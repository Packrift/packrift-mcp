export interface FirstRunProofRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

export interface FirstRunProofDemo {
  mode: string;
  live_systems_mutated: boolean;
  analytics_recorded: boolean;
  sku: string;
  title: string;
  variant_id: string;
  handle: string;
  quantity: number;
  product: Record<string, unknown>;
  pricing: Record<string, unknown>;
  inventory: Record<string, unknown>;
  cart: Record<string, unknown>;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

const JSON_RPC_SEQUENCE = [
  {
    jsonrpc: "2.0",
    id: "product-1066",
    method: "tools/call",
    params: {
      name: "get_product",
      arguments: { handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle" },
    },
  },
  {
    jsonrpc: "2.0",
    id: "price-1066",
    method: "tools/call",
    params: {
      name: "get_pricing",
      arguments: {
        variant_ids: ["53472879935856"],
        quantity: 1,
        selected_sku: "1066",
        selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
        match_type: "first_run_proof",
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: "inventory-1066",
    method: "tools/call",
    params: {
      name: "check_inventory",
      arguments: {
        variant_ids: ["53472879935856"],
        selected_sku: "1066",
        selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
        match_type: "first_run_proof",
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: "cart-1066",
    method: "tools/call",
    params: {
      name: "create_cart_url",
      arguments: {
        items: [{ variant_id: "53472879935856", qty: 1 }],
        selected_sku: "1066",
        selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
        match_type: "first_run_proof",
        source_context: "mcp_first_run_proof",
        journey_id: "mcp_first_run_proof_1066_53472879935856",
        result_set_id: "mcp_first_run_proof",
        utm_term: "1066",
      },
    },
  },
] as const;

export function mcpFirstRunProofPayload(runtime: FirstRunProofRuntime, demo: FirstRunProofDemo) {
  return {
    release: "PACKRIFT-MCP-FIRST-RUN-PROOF-R01",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    purpose:
      "Give external agents, developers, and directory reviewers a compact live proof that Packrift MCP can confirm an exact SKU, live price, live inventory, and a measured MCP cart landing without creating a duplicate CLI or buyer surface.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    guardrails: [
      "This is a synthetic read-only proof run except for generating a cart URL string.",
      "The cart URL is generated with analytics suppressed; do not count this demo as buyer demand or revenue proof.",
      "Real buyer workflows must call the hosted MCP endpoint and confirm exact SKU, live price, live inventory, and buyer-selected quantity before cart handoff.",
      "Use the returned MCP /r/cart landing URL as the primary buyer handoff when create_cart_url returns one.",
    ],
    first_run_sequence: JSON_RPC_SEQUENCE,
    live_demo: demo,
    success_criteria: [
      "get_product returns the AI_APPROVE product identity.",
      "get_pricing returns current unit price and currency.",
      "check_inventory returns current available quantity and in_stock status.",
      "create_cart_url returns a URL that starts with https://mcp.packrift.com/r/cart/ and preserves chatgpt-mcp / mcp_tool / create_cart_url attribution.",
    ],
    proof_urls: {
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      health: "https://mcp.packrift.com/health",
    },
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

export function mcpFirstRunProofMarkdown(runtime: FirstRunProofRuntime, demo: FirstRunProofDemo): string {
  const payload = mcpFirstRunProofPayload(runtime, demo);
  return [
    "# Packrift MCP First-Run Proof",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Guardrails",
    "",
    payload.guardrails.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Live Demo Result",
    "",
    fencedJson(payload.live_demo),
    "",
    "## JSON-RPC Sequence",
    "",
    fencedJson(payload.first_run_sequence),
    "",
    "## Success Criteria",
    "",
    payload.success_criteria.map((item) => `- ${item}`).join("\n"),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([name, url]) => `- ${name}: ${url}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-first-run-proof.json",
    "",
  ].join("\n");
}
