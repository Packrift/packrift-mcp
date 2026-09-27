// Product-page shipping estimate for packrift.com (added 2026-09-06).
//
// GET /estimate?variant=<numeric id>&qty=<n>&zip=<5 digits>[&tiers=3,6]
// Runs Shopify draftOrderCalculate against the live carrier service, so the
// number is exactly what checkout will quote for that variant, quantity and
// ZIP. Optional `tiers` multiplies qty (e.g. 3,6) so the page can show freight
// per unit at the volume-pricing breakpoints. Results cache in KV for 6 hours.
import { Env, shopifyQuery, numericToVariantGid } from "./shopify.js";

const ALLOWED_ORIGINS = new Set([
  "https://packrift.com",
  "https://www.packrift.com",
  "https://packrift.myshopify.com",
]);

const CALC = `
  mutation PdpEstimate($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        availableShippingRates { title price { amount } }
        subtotalPriceSet { presentmentMoney { amount } }
      }
      userErrors { field message }
    }
  }
`;

const RULES = `{
  automaticDiscountNodes(first: 20) {
    nodes {
      automaticDiscount {
        __typename
        ... on DiscountAutomaticFreeShipping {
          status
          minimumRequirement { ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } } }
          maximumShippingPrice { amount }
        }
      }
    }
  }
}`;

type Rule = { minSubtotal: number; maxShipping: number | null };
type Rate = { title: string; price: number };
type Calc = { qty: number; subtotal: number; rates: Rate[] };

function corsHeaders(origin: string): Record<string, string> {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://packrift.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=300", ...headers },
  });
}

async function freeShipRules(env: Env): Promise<Rule[]> {
  const key = "pdp-estimate:free-ship-rules:v1";
  const cached = (await env.CATALOG_CACHE.get(key, "json")) as Rule[] | null;
  if (cached) return cached;
  const data = await shopifyQuery<{
    automaticDiscountNodes: { nodes: Array<{ automaticDiscount: Record<string, any> }> };
  }>(env, RULES);
  const rules: Rule[] = [];
  for (const n of data.automaticDiscountNodes.nodes) {
    const d = n.automaticDiscount;
    if (d.__typename !== "DiscountAutomaticFreeShipping" || d.status !== "ACTIVE") continue;
    const min = Number(d.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount ?? 0);
    const max = d.maximumShippingPrice ? Number(d.maximumShippingPrice.amount) : null;
    if (Number.isFinite(min)) rules.push({ minSubtotal: min, maxShipping: max });
  }
  await env.CATALOG_CACHE.put(key, JSON.stringify(rules), { expirationTtl: 3600 });
  return rules;
}

async function calc(env: Env, variantGid: string, qty: number, zip: string): Promise<Calc> {
  const key = `pdp-estimate:v1:${variantGid}:${qty}:${zip}`;
  const cached = (await env.CATALOG_CACHE.get(key, "json")) as Calc | null;
  if (cached) return cached;
  const data = await shopifyQuery<{
    draftOrderCalculate: {
      calculatedDraftOrder: {
        availableShippingRates: Array<{ title: string; price: { amount: string } }>;
        subtotalPriceSet: { presentmentMoney: { amount: string } };
      } | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(env, CALC, {
    input: {
      lineItems: [{ variantId: variantGid, quantity: qty }],
      shippingAddress: { address1: "1 Main Street", city: "Anywhere", zip, country: "United States" },
    },
  });
  const errs = data.draftOrderCalculate.userErrors;
  if (errs.length) throw new Error(errs.map((e) => e.message).join("; "));
  const c = data.draftOrderCalculate.calculatedDraftOrder;
  const rates: Rate[] = (c?.availableShippingRates ?? [])
    .map((r) => ({ title: r.title, price: Number(r.price.amount) }))
    .filter((r) => Number.isFinite(r.price))
    .sort((a, b) => a.price - b.price);
  const out: Calc = { qty, subtotal: Number(c?.subtotalPriceSet?.presentmentMoney?.amount ?? 0), rates };
  if (rates.length) await env.CATALOG_CACHE.put(key, JSON.stringify(out), { expirationTtl: 6 * 3600 });
  return out;
}

export async function pdpEstimate(env: Env, req: Request): Promise<Response> {
  const cors = corsHeaders(req.headers.get("Origin") || "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  const variant = (url.searchParams.get("variant") || "").replace(/\D/g, "");
  const zip = (url.searchParams.get("zip") || "").trim().slice(0, 5);
  const qtyRaw = parseInt(url.searchParams.get("qty") || "1", 10);
  const qty = Math.min(Math.max(Number.isFinite(qtyRaw) ? qtyRaw : 1, 1), 500);
  if (!variant || !/^\d{5}$/.test(zip)) {
    return json({ error: "variant and a 5-digit US zip are required" }, 400, cors);
  }
  const mults = (url.searchParams.get("tiers") || "")
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 1 && n <= 12)
    .slice(0, 2);
  const qtys = [qty, ...mults.map((m) => qty * m)].filter((q, i, a) => q <= 500 && a.indexOf(q) === i);
  const gid = numericToVariantGid(variant);
  try {
    const [rules, ...results] = await Promise.all([freeShipRules(env), ...qtys.map((q) => calc(env, gid, q, zip))]);
    const tiers = results.map((r) => {
      const cheapest = r.rates[0] ?? null;
      const free =
        !!cheapest &&
        rules.some((rule) => r.subtotal >= rule.minSubtotal && (rule.maxShipping === null || cheapest.price <= rule.maxShipping));
      return {
        qty: r.qty,
        subtotal: r.subtotal,
        shipping: cheapest ? cheapest.price : null,
        rate_title: cheapest ? cheapest.title : null,
        free_shipping: free,
        per_unit: cheapest ? Number((cheapest.price / r.qty).toFixed(2)) : null,
      };
    });
    const first = tiers[0];
    if (!first || first.shipping === null) {
      return json({ error: "no_rate", zip, variant }, 502, { ...cors, "Cache-Control": "no-store" });
    }
    return json({ zip, variant, tiers, free_shipping_rules: rules }, 200, cors);
  } catch (e) {
    return json(
      { error: "estimate_unavailable", detail: String((e as Error).message).slice(0, 200) },
      502,
      { ...cors, "Cache-Control": "no-store" }
    );
  }
}
