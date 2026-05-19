import { TRACKED_INSTALL_TEMPLATE, mcpFirstUsefulRun, trackedInstallUrl } from "./install-action.js";
import { TRACKED_RUN_TEMPLATE, trackedRunUrl } from "./first-run-action.js";

export interface DirectorySubmitActionsRuntime {
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
const DIRECTORY_REFRESH_URL = "https://mcp.packrift.com/ai/mcp-directory-refresh.json";
const INSTALL_MATRIX_URL = "https://mcp.packrift.com/ai/mcp-install-matrix.json";
const CLIENT_CONFIG_URL = "https://mcp.packrift.com/ai/mcp-client-config.json";
const ROOT_MCP_JSON_URL = "https://mcp.packrift.com/mcp.json";
const WELL_KNOWN_MCP_JSON_URL = "https://mcp.packrift.com/.well-known/mcp.json";
const DIRECTORY_SUBMIT_ACTIONS_URL = "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json";
const CLAUDE_CONNECTOR_SUBMISSION_URL = "https://mcp.packrift.com/ai/claude-connector-submission.json";
const AGENT_CAPTURE_OUTREACH_URL = "https://mcp.packrift.com/ai/agent-capture-outreach.json";
const CART_ACTIVATION_URL = "https://mcp.packrift.com/ai/mcp-cart-activation.json";
const FUNNEL_SNAPSHOT_URL = "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json";
const FIRST_RUN_PROOF_URL = "https://mcp.packrift.com/ai/mcp-first-run-proof.json";
const WORKFLOW_GALLERY_URL = "https://mcp.packrift.com/ai/mcp-workflow-gallery.json";
const ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/SKILL.md";
const BROWSERBASE_BROWSE_SKILL_PACK_URL = "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json";
const CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md";

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
    id: "anthropic_connectors_directory",
    label: "Claude Connectors Directory",
    action_status: "manual_submission_ready",
    directory_status: "unlisted",
    priority: "high",
    method: "Manual directory submission form.",
    evidence: "Submission docs and form are public, but listing review is manual.",
    stale_markers: ["Packrift not yet visible in Claude connector discovery"],
    recrawl_subject: "Submit Packrift MCP to the Claude Connectors Directory",
    next_action: "Use the Claude connector submission packet plus the manual form with hosted endpoint, no-auth policy, legal/support links, first-run proof, and tracked start/config URLs.",
    listing_url: "https://claude.com/connectors",
    submission_url: "https://clau.de/mcp-directory-submission",
  },
  {
    id: "smithery",
    label: "Smithery",
    action_status: "api_key_required",
    directory_status: "unlisted",
    priority: "high",
    method: "Smithery publish flow or CLI publish with API key.",
    evidence: "The CLI publish path is gated by a Smithery API key; the public server card now exposes schema-friendly fields.",
    stale_markers: ["Packrift not visible in Smithery search"],
    recrawl_subject: "Publish Packrift MCP to Smithery",
    next_action: "Publish through Smithery with the hosted endpoint after authenticating, then monitor search listing and installs.",
    listing_url: "https://smithery.ai/servers?q=Packrift",
    submission_url: "https://smithery.ai/new",
  },
  {
    id: "cline_mcp_marketplace",
    label: "Cline MCP Marketplace",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "high",
    method: "GitHub issue submission.",
    evidence:
      "Cline MCP Marketplace issue #1610 is open; the latest proof comment now includes R11/R04 snapshots and the source-aware first_useful_run sequence.",
    stale_markers: ["Packrift not yet visible as a published Cline marketplace listing"],
    recrawl_subject: "Review Cline MCP Marketplace Packrift MCP submission",
    next_action:
      "Monitor for marketplace publication; reviewers can use the linked first_useful_run sequence, and further comments should only respond to maintainer requests.",
    listing_url: "https://github.com/cline/mcp-marketplace/issues/1610",
    submission_url: "https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml",
  },
  {
    id: "mcp_so",
    label: "MCP.so",
    action_status: "manual_submission_ready",
    directory_status: "unlisted",
    priority: "high",
    method: "Manual submit form.",
    evidence: "The public submit form is reachable, but Packrift is not confirmed in listing results.",
    stale_markers: ["Packrift not visible as a confirmed MCP.so server result"],
    recrawl_subject: "Submit Packrift MCP to MCP.so",
    next_action: "Submit or claim Packrift MCP with hosted endpoint, tracked start URL, and exact-spec packaging copy.",
    listing_url: "https://mcp.so/servers?keyword=Packrift",
    submission_url: "https://mcp.so/submit",
  },
  {
    id: "browse_sh",
    label: "Browserbase Browse / browse.sh",
    action_status: "catalog_live_installable",
    directory_status: "pass",
    priority: "high",
    method: "Browse Add website / catalog skill submission flow.",
    evidence:
      "Browse accepted and published Packrift on 2026-05-19 as packrift.com/exact-spec-packaging-procurement-e4ujmy. browse skills find returns verified=true, recommendedMethod=mcp, proxies=true, and browse skills add installed the skill locally.",
    stale_markers: [],
    recrawl_subject: "Keep Packrift Browse catalog skill current",
    next_action:
      "Monitor Browse install count and skill quality, keep the Packrift MCP endpoint current, and update the skill if Browserbase changes the generated source or catalog slug.",
    listing_url: "https://browse.sh/",
    submission_url: "https://browse.sh/",
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
    id: "mcpmarket_com",
    label: "MCP Market",
    action_status: "manual_update_needed",
    directory_status: "blocked",
    priority: "medium",
    method: "Manual listing claim/update.",
    evidence: "Automated checks hit a Vercel security checkpoint; use browser-side verification and update flow.",
    stale_markers: ["checker blocked", "hosted endpoint/current server card not verified by automation"],
    recrawl_subject: "Update MCP Market Packrift MCP listing to current hosted endpoint",
    next_action: "Open the MCP Market listing/update flow in the browser and align it to the hosted endpoint and current server card.",
    listing_url: "https://mcpmarket.com/server/packrift",
    submission_url: "https://mcpmarket.com/submit",
  },
  {
    id: "cursor_directory",
    label: "Cursor Directory",
    action_status: "auth_gated_manual",
    directory_status: "blocked",
    priority: "medium",
    method: "Auth-gated manual submit flow.",
    evidence: "Automated checks hit a Vercel security checkpoint before reaching the plugin submission flow.",
    stale_markers: ["checker blocked", "Packrift not verified in Cursor Directory"],
    recrawl_subject: "Submit Packrift MCP to Cursor Directory",
    next_action: "Use the Cursor Directory plugin submit flow after browser auth, with hosted endpoint and tracked start URL.",
    listing_url: "https://cursor.directory/",
    submission_url: "https://cursor.directory/plugins/new",
  },
  {
    id: "mcpcentral",
    label: "MCP Central",
    action_status: "auth_gated_manual",
    directory_status: "blocked",
    priority: "medium",
    method: "Browser-side submit flow.",
    evidence: "Automated checks hit a Cloudflare challenge.",
    stale_markers: ["checker blocked", "Packrift not verified in MCP Central"],
    recrawl_subject: "Submit Packrift MCP to MCP Central",
    next_action: "Use the browser-side MCP Central submit flow or request review access if auth is required.",
    listing_url: "https://mcpcentral.io/servers",
    submission_url: "https://mcpcentral.io/submit-server",
  },
  {
    id: "mcpfinder",
    label: "MCPfinder",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "medium",
    method: "Manual submit form.",
    evidence: "Free listing form POST returned 200 OK; Packrift is not visible in the browsable index yet.",
    stale_markers: ["Packrift not visible in MCPfinder"],
    recrawl_subject: "Submit Packrift MCP to MCPfinder",
    next_action: "Monitor for listing approval and provide endpoint proof if MCPfinder asks for more detail.",
    listing_url: "https://www.mcpfinder.org/",
    submission_url: "https://www.mcpfinder.org/submit",
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
    id: "mcpskills",
    label: "MCPSkills",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "medium",
    method: "Submitted through the public /api/submit endpoint.",
    evidence: "Submission returned a success redirect after posting the GitHub repo, ai-tools category, and short hosted MCP description.",
    stale_markers: ["Packrift not yet visible on the server directory"],
    recrawl_subject: "Review MCPSkills Packrift MCP submission",
    next_action: "Monitor for listing publication; use the refreshed proof message if review asks for current endpoint evidence.",
    listing_url: "https://mcpskills.app/servers",
    submission_url: "https://mcpskills.app/submit",
  },
  {
    id: "agentndx",
    label: "AgentNDX",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "medium",
    method: "Submitted through the public /api/submit endpoint.",
    evidence: "Submission returned a success redirect after posting name, GitHub repo, hosted start page, MCP protocol, and short description.",
    stale_markers: ["Packrift not yet visible on the browse directory"],
    recrawl_subject: "Review AgentNDX Packrift MCP submission",
    next_action: "Monitor for listing publication; use the refreshed proof message if review asks for current endpoint evidence.",
    listing_url: "https://agentndx.ai/browse",
    submission_url: "https://agentndx.ai/submit",
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
    evidence:
      "Docker MCP Catalog PR #3388 is open and mergeable; the latest proof comment now includes R11/R04 snapshots and the source-aware first_useful_run sequence.",
    recrawl_subject: "Refresh Docker MCP Catalog Packrift entry to current hosted endpoint",
    next_action:
      "Monitor for Docker review and publication; reviewers can use the linked first_useful_run sequence, and further comments should only respond to maintainer requests.",
    listing_url: "https://github.com/docker/mcp-registry/pull/3388",
    submission_url: "https://github.com/docker/mcp-registry/pull/3388",
  },
] as const;

