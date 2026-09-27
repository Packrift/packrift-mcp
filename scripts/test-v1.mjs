// Offline tests for the v1 tool layer: fit engine, catalog parsing,
// attribution, search ranking and the public-surface hygiene guarantees.
//   npm run build && node --test scripts/test-v1.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { billableWeight, coerceFitUseCase, findFits } from "../dist/v1/fit.js";
import { catalogIndex, classifyKind, entryBySku, maxWeightForEct, parsePackCount } from "../dist/v1/catalog.js";
import { clientSlugFromName, clientSlugFromSessionId, sessionIdForClient, utmSourceForClient } from "../dist/v1/attribution.js";
import { nearestSizes, rankSearchItems, checkoutLink, rankFits, refineMatch, CUSTOM_WORK, composeQuoteSpec, sanitizeDetailed } from "../dist/v1/tools.js";
import { discountLadder, freeShippingNote, parseDiscountNodes, percentAtQuantity, tiersForProduct, volumePricingLine, weightInPounds } from "../dist/v1/live.js";
import { fixMojibake } from "../dist/v1/format.js";
import { isInternalRoute, publicLocationName, scrubLegacyPayload } from "../dist/public-hygiene.js";
import app, { TOOLS, LEGACY_TOOLS } from "../dist/index.js";

