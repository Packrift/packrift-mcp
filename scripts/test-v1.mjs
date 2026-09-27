// Offline tests for the v1 tool layer: fit engine, catalog parsing,
// attribution, search ranking and the public-surface hygiene guarantees.
//   npm run build && node --test scripts/test-v1.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { billableWeight, coerceFitUseCase, findFits } from "../dist/v1/fit.js";
import { catalogIndex, classifyKind, entryBySku, maxWeightForEct, parsePackCount } from "../dist/v1/catalog.js";
import { clientSlugFromName, clientSlugFromSessionId, sessionIdForClient, utmSourceForClient } from "../dist/v1/attribution.js";
import { nearestSizes, rankSearchItems, checkoutLink } from "../dist/v1/tools.js";
import { discountSummary, parseDiscountNodes } from "../dist/v1/live.js";
import { isInternalRoute, publicLocationName, scrubLegacyPayload } from "../dist/public-hygiene.js";
import app, { TOOLS, LEGACY_TOOLS } from "../dist/index.js";

test("dimensional weight follows carrier rules", () => {
  assert.deepEqual(billableWeight([12, 12, 12], 3), { upsFedexLb: 13, uspsLb: 3, dimensionalApplies: true });
  assert.deepEqual(billableWeight([10, 8, 6], 2), { upsFedexLb: 4, uspsLb: 2, dimensionalApplies: true });
  const big = billableWeight([18, 18, 18], 5);
  assert.equal(big.upsFedexLb, 42);
  assert.equal(big.uspsLb, 36);
  assert.equal(billableWeight([6, 4, 2], 1).dimensionalApplies, false);
});

test("box strength table matches the box maker's certificate", () => {
  assert.equal(maxWeightForEct(32, false), 65);
  assert.equal(maxWeightForEct(44, false), 95);
  assert.equal(maxWeightForEct(48, true), 100);
  assert.equal(maxWeightForEct(71, true), 160);
  assert.equal(maxWeightForEct(null, false), null);
});

test("pack counts parse from common title formats", () => {
  assert.equal(parsePackCount("10x6x6 ECT-32 Kraft Corrugated Shipping Boxes 25-Pack"), 25);
  assert.equal(parsePackCount("10x13 2.5 Mil Clear Self-Seal Poly Mailers 100/Case"), 100);
  assert.equal(parsePackCount("Gold Foil Labels - Case of 1000"), 1000);
  assert.equal(parsePackCount("Blue Event Tickets - 2,000 Per Roll"), 2000);
  assert.equal(parsePackCount("Paint Can Foam Insert 5x5x1.25\" EPS - Case/100"), 100);
});

test("packaging kinds are classified for fitting", () => {
  assert.equal(classifyKind("12x12x12 ECT-32 Kraft Corrugated Boxes - 25 Pack", "boxes"), "corrugated_box");
  assert.equal(classifyKind("15x15x15 ECT-48 Double Wall Corrugated Boxes", "boxes"), "heavy_duty_box");
  assert.equal(classifyKind("10x13 Self-Seal Poly Mailers 100/Case", "mailers"), "poly_mailer");
  assert.equal(classifyKind("6x10 Kraft Bubble Mailers 25-Pack", "mailers"), "bubble_mailer");
  assert.equal(classifyKind("4x36 Kraft Mailing Tubes with Caps", "mailers"), "mailing_tube");
  assert.equal(classifyKind("4x4x4 Plastic Bins - Case of 12", "boxes"), "other");
});

test("use case is read from plain words", () => {
  assert.equal(coerceFitUseCase("ceramic mug", 1), "fragile");
  assert.equal(coerceFitUseCase("folded hoodie", 1), "apparel");
  assert.equal(coerceFitUseCase("laptop", 4), "electronics");
  assert.equal(coerceFitUseCase("hardcover book", 2), "books");
  assert.equal(coerceFitUseCase("", 40), "heavy");
  assert.equal(coerceFitUseCase(undefined, 2), "general");
});

test("fragile items get 2 inches of cushioning per side in a box", () => {
  const fit = findFits({ length: 4.5, width: 3.5, height: 4, weightLb: 1, useCase: "fragile", packaging: "any", limit: 3, requestText: "ceramic mug" });
  assert.ok(fit.candidates.length >= 3);
  for (const candidate of fit.candidates) {
    assert.equal(candidate.fitKind, "box");
    assert.ok(Math.min(...candidate.clearancePerSide) >= 2 - 1e-9, `${candidate.entry.sku} clearance ${candidate.clearancePerSide}`);
  }
  assert.deepEqual(fit.requiredInside, [8.5, 8, 7.5]);
});

