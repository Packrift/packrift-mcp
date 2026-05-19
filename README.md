# Packrift MCP Server

Production MCP (Model Context Protocol) server for Packrift exact-spec packaging procurement. Hero use case: find the right packaging supply for a given item, SKU, or reorder need, then confirm live price, inventory, shipping, and cart handoff.

- **Stack**: Cloudflare Workers, TypeScript (strict), Hono, Zod, Streamable HTTP transport
- **Backing**: Shopify Admin GraphQL API (`2025-04`), store `packrift.myshopify.com`
- **Endpoint**: `POST /mcp`, `GET /mcp` (SSE), `GET /` and `GET /start` (MCP start page), `GET /.well-known/mcp/server-card.json`
- **Install guide**: see [`llms-install.md`](llms-install.md) for remote MCP client configuration.
- **Discovery gate**: product lookup, reorder, quote, and cart handoff flows are constrained to AI-approved Packrift catalog records where SKU selection is involved.

## Remote MCP client setup

The public Packrift endpoint is hosted at:

```text
https://mcp.packrift.com/mcp
```

Fast start page for developers, agents, and directory reviewers:

```text
https://mcp.packrift.com/start
```

Directory and partner handoffs can use tracked start links without changing the MCP endpoint. Use a lowercase source slug with letters, numbers, and underscores:

```text
https://mcp.packrift.com/r/start/{source}
```

The start page also renders source-specific copy controls when it receives a source:

```text
https://mcp.packrift.com/start?utm_source={source}
```

Those copy controls record aggregate `mcp_install_copy` telemetry by source and target so partner and directory handoffs can be evaluated before downstream cart events appear.

Custom partner, campaign, directory, and agent-workflow slugs are allowed without code changes as long as they match `^[a-z0-9_]{2,64}$`. Examples: `mcpservers_org`, `agency_partner`, `browser_agent_demo`, `newsletter_mcp`.

When a directory or agent host wants a source-attributed config file instead of an HTML start page, use:

```text
https://mcp.packrift.com/r/config/{source}
```

MCP clients that support remote HTTP or Streamable HTTP servers can add Packrift with:

```json
{
  "mcpServers": {
    "packrift": {
      "type": "http",
      "url": "https://mcp.packrift.com/mcp"
    }
  }
}
```

## Hosted connector and directory listings

Use the hosted endpoint above when possible. It requires no buyer-side API key and exposes the current 15-tool Packrift exact-spec commerce surface.

- Glama hosted connector: https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp
- MCP Marketplace listing: https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp
- Official MCP Registry search: https://registry.modelcontextprotocol.io/v0/servers?search=Packrift
- Claude connector submission packet: https://mcp.packrift.com/ai/claude-connector-submission.json
- Source repository: https://github.com/Packrift/packrift-mcp
- Direct Streamable HTTP endpoint: https://mcp.packrift.com/mcp

## Container Image

The public hosted endpoint above is the primary integration path and the
canonical `server.json` manifest is remote-only. A container image is still
published for local development and environments that explicitly require a
self-hosted package-style install surface:

```sh
docker pull ghcr.io/packrift/packrift-mcp:latest
docker run --rm -p 8787:8787 \
  -e SHOPIFY_PACKRIFT_TOKEN=... \
  ghcr.io/packrift/packrift-mcp:latest
```

You can also build the image from this repository:

```sh
docker build -t packrift-mcp .
docker run --rm -p 8787:8787 \
  -e SHOPIFY_PACKRIFT_TOKEN=... \
  packrift-mcp
```

Optional environment variables:

- `PORT` defaults to `8787`
- `SHOPIFY_STORE_DOMAIN` defaults to `packrift.myshopify.com`
- `SHOPIFY_API_VERSION` defaults to `2025-04`
- `STOREFRONT_DOMAIN` defaults to `packrift.com`
- `SHOPIFY_PACKRIFT_TOKEN` is optional for MCP introspection and directory scanning, but required when self-hosting live Shopify-backed catalog, pricing, inventory, shipping, and cart tools

The container uses an in-memory cache instead of Cloudflare KV. It is intended
for discovery and client testing; the production server remains the Cloudflare
Workers endpoint at `https://mcp.packrift.com/mcp`.

## AI Discovery Surfaces

