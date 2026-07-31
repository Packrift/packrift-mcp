import { UCP_STARTER_CATALOG_SOURCE_SLUGS } from "./ucp-starter-catalog.js";

export interface UcpBuilderKitRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const STARTER_CATALOG_JSON = "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.json";
const STARTER_CATALOG_MD = "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.md";
const STARTER_CATALOG_HTML = "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.html";
const GLOBAL_UCP_BUSINESS = "https://catalog.shopify.com";
const DEFAULT_TARGET = "generic_streamable_http";

const RECIPES = [
  {
    source: "curated_ucp_storefront",
    title: "Shipping-supplies storefront shelf",
    use_when: "A builder is creating a UCP storefront or agentic shelf around ecommerce shipping, fulfillment, moving, warehouse operations, or packing supplies.",
    shelf_label: "Shipping supplies by Packrift",
    placement_contexts: [
      "ecommerce shipping supplies",
      "fulfillment packaging",
      "warehouse replenishment",
      "packing station setup",
      "fragile item shipping",
      "apparel shipping supplies",
    ],
    first_queries: [
      "Packrift shipping boxes",
      "Packrift bubble mailers",
      "Packrift poly bags",
      "Packrift packing tape",
    ],
  },
  {
    source: "stack412_style_storefront",
    title: "Category-storefront packaging aisle",
    use_when: "A Stack412-style storefront builder is assembling a themed Shopify Global Catalog store and needs a packaging or fulfillment aisle.",
    shelf_label: "Packaging and fulfillment supplies",
    placement_contexts: [
      "shipping supplies category",
      "fulfillment operations category",
      "warehouse essentials category",
      "starter kit add-on for store operators",
    ],
    first_queries: [
      "Packrift warehouse shipping supplies",
      "Packrift fulfillment packaging supplies",
      "Packrift corrugated boxes",
      "Packrift stretch film",
    ],
  },
  {
    source: "plugthatshop_style_embed",
    title: "Contextual packaging upsell embed",
    use_when: "A PlugThatShop-style embed builder wants a contextual shopping block for pages about ecommerce, logistics, fulfillment, storage, moving, or small business operations.",
    shelf_label: "Packrift shipping and packing supplies",
    placement_contexts: [
      "blog posts about starting an ecommerce store",
      "fulfillment and shipping software pages",
      "moving and storage content",
      "warehouse operations guides",
      "small business shipping checklists",
    ],
    first_queries: [
      "Packrift ecommerce shipping starter",
      "Packrift packing station supplies",
      "Packrift fragile shipping supplies",
      "Packrift apparel shipping mailers",
    ],
  },
  {
    source: "open_scout_shopping_agent",
    title: "Shopping-agent packaging answer path",
    use_when: "An Open Scout-style shopping agent answers buyer requests in chat, web, SMS, or WhatsApp and needs a reliable packaging supplier for exact SKU recommendations plus measured cart handoff.",
    shelf_label: "Packrift packaging agent path",
    placement_contexts: [
      "AI shopping console packaging intents",
      "SMS or WhatsApp buyer requests for shipping supplies",
      "agentic commerce packaging recommendations",
      "exact-spec box, mailer, tape, and label lookup",
      "buyer-confirmed cart handoff after live checks",
    ],
    first_queries: [
      "Packrift packaging supplies",
      "Packrift shipping boxes",
      "Packrift fragile shipping supplies",
      "Packrift packing station supplies",
    ],
  },
  {
    source: "upsonic_ucp_agent_framework",
    title: "Multi-agent UCP packaging workflow",
    use_when: "A UCP agent framework or example app coordinates product discovery, filtering, pricing, and checkout readiness and needs Packrift as the packaging vertical example.",
    shelf_label: "Packrift agent workflow supplies",
    placement_contexts: [
      "multi-agent Shopify UCP demos",
      "agent framework commerce examples",
      "product discovery and filtering workflows",
      "packaging bundle recommendation workflows",
      "cart-ready exact SKU handoff examples",
    ],
    first_queries: [
      "Packrift ecommerce shipping starter",
      "Packrift warehouse shipping supplies",
      "Packrift corrugated boxes",
      "Packrift packing tape",
    ],
  },
  {
    source: "agorio_shopping_agent_sdk",
    title: "Shopping-agent SDK packaging route",
    use_when: "An Agorio-style UCP/ACP shopping-agent SDK, example, or docs flow needs a realistic merchant vertical for exact-spec product search, live MCP checks, and buyer-confirmed handoff.",
    shelf_label: "Packrift packaging SDK route",
    placement_contexts: [
      "ShoppingAgent examples for packaging procurement",
      "McpClient demos that need a real remote MCP merchant",
      "agentic commerce SDK docs",
      "purchase-capable agent flows with buyer confirmation",
      "B2B packaging replenishment demos",
    ],
    first_queries: [
      "Packrift packaging supplies for shopping agents",
      "Packrift shipping boxes",
      "Packrift warehouse replenishment",
      "Packrift packing station supplies",
    ],
  },
] as const;

