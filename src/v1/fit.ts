// Fit engine for find_packaging_for_item. Pure functions over the catalog
// index: no network, so ranking is fast and testable. Live price and stock are
// joined afterwards for the few candidates that are returned.

import { catalogIndex, maxSizeForEct, maxWeightForEct, type CatalogEntry, type PackagingKind } from "./catalog.js";

export type UseCase = "general" | "fragile" | "electronics" | "apparel" | "books" | "heavy";
export type PackagingPreference = "any" | "box" | "mailer";

export interface FitRequest {
  length: number;
  width: number;
  height: number;
  weightLb: number;
  useCase: UseCase;
  packaging: PackagingPreference;
  limit: number;
  /** The buyer's own words, used to opt in to specialty packaging such as insulated mailers. */
  requestText?: string;
}

interface Profile {
  /** Minimum clearance per side inside a box, in inches. */
  minSide: number;
  /** Ideal clearance per side; candidates are ranked by closeness to it. */
  idealSide: number;
  /** Largest clearance per side before a box counts as too roomy. */
  maxSide: number;
  allowBoxes: boolean;
  allowMailerBoxes: boolean;
  allowFlatMailers: boolean;
  allowTubes: boolean;
  advice: string;
}

const PROFILES: Record<UseCase, Profile> = {
  general: {
    minSide: 0.25, idealSide: 0.5, maxSide: 2, allowBoxes: true, allowMailerBoxes: true, allowFlatMailers: true, allowTubes: true,
    advice: "Leave about 1/2 in per side and fill gaps so the item cannot shift.",
  },
  fragile: {
    minSide: 2, idealSide: 2, maxSide: 3.5, allowBoxes: true, allowMailerBoxes: false, allowFlatMailers: false, allowTubes: false,
    advice: "Wrap the item and keep 2 in of cushioning (bubble wrap, foam or crumpled paper) on every side; for very delicate items, box it, then pack that box inside a larger one.",
  },
  electronics: {
    minSide: 1, idealSide: 1.5, maxSide: 3, allowBoxes: true, allowMailerBoxes: true, allowFlatMailers: false, allowTubes: false,
    advice: "Keep about 1 to 2 in of cushioning on every side and use an anti-static bag for bare boards.",
  },
  apparel: {
    minSide: 0.125, idealSide: 0.5, maxSide: 2.5, allowBoxes: true, allowMailerBoxes: true, allowFlatMailers: true, allowTubes: false,
    advice: "Folded soft goods ship well in a poly mailer; use a box only if presentation matters or the item is bulky.",
  },
  books: {
    minSide: 0.125, idealSide: 0.375, maxSide: 1.5, allowBoxes: true, allowMailerBoxes: true, allowFlatMailers: true, allowTubes: false,
    advice: "Protect corners: a snug corrugated mailer or bubble mailer keeps books from sliding and denting.",
  },
  heavy: {
    minSide: 0.5, idealSide: 1, maxSide: 2.5, allowBoxes: true, allowMailerBoxes: false, allowFlatMailers: false, allowTubes: false,
    advice: "Use a box rated for the weight, tape every seam with an H pattern, and fill voids so the load cannot shift.",
  },
};

const BOX_KINDS: PackagingKind[] = ["corrugated_box", "heavy_duty_box"];
const FLAT_KINDS: PackagingKind[] = ["poly_mailer", "bubble_mailer", "paper_mailer"];
const MAX_FLAT_THICKNESS: Partial<Record<PackagingKind, number>> = { poly_mailer: 4, bubble_mailer: 2.5, paper_mailer: 1 };

