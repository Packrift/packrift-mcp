// Public, human-readable surfaces for Packrift MCP v1: the landing page,
// llms.txt, the packaging guide, the privacy notice, SKILL.md and agent
// instructions. Everything here is written for buyers and for the assistants
// that help them; nothing here describes Packrift's internal operations.

export const MCP_URL = "https://mcp.packrift.com/mcp";
export const MCP_VERSION = "1.0.0";
export const PLUGIN_REPO = "Packrift/claude-plugin";

export const TOOL_SUMMARIES: Array<{ name: string; summary: string }> = [
  { name: "search_products", summary: "Search by product type, exact size or spec, or SKU. Live price, pack size, price per unit and stock." },
  { name: "find_packaging_for_item", summary: "Give an item's size, weight and what it is; get boxes or mailers that fit, with cushioning, strength and shipping-weight checks." },
  { name: "get_product", summary: "Specs, pack count, live price and stock, whether a quantity can ship now, volume pricing and nearby sizes." },
  { name: "get_shipping_estimate", summary: "Delivered cost to a US ZIP code, with automatic volume discounts and free shipping applied." },
  { name: "create_cart_url", summary: "A packrift.com checkout link for the chosen items. The buyer reviews and pays there; nothing is ordered by the tool." },
  { name: "get_bulk_quote_link", summary: "A pre-filled quote request for pallet quantities, custom sizes, printing or freight." },
];

export const EXAMPLE_PROMPTS = [
  "What box should I use to ship a ceramic mug that's 4.5 x 3.5 x 4 inches?",
  "Find 12x12x12 shipping boxes and show me the cheapest per box.",
  "I need poly mailers for folded t-shirts. What size, and what would 500 cost delivered to 75201?",
  "Price 10 packs of Packrift SKU 1066 delivered to 10001, then give me a checkout link.",
  "I need 2,000 printed 18x12x12 boxes. How do I get a quote?",
];

export const PACKAGING_GUIDE_MD = `# Packrift packaging guide

Practical rules for choosing and sizing shipping packaging. Packrift's tools apply these rules automatically; this page explains them.

## Box or mailer?

| Item | Best packaging |
|---|---|
| Apparel and soft goods that cannot break | Poly mailer: lightest and cheapest to ship |
| Small items that need light protection (books, cosmetics, accessories) | Bubble (padded) mailer, for items up to about 2.5 in thick |
| Flat items that must not bend (prints, photos, documents) | Rigid or paperboard mailer |
| Small items where presentation matters (subscription, retail orders) | Corrugated mailer box |
| Fragile, heavy, stacked or odd-shaped items | Corrugated shipping box |
| Posters, prints and long narrow items | Mailing tube |

## Size the box

- Corrugated box sizes are inside dimensions, listed length x width x depth. The opening is length x width.
- Leave cushioning space on every side: about 1/2 in for sturdy items, 1 to 2 in for electronics, and 2 in for fragile items, with the item wrapped and every gap filled.
- For very fragile items, box the item, then pack that box inside a larger box with 2 to 3 in of cushioning between them.
- A snug box ships cheaper. Extra space costs dimensional weight and needs more void fill.

## Size a mailer

- Poly and bubble mailers are listed width x length. The width must fit the item's width plus its thickness, and the length must fit the item's length plus its thickness, with about 1 in to spare for the seal.
- Poly mailers: 2 to 2.5 mil suits apparel; 3 to 4 mil adds tear and puncture resistance.

## Box strength

The edge crush test (ECT) rating sets how much weight a box is rated to carry, per the standard box maker's certificate:

| Board | Rated load | Max size (length + width + height) |
|---|---|---|
| ECT-32 single wall | 65 lb | 75 in |
| ECT-44 single wall | 95 lb | 95 in |
| ECT-48 double wall | 100 lb | 95 in |
| ECT-51 double wall | 120 lb | 105 in |
| ECT-61 double wall | 140 lb | 110 in |
| ECT-71 double wall | 160 lb | 115 in |

Stay well under the rating when boxes are stacked, shipped by freight or packed with dense items.

## Dimensional weight

Carriers bill the greater of actual weight and dimensional weight:

- UPS and FedEx: length x width x height in inches, each rounded up, divided by 139.
- USPS: the same measurement divided by 166, for packages over one cubic foot (1,728 cubic inches).

A 12 x 12 x 12 in box bills as 13 lb with UPS or FedEx even when it weighs 3 lb; a 10 x 8 x 6 in box bills as 4 lb. Right-sizing the box is usually the biggest shipping saving.

## Tape

- 2 in tape suits light and medium boxes; 3 in tape suits heavy boxes and warehouse use.
- Acrylic tape is quiet and clear and holds in heat, cold and sunlight. Hot-melt tape grabs fast and holds best on recycled or dusty cartons.
- Tape the center seam and both edge seams (an H pattern) on the top and bottom of heavy boxes.

## Void fill

- Air pillows: light fill for sturdy items.
- Kraft paper: blocking and bracing; curbside recyclable.
- Bubble wrap: 3/16 in for surface protection, 1/2 in for cushioning.
- Foam: the most protection for fragile items.

## Stretch film

- Hand film around 60 to 70 gauge suits light, stable loads; 80 gauge suits most pallets; 90 to 120 gauge suits heavy or sharp-edged loads.
- Cast film is quieter and clearer; blown film is stronger and more puncture resistant.

## Ordering from Packrift

- Prices are per pack, and each product title states the pack count.
- Volume discounts and free-shipping thresholds apply automatically at checkout; Packrift's tools show the current tiers.
- For pallet quantities, custom sizes or printing, request a quote at https://packrift.com/pages/bulk-quote.
`;

