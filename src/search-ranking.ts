// Shared relevance-ranking core for Packrift custom MCP search.
//
// WHY THIS EXISTS
// ---------------
// The original search_products scorer added a flat +20 for every query token
// that appeared anywhere in a product row. That made high-frequency generic
// modifiers ("mil", "free", "white", "case") count exactly as much as the
// product-defining nouns that actually discriminate a result ("nitrile",
// "gloves", "mailer"). For "4 mil accelerator free nitrile gloves" the catalog
// returned a "11 Mil ... Residue-Free" Gaffers TAPE first, because it matched
// the two generic tokens and nothing penalized that.
//
// THE FIX (see docs/SEARCH-RANKING.md)
//   1. IDF weighting  — a token's weight scales with how rare it is across the
//      approved catalog. Catalog-wide tokens ("mil" in 1,085 of 3,381 titles)
//      collapse to a near-zero weight; rare product nouns ("nitrile", absent
//      from the catalog) earn the maximum weight.
//   2. Low-signal cap — packaging-generic modifiers are additionally capped so
//      they can never dominate even if locally uncommon.
//   3. Field boost    — a token that matches in the product TITLE outranks the
//      same token matching only in the handle/sku/family slug.
//   4. Phrase/bigram  — adjacent query tokens that appear as a phrase in the
//      title ("nitrile gloves") earn a combined bonus.
//   5. Qualifying gate — a keyword (non-dimension) result is only surfaced if it
//      matched a discriminating token or a structural/family signal. A result
//      that matched ONLY low-signal modifiers no longer counts as relevant, so
//      generic tape stops being returned for a glove query.
//
// The dimension/SKU/handle/title/family bonuses are intentionally UNCHANGED, so
// exact-spec queries like "24x20x12 ECT-48 double wall boxes hand holes" keep
// returning the right box. This module only changes how loose query *tokens*
// are weighted and gated.

import { dimensionEvidence } from "./dimensions.js";
import { APPROVED_CATALOG } from "./effective-approved-catalog.js";

export const RANKING_VERSION = "strict-spec-evidence-v4-2026-09-23";

/** Conversational filler removed before tokenizing. */
export const STOP_WORDS = new Set([
  "find",
  "sku",
  "packrift",
  "product",
  "products",
  "like",
  "need",
  "around",
  "with",
  "for",
  "the",
  "and",
  "inch",
  "inches",
]);

// Packaging-generic modifiers. These describe HOW a product looks/ships but do
// not identify WHAT it is, so their weight is capped (see LOW_SIGNAL_CAP) and a
// row that matches ONLY these does not qualify as a keyword match. Product-type
// nouns (tape, box, mailer, label, glove, bag, envelope, ...) are deliberately
// NOT in this list — they are exactly the discriminating tokens we want to keep.
export const LOW_SIGNAL_MODIFIERS = new Set([
  "mil",
  "free",
  "white",
  "black",
  "clear",
  "brown",
  "blue",
  "red",
  "green",
  "yellow",
  "natural",
  "kraft",
  "heavy",
  "duty",
  "heavyduty",
  "lightweight",
  "case",
  "cases",
  "pack",
  "packs",
  "bundle",
  "bundles",
  "count",
  "ct",
  "roll",
  "rolls",
  "standard",
  "premium",
  "value",
  "economy",
  "bulk",
  "large",
  "small",
  "jumbo",
  "mini",
  "assorted",
  "color",
  "colored",
  "colour",
  "strength",
  "grade",
  "of",
  "per",
  "pcs",
  "pc",
  "piece",
  "pieces",
  "new",
  "pro",
  "plus",
  "ultra",
  "super",
]);

// Tuning constants. Magnitudes are chosen to sit alongside the existing
// structural bonuses (dim +300, family +50, sku/handle/title 500-1000) without
// disturbing the dimension gate (score >= 250) or analytics thresholds.
const TOKEN_BASE = 60; // weight of a maximally-rare (catalog-absent/unique) token
const LOW_SIGNAL_CAP = 6; // hard ceiling for a generic modifier token
const MIN_TOKEN_WEIGHT = 2; // floor so an in-catalog content token still counts
const TITLE_FIELD_BOOST = 1.25; // multiplier when the token matches in the title
const PHRASE_MULTIPLIER = 0.75; // bigram bonus = (w1 + w2) * this