export function coerceFitUseCase(value: unknown, weightLb: number): UseCase {
  const text = String(value ?? "").trim().toLowerCase();
  let useCase: UseCase = "general";
  if (/\b(fragile|glass(?:ware|es)?|ceramics?|breakables?|dish(?:es)?|dinnerware|delicate|mugs?|porcelain|china|candles?|pottery|wine|bottles?|art(?:work)?|frames?|mirrors?)\b/.test(text)) useCase = "fragile";
  else if (/\b(electronics?|devices?|laptops?|phones?|tablets?|cameras?|circuit|boards?|gadgets?|hardware|computer)\b/.test(text)) useCase = "electronics";
  else if (/\b(apparel|cloth(?:ing|es)?|t?-?shirts?|garments?|hoodies?|dress(?:es)?|jeans|leggings?|textiles?|fabrics?|socks?|soft goods?|linens?|towels?)\b/.test(text)) useCase = "apparel";
  else if (/\b(books?|documents?|papers?|prints?|photos?|flat|catalogs?|magazines?|records?|vinyl)\b/.test(text)) useCase = "books";
  else if (/\b(heavy|parts?|tools?|machinery|metal|auto(?:motive)?|bulk)\b/.test(text)) useCase = "heavy";
  else if (text === "fragile" || text === "apparel" || text === "books" || text === "electronics" || text === "heavy") useCase = text as UseCase;
  if (weightLb > 30 && useCase === "general") useCase = "heavy";
  return useCase;
}

export interface BillableWeight {
  upsFedexLb: number;
  uspsLb: number;
  dimensionalApplies: boolean;
}

/**
 * Billable weight for a package: carriers round each side up to the next inch and divide by 139.
 * UPS and FedEx apply it to every package; USPS only above one cubic foot (1,728 cubic inches),
 * using the 139 divisor since July 12, 2026. Actual weight rounds up to the next pound.
 */
export function billableWeight(outer: [number, number, number], actualLb: number): BillableWeight {
  const [l, w, h] = outer.map((n) => Math.ceil(n - 1e-9));
  const cubic = l! * w! * h!;
  const actual = Math.max(1, Math.ceil(actualLb - 1e-9));
  const upsFedexDim = Math.ceil(cubic / 139 - 1e-9);
  const uspsDim = cubic > 1728 ? Math.ceil(cubic / 139 - 1e-9) : 0;
  const upsFedexLb = Math.max(actual, upsFedexDim);
  const uspsLb = Math.max(actual, uspsDim);
  return { upsFedexLb, uspsLb, dimensionalApplies: upsFedexLb > actual || uspsLb > actual };
}

/** Outside size of the packed shipment: boxes add about 1/4 in; a filled mailer wraps the item. */
export function packedSize(candidate: FitCandidate, item: [number, number, number]): [number, number, number] {
  const entry = candidate.entry;
  if (candidate.fitKind === "box" && entry.dims) return [entry.dims[0] + 0.25, entry.dims[1] + 0.25, entry.dims[2] + 0.25];
  if (candidate.fitKind === "flat" && entry.flat) {
    // A filled mailer wraps around the item: its footprint shrinks by about the item's thickness.
    const [long, mid, thin] = item;
    return [Math.max(long, entry.flat[0] - thin), Math.max(mid, entry.flat[1] - thin), Math.max(thin + 0.25, 0.5)];
  }
  if (entry.flat) return [entry.flat[0], entry.flat[1], entry.flat[1]];
  return [item[0], item[1], item[2]];
}

/** Extra packing weight beyond the item and the container: cushioning for fragile goods and electronics. */
export function cushioningLb(useCase: UseCase, candidate: FitCandidate): number {
  if (candidate.fitKind !== "box") return 0;
  if (useCase === "fragile") return 0.25;
  if (useCase === "electronics") return 0.15;
  return 0.05;
}

export interface FitCandidate {
  entry: CatalogEntry;
  fitKind: "box" | "flat" | "tube";
  clearancePerSide: number[];
  /** ideal: close to the recommended space on every side; tight: at least one side below it; roomy: extra space to fill. */
  fitLabel: "ideal" | "good" | "tight" | "roomy";
  strengthNote: string | null;
  strengthOk: boolean;
  billable: BillableWeight | null;
  score: number;
}

function sortDesc(values: number[]): number[] {
  return [...values].sort((a, b) => b - a);
}

