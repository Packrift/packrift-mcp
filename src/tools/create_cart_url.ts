import { z } from "zod";
import { Env, variantIdToNumeric } from "../shopify.js";
import { assertApprovedVariantIds } from "../approval.js";
import { addCartPermalinkAttribution, buildPostConfirmationHandoff, buildTrackingContext } from "../conversion.js";

export const createCartUrlSchema = {
  name: "create_cart_url",
  description:
    "Final step: hand the user off to checkout. Inputs: items[{variant_id, qty}], optional discount_code. Returns a Packrift cart landing URL with ref=mcp plus UTM attribution for AI-commerce purchase tracking, and the final Shopify cart permalink.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            variant_id: { type: "string" },
            qty: { type: "integer", minimum: 1 },
          },
          required: ["variant_id", "qty"],
        },
      },
      discount_code: { type: "string" },
      ref: { type: "string", default: "mcp" },
      source_context: {
        type: "string",
        description: "Optional short context for analytics, such as exact_match, reorder, quote_followup, or ai_agent.",
      },
      journey_id: { type: "string" },
      packrift_ai_id: { type: "string" },
      ai_commerce_id: { type: "string" },
      result_set_id: { type: "string" },
      selected_sku: { type: "string" },
      selected_handle: { type: "string" },
      match_type: { type: "string" },
      reorder_source: { type: "string" },
      utm_term: { type: "string" },
      suppress_analytics: {
        type: "boolean",
        description: "Internal QA flag. When true, do not record an AI-sales cart event.",
      },
      analytics_context: {
        type: "object",
        description: "Internal QA context for synthetic evals.",
      },
    },
    required: ["items"],
  },

  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const createCartUrlZod = z.object({
  items: z
    .array(
      z.object({
        variant_id: z.string(),
        qty: z.number().int().min(1),
      })
    )
    .min(1),
  discount_code: z.string().min(1).optional(),
  ref: z.string().default("mcp"),
  source_context: z.string().min(1).max(80).optional(),
  journey_id: z.string().min(1).max(120).optional(),
  packrift_ai_id: z.string().min(1).max(160).optional(),
  ai_commerce_id: z.string().min(1).max(160).optional(),
  result_set_id: z.string().min(1).max(120).optional(),
  selected_sku: z.string().min(1).max(80).optional(),
  selected_handle: z.string().min(1).max(160).optional(),
  match_type: z.string().min(1).max(80).optional(),
  reorder_source: z.string().min(1).max(80).optional(),
  utm_term: z.string().min(1).max(120).optional(),
  suppress_analytics: z.boolean().optional(),
  analytics_context: z.record(z.unknown()).optional(),
});

