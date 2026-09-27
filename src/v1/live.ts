// Live Shopify facts for the v1 tools: one batched variant read per response,
// the store's active automatic discounts (volume tiers, free shipping), and a
// checkout-accurate delivered total from draftOrderCalculate.

import { bestEffort } from "../best-effort.js";
import { Env, shopifyQuery } from "../shopify.js";

export interface LiveVariant {
  variantId: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  available: boolean;
  inventory: number | null;
  handle: string;
  title: string;
  url: string;
  imageUrl: string | null;
  active: boolean;
  productId: string | null;
  /** Shipping weight of one pack (the sellable unit), in pounds. */
  packWeightLb: number | null;
}

const VARIANTS_QUERY = `
  query PackriftV1Variants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        sku
        price
        compareAtPrice
        availableForSale
        inventoryQuantity
        inventoryItem { measurement { weight { value unit } } }
        product { id handle title status onlineStoreUrl featuredImage { url } }
      }
    }
  }
`;

interface VariantNode {
  id: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  availableForSale: boolean;
  inventoryQuantity: number | null;
  inventoryItem?: { measurement: { weight: { value: number; unit: string } | null } | null } | null;
  product: {
    id: string;
    handle: string;
    title: string;
    status: string;
    onlineStoreUrl: string | null;
    featuredImage: { url: string } | null;
  } | null;
}

function numericId(value: string): string {
  return value.match(/(\d+)$/)?.[1] ?? value;
}

export function weightInPounds(weight: { value: number; unit: string } | null | undefined): number | null {
  if (!weight || typeof weight.value !== "number" || !Number.isFinite(weight.value) || weight.value <= 0) return null;
  const unit = String(weight.unit).toUpperCase();
  const factor = unit === "POUNDS" ? 1 : unit === "OUNCES" ? 1 / 16 : unit === "KILOGRAMS" ? 2.20462 : unit === "GRAMS" ? 0.00220462 : null;
  return factor === null ? null : Math.round(weight.value * factor * 1000) / 1000;
}

/** Live price and stock for up to 50 variants in one Shopify request. Missing or unpublished variants are omitted. */
export async function liveVariants(env: Env, variantIds: string[]): Promise<Map<string, LiveVariant>> {
  const ids = [...new Set(variantIds.map(numericId))].slice(0, 50);
  const out = new Map<string, LiveVariant>();
  if (!ids.length) return out;
  const data = await shopifyQuery<{ nodes: Array<VariantNode | null> }>(
    env,
    VARIANTS_QUERY,
    { ids: ids.map((id) => `gid://shopify/ProductVariant/${id}`) },
    { timeoutMs: 6000 }
  );
  for (const node of data.nodes ?? []) {
    if (!node || !node.product) continue;
    const variantId = numericId(node.id);
    out.set(variantId, {
      variantId,
      sku: node.sku,
      price: Number(node.price),
      compareAtPrice: node.compareAtPrice ? Number(node.compareAtPrice) : null,
      available: node.availableForSale,
      inventory: typeof node.inventoryQuantity === "number" ? node.inventoryQuantity : null,
      handle: node.product.handle,
      title: node.product.title,
      url: node.product.onlineStoreUrl ?? `https://${env.STOREFRONT_DOMAIN}/products/${node.product.handle}`,
      imageUrl: node.product.featuredImage?.url ?? null,
      active: node.product.status === "ACTIVE",
      productId: node.product.id ? numericId(node.product.id) : null,
      packWeightLb: weightInPounds(node.inventoryItem?.measurement?.weight ?? null),
    });
  }
  return out;
}

export interface VolumeTier {
  minQuantity: number;
  percentOff: number;
  appliesTo: "all_items" | "selected_collections";
  title: string;
  /** Collections the tier is limited to, when appliesTo is selected_collections. */
  collectionIds?: string[];
  /** Numeric product IDs the tier applies to; null when membership could not be read. */
  productIds?: string[] | null;
}