function strength(entry: CatalogEntry, weightLb: number): { note: string | null; ok: boolean } {
  const limit = maxWeightForEct(entry.ect, entry.doubleWall);
  if (!entry.ect || limit === null) {
    return { note: null, ok: weightLb <= 40 || entry.kind === "heavy_duty_box" };
  }
  const wall = entry.doubleWall || entry.ect >= 48 ? "double wall" : "single wall";
  const sizeLimit = maxSizeForEct(entry.ect, entry.doubleWall);
  const outside = entry.dims ? entry.dims.reduce((sum, n) => sum + n + 0.25, 0) : 0;
  const oversize = sizeLimit !== null && outside > sizeLimit + 1e-6;
  const note = `ECT-${entry.ect} ${wall}, rated to ${limit} lb${oversize ? ` (larger than the ${sizeLimit} in length + width + height this rating covers; choose a stronger board for heavy loads)` : ""}`;
  return { note, ok: weightLb <= limit && !(oversize && weightLb > limit * 0.5) };
}

function boxCandidate(entry: CatalogEntry, item: number[], req: FitRequest, profile: Profile): FitCandidate | null {
  if (!entry.dims) return null;
  const inside = entry.dims;
  const clearance = inside.map((d, i) => (d - item[i]!) / 2);
  if (clearance.some((c) => c < profile.minSide - 1e-6)) return null;
  if (clearance.some((c) => c > profile.maxSide + 1e-6)) return null;
  const { note, ok } = strength(entry, req.weightLb);
  const deviation = clearance.reduce((sum, c) => sum + Math.abs(c - profile.idealSide), 0);
  const volumeRatio = (inside[0]! * inside[1]! * inside[2]!) / Math.max(1e-6, item[0]! * item[1]! * item[2]!);
  const outer: [number, number, number] = [inside[0]! + 0.25, inside[1]! + 0.25, inside[2]! + 0.25];
  const billable = billableWeight(outer, req.weightLb);
  let score = deviation * 4 + Math.log(volumeRatio) * 6 + billable.upsFedexLb * 0.15;
  if (!ok) score += 1000;
  if (entry.kind === "mailer_box" && req.useCase === "heavy") score += 50;
  if (entry.kind === "heavy_duty_box" && req.weightLb < 20) score += 5;
  const maxClear = Math.max(...clearance);
  const minClear = Math.min(...clearance);
  const fitLabel: FitCandidate["fitLabel"] =
    minClear < profile.idealSide - 0.25 - 1e-6 ? "tight" : maxClear > profile.idealSide + 1 + 1e-6 ? "roomy" : maxClear <= profile.idealSide + 0.5 + 1e-6 ? "ideal" : "good";
  return { entry, fitKind: "box", clearancePerSide: clearance.map((c) => round3(c)), fitLabel, strengthNote: note, strengthOk: ok, billable, score };
}

function flatCandidate(entry: CatalogEntry, item: number[], req: FitRequest): FitCandidate | null {
  const maxThickness = MAX_FLAT_THICKNESS[entry.kind];
  if (!entry.flat || maxThickness === undefined) return null;
  const [mailLong, mailShort] = entry.flat;
  const [itemLong, itemMid, itemThin] = item as [number, number, number];
  if (itemThin > maxThickness) return null;
  if (req.weightLb > 10) return null;
  const needShort = itemMid + itemThin + 0.5;
  const needLong = itemLong + itemThin + 1;
  if (mailShort < needShort || mailLong < needLong) return null;
  const slack = mailShort - needShort + (mailLong - needLong);
  if (slack > 8) return null;
  let score = slack * 2 + (entry.kind === "poly_mailer" && req.useCase === "apparel" ? -3 : 0) + (entry.kind === "paper_mailer" && req.useCase === "books" ? -2 : 0);
  // Books need their corners protected: padded or rigid mailers before plain poly.
  if (req.useCase === "books") score += entry.kind === "poly_mailer" ? 2 : entry.kind === "bubble_mailer" ? -1 : 0;
  // An unknown item that is more than 2 in thick is usually better protected in a box.
  if (req.useCase === "general") score += itemThin > 2 ? 10 : 2;
  const fitLabel: FitCandidate["fitLabel"] = slack <= 1.5 ? "ideal" : slack <= 4 ? "good" : "roomy";
  const filled: [number, number, number] = [Math.max(itemLong, mailLong - itemThin), Math.max(itemMid, mailShort - itemThin), Math.max(itemThin + 0.25, 0.5)];
  const billable = billableWeight(filled, req.weightLb);
  return {
    entry,
    fitKind: "flat",
    clearancePerSide: [round3((mailShort - itemMid - itemThin) / 2), round3((mailLong - itemLong - itemThin) / 2)],
    fitLabel,
    strengthNote: null,
    strengthOk: true,
    billable,
    score,
  };
}