- `llms.txt`: https://mcp.packrift.com/llms.txt
- `llms-full.txt`: https://mcp.packrift.com/llms-full.txt
- MCP server card: https://mcp.packrift.com/.well-known/mcp/server-card.json
- MCP client config: https://mcp.packrift.com/ai/mcp-client-config.json
- Root MCP JSON config: https://mcp.packrift.com/mcp.json
- Well-known MCP JSON config: https://mcp.packrift.com/.well-known/mcp.json
- Glama connector claim: https://mcp.packrift.com/.well-known/glama.json
- MCP Marketplace manifest: https://mcp.packrift.com/.well-known/mcp-marketplace.json
- AI corpus sitemap: https://mcp.packrift.com/ai/sitemap.xml
- All-agent capture matrix: https://mcp.packrift.com/ai/all-agent-capture.json
- All-agent capture matrix Markdown: https://mcp.packrift.com/ai/all-agent-capture.md
- MCP tracked start template: https://mcp.packrift.com/r/start/{source}
- MCP tracked config template: https://mcp.packrift.com/r/config/{source}
- MCP tracked start source format: `^[a-z0-9_]{2,64}$`; partner-specific slugs are allowed without pre-registration
- MCP start pack: https://mcp.packrift.com/ai/mcp-start.json
- MCP start pack Markdown: https://mcp.packrift.com/ai/mcp-start.md
- MCP adoption kit: https://mcp.packrift.com/ai/mcp-adoption-kit.json
- MCP adoption kit Markdown: https://mcp.packrift.com/ai/mcp-adoption-kit.md
- MCP install matrix: https://mcp.packrift.com/ai/mcp-install-matrix.json
- MCP install matrix Markdown: https://mcp.packrift.com/ai/mcp-install-matrix.md
- MCP client config Markdown: https://mcp.packrift.com/ai/mcp-client-config.md
- MCP usage snapshot: https://mcp.packrift.com/ai/mcp-usage-snapshot.json
- MCP usage snapshot Markdown: https://mcp.packrift.com/ai/mcp-usage-snapshot.md
- MCP buyer use cases: https://mcp.packrift.com/ai/mcp-buyer-use-cases.json
- MCP buyer use cases Markdown: https://mcp.packrift.com/ai/mcp-buyer-use-cases.md
- MCP cart activation: https://mcp.packrift.com/ai/mcp-cart-activation.json
- MCP cart activation Markdown: https://mcp.packrift.com/ai/mcp-cart-activation.md
- MCP first-run proof: https://mcp.packrift.com/ai/mcp-first-run-proof.json
- MCP first-run proof Markdown: https://mcp.packrift.com/ai/mcp-first-run-proof.md
- MCP workflow gallery: https://mcp.packrift.com/ai/mcp-workflow-gallery.json
- MCP workflow gallery Markdown: https://mcp.packrift.com/ai/mcp-workflow-gallery.md
- Browser-agent bridge: https://mcp.packrift.com/ai/browser-agent-bridge.json
- Browser-agent bridge Markdown: https://mcp.packrift.com/ai/browser-agent-bridge.md
- Root Browserbase/Browse SKILL.md: https://mcp.packrift.com/SKILL.md
- Browserbase Browse skill pack: https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json
- Browserbase Browse skill pack Markdown: https://mcp.packrift.com/ai/browserbase-browse-skill-pack.md
- Canonical Browserbase/Browse SKILL.md: https://mcp.packrift.com/ai/browserbase-browse/SKILL.md
- MCP directory refresh pack: https://mcp.packrift.com/ai/mcp-directory-refresh.json
- MCP directory refresh pack Markdown: https://mcp.packrift.com/ai/mcp-directory-refresh.md
- MCP directory submit actions: https://mcp.packrift.com/ai/mcp-directory-submit-actions.json
- MCP directory submit actions Markdown: https://mcp.packrift.com/ai/mcp-directory-submit-actions.md
- AI-approved product JSONL: https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl
- AI purchase paths JSONL: https://mcp.packrift.com/ai/purchase-paths.jsonl
- MCP cart handoff candidates: https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json
- Measured handoff directory: https://mcp.packrift.com/ai/measured-handoffs.json
- Measured cart landing example: https://mcp.packrift.com/r/cart/1066
- Reorder by SKU corpus: https://mcp.packrift.com/ai/reorder-by-sku.md
- Top 1,000 AI-sales SKU sitemap: https://mcp.packrift.com/ai/top-1000-ai-sales-sitemap.xml
- All AI-approved SKU sitemap: https://mcp.packrift.com/ai/all-ai-approved-sku-sitemap.xml
- OpenAI-shaped strict product TSV: https://mcp.packrift.com/ai/packrift-openai-products-strict-stable-current.tsv
- Shopify native UCP guide: https://mcp.packrift.com/ai/shopify-native-ucp-commerce-surface.md
- Example SKU markdown page: https://mcp.packrift.com/ai/sku/1066.md
- Example SKU JSON record: https://mcp.packrift.com/ai/sku/1066.json

## Tools

Tools are framed around exact-spec procurement, not generic browsing. Use `find_packaging_for_item` when the buyer has item dimensions or a fit question; use SKU and exact-spec tools when the buyer is replenishing a known product.