function trackedStartUrl(source: string): string {
  const url = new URL(`https://mcp.packrift.com/r/start/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "directory_recrawl");
  url.searchParams.set("utm_campaign", "packrift_mcp_start");
  url.searchParams.set("utm_content", "directory_submit_actions");
  return url.toString();
}

function trackedConfigUrl(source: string): string {
  const url = new URL(`https://mcp.packrift.com/r/config/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "directory_config");
  url.searchParams.set("utm_campaign", "packrift_mcp_install");
  url.searchParams.set("utm_content", "directory_submit_actions");
  return url.toString();
}

function proofLine(runtime: DirectorySubmitActionsRuntime): string {
  return `Current proof: live MCP returns ${runtime.toolsCount} tools, ${runtime.resourcesCount} resources, and ${runtime.promptsCount} prompts. Start page is ${MCP_START_URL}; client config is ${CLIENT_CONFIG_URL}; tracked config template is ${MCP_TRACKED_CONFIG_TEMPLATE}; tracked run template is ${TRACKED_RUN_TEMPLATE}; first-run proof is ${FIRST_RUN_PROOF_URL}; workflow gallery is ${WORKFLOW_GALLERY_URL}; Browserbase Browse SKILL.md is ${ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL}; Browserbase Browse skill pack is ${BROWSERBASE_BROWSE_SKILL_PACK_URL}; directory refresh pack is ${DIRECTORY_REFRESH_URL}; directory outreach packet is ${AGENT_CAPTURE_OUTREACH_URL}; Claude connector submission packet is ${CLAUDE_CONNECTOR_SUBMISSION_URL}; install matrix is ${INSTALL_MATRIX_URL}; cart activation proof is ${CART_ACTIVATION_URL}; tracked first-run actions include a browser page and one-click live proof that reach create_cart_url after live price and inventory checks.`;
}

function recrawlMessage(runtime: DirectorySubmitActionsRuntime, action: (typeof ACTIONS)[number]): string {
  const staleMarkers = "stale_markers" in action && action.stale_markers?.length ? [`Current stale/missing markers: ${action.stale_markers.join(", ")}.`, ""] : [];
  const trackedStart = trackedStartUrl(action.id);
  const trackedConfig = trackedConfigUrl(action.id);
  const trackedInstallCodex = trackedInstallUrl(action.id, "codex");
  const trackedInstallGeneric = trackedInstallUrl(action.id, "generic_streamable_http");
  const trackedInstallGenericMd = `${trackedInstallGeneric}&format=md`;
  const trackedRunGeneric = trackedRunUrl(action.id, "generic_streamable_http");
  const trackedRunGenericHtml = `${trackedRunGeneric}&format=html`;
  const trackedRunGenericExecute = `${trackedRunGeneric}&execute=1`;
  const trackedRunGenericSh = `${trackedRunGeneric}&format=sh`;
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
    "Please recrawl/update Packrift and run the post-install cart verification using:",
    "- Server name: io.github.Packrift/packrift-mcp",
    "- Title: Packrift MCP",
    "- Remote endpoint: https://mcp.packrift.com/mcp",
    `- Tracked start page: ${trackedStart}`,
    `- Tracked MCP JSON config: ${trackedConfig}`,
    `- Tracked Codex install action: ${trackedInstallCodex}`,
    `- Tracked generic install action: ${trackedInstallGeneric}`,
    `- Markdown install action with first-useful-run sequence: ${trackedInstallGenericMd}`,
    `- Tracked first-run action: ${trackedRunGeneric}`,
    `- Browser first-run page: ${trackedRunGenericHtml}`,
    `- One-click live proof: ${trackedRunGenericExecute}`,
    `- One-line first-run shell script: curl -sS '${trackedRunGenericSh}' | bash`,
    `- First useful run: open ${trackedRunGenericHtml}, click Run live proof, or run the first_useful_run JSON-RPC sequence from ${trackedInstallGenericMd}; it reaches get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url.`,
    `- Canonical start page: ${MCP_START_URL}`,
    "- Repository: https://github.com/Packrift/packrift-mcp",
    "- Website: https://packrift.com/pages/packrift-ai-agent-instructions",
    "- Description: Exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match.",
    "- All-agent evidence: https://mcp.packrift.com/ai/all-agent-capture.json",
    `- Start pack: ${MCP_START_JSON_URL}`,
    `- Install matrix: ${INSTALL_MATRIX_URL}`,
    `- Client config: ${CLIENT_CONFIG_URL}`,
    `- Tracked config template: ${MCP_TRACKED_CONFIG_TEMPLATE}`,
    `- Tracked install template: ${TRACKED_INSTALL_TEMPLATE}`,
    `- Root MCP JSON config: ${ROOT_MCP_JSON_URL}`,
    `- Well-known MCP JSON config: ${WELL_KNOWN_MCP_JSON_URL}`,
    "- Directory refresh pack: https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    `- Directory submit actions: ${DIRECTORY_SUBMIT_ACTIONS_URL}`,
    `- Agent capture outreach packet: ${AGENT_CAPTURE_OUTREACH_URL}`,
    `- Claude connector submission packet: ${CLAUDE_CONNECTOR_SUBMISSION_URL}`,
    `- First-run proof: ${FIRST_RUN_PROOF_URL}`,
    `- Workflow gallery: ${WORKFLOW_GALLERY_URL}`,
    `- Browserbase Browse SKILL.md: ${ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL}`,
    `- Browserbase Browse skill pack: ${BROWSERBASE_BROWSE_SKILL_PACK_URL}`,
    `- Canonical Browse skill file: ${CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL}`,
    `- Cart activation playbook: ${CART_ACTIVATION_URL}`,
    `- Funnel proof snapshot: ${FUNNEL_SNAPSHOT_URL}`,
    "- Cart handoff candidates: https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    "",
    "Thanks,",
    "Packrift",
  ].join("\n");
}