export const LLMS_TXT = `# Packrift

> Packrift sells packaging and shipping supplies online in the United States: corrugated shipping boxes, mailer boxes, poly and bubble mailers, poly bags, labels, packing tape, stretch film and void fill. Over 20,000 products are in stock with live pricing.

Packrift ships from five US warehouses (California, Texas, Illinois, Georgia and Pennsylvania). Prices are per pack, with the pack count in each product title. Volume discounts and free-shipping thresholds apply automatically at checkout on packrift.com.

## For AI assistants

- [Packrift MCP server](${MCP_URL}): remote MCP over Streamable HTTP, no sign-in. It searches the catalog with live price and stock, fits items to boxes and mailers, prices delivery to a ZIP code and creates packrift.com checkout links. It never places orders.
- [Connect Packrift to your assistant](https://mcp.packrift.com/start): setup for Claude, Claude Code, ChatGPT, Cursor, VS Code and other MCP clients.
- [Claude plugin](https://github.com/${PLUGIN_REPO}): Packrift tools plus packaging expertise for Claude Code and Claude.
- [Packaging guide](https://mcp.packrift.com/guides/packaging.md): choosing box or mailer, sizing, box strength, dimensional weight, tape, void fill and stretch film.
- [Full reference](https://mcp.packrift.com/llms-full.txt): product categories, sizes, comparisons and use cases.

## MCP tools

${TOOL_SUMMARIES.map((tool) => `- ${tool.name}: ${tool.summary}`).join("\n")}

## Shop

- [All products](https://packrift.com/collections/all)
- [Corrugated boxes](https://packrift.com/collections/corrugated-boxes)
- [Heavy-duty boxes](https://packrift.com/collections/heavy-duty-shipping-boxes)
- [Mailer boxes](https://packrift.com/collections/mailer-boxes)
- [Poly mailers](https://packrift.com/collections/poly-mailers)
- [Bubble mailers](https://packrift.com/collections/bubble-mailers)
- [Poly bags](https://packrift.com/collections/poly-bags)
- [Packing tape](https://packrift.com/collections/packing-tape)
- [Shipping labels](https://packrift.com/collections/shipping-labels)
- [Stretch film](https://packrift.com/collections/stretch-film)
- [Void fill](https://packrift.com/collections/void-fill)
- [Mailing tubes](https://packrift.com/collections/mailing-tubes)
- [Bulk and custom quotes](https://packrift.com/pages/bulk-quote)

## Policies and contact

- [Shipping policy](https://packrift.com/policies/shipping-policy)
- [Refund policy](https://packrift.com/policies/refund-policy)
- [Privacy policy](https://packrift.com/policies/privacy-policy)
- [MCP privacy notice](https://mcp.packrift.com/privacy)
- Support: support@packrift.com, +1 (302) 216-2975
`;

