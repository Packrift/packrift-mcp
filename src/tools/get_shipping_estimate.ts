import { z } from "zod";
import { tolerantLineItemZod } from "../line-items.js";
import { Env, shopifyQuery, numericToVariantGid } from "../shopify.js";
import { assertApprovedVariantIds } from "../approval.js";
import { buildPostConfirmationHandoff, buildTrackingContext } from "../conversion.js";

// Note: The brief specified `cartCreate` + `cartBuyerIdentityUpdate`. Those mutations
// live on the Storefront API, not the Admin API the rest of this server uses. We use
// `draftOrderCalculate` instead — it's the supported Admin path for previewing shipping
// rates against an arbitrary destination without creating a real order. Documented in README.

export const getShippingEstimateSchema = {
  name: "get_shipping_estimate",
  title: "Get shipping estimate",
  description:
    "Use when the buyer asks shipping cost for selected catalog variants. Provide destination_address with address1, city and province_code for an estimate using the supplied address; otherwise the estimate uses postal-code placeholders and is approximate. Addresses are not validated. Cart shipping discounts and final tax are not evaluated; Shopify cart and checkout are authoritative. Required arguments: destination_postal_code, country (US|CA), and items with variant_id as a numeric Shopify variant ID string plus qty, for example {\"variant_id\":\"53475949216112\",\"qty\":1}. Never send variant_id as a number.",
  inputSchema: {
    type: "object",
    properties: {
      destination_postal_code: { type: "string" },
      country: { type: "string", enum: ["US", "CA"] },
      destination_address: {
        type: "object",
        description: "Optional address details used with destination_postal_code and country. Supply all three fields or omit this object. Values are passed through, not address-validated.",
        properties: {
          address1: { type: "string", minLength: 1 },
          city: { type: "string", minLength: 1 },
          province_code: { type: "string", minLength: 1, description: "State or province code, for example WI or ON." },
        },
        required: ["address1", "city", "province_code"],
        additionalProperties: false,
      },
      items: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            variant_id: {
              type: "string",
              description: "Numeric Shopify variant ID as a string, not a number. Example: \"53475949216112\".",
            },
            qty: { type: "integer", minimum: 1, description: "Quantity for this line item. The alias key quantity is also accepted." },
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

const addressField = z.string().refine((value) => value.trim().length > 0, "Address fields must not be blank");

export const getShippingEstimateZod = z.object({
  destination_postal_code: z.string().min(3),
  country: z.enum(["US", "CA"]),
  destination_address: z.object({
    address1: addressField,
    city: addressField,
    province_code: addressField,
  }).strict().optional(),
  items: z.array(tolerantLineItemZod).min(1),
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

  const address = input.destination_address;
  const draftInput = {
    lineItems: input.items.map((it) => ({
      variantId: numericToVariantGid(it.variant_id),
      quantity: it.qty,
    })),
    shippingAddress: {
      address1: address ? address.address1 : "1 Main Street",
      city: address ? address.city : input.country === "US" ? "Anywhere" : "Toronto",
      zip: input.destination_postal_code,
      country: input.country === "US" ? "United States" : "Canada",
      provinceCode: address ? address.province_code : null,
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
    destination_basis: address ? "provided_address" : "postal_code_only",
    complete_address_provided: Boolean(address),
    address_validated: false,
    discounts_evaluated: false,
    price_is_final: false,
    final_price_authority: "Shopify cart and checkout",
    estimate_note: address
      ? "Shipping estimate using the supplied address fields, which have not been validated. Cart shipping discounts and final tax are not evaluated. Verify the buyer's Shopify cart and checkout for the final payable amount."
      : "Approximate postal-code-only shipping estimate using placeholder street and city values. Supply destination_address for an estimate using the buyer's address. Cart shipping discounts and final tax are not evaluated; verify Shopify cart and checkout.",
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
