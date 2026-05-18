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

## Hosted Connector Listings

- Glama hosted connector: https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp
- MCP Marketplace listing: https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp
- Official MCP Registry search: https://registry.modelcontextprotocol.io/v0/servers?search=Packrift
- Source repository: https://github.com/Packrift/packrift-mcp

## What It Provides

- Search Packrift packaging supplies by product, use case, or packaging need.
- Retrieve pricing and inventory context for selected variants.
- Recommend packaging options from item dimensions, weight, and shipping use case.
- Create Packrift cart URLs for agent-assisted purchasing workflows.

## First Tool Calls To Try

Use these after adding the remote MCP server. They are designed to exercise the measured path from discovery to a stamped cart handoff.

1. List tools and prompts:

```json
{"jsonrpc":"2.0","id":"tools","method":"tools/list"}
```

```json
{"jsonrpc":"2.0","id":"prompts","method":"prompts/list"}
```

2. Review a ready cart candidate:

```json
{"jsonrpc":"2.0","id":"candidates","method":"tools/call","params":{"name":"get_cart_handoff_candidates","arguments":{"sku":"1066","limit":1}}}
```

3. Confirm live facts before cart handoff:

```json
{"jsonrpc":"2.0","id":"price","method":"tools/call","params":{"name":"get_pricing","arguments":{"variant_ids":["53472879935856"],"quantity":1}}}
```

```json
{"jsonrpc":"2.0","id":"inventory","method":"tools/call","params":{"name":"check_inventory","arguments":{"variant_ids":["53472879935856"]}}}
```

4. Create the measured cart landing URL only after the buyer confirms exact SKU and quantity:

```json
{"jsonrpc":"2.0","id":"cart","method":"tools/call","params":{"name":"create_cart_url","arguments":{"items":[{"variant_id":"53472879935856","qty":1}],"selected_sku":"1066","selected_handle":"10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle","match_type":"cart_handoff_candidate","source_context":"exact_spec_ai_agent","journey_id":"mcp_1066_53472879935856","result_set_id":"mcp_cart_handoff_candidates","utm_term":"1066"}}}
```

The returned `url` is the MCP cart landing shim. It carries `ref=mcp`, `utm_source=chatgpt-mcp`, `utm_medium=mcp_tool`, and `utm_campaign=create_cart_url`, then redirects to the final Packrift cart.

## Public Links

- Documentation: https://packrift.com/pages/packrift-ai-agent-instructions
- Source: https://github.com/Packrift/packrift-mcp
- Server card: https://mcp.packrift.com/.well-known/mcp/server-card.json
- Glama connector claim: https://mcp.packrift.com/.well-known/glama.json
- MCP Marketplace discovery manifest: https://mcp.packrift.com/.well-known/mcp-marketplace.json
