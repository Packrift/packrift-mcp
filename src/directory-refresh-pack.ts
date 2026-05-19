import { TRACKED_INSTALL_TEMPLATE, trackedInstallUrl } from "./install-action.js";
import { TRACKED_RUN_TEMPLATE, trackedRunUrl } from "./first-run-action.js";

export interface DirectoryRefreshRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const MCP_START_URL = "https://mcp.packrift.com/start";
const MCP_START_JSON_URL = "https://mcp.packrift.com/ai/mcp-start.json";
const MCP_TRACKED_START_TEMPLATE = "https://mcp.packrift.com/r/start/{source}";
const MCP_TRACKED_CONFIG_TEMPLATE = "https://mcp.packrift.com/r/config/{source}";
const MCP_TRACKED_CONFIG_GENERIC_URL = "https://mcp.packrift.com/r/config/generic";
const INSTALL_ACTIONS_URL = "https://mcp.packrift.com/ai/mcp-install-actions.json";
const REVIEWER_ACTIVATION_URL = "https://mcp.packrift.com/ai/mcp-reviewer-activation.json";
const MCP_TRACKED_REVIEWER_ACTIVATION_TEMPLATE = "https://mcp.packrift.com/r/activate/{source}";
const MCP_TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE = "https://mcp.packrift.com/r/activate/{source}?format=html";
const ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/SKILL.md";
const BROWSERBASE_BROWSE_SKILL_PACK_URL = "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json";
const CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md";
const MCP_CLIENT_CONFIG_URL = "https://mcp.packrift.com/ai/mcp-client-config.json";
const MCP_FUNNEL_SNAPSHOT_URL = "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json";
const ROOT_MCP_JSON_URL = "https://mcp.packrift.com/mcp.json";
const WELL_KNOWN_MCP_JSON_URL = "https://mcp.packrift.com/.well-known/mcp.json";
const MCP_TRACKED_START_SOURCE_POLICY = {
  accepted_source_format: "^[a-z0-9_]{2,64}$",
  partner_specific_sources_allowed: true,
  custom_examples: ["agency_partner", "browser_agent_demo", "newsletter_mcp"],
};

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
    id: "anthropic_connectors_directory",
    name: "Claude Connectors Directory",
    listing_url: "https://claude.com/connectors",
    refresh_url: "https://clau.de/mcp-directory-submission",
    priority: "high",
    requested_action:
      "Submit Packrift MCP for Claude Connectors Directory review with the hosted endpoint, no-auth policy, and first-run cart-handoff proof.",
  },
  {
    id: "smithery",
    name: "Smithery",
    listing_url: "https://smithery.ai/servers?q=Packrift",
    refresh_url: "https://smithery.ai/new",
    priority: "high",
    requested_action:
      "Publish or claim Packrift MCP on Smithery using the hosted endpoint and the richer /.well-known/mcp/server-card.json schema fields.",
  },
  {
    id: "cline_mcp_marketplace",
    name: "Cline MCP Marketplace",
    listing_url: "https://github.com/cline/mcp-marketplace/issues?q=Packrift",
    refresh_url: "https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml",
    priority: "high",
    requested_action:
      "Keep the Packrift MCP submission issue current until it is published in the Cline MCP Marketplace.",
  },
  {
    id: "mcp_so",
    name: "MCP.so",
    listing_url: "https://mcp.so/servers?keyword=Packrift",
    refresh_url: "https://mcp.so/submit",
    priority: "high",
    requested_action:
      "Submit or claim Packrift MCP with the hosted endpoint, tracked start link, and exact-spec packaging category copy.",
  },
  {
    id: "browse_sh",
    name: "Browserbase Browse / browse.sh",
    listing_url: "https://browse.sh/",
    refresh_url: "https://browse.sh/",
    priority: "high",
    requested_action:
      "Add Packrift as a Browse catalog skill using the root SKILL.md and hosted MCP endpoint, so browser agents can discover Packrift without a duplicate CLI.",
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
    id: "mcpmarket_com",
    name: "MCP Market",
    listing_url: "https://mcpmarket.com/server/packrift",
    refresh_url: "https://mcpmarket.com/submit",
    priority: "medium",
    requested_action:
      "Claim or update the Packrift MCP Market listing so it points at the hosted endpoint and current server card.",
  },
  {
    id: "cursor_directory",
    name: "Cursor Directory",
    listing_url: "https://cursor.directory/",
    refresh_url: "https://cursor.directory/plugins/new",
    priority: "medium",
    requested_action:
      "Submit Packrift MCP for Cursor users with the hosted MCP config and tracked start source.",
  },
  {
    id: "mcpcentral",
    name: "MCP Central",
    listing_url: "https://mcpcentral.io/servers",
    refresh_url: "https://mcpcentral.io/submit-server",
    priority: "medium",
    requested_action:
      "Submit Packrift MCP to MCP Central or request review if browser-side auth is required.",
  },
  {
    id: "mcpfinder",
    name: "MCPfinder",
    listing_url: "https://www.mcpfinder.org/",
    refresh_url: "https://www.mcpfinder.org/submit",
    priority: "medium",
    requested_action:
      "Submit Packrift MCP to MCPfinder with hosted endpoint proof and tracked start URL.",
  },
  {
    id: "mcpskills",
    name: "MCPSkills",
    listing_url: "https://mcpskills.app/servers",
    refresh_url: "https://mcpskills.app/submit",
    priority: "medium",
    requested_action: "Review the direct submission and list Packrift from the public GitHub repo with the hosted no-auth MCP endpoint.",
  },
  {
    id: "agentndx",
    name: "AgentNDX",
    listing_url: "https://agentndx.ai/browse",
    refresh_url: "https://agentndx.ai/submit",
    priority: "medium",
    requested_action: "Review the direct submission and list Packrift as an MCP protocol service with the hosted start page.",
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
  const proofSummary = `${runtime.toolsCount} tools, ${runtime.promptsCount} prompts, ${runtime.resourcesCount} resources, hosted Streamable HTTP endpoint, public start page, public server card, copy-ready MCP client config, source-attributed /r/config/{source} config links, tracked /r/install/{source}/{target} install-action links, browser-executable /r/run/{source}/{target} first-run proof, reviewer-to-real-MCP /r/activate/{source} handoffs, browser runner /r/activate/{source}?format=html, official registry entry, install matrix, workflow gallery, browser-agent bridge, Browserbase Browse SKILL.md, Browserbase Browse skill pack, usage snapshot, and MCP-attributed cart handoff candidates.`;
  return {
    release: "PACKRIFT-MCP-DIRECTORY-REFRESH-R13",
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
      start_url: MCP_START_URL,
      tracked_start_template: MCP_TRACKED_START_TEMPLATE,
      tracked_config_template: MCP_TRACKED_CONFIG_TEMPLATE,
      tracked_install_template: TRACKED_INSTALL_TEMPLATE,
      tracked_run_template: TRACKED_RUN_TEMPLATE,
      tracked_reviewer_activation_template: MCP_TRACKED_REVIEWER_ACTIVATION_TEMPLATE,
      tracked_reviewer_activation_html_template: MCP_TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE,
      tracked_config_generic: MCP_TRACKED_CONFIG_GENERIC_URL,
      tracked_install_examples: {
        generic_streamable_http: trackedInstallUrl("generic", "generic_streamable_http"),
        claude_code: trackedInstallUrl("generic", "claude_code"),
        codex: trackedInstallUrl("generic", "codex"),
        cursor_windsurf_vscode: trackedInstallUrl("generic", "cursor_windsurf_vscode"),
      },
      tracked_first_run_examples: {
        generic_streamable_http: trackedRunUrl("generic", "generic_streamable_http"),
        browser: `${trackedRunUrl("generic", "generic_streamable_http")}&format=html`,
        live_proof: `${trackedRunUrl("generic", "generic_streamable_http")}&execute=1`,
      },
      tracked_reviewer_activation_examples: {
        generic: "https://mcp.packrift.com/r/activate/generic",
        mcp_so: "https://mcp.packrift.com/r/activate/mcp_so",
        browse_sh: "https://mcp.packrift.com/r/activate/browse_sh",
      },
      tracked_reviewer_activation_html_examples: {
        generic: "https://mcp.packrift.com/r/activate/generic?format=html",
        mcp_so: "https://mcp.packrift.com/r/activate/mcp_so?format=html",
        browse_sh: "https://mcp.packrift.com/r/activate/browse_sh?format=html",
      },
      tracked_start_source_policy: MCP_TRACKED_START_SOURCE_POLICY,
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
      client_config_url: MCP_CLIENT_CONFIG_URL,
      root_mcp_json: ROOT_MCP_JSON_URL,
      well_known_mcp_json: WELL_KNOWN_MCP_JSON_URL,
      proof_summary: proofSummary,
    },
    live_proof: {
      health: "https://mcp.packrift.com/health",
      manifest: "https://mcp.packrift.com/manifest",
      mcp_start: MCP_START_JSON_URL,
      tracked_start_template: MCP_TRACKED_START_TEMPLATE,
      tracked_start_partner_demo: "https://mcp.packrift.com/r/start/partner_demo",
      tracked_config_template: MCP_TRACKED_CONFIG_TEMPLATE,
      tracked_config_generic: MCP_TRACKED_CONFIG_GENERIC_URL,
      tracked_install_template: TRACKED_INSTALL_TEMPLATE,
      tracked_install_codex_generic: trackedInstallUrl("generic", "codex"),
      tracked_run_template: TRACKED_RUN_TEMPLATE,
      tracked_run_generic: trackedRunUrl("generic", "generic_streamable_http"),
      tracked_run_generic_browser: `${trackedRunUrl("generic", "generic_streamable_http")}&format=html`,
      tracked_run_generic_execute: `${trackedRunUrl("generic", "generic_streamable_http")}&execute=1`,
      tracked_reviewer_activation_template: MCP_TRACKED_REVIEWER_ACTIVATION_TEMPLATE,
      tracked_reviewer_activation_html_template: MCP_TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE,
      tracked_reviewer_activation_generic: "https://mcp.packrift.com/r/activate/generic",
      tracked_reviewer_activation_html_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
      reviewer_activation: REVIEWER_ACTIVATION_URL,
      first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
      install_actions: INSTALL_ACTIONS_URL,
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      official_registry: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
      glama_claim: "https://mcp.packrift.com/.well-known/glama.json",
      marketplace_manifest: "https://mcp.packrift.com/.well-known/mcp-marketplace.json",
      tools_list: `${MCP_ENDPOINT} via JSON-RPC tools/list`,
      resources_list: `${MCP_ENDPOINT} via JSON-RPC resources/list`,
      prompts_list: `${MCP_ENDPOINT} via JSON-RPC prompts/list`,
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      client_config: MCP_CLIENT_CONFIG_URL,
      root_mcp_json: ROOT_MCP_JSON_URL,
      well_known_mcp_json: WELL_KNOWN_MCP_JSON_URL,
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      funnel_snapshot: MCP_FUNNEL_SNAPSHOT_URL,
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      root_browserbase_browse_skill_md: ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL,
      browserbase_browse_skill_pack: BROWSERBASE_BROWSE_SKILL_PACK_URL,
      canonical_browserbase_browse_skill_md: CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL,
      directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      agent_capture_outreach: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
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
    priority_refresh_targets: DIRECTORY_TARGETS.map((target) => ({
      ...target,
      tracked_start_url: `https://mcp.packrift.com/r/start/${target.id}`,
      tracked_config_url: `https://mcp.packrift.com/r/config/${target.id}`,
      tracked_install_urls: {
        generic_streamable_http: trackedInstallUrl(target.id, "generic_streamable_http"),
        claude_code: trackedInstallUrl(target.id, "claude_code"),
        codex: trackedInstallUrl(target.id, "codex"),
        cursor_windsurf_vscode: trackedInstallUrl(target.id, "cursor_windsurf_vscode"),
      },
      tracked_run_urls: {
        generic_streamable_http: trackedRunUrl(target.id, "generic_streamable_http"),
        generic_streamable_http_browser: `${trackedRunUrl(target.id, "generic_streamable_http")}&format=html`,
        generic_streamable_http_execute: `${trackedRunUrl(target.id, "generic_streamable_http")}&execute=1`,
      },
      tracked_reviewer_activation_url: `https://mcp.packrift.com/r/activate/${target.id}`,
      tracked_reviewer_activation_html_url: `https://mcp.packrift.com/r/activate/${target.id}?format=html`,
    })),
    recrawl_request:
      `Please recrawl Packrift MCP as a hosted no-auth Streamable HTTP MCP server at ${MCP_ENDPOINT}. Use tracked install-action links like ${trackedInstallUrl("generic", "codex")} when linking to client-specific setup, use browser proof links like ${trackedRunUrl("generic", "generic_streamable_http")}&execute=1 when validating the first useful run, and use ${REVIEWER_ACTIVATION_URL} plus /r/activate/{source}?format=html to convert proof clicks into real MCP client calls. Current proof: ${proofSummary}`,
    operating_rules: [
      "The hosted endpoint is the primary listing target; do not require users to self-host or provide a Shopify token for normal MCP use.",
      "Use the official registry name io.github.Packrift/packrift-mcp and the remote endpoint https://mcp.packrift.com/mcp.",
      "Use /r/start/{source} for directory, partner, campaign, and agent handoff attribution; use /r/config/{source} when the directory or host can fetch MCP JSON config directly; use /r/install/{source}/{target} when the directory can link to client-specific setup. Custom source slugs are allowed when they match ^[a-z0-9_]{2,64}$.",
      "Use /r/run/{source}/{target}?format=html for reviewer-friendly first-run pages and /r/run/{source}/{target}?execute=1 for one-click live proof.",
      "Use /r/activate/{source}?format=html when a reviewer has clicked proof but still needs a browser-run real MCP client sequence ending in create_cart_url.",
      "Keep stale directory listings separate from the live MCP truth. The live health, server card, tools/list, resources/list, and prompts/list are authoritative.",
      "Discovery is not the final goal. Recrawls should drive external MCP sessions, tool calls, stamped cart landings, and measurable revenue.",
    ],
    success_metrics: [
      "stale directory listings become current",
      "directory referral sessions appear in analytics",
      "tracked install-action opens appear by directory source and target in the usage snapshot",
      "tracked first-run browser executions appear by directory source in the usage and funnel snapshots",
      "reviewer activation handoff opens appear by directory source before real MCP tool calls",
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
        `| ${escapeMarkdown(target.name)} | ${target.priority} | ${target.listing_url} | ${target.refresh_url} | ${target.tracked_install_urls.codex} | ${target.tracked_run_urls.generic_streamable_http_execute} | ${target.tracked_reviewer_activation_url} | ${target.tracked_reviewer_activation_html_url} | ${escapeMarkdown(target.requested_action)} |`
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
    `Start page: ${payload.canonical_listing.start_url}`,
    `Tracked start template: ${payload.canonical_listing.tracked_start_template}`,
    `Tracked config template: ${payload.canonical_listing.tracked_config_template}`,
    `Tracked install template: ${payload.canonical_listing.tracked_install_template}`,
    `Tracked first-run template: ${payload.canonical_listing.tracked_run_template}`,
    `Tracked reviewer activation template: ${payload.canonical_listing.tracked_reviewer_activation_template}`,
    `Tracked reviewer activation browser runner template: ${payload.canonical_listing.tracked_reviewer_activation_html_template}`,
    `Tracked Codex install example: ${payload.canonical_listing.tracked_install_examples.codex}`,
    `Tracked live proof example: ${payload.canonical_listing.tracked_first_run_examples.live_proof}`,
    `Tracked reviewer activation example: ${payload.canonical_listing.tracked_reviewer_activation_examples.generic}`,
    `Tracked reviewer activation browser runner example: ${payload.canonical_listing.tracked_reviewer_activation_html_examples.generic}`,
    `Tracked source format: ${payload.canonical_listing.tracked_start_source_policy.accepted_source_format}`,
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
    "| Directory | Priority | Current listing | Refresh URL | Tracked Codex install URL | Live proof URL | Activation handoff | Activation runner | Requested action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
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
