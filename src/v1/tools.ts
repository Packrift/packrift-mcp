// Packrift MCP v1 tool surface: six tools that cover the buyer journey
// (find, check, price delivered, check out, quote) in one or two calls.
// Concise output is the default; response_format "detailed" returns the
// earlier full payload for integrations that were built on it.

import { z } from "zod";
import { bestEffort } from "../best-effort.js";
import { parseDimensions } from "../dimensions.js";
import { Env, shopifyQuery } from "../shopify.js";
import { searchProductsHandler } from "../tools/search_products.js";
import { recommendPackagingHandler } from "../tools/recommend_packaging.js";
import { getProductHandler } from "../tools/get_product.js";
import { getShippingEstimateHandler } from "../tools/get_shipping_estimate.js";
import { createCartUrlHandler } from "../tools/create_cart_url.js";
import { getBulkQuoteLinkHandler } from "../tools/procurement_links.js";
import {
  catalogIndex,
  entryByHandle,
  entryBySku,
  entryByVariantId,
  colorsIn,
  kindLabel,
  type CatalogEntry,
  type PackagingKind,
} from "./catalog.js";
import { coerceFitUseCase, findFits, type FitCandidate } from "./fit.js";
import { deliveredQuote, discountRules, discountSummary, freeShippingGap, liveVariants, round2 } from "./live.js";
import { clientSlugFromName, clientSlugFromSessionId, productLink, utmSourceForClient } from "./attribution.js";
import { compactItem, itemLine, money, toolResult, unitPrice, unitPriceText, type CompactItem, type V1ToolResult } from "./format.js";

export interface V1Context {
  sessionId?: string;
  userAgent?: string;
  sourceSlug?: string;
  installTarget?: string;
}

export function resolveClient(context: V1Context = {}): string | null {
  return clientSlugFromSessionId(context.sessionId) ?? clientSlugFromName(context.sourceSlug) ?? null;
}

const RESPONSE_FORMAT = {
  type: "string",
  enum: ["concise", "detailed"],
  default: "concise",
  description: "concise (default) returns the essentials. detailed returns the full catalog record; use it only when a field you need is missing.",
} as const;

const ANNOTATIONS = (title: string) => ({
  title,
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

function wantsDetailed(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && (raw as Record<string, unknown>).response_format === "detailed");
}

function withoutFormat(raw: unknown): Record<string, unknown> {
  const args = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  delete args.response_format;
  return args;
}

const QUOTE_PAGE = "https://packrift.com/pages/bulk-quote";

export function quoteLink(spec: string, opts: { sku?: string | null; quantity?: string | number | null; family?: string | null }, client: string | null): string {
  const url = new URL(QUOTE_PAGE);
  url.searchParams.set("spec", spec.slice(0, 220));
  if (opts.sku) url.searchParams.set("sku", opts.sku);
  if (opts.family) url.searchParams.set("family", opts.family);
  if (opts.quantity !== undefined && opts.quantity !== null && String(opts.quantity).trim()) url.searchParams.set("quantity", String(opts.quantity));
  url.searchParams.set("utm_source", utmSourceForClient(client));
  url.searchParams.set("utm_medium", "mcp");
  url.searchParams.set("utm_campaign", "packrift_mcp");
  url.searchParams.set("utm_content", "bulk_quote");
  return url.toString();
}

// ---------------------------------------------------------------------------
// search_products
// ---------------------------------------------------------------------------

export const searchSchemaV1 = {
  name: "search_products",
  title: "Search Packrift packaging",
  description:
    "Search Packrift's in-stock packaging catalog: corrugated shipping boxes, mailer boxes, poly and bubble mailers, poly bags, labels, packing tape, stretch film and void fill. The query can be a product type, an exact size or spec (\"12x12x12 ECT-32 box\", \"10x13 poly mailer\", \"3 inch packing tape\"), or a Packrift SKU. Returns up to 10 matches with live price, pack size, price per unit, stock and a product link. A different size is never labeled exact; when nothing matches exactly it returns the closest sizes marked as not exact and a quote link. If the buyer describes the item they are shipping rather than the packaging they want, use find_packaging_for_item instead.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "What the buyer wants, e.g. \"12x12x12 boxes\", \"white poly mailers 14.5x19\", \"SKU 1066\"." },
      limit: { type: "integer", minimum: 1, maximum: 10, default: 5, description: "Maximum results to return." },
      response_format: RESPONSE_FORMAT,
    },
    required: ["query"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS("Search Packrift packaging"),
};

