# Packrift MCP Server Install

Packrift MCP Server is a hosted remote MCP endpoint for Packrift's packaging-supplies catalog. No local package, API key, or checkout account is required for the public catalog tools.

## Endpoint

```text
https://mcp.packrift.com/mcp
```

## Remote MCP Config

Use this configuration in MCP clients that support remote HTTP or Streamable HTTP servers:

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

If your client uses a UI instead of JSON, add a remote MCP server named `packrift` with URL `https://mcp.packrift.com/mcp`.

## What It Provides

- Search Packrift packaging supplies by product, use case, or packaging need.
- Retrieve pricing and inventory context for selected variants.
- Recommend packaging options from item dimensions, weight, and shipping use case.
- Create Packrift cart URLs for agent-assisted purchasing workflows.

## Public Links

- Documentation: https://packrift.com/pages/agents
- Source: https://github.com/Packrift/packrift-mcp
- Server card: https://mcp.packrift.com/.well-known/mcp/server-card.json
