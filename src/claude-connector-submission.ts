import { mcpFirstUsefulRun } from "./install-action.js";

export interface ClaudeConnectorSubmissionRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const SOURCE = "anthropic_connectors_directory";
const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const START_URL = "https://mcp.packrift.com/start";
const TRACKED_START_URL =
  "https://mcp.packrift.com/r/start/anthropic_connectors_directory?utm_source=anthropic_connectors_directory&utm_medium=directory_recrawl&utm_campaign=packrift_mcp_start&utm_content=claude_connector_submission";
const TRACKED_CONFIG_URL =
  "https://mcp.packrift.com/r/config/anthropic_connectors_directory?utm_source=anthropic_connectors_directory&utm_medium=directory_config&utm_campaign=packrift_mcp_install&utm_content=claude_connector_submission";
const TRACKED_INSTALL_CLAUDE_CODE_URL =
  "https://mcp.packrift.com/r/install/anthropic_connectors_directory/claude_code?format=html&utm_source=anthropic_connectors_directory&utm_medium=directory_install&utm_campaign=packrift_mcp_install&utm_content=claude_connector_submission";
const TRACKED_INSTALL_CLAUDE_DESKTOP_URL =
  "https://mcp.packrift.com/r/install/anthropic_connectors_directory/claude_desktop?format=html&utm_source=anthropic_connectors_directory&utm_medium=directory_install&utm_campaign=packrift_mcp_install&utm_content=claude_connector_submission";
const TRACKED_FIRST_RUN_CLAUDE_CODE_URL =
  "https://mcp.packrift.com/r/run/anthropic_connectors_directory/claude_code?format=html&utm_source=anthropic_connectors_directory&utm_medium=first_run_action&utm_campaign=packrift_mcp_activation&utm_content=claude_connector_submission";
const TRACKED_FIRST_RUN_CLAUDE_DESKTOP_URL =
  "https://mcp.packrift.com/r/run/anthropic_connectors_directory/claude_desktop?format=html&utm_source=anthropic_connectors_directory&utm_medium=first_run_action&utm_campaign=packrift_mcp_activation&utm_content=claude_connector_submission";
const REVIEWER_ACTIVATION_URL =
  "https://mcp.packrift.com/r/activate/anthropic_connectors_directory?format=html&utm_source=anthropic_connectors_directory&utm_medium=reviewer_activation&utm_campaign=packrift_mcp_activation&utm_content=claude_connector_submission";
const SOURCE_ACTIVATION_QUEUE_URL = "https://mcp.packrift.com/ai/mcp-source-activation-queue.json";
const ACTIVATION_EXPERIMENTS_URL = "https://mcp.packrift.com/ai/mcp-activation-experiments.json";
const ACTIVATION_EXPERIMENTS_HTML_URL = "https://mcp.packrift.com/ai/mcp-activation-experiments.html";
const USAGE_SNAPSHOT_URL = "https://mcp.packrift.com/ai/mcp-usage-snapshot.json";
const FUNNEL_SNAPSHOT_URL = "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json";
const GA4_FUNNEL_PROOF_URL = "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json";

function proofSummary(runtime: ClaudeConnectorSubmissionRuntime): string {
  return `${runtime.toolsCount} annotated tools, ${runtime.promptsCount} prompts, ${runtime.resourcesCount} resources, no-auth hosted Streamable HTTP endpoint, public server card, source-attributed config, source activation queue, activation experiments, usage/funnel proof, first-run proof, workflow gallery, and measured MCP cart handoff candidates.`;
}

function checklistRow(status: "pass" | "ready" | "manual_review", item: string, evidence: string) {
  return { status, item, evidence };
}

