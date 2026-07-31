import { z } from "zod";
import { Env, shopifyQuery, variantIdToNumeric } from "../shopify.js";
import { approvalForHandle, approvalForVariantId, approvalStatus } from "../approval.js";
import { APPROVED_CATALOG } from "../effective-approved-catalog.js";
import { buildConversionActions, buildMatchSummary, buildNoMatchRecovery, buildProductCard, buildTrackingContext } from "../conversion.js";
import {
  DIMENSION_EXACT_MIN_SCORE,
  dimensionTokens,
  normalizeText,
  queryIncludesSku,
  type RankableRow,
  scoreRow,
  searchTokens,
} from "../search-ranking.js";

export const searchProductsSchema = {
  name: "search_products",
  title: "Search products",
  description:
    "Use when the user names a category by keyword (e.g. 'kraft tape', 'bubble mailer', 'starter kit') with no dimensions. For dimension-based fit, prefer find_packaging_for_item. Returns products with price, stock, URL.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search; matches title, vendor, type, tags." },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
    },
    required: ["query"],
  },

  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const searchProductsZod = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
});

const AI_SALES_EVENT_PREFIX = "events/ai-sales";
const AI_SALES_EVENT_TTL_SECONDS = 60 * 60 * 24 * 90;

const QUERY = `
  query SearchProducts($q: String!, $first: Int!) {
    products(first: $first, query: $q) {
      edges {
        node {
          id
          handle
          title
          vendor
          onlineStoreUrl
          totalInventory
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          featuredImage { url }
          variants(first: 1) { edges { node { id availableForSale } } }
        }
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      handle
      title
      vendor
      onlineStoreUrl
      totalInventory
      priceRangeV2 {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      featuredImage { url }
      variants(first: 1) { edges { node { id availableForSale } } }
    }
  }
`;

interface ProductNode {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  onlineStoreUrl: string | null;
  totalInventory: number | null;
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  featuredImage: { url: string } | null;
  variants: { edges: Array<{ node: { id: string; availableForSale: boolean } }> };
}

export async function searchProductsHandler(env: Env, raw: unknown) {
  const { query, limit } = searchProductsZod.parse(raw);
  const suppressAnalytics = isSyntheticEval(raw);

  const cacheKey = `search:ai-approve:v13:${limit}:${query}`;
  if (!suppressAnalytics) {
    const cached = await env.CATALOG_CACHE.get(cacheKey, "json");
    if (cached) {
      if (Array.isArray(cached)) {
        await recordSearchDemandEvents(env, query, limit, cached, true);
      } else if (isSearchNoMatchResult(cached)) {
        await recordSearchDemandEvents(env, query, limit, [], true, 0, true);
      }
      return cached;
    }
  }

  const fetchLimit = Math.min(Math.max(limit * 5, limit), 50);
  const data = await shopifyQuery<{ products: { edges: Array<{ node: ProductNode }> } }>(
    env,
    QUERY,
    { q: query, first: fetchLimit }
  );

  const rows = data.products.edges
    .map(({ node }) => productToSearchRow(env, node))
    .filter((row): row is NonNullable<ReturnType<typeof productToSearchRow>> => row !== null)
    .filter((row) => searchAllowsSensitive(query) || !isSensitiveProductText(row.title));

  const seen = new Set(rows.map((row) => row.handle));
  const dims = dimensionTokens(query);
  const fallbackHandles = catalogFallbackHandles(query, limit * 2).filter((handle) => !seen.has(handle));
  // Keyword queries: always merge the top locally-ranked catalog candidates
  // into the pool (budgeted at `limit` fetches) even when the Shopify text
  // search already filled `limit` rows — Shopify's text match routinely misses
  // the category-correct product (e.g. use-case queries), and the ranking pass
  // below decides the final order anyway. Dimension queries keep fetching the
  // full fallback list (unchanged behavior: the >=250 exact gate re-applies).
  let keywordFallbackFetches = 0;
  for (const handle of fallbackHandles) {
    if (!dims.length && keywordFallbackFetches >= limit) break;
    keywordFallbackFetches += 1;
    try {
      const detail = await shopifyQuery<{ productByHandle: ProductNode | null }>(
        env,
        PRODUCT_BY_HANDLE_QUERY,
        { handle }
      );
      if (!detail.productByHandle) continue;
      const row = productToSearchRow(env, detail.productByHandle);
      if (!row || seen.has(row.handle)) continue;
      if (!searchAllowsSensitive(query) && isSensitiveProductText(row.title)) continue;
      rows.push(row);
      seen.add(row.handle);
    } catch {
      // A stale approved-catalog handle should not break search.
    }
  }

  const rankedRows = rows
    .filter((row) => searchAllowsExactOnlyMarginHold(query, row.approved_sku ?? "", row.approved_risk_flags ?? ""))
    .map((row) => ({ row, ...scoreSearchRow(query, row) }))
    .sort((a, b) => b.score - a.score);
  // Dimension queries: keep only exact-spec candidates (unchanged behavior).
  // Keyword queries: keep only rows with a qualifying signal so a row that
  // matched ONLY low-signal modifiers ("mil"/"free") no longer surfaces.
  const filteredRows = dims.length
    ? rankedRows.filter(({ score }) => score >= DIMENSION_EXACT_MIN_SCORE)
    : rankedRows.filter(({ qualifies }) => qualifies);
  const noExactMatch = !filteredRows.length;
  const out = noExactMatch
    ? buildSearchNoMatchResult(query, rankedRows.length, dims.length > 0)
    : filteredRows.slice(0, limit).map(({ row }) => row);

  if (!suppressAnalytics) {
    await env.CATALOG_CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 300 });
  }
  if (!suppressAnalytics) {
    await recordSearchDemandEvents(
      env,
      query,
      limit,
      Array.isArray(out) ? out : [],
      false,
      rankedRows[0]?.score ?? 0,
      noExactMatch
    );
  }
  return out;
}

