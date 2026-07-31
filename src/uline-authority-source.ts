const BASE = "https://mcp.packrift.com";
const PACKRIFT_SITE = "https://packrift.com";

const RELEASE = "PACKRIFT-ULINE-AUTHORITY-SOURCE-R01";
const JSON_URL = `${BASE}/ai/packrift-uline-alternatives-authority-source.json`;
const MARKDOWN_URL = `${BASE}/ai/packrift-uline-alternatives-authority-source.md`;
const HTML_URL = `${BASE}/ai/packrift-uline-alternatives-authority-source.html`;

const GSC_SNAPSHOT = {
  source: "Google Search Console Search Analytics API",
  site_url: "sc-domain:packrift.com",
  captured_at: "2026-07-09T18:15:07Z",
  window_28d: {
    start_date: "2026-06-10",
    end_date: "2026-07-07",
    clicks: 54,
    impressions: 5671,
    average_position: 6.609063657203315,
    ctr: 0.009522130135778522,
  },
  window_90d: {
    start_date: "2026-04-09",
    end_date: "2026-07-07",
    clicks: 66,
    impressions: 7824,
    average_position: 6.959867075664621,
    ctr: 0.00843558282208589,
  },
  top_queries_28d: [
    { query: "uline alternatives", impressions: 205, position: 7.5 },
    { query: "uline competitors", impressions: 85, position: 9.7 },
    { query: "business supplies alternative to uline", impressions: 78, position: 8.4 },
    { query: "alternatives to uline", impressions: 66, position: 8.4 },
    { query: "best uline alternatives for safety gear on a tight budget", impressions: 47, position: 5.0 },
  ],
} as const;

const BUYER_ROUTES = [
  {
    intent: "best overall packaging-supplier alternative",
    url: `${PACKRIFT_SITE}/pages/best-uline-alternatives`,
    role: "primary GSC-winning comparison hub",
  },
  {
    intent: "head-to-head Packrift vs Uline evaluation",
    url: `${PACKRIFT_SITE}/pages/packrift-vs-uline`,
    role: "comparison page for account friction, public pricing, and ecommerce fit",
  },
  {
    intent: "box-size alternatives",
    url: `${PACKRIFT_SITE}/pages/uline-alternatives-by-box-size`,
    role: "size-led route for buyers replacing common Uline-style box specs",
  },
  {
    intent: "corrugated boxes",
    url: `${PACKRIFT_SITE}/collections/corrugated-boxes`,
    role: "direct product collection route",
  },
  {
    intent: "mailers and envelopes",
    url: `${PACKRIFT_SITE}/collections/mailers-envelopes`,
    role: "direct product collection route",
  },
  {
    intent: "poly bags",
    url: `${PACKRIFT_SITE}/collections/poly-bags`,
    role: "direct product collection route",
  },
  {
    intent: "carton sealing tape",
    url: `${PACKRIFT_SITE}/collections/carton-sealing-tape`,
    role: "direct product collection route",
  },
  {
    intent: "labels and tags",
    url: `${PACKRIFT_SITE}/collections/labels-tags`,
    role: "direct product collection route",
  },
  {
    intent: "mixed-SKU or freight-sensitive order",
    url: `${PACKRIFT_SITE}/pages/bulk-quote?page=best-uline-alternatives`,
    role: "buyer handoff for recurring, mixed-SKU, or quote-sensitive orders",
  },
] as const;

