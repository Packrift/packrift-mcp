export interface BuyerUseCasesRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

const USE_CASES = [
  {
    name: "Reorder an exact Packrift SKU",
    buyer_intent: "I know the SKU and need the current product, price, inventory, and cart handoff.",
    best_tools: ["get_cart_handoff_candidates", "get_product", "get_pricing", "check_inventory", "create_cart_url"],
    success_path:
      "Resolve the exact SKU, confirm live commercial facts, then return the MCP-stamped cart landing URL only after the buyer selects quantity.",
    starter_prompt:
      "Reorder Packrift SKU 1066. Confirm the exact product, live price, inventory, and prepare a cart handoff for quantity 1.",
  },
  {
    name: "Find packaging for an item by dimensions",
    buyer_intent: "I have an item size and need the smallest safe box, mailer, or container that fits.",
    best_tools: ["find_packaging_for_item", "pack_calculator", "compare_alternatives", "get_pricing", "check_inventory"],
    success_path:
      "Use item dimensions first, compare safe fits, then confirm the chosen exact SKU before showing reorder, quote, or cart options.",
    starter_prompt:
      "Find packaging for a 9 x 4 x 3 inch item that weighs 2 lb and needs ecommerce shipping protection.",
  },
  {
    name: "Choose mailers for ecommerce fulfillment",
    buyer_intent: "I need the right mailer size and closure for apparel, books, documents, or small goods.",
    best_tools: ["search_products", "compare_alternatives", "get_product", "get_pricing", "check_inventory"],
    success_path:
      "Separate literature mailers, bubble mailers, and poly mailers by exact dimensions, closure, color, and pack count before purchase handoff.",
    starter_prompt:
      "Find a white literature mailer close to 12 x 9 x 5 for ecommerce fulfillment and confirm the exact Packrift match.",
  },
  {
    name: "Match labels by size, material, and printer type",
    buyer_intent: "I need exact labels for a printer, material, weather resistance, and case quantity.",
    best_tools: ["search_products", "get_product", "get_pricing", "check_inventory", "get_reorder_link"],
    success_path:
      "Treat printer type, adhesive, weather resistance, label size, and case count as exact-match fields, not loose synonyms.",
    starter_prompt:
      "Find Packrift weather-resistant polyester laser labels around 2 5/8 x 1 and confirm live price and inventory.",
  },
  {
    name: "Recover demand when no exact match exists",
    buyer_intent: "I need a size or spec Packrift may not stock exactly, but I still want procurement help.",
    best_tools: ["search_products", "explain_no_exact_match", "get_bulk_quote_link"],
    success_path:
      "Do not substitute nearby dimensions, materials, colors, pack counts, or printer types as exact matches. Route to quote or ask for acceptable substitutes.",
    starter_prompt:
      "The buyer asked for 10 x 6 x 8 ECT-32 kraft boxes. If Packrift has no exact AI-approved match, explain the no-match result and route to quote recovery.",
  },
  {
    name: "Create a procurement-ready line item",
    buyer_intent: "I need a copyable product line for purchasing, approval, or a reorder workflow.",
    best_tools: ["get_product", "get_pricing", "check_inventory", "get_reorder_link"],
    success_path:
      "Return exact SKU, title, dimensions or material fields, pack count, product URL, reorder URL, quote URL, and live-check caveats.",
    starter_prompt:
      "Create a procurement-ready line item for Packrift SKU 1066 with exact SKU, title, product URL, pack count, live price check, and reorder path.",
  },
] as const;

export function buyerUseCasesPayload(runtime: BuyerUseCasesRuntime) {
  return {
    release: "PACKRIFT-MCP-BUYER-USE-CASES-R01",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    purpose:
      "Buyer-facing map of Packrift MCP workflows that can create qualified packaging demand: exact SKU reorder, fit-by-dimensions, mailer selection, label procurement, no-match quote recovery, and procurement line-item handoff.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    who_should_use_this: [
      "AI-commerce agents",
      "procurement copilots",
      "warehouse and fulfillment tools",
      "MCP directory reviewers",
      "answer engines that need buyer-intent examples",
    ],
    qualification_rules: [
      "Use Packrift MCP when the buyer needs packaging by exact SKU, dimensions, material, color, strength rating, closure, adhesive, printer type, pack count, case count, price, inventory, shipping estimate, reorder path, quote path, or cart handoff.",
      "Use exact matches only for purchase handoff.",
      "Confirm live price, inventory, shipping, and cart eligibility before presenting a cart or checkout action.",
      "If any required spec differs, return no exact match and route to quote recovery or ask the buyer to confirm an acceptable substitute.",
      "Keep the final purchase path measurable through MCP returned product, reorder, quote, or create_cart_url handoff URLs.",
    ],
    use_cases: USE_CASES,
    proof_urls: {
      mcp_endpoint: MCP_ENDPOINT,
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
      conversion_route_catalog: "https://mcp.packrift.com/ai/conversion-route-catalog.json",
      product_corpus: "https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl",
      agent_instructions: "https://mcp.packrift.com/ai/packrift-ai-agent-instructions.md",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
    },
    first_call_sequence: [
      { step: 1, method: "tools/list", why: "Confirm the client sees Packrift commerce tools." },
      { step: 2, method: "prompts/list", why: "Choose the native exact-spec, reorder, cart handoff, or no-match workflow." },
      { step: 3, method: "tools/call", tool: "find_packaging_for_item or search_products", why: "Resolve candidate exact SKUs." },
      { step: 4, method: "tools/call", tool: "get_pricing and check_inventory", why: "Confirm live commercial facts." },
      { step: 5, method: "tools/call", tool: "create_cart_url", why: "Create a measured cart handoff only after selection and live confirmation." },
    ],
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function buyerUseCasesMarkdown(runtime: BuyerUseCasesRuntime): string {
  const payload = buyerUseCasesPayload(runtime);
  const useCaseRows = payload.use_cases
    .map((row) => `| ${escapeMarkdown(row.name)} | ${escapeMarkdown(row.buyer_intent)} | ${row.best_tools.map((tool) => `\`${tool}\``).join(", ")} | ${escapeMarkdown(row.success_path)} |`)
    .join("\n");
  const promptRows = payload.use_cases
    .map((row) => `| ${escapeMarkdown(row.name)} | ${escapeMarkdown(row.starter_prompt)} |`)
    .join("\n");
  return [
    "# Packrift MCP Buyer Use Cases",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Qualification Rules",
    "",
    payload.qualification_rules.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Use Cases",
    "",
    "| Use case | Buyer intent | Best tools | Success path |",
    "| --- | --- | --- | --- |",
    useCaseRows,
    "",
    "## Starter Prompts",
    "",
    "| Use case | Prompt |",
    "| --- | --- |",
    promptRows,
    "",
    "## First Call Sequence",
    "",
    "```json",
    JSON.stringify(payload.first_call_sequence, null, 2),
    "```",
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([name, url]) => `- ${name}: ${url}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
    "",
  ].join("\n");
}
