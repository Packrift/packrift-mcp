import { z } from "zod";
import { Env, shopifyQuery, numericToVariantGid } from "../shopify.js";
import { assertApprovedVariantIds } from "../approval.js";
import { buildPostConfirmationHandoff, buildTrackingContext } from "../conversion.js";

// Note: The brief specified `cartCreate` + `cartBuyerIdentityUpdate`. Those mutations
// live on the Storefront API, not the Admin API the rest of this server uses. We use
// `draftOrderCalculate` instead — it's the supported Admin path for previewing shipping
// rates against an arbitrary destination without creating a real order. Documented in README.

export const getShippingEstimateSchema = {
  name: "get_shipping_estimate",
  description:
    "Use when the user asks shipping cost to a ZIP for a chosen cart. Inputs: destination_postal_code, country (US|CA), items[{variant_id, qty}]. Returns carrier rate options with price and currency.",
  inputSchema: {
    type: "object",
    properties: {
      destination_postal_code: { type: "string" },
      country: { type: "string", enum: ["US", "CA"] },
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
      journey_id: { type: "string" },
      result_set_id: { type: "string" },
      selected_sku: { type: "string" },
      selected_handle: { type: "string" },
      match_type: { type: "string" },
    },
    required: ["destination_postal_code", "country", "items"],
  },

  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const getShippingEstimateZod = z.object({
  destination_postal_code: z.string().min(3),
  country: z.enum(["US", "CA"]),
  items: z
    .array(
      z.object({
        variant_id: z.string(),
        qty: z.number().int().min(1),
      })
    )
    .min(1),
  journey_id: z.string().min(1).max(120).optional(),
  result_set_id: z.string().min(1).max(120).optional(),
  selected_sku: z.string().min(1).max(80).optional(),
  selected_handle: z.string().min(1).max(160).optional(),
  match_type: z.string().min(1).max(80).optional(),
});

const QUERY = `
  mutation Calc($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        availableShippingRates {
          handle
          title
          price { amount currencyCode }
        }
        subtotalPriceSet { presentmentMoney { amount currencyCode } }
        totalShippingPriceSet { presentmentMoney { amount currencyCode } }
      }
      userErrors { field message }
    }
  }
`;

interface CalcResult {
  draftOrderCalculate: {
    calculatedDraftOrder: {
      availableShippingRates: Array<{
        handle: string;
        title: string;
        price: { amount: string; currencyCode: string };
      }>;
      subtotalPriceSet: { presentmentMoney: { amount: string; currencyCode: string } };
      totalShippingPriceSet: { presentmentMoney: { amount: string; currencyCode: string } };
    } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

export async function getShippingEstimateHandler(env: Env, raw: unknown) {
  const input = getShippingEstimateZod.parse(raw);
  assertApprovedVariantIds(input.items.map((it) => it.variant_id));

  const draftInput = {
    lineItems: input.items.map((it) => ({
      variantId: numericToVariantGid(it.variant_id),
      quantity: it.qty,
    })),
    shippingAddress: {
      address1: "1 Main Street",
      city: input.country === "US" ? "Anywhere" : "Toronto",
      zip: input.destination_postal_code,
      country: input.country === "US" ? "United States" : "Canada",
      provinceCode: input.country === "US" ? null : null,
    },
  };

  const data = await shopifyQuery<CalcResult>(env, QUERY, { input: draftInput });
  const errs = data.draftOrderCalculate.userErrors;
  if (errs.length) {
    throw new Error(`draftOrderCalculate userErrors: ${JSON.stringify(errs)}`);
  }
  const calc = data.draftOrderCalculate.calculatedDraftOrder;
  if (!calc) return [];
  const tracking = buildTrackingContext({
    source: "get_shipping_estimate",
    variantId: input.items[0]?.variant_id ?? null,
    journeyId: input.journey_id,
    resultSetId: input.result_set_id,
    selectedSku: input.selected_sku,
    selectedHandle: input.selected_handle,
    matchType: input.match_type ?? "shipping_estimate",
  });

  return calc.availableShippingRates.map((r) => ({
    handle: r.handle,
    title: r.title,
    price: Number(r.price.amount),
    currency: r.price.currencyCode,
    estimated_days: null,
    continuity_key: tracking.continuity_key,
    tracking,
    post_confirmation_handoff: buildPostConfirmationHandoff({
      source: "get_shipping_estimate",
      variantId: input.items[0]?.variant_id ?? null,
      journeyId: input.journey_id,
      resultSetId: input.result_set_id,
      selectedSku: input.selected_sku,
      selectedHandle: input.selected_handle,
      matchType: input.match_type ?? "shipping_estimate",
      quantity: input.items[0]?.qty ?? 1,
      cartEligible: true,
    }),
  }));
}
