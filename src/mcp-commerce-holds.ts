import type { ApprovedCatalogItem } from "./approved-catalog.js";

export const MCP_COMMERCE_HELD_SKUS = ["12104", "CRR40W", "FWUPS116S24P"] as const;

export const MCP_COMMERCE_HOLD_REASON =
  "SKU is held from MCP AI-commerce cart handoff pending explicit margin, LTL, and spec-conflict approval.";

const heldSkuSet = new Set<string>(MCP_COMMERCE_HELD_SKUS.map((sku) => sku.toUpperCase()));

export function normalizeCommerceSku(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

export function isMcpCommerceHeldSku(value: string | null | undefined): boolean {
  const sku = normalizeCommerceSku(value);
  return sku ? heldSkuSet.has(sku) : false;
}

export function isMcpCommerceHeldItem(item: ApprovedCatalogItem | null | undefined): boolean {
  return isMcpCommerceHeldSku(item?.sku);
}

export function mcpCommerceHoldErrorMessage(sku: string | null | undefined): string {
  const normalizedSku = normalizeCommerceSku(sku) ?? "requested SKU";
  return `MCP commerce hold blocked ${normalizedSku}: ${MCP_COMMERCE_HOLD_REASON} Use get_bulk_quote_link or request operator review instead of create_cart_url.`;
}

export function assertMcpCommerceSkuAllowed(sku: string | null | undefined): void {
  if (isMcpCommerceHeldSku(sku)) {
    throw new Error(mcpCommerceHoldErrorMessage(sku));
  }
}
