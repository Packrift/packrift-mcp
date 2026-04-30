import { z } from "zod";
import { Env, shopifyQuery, numericToVariantGid, variantIdToNumeric } from "../shopify.js";

export const getPricingSchema = {
  name: "get_pricing",
  description: "Real-time price and available quantity for one or more variant ids. Live, never cached.",
  inputSchema: {
    type: "object",
    properties: {
      variant_ids: { type: "array", items: { type: "string" }, minItems: 1 },
      quantity: { type: "integer", minimum: 1, default: 1 },
    },
    required: ["variant_ids"],
  },
};

export const getPricingZod = z.object({
  variant_ids: z.array(z.string()).min(1),
  quantity: z.number().int().min(1).default(1),
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
  const { variant_ids, quantity } = getPricingZod.parse(raw);
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
    return {
      variant_id: variantIdToNumeric(n.id),
      unit_price: unit,
      currency: n.product.priceRangeV2.minVariantPrice.currencyCode,
      available_quantity: n.inventoryQuantity ?? 0,
      available: n.availableForSale,
      line_total: Number((unit * quantity).toFixed(2)),
      quantity,
    };
  });
}