| Tool | Purpose |
|---|---|
| `find_packaging_for_item(dims, weight, use_case)` | Hero. Item L/W/D + weight + use case -> ranked packaging SKUs that fit. Use for smallest-fit, box-vs-mailer, and Uline-by-size style questions. |
| `search_products(query, limit?)` | Keyword fallback when dimensions are unknown, such as kraft tape, bubble mailer, starter kit, or weather-resistant labels. Cached 5 min in KV. |
| `get_product(handle)` | Full product detail including variants, dimensions/metafields, weight, stock, and product URL. |
| `get_pricing(variant_ids[], quantity?)` | Live unit price and line total before purchase handoff. Never cached. |
| `check_inventory(variant_ids[])` | Live inventory check before recommending or building a cart. Never cached. |
| `get_shipping_estimate(zip, country, items[])` | Carrier rates for a chosen cart via Shopify `draftOrderCalculate`. |
| `get_cart_handoff_candidates(limit?, family?, sku?)` | Priority AI-approved SKUs with ready `create_cart_url` arguments, measured SKU/product/reorder/quote/cart links, and required live-confirmation sequence. |
| `create_cart_url(items[], discount_code?, ref?)` | Final cart handoff. Builds a GA4-visible Packrift cart landing URL plus the final `packrift.com/cart/...` permalink with `ref=mcp` and AI-commerce attribution fields. |
| `prepare_purchase_handoff(sku, quantity?, buyer_confirmed?)` | Fast exact-SKU path. Confirms the AI_APPROVE product, live price, and inventory, then returns a measured MCP cart URL only when `buyer_confirmed=true`. |
| `compare_alternatives(requested_spec, family?, competitor_reference?, limit?)` | Ranks AI-approved Packrift alternatives for open-ended buyer requests, including competitor-style packaging specs. |
| `pack_calculator(item, padding?, use_case?, limit?)` | Calculates protected inside dimensions and returns fitted box or mailer candidates with void-fill guidance. |
| `inventory_status(variant_ids?, sku?, handle?, quantity?)` | Live total and location-level Shopify inventory status for exact SKUs, handles, or variant IDs. |
| `get_reorder_link(sku, handle?)` | Reorder URL, product URL, and copy-procurement-spec text for an AI-approved SKU or handle. |
| `get_bulk_quote_link(requested_spec, family?, sku?, quantity?)` | Tracked bulk quote URL for no-exact-match, large-volume, or procurement-review workflows. |
| `explain_no_exact_match(requested_spec, missing_or_mismatched_fields?)` | Explains why a nearby product should not be presented as exact, then routes to safe next actions and quote recovery. |

## MCP Prompts And Resources

The server advertises prompts and resources in addition to tools.

Prompts:

- `find_exact_packaging_spec`
- `fit_item_then_prepare_cart`
- `review_cart_handoff_candidates`
- `reorder_packrift_sku`
- `prepare_cart_handoff`
- `request_bulk_quote_for_no_match`
- `copy_procurement_spec`
- `find_box_by_lwh`
- `find_label_by_size_material_printer`

Resources include the AI-approved product corpus, per-SKU markdown/JSON records, purchase-path JSONL, MCP cart handoff candidates, MCP cart activation playbook, measured handoff directories with cart routes, exact-spec family files, no-exact-match policy, crawler-safe purchase paths, and the Shopify-native UCP commerce surface.

## Exact-spec AI-commerce examples

Packrift is optimized for exact-spec packaging procurement: agents should not treat nearby sizes, materials, colors, adhesives, strength ratings, or case counts as exact substitutes. If there is no exact AI-approved match, route the buyer to reorder, no-match explanation, or bulk quote recovery instead of forcing a substitute.

Current paid ChatGPT / product-card order families that are represented in the public corpus:

- SKU `1066`: 10 x 6 x 6 ECT-32 kraft corrugated boxes, 25/bundle
- SKU `MFL1295`: 12 1/8 x 9 1/4 x 5 white self-seal literature mailers, 50/pack
- SKU `LL251WR`: 2 5/8 x 1 weather-resistant polyester laser labels, 3000/case

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

Smoke-test the hosted cart handoff path without creating an order or collecting
payment:

```sh
npm run smoke:cart-handoff
```

This synthetic check calls the current hosted MCP endpoint, verifies
`get_cart_handoff_candidates -> get_product -> get_pricing -> check_inventory ->
create_cart_url`, and checks the MCP cart landing route. It writes JSON and
Markdown evidence under `outputs/mcp-cart-handoff-smoke/`. Add
`-- --sku LL251WR --qty 1` to test another AI-approved SKU. Use
`-- --verify-final-cart` only when intentionally checking Shopify's final cart
redirect.

GitHub Actions also runs the hosted smoke checks every six hours and on manual
dispatch through `.github/workflows/mcp-live-smoke.yml`. The scheduled job
checks both `1066` and `LL251WR`, then uploads smoke and capture evidence
artifacts. Run `npm run check:distribution` for the broader directory and
registry monitor; it exits nonzero only when a tracked surface has a true
`fail` status.