export interface FreeShippingRule {
  minSubtotal: number;
  maxShippingPrice: number | null;
  title: string;
}

export interface DiscountRules {
  volumeTiers: VolumeTier[];
  freeShipping: FreeShippingRule[];
  fetchedAt: string;
}

const DISCOUNTS_QUERY = `
  query PackriftV1Discounts {
    automaticDiscountNodes(first: 30, query: "status:active") {
      nodes {
        automaticDiscount {
          __typename
          ... on DiscountAutomaticBasic {
            title
            context { __typename }
            minimumRequirement {
              __typename
              ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
            }
            customerGets {
              value { __typename ... on DiscountPercentage { percentage } }
              items {
                __typename
                ... on DiscountCollections { collections(first: 10) { nodes { id } } }
                ... on DiscountProducts { products(first: 100) { nodes { id } } }
              }
            }
          }
          ... on DiscountAutomaticFreeShipping {
            title
            context { __typename }
            minimumRequirement {
              __typename
              ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } }
            }
            maximumShippingPrice { amount }
          }
        }
      }
    }
  }
`;

interface DiscountNode {
  automaticDiscount: {
    __typename: string;
    title?: string;
    context?: { __typename: string } | null;
    minimumRequirement?: {
      __typename: string;
      greaterThanOrEqualToQuantity?: string;
      greaterThanOrEqualToSubtotal?: { amount: string };
    } | null;
    customerGets?: {
      value?: { __typename: string; percentage?: number };
      items?: { __typename: string; collections?: { nodes: Array<{ id: string }> }; products?: { nodes: Array<{ id: string }> } };
    };
    maximumShippingPrice?: { amount: string } | null;
  };
}

const DISCOUNT_CACHE_KEY = "v1:discount-rules:2";
let memoryRules: { rules: DiscountRules; expiresAt: number } | null = null;

export async function discountRules(env: Env): Promise<DiscountRules> {
  const now = Date.now();
  if (memoryRules && memoryRules.expiresAt > now) return memoryRules.rules;
  const cached = await bestEffort(() => env.CATALOG_CACHE.get(DISCOUNT_CACHE_KEY, "json") as Promise<DiscountRules | null>, null, 250);
  if (cached) {
    memoryRules = { rules: cached, expiresAt: now + 5 * 60_000 };
    return cached;
  }
  const empty: DiscountRules = { volumeTiers: [], freeShipping: [], fetchedAt: new Date().toISOString() };
  let rules = empty;
  try {
    const data = await shopifyQuery<{ automaticDiscountNodes: { nodes: DiscountNode[] } }>(env, DISCOUNTS_QUERY, {}, { timeoutMs: 5000 });
    rules = parseDiscountNodes(data.automaticDiscountNodes.nodes);
    await resolveTierMembers(env, rules);
    await bestEffort(() => env.CATALOG_CACHE.put(DISCOUNT_CACHE_KEY, JSON.stringify(rules), { expirationTtl: 900 }), undefined);
  } catch {
    // Discount copy is informational; checkout applies the real rules either way.
  }
  memoryRules = { rules, expiresAt: now + 5 * 60_000 };
  return rules;
}

const COLLECTION_MEMBERS_QUERY = `
  query PackriftV1CollectionMembers($id: ID!, $after: String) {
    collection(id: $id) { products(first: 250, after: $after) { nodes { id } pageInfo { hasNextPage endCursor } } }
  }
`;

