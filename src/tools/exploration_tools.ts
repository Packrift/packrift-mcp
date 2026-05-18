import { z } from "zod";
import { APPROVED_CATALOG, ApprovedCatalogItem } from "../approved-catalog.js";
import { approvalStatus } from "../approval.js";
import { buildConversionActions, buildMatchSummary, buildNoMatchRecovery, buildProductCard } from "../conversion.js";
import { parseDimensions, Dimensions } from "../dimensions.js";
import { Env, numericToVariantGid, variantIdToNumeric, shopifyQuery } from "../shopify.js";

export const compareAlternativesSchema = {
  name: "compare_alternatives",
  description:
    "Exploration tool for buyers comparing a packaging spec, competitor-style item, or Uline-style request against Packrift AI_APPROVE products. Returns ranked Packrift candidates plus a plain-language comparison summary.",
  inputSchema: {
    type: "object",
    properties: {
      requested_spec: {
        type: "string",
        description: "Packaging request, competitor-style spec, or exact dimensions/material/count to compare.",
      },
      family: {
        type: "string",
        enum: ["boxes", "mailers", "labels", "tape", "poly_bags", "stretch_film", "strapping", "tags", "void_fill", "packing_list_envelopes"],
      },
      competitor_reference: {
        type: "string",
        description: "Optional competitor or source name, used only as context; Packrift does not claim live competitor price or inventory.",
      },
      limit: { type: "integer", minimum: 1, maximum: 8, default: 5 },
    },
    required: ["requested_spec"],
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const packCalculatorSchema = {
  name: "pack_calculator",
  description:
    "Exploration tool for item dimensions and weight. Calculates required inside dimensions, ranks Packrift box/mailer candidates, and gives void-fill guidance before live price/inventory confirmation.",
  inputSchema: {
    type: "object",
    properties: {
      item_length_in: { type: "number", minimum: 0.1 },
      item_width_in: { type: "number", minimum: 0.1 },
      item_depth_in: { type: "number", minimum: 0.1 },
      item_weight_lb: { type: "number", minimum: 0, default: 0 },
      padding_in: { type: "number", minimum: 0, maximum: 6, default: 0.5 },
      use_case: {
        type: "string",
        enum: ["auto", "box", "mailer", "fragile", "apparel", "ecommerce"],
        default: "auto",
      },
      limit: { type: "integer", minimum: 1, maximum: 8, default: 5 },
    },
    required: ["item_length_in", "item_width_in", "item_depth_in"],
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const inventoryStatusSchema = {
  name: "inventory_status",
  description:
    "Live inventory exploration for one or more AI_APPROVE variants. Returns Shopify total quantity, available-for-sale state, location-level BOX warehouse quantities where available, and a plain-language fulfillment summary.",
  inputSchema: {
    type: "object",
    properties: {
      variant_ids: { type: "array", items: { type: "string" }, minItems: 1 },
      sku: { type: "string", description: "Packrift SKU such as 1066." },
      handle: { type: "string", description: "Packrift product handle." },
      quantity: { type: "integer", minimum: 1, default: 1 },
    },
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

const compareAlternativesZod = z.object({
  requested_spec: z.string().min(1).max(260),
  family: z
    .enum(["boxes", "mailers", "labels", "tape", "poly_bags", "stretch_film", "strapping", "tags", "void_fill", "packing_list_envelopes"])
    .optional(),
  competitor_reference: z.string().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(8).default(5),
});

const packCalculatorZod = z.object({
  item_length_in: z.number().min(0.1),
  item_width_in: z.number().min(0.1),
  item_depth_in: z.number().min(0.1),
  item_weight_lb: z.number().min(0).default(0),
  padding_in: z.number().min(0).max(6).default(0.5),
  use_case: z.enum(["auto", "box", "mailer", "fragile", "apparel", "ecommerce"]).default("auto"),
  limit: z.number().int().min(1).max(8).default(5),
});

const inventoryStatusZod = z
  .object({
    variant_ids: z.array(z.string().min(1)).min(1).optional(),
    sku: z.string().min(1).max(80).optional(),
    handle: z.string().min(1).max(180).optional(),
    quantity: z.number().int().min(1).default(1),
  })
  .refine((input) => Boolean(input.variant_ids?.length || input.sku || input.handle), {
    message: "variant_ids, sku, or handle is required",
  });

const APPROVED_BY_SKU = new Map(APPROVED_CATALOG.map((item) => [item.sku.toLowerCase(), item]));
const APPROVED_BY_HANDLE = new Map(APPROVED_CATALOG.map((item) => [item.handle.toLowerCase(), item]));
const APPROVED_BY_VARIANT = new Map(APPROVED_CATALOG.map((item) => [numericId(item.variantId), item]));
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "box",
  "case",
  "for",
  "in",
  "of",
  "pack",
  "packaging",
  "the",
  "to",
  "with",
  "x",
]);

const INVENTORY_QUERY = `
  query InventoryStatus($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        sku
        title
        inventoryQuantity
        availableForSale
        product { handle title }
        inventoryItem {
          tracked
          inventoryLevels(first: 10) {
            edges {
              node {
                location { name }
                quantities(names: ["available", "on_hand"]) { name quantity }
              }
            }
          }
        }
      }
    }
  }
`;

interface InventoryNode {
  id: string;
  sku: string | null;
  title: string;
  inventoryQuantity: number | null;
  availableForSale: boolean;
  product: { handle: string; title: string };
  inventoryItem: {
    tracked: boolean;
    inventoryLevels: {
      edges: Array<{
        node: {
          location: { name: string };
          quantities: Array<{ name: string; quantity: number }>;
        };
      }>;
    };
  } | null;
}

export async function compareAlternativesHandler(env: Env, raw: unknown) {
  const input = compareAlternativesZod.parse(raw);
  const ranked = rankCatalogForSpec(input.requested_spec, input.family).slice(0, input.limit);
  if (ranked.length === 0) {
    return {
      summary: `No AI_APPROVE Packrift product matched "${input.requested_spec}" closely enough to present as an alternative.`,
      results: [],
      no_match_recovery: buildNoMatchRecovery({
        source: "compare_alternatives",
        requestedSpec: input.requested_spec,
        reason: "No approved Packrift alternative matched the requested spec with enough evidence.",
      }),
    };
  }

  const results = ranked.map(({ item, score, dims, matchedTerms }) =>
    catalogRow(env, item, {
      source: "compare_alternatives",
      matchType: "alternative_candidate",
      confidence: confidenceFromScore(score),
      requestedSpec: input.requested_spec,
      candidateDimensions: dims?.raw ?? null,
      exactTermsMatched: matchedTerms,
      reason: alternativeReason(input.requested_spec, item, matchedTerms, dims),
      score,
    })
  );

  return {
    summary: buildAlternativeSummary(input.requested_spec, input.competitor_reference, results),
    requested_spec: input.requested_spec,
    competitor_reference: input.competitor_reference ?? null,
    comparison_basis:
      "Packrift candidates are ranked from AI_APPROVE catalog specs only. Live competitor price, stock, shipping, and claims are not inferred.",
    results,
    recommended_next_step:
      "Use get_product, get_pricing, and inventory_status on the selected SKU before presenting checkout or cart handoff.",
  };
}

export async function packCalculatorHandler(env: Env, raw: unknown) {
  const input = packCalculatorZod.parse(raw);
  const required = requiredInsideDimensions(input);
  const candidates = rankCatalogForFit(input).slice(0, input.limit);
  if (candidates.length === 0) {
    const requested = `${input.item_length_in} x ${input.item_width_in} x ${input.item_depth_in} in item, ${input.padding_in} in padding`;
    return {
      summary: `No AI_APPROVE Packrift box or mailer fit the calculated inside dimensions for ${requested}.`,
      required_inside_dimensions_in: required,
      results: [],
      no_match_recovery: buildNoMatchRecovery({
        source: "pack_calculator",
        requestedSpec: requested,
        useCase: input.use_case,
        reason: "No approved Packrift box or mailer fit the calculated inside dimensions.",
      }),
    };
  }

  const results = candidates.map(({ item, dims, score, clearance }) =>
    catalogRow(env, item, {
      source: "pack_calculator",
      matchType: "calculated_fit",
      confidence: Math.max(0.62, Math.min(0.99, 1 - score / 80)),
      requestedSpec: `${required.length_in} x ${required.width_in} x ${required.depth_in} in required inside dimensions`,
      candidateDimensions: dims.raw,
      perAxisPaddingIn: clearance,
      reason: fitReason(input, dims, clearance),
      score,
    })
  );

  return {
    summary: buildPackCalculatorSummary(input, required, results),
    item_dimensions_in: {
      length: input.item_length_in,
      width: input.item_width_in,
      depth: input.item_depth_in,
      weight_lb: input.item_weight_lb,
    },
    required_inside_dimensions_in: required,
    void_fill_guidance: voidFillGuidance(input, results[0]?.dimensions ?? null),
    results,
    recommended_next_step:
      "Use inventory_status and get_pricing on the selected SKU, then create_cart_url only after the buyer confirms the exact SKU and quantity.",
  };
}

export async function inventoryStatusHandler(env: Env, raw: unknown) {
  const input = inventoryStatusZod.parse(raw);
  const items = resolveInventoryItems(input);
  if (items.length === 0) {
    const requested = input.sku ? `SKU ${input.sku}` : input.handle ? `handle ${input.handle}` : "requested variants";
    return {
      summary: `No AI_APPROVE Packrift product matched ${requested}.`,
      results: [],
      no_match_recovery: buildNoMatchRecovery({
        source: "inventory_status",
        requestedSpec: requested,
        reason: "Inventory status is only returned for AI_APPROVE Packrift products.",
      }),
    };
  }

  const ids = items.map((item) => numericToVariantGid(item.variantId));
  const data = await shopifyQuery<{ nodes: Array<InventoryNode | null> }>(env, INVENTORY_QUERY, { ids });
  const results = data.nodes.map((node, index) => inventoryRow(env, items[index]!, node, input.quantity));

  return {
    summary: buildInventorySummary(results, input.quantity),
    requested_quantity: input.quantity,
    results,
    fulfillment_note:
      "Location quantities are live Shopify inventory levels when Shopify returns them. Checkout still determines final shipping method, cost, and any split-fulfillment behavior.",
  };
}

function resolveInventoryItems(input: z.infer<typeof inventoryStatusZod>): ApprovedCatalogItem[] {
  const byKey = new Map<string, ApprovedCatalogItem>();
  for (const variantId of input.variant_ids ?? []) {
    const item = APPROVED_BY_VARIANT.get(numericId(variantId));
    if (item) byKey.set(item.variantId, item);
  }
  if (input.sku) {
    const item = APPROVED_BY_SKU.get(input.sku.toLowerCase());
    if (item) byKey.set(item.variantId, item);
  }
  if (input.handle) {
    const item = APPROVED_BY_HANDLE.get(input.handle.toLowerCase());
    if (item) byKey.set(item.variantId, item);
  }
  return [...byKey.values()].slice(0, 10);
}

function inventoryRow(env: Env, item: ApprovedCatalogItem, node: InventoryNode | null, requestedQuantity: number) {
  const variantId = node ? variantIdToNumeric(node.id) : item.variantId;
  const levels = node?.inventoryItem?.inventoryLevels.edges.map(({ node: level }) => {
    const quantities = Object.fromEntries(level.quantities.map((quantity) => [quantity.name, quantity.quantity]));
    return {
      location: level.location.name,
      available: Number(quantities.available ?? 0),
      on_hand: Number(quantities.on_hand ?? 0),
    };
  }) ?? [];
  const boxLevels = levels.filter((level) => /box partners|bp -/i.test(level.location));
  const boxAvailable = boxLevels.reduce((sum, level) => sum + level.available, 0);
  const totalAvailable = node?.inventoryQuantity ?? boxAvailable;
  const availableForSale = Boolean(node?.availableForSale);
  const canFulfillRequestedQuantity = availableForSale && totalAvailable >= requestedQuantity;
  const cardInput = {
    sku: item.sku,
    handle: item.handle,
    title: node?.product.title ?? item.title,
    url: productUrl(env, item),
    variantId,
    family: item.family,
    price: null,
    currency: "USD",
    inStock: availableForSale && totalAvailable > 0,
    dimensionsRaw: parseDimensions(item.title)?.raw ?? null,
    source: "inventory_status",
    matchType: canFulfillRequestedQuantity ? "inventory_available" : "inventory_review_needed",
    matchConfidence: 0.99,
  };
  return {
    sku: item.sku,
    variant_id: variantId,
    handle: item.handle,
    title: node?.product.title ?? item.title,
    family: item.family,
    ...approvalStatus(item),
    available_for_sale: availableForSale,
    total_available_quantity: totalAvailable,
    requested_quantity: requestedQuantity,
    can_fulfill_requested_quantity: canFulfillRequestedQuantity,
    inventory_tracked: node?.inventoryItem?.tracked ?? null,
    locations_total: levels.length,
    box_partners_locations_in_stock: boxLevels.filter((level) => level.available > 0).length,
    box_partners_available_quantity: boxAvailable,
    inventory_levels: levels,
    lead_time_note: canFulfillRequestedQuantity
      ? "Inventory is available in Shopify. Checkout should be used for final shipping method and delivery promise."
      : "Inventory is not sufficient for the requested quantity in this live read; use bulk quote or contact Packrift before promising fulfillment.",
    product_card: buildProductCard(cardInput),
    conversion_actions: buildConversionActions(cardInput),
  };
}

function rankCatalogForSpec(requestedSpec: string, family?: ApprovedCatalogItem["family"]) {
  const requestDims = parseDimensions(requestedSpec);
  const tokens = tokenize(requestedSpec);
  return APPROVED_CATALOG
    .filter((item) => !family || item.family === family)
    .filter((item) => !isSensitiveProductText(item.title))
    .map((item) => {
      const dims = parseDimensions(item.title);
      const itemTokens = tokenize(`${item.sku} ${item.title} ${item.family}`);
      const matchedTerms = tokens.filter((token) => itemTokens.includes(token));
      let score = matchedTerms.length * 18;
      if (item.sku.toLowerCase() === requestedSpec.trim().toLowerCase()) score += 160;
      if (requestDims && dims) score += Math.max(0, 160 - dimensionDistance(requestDims, dims) * 18);
      if (family && item.family === family) score += 30;
      if (/chatgpt_paid_priority/i.test(item.riskFlags)) score += 20;
      return { item, score, dims, matchedTerms };
    })
    .filter((row) => row.score >= 20)
    .sort((a, b) => b.score - a.score || a.item.sku.localeCompare(b.item.sku));
}

function rankCatalogForFit(input: z.infer<typeof packCalculatorZod>) {
  const required = requiredInsideDimensions(input);
  const useCase = input.use_case;
  return APPROVED_CATALOG
    .filter((item) => item.family === "boxes" || item.family === "mailers")
    .filter((item) => !isSensitiveProductText(item.title))
    .map((item) => {
      const dims = parseDimensions(item.title);
      if (!dims) return null;
      const score = fitCandidateScore(required, dims, item.family, useCase);
      if (score === null) return null;
      const clearance = axisClearance(
        {
          length_in: input.item_length_in,
          width_in: input.item_width_in,
          depth_in: input.item_depth_in,
        },
        dims
      );
      let adjustedScore = score;
      if (useCase === "box" && item.family !== "boxes") adjustedScore += 30;
      if (useCase === "mailer" && item.family !== "mailers") adjustedScore += 20;
      if (useCase === "fragile" && item.family === "mailers") adjustedScore += 12;
      if (/corrugated|ect/i.test(item.title)) adjustedScore -= 3;
      return { item, dims, score: Math.max(0, adjustedScore), clearance };
    })
    .filter((row): row is { item: ApprovedCatalogItem; dims: Dimensions; score: number; clearance: Record<string, number> } => row !== null)
    .sort((a, b) => a.score - b.score || a.item.sku.localeCompare(b.item.sku));
}

function catalogRow(
  env: Env,
  item: ApprovedCatalogItem,
  input: {
    source: string;
    matchType: string;
    confidence: number;
    requestedSpec: string;
    candidateDimensions: string | null;
    exactTermsMatched?: string[];
    perAxisPaddingIn?: Record<string, number>;
    reason: string;
    score: number;
  }
) {
  const dims = parseDimensions(item.title);
  const cardInput = {
    sku: item.sku,
    handle: item.handle,
    title: item.title,
    url: productUrl(env, item),
    variantId: item.variantId,
    family: item.family,
    price: null,
    currency: "USD",
    inStock: null,
    dimensionsRaw: input.candidateDimensions,
    source: input.source,
    matchType: input.matchType,
    matchConfidence: input.confidence,
  };
  return {
    sku: item.sku,
    variant_id: item.variantId,
    handle: item.handle,
    title: item.title,
    family: item.family,
    risk_flags: item.riskFlags || null,
    product_url: productUrl(env, item),
    product_resource_url: `https://mcp.packrift.com/products/${encodeURIComponent(item.sku)}`,
    sku_resource_url: `https://mcp.packrift.com/ai/sku/${encodeURIComponent(item.sku)}.json`,
    ...approvalStatus(item),
    match: buildMatchSummary({
      source: input.source,
      matchType: input.matchType,
      confidence: input.confidence,
      matchedFields: ["AI_APPROVE", ...(dims ? ["dimensions"] : []), ...(input.exactTermsMatched?.length ? ["terms"] : [])],
      requestedDimensions: input.requestedSpec,
      candidateDimensions: input.candidateDimensions,
      exactTermsMatched: input.exactTermsMatched ?? [],
      perAxisPaddingIn: input.perAxisPaddingIn,
      reason: input.reason,
    }),
    product_card: buildProductCard(cardInput),
    conversion_actions: buildConversionActions(cardInput),
    dimensions: dims
      ? {
          length_in: dims.length_in,
          width_in: dims.width_in,
          depth_in: dims.depth_in,
          raw: dims.raw,
        }
      : null,
    exploration_score: Number(input.score.toFixed(3)),
    reason: input.reason,
  };
}

function productUrl(env: Env, item: ApprovedCatalogItem): string {
  return `https://${env.STOREFRONT_DOMAIN}/products/${item.handle}`;
}

function requiredInsideDimensions(input: z.infer<typeof packCalculatorZod>) {
  const add = input.padding_in * 2;
  return {
    length_in: Number((input.item_length_in + add).toFixed(3)),
    width_in: Number((input.item_width_in + add).toFixed(3)),
    depth_in: Number((input.item_depth_in + add).toFixed(3)),
  };
}

function fitCandidateScore(
  required: { length_in: number; width_in: number; depth_in: number },
  candidate: Dimensions,
  family: string,
  useCase: z.infer<typeof packCalculatorZod>["use_case"]
): number | null {
  const reqDims = [required.length_in, required.width_in, required.depth_in].sort((a, b) => b - a);
  const candidateDepth = candidate.depth_in ?? (family === "mailers" && required.depth_in <= 1.5 ? 1.5 : 0);
  if (!candidateDepth) return null;
  const candidateDims = [candidate.length_in, candidate.width_in, candidateDepth].sort((a, b) => b - a);
  if (candidateDims.some((dim, index) => dim < reqDims[index]!)) return null;
  const slack = candidateDims.reduce((sum, dim, index) => sum + (dim - reqDims[index]!), 0);
  const volume = candidateDims.reduce((product, dim) => product * dim, 1);
  const requiredVolume = reqDims.reduce((product, dim) => product * dim, 1);
  const volumePenalty = Math.max(0, (volume - requiredVolume) / Math.max(requiredVolume, 1));
  let score = slack + volumePenalty * 4;
  if (useCase === "apparel" && family === "mailers") score -= 4;
  return score;
}

function axisClearance(
  item: { length_in: number; width_in: number; depth_in: number },
  candidate: Dimensions
): Record<string, number> {
  const itemDims = [item.length_in, item.width_in, item.depth_in].sort((a, b) => b - a);
  const candidateDims = [candidate.length_in, candidate.width_in, candidate.depth_in ?? 1.5].sort((a, b) => b - a);
  return {
    largest_axis: Number((candidateDims[0]! - itemDims[0]!).toFixed(3)),
    middle_axis: Number((candidateDims[1]! - itemDims[1]!).toFixed(3)),
    smallest_axis: Number((candidateDims[2]! - itemDims[2]!).toFixed(3)),
  };
}

function dimensionDistance(a: Dimensions, b: Dimensions): number {
  const aDims = [a.length_in, a.width_in, a.depth_in ?? 0].sort((x, y) => y - x);
  const bDims = [b.length_in, b.width_in, b.depth_in ?? 0].sort((x, y) => y - x);
  return aDims.reduce((sum, value, index) => sum + Math.abs(value - bDims[index]!), 0);
}

function confidenceFromScore(score: number): number {
  return Math.max(0.55, Math.min(0.98, score / 260));
}

function alternativeReason(requestedSpec: string, item: ApprovedCatalogItem, matchedTerms: string[], dims: Dimensions | null): string {
  const pieces = [`Ranked against "${requestedSpec}" from the AI_APPROVE catalog`];
  if (dims) pieces.push(`candidate dimensions parsed as ${dims.raw}`);
  if (matchedTerms.length) pieces.push(`matched terms: ${matchedTerms.slice(0, 6).join(", ")}`);
  pieces.push(`candidate SKU ${item.sku} in family ${item.family}`);
  return pieces.join("; ");
}

function fitReason(input: z.infer<typeof packCalculatorZod>, dims: Dimensions, clearance: Record<string, number>): string {
  return [
    `Item ${input.item_length_in} x ${input.item_width_in} x ${input.item_depth_in} in with ${input.padding_in} in padding was compared against ${dims.raw}`,
    `clearance by sorted axis is ${clearance.largest_axis}/${clearance.middle_axis}/${clearance.smallest_axis} in`,
  ].join("; ");
}

function buildAlternativeSummary(requestedSpec: string, competitorReference: string | undefined, results: Array<{ sku: string; title: string; family: string }>): string {
  const source = competitorReference ? ` for ${competitorReference}` : "";
  const first = results[0];
  if (!first) return `No Packrift alternative was found${source} for ${requestedSpec}.`;
  return `Best Packrift candidate${source} for "${requestedSpec}" is SKU ${first.sku} (${first.title}). Confirm live product detail, price, and inventory before presenting it as a buyable alternative.`;
}

function buildPackCalculatorSummary(
  input: z.infer<typeof packCalculatorZod>,
  required: { length_in: number; width_in: number; depth_in: number },
  results: Array<{ sku: string; title: string }>
): string {
  const first = results[0];
  if (!first) {
    return `Calculated inside dimensions are ${required.length_in} x ${required.width_in} x ${required.depth_in} in, but no approved Packrift box or mailer fit.`;
  }
  return `Calculated inside dimensions are ${required.length_in} x ${required.width_in} x ${required.depth_in} in for a ${input.item_weight_lb} lb item. Top candidate is SKU ${first.sku} (${first.title}).`;
}

function buildInventorySummary(
  results: Array<{ sku: string; total_available_quantity: number; can_fulfill_requested_quantity: boolean; box_partners_locations_in_stock: number }>,
  requestedQuantity: number
): string {
  if (!results.length) return "No approved Packrift inventory rows were returned.";
  const ready = results.filter((row) => row.can_fulfill_requested_quantity).length;
  const first = results[0]!;
  return `${ready}/${results.length} approved item(s) can fulfill quantity ${requestedQuantity} in this live Shopify read. SKU ${first.sku} shows ${first.total_available_quantity} available across Shopify inventory and ${first.box_partners_locations_in_stock} BOX location(s) with available stock.`;
}

function voidFillGuidance(input: z.infer<typeof packCalculatorZod>, candidateDims: { length_in: number; width_in: number; depth_in: number | null } | null) {
  if (!candidateDims) {
    return {
      needed: "unknown",
      guidance: "No fitted package candidate was found, so void-fill need cannot be estimated from this response.",
    };
  }
  const clearance = axisClearance(
    {
      length_in: input.item_length_in,
      width_in: input.item_width_in,
      depth_in: input.item_depth_in,
    },
    { ...candidateDims, raw: "" }
  );
  const maxClearance = Math.max(clearance.largest_axis ?? 0, clearance.middle_axis ?? 0, clearance.smallest_axis ?? 0);
  if (input.use_case === "fragile" || maxClearance > 3) {
    return {
      needed: "likely",
      guidance: "Use protective cushioning or void fill before checkout, especially if the item is fragile or has more than 3 inches of clearance on any axis.",
    };
  }
  return {
    needed: maxClearance > 1.5 ? "possibly" : "minimal",
    guidance: "Confirm product fragility and movement tolerance. Use paper, bubble, or mailer padding if the item can move inside the selected package.",
  };
}

function tokenize(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9./]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return [...new Set(tokens)];
}

function numericId(value: string): string {
  const match = value.match(/(\d+)$/);
  return match ? match[1]! : value;
}

function isSensitiveProductText(value: string): boolean {
  return /\b(hazmat|haz\s*mat|un\s*certified|fda|medical|food\s*safe|aircraft)\b/i.test(value);
}