Refresh the `llms-full.txt` priority SKU block from recent GA4 item activity joined to the AI-approved catalog and live Shopify inventory:

```sh
npm run build:llms-full -- \
  --ga4-items /path/to/packrift-ga4-items.csv \
  --approved-jsonl /path/to/packrift-ai-approved-products.jsonl \
  --limit 20
```

The generated public block must not include local paths, internal notes, or non-public campaign details. A private JSON report is written under `outputs/llms-full-priority-skus/`.

To run the whole refresh path, pull fresh GA4 reports, publish the public `llms-full.txt` override into Workers KV, purge the public agent URLs, and verify the live surfaces:

```sh
npm run refresh:llms-full -- --publish-kv
```

This updates the `static-override:llms-full.txt` KV key. The Worker serves that override after the current deploy, so future priority-SKU refreshes do not require deploying unrelated Worker source changes.

Check crawler-facing `llms-full.txt` availability across six AI user agents:

```sh
npm run check:static-availability -- --samples-per-ua 200 --concurrency 30
```

This writes JSON and Markdown evidence under `outputs/static-availability/`. The funnel snapshot also runs this check and reports failure rate, 5xx rate, content validation, and p95 latency.

Refresh the full MCP funnel proof, including first-party Shopify order stitching
for MCP cart attributes:

```sh
npm run snapshot:funnel
```

The snapshot reads the token-protected `https://mcp.packrift.com/admin/mcp-orders`
endpoint, scans recent Shopify orders for MCP cart attributes such as
`packrift_mcp_key`, `packrift_ai_id`, and `utm_source=chatgpt-mcp`, and reports
attributed order count and revenue beside GA4 cart-landing evidence. The admin
endpoint requires `MCP_STATS_TOKEN` and does not expose customer PII.

Refresh MCP directory evidence:

```sh
npm run check:distribution
npm run build:directory-submission-pack
```

The distribution check reports which public MCP directories are current, stale, blocked, or failing. The submission pack turns stale rows into copy-ready listing fields, live proof URLs, and the next refresh action for each directory.

Check the all-agent capture hub:

```sh
npm run check:agent-capture
npm run build:agent-capture-outreach
```

This verifies that `https://mcp.packrift.com/ai/all-agent-capture.json` and
`.md`, `https://mcp.packrift.com/ai/mcp-adoption-kit.json` and `.md`,
`https://mcp.packrift.com/ai/mcp-install-matrix.json` and `.md`,
`https://mcp.packrift.com/ai/mcp-usage-snapshot.json` and `.md`, and
`https://mcp.packrift.com/ai/mcp-buyer-use-cases.json` and `.md`, and
`https://mcp.packrift.com/ai/mcp-cart-activation.json` and `.md`, and
`https://mcp.packrift.com/ai/browser-agent-bridge.json` and `.md`, and
`https://mcp.packrift.com/SKILL.md`, and
`https://mcp.packrift.com/ai/mcp-directory-refresh.json` and `.md`, and
`https://mcp.packrift.com/ai/mcp-directory-submit-actions.json` and `.md` are live,
advertised in `resources/list`, include the core agent surfaces,
first-five-minute install/test path, copy-paste developer examples, copy-ready install matrix, public usage snapshot,
buyer workflow map, cart activation playbook, browser-agent bridge, directory refresh pack, directory submit-action queue,
Browserbase Browse candidate lane, and root SKILL.md, and preserve the
rule that Packrift uses the hosted MCP endpoint instead of a duplicate CLI surface. The outreach build writes
copy-ready stale-directory refresh messages, Browserbase Browse candidate
briefs, proof links, and MCP install snippets under
`outputs/agent-capture-outreach/`.

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
    exploration_tools.ts
    procurement_links.ts
wrangler.toml                    Worker config (KV binding, vars, route)
package.json
tsconfig.json
.dev.vars                        Local-only secrets (gitignored)
```

## AI Sales SKU Discovery Pages

Packrift publishes AI-commerce SKU pages for exact-spec procurement agents.

- Top 1,000 AI SKU sitemap: https://mcp.packrift.com/ai/top-1000-ai-sales-sitemap.xml
- SKU markdown template: https://mcp.packrift.com/ai/sku/1066.md
- SKU JSON template: https://mcp.packrift.com/ai/sku/1066.json
- Reorder corpus: https://mcp.packrift.com/ai/reorder-by-sku.md
- AI-approved product JSONL: https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl

Each SKU page links to the canonical Packrift product page, reorder path, bulk quote path, MCP endpoint, and no-exact-match policy. Use these pages only for AI-approved products and confirm live price and inventory through the MCP tools before checkout handoff.
