import { z } from "zod";
import { Env, shopifyQuery, variantIdToNumeric } from "../shopify.js";
import { extractDimensions, fitScore } from "../dimensions.js";

export const recommendPackagingSchema = {
  name: "recommend_packaging",
  description:
    "Given an item's dimensions, weight, and use case, recommends up to 5 Packrift variants that fit with 0.5–2 inches of padding per side.",
  inputSchema: {
    type: "object",
    properties: {
      item_length_in: { type: "number", minimum: 0.1 },
      item_width_in: { type: "number", minimum: 0.1 },
      item_depth_in: { type: "number", minimum: 0.1 },
      item_weight_lb: { type: "number", minimum: 0 },
      use_case: {
        type: "string",
        enum: ["mailer", "box", "fragile", "apparel", "ecommerce"],
      },
    },
    required: ["item_length_in", "item_width_in", "item_depth_in", "item_weight_lb", "use_case"],
  },
};

export const recommendPackagingZod = z.object({
  item_length_in: z.number().min(0.1),
  item_width_in: z.number().min(0.1),
  item_depth_in: z.number().min(0.1),
  item_weight_lb: z.number().min(0),
  use_case: z.enum(["mailer", "box", "fragile", "apparel", "ecommerce"]),
});

// Use-case to collection-handle mapping. Verified handles from the live store.
const COLLECTIONS_BY_USE_CASE: Record<string, string[]> = {
  mailer: ["mailers-envelopes", "boxes-mailers"],
  box: ["corrugated-boxes", "boxes-mailers"],
  fragile: ["bubble-wrap-foam", "cushioning", "corrugated-boxes"],
  apparel: ["mailers-envelopes", "boxes-mailers"],
  ecommerce: ["ecommerce-fulfillment", "boxes-mailers", "mailers-envelopes"],
};

const QUERY = `
  query CollectionProducts($handle: String!, $first: Int!) {
    collectionByHandle(handle: $handle) {
      products(first: $first) {
        edges {
          node {
            handle
            title
            onlineStoreUrl
            metafields(first: 30) { edges { node { namespace key value type } } }
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                  availableForSale
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface ProductNode {
  handle: string;
  title: string;
  onlineStoreUrl: string | null;
  metafields: { edges: Array<{ node: { namespace: string; key: string; value: string; type: string } }> };
  variants: {
    edges: Array<{
      node: {
        id: string;
        price: string;
        availableForSale: boolean;
        inventoryQuantity: number | null;
      };
    }>;
  };
}

export async function recommendPackagingHandler(env: Env, raw: unknown) {
  const input = recommendPackagingZod.parse(raw);
  const handles = COLLECTIONS_BY_USE_CASE[input.use_case]!;

  // Fan out across collections, take first 50 products from each, dedupe.
  const seen = new Set<string>();
  const candidates: Array<{
    variant_id: string;
    handle: string;
    title: string;
    url: string;
    price: number;
    available: boolean;
    inventory: number;
    dimensions: { length_in: number; width_in: number; depth_in: number | null; raw: string };
    score: number;
  }> = [];

  for (const handle of handles) {
    const data = await shopifyQuery<{
      collectionByHandle: { products: { edges: Array<{ node: ProductNode }> } } | null;
    }>(env, QUERY, { handle, first: 50 });
    const col = data.collectionByHandle;
    if (!col) continue;

    for (const { node: p } of col.products.edges) {
      if (seen.has(p.handle)) continue;
      seen.add(p.handle);
      const v = p.variants.edges[0]?.node;
      if (!v) continue;
      if (!v.availableForSale) continue;
      const mf = p.metafields.edges.map((e) => e.node);
      const dims = extractDimensions({ metafields: mf, title: p.title });
      if (!dims) continue;
      // Fit scoring requires a 3-D box. Skip 2-D-only items unless use_case is mailer/apparel.
      const usable: typeof dims = dims.depth_in !== null ? dims : { ...dims, depth_in: 0.5 };
      const score = fitScore(
        {
          length_in: input.item_length_in,
          width_in: input.item_width_in,
          depth_in: input.item_depth_in,
        },
        usable
      );
      if (score === null) continue;
      candidates.push({
        variant_id: variantIdToNumeric(v.id),
        handle: p.handle,
        title: p.title,
        url: p.onlineStoreUrl ?? `https://${env.STOREFRONT_DOMAIN}/products/${p.handle}`,
        price: Number(v.price),
        available: v.availableForSale,
        inventory: v.inventoryQuantity ?? 0,
        dimensions: {
          length_in: dims.length_in,
          width_in: dims.width_in,
          depth_in: dims.depth_in,
          raw: dims.raw,
        },
        score,
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  const top = candidates.slice(0, 5);

  return top.map((c) => ({
    variant_id: c.variant_id,
    handle: c.handle,
    title: c.title,
    url: c.url,
    dimensions: c.dimensions,
    price: c.price,
    available: c.available,
    inventory: c.inventory,
    fit_score: Number(c.score.toFixed(3)),
    reason: buildReason(input, c.dimensions),
  }));
}

function buildReason(
  input: z.infer<typeof recommendPackagingZod>,
  d: { length_in: number; width_in: number; depth_in: number | null; raw: string }
): string {
  const parts = [
    `Item ${input.item_length_in}x${input.item_width_in}x${input.item_depth_in} in fits ${d.raw}`,
  ];
  const padL = d.length_in - input.item_length_in;
  const padW = d.width_in - input.item_width_in;
  if (d.depth_in !== null) {
    const padD = d.depth_in - input.item_depth_in;
    parts.push(`padding ~${padL.toFixed(1)}/${padW.toFixed(1)}/${padD.toFixed(1)} in`);
  } else {
    parts.push(`padding ~${padL.toFixed(1)}/${padW.toFixed(1)} in`);
  }
  return parts.join("; ");
}
