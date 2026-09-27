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
  OMNISEND_API_KEY?: string;
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
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<T> {
  // Bound the complete upstream exchange, including a stalled response body.
  // Never retry here: callers include operations whose replay may be unsafe.
  const timeoutMs = options.timeoutMs ?? 8000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) {
    throw new ShopifyError("Invalid Shopify request deadline");
  }
  const controller = new AbortController();
  const caller = options.signal;
  const abortReason = () => caller?.reason ?? new DOMException("Request aborted", "AbortError");
  if (caller?.aborted) throw abortReason();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    onAbort = () => {
      const reason = abortReason();
      reject(reason);
      controller.abort(reason);
    };
    caller?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      const reason = new ShopifyError("Shopify request timed out", { code: "SHOPIFY_TIMEOUT", timeout_ms: timeoutMs });
      reject(reason);
      controller.abort(reason);
    }, timeoutMs);
  });
  try {
    return await Promise.race([shopifyExchange<T>(env, graphql, variables, controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
    if (onAbort) caller?.removeEventListener("abort", onAbort);
  }
}

async function shopifyExchange<T>(
  env: Env,
  graphql: string,
  variables: Record<string, unknown>,
  signal: AbortSignal
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
    signal,
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
