import { z } from "zod";
import { APPROVED_CATALOG, ApprovedCatalogItem } from "../effective-approved-catalog.js";
import { approvalStatus } from "../approval.js";
import { buildMatchSummary, buildNoMatchRecovery, buildTrackingContext, trackedUrl } from "../conversion.js";
import type { Env } from "../shopify.js";

const AI_SALES_EVENT_PREFIX = "events/ai-sales";
const AI_SALES_EVENT_TTL_SECONDS = 60 * 60 * 24 * 90;

export const getReorderLinkSchema = {
  name: "get_reorder_link",
  title: "Get reorder link",
  description:
    "Return the reorder URL, product URL, and a copyable procurement spec for one catalog SKU or handle. Use for repeat-buy and procurement handoff workflows.",
  inputSchema: {
    type: "object",
    properties: {
      sku: { type: "string", description: "Packrift SKU such as 1066, MFL1295, or LL251WR." },
      handle: { type: "string", description: "Packrift product handle if SKU is unknown." },
      source_context: { type: "string", description: "Optional short context label, such as reorder or procurement." },
    },
  },
  annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
};

export const getBulkQuoteLinkSchema = {
  name: "get_bulk_quote_link",
  title: "Get bulk quote link",
  description:
    "Return a quote-request URL for an exact packaging spec or SKU. Use when no exact match exists or the buyer needs bulk or procurement review.",
  inputSchema: {
    type: "object",
    properties: {
      requested_spec: { type: "string", description: "Exact unavailable or bulk quote packaging spec." },
      sku: { type: "string", description: "Optional Packrift SKU to prefill if the quote relates to a known product." },
      family: { type: "string", description: "Optional product family such as boxes, labels, mailers, tape, or poly_bags." },
      quantity: { type: "string", description: "Optional buyer quantity. Numbers are accepted and coerced to string." },
      reason: { type: "string", description: "Optional reason for quote handoff." },
    },
    required: ["requested_spec"],
  },
  annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
};

export const explainNoExactMatchSchema = {
  name: "explain_no_exact_match",
  title: "Explain no exact match",
  description:
    "Explain why a nearby product should not be presented as an exact match for the buyer's spec, then return safe next actions and a quote-request URL.",
  inputSchema: {
    type: "object",
    properties: {
      requested_spec: { type: "string", description: "The buyer's exact requested packaging spec." },
      family: { type: "string", description: "Optional product family." },
      missing_or_mismatched_fields: {
        type: "array",
        items: { type: "string" },
        description: "Required fields that were unavailable or different, such as length, material, color, or pack_count.",
      },
      reason: { type: "string", description: "Optional short explanation from the caller." },
    },
    required: ["requested_spec"],
  },
  annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
};

const getReorderLinkZod = z
  .object({
    sku: z.string().min(1).max(80).optional(),
    handle: z.string().min(1).max(180).optional(),
    source_context: z.string().min(1).max(80).optional(),
    suppress_analytics: z.boolean().optional(),
    analytics_context: z.record(z.unknown()).optional(),
  })
  .refine((value) => Boolean(value.sku || value.handle), {
    message: "sku or handle is required",
  });

const getBulkQuoteLinkZod = z.object({
  requested_spec: z.string().min(1).max(220),
  sku: z.string().min(1).max(80).optional(),
  family: z.string().min(1).max(80).optional(),
  quantity: z.preprocess(
    (value) => (typeof value === "number" && Number.isFinite(value) ? String(value) : value),
    z.string().min(1).max(80).optional()
  ),
  reason: z.string().min(1).max(240).optional(),
  suppress_analytics: z.boolean().optional(),
  analytics_context: z.record(z.unknown()).optional(),
});

const explainNoExactMatchZod = z.object({
  requested_spec: z.string().min(1).max(220),
  family: z.string().min(1).max(80).optional(),
  missing_or_mismatched_fields: z.array(z.string().min(1).max(80)).default([]),
  reason: z.string().min(1).max(240).optional(),
  suppress_analytics: z.boolean().optional(),
  analytics_context: z.record(z.unknown()).optional(),
});

function compact(value: unknown): string {
  return String(value ?? "").trim();
}

function findApprovedProduct(input: { sku?: string; handle?: string }): ApprovedCatalogItem | null {
  const sku = compact(input.sku).toLowerCase();
  const handle = compact(input.handle).toLowerCase();
  return (
    APPROVED_CATALOG.find((item) => Boolean(sku) && item.sku.toLowerCase() === sku) ??
    APPROVED_CATALOG.find((item) => Boolean(handle) && item.handle.toLowerCase() === handle) ??
    null
  );
}

const PAID_AI_EXACT_SPEC_VIEW_SKUS = new Set(["1066", "MFL1295", "LL251WR"]);

