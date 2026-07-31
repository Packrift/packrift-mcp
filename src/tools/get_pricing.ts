import { z } from "zod";
import { Env, shopifyQuery, numericToVariantGid, variantIdToNumeric } from "../shopify.js";
import { approvalForVariantId, approvalStatus, assertApprovedVariantIds } from "../approval.js";
import { buildPostConfirmationHandoff, buildTrackingContext } from "../conversion.js";

export const getPricingSchema = {
  name: "get_pricing",
  title: "Get live pricing",
  description:
    "Use to confirm live unit price and line total before cart handoff. Required argument: variant_ids as an array of numeric Shopify variant IDs encoded as strings, for example [\"53475949216112\"]. Optional quantity defaults to 1. Never send variant_ids as numbers. Never cached.",
  inputSchema: {
    type: "object",
    properties: {
      variant_ids: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        description: "Numeric Shopify variant IDs as strings, not numbers. Example: [\"53475949216112\"].",
      },
      quantity: { type: "integer", minimum: 1, default: 1, description: "Buyer-selected quantity for line total calculation." },
      journey_id: { type: "string" },
      result_set_id: { type: "string" },
      selected_sku: { type: "string" },
      selected_handle: { type: "string" },
      match_type: { type: "string" },
    },
    required: ["variant_ids"],
  },

  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const getPricingZod = z.object({
  variant_ids: z.array(z.string()).min(1),
  quantity: z.number().int().min(1).default(1),
  journey_id: z.string().min(1).max(120).optional(),
  result_set_id: z.string().min(1).max(120).optional(),
  selected_sku: z.string().min(1).max(80).optional(),
  selected_handle: z.string().min(1).max(160).optional(),
  match_type: z.string().min(1).max(80).optional(),
});

const QUERY = `
  query Pricing($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        price
        inventoryQuantity
        availableForSale
        product { priceRangeV2 { minVariantPrice { currencyCode } } }
      }
    }
  }
`;

interface VariantNode {
  id: string;
  price: string;
  inventoryQuantity: number | null;
  availableForSale: boolean;
  product: { priceRangeV2: { minVariantPrice: { currencyCode: string } } };
}

export async function getPricingHandler(env: Env, raw: unknown) {
  const { variant_ids, quantity, journey_id, result_set_id, selected_sku, selected_handle, match_type } =
    getPricingZod.parse(raw);
  assertApprovedVariantIds(variant_ids);
  const ids = variant_ids.map(numericToVariantGid);
  const data = await shopifyQuery<{ nodes: Array<VariantNode | null> }>(env, QUERY, { ids });

  return data.nodes.map((n, i) => {
    if (!n) {
      return {
        variant_id: variant_ids[i],
        unit_price: null,
        currency: null,
        available_quantity: 0,
        line_total: null,
        error: "variant not found",
      };
    }
    const unit = Number(n.price);
    const variantId = variantIdToNumeric(n.id);
    const tracking = buildTrackingContext({
      source: "get_pricing",
      variantId,
      journeyId: journey_id,
      resultSetId: result_set_id,
      selectedSku: selected_sku,
      selectedHandle: selected_handle,
      matchType: match_type ?? "pricing_check",
    });
    return {
      variant_id: variantId,
      ...approvalStatus(approvalForVariantId(variantId)),
      continuity_key: tracking.continuity_key,
      unit_price: unit,
      currency: n.product.priceRangeV2.minVariantPrice.currencyCode,
      available_quantity: n.inventoryQuantity ?? 0,
      available: n.availableForSale,
      line_total: Number((unit * quantity).toFixed(2)),
      quantity,
      tracking,
      post_confirmation_handoff: buildPostConfirmationHandoff({
        source: "get_pricing",
        variantId,
        journeyId: journey_id,
        resultSetId: result_set_id,
        selectedSku: selected_sku,
        selectedHandle: selected_handle,
        matchType: match_type ?? "pricing_check",
        quantity,
        cartEligible: n.availableForSale,
      }),
    };
  });
}
