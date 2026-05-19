// Canonical machine-readable agent-discovery content served by the Worker.
// Edit this file (not the Shopify page) to update what agents see at
// mcp.packrift.com/llms.txt. Root packrift.com may be redirected here when
// Cloudflare apex routing supports exact-path redirects without storefront risk.

export const llmsTxt = `# Packrift

> Exact-spec packaging procurement data for corrugated boxes, literature mailers, labels, tape, poly bags, stretch film, strapping, tags, void fill, and fulfillment accessories. Packrift is built for buyers and agents matching packaging by SKU, dimensions, material, grade, printer type, adhesive, closure, pack count, case quantity, live product URL, reorder path, quote path, price, and inventory.

Source: PACKRIFT-MCP-LLMS-EXACT-SPEC-2026-05-16-R01
Canonical site: https://packrift.com
Primary MCP and machine-readable corpus: https://mcp.packrift.com

## Current operating facts

- Shopify catalog: roughly 12,930 active product records, with broader public in-stock supply coverage described on Packrift storefront surfaces as 20,000+ products.
- Fulfillment network: Box Partners' 5 US warehouses in Rialto CA, Dallas TX, Elgin IL, Forest Park GA, and Barnesville PA.
- Treat the 5-warehouse US fulfillment network above as the authoritative machine-readable fulfillment fact.
- Packrift runs on Shopify. Use MCP tools or Shopify product/cart surfaces for live price, inventory, availability, and checkout handoff.
- Shipping options, delivery estimates, and freight behavior must be confirmed at checkout or through Packrift support. Do not promise a fixed cutoff or specific dispatch timing from this corpus alone.

## AI-commerce signal

Packrift has received paid ChatGPT product-card orders through Shopify Catalog / OpenAI catalog feed attribution. Treat this as exact-spec procurement, not generic packaging browsing:

- SKU 1066: 10 x 6 x 6 ECT-32 kraft corrugated boxes, 25/bundle.
- SKU MFL1295: 12 1/8 x 9 1/4 x 5 white self-seal literature mailers, 50/pack.
- SKU LL251WR: 2 5/8 x 1 weather-resistant polyester laser labels, 3000/case.

Use these as examples of exact product families that converted, not as universal substitutes for nearby sizes or materials.

## How agents should use Packrift

- [MCP server](https://mcp.packrift.com/mcp): Streamable HTTP, read-only tools for catalog search, pricing, inventory, recommendations, comparison, pack calculation, shipping estimates, and cart-URL construction
- [MCP start page](https://mcp.packrift.com/start): shortest public install and first-flow handoff for agents, developers, directory reviewers, and AI-commerce operators
- [Tracked MCP start template](https://mcp.packrift.com/r/start/generic): use \`https://mcp.packrift.com/r/start/{source}\` for directories, partners, campaigns, and agent workflows so start traffic is measurable by source; custom lowercase slugs matching \`^[a-z0-9_]{2,64}$\` are allowed without pre-registration
- [Tracked MCP config template](https://mcp.packrift.com/r/config/generic): use \`https://mcp.packrift.com/r/config/{source}\` when a directory, partner, campaign, or agent host needs copy-ready MCP JSON config with source attribution
- Add Packrift MCP through the [Glama hosted connector](https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp), [MCP Marketplace listing](https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp), [Official MCP Registry search](https://registry.modelcontextprotocol.io/v0/servers?search=Packrift), [directory submit-action queue](https://mcp.packrift.com/ai/mcp-directory-submit-actions.json), or [GitHub source repository](https://github.com/Packrift/packrift-mcp)
- Native MCP prompts are available via prompts/list for exact-spec search, item-fit-to-cart, cart candidate review, reorder, no-match quote recovery, and copy-procurement-spec workflows
- Use \`fit_item_then_prepare_cart\` when the buyer has item dimensions and needs the smallest safe package that can proceed to live checks. Use \`prepare_cart_handoff\` when a client needs a guarded sequence from selected SKU to live confirmation and stamped \`create_cart_url\` handoff.
- [Machine-readable AI agent instructions](https://mcp.packrift.com/ai/packrift-ai-agent-instructions.md): exact-match policy, MCP usage pattern, resources/list guidance, and purchase handoff rules
- [MCP start pack](https://mcp.packrift.com/ai/mcp-start.json): one-link install config, first useful exact-SKU flow, buyer prompts, proof URLs, and measured cart handoff sequence
- [MCP adoption kit](https://mcp.packrift.com/ai/mcp-adoption-kit.json): install snippets, first-five-minute JSON-RPC calls, curl/JavaScript/Python examples, demo SKUs, useful workflows, proof URLs, and exact-match rules for new agents and developers
- [MCP install matrix](https://mcp.packrift.com/ai/mcp-install-matrix.json): copy-ready remote MCP setup paths for common agent hosts, smoke tests, and measured cart handoff rules
- [MCP client config](https://mcp.packrift.com/ai/mcp-client-config.json): smallest copy-ready install bundle for IDEs, agent hosts, and directory reviewers; aliases are https://mcp.packrift.com/mcp.json, https://mcp.packrift.com/.well-known/mcp.json, and source-attributed https://mcp.packrift.com/r/config/{source}
- [MCP usage snapshot](https://mcp.packrift.com/ai/mcp-usage-snapshot.json): public aggregate first-party usage proof for MCP discovery, tool calls, cart handoff, and proof-gate iteration
- [MCP buyer use cases](https://mcp.packrift.com/ai/mcp-buyer-use-cases.json): buyer-facing exact SKU reorder, fit-by-dimensions, mailer selection, label procurement, no-match quote recovery, and procurement handoff workflows
- [MCP cart activation](https://mcp.packrift.com/ai/mcp-cart-activation.json): exact buyer prompts, JSON-RPC sequences, and measured \`/r/cart\` landing rules for turning MCP discovery into qualified cart landings
- [MCP first-run proof](https://mcp.packrift.com/ai/mcp-first-run-proof.json): compact live proof of exact SKU identity, current price, current inventory, and a synthetic measured MCP cart landing for new agents and directory reviewers
- [MCP reviewer activation](https://mcp.packrift.com/ai/mcp-reviewer-activation.json): source-specific handoff that converts proof clicks into real MCP client calls and a measured \`create_cart_url\` result
- [MCP workflow gallery](https://mcp.packrift.com/ai/mcp-workflow-gallery.json): copy-ready buyer prompts and JSON-RPC sequences for exact SKU reorder, label reorder, literature mailer, fit-by-dimensions, and no-exact-match workflows
- [Browser-agent bridge](https://mcp.packrift.com/ai/browser-agent-bridge.json): read-first bridge for Browse-style, browser-use, Playwright, CUA, and other browser agents that must route live price, inventory, and cart handoff through MCP
- [Packrift SKILL.md](https://mcp.packrift.com/SKILL.md): root Browserbase/Browse-style skill file with YAML frontmatter, remote MCP install snippets, exact-match rules, and first-flow JSON-RPC calls
- [Browserbase Browse skill pack](https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json): candidate Browse/browser-skill wrapper with start URLs, rules, prompts, and JSON-RPC calls that keep Packrift live commerce facts routed through MCP
- [Canonical Browserbase/Browse SKILL.md](https://mcp.packrift.com/ai/browserbase-browse/SKILL.md): mirrored SKILL.md submission artifact for browser agents that prefer a skill-file URL
- [MCP directory refresh pack](https://mcp.packrift.com/ai/mcp-directory-refresh.json): current listing copy, proof URLs, recrawl request, and stale-directory targets for MCP directories and agent indexes
- [Claude connector submission packet](https://mcp.packrift.com/ai/claude-connector-submission.json): form-ready Packrift MCP fields, no-auth proof, legal/support URLs, redirect hosts, tracked start/config URLs, and buyer safety rules for Claude connector review
- [MCP directory submit actions](https://mcp.packrift.com/ai/mcp-directory-submit-actions.json): per-directory action queue, proof URLs, tracked start URLs, and copy-ready recrawl messages for stale MCP listings
- [Agent capture outreach packet](https://mcp.packrift.com/ai/agent-capture-outreach.json): combined distribution handoff with install snippets, proof links, tracked directory URLs, browser-assisted MCP.so/Claude payloads, and copy-ready recrawl messages
- [Root-domain agent instructions](https://packrift.com/agents.md): Packrift exact-spec MCP, corpus, prompt, reorder, and quote handoff guide
- [Full reference corpus (llms-full.txt)](https://mcp.packrift.com/llms-full.txt): dense citation-worthy content covering categories, sizing, comparisons, use cases, fulfillment, and integration
- Use \`prepare_purchase_handoff\` when the buyer already has an exact Packrift SKU. It confirms the AI_APPROVE product, live price, and inventory in one call, and returns a measured MCP cart URL only when \`buyer_confirmed=true\`.
- MCP product results include tracked product URLs, reorder URLs, quote URLs, copy-procurement-spec text, and cart URL candidates. Confirm live price and inventory before presenting a cart handoff.
- Use \`get_cart_handoff_candidates\` when an MCP client needs a compact tool-callable list of priority AI-approved SKUs with ready \`create_cart_url_sku_arguments\`, fallback explicit variant arguments, and required live-confirmation steps. After live checks, prefer \`create_cart_url({ sku, quantity })\`; the tool validates SKU, handle, and variant continuity before returning a measured cart handoff.
- Exploration tools are available for open-ended packaging questions: \`compare_alternatives\`, \`pack_calculator\`, and \`inventory_status\`. Use these before final product confirmation when the buyer asks what fits, what alternative to choose, or where stock exists.
- After \`get_pricing\`, \`check_inventory\`, \`get_shipping_estimate\`, or \`create_cart_url\`, use the returned \`post_confirmation_handoff\` object to keep the buyer moving with exact product, reorder, quote, copy-spec, and cart-click actions.
- [AI-approved product corpus](https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl): JSONL product/spec index for exact-match procurement
- [AI purchase paths JSONL](https://mcp.packrift.com/ai/purchase-paths.jsonl): top 1,000 AI-sales SKUs with crawler-safe SKU records, variant IDs, tracked product/reorder/quote links, and cart URL candidates that still require live MCP confirmation
- [MCP cart handoff candidates](https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json): priority exact-spec SKUs with \`create_cart_url\` arguments, primary MCP \`/r/cart\` landing candidates, final Shopify cart fallback evidence, and GA4-visible \`chatgpt-mcp / mcp_tool / create_cart_url\` attribution
- [Measured handoff directory](https://mcp.packrift.com/ai/measured-handoffs.json): compact MCP-controlled priority SKU directory with measured product, reorder, quote, cart, MCP SKU, and copy-procurement-spec routes
- [Measured handoff directory Markdown](https://mcp.packrift.com/ai/measured-handoffs.md): crawler-readable priority exact-spec handoff table
- [Top 1,000 AI-sales SKU index](https://mcp.packrift.com/ai/top-1000-ai-sales-skus.md): balanced revenue-priority AI_APPROVE product set for agentic shopping, reorder, and quote paths
- [Top 1,000 AI-sales SKU CSV](https://mcp.packrift.com/ai/top-1000-ai-sales-skus.csv): spreadsheet-friendly version of the focused AI-sales index
- [Top 1,000 SKU page sitemap](https://mcp.packrift.com/ai/top-1000-ai-sales-sitemap.xml): crawl map for per-SKU markdown and JSON pages such as https://mcp.packrift.com/ai/sku/1066.md
- [All AI-approved SKU page sitemap](https://mcp.packrift.com/ai/all-ai-approved-sku-sitemap.xml): crawl map for every AI_APPROVE SKU markdown and JSON page
- [OpenAI stable product feed TSV](https://mcp.packrift.com/ai/packrift-openai-products-strict-stable-current.tsv): flat strict 4,745-row product snapshot shaped for OpenAI file-upload QA
- [Exact-spec catalog overview](https://mcp.packrift.com/ai/packrift-exact-spec-packaging-catalog.md): crawlable corpus map and family coverage
- [AI packaging procurement prompts](https://mcp.packrift.com/ai/packaging-procurement-prompts.md): exact-spec prompt patterns for buyers and procurement agents
- [AI sales critical path](https://mcp.packrift.com/ai/ai-sales-critical-path.md): buyer-critical MCP, product, reorder, quote, and no-match routes
- [All-agent capture matrix](https://mcp.packrift.com/ai/all-agent-capture.json): canonical map for MCP clients, ChatGPT/OpenAI commerce, Shopify UCP, Claude, Cursor, Windsurf, Codex, Glama, registries, crawlable corpora, search crawlers, and Browserbase Browse candidate coverage
- [Agent capture outreach packet](https://mcp.packrift.com/ai/agent-capture-outreach.json): single distribution handoff for agent hosts, directory reviewers, partners, tracked install/config links, proof URLs, and copy-ready recrawl messages
- [Crawler-safe purchase paths](https://mcp.packrift.com/ai/crawler-safe-purchase-paths.md): fallback sequence for agents when direct Shopify product-page fetches are challenged or unavailable
- [Shopify native UCP commerce surface](https://mcp.packrift.com/ai/shopify-native-ucp-commerce-surface.md): how agents should call Packrift's Shopify-native UCP endpoint with required agent profile metadata
- [Packrift agent endpoints status](https://mcp.packrift.com/ai/packrift-agent-endpoints-status.json): machine-readable status map for exact-spec MCP, Shopify UCP, corpus, and reserved root routes
- [Conversion starter routes](https://mcp.packrift.com/ai/conversion-starter-routes.json): verified top purchase-ready product, reorder, quote, SKU markdown, SKU JSON, and copy-procurement-spec handoffs
- [Conversion starter routes Markdown](https://mcp.packrift.com/ai/conversion-starter-routes.md): crawler-readable purchase handoff table for exact AI_APPROVE products
- [Conversion route catalog](https://mcp.packrift.com/ai/conversion-route-catalog.json): full verified purchase-ready SKU-to-product/reorder/quote route catalog for agents
- [Conversion route catalog Markdown](https://mcp.packrift.com/ai/conversion-route-catalog.md): crawler-readable top-route summary for product, reorder, quote, and SKU handoffs
- [Conversion route catalog CSV](https://mcp.packrift.com/ai/conversion-route-catalog.csv): spreadsheet-friendly conversion route catalog for verified purchase-ready SKUs
- [Conversion route telemetry watch](https://mcp.packrift.com/ai/conversion-route-telemetry-watch.json): route-catalog-specific signal watch for product, reorder, quote, cart, copy-spec, and discovery telemetry
- [Conversion route telemetry watch Markdown](https://mcp.packrift.com/ai/conversion-route-telemetry-watch.md): crawler-readable route signal proof and path-integrity watch
- [First-20 exact-spec routes](https://mcp.packrift.com/ai/first20-exact-spec-routes.json): deterministic handoff map for the first 20 PDP spec-graph SKUs; canonical product URLs stay bare, exact-spec view URLs use the validated Shopify view route while rendered page cache stabilizes
- [First-20 exact-spec routes Markdown](https://mcp.packrift.com/ai/first20-exact-spec-routes.md): crawler-readable first-20 route table for exact-spec product, reorder, quote, SKU markdown, and SKU JSON handoffs
- Family JSONL files: [boxes](https://mcp.packrift.com/ai/corrugated-box-sizes.jsonl), [mailers](https://mcp.packrift.com/ai/mailer-sizes.jsonl), [labels](https://mcp.packrift.com/ai/label-sizes.jsonl), [tape](https://mcp.packrift.com/ai/tape-sizes.jsonl), [poly bags](https://mcp.packrift.com/ai/poly-bag-sizes.jsonl), [stretch film](https://mcp.packrift.com/ai/stretch-film-sizes.jsonl), [strapping](https://mcp.packrift.com/ai/strapping-sizes.jsonl), [tags](https://mcp.packrift.com/ai/tag-sizes.jsonl), [void fill](https://mcp.packrift.com/ai/void-fill-sizes.jsonl), and [packing list envelopes](https://mcp.packrift.com/ai/packing-list-envelope-sizes.jsonl)
- Family procurement prompt files: [boxes](https://mcp.packrift.com/ai/corrugated-box-procurement-prompts.md), [mailers](https://mcp.packrift.com/ai/mailer-procurement-prompts.md), [labels](https://mcp.packrift.com/ai/label-procurement-prompts.md), [tape](https://mcp.packrift.com/ai/tape-procurement-prompts.md), [poly bags](https://mcp.packrift.com/ai/poly-bag-procurement-prompts.md), [stretch film](https://mcp.packrift.com/ai/stretch-film-procurement-prompts.md), [strapping](https://mcp.packrift.com/ai/strapping-procurement-prompts.md), [tags](https://mcp.packrift.com/ai/tag-procurement-prompts.md), [void fill](https://mcp.packrift.com/ai/void-fill-procurement-prompts.md), and [packing list envelopes](https://mcp.packrift.com/ai/packing-list-envelope-procurement-prompts.md)
- [AI corpus sitemap](https://mcp.packrift.com/ai/sitemap.xml): crawl map for Packrift machine-readable exact-spec files
- [Public exact-spec data page](https://packrift.com/pages/packrift-ai-exact-spec-data): Shopify-hosted resource page linking buyers, crawlers, and agents to the MCP corpus files
- [AI agent instructions](https://packrift.com/pages/packrift-ai-agent-instructions): exact-match policy, MCP usage pattern, resources/list guidance, and purchase handoff rules
- [Server card](https://mcp.packrift.com/.well-known/mcp/server-card.json): MCP discovery manifest
- [Root MCP JSON](https://mcp.packrift.com/mcp.json): copy-ready MCP client config
- [Well-known MCP JSON](https://mcp.packrift.com/.well-known/mcp.json): well-known copy-ready MCP client config
- [Glama connector claim](https://mcp.packrift.com/.well-known/glama.json): hosted connector ownership and endpoint discovery
- [MCP Marketplace discovery manifest](https://mcp.packrift.com/.well-known/mcp-marketplace.json): marketplace ownership and endpoint discovery
- [Product feed (JSON)](https://packrift.com/products.json): Shopify product feed, paginated, no auth
- [Sitemap](https://packrift.com/sitemap.xml)

## Catalog

- [All products](https://packrift.com/collections/all)
- [Boxes and mailer boxes](https://packrift.com/collections/boxes-mailers)
- [Mailer boxes](https://packrift.com/collections/mailer-boxes)
- [Poly and bubble mailers](https://packrift.com/collections/mailers-envelopes)
- [Carton sealing tape](https://packrift.com/collections/carton-sealing-tape)
- [Kraft tape](https://packrift.com/collections/kraft-tape)
- [Poly bags and liners](https://packrift.com/collections/bags-liners)
- [Stretch film and strapping](https://packrift.com/collections/stretch-film-strapping)

## Sizing and selection tools

- [Box size calculator](https://packrift.com/pages/box-size-calculator)
- [Dimensional weight calculator](https://packrift.com/pages/dimensional-weight-calculator)
- [Packaging cost calculator](https://packrift.com/pages/packaging-cost-calculator)
- [Mailer vs box selector](https://packrift.com/pages/mailer-vs-box-selector)
- [Bubble mailer size guide](https://packrift.com/pages/bubble-mailer-size-guide)
- [Mailer box size chart](https://packrift.com/pages/mailer-box-size-chart)
- [Poly bag size chart](https://packrift.com/pages/poly-bag-size-chart)
- [Box sizes by dimension](https://packrift.com/pages/box-sizes-by-dimension)
- [10x6x6 corrugated boxes](https://packrift.com/pages/10x6x6-corrugated-boxes)
- [6x6x5 corrugated boxes](https://packrift.com/pages/6x6x5-corrugated-boxes)
- [14x10x8 corrugated boxes](https://packrift.com/pages/14x10x8-corrugated-boxes)
- [20x14x12 corrugated boxes](https://packrift.com/pages/20x14x12-corrugated-boxes)
- [20x14x6 corrugated boxes](https://packrift.com/pages/20x14x6-corrugated-boxes)
- [12 1/8 x 9 1/4 x 5 literature mailers](https://packrift.com/pages/12-1-8-x-9-1-4-x-5-literature-mailers)
- [10.75 x 6.75 packing list envelopes](https://packrift.com/pages/10-75x6-75-packing-list-envelopes)
- [5.125 x 8 packing list envelopes](https://packrift.com/pages/5-125x8-packing-list-envelopes)
- [6 x 12 packing list envelopes](https://packrift.com/pages/6x12-packing-list-envelopes)
- [7 x 10 packing list envelopes](https://packrift.com/pages/7x10-packing-list-envelopes)
- [7 x 5.5 packing list envelopes](https://packrift.com/pages/7x5-5-packing-list-envelopes)
- [7 x 6 packing list envelopes](https://packrift.com/pages/7x6-packing-list-envelopes)
- [8.5 x 10.5 packing list envelopes](https://packrift.com/pages/8-5x10-5-packing-list-envelopes)
- [5.25 x 8 packing list envelopes](https://packrift.com/pages/5-25x8-packing-list-envelopes)
- [12 x 15 packing list envelopes](https://packrift.com/pages/12x15-packing-list-envelopes)

## Priority exact-spec SKUs for agent product lookup

These SKUs are approved in the public MCP catalog gate and are good exact-spec lookup examples. Use the MCP SKU record first for exact product facts and measured product/reorder/quote handoffs, then use MCP tools for live price, inventory, product details, and cart handoff.

- [SKU 1066](https://mcp.packrift.com/ai/sku/1066.md): 10 x 6 x 6 ECT-32 kraft corrugated boxes, 25/bundle
- [SKU MFL1295](https://mcp.packrift.com/ai/sku/MFL1295.md): 12 1/8 x 9 1/4 x 5 white self-seal literature mailers, 50/pack
- [SKU LL251WR](https://mcp.packrift.com/ai/sku/LL251WR.md): 2 5/8 x 1 weather-resistant polyester laser labels, 3000/case
- [SKU M754](https://mcp.packrift.com/ai/sku/M754.md): 7 x 5 x 4 ECT-32 white corrugated mailers, 50/pack
- [SKU MCC5](https://mcp.packrift.com/ai/sku/MCC5.md): 20 x 11 3/8 x 5 1/2 ECT-32 white corrugated carrying cases, 50/pack

Exact-match rule for agents: if a buyer requests a different size, material, color, case count, pack count, printer type, adhesive, closure, or SKU, do not present one of these products as an exact substitute. Return no exact match, ask for confirmation, or route to the exact-spec finder or bulk quote path.

## Buying guides

- [Corrugated boxes](https://packrift.com/pages/corrugated-boxes-guide)
- [Mailers](https://packrift.com/pages/mailers-guide)
- [Tape](https://packrift.com/pages/tape-guide)
- [Stretch film](https://packrift.com/pages/stretch-film-guide)
- [Poly bags](https://packrift.com/pages/poly-bags-guide)
- [Labels and tags](https://packrift.com/pages/labels-tags-guide)

## Use-case pages

- [Best packaging for 3PLs](https://packrift.com/pages/best-packaging-for-3pls)
- [Best packaging for Amazon FBM](https://packrift.com/pages/best-packaging-for-amazon-fbm)
- [Best packaging for Shopify brands](https://packrift.com/pages/best-packaging-for-shopify-brands)
- [Best packaging for Etsy sellers](https://packrift.com/pages/best-packaging-for-etsy-sellers)
- [Best packaging for subscription boxes](https://packrift.com/pages/best-packaging-for-subscription-boxes)
- [Uline alternatives](https://packrift.com/pages/uline-alternatives)
- [Uline box alternatives by size](https://packrift.com/pages/uline-box-alternatives-by-size)
- [White self-seal literature mailers](https://packrift.com/pages/white-self-seal-literature-mailers)
- [Corrugated box grades explained](https://packrift.com/pages/corrugated-box-grades-explained)
- [Packaging questions](https://packrift.com/pages/packaging-questions)

## Company

- [About](https://packrift.com/pages/about-us)
- [Contact](https://packrift.com/pages/contact)
- [Support](https://packrift.com/pages/support)
- [Partner with us](https://packrift.com/pages/partner-with-us)

## Optional

- [Privacy policy](https://packrift.com/pages/privacy-policy)
`;
