// Dimension parsing utilities for Packrift product spec strings.
// Spec strings come in many forms: `12 1/8" L x 11 5/8" W x 2 5/8" H`,
// `3" W x 4.5" H`, `10 x 8 x 4 in`, etc. Also fall back to title parsing.

export interface Dimensions {
  length_in: number;
  width_in: number;
  depth_in: number | null;
  raw: string;
}

// Parse "12 1/8" or "1/2" or "12.5" or "12" into a number.
function parseFractional(token: string): number | null {
  const t = token.trim().replace(/["']/g, "").trim();
  if (!t) return null;
  // mixed: "12 1/8"
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  // pure fraction: "1/2"
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  // decimal or integer
  const num = Number(t);
  return Number.isFinite(num) ? num : null;
}

// Find dimensions like `12 1/8" L x 11 5/8" W x 2 5/8" H` or `10 x 8 x 4`.
export function parseDimensions(input: string | null | undefined): Dimensions | null {
  if (!input) return null;
  const raw = input;
  // Strip extraneous whitespace.
  const s = raw.replace(/\s+/g, " ").trim();

  // Three-dim pattern: <num> [unit] x <num> [unit] x <num> [unit]
  // Numbers can be `12`, `12.5`, `1/2`, `12 1/8`. Unit chars `"`, `'`, `in`, `L|W|H` letters allowed and dropped.
  const numToken = `(\\d+(?:\\s+\\d+\\/\\d+)?(?:\\.\\d+)?|\\d+\\/\\d+)`;
  const re3 = new RegExp(
    `${numToken}\\s*["']?\\s*[A-Za-z]?\\s*x\\s*${numToken}\\s*["']?\\s*[A-Za-z]?\\s*x\\s*${numToken}\\s*["']?\\s*[A-Za-z]?`,
    "i"
  );
  const m3 = s.match(re3);
  if (m3) {
    const a = parseFractional(m3[1]!);
    const b = parseFractional(m3[2]!);
    const c = parseFractional(m3[3]!);
    if (a !== null && b !== null && c !== null) {
      return { length_in: a, width_in: b, depth_in: c, raw };
    }
  }

  // Two-dim pattern (mailers/envelopes): `3" W x 4.5" H`.
  const re2 = new RegExp(
    `${numToken}\\s*["']?\\s*[A-Za-z]?\\s*x\\s*${numToken}\\s*["']?\\s*[A-Za-z]?`,
    "i"
  );
  const m2 = s.match(re2);
  if (m2) {
    const a = parseFractional(m2[1]!);
    const b = parseFractional(m2[2]!);
    if (a !== null && b !== null) {
      return { length_in: a, width_in: b, depth_in: null, raw };
    }
  }
  return null;
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