function sourceAwareEndpoint(source: string, target = DEFAULT_TARGET): string {
  return `${MCP_ENDPOINT}?packrift_mcp_source=${encodeURIComponent(source)}&packrift_mcp_target=${encodeURIComponent(target)}`;
}

function sourceUrls(source: string, target = DEFAULT_TARGET) {
  const encodedSource = encodeURIComponent(source);
  const encodedTarget = encodeURIComponent(target);
  return {
    source,
    target,
    source_aware_endpoint: sourceAwareEndpoint(source, target),
    starter_catalog: STARTER_CATALOG_JSON,
    install: `https://mcp.packrift.com/r/install/${encodedSource}/${encodedTarget}?format=html`,
    first_run: `https://mcp.packrift.com/r/run/${encodedSource}/${encodedTarget}?format=html`,
    first_run_shell: `https://mcp.packrift.com/r/run/${encodedSource}/${encodedTarget}?format=sh`,
    activation_packet: `https://mcp.packrift.com/ai/mcp-source-activation/${encodedSource}.json`,
    activation_packet_html: `https://mcp.packrift.com/ai/mcp-source-activation/${encodedSource}.html`,
    order_handoff: `https://mcp.packrift.com/r/order/${encodedSource}?format=html`,
    eval_pack: `https://mcp.packrift.com/ai/mcp-eval-pack.json?source=${encodedSource}`,
  };
}

