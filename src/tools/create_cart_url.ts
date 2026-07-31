import { z } from "zod";
import { tolerantLineItemZod } from "../line-items.js";
import { Env, variantIdToNumeric } from "../shopify.js";
import { approvalForHandle, approvalForSku, approvalForVariantId, assertApprovedVariantIds } from "../approval.js";
import { addCartPermalinkAttribution, buildPostConfirmationHandoff, buildTrackingContext } from "../conversion.js";
import {
  assertMcpCommerceSkuAllowed,
  isMcpCommerceHeldItem,
  mcpCommerceHoldErrorMessage,
} from "../mcp-commerce-holds.js";

type CreateCartUrlContext = {
  sessionId?: string | null;
  sourceSlug?: string | null;
  installTarget?: string | null;
};

export const createCartUrlSchema = {
  name: "create_cart_url",
  title: "Create cart handoff URL",
  description:
    "Build the checkout handoff URL once the buyer has confirmed an exact product, quantity, live price, and stock. Preferred input is sku plus quantity; use items only when you already hold variant IDs as strings. Returns a tracked packrift.com cart URL plus a Shopify cart permalink; it never places an order.",
  inputSchema: {
    type: "object",
    properties: {
      sku: {
        type: "string",
        description:
          "Shortcut for exact Packrift SKUs such as 1066, MFL1295, or LL251WR. When provided without items, the approved variant is resolved automatically.",
      },
      quantity: {
        type: "integer",
        minimum: 1,
        default: 1,
        description: "Buyer-confirmed quantity to use with sku shortcut. Ignored when items is provided.",
      },
      items: {
        type: "array",
        description: "Advanced path for agents that already have approved variant IDs. Most buyers should use sku plus quantity instead.",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            variant_id: {
              type: "string",
              description: "Numeric Shopify variant ID as a string, not a number. Example: \"53475949216112\".",
            },
            qty: { type: "integer", minimum: 1, description: "Buyer-confirmed quantity for this line item. The alias key quantity is also accepted." },
          },
          required: ["variant_id", "qty"],
        },
      },
      discount_code: { type: "string", description: "Optional discount code to apply to the cart." },
      source_context: {
        type: "string",
        description: "Optional short context label for the handoff, such as exact_match, reorder, or quote_followup.",
      },
      journey_id: {
        type: "string",
        description: "Optional continuity ID echoed from an earlier search or pricing result in this conversation.",
      },
      result_set_id: {
        type: "string",
        description: "Optional continuity ID echoed from the result set the buyer chose from.",
      },
      selected_sku: {
        type: "string",
        description: "Buyer-confirmed SKU. When provided, it must resolve to the same catalog item as the cart variant.",
      },
      selected_handle: {
        type: "string",
        description: "Buyer-confirmed product handle. When provided, it must resolve to the same catalog item as the cart variant.",
      },
      match_type: {
        type: "string",
        description: "Optional continuity label describing how the product was matched, echoed from earlier results.",
      },
    },
    anyOf: [{ required: ["items"] }, { required: ["sku"] }],
  },

  annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
};

export const createCartUrlZod = z.object({
  sku: z.string().min(1).max(80).optional(),
  quantity: z.number().int().min(1).optional(),
  items: z.array(tolerantLineItemZod).min(1).optional(),
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
  mcp_source_context: z.string().min(1).max(80).optional(),
  packrift_mcp_source: z.string().min(1).max(80).optional(),
  mcp_source: z.string().min(1).max(80).optional(),
  source_slug: z.string().min(1).max(80).optional(),
  mcp_install_target: z.string().min(1).max(80).optional(),
  packrift_mcp_target: z.string().min(1).max(80).optional(),
  mcp_target: z.string().min(1).max(80).optional(),
  suppress_analytics: z.boolean().optional(),
  analytics_context: z.record(z.unknown()).optional(),
}).refine((value) => Boolean(value.items?.length || value.sku), {
  message: "create_cart_url requires either items[{variant_id, qty}] or an exact catalog sku.",
});

