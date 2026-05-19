#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const OUT_ROOT = resolve(REPO_ROOT, "outputs/agent-capture-outreach");
const CAPTURE_URL = "https://mcp.packrift.com/ai/all-agent-capture.json";
const CAPTURE_MD_URL = "https://mcp.packrift.com/ai/all-agent-capture.md";
const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const TRACKED_START_TEMPLATE = "https://mcp.packrift.com/r/start/{source}";
const TRACKED_CONFIG_TEMPLATE = "https://mcp.packrift.com/r/config/{source}";
const DIRECTORY_SUBMIT_ACTIONS_URL = "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json";
const DISTRIBUTION_LATEST = resolve(REPO_ROOT, "outputs/mcp-distribution-check/latest.json");
const AGENT_CAPTURE_CHECK_LATEST = resolve(REPO_ROOT, "outputs/agent-capture-check/latest.json");
const SERVER_JSON = JSON.parse(readFileSync(resolve(REPO_ROOT, "server.json"), "utf8"));

const TEXT_HEADERS = {
  "User-Agent": "Packrift-Agent-Capture-Outreach/1.0 (+https://mcp.packrift.com/ai/all-agent-capture.json)",
  Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: TEXT_HEADERS, redirect: "follow" });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${text.slice(0, 160)}`);
  }
  return JSON.parse(text);
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function distributionRows(distribution) {
  return (distribution?.checks ?? []).filter((row) => row.status !== "pass");
}

function directoryActionRows(submitActions, distribution) {
  const liveRows = submitActions?.actions ?? [];
  if (liveRows.length) {
    return liveRows.map((row) => ({
      id: row.id,
      name: row.id,
      label: row.label,
      action_status: row.action_status,
      directory_status: row.directory_status,
      priority: row.priority,
      listing_url: row.listing_url,
      submission_url: row.submission_url,
      missing: row.stale_markers ?? [],
      follow_up_action: row.next_action,
      tracked_start_url: row.tracked_start_url,
      tracked_config_url: row.tracked_config_url,
      proof_urls: row.proof_urls,
      message: row.recrawl_message,
    }));
  }
  return distributionRows(distribution).map((row) => ({
    ...row,
    id: row.name,
    label: row.name,
    action_status: row.status,
    directory_status: row.status,
    tracked_start_url: TRACKED_START_TEMPLATE.replace("{source}", row.name),
    tracked_config_url: TRACKED_CONFIG_TEMPLATE.replace("{source}", row.name),
    message: directoryRefreshMessage(row),
  }));
}

function evidenceLinks(capture) {
  return {
    canonical_mcp_endpoint: MCP_ENDPOINT,
    tracked_start_template: TRACKED_START_TEMPLATE,
    tracked_config_template: TRACKED_CONFIG_TEMPLATE,
    all_agent_capture_json: CAPTURE_URL,
    all_agent_capture_markdown: CAPTURE_MD_URL,
    mcp_adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
    mcp_install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
    mcp_client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
    generic_tracked_config: TRACKED_CONFIG_TEMPLATE.replace("{source}", "generic"),
    root_mcp_json: "https://mcp.packrift.com/mcp.json",
    well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
    mcp_usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
    mcp_buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
    mcp_cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
    mcp_first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
    mcp_workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
    browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
    mcp_directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    mcp_directory_submit_actions: DIRECTORY_SUBMIT_ACTIONS_URL,
    health: "https://mcp.packrift.com/health",
    manifest: "https://mcp.packrift.com/manifest",
    server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
    official_registry: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    glama_connector: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    mcp_marketplace: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
    cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
    llms_txt: "https://mcp.packrift.com/llms.txt",
    resources_list: `${MCP_ENDPOINT} via JSON-RPC resources/list`,
    tools_list: `${MCP_ENDPOINT} via JSON-RPC tools/list`,
    release: capture.release,
  };
}

function directoryRefreshMessage(row, capture = null) {
  const missing = row.missing?.length ? ` The current listing is missing: ${row.missing.join(", ")}.` : "";
  const captureFacts = capture
    ? `${CAPTURE_URL} shows ${capture.surfaces.length} agent surfaces and the canonical endpoint. Live health shows ${capture.runtime.tools_count} tools, ${capture.runtime.resources_count} resources, and ${capture.runtime.prompts_count} prompts.`
    : `${CAPTURE_URL} shows the current all-agent capture matrix.`;
  return [
    `Subject: Refresh Packrift MCP listing to current hosted 15-tool endpoint`,
    "",
    `Hi, Packrift MCP is live as a hosted Streamable HTTP MCP server at ${MCP_ENDPOINT}.`,
    "",
    `Current proof: ${captureFacts} First-run proof, workflow gallery, cart activation, and cart handoff candidates are live at https://mcp.packrift.com/ai/mcp-first-run-proof.json, https://mcp.packrift.com/ai/mcp-workflow-gallery.json, https://mcp.packrift.com/ai/mcp-cart-activation.json, and https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json.`,
    "",
    `The latest check marks ${row.name} as ${row.status}.${missing}`,
    "",
    `Please recrawl/update Packrift using:`,
    `- Server name: ${SERVER_JSON.name}`,
    `- Title: ${SERVER_JSON.title}`,
    `- Remote endpoint: ${MCP_ENDPOINT}`,
    `- Tracked start page: ${TRACKED_START_TEMPLATE.replace("{source}", row.name ?? "generic")}`,
    `- Tracked MCP JSON config: ${TRACKED_CONFIG_TEMPLATE.replace("{source}", row.name ?? "generic")}`,
    `- Canonical start page: https://mcp.packrift.com/start`,
    `- Repository: ${SERVER_JSON.repository?.url}`,
    `- Website: ${SERVER_JSON.websiteUrl}`,
    `- Description: ${SERVER_JSON.description}`,
    `- All-agent evidence: ${CAPTURE_URL}`,
    "",
    "Thanks,",
    "Packrift",
  ].join("\n");
}

