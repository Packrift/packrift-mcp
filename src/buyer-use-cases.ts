export interface BuyerUseCasesRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

const BUYER_USE_CASES = [
  {
    id: "exact_sku_reorder",
    title: "Reorder an exact Packrift SKU",
    buyer_intent: "I know the SKU and need the current product, price, inventory, and cart handoff.",
    starter_prompt:
      "Reorder Packrift SKU 1066. Confirm the exact product, live price, inventory, and prepare a cart handoff for quantity 1.",
    best_tools: ["get_cart_handoff_candidates", "get_product", "get_pricing", "check_inventory", "create_cart_url"],
    priority_skus: ["1066", "MFL1295", "LL251WR"],
    success_path:
      "Resolve the exact SKU, confirm live commercial facts, then return the MCP-stamped cart landing URL only after the buyer selects quantity.",
    measurement:
      "Final cart handoff should carry utm_source=chatgpt-mcp, utm_medium=mcp_tool, and utm_campaign=create_cart_url.",
  },
  {
    id: "fit_item_to_package",
    title: "Find packaging for an item by dimensions",
    buyer_intent: "I have an item size and need the smallest safe box, mailer, or container that fits.",
    starter_prompt:
      "Find packaging for a 9 x 4 x 3 inch item that weighs 2 lb and needs ecommerce shipping protection.",
    best_tools: ["find_packaging_for_item", "pack_calculator", "compare_alternatives", "get_pricing", "check_inventory"],
    priority_skus: ["1066", "1074", "MFL1295"],
    success_path:
      "Use item dimensions first, compare safe fits, then confirm the chosen exact SKU before showing reorder, quote, or cart options.",
    measurement:
      "When a fit becomes a selected SKU, continue through live checks and create_cart_url so the path is visible in MCP cart telemetry.",
  },
  {
    id: "mailer_selection",
    title: "Choose mailers for ecommerce fulfillment",
    buyer_intent: "I need the right mailer size and closure for apparel, books, documents, or small goods.",
    starter_prompt:
      "Find a white literature mailer close to 12 x 9 x 5 for ecommerce fulfillment and confirm the exact Packrift match.",
    best_tools: ["search_products", "compare_alternatives", "get_product", "get_pricing", "check_inventory"],
    priority_skus: ["MFL1295"],
    success_path:
      "Separate literature mailers, bubble mailers, and poly mailers by exact dimensions, closure, color, and pack count before purchase handoff.",
    measurement:
      "Use measured product, reorder, quote, and cart handoff URLs from the MCP response or measured handoff directory.",
  },
  {
    id: "label_procurement",
    title: "Match labels by size, material, and printer type",
    buyer_intent: "I need exact labels for a printer, material, weather resistance, and case quantity.",
    starter_prompt:
      "Find Packrift weather-resistant polyester laser labels around 2 5/8 x 1 and confirm live price and inventory.",
    best_tools: ["search_products", "get_product", "get_pricing", "check_inventory", "get_reorder_link"],
    priority_skus: ["LL251WR"],
    success_path:
      "Treat printer type, adhesive, weather resistance, label size, and case count as exact-match fields, not loose synonyms.",
    measurement:
      "If the buyer proceeds to purchase, create a stamped cart URL after price and inventory confirmation.",
  },
  {
    id: "bulk_quote_recovery",
    title: "Recover demand when no exact match exists",
    buyer_intent: "I need a size or spec Packrift may not stock exactly, but I still want procurement help.",
    starter_prompt:
      "The buyer asked for 10 x 6 x 8 ECT-32 kraft boxes. If Packrift has no exact AI-approved match, explain the no-match result and route to quote recovery.",
    best_tools: ["search_products", "explain_no_exact_match", "get_bulk_quote_link"],
    priority_skus: [],
    success_path:
      "Do not substitute nearby dimensions, materials, colors, pack counts, or printer types as exact matches. Route to quote or ask for acceptable substitutes.",
    measurement:
      "Use the quote handoff returned by MCP so no-match recovery stays attributable.",
  },
  {
    id: "procurement_line_item",
    title: "Create a procurement-ready line item",
    buyer_intent: "I need a copyable product line for purchasing, approval, or a reorder workflow.",
    starter_prompt:
      "Create a procurement-ready line item for Packrift SKU 1066 with exact SKU, title, product URL, pack count, live price check, and reorder path.",
    best_tools: ["get_product", "get_pricing", "check_inventory", "get_reorder_link"],
    priority_skus: ["1066", "MFL1295", "LL251WR"],
    success_path:
      "Return exact SKU, title, dimensions or material fields, pack count, product URL, reorder URL, quote URL, and live-check caveats.",
    measurement:
      "Use returned handoff URLs instead of untracked free-text product links when the buyer is ready to move.",
  },
] as const;

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlShell(title: string, description: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <style>
    :root{color-scheme:light;--ink:#17211d;--muted:#596a63;--line:#d7ded8;--paper:#f7f8f5;--panel:#fff;--green:#0f6b4f;--blue:#245f9b}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1120px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4.2rem);line-height:.98;letter-spacing:0}
    h2{margin:28px 0 10px;font-size:1.2rem;letter-spacing:0}
    h3{margin:0 0 6px;font-size:1rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:860px}
    a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px}
    .status,.links,.tools{display:flex;flex-wrap:wrap;gap:8px}
    .status span,.tools span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:14px}
    article,.rules,.sequence{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:15px}
    ul,ol{margin:8px 0 0;padding-left:20px;color:var(--muted)}
    li{margin:5px 0}
    code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#f9faf8;padding:12px;color:var(--ink);font-size:.88rem}
    .button{display:inline-flex;align-items:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    @media (max-width:680px){.button{width:100%;justify-content:center}}
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

export function mcpBuyerUseCasesPayload(runtime: BuyerUseCasesRuntime) {
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
      "AI shopping and procurement agents",
      "warehouse and fulfillment copilots",
      "ecommerce operators choosing packaging",
      "MCP directory reviewers evaluating buyer utility",
      "search and answer-engine crawlers looking for citeable Packrift use cases",
    ],
    qualification_rules: [
      "Use Packrift MCP when the buyer needs packaging by exact SKU, dimensions, material, color, strength rating, closure, adhesive, printer type, pack count, case count, price, inventory, shipping estimate, reorder path, quote path, or cart handoff.",
      "Use exact matches only for purchase handoff.",
      "Confirm live price, inventory, shipping, and cart eligibility before presenting a cart or checkout action.",
      "If any required spec differs, return no exact match and route to quote recovery or ask the buyer to confirm an acceptable substitute.",
      "Keep the final purchase path measurable through MCP returned product, reorder, quote, or create_cart_url handoff URLs.",
    ],
    use_cases: BUYER_USE_CASES,
    proof_urls: {
      mcp_endpoint: MCP_ENDPOINT,
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      cart_activation_html: "https://mcp.packrift.com/ai/mcp-cart-activation.html",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      workflow_gallery_html: "https://mcp.packrift.com/ai/mcp-workflow-gallery.html",
      agent_adoption_progress: "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.json",
      agent_adoption_progress_html: "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.html",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
      conversion_route_catalog: "https://mcp.packrift.com/ai/conversion-route-catalog.json",
      product_corpus: "https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl",
      agent_instructions: "https://mcp.packrift.com/ai/packrift-ai-agent-instructions.md",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
    },
    first_call_sequence: [
      { step: 1, method: "tools/list", why: "Confirm the client sees Packrift commerce tools." },
      { step: 2, method: "prompts/list", why: "Choose the native exact-spec, reorder, cart handoff, or no-match workflow." },
      { step: 3, method: "tools/call", tool: "prepare_purchase_handoff", why: "Use this fastest path when the buyer already has an exact SKU." },
      { step: 4, method: "tools/call", tool: "find_packaging_for_item or search_products", why: "Resolve candidate exact SKUs when the buyer is still exploring." },
      { step: 5, method: "tools/call", tool: "get_pricing and check_inventory", why: "Confirm live commercial facts when using the manual flow." },
      { step: 6, method: "tools/call", tool: "create_cart_url", why: "Create a measured cart handoff only after selection and live confirmation." },
    ],
  };
}