// Spec-attribute bonuses/penalties (mil, gauge, inch width, yardage). A buyer
// asking for "6x18 4 mil" means the 4-mil SKU, not the 1.5-mil one; equal spec
// earns a bonus, an explicit conflicting spec earns a small penalty. The
// cumulative penalty is capped so an exact-dimension match (+300) can never be
// pushed below the DIMENSION_EXACT_MIN_SCORE gate (250) by spec mismatches.
const MIL_EXACT_BONUS = 120;
const MIL_MISMATCH_PENALTY = 40;
const GAUGE_EXACT_BONUS = 100;
const GAUGE_MISMATCH_PENALTY = 35;
const INCH_EXACT_BONUS = 60;
const INCH_MISMATCH_PENALTY = 20;
const YARD_EXACT_BONUS = 40;
const YARD_MISMATCH_PENALTY = 15;
const SPEC_PENALTY_CAP = 45; // 300 (dim) - 45 = 255 >= 250 exact gate
const USE_CASE_TOKEN_WEIGHT = 25; // per expansion token matched in the row
const USE_CASE_FAMILY_BONUS = 50; // row family preferred by the use-case

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchTokens(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function dimensionTokens(value: string): string[] {
  return dimensionEvidence(value).filter(record => record.valid && record.kind !== "roll").map(record => record.values.join("x"));
}

const DIMENSION_NUMBER = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|\\.\\d+)";
const DIMENSION_SEPARATOR = "\\s*(?:[x×]|\\bby\\b)\\s*";

/** A stated range is not a single exact dimension or numeric product attribute. */
function hasUnsupportedSpecRange(value: string): boolean {
  const range = `${DIMENSION_NUMBER}\\s*(?:[-–]|\\bto\\b)\\s*${DIMENSION_NUMBER}`;
  return new RegExp(`${range}\\s*(?:mil\\b|gauge\\b|ga\\b|yds?\\b|yards?\\b|ft\\b|feet\\b|foot\\b|inches\\b|inch\\b|in\\b|["\u2033]|${DIMENSION_SEPARATOR})`, "i").test(value);
}

const CATALOG_BY_SKU = new Map(APPROVED_CATALOG.map(row => [row.sku.trim().toLowerCase(), row]));
const CATALOG_ROWS = Object.freeze([...APPROVED_CATALOG]);
const CATALOG_ORDER = new Map(CATALOG_ROWS.map((row, index) => [row, index]));