function tubeCandidate(entry: CatalogEntry, item: number[], req: FitRequest): FitCandidate | null {
  if (entry.kind !== "mailing_tube" || !entry.flat) return null;
  const [itemLong, itemMid, itemThin] = item as [number, number, number];
  if (itemLong < itemMid * 3 || req.weightLb > 15) return null;
  const [tubeLength, diameter] = entry.flat;
  const crossSection = Math.hypot(itemMid, itemThin);
  if (diameter < crossSection + 0.125 || tubeLength < itemLong + 0.5) return null;
  const slack = diameter - crossSection + (tubeLength - itemLong) / 4;
  if (slack > 6) return null;
  return {
    entry,
    fitKind: "tube",
    clearancePerSide: [round3((diameter - crossSection) / 2), round3((tubeLength - itemLong) / 2)],
    fitLabel: slack <= 1.5 ? "ideal" : slack <= 3 ? "good" : "roomy",
    strengthNote: null,
    strengthOk: true,
    billable: billableWeight([tubeLength, diameter, diameter], req.weightLb),
    score: slack * 2,
  };
}

export interface FitResult {
  useCase: UseCase;
  requiredInside: [number, number, number];
  advice: string;
  candidates: FitCandidate[];
  tooHeavyForParcel: boolean;
}

export function findFits(req: FitRequest): FitResult {
  const profile = PROFILES[req.useCase];
  const item = sortDesc([req.length, req.width, req.height]);
  const requiredInside: [number, number, number] = [
    round3(item[0]! + profile.minSide * 2),
    round3(item[1]! + profile.minSide * 2),
    round3(item[2]! + profile.minSide * 2),
  ];
  const wantBoxes = req.packaging !== "mailer";
  const wantMailers = req.packaging !== "box";
  const candidates: FitCandidate[] = [];
  const requestText = (req.requestText ?? "").toLowerCase();
  for (const entry of catalogIndex()) {
    if (entry.held || entry.sensitive) continue;
    if (entry.specialty && !requestText.includes(entry.specialty.split(/[- ]/)[0]!)) continue;
    let candidate: FitCandidate | null = null;
    if (BOX_KINDS.includes(entry.kind)) {
      if (wantBoxes && profile.allowBoxes) candidate = boxCandidate(entry, item, req, profile);
    } else if (entry.kind === "mailer_box") {
      if (wantMailers && profile.allowMailerBoxes) candidate = boxCandidate(entry, item, req, profile);
    } else if (FLAT_KINDS.includes(entry.kind)) {
      if (wantMailers && profile.allowFlatMailers) candidate = flatCandidate(entry, item, req);
    } else if (entry.kind === "mailing_tube") {
      if (profile.allowTubes) candidate = tubeCandidate(entry, item, req);
    }
    if (candidate && candidate.strengthOk) candidates.push(candidate);
  }
  candidates.sort((a, b) => a.score - b.score || a.entry.sku.localeCompare(b.entry.sku));
  const limit = Math.max(1, Math.min(req.limit, 5));
  // Keep the list varied. The same size listed in a different orientation (9x8x8 and 8x8x9) is
  // kept here so the tool layer can choose the cheaper one once live prices are known.
  const seen = new Map<string, number>();
  const picked: FitCandidate[] = [];
  for (const candidate of candidates) {
    const key = sizeKey(candidate.entry);
    const count = seen.get(key) ?? 0;
    if (count >= 3) continue;
    seen.set(key, count + 1);
    picked.push(candidate);
    if (picked.length >= limit * 5) break;
  }
  return {
    useCase: req.useCase,
    requiredInside,
    advice: profile.advice,
    candidates: picked,
    tooHeavyForParcel: req.weightLb > 150,
  };
}

/**
 * Orientation-free identity of a size: packaging kind and sorted dimensions. Fit results show one
 * product per size (the best value); color, pack count and thickness variants are one search away.
 */
export function sizeKey(entry: CatalogEntry): string {
  const size = entry.dims ?? entry.flat ?? [];
  return [entry.kind, size.map((n) => n.toFixed(3)).join("x")].join("|");
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
