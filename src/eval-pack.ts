import { clineMcpJson, mcpFirstUsefulRun, sourceAwareMcpEndpoint, stdioMcpRemoteJson, trackedInstallUrl } from "./install-action.js";
import { trackedRunUrl } from "./first-run-action.js";

export interface McpEvalPackRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const EVAL_SKU = "1066";
const EVAL_VARIANT_ID = "53472879935856";
const EVAL_HANDLE = "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle";

function normalizeEvalSlug(value: string | undefined, fallback: string): string {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return slug.length >= 2 ? slug : fallback;
}

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

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

const ACCEPTANCE_CASES = [
  {
    id: "host_tools_list",
    required: true,
    buyer_facing: false,
    request: { jsonrpc: "2.0", id: "tools", method: "tools/list" },
    assertions: [
      "result.tools includes search_products",
      "result.tools includes get_cart_handoff_candidates",
      "result.tools includes get_pricing",
      "result.tools includes check_inventory",
      "result.tools includes create_cart_url",
      "result.tools includes prepare_purchase_handoff",
    ],
  },
  {
    id: "host_prompts_list",
    required: true,
    buyer_facing: false,
    request: { jsonrpc: "2.0", id: "prompts", method: "prompts/list" },
    assertions: [
      "result.prompts includes find_exact_packaging_spec",
      "result.prompts includes reorder_packrift_sku",
      "result.prompts includes prepare_cart_handoff",
    ],
  },
  {
    id: "exact_sku_candidate",
    required: true,
    buyer_facing: true,
    request: toolCall("candidate-1066", "get_cart_handoff_candidates", {
      sku: EVAL_SKU,
      limit: 1,
      source_context: "mcp_eval_pack_candidate",
      journey_id: `mcp_eval_pack_${EVAL_SKU}_${EVAL_VARIANT_ID}`,
      result_set_id: "mcp_eval_pack",
    }),
    assertions: [
      "candidate selected_sku is 1066",
      "candidate includes variant_id 53472879935856",
      "candidate includes create_cart_url arguments",
      "candidate says live price and inventory checks are required before cart handoff",
    ],
  },
  {
    id: "live_price",
    required: true,
    buyer_facing: true,
    request: toolCall("price-1066", "get_pricing", {
      variant_ids: [EVAL_VARIANT_ID],
      quantity: 1,
      selected_sku: EVAL_SKU,
      selected_handle: EVAL_HANDLE,
      match_type: "mcp_eval_pack",
      source_context: "mcp_eval_pack_price",
      journey_id: `mcp_eval_pack_${EVAL_SKU}_${EVAL_VARIANT_ID}`,
      result_set_id: "mcp_eval_pack",
    }),
    assertions: [
      "price response includes variant_id 53472879935856",
      "price response includes unit_price",
      "price response includes currency",
      "no cached or guessed price is presented as live",
    ],
  },
  {
    id: "live_inventory",
    required: true,
    buyer_facing: true,
    request: toolCall("inventory-1066", "check_inventory", {
      variant_ids: [EVAL_VARIANT_ID],
      selected_sku: EVAL_SKU,
      selected_handle: EVAL_HANDLE,
      match_type: "mcp_eval_pack",
      source_context: "mcp_eval_pack_inventory",
      journey_id: `mcp_eval_pack_${EVAL_SKU}_${EVAL_VARIANT_ID}`,
      result_set_id: "mcp_eval_pack",
    }),
    assertions: [
      "inventory response includes variant_id 53472879935856",
      "inventory response includes in_stock",
      "inventory is checked before create_cart_url",
    ],
  },
  {
    id: "measured_cart_handoff",
    required: true,
    buyer_facing: true,
    request: toolCall("cart-1066", "create_cart_url", {
      sku: EVAL_SKU,
      quantity: 1,
      selected_sku: EVAL_SKU,
      selected_handle: EVAL_HANDLE,
      match_type: "mcp_eval_pack",
      source_context: "mcp_eval_pack_cart",
      journey_id: `mcp_eval_pack_${EVAL_SKU}_${EVAL_VARIANT_ID}`,
      result_set_id: "mcp_eval_pack",
      utm_term: EVAL_SKU,
    }),
    assertions: [
      "cart response url starts with https://mcp.packrift.com/r/cart/1066",
      "cart response includes final_cart_url but the MCP /r/cart URL is the primary handoff",
      "no order is placed",
    ],
  },
] as const;