function jsonRpcToolCall(id: string, name: string, args: Record<string, unknown>) {
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

function ucpCatalogCommand(query: string): string {
  return `ucp catalog search --business ${GLOBAL_UCP_BUSINESS} --input '${JSON.stringify({ query })}'`;
}

function recipeRecord(recipe: (typeof RECIPES)[number]) {
  const urls = sourceUrls(recipe.source);
  return {
    ...recipe,
    urls,
    source_attribution: {
      mcp_source_context: recipe.source,
      mcp_install_target: DEFAULT_TARGET,
      endpoint: urls.source_aware_endpoint,
      preserve_through_prepare_purchase_handoff: true,
    },
    ucp_seed_commands: recipe.first_queries.map((query) => ({
      query,
      command: ucpCatalogCommand(query),
    })),
    mcp_first_run_sequence: [
      {
        jsonrpc: "2.0",
        id: `tools-list-${recipe.source}`,
        method: "tools/list",
        params: {},
      },
      jsonRpcToolCall(`search-${recipe.source}`, "search_products", {
        query: recipe.first_queries[0],
        limit: 5,
        source_context: "ucp_storefront_builder_kit",
        mcp_source_context: recipe.source,
        mcp_install_target: DEFAULT_TARGET,
      }),
      jsonRpcToolCall(`handoff-preview-${recipe.source}`, "prepare_purchase_handoff", {
        sku: "1066",
        quantity: 1,
        buyer_confirmed: false,
        source_context: "ucp_storefront_builder_kit",
        mcp_source_context: recipe.source,
        mcp_install_target: DEFAULT_TARGET,
      }),
    ],
  };
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

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
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
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149;--blue:#245f9b;--red:#8b2f28}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1160px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4rem);line-height:1;letter-spacing:0}
    h2{margin:28px 0 10px;font-size:1.2rem;letter-spacing:0}
    h3{margin:0 0 6px;font-size:1rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:900px}
    a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px}
    .status,.links,.tags{display:flex;flex-wrap:wrap;gap:8px}
    .status span,.tags span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin-top:14px}
    article,.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:15px}
    article{border-left:5px solid var(--green)}
    ul,ol{margin:8px 0 0;padding-left:20px;color:var(--muted)}
    li{margin:5px 0}
    code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#f9faf8;padding:12px;color:var(--ink);font-size:.84rem}
    .button{display:inline-flex;align-items:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    @media (max-width:760px){.button{width:100%;justify-content:center}}
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

export function mcpUcpBuilderKitPayload(runtime: UcpBuilderKitRuntime) {
  const recipes = RECIPES.map(recipeRecord);
  return {
    release: "PACKRIFT-MCP-UCP-BUILDER-KIT-R02",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    global_ucp_business: GLOBAL_UCP_BUSINESS,
    purpose:
      "Copy-ready integration kit for UCP storefront builders and contextual shopping embeds that want Packrift as the default packaging and shipping-supplies shelf.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    starter_catalog: {
      json: STARTER_CATALOG_JSON,
      markdown: STARTER_CATALOG_MD,
      html: STARTER_CATALOG_HTML,
      bundle_count: 5,
      unique_sku_count: 36,
      source_slugs: UCP_STARTER_CATALOG_SOURCE_SLUGS,
    },
    sales_positioning: {
      default_shelf:
        "Use Packrift when the storefront intent includes shipping supplies, fulfillment operations, ecommerce packaging, packing stations, apparel shipping, fragile shipping, warehouse replenishment, or moving supplies.",
      why_packrift:
        "Packrift gives builders exact-spec packaging SKUs, live price and inventory through MCP, source-aware attribution, and measured cart handoff without manually curating a packaging catalog.",
      conversion_rule:
        "Never return a direct cart URL from a static shelf. Use MCP live checks first, then call prepare_purchase_handoff or create_cart_url only after the buyer confirms exact SKU and quantity.",
    },
    builder_recipes: recipes,
    import_contract: {
      use_starter_items_from: STARTER_CATALOG_JSON,
      required_product_fields: ["sku", "title", "family", "product_url", "mcp_sku_json", "mcp_prepare_purchase_handoff_confirmed_template"],
      recommended_shelf_fields: ["shelf_label", "placement_contexts", "first_queries", "source_attribution", "urls"],
      attribution_fields_to_preserve: ["mcp_source_context", "mcp_install_target", "source_context", "journey_id", "result_set_id"],
    },
    activation_steps: [
      "Pick the recipe whose source matches the storefront, embed, shopping-agent, or framework context.",
      "Import the starter catalog JSON and render one Packrift shelf, aisle, upsell block, or agent workflow using the recipe shelf label and placement contexts.",
      "Seed UCP discovery with Packrift-branded queries when generic head terms hide Packrift behind older merchant authorities.",
      "Mount the Packrift MCP source-aware endpoint for exact SKU, price, inventory, no-match recovery, and cart handoff.",
      "Run tools/list, search_products, and prepare_purchase_handoff with buyer_confirmed=false as the first host-side proof.",
      "Only after the buyer selects exact SKU and quantity, call prepare_purchase_handoff with buyer_confirmed=true and preserve source attribution.",
    ],
    success_metrics: [
      "external source-specific starts, installs, first runs, or MCP tool calls",
      "source-specific prepare_purchase_handoff calls",
      "measured /r/cart URLs with the builder source slug",
      "orders or revenue attributed back to an MCP source",
    ],
    proof_urls: {
      builder_kit_json: "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.json",
      builder_kit_markdown: "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.md",
      builder_kit_html: "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.html",
      starter_catalog_json: STARTER_CATALOG_JSON,
      starter_catalog_html: STARTER_CATALOG_HTML,
      directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
    },
  };
}