export const AGENT_INSTRUCTIONS_MD = `# Using Packrift from an AI assistant

Packrift sells packaging supplies in the United States. Connect to the Packrift MCP server at ${MCP_URL} (Streamable HTTP, no authentication).

## Which tool to use

${TOOL_SUMMARIES.map((tool) => `- **${tool.name}**: ${tool.summary}`).join("\n")}

## Typical flows

1. The buyer knows the packaging: search_products, then create_cart_url once they confirm the item and quantity.
2. The buyer describes the item they ship: find_packaging_for_item, then create_cart_url.
3. The buyer asks what it costs delivered: get_shipping_estimate with SKUs, quantities and their ZIP code.
4. Pallet quantities, custom sizes, printing, freight, or no exact match: get_bulk_quote_link.

## Rules

- Never present a different size, strength, thickness or pack count as an exact match. Search results label close sizes.
- Prices are per pack; confirm the pack count with the buyer when quantities matter.
- create_cart_url returns a link to packrift.com. The buyer reviews and pays there; no order exists until they check out.
- Shipping estimates exclude tax; checkout shows the final amount.

Support: support@packrift.com, +1 (302) 216-2975.
`;

export const SKILL_MD = `---
name: packrift-packaging
description: Find, size, price and order packaging supplies (shipping boxes, mailers, poly bags, tape, labels, stretch film) from Packrift through its MCP server. Use when someone needs shipping boxes or mailers, asks what size box or mailer fits an item, wants delivered pricing for packaging, or wants to reorder packaging supplies.
---

# Packrift packaging

Packrift sells packaging supplies in the United States with live price and stock.

## Connect

Remote MCP server: ${MCP_URL} (Streamable HTTP, no authentication).

## Tools

${TOOL_SUMMARIES.map((tool) => `- \`${tool.name}\`: ${tool.summary}`).join("\n")}

## How to help a buyer

1. If they describe the item they ship, call \`find_packaging_for_item\` with its length, width, height, weight and what it is.
2. If they name the packaging, call \`search_products\` with the size, spec or SKU.
3. For a delivered price, call \`get_shipping_estimate\` with SKUs, pack quantities and their ZIP code.
4. When they confirm items and quantities, call \`create_cart_url\` and share the checkout link.
5. For pallet quantities, custom sizes, printing or freight, call \`get_bulk_quote_link\`.

Never present a different size as an exact match. Prices are per pack. The checkout link opens packrift.com; nothing is ordered until the buyer pays there.
`;

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PAGE_CSS = `
:root{--bg:#ffffff;--surface:#f7f6f3;--text:#171a1f;--muted:#5b6270;--line:#e6e3dc;--accent:#e86100;--accent-ink:#ffffff;--code:#f1efea}
@media (prefers-color-scheme: dark){:root{--bg:#121316;--surface:#1b1d21;--text:#eceae6;--muted:#a3a9b3;--line:#2c2f35;--accent:#ff7a1a;--accent-ink:#121316;--code:#23262b}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:400 16px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:inherit}
.wrap{max-width:980px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--line)}
.bar{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:700;letter-spacing:-.01em}
.brand img{width:28px;height:28px;border-radius:6px}
.bar nav a{color:var(--muted);text-decoration:none;font-weight:500;margin-left:18px;font-size:15px}
.bar nav a:hover{color:var(--text)}
.hero{padding:64px 0 40px}
.hero h1{font-size:clamp(32px,5vw,48px);line-height:1.08;letter-spacing:-.025em;margin:0 0 16px;max-width:760px}
.hero p{font-size:19px;color:var(--muted);max-width:680px;margin:0 0 28px}
.url{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.url code{font:500 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--code);border:1px solid var(--line);border-radius:10px;padding:14px 16px;word-break:break-all}
button.copy{font:600 15px Inter,system-ui,sans-serif;background:var(--accent);color:var(--accent-ink);border:0;border-radius:10px;padding:14px 18px;cursor:pointer}
button.copy:focus-visible{outline:3px solid var(--text);outline-offset:2px}
.meta{margin-top:14px;color:var(--muted);font-size:14px}
section{padding:36px 0;border-top:1px solid var(--line)}
section h2{font-size:24px;letter-spacing:-.015em;margin:0 0 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px}
.card h3{margin:0 0 6px;font-size:16px}
.card p{margin:0;color:var(--muted);font-size:15px}
.card pre{margin:10px 0 0;background:var(--code);border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow-x:auto;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
.tool{font:600 14px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent)}
ul.prompts{list-style:none;padding:0;margin:0;display:grid;gap:10px}
ul.prompts li{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;color:var(--muted);font-size:15px}
.facts strong{display:block;color:var(--text);font-size:15px;margin-bottom:2px}
footer{padding:28px 0 48px;color:var(--muted);font-size:14px;border-top:1px solid var(--line)}
footer a{color:var(--muted)}
`;