export function mcpBuyerUseCasesHtml(runtime: BuyerUseCasesRuntime): string {
  const payload = mcpBuyerUseCasesPayload(runtime);
  const cases = payload.use_cases
    .map(
      (item) => `<article>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.buyer_intent)}</p>
        <div class="tools">${item.best_tools.map((tool) => `<span>${escapeHtml(tool)}</span>`).join("")}</div>
        <p><strong>Success path:</strong> ${escapeHtml(item.success_path)}</p>
        <p><strong>Measurement:</strong> ${escapeHtml(item.measurement)}</p>
        <pre>${escapeHtml(item.starter_prompt)}</pre>
      </article>`
    )
    .join("");
  const sequence = payload.first_call_sequence
    .map((step) => {
      const tool = "tool" in step && typeof step.tool === "string" ? step.tool : "";
      return `<li>${escapeHtml(step.method)}${tool ? ` / ${escapeHtml(tool)}` : ""}: ${escapeHtml(step.why)}</li>`;
    })
    .join("");
  const links = ([
    ["Start MCP", "https://mcp.packrift.com/start"],
    ["Endpoint", payload.canonical_endpoint],
    ["Cart activation", payload.proof_urls.cart_activation_html],
    ["Workflow gallery", payload.proof_urls.workflow_gallery_html],
    ["Adoption progress", payload.proof_urls.agent_adoption_progress_html],
    ["Run generic check", "https://mcp.packrift.com/r/run/generic/generic_streamable_http?format=html"],
  ] satisfies Array<[string, string]>)
    .map(([label, url], index) => `<a class="button${index === 0 ? " primary" : ""}" href="${escapeHtml(url)}">${escapeHtml(label)}</a>`)
    .join("");
  return htmlShell(
    "Packrift MCP Buyer Use Cases",
    payload.purpose,
    `<header>
      <h1>Packrift MCP Buyer Use Cases</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.runtime.tools_count} tools</span>
        <span>${payload.runtime.resources_count} resources</span>
        <span>${payload.runtime.prompts_count} prompts</span>
      </div>
      <div class="links">${links}</div>
    </header>
    <section>
      <h2>Qualification Rules</h2>
      <div class="rules"><ul>${payload.qualification_rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul></div>
    </section>
    <section>
      <h2>Use Cases</h2>
      <div class="grid">${cases}</div>
    </section>
    <section>
      <h2>First Call Sequence</h2>
      <div class="sequence"><ol>${sequence}</ol></div>
    </section>`
  );
}

export function mcpBuyerUseCasesMarkdown(runtime: BuyerUseCasesRuntime): string {
  const payload = mcpBuyerUseCasesPayload(runtime);
  const useCaseRows = payload.use_cases
    .map(
      (item) =>
        `| ${escapeMarkdown(item.title)} | ${escapeMarkdown(item.buyer_intent)} | ${item.best_tools.map((tool) => `\`${tool}\``).join(", ")} | ${escapeMarkdown(item.success_path)} |`
    )
    .join("\n");
  const promptRows = payload.use_cases
    .map((item) => `| ${escapeMarkdown(item.title)} | ${escapeMarkdown(item.starter_prompt)} |`)
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
    fencedJson(payload.first_call_sequence),
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
