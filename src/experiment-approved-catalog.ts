import type { ApprovedCatalogItem } from "./approved-catalog.js";

export type ExperimentApprovedCatalogItem = ApprovedCatalogItem & { searchAliases: string };

// Reversible, experiment-scoped approval overlay for Packrift agentic-catalog
// recovery lanes. Rows here are intentionally separate from the generated
// canonical allowlist so removing a row restores the prior MCP approval state
// without rewriting the catalog source.
//
// 2026-07-11: the three 2026-07-10 recovery SKUs (444, PB339, T901800) all
// passed the full live re-classification (fresh Shopify + Merchant Center +
// dims-metafield data) and graduated into the generated canonical allowlist
// (src/approved-catalog.ts). Canonical wins: they were removed from this
// overlay to satisfy the effective-catalog duplicate-identity guard. Their
// recovery search aliases moved to src/query-alias-overrides.ts, which is the
// alias mechanism for canonical rows, so ranking behavior is unchanged.
export const EXPERIMENT_APPROVED_CATALOG: ExperimentApprovedCatalogItem[] = [];