test("dimensional weight follows carrier rules (USPS divides by 139 above one cubic foot since July 12, 2026)", () => {
  assert.deepEqual(billableWeight([12, 12, 12], 3), { upsFedexLb: 13, uspsLb: 3, dimensionalApplies: true });
  assert.deepEqual(billableWeight([10, 8, 6], 2), { upsFedexLb: 4, uspsLb: 2, dimensionalApplies: true });
  // A listed 12x12x12 box measures about 12.25 in outside: 13x13x13 = 2,197 cu in.
  assert.deepEqual(billableWeight([12.25, 12.25, 12.25], 3), { upsFedexLb: 16, uspsLb: 16, dimensionalApplies: true });
  const big = billableWeight([18, 18, 18], 5);
  assert.equal(big.upsFedexLb, 42);
  assert.equal(big.uspsLb, 42);
  assert.equal(billableWeight([6, 4, 2], 1).dimensionalApplies, false);
  assert.equal(weightInPounds({ value: 160, unit: "OUNCES" }), 10);
  assert.equal(weightInPounds({ value: 10.06, unit: "POUNDS" }), 10.06);
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

test("bubble-lined poly mailers and shopping bags are classified correctly", () => {
  assert.equal(classifyKind("9.5x14.5 Bubble Lined Poly Mailers - Self-Seal Shipping Protection, Case 100", "mailers"), "bubble_mailer");
  assert.equal(classifyKind('16" x 6" x 12" White Paper Corrugated Mailers, 250-Pack', "mailers", "16x6x12-65lb-white-paper-shopping-bags-w-twist-handles-case-of-250"), "other");
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

const LIVE_LIKE_DISCOUNTS = [
  { automaticDiscount: { __typename: "DiscountAutomaticBasic", title: "3%", context: { __typename: "DiscountBuyerSelectionAll" }, minimumRequirement: { __typename: "DiscountMinimumQuantity", greaterThanOrEqualToQuantity: "3" }, customerGets: { value: { __typename: "DiscountPercentage", percentage: 0.03 }, items: { __typename: "AllDiscountItems" } } } },
  { automaticDiscount: { __typename: "DiscountAutomaticBasic", title: "5%", context: { __typename: "DiscountBuyerSelectionAll" }, minimumRequirement: { __typename: "DiscountMinimumQuantity", greaterThanOrEqualToQuantity: "6" }, customerGets: { value: { __typename: "DiscountPercentage", percentage: 0.05 }, items: { __typename: "AllDiscountItems" } } } },
  { automaticDiscount: { __typename: "DiscountAutomaticBasic", title: "cases 5%", context: { __typename: "DiscountBuyerSelectionAll" }, minimumRequirement: { __typename: "DiscountMinimumQuantity", greaterThanOrEqualToQuantity: "3" }, customerGets: { value: { __typename: "DiscountPercentage", percentage: 0.05 }, items: { __typename: "DiscountProducts", products: { nodes: [{ id: "gid://shopify/Product/111" }] } } } } },
  { automaticDiscount: { __typename: "DiscountAutomaticBasic", title: "cases 8%", context: { __typename: "DiscountBuyerSelectionAll" }, minimumRequirement: { __typename: "DiscountMinimumQuantity", greaterThanOrEqualToQuantity: "6" }, customerGets: { value: { __typename: "DiscountPercentage", percentage: 0.08 }, items: { __typename: "DiscountProducts", products: { nodes: [{ id: "gid://shopify/Product/111" }] } } } } },
  { automaticDiscount: { __typename: "DiscountAutomaticFreeShipping", title: "free 99", context: { __typename: "DiscountBuyerSelectionAll" }, minimumRequirement: { __typename: "DiscountMinimumSubtotal", greaterThanOrEqualToSubtotal: { amount: "99.0" } }, maximumShippingPrice: { amount: "29.95" } } },
  { automaticDiscount: { __typename: "DiscountAutomaticFreeShipping", title: "free 500", context: { __typename: "DiscountBuyerSelectionAll" }, minimumRequirement: { __typename: "DiscountMinimumSubtotal", greaterThanOrEqualToSubtotal: { amount: "500.0" } }, maximumShippingPrice: { amount: "120.0" } } },
  { automaticDiscount: { __typename: "DiscountAutomaticFreeShipping", title: "one customer", context: { __typename: "DiscountCustomers" }, minimumRequirement: null, maximumShippingPrice: null } },
];

test("volume pricing is stated per SKU from live automatic discounts; customer-only discounts are ignored", () => {
  const rules = parseDiscountNodes(LIVE_LIKE_DISCOUNTS);
  assert.equal(rules.freeShipping.length, 2);
  assert.deepEqual(discountLadder(tiersForProduct(rules, "999")), [{ minQuantity: 3, percentOff: 3 }, { minQuantity: 6, percentOff: 5 }]);
  const deep = discountLadder(tiersForProduct(rules, "111"));
  assert.deepEqual(deep, [{ minQuantity: 3, percentOff: 5 }, { minQuantity: 6, percentOff: 8 }]);
  assert.equal(percentAtQuantity(deep, 8), 8);
  assert.equal(percentAtQuantity(deep, 2), 0);
  const line = volumePricingLine(rules, [{ sku: "988", productId: "999" }, { sku: "121212", productId: "111" }]);
  assert.match(line, /3% off 3\+ packs, 5% off 6\+ packs/);
  assert.match(line, /SKU 121212: 5% off 3\+ packs, 8% off 6\+ packs/);
  assert.doesNotMatch(line, /free shipping/i);
});

test("free-shipping notes never promise free shipping the rate does not qualify for", () => {
  const rules = parseDiscountNodes(LIVE_LIKE_DISCOUNTS);
  const quote = (subtotal, price) => ({ subtotalBeforeDiscounts: subtotal, discounts: 0, subtotal, rates: [{ title: "Freight Shipping", price, free: false, charged: price }], cheapest: { title: "Freight Shipping", charged: price }, total: subtotal + price });
  const blocked = freeShippingNote(quote(123.4, 35.12), rules);
  assert.match(blocked, /covers shipping rates up to \$29\.95; this order's rate is \$35\.12, so shipping is charged/);
  assert.match(blocked, /Orders over \$500 ship free when the rate is \$120 or less; this order is \$376\.60 below that/);
  assert.match(freeShippingNote(quote(60, 12), rules), /Orders over \$99 ship free when the rate is \$29\.95 or less; this order is \$39\.00 below that/);
  assert.equal(freeShippingNote(quote(249.68, 186.73), rules), "Free shipping on orders over $99 covers shipping rates up to $29.95; this order's rate is $186.73, so shipping is charged.");
  assert.equal(freeShippingNote({ ...quote(150, 20), cheapest: { title: "x", charged: 0 } }, rules), "Shipping is free on this order.");
});

test("fit ranking puts a poly mailer first for a hoodie and keeps the cheaper of rotated boxes", () => {
  const candidate = (sku, kind, dims, score) => ({ entry: { sku, kind, dims, flat: null, ect: 32, doubleWall: false, mil: null, colors: ["kraft"] }, fitKind: "box", clearancePerSide: [0.5], fitLabel: "ideal", strengthNote: null, strengthOk: true, billable: null, score });
  const priced = (c, unit, lb) => ({ candidate: c, item: { sku: c.entry.sku, unit_price: unit, price: unit * 25, in_stock: true }, value: 0, billable: { upsFedexLb: lb } });
  const mailer = { entry: { sku: "B876", kind: "poly_mailer", dims: null, flat: [19, 14.5], ect: null, doubleWall: false, mil: 2.5, colors: ["white"] }, fitKind: "flat", clearancePerSide: [0.5], fitLabel: "good", strengthNote: null, strengthOk: true, billable: null, score: 1 };
  const ranked = rankFits([priced(candidate("14124", "corrugated_box", [14, 12, 4], 3.9), 1.2, 8), priced(mailer, 0.253, 5)], 1.2, 3);
  assert.equal(ranked[0].candidate.entry.sku, "B876");
  const rotated = rankFits([priced(candidate("889", "corrugated_box", [9, 8, 8], 2), 0.934, 6), priced(candidate("988", "corrugated_box", [9, 8, 8], 2), 0.912, 6)], 1, 3);
  assert.deepEqual(rotated.map((p) => p.candidate.entry.sku), ["988"]);
});

test("exact sizes in the wrong style are labeled related, not exact", () => {
  const box = entryBySku("1084");
  const mailerBox = entryBySku("M1084");
  if (box && mailerBox) {
    assert.equal(refineMatch(box, "10x8x4 mailer box", "exact"), "related");
    assert.equal(refineMatch(mailerBox, "10x8x4 mailer box", "exact"), "exact");
    assert.equal(refineMatch(box, "10x8x4 boxes", "exact"), "exact");
  }
  const liner = catalogIndex().find((e) => /liners?/i.test(e.title) && e.family === "boxes" && e.dims);
  if (liner) assert.equal(refineMatch(liner, "12x12x12 shipping boxes", "exact"), "related");
});

test("custom and printed quote requests never carry a stock SKU; the spec carries quantity, ZIP and date", () => {
  for (const spec of ["5,000 custom printed mailer boxes", "boxes with our logo", "1-color print on 2 sides", "branded tape", "custom size 17x11x9 box"]) assert.ok(CUSTOM_WORK.test(spec), spec);
  for (const spec of ["4x6 thermal labels for a Zebra printer", "a pallet of 18x18x18 boxes every month", "customer returns bags", "truckload of stretch film"]) assert.ok(!CUSTOM_WORK.test(spec), spec);
  const composed = composeQuoteSpec({ requested_spec: "10x8x4 white mailer boxes, 1-color logo on lid", quantity: "5,000 per quarter", delivery_zip: "60601", needed_by: "Nov 15" });
  assert.equal(composed.spec, "10x8x4 white mailer boxes, 1-color logo on lid; qty 5,000 per quarter; ship to 60601; need by Nov 15");
  assert.equal(composed.shortened, false);
  const long = composeQuoteSpec({ requested_spec: "x".repeat(10) + " word ".repeat(60), quantity: "2,000", delivery_zip: "10001" });
  assert.ok(long.spec.length <= 220 && long.shortened && long.spec.endsWith("; qty 2,000; ship to 10001"));
});

test("detailed responses keep attribution on the calling assistant and drop removed-tool hints", () => {
  const out = sanitizeDetailed({ url: "https://packrift.com/products/x?utm_source=chatgpt&utm_medium=mcp", nested: [{ u: "https://packrift.com/?a=1&utm_source=chatgpt-mcp", handle: "eyJhbGciOiJIUzI1NiJ9.eyJjb2RlIjoieCJ9.sig", tracking: { utm_source: "chatgpt" } }], required_before_presenting: ["get_pricing"] }, "claude_code");
  assert.equal("handle" in out.nested[0], false);
  assert.equal(out.nested[0].tracking.utm_source, "claude");
  assert.equal(out.url, "https://packrift.com/products/x?utm_source=claude&utm_medium=mcp");
  assert.equal(out.nested[0].u, "https://packrift.com/?a=1&utm_source=claude");
  assert.equal("required_before_presenting" in out, false);
});

test("mojibake in catalog specs is repaired", () => {
  assert.equal(fixMojibake("9‚Ä≥ L  8‚Ä≥ W"), "9″ L  8″ W");
  assert.equal(fixMojibake("don‚Äôt 3‚Äì5 days √ó 2"), "don’t 3–5 days × 2");
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

test("the public product corpus carries no cost or margin fields", async () => {
  const { aiApprovedProductsJsonl } = await import("../dist/ai-corpus-content.js");
  assert.ok(!/current_margin|\bcogs\b|markup/i.test(aiApprovedProductsJsonl));
});
