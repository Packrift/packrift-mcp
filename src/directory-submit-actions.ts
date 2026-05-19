export interface DirectorySubmitActionsRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const DIRECTORY_REFRESH_URL = "https://mcp.packrift.com/ai/mcp-directory-refresh.json";
const INSTALL_MATRIX_URL = "https://mcp.packrift.com/ai/mcp-install-matrix.json";
const DIRECTORY_SUBMIT_ACTIONS_URL = "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json";
const CART_ACTIVATION_URL = "https://mcp.packrift.com/ai/mcp-cart-activation.json";
const FIRST_RUN_PROOF_URL = "https://mcp.packrift.com/ai/mcp-first-run-proof.json";
const WORKFLOW_GALLERY_URL = "https://mcp.packrift.com/ai/mcp-workflow-gallery.json";
const BROWSERBASE_BROWSE_SKILL_PACK_URL = "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json";

const ACTIONS = [
  {
    id: "mcpservers_org",
    label: "mcpservers.org",
    action_status: "submitted_pending",
    directory_status: "stale",
    priority: "high",
    method: "Submitted through the public listing flow.",
    evidence: "Packrift has already been submitted and is waiting for review or recrawl.",
    stale_markers: ["get_cart_handoff_candidates", "mcp-cart-handoff-candidates", "compare_alternatives", "pack_calculator", "inventory_status"],
    recrawl_subject: "Refresh mcpservers.org Packrift MCP listing to current hosted endpoint",
    next_action: "Use the refreshed proof message if support or review asks for current evidence.",
    listing_url: "https://mcpservers.org/servers/packrift/packrift-mcp",
    submission_url: "https://mcpservers.org/submit",
  },
  {
    id: "glama_server_listing",
    label: "Glama source server listing",
    action_status: "manual_support_refresh_needed",
    directory_status: "stale",
    priority: "high",
    method: "Support recrawl request.",
    evidence:
      "The hosted Glama connector is healthy, but the source server listing still shows the older zero-tool token-required record.",
    stale_markers: ["zero tools", "SHOPIFY_PACKRIFT_TOKEN required"],
    recrawl_subject: "Refresh Glama Packrift MCP source listing to current hosted endpoint",
    next_action: "Ask Glama to reconcile the source listing with the hosted connector and current official registry entry.",
    listing_url: "https://glama.ai/mcp/servers/ye4xxr7qiu",
    submission_url: "https://glama.ai/",
  },
  {
    id: "mcp_directory",
    label: "MCP.Directory",
    action_status: "already_submitted",
    directory_status: "stale",
    priority: "high",
    method: "Repository already submitted through the public API.",
    evidence: "The repository submission is already queued for review, but Packrift is not yet visible in search.",
    stale_markers: ["Packrift not visible in search"],
    recrawl_subject: "Refresh MCP.Directory Packrift MCP listing to current hosted endpoint",
    next_action: "Use the refreshed proof message to request review, claim, or update access.",
    listing_url: "https://mcp.directory/servers?q=packrift",
    submission_url: "https://mcp.directory/submit",
  },
  {
    id: "pulsemcp_packrift",
    label: "PulseMCP",
    action_status: "manual_support_refresh_needed",
    directory_status: "blocked",
    priority: "high",
    method: "Support recrawl request using official-registry proof.",
    evidence:
      "Automated verification can be blocked, but the official MCP registry and Packrift hosted endpoint are current.",
    stale_markers: ["checker blocked or listing unavailable"],
    recrawl_subject: "Refresh PulseMCP Packrift MCP listing to current hosted endpoint",
    next_action: "Ask PulseMCP to refresh from the official registry, server.json, and public proof URLs.",
    listing_url: "https://www.pulsemcp.com/servers/packrift",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
  },
  {
    id: "mcpbench",
    label: "MCPBench",
    action_status: "monitor_upstream_registry",
    directory_status: "stale",
    priority: "medium",
    method: "Registry-derived monitoring.",
    evidence: "The official MCP registry is current; MCPBench appears to lag upstream ingestion.",
    stale_markers: ["latest official registry version not visible"],
    recrawl_subject: "Refresh MCPBench Packrift MCP listing from official registry",
    next_action: "Monitor for official-registry ingestion and cite the directory refresh pack if requesting a recrawl.",
    listing_url: "https://mcpbench.ai/servers/io.github.Packrift/packrift-mcp",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
  },
  {
    id: "chiark",
    label: "Chiark",
    action_status: "monitor_upstream_registry",
    directory_status: "stale",
    priority: "medium",
    method: "Upstream registry monitoring.",
    evidence: "Chiark is expected to crawl upstream MCP registry and marketplace surfaces.",
    stale_markers: ["Packrift not visible by endpoint or name"],
    recrawl_subject: "Refresh Chiark Packrift MCP coverage from upstream registries",
    next_action: "Monitor after official registry and high-priority directory refreshes propagate.",
    listing_url: "https://chiark.ai/",
    submission_url: "https://chiark.ai/methodology",
  },
  {
    id: "docker_mcp_catalog",
    label: "Docker MCP Catalog",
    action_status: "pending_merge",
    directory_status: "pending",
    priority: "medium",
    method: "GitHub pull request.",
    evidence: "Docker MCP Catalog PR #3388 is open and mergeable.",
    recrawl_subject: "Refresh Docker MCP Catalog Packrift entry to current hosted endpoint",
    next_action: "Keep the PR mergeable and respond if Docker review requests changes.",
    listing_url: "https://github.com/docker/mcp-registry/pull/3388",
    submission_url: "https://github.com/docker/mcp-registry/pull/3388",
  },
] as const;