function productUrl(item: ApprovedCatalogItem): string {
  return `https://packrift.com/products/${item.handle}`;
}

function productHandoffUrl(item: ApprovedCatalogItem): string {
  const url = new URL(productUrl(item));
  if (PAID_AI_EXACT_SPEC_VIEW_SKUS.has(item.sku.toUpperCase())) {
    url.searchParams.set("view", "ai-exact-spec-r2");
  }
  return url.toString();
}

function procurementSpec(item: ApprovedCatalogItem): string {
  return `SKU ${item.sku}: ${item.title}. Product URL: ${productHandoffUrl(item)}`;
}

function quoteUrl(input: z.infer<typeof getBulkQuoteLinkZod>): string {
  const quote = new URL("https://packrift.com/pages/bulk-quote");
  quote.searchParams.set("spec", input.requested_spec);
  if (input.sku) quote.searchParams.set("sku", input.sku);
  if (input.family) quote.searchParams.set("family", input.family);
  if (input.quantity) quote.searchParams.set("quantity", input.quantity);
  const tracking = buildBulkQuoteTracking(input);
  return trackedUrl(quote.toString(), { ...tracking, utm_content: "bulk_quote" });
}

function buildBulkQuoteTracking(input: z.infer<typeof getBulkQuoteLinkZod>) {
  return buildTrackingContext({
    source: "get_bulk_quote_link",
    selectedSku: input.sku,
    selectedHandle: input.sku ? undefined : "no_exact_match",
    matchType: "bulk_quote_or_no_match",
    utmTerm: input.requested_spec,
  });
}

