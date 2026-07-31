// Reversible, MCP-only buyer-query aliases derived from the accepted July 11
// 100-query Storefront candidate audit. These SKUs already exist in the
// generated AI_APPROVE catalog; this file changes no Shopify or feed fields.
// Broad/ambiguous queries and every AI_FIX, AI_HOLD, out-of-stock, grouping,
// image-pilot, and protected-box overlap are deliberately excluded.
//
// 2026-07-11: the three 2026-07-10 experiment-overlay recovery SKUs
// (444, PB339, T901800) graduated into the generated canonical allowlist;
// their recovery aliases moved here unchanged from
// src/experiment-approved-catalog.ts so ranking behavior is preserved.
export const QUERY_ALIAS_OVERRIDES: Readonly<Record<string, string>> = {
  "362110": "wardrobe box",
  "SF188": "80 gauge stretch wrap || pallet stretch wrap",
  "SF2071PK": "stretch wrap 20 inch x 1000 ft",
  "T94653006PK": "kraft paper tape",
  "T9067500": "water activated tape",
  "FD1424": "void fill",
  "PL28": "packing slip envelopes",
  "444": "4 x 4 x 4 kraft corrugated shipping boxes ECT-32 25 pack cube",
  "PB339": "2 x 2 clear polyethylene poly bags 2 mil 1000 case lay flat",
  "T901800": "2 inch clear polypropylene carton sealing tape 2 x 55 yd hot melt 2.2 mil 36 roll case",
};
