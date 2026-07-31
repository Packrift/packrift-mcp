import { APPROVED_CATALOG as GENERATED_APPROVED_CATALOG, type ApprovedCatalogItem } from "./approved-catalog.js";
import { EXPERIMENT_APPROVED_CATALOG } from "./experiment-approved-catalog.js";
import { QUERY_ALIAS_OVERRIDES } from "./query-alias-overrides.js";

export type { ApprovedCatalogItem } from "./approved-catalog.js";
export type EffectiveApprovedCatalogItem = ApprovedCatalogItem & { searchAliases?: string };

const generatedWithAliases: EffectiveApprovedCatalogItem[] = GENERATED_APPROVED_CATALOG.map((item) => ({
  ...item,
  searchAliases: QUERY_ALIAS_OVERRIDES[item.sku.trim().toUpperCase()] ?? "",
}));
const combined = [...generatedWithAliases, ...EXPERIMENT_APPROVED_CATALOG];
const skuCounts = new Map<string, number>();
const variantCounts = new Map<string, number>();
for (const item of combined) {
  const sku = item.sku.trim().toUpperCase();
  const variant = item.variantId.trim();
  skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
  variantCounts.set(variant, (variantCounts.get(variant) ?? 0) + 1);
}

const duplicateSkus = [...skuCounts].filter(([, count]) => count > 1).map(([sku]) => sku);
const duplicateVariants = [...variantCounts].filter(([, count]) => count > 1).map(([variant]) => variant);
if (duplicateSkus.length || duplicateVariants.length) {
  throw new Error(
    `Effective approved catalog has duplicate identities: skus=${duplicateSkus.join(",") || "none"}; variants=${duplicateVariants.join(",") || "none"}`
  );
}

export const APPROVED_CATALOG: EffectiveApprovedCatalogItem[] = combined;
