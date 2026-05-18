interface ProductCardInput {
  sku?: string | null;
  handle: string;
  title: string;
  url: string;
  variantId?: string | null;
  family?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  inStock?: boolean | null;
  dimensionsRaw?: string | null;
  source: string;
  matchType?: string;
  matchConfidence?: number;
}

interface TrackingInput {
  source: string;
  sku?: string | null;
  handle?: string | null;
  variantId?: string | null;
  matchType?: string | null;
  packriftAiId?: string | null;
  aiCommerceId?: string | null;
  journeyId?: string | null;
  resultSetId?: string | null;
  selectedSku?: string | null;
  selectedHandle?: string | null;
  reorderSource?: string | null;
  utmTerm?: string | null;
}

interface NoMatchRecoveryInput {
  source: string;
  reason: string;
  requestedSpec: string;
  useCase?: string | null;
}

interface PostConfirmationHandoffInput {
  source: string;
  variantId?: string | null;
  selectedSku?: string | null;
  selectedHandle?: string | null;
  journeyId?: string | null;
  resultSetId?: string | null;
  matchType?: string | null;
  quantity?: number | null;
  cartUrl?: string | null;
  cartEligible?: boolean | null;
}

function compact(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function skuAnchor(value: string | null | undefined): string {
  const safe = String(value ?? "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `sku-${safe || "packrift"}`;
}

export function productContinuityKey(input: {
  sku?: string | null;
  handle?: string | null;
  variantId?: string | null;
}): string {
  const primary = compact(input.sku) || compact(input.handle) || "packrift_product";
  const variant = compact(input.variantId);
  return variant ? `${primary}:${variant}` : primary;
}

export function buildTrackingContext(input: TrackingInput) {
  const continuityKey = productContinuityKey({
    sku: input.selectedSku ?? input.sku,
    handle: input.selectedHandle ?? input.handle,
    variantId: input.variantId,
  });
  const journeyId = input.journeyId ?? `mcp_${continuityKey}`;
  const packriftAiId =
    compact(input.packriftAiId) ||
    compact(input.aiCommerceId) ||
    compact(journeyId) ||
    compact(continuityKey) ||
    "packrift_ai";
  return {
    source: input.source,
    ref: "mcp",
    utm_source: "chatgpt",
    utm_medium: "mcp",
    utm_campaign: "packrift_ai_commerce",
    utm_content: compact(input.matchType) || compact(input.source) || "mcp_handoff",
    utm_term: input.utmTerm ?? input.selectedSku ?? input.sku ?? input.selectedHandle ?? input.handle ?? null,
    packrift_ai_id: packriftAiId,
    ai_commerce_id: packriftAiId,
    continuity_key: continuityKey,
    journey_id: journeyId,
    result_set_id: input.resultSetId ?? null,
    match_type: input.matchType ?? null,
    selected_sku: input.selectedSku ?? input.sku ?? null,
    selected_handle: input.selectedHandle ?? input.handle ?? null,
    selected_variant_id: input.variantId ?? null,
    reorder_source: input.reorderSource ?? null,
  };
}

export function trackedUrl(url: string, tracking: ReturnType<typeof buildTrackingContext>): string {
  const parsed = new URL(url);
  parsed.searchParams.set("ref", tracking.ref);
  parsed.searchParams.set("utm_source", tracking.utm_source);
  parsed.searchParams.set("utm_medium", tracking.utm_medium);
  parsed.searchParams.set("utm_campaign", tracking.utm_campaign);
  parsed.searchParams.set("utm_content", tracking.utm_content);
  if (tracking.utm_term) parsed.searchParams.set("utm_term", tracking.utm_term);
  parsed.searchParams.set("packrift_ai_id", tracking.packrift_ai_id);
  parsed.searchParams.set("mcp_key", tracking.continuity_key);
  parsed.searchParams.set("mcp_journey", tracking.journey_id);
  if (tracking.result_set_id) parsed.searchParams.set("mcp_result_set", tracking.result_set_id);
  if (tracking.match_type) parsed.searchParams.set("match_type", tracking.match_type);
  if (parsed.hostname === "packrift.com" && parsed.pathname.startsWith("/cart/")) {
    addCartPermalinkAttribution(parsed.searchParams, tracking);
  }
  return parsed.toString();
}

export function addCartPermalinkAttribution(
  params: URLSearchParams,
  tracking: ReturnType<typeof buildTrackingContext>
): void {
  const attributes: Record<string, string | null | undefined> = {
    packrift_packrift_ai_id: tracking.packrift_ai_id,
    packrift_ai_commerce_id: tracking.ai_commerce_id,
    packrift_mcp_key: tracking.continuity_key,
    packrift_mcp_journey: tracking.journey_id,
    packrift_mcp_result_set: tracking.result_set_id,
    packrift_match_type: tracking.match_type,
    packrift_utm_source: tracking.utm_source,
    packrift_utm_medium: tracking.utm_medium,
    packrift_utm_campaign: tracking.utm_campaign,
    packrift_utm_content: tracking.utm_content,
    packrift_utm_term: tracking.utm_term,
  };
  for (const [key, value] of Object.entries(attributes)) {
    if (value) params.set(`attributes[${key}]`, value);
  }
}

export function buildConversionActions(input: ProductCardInput) {
  const tracking = buildTrackingContext({
    source: input.source,
    sku: input.sku,
    handle: input.handle,
    variantId: input.variantId,
    matchType: input.matchType ?? "mcp_result",
    selectedSku: input.sku,
    selectedHandle: input.handle,
  });
  const reorder = new URL("https://packrift.com/pages/reorder-packaging-by-sku");
  reorder.searchParams.set("view", "packrift_ai_reorder_live_r05");
  if (input.sku) reorder.searchParams.set("sku", input.sku);
  reorder.hash = skuAnchor(input.sku ?? input.handle);
  const quote = new URL("https://packrift.com/pages/bulk-quote");
  if (input.sku) quote.searchParams.set("sku", input.sku);
  quote.searchParams.set("spec", buildProcurementSpec(input));
  if (input.handle) quote.searchParams.set("handle", input.handle);
  const cartUrl = input.variantId
    ? trackedUrl(`https://packrift.com/cart/${input.variantId}:1`, {
        ...tracking,
        utm_source: "chatgpt-mcp",
        utm_medium: "mcp_tool",
        utm_campaign: "create_cart_url",
        utm_content: input.sku ?? input.variantId ?? "cart_click",
      })
    : null;
  return {
    tracking,
    product_click: {
      event: "product_click",
      url: trackedUrl(input.url, tracking),
    },
    product_url: trackedUrl(input.url, tracking),
    reorder: {
      event: "reorder_click",
      url: trackedUrl(reorder.toString(), { ...tracking, utm_content: "reorder_click" }),
    },
    quote: {
      event: "quote_click",
      url: trackedUrl(quote.toString(), { ...tracking, utm_content: "quote_click" }),
    },
    cart: {
      event: "mcp_cart_click",
      variant_id: input.variantId ?? null,
      url_candidate: cartUrl,
      available_after_live_price_inventory_check: Boolean(input.variantId),
      required_before_presenting: ["get_pricing", "check_inventory"],
    },
    cart_hint: input.variantId
      ? "Call create_cart_url after confirming live price and inventory."
      : "No cart URL available without a verified variant ID.",
    copy_procurement_spec: {
      event: "copy_procurement_spec",
      text: buildProcurementSpec(input),
    },
  };
}

export function buildPostConfirmationHandoff(input: PostConfirmationHandoffInput) {
  const tracking = buildTrackingContext({
    source: input.source,
    variantId: input.variantId,
    journeyId: input.journeyId,
    resultSetId: input.resultSetId,
    selectedSku: input.selectedSku,
    selectedHandle: input.selectedHandle,
    matchType: input.matchType ?? "post_confirmation_handoff",
  });
  const productUrl = input.selectedHandle
    ? trackedUrl(`https://packrift.com/products/${input.selectedHandle}`, {
        ...tracking,
        utm_content: "product_click",
      })
    : null;
  const reorder = new URL("https://packrift.com/pages/reorder-packaging-by-sku");
  reorder.searchParams.set("view", "packrift_ai_reorder_live_r05");
  if (input.selectedSku) reorder.searchParams.set("sku", input.selectedSku);
  reorder.hash = skuAnchor(input.selectedSku ?? input.selectedHandle);
  const quote = new URL("https://packrift.com/pages/bulk-quote");
  if (input.selectedSku) quote.searchParams.set("sku", input.selectedSku);
  quote.searchParams.set("spec", buildProcurementSpec({
    sku: input.selectedSku,
    handle: input.selectedHandle ?? "",
    variantId: input.variantId,
    title: input.selectedHandle ?? input.selectedSku ?? "Packrift product",
    url: input.selectedHandle ? `https://packrift.com/products/${input.selectedHandle}` : "",
    source: input.source,
  }));
  if (input.selectedHandle) quote.searchParams.set("handle", input.selectedHandle);
  const quantity = Math.max(1, input.quantity ?? 1);
  const cartCandidate =
    input.cartUrl ??
    (input.variantId && input.cartEligible !== false
      ? `https://packrift.com/cart/${input.variantId}:${quantity}`
      : null);

  return {
    tracking,
    product_click: productUrl
      ? {
          event: "product_click",
          url: productUrl,
        }
      : null,
    reorder: {
      event: "reorder_click",
      url: trackedUrl(reorder.toString(), { ...tracking, utm_content: "reorder_click" }),
    },
    quote: {
      event: "quote_click",
      url: trackedUrl(quote.toString(), { ...tracking, utm_content: "quote_click" }),
    },
    cart: {
      event: "cart_click",
      variant_id: input.variantId ?? null,
      quantity,
      url_candidate: cartCandidate
        ? trackedUrl(cartCandidate, {
            ...tracking,
            utm_source: "chatgpt-mcp",
            utm_medium: "mcp_tool",
            utm_campaign: "create_cart_url",
            utm_content: input.selectedSku ?? input.variantId ?? "cart_click",
          })
        : null,
      eligible_after_this_check: input.cartEligible !== false,
    },
    copy_procurement_spec: {
      event: "copy_procurement_spec",
      text: [
        input.selectedSku ? `SKU ${input.selectedSku}` : null,
        input.selectedHandle ? `Handle ${input.selectedHandle}` : null,
        input.variantId ? `Variant ${input.variantId}` : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join(" | "),
    },
    recommended_next_action:
      input.cartEligible === false
        ? "Do not present a cart handoff. Use the reorder or quote path instead."
        : "Present the exact product, reorder, quote, copy-spec, or cart handoff that matches the buyer's intent.",
  };
}

export function buildProductCard(input: ProductCardInput) {
  const conversion = buildConversionActions(input);
  return {
    packrift_ai_id: conversion.tracking.packrift_ai_id,
    ai_commerce_id: conversion.tracking.ai_commerce_id,
    continuity_key: conversion.tracking.continuity_key,
    sku: input.sku ?? null,
    handle: input.handle,
    variant_id: input.variantId ?? null,
    family: input.family ?? null,
    title: input.title,
    url: conversion.product_click.url,
    image_url: input.imageUrl ?? null,
    price: input.price ?? null,
    currency: input.currency ?? null,
    in_stock: input.inStock ?? null,
    dimensions: input.dimensionsRaw ?? null,
    match_type: input.matchType ?? null,
    match_confidence: input.matchConfidence ?? null,
    primary_cta: {
      label: "View exact product",
      event: conversion.product_click.event,
      url: conversion.product_click.url,
    },
    reorder_cta: conversion.reorder,
    reorder_url: conversion.reorder.url,
    quote_cta: conversion.quote,
    quote_url: conversion.quote.url,
    cart_cta_candidate: conversion.cart,
    copy_procurement_spec: conversion.copy_procurement_spec,
  };
}

export function buildMatchSummary(input: {
  source: string;
  matchType: string;
  confidence: number;
  matchedFields: string[];
  requestedDimensions?: string | null;
  candidateDimensions?: string | null;
  reason?: string | null;
  exactTermsMatched?: string[];
  perAxisPaddingIn?: Record<string, number>;
}) {
  return {
    source: input.source,
    match_type: input.matchType,
    confidence: Number(input.confidence.toFixed(3)),
    matched_fields: input.matchedFields,
    evidence: {
      dimension: {
        requested: input.requestedDimensions ?? null,
        candidate: input.candidateDimensions ?? null,
        per_axis_padding_in: input.perAxisPaddingIn ?? null,
      },
      exact_terms_matched: input.exactTermsMatched ?? [],
      reason: input.reason ?? null,
    },
    unsafe_substitute_blocked: input.matchType === "no_exact_match",
  };
}

export function buildNoMatchRecovery(input: NoMatchRecoveryInput) {
  const quote = new URL("https://packrift.com/pages/bulk-quote");
  quote.searchParams.set("spec", input.requestedSpec);
  if (input.useCase) quote.searchParams.set("use_case", input.useCase);
  const tracking = buildTrackingContext({
    source: input.source,
    matchType: "no_match_quote",
    selectedHandle: "no_exact_match",
    utmTerm: input.requestedSpec,
  });
  return {
    status: "no_exact_match",
    reason: input.reason,
    requested_spec: input.requestedSpec,
    quote_url: trackedUrl(quote.toString(), { ...tracking, utm_content: "no_match_quote" }),
    required_inputs: ["dimensions", "use case", "quantity", "material or color if required"],
    follow_up_question: "Do you want to request a quote for this exact packaging spec?",
    safe_next_action: "Request a quote or adjust the exact dimensions. Do not present a nearby SKU as an exact substitute.",
  };
}

function buildProcurementSpec(input: ProductCardInput): string {
  const parts = [
    input.sku ? `SKU ${input.sku}` : null,
    input.title,
    input.dimensionsRaw ? `Dimensions: ${input.dimensionsRaw}` : null,
    input.family ? `Family: ${input.family}` : null,
    input.variantId ? `Variant ${input.variantId}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" | ");
}
