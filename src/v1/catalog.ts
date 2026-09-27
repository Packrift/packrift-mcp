// In-memory index over the bundled approved catalog, built once per isolate.
// Titles carry the specs buyers search by (size, strength, thickness, pack
// count), so parsing them here lets the v1 tools answer fit and nearest-size
// questions without a Shopify round trip. Live price and stock are fetched
// separately, only for the handful of SKUs a response actually shows.

import { APPROVED_CATALOG, type EffectiveApprovedCatalogItem } from "../effective-approved-catalog.js";
import { parseDimensions } from "../dimensions.js";
import { isMcpCommerceHeldSku } from "../mcp-commerce-holds.js";

export type PackagingKind =
  | "corrugated_box"
  | "heavy_duty_box"
  | "mailer_box"
  | "poly_mailer"
  | "bubble_mailer"
  | "paper_mailer"
  | "mailing_tube"
  | "other";

export interface CatalogEntry {
  sku: string;
  handle: string;
  title: string;
  family: string;
  variantId: string;
  productId: string;
  kind: PackagingKind;
  /** Inside dimensions in inches, sorted largest first. Null when the title has no usable size. */
  dims: [number, number, number] | null;
  /** Flat width x length for mailers and bags, when the title gives only two dimensions. */
  flat: [number, number] | null;
  /** Units per pack, parsed from the title. Null when the title does not say. */
  pack: number | null;
  /** Edge crush test rating, e.g. 32 or 44. */
  ect: number | null;
  doubleWall: boolean;
  mil: number | null;
  sizeLabel: string | null;
  held: boolean;
  sensitive: boolean;
  /** Specialty packaging (insulated, metallic, anti-static, tamper-evident...). Offered only when asked for. */
  specialty: string | null;
  /** Colors named in the title, lowercase. */
  colors: string[];
}

const SPECIALTY = /\b(thermal|insulated|cold[- ]chain|metallic|holographic|glitter|foil|anti[- ]?static|static[- ]shielding|esd|conductive|vci|tamper[- ]evident|security|hazmat|un[- ]?certified|printed|custom|gift|display|jewelry|wine|pizza|pharmacy)\b/i;
const COLOR_WORDS = ["clear", "white", "black", "brown", "tan", "kraft", "blue", "red", "green", "yellow", "pink", "purple", "silver", "gold", "orange", "gray", "grey"] as const;

export function colorsIn(text: string): string[] {
  const lower = text.toLowerCase();
  return COLOR_WORDS.filter((color) => new RegExp(`\\b${color}\\b`).test(lower)).map((color) => (color === "grey" ? "gray" : color));
}

const SENSITIVE = /\b(hazmat|haz\s*mat|un\s*certified|fda|medical|food[-\s]*(?:safe|grade)|aircraft|anti[-\s]*static|vci|corrosion|conductive|esd)\b/i;
const NOT_A_SHIPPING_CONTAINER = /\b(bins?|inserts?|foam|totes?|displays?|folding cartons?|tuck|gift box(?:es)?|jewelry|paint cans?|jars?|bottles?|vials?|dividers?|partitions?|pads?|trays?|lids?|sleeves?|liners?|labels?|tags?|envelopes? only)\b/i;

export function classifyKind(title: string, family: string): PackagingKind {
  const t = title.toLowerCase();
  if (/\btubes?\b/.test(t) && /mail|ship|spiral|kraft/.test(t)) return "mailing_tube";
  if (/poly mailers?|poly bag mailers?|polyethylene mailers?/.test(t)) return "poly_mailer";
  if (/bubble mailers?|padded mailers?|bubble envelopes?|padded envelopes?|poly bubble/.test(t)) return "bubble_mailer";
  if (/rigid mailers?|stay[- ]flat|photo mailers?|kraft (?:paper )?mailers?|paperboard mailers?|expansion mailers?/.test(t) && !/corrugated/.test(t)) {
    return "paper_mailer";
  }
  if (family === "mailers" && /corrugated|literature|ect|mailer box/.test(t)) return "mailer_box";
  if (family === "boxes" && NOT_A_SHIPPING_CONTAINER.test(t)) return "other";
  if (family === "boxes" && /double[- ]wall|heavy[- ]duty|ect[- ]?(4[4-9]|[5-9]\d)|\b(275|350|400|500)#/.test(t)) return "heavy_duty_box";
  if (family === "boxes" && /corrugated|shipping box|ect|multi[- ]depth|moving box|carton/.test(t)) return "corrugated_box";
  if (family === "mailers" && /mailer/.test(t)) return "mailer_box";
  return "other";
}

const PACK_PATTERNS: RegExp[] = [
  /\b(?:case|bundle|pack|box|roll|carton|bag|set)\s*(?:of|\/)\s*(\d[\d,]*)\b/i,
  /\b(\d[\d,]*)\s*[- ]?(?:pack|pk|count|ct|bundle|pcs|pieces|sheets|labels|bags|rolls|tags|mailers|boxes|envelopes)\b/i,
  /\b(\d[\d,]*)\s*\/\s*(?:case|bundle|pack|roll|box|carton|bag)\b/i,
  /\b(\d[\d,]*)\s+per\s+(?:case|bundle|pack|roll|box|carton)\b/i,
  /\bcase\s+(\d[\d,]*)\b/i,
  /\b(\d[\d,]*)\s+case\b/i,
];

export function parsePackCount(title: string): number | null {
  for (const pattern of PACK_PATTERNS) {
    const match = title.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value >= 1 && value <= 1_000_000) return value;
    }
  }
  if (/\bsingle\b|\b1 roll\b|\beach\b/i.test(title)) return 1;
  return null;
}