function browseCandidateBrief() {
  return {
    status: "candidate_only",
    domain: "packrift.com",
    catalog_url: "https://browse.sh/",
    product_positioning:
      "Packrift should be a read-first packaging procurement skill if Browse adds a retailer/domain submission lane. The skill should not replace MCP; it should route exact SKU/spec lookup and measured handoff through the hosted MCP endpoint.",
    skill_md_url: "https://mcp.packrift.com/SKILL.md",
    canonical_skill_md_url: "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md",
    skill_pack_url: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
    candidate_skills: [
      {
        name: "search-packaging",
        mode: "read-only",
        inputs: ["query", "sku", "dimensions", "family", "material", "color", "case_count"],
        output:
          "Structured products with SKU, title, exact specs, product URL, MCP SKU record, live-confirmation-required flag, reorder URL, quote URL, and MCP endpoint.",
      },
      {
        name: "get-packaging-product",
        mode: "read-only",
        inputs: ["sku", "product_url", "handle"],
        output:
          "Exact product record plus next MCP calls for price, inventory, shipping, and cart handoff. No unsupported certification/compliance claims.",
      },
      {
        name: "prepare-packaging-handoff",
        mode: "guarded-handoff",
        inputs: ["sku", "quantity"],
        output:
          "Calls out that get_product, get_pricing, and check_inventory must be confirmed through MCP before presenting cart or checkout action.",
      },
    ],
    required_rule:
      "Do not present nearby dimensions, material, color, adhesive, printer type, count, strength rating, or SKU as an exact substitute.",
    canonical_endpoint: MCP_ENDPOINT,
    proof_url: CAPTURE_URL,
  };
}

function agentInstallSnippets() {
  return {
    tracked_start_template: TRACKED_START_TEMPLATE,
    generic_tracked_start: TRACKED_START_TEMPLATE.replace("{source}", "generic"),
    tracked_config_template: TRACKED_CONFIG_TEMPLATE,
    generic_tracked_config: TRACKED_CONFIG_TEMPLATE.replace("{source}", "generic"),
    generic_mcp_json: {
      mcpServers: {
        packrift: {
          type: "http",
          url: MCP_ENDPOINT,
        },
      },
    },
    claude_code: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
    codex: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
    client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
    root_mcp_json: "https://mcp.packrift.com/mcp.json",
    well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
    install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
    docker_optional_only: "docker pull ghcr.io/packrift/packrift-mcp:latest",
  };
}