/** Reads the product IDs of each collection a volume tier is limited to (up to 2,000 per collection). */
async function resolveTierMembers(env: Env, rules: DiscountRules): Promise<void> {
  const ids = [...new Set(rules.volumeTiers.flatMap((tier) => tier.collectionIds ?? []))];
  const members = new Map<string, string[] | null>();
  for (const id of ids.slice(0, 5)) {
    const found: string[] = [];
    let after: string | null = null;
    let complete = false;
    try {
      for (let page = 0; page < 8; page += 1) {
        const data: { collection: { products: { nodes: Array<{ id: string }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } | null } =
          await shopifyQuery(env, COLLECTION_MEMBERS_QUERY, { id, after }, { timeoutMs: 5000 });
        if (!data.collection) break;
        found.push(...data.collection.products.nodes.map((node) => numericId(node.id)));
        if (!data.collection.products.pageInfo.hasNextPage) {
          complete = true;
          break;
        }
        after = data.collection.products.pageInfo.endCursor;
      }
    } catch {
      complete = false;
    }
    members.set(id, complete ? found : null);
  }
  for (const tier of rules.volumeTiers) {
    if (tier.appliesTo !== "selected_collections" || tier.productIds) continue;
    const lists = (tier.collectionIds ?? []).map((id) => members.get(id) ?? null);
    tier.productIds = lists.length && lists.every((list) => list !== null) ? [...new Set(lists.flat() as string[])] : null;
  }
}

export function parseDiscountNodes(nodes: DiscountNode[]): DiscountRules {
  const volumeTiers: VolumeTier[] = [];
  const freeShipping: FreeShippingRule[] = [];
  for (const node of nodes) {
    const d = node.automaticDiscount;
    // Discounts limited to named customers or segments are not public pricing.
    if (d.context && d.context.__typename !== "DiscountBuyerSelectionAll") continue;
    if (d.__typename === "DiscountAutomaticBasic") {
      const minQuantity = Number(d.minimumRequirement?.greaterThanOrEqualToQuantity);
      const percentage = d.customerGets?.value?.percentage;
      if (Number.isFinite(minQuantity) && typeof percentage === "number" && percentage > 0) {
        const items = d.customerGets?.items;
        const allItems = items?.__typename === "AllDiscountItems";
        volumeTiers.push({
          minQuantity,
          percentOff: Math.round(percentage * 1000) / 10,
          appliesTo: allItems ? "all_items" : "selected_collections",
          title: d.title ?? "",
          collectionIds: items?.collections?.nodes.map((node) => node.id) ?? [],
          productIds: items?.__typename === "DiscountProducts" ? items.products?.nodes.map((node) => numericId(node.id)) ?? [] : allItems ? undefined : null,
        });
      }
    } else if (d.__typename === "DiscountAutomaticFreeShipping") {
      const minSubtotal = Number(d.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount);
      if (Number.isFinite(minSubtotal)) {
        freeShipping.push({
          minSubtotal,
          maxShippingPrice: d.maximumShippingPrice ? Number(d.maximumShippingPrice.amount) : null,
          title: d.title ?? "",
        });
      }
    }
  }
  volumeTiers.sort((a, b) => a.minQuantity - b.minQuantity || a.percentOff - b.percentOff);
  freeShipping.sort((a, b) => a.minSubtotal - b.minSubtotal);
  return { volumeTiers, freeShipping, fetchedAt: new Date().toISOString() };
}

/** Volume tiers that apply to one product: store-wide tiers plus any collection tier it belongs to. */
export function tiersForProduct(rules: DiscountRules, productId: string | null | undefined): VolumeTier[] {
  const id = productId ? numericId(String(productId)) : null;
  return rules.volumeTiers.filter((tier) => tier.appliesTo === "all_items" || Boolean(id && tier.productIds && tier.productIds.includes(id)));
}

/** Effective discount ladder for one product. Automatic discounts here do not combine, so checkout applies the best tier reached. */
export function discountLadder(tiers: VolumeTier[]): Array<{ minQuantity: number; percentOff: number }> {
  const thresholds = [...new Set(tiers.map((tier) => tier.minQuantity))].sort((a, b) => a - b);
  const ladder: Array<{ minQuantity: number; percentOff: number }> = [];
  for (const minQuantity of thresholds) {
    const percentOff = Math.max(...tiers.filter((tier) => tier.minQuantity <= minQuantity).map((tier) => tier.percentOff));
    if (!ladder.length || percentOff > ladder[ladder.length - 1]!.percentOff) ladder.push({ minQuantity, percentOff });
  }
  return ladder;
}

export function percentAtQuantity(ladder: Array<{ minQuantity: number; percentOff: number }>, quantity: number): number {
  let best = 0;
  for (const step of ladder) if (quantity >= step.minQuantity) best = step.percentOff;
  return best;
}

function ladderText(ladder: Array<{ minQuantity: number; percentOff: number }>): string {
  return ladder.map((step) => `${step.percentOff}% off ${step.minQuantity}+ packs`).join(", ");
}

/** One line on volume pricing for the SKUs shown. Store-wide tiers first, then any SKUs on a deeper ladder. */
export function volumePricingLine(rules: DiscountRules, items: Array<{ sku: string; productId: string | null }>): string {
  if (!rules.volumeTiers.length) return "";
  const base = discountLadder(rules.volumeTiers.filter((tier) => tier.appliesTo === "all_items"));
  const unknownMembership = rules.volumeTiers.some((tier) => tier.appliesTo === "selected_collections" && !tier.productIds);
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const text = ladderText(discountLadder(tiersForProduct(rules, item.productId)));
    if (!text || text === ladderText(base)) continue;
    groups.set(text, [...(groups.get(text) ?? []), item.sku]);
  }
  const parts: string[] = [];
  if (base.length) parts.push(ladderText(base));
  for (const [text, skus] of groups) parts.push(`SKU ${skus.join(", ")}: ${text}`);
  if (!parts.length) return "";
  const tail = unknownMembership ? " Some items qualify for deeper case pricing at checkout." : "";
  return `Volume pricing, applied automatically at checkout: ${parts.join("; ")}.${tail}`;
}

