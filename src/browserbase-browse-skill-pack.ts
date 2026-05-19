export interface BrowserbaseBrowseSkillPackRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const BRIDGE_URL = "https://mcp.packrift.com/ai/browser-agent-bridge.json";
const ROOT_BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/SKILL.md";
const BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md";

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

const DEMO_SEQUENCE = [
  {
    step: 1,
    name: "Read the bridge",
    method: "GET",
    url: BRIDGE_URL,
    expected: "release PACKRIFT-BROWSER-AGENT-BRIDGE-R01 and canonical_endpoint https://mcp.packrift.com/mcp",
  },
  {
    step: 2,
    name: "Fetch a ready exact-SKU workflow",
    method: "GET",
    url: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
    expected: "workflow one_call_purchase_handoff_1066 and exact_sku_reorder_1066 with live-check sequence before cart handoff",
  },
  {
    step: 3,
    name: "Use the one-call exact-SKU prep path",
    method: "POST",
    url: MCP_ENDPOINT,
    request: toolCall("prepare-1066", "prepare_purchase_handoff", {
      sku: "1066",
      quantity: 1,
      buyer_confirmed: false,
      source_context: "browserbase_browse",
    }),
    expected: "live price and inventory are confirmed, but cart remains null until buyer_confirmed is true",
  },
  {
    step: 4,
    name: "Call MCP for candidate continuity",
    method: "POST",
    url: MCP_ENDPOINT,
    request: toolCall("candidate-1066", "get_cart_handoff_candidates", { sku: "1066", limit: 1 }),
    expected: "candidate includes selected_sku 1066, variant_id, handle, and create_cart_url_sku_arguments",
  },
  {
    step: 5,
    name: "Call MCP for live price",
    method: "POST",
    url: MCP_ENDPOINT,
    request: toolCall("price-1066", "get_pricing", {
      variant_ids: ["53472879935856"],
      quantity: 1,
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      match_type: "browserbase_browse_skill_pack",
    }),
    expected: "unit_price and currency are returned from live Shopify data",
  },
  {
    step: 6,
    name: "Call MCP for live inventory",
    method: "POST",
    url: MCP_ENDPOINT,
    request: toolCall("inventory-1066", "check_inventory", {
      variant_ids: ["53472879935856"],
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      match_type: "browserbase_browse_skill_pack",
    }),
    expected: "in_stock true or a clear unavailable state",
  },
  {
    step: 7,
    name: "Create measured cart handoff only after live confirmation",
    method: "POST",
    url: MCP_ENDPOINT,
    request: toolCall("cart-1066", "create_cart_url", {
      sku: "1066",
      quantity: 1,
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      match_type: "browserbase_browse_skill_pack",
      source_context: "browserbase_browse",
      journey_id: "browserbase_browse_1066_53472879935856",
      result_set_id: "browserbase_browse_skill_pack",
      utm_term: "1066",
    }),
    expected: "url starts with https://mcp.packrift.com/r/cart/1066 and cart_continuity.validated is true",
  },
] as const;

