export interface AdoptionKitRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

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

export function mcpAdoptionKitPayload(runtime: AdoptionKitRuntime) {
  const demo = DEMO_SKUS[0];
  return {
    release: "PACKRIFT-MCP-ADOPTION-KIT-R01",
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
      cursor_windsurf_vscode: {
        mcpServers: {
          packrift: {
            type: "http",
            url: MCP_ENDPOINT,
          },
        },
      },
      glama_connector: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
      marketplace_listing: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
      registry_search: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
      self_hosted_container_optional: "docker pull ghcr.io/packrift/packrift-mcp:latest",
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
        name: "Get a ready exact-SKU cart candidate",
        why: "Start with a conversion-proven SKU that already has safe create_cart_url arguments.",
        request: toolCall("candidate-1066", "get_cart_handoff_candidates", { sku: demo.sku, limit: 1 }),
      },
      {
        step: 4,
        name: "Confirm live price",
        why: "Do not show price-dependent handoff until live pricing is checked.",
        request: toolCall("price-1066", "get_pricing", {
          variant_ids: [demo.variant_id],
          quantity: 1,
        }),
      },
      {
        step: 5,
        name: "Confirm live inventory",
        why: "Do not show a cart or checkout path for an unavailable exact SKU.",
        request: toolCall("inventory-1066", "check_inventory", {
          variant_ids: [demo.variant_id],
        }),
      },
      {
        step: 6,
        name: "Create measured cart handoff only after confirmation",
        why: "Return an MCP cart landing URL with attribution and exact SKU continuity.",
        request: toolCall("cart-1066", "create_cart_url", {
          items: [{ variant_id: demo.variant_id, qty: 1 }],
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
    useful_workflows: [
      {
        name: "Exact SKU reorder",
        prompt: "Reorder Packrift SKU 1066. Confirm product, live price, inventory, and then prepare a cart handoff for quantity 1.",
        best_tools: ["get_cart_handoff_candidates", "get_product", "get_pricing", "check_inventory", "create_cart_url"],
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
      manifest: "https://mcp.packrift.com/manifest",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
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
      "Use only AI_APPROVE exact matches for purchase handoff.",
      "Confirm live price, inventory, shipping, and cart eligibility before presenting cart or checkout actions.",
      "If any required spec differs, return no exact match and route to bulk quote recovery.",
    ],
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
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
    `Claude Code: \`${payload.install.claude_code}\``,
    "",
    `Codex: \`${payload.install.codex}\``,
    "",
    `Glama connector: ${payload.install.glama_connector}`,
    "",
    "## First Five Minutes",
    "",
    payload.first_five_minutes
      .map((step) => [`### ${step.step}. ${step.name}`, "", step.why, "", fencedJson(step.request)].join("\n"))
      .join("\n\n"),
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