function synthetic(input: { suppress_analytics?: boolean; analytics_context?: Record<string, unknown> }): boolean {
  return input.suppress_analytics === true || input.analytics_context?.synthetic === true;
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

async function recordProcurementEvent(env: Env, input: { suppress_analytics?: boolean; analytics_context?: Record<string, unknown> }, payload: Record<string, unknown>) {
  if (synthetic(input)) return;
  const receivedAt = new Date().toISOString();
  try {
    await env.CATALOG_CACHE.put(
      `${AI_SALES_EVENT_PREFIX}/${receivedAt.slice(0, 10)}/${receivedAt}-${crypto.randomUUID()}.json`,
      JSON.stringify({
        ...payload,
        sku: safeEventText(payload.sku, 80),
        handle: safeEventText(payload.handle, 160),
        family: safeEventText(payload.family, 80),
        requested_spec: safeEventText(payload.requested_spec, 220),
        query: safeEventText(payload.query, 220),
        source: safeEventText(payload.source, 80),
        match_type: safeEventText(payload.match_type, 80),
        received_at: receivedAt,
      }),
      { expirationTtl: AI_SALES_EVENT_TTL_SECONDS }
    );
  } catch {
    // Procurement tools should never fail because analytics storage is temporarily unavailable.
  }
}

export async function getReorderLinkHandler(env: Env, raw: unknown) {
  const input = getReorderLinkZod.parse(raw);
  const item = findApprovedProduct(input);
  if (!item) {
    const requested = input.sku ? `SKU ${input.sku}` : `handle ${input.handle}`;
    await recordProcurementEvent(env, input, {
      event: "no_match",
      source: "get_reorder_link",
      requested_spec: requested,
      match_type: "no_exact_match",
    });
    return {
      match: buildMatchSummary({
        source: "get_reorder_link",
        matchType: "no_exact_match",
        confidence: 0,
        matchedFields: ["AI_APPROVE"],
        reason: `No AI_APPROVE Packrift product matched ${requested}.`,
      }),
      no_match_recovery: buildNoMatchRecovery({
        source: "get_reorder_link",
        requestedSpec: requested,
        reason: `No AI_APPROVE Packrift product matched ${requested}; do not create a reorder handoff for an unapproved or unknown product.`,
      }),
    };
  }

  const tracking = buildTrackingContext({
    source: "get_reorder_link",
    sku: item.sku,
    handle: item.handle,
    variantId: item.variantId,
    selectedSku: item.sku,
    selectedHandle: item.handle,
    matchType: input.source_context ?? "reorder_by_sku",
    utmTerm: item.sku,
  });
  const reorder = new URL("https://packrift.com/pages/reorder-packaging-by-sku");
  reorder.searchParams.set("view", "packrift_ai_reorder_live_r07");
  reorder.hash = `sku-${item.sku.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "packrift"}`;
  await recordProcurementEvent(env, input, {
    event: "reorder_click",
    source: "get_reorder_link",
    sku: item.sku,
    handle: item.handle,
    family: item.family,
    requested_spec: item.sku,
    match_type: input.source_context ?? "reorder_by_sku",
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
  });

  return {
    ...approvalStatus(item),
    match: buildMatchSummary({
      source: "get_reorder_link",
      matchType: "exact_sku_or_handle",
      confidence: 0.99,
      matchedFields: [input.sku ? "sku" : "handle", "AI_APPROVE"],
      reason: "Reorder handoff is AI_APPROVE-gated and tied to the canonical Packrift product URL.",
    }),
    sku: item.sku,
    handle: item.handle,
    variant_id: item.variantId,
    family: item.family,
    title: item.title,
    product_url: trackedUrl(productHandoffUrl(item), tracking),
    reorder_url: trackedUrl(reorder.toString(), { ...tracking, utm_content: "reorder_click" }),
    quote_url: trackedUrl(
      `https://packrift.com/pages/bulk-quote?sku=${encodeURIComponent(item.sku)}&spec=${encodeURIComponent(item.title)}`,
      {
      ...tracking,
      utm_content: "quote_click",
      }
    ),
    copy_procurement_spec: procurementSpec(item),
    required_before_cart: ["get_pricing", "check_inventory", "buyer quantity confirmation"],
    tracking,
  };
}

export async function getBulkQuoteLinkHandler(env: Env, raw: unknown) {
  const input = getBulkQuoteLinkZod.parse(raw);
  const item = input.sku ? findApprovedProduct({ sku: input.sku }) : null;
  const tracking = buildBulkQuoteTracking(input);
  await recordProcurementEvent(env, input, {
    event: "quote_click",
    source: "get_bulk_quote_link",
    sku: item?.sku ?? input.sku ?? "",
    handle: item?.handle ?? "",
    family: item?.family ?? input.family ?? "",
    requested_spec: input.requested_spec,
    match_type: item ? "approved_sku_quote_handoff" : "bulk_quote_or_no_match",
    packrift_ai_id: tracking.packrift_ai_id,
    ai_commerce_id: tracking.ai_commerce_id,
    mcp_key: tracking.continuity_key,
    mcp_journey: tracking.journey_id,
    mcp_result_set: tracking.result_set_id ?? "",
    utm_source: tracking.utm_source,
    utm_medium: tracking.utm_medium,
    utm_campaign: tracking.utm_campaign,
    utm_content: "bulk_quote",
    utm_term: tracking.utm_term ?? "",
  });
  return {
    status: "quote_handoff",
    requested_spec: input.requested_spec,
    sku: item?.sku ?? input.sku ?? null,
    handle: item?.handle ?? null,
    family: item?.family ?? input.family ?? null,
    reason: input.reason ?? "Bulk or exact-spec review requested.",
    quote_url: quoteUrl(input),
    product_url: item ? productUrl(item) : null,
    copy_procurement_spec: item ? procurementSpec(item) : `Requested spec: ${input.requested_spec}.`,
    safe_next_action: "Use this quote URL when no exact AI_APPROVE product exists or when the buyer needs bulk/procurement review.",
    unsafe_action_blocked: "Do not present a nearby product as an exact substitute.",
  };
}

export async function explainNoExactMatchHandler(env: Env, raw: unknown) {
  const input = explainNoExactMatchZod.parse(raw);
  const fields = input.missing_or_mismatched_fields;
  const tracking = buildTrackingContext({
    source: "explain_no_exact_match",
    selectedHandle: "no_exact_match",
    matchType: "no_exact_match",
    utmTerm: input.requested_spec,
  });
  const reason =
    input.reason ??
    (fields.length
      ? `The requested spec differs on required fields: ${fields.join(", ")}.`
      : "The requested spec did not match an AI_APPROVE Packrift product exactly.");
  const quote = getBulkQuoteLinkZod.parse({
    requested_spec: input.requested_spec,
    family: input.family,
    reason,
    suppress_analytics: true,
    analytics_context: { synthetic: true, source: "explain_no_exact_match_nested_quote" },
  });
  await recordProcurementEvent(env, input, {
    event: "no_match",
    source: "explain_no_exact_match",
    family: input.family ?? "",
    requested_spec: input.requested_spec,
    query: fields.join(", "),
    match_type: "no_exact_match",
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
  });
  return {
    match_type: "no_exact_match",
    requested_spec: input.requested_spec,
    family: input.family ?? null,
    missing_or_mismatched_fields: fields,
    reason,
    no_match_policy: "Exact matches only for purchase handoff. Nearby products must be labeled as alternatives and require buyer confirmation.",
    no_match_recovery: buildNoMatchRecovery({
      source: "explain_no_exact_match",
      requestedSpec: input.requested_spec,
      useCase: input.family,
      reason,
    }),
    bulk_quote: await getBulkQuoteLinkHandler(env, quote),
    safe_next_actions: ["request_bulk_quote", "ask_which_attribute_can_vary", "show_family_page_without_calling_it_exact"],
    unsafe_action_blocked: "Do not call a different dimension, material, color, closure, adhesive, printer type, strength, pack count, or SKU an exact match.",
  };
}