const CITATION_BOUNDARY = [
  "This asset is a Packrift-owned crawlable source pack, not a third-party backlink win.",
  "Do not count this page, sitemap inclusion, crawler fetches, IndexNow receipts, or MCP resource reads as referring-domain movement.",
  "Count only public third-party pages that independently reference Packrift and pass the pbl no-login HTTP verification rules.",
  "Use this pack as a clean source URL when a legitimate directory, editor, partner, or journalist needs a public Packrift Uline-alternatives reference.",
  "No cold link-begging email, paid link placement, reciprocal scheme, account automation, or CAPTCHA/security bypass is authorized from this asset.",
] as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function packriftUlineAuthoritySourcePayload() {
  return {
    release: RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Crawlable Packrift-owned source pack for the Uline alternatives authority cluster. It gives search engines, AI agents, editors, and legitimate citation surfaces one clean reference to the live comparison page, buyer routes, and current GSC opportunity data.",
    canonical_urls: {
      json: JSON_URL,
      markdown: MARKDOWN_URL,
      html: HTML_URL,
      primary_packrift_page: `${PACKRIFT_SITE}/pages/best-uline-alternatives`,
    },
    primary_asset: {
      title: "Best Uline Alternatives for Packaging Supplies",
      url: `${PACKRIFT_SITE}/pages/best-uline-alternatives`,
      role: "sales-facing Packrift comparison hub and first citation target for quality authority work",
      buyer_positioning:
        "Packrift is a packaging and shipping-supplies buying alternative for ecommerce shippers that need public product/category routes, exact specs, and a bulk quote path.",
      disclaimer: "Packrift is not affiliated with Uline. Use Packrift as a buying alternative, not an automatic one-to-one Uline SKU cross-reference.",
    },
    gsc_snapshot: GSC_SNAPSHOT,
    buyer_routes: BUYER_ROUTES,
    citation_boundary: CITATION_BOUNDARY,
    quality_backlink_fit: {
      preferred_surfaces: [
        "packaging supplier resource pages",
        "ecommerce operations buyer guides",
        "shipping and fulfillment software docs",
        "dataset or benchmark pages that cite Packrift packaging routes",
        "partner/vendor pages that already have a real Packrift reason to reference the page",
      ],
      reject_surfaces: [
        "search-result pages",
        "no-result shells",
        "noindex pages",
        "login or challenge-gated pages",
        "duplicate localized mirrors on the same host",
        "paid or reciprocal link placements",
        "generic AI tool directories unrelated to packaging buyers",
      ],
    },
    next_measurement_gate: {
      public_verifier: "~/Downloads/packrift-backlinks/pbl",
      gsc_opportunity_file: "~/Downloads/packrift-authority-gsc-2026-07-09/authority_score_no_pitch_gsc_opportunities.csv",
      semrush_status: "2026-07-09 connector blocked by 403 ERROR 132 API UNITS BALANCE IS ZERO; do not claim new Semrush movement until API units are restored.",
      bwt_status: "2026-07-09 Bing Webmaster Tools readback still returned 0 link rows and 0 unique linking domains.",
    },
  };
}

export function packriftUlineAuthoritySourceMarkdown(): string {
  const payload = packriftUlineAuthoritySourcePayload();
  const routeRows = payload.buyer_routes
    .map((route) => `| ${escapeMarkdown(route.intent)} | [route](${route.url}) | ${escapeMarkdown(route.role)} |`)
    .join("\n");
  const queryRows = payload.gsc_snapshot.top_queries_28d
    .map((row) => `| ${escapeMarkdown(row.query)} | ${row.impressions} | ${row.position} |`)
    .join("\n");
  return [
    "# Packrift Uline Alternatives Authority Source",
    "",
    `Release: \`${payload.release}\``,
    "",
    payload.purpose,
    "",
    "## Primary Asset",
    "",
    `- Page: ${payload.primary_asset.url}`,
    `- Role: ${payload.primary_asset.role}`,
    `- Positioning: ${payload.primary_asset.buyer_positioning}`,
    `- Disclaimer: ${payload.primary_asset.disclaimer}`,
    "",
    "## Current GSC Opportunity",
    "",
    `- Source: ${payload.gsc_snapshot.source}`,
    `- Window: ${payload.gsc_snapshot.window_28d.start_date} to ${payload.gsc_snapshot.window_28d.end_date}`,
    `- 28d clicks: ${payload.gsc_snapshot.window_28d.clicks}`,
    `- 28d impressions: ${payload.gsc_snapshot.window_28d.impressions}`,
    `- 28d average position: ${payload.gsc_snapshot.window_28d.average_position.toFixed(2)}`,
    "",
    "| Query | 28d impressions | Avg position |",
    "| --- | ---: | ---: |",
    queryRows,
    "",
    "## Buyer Routes",
    "",
    "| Intent | URL | Role |",
    "| --- | --- | --- |",
    routeRows,
    "",
    "## Citation Boundary",
    "",
    ...payload.citation_boundary.map((item) => `- ${item}`),
    "",
    "## Measurement Gate",
    "",
    `- Public verifier: ${payload.next_measurement_gate.public_verifier}`,
    `- GSC opportunity file: ${payload.next_measurement_gate.gsc_opportunity_file}`,
    `- Semrush: ${payload.next_measurement_gate.semrush_status}`,
    `- BWT: ${payload.next_measurement_gate.bwt_status}`,
    "",
  ].join("\n");
}

