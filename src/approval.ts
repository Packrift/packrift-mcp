import { APPROVED_CATALOG, ApprovedCatalogItem } from "./approved-catalog.js";

function numericId(idOrGid: string): string {
  const match = idOrGid.match(/(\d+)$/);
  return match ? match[1]! : idOrGid;
}

const byHandle = new Map<string, ApprovedCatalogItem>();
const byVariantId = new Map<string, ApprovedCatalogItem>();

for (const item of APPROVED_CATALOG) {
  if (item.handle && !byHandle.has(item.handle)) byHandle.set(item.handle, item);
  if (item.variantId) byVariantId.set(numericId(item.variantId), item);
}

export function approvalForHandle(handle: string): ApprovedCatalogItem | null {
  return byHandle.get(handle) ?? null;
}

export function approvalForVariantId(idOrGid: string): ApprovedCatalogItem | null {
  return byVariantId.get(numericId(idOrGid)) ?? null;
}

export function isApprovedHandle(handle: string): boolean {
  return byHandle.has(handle);
}

export function isApprovedVariantId(idOrGid: string): boolean {
  return byVariantId.has(numericId(idOrGid));
}

export function approvalStatus(item: ApprovedCatalogItem | null) {
  if (!item) {
    return {
      ai_status: "NOT_APPROVED",
      approval_gate: "blocked",
    };
  }
  return {
    ai_status: "AI_APPROVE",
    approval_gate: "passed",
    approved_family: item.family || null,
    approved_sku: item.sku || null,
    approved_variant_id: item.variantId || null,
    approved_risk_flags: item.riskFlags || null,
  };
}

export function assertApprovedVariantIds(variantIds: string[]): void {
  const blocked = variantIds.filter((id) => !isApprovedVariantId(id));
  if (blocked.length) {
    throw new Error(
      `AI_APPROVE gate blocked variant_ids: ${blocked.join(", ")}. Use search_products or find_packaging_for_item to choose approved Packrift SKUs.`
    );
  }
}
