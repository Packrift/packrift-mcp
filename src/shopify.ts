export interface Env {
  SHOPIFY_STORE_DOMAIN: string;
  SHOPIFY_API_VERSION: string;
  STOREFRONT_DOMAIN: string;
  SHOPIFY_PACKRIFT_TOKEN: string;
  CATALOG_CACHE: KVNamespace;
}

export class ShopifyError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "ShopifyError";
  }
}

export async function shopifyQuery<T = unknown>(
  env: Env,
  graphql: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const url = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": env.SHOPIFY_PACKRIFT_TOKEN,
      "Accept": "application/json",
    },
    body: JSON.stringify({ query: graphql, variables }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ShopifyError(`Shopify HTTP ${res.status}`, body.slice(0, 1000));
  }

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) {
    throw new ShopifyError("Shopify GraphQL error", json.errors);
  }
  if (!json.data) throw new ShopifyError("Shopify returned no data");
  return json.data;
}

// Numeric variant id from gid://shopify/ProductVariant/<n>
export function variantIdToNumeric(gid: string): string {
  const m = gid.match(/(\d+)$/);
  return m ? m[1]! : gid;
}

export function numericToVariantGid(idOrGid: string): string {
  if (idOrGid.startsWith("gid://")) return idOrGid;
  return `gid://shopify/ProductVariant/${idOrGid}`;
}
