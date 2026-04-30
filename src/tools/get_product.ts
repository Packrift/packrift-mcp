import { z } from "zod";
import { Env, shopifyQuery, variantIdToNumeric } from "../shopify.js";
import { extractDimensions } from "../dimensions.js";

export const getProductSchema = {
  name: "get_product",
  description: "Full product detail by handle including all variants, dimensions, weight, and inventory.",
  inputSchema: {
    type: "object",
    properties: { handle: { type: "string" } },
    required: ["handle"],
  },
};

export const getProductZod = z.object({ handle: z.string().min(1) });

const QUERY = `
  query GetProduct($handle: String!) {
    productByHandle(handle: $handle) {
      id
      handle
      title
      vendor
      productType
      description
      tags
      onlineStoreUrl
      featuredImage { url }
      priceRangeV2 {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      metafields(first: 50) { edges { node { namespace key value type } } }
      variants(first: 100) {
        edges {
          node {
            id
            sku
            barcode
            title
            price
            compareAtPrice
            inventoryQuantity
            availableForSale
            selectedOptions { name value }
            inventoryItem { measurement { weight { value unit } } }
          }
        }
      }
    }
  }
`;

interface VariantNode {
  id: string;
  sku: string | null;
  barcode: string | null;
  title: string;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
  inventoryItem: { measurement: { weight: { value: number; unit: string } | null } | null } | null;
}

export async function getProductHandler(env: Env, raw: unknown) {
  const { handle } = getProductZod.parse(raw);
  const data = await shopifyQuery<{
    productByHandle: {
      id: string;
      handle: string;
      title: string;
      vendor: string;
      productType: string;
      description: string;
      tags: string[];
      onlineStoreUrl: string | null;
      featuredImage: { url: string } | null;
      priceRangeV2: {
        minVariantPrice: { amount: string; currencyCode: string };
        maxVariantPrice: { amount: string; currencyCode: string };
      };
      metafields: { edges: Array<{ node: { namespace: string; key: string; value: string; type: string } }> };
      variants: { edges: Array<{ node: VariantNode }> };
    } | null;
  }>(env, QUERY, { handle });

  const p = data.productByHandle;
  if (!p) throw new Error(`Product not found: ${handle}`);

  const metafields = p.metafields.edges.map((e) => e.node);
  const dims = extractDimensions({ metafields, title: p.title });

  return {
    id: variantIdToNumeric(p.id),
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    product_type: p.productType,
    description: p.description,
    tags: p.tags,
    url: p.onlineStoreUrl ?? `https://${env.STOREFRONT_DOMAIN}/products/${p.handle}`,
    primary_image_url: p.featuredImage?.url ?? null,
    price_range: {
      min: Number(p.priceRangeV2.minVariantPrice.amount),
      max: Number(p.priceRangeV2.maxVariantPrice.amount),
      currency: p.priceRangeV2.minVariantPrice.currencyCode,
    },
    dimensions: dims
      ? {
          length_in: dims.length_in,
          width_in: dims.width_in,
          depth_in: dims.depth_in,
          raw: dims.raw,
        }
      : null,
    metafields: metafields.map((m) => ({
      namespace: m.namespace,
      key: m.key,
      value: m.value,
      type: m.type,
    })),
    variants: p.variants.edges.map(({ node: v }) => ({
      id: variantIdToNumeric(v.id),
      gid: v.id,
      sku: v.sku,
      barcode: v.barcode,
      title: v.title,
      price: Number(v.price),
      compare_at_price: v.compareAtPrice ? Number(v.compareAtPrice) : null,
      inventory_quantity: v.inventoryQuantity ?? 0,
      available: v.availableForSale,
      weight: v.inventoryItem?.measurement?.weight?.value ?? null,
      weight_unit: v.inventoryItem?.measurement?.weight?.unit ?? null,
      selected_options: v.selectedOptions,
      dimensions: dims
        ? { length_in: dims.length_in, width_in: dims.width_in, depth_in: dims.depth_in, raw: dims.raw }
        : null,
    })),
  };
}