function isSyntheticEval(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const row = raw as Record<string, unknown>;
  const context = row.analytics_context as Record<string, unknown> | undefined;
  return row.suppress_analytics === true || context?.synthetic === true;
}

function isSearchNoMatchResult(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && (raw as Record<string, unknown>).no_match_recovery);
}

function buildSearchNoMatchResult(query: string, blockedCandidateCount: number, isDimension = false) {
  const reason = isDimension
    ? `No AI_APPROVE product exactly matched the dimension-bearing search "${query}". Nearby keyword matches were blocked from being presented as exact substitutes.`
    : `No AI_APPROVE product matched the discriminating terms in "${query}". Only generic-modifier (e.g. "mil", "free", "case") matches were found, which are not reliable product matches, so they were not presented as exact substitutes.`;
  return {
    results: [],
    match: buildMatchSummary({
      source: "search_products",
      matchType: "no_exact_match",
      confidence: 0,
      matchedFields: ["query", "dimensions", "AI_APPROVE"],
      reason,
    }),
    no_match_recovery: buildNoMatchRecovery({
      source: "search_products",
      requestedSpec: query,
      reason,
    }),
    blocked_candidate_count: blockedCandidateCount,
  };
}

async function recordSearchDemandEvents(
  env: Env,
  query: string,
  limit: number,
  results: unknown[],
  cached: boolean,
  topScore?: number,
  dimensionNoExact = false
) {
  const rows = summarizeSearchRows(results);
  const dims = dimensionTokens(query);
  const top = rows[0];
  const score = topScore ?? scoreSearchSummary(query, top);
  const noExactMatch = !rows.length || dimensionNoExact || Boolean(dims.length && score < 250);
  const tracking = buildTrackingContext({
    source: "search_products",
    selectedSku: top?.sku,
    selectedHandle: top?.handle ?? (noExactMatch ? "no_exact_match" : undefined),
    matchType: noExactMatch ? "no_exact_match" : "keyword_or_exact_search",
    utmTerm: query,
  });
  const base = {
    source: "search_products",
    query: safeEventText(query, 220),
    limit,
    result_count: rows.length,
    cached,
    search_has_dimensions: dims.length > 0,
    top_score: score,
    sku: top?.sku ?? "",
    handle: top?.handle ?? "",
    family: top?.family ?? "",
    match_type: noExactMatch ? "no_exact_match" : "keyword_or_exact_search",
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
  if (noExactMatch) {
    await recordAiSalesEvent(env, { ...base, event: "no_match", match_type: "no_exact_match" });
    return;
  }
  if ((dims.length && score >= 250) || score >= 900) {
    await recordAiSalesEvent(env, { ...base, event: "exact_match", match_type: "exact_candidate" });
  }
  if (rows.length > 1) {
    await recordAiSalesEvent(env, {
      ...base,
      event: "multi_match",
      match_type: dims.length ? "multiple_dimension_candidates" : "multiple_keyword_candidates",
      sku_count: rows.length,
      top_skus: rows.slice(0, 5).map((row) => row.sku).filter(Boolean).join(","),
      missing_choice_field: dims.length ? "buyer_selects_best_exact_candidate" : "buyer_refines_exact_spec_or_sku",
    });
  }
}

function summarizeSearchRows(results: unknown[]): Array<{ sku: string; handle: string; family: string }> {
  return results
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        sku: safeEventText(row.approved_sku, 80),
        handle: safeEventText(row.handle, 160),
        family: safeEventText(row.approved_family, 80),
      };
    })
    .filter((row) => row.sku || row.handle);
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
    // Search should never fail because analytics storage is temporarily unavailable.
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

