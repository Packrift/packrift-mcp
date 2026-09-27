# Packrift MCP

Packaging supplies for AI assistants. Packrift MCP lets Claude, ChatGPT, Cursor and any MCP client find, size, price and order packaging from Packrift's in-stock catalog of 20,000+ shipping boxes, mailers, poly bags, labels, packing tape, stretch film and void fill.

- **Endpoint:** `https://mcp.packrift.com/mcp` (Streamable HTTP, no authentication)
- **Start page:** https://mcp.packrift.com/start
- **Claude plugin:** https://github.com/Packrift/claude-plugin
- **MCP Registry:** `io.github.Packrift/packrift-mcp`
- **Privacy:** https://mcp.packrift.com/privacy

## Tools

| Tool | What it does |
|---|---|
| `search_products` | Search by product type, exact size or spec, or SKU. Returns live price, pack size, price per unit, stock and a product link; close sizes are labeled as not exact. |
| `find_packaging_for_item` | Give an item's length, width, height, weight and what it is; get boxes or mailers that fit, with cushioning, box strength and billable shipping weight. |
| `get_product` | Specs, pack count, live price and stock, whether a quantity can ship now, volume pricing and nearby sizes for one SKU. |
| `get_shipping_estimate` | Delivered cost to a US ZIP code, using checkout rates with automatic volume discounts and free-shipping rules applied. |
| `create_cart_url` | A packrift.com checkout link for the chosen SKUs and quantities. The buyer reviews and pays on packrift.com. |
| `get_bulk_quote_link` | A pre-filled quote request for pallet quantities, custom sizes, printing or freight. |

Every tool is read-only (`readOnlyHint: true`, `destructiveHint: false`) and never places an order or takes payment. Each returns a short text answer plus a compact `structuredContent` object; pass `response_format: "detailed"` for the full catalog record.

## Connect

| Client | Setup |
|---|---|
| Claude (claude.ai and the Claude apps) | Settings, Connectors, Add custom connector, then paste `https://mcp.packrift.com/mcp` |
| Claude Code | `claude mcp add --transport http packrift https://mcp.packrift.com/mcp` |
| Claude plugin | `claude plugin marketplace add Packrift/claude-plugin` then `claude plugin install packrift@packrift` |
| ChatGPT | Add a custom connector (developer mode) with `https://mcp.packrift.com/mcp` |
| Cursor and Windsurf | `{"mcpServers":{"packrift":{"url":"https://mcp.packrift.com/mcp"}}}` |
| VS Code | `code --add-mcp '{"name":"packrift","type":"http","url":"https://mcp.packrift.com/mcp"}'` |
| Codex | `codex mcp add packrift --url https://mcp.packrift.com/mcp` |

## Try asking

- "What box should I use to ship a ceramic mug that's 4.5 x 3.5 x 4 inches?"
- "Find 12x12x12 shipping boxes and show me the cheapest per box."
- "I need poly mailers for folded t-shirts. What size, and what would 500 cost delivered to 75201?"
- "Price 10 packs of Packrift SKU 1066 delivered to 10001, then give me a checkout link."
- "I need 2,000 printed 18x12x12 boxes. How do I get a quote?"

## How it works

- **Live data.** Prices, stock and shipping rates come from Packrift's Shopify store at request time.
- **Fit.** Inside dimensions plus cushioning by item type (about 1/2 in per side for sturdy items, 1 to 2 in for electronics, 2 in for fragile items), box strength by ECT rating against the item's weight, flat-mailer and tube fits, and billable weight (UPS/FedEx divide by 139; USPS divides by 166 above one cubic foot).
- **Delivered price.** Checkout shipping rates with automatic volume discounts and free-shipping thresholds applied. Tax is excluded; checkout shows the final amount.
- **Checkout.** `create_cart_url` returns a `https://mcp.packrift.com/c/...` link that opens the buyer's cart on packrift.com with the chosen items.
- **Exact matches only.** A different size, strength, thickness or pack count is never presented as an exact match.
- **Resources and prompts.** `resources/list` offers a packaging guide, an overview of Packrift, tool guidance, setup and the privacy notice. `prompts/list` offers five starter prompts.

Earlier tool names from 0.x (`get_pricing`, `check_inventory`, `compare_alternatives`, `pack_calculator` and others) remain callable for existing integrations but are no longer listed.

## Privacy

The server receives only the arguments your assistant sends to its tools. It keeps usage records (tool, time, search text, SKUs returned, assistant type) for up to 90 days and does not store names, email addresses, phone numbers, street addresses or IP addresses from MCP requests. Full notice: https://mcp.packrift.com/privacy.

## Development

The server is a Cloudflare Worker (TypeScript, Hono, Zod) backed by the Shopify Admin GraphQL API.

```bash
npm install
npm test                 # offline unit tests and public-surface checks
npm run check:directory-surface
npx wrangler dev         # local worker; set SHOPIFY_PACKRIFT_TOKEN for live tool calls
```

`scripts/v1-live-smoke.mjs` exercises every tool against the live store with read-only calls; set `SHOPIFY_PACKRIFT_TOKEN` before running it.

## Support

support@packrift.com · +1 (302) 216-2975 · Packrift LLC, 300 Delaware Ave, Wilmington, DE 19801

## License

MIT
