// Dimension parsing utilities for Packrift product spec strings.
// Spec strings come in many forms: `12 1/8" L x 11 5/8" W x 2 5/8" H`,
// `3" W x 4.5" H`, `10 x 8 x 4 in`, etc. Also fall back to title parsing.

export interface Dimensions {
  length_in: number;
  width_in: number;
  depth_in: number | null;
  raw: string;
}

const DIMENSION_NUMBER = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|\\.\\d+)";
const DIMENSION_UNIT = '(?:gauge|ga|mil|mm|millimet(?:er|re)s?|cm|centimet(?:er|re)s?|inches|inch|in|ft|feet|foot|yds?|yards?|m|met(?:er|re)s?)\\b\\.?|["\u2033\'\u2032]';
const DIMENSION_SEPARATOR = "\\s*(?:[x×]|\\bby\\b)\\s*";
export interface DimensionEvidence { values: number[]; unit: string; valid: boolean; kind?: "roll"; start?: number; end?: number }
export function dimensionEvidence(value: string): DimensionEvidence[] {
  const invalid: DimensionEvidence = { values: [], unit: "", valid: false };
  const range = `${DIMENSION_NUMBER}\\s*(?:[-–]|\\bto\\b)\\s*${DIMENSION_NUMBER}`;
  if (new RegExp(`${range}(?:\\s*(?:${DIMENSION_UNIT}))?${DIMENSION_SEPARATOR}`, "i").test(value)) return [invalid];
  const axis = `${DIMENSION_NUMBER}(?:\\s*(?:${DIMENSION_UNIT}))?(?:\\s*[LWHD]\\b)?`;
  const pattern = new RegExp(`(?<![\\w./-])${axis}(?:${DIMENSION_SEPARATOR}${axis})+(?![\\w./])`, "gi");
  const records: DimensionEvidence[] = [...value.matchAll(pattern)].filter(match =>
    !/(?:^|[\s\d"'′″])(?:[x×]|\bby)\s*$/i.test(value.slice(0, match.index))
  ).map((match) => {
    const units: string[] = [];
    const values = match[0]!.split(/\s*(?:[x×]|\bby\b)\s*/i).map((part) => {
      const numeric = part.match(new RegExp(`^(${DIMENSION_NUMBER})`))!;
      const rawUnit = part.slice(numeric[0].length).trim().toLowerCase();
      const unit = /^(mm|milli)/.test(rawUnit) ? "mm" : /^(cm|centi)/.test(rawUnit) ? "cm"
        : /^(in\b|inch|["\u2033])/.test(rawUnit) ? "in" : /^(ft\b|feet|foot|['\u2032])/.test(rawUnit) ? "ft"
        : /^(gauge|ga\b)/.test(rawUnit) ? "gauge" : /^mil\b/.test(rawUnit) ? "mil"
        : /^(yd|yard)/.test(rawUnit) ? "yd" : /^(m\b|met)/.test(rawUnit) ? "m" : "";
      units.push(unit);
      const fraction = numeric[0].trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
      return fraction ? Number(fraction[1] || 0) + Number(fraction[2]) / Number(fraction[3]) : Number(numeric[0]);
    });
    // Inch width × yard/foot roll length is two independent product specifications,
    // not a homogeneous box/mailer's size tuple. Enforce both in the searcher.
    const roll = units.includes("in") && units.some(unit => ["yd", "ft", "mil", "gauge"].includes(unit))
      && units.every(unit => ["in", "yd", "ft", "mil", "gauge"].includes(unit));
    const suffix = value.slice(match.index! + match[0]!.length);
    const continues = new RegExp(`^\\s*(?:(?:[-–]|\\bto\\b)\\s*${DIMENSION_NUMBER}|(?:[x×]|\\bby\\b)(?:\\s|[-+\\d.]|$))`, "i").test(suffix);
    return { start: match.index!, end: match.index! + match[0]!.length, values,
      unit: units.find(Boolean) ?? "", ...(roll ? { kind: "roll" as const } : {}),
      valid: !continues && values.every(n => Number.isFinite(n) && n > 0)
        && (roll || new Set(units.filter(Boolean)).size <= 1) };
  });
  // Remember malformed dimension intent even when the strict tuple regex finds
  // no complete tuple, so callers cannot silently fall back to broad keywords.
  const intent = new RegExp(`(?<![\\w./])[-+]?${axis}${DIMENSION_SEPARATOR}`, "gi");
  for (const match of value.matchAll(intent)) {
    if (!records.some(record => match.index! >= record.start! && match.index! < record.end!)) return [invalid];
  }
  return records;
}
// The catalog parser emits inches. Explicit units are converted, never relabeled.
// Bare catalog dimensions retain the documented inch default; search constraints
// separately require explicit evidence whenever the buyer states a unit.
export function parseDimensions(input: string | null | undefined): Dimensions | null {
  if (!input) return null;
  const record = dimensionEvidence(input)[0];
  if (!record || !record.valid || record.kind === "roll" || (record.values.length !== 2 && record.values.length !== 3)) return null;
  const scale: Record<string, number> = { "": 1, in: 1, mm: 1 / 25.4, cm: 1 / 2.54, ft: 12, yd: 36, m: 100 / 2.54 };
  const factor = scale[record.unit];
  if (factor === undefined) return null;
  const values = record.values.map(n => n * factor);
  if (!values.every(n => Number.isFinite(n) && n > 0)) return null;
  return { length_in: values[0]!, width_in: values[1]!, depth_in: values[2] ?? null, raw: input };
}

// Try product spec metafields then title.
export function extractDimensions(opts: {
  metafields?: Array<{ namespace: string; key: string; value: string }>;
  title?: string;
}): Dimensions | null {
  const mf = opts.metafields ?? [];
  // Look for any custom.specN_value where the corresponding specN_name says "Dimensions" or "Size".
  for (let i = 1; i <= 8; i++) {
    const nameField = mf.find((m) => m.namespace === "custom" && m.key === `spec${i}_name`);
    if (!nameField) continue;
    if (!/dimension|size/i.test(nameField.value)) continue;
    const valueField = mf.find((m) => m.namespace === "custom" && m.key === `spec${i}_value`);
    if (!valueField) continue;
    const parsed = parseDimensions(valueField.value);
    if (parsed) return parsed;
  }
  // Scan all custom string values as a fallback.
  for (const m of mf) {
    if (m.namespace !== "custom") continue;
    if (!m.key.endsWith("_value")) continue;
    const parsed = parseDimensions(m.value);
    if (parsed) return parsed;
  }
  // Last resort: title.
  if (opts.title) {
    const parsed = parseDimensions(opts.title);
    if (parsed) return parsed;
  }
  return null;
}

export function fitScore(item: { length_in: number; width_in: number; depth_in: number }, box: Dimensions): number | null {
  // Box must accommodate item with each dim padded by 0.5–2 inches.
  // Sort both so orientation doesn't matter.
  const itemDims = [item.length_in, item.width_in, item.depth_in].sort((a, b) => b - a);
  const boxDims = [
    box.length_in,
    box.width_in,
    box.depth_in ?? 0,
  ].sort((a, b) => b - a);
  if (boxDims[2] === 0) return null;
  const pads = itemDims.map((it, i) => boxDims[i]! - it);
  if (pads.some((p) => p < 0.5)) return null; // doesn't fit with min padding
  const slack = pads.reduce((s, p) => s + Math.max(0, p - 2), 0); // penalize >2" overshoot
  const tightness = pads.reduce((s, p) => s + Math.min(p, 2), 0); // closer to padding range = better
  // Lower is better. Combine: oversize penalty + (3*2 - tightness) so perfect fit ~0.
  return slack * 2 + (6 - tightness);
}