export function claudeConnectorSubmissionPayload(runtime: ClaudeConnectorSubmissionRuntime) {
  const summary = proofSummary(runtime);
  const firstUsefulRun = mcpFirstUsefulRun(SOURCE, "claude_code");
  const sourceAwareMcpJsonConfig = {
    mcpServers: {
      packrift: {
        type: "http",
        url: firstUsefulRun.endpoint,
      },
    },
  };
  const copyReadyReviewRequest = [
    "Packrift MCP Claude connector activation request",
    "",
    `Endpoint: ${MCP_ENDPOINT}`,
    `Source-aware endpoint: ${firstUsefulRun.endpoint}`,
    `Claude Code install: claude mcp add --transport http packrift "${firstUsefulRun.endpoint}"`,
    `Tracked install: ${TRACKED_INSTALL_CLAUDE_CODE_URL}`,
    `Tracked first run: ${TRACKED_FIRST_RUN_CLAUDE_CODE_URL}`,
    `Reviewer runner: ${REVIEWER_ACTIVATION_URL}`,
    "",
    "Please install the hosted Streamable HTTP endpoint in a real Claude MCP host, run tools/list, then run get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url for SKU 1066.",
    "Success requires create_cart_url to return a measured https://mcp.packrift.com/r/cart/1066 URL. Do not place an order.",
  ].join("\n");
  return {
    release: "PACKRIFT-CLAUDE-CONNECTOR-SUBMISSION-R04",
    generated_at: new Date().toISOString(),
    status: "manual_submission_ready",
    purpose:
      "Claude Connectors Directory submission packet for Packrift MCP, with form-ready fields, production-readiness proof, and source-attributed install/start links.",
    source: SOURCE,
    official_references: {
      submission_docs: "https://claude.com/docs/connectors/building/submission",
      review_criteria: "https://claude.com/docs/connectors/building/review-criteria",
      submission_form: "https://clau.de/mcp-directory-submission",
    },
    server: {
      name: "Packrift MCP",
      registry_name: "io.github.Packrift/packrift-mcp",
      version: runtime.serverVersion,
      category: "Business",
      short_description:
        "Exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match recovery.",
      long_description:
        "Packrift MCP lets Claude and other AI agents find exact-spec packaging products, confirm live price and inventory, compare alternatives, estimate shipping, and hand off attributed carts to Packrift after buyer confirmation.",
      remote_endpoint: MCP_ENDPOINT,
      transport: "streamable_http",
      authentication: "none_required_for_hosted_endpoint",
      website_url: "https://packrift.com/pages/packrift-ai-agent-instructions",
      repository_url: "https://github.com/Packrift/packrift-mcp",
      support_url: "https://packrift.com/pages/contact",
      privacy_policy_url: "https://packrift.com/policies/privacy-policy",
      terms_of_service_url: "https://packrift.com/policies/terms-of-service",
    },
    claude_install: {
      mcp_json_config: {
        mcpServers: {
          packrift: {
            type: "http",
            url: MCP_ENDPOINT,
          },
        },
      },
      source_aware_mcp_json_config: sourceAwareMcpJsonConfig,
      claude_code_command: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
      source_aware_claude_code_command: `claude mcp add --transport http packrift "${firstUsefulRun.endpoint}"`,
      source_aware_endpoint: firstUsefulRun.endpoint,
      tracked_config_url: TRACKED_CONFIG_URL,
      tracked_start_url: TRACKED_START_URL,
      tracked_install_claude_code_url: TRACKED_INSTALL_CLAUDE_CODE_URL,
      tracked_install_claude_desktop_url: TRACKED_INSTALL_CLAUDE_DESKTOP_URL,
      tracked_first_run_claude_code_url: TRACKED_FIRST_RUN_CLAUDE_CODE_URL,
      tracked_first_run_claude_desktop_url: TRACKED_FIRST_RUN_CLAUDE_DESKTOP_URL,
      reviewer_activation_runner_url: REVIEWER_ACTIVATION_URL,
      copy_ready_first_run_prompt: firstUsefulRun.agent_prompt,
      copy_ready_curl_script: firstUsefulRun.curl_script,
      copy_ready_review_request: copyReadyReviewRequest,
      canonical_start_url: START_URL,
    },
    suggested_form_fields: {
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
      install_note:
        "Use the hosted Streamable HTTP endpoint. No buyer-side API key is required. For source attribution, share the tracked start, config, install, first-run, and reviewer activation links in this packet.",
      reviewer_note:
        "The server is production-hosted at mcp.packrift.com, exposes annotated MCP tools, avoids staging or localhost URLs, and routes buyer purchase handoff through measured /r/cart URLs only after exact SKU, price, inventory, and buyer quantity are confirmed. The packet includes activation experiments and usage/funnel proof so the Claude connector review can move beyond listing into a real first-run create_cart_url flow.",
    },
    checklist: [
      checklistRow("pass", "Production endpoint", `${MCP_ENDPOINT} is the canonical hosted Streamable HTTP MCP endpoint.`),
      checklistRow("pass", "No-auth connection flow", "Hosted endpoint does not require a buyer-side API key or OAuth before listing tools/resources/prompts."),
      checklistRow("pass", "No staging or localhost URLs", "Public install and proof URLs use mcp.packrift.com, packrift.com, github.com, or claude.com."),
      checklistRow("pass", "Tool metadata", summary),
      checklistRow("pass", "Tool annotations", "All MCP tools expose readOnlyHint and openWorldHint annotations for connector clients."),
      checklistRow("pass", "Activation proof loop", "Source activation queue, activation experiments, usage snapshot, funnel snapshot, and GA4 funnel proof are public so connector review can be measured without self-generated completion signals."),
      checklistRow("ready", "Legal and support links", "Privacy policy, terms of service, and support/contact pages are public on packrift.com."),
      checklistRow("ready", "Allowed redirect domains", "Buyer handoff may redirect between mcp.packrift.com and packrift.com; GitHub and Claude links are documentation/review links only."),
      checklistRow("manual_review", "Directory form submission", "The Claude submission form is manual and should be reviewed by the account owner before sending."),
    ],
    allowed_redirect_hosts: ["mcp.packrift.com", "packrift.com", "www.packrift.com"],
    live_proof_urls: {
      health: "https://mcp.packrift.com/health",
      manifest: "https://mcp.packrift.com/manifest",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      mcp_start: "https://mcp.packrift.com/ai/mcp-start.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
      usage_snapshot: USAGE_SNAPSHOT_URL,
      funnel_snapshot: FUNNEL_SNAPSHOT_URL,
      ga4_funnel_proof: GA4_FUNNEL_PROOF_URL,
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      source_activation_queue: SOURCE_ACTIVATION_QUEUE_URL,
      activation_experiments: ACTIVATION_EXPERIMENTS_URL,
      activation_experiments_html: ACTIVATION_EXPERIMENTS_HTML_URL,
      reviewer_activation: "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      agent_capture_outreach: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
      tracked_start: TRACKED_START_URL,
      tracked_config: TRACKED_CONFIG_URL,
      tracked_install_claude_code: TRACKED_INSTALL_CLAUDE_CODE_URL,
      tracked_install_claude_desktop: TRACKED_INSTALL_CLAUDE_DESKTOP_URL,
      tracked_first_run_claude_code: TRACKED_FIRST_RUN_CLAUDE_CODE_URL,
      tracked_first_run_claude_desktop: TRACKED_FIRST_RUN_CLAUDE_DESKTOP_URL,
      reviewer_activation_runner: REVIEWER_ACTIVATION_URL,
    },
    activation_readiness: {
      source: SOURCE,
      source_aware_endpoint: firstUsefulRun.endpoint,
      copy_ready_first_run_prompt: firstUsefulRun.agent_prompt,
      copy_ready_review_request: copyReadyReviewRequest,
      tracked_first_run_prompt_url: TRACKED_FIRST_RUN_CLAUDE_CODE_URL,
      reviewer_activation_runner_url: REVIEWER_ACTIVATION_URL,
      required_first_run_tools: ["get_cart_handoff_candidates", "get_pricing", "check_inventory", "create_cart_url"],
      success_signal:
        "A non-suppressed Claude connector review or Claude MCP host run should produce source-attributed first-run/tool-call events and a measured https://mcp.packrift.com/r/cart/1066 URL after live price and inventory confirmation.",
      suppressions: [
        "Do not count Packrift self-checks as connector activation.",
        "Do not count browser-only proof as a completed Claude MCP host activation.",
        "Do not create a duplicate Packrift CLI or buyer surface; use the hosted MCP endpoint.",
      ],
      measurement_urls: {
        source_activation_queue: SOURCE_ACTIVATION_QUEUE_URL,
        activation_experiments: ACTIVATION_EXPERIMENTS_URL,
        usage_snapshot: USAGE_SNAPSHOT_URL,
        funnel_snapshot: FUNNEL_SNAPSHOT_URL,
        ga4_funnel_proof: GA4_FUNNEL_PROOF_URL,
      },
    },
    buyer_safety_rules: [
      "Use only AI_APPROVE products for SKU-level product, price, inventory, and cart flows.",
      "Confirm exact SKU, variant, live price, inventory, and buyer quantity before presenting a cart URL.",
      "If requested dimensions, material, color, count, closure, adhesive, printer type, product family, or SKU differ, do not present a nearby product as exact.",
      "The MCP server creates measured cart handoff URLs; the buyer still confirms checkout on Packrift.",
    ],
    proof_summary: summary,
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function claudeConnectorSubmissionMarkdown(runtime: ClaudeConnectorSubmissionRuntime): string {
  const payload = claudeConnectorSubmissionPayload(runtime);
  const checklist = payload.checklist
    .map((row) => `| ${row.status} | ${escapeMarkdown(row.item)} | ${escapeMarkdown(row.evidence)} |`)
    .join("\n");
  const proofUrls = Object.entries(payload.live_proof_urls)
    .map(([label, url]) => `- ${label}: ${url}`)
    .join("\n");
  const safetyRules = payload.buyer_safety_rules.map((rule) => `- ${rule}`).join("\n");
  return [
    "# Packrift Claude Connector Submission Packet",
    "",
    `Release: ${payload.release}`,
    `Status: ${payload.status}`,
    `Endpoint: ${payload.server.remote_endpoint}`,
    `Tracked start: ${payload.claude_install.tracked_start_url}`,
    `Tracked config: ${payload.claude_install.tracked_config_url}`,
    "",
    "## Suggested Form Fields",
    "",
    `- Name: ${payload.suggested_form_fields.name}`,
    `- Category: ${payload.suggested_form_fields.category}`,
    `- Server URL: ${payload.suggested_form_fields.server_url}`,
    `- Website: ${payload.suggested_form_fields.website_url}`,
    `- Repository: ${payload.suggested_form_fields.repository_url}`,
    `- Support: ${payload.suggested_form_fields.support_url}`,
    `- Privacy: ${payload.suggested_form_fields.privacy_policy_url}`,
    `- Terms: ${payload.suggested_form_fields.terms_of_service_url}`,
    `- Description: ${payload.suggested_form_fields.description}`,
    "",
    "## Reviewer Note",
    "",
    payload.suggested_form_fields.reviewer_note,
    "",
    "## Checklist",
    "",
    "| Status | Item | Evidence |",
    "| --- | --- | --- |",
    checklist,
    "",
    "## Claude Install",
    "",
    "```json",
    JSON.stringify(payload.claude_install.mcp_json_config, null, 2),
    "```",
    "",
    "### Source-Aware Claude Review Config",
    "",
    "```json",
    JSON.stringify(payload.claude_install.source_aware_mcp_json_config, null, 2),
    "```",
    "",
    `Claude Code command: \`${payload.claude_install.claude_code_command}\``,
    `Source-aware Claude Code command: \`${payload.claude_install.source_aware_claude_code_command}\``,
    `Tracked Claude Code install: ${payload.claude_install.tracked_install_claude_code_url}`,
    `Tracked Claude Desktop install: ${payload.claude_install.tracked_install_claude_desktop_url}`,
    `Tracked Claude Code first run: ${payload.claude_install.tracked_first_run_claude_code_url}`,
    `Tracked Claude Desktop first run: ${payload.claude_install.tracked_first_run_claude_desktop_url}`,
    `Reviewer activation runner: ${payload.claude_install.reviewer_activation_runner_url}`,
    "",
    "### Copy-Ready Review Request",
    "",
    "```text",
    payload.claude_install.copy_ready_review_request,
    "```",
    "",
    "### Copy-Ready First Run Prompt",
    "",
    "```text",
    payload.claude_install.copy_ready_first_run_prompt,
    "```",
    "",
    "## Activation Readiness",
    "",
    `- Source: ${payload.activation_readiness.source}`,
    `- Source-aware endpoint: ${payload.activation_readiness.source_aware_endpoint}`,
    `- Required first-run tools: ${payload.activation_readiness.required_first_run_tools.join(", ")}`,
    `- Success signal: ${payload.activation_readiness.success_signal}`,
    "",
    "### Suppressions",
    "",
    payload.activation_readiness.suppressions.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Buyer Safety Rules",
    "",
    safetyRules,
    "",
    "## Live Proof URLs",
    "",
    proofUrls,
    "",
    "## Official References",
    "",
    `- Submission docs: ${payload.official_references.submission_docs}`,
    `- Review criteria: ${payload.official_references.review_criteria}`,
    `- Submission form: ${payload.official_references.submission_form}`,
    "",
  ].join("\n");
}
