import { clineMcpJson, stdioMcpRemoteJson, trackedInstallUrl } from "./install-action.js";
import { trackedRunUrl } from "./first-run-action.js";

export interface AdoptionKitRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const ACTIVATION_WAVE_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.json";
const ACTIVATION_WAVE_HTML_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.html";
const MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief.json";
const MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief.html";
const MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief-tasks.jsonl";
const MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief-tasks.csv";
const MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief-runner.sh";
const SHAREABLE_SOURCES = [
  "generic",
  "cline_mcp_marketplace",
  "glama_connector",
  "mcp_marketplace_io",
  "official_registry",
  "mcpcentral",
  "mcp_so",
  "browse_sh",
] as const;

const DEMO_SKUS = [
  {
    sku: "1066",
    title: "10x6x6 ECT-32 Kraft Long Corrugated Boxes - 25 Bundle",
    variant_id: "53472879935856",
    handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
    use_case: "Exact corrugated box reorder and cart handoff.",
  },
  {
    sku: "MFL1295",
    title: "12 1/8 x 9 1/4 x 5 White Corrugated Literature Mailer - Self-Seal, 50 Pack",
    variant_id: "53472994427248",
    handle: "12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack",
    use_case: "Exact literature mailer lookup for ecommerce fulfillment.",
  },
  {
    sku: "LL251WR",
    title: "2 5/8 x 1 Weather-Resistant Polyester Laser Labels - 3000/Case",
    variant_id: "53475925492080",
    handle: "2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case",
    use_case: "Exact label spec lookup with live price and stock confirmation.",
  },
] as const;

function toolCall(id: string, name: string, args: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  };
}

