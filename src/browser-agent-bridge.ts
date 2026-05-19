export interface BrowserAgentBridgeRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

const BROWSER_AGENT_WORKFLOWS = [
  {
    id: "browse_style_product_search",
    title: "Read-first packaging product search",
    browser_agent_intent:
      "A browser or Browse-style agent needs structured packaging results from Packrift without guessing through storefront search.",
    start_urls: [
      "https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl",
      "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
    ],
    required_mcp_sequence: ["tools/list", "search_products", "get_product", "get_pricing", "check_inventory"],
    handoff_rule:
      "Use browser reading for discovery only. Use MCP live checks before showing price, stock, reorder, quote, or cart actions.",
  },
  {
    id: "exact_sku_browser_reorder",
    title: "Exact SKU reorder from a browser session",
    browser_agent_intent:
      "A buyer or agent has a Packrift SKU and wants a product, reorder path, or cart handoff.",
    start_urls: [
      "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      "https://mcp.packrift.com/ai/sku/1066.json",
      "https://mcp.packrift.com/ai/sku/MFL1295.json",
      "https://mcp.packrift.com/ai/sku/LL251WR.json",
    ],
    required_mcp_sequence: [
      "get_cart_handoff_candidates",
      "get_product",
      "get_pricing",
      "check_inventory",
      "create_cart_url",
    ],
    handoff_rule:
      "Only create or present a cart URL after the buyer confirms the exact SKU and quantity and MCP confirms live price and inventory.",
  },
  {
    id: "no_exact_match_recovery",
    title: "No-exact-match quote recovery",
    browser_agent_intent:
      "A browser agent finds nearby packaging but the required dimensions, material, closure, printer type, color, or count differs.",
    start_urls: [
      "https://mcp.packrift.com/ai/no-match-policy.md",
      "https://mcp.packrift.com/ai/crawler-safe-purchase-paths.md",
      "https://mcp.packrift.com/ai/measured-handoffs.json",
    ],
    required_mcp_sequence: ["search_products", "explain_no_exact_match", "get_bulk_quote_link"],
    handoff_rule:
      "Do not substitute nearby specs as exact. Route to quote recovery or ask the buyer to confirm acceptable substitutions.",
  },
] as const;

export function browserAgentBridgePayload(runtime: BrowserAgentBridgeRuntime) {
  return {
    release: "PACKRIFT-BROWSER-AGENT-BRIDGE-R01",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    purpose:
      "Give Browserbase Browse, browser-use, Computer Use, Playwright, CUA, and other browser agents a read-first Packrift path that still routes live commerce facts and cart handoff through the canonical Packrift MCP endpoint.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    audience: [
      "Browserbase Browse-style skills",
      "browser-use agents",
      "Playwright and Computer Use agents",
      "AI shopping agents that can read URLs but cannot install MCP directly",
      "MCP-capable agents that need browser fallback URLs",
    ],
    operating_rules: [
      "This is a bridge, not a Packrift CLI or alternate buyer surface.",
      "Use browser primitives for reading public Packrift resources and product pages.",
      "Use Packrift MCP for live price, inventory, shipping, exact product detail, and cart URL construction.",
      "Keep purchase handoff measurable with MCP returned product, reorder, quote, or create_cart_url links.",
      "Never treat nearby dimensions, materials, colors, adhesives, printer types, pack counts, case counts, or strength ratings as exact substitutes.",
    ],
    browser_skill_candidate: {
      status: "candidate",
      name: "packrift.com packaging procurement",
      mode: "read_first_mcp_confirmed",
      not_yet_a_published_browse_skill: true,
      suggested_skill_inputs: ["query", "sku", "dimensions", "family", "material", "color", "case_count", "quantity"],
      suggested_skill_outputs: [
        "sku",
        "title",
        "exact_spec_fields",
        "product_url",
        "mcp_sku_record",
        "live_confirmation_required",
        "reorder_url",
        "quote_url",
        "mcp_endpoint",
      ],
      canonical_endpoint: MCP_ENDPOINT,
    },
    install_or_call: {
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
      browser_agent_start_here: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      browse_skill_pack: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
    },
    workflows: BROWSER_AGENT_WORKFLOWS,
    proof_urls: {
      bridge_json: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      bridge_markdown: "https://mcp.packrift.com/ai/browser-agent-bridge.md",
      browserbase_browse_skill_pack: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
      browserbase_browse_skill_pack_markdown: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.md",
      mcp_endpoint: MCP_ENDPOINT,
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
      product_corpus: "https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl",
    },
    success_metrics: [
      "browser-agent visits to browser-agent-bridge.json or .md",
      "resources/list and resources/read calls for bridge routes",
      "MCP tool calls after browser-agent discovery",
      "create_cart_url calls with browser-agent source context",
      "stamped cart landings from MCP-confirmed exact SKUs",
    ],
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function browserAgentBridgeMarkdown(runtime: BrowserAgentBridgeRuntime): string {
  const payload = browserAgentBridgePayload(runtime);
  const ruleRows = payload.operating_rules.map((rule) => `- ${rule}`).join("\n");
  const workflowRows = payload.workflows
    .map(
      (workflow) =>
        `| ${escapeMarkdown(workflow.title)} | ${escapeMarkdown(workflow.browser_agent_intent)} | ${workflow.required_mcp_sequence.map((step) => `\`${step}\``).join(", ")} | ${escapeMarkdown(workflow.handoff_rule)} |`
    )
    .join("\n");
  return [
    "# Packrift Browser-Agent Bridge",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical MCP endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Operating Rules",
    "",
    ruleRows,
    "",
    "## Browser Skill Candidate",
    "",
    `Status: ${payload.browser_skill_candidate.status}`,
    `Mode: ${payload.browser_skill_candidate.mode}`,
    `Published Browse skill: ${payload.browser_skill_candidate.not_yet_a_published_browse_skill ? "no" : "yes"}`,
    "",
    "## Workflows",
    "",
    "| Workflow | Browser-agent intent | Required MCP sequence | Handoff rule |",
    "| --- | --- | --- | --- |",
    workflowRows,
    "",
    "## Install Or Call",
    "",
    "```json",
    JSON.stringify(payload.install_or_call.generic_remote_mcp_json, null, 2),
    "```",
    "",
    `Claude Code: \`${payload.install_or_call.claude_code}\``,
    "",
    `Codex: \`${payload.install_or_call.codex}\``,
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/browser-agent-bridge.json",
    "",
  ].join("\n");
}