export function mcpEvalPackPayload(runtime: McpEvalPackRuntime, source = "mcp_eval_pack") {
  const sourceSlug = normalizeEvalSlug(source, "mcp_eval_pack");
  const firstUsefulRun = mcpFirstUsefulRun(sourceSlug, "generic_streamable_http");
  const genericRunUrl = trackedRunUrl(sourceSlug, "generic_streamable_http");
  return {
    release: "PACKRIFT-MCP-EVAL-PACK-R01",
    generated_at: new Date().toISOString(),
    purpose:
      "Give MCP hosts, directories, and AI-commerce builders a copy-ready acceptance-test pack that proves Packrift MCP is installed in a real host and can reach exact SKU lookup, live price, live inventory, and measured cart handoff.",
    canonical_endpoint: MCP_ENDPOINT,
    source: sourceSlug,
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    install_rule:
      "Use the hosted Packrift MCP endpoint. The stdio option is only an mcp-remote bridge for hosts that cannot connect to remote HTTP directly; do not create a Packrift CLI or duplicate buyer surface.",
    acceptance_gate: {
      real_mcp_host_required: true,
      browser_proof_is_not_enough: true,
      required_final_tool: "create_cart_url",
      required_cart_url_prefix: "https://mcp.packrift.com/r/cart/1066",
      pass_threshold: "All required cases must pass in the external MCP host, and the final response must include the measured MCP /r/cart URL.",
      no_order_created: true,
    },
    source_aware_endpoints: {
      generic_streamable_http: sourceAwareMcpEndpoint(sourceSlug, "generic_streamable_http"),
      stdio_mcp_remote: sourceAwareMcpEndpoint(sourceSlug, "stdio_mcp_remote"),
      codex: sourceAwareMcpEndpoint(sourceSlug, "codex"),
      claude_code: sourceAwareMcpEndpoint(sourceSlug, "claude_code"),
      cline: sourceAwareMcpEndpoint(sourceSlug, "cline"),
    },
    host_configs: {
      remote_http: {
        mcpServers: {
          packrift: {
            type: "http",
            url: sourceAwareMcpEndpoint(sourceSlug, "generic_streamable_http"),
          },
        },
      },
      stdio_mcp_remote: stdioMcpRemoteJson("packrift", sourceAwareMcpEndpoint(sourceSlug, "stdio_mcp_remote")),
      cline: clineMcpJson("packrift", sourceAwareMcpEndpoint(sourceSlug, "cline")),
    },
    tracked_actions: {
      install_generic: trackedInstallUrl(sourceSlug, "generic_streamable_http"),
      install_stdio_bridge: trackedInstallUrl(sourceSlug, "stdio_mcp_remote"),
      install_codex: trackedInstallUrl(sourceSlug, "codex"),
      install_cline: trackedInstallUrl(sourceSlug, "cline"),
      first_run_generic: genericRunUrl,
      first_run_shell: `${genericRunUrl}&format=sh`,
      first_run_html: `${genericRunUrl}&format=html`,
      first_run_execute: `${genericRunUrl}&execute=1`,
      activation_runner: `https://mcp.packrift.com/r/activate/${sourceSlug}?format=html`,
      activation_shell: `https://mcp.packrift.com/r/activate/${sourceSlug}?format=sh`,
    },
    copy_ready: {
      one_line_shell: `curl -sS ${shellQuote(`${genericRunUrl}&format=sh`)} | bash`,
      agent_prompt: firstUsefulRun.agent_prompt,
      curl_script: firstUsefulRun.curl_script,
      json_rpc_sequence: firstUsefulRun.sequence,
    },
    cases: ACCEPTANCE_CASES,
    required_report_fields: [
      "host name and version",
      "Packrift MCP install target used",
      "tools/list result includes the required Packrift tools",
      "live unit price and currency for SKU 1066",
      "live inventory status for SKU 1066",
      "measured cart URL beginning https://mcp.packrift.com/r/cart/1066",
      "confirmation that no order was placed",
    ],
    proof_urls: {
      health: "https://mcp.packrift.com/health",
      install_actions: "https://mcp.packrift.com/ai/mcp-install-actions.json",
      first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
    },
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function fencedShell(value: string): string {
  return ["```sh", value, "```"].join("\n");
}

export function mcpEvalPackMarkdown(runtime: McpEvalPackRuntime, source = "mcp_eval_pack"): string {
  const payload = mcpEvalPackPayload(runtime, source);
  return [
    "# Packrift MCP Eval Pack",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    `Source: ${payload.source}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Install Rule",
    "",
    payload.install_rule,
    "",
    "## Acceptance Gate",
    "",
    fencedJson(payload.acceptance_gate),
    "",
    "## Host Configs",
    "",
    fencedJson(payload.host_configs),
    "",
    "## One-Line Runner",
    "",
    fencedShell(payload.copy_ready.one_line_shell),
    "",
    "## Agent Prompt",
    "",
    payload.copy_ready.agent_prompt,
    "",
    "## Required Cases",
    "",
    payload.cases
      .map((test) => [`### ${test.id}`, "", fencedJson(test.request), "", test.assertions.map((assertion) => `- ${assertion}`).join("\n")].join("\n"))
      .join("\n\n"),
    "",
    "## Required Report Fields",
    "",
    payload.required_report_fields.map((field) => `- ${field}`).join("\n"),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([name, url]) => `- ${name}: ${url}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-eval-pack.json",
    "",
  ].join("\n");
}
