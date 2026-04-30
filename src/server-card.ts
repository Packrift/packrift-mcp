// Mirror of the MCP server card served at /.well-known/mcp/server-card.json on
// the worker so the same content is reachable on mcp.packrift.com once DNS is
// pointed. Agent B publishes the canonical copy on packrift.com via Shopify pages.

export const serverCard = {
  name: "Packrift MCP",
  description:
    "Search the Packrift packaging-supplies catalog, get live pricing and inventory, recommend a box for a given item, estimate shipping, and produce checkout URLs.",
  version: "0.1.0",
  protocol: "mcp",
  transport: "streamable-http",
  endpoint: "/mcp",
  vendor: "Packrift",
  homepage: "https://packrift.com",
  contact: "farhan@packrift.com",
  capabilities: { tools: true },
  tools: [
    "search_products",
    "get_product",
    "get_pricing",
    "check_inventory",
    "recommend_packaging",
    "get_shipping_estimate",
    "create_cart_url",
  ],
} as const;