function trackedConfigUrl(source: string): string {
  const url = new URL(`https://mcp.packrift.com/r/config/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "adoption_kit_config");
  url.searchParams.set("utm_campaign", "packrift_mcp_activation");
  url.searchParams.set("utm_content", "developer_share_pack");
  return url.toString();
}

function sourceActivationPacketUrl(source: string, format: "json" | "md" | "html" = "json"): string {
  return `https://mcp.packrift.com/ai/mcp-source-activation/${source}.${format}`;
}

function shareableSourceLink(source: (typeof SHAREABLE_SOURCES)[number]) {
  const preferredTarget = source === "cline_mcp_marketplace" ? "cline" : "generic_streamable_http";
  return {
    source,
    preferred_target: preferredTarget,
    tracked_start_url: `https://mcp.packrift.com/r/start/${source}`,
    tracked_config_url: trackedConfigUrl(source),
    tracked_install_urls: {
      generic_streamable_http: trackedInstallUrl(source, "generic_streamable_http"),
      stdio_mcp_remote: trackedInstallUrl(source, "stdio_mcp_remote"),
      claude_code: trackedInstallUrl(source, "claude_code"),
      codex: trackedInstallUrl(source, "codex"),
      cline: trackedInstallUrl(source, "cline"),
    },
    tracked_first_run_urls: {
      preferred: trackedRunUrl(source, preferredTarget),
      preferred_html: `${trackedRunUrl(source, preferredTarget)}&format=html`,
      preferred_shell: `${trackedRunUrl(source, preferredTarget)}&format=sh`,
      generic_streamable_http: trackedRunUrl(source, "generic_streamable_http"),
      generic_streamable_http_html: `${trackedRunUrl(source, "generic_streamable_http")}&format=html`,
      generic_streamable_http_shell: `${trackedRunUrl(source, "generic_streamable_http")}&format=sh`,
    },
    reviewer_activation_runner: `https://mcp.packrift.com/r/activate/${source}?format=html`,
    reviewer_activation_shell: `https://mcp.packrift.com/r/activate/${source}?format=sh`,
    source_activation_packet: sourceActivationPacketUrl(source),
    source_activation_packet_markdown: sourceActivationPacketUrl(source, "md"),
    source_activation_packet_html: sourceActivationPacketUrl(source, "html"),
    eval_pack: `https://mcp.packrift.com/ai/mcp-eval-pack.json?source=${source}`,
    one_command_external_runner: `curl -sS '${trackedRunUrl(source, preferredTarget)}&format=sh' | bash`,
  };
}

const DEVELOPER_EXAMPLES = [
  {
    id: "curl-tools-list",
    title: "List tools with curl",
    language: "sh",
    purpose: "Confirm the hosted Packrift MCP endpoint is reachable before wiring an agent.",
    code: `curl -sS ${MCP_ENDPOINT} \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":"tools","method":"tools/list"}'`,
  },
  {
    id: "curl-cart-candidate",
    title: "Fetch a measured cart candidate with curl",
    language: "sh",
    purpose: "Get one AI-approved SKU candidate whose cart handoff starts with the MCP measured landing URL.",
    code: `curl -sS ${MCP_ENDPOINT} \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":"candidate-1066","method":"tools/call","params":{"name":"get_cart_handoff_candidates","arguments":{"sku":"1066","limit":1}}}'`,
  },
  {
    id: "javascript-first-flow",
    title: "Run the first useful flow in JavaScript",
    language: "js",
    purpose: "Use fetch to call tools/list, get a cart candidate, and inspect live-check requirements.",
    code: `const endpoint = "${MCP_ENDPOINT}";

async function parseMcpPayload(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {}
  const dataLines = text
    .split("\\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  for (let index = dataLines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(dataLines[index]);
    } catch {}
  }
  throw new Error("Packrift MCP response was not JSON or event-stream JSON");
}

async function rpc(id, method, params) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
  });
  const payload = await parseMcpPayload(response);
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}

const tools = await rpc("tools", "tools/list");
const candidate = await rpc("candidate-1066", "tools/call", {
  name: "get_cart_handoff_candidates",
  arguments: { sku: "1066", limit: 1 },
});

console.log(tools.tools.length);
console.log(candidate.content?.[0]?.text ?? candidate);`,
  },
  {
    id: "python-first-flow",
    title: "Run the first useful flow in Python",
    language: "python",
    purpose: "Use Python's standard library to call the hosted MCP endpoint without installing a Packrift package.",
    code: `import json
import urllib.request

ENDPOINT = "${MCP_ENDPOINT}"

def parse_mcp_payload(raw):
    text = raw.decode("utf-8")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    data_lines = [
        line[len("data:"):].strip()
        for line in text.splitlines()
        if line.strip().startswith("data:")
    ]
    for line in reversed(data_lines):
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    raise RuntimeError("Packrift MCP response was not JSON or event-stream JSON")

def rpc(id, method, params=None):
    body = {"jsonrpc": "2.0", "id": id, "method": method}
    if params:
        body["params"] = params
    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "accept": "application/json, text/event-stream",
            "user-agent": "Packrift-MCP-Example/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = parse_mcp_payload(response.read())
    if payload.get("error"):
        raise RuntimeError(payload["error"]["message"])
    return payload["result"]

print(len(rpc("tools", "tools/list")["tools"]))
print(rpc("candidate-1066", "tools/call", {
    "name": "get_cart_handoff_candidates",
    "arguments": {"sku": "1066", "limit": 1},
}))`,
  },
] as const;

export function mcpAdoptionKitPayload(runtime: AdoptionKitRuntime) {
  const demo = DEMO_SKUS[0];
  const shareableSourceLinks = SHAREABLE_SOURCES.map(shareableSourceLink);
  return {
    release: "PACKRIFT-MCP-ADOPTION-KIT-R11",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    purpose:
      "Help developers, agents, marketplaces, and AI-commerce workflows install Packrift MCP, run a useful first test, and understand when to use exact-spec product search, live price and inventory, no-match recovery, and cart handoff.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    audience: [
      "MCP client builders",
      "AI-commerce agents",
      "procurement copilots",
      "warehouse and fulfillment tools",
      "marketplace and directory reviewers",
      "search and answer-engine crawlers",
    ],
    install: {
      generic_remote_mcp_json: {
        mcpServers: {
          packrift: {
            type: "http",
            url: MCP_ENDPOINT,
          },
        },
      },
      claude_code: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
      codex: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
      stdio_mcp_remote: stdioMcpRemoteJson(),
      stdio_mcp_remote_command: `npx -y mcp-remote ${MCP_ENDPOINT}`,
      start_page: "https://mcp.packrift.com/start",
      start_pack: "https://mcp.packrift.com/ai/mcp-start.json",
      reviewer_activation_runner_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
      cursor_windsurf_vscode: {
        mcpServers: {
          packrift: {
            type: "http",
            url: MCP_ENDPOINT,
          },
        },
      },
      cline: clineMcpJson(),
      glama_connector: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
      marketplace_listing: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
      registry_search: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      activation_wave: ACTIVATION_WAVE_URL,
      activation_wave_html: ACTIVATION_WAVE_HTML_URL,
      external_activation_brief: MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL,
      external_activation_brief_html: MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL,
      external_activation_selected_tasks_jsonl: MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL,
      external_activation_selected_tasks_csv: MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL,
      external_activation_selected_runner_shell: MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL,
      self_hosted_container_optional: "docker pull ghcr.io/packrift/packrift-mcp:latest",
    },
    developer_share_pack: {
      purpose:
        "Copy one source-specific row into a directory, marketplace, partner handoff, or agent-host review so installs and first useful runs preserve attribution.",
      rule:
        "Use these links to drive real MCP host usage through the existing hosted endpoint. Do not count generated resource fetches, sitemap crawls, or Packrift self-checks as completed source activation.",
      source_count: shareableSourceLinks.length,
      shareable_source_links: shareableSourceLinks,
      activation_wave: ACTIVATION_WAVE_URL,
      activation_wave_html: ACTIVATION_WAVE_HTML_URL,
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      external_activation_brief: MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL,
      external_activation_brief_html: MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL,
      external_activation_selected_tasks_jsonl: MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL,
      external_activation_selected_tasks_csv: MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL,
      external_activation_selected_runner_shell: MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL,
      external_activation_success_gate:
        "Use the selected task feed only for real external MCP host or reviewer runs. Packrift self-runs, crawlers, and resource fetches are not adoption proof.",
      measurement_urls: {
        usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
        funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
        ga4_funnel_proof: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
      },
    },
    first_five_minutes: [
      {
        step: 1,
        name: "List available tools",
        why: "Confirm the endpoint is reachable and exposes the current Packrift commerce surface.",
        request: { jsonrpc: "2.0", id: "tools", method: "tools/list" },
      },
      {
        step: 2,
        name: "List prompts",
        why: "Find native exact-spec, reorder, cart candidate, no-match, and procurement-spec workflows.",
        request: { jsonrpc: "2.0", id: "prompts", method: "prompts/list" },
      },
      {
        step: 3,
        name: "Use one-call exact-SKU prep",
        why: "For known SKUs, confirm product, live price, and inventory in one call while withholding cart URL until buyer_confirmed is true.",
        request: toolCall("prepare-1066", "prepare_purchase_handoff", {
          sku: demo.sku,
          quantity: 1,
          buyer_confirmed: false,
          source_context: "adoption_kit_demo",
        }),
      },
      {
        step: 4,
        name: "Get a ready exact-SKU cart candidate",
        why: "Start with a conversion-proven SKU that already has safe create_cart_url arguments.",
        request: toolCall("candidate-1066", "get_cart_handoff_candidates", { sku: demo.sku, limit: 1 }),
      },
      {
        step: 5,
        name: "Confirm live price",
        why: "Do not show price-dependent handoff until live pricing is checked.",
        request: toolCall("price-1066", "get_pricing", {
          variant_ids: [demo.variant_id],
          quantity: 1,
        }),
      },
      {
        step: 6,
        name: "Confirm live inventory",
        why: "Do not show a cart or checkout path for an unavailable exact SKU.",
        request: toolCall("inventory-1066", "check_inventory", {
          variant_ids: [demo.variant_id],
        }),
      },
      {
        step: 7,
        name: "Create measured cart handoff only after confirmation",
        why: "Return an MCP cart landing URL with attribution and exact SKU continuity.",
        request: toolCall("cart-1066", "create_cart_url", {
          sku: demo.sku,
          quantity: 1,
          selected_sku: demo.sku,
          selected_handle: demo.handle,
          match_type: "adoption_kit_demo",
          source_context: "exact_spec_ai_agent",
          journey_id: `mcp_${demo.sku}_${demo.variant_id}`,
          result_set_id: "mcp_adoption_kit",
          utm_term: demo.sku,
        }),
      },
    ],
    developer_examples: DEVELOPER_EXAMPLES,
    expected_first_flow_outcomes: [
      "tools/list returns at least 15 tools, including prepare_purchase_handoff for one-call exact-SKU live confirmation and guarded cart handoff.",
      "prepare_purchase_handoff with buyer_confirmed=false returns live confirmation and cart null.",
      "get_cart_handoff_candidates returns AI_APPROVE SKU 1066 when requested exactly.",
      "Cart candidates expose an MCP measured landing URL under https://mcp.packrift.com/r/cart/ before the final Shopify cart URL.",
      "Agents must call get_product, get_pricing, and check_inventory before presenting create_cart_url output to a buyer.",
      "Directory reviewers can use https://mcp.packrift.com/r/activate/generic?format=html to run the real MCP sequence in a browser.",
      "Developers and reviewers can use developer_share_pack.shareable_source_links to preserve source attribution from start/config/install through first useful run and activation proof.",
      "External agent hosts can use developer_share_pack.external_activation_selected_tasks_jsonl or .csv to pick the current contact-ready source runs that close the material tool-call gap.",
      "Stdio-only hosts can use npx mcp-remote as a thin bridge to the hosted endpoint; this is not a Packrift CLI.",
    ],
    useful_workflows: [
      {
        name: "Exact SKU reorder",
        prompt: "Reorder Packrift SKU 1066. Confirm product, live price, inventory, and then prepare a cart handoff for quantity 1.",
        best_tools: ["prepare_purchase_handoff", "get_cart_handoff_candidates", "get_product", "get_pricing", "check_inventory", "create_cart_url"],
      },
      {
        name: "Find packaging for an item",
        prompt: "Find packaging for a 9 x 4 x 3 inch item that weighs 2 lb and needs ecommerce shipping protection.",
        best_tools: ["find_packaging_for_item", "pack_calculator", "compare_alternatives", "get_pricing", "check_inventory"],
      },
      {
        name: "Procurement-safe no-match",
        prompt: "The buyer asked for 10 x 6 x 8 ECT-32 kraft boxes. If Packrift has no exact AI-approved match, explain no exact match and route to quote recovery.",
        best_tools: ["search_products", "explain_no_exact_match", "get_bulk_quote_link"],
      },
      {
        name: "Copy a procurement line item",
        prompt: "Create a procurement-ready line item for Packrift SKU LL251WR with exact SKU, product URL, case count, price check, and reorder path.",
        best_tools: ["get_product", "get_pricing", "check_inventory", "get_reorder_link"],
      },
    ],
    demo_skus: DEMO_SKUS,
    proof_urls: {
      health: "https://mcp.packrift.com/health",
      mcp_start: "https://mcp.packrift.com/ai/mcp-start.json",
      manifest: "https://mcp.packrift.com/manifest",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      reviewer_activation: "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
      reviewer_activation_runner_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      eval_pack: "https://mcp.packrift.com/ai/mcp-eval-pack.json",
      browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      root_skill_md: "https://mcp.packrift.com/SKILL.md",
      directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      agent_capture_outreach: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
      activation_wave: ACTIVATION_WAVE_URL,
      activation_wave_html: ACTIVATION_WAVE_HTML_URL,
      external_activation_brief: MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL,
      external_activation_brief_html: MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL,
      external_activation_selected_tasks_jsonl: MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL,
      external_activation_selected_tasks_csv: MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL,
      external_activation_selected_runner_shell: MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL,
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
      product_corpus: "https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl",
      llms_txt: "https://mcp.packrift.com/llms.txt",
      llms_full: "https://mcp.packrift.com/llms-full.txt",
    },
    success_metrics: [
      "remote MCP installs",
      "tools/list and prompts/list success",
      "get_cart_handoff_candidates calls",
      "get_pricing and check_inventory confirmations",
      "create_cart_url calls",
      "measured /r/cart route landings",
      "Shopify cart sessions with ref=mcp and MCP attribution",
    ],
    rules: [
      "Use https://mcp.packrift.com/mcp as the canonical endpoint.",
      "Do not build or promote a duplicate Packrift CLI; use only thin wrappers around the hosted MCP endpoint when needed.",
      "Use the mcp-remote bridge only for hosts that cannot connect to remote HTTP directly.",
      "Use only AI_APPROVE exact matches for purchase handoff.",
      "Confirm live price, inventory, shipping, and cart eligibility before presenting cart or checkout actions.",
      "Use the reviewer activation browser runner when a marketplace, directory, or agent host needs to turn proof interest into a real create_cart_url call.",
      "Use the eval pack when a host or directory needs acceptance-test cases with expected assertions.",
      "Use the source activation queue to prioritize the next external source that needs a real MCP run, measured cart landing, or order.",
      "Use the activation wave when the material tool-call gate is open; it packages the next source-aware real host runs without creating a duplicate CLI or buyer surface.",
      "Use the selected external activation task feed when a reviewer or automation platform needs the smallest contact-ready source set; count only real external MCP host runs.",
      "If any required spec differs, return no exact match and route to bulk quote recovery.",
    ],
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function fencedCode(language: string, value: string): string {
  return [`\`\`\`${language}`, value, "```"].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function mcpAdoptionKitMarkdown(runtime: AdoptionKitRuntime): string {
  const payload = mcpAdoptionKitPayload(runtime);
  const demoRows = payload.demo_skus
    .map((item) => `| ${item.sku} | ${escapeMarkdown(item.title)} | ${item.variant_id} | ${escapeMarkdown(item.use_case)} |`)
    .join("\n");
  const workflowRows = payload.useful_workflows
    .map((item) => `| ${escapeMarkdown(item.name)} | ${escapeMarkdown(item.prompt)} | ${item.best_tools.map((tool) => `\`${tool}\``).join(", ")} |`)
    .join("\n");
  return [
    "# Packrift MCP Adoption Kit",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Install",
    "",
    fencedJson(payload.install.generic_remote_mcp_json),
    "",
    "Stdio bridge for hosts without remote HTTP support:",
    "",
    fencedJson(payload.install.stdio_mcp_remote),
    "",
    `Stdio command: \`${payload.install.stdio_mcp_remote_command}\``,
    "",
    `Claude Code: \`${payload.install.claude_code}\``,
    "",
    `Codex: \`${payload.install.codex}\``,
    "",
    `Start page: ${payload.install.start_page}`,
    "",
    `Reviewer activation runner: ${payload.install.reviewer_activation_runner_generic}`,
    "",
    `Glama connector: ${payload.install.glama_connector}`,
    "",
    `Install matrix: ${payload.install.install_matrix}`,
    "",
    `Activation wave: ${payload.install.activation_wave_html}`,
    "",
    `External activation brief: ${payload.install.external_activation_brief_html}`,
    `Selected task feed JSONL: ${payload.install.external_activation_selected_tasks_jsonl}`,
    `Selected task feed CSV: ${payload.install.external_activation_selected_tasks_csv}`,
    `Guarded selected-runner: ${payload.install.external_activation_selected_runner_shell}`,
    "",
    "## Developer Share Pack",
    "",
    payload.developer_share_pack.purpose,
    "",
    payload.developer_share_pack.rule,
    "",
    `Selected external task JSONL: ${payload.developer_share_pack.external_activation_selected_tasks_jsonl}`,
    `Selected external task CSV: ${payload.developer_share_pack.external_activation_selected_tasks_csv}`,
    `Selected external runner: ${payload.developer_share_pack.external_activation_selected_runner_shell}`,
    "",
    payload.developer_share_pack.external_activation_success_gate,
    "",
    "| Source | Target | Start | Config | Install | First-run shell | Activation runner | Packet |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    payload.developer_share_pack.shareable_source_links
      .map(
        (link) =>
          `| ${link.source} | ${link.preferred_target} | ${link.tracked_start_url} | ${link.tracked_config_url} | ${link.tracked_install_urls.generic_streamable_http} | ${link.tracked_first_run_urls.preferred_shell} | ${link.reviewer_activation_runner} | ${link.source_activation_packet} |`
      )
      .join("\n"),
    "",
    "## First Five Minutes",
    "",
    payload.first_five_minutes
      .map((step) => [`### ${step.step}. ${step.name}`, "", step.why, "", fencedJson(step.request)].join("\n"))
      .join("\n\n"),
    "",
    "## Developer Examples",
    "",
    payload.developer_examples
      .map((example) => [`### ${example.title}`, "", example.purpose, "", fencedCode(example.language, example.code)].join("\n"))
      .join("\n\n"),
    "",
    "## Expected First Flow Outcomes",
    "",
    payload.expected_first_flow_outcomes.map((outcome) => `- ${outcome}`).join("\n"),
    "",
    "## Useful Workflows",
    "",
    "| Workflow | Prompt | Best tools |",
    "| --- | --- | --- |",
    workflowRows,
    "",
    "## Demo SKUs",
    "",
    "| SKU | Product | Variant ID | Use case |",
    "| --- | --- | --- | --- |",
    demoRows,
    "",
    "## Rules",
    "",
    payload.rules.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([name, url]) => `- ${name}: ${url}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-adoption-kit.json",
    "",
  ].join("\n");
}
