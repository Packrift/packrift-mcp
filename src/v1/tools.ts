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
import { billableWeight, coerceFitUseCase, cushioningLb, findFits, packedSize, sizeKey, type FitCandidate } from "./fit.js";
import {
  basketPricing,
  deliveredQuote,
  discountLadder,
  discountRules,
  freeShippingNote,
  liveVariants,
  percentAtQuantity,
  round2,
  tiersForProduct,
  volumePricingLine,
  type LiveVariant,
} from "./live.js";
import { clientSlugFromName, clientSlugFromSessionId, productLink, utmSourceForClient } from "./attribution.js";
import { compactItem, fixMojibake, itemLine, money, toolResult, unitPrice, unitPriceText, type CompactItem, type V1ToolResult } from "./format.js";

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

// Output schemas are deliberately permissive: every field is optional and extra
// fields are allowed, so the detailed payload validates too.
const STR = { type: "string" } as const;
const ARR = { type: "array" } as const;
const outputSchema = (properties: Record<string, unknown>) => ({ type: "object", properties, additionalProperties: true });

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

/**
 * Detailed responses come from the earlier tool layer. Keep their attribution on the calling
 * assistant and drop hints that name tools this server no longer lists.
 */
export function sanitizeDetailed(value: unknown, client: string | null): unknown {
  const source = utmSourceForClient(client);
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return node.replace(/([?&]utm_source=)chatgpt(?:-mcp)?(?=&|$)/g, `$1${encodeURIComponent(source)}`);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (key === "required_before_presenting") continue;
        // Shipping-rate handles are signed carrier tokens, not buyer information.
        if (key === "handle" && typeof child === "string" && child.startsWith("eyJ")) continue;
        if (key === "utm_source" && typeof child === "string" && /^chatgpt(?:-mcp)?$/.test(child)) {
          out[key] = source;
          continue;
        }
        out[key] = walk(child);
      }
      return out;
    }
    return node;
  };
  return walk(value);
}

const QUOTE_PAGE = "https://packrift.com/pages/bulk-quote";