const searchZod = z.object({
  query: z.string().trim().min(1).max(300),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

function sortedDims(query: string): number[] | null {
  const parsed = parseDimensions(query);
  if (!parsed) return null;
  const values = parsed.depth_in === null ? [parsed.length_in, parsed.width_in] : [parsed.length_in, parsed.width_in, parsed.depth_in];
  return values.sort((a, b) => b - a);
}

function sameDims(a: number[] | null, b: number[] | null): boolean {
  return Boolean(a && b && a.length === b.length && a.every((value, index) => Math.abs(value - b[index]!) < 0.02));
}

function entryDims(entry: CatalogEntry): number[] | null {
  return entry.dims ? [...entry.dims] : entry.flat ? [...entry.flat] : null;
}

function kindsForQuery(query: string, dims: number[]): { kinds: PackagingKind[] | null; families: string[] } {
  const q = query.toLowerCase();
  if (/poly mailer/.test(q)) return { kinds: ["poly_mailer"], families: [] };
  if (/bubble|padded/.test(q)) return { kinds: ["bubble_mailer"], families: [] };
  if (/mailer box|corrugated mailer|literature mailer/.test(q)) return { kinds: ["mailer_box"], families: [] };
  if (/mailer|envelope/.test(q)) return { kinds: ["poly_mailer", "bubble_mailer", "paper_mailer", "mailer_box"], families: [] };
  if (/\bbags?\b/.test(q)) return { kinds: null, families: ["poly_bags"] };
  if (/label/.test(q)) return { kinds: null, families: ["labels"] };
  if (/box|carton|corrugated/.test(q) || dims.length === 3) return { kinds: ["corrugated_box", "heavy_duty_box"], families: [] };
  return { kinds: ["poly_mailer", "bubble_mailer", "paper_mailer"], families: ["poly_bags"] };
}

export function nearestSizes(query: string, dims: number[], count = 3): CatalogEntry[] {
  const { kinds, families } = kindsForQuery(query, dims);
  const scored: Array<{ entry: CatalogEntry; excess: number }> = [];
  for (const entry of catalogIndex()) {
    if (entry.held || entry.sensitive) continue;
    const kindOk = kinds ? kinds.includes(entry.kind) : false;
    const familyOk = families.includes(entry.family);
    if (!kindOk && !familyOk) continue;
    const size = entryDims(entry);
    if (!size || size.length !== dims.length) continue;
    if (size.some((value, index) => value < dims[index]! - 1e-6)) continue;
    const excess = size.reduce((sum, value, index) => sum + (value - dims[index]!), 0);
    if (excess < 0.02 || excess > Math.max(6, dims[0]! * 0.6)) continue;
    scored.push({ entry, excess });
  }
  scored.sort((a, b) => a.excess - b.excess || a.entry.sku.localeCompare(b.entry.sku));
  const seen = new Set<string>();
  const out: CatalogEntry[] = [];
  for (const { entry } of scored) {
    const key = `${entry.kind}:${entry.sizeLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= count) break;
  }
  return out;
}

const HEAVY_INTENT = /heavy[- ]?duty|double[- ]?wall|triple[- ]?wall|ect[- ]?(4[4-9]|[5-9]\d)|\b(275|350|400|500|600)#/i;

/** Order results the way a buyer would: exact size first, then the strength and color asked for, then price per unit. */
export function rankSearchItems(items: CompactItem[], query: string, hasDims: boolean): void {
  const wantsHeavy = HEAVY_INTENT.test(query);
  const wantedColors = colorsIn(query);
  const order = new Map(items.map((item, index) => [item.sku, index]));
  const penalty = (item: CompactItem): number => {
    const entry = entryBySku(item.sku);
    let p = 0;
    if (hasDims && item.match !== "exact") p += 100;
    if (entry) {
      const heavy = entry.kind === "heavy_duty_box" || (entry.ect ?? 0) >= 44;
      if (wantsHeavy && !heavy && entry.family === "boxes") p += 20;
      if (!wantsHeavy && heavy) p += 20;
      if (wantedColors.length) {
        const hasWanted = wantedColors.some((color) => entry.colors.includes(color));
        if (!hasWanted && entry.colors.length) p += 30;
        else if (!hasWanted) p += 5;
      }
      if (entry.specialty && !query.toLowerCase().includes(entry.specialty.split(/[- ]/)[0]!)) p += 25;
      if (entry.kind === "other" && /\bbox(es)?\b|\bmailers?\b/i.test(query) && !/liner|insert|bin|tote/i.test(query)) p += 60;
    }
    if (!item.in_stock) p += 50;
    return p;
  };
  items.sort((a, b) => {
    const diff = penalty(a) - penalty(b);
    if (diff !== 0) return diff;
    if (hasDims) {
      const ua = a.unit_price ?? a.price ?? Number.POSITIVE_INFINITY;
      const ub = b.unit_price ?? b.price ?? Number.POSITIVE_INFINITY;
      if (ua !== ub) return ua - ub;
    }
    return (order.get(a.sku) ?? 0) - (order.get(b.sku) ?? 0);
  });
}

export async function searchProductsV1(env: Env, raw: unknown, context: V1Context = {}): Promise<V1ToolResult | unknown> {
  if (wantsDetailed(raw)) return searchProductsHandler(env, withoutFormat(raw));
  const input = searchZod.parse(withoutFormat(raw));
  const client = resolveClient(context);
  const [legacy, rules] = await Promise.all([
    searchProductsHandler(env, { query: input.query, limit: Math.min(10, Math.max(input.limit + 5, 8)) }),
    discountRules(env),
  ]);
  const queryDims = sortedDims(input.query);
  const rows = Array.isArray(legacy) ? (legacy as Array<Record<string, any>>) : [];
  const items: CompactItem[] = [];
  for (const row of rows) {
    const entry = entryBySku(row.approved_sku) ?? entryByHandle(row.handle);
    if (!entry || entry.held) continue;
    const match = queryDims ? (sameDims(queryDims, entryDims(entry)) ? "exact" : "close") : undefined;
    items.push(
      compactItem(
        entry,
        {
          price: typeof row.price_range?.min === "number" ? row.price_range.min : null,
          inStock: Boolean(row.in_stock),
          url: productLink(String(row.url ?? `https://packrift.com/products/${entry.handle}`), client, "search"),
          title: row.title,
          imageUrl: row.primary_image_url ?? null,
        },
        match
      )
    );
  }
  rankSearchItems(items, input.query, queryDims !== null);
  items.splice(input.limit);
  const discountLine = discountSummary(rules);
  if (items.length) {
    const exactCount = items.filter((item) => item.match === "exact").length;
    const header = queryDims
      ? `${exactCount ? `${exactCount} exact-size match${exactCount === 1 ? "" : "es"}` : "No exact size"} for "${input.query}" (live price and stock):`
      : `${items.length} match${items.length === 1 ? "" : "es"} for "${input.query}" (live price and stock):`;
    const text = [
      header,
      ...items.map((item, index) => itemLine(item, index)),
      discountLine,
      "Next: when the buyer picks an item and quantity, call create_cart_url. For a delivered total to a ZIP code, call get_shipping_estimate.",
    ].filter(Boolean).join("\n");
    return toolResult(text, { query: input.query, results: items, pricing_note: discountLine || null });
  }

  // No exact match: offer the closest larger sizes, clearly labeled, plus a quote link.
  const nearby = queryDims ? nearestSizes(input.query, queryDims, 3) : [];
  const live = nearby.length ? await liveVariants(env, nearby.map((entry) => entry.variantId)) : new Map();
  const close: CompactItem[] = [];
  for (const entry of nearby) {
    const facts = live.get(entry.variantId);
    if (!facts || !facts.active) continue;
    close.push(compactItem(entry, { price: facts.price, inStock: facts.available, url: productLink(facts.url, client, "closest_size"), title: facts.title, imageUrl: facts.imageUrl }, "close"));
  }
  const quote = quoteLink(input.query, {}, client);
  const text = [
    `No exact match in Packrift's catalog for "${input.query}".`,
    close.length ? "Closest sizes in stock (not exact; confirm with the buyer before suggesting them):" : "",
    ...close.map((item, index) => itemLine(item, index)),
    `For this exact spec, a custom size, printing or pallet quantities, the buyer can request a quote: ${quote}`,
    "Try search_products again with a broader query (for example the product type without a size), or find_packaging_for_item if the buyer can give the item's dimensions.",
  ].filter(Boolean).join("\n");
  return toolResult(text, { query: input.query, results: [], closest_sizes: close, quote_url: quote });
}

