// Compact, human-readable output for the v1 tools. Every listed tool returns
// a short text block (what the model reads) plus a compact structuredContent
// object (what apps and widgets read). Neither carries internal tracking IDs.

import { kindLabel, type CatalogEntry } from "./catalog.js";

export function money(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  return `$${n.toFixed(2)}`;
}

export function unitPrice(price: number | null | undefined, pack: number | null | undefined): number | null {
  if (typeof price !== "number" || !Number.isFinite(price) || !pack || pack < 2) return null;
  const value = price / pack;
  return value >= 1 ? Math.round(value * 100) / 100 : Math.round(value * 1000) / 1000;
}

export function unitPriceText(unit: number | null): string {
  if (unit === null) return "";
  return unit >= 1 ? `$${unit.toFixed(2)} each` : `$${unit.toFixed(3)} each`;
}

export interface CompactItem {
  sku: string;
  title: string;
  type: string;
  size: string | null;
  pack: number | null;
  price: number | null;
  unit_price: number | null;
  in_stock: boolean;
  url: string;
  match?: "exact" | "close" | "related";
  image_url?: string | null;
}

export function compactItem(
  entry: CatalogEntry,
  live: { price: number | null; inStock: boolean; url: string; title?: string | null; imageUrl?: string | null },
  match?: CompactItem["match"]
): CompactItem {
  const item: CompactItem = {
    sku: entry.sku,
    title: live.title || entry.title,
    type: entry.kind === "other" ? entry.family.replace(/_/g, " ") : kindLabel(entry.kind),
    size: entry.sizeLabel,
    pack: entry.pack,
    price: live.price,
    unit_price: unitPrice(live.price, entry.pack),
    in_stock: live.inStock,
    url: live.url,
  };
  if (match) item.match = match;
  if (live.imageUrl) item.image_url = live.imageUrl;
  return item;
}

export function itemLine(item: CompactItem, index?: number): string {
  const prefix = typeof index === "number" ? `${index + 1}. ` : "";
  const price =
    item.price === null
      ? "price at checkout"
      : item.pack && item.pack > 1
        ? `${money(item.price)} per pack of ${item.pack.toLocaleString("en-US")}${item.unit_price !== null ? ` (${unitPriceText(item.unit_price)})` : ""}`
        : money(item.price);
  const match = item.match === "close" ? " [close size, not exact]" : "";
  return `${prefix}SKU ${item.sku}: ${item.title}${match} | ${price} | ${item.in_stock ? "in stock" : "out of stock"} | ${item.url}`;
}

export function toolResult(text: string, structured: Record<string, unknown>) {
  return { __v1: true as const, text, structured };
}

export type V1ToolResult = ReturnType<typeof toolResult>;

export function isV1ToolResult(value: unknown): value is V1ToolResult {
  return Boolean(value && typeof value === "object" && (value as { __v1?: unknown }).__v1 === true);
}