function pageShell(title: string, description: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="/favicon.png">
<link rel="canonical" href="https://mcp.packrift.com/start">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<style>${PAGE_CSS}</style>
</head>
<body>
<header><div class="wrap bar">
<a class="brand" href="https://packrift.com"><img src="/packrift-mcp-logo.png" alt="" width="28" height="28">Packrift</a>
<nav><a href="#connect">Connect</a><a href="#tools">Tools</a><a href="/privacy">Privacy</a><a href="https://packrift.com">Shop</a></nav>
</div></header>
<main class="wrap">${body}</main>
<footer><div class="wrap">Packrift LLC · <a href="mailto:support@packrift.com">support@packrift.com</a> · +1 (302) 216-2975 · <a href="/privacy">MCP privacy</a> · <a href="https://packrift.com/policies/privacy-policy">Privacy policy</a> · <a href="https://packrift.com/policies/terms-of-service">Terms</a> · MCP ${MCP_VERSION}</div></footer>
<script>document.querySelectorAll("button.copy").forEach(function(b){b.addEventListener("click",function(){var t=b.getAttribute("data-copy");if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){var o=b.textContent;b.textContent="Copied";setTimeout(function(){b.textContent=o},1400)})}})});</script>
</body>
</html>`;
}

export function startPageHtml(): string {
  const connect: Array<{ name: string; how: string; code?: string }> = [
    { name: "Claude", how: "In claude.ai or the Claude app, open Settings, then Connectors, choose Add custom connector and paste the server URL.", code: MCP_URL },
    { name: "Claude Code", how: "Run in your terminal:", code: `claude mcp add --transport http packrift ${MCP_URL}` },
    { name: "Claude plugin", how: "Packrift tools plus packaging expertise, in Claude Code:", code: `claude plugin marketplace add ${PLUGIN_REPO}\nclaude plugin install packrift@packrift` },
    { name: "ChatGPT", how: "Add Packrift as a custom connector (developer mode) using the server URL.", code: MCP_URL },
    { name: "Cursor and Windsurf", how: "Add to your MCP settings:", code: `{"mcpServers":{"packrift":{"url":"${MCP_URL}"}}}` },
    { name: "VS Code", how: "Run in your terminal:", code: `code --add-mcp '{"name":"packrift","type":"http","url":"${MCP_URL}"}'` },
    { name: "Codex", how: "Run in your terminal:", code: `codex mcp add packrift --url ${MCP_URL}` },
  ];
  const body = `
<div class="hero">
<h1>Packaging supplies, inside your AI assistant.</h1>
<p>Connect Packrift to Claude, ChatGPT or any MCP client to find the right box or mailer for what you ship, see live prices and stock across 20,000+ products, get the delivered cost to your ZIP code and check out on packrift.com.</p>
<div class="url"><code>${MCP_URL}</code><button class="copy" data-copy="${MCP_URL}">Copy URL</button></div>
<div class="meta">Remote MCP · Streamable HTTP · No sign-in · Never places orders</div>
</div>
<section id="connect"><h2>Connect</h2><div class="grid">
${connect.map((c) => `<div class="card"><h3>${esc(c.name)}</h3><p>${esc(c.how)}</p>${c.code ? `<pre>${esc(c.code)}</pre>` : ""}</div>`).join("\n")}
</div></section>
<section id="tools"><h2>What it can do</h2><div class="grid">
${TOOL_SUMMARIES.map((t) => `<div class="card"><div class="tool">${esc(t.name)}</div><p>${esc(t.summary)}</p></div>`).join("\n")}
</div></section>
<section><h2>Try asking</h2><ul class="prompts">
${EXAMPLE_PROMPTS.map((p) => `<li>${esc(p)}</li>`).join("\n")}
</ul></section>
<section><h2>Good to know</h2><div class="facts">
<div><strong>Live data</strong>Prices, stock and shipping rates come straight from the Packrift store.</div>
<div><strong>You stay in control</strong>Tools only read the catalog and build links. Orders happen on packrift.com.</div>
<div><strong>Built for fit</strong>Sizing applies cushioning, box strength and dimensional-weight rules.</div>
<div><strong>Bulk and custom</strong>Pallet quantities, printing and custom sizes go to a quick quote.</div>
</div></section>
<section><h2>More</h2><div class="grid">
<div class="card"><h3>Packaging guide</h3><p>How to choose and size boxes and mailers.</p><pre><a href="/guides/packaging.md">mcp.packrift.com/guides/packaging.md</a></pre></div>
<div class="card"><h3>For AI crawlers</h3><p>Overview and full reference for assistants.</p><pre><a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a></pre></div>
<div class="card"><h3>Source</h3><p>Plugin and server listings.</p><pre><a href="https://github.com/${PLUGIN_REPO}">github.com/${PLUGIN_REPO}</a></pre></div>
</div></section>`;
  return pageShell(
    "Packrift for AI assistants",
    "Connect Packrift's packaging catalog to Claude, ChatGPT and other AI assistants: fit items to boxes and mailers, live prices and stock, delivered pricing and checkout links.",
    body
  );
}

export const START_MD = `# Packrift for AI assistants

