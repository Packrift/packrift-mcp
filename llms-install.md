# Packrift MCP Server Install

Packrift MCP Server is a hosted remote MCP endpoint for Packrift's packaging-supplies catalog. No local package, API key, or checkout account is required for the public catalog tools.

## Endpoint

```text
https://mcp.packrift.com/mcp
```

## Start Page

Use this as the shortest public handoff for developers, agents, and directory reviewers. It includes install snippets, the first exact-SKU flow, buyer prompts, and proof URLs:

- HTML: https://mcp.packrift.com/start
- JSON: https://mcp.packrift.com/ai/mcp-start.json
- Markdown: https://mcp.packrift.com/ai/mcp-start.md

## Hosted Adoption Kit

Use this when you want a fast, copy-ready first test after installing Packrift MCP:

- JSON: https://mcp.packrift.com/ai/mcp-adoption-kit.json
- Markdown: https://mcp.packrift.com/ai/mcp-adoption-kit.md

The adoption kit includes remote MCP config, Claude/Codex install commands, first-five-minute JSON-RPC calls, demo SKUs, useful workflows, proof URLs, and exact-match rules.

## Install Matrix

Use this when an agent host, directory, or developer needs copy-ready setup paths for common MCP clients plus smoke-test requests:

- JSON: https://mcp.packrift.com/ai/mcp-install-matrix.json
- Markdown: https://mcp.packrift.com/ai/mcp-install-matrix.md

The install matrix keeps Claude, Codex, IDE hosts, Glama, marketplace, browser-agent bridge, and optional container paths tied to the same hosted endpoint: `https://mcp.packrift.com/mcp`.

## Client Config

Use this when a host, IDE, or directory reviewer wants the smallest copy-ready MCP JSON instead of the larger install matrix:

- JSON bundle: https://mcp.packrift.com/ai/mcp-client-config.json
- Markdown: https://mcp.packrift.com/ai/mcp-client-config.md
- Root alias: https://mcp.packrift.com/mcp.json
- Well-known alias: https://mcp.packrift.com/.well-known/mcp.json

The root and well-known aliases return the minimal `mcpServers.packrift` config pointed at `https://mcp.packrift.com/mcp`.

## First-Run Proof

Use this when a developer, agent platform, or directory reviewer wants the shortest live proof before installing or recrawling:

- JSON: https://mcp.packrift.com/ai/mcp-first-run-proof.json
- Markdown: https://mcp.packrift.com/ai/mcp-first-run-proof.md

The first-run proof runs a synthetic SKU `1066` sequence against live product, price, inventory, and cart-handoff code with analytics suppressed. It shows the same JSON-RPC calls an external agent should make against `https://mcp.packrift.com/mcp`.

## Workflow Gallery

Use this when an agent host or developer needs copy-ready buyer prompts and JSON-RPC sequences for demos or evals:

- JSON: https://mcp.packrift.com/ai/mcp-workflow-gallery.json
- Markdown: https://mcp.packrift.com/ai/mcp-workflow-gallery.md

The workflow gallery covers exact SKU reorder, label reorder, literature mailer cart handoff, fit-by-dimensions discovery, and no-exact-match quote recovery.

## Cart Activation

Use this when an agent has exact buyer intent and needs the guarded sequence from live checks to a measured MCP cart landing:

- JSON: https://mcp.packrift.com/ai/mcp-cart-activation.json
- Markdown: https://mcp.packrift.com/ai/mcp-cart-activation.md

The cart activation playbook gives buyer prompts, JSON-RPC sequences, and the rule to present the `https://mcp.packrift.com/r/cart/` landing URL before the forwarded Shopify cart URL.

## Browser-Agent Bridge

Use this when an agent can read public URLs with a browser but cannot install MCP directly:

- JSON: https://mcp.packrift.com/ai/browser-agent-bridge.json
- Markdown: https://mcp.packrift.com/ai/browser-agent-bridge.md
- Root SKILL.md: https://mcp.packrift.com/SKILL.md
- Browse skill pack JSON: https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json
- Browse skill pack Markdown: https://mcp.packrift.com/ai/browserbase-browse-skill-pack.md
- Canonical Browse SKILL.md: https://mcp.packrift.com/ai/browserbase-browse/SKILL.md

The bridge and SKILL.md are read-first and MCP-confirmed. Browser agents can crawl Packrift resources for discovery, but live price, inventory, shipping, exact product detail, and cart handoff should still come from `https://mcp.packrift.com/mcp`.

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
- Client config: https://mcp.packrift.com/ai/mcp-client-config.json
- Root MCP JSON config: https://mcp.packrift.com/mcp.json
- Well-known MCP JSON config: https://mcp.packrift.com/.well-known/mcp.json
- Glama connector claim: https://mcp.packrift.com/.well-known/glama.json
- MCP Marketplace discovery manifest: https://mcp.packrift.com/.well-known/mcp-marketplace.json