export function quoteLink(spec: string, opts: { sku?: string | null; quantity?: string | number | null; family?: string | null }, client: string | null): string {
  const url = new URL(QUOTE_PAGE);
  url.searchParams.set("spec", spec.slice(0, 220));
  if (opts.sku) url.searchParams.set("sku", opts.sku);
  if (opts.family) url.searchParams.set("family", opts.family);
  if (opts.quantity !== undefined && opts.quantity !== null && String(opts.quantity).trim()) url.searchParams.set("quantity", String(opts.quantity));
  url.searchParams.set("utm_source", utmSourceForClient(client));
  url.searchParams.set("utm_medium", "mcp_tool");
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
  outputSchema: outputSchema({ query: STR, results: ARR, closest_sizes: ARR, quote_url: STR }),
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

/** The packaging style a query asks for, when it names one. */
export function styleForQuery(query: string): PackagingKind[] | null {
  const q = query.toLowerCase();
  if (/mailer box|corrugated mailer|literature mailer/.test(q)) return ["mailer_box"];
  if (/bubble|padded/.test(q)) return ["bubble_mailer"];
  if (/poly mailer/.test(q)) return ["poly_mailer"];
  if (/\bbox(es)?\b|carton|corrugated/.test(q) && !/mailer/.test(q)) return ["corrugated_box", "heavy_duty_box"];
  return null;
}

/** An exact size in the wrong style (a shipping box for "mailer box", a liner for "boxes") is related, not exact. */
export function refineMatch(entry: CatalogEntry, query: string, match: CompactItem["match"]): CompactItem["match"] {
  if (match !== "exact") return match;
  if (entry.kind === "other" && /\bbox(es)?\b|\bmailers?\b/i.test(query) && !/liner|insert|bin|tote|bag/i.test(query)) return "related";
  const style = styleForQuery(query);
  if (style && entry.kind !== "other" && !style.includes(entry.kind)) return "related";
  return match;
}

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
    if (item.match === "related") p += 40;
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
    const match = queryDims ? refineMatch(entry, input.query, sameDims(queryDims, entryDims(entry)) ? "exact" : "close") : undefined;
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
  const exactTotal = items.filter((item) => item.match === "exact").length;
  items.splice(input.limit);
  const discountLine = volumePricingLine(rules, items.map((item) => ({ sku: item.sku, productId: entryBySku(item.sku)?.productId ?? null })));
  if (items.length) {
    const exactShown = items.filter((item) => item.match === "exact").length;
    const header = queryDims
      ? exactShown
        ? `${exactTotal > exactShown ? `Top ${exactShown} of ${exactTotal}` : exactShown} exact-size match${exactTotal === 1 ? "" : "es"} for "${input.query}" (live price and stock):`
        : `No exact match for "${input.query}". Nearest items (live price and stock):`
      : `${items.length} match${items.length === 1 ? "" : "es"} for "${input.query}" (live price and stock):`;
    const text = [
      header,
      ...items.map((item, index) => itemLine(item, index)),
      discountLine,
      "Next: when the buyer confirms an item and quantity (in packs), call create_cart_url. For a delivered total to a ZIP code, call get_shipping_estimate.",
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
  outputSchema: outputSchema({ required_inside_in: ARR, advice: STR, results: ARR, quote_url: STR }),
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

interface PricedFit {
  candidate: FitCandidate;
  item: CompactItem;
  live: LiveVariant;
  value: number;
  packedLb: number | null;
  billable: { upsFedexLb: number; uspsLb: number } | null;
}

function fitLine(fit: PricedFit, index: number): string {
  const { candidate, item } = fit;
  const parts = [`${index + 1}. SKU ${item.sku}: ${item.title}`];
  if (candidate.fitKind === "box") {
    parts.push(`inside ${candidate.entry.sizeLabel}, about ${formatClearance(candidate.clearancePerSide)} per side (${candidate.fitLabel} fit)`);
  } else if (candidate.fitKind === "flat") {
    parts.push(`${candidate.entry.sizeLabel} ${kindLabel(candidate.entry.kind)} (${candidate.fitLabel} fit)`);
  } else {
    parts.push(`${candidate.entry.sizeLabel} tube (${candidate.fitLabel} fit)`);
  }
  if (candidate.strengthNote) parts.push(candidate.strengthNote);
  if (fit.billable) parts.push(`bills about ${fit.billable.upsFedexLb} lb UPS/FedEx, ${fit.billable.uspsLb} lb USPS`);
  const price = item.price === null ? "price at checkout" : item.pack && item.pack > 1 ? `${money(item.price)} per pack of ${item.pack.toLocaleString("en-US")}${item.unit_price !== null ? ` (${unitPriceText(item.unit_price)})` : ""}` : money(item.price);
  parts.push(price, item.in_stock ? "in stock" : "out of stock", item.url);
  return parts.join(" | ");
}

function formatClearance(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const f = (n: number) => `${Number(n.toFixed(2))} in`;
  return Math.abs(max - min) < 0.13 ? f(min) : `${f(min)} to ${f(max)}`;
}

/**
 * Rank priced fits: fit score first, then price within the same packaging type (a 2x pricier
 * option of the same fit costs about 1.4 points), a penalty near the rated weight limit, billable
 * weight, and stock. One product per size: rotated listings (9x8x8 and 8x8x9) and color or pack
 * variants keep only the better value.
 */
export function rankFits<T extends { candidate: FitCandidate; item: CompactItem; value: number; billable: { upsFedexLb: number } | null }>(priced: T[], weightLb: number, limit: number): T[] {
  const unitCost = (p: T) => p.item.unit_price ?? p.item.price ?? null;
  // Price is compared within a packaging type: a poly mailer is always cheaper than a box, and the
  // fit score already says which type suits the item.
  const cheapestByKind = new Map<string, number>();
  for (const p of priced) {
    const cost = unitCost(p);
    if (cost && cost > 0) cheapestByKind.set(p.candidate.fitKind, Math.min(cheapestByKind.get(p.candidate.fitKind) ?? Infinity, cost));
  }
  for (const p of priced) {
    p.value = p.candidate.score;
    const cost = unitCost(p);
    const cheapest = cheapestByKind.get(p.candidate.fitKind);
    if (cost && cheapest && Number.isFinite(cheapest)) p.value += 2 * Math.log(cost / cheapest);
    const rated = ratedLimit(p.candidate);
    if (rated !== null && weightLb > 0.7 * rated) p.value += 2;
    if (p.billable) p.value += 0.1 * p.billable.upsFedexLb;
    if (!p.item.in_stock) p.value += 100;
  }
  const sorted = [...priced].sort((a, b) => a.value - b.value);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of sorted) {
    const key = sizeKey(p.candidate.entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

function ratedLimit(candidate: FitCandidate): number | null {
  const match = candidate.strengthNote ? /rated to (\d+) lb/.exec(candidate.strengthNote) : null;
  return match ? Number(match[1]) : null;
}

/** Outer box for double boxing a fragile item: about 2.5 in of cushioning around the inner box on every side. */
function doubleBoxOuter(inner: CatalogEntry, weightLb: number): CatalogEntry | null {
  if (!inner.dims) return null;
  const need = inner.dims.map((n) => n + 0.25 + 5) as [number, number, number];
  let best: { entry: CatalogEntry; excess: number } | null = null;
  for (const entry of catalogIndex()) {
    if (entry.held || entry.sensitive || entry.specialty || !entry.dims) continue;
    if (entry.kind !== "corrugated_box" && entry.kind !== "heavy_duty_box") continue;
    if (entry.dims.some((n, i) => n < need[i]! - 1e-6)) continue;
    const excess = entry.dims.reduce((sum, n, i) => sum + (n - need[i]!), 0);
    if (excess > 6) continue;
    if (!best || excess < best.excess || (excess === best.excess && entry.kind === "corrugated_box" && best.entry.kind !== "corrugated_box")) best = { entry, excess };
  }
  return best && weightLb <= 60 ? best.entry : null;
}

export async function findPackagingV1(env: Env, raw: unknown, context: V1Context = {}): Promise<V1ToolResult | unknown> {
  const client = resolveClient(context);
  if (wantsDetailed(raw)) {
    const args = withoutFormat(raw);
    return sanitizeDetailed(await recommendPackagingHandler(env, { item_weight_lb: 1, use_case: "ecommerce", ...args }), client);
  }
  const args = withoutFormat(raw);
  if (args.item_depth_in === undefined && args.item_height_in !== undefined) args.item_depth_in = args.item_height_in;
  delete args.item_height_in;
  const input = fitZod.parse(args);
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
  const item3 = [input.item_length_in, input.item_width_in, input.item_depth_in].sort((a, b) => b - a) as [number, number, number];
  const [rules, live] = await Promise.all([
    discountRules(env),
    fit.candidates.length ? liveVariants(env, fit.candidates.map((c) => c.entry.variantId)) : Promise.resolve(new Map<string, LiveVariant>()),
  ]);
  const priced: PricedFit[] = [];
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
    // Packed weight: the item, one unit of the packaging, and cushioning.
    const unitLb = facts.packWeightLb !== null && candidate.entry.pack ? facts.packWeightLb / candidate.entry.pack : null;
    const packedLb = weight + (unitLb ?? 0) + cushioningLb(useCase, candidate);
    const b = billableWeight(packedSize(candidate, item3), packedLb);
    priced.push({ candidate, item, live: facts, value: candidate.score, packedLb: unitLb === null ? null : Math.round(packedLb * 100) / 100, billable: { upsFedexLb: b.upsFedexLb, uspsLb: b.uspsLb } });
  }
  const picked = rankFits(priced, weight, input.limit);
  for (const { candidate } of picked) {
    const limit = ratedLimit(candidate);
    if (limit !== null && weight > 0.7 * limit && candidate.strengthNote) candidate.strengthNote += " (close to its rated limit; a stronger box adds headroom)";
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
  const outer = useCase === "fragile" && picked[0]!.candidate.fitKind === "box" ? doubleBoxOuter(picked[0]!.candidate.entry, weight) : null;
  const lines = picked.map((p, index) => fitLine(p, index));
  const pricing = volumePricingLine(rules, picked.map((p) => ({ sku: p.item.sku, productId: p.live.productId ?? p.candidate.entry.productId })));
  const text = [
    `Item ${itemLabel}. Treated as ${useCase === "general" ? "a general ecommerce item" : `${useCase}`}; needs at least ${required} in inside.`,
    fit.advice,
    ...lines,
    outer ? `To double box option 1, an outer box such as SKU ${outer.sku} (${outer.sizeLabel}) leaves about 2.5 in of cushioning around it.` : "",
    "Billable weight counts the item, the packaging and cushioning; USPS bills actual weight up to one cubic foot.",
    pricing,
    "Next: when the buyer confirms one and a quantity (in packs), call create_cart_url. get_shipping_estimate gives the delivered total to their ZIP code.",
  ].filter(Boolean).join("\n");
  return toolResult(text, {
    item: { length_in: input.item_length_in, width_in: input.item_width_in, height_in: input.item_depth_in, weight_lb: weight, use_case: useCase },
    required_inside_in: fit.requiredInside,
    advice: fit.advice,
    results: picked.map((p) => ({
      ...p.item,
      fit: p.candidate.fitLabel,
      clearance_per_side_in: p.candidate.clearancePerSide,
      strength: p.candidate.strengthNote,
      packed_weight_lb: p.packedLb,
      billable_weight_lb: p.billable ? { ups_fedex: p.billable.upsFedexLb, usps: p.billable.uspsLb } : null,
    })),
    double_box_outer: outer ? { sku: outer.sku, size: outer.sizeLabel, title: outer.title } : null,
    pricing_note: pricing || null,
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
  outputSchema: outputSchema({ sku: STR, title: STR, url: STR, specs: ARR, nearby_sizes: ARR }),
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
  const client = resolveClient(context);
  if (wantsDetailed(raw)) return sanitizeDetailed(await getProductHandler(env, { handle: entry.handle }), client);
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
    const name = fixMojibake(mf.get(`spec${i}_name`) ?? "").trim();
    const value = fixMojibake(mf.get(`spec${i}_value`) ?? "").replace(/\s+/g, " ").trim();
    if (name && value) specs.push({ name, value: value.slice(0, 120) });
  }
  const summary = cleanSummary(fixMojibake(mf.get("catalog_description") ?? mf.get("ai_summary") ?? ""));
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
  const discountLine = volumePricingLine(rules, [{ sku: entry.sku, productId: entry.productId }]);
  if (discountLine) lines.push(discountLine);
  const ladder = discountLadder(tiersForProduct(rules, entry.productId));
  const pct = input.quantity !== undefined ? percentAtQuantity(ladder, input.quantity) : 0;
  if (input.quantity !== undefined && pct > 0 && Number.isFinite(price)) {
    const perPack = round2(price - Math.floor(price * pct + 1e-9) / 100);
    lines.push(`At ${input.quantity} packs checkout takes ${pct}% off: about ${money(perPack)} per pack, ${money(round2(perPack * input.quantity))} before shipping and tax.`);
  }
  if (nearby.length) lines.push(`Nearby sizes: ${nearby.map((e) => `SKU ${e.sku} (${e.sizeLabel ?? e.title})`).join(", ")}.`);
  lines.push(`Product page: ${url}`);
  lines.push("Next: after the buyer confirms a quantity, create_cart_url with this SKU; get_shipping_estimate gives a delivered total.");
  return toolResult(lines.join("\n"), {
    ...item,
    specs,
    summary: summary || null,
    weight_per_pack: weight?.value ? { value: Number(weight.value), unit: String(weight.unit).toLowerCase() } : null,
    quantity_requested: input.quantity ?? null,
    can_ship_quantity_now: canShip,
    nearby_sizes: nearby.map((e) => ({ sku: e.sku, size: e.sizeLabel, title: e.title })),
    volume_pricing: ladder.map((step) => ({ min_packs: step.minQuantity, percent_off: step.percentOff })),
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
  title: "Estimate delivered cost of a Packrift order",
  description:
    "Estimate the delivered cost of a Packrift order to a US ZIP code, using the same shipping rates and automatic volume discounts as Packrift checkout. Give the items as SKU and quantity (number of packs). Returns the subtotal after discounts, the shipping charge (free only when the order qualifies), the delivered total and the delivered cost per unit. Tax is not included; checkout shows the final amount. Not for carrier rate shopping or postage.",
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
  annotations: ANNOTATIONS("Estimate delivered cost of a Packrift order"),
  outputSchema: outputSchema({ items: ARR, shipping_options: ARR }),
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
  destination_postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}(?:-\d{4})?$/, "Packrift ships within the United States; use a 5-digit US ZIP code"),
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
  const client = resolveClient(context);
  const input = shippingZod.parse(withoutFormat(raw));
  const lines = resolveLines(input.items);
  if (wantsDetailed(raw)) {
    const legacyArgs: Record<string, unknown> = {
      destination_postal_code: input.destination_postal_code,
      country: input.country,
      items: lines.map((line) => ({ variant_id: line.entry.variantId, qty: line.quantity })),
    };
    const address = input.destination_address;
    if (address?.address1 && address.city && (address.province_code || input.destination_state)) {
      legacyArgs.destination_address = { address1: address.address1, city: address.city, province_code: address.province_code ?? input.destination_state };
    }
    return sanitizeDetailed(await getShippingEstimateHandler(env, legacyArgs), client);
  }
  const [quote, rules, live] = await Promise.all([
    deliveredQuote(
      env,
      lines.map((line) => ({ variantId: line.entry.variantId, quantity: line.quantity })),
      {
        postalCode: input.destination_postal_code,
        country: input.country,
        provinceCode: input.destination_state ?? input.destination_address?.province_code ?? null,
        city: input.destination_address?.city ?? null,
        address1: input.destination_address?.address1 ?? null,
      }
    ),
    discountRules(env),
    bestEffort(() => liveVariants(env, lines.map((line) => line.entry.variantId)), new Map<string, LiveVariant>(), 2500),
  ]);
  const titleOf = (entry: CatalogEntry) => live.get(entry.variantId)?.title ?? entry.title;
  const units = lines.length === 1 && lines[0]!.entry.pack ? lines[0]!.quantity * lines[0]!.entry.pack! : null;
  const perUnit = units && quote.total !== null ? round2Unit(quote.total / units) : null;
  const itemText = lines.map((line) => `${line.quantity} x SKU ${line.entry.sku} (${titleOf(line.entry)})`).join("; ");
  const singlePct =
    lines.length === 1 && quote.discounts > 0 ? percentAtQuantity(discountLadder(tiersForProduct(rules, lines[0]!.entry.productId)), lines[0]!.quantity) : 0;
  const rateText = quote.rates.length
    ? quote.rates.map((rate) => `${rate.title === "Freight Shipping" ? "standard shipping" : rate.title} ${rate.free ? `free (was ${money(rate.price)})` : money(rate.price)}`).join("; ")
    : "no parcel rate available for this destination; request a freight quote";
  const text = [
    `Delivered estimate to ${input.destination_postal_code}: ${itemText}.`,
    `Subtotal ${money(quote.subtotal)}${quote.discounts > 0 ? ` after ${singlePct ? `${singlePct}% ` : ""}volume discount of ${money(quote.discounts)} (was ${money(quote.subtotalBeforeDiscounts)})` : ""}.`,
    `Shipping: ${rateText}.${quote.rates.some((rate) => rate.title === "Freight Shipping") ? " Checkout names this rate \"Freight Shipping\"; it is Packrift's standard rate for parcel orders too." : ""}`,
    quote.total !== null ? `Delivered total ${money(quote.total)} before tax${perUnit !== null ? `, about ${perUnit >= 1 ? money(perUnit) : `$${perUnit.toFixed(3)}`} per unit` : ""}.` : "",
    freeShippingNote(quote, rules),
    "Estimate from Packrift's checkout rates; tax and the final amount are shown at checkout.",
    quote.total === null ? `Freight quote: ${quoteLink(itemText, {}, client)}` : "Next: after the buyer confirms, create_cart_url with the same items gives the checkout link.",
  ].filter(Boolean).join("\n");
  return toolResult(text, {
    destination: { postal_code: input.destination_postal_code, country: input.country },
    items: lines.map((line) => ({ sku: line.entry.sku, quantity: line.quantity, title: titleOf(line.entry) })),
    subtotal_before_discounts: quote.subtotalBeforeDiscounts,
    volume_discount: quote.discounts,
    volume_discount_percent: singlePct || null,
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
    "Create a checkout link on packrift.com for items the buyer has chosen. Give each item as SKU and quantity (number of packs); up to 25 lines. The link opens packrift.com checkout with those items and automatic volume discounts applied; the buyer adds their address and pays there. Returns the subtotal after volume discounts. This tool never places an order or charges anyone. Call it only after the buyer confirms the items and quantities.",
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
  outputSchema: outputSchema({ checkout_url: STR, cart_url: STR, lines: ARR }),
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
  if (wantsDetailed(raw)) return sanitizeDetailed(legacy, client);
  const finalUrl = String(legacy.final_cart_url ?? legacy.url);
  const utmSource = String(legacy.utm?.source ?? utmSourceForClient(client));
  const checkoutUrl = checkoutLink(
    lines.map((line) => ({ variantId: line.entry.variantId, quantity: line.quantity })),
    utmSource,
    typeof legacy.mcp_handoff_id === "string" ? legacy.mcp_handoff_id : null
  );
  const basket = lines.map((line) => ({ variantId: line.entry.variantId, quantity: line.quantity }));
  const [live, pricing] = await Promise.all([
    bestEffort(() => liveVariants(env, lines.map((line) => line.entry.variantId)), new Map<string, LiveVariant>(), 2500),
    bestEffort(() => basketPricing(env, basket), null, 4000),
  ]);
  const priced = lines.map((line) => {
    const facts = live.get(line.entry.variantId);
    const price = facts ? facts.price : null;
    return { sku: line.entry.sku, title: facts?.title ?? line.entry.title, quantity: line.quantity, price_per_pack: price, line_total: price === null ? null : round2(price * line.quantity), in_stock: facts?.available ?? null };
  });
  const listTotal = priced.every((line) => line.line_total !== null) ? round2(priced.reduce((sum, line) => sum + (line.line_total ?? 0), 0)) : null;
  const subtotalText = pricing
    ? pricing.discounts > 0
      ? `Subtotal ${money(pricing.subtotal)} after the automatic volume discount of ${money(pricing.discounts)} (list ${money(pricing.subtotalBeforeDiscounts)}).`
      : `Subtotal ${money(pricing.subtotal)}.`
    : listTotal !== null
      ? `List total ${money(listTotal)} before automatic volume discounts.`
      : "";
  const text = [
    `Checkout link: ${checkoutUrl}`,
    ...priced.map((line) => `- ${line.quantity} x SKU ${line.sku}: ${line.title}${line.price_per_pack !== null ? ` at ${money(line.price_per_pack)} = ${money(line.line_total)}` : ""}${line.in_stock === false ? " (currently out of stock)" : ""}`),
    subtotalText,
    "Shipping and tax are added at checkout; get_shipping_estimate gives the delivered total to a ZIP code.",
    "The link opens packrift.com checkout with these items; the buyer adds their address and pays there. Nothing is ordered until they pay.",
  ].filter(Boolean).join("\n");
  return toolResult(text, {
    checkout_url: checkoutUrl,
    cart_url: finalUrl,
    lines: priced,
    list_total: listTotal,
    volume_discount: pricing?.discounts ?? null,
    subtotal_after_discounts: pricing?.subtotal ?? null,
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
    "Get a pre-filled quote request link for pallet or recurring quantities, custom sizes, printed or branded packaging, freight orders, or any spec Packrift does not stock exactly. Put everything the buyer told you in the fields: the spec, quantity, delivery ZIP and need-by date travel with the request. The buyer adds their email and submits the form on packrift.com; Packrift replies by email with pricing. Returns the link and what the buyer still needs to add.",
  inputSchema: {
    type: "object",
    properties: {
      requested_spec: {
        type: "string",
        description: "What the buyer needs, e.g. \"18x12x12 ECT-44 kraft boxes, printed 1 color on 2 sides\". Include size, strength or thickness, color and any printing.",
      },
      quantity: { type: "string", description: "Quantity per order and how often, e.g. \"5,000 per quarter\"." },
      delivery_zip: { type: "string", description: "US delivery ZIP code, if known." },
      needed_by: { type: "string", description: "Date the buyer needs delivery, if known." },
      sku: { type: "string", description: "A stocked Packrift SKU the request is for. Leave empty for custom, printed or branded packaging." },
      response_format: RESPONSE_FORMAT,
    },
    required: ["requested_spec"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS("Request a bulk or custom quote"),
  outputSchema: outputSchema({ quote_url: STR, requested_spec: STR }),
};

/** Custom, printed or branded work needs a person to quote it, never a stock-SKU match. */
export const CUSTOM_WORK = /\b(custom(?:i[sz]ed)?|printed|print(?:ing)?|imprint(?:ed|ing)?|logos?|brand(?:ed|ing)?|artwork|private[- ]label|pantone|pms|full[- ]colou?r|one[- ]colou?r|two[- ]colou?r|\d[- ]colou?rs?|die[- ]cut|embossed|foil[- ]stamp(?:ed|ing)?)\b/i;

const QUOTE_SPEC_LIMIT = 220;

/** The form carries one short request line; put quantity, ZIP and date in it when the spec does not already say them. */
export function composeQuoteSpec(input: { requested_spec: string; quantity?: string | null; delivery_zip?: string | null; needed_by?: string | null }): { spec: string; shortened: boolean } {
  const base = input.requested_spec.replace(/\s+/g, " ").trim();
  const extras: string[] = [];
  const quantity = input.quantity?.trim();
  if (quantity && !base.includes(quantity.replace(/\s+/g, " "))) extras.push(`qty ${quantity}`);
  const zip = input.delivery_zip?.trim();
  if (zip && !base.includes(zip)) extras.push(`ship to ${zip}`);
  const date = input.needed_by?.trim();
  if (date && !base.toLowerCase().includes(date.toLowerCase())) extras.push(`need by ${date}`);
  const tail = extras.length ? `; ${extras.join("; ")}` : "";
  if (base.length + tail.length <= QUOTE_SPEC_LIMIT) return { spec: base + tail, shortened: false };
  const room = Math.max(40, QUOTE_SPEC_LIMIT - tail.length - 3);
  const cut = base.slice(0, room).replace(/[\s,;:]+\S*$/, "");
  return { spec: `${cut}...${tail}`.slice(0, QUOTE_SPEC_LIMIT), shortened: true };
}

const quoteZod = z.object({
  requested_spec: z.string().trim().min(3).max(2000),
  quantity: z.union([z.string(), z.number()]).transform((value) => String(value).trim()).optional(),
  delivery_zip: z.string().trim().max(20).optional(),
  needed_by: z.string().trim().max(60).optional(),
  sku: z.string().trim().max(80).optional(),
});

export async function getBulkQuoteLinkV1(env: Env, raw: unknown, context: V1Context = {}): Promise<V1ToolResult | unknown> {
  const args = withoutFormat(raw);
  const input = quoteZod.parse(args);
  const client = resolveClient(context);
  const custom = CUSTOM_WORK.test(input.requested_spec);
  const stocked = !custom && input.sku ? entryBySku(input.sku) : null;
  const { spec, shortened } = composeQuoteSpec(input);
  // The earlier layer records the quote-link event; its own URL is replaced below.
  const legacy = (await getBulkQuoteLinkHandler(env, {
    requested_spec: spec,
    ...(stocked ? { sku: stocked.sku } : {}),
    ...(input.quantity ? { quantity: input.quantity } : {}),
  })) as Record<string, any>;
  const url = quoteLink(spec, { sku: stocked?.sku ?? null, quantity: input.quantity ?? null, family: stocked?.family ?? null }, client);
  if (wantsDetailed(raw)) return sanitizeDetailed({ ...legacy, quote_url: url, requested_spec: spec }, client);
  const text = [
    `Quote request link: ${url}`,
    stocked
      ? `The form opens with SKU ${stocked.sku} (${stocked.title}) as the item and this request attached. The buyer sets the quantity on the form, adds their email and delivery ZIP, and submits.`
      : `The form opens with this request in the items box: "${spec}". The buyer adds their email and delivery ZIP and submits; Packrift's team reviews it.`,
    shortened ? "The request was shortened to fit the form; the buyer can add the rest in the notes box." : "",
    custom ? "For printed or branded packaging, the buyer can email artwork to support@packrift.com after submitting." : "",
    "Packrift replies by email with pricing; do not promise prices, lead times or minimums.",
  ].filter(Boolean).join("\n");
  return toolResult(text, { quote_url: url, requested_spec: spec, sku: stocked?.sku ?? null, custom_work: custom, spec_shortened: shortened });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface V1ToolDef {
  schema: { name: string; title: string; description: string; inputSchema: unknown; annotations: Record<string, unknown>; outputSchema?: unknown };
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
  "Packrift sells packaging supplies in the United States: corrugated shipping boxes, mailer boxes, poly and bubble mailers, poly bags, labels, packing tape, stretch film and void fill. Use search_products when the buyer names a product, size or SKU, and find_packaging_for_item when they describe the item they ship. Results include live price and stock, so after the buyer confirms an item and quantity you can call create_cart_url directly; it returns a packrift.com checkout link and never places an order. get_product gives specs, volume pricing and whether a quantity can ship now. get_shipping_estimate gives a delivered total to a ZIP code with automatic volume discounts applied, and free shipping only when the order qualifies. Use get_bulk_quote_link for pallet quantities, custom or printed packaging, freight, or when nothing matches exactly. Quantities are in packs. Never present a different size as an exact match, and never call shipping free unless an estimate shows it.";
