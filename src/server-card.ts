// MCP server card served at /.well-known/mcp/server-card.json, /server-card.json
// and /manifest. Directories and registries read it to describe Packrift.

export const serverCard = {
  name: "Packrift MCP",
  title: "Packrift packaging supplies",
  description:
    "Find, size, price and order packaging supplies from Packrift: corrugated shipping boxes, mailer boxes, poly and bubble mailers, poly bags, labels, packing tape, stretch film and void fill, with live price and stock across 20,000+ products. Fits items to boxes and mailers with cushioning, strength and dimensional-weight checks, prices delivery to US ZIP codes with automatic volume discounts, and creates packrift.com checkout links. Read-only; it never places orders.",
  version: "1.0.0",
  protocol: "mcp",
  transport: "streamable-http",
  endpoint: "/mcp",
  url: "https://mcp.packrift.com/mcp",
  authentication: "none",
  vendor: "Packrift",
  homepage: "https://packrift.com",
  documentation: "https://mcp.packrift.com/start",
  privacyPolicy: "https://mcp.packrift.com/privacy",
  support: "mailto:support@packrift.com",
  contact: "support@packrift.com",
  resources: {
    start: "https://mcp.packrift.com/start",
    packagingGuide: "https://mcp.packrift.com/guides/packaging.md",
    llmsTxt: "https://mcp.packrift.com/llms.txt",
    llmsFullTxt: "https://mcp.packrift.com/llms-full.txt",
    agentInstructions: "https://mcp.packrift.com/ai/packrift-ai-agent-instructions.md",
    privacy: "https://mcp.packrift.com/privacy",
    claudePlugin: "https://github.com/Packrift/claude-plugin",
    shopifyNativeUcpEndpoint: "https://packrift.com/api/ucp/mcp",
    shopifyUcpDiscovery: "https://packrift.com/.well-known/ucp",
  },
  capabilities: { tools: true, resources: true, prompts: true },
  tools: [
    "search_products",
    "find_packaging_for_item",
    "get_product",
    "get_shipping_estimate",
    "create_cart_url",
    "get_bulk_quote_link",
  ],
  prompts: [
    "find_packaging_for_my_item",
    "find_exact_packaging_spec",
    "delivered_price_to_zip",
    "reorder_packrift_sku",
    "request_bulk_quote",
  ],
} as const;
