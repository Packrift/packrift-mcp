# Packrift MCP

## Tagline
Exact-spec packaging search with live price, stock, shipping, and cart handoff.

## Description
Packrift MCP is a hosted Model Context Protocol server for ecommerce packaging procurement. It helps AI agents find exact-spec Packrift packaging products, confirm live pricing and inventory, compare alternatives, estimate shipping, and hand off tracked carts to Packrift checkout.

The server is designed for buyers and AI agents that need packaging supplies by SKU, dimensions, product family, or fulfillment use case. Product-facing tools are gated to Packrift's AI-approved catalog and include no-match guidance when an exact fit is not available.

## Setup Requirements
- No API key is required for the hosted remote MCP endpoint: `https://mcp.packrift.com/mcp`.
- `SHOPIFY_PACKRIFT_TOKEN` (optional): Required only if self-hosting live Shopify-backed catalog, pricing, inventory, shipping, and cart tools.
- `SHOPIFY_STORE_DOMAIN` (optional): Defaults to `packrift.myshopify.com`.
- `STOREFRONT_DOMAIN` (optional): Defaults to `packrift.com`.

## Hosted Connector
- Primary hosted endpoint: `https://mcp.packrift.com/mcp`
- Glama hosted connector: https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp
- MCP Marketplace listing: https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp
- Official MCP Registry search: https://registry.modelcontextprotocol.io/v0/servers?search=Packrift
- Source repository: https://github.com/Packrift/packrift-mcp

## Category
Business Tools

## Features
- Search Packrift packaging supplies by SKU, dimensions, product type, or use case.
- Retrieve AI-approved product records with title, handle, SKU, dimensions, and purchase links.
- Check live inventory and pricing for exact Packrift SKUs.
- Estimate shipping for packaging orders before checkout.
- Recommend boxes, mailers, labels, tape, bags, stretch film, and other packaging families.
- Compare alternatives when an exact packaging spec is unavailable.
- Generate Packrift cart handoff URLs with MCP attribution for measurement.
- Discover purchase-ready cart candidates for priority AI-approved SKUs.
- Provide structured JSON plus agent-readable summaries for buyer workflows.
- Expose public REST discovery surfaces for tools, resources, server cards, and health checks.

## Getting Started
- "Find 10 x 6 x 6 corrugated boxes and give me the live Packrift price."
- "Compare Packrift alternatives for a 12 x 9 x 5 shipping box."
- "Create a tracked cart URL for SKU 1066."
- "Show priority Packrift cart handoff candidates for AI procurement agents."
- Tool: `search_products` — Find matching Packrift packaging products from natural-language specs.
- Tool: `get_product` — Retrieve full detail for a specific AI-approved SKU or handle.
- Tool: `get_pricing` — Confirm live price for a specific SKU.
- Tool: `check_inventory` — Confirm availability for a specific SKU.
- Tool: `get_shipping_estimate` — Estimate shipping for a Packrift packaging order.
- Tool: `find_packaging_for_item` — Recommend packaging from item dimensions or use case.
- Tool: `compare_alternatives` — Compare viable Packrift packaging alternatives.
- Tool: `pack_calculator` — Calculate a recommended packaging fit.
- Tool: `inventory_status` — Summarize inventory status for buyer handoff.
- Tool: `create_cart_url` — Generate an attributed Packrift checkout handoff.
- Tool: `get_cart_handoff_candidates` — Return priority MCP cart handoff candidates.

## Tags
mcp, ecommerce, packaging, procurement, shopify, inventory, shipping, cart-handoff, remote-mcp, business-tools, exact-spec, ai-commerce

## Documentation URL
https://github.com/Packrift/packrift-mcp

## Health Check URL
https://mcp.packrift.com/health
