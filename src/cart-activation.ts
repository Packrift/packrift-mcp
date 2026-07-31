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
    release: "PACKRIFT-MCP-CART-ACTIVATION-R02",
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
    native_ucp_cart_context_rule: {
      rule:
        "When an agent bypasses the measured MCP /r/cart handoff and calls Shopify native UCP create_cart, include the buyer's real market context. At minimum pass context.address_country=US and context.currency=USD; include address_region and postal_code when known.",
      failure_mode:
        "A context-free Packrift UCP cart can return merchandise_out_of_stock for variants that Global Catalog and Shopify Admin both report available.",
      verified_recovery:
        "Retrying with US country, region, postal code, currency USD, and language en-US produced a clean four-line cart and checkout handoff with preserved ChatGPT/feed attribution.",
      attribution_rule:
        "Pass referring_domain and UTM fields in create_cart attribution so the source survives into checkout.",
    },
    required_live_confirmation: [
      "exact SKU or exact dimensions selected by buyer",
      "prepare_purchase_handoff may collapse product, price, and inventory checks for known exact SKUs",
      "get_product confirms product identity and variant",
      "get_pricing confirms live unit price",
      "check_inventory confirms availability",
      "buyer-selected quantity is known",
      "create_cart_url returns the MCP cart landing URL",
    ],
    activation_paths: [
      {
        id: "one_call_exact_sku_prepare_then_cart",
        buyer_prompt:
          "Prepare Packrift SKU 1066 for purchase. Confirm live product, price, and inventory first, then create the cart only after I confirm quantity 1.",
        expected_agent_behavior:
          "Call prepare_purchase_handoff with buyer_confirmed=false first; after buyer confirmation, call it again with buyer_confirmed=true, preserve mcp_source_context/mcp_install_target, and return the MCP /r/cart URL.",
        json_rpc_sequence: [
          toolCall("prepare-1066-unconfirmed", "prepare_purchase_handoff", {
            sku: "1066",
            quantity: 1,
            buyer_confirmed: false,
            source_context: "mcp_cart_activation",
            mcp_source_context: "mcp_cart_activation",
            mcp_install_target: "generic_streamable_http",
          }),
          toolCall("prepare-1066-confirmed", "prepare_purchase_handoff", {
            sku: "1066",
            quantity: 1,
            buyer_confirmed: true,
            source_context: "mcp_cart_activation",
            mcp_source_context: "mcp_cart_activation",
            mcp_install_target: "generic_streamable_http",
          }),
        ],
      },
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
      funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      endpoint_health: "https://mcp.packrift.com/health",
    },
    success_signals: [
      "tools/list and prompts/list are visible from external agents",
      "prepare_purchase_handoff is called for known exact SKUs",
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
    :root{color-scheme:light;--ink:#17211d;--muted:#596a63;--line:#d7ded8;--paper:#f7f8f5;--panel:#fff;--green:#0f6b4f;--blue:#245f9b;--red:#9f2d20}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1120px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4.2rem);line-height:.98;letter-spacing:0}
    h2{margin:28px 0 10px;font-size:1.2rem;letter-spacing:0}
    h3{margin:0 0 6px;font-size:1rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:860px}
    a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px}
    .status,.links,.signals{display:flex;flex-wrap:wrap;gap:8px}
    .status span,.signals span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .rule,.do-not,.checks,.path,.sku{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:15px}
    .do-not{border-left:5px solid var(--red)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin-top:14px}
    ul{margin:8px 0 0;padding-left:20px;color:var(--muted)}
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

export function mcpCartActivationHtml(runtime: CartActivationRuntime): string {
  const payload = mcpCartActivationPayload(runtime);
  const pathCards = payload.activation_paths
    .map(
      (path) => `<article class="path">
        <h3>${escapeHtml(path.id)}</h3>
        <p>${escapeHtml(path.buyer_prompt)}</p>
        <p><strong>Expected behavior:</strong> ${escapeHtml(path.expected_agent_behavior)}</p>
        ${"cart_rule" in path && typeof path.cart_rule === "string" ? `<p><strong>Cart rule:</strong> ${escapeHtml(path.cart_rule)}</p>` : ""}
        <pre>${escapeHtml(JSON.stringify(path.json_rpc_sequence, null, 2))}</pre>
      </article>`
    )
    .join("");
  const skuCards = payload.starter_skus
    .map(
      (sku) => `<article class="sku">
        <h3>${escapeHtml(sku.sku)}</h3>
        <p>${escapeHtml(sku.title)}</p>
        <p>${escapeHtml(sku.buyer_intent)}</p>
        <p><code>${escapeHtml(sku.variant_id)}</code></p>
      </article>`
    )
    .join("");
  const links = ([
    ["Start MCP", "https://mcp.packrift.com/start"],
    ["Endpoint", payload.canonical_endpoint],
    ["Buyer use cases", "https://mcp.packrift.com/ai/mcp-buyer-use-cases.html"],
    ["Workflow gallery", "https://mcp.packrift.com/ai/mcp-workflow-gallery.html"],
    ["Adoption progress", "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.html"],
    ["Cart handoff candidates", payload.proof_urls.cart_handoff_candidates],
  ] satisfies Array<[string, string]>)
    .map(([label, url], index) => `<a class="button${index === 0 ? " primary" : ""}" href="${escapeHtml(url)}">${escapeHtml(label)}</a>`)
    .join("");
  return htmlShell(
    "Packrift MCP Cart Activation",
    payload.purpose,
    `<header>
      <h1>Packrift MCP Cart Activation</h1>
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
      <h2>Primary Rule</h2>
      <div class="rule"><p>${escapeHtml(payload.primary_rule)}</p></div>
    </section>
    <section>
      <h2>Do Not</h2>
      <div class="do-not"><p>${escapeHtml(payload.do_not)}</p></div>
    </section>
    <section>
      <h2>Required Live Confirmation</h2>
      <div class="checks"><ul>${payload.required_live_confirmation.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul></div>
    </section>
    <section>
      <h2>Activation Paths</h2>
      <div class="grid">${pathCards}</div>
    </section>
    <section>
      <h2>Starter SKUs</h2>
      <div class="grid">${skuCards}</div>
    </section>
    <section>
      <h2>Success Signals</h2>
      <div class="signals">${payload.success_signals.map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}</div>
    </section>`
  );
}