/** Plain-language note on free shipping for a priced basket. Never implies free shipping the rate does not qualify for. */
export function freeShippingNote(quote: DeliveredQuote, rules: DiscountRules): string {
  if (!quote.cheapest) return "";
  if (quote.cheapest.charged === 0) return "Shipping is free on this order.";
  const rate = Math.min(...quote.rates.map((r) => r.price));
  const tiers = [...rules.freeShipping].sort((a, b) => a.minSubtotal - b.minSubtotal);
  const reached = tiers.filter((r) => quote.subtotal >= r.minSubtotal);
  const notes: string[] = [];
  const blocked = reached.filter((r) => r.maxShippingPrice !== null && rate > r.maxShippingPrice).pop();
  if (blocked) {
    notes.push(`Free shipping on orders over $${blocked.minSubtotal} covers shipping rates up to $${blocked.maxShippingPrice}; this order's rate is ${formatMoney(rate)}, so shipping is charged.`);
  }
  const next = tiers.find((r) => quote.subtotal < r.minSubtotal && (r.maxShippingPrice === null || rate <= r.maxShippingPrice));
  if (next) {
    const gap = round2(next.minSubtotal - quote.subtotal);
    notes.push(`Orders over $${next.minSubtotal} ship free${next.maxShippingPrice !== null ? ` when the rate is $${next.maxShippingPrice} or less` : ""}; this order is ${formatMoney(gap)} below that.`);
  }
  return notes.join(" ");
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

export interface DeliveredQuote {
  subtotalBeforeDiscounts: number;
  discounts: number;
  subtotal: number;
  rates: Array<{ title: string; price: number; free: boolean; charged: number }>;
  cheapest: { title: string; charged: number } | null;
  total: number | null;
}

const CALC_QUERY = `
  mutation PackriftV1Calc($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        subtotalPriceSet { presentmentMoney { amount } }
        totalDiscountsSet { presentmentMoney { amount } }
        availableShippingRates { title price { amount } }
      }
      userErrors { field message }
    }
  }
`;

interface CalcResult {
  draftOrderCalculate: {
    calculatedDraftOrder: {
      subtotalPriceSet: { presentmentMoney: { amount: string } };
      totalDiscountsSet: { presentmentMoney: { amount: string } } | null;
      availableShippingRates: Array<{ title: string; price: { amount: string } }>;
    } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

/** Delivered total for a basket: Shopify's checkout rates with automatic discounts applied. Tax is not included. */
export async function deliveredQuote(
  env: Env,
  lines: Array<{ variantId: string; quantity: number }>,
  destination: { postalCode: string; country: "US" | "CA"; provinceCode?: string | null; city?: string | null; address1?: string | null }
): Promise<DeliveredQuote> {
  const input = {
    acceptAutomaticDiscounts: true,
    lineItems: lines.map((line) => ({ variantId: `gid://shopify/ProductVariant/${numericId(line.variantId)}`, quantity: line.quantity })),
    shippingAddress: {
      address1: destination.address1 || "1 Main Street",
      city: destination.city || (destination.country === "US" ? "Anywhere" : "Toronto"),
      zip: destination.postalCode,
      countryCode: destination.country,
      provinceCode: destination.provinceCode || null,
    },
  };
  const [data, rules] = await Promise.all([
    shopifyQuery<CalcResult>(env, CALC_QUERY, { input }, { timeoutMs: 15000 }),
    discountRules(env),
  ]);
  const errors = data.draftOrderCalculate.userErrors;
  if (errors.length) throw new Error(`Shipping calculation failed: ${errors.map((e) => e.message).join("; ")}`);
  const calc = data.draftOrderCalculate.calculatedDraftOrder;
  if (!calc) throw new Error("Shipping calculation returned no result for this destination.");
  const subtotal = Number(calc.subtotalPriceSet.presentmentMoney.amount);
  const discounts = Number(calc.totalDiscountsSet?.presentmentMoney.amount ?? 0);
  const rates = calc.availableShippingRates.map((rate) => {
    const price = Number(rate.price.amount);
    const free = rules.freeShipping.some(
      (rule) => subtotal >= rule.minSubtotal && (rule.maxShippingPrice === null || price <= rule.maxShippingPrice)
    );
    return { title: rate.title, price, free, charged: free ? 0 : price };
  });
  rates.sort((a, b) => a.charged - b.charged);
  const cheapest = rates[0] ? { title: rates[0].title, charged: rates[0].charged } : null;
  return {
    subtotalBeforeDiscounts: round2(subtotal + discounts),
    discounts: round2(discounts),
    subtotal: round2(subtotal),
    rates,
    cheapest,
    total: cheapest ? round2(subtotal + cheapest.charged) : null,
  };
}

const PRICE_QUERY = `
  mutation PackriftV1Price($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        subtotalPriceSet { presentmentMoney { amount } }
        totalDiscountsSet { presentmentMoney { amount } }
      }
      userErrors { field message }
    }
  }
`;

/** Subtotal after automatic volume discounts for a basket, as checkout computes it. No address, so no shipping. */
export async function basketPricing(
  env: Env,
  lines: Array<{ variantId: string; quantity: number }>
): Promise<{ subtotalBeforeDiscounts: number; discounts: number; subtotal: number }> {
  const input = {
    acceptAutomaticDiscounts: true,
    lineItems: lines.map((line) => ({ variantId: `gid://shopify/ProductVariant/${numericId(line.variantId)}`, quantity: line.quantity })),
  };
  const data = await shopifyQuery<{
    draftOrderCalculate: {
      calculatedDraftOrder: { subtotalPriceSet: { presentmentMoney: { amount: string } }; totalDiscountsSet: { presentmentMoney: { amount: string } } | null } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(env, PRICE_QUERY, { input }, { timeoutMs: 6000 });
  const calc = data.draftOrderCalculate.calculatedDraftOrder;
  if (!calc || data.draftOrderCalculate.userErrors.length) throw new Error("Pricing unavailable");
  const subtotal = Number(calc.subtotalPriceSet.presentmentMoney.amount);
  const discounts = Number(calc.totalDiscountsSet?.presentmentMoney.amount ?? 0);
  return { subtotalBeforeDiscounts: round2(subtotal + discounts), discounts: round2(discounts), subtotal: round2(subtotal) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
