import { allAgentCapturePayload, type AgentCaptureRuntime } from "./agent-capture.js";
import { mcpDirectorySubmitActionsPayload, type DirectorySubmitActionsRuntime } from "./directory-submit-actions.js";
import { TRACKED_INSTALL_TEMPLATE, clineMcpJson, mcpFirstUsefulRun, trackedInstallUrl } from "./install-action.js";

export interface AgentCaptureOutreachRuntime extends AgentCaptureRuntime, DirectorySubmitActionsRuntime {}

interface DirectoryRefreshRow {
  id: string;
  label: string;
  action_status: string;
  directory_status: string;
  priority: string;
  listing_url?: string;
  submission_url?: string;
  tracked_start_url?: string;
  tracked_config_url?: string;
  tracked_run_url?: string;
  tracked_reviewer_activation_url?: string;
  tracked_reviewer_activation_html_url?: string;
  tracked_order_handoff_url?: string;
  tracked_order_handoff_html_url?: string;
  source_eval_pack_url?: string;
  stale_markers: readonly string[];
  next_action: string;
  recrawl_subject?: string;
  recrawl_message?: string;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const CAPTURE_JSON_URL = "https://mcp.packrift.com/ai/all-agent-capture.json";
const CAPTURE_MARKDOWN_URL = "https://mcp.packrift.com/ai/all-agent-capture.md";
const DIRECTORY_SUBMIT_ACTIONS_URL = "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json";
const SOURCE_ACTIVATION_QUEUE_URL = "https://mcp.packrift.com/ai/mcp-source-activation-queue.json";
const SOURCE_ACTIVATION_QUEUE_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-source-activation-queue.md";
const REVENUE_CONVERSION_QUEUE_URL = "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.json";
const REVENUE_CONVERSION_QUEUE_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.md";
const REVENUE_CONVERSION_QUEUE_HTML_URL = "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.html";
const ACTIVATION_EXPERIMENTS_URL = "https://mcp.packrift.com/ai/mcp-activation-experiments.json";
const ACTIVATION_WAVE_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.json";
const ACTIVATION_WAVE_HTML_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.html";
const ACTIVATION_WAVE_RUNNER_URL = "https://mcp.packrift.com/ai/mcp-activation-wave-runner.sh";
const USAGE_SNAPSHOT_URL = "https://mcp.packrift.com/ai/mcp-usage-snapshot.json";
const FUNNEL_SNAPSHOT_URL = "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json";
const GA4_FUNNEL_PROOF_URL = "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json";
const MCP_EVAL_PACK_URL = "https://mcp.packrift.com/ai/mcp-eval-pack.json";
const TRACKED_START_TEMPLATE = "https://mcp.packrift.com/r/start/{source}";
const TRACKED_CONFIG_TEMPLATE = "https://mcp.packrift.com/r/config/{source}";
const TRACKED_RUN_TEMPLATE = "https://mcp.packrift.com/r/run/{source}/{target}";
const TRACKED_REVIEWER_ACTIVATION_TEMPLATE = "https://mcp.packrift.com/r/activate/{source}";
const TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE = "https://mcp.packrift.com/r/activate/{source}?format=html";
const TRACKED_ORDER_HANDOFF_TEMPLATE = "https://mcp.packrift.com/r/order/{source}";
const TRACKED_ORDER_HANDOFF_HTML_TEMPLATE = "https://mcp.packrift.com/r/order/{source}?format=html";

function genericMcpJson() {
  return {
    mcpServers: {
      packrift: {
        type: "http",
        url: MCP_ENDPOINT,
      },
    },
  };
}

function sourceAwareMcpJson(source: string, target: string) {
  return {
    mcpServers: {
      packrift: {
        type: "http",
        url: `${MCP_ENDPOINT}?packrift_mcp_source=${source}&packrift_mcp_target=${target}`,
      },
    },
  };
}

function agentPromptSupport(source: string, target: string) {
  const firstUsefulRun = mcpFirstUsefulRun(source, target);
  return {
    source,
    target,
    source_aware_endpoint: firstUsefulRun.endpoint,
    copy_ready_agent_prompt: firstUsefulRun.agent_prompt,
    copy_ready_curl_script: firstUsefulRun.curl_script,
    json_rpc_sequence: firstUsefulRun.sequence,
    required_success_signals: firstUsefulRun.success_signals,
    agent_prompt_page: `https://mcp.packrift.com/r/run/${source}/${target}?format=html`,
    first_run_execute_url: `https://mcp.packrift.com/r/run/${source}/${target}?execute=1`,
    reviewer_activation_runner: `https://mcp.packrift.com/r/activate/${source}?format=html`,
    buyer_order_handoff: `https://mcp.packrift.com/r/order/${source}?format=html`,
    buyer_order_handoff_json: `https://mcp.packrift.com/r/order/${source}?format=json`,
    generic_mcp_json: sourceAwareMcpJson(source, target),
    claude_code_command: `claude mcp add --transport http packrift "${firstUsefulRun.endpoint}"`,
    codex_command: `codex mcp add packrift --url "${firstUsefulRun.endpoint}"`,
    success_gate:
      "Run tools/list, get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url in the real MCP host; require the returned cart URL to start with https://mcp.packrift.com/r/cart/1066.",
    source_activation_queue: SOURCE_ACTIVATION_QUEUE_URL,
    source_activation_queue_markdown: SOURCE_ACTIVATION_QUEUE_MARKDOWN_URL,
    activation_experiments: ACTIVATION_EXPERIMENTS_URL,
    eval_pack: `${MCP_EVAL_PACK_URL}?source=${source}`,
    usage_snapshot: USAGE_SNAPSHOT_URL,
    funnel_snapshot: FUNNEL_SNAPSHOT_URL,
    ga4_funnel_proof: GA4_FUNNEL_PROOF_URL,
    acceptance_rule:
      "Paste the source-aware prompt into the MCP host and require tools/list, get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url before calling the source activated.",
    order_handoff_rule:
      "Use the source-specific /r/order/{source} page only when a real buyer or reviewer is ready to evaluate checkout after MCP tool-call and cart proof; it does not place an order.",
    suppression_rule:
      "Do not count browser-only proof, Packrift self-checks, or duplicate public issue comments as completed source activation.",
  };
}

function agentInstallSnippets() {
  const firstUsefulRun = mcpFirstUsefulRun("generic", "generic_streamable_http");
  return {
    generic_tracked_start: "https://mcp.packrift.com/r/start/generic",
    generic_tracked_config: "https://mcp.packrift.com/r/config/generic",
    generic_tracked_install_generic: trackedInstallUrl("generic", "generic_streamable_http"),
    generic_tracked_install_codex: trackedInstallUrl("generic", "codex"),
    generic_tracked_install_claude_code: trackedInstallUrl("generic", "claude_code"),
    generic_tracked_install_cline: trackedInstallUrl("generic", "cline"),
    generic_tracked_first_run: "https://mcp.packrift.com/r/run/generic/generic_streamable_http",
    generic_tracked_first_run_claude_code: "https://mcp.packrift.com/r/run/generic/claude_code",
    generic_tracked_first_run_cline: "https://mcp.packrift.com/r/run/generic/cline",
    generic_tracked_first_run_agent_prompt_page: "https://mcp.packrift.com/r/run/generic/generic_streamable_http?format=html",
    generic_agent_prompt: firstUsefulRun.agent_prompt,
    generic_agent_prompt_success_criteria: firstUsefulRun.agent_prompt_success_criteria,
    generic_tracked_reviewer_activation: "https://mcp.packrift.com/r/activate/generic",
    generic_tracked_reviewer_activation_runner: "https://mcp.packrift.com/r/activate/generic?format=html",
    tracked_start_template: TRACKED_START_TEMPLATE,
    tracked_config_template: TRACKED_CONFIG_TEMPLATE,
    tracked_install_template: TRACKED_INSTALL_TEMPLATE,
    tracked_run_template: TRACKED_RUN_TEMPLATE,
    tracked_reviewer_activation_template: TRACKED_REVIEWER_ACTIVATION_TEMPLATE,
    tracked_reviewer_activation_html_template: TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE,
    tracked_order_handoff_template: TRACKED_ORDER_HANDOFF_TEMPLATE,
    tracked_order_handoff_html_template: TRACKED_ORDER_HANDOFF_HTML_TEMPLATE,
    generic_mcp_json: genericMcpJson(),
    claude_code: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
    codex: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
    claude_desktop_config: genericMcpJson(),
    cursor_windsurf_vscode_config: genericMcpJson(),
    cline_config: clineMcpJson(),
    cline_tracked_install: "https://mcp.packrift.com/r/install/cline_mcp_marketplace/cline?format=html",
    cline_tracked_first_run: "https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline?format=html",
    client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
    root_mcp_json: "https://mcp.packrift.com/mcp.json",
    well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
    install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
    mcp_eval_pack: MCP_EVAL_PACK_URL,
    docker_optional_only: "docker pull ghcr.io/packrift/packrift-mcp:latest",
  };
}

function browserbaseBrowseCandidate() {
  return {
    status: "catalog_live_installable",
    domain: "packrift.com",
    catalog_url: "https://browse.sh/",
    catalog_check_command: "browse skills find packrift",
    catalog_slug: "packrift.com/exact-spec-packaging-procurement-e4ujmy",
    catalog_task: "exact-spec-packaging-procurement-e4ujmy",
    catalog_name: "exact-spec-packaging-procurement",
    catalog_title: "Packrift Exact-Spec Packaging Procurement",
    category: "packaging",
    tags: ["packaging", "procurement", "mcp", "shopify", "exact-match", "b2b", "ai-commerce"],
    recommended_method: "mcp",
    verified: true,
    proxies: true,
    install_count_observed: 6,
    catalog_source_url: "https://github.com/browserbase/browse.sh/blob/main/skills/packrift.com/exact-spec-packaging-procurement-e4ujmy/SKILL.md",
    submitted_at: "2026-05-19",
    first_seen_in_catalog_at: "2026-05-19",
    submitted_contact: "partnerships@packrift.com",
    install_check: {
      command: "browse skills add packrift.com/exact-spec-packaging-procurement-e4ujmy",
      status: "pass",
      observed_at: "2026-05-19",
      installed_local_path: ".agents/skills/exact-spec-packaging-procurement",
      summary: "Browse downloaded and installed the Packrift skill locally for Codex and other agent hosts.",
    },
    skill_md_url: "https://mcp.packrift.com/SKILL.md",
    canonical_skill_md_url: "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md",
    skill_pack_url: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
    product_positioning:
      "Packrift should be a read-first packaging procurement skill if Browse adds a retailer or domain submission lane. Browser discovery should not replace MCP; live price, inventory, shipping, and cart handoff must route through the hosted MCP endpoint.",
    required_rule:
      "Do not present nearby dimensions, material, color, adhesive, printer type, count, strength rating, or SKU as an exact substitute.",
    canonical_endpoint: MCP_ENDPOINT,
    proof_url: CAPTURE_JSON_URL,
  };
}

function trackedUrls(rows: DirectoryRefreshRow[], source: string) {
  const row = rows.find((action) => action.id === source);
  return {
    tracked_start_url: row?.tracked_start_url ?? TRACKED_START_TEMPLATE.replace("{source}", source),
    tracked_config_url: row?.tracked_config_url ?? TRACKED_CONFIG_TEMPLATE.replace("{source}", source),
    tracked_reviewer_activation_url: row?.tracked_reviewer_activation_url ?? TRACKED_REVIEWER_ACTIVATION_TEMPLATE.replace("{source}", source),
    tracked_reviewer_activation_html_url: row?.tracked_reviewer_activation_html_url ?? TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE.replace("{source}", source),
    tracked_order_handoff_url: row?.tracked_order_handoff_url ?? TRACKED_ORDER_HANDOFF_TEMPLATE.replace("{source}", source),
    tracked_order_handoff_html_url: row?.tracked_order_handoff_html_url ?? TRACKED_ORDER_HANDOFF_HTML_TEMPLATE.replace("{source}", source),
  };
}

function browserAssistedSubmissions(runtime: AgentCaptureOutreachRuntime, rows: DirectoryRefreshRow[]) {
  const mcpSo = trackedUrls(rows, "mcp_so");
  const claude = trackedUrls(rows, "anthropic_connectors_directory");
  const browse = trackedUrls(rows, "browse_sh");
  const proofLine = `Hosted no-auth Streamable HTTP MCP for exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match recovery. Endpoint: ${MCP_ENDPOINT}. Current health: version ${runtime.serverVersion}, ${runtime.toolsCount} tools, ${runtime.resourcesCount} resources.`;
  const mcpSoPromptSupport = agentPromptSupport("mcp_so", "generic_streamable_http");
  const claudePromptSupport = agentPromptSupport("anthropic_connectors_directory", "claude_code");
  const browsePromptSupport = agentPromptSupport("browse_sh", "codex");

  return {
    mcp_so: {
      status: "submitted_pending",
      submission_url: "https://github.com/chatmcp/mcpso/issues/2189",
      listing_url: "https://mcp.so/servers?keyword=Packrift",
      auth_gate:
        "MCP.so's public form is owner-auth gated, so the existing chatmcp/mcpso issue #2189 was updated with current proof on 2026-05-19. Do not create a duplicate submission unless MCP.so asks for a fresh authenticated form entry.",
      inspected_submit_endpoint: "POST https://mcp.so/api/submit-project",
      fields: {
        name: "Packrift MCP",
        type: "server",
        url: "https://github.com/Packrift/packrift-mcp",
        server_config: JSON.stringify(genericMcpJson(), null, 2),
        is_innovation: false,
        is_dxt: false,
      },
      supporting_copy: proofLine,
      agent_prompt_support: mcpSoPromptSupport,
      buyer_order_handoff: "https://mcp.packrift.com/r/order/mcp_so?format=html",
      buyer_order_handoff_json: "https://mcp.packrift.com/r/order/mcp_so?format=json",
      order_handoff_rule:
        "Use this after MCP.so source proof reaches real MCP tool calls and a measured cart handoff, then route a buyer or reviewer through checkout evaluation without placing an order.",
      ...mcpSo,
    },
    claude_connectors_directory: {
      status: "google_form_auth_required",
      submission_url: "https://clau.de/mcp-directory-submission",
      listing_url: "https://claude.com/connectors",
      auth_gate:
        "The Claude Connectors Directory submission redirects to a Google Forms sign-in gate before fields are visible. Use the live Claude packet as the source of truth after signing in.",
      source_packet: "https://mcp.packrift.com/ai/claude-connector-submission.json",
      source_packet_markdown: "https://mcp.packrift.com/ai/claude-connector-submission.md",
      fields_source:
        "Use suggested_form_fields, allowed_redirect_hosts, live_proof_urls, activation_readiness, buyer_safety_rules, and claude_install from the Claude connector submission packet.",
      high_priority_fields: {
        name: "Packrift MCP",
        category: "Business",
        server_url: MCP_ENDPOINT,
        website_url: "https://packrift.com/pages/packrift-ai-agent-instructions",
        repository_url: "https://github.com/Packrift/packrift-mcp",
        support_url: "https://packrift.com/pages/contact",
        privacy_policy_url: "https://packrift.com/policies/privacy-policy",
        terms_of_service_url: "https://packrift.com/policies/terms-of-service",
        description:
          "Hosted no-auth remote MCP for exact-spec Packrift packaging search with live price, inventory, shipping, cart handoff, and no-match recovery.",
      },
      agent_prompt_support: claudePromptSupport,
      activation_packet: {
        tracked_claude_code_install: "https://mcp.packrift.com/r/install/anthropic_connectors_directory/claude_code?format=html",
        tracked_claude_desktop_install: "https://mcp.packrift.com/r/install/anthropic_connectors_directory/claude_desktop?format=html",
        tracked_claude_code_first_run: "https://mcp.packrift.com/r/run/anthropic_connectors_directory/claude_code?format=html",
        tracked_claude_desktop_first_run: "https://mcp.packrift.com/r/run/anthropic_connectors_directory/claude_desktop?format=html",
        reviewer_activation_runner: "https://mcp.packrift.com/r/activate/anthropic_connectors_directory?format=html",
        buyer_order_handoff: "https://mcp.packrift.com/r/order/anthropic_connectors_directory?format=html",
        source_aware_claude_code_command: claudePromptSupport.claude_code_command,
        source_aware_mcp_json: claudePromptSupport.generic_mcp_json,
        copy_ready_agent_prompt: claudePromptSupport.copy_ready_agent_prompt,
        acceptance_gate:
          "Review is complete only after a Claude MCP host can install the existing hosted endpoint and reach create_cart_url with source attribution.",
        order_handoff_rule:
          "Use the source-specific order handoff only for buyer/reviewer checkout follow-through after MCP proof; it does not place an order.",
      },
      ...claude,
    },
    browse_sh: {
      status: "catalog_live_installable",
      submission_url: "https://browse.sh/",
      listing_url: "https://browse.sh/",
      catalog_check_command: "browse skills find packrift",
      catalog_slug: "packrift.com/exact-spec-packaging-procurement-e4ujmy",
      catalog_task: "exact-spec-packaging-procurement-e4ujmy",
      catalog_name: "exact-spec-packaging-procurement",
      catalog_title: "Packrift Exact-Spec Packaging Procurement",
      category: "packaging",
      tags: ["packaging", "procurement", "mcp", "shopify", "exact-match", "b2b", "ai-commerce"],
      recommended_method: "mcp",
      verified: true,
      proxies: true,
      install_count_observed: 6,
      catalog_source_url: "https://github.com/browserbase/browse.sh/blob/main/skills/packrift.com/exact-spec-packaging-procurement-e4ujmy/SKILL.md",
      submitted_at: "2026-05-19",
      first_seen_in_catalog_at: "2026-05-19",
      submitted_contact: "partnerships@packrift.com",
      submission_note:
        "Submitted through the Browse Add website flow on 2026-05-19 and now live as a verified MCP-first Browse skill. browse skills add installed it locally; keep the hosted MCP endpoint as the live fact and cart-handoff authority.",
      install_check: {
        command: "browse skills add packrift.com/exact-spec-packaging-procurement-e4ujmy",
        status: "pass",
        observed_at: "2026-05-19",
        installed_local_path: ".agents/skills/exact-spec-packaging-procurement",
        summary: "Browse downloaded and installed the Packrift skill locally for Codex and other agent hosts.",
      },
      fields: {
        domain: "packrift.com",
        title: "Packrift Exact-Spec Packaging Procurement",
        category: "shopping",
        recommended_method: "hybrid",
        skill_md_url: "https://mcp.packrift.com/SKILL.md",
        canonical_skill_md_url: "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md",
        skill_pack_url: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
        browser_agent_bridge_url: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
        mcp_endpoint: MCP_ENDPOINT,
        description:
          "Find exact Packrift packaging SKUs, confirm live price and inventory through the hosted MCP endpoint, and return measured cart or quote handoffs. Read-first browser discovery; MCP-confirmed commercial facts.",
        tags: ["packaging", "procurement", "shopping", "mcp", "shopify", "cart-handoff", "inventory"],
        safe_operation: "Read-only discovery until the agent calls Packrift MCP for live price, inventory, shipping, and cart handoff.",
      },
      supporting_copy: proofLine,
      agent_prompt_support: browsePromptSupport,
      ...browse,
    },
  };
}

function evidenceLinks() {
  return {
    canonical_mcp_endpoint: MCP_ENDPOINT,
    mcp_start: "https://mcp.packrift.com/start",
    mcp_start_json: "https://mcp.packrift.com/ai/mcp-start.json",
    tracked_start_template: TRACKED_START_TEMPLATE,
    tracked_config_template: TRACKED_CONFIG_TEMPLATE,
    tracked_run_template: TRACKED_RUN_TEMPLATE,
    tracked_reviewer_activation_template: TRACKED_REVIEWER_ACTIVATION_TEMPLATE,
    tracked_reviewer_activation_html_template: TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE,
    tracked_order_handoff_template: TRACKED_ORDER_HANDOFF_TEMPLATE,
    tracked_order_handoff_html_template: TRACKED_ORDER_HANDOFF_HTML_TEMPLATE,
    mcp_order_handoff_generic: "https://mcp.packrift.com/r/order/generic?format=html",
    mcp_order_handoff_mcp_so: "https://mcp.packrift.com/r/order/mcp_so?format=html",
    mcp_order_handoff_cline: "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html",
    mcp_order_handoff_docker: "https://mcp.packrift.com/r/order/docker_mcp_catalog?format=html",
    all_agent_capture_json: CAPTURE_JSON_URL,
    all_agent_capture_markdown: CAPTURE_MARKDOWN_URL,
    agent_capture_outreach_json: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
    agent_capture_outreach_markdown: "https://mcp.packrift.com/ai/agent-capture-outreach.md",
    mcp_adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
    mcp_install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
    mcp_client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
    mcp_first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
    mcp_first_run_agent_prompt_page: "https://mcp.packrift.com/r/run/generic/generic_streamable_http?format=html",
    mcp_reviewer_activation: "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
    mcp_reviewer_activation_runner_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
    mcp_eval_pack: MCP_EVAL_PACK_URL,
    mcp_eval_pack_template: "https://mcp.packrift.com/ai/mcp-eval-pack.json?source={source}",
    mcp_source_activation_queue: SOURCE_ACTIVATION_QUEUE_URL,
    mcp_source_activation_queue_markdown: SOURCE_ACTIVATION_QUEUE_MARKDOWN_URL,
    mcp_revenue_conversion_queue: REVENUE_CONVERSION_QUEUE_URL,
    mcp_revenue_conversion_queue_markdown: REVENUE_CONVERSION_QUEUE_MARKDOWN_URL,
    mcp_revenue_conversion_queue_html: REVENUE_CONVERSION_QUEUE_HTML_URL,
    mcp_activation_experiments: ACTIVATION_EXPERIMENTS_URL,
    mcp_activation_wave: ACTIVATION_WAVE_URL,
    mcp_activation_wave_html: ACTIVATION_WAVE_HTML_URL,
    mcp_activation_wave_runner_shell: ACTIVATION_WAVE_RUNNER_URL,
    mcp_usage_snapshot: USAGE_SNAPSHOT_URL,
    mcp_buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
    mcp_cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
    mcp_first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
    mcp_workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
    mcp_automation_workflows: "https://mcp.packrift.com/ai/mcp-automation-workflows.json",
    mcp_n8n_workflow_import: "https://mcp.packrift.com/ai/mcp-n8n-workflow.json",
    browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
    browserbase_browse_skill_pack: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
    directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    directory_submit_actions: DIRECTORY_SUBMIT_ACTIONS_URL,
    claude_connector_submission: "https://mcp.packrift.com/ai/claude-connector-submission.json",
    health: "https://mcp.packrift.com/health",
    manifest: "https://mcp.packrift.com/manifest",
    server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
    official_registry: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    glama_connector: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    mcp_marketplace: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
    browse_sh: "https://browse.sh/",
    cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
    mcp_funnel_snapshot: FUNNEL_SNAPSHOT_URL,
    mcp_ga4_funnel_proof: GA4_FUNNEL_PROOF_URL,
    llms_txt: "https://mcp.packrift.com/llms.txt",
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

export function agentCaptureOutreachPayload(runtime: AgentCaptureOutreachRuntime) {
  const capture = allAgentCapturePayload(runtime);
  const submitActions = mcpDirectorySubmitActionsPayload(runtime);
  const directoryRefreshes: DirectoryRefreshRow[] = submitActions.actions.map((action) => ({
    id: action.id,
    label: action.label,
    action_status: action.action_status,
    directory_status: action.directory_status,
    priority: action.priority,
    listing_url: action.listing_url,
    submission_url: action.submission_url,
    tracked_start_url: action.tracked_start_url,
    tracked_config_url: action.tracked_config_url,
    tracked_run_url: action.tracked_run_urls?.generic_streamable_http,
    tracked_reviewer_activation_url: action.proof_urls?.tracked_reviewer_activation,
    tracked_reviewer_activation_html_url: action.proof_urls?.tracked_reviewer_activation_html,
    tracked_order_handoff_url: action.proof_urls?.tracked_order_handoff,
    tracked_order_handoff_html_url: action.proof_urls?.tracked_order_handoff_html,
    source_eval_pack_url: action.proof_urls?.source_eval_pack,
    stale_markers: "stale_markers" in action ? Array.from(action.stale_markers ?? []) : [],
    next_action: action.next_action,
    recrawl_subject: action.recrawl_subject,
    recrawl_message: action.recrawl_message,
  }));
  const priorityQueue = directoryRefreshes.filter(
    (action) =>
      action.priority === "high" &&
      !["monitor_upstream_registry", "submitted_pending", "pending_merge"].includes(action.action_status)
  );

  return {
    release: "PACKRIFT-AGENT-CAPTURE-OUTREACH-R22",
    generated_at: new Date().toISOString(),
    purpose:
      "Single public packet for getting Packrift MCP into more agent hosts, directories, reviewers, partners, and AI-commerce workflows without creating a duplicate Packrift CLI or buyer surface.",
    canonical_endpoint: MCP_ENDPOINT,
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    capture_summary: {
      release: capture.release,
      status: capture.status,
      total_surfaces: capture.counts.total_surfaces,
      live_surfaces: capture.counts.live,
      ready_surfaces: capture.counts.ready,
      monitored_surfaces: capture.counts.monitored,
      candidate_surfaces: capture.counts.candidate,
      hub_urls: capture.hub_urls,
    },
    directory_submit_actions: {
      release: submitActions.release,
      tracked_start_template: submitActions.tracked_start_template,
      tracked_config_template: submitActions.tracked_config_template,
      tracked_run_template: submitActions.tracked_run_template,
      tracked_reviewer_activation_template: submitActions.tracked_reviewer_activation_template,
      tracked_reviewer_activation_html_template: submitActions.tracked_reviewer_activation_html_template,
      tracked_order_handoff_template: submitActions.tracked_order_handoff_template,
      tracked_order_handoff_html_template: submitActions.tracked_order_handoff_html_template,
      source_activation_queue: SOURCE_ACTIVATION_QUEUE_URL,
      source_activation_wave: ACTIVATION_WAVE_URL,
      source_activation_wave_html: ACTIVATION_WAVE_HTML_URL,
      source_activation_wave_runner_shell: ACTIVATION_WAVE_RUNNER_URL,
      status_counts: submitActions.status_counts,
      actions_count: submitActions.actions.length,
    },
    activation_handoff: {
      status: "work_the_existing_mcp_endpoint",
      goal:
        "Move directory and agent-host attention from listing clicks into real source-attributed MCP runs, measured /r/cart handoffs, and orders.",
      canonical_endpoint: MCP_ENDPOINT,
      proof_urls: {
        source_activation_queue: SOURCE_ACTIVATION_QUEUE_URL,
        activation_experiments: ACTIVATION_EXPERIMENTS_URL,
        activation_wave: ACTIVATION_WAVE_URL,
        activation_wave_html: ACTIVATION_WAVE_HTML_URL,
        activation_wave_runner_shell: ACTIVATION_WAVE_RUNNER_URL,
        revenue_conversion_queue: REVENUE_CONVERSION_QUEUE_URL,
        revenue_conversion_queue_html: REVENUE_CONVERSION_QUEUE_HTML_URL,
        order_handoff_template: TRACKED_ORDER_HANDOFF_TEMPLATE,
        order_handoff_html_template: TRACKED_ORDER_HANDOFF_HTML_TEMPLATE,
        order_handoff_mcp_so: "https://mcp.packrift.com/r/order/mcp_so?format=html",
        order_handoff_cline: "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html",
        order_handoff_docker: "https://mcp.packrift.com/r/order/docker_mcp_catalog?format=html",
        eval_pack: MCP_EVAL_PACK_URL,
        eval_pack_template: "https://mcp.packrift.com/ai/mcp-eval-pack.json?source={source}",
        usage_snapshot: USAGE_SNAPSHOT_URL,
        funnel_snapshot: FUNNEL_SNAPSHOT_URL,
        ga4_funnel_proof: GA4_FUNNEL_PROOF_URL,
      },
      reviewer_acceptance_gate: [
        "Use the existing hosted MCP endpoint.",
        "Install with a source-specific /r/install/{source}/{target} link.",
        "Run a source-specific /r/run/{source}/{target} or /r/activate/{source}?format=html flow.",
        "Use /ai/mcp-eval-pack.json?source={source} when reviewers need copy-ready host acceptance cases.",
        "Require tools/list plus get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url.",
        "Use /r/order/{source}?format=html only for buyer or reviewer checkout follow-through after source-level MCP tool-call and cart proof; it does not place an order.",
        "Do not create duplicate CLIs, storefronts, buyer pages, or duplicate public issue comments.",
      ],
    },
    evidence: evidenceLinks(),
    priority_queue: priorityQueue,
    directory_refreshes: directoryRefreshes,
    browser_assisted_submissions: browserAssistedSubmissions(runtime, directoryRefreshes),
    browserbase_browse_candidate: browserbaseBrowseCandidate(),
    agent_install_snippets: agentInstallSnippets(),
    operating_rules: [
      "Use the existing hosted MCP endpoint as the product surface: https://mcp.packrift.com/mcp.",
      "Use tracked /r/start/{source} and /r/config/{source} links in every directory, partner, and agent-host handoff.",
      "Use tracked /r/run/{source}/{target} links to move installed users into the first useful run and measure first-run intent.",
      "Use the copy-ready agent prompt from /r/run/{source}/{target}?format=html and /r/activate/{source}?format=html when the next step is a real MCP run, not another listing click.",
      "Use tracked /r/activate/{source}?format=html browser runners when proof clicks need to become real MCP client calls and create_cart_url output.",
      "Use tracked /r/order/{source}?format=html buyer/reviewer handoffs after real MCP tool-call and cart proof when the next missing event is a source-attributed order.",
      "Use the eval pack when a host, marketplace, or reviewer needs copy-ready acceptance cases for a real external MCP install.",
      "Use the source activation queue to pick the next source-specific run that moves starts, installs, tool calls, cart landings, and orders forward.",
      "Use the revenue conversion queue only for mature sources that already have real MCP tool-call and qualified cart-landing proof.",
      "Use the start page for first install, the install matrix for host-specific setup, and the workflow gallery for demo/eval flows.",
      "Route Browserbase Browse and other browser agents through read-first public resources, then confirm live commerce facts through MCP.",
      "Do not create or promote a separate Packrift CLI or duplicate buyer interface.",
      "Treat this packet as distribution infrastructure, not as proof that thousands of qualified users have been reached.",
    ],
    success_gate:
      "This outreach packet succeeds only when it drives qualified external installs, tools/list calls, get_cart_handoff_candidates calls, measured /r/cart landings, and MCP-attributed orders.",
  };
}

export function agentCaptureOutreachMarkdown(runtime: AgentCaptureOutreachRuntime): string {
  const payload = agentCaptureOutreachPayload(runtime);
  const priorityRows = payload.priority_queue
    .map(
      (action) =>
        `| ${escapeMarkdown(action.label)} | ${action.action_status} | ${action.directory_status} | ${action.tracked_start_url} | ${action.tracked_config_url} | ${action.tracked_run_url ?? ""} | ${action.tracked_reviewer_activation_url ?? ""} | ${action.tracked_reviewer_activation_html_url ?? ""} | ${action.tracked_order_handoff_html_url ?? ""} | ${action.source_eval_pack_url ?? ""} | ${escapeMarkdown(action.next_action)} |`
    )
    .join("\n");
  const directoryRows = payload.directory_refreshes
    .map(
      (action) =>
        `| ${escapeMarkdown(action.label)} | ${action.action_status} | ${action.directory_status} | ${action.priority} | ${action.tracked_start_url} | ${action.tracked_config_url} | ${action.tracked_run_url ?? ""} | ${action.tracked_reviewer_activation_url ?? ""} | ${action.tracked_reviewer_activation_html_url ?? ""} | ${action.tracked_order_handoff_html_url ?? ""} | ${action.source_eval_pack_url ?? ""} |`
    )
    .join("\n");
  const messages = payload.directory_refreshes
    .filter((action) => action.action_status !== "monitor_upstream_registry")
    .map((action) => [`### ${action.label}`, "", "```text", action.recrawl_message, "```"].join("\n"))
    .join("\n\n");

  return [
    "# Packrift Agent Capture Outreach Pack",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Runtime",
    "",
    `- Tools: ${payload.runtime.tools_count}`,
    `- Resources: ${payload.runtime.resources_count}`,
    `- Prompts: ${payload.runtime.prompts_count}`,
    `- Capture surfaces: ${payload.capture_summary.total_surfaces}`,
    "",
    "## Highest Priority Queue",
    "",
    "| Surface | Action status | Directory status | Tracked start | Tracked config | Tracked first run | Activation handoff | Activation runner | Order handoff | Eval pack | Next action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    priorityRows || "| none | pass | pass | | | | | | | | |",
    "",
    "## Activation Handoff",
    "",
    fencedJson(payload.activation_handoff),
    "",
    "## All Directory Refreshes",
    "",
    "| Surface | Action status | Directory status | Priority | Tracked start | Tracked config | Tracked first run | Activation handoff | Activation runner | Order handoff | Eval pack |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    directoryRows,
    "",
    "## Browser-Assisted Submission Payloads",
    "",
    fencedJson(payload.browser_assisted_submissions),
    "",
    "## Evidence Links",
    "",
    Object.entries(payload.evidence)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Agent Install Snippets",
    "",
    fencedJson(payload.agent_install_snippets),
    "",
    "## Browserbase Browse Candidate",
    "",
    fencedJson(payload.browserbase_browse_candidate),
    "",
    "## Copy-Ready Directory Messages",
    "",
    messages || "No directory messages required.",
    "",
    "## Operating Rules",
    "",
    payload.operating_rules.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Success Gate",
    "",
    payload.success_gate,
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/agent-capture-outreach.json",
    "",
  ].join("\n");
}