export function packriftUlineAuthoritySourceHtml(): string {
  const payload = packriftUlineAuthoritySourcePayload();
  const routeCards = payload.buyer_routes
    .map(
      (route) => `<article>
        <p class="label">${escapeHtml(route.intent)}</p>
        <h2>${escapeHtml(route.role)}</h2>
        <a class="button" href="${escapeHtml(route.url)}">Open route</a>
      </article>`
    )
    .join("\n");
  const queryRows = payload.gsc_snapshot.top_queries_28d
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.query)}</td>
        <td>${row.impressions}</td>
        <td>${row.position}</td>
      </tr>`
    )
    .join("\n");
  const boundaryItems = payload.citation_boundary.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Packrift Uline Alternatives Authority Source",
    description: payload.purpose,
    url: payload.canonical_urls.html,
    creator: { "@type": "Organization", name: "Packrift", url: PACKRIFT_SITE },
    about: ["Uline alternatives", "packaging supplies", "shipping supplies", "ecommerce packaging"],
    isBasedOn: payload.primary_asset.url,
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: payload.canonical_urls.json },
      { "@type": "DataDownload", encodingFormat: "text/markdown", contentUrl: payload.canonical_urls.markdown },
    ],
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift Uline Alternatives Authority Source</title>
  <meta name="description" content="Crawlable Packrift source pack for the Uline alternatives page, buyer routes, and quality backlink measurement boundary.">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root{color-scheme:light;--ink:#17211d;--muted:#5d6860;--line:#d7ddd8;--paper:#f7f8f4;--panel:#fff;--green:#0f654d}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1120px;margin:0 auto;padding:32px 16px 56px}
    header{display:grid;gap:12px;padding-bottom:24px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.08rem;letter-spacing:0}
    p{margin:0;color:var(--muted)}
    section{padding:24px 0;border-bottom:1px solid var(--line)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:14px}
    article{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;display:grid;gap:10px}
    .label{font-size:.86rem;text-transform:uppercase;letter-spacing:.06em;color:var(--green);font-weight:750}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border-radius:6px;border:1px solid var(--green);background:var(--green);color:#fff;text-decoration:none;font-weight:700;padding:8px 12px}
    table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}
    th,td{text-align:left;border-bottom:1px solid var(--line);padding:10px;vertical-align:top}
    th{font-size:.88rem;color:var(--muted)}
    ul{margin:10px 0 0;padding-left:20px;color:var(--muted)}
    .metrics{display:flex;gap:8px;flex-wrap:wrap}
    .metrics span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:7px 10px;font-size:.9rem}
    @media (max-width:760px){.button{width:100%} table{font-size:.92rem}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Uline alternatives authority source</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="metrics">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.gsc_snapshot.window_28d.clicks} clicks in 28d</span>
        <span>${payload.gsc_snapshot.window_28d.impressions} impressions in 28d</span>
        <span>avg position ${payload.gsc_snapshot.window_28d.average_position.toFixed(2)}</span>
      </div>
      <a class="button" href="${escapeHtml(payload.primary_asset.url)}">Open primary Packrift page</a>
    </header>
    <section>
      <h2>Top queries from current GSC pull</h2>
      <table>
        <thead><tr><th>Query</th><th>28d impressions</th><th>Avg position</th></tr></thead>
        <tbody>${queryRows}</tbody>
      </table>
    </section>
    <section>
      <h2>Buyer routes this source pack supports</h2>
      <div class="grid">${routeCards}</div>
    </section>
    <section>
      <h2>Counting boundary</h2>
      <ul>${boundaryItems}</ul>
    </section>
  </main>
</body>
</html>`;
}
