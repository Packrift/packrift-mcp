export interface McpStartRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const START_HTML_URL = "https://mcp.packrift.com/start";
const START_JSON_URL = "https://mcp.packrift.com/ai/mcp-start.json";
const START_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-start.md";
const START_HTML_RESOURCE_URL = "https://mcp.packrift.com/ai/mcp-start.html";
const TRACKED_START_TEMPLATE = "https://mcp.packrift.com/r/start/{source}";

function remoteMcpJson() {
  return {
    mcpServers: {
      packrift: {
        type: "http",
        url: MCP_ENDPOINT,
      },
    },
  };
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

function trackedStartUrl(source: string): string {
  const url = new URL(`https://mcp.packrift.com/r/start/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "directory_recrawl");
  url.searchParams.set("utm_campaign", "packrift_mcp_start");
  url.searchParams.set("utm_content", "mcp_start_pack");
  return url.toString();
}

const FIRST_FLOW = [
  {
    step: 1,
    name: "Connect the hosted endpoint",
    outcome: "The agent sees Packrift as a remote Streamable HTTP MCP server.",
    request: null,
  },
  {
    step: 2,
    name: "List tools",
    outcome: "The agent confirms the current 14-tool commerce surface.",
    request: { jsonrpc: "2.0", id: "tools", method: "tools/list" },
  },
  {
    step: 3,
    name: "Fetch one purchase-ready cart candidate",
    outcome: "The agent receives SKU 1066 plus the required live-confirmation sequence.",
    request: toolCall("candidate-1066", "get_cart_handoff_candidates", { sku: "1066", limit: 1 }),
  },
  {
    step: 4,
    name: "Confirm live price",
    outcome: "The agent verifies the current price before showing a buyer-facing recommendation.",
    request: toolCall("price-1066", "get_pricing", {
      variant_ids: ["53472879935856"],
      quantity: 1,
    }),
  },
  {
    step: 5,
    name: "Confirm live inventory",
    outcome: "The agent verifies the exact SKU is available before cart handoff.",
    request: toolCall("inventory-1066", "check_inventory", {
      variant_ids: ["53472879935856"],
    }),
  },
  {
    step: 6,
    name: "Create the measured cart handoff",
    outcome: "The agent returns a Packrift MCP /r/cart landing URL before the final Shopify cart URL.",
    request: toolCall("cart-1066", "create_cart_url", {
      sku: "1066",
      quantity: 1,
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      match_type: "mcp_start_demo",
      source_context: "exact_spec_ai_agent",
      journey_id: "mcp_start_1066_53472879935856",
      result_set_id: "mcp_start",
      utm_term: "1066",
    }),
  },
] as const;

const BUYER_PROMPTS = [
  "Reorder Packrift SKU 1066. Confirm product, live price, inventory, then prepare a cart handoff for quantity 1.",
  "Find packaging for a 9 x 4 x 3 inch item weighing 2 lb for ecommerce shipping; compare options and check live price and inventory.",
  "A buyer asked for 10 x 6 x 8 ECT-32 kraft boxes. If there is no exact AI-approved match, explain no exact match and route to bulk quote recovery.",
  "Create a procurement line item for Packrift SKU LL251WR with exact SKU, product URL, live price check, inventory, and reorder path.",
] as const;

export function mcpStartPayload(runtime: McpStartRuntime) {
  return {
    release: "PACKRIFT-MCP-START-R02",
    generated_at: new Date().toISOString(),
    purpose:
      "One public start surface for agents, developers, directories, and AI-commerce workflows to install Packrift MCP, run the first useful exact-SKU flow, and continue into measured cart handoff without creating a duplicate CLI or buyer surface.",
    canonical_endpoint: MCP_ENDPOINT,
    start_urls: {
      html: START_HTML_URL,
      json: START_JSON_URL,
      markdown: START_MARKDOWN_URL,
      html_resource: START_HTML_RESOURCE_URL,
      tracked_start_template: TRACKED_START_TEMPLATE,
      tracked_examples: {
        official_registry: trackedStartUrl("official_registry"),
        mcpservers_org: trackedStartUrl("mcpservers_org"),
        glama_connector: trackedStartUrl("glama_connector"),
        glama_server_listing: trackedStartUrl("glama_server_listing"),
        mcp_directory: trackedStartUrl("mcp_directory"),
        pulsemcp_packrift: trackedStartUrl("pulsemcp_packrift"),
        mcpbench: trackedStartUrl("mcpbench"),
        chiark: trackedStartUrl("chiark"),
        mcp_marketplace_io: trackedStartUrl("mcp_marketplace_io"),
        docker_mcp_catalog: trackedStartUrl("docker_mcp_catalog"),
        generic: trackedStartUrl("generic"),
      },
    },
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    install: {
      remote_mcp_json: remoteMcpJson(),
      claude_code: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
      codex: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
      endpoint_only: MCP_ENDPOINT,
    },
    first_flow: FIRST_FLOW,
    buyer_prompts: BUYER_PROMPTS,
    proof_urls: {
      health: "https://mcp.packrift.com/health",
      manifest: "https://mcp.packrift.com/manifest",
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
    },
    success_gate:
      "This start surface is useful only if it drives external installs, tools/list calls, get_cart_handoff_candidates calls, measured /r/cart landings, and MCP-attributed orders. It is not proof that the adoption goal is complete.",
    operating_rules: [
      "Use https://mcp.packrift.com/mcp as the canonical endpoint.",
      "Use /r/start/{source} tracked start links for directories and partner handoffs so start traffic can be attributed by source.",
      "Do not create or promote a separate Packrift CLI or duplicate buyer surface.",
      "Confirm exact SKU, live price, and live inventory before cart handoff.",
      "Use create_cart_url only after buyer confirmation so the returned /r/cart URL keeps MCP attribution measurable.",
      "Route no-exact-match requests to explain_no_exact_match and get_bulk_quote_link instead of forcing near matches.",
    ],
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function mcpStartMarkdown(runtime: McpStartRuntime): string {
  const payload = mcpStartPayload(runtime);
  return [
    "# Packrift MCP Start",
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
    fencedJson(payload.install.remote_mcp_json),
    "",
    `Claude Code: \`${payload.install.claude_code}\``,
    "",
    `Codex: \`${payload.install.codex}\``,
    "",
    "## Tracked Start Links",
    "",
    `Template: \`${payload.start_urls.tracked_start_template}\``,
    "",
    Object.entries(payload.start_urls.tracked_examples)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## First Useful Flow",
    "",
    payload.first_flow
      .map((step) =>
        [
          `### ${step.step}. ${step.name}`,
          "",
          step.outcome,
          "",
          step.request ? fencedJson(step.request) : `Endpoint: \`${payload.canonical_endpoint}\``,
        ].join("\n")
      )
      .join("\n\n"),
    "",
    "## Buyer Prompts",
    "",
    payload.buyer_prompts.map((prompt) => `- ${escapeMarkdown(prompt)}`).join("\n"),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Operating Rules",
    "",
    payload.operating_rules.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Success Gate",
    "",
    payload.success_gate,
    "",
    `Machine-readable version: ${START_JSON_URL}`,
    "",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function codeBlock(value: unknown): string {
  return escapeHtml(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

export function mcpStartHtml(runtime: McpStartRuntime): string {
  const payload = mcpStartPayload(runtime);
  const flow = payload.first_flow
    .map(
      (step) => `<li>
        <div>
          <strong>${step.step}. ${escapeHtml(step.name)}</strong>
          <p>${escapeHtml(step.outcome)}</p>
          <pre>${step.request ? codeBlock(step.request) : escapeHtml(payload.canonical_endpoint)}</pre>
        </div>
      </li>`
    )
    .join("");
  const prompts = payload.buyer_prompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join("");
  const trackedStarts = Object.entries(payload.start_urls.tracked_examples)
    .map(([key, value]) => `<a href="${escapeHtml(value)}">${escapeHtml(key.replace(/_/g, " "))}</a>`)
    .join("");
  const proofLinks = Object.entries(payload.proof_urls)
    .map(([key, value]) => `<a href="${escapeHtml(value)}">${escapeHtml(key.replace(/_/g, " "))}</a>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift MCP Start</title>
  <meta name="description" content="Install Packrift MCP, run the first exact-spec packaging flow, and create measured cart handoff URLs through the hosted MCP endpoint.">
  <style>
    :root {
      color-scheme: light;
      --ink: #17211d;
      --muted: #5f6f68;
      --line: #d7ded8;
      --paper: #f7f8f5;
      --panel: #ffffff;
      --green: #0f6b4f;
      --blue: #245f9b;
      --amber: #96610f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--paper);
      line-height: 1.5;
    }
    main { max-width: 1120px; margin: 0 auto; padding: 36px 20px 56px; }
    header { display: grid; gap: 18px; padding: 24px 0 20px; border-bottom: 1px solid var(--line); }
    h1 { margin: 0; font-size: clamp(2rem, 5vw, 4.4rem); line-height: .95; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 1.2rem; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); max-width: 760px; }
    a { color: var(--blue); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .status { display: flex; flex-wrap: wrap; gap: 8px; }
    .pill {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: .9rem;
      color: var(--muted);
    }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
    .button {
      display: inline-flex;
      align-items: center;
      min-height: 42px;
      border: 1px solid var(--ink);
      border-radius: 6px;
      padding: 9px 13px;
      color: var(--ink);
      background: var(--panel);
      text-decoration: none;
      font-weight: 650;
    }
    .button.primary { color: white; background: var(--green); border-color: var(--green); }
    section { padding: 28px 0; border-bottom: 1px solid var(--line); }
    .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    pre {
      overflow: auto;
      margin: 12px 0 0;
      padding: 12px;
      border: 1px solid #cdd6cf;
      border-radius: 6px;
      background: #101714;
      color: #e9f2ed;
      font-size: .86rem;
      line-height: 1.45;
    }
    ol, ul { margin: 0; padding-left: 20px; }
    li { margin: 10px 0; }
    li p { margin-top: 2px; }
    .proof { display: flex; flex-wrap: wrap; gap: 10px 14px; }
    .warning { color: var(--amber); font-weight: 650; }
    footer { padding-top: 24px; color: var(--muted); font-size: .92rem; }
    @media (max-width: 640px) {
      main { padding: 24px 14px 42px; }
      .button { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="status">
        <span class="pill">Packrift MCP ${escapeHtml(payload.runtime.server_version)}</span>
        <span class="pill">${payload.runtime.tools_count} tools</span>
        <span class="pill">${payload.runtime.resources_count} resources</span>
        <span class="pill">No buyer API key</span>
      </div>
      <h1>Packrift MCP Start</h1>
      <p>Install the hosted Packrift MCP endpoint, run one exact-spec packaging flow, confirm live price and inventory, and hand off a measured cart URL.</p>
      <div class="actions">
        <a class="button primary" href="${escapeHtml(payload.canonical_endpoint)}">MCP endpoint</a>
        <a class="button" href="${escapeHtml(START_JSON_URL)}">JSON start pack</a>
        <a class="button" href="${escapeHtml(payload.proof_urls.workflow_gallery)}">Workflow gallery</a>
      </div>
    </header>
    <section>
      <h2>Install</h2>
      <div class="grid">
        <div class="panel">
          <strong>Remote MCP config</strong>
          <pre>${codeBlock(payload.install.remote_mcp_json)}</pre>
        </div>
        <div class="panel">
          <strong>Claude Code</strong>
          <pre>${codeBlock(payload.install.claude_code)}</pre>
        </div>
        <div class="panel">
          <strong>Codex</strong>
          <pre>${codeBlock(payload.install.codex)}</pre>
        </div>
      </div>
    </section>
    <section>
      <h2>Tracked Start Links</h2>
      <p>Use source-specific start links in directories and partner handoffs so MCP start traffic is measurable by source.</p>
      <div class="proof">${trackedStarts}</div>
    </section>
    <section>
      <h2>First Useful Flow</h2>
      <ol>${flow}</ol>
    </section>
    <section>
      <h2>Buyer Prompts</h2>
      <ul>${prompts}</ul>
    </section>
    <section>
      <h2>Proof Links</h2>
      <div class="proof">${proofLinks}</div>
    </section>
    <footer>
      <div class="warning">Do not build a duplicate Packrift CLI or buyer surface.</div>
      <div>${escapeHtml(payload.success_gate)}</div>
    </footer>
  </main>
</body>
</html>
`;
}
