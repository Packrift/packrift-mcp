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
        product { handle title status onlineStoreUrl featuredImage { url } }
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
  product: {
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
    });
  }
  return out;
}

export interface VolumeTier {
  minQuantity: number;
  percentOff: number;
  appliesTo: "all_items" | "selected_collections";
  title: string;
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
            minimumRequirement {
              __typename
              ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
            }
            customerGets {
              value { __typename ... on DiscountPercentage { percentage } }
              items { __typename }
            }
          }
          ... on DiscountAutomaticFreeShipping {
            title
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
    minimumRequirement?: {
      __typename: string;
      greaterThanOrEqualToQuantity?: string;
      greaterThanOrEqualToSubtotal?: { amount: string };
    } | null;
    customerGets?: {
      value?: { __typename: string; percentage?: number };
      items?: { __typename: string };
    };
    maximumShippingPrice?: { amount: string } | null;
  };
}

const DISCOUNT_CACHE_KEY = "v1:discount-rules:1";
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
    await bestEffort(() => env.CATALOG_CACHE.put(DISCOUNT_CACHE_KEY, JSON.stringify(rules), { expirationTtl: 900 }), undefined);
  } catch {
    // Discount copy is informational; checkout applies the real rules either way.
  }
  memoryRules = { rules, expiresAt: now + 5 * 60_000 };
  return rules;
}

export function parseDiscountNodes(nodes: DiscountNode[]): DiscountRules {
  const volumeTiers: VolumeTier[] = [];
  const freeShipping: FreeShippingRule[] = [];
  for (const node of nodes) {
    const d = node.automaticDiscount;
    if (d.__typename === "DiscountAutomaticBasic") {
      const minQuantity = Number(d.minimumRequirement?.greaterThanOrEqualToQuantity);
      const percentage = d.customerGets?.value?.percentage;
      if (Number.isFinite(minQuantity) && typeof percentage === "number" && percentage > 0) {
        volumeTiers.push({
          minQuantity,
          percentOff: Math.round(percentage * 1000) / 10,
          appliesTo: d.customerGets?.items?.__typename === "AllDiscountItems" ? "all_items" : "selected_collections",
          title: d.title ?? "",
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

/** One sentence describing volume pricing and free shipping, for concise responses. */
export function discountSummary(rules: DiscountRules): string {
  const allItems = rules.volumeTiers.filter((tier) => tier.appliesTo === "all_items");
  const cases = rules.volumeTiers.filter((tier) => tier.appliesTo === "selected_collections");
  const parts: string[] = [];
  if (allItems.length || cases.length) {
    const tiers = allItems.map((t) => `${t.percentOff}% off ${t.minQuantity}+ items`).join(", ");
    const caseTiers = cases.map((t) => `${t.percentOff}% off ${t.minQuantity}+`).join(", ");
    parts.push(`volume discounts (${[tiers, caseTiers ? `eligible cases ${caseTiers}` : ""].filter(Boolean).join("; ")})`);
  }
  if (rules.freeShipping.length) {
    parts.push(
      `free shipping on orders over ${rules.freeShipping
        .map((rule) => (rule.maxShippingPrice !== null ? `$${rule.minSubtotal} (rates up to $${rule.maxShippingPrice})` : `$${rule.minSubtotal}`))
        .join(" or ")}`
    );
  }
  return parts.length ? `Checkout applies ${parts.join(" and ")} automatically.` : "";
}

/** How much more the buyer would need to spend for free shipping, when a rule could apply to this order's rate. */
export function freeShippingGap(quote: DeliveredQuote, rules: DiscountRules): string {
  if (!quote.cheapest || quote.cheapest.charged === 0) return quote.cheapest ? "Shipping is free on this order." : "";
  const rate = quote.rates[0]?.price ?? 0;
  const rule = rules.freeShipping
    .filter((r) => quote.subtotal < r.minSubtotal && (r.maxShippingPrice === null || rate <= r.maxShippingPrice))
    .sort((a, b) => a.minSubtotal - b.minSubtotal)[0];
  if (!rule) return "";
  const gap = round2(rule.minSubtotal - quote.subtotal);
  return `Free shipping applies to orders over $${rule.minSubtotal}${rule.maxShippingPrice !== null ? ` when shipping is up to $${rule.maxShippingPrice}` : ""}; this order is $${gap.toFixed(2)} below that.`;
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
    shopifyQuery<CalcResult>(env, CALC_QUERY, { input }, { timeoutMs: 8000 }),
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

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
