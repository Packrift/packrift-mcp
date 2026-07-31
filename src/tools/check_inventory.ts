import { z } from "zod";
import { Env, shopifyQuery, numericToVariantGid, variantIdToNumeric } from "../shopify.js";
import { approvalForVariantId, approvalStatus, assertApprovedVariantIds } from "../approval.js";
import { buildPostConfirmationHandoff, buildTrackingContext } from "../conversion.js";

export const checkInventorySchema = {
  name: "check_inventory",
  title: "Check inventory",
  description:
    "Use to confirm stock before recommending a SKU or building a cart. Required argument: variant_ids as an array of numeric Shopify variant IDs encoded as strings, for example [\"53475949216112\"]. Never send variant_ids as numbers. Live, never cached.",
  inputSchema: {
    type: "object",
    properties: {
      variant_ids: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        description: "Numeric Shopify variant IDs as strings, not numbers. Example: [\"53475949216112\"].",
      },
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

export const checkInventoryZod = z.object({
  variant_ids: z.array(z.string()).min(1),
  journey_id: z.string().min(1).max(120).optional(),
  result_set_id: z.string().min(1).max(120).optional(),
  selected_sku: z.string().min(1).max(80).optional(),
  selected_handle: z.string().min(1).max(160).optional(),
  match_type: z.string().min(1).max(80).optional(),
});

const QUERY = `
  query Inventory($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant { id inventoryQuantity availableForSale }
    }
  }
`;

interface VariantNode {
  id: string;
  inventoryQuantity: number | null;
  availableForSale: boolean;
}

export async function checkInventoryHandler(env: Env, raw: unknown) {
  const { variant_ids, journey_id, result_set_id, selected_sku, selected_handle, match_type } =
    checkInventoryZod.parse(raw);
  assertApprovedVariantIds(variant_ids);
  const ids = variant_ids.map(numericToVariantGid);
  const data = await shopifyQuery<{ nodes: Array<VariantNode | null> }>(env, QUERY, { ids });

  return data.nodes.map((n, i) => {
    if (!n) {
      return { variant_id: variant_ids[i], available: 0, in_stock: false, error: "variant not found" };
    }
    const qty = n.inventoryQuantity ?? 0;
    const variantId = variantIdToNumeric(n.id);
    const tracking = buildTrackingContext({
      source: "check_inventory",
      variantId,
      journeyId: journey_id,
      resultSetId: result_set_id,
      selectedSku: selected_sku,
      selectedHandle: selected_handle,
      matchType: match_type ?? "inventory_check",
    });
    return {
      variant_id: variantId,
      ...approvalStatus(approvalForVariantId(variantId)),
      continuity_key: tracking.continuity_key,
      available: qty,
      in_stock: n.availableForSale && qty > 0,
      tracking,
      post_confirmation_handoff: buildPostConfirmationHandoff({
        source: "check_inventory",
        variantId,
        journeyId: journey_id,
        resultSetId: result_set_id,
        selectedSku: selected_sku,
        selectedHandle: selected_handle,
        matchType: match_type ?? "inventory_check",
        cartEligible: n.availableForSale && qty > 0,
      }),
    };
  });
}