test("apparel prefers mailers and skips specialty packaging unless asked", () => {
  const fit = findFits({ length: 12, width: 10, height: 1.5, weightLb: 0.5, useCase: "apparel", packaging: "any", limit: 3, requestText: "folded t-shirt" });
  assert.ok(fit.candidates.some((c) => c.fitKind === "flat"));
  assert.ok(fit.candidates.every((c) => !c.entry.specialty), "no specialty mailers for a plain t-shirt");
  const insulated = findFits({ length: 12, width: 10, height: 1.5, weightLb: 0.5, useCase: "apparel", packaging: "mailer", limit: 5, requestText: "thermal insulated shipping" });
  assert.ok(insulated.candidates.some((c) => c.entry.specialty === "thermal" || c.entry.specialty === "insulated"));
});

test("heavy items only get boxes rated for the weight", () => {
  const fit = findFits({ length: 16, width: 12, height: 10, weightLb: 80, useCase: "heavy", packaging: "any", limit: 5, requestText: "machine parts" });
  assert.ok(fit.candidates.length > 0);
  for (const candidate of fit.candidates) {
    assert.ok(candidate.strengthOk);
    const limit = maxWeightForEct(candidate.entry.ect, candidate.entry.doubleWall);
    if (limit !== null) assert.ok(limit >= 80, `${candidate.entry.sku} rated ${limit}`);
  }
});

test("long narrow items can fit mailing tubes", () => {
  const fit = findFits({ length: 24, width: 2, height: 2, weightLb: 0.5, useCase: "general", packaging: "any", limit: 3, requestText: "rolled poster" });
  assert.ok(fit.candidates.some((c) => c.fitKind === "tube"));
});

test("client names map to attribution slugs that survive the session id", () => {
  assert.equal(clientSlugFromName("claude-ai"), "claude");
  assert.equal(clientSlugFromName("claude-code"), "claude_code");
  assert.equal(clientSlugFromName("openai-mcp"), "chatgpt");
  assert.equal(clientSlugFromName("Visual Studio Code"), "vscode");
  assert.equal(clientSlugFromName(""), null);
  const session = sessionIdForClient("claude_code");
  assert.match(session, /^pk1\.claude_code\.[0-9a-f-]{36}$/);
  assert.equal(clientSlugFromSessionId(session), "claude_code");
  assert.equal(clientSlugFromSessionId("random-client-id"), null);
  assert.equal(utmSourceForClient("claude_code"), "claude");
  assert.equal(utmSourceForClient("chatgpt"), "chatgpt");
  assert.equal(utmSourceForClient(null), "ai_agent");
});

test("search ranking puts exact size, requested strength and color first, then price", () => {
  const item = (sku, extra) => ({ sku, title: sku, type: "box", size: null, pack: 25, price: 10, unit_price: 0.4, in_stock: true, url: "u", match: "exact", ...extra });
  const standard = entryBySku("121212");
  const heavy = entryBySku("HD1212DW");
  assert.ok(standard && heavy, "catalog has the standard and heavy 12 inch cubes");
  const items = [item("HD1212DW", { unit_price: 2.38 }), item("121212", { unit_price: 1.25 })];
  rankSearchItems(items, "12x12x12 shipping boxes", true);
  assert.equal(items[0].sku, "121212", "standard strength first when heavy duty is not asked for");
  rankSearchItems(items, "12x12x12 double wall boxes", true);
  assert.equal(items[0].sku, "HD1212DW", "heavy duty first when asked for");
});

test("nearest sizes are larger than the request and never the exact size", () => {
  const sizes = nearestSizes("12x12x11.5 box", [12, 12, 11.5], 3);
  assert.ok(sizes.length > 0);
  for (const entry of sizes) {
    assert.ok(entry.dims.every((d, i) => d >= [12, 12, 11.5][i] - 1e-9));
  }
});

test("checkout links carry the cart and source without server state", () => {
  const url = new URL(checkoutLink([{ variantId: "53472879935856", quantity: 6 }], "claude", "mcp_handoff_4fbc3d28-e6c6-4bb6-a12b-ddbfb7f1f036"));
  assert.equal(url.pathname, "/c/53472879935856:6");
  assert.equal(url.searchParams.get("s"), "claude");
  assert.equal(url.searchParams.get("k"), "4fbc3d28-e6c6-4bb6-a12b-ddbfb7f1f036");
});

test("discount copy is built from live automatic discounts", () => {
  const rules = parseDiscountNodes([
    { automaticDiscount: { __typename: "DiscountAutomaticBasic", title: "3%", minimumRequirement: { __typename: "DiscountMinimumQuantity", greaterThanOrEqualToQuantity: "3" }, customerGets: { value: { __typename: "DiscountPercentage", percentage: 0.03 }, items: { __typename: "AllDiscountItems" } } } },
    { automaticDiscount: { __typename: "DiscountAutomaticFreeShipping", title: "free", minimumRequirement: { __typename: "DiscountMinimumSubtotal", greaterThanOrEqualToSubtotal: { amount: "99.0" } }, maximumShippingPrice: { amount: "29.95" } } },
  ]);
  assert.equal(rules.volumeTiers[0].percentOff, 3);
  assert.match(discountSummary(rules), /3% off 3\+ items/);
  assert.match(discountSummary(rules), /\$99 \(rates up to \$29\.95\)/);
});

