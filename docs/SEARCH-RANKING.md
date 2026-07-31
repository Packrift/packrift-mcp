# search_products relevance ranking

Last updated: 2026-06-08

## The problem (2026-06-03 agentic catalog audit)

The custom MCP (`mcp.packrift.com`) over-weighted high-frequency generic tokens.

- Query **`4 mil accelerator free nitrile gloves`** returned an irrelevant
  **Gaffers tape** first, because the scorer rewarded the generic tokens `mil`
  and `free` exactly as much as the product-defining nouns `nitrile`/`gloves`.
- By contrast Shopify-native UCP (`/api/mcp`) found the correct nitrile glove for
  the same query (but serves thin product data).
- The custom MCP already handled exact box queries well — e.g.
  **`24x20x12 ECT-48 double wall boxes hand holes`** returns the right box — so
  the fix had to **not regress dimension/spec queries**.

### Root cause

`scoreSearchRow` (and the catalog-fallback / summary scorers) added a **flat
`+20` for every query token** that appeared anywhere in a product row:

```ts
for (const token of tokens) {
  if (rowTokens.has(token)) score += 20;   // mil == nitrile == gloves == free
}
```

`mil` appears in **1,085 of 3,381** approved titles and `free` in many; `nitrile`
appears in **none**. A tape matching `mil`+`free` scored 40 and outranked
everything, while the discriminating nouns carried no extra weight.

## The fix

All token-level relevance now lives in **`src/search-ranking.ts`** (pure,
dependency-light, unit-tested). `search_products.ts` delegates to it. The
**structural bonuses are unchanged** — only how loose query *tokens* are weighted
and gated changed.

| # | Change | Effect |
|---|--------|--------|
| 1 | **IDF weighting** | Token weight scales with rarity across the approved catalog. `tokenWeight ≈ 60 · idf(token)/maxIdf`. Catalog-wide tokens collapse toward 0; rare product nouns earn up to ~60. `mil` → **6**, `free` → **~3**, `nitrile`/`gloves` (absent → max idf) → **~60**. |
| 2 | **Low-signal cap** | Packaging-generic modifiers (`mil`, `free`, `white`, `case`, `pack`, `heavy`, `duty`, colors, …) are hard-capped at 6 even if locally uncommon. Product-type nouns (tape, box, mailer, label, glove, …) are deliberately **not** in this list. |
| 3 | **Field boost** | A token matching in the product **title** is multiplied by `1.25` over the same token matching only in the handle/sku/family slug. |
| 4 | **Phrase / bigram** | Adjacent query tokens that appear as a phrase in the title (`nitrile gloves`) earn a combined bonus `(w1+w2)·0.75`. |
| 5 | **Qualifying gate** | A **keyword** (non-dimension) result is surfaced only if it matched a *discriminating* token, a structural signal (sku/handle/title/dimension), or a family-category keyword. A row that matched **only** low-signal modifiers no longer qualifies — so generic tape stops being returned for a glove query and the request safe-fails into `explain_no_exact_match`. |

Dimension queries are untouched by the gate: they keep the existing
`score >= 250` exact-candidate filter (a single dimension match is `+300`).

### Scoring (unchanged structural bonuses)

| Signal | Points |
|--------|-------:|
| SKU match | +1000 |
| Handle substring | +900 |
| Exact title | +1000 |
| Title substring (either direction) | +500 |
| Each dimension token match (e.g. `24x20x12`) | +300 |
| Family-category keyword (box/label/mailer) | +50 |
| **Per query token (NEW)** | **IDF-weighted ≈ 2–75, was flat +20** |
| **Title phrase / bigram (NEW)** | **`(w1+w2)·0.75`** |

## Before / after (real approved catalog, offline)

Run `npm run build && node scripts/eval-search-ranking.mjs`.

```
=== "4 mil accelerator free nitrile gloves" ===
  BEFORE:  40  tape    3" x 60 yds. 11 Mil Olive Green Gaffers Tape - Residue-Free, 3-Pack   ← wrong
  AFTER:   (no qualifying match -> routes to explain_no_exact_match / bulk quote)             ← correct safe-fail
           (a real nitrile glove, when AI_APPROVE'd, ranks #1 — see test suite)

=== "24x20x12 ECT-48 double wall boxes hand holes" ===
  BEFORE: 470  boxes   24x20x12 ECT-48 Double Wall Corrugated Boxes ...   ← right
  AFTER:  725  boxes   24x20x12 ECT-48 Double Wall Corrugated Boxes ...   ← right, wider margin
```

> Note: the bundled `src/approved-catalog.ts` is a 2026-05-20 snapshot that
> contains **zero** glove SKUs. The live server filters the full Shopify catalog
> through the AI_APPROVE gate at request time. After this fix, the live behavior
> for the glove query is: return the real nitrile glove #1 **if** it is
> AI_APPROVE'd, otherwise safe-fail to `explain_no_exact_match`. Either is
> correct — the previous "irrelevant tape first" outcome is eliminated in both.

## Tests

`node --test scripts/test-search-ranking.mjs` (run `npm run build` first). 11
cases, including: IDF separation, glove-vs-tape discrimination (with a synthetic
glove so the logic is catalog-independent), the generic-only no-qualify gate, the
exact box staying rank 1 + clearing the 250 gate, and category/SKU keyword
queries still returning.

## Scope / not changed

- Read-only: no catalog, Shopify, or network writes.
- Only `search_products` is wired to the shared module. `find_packaging_for_item`,
  `pack_calculator`, and `compare_alternatives` keep their own scoring; they
  could adopt `search-ranking.ts` later.
- Deployed live 2026-06-08 (worker b63a1e55); re-landed with the 0.3.0 directory
  surface cleanup on 2026-07-31.
