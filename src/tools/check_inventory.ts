import { z } from "zod";
import { Env, shopifyQuery, numericToVariantGid, variantIdToNumeric } from "../shopify.js";

export const checkInventorySchema = {
  name: "check_inventory",
  description: "Real-time available inventory count for one or more variant ids. Live, never cached.",
  inputSchema: {
    type: "object",
    properties: {
      variant_ids: { type: "array", items: { type: "string" }, minItems: 1 },
    },
    required: ["variant_ids"],
  },

  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const checkInventoryZod = z.object({ variant_ids: z.array(z.string()).min(1) });

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
  const { variant_ids } = checkInventoryZod.parse(raw);
  const ids = variant_ids.map(numericToVariantGid);
  const data = await shopifyQuery<{ nodes: Array<VariantNode | null> }>(env, QUERY, { ids });

  return data.nodes.map((n, i) => {
    if (!n) {
      return { variant_id: variant_ids[i], available: 0, in_stock: false, error: "variant not found" };
    }
    const qty = n.inventoryQuantity ?? 0;
    return {
      variant_id: variantIdToNumeric(n.id),
      available: qty,
      in_stock: n.availableForSale && qty > 0,
    };
  });
}