test("the public tool surface is the six v1 tools with full annotations; earlier names stay callable", () => {
  assert.deepEqual(TOOLS.map((t) => t.schema.name), ["search_products", "find_packaging_for_item", "get_product", "get_shipping_estimate", "create_cart_url", "get_bulk_quote_link"]);
  for (const tool of TOOLS) {
    const a = tool.schema.annotations;
    assert.equal(a.readOnlyHint, true);
    assert.equal(a.destructiveHint, false);
    assert.ok(a.title && tool.schema.title);
    assert.ok(tool.schema.description.length < 900);
  }
  for (const name of ["compare_alternatives", "pack_calculator", "get_pricing", "check_inventory", "inventory_status", "prepare_purchase_handoff"]) {
    assert.ok(LEGACY_TOOLS.some((t) => t.schema.name === name), name);
  }
});

test("legacy payloads lose internal fields and supplier location names", () => {
  const out = scrubLegacyPayload({
    approved_risk_flags: "x",
    current_margin: "",
    results: [{ sku: "1", risk_flags: "y", inventory_levels: [{ location: "Acme Freight - Central" }, { location: "Shop location" }] }],
  });
  assert.equal("approved_risk_flags" in out, false);
  assert.equal("current_margin" in out, false);
  assert.equal("risk_flags" in out.results[0], false);
  assert.equal(out.results[0].inventory_levels[0].location, "Central US warehouse");
  assert.equal(out.results[0].inventory_levels[1].location, "Shop location");
  assert.equal(publicLocationName("Acme - Southeast"), "Southeast US warehouse");
});

const env = {
  SHOPIFY_STORE_DOMAIN: "offline.invalid",
  SHOPIFY_API_VERSION: "test",
  STOREFRONT_DOMAIN: "packrift.com",
  SHOPIFY_PACKRIFT_TOKEN: "",
  CATALOG_CACHE: { get: async () => null, put: async () => {}, list: async () => ({ keys: [] }) },
};
const ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (path) => app.fetch(new Request(`https://mcp.packrift.com${path}`, { headers: { "user-agent": "packrift-test" } }), env, ctx);

const PUBLIC_ROUTES = [
  "/", "/start", "/install", "/llms.txt", "/llms-full.txt", "/guides/packaging.md", "/privacy", "/privacy.md", "/SKILL.md",
  "/agents.md", "/ai/packrift-ai-agent-instructions.md", "/robots.txt", "/.well-known/mcp/server-card.json", "/server-card.json",
  "/manifest", "/agent.json", "/.well-known/agent.json", "/openapi.json", "/.well-known/openapi.json", "/ai-plugin.json",
  "/.well-known/ai-plugin.json", "/mcp.json", "/.well-known/mcp.json", "/.well-known/capability-card.json",
  "/.well-known/agent-manifest.json",
];
const privateTermsFile = new URL("../.private-terms", import.meta.url);
const PRIVATE_TERMS = existsSync(privateTermsFile)
  ? readFileSync(privateTermsFile, "utf8").split("\n").map((t) => t.trim()).filter(Boolean)
  : [];
const FORBIDDEN = [/\bcogs\b/i, /\bmarkup\b/i, /current_margin/i, /\/Users\/farhan/i, /~\/Downloads/i, /"orders?"\s*:\s*0\b/i, /#100[0-9]\b/, /AI_APPROVE/];

test("public pages and manifests contain no internal or supplier details", async () => {
  for (const path of PUBLIC_ROUTES) {
    const res = await get(path);
    assert.ok(res.status < 400, `${path} -> ${res.status}`);
    const body = await res.text();
    for (const pattern of FORBIDDEN) assert.ok(!pattern.test(body), `${path} matched ${pattern}`);
    for (const term of PRIVATE_TERMS) {
      const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      assert.ok(!pattern.test(body), `${path} contains a private term`);
    }
  }
});

test("internal reports are not served publicly", async () => {
  for (const path of ["/ai/mcp-funnel-snapshot.json", "/ai/mcp-usage-snapshot.json", "/ai/mcp-revenue-conversion-queue.json", "/events/ai-sales/summary", "/events/ai-sales/dashboard", "/ai/packrift-uline-alternatives-authority-source.json", "/ai/claude-connector-submission.json"]) {
    assert.equal((await get(path)).status, 404, path);
  }
});

test("robots.txt keeps crawlers off redirects and checkout links", async () => {
  const body = await (await get("/robots.txt")).text();
  assert.match(body, /Disallow: \/r\//);
  assert.match(body, /Disallow: \/c\//);
});

test("catalog index covers the approved catalog", () => {
  assert.ok(catalogIndex().length > 9000);
  assert.ok(isInternalRoute("/ai/mcp-activation-wave.json"));
  assert.ok(!isInternalRoute("/ai/sku/1066.md"));
});