export function mcpDirectorySubmitActionsPayload(runtime: DirectorySubmitActionsRuntime) {
  const actions = ACTIONS.map((action) => ({
    ...action,
    tracked_start_url: trackedStartUrl(action.id),
    tracked_config_url: trackedConfigUrl(action.id),
    tracked_install_urls: {
      generic_streamable_http: trackedInstallUrl(action.id, "generic_streamable_http"),
      claude_code: trackedInstallUrl(action.id, "claude_code"),
      codex: trackedInstallUrl(action.id, "codex"),
      cursor_windsurf_vscode: trackedInstallUrl(action.id, "cursor_windsurf_vscode"),
    },
    tracked_run_urls: {
      generic_streamable_http: trackedRunUrl(action.id, "generic_streamable_http"),
      generic_streamable_http_browser: `${trackedRunUrl(action.id, "generic_streamable_http")}&format=html`,
      generic_streamable_http_execute: `${trackedRunUrl(action.id, "generic_streamable_http")}&execute=1`,
      claude_code: trackedRunUrl(action.id, "claude_code"),
      codex: trackedRunUrl(action.id, "codex"),
      cursor_windsurf_vscode: trackedRunUrl(action.id, "cursor_windsurf_vscode"),
    },
    first_useful_run: mcpFirstUsefulRun(action.id, "generic_streamable_http"),
    proof_urls: {
      hosted_endpoint: MCP_ENDPOINT,
      start_page: MCP_START_URL,
      tracked_start: trackedStartUrl(action.id),
      tracked_config: trackedConfigUrl(action.id),
      tracked_install_codex: trackedInstallUrl(action.id, "codex"),
      tracked_install_claude_code: trackedInstallUrl(action.id, "claude_code"),
      tracked_run_generic: trackedRunUrl(action.id, "generic_streamable_http"),
      tracked_run_generic_browser: `${trackedRunUrl(action.id, "generic_streamable_http")}&format=html`,
      tracked_run_generic_execute: `${trackedRunUrl(action.id, "generic_streamable_http")}&execute=1`,
      tracked_run_codex: trackedRunUrl(action.id, "codex"),
      start_pack: MCP_START_JSON_URL,
      health: "https://mcp.packrift.com/health",
      manifest: "https://mcp.packrift.com/manifest",
      official_registry: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      install_matrix: INSTALL_MATRIX_URL,
      directory_refresh: DIRECTORY_REFRESH_URL,
      directory_submit_actions: DIRECTORY_SUBMIT_ACTIONS_URL,
      agent_capture_outreach: AGENT_CAPTURE_OUTREACH_URL,
      claude_connector_submission: CLAUDE_CONNECTOR_SUBMISSION_URL,
      cart_activation: CART_ACTIVATION_URL,
      funnel_snapshot: FUNNEL_SNAPSHOT_URL,
      first_run_proof: FIRST_RUN_PROOF_URL,
      workflow_gallery: WORKFLOW_GALLERY_URL,
      root_browserbase_browse_skill_md: ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL,
      browserbase_browse_skill_pack: BROWSERBASE_BROWSE_SKILL_PACK_URL,
      canonical_browserbase_browse_skill_md: CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL,
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    },
    recrawl_message: recrawlMessage(runtime, action),
  }));
  return {
    release: "PACKRIFT-MCP-DIRECTORY-SUBMIT-ACTIONS-R19",
    generated_at: new Date().toISOString(),
    purpose:
      "Public action queue for converting stale and pending MCP directory surfaces into current Packrift MCP listings that can drive external agent discovery.",
    canonical_endpoint: MCP_ENDPOINT,
    tracked_start_template: MCP_TRACKED_START_TEMPLATE,
    tracked_config_template: MCP_TRACKED_CONFIG_TEMPLATE,
    tracked_install_template: TRACKED_INSTALL_TEMPLATE,
    tracked_run_template: TRACKED_RUN_TEMPLATE,
    source_directory_refresh: DIRECTORY_REFRESH_URL,
    source_install_matrix: INSTALL_MATRIX_URL,
    source_client_config: CLIENT_CONFIG_URL,
    source_root_mcp_json: ROOT_MCP_JSON_URL,
    source_well_known_mcp_json: WELL_KNOWN_MCP_JSON_URL,
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
        `| ${escapeMarkdown(action.label)} | ${action.action_status} | ${action.directory_status} | ${action.priority} | ${action.tracked_start_url} | ${action.tracked_config_url} | ${action.tracked_install_urls.codex} | ${action.tracked_run_urls.generic_streamable_http} | ${action.tracked_run_urls.generic_streamable_http_execute} | ${escapeMarkdown(action.next_action)} |`
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
    `Tracked start template: ${payload.tracked_start_template}`,
    `Tracked config template: ${payload.tracked_config_template}`,
    `Tracked install template: ${payload.tracked_install_template}`,
    `Tracked run template: ${payload.tracked_run_template}`,
    "",
    "| Target | Action status | Directory status | Priority | Tracked start URL | Tracked config URL | Tracked Codex install URL | Tracked first-run URL | Live proof URL | Next action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
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