// ---------------------------------------------------------------------------
// find_packaging_for_item
// ---------------------------------------------------------------------------

export const fitSchemaV1 = {
  name: "find_packaging_for_item",
  title: "Find packaging that fits an item",
  description:
    "Find the right Packrift box or mailer for an item the buyer ships. Give the item's length, width and height in inches, its weight, and what it is (for example \"ceramic mug\", \"t-shirt\", \"hardcover book\", \"laptop\"). Applies cushioning space by item type (2 in per side for fragile items), checks box strength against the weight, and compares billable shipping weight (UPS/FedEx and USPS dimensional weight). Returns up to 5 in-stock options with inside size, fit, strength, live price and a product link. Use search_products instead when the buyer already knows the packaging size they want.",
  inputSchema: {
    type: "object",
    properties: {
      item_length_in: { type: "number", exclusiveMinimum: 0, description: "Item length in inches." },
      item_width_in: { type: "number", exclusiveMinimum: 0, description: "Item width in inches." },
      item_depth_in: { type: "number", exclusiveMinimum: 0, description: "Item height or depth in inches." },
      item_weight_lb: { type: "number", minimum: 0, description: "Item weight in pounds. Use your best estimate; defaults to 1." },
      use_case: {
        type: "string",
        description: "What the item is or how it ships, in plain words: \"fragile glass jar\", \"folded hoodie\", \"paperback book\", \"electronics\", \"heavy auto parts\". Free text is fine.",
      },
      packaging: { type: "string", enum: ["any", "box", "mailer"], default: "any", description: "Limit results to boxes or mailers." },
      limit: { type: "integer", minimum: 1, maximum: 5, default: 3, description: "Number of options to return." },
      response_format: RESPONSE_FORMAT,
    },
    required: ["item_length_in", "item_width_in", "item_depth_in"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS("Find packaging that fits an item"),
};

const fitZod = z.object({
  item_length_in: z.coerce.number().positive().max(200),
  item_width_in: z.coerce.number().positive().max(200),
  item_depth_in: z.coerce.number().positive().max(200),
  item_weight_lb: z.coerce.number().min(0).max(2000).optional(),
  use_case: z.string().max(200).optional(),
  packaging: z.enum(["any", "box", "mailer"]).default("any"),
  limit: z.coerce.number().int().min(1).max(5).default(3),
});

function fitLine(candidate: FitCandidate, item: CompactItem, index: number): string {
  const parts = [`${index + 1}. SKU ${item.sku}: ${item.title}`];
  if (candidate.fitKind === "box") {
    const c = candidate.clearancePerSide;
    parts.push(`inside ${candidate.entry.sizeLabel}, about ${formatClearance(c)} per side (${candidate.fitLabel} fit)`);
  } else if (candidate.fitKind === "flat") {
    parts.push(`${candidate.entry.sizeLabel} ${kindLabel(candidate.entry.kind)} (${candidate.fitLabel} fit)`);
  } else {
    parts.push(`${candidate.entry.sizeLabel} tube (${candidate.fitLabel} fit)`);
  }
  if (candidate.strengthNote) parts.push(candidate.strengthNote);
  if (candidate.billable && candidate.fitKind === "box") {
    const b = candidate.billable;
    parts.push(`bills about ${b.upsFedexLb} lb UPS/FedEx, ${b.uspsLb} lb USPS`);
  }
  const price = item.price === null ? "price at checkout" : item.pack && item.pack > 1 ? `${money(item.price)} per pack of ${item.pack}${item.unit_price !== null ? ` (${unitPriceText(item.unit_price)})` : ""}` : money(item.price);
  parts.push(price, item.in_stock ? "in stock" : "out of stock", item.url);
  return parts.join(" | ");
}

function formatClearance(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const f = (n: number) => `${Number(n.toFixed(2))} in`;
  return Math.abs(max - min) < 0.13 ? f(min) : `${f(min)} to ${f(max)}`;
}

export async function findPackagingV1(env: Env, raw: unknown, context: V1Context = {}): Promise<V1ToolResult | unknown> {
  if (wantsDetailed(raw)) {
    const args = withoutFormat(raw);
    return recommendPackagingHandler(env, { item_weight_lb: 1, use_case: "ecommerce", ...args });
  }
  const args = withoutFormat(raw);
  if (args.item_depth_in === undefined && args.item_height_in !== undefined) args.item_depth_in = args.item_height_in;
  delete args.item_height_in;
  const input = fitZod.parse(args);
  const client = resolveClient(context);
  const weight = input.item_weight_lb ?? 1;
  const useCase = coerceFitUseCase(input.use_case, weight);
  const itemLabel = `${fmt(input.item_length_in)} x ${fmt(input.item_width_in)} x ${fmt(input.item_depth_in)} in, ${fmt(weight)} lb${input.use_case ? ` (${input.use_case.slice(0, 60)})` : ""}`;

  if (weight > 150) {
    const quote = quoteLink(`Packaging for a ${itemLabel} item`, { family: "boxes" }, client);
    return toolResult(
      `An item of ${itemLabel} is beyond parcel limits. Packrift quotes crates, pallets and freight packaging on request: ${quote}`,
      { item: itemLabel, results: [], quote_url: quote }
    );
  }

  const fit = findFits({
    length: input.item_length_in,
    width: input.item_width_in,
    height: input.item_depth_in,
    weightLb: weight,
    useCase,
    packaging: input.packaging,
    limit: input.limit,
    requestText: input.use_case ?? "",
  });
  const live = fit.candidates.length ? await liveVariants(env, fit.candidates.map((c) => c.entry.variantId)) : new Map();
  const available: Array<{ candidate: FitCandidate; item: CompactItem }> = [];
  const unavailable: Array<{ candidate: FitCandidate; item: CompactItem }> = [];
  for (const candidate of fit.candidates) {
    const facts = live.get(candidate.entry.variantId);
    if (!facts || !facts.active) continue;
    const item = compactItem(candidate.entry, {
      price: facts.price,
      inStock: facts.available,
      url: productLink(facts.url, client, "fit"),
      title: facts.title,
      imageUrl: facts.imageUrl,
    });
    (facts.available ? available : unavailable).push({ candidate, item });
  }
  const tier = { snug: 0, good: 1, roomy: 2 } as const;
  const nearLimit = (candidate: FitCandidate) => Boolean(candidate.strengthNote && /rated to (\d+) lb/.exec(candidate.strengthNote) && weight > 0.7 * Number(/rated to (\d+) lb/.exec(candidate.strengthNote)![1]));
  const byValue = (a: { candidate: FitCandidate; item: CompactItem }, b: { candidate: FitCandidate; item: CompactItem }) =>
    tier[a.candidate.fitLabel] - tier[b.candidate.fitLabel] ||
    Number(nearLimit(a.candidate)) - Number(nearLimit(b.candidate)) ||
    (a.item.unit_price ?? a.item.price ?? Infinity) - (b.item.unit_price ?? b.item.price ?? Infinity);
  available.sort(byValue);
  unavailable.sort(byValue);
  const picked = [...available, ...unavailable].slice(0, input.limit);
  for (const { candidate } of picked) {
    if (nearLimit(candidate) && candidate.strengthNote) candidate.strengthNote += " (close to its rated limit; a stronger box adds margin)";
  }
  const required = fit.requiredInside.map((n) => fmt(n)).join(" x ");
  if (!picked.length) {
    const quote = quoteLink(`Packaging for a ${itemLabel} item (${useCase})`, {}, client);
    return toolResult(
      [
        `No stocked Packrift box or mailer fits ${itemLabel} with the space this item needs (at least ${required} in inside).`,
        fit.advice,
        `Packrift can quote a custom size: ${quote}`,
      ].join("\n"),
      { item: itemLabel, use_case: useCase, required_inside_in: fit.requiredInside, results: [], quote_url: quote }
    );
  }
  const rules = await discountRules(env);
  const lines = picked.map(({ candidate, item }, index) => fitLine(candidate, item, index));
  const text = [
    `Item ${itemLabel}. Treated as ${useCase === "general" ? "a general ecommerce item" : `${useCase}`}; needs at least ${required} in inside.`,
    fit.advice,
    ...lines,
    discountSummary(rules),
    "Next: when the buyer picks one and a quantity, call create_cart_url. get_shipping_estimate gives the delivered total to their ZIP code.",
  ].filter(Boolean).join("\n");
  return toolResult(text, {
    item: { length_in: input.item_length_in, width_in: input.item_width_in, height_in: input.item_depth_in, weight_lb: weight, use_case: useCase },
    required_inside_in: fit.requiredInside,
    advice: fit.advice,
    results: picked.map(({ candidate, item }) => ({
      ...item,
      fit: candidate.fitLabel,
      clearance_per_side_in: candidate.clearancePerSide,
      strength: candidate.strengthNote,
      billable_weight_lb: candidate.billable ? { ups_fedex: candidate.billable.upsFedexLb, usps: candidate.billable.uspsLb } : null,
    })),
  });
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

// ---------------------------------------------------------------------------
// get_product
// ---------------------------------------------------------------------------

export const productSchemaV1 = {
  name: "get_product",
  title: "Get Packrift product details",
  description:
    "Get one Packrift product by SKU (or product handle): specs such as inside size, material, strength and pack count, live price and price per unit, stock, whether a quantity can ship now, volume pricing, nearby sizes and the product link. Use after search_products or find_packaging_for_item when the buyer wants more detail before choosing.",
  inputSchema: {
    type: "object",
    properties: {
      sku: { type: "string", description: "Packrift SKU, e.g. \"1066\"." },
      handle: { type: "string", description: "Product handle from a product URL, if you have it instead of a SKU." },
      quantity: { type: "integer", minimum: 1, description: "Optional number of packs the buyer wants, to check it can ship now." },
      response_format: RESPONSE_FORMAT,
    },
    additionalProperties: false,
  },
  annotations: ANNOTATIONS("Get Packrift product details"),
};

const productZod = z.object({
  sku: z.string().trim().min(1).max(80).optional(),
  handle: z.string().trim().min(1).max(200).optional(),
  variant_id: z.union([z.string(), z.number()]).optional(),
  quantity: z.coerce.number().int().min(1).max(100000).optional(),
});

const PRODUCT_QUERY = `
  query PackriftV1Product($handle: String!) {
    productByHandle(handle: $handle) {
      title
      status
      onlineStoreUrl
      featuredImage { url }
      metafields(first: 80, namespace: "custom") { edges { node { key value } } }
      variants(first: 3) {
        edges { node { id price availableForSale inventoryQuantity inventoryItem { measurement { weight { value unit } } } } }
      }
    }
  }
`;

interface ProductV1Node {
  title: string;
  status: string;
  onlineStoreUrl: string | null;
  featuredImage: { url: string } | null;
  metafields: { edges: Array<{ node: { key: string; value: string } }> };
  variants: {
    edges: Array<{
      node: {
        id: string;
        price: string;
        availableForSale: boolean;
        inventoryQuantity: number | null;
        inventoryItem: { measurement: { weight: { value: number; unit: string } | null } | null } | null;
      };
    }>;
  };
}

function resolveEntry(input: { sku?: string; handle?: string; variant_id?: string | number }): CatalogEntry | null {
  return entryBySku(input.sku) ?? entryByHandle(input.handle) ?? entryByVariantId(input.variant_id !== undefined ? String(input.variant_id) : null);
}

function notInCatalogError(label: string): never {
  throw new Error(`${label} is not in Packrift's current catalog. Use search_products to find the item by size, type or name.`);
}

export async function getProductV1(env: Env, raw: unknown, context: V1Context = {}): Promise<V1ToolResult | unknown> {
  const args = withoutFormat(raw);
  const input = productZod.parse(args);
  if (!input.sku && !input.handle && input.variant_id === undefined) throw new Error("Provide a sku (preferred) or a handle.");
  const entry = resolveEntry(input);
  if (!entry) notInCatalogError(input.sku ? `SKU ${input.sku}` : `Product ${input.handle ?? input.variant_id}`);
  if (wantsDetailed(raw)) return getProductHandler(env, { handle: entry.handle });
  const client = resolveClient(context);
  const [data, rules] = await Promise.all([
    shopifyQuery<{ productByHandle: ProductV1Node | null }>(env, PRODUCT_QUERY, { handle: entry.handle }, { timeoutMs: 6000 }),
    discountRules(env),
  ]);
  const p = data.productByHandle;
  if (!p || p.status !== "ACTIVE") notInCatalogError(`SKU ${entry.sku}`);
  const variant = p.variants.edges.map((e) => e.node).find((v) => v.id.endsWith(`/${entry.variantId}`)) ?? p.variants.edges[0]?.node;
  if (!variant) notInCatalogError(`SKU ${entry.sku}`);
  const mf = new Map(p.metafields.edges.map((e) => [e.node.key, e.node.value]));
  const specs: Array<{ name: string; value: string }> = [];
  for (let i = 1; i <= 8; i += 1) {
    const name = mf.get(`spec${i}_name`)?.trim();
    const value = mf.get(`spec${i}_value`)?.trim();
    if (name && value) specs.push({ name, value: value.slice(0, 120) });
  }
  const summary = cleanSummary(mf.get("catalog_description") ?? mf.get("ai_summary") ?? "");
  const nearby = (mf.get("ux_substitute_handles") ?? "")
    .split(",")
    .map((handle) => entryByHandle(handle.trim()))
    .filter((e): e is CatalogEntry => Boolean(e && !e.held && e.sku !== entry.sku))
    .slice(0, 3);
  const price = Number(variant.price);
  const inStock = variant.availableForSale;
  const inventory = typeof variant.inventoryQuantity === "number" ? variant.inventoryQuantity : null;
  const canShip =
    input.quantity === undefined ? null : !inStock ? false : inventory === null || inventory <= 0 ? inStock : inventory >= input.quantity;
  const weight = variant.inventoryItem?.measurement?.weight;
  const multiples = Number(mf.get("order_in_multiples_of"));
  const url = productLink(p.onlineStoreUrl ?? `https://packrift.com/products/${entry.handle}`, client, "product");
  const item = compactItem(entry, { price, inStock, url, title: p.title, imageUrl: p.featuredImage?.url ?? null });
  const lines = [
    `SKU ${entry.sku}: ${p.title}`,
    `${item.pack && item.pack > 1 ? `${money(price)} per pack of ${item.pack}${item.unit_price !== null ? ` (${unitPriceText(item.unit_price)})` : ""}` : money(price)} | ${inStock ? "in stock" : "out of stock"}${weight?.value ? ` | ${fmt(Number(weight.value))} ${String(weight.unit).toLowerCase()} per pack` : ""}`,
  ];
  if (canShip !== null) {
    lines.push(
      canShip
        ? `Enough stock to ship ${input.quantity} pack${input.quantity === 1 ? "" : "s"} now.`
        : `Not enough stock for ${input.quantity} packs right now; get_bulk_quote_link can arrange a larger or scheduled order.`
    );
  }
  if (specs.length) lines.push(`Specs: ${specs.map((s) => `${s.name}: ${s.value}`).join("; ")}`);
  if (summary) lines.push(summary);
  if (Number.isFinite(multiples) && multiples > 1 && (!item.pack || multiples !== item.pack)) lines.push(`Sold in multiples of ${multiples}.`);
  const discountLine = discountSummary(rules);
  if (discountLine) lines.push(discountLine);
  if (nearby.length) lines.push(`Nearby sizes: ${nearby.map((e) => `SKU ${e.sku} (${e.sizeLabel ?? e.title})`).join(", ")}.`);
  lines.push(`Product page: ${url}`);
  lines.push("Next: create_cart_url with this sku and the buyer's quantity, or get_shipping_estimate for a delivered total.");
  return toolResult(lines.join("\n"), {
    ...item,
    specs,
    summary: summary || null,
    weight_per_pack: weight?.value ? { value: Number(weight.value), unit: String(weight.unit).toLowerCase() } : null,
    quantity_requested: input.quantity ?? null,
    can_ship_quantity_now: canShip,
    nearby_sizes: nearby.map((e) => ({ sku: e.sku, size: e.sizeLabel, title: e.title })),
    pricing_note: discountLine || null,
  });
}

function cleanSummary(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.startsWith("{")) return "";
  const firstSentences = text.match(/^(.{40,320}?[.!?])(\s|$)/)?.[1] ?? text.slice(0, 280);
  return firstSentences;
}

// ---------------------------------------------------------------------------
// get_shipping_estimate
// ---------------------------------------------------------------------------

export const shippingSchemaV1 = {
  name: "get_shipping_estimate",
  title: "Estimate delivered cost",
  description:
    "Estimate the delivered cost of a Packrift order to a US ZIP code, using the same shipping rates and automatic volume discounts as Packrift checkout. Give the items as SKU and quantity (number of packs). Returns the subtotal after discounts, shipping options (free shipping applied when eligible), the delivered total and the delivered cost per unit. Tax is not included; checkout shows the final amount.",
  inputSchema: {
    type: "object",
    properties: {
      destination_postal_code: { type: "string", description: "US delivery ZIP code, e.g. \"75201\"." },
      destination_state: { type: "string", description: "Optional two-letter state code, e.g. \"TX\", for a more precise estimate." },
      items: {
        type: "array",
        minItems: 1,
        maxItems: 25,
        description: "Items to price.",
        items: {
          type: "object",
          properties: {
            sku: { type: "string", description: "Packrift SKU." },
            quantity: { type: "integer", minimum: 1, description: "Number of packs." },
          },
          required: ["sku", "quantity"],
        },
      },
      response_format: RESPONSE_FORMAT,
    },
    required: ["destination_postal_code", "items"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS("Estimate delivered cost"),
};

const shippingLineZod = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object") return value;
    const line = { ...(value as Record<string, unknown>) };
    if (line.quantity === undefined && line.qty !== undefined) line.quantity = line.qty;
    if (typeof line.variant_id === "number") line.variant_id = String(line.variant_id);
    return line;
  },
  z.object({
    sku: z.string().trim().min(1).max(80).optional(),
    variant_id: z.string().trim().min(1).max(40).optional(),
    quantity: z.coerce.number().int().min(1).max(100000),
  })
);

const shippingZod = z.object({
  destination_postal_code: z.string().trim().min(3).max(12),
  country: z.preprocess((value) => (typeof value === "string" ? value.trim().toUpperCase() : value), z.literal("US", { errorMap: () => ({ message: "Packrift ships within the United States only" }) })).default("US"),
  destination_state: z.string().trim().min(2).max(3).optional(),
  destination_address: z.object({ address1: z.string().optional(), city: z.string().optional(), province_code: z.string().optional() }).partial().optional(),
  items: z.array(shippingLineZod).min(1).max(25),
});

function resolveLines(lines: Array<{ sku?: string; variant_id?: string; quantity: number }>): Array<{ entry: CatalogEntry; quantity: number }> {
  return lines.map((line) => {
    const entry = entryBySku(line.sku) ?? entryByVariantId(line.variant_id ?? null);
    if (!entry) notInCatalogError(line.sku ? `SKU ${line.sku}` : `Variant ${line.variant_id}`);
    if (entry.held) {
      throw new Error(`SKU ${entry.sku} ships by freight and needs a quote; use get_bulk_quote_link instead.`);
    }
    return { entry, quantity: line.quantity };
  });
}

export async function getShippingEstimateV1(env: Env, raw: unknown, context: V1Context = {}): Promise<V1ToolResult | unknown> {
  if (wantsDetailed(raw)) return getShippingEstimateHandler(env, withoutFormat(raw));
  const input = shippingZod.parse(withoutFormat(raw));
  const client = resolveClient(context);
  const lines = resolveLines(input.items);
  const quote = await deliveredQuote(
    env,
    lines.map((line) => ({ variantId: line.entry.variantId, quantity: line.quantity })),
    {
      postalCode: input.destination_postal_code,
      country: input.country,
      provinceCode: input.destination_state ?? input.destination_address?.province_code ?? null,
      city: input.destination_address?.city ?? null,
      address1: input.destination_address?.address1 ?? null,
    }
  );
  const units = lines.length === 1 && lines[0]!.entry.pack ? lines[0]!.quantity * lines[0]!.entry.pack! : null;
  const perUnit = units && quote.total !== null ? round2Unit(quote.total / units) : null;
  const itemText = lines.map((line) => `${line.quantity} x SKU ${line.entry.sku} (${line.entry.title})`).join("; ");
  const rateText = quote.rates.length
    ? quote.rates.map((rate) => `${rate.title}: ${rate.free ? `free (was ${money(rate.price)})` : money(rate.price)}`).join("; ")
    : "no parcel rate available for this destination; request a freight quote";
  const text = [
    `Delivered estimate to ${input.destination_postal_code} ${input.country}: ${itemText}.`,
    `Subtotal ${money(quote.subtotal)}${quote.discounts > 0 ? ` after ${money(quote.discounts)} volume discount (was ${money(quote.subtotalBeforeDiscounts)})` : ""}.`,
    `Shipping: ${rateText}.`,
    quote.total !== null ? `Delivered total ${money(quote.total)} before tax${perUnit !== null ? `, about ${perUnit >= 1 ? money(perUnit) : `$${perUnit.toFixed(3)}`} per unit` : ""}.` : "",
    freeShippingGap(quote, await discountRules(env)),
    "Estimate from Packrift's checkout rates; tax and the final amount are shown at checkout.",
    quote.total === null ? `Freight quote: ${quoteLink(itemText, {}, client)}` : "Next: create_cart_url with the same items to get the checkout link.",
  ].filter(Boolean).join("\n");
  return toolResult(text, {
    destination: { postal_code: input.destination_postal_code, country: input.country },
    items: lines.map((line) => ({ sku: line.entry.sku, quantity: line.quantity, title: line.entry.title })),
    subtotal_before_discounts: quote.subtotalBeforeDiscounts,
    volume_discount: quote.discounts,
    subtotal: quote.subtotal,
    shipping_options: quote.rates.map((rate) => ({ title: rate.title, price: rate.price, free: rate.free, charged: rate.charged })),
    delivered_total_before_tax: quote.total,
    delivered_per_unit: perUnit,
  });
}

function round2Unit(n: number): number {
  return n >= 1 ? round2(n) : Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// create_cart_url
// ---------------------------------------------------------------------------

export const cartSchemaV1 = {
  name: "create_cart_url",
  title: "Create Packrift checkout link",
  description:
    "Create a checkout link on packrift.com for items the buyer has chosen. Give each item as SKU and quantity (number of packs); up to 25 lines. The link opens the buyer's cart with those items and automatic volume discounts; the buyer reviews and pays on packrift.com. This tool never places an order or charges anyone. Call it only after the buyer confirms the items and quantities.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 25,
        items: {
          type: "object",
          properties: {
            sku: { type: "string", description: "Packrift SKU." },
            quantity: { type: "integer", minimum: 1, description: "Number of packs." },
          },
          required: ["sku", "quantity"],
        },
      },
      discount_code: { type: "string", description: "Optional discount code the buyer has." },
      response_format: RESPONSE_FORMAT,
    },
    required: ["items"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS("Create Packrift checkout link"),
};

const cartZod = z.object({
  items: z.array(shippingLineZod).min(1).max(25).optional(),
  sku: z.string().trim().min(1).max(80).optional(),
  quantity: z.coerce.number().int().min(1).max(100000).optional(),
  discount_code: z.string().trim().min(1).max(60).optional(),
  source_context: z.string().trim().min(1).max(80).optional(),
});

/** Stateless checkout link: the cart lines and source travel in the URL, so creating it stores nothing. */
export function checkoutLink(lines: Array<{ variantId: string; quantity: number }>, utmSource: string, handoffId: string | null): string {
  const path = lines.map((line) => `${line.variantId}:${line.quantity}`).join(",");
  const url = new URL(`https://mcp.packrift.com/c/${path}`);
  url.searchParams.set("s", utmSource);
  if (handoffId) url.searchParams.set("k", handoffId.replace(/^mcp_handoff_/, "").slice(0, 36));
  return url.toString();
}

export async function createCartUrlV1(env: Env, raw: unknown, context: V1Context = {}): Promise<V1ToolResult | unknown> {
  const args = withoutFormat(raw);
  const input = cartZod.parse(args);
  const requested = input.items?.length ? input.items : input.sku ? [{ sku: input.sku, quantity: input.quantity ?? 1 }] : [];
  if (!requested.length) throw new Error("Provide items as [{sku, quantity}].");
  const lines = resolveLines(requested);
  const client = resolveClient(context);
  const legacyArgs: Record<string, unknown> = {
    items: lines.map((line) => ({ variant_id: line.entry.variantId, qty: line.quantity })),
  };
  if (lines.length === 1) {
    legacyArgs.selected_sku = lines[0]!.entry.sku;
  }
  if (input.discount_code) legacyArgs.discount_code = input.discount_code;
  if (input.source_context) legacyArgs.source_context = input.source_context;
  const legacy = (await createCartUrlHandler(env, legacyArgs, {
    sessionId: context.sessionId ?? null,
    sourceSlug: client ?? context.sourceSlug ?? null,
    installTarget: context.installTarget ?? null,
  })) as Record<string, any>;
  if (wantsDetailed(raw)) return legacy;
  const finalUrl = String(legacy.final_cart_url ?? legacy.url);
  const utmSource = String(legacy.utm?.source ?? utmSourceForClient(client));
  const checkoutUrl = checkoutLink(
    lines.map((line) => ({ variantId: line.entry.variantId, quantity: line.quantity })),
    utmSource,
    typeof legacy.mcp_handoff_id === "string" ? legacy.mcp_handoff_id : null
  );
  const live = await bestEffort(() => liveVariants(env, lines.map((line) => line.entry.variantId)), new Map(), 2500);
  const priced = lines.map((line) => {
    const facts = live.get(line.entry.variantId);
    const price = facts ? facts.price : null;
    return { sku: line.entry.sku, title: facts?.title ?? line.entry.title, quantity: line.quantity, price_per_pack: price, line_total: price === null ? null : round2(price * line.quantity), in_stock: facts?.available ?? null };
  });
  const listTotal = priced.every((line) => line.line_total !== null) ? round2(priced.reduce((sum, line) => sum + (line.line_total ?? 0), 0)) : null;
  const text = [
    `Checkout link: ${checkoutUrl}`,
    ...priced.map((line) => `- ${line.quantity} x SKU ${line.sku}: ${line.title}${line.price_per_pack !== null ? ` at ${money(line.price_per_pack)} = ${money(line.line_total)}` : ""}${line.in_stock === false ? " (currently out of stock)" : ""}`),
    listTotal !== null ? `List total ${money(listTotal)} before automatic volume discounts, shipping and tax.` : "",
    "The link opens the buyer's cart on packrift.com; they review and pay there. Nothing is ordered until they check out.",
  ].filter(Boolean).join("\n");
  return toolResult(text, {
    checkout_url: checkoutUrl,
    cart_url: finalUrl,
    lines: priced,
    list_total: listTotal,
    places_order: false,
  });
}

// ---------------------------------------------------------------------------
// get_bulk_quote_link
// ---------------------------------------------------------------------------

export const quoteSchemaV1 = {
  name: "get_bulk_quote_link",
  title: "Request a bulk or custom quote",
  description:
    "Get a pre-filled quote request link for pallet or recurring quantities, custom sizes, printed packaging, freight orders, or any spec Packrift does not stock exactly. The buyer submits the form on packrift.com and Packrift replies by email with pricing. Returns the link and what to include.",
  inputSchema: {
    type: "object",
    properties: {
      requested_spec: { type: "string", description: "What the buyer needs, e.g. \"2,000 18x12x12 ECT-44 boxes, printed 1 color\"." },
      quantity: { type: "string", description: "Quantity in units or packs, if known." },
      sku: { type: "string", description: "Related Packrift SKU, if any." },
      response_format: RESPONSE_FORMAT,
    },
    required: ["requested_spec"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS("Request a bulk or custom quote"),
};

export async function getBulkQuoteLinkV1(env: Env, raw: unknown, context: V1Context = {}): Promise<V1ToolResult | unknown> {
  const args = withoutFormat(raw);
  const legacy = (await getBulkQuoteLinkHandler(env, args)) as Record<string, any>;
  if (wantsDetailed(raw)) return legacy;
  const client = resolveClient(context);
  const spec = String(args.requested_spec ?? "");
  const url = quoteLink(spec, { sku: legacy.sku ?? null, quantity: (args.quantity as string | number | undefined) ?? null, family: legacy.family ?? null }, client);
  const text = [
    `Quote request link: ${url}`,
    "The form is pre-filled with the spec. The buyer adds their email, delivery ZIP, quantity and timing, and Packrift replies with pricing by email.",
    "Helpful details: inside dimensions, board strength or thickness, color or print, quantity per order and how often they reorder.",
  ].join("\n");
  return toolResult(text, { quote_url: url, requested_spec: spec, sku: legacy.sku ?? null });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface V1ToolDef {
  schema: { name: string; title: string; description: string; inputSchema: unknown; annotations: Record<string, unknown> };
  handler: (env: Env, args: unknown, context?: V1Context) => Promise<unknown>;
}

export const V1_TOOLS: V1ToolDef[] = [
  { schema: searchSchemaV1, handler: searchProductsV1 },
  { schema: fitSchemaV1, handler: findPackagingV1 },
  { schema: productSchemaV1, handler: getProductV1 },
  { schema: shippingSchemaV1, handler: getShippingEstimateV1 },
  { schema: cartSchemaV1, handler: createCartUrlV1 },
  { schema: quoteSchemaV1, handler: getBulkQuoteLinkV1 },
];

export const V1_TOOL_NAMES = new Set(V1_TOOLS.map((tool) => tool.schema.name));

export const V1_SERVER_INSTRUCTIONS =
  "Packrift sells packaging supplies in the United States: corrugated shipping boxes, mailer boxes, poly and bubble mailers, poly bags, labels, packing tape, stretch film and void fill. Use search_products when the buyer names a product, size or SKU, and find_packaging_for_item when they describe the item they ship. Results include live price and stock, so after the buyer confirms an item and quantity you can call create_cart_url directly; it returns a packrift.com checkout link and never places an order. get_product gives specs, volume pricing and whether a quantity can ship now. get_shipping_estimate gives a delivered total to a ZIP code with automatic volume discounts and free shipping applied. Use get_bulk_quote_link for pallet quantities, custom or printed packaging, freight, or when nothing matches exactly. Never present a different size as an exact match.";
