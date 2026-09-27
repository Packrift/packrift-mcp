# Install Packrift MCP

Packrift MCP is a hosted remote MCP server for Packrift's packaging-supplies catalog. There is nothing to install locally and no API key: add the endpoint to your MCP client.

## Endpoint

```text
https://mcp.packrift.com/mcp
```

Transport: Streamable HTTP. Authentication: none.

## Client configuration

Most clients accept this JSON:

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

Command-line clients:

```bash
claude mcp add --transport http packrift https://mcp.packrift.com/mcp
codex mcp add packrift --url https://mcp.packrift.com/mcp
code --add-mcp '{"name":"packrift","type":"http","url":"https://mcp.packrift.com/mcp"}'
```

## Verify

After connecting, `tools/list` returns six tools: `search_products`, `find_packaging_for_item`, `get_product`, `get_shipping_estimate`, `create_cart_url` and `get_bulk_quote_link`. A good first call:

```json
{"name": "find_packaging_for_item", "arguments": {"item_length_in": 9, "item_width_in": 6, "item_depth_in": 4, "item_weight_lb": 2, "use_case": "ceramic mug"}}
```

## Notes

- All tools are read-only and never place orders; `create_cart_url` returns a packrift.com checkout link for the buyer.
- Setup for more clients: https://mcp.packrift.com/start
- Privacy notice: https://mcp.packrift.com/privacy
- Support: support@packrift.com