export function parseEct(title: string): number | null {
  const match = title.match(/\bECT[- ]?(\d{2})\b|\b(\d{2})\s*ECT\b/i);
  const value = Number(match?.[1] ?? match?.[2]);
  return Number.isFinite(value) && value >= 20 && value <= 120 ? value : null;
}

export function parseMil(title: string): number | null {
  const match = title.match(/\b(\d+(?:\.\d+)?)\s*mil\b/i);
  const value = Number(match?.[1]);
  return Number.isFinite(value) && value > 0 && value < 50 ? value : null;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

function buildEntry(item: EffectiveApprovedCatalogItem): CatalogEntry {
  const parsed = parseDimensions(item.title);
  const kind = classifyKind(item.title, item.family);
  let dims: [number, number, number] | null = null;
  let flat: [number, number] | null = null;
  if (parsed) {
    if (parsed.depth_in !== null) {
      const sorted = [parsed.length_in, parsed.width_in, parsed.depth_in].sort((a, b) => b - a);
      dims = [sorted[0]!, sorted[1]!, sorted[2]!];
    } else {
      const sorted = [parsed.length_in, parsed.width_in].sort((a, b) => b - a);
      flat = [sorted[0]!, sorted[1]!];
    }
  }
  const sizeLabel = parsed
    ? parsed.depth_in !== null
      ? `${fmt(parsed.length_in)} x ${fmt(parsed.width_in)} x ${fmt(parsed.depth_in)} in`
      : `${fmt(parsed.length_in)} x ${fmt(parsed.width_in)} in`
    : null;
  return {
    sku: item.sku,
    handle: item.handle,
    title: item.title,
    family: item.family,
    variantId: item.variantId,
    productId: item.productId,
    kind,
    dims,
    flat,
    pack: parsePackCount(item.title),
    ect: parseEct(item.title),
    doubleWall: /double[- ]wall/i.test(item.title),
    mil: parseMil(item.title),
    sizeLabel,
    held: isMcpCommerceHeldSku(item.sku),
    sensitive: SENSITIVE.test(item.title),
    specialty: item.title.match(SPECIALTY)?.[1]?.toLowerCase() ?? null,
    colors: colorsIn(item.title),
  };
}

let INDEX: CatalogEntry[] | null = null;
let BY_SKU: Map<string, CatalogEntry> | null = null;
let BY_HANDLE: Map<string, CatalogEntry> | null = null;
let BY_VARIANT: Map<string, CatalogEntry> | null = null;

export function catalogIndex(): CatalogEntry[] {
  if (!INDEX) {
    INDEX = APPROVED_CATALOG.map(buildEntry);
    BY_SKU = new Map(INDEX.map((entry) => [entry.sku.toUpperCase(), entry]));
    BY_HANDLE = new Map(INDEX.map((entry) => [entry.handle, entry]));
    BY_VARIANT = new Map(INDEX.map((entry) => [entry.variantId, entry]));
  }
  return INDEX;
}

export function entryBySku(sku: string | null | undefined): CatalogEntry | null {
  if (!sku) return null;
  catalogIndex();
  return BY_SKU!.get(sku.trim().toUpperCase()) ?? null;
}

export function entryByHandle(handle: string | null | undefined): CatalogEntry | null {
  if (!handle) return null;
  catalogIndex();
  return BY_HANDLE!.get(handle.trim()) ?? null;
}

export function entryByVariantId(variantId: string | null | undefined): CatalogEntry | null {
  if (!variantId) return null;
  const numeric = String(variantId).match(/(\d+)$/)?.[1];
  if (!numeric) return null;
  catalogIndex();
  return BY_VARIANT!.get(numeric) ?? null;
}

/** Maximum gross weight for single- and double-wall corrugated by ECT, per the standard box maker's certificate table. */
export function maxWeightForEct(ect: number | null, doubleWall: boolean): number | null {
  if (!ect) return null;
  const single: Array<[number, number]> = [
    [23, 20], [26, 35], [29, 50], [32, 65], [40, 80], [44, 95], [55, 120],
  ];
  const double: Array<[number, number]> = [
    [42, 80], [48, 100], [51, 120], [61, 140], [71, 160], [82, 180],
  ];
  const table = doubleWall || ect >= 48 ? double : single;
  let best: number | null = null;
  for (const [rating, limit] of table) if (ect >= rating) best = limit;
  return best ?? table[0]![1];
}

/** Human label for a packaging kind, used in concise results. */
export function kindLabel(kind: PackagingKind): string {
  switch (kind) {
    case "corrugated_box":
      return "corrugated box";
    case "heavy_duty_box":
      return "heavy-duty box";
    case "mailer_box":
      return "corrugated mailer";
    case "poly_mailer":
      return "poly mailer";
    case "bubble_mailer":
      return "bubble mailer";
    case "paper_mailer":
      return "paper mailer";
    case "mailing_tube":
      return "mailing tube";
    default:
      return "packaging";
  }
}
