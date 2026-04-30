import { z } from "zod";
import { Env, shopifyQuery, variantIdToNumeric } from "../shopify.js";

export const searchProductsSchema = {
  name: "search_products",
  description:
    "Search the Packrift catalog by keyword. Returns up to `limit` products with price range, stock state, primary image, and storefront URL.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search; matches title, vendor, type, tags." },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
    },
    required: ["query"],
  },

  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const searchProductsZod = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
});

const QUERY = `
  query SearchProducts($q: String!, $first: Int!) {
    products(first: $first, query: $q) {
      edges {
        node {
          id
          handle
          title
          vendor
          onlineStoreUrl
          totalInventory
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          featuredImage { url }
          variants(first: 1) { edges { node { id availableForSale } } }
        }
      }
    }
  }
`;

interface ProductNode {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  onlineStoreUrl: string | null;
  totalInventory: number | null;
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  featuredImage: { url: string } | null;
  variants: { edges: Array<{ node: { id: string; availableForSale: boolean } }> };
}

export async function searchProductsHandler(env: Env, raw: unknown) {
  const { query, limit } = searchProductsZod.parse(raw);

  const cacheKey = `search:${limit}:${query}`;
  const cached = await env.CATALOG_CACHE.get(cacheKey, "json");
  if (cached) return cached;

  const data = await shopifyQuery<{ products: { edges: Array<{ node: ProductNode }> } }>(
    env,
    QUERY,
    { q: query, first: limit }
  );

  const out = data.products.edges.map(({ node }) => ({
    id: variantIdToNumeric(node.id),
    handle: node.handle,
    title: node.title,
    vendor: node.vendor,
    price_range: {
      min: Number(node.priceRangeV2.minVariantPrice.amount),
      max: Number(node.priceRangeV2.maxVariantPrice.amount),
      currency: node.priceRangeV2.minVariantPrice.currencyCode,
    },
    in_stock:
      (node.totalInventory ?? 0) > 0 ||
      node.variants.edges.some((e) => e.node.availableForSale),
    primary_image_url: node.featuredImage?.url ?? null,
    url:
      node.onlineStoreUrl ??
      `https://${env.STOREFRONT_DOMAIN}/products/${node.handle}`,
  }));

  await env.CATALOG_CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 300 });
  return out;
}
