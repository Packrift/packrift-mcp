import { z } from "zod";
import { Env, shopifyQuery, numericToVariantGid } from "../shopify.js";

// Note: The brief specified `cartCreate` + `cartBuyerIdentityUpdate`. Those mutations
// live on the Storefront API, not the Admin API the rest of this server uses. We use
// `draftOrderCalculate` instead — it's the supported Admin path for previewing shipping
// rates against an arbitrary destination without creating a real order. Documented in README.

export const getShippingEstimateSchema = {
  name: "get_shipping_estimate",
  description:
    "Returns available shipping rate options to a destination postal code for a cart of variants and quantities. Uses Shopify Admin draftOrderCalculate.",
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

  return calc.availableShippingRates.map((r) => ({
    handle: r.handle,
    title: r.title,
    price: Number(r.price.amount),
    currency: r.price.currencyCode,
    estimated_days: null,
  }));
}
