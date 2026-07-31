import { z } from "zod";
import { Env, shopifyQuery, variantIdToNumeric } from "../shopify.js";
import { extractDimensions } from "../dimensions.js";
import { approvalForHandle, approvalForVariantId, approvalStatus } from "../approval.js";
import { buildConversionActions, buildMatchSummary, buildProductCard } from "../conversion.js";

export const getProductSchema = {
  name: "get_product",
  title: "Get product details",
  description:
    "Use after find_packaging_for_item or search_products to pull full detail for a handle: all variants, SKUs, dimensions, weight, stock. Input: handle. Call before building a cart to map qty to the right variant.",
  inputSchema: {
    type: "object",
    properties: { handle: { type: "string" } },
    required: ["handle"],
  },

  annotations: { readOnlyHint: true, openWorldHint: true },
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
      metafields(first: 250) { edges { node { namespace key value type } } }
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
  const approval =
    approvalForHandle(p.handle) ??
    p.variants.edges.map(({ node }) => approvalForVariantId(node.id)).find((item) => item !== null) ??
    null;
  if (!approval) {
    throw new Error(`AI_APPROVE gate blocked product handle: ${handle}. Use search_products or find_packaging_for_item to choose approved Packrift SKUs.`);
  }
  const approvedVariantEdges = p.variants.edges.filter(({ node }) => approvalForVariantId(node.id));
  if (approvedVariantEdges.length === 0) {
    throw new Error(`AI_APPROVE gate blocked all variants for product handle: ${handle}. Use search_products or find_packaging_for_item to choose approved Packrift SKUs.`);
  }

  const metafields = p.metafields.edges.map((e) => e.node);
  const dims = extractDimensions({ metafields, title: p.title });
  const primaryVariant = approvedVariantEdges[0]?.node ?? null;
  const primaryVariantId = primaryVariant ? variantIdToNumeric(primaryVariant.id) : null;
  const url = p.onlineStoreUrl ?? `https://${env.STOREFRONT_DOMAIN}/products/${p.handle}`;
  const priceMin = Number(p.priceRangeV2.minVariantPrice.amount);
  const currency = p.priceRangeV2.minVariantPrice.currencyCode;
  const cardInput = {
    sku: approval.sku,
    handle: p.handle,
    title: p.title,
    url,
    variantId: primaryVariantId,
    family: approval.family,
    imageUrl: p.featuredImage?.url ?? null,
    price: priceMin,
    currency,
    inStock: approvedVariantEdges.some(({ node }) => node.availableForSale),
    dimensionsRaw: dims?.raw ?? null,
    source: "get_product",
    matchType: "product_detail_continuity",
    matchConfidence: 0.99,
  };

  return {
    id: variantIdToNumeric(p.id),
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    ...approvalStatus(approval),
    product_type: p.productType,
    description: p.description,
    tags: p.tags,
    url,
    primary_image_url: p.featuredImage?.url ?? null,
    match: buildMatchSummary({
      source: "get_product",
      matchType: "product_detail_continuity",
      confidence: 0.99,
      matchedFields: ["handle", "variant", "AI_APPROVE"],
      candidateDimensions: dims?.raw ?? null,
      reason: "Product detail is returned only after the AI_APPROVE handle or variant gate passes.",
    }),
    product_card: buildProductCard(cardInput),
    conversion_actions: buildConversionActions(cardInput),
    price_range: {
      min: priceMin,
      max: Number(p.priceRangeV2.maxVariantPrice.amount),
      currency,
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
    variant_gate: {
      policy: "AI_APPROVE_ONLY",
      variants_returned: approvedVariantEdges.length,
      variants_blocked: p.variants.edges.length - approvedVariantEdges.length,
    },
    variants: approvedVariantEdges.map(({ node: v }) => ({
      id: variantIdToNumeric(v.id),
      gid: v.id,
      sku: v.sku,
      barcode: v.barcode,
      title: v.title,
      ...approvalStatus(approvalForVariantId(v.id)),
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
