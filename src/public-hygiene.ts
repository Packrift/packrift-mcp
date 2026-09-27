// Guards for what the public worker exposes. Internal growth and operations
// reports stay reachable for Packrift with the stats token but are not served
// to the public, and legacy tool payloads are scrubbed of fields that only
// make sense inside Packrift (supplier location names, risk flags, empty
// cost fields).

const INTERNAL_ROUTE_PATTERNS: RegExp[] = [
  /^\/ai\/(?:.*-)?(?:activation|adoption|rollout|funnel|snapshot|usage|revenue|outreach|submission|submit-actions?|directory-refresh|directory-update|reviewer|visitor-growth|first-run|first20|proof|eval-pack|order-handoffs|conversion-route|pr-activation|capture|external-activation|wave|experiments|queue|tasks|runner|conversion-starter|source-listing|readiness|ga4|gsc|uline-alternatives-authority-source|ucp-builder-sales-loop|ucp-builder-launchpad|ucp-builder-approval|ucp-builder-integration|ucp-builder-activation|claude-connector)/i,
  /^\/ai\/mcp-directory-update\//i,
  /^\/ai\/all-agent-capture/i,
  /^\/ai\/agent-capture/i,
  /^\/ai\/mcp-activation/i,
  /^\/ai\/mcp-source-activation/i,
  /^\/ai\/mcp-agent-host-rollout/i,
  /^\/ai\/mcp-agent-adoption/i,
  /^\/ai\/mcp-buyer-order-handoffs/i,
  /^\/ai\/mcp-directory-submit/i,
  /^\/ai\/mcp-revenue/i,
  /^\/ai\/mcp-visitor-growth/i,
  /^\/ai\/mcp-funnel/i,
  /^\/ai\/mcp-usage/i,
  /^\/ai\/mcp-ga4/i,
  /^\/ai\/mcp-eval-pack/i,
  /^\/ai\/mcp-external/i,
  /^\/events\/ai-sales\/(?:summary|dashboard)/i,
  /^\/r\/activate(?:\/|$)/i,
];

export function isInternalRoute(pathname: string): boolean {
  return INTERNAL_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function hasStatsToken(url: URL, headers: Headers, configuredToken: string | undefined): boolean {
  if (!configuredToken) return false;
  const bearer = headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const token = url.searchParams.get("token") ?? bearer;
  return token.length > 0 && token === configuredToken;
}

// Fulfillment locations are named "<partner> - <Region>" in Shopify. Buyers
// only need the region, so every regional location is presented by region.
const REGIONS = ["Northeast", "Southeast", "Central", "West", "South"] as const;
const REGION_PATTERN = new RegExp(`^(.*?)\\s+-\\s+(${REGIONS.join("|")})$`, "i");

export function isRegionalWarehouse(location: string): boolean {
  return REGION_PATTERN.test(location.trim());
}

export function publicLocationName(location: string): string {
  const match = location.trim().match(REGION_PATTERN);
  if (!match) return location;
  const region = REGIONS.find((name) => name.toLowerCase() === match[2]!.toLowerCase()) ?? match[2]!;
  return `${region} US warehouse`;
}

const DROP_KEYS = new Set(["approved_risk_flags", "risk_flags", "current_margin", "riskFlags"]);

function scrubString(value: string): string {
  return value
    .replace(/^(.*?)\s+-\s+(Northeast|Southeast|Central|West|South)$/i, (_m, _partner: string, region: string) => `${region} US warehouse`)
    .replace(/\bBOX location\(s\)/g, "US warehouse location(s)")
    .replace(/\bBOX locations?\b/g, "US warehouse locations");
}

/** Deep copy of a legacy tool payload without internal-only fields and supplier names. */
export function scrubLegacyPayload<T>(value: T): T {
  return scrub(value) as T;
}

function scrub(value: unknown): unknown {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (DROP_KEYS.has(key)) continue;
      const renamed = key.replace(/^box_partners_/, "warehouse_");
      out[renamed] = scrub(inner);
    }
    return out;
  }
  return value;
}

/** Metafield keys that describe the product to a buyer. Everything else on a product is operational. */
export const PUBLIC_METAFIELD_KEY = /^(spec\d+_(?:name|value)|item_(?:length|width|height)|color|strength_material|category|subcategory|order_in_multiples_of|qty_per_shipping_unit|shipping_uom|shipping_(?:length|width|depth)|faq\d+_(?:question|answer)|catalog_title|catalog_description|ai_summary|whats_included|common_use_cases|best_for_description|short_description|feature_explanation|shipping_packaging_details)$/;