function markdown(payload) {
  const staleRows = payload.directory_refreshes
    .map((row) => `| ${row.label ?? row.name} | ${row.action_status} | ${row.directory_status} | ${row.priority ?? ""} | ${row.tracked_start_url ?? ""} | ${row.tracked_config_url ?? ""} | ${row.listing_url ?? row.url ?? ""} | ${row.submission_url ?? ""} |`)
    .join("\n");
  const messages = payload.directory_refreshes
    .map((row) => [`### ${row.name}`, "", "```text", row.message, "```", ""].join("\n"))
    .join("\n");
  return [
    "# Packrift Agent Capture Outreach Pack",
    "",
    `Generated: ${payload.generated_at}`,
    `Capture release: ${payload.capture.release}`,
    `Canonical MCP endpoint: ${MCP_ENDPOINT}`,
    "",
    "## Use This For",
    "",
    "- Refresh stale MCP directories with copy-ready proof.",
    "- Use source-specific tracked start and tracked config links from the canonical directory submit-action queue.",
    "- Give partners or agent platforms a single evidence bundle.",
    "- Point developers to the install matrix for copy-ready setup and smoke tests.",
    "- Use the live browser-agent bridge for Browse-style agents without creating a duplicate Packrift CLI.",
    "- Keep Browserbase Browse as a candidate browser-skill lane with a root SKILL.md until a real Packrift skill is published.",
    "- Share install snippets for Claude, Codex, Cursor, Windsurf, and other MCP clients.",
    "",
    "## Proof Links",
    "",
    Object.entries(payload.evidence)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Directory Refresh Queue",
    "",
    "| Surface | Action status | Directory status | Priority | Tracked start | Tracked config | Listing | Submission |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    staleRows || "| none | pass | pass | | | | | |",
    "",
    "## Copy-Ready Directory Messages",
    "",
    messages || "No stale directory messages needed.",
    "",
    "## Browserbase Browse Candidate Brief",
    "",
    "```json",
    JSON.stringify(payload.browserbase_browse_candidate, null, 2),
    "```",
    "",
    "## Agent Install Snippets",
    "",
    "```json",
    JSON.stringify(payload.agent_install_snippets, null, 2),
    "```",
    "",
  ].join("\n");
}

async function main() {
  const [capture, submitActions, distribution, agentCaptureCheck] = await Promise.all([
    fetchJson(CAPTURE_URL),
    fetchJson(DIRECTORY_SUBMIT_ACTIONS_URL),
    Promise.resolve(readJsonIfExists(DISTRIBUTION_LATEST)),
    Promise.resolve(readJsonIfExists(AGENT_CAPTURE_CHECK_LATEST)),
  ]);
  const rows = directoryActionRows(submitActions, distribution);
  const rowsMissingTrackedStart = rows.filter((row) => !String(row.tracked_start_url ?? "").startsWith("https://mcp.packrift.com/r/start/"));
  const rowsMissingTrackedConfig = rows.filter((row) => !String(row.tracked_config_url ?? "").startsWith("https://mcp.packrift.com/r/config/"));
  const rowsMissingTrackedMessage = rows.filter((row) => !String(row.message ?? "").includes("/r/start/"));
  const rowsMissingTrackedConfigMessage = rows.filter((row) => !String(row.message ?? "").includes("/r/config/"));
  if (rowsMissingTrackedStart.length || rowsMissingTrackedConfig.length || rowsMissingTrackedMessage.length || rowsMissingTrackedConfigMessage.length) {
    throw new Error(
      [
        "Directory outreach rows must preserve tracked start and tracked config URLs from the canonical submit-action queue.",
        rowsMissingTrackedStart.length ? `Missing tracked_start_url: ${rowsMissingTrackedStart.map((row) => row.id ?? row.name).join(", ")}` : "",
        rowsMissingTrackedConfig.length ? `Missing tracked_config_url: ${rowsMissingTrackedConfig.map((row) => row.id ?? row.name).join(", ")}` : "",
        rowsMissingTrackedMessage.length ? `Missing tracked message link: ${rowsMissingTrackedMessage.map((row) => row.id ?? row.name).join(", ")}` : "",
        rowsMissingTrackedConfigMessage.length ? `Missing tracked config message link: ${rowsMissingTrackedConfigMessage.map((row) => row.id ?? row.name).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
  const payload = {
    generated_at: new Date().toISOString(),
    capture: {
      release: capture.release,
      canonical_endpoint: capture.canonical_endpoint,
      runtime: capture.runtime,
      surfaces_count: capture.surfaces?.length ?? 0,
      counts: capture.counts,
    },
    evidence: evidenceLinks(capture),
    agent_capture_check: agentCaptureCheck
      ? {
          generated_at: agentCaptureCheck.generated_at,
          ok: agentCaptureCheck.ok,
          checks_count: agentCaptureCheck.checks?.length ?? 0,
        }
      : null,
    distribution_counts: distribution?.counts ?? null,
    directory_submit_actions: {
      release: submitActions.release,
      tracked_start_template: submitActions.tracked_start_template,
      tracked_config_template: submitActions.tracked_config_template,
      status_counts: submitActions.status_counts,
      actions_count: submitActions.actions?.length ?? 0,
    },
    directory_refreshes: rows,
    browserbase_browse_candidate: browseCandidateBrief(),
    agent_install_snippets: agentInstallSnippets(),
  };
  const outDir = resolve(OUT_ROOT, payload.generated_at.replace(/[:.]/g, "-"));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "agent-capture-outreach.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(outDir, "agent-capture-outreach.md"), markdown(payload));
  writeFileSync(resolve(OUT_ROOT, "latest.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(OUT_ROOT, "latest.md"), markdown(payload));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