function normalizedSku(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function normalizedHandle(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function sameVariant(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && variantIdToNumeric(left) === variantIdToNumeric(right));
}

function cartContinuityError(message: string): never {
  throw new Error(
    `Cart continuity check failed: ${message}. Use get_cart_handoff_candidates, search_products, or get_product to choose one exact catalog SKU before create_cart_url.`
  );
}

function normalizedMcpSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const sessionId = value.trim();
  return /^[A-Za-z0-9._:-]{1,120}$/.test(sessionId) ? sessionId : null;
}

function normalizedMcpSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return slug && /^[a-z0-9_]{2,80}$/.test(slug) ? slug : null;
}

export async function createCartUrlHandler(env: Env, raw: unknown, context: CreateCartUrlContext = {}) {
  const input = createCartUrlZod.parse(raw);
  const requestedSku = normalizedSku(input.sku);
  const selectedSkuInput = normalizedSku(input.selected_sku);
  assertMcpCommerceSkuAllowed(requestedSku);
  assertMcpCommerceSkuAllowed(selectedSkuInput);
  if (requestedSku && selectedSkuInput && requestedSku !== selectedSkuInput) {
    cartContinuityError(`sku ${requestedSku} does not match selected_sku ${selectedSkuInput}`);
  }

  const skuForApproval = requestedSku ?? selectedSkuInput;
  const approvedSkuItem = skuForApproval ? approvalForSku(skuForApproval) : null;
  if (requestedSku && !approvedSkuItem) {
    throw new Error(`AI_APPROVE gate blocked sku: ${input.sku}. Use search_products or find_packaging_for_item to choose approved Packrift SKUs.`);
  }
  if (selectedSkuInput && !approvedSkuItem) {
    throw new Error(
      `AI_APPROVE gate blocked selected_sku: ${input.selected_sku}. Use search_products or find_packaging_for_item to choose approved Packrift SKUs.`
    );
  }

  const items = input.items?.length ? input.items : [{ variant_id: approvedSkuItem!.variantId, qty: input.quantity ?? 1 }];
  assertApprovedVariantIds(items.map((it) => it.variant_id));
  for (const item of items) {
    const variantItem = approvalForVariantId(item.variant_id);
    if (isMcpCommerceHeldItem(variantItem)) {
      throw new Error(mcpCommerceHoldErrorMessage(variantItem?.sku));
    }
  }

  const firstItem = items[0] ?? null;
  const inferredVariantItem = items.length === 1 && firstItem ? approvalForVariantId(firstItem.variant_id) : null;
  if (approvedSkuItem) {
    if (items.length !== 1) {
      cartContinuityError(`sku ${approvedSkuItem.sku} can only be used with one matching cart line`);
    }
    if (!sameVariant(firstItem?.variant_id, approvedSkuItem.variantId)) {
      cartContinuityError(`sku ${approvedSkuItem.sku} resolves to variant ${approvedSkuItem.variantId}, not cart variant ${firstItem?.variant_id ?? "missing"}`);
    }
  }

  const selectedHandleInput = normalizedHandle(input.selected_handle);
  const selectedHandleItem = selectedHandleInput ? approvalForHandle(selectedHandleInput) : null;
  if (isMcpCommerceHeldItem(selectedHandleItem)) {
    throw new Error(mcpCommerceHoldErrorMessage(selectedHandleItem?.sku));
  }
  if (selectedHandleInput && !selectedHandleItem) {
    throw new Error(
      `AI_APPROVE gate blocked selected_handle: ${input.selected_handle}. Use search_products or get_product to choose approved Packrift handles.`
    );
  }
  if (selectedHandleItem && approvedSkuItem && !sameVariant(selectedHandleItem.variantId, approvedSkuItem.variantId)) {
    cartContinuityError(`selected_handle ${selectedHandleInput} does not match sku ${approvedSkuItem.sku}`);
  }
  if (selectedHandleItem && firstItem && items.length === 1 && !sameVariant(selectedHandleItem.variantId, firstItem.variant_id)) {
    cartContinuityError(`selected_handle ${selectedHandleInput} resolves to variant ${selectedHandleItem.variantId}, not cart variant ${firstItem.variant_id}`);
  }

  const resolvedItem = approvedSkuItem ?? selectedHandleItem ?? inferredVariantItem;
  const resolvedSource = approvedSkuItem ? "sku" : selectedHandleItem ? "handle" : inferredVariantItem ? "variant_id" : null;
  const selectedSku = resolvedItem?.sku ?? input.selected_sku ?? input.sku;
  const selectedHandle = selectedHandleInput ?? resolvedItem?.handle;
  const matchType = input.match_type ?? input.source_context ?? (approvedSkuItem ? "buyer_confirmed_exact_sku" : "cart_handoff");
  const mcpHandoffId = `mcp_handoff_${crypto.randomUUID()}`;
  const mcpSessionId = normalizedMcpSessionId(context.sessionId);
  const mcpSourceContext =
    normalizedMcpSlug(input.mcp_source_context) ??
    normalizedMcpSlug(input.packrift_mcp_source) ??
    normalizedMcpSlug(input.mcp_source) ??
    normalizedMcpSlug(input.source_slug) ??
    normalizedMcpSlug(context.sourceSlug);
  const mcpInstallTarget =
    normalizedMcpSlug(input.mcp_install_target) ??
    normalizedMcpSlug(input.packrift_mcp_target) ??
    normalizedMcpSlug(input.mcp_target) ??
    normalizedMcpSlug(context.installTarget);
  const path = items
    .map((it) => `${variantIdToNumeric(it.variant_id)}:${it.qty}`)
    .join(",");
  const params = new URLSearchParams();
  const tracking = buildTrackingContext({
    source: "create_cart_url",
    variantId: items[0]?.variant_id ?? null,
    matchType,
    packriftAiId: input.packrift_ai_id,
    aiCommerceId: input.ai_commerce_id,
    mcpHandoffId,
    journeyId: input.journey_id,
    resultSetId: input.result_set_id,
    selectedSku,
    selectedHandle,
    reorderSource: input.reorder_source,
    utmTerm: input.utm_term ?? selectedSku,
    mcpSourceContext,
    mcpInstallTarget,
  });
  const cartUtmContent = selectedSku ?? items[0]?.variant_id ?? input.source_context ?? tracking.utm_content;
  const cartTracking = {
    ...tracking,
    utm_source: "chatgpt-mcp",
    utm_medium: "mcp_tool",
    utm_campaign: "create_cart_url",
    utm_content: cartUtmContent,
    mcp_session_id: mcpSessionId,
    mcp_source_context: mcpSourceContext,
    mcp_install_target: mcpInstallTarget,
  };
  params.set("ref", input.ref);
  params.set("utm_source", cartTracking.utm_source);
  params.set("utm_medium", cartTracking.utm_medium);
  params.set("utm_campaign", cartTracking.utm_campaign);
  params.set("utm_content", cartTracking.utm_content);
  if (cartTracking.utm_term) params.set("utm_term", cartTracking.utm_term);
  params.set("packrift_ai_id", tracking.packrift_ai_id);
  params.set("mcp_handoff_id", mcpHandoffId);
  if (mcpSessionId) params.set("mcp_session_id", mcpSessionId);
  if (mcpSourceContext) params.set("mcp_source_context", mcpSourceContext);
  if (mcpInstallTarget) params.set("mcp_install_target", mcpInstallTarget);
  params.set("mcp_key", tracking.continuity_key);
  params.set("mcp_journey", tracking.journey_id);
  if (tracking.result_set_id) params.set("mcp_result_set", tracking.result_set_id);
  if (tracking.match_type) params.set("match_type", tracking.match_type);
  if (input.discount_code) params.set("discount", input.discount_code);
  addCartPermalinkAttribution(params, cartTracking);
  const finalCartUrl = `https://${env.STOREFRONT_DOMAIN}/cart/${path}?${params.toString()}`;
  const canUseLandingUrl = items.length === 1 && Boolean(selectedSku);
  const landingUrl = canUseLandingUrl ? new URL(`https://mcp.packrift.com/r/cart/${encodeURIComponent(selectedSku!)}`) : null;
  if (landingUrl) {
    landingUrl.searchParams.set("ref", input.ref);
    landingUrl.searchParams.set("qty", String(items[0]?.qty ?? 1));
    landingUrl.searchParams.set("utm_source", cartTracking.utm_source);
    landingUrl.searchParams.set("utm_medium", cartTracking.utm_medium);
    landingUrl.searchParams.set("utm_campaign", cartTracking.utm_campaign);
    landingUrl.searchParams.set("utm_content", cartTracking.utm_content);
    if (cartTracking.utm_term) landingUrl.searchParams.set("utm_term", cartTracking.utm_term);
    landingUrl.searchParams.set("packrift_ai_id", tracking.packrift_ai_id);
    landingUrl.searchParams.set("ai_commerce_id", tracking.ai_commerce_id);
    landingUrl.searchParams.set("mcp_handoff_id", mcpHandoffId);
    if (mcpSessionId) landingUrl.searchParams.set("mcp_session_id", mcpSessionId);
    if (mcpSourceContext) landingUrl.searchParams.set("mcp_source_context", mcpSourceContext);
    if (mcpInstallTarget) landingUrl.searchParams.set("mcp_install_target", mcpInstallTarget);
    landingUrl.searchParams.set("mcp_key", tracking.continuity_key);
    landingUrl.searchParams.set("mcp_journey", tracking.journey_id);
    if (tracking.result_set_id) landingUrl.searchParams.set("mcp_result_set", tracking.result_set_id);
    if (tracking.match_type) landingUrl.searchParams.set("match_type", tracking.match_type);
  }
  const url = landingUrl?.toString() ?? finalCartUrl;
  const cartHandoff = {
    mcp_handoff_id: mcpHandoffId,
    primary_url: url,
    primary_url_role: landingUrl ? "measured_mcp_cart_landing" : "shopify_cart_permalink",
    required_next_action: landingUrl
      ? "Open or present primary_url to the buyer. The MCP cart landing records mcp_cart_landing, then forwards to Shopify checkout with the same attribution."
      : "Present primary_url to the buyer as the cart handoff. No MCP cart landing shim is available for multi-line carts.",
    final_destination_url: finalCartUrl,
    no_order_created_by_mcp: true,
    buyer_confirmation_required_before_call: true,
    landing_records_event: Boolean(landingUrl),
    landing_event: landingUrl ? "mcp_cart_landing" : null,
    attribution_required: {
      ref: input.ref,
      utm_source: cartTracking.utm_source,
      utm_medium: cartTracking.utm_medium,
      utm_campaign: cartTracking.utm_campaign,
      utm_content: cartTracking.utm_content,
      utm_term: cartTracking.utm_term ?? null,
      mcp_handoff_id: mcpHandoffId,
      mcp_session_id: mcpSessionId,
      mcp_source_context: mcpSourceContext,
      mcp_install_target: mcpInstallTarget,
      mcp_key: tracking.continuity_key,
      mcp_journey: tracking.journey_id,
      mcp_result_set: tracking.result_set_id ?? null,
    },
  };
  const response = {
    mcp_handoff_id: mcpHandoffId,
    mcp_session_id: mcpSessionId,
    url,
    final_cart_url: finalCartUrl,
    cart_handoff: cartHandoff,
    primary_buyer_handoff: cartHandoff,
    items,
    resolved_from_catalog: resolvedItem
      ? {
          sku: resolvedItem.sku,
          handle: resolvedItem.handle,
          variant_id: resolvedItem.variantId,
          family: resolvedItem.family || null,
          source: resolvedSource,
        }
      : null,
    cart_continuity: {
      validated: true,
      mode: approvedSkuItem ? "sku_shortcut" : resolvedItem ? "catalog_resolved_variant" : "approved_variant_ids",
      selected_sku: selectedSku ?? null,
      selected_handle: selectedHandle ?? null,
      cart_line_count: items.length,
      primary_variant_id: firstItem?.variant_id ?? null,
      guardrail: "SKU, handle, and variant metadata must resolve to the same AI_APPROVE catalog item.",
    },
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
      variantId: items[0]?.variant_id ?? null,
      journeyId: input.journey_id,
      resultSetId: input.result_set_id,
      selectedSku,
      selectedHandle,
      matchType,
      quantity: items[0]?.qty ?? 1,
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
        sku: selectedSku ?? "",
        handle: selectedHandle ?? "",
        variant_id: items[0]?.variant_id ?? "",
        match_type: matchType,
        packrift_ai_id: tracking.packrift_ai_id,
        ai_commerce_id: tracking.ai_commerce_id,
        mcp_handoff_id: mcpHandoffId,
        mcp_session_id: mcpSessionId ?? "",
        mcp_source_context: mcpSourceContext ?? "",
        mcp_install_target: mcpInstallTarget ?? "",
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