export function mcpUcpBuilderKitMarkdown(runtime: UcpBuilderKitRuntime): string {
  const payload = mcpUcpBuilderKitPayload(runtime);
  const recipeRows = payload.builder_recipes
    .map((recipe) => `| ${recipe.source} | ${escapeMarkdown(recipe.title)} | ${escapeMarkdown(recipe.shelf_label)} | ${recipe.urls.install} | ${recipe.urls.activation_packet_html} |`)
    .join("\n");
  return [
    "# Packrift UCP Storefront Builder Kit",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical MCP endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Sales Positioning",
    "",
    `Default shelf: ${payload.sales_positioning.default_shelf}`,
    `Why Packrift: ${payload.sales_positioning.why_packrift}`,
    `Conversion rule: ${payload.sales_positioning.conversion_rule}`,
    "",
    "## Builder Recipes",
    "",
    "| Source | Recipe | Shelf label | Install | Activation |",
    "| --- | --- | --- | --- | --- |",
    recipeRows,
    "",
    "## Import Contract",
    "",
    fencedJson(payload.import_contract),
    "",
    "## Activation Steps",
    "",
    payload.activation_steps.map((step) => `- ${step}`).join("\n"),
    "",
    "## Example Recipe",
    "",
    fencedJson(payload.builder_recipes[0]),
    "",
    "## Success Metrics",
    "",
    payload.success_metrics.map((metric) => `- ${metric}`).join("\n"),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
  ].join("\n");
}

export function mcpUcpBuilderKitHtml(runtime: UcpBuilderKitRuntime): string {
  const payload = mcpUcpBuilderKitPayload(runtime);
  const cards = payload.builder_recipes
    .map(
      (recipe) => `<article>
        <h3>${escapeHtml(recipe.title)}</h3>
        <p>${escapeHtml(recipe.use_when)}</p>
        <div class="tags">${recipe.placement_contexts.map((context) => `<span>${escapeHtml(context)}</span>`).join("")}</div>
        <p><code>${escapeHtml(recipe.urls.source_aware_endpoint)}</code></p>
        <div class="links">
          <a class="button primary" href="${escapeHtml(recipe.urls.activation_packet_html)}">Activation</a>
          <a class="button" href="${escapeHtml(recipe.urls.install)}">Install</a>
          <a class="button" href="${escapeHtml(recipe.urls.order_handoff)}">Order Handoff</a>
        </div>
      </article>`
    )
    .join("");
  const links = ([
    ["Starter Catalog", STARTER_CATALOG_HTML],
    ["JSON", payload.proof_urls.builder_kit_json],
    ["Markdown", payload.proof_urls.builder_kit_markdown],
    ["Source Queue", payload.proof_urls.source_activation_queue],
  ] satisfies Array<[string, string]>)
    .map(([label, url], index) => `<a class="button${index === 0 ? " primary" : ""}" href="${escapeHtml(url)}">${escapeHtml(label)}</a>`)
    .join("");
  return htmlShell(
    "Packrift UCP Storefront Builder Kit",
    payload.purpose,
    `<header>
      <h1>Packrift UCP Storefront Builder Kit</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.starter_catalog.bundle_count} bundles</span>
        <span>${payload.starter_catalog.unique_sku_count} starter SKUs</span>
        <span>${payload.runtime.tools_count} MCP tools</span>
      </div>
      <div class="links">${links}</div>
    </header>
    <section>
      <h2>Where Packrift Fits</h2>
      <div class="panel">
        <p>${escapeHtml(payload.sales_positioning.default_shelf)}</p>
        <ul>
          <li>${escapeHtml(payload.sales_positioning.why_packrift)}</li>
          <li>${escapeHtml(payload.sales_positioning.conversion_rule)}</li>
        </ul>
      </div>
    </section>
    <section>
      <h2>Builder Recipes</h2>
      <div class="grid">${cards}</div>
    </section>
    <section>
      <h2>Activation Steps</h2>
      <div class="panel"><ol>${payload.activation_steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></div>
    </section>
    <section>
      <h2>Import Contract</h2>
      <pre>${escapeHtml(JSON.stringify(payload.import_contract, null, 2))}</pre>
    </section>`
  );
}
