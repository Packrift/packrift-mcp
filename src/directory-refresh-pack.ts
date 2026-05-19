export interface DirectoryRefreshRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

const DIRECTORY_TARGETS = [
  {
    id: "mcpservers_org",
    name: "mcpservers.org",
    listing_url: "https://mcpservers.org/servers/packrift/packrift-mcp",
    refresh_url: "https://mcpservers.org/submit",
    priority: "high",
    requested_action: "Recrawl the GitHub repository and hosted endpoint so the listing shows current cart-handoff and exploration tools.",
  },
  {
    id: "mcp_directory",
    name: "MCP.Directory",
    listing_url: "https://mcp.directory/servers?q=packrift",
    refresh_url: "https://mcp.directory/submit",
    priority: "high",
    requested_action: "Add Packrift MCP with the hosted Streamable HTTP endpoint, repo URL, and current exact-spec procurement copy.",
  },
  {
    id: "glama_server_listing",
    name: "Glama open-source server listing",
    listing_url: "https://glama.ai/mcp/servers/ye4xxr7qiu",
    refresh_url: "https://glama.ai/",
    priority: "high",
    requested_action: "Recrawl the current official registry and hosted endpoint so the old token-required zero-tool record is no longer the visible server listing.",
  },
  {
    id: "mcpbench",
    name: "MCPBench",
    listing_url: "https://mcpbench.ai/servers/io.github.Packrift/packrift-mcp",
    refresh_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    priority: "medium",
    requested_action: "Refresh from the official registry latest version and hosted endpoint proof.",
  },
  {
    id: "chiark",
    name: "Chiark",
    listing_url: "https://chiark.ai/",
    refresh_url: "https://chiark.ai/methodology",
    priority: "medium",
    requested_action: "Ingest Packrift from upstream MCP registry and marketplace surfaces by endpoint URL.",
  },
  {
    id: "pulsemcp_packrift",
    name: "PulseMCP",
    listing_url: "https://www.pulsemcp.com/servers/packrift",
    refresh_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    priority: "high",
    requested_action: "Use the official registry entry and public server.json as the recrawl source if direct crawler access is blocked.",
  },
  {
    id: "docker_mcp_catalog",
    name: "Docker MCP Catalog",
    listing_url: "https://github.com/docker/mcp-registry/pull/3388",
    refresh_url: "https://github.com/docker/mcp-registry/pull/3388",
    priority: "medium",
    requested_action:
      "Review and merge the hosted remote-server entry so Packrift can appear in Docker Desktop MCP Toolkit and Docker MCP Catalog discovery.",
  },
] as const;