export function browserbaseBrowseSkillPackPayload(runtime: BrowserbaseBrowseSkillPackRuntime) {
  return {
    release: "PACKRIFT-BROWSERBASE-BROWSE-SKILL-PACK-R02",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    purpose:
      "A thin Browse/browser-skill starter pack for Packrift. It gives agents a canonical SKILL.md playbook for public discovery, then routes all live price, inventory, shipping, and cart handoff through the canonical hosted MCP endpoint.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    browse_skill_candidate: {
      name: "Packrift exact-spec packaging procurement",
      short_description:
        "Find exact Packrift packaging SKUs, confirm live price and inventory through MCP, and return measured cart or quote handoffs.",
      start_url: BRIDGE_URL,
      skill_md_url: ROOT_BROWSE_SKILL_MD_URL,
      canonical_skill_md_url: BROWSE_SKILL_MD_URL,
      canonical_endpoint: MCP_ENDPOINT,
      status: "candidate_pack_ready",
      duplicate_surface_guard:
        "This is not a Packrift CLI, checkout, or alternate buyer surface. It is a read-first browser-skill wrapper around https://mcp.packrift.com/mcp.",
      suggested_inputs: ["sku", "product_dimensions", "family", "material", "color", "case_count", "quantity", "required_use"],
      suggested_outputs: [
        "exact_match_status",
        "sku",
        "title",
        "spec_fields",
        "live_price",
        "live_inventory",
        "mcp_cart_url",
        "quote_url",
        "no_match_reason",
      ],
    },
    skill_md: {
      root_url: ROOT_BROWSE_SKILL_MD_URL,
      canonical_url: BROWSE_SKILL_MD_URL,
      format: "Markdown SKILL.md with YAML frontmatter, install snippets, JSON-RPC examples, exact-match rules, and MCP-only commercial fact checks.",
      submission_note:
        "Use this as the Browse/browser-agent submission artifact or as the direct instruction file for any agent that accepts open-web skills. It does not replace the hosted MCP endpoint.",
      frontmatter: {
        name: "packrift-mcp",
        description:
          "Exact-spec packaging procurement through the hosted Packrift MCP endpoint: product search, live price, live inventory, no-match recovery, and measured cart handoff.",
        compatibility: "Browserbase Browse-style agents, browser-use, Playwright, CUA, Claude, Codex, Cursor, Windsurf, VS Code MCP clients, and any agent that can call a remote Streamable HTTP MCP endpoint.",
      },
    },
    browser_agent_rules: [
      "Read https://mcp.packrift.com/SKILL.md first when a browser-skill host asks for a single Packrift skill file.",
      "Use public URLs for read-first discovery, not for final commercial facts.",
      "Call Packrift MCP for get_product, get_pricing, check_inventory, shipping estimates, no-match handling, and create_cart_url.",
      "Use prepare_purchase_handoff when the browser agent already has an exact SKU and needs a compact live-confirmed handoff path.",
      "Use create_cart_url with sku plus quantity after buyer confirmation; the tool blocks SKU, handle, and variant mismatches.",
      "Never present nearby dimensions, material, closure, printer type, pack count, case count, or color as an exact substitute.",
      "When no exact AI_APPROVE item exists, route to explain_no_exact_match and get_bulk_quote_link instead of forcing a cart.",
    ],
    start_urls: [
      ROOT_BROWSE_SKILL_MD_URL,
      BROWSE_SKILL_MD_URL,
      BRIDGE_URL,
      "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      "https://mcp.packrift.com/ai/no-match-policy.md",
    ],
    demo_sequence: DEMO_SEQUENCE,
    buyer_prompts: [
      "Reorder Packrift SKU 1066. Confirm live price and inventory, then create a cart for quantity 1.",
      "Find packaging for a 9 x 4 x 3 inch ecommerce item weighing 2 lb. Do not substitute non-exact sizes as exact.",
      "I need 12 1/8 x 9 1/4 x 5 white self-seal literature mailers. Confirm exact SKU and live availability.",
      "Find 2 5/8 x 1 weather-resistant polyester laser labels and confirm the exact case count before handoff.",
    ],
    proof_urls: {
      root_skill_md: ROOT_BROWSE_SKILL_MD_URL,
      canonical_skill_md: BROWSE_SKILL_MD_URL,
      browse_skill_pack_json: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
      browse_skill_pack_markdown: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.md",
      browser_agent_bridge: BRIDGE_URL,
      mcp_endpoint: MCP_ENDPOINT,
      health: "https://mcp.packrift.com/health",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
    },
    success_metrics: [
      "browserbase_browse_skill_pack resource reads",
      "root SKILL.md and browserbase-browse SKILL.md resource reads",
      "MCP tools/list and resources/list after browser-skill discovery",
      "get_cart_handoff_candidates calls with source context browserbase_browse",
      "prepare_purchase_handoff calls with source_context browserbase_browse",
      "create_cart_url calls with source_context browserbase_browse",
      "qualified /r/cart landings and MCP-attributed orders",
    ],
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

export function browserbaseBrowseSkillPackMarkdown(runtime: BrowserbaseBrowseSkillPackRuntime): string {
  const payload = browserbaseBrowseSkillPackPayload(runtime);
  return [
    "# Packrift Browserbase Browse Skill Pack",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical MCP endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Candidate Skill",
    "",
    `Name: ${payload.browse_skill_candidate.name}`,
    `Status: ${payload.browse_skill_candidate.status}`,
    `Start URL: ${payload.browse_skill_candidate.start_url}`,
    `Root SKILL.md: ${payload.browse_skill_candidate.skill_md_url}`,
    `Canonical SKILL.md: ${payload.browse_skill_candidate.canonical_skill_md_url}`,
    "",
    payload.browse_skill_candidate.duplicate_surface_guard,
    "",
    "## SKILL.md",
    "",
    `Root URL: ${payload.skill_md.root_url}`,
    `Canonical URL: ${payload.skill_md.canonical_url}`,
    "",
    payload.skill_md.submission_note,
    "",
    "## Browser-Agent Rules",
    "",
    payload.browser_agent_rules.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Demo Sequence",
    "",
    "| Step | Method | URL | Expected |",
    "| ---: | --- | --- | --- |",
    ...payload.demo_sequence.map((step) => `| ${step.step} | ${step.method} | ${step.url} | ${escapeMarkdown(step.expected)} |`),
    "",
    "## JSON-RPC Calls",
    "",
    fencedJson(payload.demo_sequence.filter((step) => "request" in step).map((step) => step.request)),
    "",
    "## Buyer Prompts",
    "",
    payload.buyer_prompts.map((prompt) => `- ${prompt}`).join("\n"),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
    "",
  ].join("\n");
}

export function browserbaseBrowseSkillMd(runtime: BrowserbaseBrowseSkillPackRuntime): string {
  const payload = browserbaseBrowseSkillPackPayload(runtime);
  return [
    "---",
    "name: packrift-mcp",
    "description: Exact-spec packaging procurement through Packrift MCP. Use when a buyer or agent needs packaging by SKU, dimensions, material, color, grade, closure, adhesive, printer type, pack count, case count, live price, inventory, no-match recovery, or measured cart handoff.",
    "compatibility: Browserbase Browse-style agents, browser-use, Playwright, CUA, Claude, Codex, Cursor, Windsurf, VS Code MCP clients, and any agent that can call a remote Streamable HTTP MCP endpoint.",
    "canonical_endpoint: https://mcp.packrift.com/mcp",
    "no_buyer_api_key_required: true",
    "---",
    "",
    "# Packrift MCP",
    "",
    "Use this skill to find exact Packrift packaging products and route live commercial checks through the hosted Packrift MCP endpoint.",
    "",
    "Do not build or invoke a separate Packrift CLI, checkout, scraper, or buyer surface. This skill is a thin open-web instruction file around `https://mcp.packrift.com/mcp`.",
    "",
    "## When To Use",
    "",
    "- A buyer has a Packrift SKU and wants reorder, live price, inventory, or cart handoff.",
    "- A buyer gives exact packaging dimensions, material, grade, color, closure, adhesive, printer type, pack count, or case count.",
    "- A browser agent can read public pages but needs MCP for live price, inventory, shipping, product detail, no-match, or cart handoff.",
    "- A directory reviewer or agent host needs one direct instruction file for testing Packrift MCP.",
    "",
    "## Canonical Endpoint",
    "",
    "- MCP endpoint: `https://mcp.packrift.com/mcp`",
    "- Start page: `https://mcp.packrift.com/start`",
    "- Browser-agent bridge: `https://mcp.packrift.com/ai/browser-agent-bridge.json`",
    "- Workflow gallery: `https://mcp.packrift.com/ai/mcp-workflow-gallery.json`",
    "- First-run proof: `https://mcp.packrift.com/ai/mcp-first-run-proof.json`",
    "- Install matrix: `https://mcp.packrift.com/ai/mcp-install-matrix.json`",
    "- Skill pack JSON: `https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json`",
    "",
    "## Install",
    "",
    "Use remote MCP config when the host supports MCP JSON:",
    "",
    "```json",
    JSON.stringify({ mcpServers: { packrift: { type: "http", url: MCP_ENDPOINT } } }, null, 2),
    "```",
    "",
    "Claude Code:",
    "",
    "```sh",
    "claude mcp add --transport http packrift https://mcp.packrift.com/mcp",
    "```",
    "",
    "Codex:",
    "",
    "```sh",
    "codex mcp add packrift --url https://mcp.packrift.com/mcp",
    "```",
    "",
    "## First Useful Flow",
    "",
    "For a known SKU, use the compact guarded handoff path first:",
    "",
    "```json",
    JSON.stringify(
      toolCall("prepare-1066", "prepare_purchase_handoff", {
        sku: "1066",
        quantity: 1,
        buyer_confirmed: false,
        source_context: "browserbase_browse",
      }),
      null,
      2
    ),
    "```",
    "",
    "Expected result: live product, price, and inventory are confirmed, but `cart` is `null` until the buyer explicitly confirms exact SKU and quantity.",
    "",
    "After the buyer confirms, call the same tool with `buyer_confirmed: true` or call `create_cart_url` with validated SKU continuity. Return the MCP `/r/cart/...` URL as the primary handoff.",
    "",
    "## Browser-Agent Rules",
    "",
    ...payload.browser_agent_rules.map((rule) => `- ${rule}`),
    "",
    "## Exact-Match Rule",
    "",
    "Only use exact matches for purchase handoff. If size, material, color, strength, closure, adhesive, printer type, pack count, case count, or SKU differs, do not present the product as an exact substitute. Use `explain_no_exact_match` or `get_bulk_quote_link` instead.",
    "",
    "## Good Test Prompts",
    "",
    ...payload.buyer_prompts.map((prompt) => `- ${prompt}`),
    "",
    "## Proof And Monitoring",
    "",
    `- Release: ${payload.release}`,
    `- Runtime: ${payload.runtime.tools_count} tools, ${payload.runtime.resources_count} resources, ${payload.runtime.prompts_count} prompts`,
    "- Health: `https://mcp.packrift.com/health`",
    "- Usage snapshot: `https://mcp.packrift.com/ai/mcp-usage-snapshot.json`",
    "- All-agent capture matrix: `https://mcp.packrift.com/ai/all-agent-capture.json`",
    "",
  ].join("\n");
}
