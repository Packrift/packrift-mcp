# Packrift MCP Server

Production MCP (Model Context Protocol) server for Packrift, a Shopify packaging-supplies store. Lets AI agents search the catalog, get live pricing and inventory, recommend a box for an item, estimate shipping, and produce checkout URLs.

- **Stack**: Cloudflare Workers, TypeScript (strict), Hono, Zod, Streamable HTTP transport
- **Backing**: Shopify Admin GraphQL API (`2025-04`), store `packrift.myshopify.com`
- **Endpoint**: `POST /mcp`, `GET /mcp` (SSE), `GET /` (health), `GET /.well-known/mcp/server-card.json`

## Tools

| Tool | Purpose |
|---|---|
| `search_products(query, limit?)` | Keyword search across the catalog. Cached 5 min in KV. |
| `get_product(handle)` | Full product detail incl. variants, dimensions metafield, weight. |
| `get_pricing(variant_ids[], quantity?)` | Live unit price + line total. Never cached. |
| `check_inventory(variant_ids[])` | Live inventory count. Never cached. |
| `recommend_packaging(dims, weight, use_case)` | Up to 5 ranked variant suggestions with 0.5–2 in padding. |
| `get_shipping_estimate(zip, country, items[])` | Carrier rates via Shopify `draftOrderCalculate`. |
| `create_cart_url(items[], discount_code?, ref?)` | Builds `packrift.com/cart/...?ref=mcp[&discount=...]`. |

## Local development

Install Node 24+ and the deps:

```sh
cd ~/Downloads/packrift-mcp-server
npm install
```

Local secrets — already created at `.dev.vars` (gitignored):

```
SHOPIFY_PACKRIFT_TOKEN=shpat_...
```

Run the server:

```sh
npx wrangler dev --port 8787 --local
```

Smoke-test the MCP endpoint with curl:

```sh
# initialize
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# list tools
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# search
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_products","arguments":{"query":"poly mailer","limit":3}}}'
```

Type-check:

```sh
npx tsc --noEmit
```

## Deployment

The Cloudflare account is being created in a separate process. Once it's ready and `wrangler` is logged in (`wrangler login`), run these in order:

```sh
cd ~/Downloads/packrift-mcp-server

# 1. Create the KV namespace and copy the printed id into wrangler.toml
#    (replace both `id` and `preview_id` with the same value).
npx wrangler kv namespace create CATALOG_CACHE

# 2. Set the Shopify Admin token as a secret (paste shpat_... when prompted).
npx wrangler secret put SHOPIFY_PACKRIFT_TOKEN

# 3. Deploy. Initial deploy puts the worker on
#    https://packrift-mcp.<account>.workers.dev
npx wrangler deploy

# 4. (Once mcp.packrift.com is CNAME'd to the worker) uncomment the [[routes]]
#    block in wrangler.toml and redeploy.
npx wrangler deploy
```

After deploy, the MCP endpoint is `https://packrift-mcp.<account>.workers.dev/mcp` (and later `https://mcp.packrift.com/mcp`). The server card lives at `/.well-known/mcp/server-card.json`.

## Design notes / caveats

- **`cartCreate` is a Storefront API mutation, not Admin.** The brief asked for `cartCreate` + `cartBuyerIdentityUpdate` for shipping rates, but those don't exist on the Admin GraphQL API this server uses. The supported Admin path is `draftOrderCalculate`, which is what `get_shipping_estimate` uses. It returns the same carrier-rate data without creating a real order.
- **Dimensions parsing.** Packrift product dimensions live in `custom.specN_value` metafields where the matching `custom.specN_name` says "Dimensions" or "Size". Format is human-readable (`12 1/8" L x 11 5/8" W x 2 5/8" H`). `src/dimensions.ts` parses mixed fractions and falls back to scanning the title.
- **Recommend collections.** The brief mentioned `mailer-boxes` collection — that handle does not exist on the live store. We use `mailers-envelopes`, `boxes-mailers`, `corrugated-boxes`, `bubble-wrap-foam`, `cushioning`, and `ecommerce-fulfillment` (verified via `collections` query 2026-04-29).
- **Use case mapping** is in `src/tools/recommend_packaging.ts` (`COLLECTIONS_BY_USE_CASE`).
- **Shipping rate `handle`** in the response is a long opaque JWT-style string — that's how Shopify returns rate handles; pass it through to subsequent calls if needed.
- **Errors**: tool exceptions are returned as `{ content: [...], isError: true }` per the MCP spec, not as JSON-RPC `-3260x` errors. Protocol-level errors (unknown tool, bad JSON) do return JSON-RPC errors.

## File map

```
src/
  index.ts                       Hono app + MCP JSON-RPC dispatcher
  shopify.ts                     Admin GraphQL client + id helpers
  dimensions.ts                  Spec-string -> structured dimensions
  server-card.ts                 /.well-known card
  tools/
    search_products.ts
    get_product.ts
    get_pricing.ts
    check_inventory.ts
    recommend_packaging.ts
    get_shipping_estimate.ts
    create_cart_url.ts
wrangler.toml                    Worker config (KV binding, vars, route)
package.json
tsconfig.json
.dev.vars                        Local-only secrets (gitignored)
```