function productToSearchRow(env: Env, node: ProductNode) {
  const firstVariant = node.variants.edges[0]?.node;
  const approval =
    approvalForHandle(node.handle) ??
    (firstVariant ? approvalForVariantId(firstVariant.id) : null);
  if (!approval) return null;
  const variantId = firstVariant ? variantIdToNumeric(firstVariant.id) : null;
  const url = node.onlineStoreUrl ?? `https://${env.STOREFRONT_DOMAIN}/products/${node.handle}`;
  const priceMin = Number(node.priceRangeV2.minVariantPrice.amount);
  const currency = node.priceRangeV2.minVariantPrice.currencyCode;
  const inStock =
    (node.totalInventory ?? 0) > 0 ||
    node.variants.edges.some((e) => e.node.availableForSale);
  const cardInput = {
    sku: approval.sku,
    handle: node.handle,
    title: node.title,
    url,
    variantId,
    family: approval.family,
    imageUrl: node.featuredImage?.url ?? null,
    price: priceMin,
    currency,
    inStock,
    source: "search_products",
    matchType: "keyword_or_exact_search",
  };
  return {
    id: variantId ?? variantIdToNumeric(node.id),
    variant_id: variantId,
    handle: node.handle,
    title: node.title,
    vendor: node.vendor,
    ...approvalStatus(approval),
    approved_search_aliases: String((approval as { searchAliases?: string }).searchAliases ?? ""),
    price_range: {
      min: priceMin,
      max: Number(node.priceRangeV2.maxVariantPrice.amount),
      currency,
    },
    in_stock: inStock,
    primary_image_url: node.featuredImage?.url ?? null,
    url,
    match: buildMatchSummary({
      source: "search_products",
      matchType: "keyword_or_exact_search",
      confidence: 0.82,
      matchedFields: ["query", "title", "sku", "handle", "family"],
      exactTermsMatched: searchTokens(`${approval.sku} ${node.handle} ${node.title}`).filter((token) =>
        normalizeText(`${node.handle} ${node.title} ${approval.sku}`).includes(token)
      ).slice(0, 12),
      reason: "Search result is AI_APPROVE-gated and ranked by exact SKU, handle, dimension, and title tokens.",
    }),
    product_card: buildProductCard(cardInput),
    conversion_actions: buildConversionActions(cardInput),
  };
}

// Map an in-flight Shopify search row into the shared ranking shape.
function toRankableRow(row: NonNullable<ReturnType<typeof productToSearchRow>>): RankableRow {
  return {
    sku: row.approved_sku ?? "",
    handle: row.handle,
    title: row.title,
    family: row.approved_family ?? "",
    searchAliases: row.approved_search_aliases ?? "",
  };
}

function catalogFallbackHandles(query: string, limit: number): string[] {
  const dims = dimensionTokens(query);
  const allowSensitive = searchAllowsSensitive(query);
  const scored = APPROVED_CATALOG.map((item) => {
    if (!allowSensitive && isSensitiveProductText(item.title)) return { handle: item.handle, score: 0, qualifies: false };
    if (!searchAllowsExactOnlyMarginHold(query, item.sku, item.riskFlags)) {
      return { handle: item.handle, score: 0, qualifies: false };
    }
    const { score, qualifies } = scoreRow(query, {
      sku: item.sku,
      handle: item.handle,
      title: item.title,
      family: item.family,
      searchAliases: item.searchAliases,
    });
    return { handle: item.handle, score, qualifies };
  })
    // Dimension queries can still pull near-dimension candidates into the fetch
    // pool (the handler re-applies the >=250 exact gate). Keyword queries only
    // pull rows that cleared the qualifying-signal gate, so generic-modifier-only
    // rows ("mil"/"free" tape) never enter the candidate set.
    .filter((row) => (dims.length ? row.score > 0 : row.qualifies))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(limit, 1)).map((row) => row.handle);
}

function searchAllowsExactOnlyMarginHold(query: string, sku: string, riskFlags: string | null): boolean {
  const flags = String(riskFlags ?? "").toLowerCase();
  if (!flags.includes("low_margin_exact_sku_only") && !flags.includes("verified_low_margin_review_required")) {
    return true;
  }
  const queryNorm = normalizeText(query);
  const hasDims = dimensionTokens(query).length > 0;
  return queryIncludesSku(queryNorm, sku, hasDims);
}

// Relevance scoring is delegated to ../search-ranking (IDF + phrase + field
// boost + qualifying gate). Returns { score, qualifies, matchedDiscriminating }.
function scoreSearchRow(query: string, row: NonNullable<ReturnType<typeof productToSearchRow>>) {
  return scoreRow(query, toRankableRow(row));
}

function scoreSearchSummary(
  query: string,
  row?: { sku: string; handle: string; family: string }
): number {
  if (!row) return 0;
  return scoreRow(query, { sku: row.sku, handle: row.handle, title: "", family: row.family }).score;
}

function searchAllowsSensitive(value: string): boolean {
  return /\bsku\s+[a-z0-9._-]+\b/i.test(value) || /\b(hazmat|haz\s*mat|hazardous|un\s*certified|certified|paint\s*can|dangerous\s*goods|anti[-\s]*static|vci|corrosion|fda|food[-\s]*(?:safe|grade)|medical)\b/i.test(value);
}

function isSensitiveProductText(value: string): boolean {
  return /\b(hazmat|haz\s*mat|un\s*certified|fda|medical|food[-\s]*(?:safe|grade)|aircraft|anti[-\s]*static|vci|corrosion)\b/i.test(value);
}