Connect Packrift to Claude, ChatGPT or any MCP client to find the right box or mailer for what you ship, see live prices and stock across 20,000+ products, get the delivered cost to your ZIP code and check out on packrift.com.

MCP server: ${MCP_URL} (Streamable HTTP, no sign-in, never places orders)

## Connect

- Claude: Settings, Connectors, Add custom connector, paste the server URL.
- Claude Code: \`claude mcp add --transport http packrift ${MCP_URL}\`
- Claude plugin: \`claude plugin marketplace add ${PLUGIN_REPO}\` then \`claude plugin install packrift@packrift\`
- ChatGPT: add Packrift as a custom connector (developer mode) with the server URL.
- Cursor and Windsurf: \`{"mcpServers":{"packrift":{"url":"${MCP_URL}"}}}\`
- VS Code: \`code --add-mcp '{"name":"packrift","type":"http","url":"${MCP_URL}"}'\`
- Codex: \`codex mcp add packrift --url ${MCP_URL}\`

## Tools

${TOOL_SUMMARIES.map((tool) => `- ${tool.name}: ${tool.summary}`).join("\n")}

## Try asking

${EXAMPLE_PROMPTS.map((p) => `- ${p}`).join("\n")}

Privacy: https://mcp.packrift.com/privacy · Support: support@packrift.com
`;

export const PRIVACY_MD = `# Packrift MCP and Claude plugin privacy notice

Last updated September 27, 2026. This notice covers the Packrift MCP server at ${MCP_URL} and the Packrift Claude plugin. Orders placed on packrift.com are covered by the [Packrift privacy policy](https://packrift.com/policies/privacy-policy).

## What the server receives

Only the arguments your assistant sends to Packrift's tools: search text, item dimensions and weights, SKUs and quantities, and a ZIP code (and optional state) for shipping estimates. The server does not receive your conversation, your files or your account details, and it never asks for payment information.

## What we keep

Usage records for up to 90 days: the tool used, the time, search text, the SKUs returned, the type of assistant app (for example Claude or ChatGPT) and whether a checkout link was opened. Search text is scrubbed of anything that looks like an email address or phone number. We do not store names, email addresses, phone numbers, street addresses or IP addresses from MCP requests. Our hosting provider may keep standard request logs for security.

## How we use it

To answer requests, to measure and improve search and sizing results, and to understand which assistants send shoppers to packrift.com. We do not sell this information or share it with advertisers.

## Service providers

Cloudflare hosts the server. Shopify provides product, price, stock and shipping data and runs checkout on packrift.com.

## Contact

Packrift LLC, 300 Delaware Ave, Wilmington, DE 19801, US · support@packrift.com · +1 (302) 216-2975
`;

export function privacyPageHtml(): string {
  const html = PRIVACY_MD.replace(/^# (.*)$/m, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "</p><h2>$1</h2><p>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, "</p><p>");
  const body = `<div class="hero" style="padding-bottom:12px"></div><article style="max-width:720px;padding-bottom:40px">${html.replace(/<p><\/p>/g, "")}</article>`;
  return pageShell("Packrift MCP privacy notice", "What the Packrift MCP server and Claude plugin receive, keep and use.", body);
}
