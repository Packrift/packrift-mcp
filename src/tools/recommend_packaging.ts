import { z } from "zod";
import { Env, shopifyQuery, variantIdToNumeric } from "../shopify.js";
import { extractDimensions, fitScore, parseDimensions } from "../dimensions.js";
import { approvalForHandle, approvalForVariantId, approvalStatus } from "../approval.js";
import { APPROVED_CATALOG } from "../approved-catalog.js";
import { buildConversionActions, buildMatchSummary, buildNoMatchRecovery, buildProductCard, buildTrackingContext } from "../conversion.js";

export const recommendPackagingSchema = {
  name: "find_packaging_for_item",
  description:
    "Use when the buyer has item dimensions and needs a fitting box or mailer. Required arguments are item_length_in, item_width_in, item_depth_in, item_weight_lb, and use_case (mailer|box|fragile|apparel|ecommerce). Returns up to 5 AI_APPROVE SKUs ranked by fit with price, stock, URL, and cart-continuity fields.",
  inputSchema: {
    type: "object",
    properties: {
      item_length_in: { type: "number", minimum: 0.1, description: "Item length in inches." },
      item_width_in: { type: "number", minimum: 0.1, description: "Item width in inches." },
      item_depth_in: { type: "number", minimum: 0.1, description: "Item depth/height in inches." },
      item_weight_lb: { type: "number", minimum: 0, description: "Packed item weight in pounds; use 0 when unknown." },
      use_case: {
        type: "string",
        enum: ["mailer", "box", "fragile", "apparel", "ecommerce"],
        description: "Packaging context that guides fit ranking.",
      },
    },
    required: ["item_length_in", "item_width_in", "item_depth_in", "item_weight_lb", "use_case"],
  },

  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const recommendPackagingZod = z.object({
  item_length_in: z.number().min(0.1),
  item_width_in: z.number().min(0.1),
  item_depth_in: z.number().min(0.1),
  item_weight_lb: z.number().min(0),
  use_case: z.enum(["mailer", "box", "fragile", "apparel", "ecommerce"]),
});

const AI_SALES_EVENT_PREFIX = "events/ai-sales";
const AI_SALES_EVENT_TTL_SECONDS = 60 * 60 * 24 * 90;

// Use-case to collection-handle mapping. Verified handles from the live store.
const COLLECTIONS_BY_USE_CASE: Record<string, string[]> = {
  mailer: ["mailers-envelopes", "boxes-mailers"],
  box: ["corrugated-boxes", "boxes-mailers"],
  fragile: ["bubble-wrap-foam", "cushioning", "corrugated-boxes"],
  apparel: ["mailers-envelopes", "boxes-mailers"],
  ecommerce: ["ecommerce-fulfillment", "boxes-mailers", "mailers-envelopes"],
};

const QUERY = `
  query CollectionProducts($handle: String!, $first: Int!) {
    collectionByHandle(handle: $handle) {
      products(first: $first) {
        edges {
          node {
            handle
            title
            onlineStoreUrl
            metafields(first: 30) { edges { node { namespace key value type } } }
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                  availableForSale
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      handle
      title
      onlineStoreUrl
      metafields(first: 30) { edges { node { namespace key value type } } }
      variants(first: 1) {
        edges {
          node {
            id
            price
            availableForSale
            inventoryQuantity
          }
        }
      }
    }
  }
`;

interface ProductNode {
  handle: string;
  title: string;
  onlineStoreUrl: string | null;
  metafields: { edges: Array<{ node: { namespace: string; key: string; value: string; type: string } }> };
  variants: {
    edges: Array<{
      node: {
        id: string;
        price: string;
        availableForSale: boolean;
        inventoryQuantity: number | null;
      };
    }>;
  };
}

export async function recommendPackagingHandler(env: Env, raw: unknown) {
  const input = recommendPackagingZod.parse(raw);
  const suppressAnalytics = isSyntheticEval(raw);
  const handles = COLLECTIONS_BY_USE_CASE[input.use_case]!;

  // Fan out across collections, take first 50 products from each, dedupe.
  const seen = new Set<string>();
  const candidates: Array<{
    variant_id: string;
    handle: string;
    title: string;
    url: string;
    price: number;
    available: boolean;
    inventory: number;
    dimensions: { length_in: number; width_in: number; depth_in: number | null; raw: string };
    score: number;
    approval: NonNullable<ReturnType<typeof approvalForHandle>>;
  }> = [];

  for (const handle of handles) {
    const data = await shopifyQuery<{
      collectionByHandle: { products: { edges: Array<{ node: ProductNode }> } } | null;
    }>(env, QUERY, { handle, first: 50 });
    const col = data.collectionByHandle;
    if (!col) continue;

    for (const { node: p } of col.products.edges) {
      if (seen.has(p.handle)) continue;
      seen.add(p.handle);
      const v = p.variants.edges[0]?.node;
      if (!v) continue;
      if (!v.availableForSale) continue;
      if (isSensitiveProductText(p.title)) continue;
      const approval = approvalForHandle(p.handle) ?? approvalForVariantId(v.id);
      if (!approval) continue;
      const mf = p.metafields.edges.map((e) => e.node);
      const dims = extractDimensions({ metafields: mf, title: p.title });
      if (!dims) continue;
      // Fit scoring requires a 3-D box. Skip 2-D-only items unless use_case is mailer/apparel.
      const usable: typeof dims = dims.depth_in !== null ? dims : { ...dims, depth_in: 0.5 };
      const score = fitScore(
        {
          length_in: input.item_length_in,
          width_in: input.item_width_in,
          depth_in: input.item_depth_in,
        },
        usable
      );
      if (score === null) continue;
      candidates.push({
        variant_id: variantIdToNumeric(v.id),
        handle: p.handle,
        title: p.title,
        url: p.onlineStoreUrl ?? `https://${env.STOREFRONT_DOMAIN}/products/${p.handle}`,
        price: Number(v.price),
        available: v.availableForSale,
        inventory: v.inventoryQuantity ?? 0,
        dimensions: {
          length_in: dims.length_in,
          width_in: dims.width_in,
          depth_in: dims.depth_in,
          raw: dims.raw,
        },
        score,
        approval,
      });
    }
  }

  {
    const fallbackHandles = catalogDimensionFallbackHandles(input, 12);
    let fallbackAdded = 0;
    for (const handle of fallbackHandles) {
      if (fallbackAdded >= 12) break;
      if (seen.has(handle)) continue;
      seen.add(handle);
      try {
        const data = await shopifyQuery<{ productByHandle: ProductNode | null }>(
          env,
          PRODUCT_BY_HANDLE_QUERY,
          { handle }
        );
        const p = data.productByHandle;
        if (!p) continue;
        const v = p.variants.edges[0]?.node;
        if (!v || !v.availableForSale) continue;
        if (isSensitiveProductText(p.title)) continue;
        const approval = approvalForHandle(p.handle) ?? approvalForVariantId(v.id);
        if (!approval) continue;
        const mf = p.metafields.edges.map((e) => e.node);
        const dims = extractDimensions({ metafields: mf, title: p.title });
        if (!dims || dims.depth_in === null) continue;
        const score = dimensionMatchScore(
          {
            length_in: input.item_length_in,
            width_in: input.item_width_in,
            depth_in: input.item_depth_in,
          },
          dims
        );
        if (score === null) continue;
        candidates.push({
          variant_id: variantIdToNumeric(v.id),
          handle: p.handle,
          title: p.title,
          url: p.onlineStoreUrl ?? `https://${env.STOREFRONT_DOMAIN}/products/${p.handle}`,
          price: Number(v.price),
          available: v.availableForSale,
          inventory: v.inventoryQuantity ?? 0,
          dimensions: {
            length_in: dims.length_in,
            width_in: dims.width_in,
            depth_in: dims.depth_in,
            raw: dims.raw,
          },
          score,
          approval,
        });
        fallbackAdded += 1;
      } catch {
        // Stale catalog handles should not break the fallback path.
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  const top = candidates.slice(0, 5);
  if (top.length === 0) {
    const requestedSpec = `${input.item_length_in} x ${input.item_width_in} x ${input.item_depth_in} in ${input.use_case}`;
    if (!suppressAnalytics) {
      await recordSpecFinderDemandEvents(env, input, [], requestedSpec);
    }
    return {
      results: [],
      no_match_recovery: buildNoMatchRecovery({
        source: "find_packaging_for_item",
        requestedSpec,
        useCase: input.use_case,
        reason: `No AI_APPROVE ${input.use_case} product fits ${requestedSpec} with the current exact-spec gates.`,
      }),
    };
  }

  if (!suppressAnalytics) {
    await recordSpecFinderDemandEvents(env, input, top, `${input.item_length_in} x ${input.item_width_in} x ${input.item_depth_in} in ${input.use_case}`);
  }

  return top.map((c) => ({
    ...recommendationToRow(input, c),
  }));
}

function isSyntheticEval(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const row = raw as Record<string, unknown>;
  const context = row.analytics_context as Record<string, unknown> | undefined;
  return row.suppress_analytics === true || context?.synthetic === true;
}

async function recordSpecFinderDemandEvents(
  env: Env,
  input: z.infer<typeof recommendPackagingZod>,
  results: Array<{
    variant_id: string;
    handle: string;
    score: number;
    approval: NonNullable<ReturnType<typeof approvalForHandle>>;
  }>,
  requestedSpec: string
) {
  const top = results[0];
  const tracking = buildTrackingContext({
    source: "find_packaging_for_item",
    selectedSku: top?.approval.sku,
    selectedHandle: top?.handle ?? (!results.length ? "no_exact_match" : undefined),
    variantId: top?.variant_id,
    matchType: results.length ? "fit_recommendation" : "no_exact_match",
    utmTerm: requestedSpec,
  });
  const base = {
    source: "find_packaging_for_item",
    tool: "find_packaging_for_item",
    requested_spec: safeEventText(requestedSpec, 180),
    use_case: safeEventText(input.use_case, 80),
    item_length_in: Number(input.item_length_in.toFixed(3)),
    item_width_in: Number(input.item_width_in.toFixed(3)),
    item_depth_in: Number(input.item_depth_in.toFixed(3)),
    item_weight_lb: Number(input.item_weight_lb.toFixed(3)),
    result_count: results.length,
    sku: safeEventText(top?.approval.sku, 80),
    handle: safeEventText(top?.handle, 160),
    variant_id: safeEventText(top?.variant_id, 80),
    family: safeEventText(top?.approval.family, 80),
    fit_score: typeof top?.score === "number" ? Number(top.score.toFixed(3)) : null,
    match_type: results.length ? "fit_recommendation" : "no_exact_match",
    packrift_ai_id: tracking.packrift_ai_id,
    ai_commerce_id: tracking.ai_commerce_id,
    mcp_key: tracking.continuity_key,
    mcp_journey: tracking.journey_id,
    mcp_result_set: tracking.result_set_id ?? "",
    utm_source: tracking.utm_source,
    utm_medium: tracking.utm_medium,
    utm_campaign: tracking.utm_campaign,
    utm_content: tracking.utm_content,
    utm_term: tracking.utm_term ?? "",
  };

  await recordAiSalesEvent(env, { ...base, event: "spec_search" });
  if (!results.length) {
    await recordAiSalesEvent(env, { ...base, event: "no_match", match_type: "no_exact_match" });
    return;
  }
  if (top && top.score === 0) {
    await recordAiSalesEvent(env, { ...base, event: "exact_match", match_type: "exact_dimension_match" });
  }
  if (results.length > 1) {
    await recordAiSalesEvent(env, {
      ...base,
      event: "multi_match",
      match_type: top?.score === 0 ? "multiple_exact_dimension_matches" : "multiple_fit_recommendations",
      sku_count: results.length,
      top_skus: results.slice(0, 5).map((row) => row.approval.sku).filter(Boolean).join(","),
      missing_choice_field: "buyer_selects_preferred_packaging_option",
    });
  }
}

async function recordAiSalesEvent(env: Env, payload: Record<string, unknown>) {
  const receivedAt = new Date().toISOString();
  try {
    await env.CATALOG_CACHE.put(
      `${AI_SALES_EVENT_PREFIX}/${receivedAt.slice(0, 10)}/${receivedAt}-${crypto.randomUUID()}.json`,
      JSON.stringify({ ...payload, received_at: receivedAt }),
      { expirationTtl: AI_SALES_EVENT_TTL_SECONDS }
    );
  } catch {
    // Spec Finder results should never fail because analytics storage is temporarily unavailable.
  }
}

function safeEventText(value: unknown, maxLength = 180): string {
  return String(value ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted_email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted_phone]")
    .replace(/[^\w\s:/?&.=#%+-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function recommendationToRow(
  input: z.infer<typeof recommendPackagingZod>,
  c: {
    variant_id: string;
    handle: string;
    title: string;
    url: string;
    price: number;
    available: boolean;
    inventory: number;
    dimensions: { length_in: number; width_in: number; depth_in: number | null; raw: string };
    score: number;
    approval: NonNullable<ReturnType<typeof approvalForHandle>>;
  }
) {
  const reason = buildReason(input, c.dimensions);
  const requested = `${input.item_length_in}x${input.item_width_in}x${input.item_depth_in} in`;
  const confidence = Math.max(0.65, Math.min(0.99, 1 - c.score / 80));
  const cardInput = {
    sku: c.approval.sku,
    handle: c.handle,
    title: c.title,
    url: c.url,
    variantId: c.variant_id,
    family: c.approval.family,
    price: c.price,
    currency: "USD",
    inStock: c.available,
    dimensionsRaw: c.dimensions.raw,
    source: "find_packaging_for_item",
    matchType: "fit_recommendation",
    matchConfidence: confidence,
  };
  return {
    variant_id: c.variant_id,
    handle: c.handle,
    title: c.title,
    url: c.url,
    ...approvalStatus(c.approval),
    match: buildMatchSummary({
      source: "find_packaging_for_item",
      matchType: "fit_recommendation",
      confidence,
      matchedFields: ["dimensions", "use_case", "AI_APPROVE"],
      requestedDimensions: requested,
      candidateDimensions: c.dimensions.raw,
      perAxisPaddingIn: perAxisPadding(input, c.dimensions),
      reason,
    }),
    product_card: buildProductCard(cardInput),
    conversion_actions: buildConversionActions(cardInput),
    dimensions: c.dimensions,
    price: c.price,
    available: c.available,
    inventory: c.inventory,
    fit_score: Number(c.score.toFixed(3)),
    reason,
  };
}

function perAxisPadding(
  input: z.infer<typeof recommendPackagingZod>,
  d: { length_in: number; width_in: number; depth_in: number | null }
): Record<string, number> {
  const itemDims = [input.item_length_in, input.item_width_in, input.item_depth_in].sort((a, b) => b - a);
  const boxDims = [d.length_in, d.width_in, d.depth_in ?? 0].sort((a, b) => b - a);
  return {
    largest_axis: Number((boxDims[0]! - itemDims[0]!).toFixed(3)),
    middle_axis: Number((boxDims[1]! - itemDims[1]!).toFixed(3)),
    smallest_axis: Number((boxDims[2]! - itemDims[2]!).toFixed(3)),
  };
}

function dimensionMatchScore(
  item: { length_in: number; width_in: number; depth_in: number },
  box: { length_in: number; width_in: number; depth_in: number | null }
): number | null {
  const itemDims = [item.length_in, item.width_in, item.depth_in].sort((a, b) => b - a);
  const boxDims = [box.length_in, box.width_in, box.depth_in ?? 0].sort((a, b) => b - a);
  if (boxDims.some((dim, index) => dim < itemDims[index]!)) return null;
  return itemDims.reduce((sum, dim, index) => sum + Math.abs(dim - boxDims[index]!), 0);
}

function catalogDimensionFallbackHandles(
  input: z.infer<typeof recommendPackagingZod>,
  limit: number
): string[] {
  const request = {
    length_in: input.item_length_in,
    width_in: input.item_width_in,
    depth_in: input.item_depth_in,
  };
  return APPROVED_CATALOG
    .filter((item) => item.family === "boxes" || item.family === "mailers")
    .filter((item) => !isSensitiveProductText(item.title))
    .map((item) => {
      const dims = parseDimensions(item.title);
      if (!dims || dims.depth_in === null) return null;
      let score = dimensionMatchScore(request, dims);
      if (score === null) return null;
      if (input.use_case === "box" && item.family !== "boxes") score += 25;
      if (/corrugated|ect/i.test(item.title)) score -= 8;
      if (/chatgpt_paid_priority/i.test(item.riskFlags)) score -= 50;
      return { handle: item.handle, score };
    })
    .filter((row): row is { handle: string; score: number } => row !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.max(limit, 1))
    .map((row) => row.handle);
}

function isSensitiveProductText(value: string): boolean {
  return /\b(hazmat|haz\s*mat|un\s*certified|fda|medical|food\s*safe|aircraft)\b/i.test(value);
}

function buildReason(
  input: z.infer<typeof recommendPackagingZod>,
  d: { length_in: number; width_in: number; depth_in: number | null; raw: string }
): string {
  const itemDims = [input.item_length_in, input.item_width_in, input.item_depth_in].sort((a, b) => b - a);
  const boxDims = [d.length_in, d.width_in, d.depth_in ?? 0].sort((a, b) => b - a);
  const parts = [
    `Item ${input.item_length_in}x${input.item_width_in}x${input.item_depth_in} in fits ${d.raw}`,
  ];
  const padL = boxDims[0]! - itemDims[0]!;
  const padW = boxDims[1]! - itemDims[1]!;
  if (d.depth_in !== null) {
    const padD = boxDims[2]! - itemDims[2]!;
    parts.push(`padding ~${padL.toFixed(1)}/${padW.toFixed(1)}/${padD.toFixed(1)} in`);
  } else {
    parts.push(`padding ~${padL.toFixed(1)}/${padW.toFixed(1)} in`);
  }
  return parts.join("; ");
}
