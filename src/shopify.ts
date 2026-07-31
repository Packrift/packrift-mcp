export interface Env {
  SHOPIFY_STORE_DOMAIN: string;
  SHOPIFY_API_VERSION: string;
  STOREFRONT_DOMAIN: string;
  INDEXNOW_ROOT_KEY?: string;
  SHOPIFY_PACKRIFT_TOKEN: string;
  AI_SALES_SKU_PAGE_TELEMETRY?: string;
  MCP_STATS_TOKEN?: string;
  GOOGLE_RETAIL_PROJECT_ID?: string;
  GOOGLE_RETAIL_LOCATION?: string;
  GOOGLE_RETAIL_CATALOG?: string;
  GOOGLE_RETAIL_SERVING_CONFIG?: string;
  GOOGLE_RETAIL_BRANCH?: string;
  GOOGLE_RETAIL_AI_FINDER_DAILY_LIMIT?: string;
  GOOGLE_RETAIL_SERVICE_ACCOUNT_JSON?: string;
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
  variables: Record<string, unknown> = {},
  options: { signal?: AbortSignal } = {}
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
    signal: options.signal,
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
