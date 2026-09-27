# Packrift MCP

## Tagline
Find, size, price and order packaging supplies from any AI assistant.

## Description
Packrift MCP connects AI assistants to Packrift's in-stock catalog of 20,000+ packaging supplies: corrugated shipping boxes, mailer boxes, poly and bubble mailers, poly bags, labels, packing tape, stretch film and void fill. It fits items to the right box or mailer with cushioning, box-strength and dimensional-weight checks, shows live price and stock, prices delivery to a US ZIP code with automatic volume discounts, and creates a packrift.com checkout link. Every tool is read-only and never places an order.

## Setup Requirements
- No API key or account. Remote endpoint: `https://mcp.packrift.com/mcp` (Streamable HTTP).
- Setup for Claude, Claude Code, ChatGPT, Cursor, VS Code and Codex: https://mcp.packrift.com/start

## Tools
- `search_products`: search by product type, exact size or spec, or SKU, with live price and stock.
- `find_packaging_for_item`: boxes and mailers that fit an item, with cushioning, strength and billable weight.
- `get_product`: specs, pack count, price, stock, volume pricing and nearby sizes.
- `get_shipping_estimate`: delivered cost to a US ZIP code with discounts applied.
- `create_cart_url`: a packrift.com checkout link for chosen items.
- `get_bulk_quote_link`: a quote request for pallets, custom sizes or printing.

## Example Prompts
- What box should I use to ship a ceramic mug that's 4.5 x 3.5 x 4 inches?
- Find 12x12x12 shipping boxes and show me the cheapest per box.
- What would 500 10x13 poly mailers cost delivered to 75201?

## Category
Ecommerce, shopping, logistics

## Links
- Website: https://packrift.com
- Start page: https://mcp.packrift.com/start
- Privacy: https://mcp.packrift.com/privacy
- Source: https://github.com/Packrift/packrift-mcp
- Support: support@packrift.com
