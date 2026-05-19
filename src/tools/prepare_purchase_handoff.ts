import { z } from "zod";
import { approvalForSku } from "../approval.js";
import type { Env } from "../shopify.js";
import { checkInventoryHandler } from "./check_inventory.js";
import { createCartUrlHandler } from "./create_cart_url.js";
import { getPricingHandler } from "./get_pricing.js";
import { getProductHandler } from "./get_product.js";
import { getBulkQuoteLinkHandler, getReorderLinkHandler } from "./procurement_links.js";

type PreparePurchaseHandoffContext = {
  sessionId?: string | null;
};

export const preparePurchaseHandoffSchema = {
  name: "prepare_purchase_handoff",
  description:
    "One-call exact-SKU purchase prep for agents. Confirms AI_APPROVE product, live price, and live inventory for a Packrift SKU, then returns a measured MCP cart URL only when buyer_confirmed is true.",
  inputSchema: {
    type: "object",
    properties: {
      sku: { type: "string", description: "Exact Packrift SKU such as 1066, MFL1295, or LL251WR." },
      quantity: { type: "integer", minimum: 1, default: 1, description: "Buyer-selected quantity. Defaults to 1." },
      buyer_confirmed: {
        type: "boolean",
        default: false,
        description: "Set true only after the buyer confirms the exact SKU and quantity. Without this, no cart URL is created.",
      },
      source_context: {
        type: "string",
        description: "Optional analytics context, such as agent_quick_start, exact_sku_reorder, or browserbase_browse.",
      },
      journey_id: { type: "string" },
      result_set_id: { type: "string" },
      suppress_analytics: {
        type: "boolean",
        description: "Internal QA flag. When true, do not record downstream cart analytics.",
      },
      analytics_context: {
        type: "object",
        description: "Internal QA context for synthetic evals.",
      },
    },
    required: ["sku"],
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

const preparePurchaseHandoffZod = z.object({
  sku: z.string().min(1).max(80),
  quantity: z.number().int().min(1).default(1),
  buyer_confirmed: z.boolean().default(false),
  source_context: z.string().min(1).max(80).optional(),
  journey_id: z.string().min(1).max(120).optional(),
  result_set_id: z.string().min(1).max(120).optional(),
  suppress_analytics: z.boolean().optional(),
  analytics_context: z.record(z.unknown()).optional(),
});

function firstArrayItem(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) && value[0] && typeof value[0] === "object" ? (value[0] as Record<string, unknown>) : null;
}

function productSummary(value: unknown) {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const variants = Array.isArray(row.variants) ? row.variants : [];
  const primaryVariant = variants[0] && typeof variants[0] === "object" ? (variants[0] as Record<string, unknown>) : {};
  return {
    handle: row.handle ?? null,
    title: row.title ?? null,
    url: row.url ?? null,
    dimensions: row.dimensions ?? null,
    price_range: row.price_range ?? null,
    variant: {
      id: primaryVariant.id ?? null,
      sku: primaryVariant.sku ?? null,
      price: primaryVariant.price ?? null,
      available: primaryVariant.available ?? null,
      inventory_quantity: primaryVariant.inventory_quantity ?? null,
      selected_options: primaryVariant.selected_options ?? [],
    },
    conversion_actions: row.conversion_actions ?? null,
  };
}

export async function preparePurchaseHandoffHandler(env: Env, raw: unknown, context: PreparePurchaseHandoffContext = {}) {
  const input = preparePurchaseHandoffZod.parse(raw);
  const sku = input.sku.trim().toUpperCase();
  const quantity = input.quantity;
  const item = approvalForSku(sku);
  const syntheticContext = {
    suppress_analytics: true,
    analytics_context: { ...(input.analytics_context ?? {}), synthetic: true, source: "prepare_purchase_handoff_internal" },
  };

  if (!item) {
    const quote = await getBulkQuoteLinkHandler(env, {
      requested_spec: `Packrift SKU ${sku}`,
      quantity: String(quantity),
      reason: "No AI_APPROVE exact SKU matched prepare_purchase_handoff request.",
      ...syntheticContext,
    });
    return {
      tool_name: "prepare_purchase_handoff",
      status: "no_exact_approved_sku",
      buyer_confirmed: input.buyer_confirmed,
      sku,
      quantity,
      cart: null,
      no_match_rule:
        "Do not create a cart URL for unknown or unapproved SKUs. Use search_products, find_packaging_for_item, explain_no_exact_match, or bulk quote recovery.",
      quote_recovery: quote,
      next_action: "Ask the buyer for the exact SKU or requested spec, then search Packrift AI_APPROVE products or route to quote recovery.",
    };
  }

  const journeyId = input.journey_id ?? `prepare_purchase_handoff_${item.sku}_${item.variantId}`;
  const resultSetId = input.result_set_id ?? "prepare_purchase_handoff";
  const matchType = input.source_context ?? "prepare_purchase_handoff";
  const liveContext = {
    journey_id: journeyId,
    result_set_id: resultSetId,
    selected_sku: item.sku,
    selected_handle: item.handle,
    match_type: matchType,
  };
  const [product, pricingRows, inventoryRows, reorder, quote] = await Promise.all([
    getProductHandler(env, { handle: item.handle }),
    getPricingHandler(env, { variant_ids: [item.variantId], quantity, ...liveContext }),
    checkInventoryHandler(env, { variant_ids: [item.variantId], ...liveContext }),
    getReorderLinkHandler(env, { sku: item.sku, source_context: matchType, ...syntheticContext }),
    getBulkQuoteLinkHandler(env, {
      requested_spec: item.title,
      sku: item.sku,
      family: item.family || undefined,
      quantity: String(quantity),
      reason: "Fallback if buyer rejects exact SKU, quantity, or live commercial facts.",
      ...syntheticContext,
    }),
  ]);
  const pricing = firstArrayItem(pricingRows);
  const inventory = firstArrayItem(inventoryRows);
  const priceOk = pricing && pricing.unit_price != null && !pricing.error;
  const inventoryOk = inventory?.in_stock === true;
  const cartArguments = {
    sku: item.sku,
    quantity,
    selected_handle: item.handle,
    match_type: matchType,
    source_context: input.source_context ?? "prepare_purchase_handoff",
    journey_id: journeyId,
    result_set_id: resultSetId,
    utm_term: item.sku,
  };
  const canCreateCart = input.buyer_confirmed && Boolean(priceOk && inventoryOk);
  const cart = canCreateCart
    ? await createCartUrlHandler(
        env,
        {
          ...cartArguments,
          suppress_analytics: input.suppress_analytics,
          analytics_context: input.analytics_context,
        },
        context
      )
    : null;
  const cartHandoff =
    cart && typeof cart === "object" && "cart_handoff" in cart
      ? (cart as { cart_handoff?: unknown }).cart_handoff ?? null
      : null;

  return {
    tool_name: "prepare_purchase_handoff",
    status: canCreateCart
      ? "cart_handoff_ready"
      : input.buyer_confirmed
        ? "blocked_by_live_confirmation"
        : "live_confirmed_awaiting_buyer_confirmation",
    buyer_confirmed: input.buyer_confirmed,
    sku: item.sku,
    handle: item.handle,
    variant_id: item.variantId,
    family: item.family || null,
    title: item.title,
    quantity,
    live_confirmation: {
      required_before_cart: ["AI_APPROVE SKU gate", "get_product", "get_pricing", "check_inventory", "buyer_confirmed"],
      product: productSummary(product),
      pricing,
      inventory,
      price_ok: Boolean(priceOk),
      inventory_ok: inventoryOk,
    },
    cart,
    cart_handoff: cartHandoff,
    cart_arguments_if_buyer_confirms: cartArguments,
    fallback_actions: {
      reorder,
      quote,
    },
    guardrails: [
      "This tool creates a cart URL only when buyer_confirmed is true.",
      "If price or inventory cannot be confirmed live, cart remains null.",
      "If the SKU is unknown or not AI_APPROVE, route to search or quote recovery instead of forcing a nearby substitute.",
      "Return the MCP /r/cart URL from cart.url as the primary buyer handoff when cart_handoff_ready.",
    ],
    next_action: canCreateCart
      ? "Return cart.url as the primary buyer handoff and keep final_cart_url only as destination evidence."
      : input.buyer_confirmed
        ? "Do not hand off a cart. Resolve the failed live confirmation or route to quote recovery."
        : "Ask the buyer to confirm the exact SKU and quantity, then call prepare_purchase_handoff again with buyer_confirmed=true.",
  };
}