function proofLine(runtime: DirectorySubmitActionsRuntime): string {
  return `Current proof: live MCP returns ${runtime.toolsCount} tools, ${runtime.resourcesCount} resources, and ${runtime.promptsCount} prompts. First-run proof is ${FIRST_RUN_PROOF_URL}; workflow gallery is ${WORKFLOW_GALLERY_URL}; Browserbase Browse skill pack is ${BROWSERBASE_BROWSE_SKILL_PACK_URL}; directory refresh pack is ${DIRECTORY_REFRESH_URL}; install matrix is ${INSTALL_MATRIX_URL}; cart activation proof is ${CART_ACTIVATION_URL}.`;
}

function recrawlMessage(runtime: DirectorySubmitActionsRuntime, action: (typeof ACTIONS)[number]): string {
  const staleMarkers = "stale_markers" in action && action.stale_markers?.length ? [`Current stale/missing markers: ${action.stale_markers.join(", ")}.`, ""] : [];
  return [
    `Subject: ${action.recrawl_subject}`,
    "",
    "Hi,",
    "",
    "Packrift MCP is live as a hosted Streamable HTTP MCP server at https://mcp.packrift.com/mcp.",
    "",
    proofLine(runtime),
    "It requires no buyer-side API key and exposes exact-spec packaging search, live price, live inventory, no-match handling, and measured cart handoff.",
    "",
    ...staleMarkers,
    "Please recrawl/update Packrift using:",
    "- Server name: io.github.Packrift/packrift-mcp",
    "- Title: Packrift MCP",
    "- Remote endpoint: https://mcp.packrift.com/mcp",
    "- Repository: https://github.com/Packrift/packrift-mcp",
    "- Website: https://packrift.com/pages/packrift-ai-agent-instructions",
    "- Description: Exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match.",
    "- All-agent evidence: https://mcp.packrift.com/ai/all-agent-capture.json",
    `- Install matrix: ${INSTALL_MATRIX_URL}`,
    "- Directory refresh pack: https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    `- Directory submit actions: ${DIRECTORY_SUBMIT_ACTIONS_URL}`,
    `- First-run proof: ${FIRST_RUN_PROOF_URL}`,
    `- Workflow gallery: ${WORKFLOW_GALLERY_URL}`,
    `- Browserbase Browse skill pack: ${BROWSERBASE_BROWSE_SKILL_PACK_URL}`,
    `- Cart activation playbook: ${CART_ACTIVATION_URL}`,
    "- Cart handoff candidates: https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    "",
    "Thanks,",
    "Packrift",
  ].join("\n");
}

export function mcpDirectorySubmitActionsPayload(runtime: DirectorySubmitActionsRuntime) {
  const actions = ACTIONS.map((action) => ({
    ...action,
    proof_urls: {
      hosted_endpoint: MCP_ENDPOINT,
      health: "https://mcp.packrift.com/health",
      manifest: "https://mcp.packrift.com/manifest",
      official_registry: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      install_matrix: INSTALL_MATRIX_URL,
      directory_refresh: DIRECTORY_REFRESH_URL,
      directory_submit_actions: DIRECTORY_SUBMIT_ACTIONS_URL,
      cart_activation: CART_ACTIVATION_URL,
      first_run_proof: FIRST_RUN_PROOF_URL,
      workflow_gallery: WORKFLOW_GALLERY_URL,
      browserbase_browse_skill_pack: BROWSERBASE_BROWSE_SKILL_PACK_URL,
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    },
    recrawl_message: recrawlMessage(runtime, action),
  }));
  return {
    release: "PACKRIFT-MCP-DIRECTORY-SUBMIT-ACTIONS-R03",
    generated_at: new Date().toISOString(),
    purpose:
      "Public action queue for converting stale and pending MCP directory surfaces into current Packrift MCP listings that can drive external agent discovery.",
    canonical_endpoint: MCP_ENDPOINT,
    source_directory_refresh: DIRECTORY_REFRESH_URL,
    source_install_matrix: INSTALL_MATRIX_URL,
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    status_counts: actions.reduce<Record<string, number>>((acc, action) => {
      acc[action.action_status] = (acc[action.action_status] ?? 0) + 1;
      return acc;
    }, {}),
    actions,
    operating_rule:
      "Use this as a support/reviewer queue, not as proof that the MCP revenue goal is complete. Completion still requires qualified external MCP sessions, cart landings, and attributed orders.",
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function mcpDirectorySubmitActionsMarkdown(runtime: DirectorySubmitActionsRuntime): string {
  const payload = mcpDirectorySubmitActionsPayload(runtime);
  const rows = payload.actions
    .map(
      (action) =>
        `| ${escapeMarkdown(action.label)} | ${action.action_status} | ${action.directory_status} | ${action.priority} | ${escapeMarkdown(action.next_action)} |`
    )
    .join("\n");
  const messages = payload.actions
    .filter((action) => action.action_status !== "monitor_upstream_registry")
    .map((action) => [`### ${action.label}`, "", action.recrawl_message].join("\n"))
    .join("\n\n");
  return [
    "# Packrift MCP Directory Submit Actions",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Action Queue",
    "",
    "| Target | Action status | Directory status | Priority | Next action |",
    "| --- | --- | --- | --- | --- |",
    rows,
    "",
    "## Copy-Ready Recrawl Messages",
    "",
    messages,
    "",
    "## Operating Rule",
    "",
    payload.operating_rule,
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
    "",
  ].join("\n");
}