/** Explicit SKU intent is an identity constraint, not an ordinary keyword. */
function requestedSku(query: string): string | null {
  const explicit = query.match(/(?:^|\s)sku\s*[:#]?\s+([a-z0-9][a-z0-9._/-]*)\b/i)
    ?? query.match(/(?:^|\s)sku\s*[:#]\s*([a-z0-9][a-z0-9._/-]*)\b/i);
  if (explicit) return explicit[1]!.toLowerCase();
  const trimmed = query.trim().toLowerCase();
  return CATALOG_BY_SKU.has(trimmed) ? trimmed : null;
}

/** Explicit sale-unit count only; "100 boxes" is an order quantity, not pack size. */
export function explicitPackCount(value: string): number | null {
  const text = value.toLowerCase();
  const after = text.match(/\b(\d+)\s*(?:-\s*|\/\s*|per\s+)?(?:pack|bundle|case)\b/);
  const before = text.match(/\b(?:packs?|bundles?|cases?)\s+of\s+(\d+)\b/);
  const count = Number(before?.[1] ?? after?.[1]);
  return Number.isInteger(count) && count > 0 ? count : null;
}

// Only parsed text is cached: no prices, inventory, eligibility decisions or
// output rows. Exact raw strings guard dynamic/hydrated rows against stale facts.
interface RowFeatures {
  sku: string; handle: string; title: string; family: string; aliases: string | undefined;
  dimensions?: ReturnType<typeof dimensionEvidence>;
  specs?: SpecAttributes;
  pack?: number | null;
  scoring?: {
    titleNorm: string; handleNorm: string; aliasPhrases: string[];
    rowTokens: string[]; titleTokens: string[]; rowDimensions?: Set<string>;
    exactSku?: RegExp; prefixedSku?: RegExp; skuNorm: string; numericSku: boolean;
  };
}
const ROW_FEATURES = new WeakMap<RankableRow, RowFeatures>();
function rowFeatures(row: RankableRow): RowFeatures {
  const cached = ROW_FEATURES.get(row);
  if (cached && cached.sku === row.sku && cached.handle === row.handle && cached.title === row.title
    && cached.family === row.family && cached.aliases === row.searchAliases) return cached;
  const next: RowFeatures = { sku: row.sku, handle: row.handle, title: row.title, family: row.family, aliases: row.searchAliases };
  ROW_FEATURES.set(row, next);
  return next;
}
function rowDimensionEvidence(row: RowFeatures) {
  if (!row.dimensions) {
    const title = dimensionEvidence(row.title).filter(record => record.kind !== "roll");
    row.dimensions = title.length ? title : dimensionEvidence(row.handle).filter(record => record.kind !== "roll");
  }
  return row.dimensions;
}
function rowSpecsForScoring(row: RowFeatures): SpecAttributes { return row.specs ??= parseSpecAttributes(row.title); }
function scoringFeatures(row: RankableRow, cached: RowFeatures) {
  if (cached.scoring) return cached.scoring;
  const skuNorm = normalizeText(row.sku);
  return cached.scoring = {
    titleNorm: normalizeText(row.title), handleNorm: normalizeText(row.handle),
    aliasPhrases: String(row.searchAliases ?? "").split("||").map(normalizeText).filter(Boolean),
    rowTokens: [...new Set(searchTokens(rowHaystack(row)))], titleTokens: [...new Set(searchTokens(row.title))],
    skuNorm, numericSku: /^\d+$/.test(skuNorm.replace(/\s+/g, "")),
  };
}
function matchesFeatureSku(features: NonNullable<RowFeatures["scoring"]>, query: string, hasDimensions: boolean): boolean {
  if (!features.skuNorm || !query.includes(features.skuNorm)) return false;
  // Most keyword queries contain no SKU at all. Compile identity regexes only
  // for possible literal matches instead of retaining two per catalog product.
  if (!features.exactSku) {
    const pattern = features.skuNorm.split(" ").filter(Boolean).map(escapeRegExp).join("\\s+");
    features.exactSku = new RegExp(`\\b${pattern}\\b`);
    features.prefixedSku = new RegExp(`\\bsku\\s+${pattern}\\b`);
  }
  return features.numericSku
    ? features.prefixedSku!.test(query) || (!hasDimensions && query === features.skuNorm)
    : features.exactSku.test(query) || features.prefixedSku!.test(query);
}
function buildCompiledQuery(query: string) {
  const evidence = dimensionEvidence(query);
  const required = evidence.filter(record => record.kind !== "roll");
  const queryNorm = normalizeText(query);
  const queryTokens = searchTokens(query);
  const specs = parseSpecAttributes(query);
  const finishValues = required.length ? [...query.toLowerCase().matchAll(/\b(kraft|white|clear|black)\b/g)].map(m => m[1]!) : [];
  const ect = required.length ? query.match(/\bect\s*[-#]?\s*(\d+)\b/i) || query.match(/\b(\d+)\s*[-#]?\s*ect\b/i) : null;
  return {
    queryNorm, queryTokens, specs, required, sku: requestedSku(query), pack: explicitPackCount(query),
    invalid: hasUnsupportedSpecRange(query) || evidence.some(record => !record.valid),
    dims: evidence.filter(record => record.valid && record.kind !== "roll").map(record => record.values.join("x")),
    finish: new Set(finishValues).size === 1 ? new RegExp(`\\b${finishValues[0]}\\b`, "i") : null,
    ect: ect ? new RegExp(`\\b(?:ect\\s*[-#]?\\s*${ect[1]}|${ect[1]}\\s*[-#]?\\s*ect)\\b`, "i") : null,
    hasSpecs: specs.mil !== null || specs.gauge !== null || specs.yards !== null || specs.feet !== null || specs.inches.length > 0,
    expansions: USE_CASE_EXPANSIONS.filter(expansion => expansion.trigger.test(queryNorm)),
    weights: new Map<string, number>(),
  };
}
type CompiledQuery = ReturnType<typeof buildCompiledQuery>;
const QUERY_FEATURES = new Map<string, CompiledQuery>();
function compiledQuery(query: string): CompiledQuery {
  const cached = QUERY_FEATURES.get(query);
  if (cached) { QUERY_FEATURES.delete(query); QUERY_FEATURES.set(query, cached); return cached; }
  const prepared = buildCompiledQuery(query);
  // Bound query retention by both count and length. Long queries still work.
  if (query.length <= 1000) {
    QUERY_FEATURES.set(query, prepared);
    if (QUERY_FEATURES.size > 32) QUERY_FEATURES.delete(QUERY_FEATURES.keys().next().value!);
  }
  return prepared;
}
function queryTokenWeight(query: CompiledQuery, token: string): number {
  let weight = query.weights.get(token);
  if (weight === undefined) { weight = tokenWeight(token); query.weights.set(token, weight); }
  return weight;
}
function matchesCompiledConstraints(query: CompiledQuery, row: RankableRow, cached: RowFeatures): boolean {
  if (query.sku && row.sku.trim().toLowerCase() !== query.sku) return false;
  if (query.invalid) return false;
  if (query.required.length) {
    const actual = rowDimensionEvidence(cached);
    if (query.required.some(wanted => !actual.some(candidate => candidate.valid
      && candidate.values.length === wanted.values.length
      && candidate.values.every((n, i) => Math.abs(n - wanted.values[i]!) < 1e-8)
      && (!wanted.unit || wanted.unit === candidate.unit)))) return false;
  }
  if (query.pack !== null) {
    if (cached.pack === undefined) cached.pack = explicitPackCount(row.title);
    if (cached.pack !== query.pack) return false;
  }
  if (query.hasSpecs) {
    const actual = rowSpecsForScoring(cached);
    for (const key of ["mil", "gauge", "yards", "feet"] as const) {
      if (query.specs[key] !== null && (actual[key] === null || !specEqual(query.specs[key]!, actual[key]!))) return false;
    }
    if (query.specs.inches.length && query.specs.inches.some(wanted => !actual.inches.some(value => specEqual(wanted, value)))) return false;
  }
  if (query.finish && !query.finish.test(row.title)) return false;
  if (query.ect && !query.ect.test(row.title)) return false;
  return true;
}
type CatalogItem = (typeof APPROVED_CATALOG)[number];
let CATALOG_DIMENSIONS: Map<string, readonly CatalogItem[]> | null = null;
/** Narrow only by necessary identity/tuple conditions; final constraints still run.
 * The bundled approved catalog is immutable for this Worker build. Live Shopify
 * rows are never indexed and are rechecked using their own current text. */
export function catalogSearchCandidates(query: string): readonly CatalogItem[] {
  const prepared = compiledQuery(query);
  if (prepared.invalid) return [];
  if (prepared.sku) {
    const item = CATALOG_BY_SKU.get(prepared.sku);
    return item ? [item] : [];
  }
  if (!prepared.required.length) return CATALOG_ROWS;
  // Bucket only ordinary 1–3 axis measurements. Adjacent buckets retain the
  // existing 1e-8 numeric tolerance instead of demanding identical float text.
  const scale = 1e7;
  if (prepared.required.some(record => record.values.length > 3 || record.values.some(value => !Number.isSafeInteger(Math.round(value * scale))))) return CATALOG_ROWS;
  if (!CATALOG_DIMENSIONS) {
    const index = new Map<string, CatalogItem[]>();
    for (const item of CATALOG_ROWS) {
      const keys = new Set(rowDimensionEvidence(rowFeatures(item)).filter(record => record.valid).map(record => record.values.map(value => Math.round(value * scale)).join("x")));
      for (const key of keys) {
        const rows = index.get(key) ?? [];
        rows.push(item); index.set(key, rows);
      }
    }
    CATALOG_DIMENSIONS = new Map([...index].map(([key, rows]) => [key, Object.freeze(rows)]));
  }
  let candidates: readonly CatalogItem[] | undefined;
  for (const wanted of prepared.required) {
    let keys: number[][] = [[]];
    for (const value of wanted.values) {
      const center = Math.round(value * scale);
      keys = keys.flatMap(prefix => [-1, 0, 1].map(delta => [...prefix, center + delta]));
    }
    const matches = new Set(keys.flatMap(key => CATALOG_DIMENSIONS!.get(key.join("x")) ?? []));
    if (!matches.size) return [];
    // Posting unions retain original catalog order, including equal-score ties.
    const rows = [...matches].sort((a, b) => CATALOG_ORDER.get(a)! - CATALOG_ORDER.get(b)!);
    if (!candidates || rows.length < candidates.length) candidates = rows;
  }
  return candidates ?? CATALOG_ROWS;
}

/** Required dimensions and explicit pack counts cannot be compensated by token scores. */
export function matchesRequiredSearchConstraints(query: string, row: RankableRow): boolean {
  return matchesCompiledConstraints(compiledQuery(query), row, rowFeatures(row));
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Spec-attribute extraction. Parsed from RAW text (before normalizeText) so
// inch marks (") survive. Yardage/gauge/mil use the unit token that follows
// the number; standalone inch widths exclude numbers that are the second/third
// member of a WxL dimension ("10x13\"" must not read as a 13-inch width) and
// numbers inside fractions ("3/16\"" must not read as 16 inches).
// ---------------------------------------------------------------------------

export interface SpecAttributes {
  mil: number | null;
  gauge: number | null;
  /** Standalone inch-denominated measurements (tape/film widths, bubble size). */
  inches: number[];
  yards: number | null;
  feet: number | null;
}

const MIL_RE = new RegExp(`(?<![\\d./-])(${DIMENSION_NUMBER})\\s*[-–]?\\s*mil\\b`);
const GAUGE_RE = new RegExp(`(?<![\\d./-])(${DIMENSION_NUMBER})\\s*[-–]?\\s*(?:ga|gauge)\\b`);
const YARD_RE = new RegExp(`(?<![\\d./-])(${DIMENSION_NUMBER})\\s*[-–]?\\s*(?:yds?|yards?)\\b`);
const FEET_RE = new RegExp(`(?<![\\d./-])(${DIMENSION_NUMBER})\\s*[-–]?\\s*(?:ft\\b|feet\\b|foot\\b|['′])`);
// Mixed/pure fractions with an explicit inch unit: `1 1/2"`, `3/16"`, `1/2 inch`.
const FRACTION_INCH_RE = /(?<![\d/.])(?:(\d+)\s+)?(\d+)\/(\d+)\s*(?:"|in\b|inch(?:es)?\b)/g;
// Plain numbers with an explicit inch unit, not preceded by x/digit/slash/dot
// (excludes WxL members and fraction denominators).
const PLAIN_INCH_RE = /(?<![\dx/.-])(\d+(?:\.\d+)?|\.\d+)\s*[-–]?\s*(?:"|in\b|inch(?:es)?\b)/g;

function specNumber(value: string): number {
  const fraction = value.trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  return fraction ? Number(fraction[1] || 0) + Number(fraction[2]) / Number(fraction[3]) : Number(value);
}

export function parseSpecAttributes(value: string): SpecAttributes {
  const text = String(value ?? "").toLowerCase();
  const mil = text.match(MIL_RE);
  const gauge = text.match(GAUGE_RE);
  const inches: number[] = [];
  const tupleSpans = dimensionEvidence(text).filter(record => record.valid && record.kind !== "roll" && record.start !== undefined);
  const widthText = text.split("").map((char, index) =>
    tupleSpans.some(span => index >= span.start! && index < span.end!) ? " " : char
  ).join("");
  const yards = widthText.match(YARD_RE);
  const feet = widthText.match(FEET_RE);
  for (const match of widthText.matchAll(FRACTION_INCH_RE)) {
    const whole = match[1] ? Number(match[1]) : 0;
    const num = Number(match[2]);
    const den = Number(match[3]);
    if (den > 0) inches.push(whole + num / den);
  }
  const fractionSpans: Array<{ start: number; end: number }> = [...widthText.matchAll(FRACTION_INCH_RE)].map((m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
  for (const match of widthText.matchAll(PLAIN_INCH_RE)) {
    const at = match.index ?? 0;
    if (fractionSpans.some((span) => at >= span.start && at < span.end)) continue;
    inches.push(Number(match[1]));
  }
  return {
    mil: mil ? specNumber(mil[1]!) : null,
    gauge: gauge ? specNumber(gauge[1]!) : null,
    inches,
    yards: yards ? specNumber(yards[1]!) : null,
    feet: feet ? specNumber(feet[1]!) : null,
  };
}

function specEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

// ---------------------------------------------------------------------------
// Use-case expansions. When a buyer describes WHAT they are shipping instead
// of the product type ("packaging for shipping t-shirts"), map the use-case
// noun to the product tokens/family that actually serve it. Kept small and
// high-conviction: expansions only add score, never filter.
// ---------------------------------------------------------------------------

interface UseCaseExpansion {
  trigger: RegExp;
  tokens: string[];
  families: string[];
}

export const USE_CASE_EXPANSIONS: UseCaseExpansion[] = [
  {
    // Apparel/soft goods ship in poly mailers.
    trigger: /\b(t[- ]?shirts?|shirts?|apparel|clothing|clothes|hoodies?|sweatshirts?|leggings?|garments?)\b/,
    tokens: ["poly", "mailers"],
    families: ["mailers"],
  },
  {
    // Fragile/breakable items need cushioning.
    trigger: /\b(fragile|glassware|dishes|ceramics?|breakables?|dinnerware)\b/,
    tokens: ["bubble", "foam", "cushioning"],
    families: ["void_fill"],
  },
];

export function queryIncludesSku(queryNorm: string, sku: string, hasDimensions: boolean): boolean {
  const skuNorm = normalizeText(sku);
  if (!skuNorm) return false;
  const skuPattern = skuNorm
    .split(" ")
    .filter(Boolean)
    .map((part) => escapeRegExp(part))
    .join("\\s+");
  if (!skuPattern) return false;
  const exactSku = new RegExp(`\\b${skuPattern}\\b`);
  const prefixedSku = new RegExp(`\\bsku\\s+${skuPattern}\\b`);
  const numericOnlySku = /^\d+$/.test(skuNorm.replace(/\s+/g, ""));
  if (numericOnlySku) return prefixedSku.test(queryNorm) || (!hasDimensions && queryNorm === skuNorm);
  return exactSku.test(queryNorm) || prefixedSku.test(queryNorm);
}

// ---------------------------------------------------------------------------
// IDF model — document frequency of each token across the approved catalog.
// Lazily built once. The corpus is the only "documents" the server controls;
// it is the right denominator for "how common is this token in our products".
// ---------------------------------------------------------------------------

let DOC_FREQ: Map<string, number> | null = null;
let CORPUS_SIZE = 0;
let MAX_IDF = 1;

interface CorpusItem {
  sku?: string;
  handle?: string;
  title?: string;
  family?: string;
  searchAliases?: string;
}

export function buildDocFrequency(corpus: ReadonlyArray<CorpusItem>): {
  docFreq: Map<string, number>;
  size: number;
} {
  const docFreq = new Map<string, number>();
  for (const item of corpus) {
    const tokens = new Set(
      searchTokens(`${item.sku ?? ""} ${item.handle ?? ""} ${item.title ?? ""} ${item.family ?? ""} ${item.searchAliases ?? ""}`)
    );
    for (const token of tokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }
  return { docFreq, size: corpus.length };
}

function ensureDocFrequency(): void {
  if (DOC_FREQ) return;
  const { docFreq, size } = buildDocFrequency(APPROVED_CATALOG);
  DOC_FREQ = docFreq;
  CORPUS_SIZE = size;
  MAX_IDF = Math.log((size + 1) / 1); // df = 0 -> token never seen in catalog
}

/** Smoothed inverse document frequency. Absent token => MAX_IDF (most rare). */
export function idf(token: string): number {
  ensureDocFrequency();
  const df = DOC_FREQ!.get(token) ?? 0;
  return Math.log((CORPUS_SIZE + 1) / (df + 1));
}

/**
 * Per-token weight: IDF normalized to [~0, TOKEN_BASE], with generic modifiers
 * hard-capped. A unique/absent token ~= 60; "mil" (1/3 of the catalog) ~= 6.
 */
export function tokenWeight(token: string): number {
  ensureDocFrequency();
  const normalized = idf(token) / MAX_IDF; // 0..1
  let weight = TOKEN_BASE * normalized;
  if (LOW_SIGNAL_MODIFIERS.has(token)) weight = Math.min(weight, LOW_SIGNAL_CAP);
  return Math.max(MIN_TOKEN_WEIGHT, Math.round(weight));
}

export interface RankableRow {
  sku: string;
  handle: string;
  title: string;
  family: string;
  searchAliases?: string;
}

export interface ScoredSignal {
  /** Total relevance score (higher is better). */
  score: number;
  /**
   * Whether this row should be surfaced for a KEYWORD (non-dimension) query.
   * True when the row matched a discriminating token, a structural signal
   * (sku/handle/title/dimension), or a family-category keyword. A row that
   * matched only low-signal modifiers is NOT qualified.
   */
  qualifies: boolean;
  /** A non-low-signal query token matched somewhere in the row. */
  matchedDiscriminating: boolean;
}

function rowHaystack(row: RankableRow): string {
  return `${row.sku} ${row.handle} ${row.title} ${row.family} ${row.searchAliases ?? ""}`;
}

/**
 * Core scorer shared by the Shopify result rows and the local catalog fallback.
 * Structural bonuses (sku/handle/title/dimension/family) match the original
 * scorer exactly; only the token contribution is IDF-weighted + phrase-aware.
 */
export function scoreRow(query: string, row: RankableRow): ScoredSignal {
  const prepared = compiledQuery(query);
  const cached = rowFeatures(row);
  if (!matchesCompiledConstraints(prepared, row, cached)) return { score: 0, qualifies: false, matchedDiscriminating: false };
  const { queryNorm, queryTokens, dims } = prepared;
  const features = scoringFeatures(row, cached);
  const { titleNorm, aliasPhrases, rowTokens, titleTokens } = features;

  let score = 0;
  let structural = false;

  if (matchesFeatureSku(features, queryNorm, dims.length > 0)) {
    score += 1000;
    structural = true;
  }
  if (row.handle && queryNorm.includes(features.handleNorm)) {
    score += 900;
    structural = true;
  }
  if (titleNorm && queryNorm === titleNorm) {
    score += 1000;
    structural = true;
  } else if (titleNorm && (queryNorm.includes(titleNorm) || titleNorm.includes(queryNorm))) {
    score += 500;
    structural = true;
  }
  // A manually approved exact buyer-query alias is an identity-level signal,
  // not merely another bag of tokens. The override set is small, reversible,
  // AI_APPROVE-only, and regression-tested against active experiment overlap.
  if (aliasPhrases.includes(queryNorm)) {
    score += 800;
    structural = true;
  }
  for (const dim of dims) {
    const rowDimensions = features.rowDimensions ??= new Set(rowDimensionEvidence(cached).filter(record => record.valid).map(record => record.values.join("x")));
    if (rowDimensions.has(dim)) {
      score += 300;
      structural = true;
    }
  }

  // IDF-weighted token contribution (replaces the old flat +20 per token).
  let matchedDiscriminating = false;
  for (const token of queryTokens) {
    if (!rowTokens.includes(token)) continue;
    let weight = queryTokenWeight(prepared, token);
    if (titleTokens.includes(token)) weight *= TITLE_FIELD_BOOST;
    score += weight;
    if (!LOW_SIGNAL_MODIFIERS.has(token)) matchedDiscriminating = true;
  }

  // Phrase / bigram bonus: adjacent query tokens appearing together in the
  // title. Both tokens must be discriminating — a low-signal token adjacent to
  // a heavy dimension token ("10x13 white") must not outweigh a product-noun
  // phrase ("poly mailers").
  for (let i = 0; i < queryTokens.length - 1; i += 1) {
    const first = queryTokens[i]!;
    const second = queryTokens[i + 1]!;
    if (LOW_SIGNAL_MODIFIERS.has(first) || LOW_SIGNAL_MODIFIERS.has(second)) continue;
    const bigram = `${first} ${second}`;
    if (titleNorm.includes(bigram)) {
      score += (queryTokenWeight(prepared, first) + queryTokenWeight(prepared, second)) * PHRASE_MULTIPLIER;
    }
  }

  // Spec-attribute matching (mil / gauge / inch width / yardage). A spec the
  // buyer stated explicitly is a hard product attribute: the exact-spec SKU
  // must outrank near-spec siblings. Penalties only apply when BOTH sides
  // state a value and they conflict, and are cumulative-capped so a true
  // dimension match can never fall below the exact gate.
  const querySpecs = prepared.specs;
  const rowSpecs = prepared.hasSpecs ? rowSpecsForScoring(cached) : querySpecs;
  let specPenalty = 0;
  if (querySpecs.mil !== null && rowSpecs.mil !== null) {
    if (specEqual(querySpecs.mil, rowSpecs.mil)) {
      score += MIL_EXACT_BONUS;
    } else {
      specPenalty += MIL_MISMATCH_PENALTY;
    }
  }
  if (querySpecs.gauge !== null && rowSpecs.gauge !== null) {
    if (specEqual(querySpecs.gauge, rowSpecs.gauge)) {
      score += GAUGE_EXACT_BONUS;
    } else {
      specPenalty += GAUGE_MISMATCH_PENALTY;
    }
  }
  if (querySpecs.inches.length === 1 && rowSpecs.inches.length > 0) {
    if (rowSpecs.inches.some((value) => specEqual(value, querySpecs.inches[0]!))) {
      score += INCH_EXACT_BONUS;
    } else {
      specPenalty += INCH_MISMATCH_PENALTY;
    }
  }
  if (querySpecs.yards !== null && rowSpecs.yards !== null) {
    if (specEqual(querySpecs.yards, rowSpecs.yards)) {
      score += YARD_EXACT_BONUS;
    } else {
      specPenalty += YARD_MISMATCH_PENALTY;
    }
  }
  score -= Math.min(specPenalty, SPEC_PENALTY_CAP);

  // Use-case expansion: "packaging for shipping t-shirts" boosts the product
  // tokens/family that serve the use-case, so category-correct rows surface
  // even when no direct product-noun token was typed.
  for (const expansion of prepared.expansions) {
    for (const token of expansion.tokens) {
      if (rowTokens.includes(token)) {
        score += USE_CASE_TOKEN_WEIGHT;
        matchedDiscriminating = true;
      }
    }
    if (expansion.families.includes(row.family)) {
      score += USE_CASE_FAMILY_BONUS;
      matchedDiscriminating = true;
    }
  }

  // Family-category keyword bonus (unchanged).
  let familyHit = false;
  if (/\bbox(?:es)?\b/.test(queryNorm) && row.family === "boxes") {
    score += 50;
    familyHit = true;
  }
  if (/\blabel(?:s)?\b/.test(queryNorm) && row.family === "labels") {
    score += 50;
    familyHit = true;
  }
  if (/\bmailer(?:s)?\b/.test(queryNorm) && row.family === "mailers") {
    score += 50;
    familyHit = true;
  }
  if (/\btape(?:s)?\b/.test(queryNorm) && row.family === "tape") {
    score += 50;
    familyHit = true;
  }
  if (/\bbag(?:s)?\b/.test(queryNorm) && row.family === "poly_bags") {
    score += 50;
    familyHit = true;
  }
  if (/\bstrapping\b|\bstrap(?:s)?\b/.test(queryNorm) && row.family === "strapping") {
    score += 50;
    familyHit = true;
  }
  if (/\btag(?:s)?\b/.test(queryNorm) && row.family === "tags") {
    score += 50;
    familyHit = true;
  }
  if (/\bvoid\s*fill\b|\bbubble\b|\bfoam\b|\bcushioning\b/.test(queryNorm) && row.family === "void_fill") {
    score += 50;
    familyHit = true;
  }
  if (/\bpacking\s*list\b/.test(queryNorm) && row.family === "packing_list_envelopes") {
    score += 50;
    familyHit = true;
  }

  const qualifies = score > 0 && (structural || familyHit || matchedDiscriminating);
  return { score: Math.round(score), qualifies, matchedDiscriminating };
}

/** Convenience: numeric score only (kept for analytics/back-compat callers). */
export function scoreRowValue(query: string, row: RankableRow): number {
  return scoreRow(query, row).score;
}

/** Minimum score for a dimension-bearing query to count as an exact candidate. */
export const DIMENSION_EXACT_MIN_SCORE = 250;
