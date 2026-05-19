export interface CartActivationRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

const STARTER_SKUS = [
  {
    sku: "1066",
    title: "10x6x6 ECT-32 Kraft Long Corrugated Boxes - 25 Bundle",
    variant_id: "53472879935856",
    handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
    buyer_intent: "Reorder exact 10 x 6 x 6 kraft corrugated boxes.",
  },
  {
    sku: "MFL1295",
    title: "12 1/8 x 9 1/4 x 5 White Corrugated Literature Mailer - Self-Seal, 50 Pack",
    variant_id: "53472994427248",
    handle: "12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack",
    buyer_intent: "Find an exact white literature mailer for ecommerce fulfillment.",
  },
  {
    sku: "LL251WR",
    title: "2 5/8 x 1 Weather-Resistant Polyester Laser Labels - 3000/Case",
    variant_id: "53475925492080",
    handle: "2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case",
    buyer_intent: "Match weather-resistant polyester laser labels by exact size and case count.",
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

function exactSkuSequence(sku: (typeof STARTER_SKUS)[number]) {
  return [
    toolCall(`candidate-${sku.sku}`, "get_cart_handoff_candidates", { sku: sku.sku, limit: 1 }),
    toolCall(`product-${sku.sku}`, "get_product", { handle: sku.handle }),
    toolCall(`price-${sku.sku}`, "get_pricing", { variant_ids: [sku.variant_id], quantity: 1 }),
    toolCall(`inventory-${sku.sku}`, "check_inventory", { variant_ids: [sku.variant_id] }),
    toolCall(`cart-${sku.sku}`, "create_cart_url", {
      sku: sku.sku,
      quantity: 1,
      selected_sku: sku.sku,
      selected_handle: sku.handle,
      match_type: "buyer_confirmed_exact_sku",
      source_context: "mcp_cart_activation",
      journey_id: `mcp_cart_activation_${sku.sku}_${sku.variant_id}`,
      result_set_id: "mcp_cart_activation",
      utm_term: sku.sku,
    }),
  ];
}

export function mcpCartActivationPayload(runtime: CartActivationRuntime) {
  return {
    release: "PACKRIFT-MCP-CART-ACTIVATION-R01",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    purpose:
      "Turn Packrift MCP discovery into qualified buyer progression by giving agents a short, measurable path from exact packaging intent to MCP cart landing.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    primary_rule:
      "Use the MCP cart landing URL returned by create_cart_url or cart_url_qty_1_candidate first. It must start with https://mcp.packrift.com/r/cart/ and then forward to Shopify with the same MCP attribution.",
    do_not:
      "Do not present direct Shopify cart URLs as the primary agent handoff when an MCP cart landing URL is available. Keep the final Shopify cart URL only as the forwarded destination and fallback evidence.",
    qualified_cart_landing_definition:
      "A qualified MCP cart landing is an external buyer or agent reaching a URL with utm_source=chatgpt-mcp, utm_medium=mcp_tool, utm_campaign=create_cart_url, and the /r/cart/{SKU} landing path before Shopify checkout.",
    required_live_confirmation: [
      "exact SKU or exact dimensions selected by buyer",
      "get_product confirms product identity and variant",
      "get_pricing confirms live unit price",
      "check_inventory confirms availability",
      "buyer-selected quantity is known",
      "create_cart_url returns the MCP cart landing URL",
    ],
    activation_paths: [
      {
        id: "exact_sku_reorder_to_cart",
        buyer_prompt:
          "Reorder Packrift SKU 1066. Confirm exact product, live price, inventory, and prepare a measured cart handoff for quantity 1.",
        expected_agent_behavior:
          "Resolve a single exact SKU, run live checks, then return the MCP cart landing URL as the primary buyer action.",
        json_rpc_sequence: exactSkuSequence(STARTER_SKUS[0]),
      },
      {
        id: "mailer_selection_to_cart",
        buyer_prompt:
          "Find a white literature mailer close to 12 x 9 x 5, confirm the exact Packrift match, and prepare a measured cart handoff if the buyer confirms the SKU.",
        expected_agent_behavior:
          "Separate similar mailer sizes and closure types, confirm MFL1295 only if exact, then use create_cart_url after live checks.",
        json_rpc_sequence: exactSkuSequence(STARTER_SKUS[1]),
      },
      {
        id: "label_procurement_to_cart",
        buyer_prompt:
          "Find weather-resistant polyester laser labels around 2 5/8 x 1 and prepare a measured cart handoff only after exact spec, price, and inventory are confirmed.",
        expected_agent_behavior:
          "Treat label size, material, printer type, and case count as exact fields, then use create_cart_url for a measured handoff.",
        json_rpc_sequence: exactSkuSequence(STARTER_SKUS[2]),
      },
      {
        id: "fit_by_dimensions_then_confirm",
        buyer_prompt:
          "Find packaging for a 9 x 4 x 3 inch item that weighs 2 lb and needs ecommerce shipping protection.",
        expected_agent_behavior:
          "Use fit and comparison tools first. Only move to create_cart_url after the buyer confirms a returned exact SKU and quantity.",
        json_rpc_sequence: [
          toolCall("fit-item", "find_packaging_for_item", {
            item: { length: 9, width: 4, height: 3, unit: "in" },
            weight: { value: 2, unit: "lb" },
            use_case: "ecommerce shipping protection",
            limit: 5,
          }),
          toolCall("compare-safe-fits", "compare_alternatives", {
            requested_spec: "packaging for a 9 x 4 x 3 inch, 2 lb ecommerce item",
            family: "boxes",
            limit: 5,
          }),
        ],
        cart_rule:
          "After a specific returned SKU is selected, continue with get_product, get_pricing, check_inventory, and create_cart_url.",
      },
    ],
    starter_skus: STARTER_SKUS,
    proof_urls: {
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      funnel_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      endpoint_health: "https://mcp.packrift.com/health",
    },
    success_signals: [
      "tools/list and prompts/list are visible from external agents",
      "get_cart_handoff_candidates is called for exact SKUs",
      "get_pricing and check_inventory run before cart handoff",
      "create_cart_url returns an MCP /r/cart landing URL",
      "GA4 sees qualified external mcp_cart_landing or cart progression events",
      "Shopify orders carry MCP cart attributes or chatgpt-mcp UTM continuity",
    ],
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function mcpCartActivationMarkdown(runtime: CartActivationRuntime): string {
  const payload = mcpCartActivationPayload(runtime);
  const pathRows = payload.activation_paths
    .map((path) => `| ${escapeMarkdown(path.id)} | ${escapeMarkdown(path.buyer_prompt)} | ${escapeMarkdown(path.expected_agent_behavior)} |`)
    .join("\n");
  const skuRows = payload.starter_skus
    .map((sku) => `| ${sku.sku} | ${escapeMarkdown(sku.title)} | ${sku.variant_id} | ${escapeMarkdown(sku.buyer_intent)} |`)
    .join("\n");
  return [
    "# Packrift MCP Cart Activation",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Primary Rule",
    "",
    payload.primary_rule,
    "",
    "## Do Not",
    "",
    payload.do_not,
    "",
    "## Qualified Cart Landing Definition",
    "",
    payload.qualified_cart_landing_definition,
    "",
    "## Required Live Confirmation",
    "",
    payload.required_live_confirmation.map((step) => `- ${step}`).join("\n"),
    "",
    "## Activation Paths",
    "",
    "| Path | Buyer prompt | Expected agent behavior |",
    "| --- | --- | --- |",
    pathRows,
    "",
    "## Exact SKU JSON-RPC Sequence",
    "",
    fencedJson(payload.activation_paths[0]?.json_rpc_sequence ?? []),
    "",
    "## Starter SKUs",
    "",
    "| SKU | Product | Variant ID | Buyer intent |",
    "| --- | --- | --- | --- |",
    skuRows,
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([name, url]) => `- ${name}: ${url}`)
      .join("\n"),
    "",
    "## Success Signals",
    "",
    payload.success_signals.map((signal) => `- ${signal}`).join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-cart-activation.json",
    "",
  ].join("\n");
}