export function mcpDirectoryRefreshPayload(runtime: DirectoryRefreshRuntime) {
  const proofSummary = `${runtime.toolsCount} tools, ${runtime.promptsCount} prompts, ${runtime.resourcesCount} resources, hosted Streamable HTTP endpoint, public server card, official registry entry, browser-agent bridge, usage snapshot, and MCP-attributed cart handoff candidates.`;
  return {
    release: "PACKRIFT-MCP-DIRECTORY-REFRESH-R02",
    generated_at: new Date().toISOString(),
    purpose:
      "Single public recrawl pack for MCP directories, marketplaces, and agent indexes that need current Packrift MCP listing fields and live proof URLs.",
    canonical_listing: {
      server_name: "Packrift MCP",
      registry_name: "io.github.Packrift/packrift-mcp",
      short_description:
        "Exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match.",
      long_description:
        "Packrift MCP lets AI agents find exact-spec packaging products, confirm live price and inventory, compare alternatives, estimate shipping, and hand off attributed carts to Packrift.",
      category: "Business",
      tags: ["mcp", "ecommerce", "packaging", "procurement", "shopify", "cart-handoff", "inventory"],
      website_url: "https://packrift.com/pages/packrift-ai-agent-instructions",
      repository_url: "https://github.com/Packrift/packrift-mcp",
      remote_endpoint: MCP_ENDPOINT,
      contact_email: "farhan@packrift.com",
      install_config: {
        mcpServers: {
          packrift: {
            type: "http",
            url: MCP_ENDPOINT,
          },
        },
      },
      proof_summary: proofSummary,
    },
    live_proof: {
      health: "https://mcp.packrift.com/health",
      manifest: "https://mcp.packrift.com/manifest",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      official_registry: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
      glama_claim: "https://mcp.packrift.com/.well-known/glama.json",
      marketplace_manifest: "https://mcp.packrift.com/.well-known/mcp-marketplace.json",
      tools_list: `${MCP_ENDPOINT} via JSON-RPC tools/list`,
      resources_list: `${MCP_ENDPOINT} via JSON-RPC resources/list`,
      prompts_list: `${MCP_ENDPOINT} via JSON-RPC prompts/list`,
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      docker_mcp_catalog_pr: "https://github.com/docker/mcp-registry/pull/3388",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
    },
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    priority_refresh_targets: DIRECTORY_TARGETS,
    recrawl_request:
      `Please recrawl Packrift MCP as a hosted no-auth Streamable HTTP MCP server at ${MCP_ENDPOINT}. Current proof: ${proofSummary}`,
    operating_rules: [
      "The hosted endpoint is the primary listing target; do not require users to self-host or provide a Shopify token for normal MCP use.",
      "Use the official registry name io.github.Packrift/packrift-mcp and the remote endpoint https://mcp.packrift.com/mcp.",
      "Keep stale directory listings separate from the live MCP truth. The live health, server card, tools/list, resources/list, and prompts/list are authoritative.",
      "Discovery is not the final goal. Recrawls should drive external MCP sessions, tool calls, stamped cart landings, and measurable revenue.",
    ],
    success_metrics: [
      "stale directory listings become current",
      "directory referral sessions appear in analytics",
      "external agents call tools/list or resources/list from directory referrals",
      "real workflows call get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url",
      "qualified MCP cart landings and MCP-attributed sales become visible",
    ],
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function mcpDirectoryRefreshMarkdown(runtime: DirectoryRefreshRuntime): string {
  const payload = mcpDirectoryRefreshPayload(runtime);
  const targetRows = payload.priority_refresh_targets
    .map(
      (target) =>
        `| ${escapeMarkdown(target.name)} | ${target.priority} | ${target.listing_url} | ${target.refresh_url} | ${escapeMarkdown(target.requested_action)} |`
    )
    .join("\n");
  const proofRows = Object.entries(payload.live_proof)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
  const rules = payload.operating_rules.map((rule) => `- ${rule}`).join("\n");
  return [
    "# Packrift MCP Directory Refresh Pack",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical MCP endpoint: ${payload.canonical_listing.remote_endpoint}`,
    "",
    "## Canonical Listing Copy",
    "",
    `Server name: ${payload.canonical_listing.server_name}`,
    `Registry name: ${payload.canonical_listing.registry_name}`,
    `Short description: ${payload.canonical_listing.short_description}`,
    `Long description: ${payload.canonical_listing.long_description}`,
    `Repository: ${payload.canonical_listing.repository_url}`,
    `Website: ${payload.canonical_listing.website_url}`,
    `Tags: ${payload.canonical_listing.tags.join(", ")}`,
    `Proof summary: ${payload.canonical_listing.proof_summary}`,
    "",
    "```json",
    JSON.stringify(payload.canonical_listing.install_config, null, 2),
    "```",
    "",
    "## Priority Refresh Targets",
    "",
    "| Directory | Priority | Current listing | Refresh URL | Requested action |",
    "| --- | --- | --- | --- | --- |",
    targetRows,
    "",
    "## Live Proof URLs",
    "",
    proofRows,
    "",
    "## Operating Rules",
    "",
    rules,
    "",
    "## Recrawl Request",
    "",
    payload.recrawl_request,
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    "",
  ].join("\n");
}