export async function createCartUrlHandler(env: Env, raw: unknown) {
  const input = createCartUrlZod.parse(raw);
  assertApprovedVariantIds(input.items.map((it) => it.variant_id));
  const path = input.items
    .map((it) => `${variantIdToNumeric(it.variant_id)}:${it.qty}`)
    .join(",");
  const params = new URLSearchParams();
  const tracking = buildTrackingContext({
    source: "create_cart_url",
    variantId: input.items[0]?.variant_id ?? null,
    matchType: input.match_type ?? input.source_context ?? "cart_handoff",
    packriftAiId: input.packrift_ai_id,
    aiCommerceId: input.ai_commerce_id,
    journeyId: input.journey_id,
    resultSetId: input.result_set_id,
    selectedSku: input.selected_sku,
    selectedHandle: input.selected_handle,
    reorderSource: input.reorder_source,
    utmTerm: input.utm_term,
  });
  const cartUtmContent = input.selected_sku ?? input.items[0]?.variant_id ?? input.source_context ?? tracking.utm_content;
  const cartTracking = {
    ...tracking,
    utm_source: "chatgpt-mcp",
    utm_medium: "mcp_tool",
    utm_campaign: "create_cart_url",
    utm_content: cartUtmContent,
  };
  params.set("ref", input.ref);
  params.set("utm_source", cartTracking.utm_source);
  params.set("utm_medium", cartTracking.utm_medium);
  params.set("utm_campaign", cartTracking.utm_campaign);
  params.set("utm_content", cartTracking.utm_content);
  if (cartTracking.utm_term) params.set("utm_term", cartTracking.utm_term);
  params.set("packrift_ai_id", tracking.packrift_ai_id);
  params.set("mcp_key", tracking.continuity_key);
  params.set("mcp_journey", tracking.journey_id);
  if (tracking.result_set_id) params.set("mcp_result_set", tracking.result_set_id);
  if (tracking.match_type) params.set("match_type", tracking.match_type);
  if (input.discount_code) params.set("discount", input.discount_code);
  addCartPermalinkAttribution(params, cartTracking);
  const finalCartUrl = `https://${env.STOREFRONT_DOMAIN}/cart/${path}?${params.toString()}`;
  const canUseLandingUrl = input.items.length === 1 && Boolean(input.selected_sku);
  const landingUrl = canUseLandingUrl ? new URL(`https://${env.STOREFRONT_DOMAIN}/r/cart/${encodeURIComponent(input.selected_sku!)}`) : null;
  if (landingUrl) {
    landingUrl.searchParams.set("qty", String(input.items[0]?.qty ?? 1));
    landingUrl.searchParams.set("utm_source", cartTracking.utm_source);
    landingUrl.searchParams.set("utm_medium", cartTracking.utm_medium);
    landingUrl.searchParams.set("utm_campaign", cartTracking.utm_campaign);
    landingUrl.searchParams.set("utm_content", cartTracking.utm_content);
    if (cartTracking.utm_term) landingUrl.searchParams.set("utm_term", cartTracking.utm_term);
    landingUrl.searchParams.set("packrift_ai_id", tracking.packrift_ai_id);
    landingUrl.searchParams.set("ai_commerce_id", tracking.ai_commerce_id);
    landingUrl.searchParams.set("mcp_key", tracking.continuity_key);
    landingUrl.searchParams.set("mcp_journey", tracking.journey_id);
    if (tracking.result_set_id) landingUrl.searchParams.set("mcp_result_set", tracking.result_set_id);
    if (tracking.match_type) landingUrl.searchParams.set("match_type", tracking.match_type);
  }
  const url = landingUrl?.toString() ?? finalCartUrl;
  const response = {
    url,
    final_cart_url: finalCartUrl,
    items: input.items,
    ref: input.ref,
    utm: {
      source: cartTracking.utm_source,
      medium: cartTracking.utm_medium,
      campaign: cartTracking.utm_campaign,
      content: cartTracking.utm_content,
      term: cartTracking.utm_term,
    },
    cart_tracking: cartTracking,
    post_confirmation_handoff: buildPostConfirmationHandoff({
      source: "create_cart_url",
      variantId: input.items[0]?.variant_id ?? null,
      journeyId: input.journey_id,
      resultSetId: input.result_set_id,
      selectedSku: input.selected_sku,
      selectedHandle: input.selected_handle,
      matchType: input.match_type ?? input.source_context ?? "cart_handoff",
      quantity: input.items[0]?.qty ?? 1,
      cartUrl: url,
      cartEligible: true,
    }),
    discount_code: input.discount_code ?? null,
  };
  const synthetic = input.suppress_analytics === true || input.analytics_context?.synthetic === true;
  if (!synthetic) {
    const receivedAt = new Date().toISOString();
    await env.CATALOG_CACHE.put(
      `events/ai-sales/${receivedAt.slice(0, 10)}/${receivedAt}-${crypto.randomUUID()}.json`,
      JSON.stringify({
        event: "cart_click",
        source: "create_cart_url",
        sku: input.selected_sku ?? "",
        handle: input.selected_handle ?? "",
        variant_id: input.items[0]?.variant_id ?? "",
        match_type: input.match_type ?? input.source_context ?? "cart_handoff",
        packrift_ai_id: tracking.packrift_ai_id,
        ai_commerce_id: tracking.ai_commerce_id,
        mcp_key: tracking.continuity_key,
        mcp_journey: tracking.journey_id,
        mcp_result_set: tracking.result_set_id ?? "",
        utm_source: cartTracking.utm_source,
        utm_medium: cartTracking.utm_medium,
        utm_campaign: cartTracking.utm_campaign,
        utm_content: cartTracking.utm_content,
        utm_term: cartTracking.utm_term ?? "",
        received_at: receivedAt,
      }),
      { expirationTtl: 60 * 60 * 24 * 90 }
    );
  }
  return response;
}
