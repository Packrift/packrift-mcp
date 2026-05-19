import { Hono } from "hono";
import type { Context } from "hono";
import { shopifyQuery, type Env } from "./shopify.js";
import { serverCard } from "./server-card.js";
import { llmsTxt } from "./llms-content.js";
import { llmsFullTxt } from "./llms-full-content.js";
import { agentInstructionsMd } from "./agent-instructions-content.js";
import { allAgentCaptureMarkdown, allAgentCapturePayload } from "./agent-capture.js";
import { mcpStartHtml, mcpStartMarkdown, mcpStartPayload } from "./agent-start.js";
import { mcpAdoptionKitMarkdown, mcpAdoptionKitPayload } from "./adoption-kit.js";
import { mcpInstallMatrixMarkdown, mcpInstallMatrixPayload } from "./install-matrix.js";
import {
  MCP_INSTALL_ACTION_RELEASE,
  MCP_SOURCE_QUERY_PARAM,
  MCP_TARGET_QUERY_PARAM,
  mcpInstallActionHtml,
  mcpInstallActionMarkdown,
  mcpInstallActionPayload,
  mcpInstallActionsMarkdown,
  mcpInstallActionsPayload,
  mcpFirstUsefulRun,
  normalizeInstallTarget,
  sourceAwareMcpEndpoint,
  trackedInstallUrl,
} from "./install-action.js";
import {
  MCP_FIRST_RUN_ACTION_RELEASE,
  mcpFirstRunActionMarkdown,
  mcpFirstRunActionPayload,
  mcpFirstRunActionsMarkdown,
  mcpFirstRunActionsPayload,
  trackedRunUrl,
} from "./first-run-action.js";
import { mcpClientConfigMarkdown, mcpClientConfigPayload } from "./client-config.js";
import { mcpBuyerUseCasesMarkdown, mcpBuyerUseCasesPayload } from "./buyer-use-cases.js";
import { mcpCartActivationMarkdown, mcpCartActivationPayload } from "./cart-activation.js";
import { mcpFirstRunProofMarkdown, mcpFirstRunProofPayload, type FirstRunProofDemo } from "./first-run-proof.js";
import { mcpWorkflowGalleryMarkdown, mcpWorkflowGalleryPayload } from "./workflow-gallery.js";
import { browserAgentBridgeMarkdown, browserAgentBridgePayload } from "./browser-agent-bridge.js";
import { browserbaseBrowseSkillMd, browserbaseBrowseSkillPackMarkdown, browserbaseBrowseSkillPackPayload } from "./browserbase-browse-skill-pack.js";
import { mcpDirectoryRefreshMarkdown, mcpDirectoryRefreshPayload } from "./directory-refresh-pack.js";
import {
  mcpDirectorySubmitActionMarkdown,
  mcpDirectorySubmitActionPayload,
  mcpDirectorySubmitActionsMarkdown,
  mcpDirectorySubmitActionsPayload,
} from "./directory-submit-actions.js";
import { mcpReviewerActivationHtml, mcpReviewerActivationMarkdown, mcpReviewerActivationPayload, trackedReviewerActivationUrl } from "./reviewer-activation.js";
import { claudeConnectorSubmissionMarkdown, claudeConnectorSubmissionPayload } from "./claude-connector-submission.js";
import { agentCaptureOutreachMarkdown, agentCaptureOutreachPayload } from "./agent-capture-outreach.js";
import { APPROVED_CATALOG, type ApprovedCatalogItem } from "./approved-catalog.js";
import { PURCHASE_READY_SKUS } from "./purchase-ready-skus.js";

import { searchProductsSchema, searchProductsHandler } from "./tools/search_products.js";
import { getProductSchema, getProductHandler } from "./tools/get_product.js";
import { getPricingSchema, getPricingHandler } from "./tools/get_pricing.js";
import { checkInventorySchema, checkInventoryHandler } from "./tools/check_inventory.js";
import { recommendPackagingSchema, recommendPackagingHandler } from "./tools/recommend_packaging.js";
import { getShippingEstimateSchema, getShippingEstimateHandler } from "./tools/get_shipping_estimate.js";
import { createCartUrlSchema, createCartUrlHandler } from "./tools/create_cart_url.js";
import { preparePurchaseHandoffHandler, preparePurchaseHandoffSchema } from "./tools/prepare_purchase_handoff.js";
import {
  compareAlternativesHandler,
  compareAlternativesSchema,
  inventoryStatusHandler,
  inventoryStatusSchema,
  packCalculatorHandler,
  packCalculatorSchema,
} from "./tools/exploration_tools.js";
import {
  explainNoExactMatchHandler,
  explainNoExactMatchSchema,
  getBulkQuoteLinkHandler,
  getBulkQuoteLinkSchema,
  getReorderLinkHandler,
  getReorderLinkSchema,
} from "./tools/procurement_links.js";
import { buildTrackingContext, trackedUrl } from "./conversion.js";

type Bindings = Env;
type AppContext = Context<{ Bindings: Bindings }>;

const app = new Hono<{ Bindings: Bindings }>();
let workerStartedAtMs: number | null = null;

function workerUptimeSeconds(): number {
  const now = Date.now();
  if (workerStartedAtMs === null || workerStartedAtMs > now) workerStartedAtMs = now;
  return Math.max(0, Math.floor((now - workerStartedAtMs) / 1000));
}

interface ToolDef {
  schema: { name: string; description: string; inputSchema: unknown };
  handler: (env: Env, args: unknown) => unknown | Promise<unknown>;
}

const CART_HANDOFF_CANDIDATE_FAMILIES = [
  "boxes",
  "mailers",
  "labels",
  "tape",
  "poly_bags",
  "stretch_film",
  "strapping",
  "tags",
  "void_fill",
  "packing_list_envelopes",
] as const;

const CART_HANDOFF_FAMILY_ALIASES: Record<string, string> = {
  box: "boxes",
  boxes: "boxes",
  corrugated_box: "boxes",
  corrugated_boxes: "boxes",
  mailer: "mailers",
  mailers: "mailers",
  label: "labels",
  labels: "labels",
  tape: "tape",
  poly_bag: "poly_bags",
  poly_bags: "poly_bags",
  bag: "poly_bags",
  bags: "poly_bags",
  stretch_film: "stretch_film",
  strapping: "strapping",
  tag: "tags",
  tags: "tags",
  void_fill: "void_fill",
  packing_list_envelope: "packing_list_envelopes",
  packing_list_envelopes: "packing_list_envelopes",
};

const getCartHandoffCandidatesSchema = {
  name: "get_cart_handoff_candidates",
  description:
    "Returns priority AI-approved Packrift SKUs that are ready for MCP cart handoff exploration, including create_cart_url arguments, SKU records, measured product/reorder/quote links, and the required live-confirmation sequence.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      family: {
        type: "string",
        enum: CART_HANDOFF_CANDIDATE_FAMILIES,
        description: "Optional product family filter.",
      },
      sku: { type: "string", description: "Optional exact Packrift SKU filter." },
    },
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

interface PromptArgumentDef {
  name: string;
  description: string;
  required?: boolean;
}

interface PromptDef {
  name: string;
  description: string;
  arguments: PromptArgumentDef[];
  template: string;
}

const TOOLS: ToolDef[] = [
  { schema: searchProductsSchema, handler: searchProductsHandler },
  { schema: getProductSchema, handler: getProductHandler },
  { schema: getPricingSchema, handler: getPricingHandler },
  { schema: checkInventorySchema, handler: checkInventoryHandler },
  { schema: recommendPackagingSchema, handler: recommendPackagingHandler },
  { schema: getShippingEstimateSchema, handler: getShippingEstimateHandler },
  { schema: getCartHandoffCandidatesSchema, handler: getCartHandoffCandidatesHandler },
  { schema: createCartUrlSchema, handler: createCartUrlHandler },
  { schema: preparePurchaseHandoffSchema, handler: preparePurchaseHandoffHandler },
  { schema: compareAlternativesSchema, handler: compareAlternativesHandler },
  { schema: packCalculatorSchema, handler: packCalculatorHandler },
  { schema: inventoryStatusSchema, handler: inventoryStatusHandler },
  { schema: getReorderLinkSchema, handler: getReorderLinkHandler },
  { schema: getBulkQuoteLinkSchema, handler: getBulkQuoteLinkHandler },
  { schema: explainNoExactMatchSchema, handler: explainNoExactMatchHandler },
];

const PROMPTS: PromptDef[] = [
  {
    name: "find_exact_packaging_spec",
    description: "Find an AI-approved Packrift product by exact dimensions, material, color, count, or SKU.",
    arguments: [
      { name: "spec", description: "Exact buyer request such as 10 x 6 x 6 ECT 32 kraft boxes, 25 bundle.", required: true },
      { name: "family", description: "Optional product family such as boxes, labels, mailers, tape, poly bags, or stretch film." },
    ],
    template:
      "Find an exact Packrift packaging match for: {{spec}}. Product family: {{family}}. Use only AI_APPROVE products. Confirm SKU, dimensions, material, color, pack or case count, product URL, live price, and inventory before purchase handoff. If any required field differs, return no exact match and route to bulk quote.",
  },
  {
    name: "reorder_packrift_sku",
    description: "Reorder a known Packrift SKU with exact product continuity.",
    arguments: [{ name: "sku", description: "Packrift SKU to reorder.", required: true }],
    template:
      "Reorder Packrift SKU {{sku}}. First call get_cart_handoff_candidates with the SKU, then get_product, get_pricing, and check_inventory. After the exact SKU, live facts, and buyer quantity are confirmed, call create_cart_url with the candidate's create_cart_url_sku_arguments or create_cart_url_arguments. Return the MCP /r/cart URL as the primary handoff; keep product, reorder, quote, and copy-procurement-spec actions as fallbacks. If the SKU is not an exact AI_APPROVE match, do not create a cart URL.",
  },
  {
    name: "prepare_cart_handoff",
    description: "Prepare a live-confirmed Packrift cart handoff for a selected exact SKU and quantity.",
    arguments: [
      { name: "sku", description: "Selected Packrift SKU such as 1066.", required: true },
      { name: "quantity", description: "Buyer-selected quantity. Default to 1 when not provided." },
    ],
    template:
      "Prepare a Packrift MCP cart handoff for SKU {{sku}} and quantity {{quantity}}. First call get_cart_handoff_candidates with the exact SKU to retrieve the approved variant and create_cart_url arguments. Then call get_product, get_pricing, and check_inventory for live confirmation. Only after the exact SKU, variant, live price, inventory, and buyer-selected quantity are confirmed, call create_cart_url with MCP attribution. Return the stamped cart URL plus the measured product, reorder, quote, and copy-procurement-spec fallback actions. If the requested SKU is not an exact AI_APPROVE match, do not create a cart URL; call explain_no_exact_match or get_bulk_quote_link instead.",
  },
  {
    name: "fit_item_then_prepare_cart",
    description: "Find packaging for a buyer's item dimensions, confirm live facts, then prepare a stamped cart handoff.",
    arguments: [
      { name: "item_dimensions", description: "Item length x width x height in inches, such as 9 x 4 x 3.", required: true },
      { name: "weight", description: "Optional item weight and unit, such as 2 lb." },
      { name: "use_case", description: "Shipping use case such as fragile ecommerce, books, apparel, labels, or long narrow items." },
      { name: "quantity", description: "Buyer-selected quantity. Default to 1 until confirmed." },
    ],
    template:
      "Find packaging for an item with dimensions {{item_dimensions}}, weight {{weight}}, use case {{use_case}}, and desired quantity {{quantity}}. Start with find_packaging_for_item using the item dimensions and use case. For the top AI_APPROVE fit, call get_product, get_pricing, check_inventory, and get_shipping_estimate when destination data is available. If the buyer confirms the exact SKU and quantity, call create_cart_url so the returned URL includes ref=mcp plus chatgpt-mcp / mcp_tool / create_cart_url attribution. If no exact safe fit exists, call explain_no_exact_match and get_bulk_quote_link instead of forcing a substitute.",
  },
  {
    name: "review_cart_handoff_candidates",
    description: "Explore priority SKUs that already have ready create_cart_url arguments for measured MCP cart testing.",
    arguments: [
      { name: "family", description: "Optional family filter such as boxes, mailers, labels, tape, poly_bags, stretch_film, strapping, tags, void_fill, or envelopes." },
      { name: "limit", description: "Number of candidates to review. Default to 10." },
    ],
    template:
      "Review Packrift MCP cart handoff candidates for family {{family}} with limit {{limit}}. Call get_cart_handoff_candidates, choose one exact AI_APPROVE candidate, then call get_product, get_pricing, and check_inventory. Only after confirmation, call create_cart_url with the candidate's create_cart_url_arguments. Return the stamped MCP cart landing URL, final Packrift cart permalink, measured product/reorder/quote links, and no-match policy.",
  },
  {
    name: "request_bulk_quote_for_no_match",
    description: "Route a buyer to quote recovery when Packrift has no exact approved match.",
    arguments: [
      { name: "requested_spec", description: "The exact unavailable spec the buyer requested.", required: true },
      { name: "family", description: "Product family for the quote request." },
    ],
    template:
      "The buyer requested {{requested_spec}} in family {{family}}. If no AI_APPROVE exact match exists, do not suggest a nearby substitute as exact. Explain the missing required field and route to https://packrift.com/pages/bulk-quote with the requested spec.",
  },
  {
    name: "copy_procurement_spec",
    description: "Produce a clean procurement-line item for a selected Packrift SKU.",
    arguments: [{ name: "sku", description: "Selected Packrift SKU.", required: true }],
    template:
      "Create a procurement-ready line item for Packrift SKU {{sku}}. Include SKU, title, dimensions, material, color, strength or closure details where verified, pack or case count, product URL, and reorder URL. Do not add unsupported claims.",
  },
  {
    name: "find_box_by_lwh",
    description: "Find corrugated boxes by exact length x width x height, strength, color, and bundle count.",
    arguments: [
      { name: "dimensions", description: "Box dimensions in L x W x H inches.", required: true },
      { name: "strength", description: "Strength rating such as ECT 32 or ECT 44." },
      { name: "color", description: "Box color such as kraft or white." },
    ],
    template:
      "Find exact Packrift corrugated boxes with dimensions {{dimensions}}, strength {{strength}}, and color {{color}}. Use AI_APPROVE only. If no exact L x W x H match exists, return no exact match and quote recovery.",
  },
  {
    name: "find_label_by_size_material_printer",
    description: "Find labels by exact size, material, printer type, adhesive or weather resistance, and case count.",
    arguments: [
      { name: "label_size", description: "Label size such as 2 5/8 x 1.", required: true },
      { name: "material", description: "Label material such as polyester or paper." },
      { name: "printer_type", description: "Printer type such as laser, inkjet, direct thermal, or thermal transfer." },
    ],
    template:
      "Find exact Packrift labels with size {{label_size}}, material {{material}}, and printer type {{printer_type}}. Confirm adhesive or weather resistance only where verified in the product data. If unavailable, return no exact match.",
  },
];

const PROTOCOL_VERSION = "2025-06-18";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface RpcExecutionContext {
  sessionId?: string;
  userAgent?: string;
  sourceSlug?: string;
  installTarget?: string;
  sourceInference?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}

type RouteRedirectAction = "product" | "reorder" | "quote" | "cart";

type InferredMcpRuntimeSource = {
  sourceSlug: string;
  installTarget?: string;
  sourceInference: string;
};

function normalizeMcpRuntimeSlug(value: unknown): string {
  const slug = safeEventText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return MCP_START_SOURCE_PATTERN.test(slug) ? slug : "";
}

function firstRuntimeSlug(url: URL, keys: string[]): string {
  for (const key of keys) {
    const slug = normalizeMcpRuntimeSlug(url.searchParams.get(key));
    if (slug) return slug;
  }
  return "";
}

function inferredRuntimeSource(sourceSlug: string, installTarget: string | undefined, sourceInference: string): InferredMcpRuntimeSource | null {
  const normalizedSource = normalizeMcpRuntimeSlug(sourceSlug);
  if (!normalizedSource) return null;
  const normalizedTarget = normalizeMcpRuntimeSlug(installTarget);
  return {
    sourceSlug: normalizedSource,
    installTarget: normalizedTarget || undefined,
    sourceInference,
  };
}

function inferMcpRuntimeSourceFromUserAgent(userAgent: string): InferredMcpRuntimeSource | null {
  const ua = userAgent.toLowerCase();
  if (!ua) return null;
  if (ua.includes("cline")) return inferredRuntimeSource("cline_mcp_marketplace", "cline", "user_agent_cline");
  if (ua.includes("cursor")) return inferredRuntimeSource("cursor_directory", "cursor_windsurf_vscode", "user_agent_cursor");
  if (ua.includes("windsurf")) return inferredRuntimeSource("windsurf_direct", "cursor_windsurf_vscode", "user_agent_windsurf");
  if (ua.includes("roo")) return inferredRuntimeSource("roo_direct", "cursor_windsurf_vscode", "user_agent_roo");
  if (ua.includes("vscode") || ua.includes("vs code")) return inferredRuntimeSource("vscode_direct", "cursor_windsurf_vscode", "user_agent_vscode");
  if (ua.includes("codex")) return inferredRuntimeSource("codex_remote_mcp", "codex", "user_agent_codex");
  if (ua.includes("claude")) return inferredRuntimeSource("claude_remote_mcp", "claude_code", "user_agent_claude");
  if (ua.includes("anthropic")) return inferredRuntimeSource("anthropic_remote_mcp", "claude_code", "user_agent_anthropic");
  if (ua.includes("glama")) return inferredRuntimeSource("glama_connector", "glama_connector", "user_agent_glama");
  if (ua.includes("smithery")) return inferredRuntimeSource("smithery", "generic_streamable_http", "user_agent_smithery");
  if (ua.includes("browserbase") || ua.includes("browse")) return inferredRuntimeSource("browse_sh", "generic_streamable_http", "user_agent_browserbase_browse");
  if (ua.includes("chatmcp") || ua.includes("mcp.so")) return inferredRuntimeSource("mcp_so", "generic_streamable_http", "user_agent_mcp_so");
  if (ua.includes("mcp-marketplace") || ua.includes("mcp_marketplace")) return inferredRuntimeSource("mcp_marketplace_io", "mcp_marketplace", "user_agent_mcp_marketplace");
  if (ua.includes("modelcontextprotocol") || ua.includes("mcp-client") || /\bmcp\b/.test(ua)) {
    return inferredRuntimeSource("unattributed_mcp_client", "generic_streamable_http", "user_agent_generic_mcp_client");
  }
  return null;
}

function mcpSourceContinuityFromUrl(url: URL, userAgent = ""): RpcExecutionContext {
  const sourceSlug = firstRuntimeSlug(url, [MCP_SOURCE_QUERY_PARAM, "mcp_source", "utm_source"]);
  if (!sourceSlug) {
    const inferred = inferMcpRuntimeSourceFromUserAgent(userAgent);
    if (!inferred) return {};
    return {
      sourceSlug: inferred.sourceSlug,
      installTarget: inferred.installTarget,
      sourceInference: inferred.sourceInference,
      utmMedium: "mcp_runtime_inferred",
      utmCampaign: "packrift_mcp_runtime",
      utmContent: inferred.installTarget ?? inferred.sourceSlug,
    };
  }
  const installTarget = firstRuntimeSlug(url, [MCP_TARGET_QUERY_PARAM, "mcp_target", "utm_content"]);
  return {
    sourceSlug,
    installTarget: installTarget || undefined,
    sourceInference: "query_param",
    utmMedium: safeEventText(url.searchParams.get("utm_medium"), 80) || undefined,
    utmCampaign: safeEventText(url.searchParams.get("utm_campaign"), 120) || undefined,
    utmContent: safeEventText(url.searchParams.get("utm_content"), 120) || undefined,
  };
}

function rpcContextTelemetry(context: RpcExecutionContext) {
  return {
    sessionId: context.sessionId,
    userAgent: context.userAgent,
    sourceSlug: context.sourceSlug,
    installTarget: context.installTarget,
    sourceInference: context.sourceInference,
    utmMedium: context.utmMedium,
    utmCampaign: context.utmCampaign,
    utmContent: context.utmContent,
  };
}

function mcpContinuityAttribution(meta: RpcExecutionContext, actionLabel: string): Record<string, unknown> {
  const sourceSlug = normalizeMcpRuntimeSlug(meta.sourceSlug);
  if (!sourceSlug) return {};
  const action = normalizeMcpRuntimeSlug(actionLabel) || "runtime";
  const target = normalizeMcpRuntimeSlug(meta.installTarget) || action;
  const day = compactDate();
  const id = `mcp_runtime_${sourceSlug}_${day}_${action}`;
  return {
    mcp_source_context: sourceSlug,
    mcp_install_target: target,
    mcp_source_inference: safeEventText(meta.sourceInference, 80),
    mcp_source_inference_release: MCP_RUNTIME_SOURCE_INFERENCE_RELEASE,
    packrift_ai_id: id,
    ai_commerce_id: id,
    mcp_key: `runtime:${sourceSlug}`,
    mcp_journey: `mcp_runtime:${sourceSlug}:${target}:${action}`,
    mcp_result_set: `mcp_runtime_${day}`,
    utm_source: sourceSlug,
    utm_medium: safeEventText(meta.utmMedium, 80) || "mcp_runtime",
    utm_campaign: safeEventText(meta.utmCampaign, 120) || "packrift_mcp_runtime",
    utm_content: safeEventText(meta.utmContent, 120) || target,
  };
}

function mergeNonEmptyAttribution(...rows: Array<Record<string, unknown>>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      merged[key] = value;
    }
  }
  return merged;
}

function sourceAwareMcpJson(source: string, target = "tracked_config") {
  return {
    mcpServers: {
      packrift: {
        type: "http",
        url: sourceAwareMcpEndpoint(source, target),
      },
    },
  };
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: unknown, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

function promptListItem(prompt: PromptDef) {
  return {
    name: prompt.name,
    description: prompt.description,
    arguments: prompt.arguments,
  };
}

function renderPrompt(template: string, args: Record<string, unknown>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(args[key] ?? "").trim());
}

function isSyntheticToolCall(args: unknown): boolean {
  if (!args || typeof args !== "object") return false;
  const row = args as Record<string, unknown>;
  const context = row.analytics_context && typeof row.analytics_context === "object" ? (row.analytics_context as Record<string, unknown>) : {};
  return row.suppress_analytics === true || context.synthetic === true;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function normalizeCartHandoffFamily(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  return CART_HANDOFF_FAMILY_ALIASES[raw] ?? raw;
}

function getCartHandoffCandidatesHandler(_env: Env, raw: unknown) {
  const args = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const limit = boundedInteger(args.limit, 10, 1, 50);
  const sku = String(args.sku ?? "").trim().toUpperCase();
  const family = normalizeCartHandoffFamily(args.family);
  if (family && !CART_HANDOFF_CANDIDATE_FAMILIES.includes(family as (typeof CART_HANDOFF_CANDIDATE_FAMILIES)[number])) {
    throw new Error(`Unsupported family filter: ${family}`);
  }

  const payload = cartHandoffCandidatesPayload(50);
  const filtered = payload.items
    .filter((item) => !sku || item.sku.toUpperCase() === sku)
    .filter((item) => !family || item.family === family)
    .slice(0, limit);

  return {
    ...payload,
    tool_name: "get_cart_handoff_candidates",
    filters: {
      sku: sku || null,
      family: family || null,
      limit,
    },
    result_count: filtered.length,
    items: filtered,
    recommended_next_step:
      filtered.length > 0
        ? "For a selected item, call get_product, get_pricing, and check_inventory. After the buyer confirms exact SKU and quantity, call create_cart_url with create_cart_url_sku_arguments, or pass create_cart_url_arguments when your agent already needs explicit variant IDs."
        : "No priority cart handoff candidate matched this filter. Use search_products for the exact spec, or get_bulk_quote_link when no exact approved match exists.",
  };
}

async function handleRpc(env: Env, req: JsonRpcRequest, context: RpcExecutionContext = {}): Promise<unknown | null> {
  const { method, params, id } = req;
  const telemetryContext = rpcContextTelemetry(context);
  // Notifications (no id) get no response.
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: serverCard.name, version: serverCard.version },
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          instructions:
            "Packrift finds the right packaging supply for a given item. All product discovery, product detail, price, inventory, shipping, reorder, quote, and cart handoff tools are AI_APPROVE-gated where a product SKU is involved. Hero use case: the user has an item's dimensions (or a use case like 'mailer' / 'fragile') and needs the smallest box, mailer, or container that fits — call find_packaging_for_item. Use search_products only when the user names a specific product type and dimensions are unknown. Use prepare_purchase_handoff for the fastest exact-SKU path: it confirms product, live price, and inventory, and returns a measured MCP cart URL only when buyer_confirmed=true. Use get_cart_handoff_candidates to discover priority AI-approved SKUs with ready create_cart_url arguments for agentic cart exploration. After picking a SKU, use get_product for full detail, get_pricing/check_inventory for live confirmation, get_reorder_link or get_bulk_quote_link for procurement handoff, get_shipping_estimate for rates, then create_cart_url to hand off to checkout (always carries ?ref=mcp). If no exact match exists, call explain_no_exact_match.",
        });

      case "notifications/initialized":
      case "initialized":
        return null;

      case "ping":
        return rpcResult(id, {});

      case "tools/list":
        await recordMcpDiscoveryEvent(env, "mcp_tools_list", {
          mcpMethod: method,
          resultCount: TOOLS.length,
          resultSizeBytes: jsonByteSize(TOOLS.map((t) => t.schema)),
          ...telemetryContext,
          ok: true,
        });
        return rpcResult(id, { tools: TOOLS.map((t) => t.schema) });

      case "tools/call": {
        const name = (params?.["name"] as string) ?? "";
        const args = (params?.["arguments"] as unknown) ?? {};
        const tool = TOOLS.find((t) => t.schema.name === name);
        if (!tool) {
          return rpcError(id, -32602, `Unknown tool: ${name}`);
        }
        const shouldRecordToolTelemetry = !isSyntheticToolCall(args) && !shouldSkipInternalTelemetry(context.userAgent ?? "");
        const startedAt = Date.now();
        try {
          const out = await tool.handler(env, args);
          if (shouldRecordToolTelemetry) {
            await recordAiSalesEvent(
              env,
              buildMcpToolCallEvent(name, out, {
                latencyMs: Date.now() - startedAt,
                resultSizeBytes: jsonByteSize(out),
                ...telemetryContext,
                ok: true,
              })
            );
          }
          return rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
            structuredContent: out,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (shouldRecordToolTelemetry) {
            await recordAiSalesEvent(
              env,
              buildMcpToolCallEvent(name, { error: msg }, {
                latencyMs: Date.now() - startedAt,
                resultSizeBytes: jsonByteSize({ error: msg }),
                ...telemetryContext,
                ok: false,
                errorMessage: msg,
              })
            );
          }
          // Per MCP spec, tool errors are returned in `result` with isError:true,
          // not as JSON-RPC errors — this lets the model see what went wrong.
          return rpcResult(id, {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          });
        }
      }

      case "resources/list":
        await recordMcpDiscoveryEvent(env, "mcp_resource_list", {
          mcpMethod: method,
          resultCount: MCP_RESOURCES.length,
          resultSizeBytes: jsonByteSize(MCP_RESOURCES),
          ...telemetryContext,
          ok: true,
        });
        return rpcResult(id, { resources: MCP_RESOURCES });

      case "resources/templates/list":
        await recordMcpDiscoveryEvent(env, "mcp_resource_templates_list", {
          mcpMethod: method,
          resultCount: MCP_RESOURCE_TEMPLATES.length,
          resultSizeBytes: jsonByteSize(MCP_RESOURCE_TEMPLATES),
          ...telemetryContext,
          ok: true,
        });
        return rpcResult(id, { resourceTemplates: MCP_RESOURCE_TEMPLATES });

      case "resources/read": {
        const startedAt = Date.now();
        const uri = (params?.["uri"] as string) ?? "";
        const pathname = new URL(uri).pathname;
        const skuResourceMatch = pathname.match(/^\/ai\/sku\/[^/]+\.(md|json)$/);
        const resource = MCP_RESOURCES.find((item) => item.uri === uri);
        if (!resource && !skuResourceMatch) {
          await recordMcpDiscoveryEvent(env, "mcp_resource_read", {
            mcpMethod: method,
            resourceUri: uri,
            format: skuResourceMatch?.[1] ?? "",
            latencyMs: Date.now() - startedAt,
            resultSizeBytes: 0,
            ...telemetryContext,
            ok: false,
            errorMessage: `Unknown resource: ${uri}`,
          });
          return rpcError(id, -32602, `Unknown resource: ${uri}`);
        }
        const text = await readResourceText(env, uri);
        const mimeType = resource?.mimeType ?? (skuResourceMatch?.[1] === "json" ? "application/json" : "text/markdown");
        await recordMcpDiscoveryEvent(env, "mcp_resource_read", {
          mcpMethod: method,
          resourceUri: uri,
          format: skuResourceMatch?.[1] ?? mimeType,
          latencyMs: Date.now() - startedAt,
          resultSizeBytes: jsonByteSize(text),
          ...telemetryContext,
          ok: true,
        });
        return rpcResult(id, {
          contents: [{ uri, mimeType, text }],
        });
      }

      case "prompts/list":
        await recordMcpDiscoveryEvent(env, "mcp_prompt_list", {
          mcpMethod: method,
          resultCount: PROMPTS.length,
          resultSizeBytes: jsonByteSize(PROMPTS.map(promptListItem)),
          ...telemetryContext,
          ok: true,
        });
        return rpcResult(id, { prompts: PROMPTS.map(promptListItem) });

      case "prompts/get": {
        const startedAt = Date.now();
        const name = (params?.["name"] as string) ?? "";
        const args = ((params?.["arguments"] as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
        const prompt = PROMPTS.find((item) => item.name === name);
        if (!prompt) {
          await recordMcpDiscoveryEvent(env, "mcp_prompt_get", {
            mcpMethod: method,
            promptName: name,
            latencyMs: Date.now() - startedAt,
            resultSizeBytes: 0,
            ...telemetryContext,
            ok: false,
            errorMessage: `Unknown prompt: ${name}`,
          });
          return rpcError(id, -32602, `Unknown prompt: ${name}`);
        }
        const missing = prompt.arguments.filter((arg) => arg.required && !String(args[arg.name] ?? "").trim());
        if (missing.length > 0) {
          await recordMcpDiscoveryEvent(env, "mcp_prompt_get", {
            mcpMethod: method,
            promptName: name,
            latencyMs: Date.now() - startedAt,
            resultSizeBytes: 0,
            ...telemetryContext,
            ok: false,
            errorMessage: `Missing required prompt argument: ${missing.map((arg) => arg.name).join(", ")}`,
          });
          return rpcError(id, -32602, `Missing required prompt argument: ${missing.map((arg) => arg.name).join(", ")}`);
        }
        const text = renderPrompt(prompt.template, args);
        await recordMcpDiscoveryEvent(env, "mcp_prompt_get", {
          mcpMethod: method,
          promptName: name,
          latencyMs: Date.now() - startedAt,
          resultSizeBytes: jsonByteSize(text),
          ...telemetryContext,
          ok: true,
        });
        return rpcResult(id, {
          description: prompt.description,
          messages: [
            {
              role: "user",
              content: { type: "text", text },
            },
          ],
        });
      }

      default:
        if (isNotification) return null;
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    if (isNotification) return null;
    const msg = err instanceof Error ? err.message : String(err);
    return rpcError(id, -32603, `Internal error: ${msg}`);
  }
}

function isStorefrontHostname(hostname: string): boolean {
  return hostname === "packrift.com" || hostname === "www.packrift.com";
}

function wantsJson(acceptHeader: string | undefined): boolean {
  const accept = (acceptHeader ?? "").toLowerCase();
  return accept.includes("application/json") && !accept.includes("text/html");
}

async function mcpStartHtmlResponse(c: AppContext): Promise<Response> {
  const url = new URL(c.req.url);
  const body = mcpStartHtml(mcpStartRuntime(), {
    source: url.searchParams.get("utm_source") || url.searchParams.get("source"),
  });
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-start.html", "mcp_start", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/html; charset=utf-8",
    ...RAW_HEADERS,
  });
}

app.get("/", async (c) => {
  const url = new URL(c.req.url);
  if (isStorefrontHostname(url.hostname)) {
    return storefrontPassThrough(c.req.raw, c.env);
  }
  if (wantsJson(c.req.header("Accept"))) {
    return c.json({
      status: "ok",
      server: serverCard.name,
      version: serverCard.version,
      mcp_endpoint: "https://mcp.packrift.com/mcp",
      start_url: "https://mcp.packrift.com/start",
      start_json: "https://mcp.packrift.com/ai/mcp-start.json",
    });
  }
  return mcpStartHtmlResponse(c);
});

app.get("/start", async (c) => {
  const url = new URL(c.req.url);
  if (isStorefrontHostname(url.hostname)) {
    return storefrontPassThrough(c.req.raw, c.env);
  }
  return mcpStartHtmlResponse(c);
});

app.get("/install", async (c) => {
  const url = new URL(c.req.url);
  if (isStorefrontHostname(url.hostname)) {
    return storefrontPassThrough(c.req.raw, c.env);
  }
  return mcpStartHtmlResponse(c);
});

// Raw machine-readable agent-discovery surfaces.
// llms.txt: llmstxt.org-format Markdown index for AI agents and answer engines.
// server-card.json: MCP discovery manifest in raw JSON.
// Both have permissive CORS so agents can fetch from any origin.
const RAW_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
  "Cloudflare-CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
};
const PURCHASE_PATHS_NOSTORE_RELEASE = "PACKRIFT-PURCHASE-PATHS-NOSTORE-2026-05-19-R02";
const PURCHASE_PATHS_HEADERS = {
  ...RAW_HEADERS,
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "X-Packrift-Purchase-Paths-Release": PURCHASE_PATHS_NOSTORE_RELEASE,
};
const STATIC_CACHE_TTL_SECONDS = 300;
const STATIC_CACHE_MIRROR_PREFIX = "static:";
const STATIC_CACHE_OVERRIDE_PREFIX = "static-override:";

const PDP_PROCUREMENT_RELEASE = "PACKRIFT-PDP-PROCUREMENT-HANDOFF-2026-05-17-R04";
const PAID_SKU_NOTE_REPAIR_RELEASE = "PACKRIFT-PAID-SKU-NOTE-REPAIR-2026-05-13-R01";
const PDP_EXACT_SPEC_CARD_EDGE_RELEASE = "PACKRIFT-PDP-EXACT-SPEC-CARD-EDGE-RETIRED-2026-05-17-R02";
const OWNED_PAGE_PRODUCT_LINKS_RELEASE = "PACKRIFT-OWNED-PAGE-PRODUCT-LINKS-2026-05-16-R02";
const REORDER_PAGE_CANONICAL_VIEW = "packrift_ai_reorder_live_r07";
const REORDER_PAGE_FEATURED_RELEASE = "PACKRIFT-REORDER-PAGE-TOP1000-2026-05-19-R05";
const REORDER_PAGE_EDGE_REPAIR_RELEASE = "PACKRIFT-REORDER-PAGE-LIVE-R07-LINK-REPAIR-2026-05-19-R01";
const AI_SALES_ADD_TO_CART_RELEASE = "PACKRIFT-AI-SALES-ADD-TO-CART-2026-05-14-R02";
const ROUTE_LANDING_SERVER_TELEMETRY_RELEASE = "PACKRIFT-ROUTE-LANDING-SERVER-TELEMETRY-2026-05-16-R01";
const ROUTE_REDIRECT_SERVER_TELEMETRY_RELEASE = "PACKRIFT-MCP-ROUTE-REDIRECT-TELEMETRY-2026-05-16-R01";
const MCP_START_REDIRECT_TELEMETRY_RELEASE = "PACKRIFT-MCP-START-REDIRECT-TELEMETRY-R01";
const MCP_DISCOVERY_TELEMETRY_RELEASE = "PACKRIFT-MCP-DISCOVERY-TELEMETRY-R01";
const MCP_RUNTIME_SOURCE_INFERENCE_RELEASE = "PACKRIFT-MCP-RUNTIME-SOURCE-INFERENCE-R01";
const GENERATED_AI_RESOURCE_TELEMETRY_RELEASE = "PACKRIFT-GENERATED-AI-RESOURCE-TELEMETRY-R01";
const CART_LANDING_SHIM_RELEASE = "PACKRIFT-MCP-CART-LANDING-SHIM-R02";
const MCP_ORDER_ATTRIBUTION_RELEASE = "PACKRIFT-MCP-ORDER-ATTRIBUTION-R01";
const PACKRIFT_GA4_MEASUREMENT_ID = "G-HPMNFWG4DV";
const SEMRUSH_36X16X16_PAGE_CACHE_BYPASS_RELEASE = "PACKRIFT-SEMRUSH-36X16X16-WORKER-BYPASS-2026-05-18-R01";
const AI_SALES_EVENT_PREFIX = "events/ai-sales";
const AI_SALES_EVENT_TTL_SECONDS = 60 * 60 * 24 * 90;
const AI_SALES_EVENT_READ_CONCURRENCY = 50;
const PUBLIC_MCP_ORDER_SUMMARY_TIMEOUT_MS = 3500;
const AI_SALES_ALLOWED_EVENTS = new Set([
  "add_to_cart",
  "product_click",
  "reorder_click",
  "quote_click",
  "cart_click",
  "mcp_cart_click",
  "mcp_cart_landing",
  "copy_procurement_spec",
  "ai_corpus_click",
  "mcp_tool_call",
  "mcp_tools_list",
  "mcp_prompt_list",
  "mcp_prompt_get",
  "mcp_resource_list",
  "mcp_resource_templates_list",
  "mcp_resource_read",
  "mcp_start_click",
  "mcp_install_intent",
  "mcp_first_run_intent",
  "mcp_first_run_execution",
  "mcp_install_copy",
  "mcp_activation_cart_ready",
  "spec_search",
  "exact_match",
  "multi_match",
  "no_match",
  "sku_page_view",
]);

const MCP_START_SOURCE_FORMAT = "^[a-z0-9_]{2,64}$";
const MCP_START_SOURCE_PATTERN = /^[a-z0-9_]{2,64}$/;
const MCP_START_REDIRECT_RECOMMENDED_SOURCES = [
  "official_registry",
  "mcpservers_org",
  "glama_connector",
  "glama_server_listing",
  "mcp_directory",
  "anthropic_connectors_directory",
  "smithery",
  "cline_mcp_marketplace",
  "mcp_so",
  "mcpmarket_com",
  "cursor_directory",
  "mcpcentral",
  "mcpfinder",
  "pulsemcp_packrift",
  "mcpskills",
  "agentndx",
  "mcpbench",
  "chiark",
  "mcp_marketplace_io",
  "mcplist_ai",
  "mcphubz",
  "mcp_blue",
  "findmcp_dev",
  "mcplane",
  "mcpsolutions_dev",
  "gpmcp",
  "theresamcpforthat",
  "mcpserverfinder",
  "docker_mcp_catalog",
  "generic",
] as const;
const MCP_START_SOURCE_POLICY = {
  accepted_source_format: MCP_START_SOURCE_FORMAT,
  partner_specific_sources_allowed: true,
  normalization: "Source slugs are lowercased before attribution. Use lowercase source labels to preserve exact reporting.",
  recommended_sources: MCP_START_REDIRECT_RECOMMENDED_SOURCES,
  custom_examples: ["agency_partner", "browser_agent_demo", "newsletter_mcp"],
} as const;

type OwnedPageProductLink = { sku: string; title: string; path: string };
type OwnedPageProductLinkBlock = { heading: string; body: string; items: OwnedPageProductLink[] };

function skuAnchor(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `sku-${safe || "packrift"}`;
}

const REORDER_FEATURED_SKUS: Array<OwnedPageProductLink & { spec: string }> = [
  {
    sku: "1066",
    title: "10x6x6 ECT-32 Kraft Long Corrugated Boxes",
    spec: "10 x 6 x 6 corrugated box, ECT 32, kraft, 25 bundle",
    path: "/products/10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
  },
  {
    sku: "MFL1295",
    title: "12 1/8 x 9 1/4 x 5 White Literature Mailer",
    spec: "12 1/8 x 9 1/4 x 5 white corrugated self-seal mailer, 50 pack",
    path: "/products/12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack",
  },
  {
    sku: "LL251WR",
    title: "2 5/8 x 1 Weather-Resistant Polyester Laser Labels",
    spec: "2 5/8 x 1 weather-resistant polyester laser labels, 3,000 case",
    path: "/products/2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case",
  },
];

const PAID_SKU_NOTE_REPAIRS: Record<string, { internalNote: string; buyerNote: string }> = {
  "/products/10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle": {
    internalNote: "Paid ChatGPT SKU; highest-priority exact-spec confirmation and substitute UX.",
    buyerNote: "Confirm inside dimensions, ECT board grade, bundle quantity, and product fit before ordering.",
  },
  "/products/12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack": {
    internalNote: "Paid ChatGPT SKU; highest-priority exact-spec confirmation and substitute UX.",
    buyerNote: "Confirm usable dimensions, closure type, rigidity, color, and pack quantity before ordering.",
  },
  "/products/2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case": {
    internalNote: "Paid ChatGPT SKU; highest-priority exact-spec confirmation and substitute UX.",
    buyerNote: "Confirm label-face size, material, printer compatibility, and case quantity before ordering.",
  },
};

type PaidPdpExactSpecFact = { name: string; value: string };
type PaidPdpExactSpecCard = {
  sku: string;
  summary: string;
  confirmNote: string;
  facts: PaidPdpExactSpecFact[];
};

const PAID_PDP_EXACT_SPEC_CARDS: Record<string, PaidPdpExactSpecCard> = {
  "/products/10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle": {
    sku: "1066",
    summary:
      "10 x 6 x 6 in kraft, corrugated, ECT-32 boxes sold as 25/bundle. Commonly used for corrugated shipping, storage, ecommerce fulfillment, and reorder workflows.",
    confirmNote: "Confirm inside dimensions, ECT board grade, bundle quantity, and product fit before ordering.",
    facts: [
      { name: "Material", value: "ECT-32 Single Wall Kraft Corrugated" },
      { name: "Dimensions", value: '10" Length x 6" Width x 6" Height' },
      { name: "Edge Crush Test (ECT)", value: "32 lbs/in" },
      { name: "Quantity per Bundle", value: "25 Boxes (Flat Shipped)" },
      { name: "Recyclable", value: "Yes" },
    ],
  },
  "/products/12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack": {
    sku: "MFL1295",
    summary:
      "12 1/8 x 9 1/4 x 5 corrugated mailers, sold as a 50-pack. Commonly used for documents, catalogs, samples, and flat pack shipments.",
    confirmNote: "Confirm usable dimensions, closure type, rigidity, color, and pack quantity before ordering.",
    facts: [
      { name: "Material", value: "ECT-32-B Corrugated Cardboard" },
      { name: "Dimensions", value: '12 1/8" L x 9 1/4" W x 5" H' },
      { name: "Color", value: "Oyster White" },
      { name: "Assembly", value: "No-Tape Self-Seal One-Piece Design" },
      { name: "Recyclable", value: "Yes" },
    ],
  },
  "/products/2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case": {
    sku: "LL251WR",
    summary:
      "2.625 x 1 in weather-resistant polyester laser labels sold as 3000/case. Commonly used for durable inventory, product, bin, outdoor, and condensation-prone laser label workflows.",
    confirmNote: "Confirm label face size, laser-printer compatibility, material, adhesive, and labels per case before ordering.",
    facts: [
      { name: "Material", value: "Polyester with Permanent Acrylic Adhesive" },
      { name: "Dimensions", value: '2 5/8" x 1"' },
      { name: "Color", value: "White" },
      { name: "Quantity Per Case", value: "3,000 Labels" },
      { name: "Recyclable", value: "No" },
    ],
  },
};

const FIRST20_PDP_EXACT_SPEC_CARDS: Record<string, PaidPdpExactSpecCard> = {
  "/products/10x10x3-ect-32-kraft-corrugated-boxes-shallow-depth-shipping-bundle-of-25": {
    sku: "10103",
    summary: "SKU 10103: 10 x 10 x 3 in kraft ECT-32 corrugated boxes, sold as 25. Best for shipping and storage workflows.",
    confirmNote: "Confirm SKU 10103, 10 x 10 x 3 in, sold-as quantity 25, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/6x10-kraft-self-seal-padded-mailers-0-puncture-resistant-25-pack": {
    sku: "B803SS25PK",
    summary: "SKU B803SS25PK: 6 x 10 in kraft padded mailers, sold as 25. Best for self-seal padded mailing workflows.",
    confirmNote: "Confirm SKU B803SS25PK, 6 x 10 in, sold-as quantity 25, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/3x5-2-mil-clear-poly-bags-on-roll-auto-fill-compatible-3000-roll": {
    sku: "AB205",
    summary: "SKU AB205: 3 x 5 in clear 2 mil poly bags, sold as 3000. Best for parts bagging and storage workflows.",
    confirmNote: "Confirm SKU AB205, 3 x 5 in, sold-as quantity 3000, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/2x2x12-120-edge-protectors-case-of-250-pallet-protection": {
    sku: "EP2212120BX",
    summary: "SKU EP2212120BX: 2 x 2 x 12 in edge protector, .120 in thickness edge protectors, sold as 250. Best for pallet-edge protection workflows.",
    confirmNote: "Confirm SKU EP2212120BX, 2 x 2 x 12 in edge protector, .120 in thickness, sold-as quantity 250, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/1-2-x-12-x-50-anti-static-bubble-dispenser-pink-polyethylene": {
    sku: "BD1212AS",
    summary: "SKU BD1212AS: 1/2 in bubble/profile x 12 in roll width x 50 ft roll length poly void fill. Best for cushioning and void-fill stations.",
    confirmNote: "Confirm SKU BD1212AS, 1/2 in bubble/profile x 12 in roll width x 50 ft roll length, sold-as quantity, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/5-1-4-x-8-2-mil-poly-packing-list-envelopes-1000-case": {
    sku: "GSA20EL",
    summary: "SKU GSA20EL: 5.25 x 8 in poly 2 mil packing list envelopes, sold as 1000. Best for packing slip and document enclosure workflows.",
    confirmNote: "Confirm SKU GSA20EL, 5.25 x 8 in, sold-as quantity 1000, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/19-7-8x15-1-4x12-7-16-hdpe-stackable-bins-case-of-3": {
    sku: "BING110",
    summary: "SKU BING110: 19 7/8 x 15 1/4 x 12 7/16 in hdpe storage bins, sold as 3. Best for exact-spec storage workflows.",
    confirmNote: "Confirm SKU BING110, 19 7/8 x 15 1/4 x 12 7/16 in, sold-as quantity 3, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/10x10x8-ect-32-kraft-corrugated-boxes-bundle-of-25": {
    sku: "10108",
    summary: "SKU 10108: 10 x 10 x 8 in kraft ECT-32 corrugated boxes, sold as 25. Best for shipping and storage workflows.",
    confirmNote: "Confirm SKU 10108, 10 x 10 x 8 in, sold-as quantity 25, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/7-25x12-kraft-self-seal-padded-mailers-1-puncture-resistant-case-of-100": {
    sku: "B804SS",
    summary: "SKU B804SS: 7.25 x 12 in kraft padded mailers, sold as 100. Best for self-seal padded mailing workflows.",
    confirmNote: "Confirm SKU B804SS, 7.25 x 12 in, sold-as quantity 100, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/4x8-2-mil-pre-opened-poly-bags-on-roll-1750-count": {
    sku: "AB211",
    summary: "SKU AB211: 4 x 8 in poly 2 mil poly bags, sold as 1750. Best for parts bagging and storage workflows.",
    confirmNote: "Confirm SKU AB211, 4 x 8 in, sold-as quantity 1750, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/1-2-low-tack-glue-dots-clear-adhesive-1500-roll": {
    sku: "GD101R",
    summary: "SKU GD101R: 1/2 in glue dots clear adhesive products, sold as 1500. Best for adhesive and packing-station workflows.",
    confirmNote: "Confirm SKU GD101R, 1/2 in glue dots, sold-as quantity 1500, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/3-16-x-24-x-175-clear-bubble-dispenser-roll-easy-tear-packaging": {
    sku: "BD31624",
    summary: "SKU BD31624: 3/16 in bubble/profile x 24 in roll width x 175 ft roll length clear void fill. Best for cushioning and void-fill stations.",
    confirmNote: "Confirm SKU BD31624, 3/16 in bubble/profile x 24 in roll width x 175 ft roll length, sold-as quantity, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/4-5x6-orange-packing-list-enclosed-poly-envelopes-1000-case": {
    sku: "PL1",
    summary: "SKU PL1: 4.5 x 6 in orange packing list envelopes, sold as 1000. Best for packing slip and document enclosure workflows.",
    confirmNote: "Confirm SKU PL1, 4.5 x 6 in, sold-as quantity 1000, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/19-7-8x15-1-4x12-7-16-red-hdpe-stackable-bins-case-of-3": {
    sku: "BING111",
    summary: "SKU BING111: 19.875 x 15.25 x 12.4375 in red storage bins, sold as 3. Best for exact-spec storage workflows.",
    confirmNote: "Confirm SKU BING111, 19.875 x 15.25 x 12.4375 in, sold-as quantity 3, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/10-7-8x2x12-1-4-ect-32-self-seal-side-load-box-25-pack": {
    sku: "10212SSFOL",
    summary: "SKU 10212SSFOL: 10.875 x 2 x 12.25 in ECT-32 corrugated boxes, sold as 25. Best for shipping and storage workflows.",
    confirmNote: "Confirm SKU 10212SSFOL, 10.875 x 2 x 12.25 in, sold-as quantity 25, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/12-x-8-5-kraft-self-seal-padded-mailers-2-puncture-resistant-case-100": {
    sku: "B805SS",
    summary: "SKU B805SS: 12 x 8.5 in kraft padded mailers, sold as 100. Best for self-seal padded mailing workflows.",
    confirmNote: "Confirm SKU B805SS, 12 x 8.5 in, sold-as quantity 100, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/5x8-2-mil-pre-opened-poly-bags-on-roll-1750-ct-auto-fill": {
    sku: "AB213",
    summary: "SKU AB213: 5 x 8 in poly 2 mil poly bags, sold as 1750. Best for parts bagging and storage workflows.",
    confirmNote: "Confirm SKU AB213, 5 x 8 in, sold-as quantity 1750, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/20-x-75-gauge-x-5000-blown-machine-stretch-film-superior-load-retention": {
    sku: "MSF20755B",
    summary: "SKU MSF20755B: 20 in width x 75 gauge x 5000 ft roll length stretch film. Best for machine stretch-wrap workflows.",
    confirmNote: "Confirm SKU MSF20755B, 20 in width x 75 gauge x 5000 ft roll length, sold-as quantity, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/2x2x12-225-fibreboard-edge-protectors-case-of-120": {
    sku: "EP2212225BX",
    summary: "SKU EP2212225BX: 2 x 2 x 12 in edge protector, .225 in thickness edge protectors, sold as 120. Best for pallet-edge protection workflows.",
    confirmNote: "Confirm SKU EP2212225BX, 2 x 2 x 12 in edge protector, .225 in thickness, sold-as quantity 120, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
  "/products/5-16-x-12-x-100-anti-static-bubble-roll-pink-polyethylene-dispenser-pack": {
    sku: "BD51612AS",
    summary: "SKU BD51612AS: 5/16 in bubble/profile x 12 in roll width x 100 ft roll length poly void fill. Best for cushioning and void-fill stations.",
    confirmNote: "Confirm SKU BD51612AS, 5/16 in bubble/profile x 12 in roll width x 100 ft roll length, sold-as quantity, material/grade, price, availability, and checkout delivery before ordering.",
    facts: [],
  },
};

const PDP_EXACT_SPEC_CARDS: Record<string, PaidPdpExactSpecCard> = {
  ...PAID_PDP_EXACT_SPEC_CARDS,
  ...FIRST20_PDP_EXACT_SPEC_CARDS,
};

const OWNED_PAGE_PRODUCT_LINK_BLOCKS: Record<string, OwnedPageProductLinkBlock> = {
  "/pages/box-sizes-by-dimension": {
    heading: "Popular exact-size box SKUs",
    body: "Direct links from box dimension research to Packrift corrugated box product pages.",
    items: [
      { sku: "1066", title: "10x6x6 ECT-32 Kraft Long Corrugated Boxes", path: "/products/10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle" },
      { sku: "10212SSFOL", title: "10 7/8x2x12 1/4 ECT-32 Self Seal Side Load Box", path: "/products/10-7-8x2x12-1-4-ect-32-self-seal-side-load-box-25-pack" },
      { sku: "1044", title: "10x4x4 ECT-32 Kraft Corrugated Long Boxes", path: "/products/10x4x4-ect-32-kraft-corrugated-long-boxes-25-pack-bundle" },
      { sku: "1054", title: "10x5x4 ECT-32 Kraft Corrugated Boxes", path: "/products/10x5x4-ect-32-kraft-corrugated-boxes-ai-long-side-opening-bundle-of-25" },
      { sku: "1055", title: "10x5x5 ECT-32 Kraft Corrugated Boxes", path: "/products/10x5x5-ect-32-kraft-corrugated-boxes-long-design-bundle-of-25" },
      { sku: "1065", title: "10x6x5 ECT-32 Kraft Corrugated Boxes", path: "/products/10x6x5-ect-32-kraft-corrugated-boxes-25-pack-bundle" },
      { sku: "1086W", title: "10x8x6 White Corrugated Boxes", path: "/products/10x8x6-white-corrugated-boxes-ect-32-single-wall-25-pack-bundle" },
      { sku: "1094", title: "10x9x4 ECT-32 Kraft Corrugated Boxes", path: "/products/10x9x4-ect-32-kraft-corrugated-boxes-25-bundle-shallow-product-shipping" },
    ],
  },
  "/pages/mailer-sizes-by-dimension": {
    heading: "Popular exact-size mailer SKUs",
    body: "Direct links from mailer size research to Packrift mailer product pages.",
    items: [
      { sku: "MFL1295", title: "12 1/8 x 9 1/4 x 5 White Corrugated Literature Mailer", path: "/products/12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack" },
      { sku: "M1031", title: "10x3x1 ECT-32-B White Corrugated Mailers", path: "/products/10x3x1-ect-32-b-white-corrugated-mailers-crush-resistant-50-bundle" },
      { sku: "M1033", title: "10x3x3 ECT-32-B White Corrugated Mailers", path: "/products/10x3x3-ect-32-b-white-corrugated-mailers-crush-resistant-50-bundle" },
      { sku: "M1033K", title: "10x3x3 Kraft Corrugated Mailers", path: "/products/10x3x3-kraft-corrugated-mailers-ect-32-crush-resistant-50-bundle" },
      { sku: "M1042K", title: "10x4x2 Kraft Corrugated Mailers", path: "/products/10x4x2-kraft-corrugated-mailers-ect-32-crush-resistant-50-bundle" },
      { sku: "M1044", title: "10x4x4 White Corrugated Mailers", path: "/products/10x4x4-white-corrugated-mailers-ect-32-crush-resistant-50-pack" },
      { sku: "M1052", title: "10x5x2 ECT-32-B White Corrugated Mailers", path: "/products/10x5x2-ect-32-b-white-corrugated-mailers-crush-resistant-50-bundle" },
      { sku: "M1055", title: "10x5x5 ECT-32-B White Corrugated Mailers", path: "/products/10x5x5-ect-32-b-white-corrugated-mailers-crush-resistant-50-bundle" },
    ],
  },
  "/pages/label-sizes-by-spec": {
    heading: "Popular exact-spec label SKUs",
    body: "Direct links from label spec research to Packrift label product pages.",
    items: [
      { sku: "LL251WR", title: "2 5/8 x 1 Weather-Resistant Polyester Laser Labels", path: "/products/2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case" },
      { sku: "DL1058", title: "2x3 Fragile Glass Handle With Care Labels", path: "/products/2x3-fragile-glass-handle-with-care-labels-semi-gloss-red-white-roll-of-500" },
      { sku: "DL1066", title: "2x3 Fragile Glass Handle Care Labels", path: "/products/2x3-fragile-glass-handle-care-labels-semi-gloss-red-white-500-roll" },
      { sku: "DL1075", title: "2x3 Fluorescent Red Fragile Labels", path: "/products/2x3-fluorescent-red-fragile-labels-semi-gloss-roll-of-500" },
      { sku: "DL1087", title: "3x5 Fluorescent Red Do Not Bend Labels", path: "/products/3x5-fluorescent-red-do-not-bend-labels-semi-gloss-500-roll" },
      { sku: "DL1088", title: "3x5 Fluorescent Red Do Not Lay Flat Labels", path: "/products/3x5-fluorescent-red-do-not-lay-flat-labels-500-roll-semi-gloss" },
      { sku: "DL1091", title: "3x5 Fluorescent Red Bilingual Fragile Labels", path: "/products/3x5-fluorescent-red-bilingual-fragile-labels-semi-gloss-roll-of-500" },
      { sku: "DL1096", title: "3x5 Fluorescent Yellow Do Not Double Stack Labels", path: "/products/3x5-fluorescent-yellow-do-not-double-stack-labels-500-roll" },
    ],
  },
  "/pages/poly-bag-sizes-by-mil-and-dimension": {
    heading: "Popular exact-size poly bag SKUs",
    body: "Direct links from poly bag mil and dimension research to Packrift poly bag product pages.",
    items: [
      { sku: "AB205", title: "3x5 2 Mil Clear Poly Bags on Roll", path: "/products/3x5-2-mil-clear-poly-bags-on-roll-auto-fill-compatible-3000-roll" },
      { sku: "AB211", title: "4x8 2 Mil Pre-Opened Poly Bags on Roll", path: "/products/4x8-2-mil-pre-opened-poly-bags-on-roll-1750-count" },
      { sku: "AB213", title: "5x8 2 Mil Pre-Opened Poly Bags on Roll", path: "/products/5x8-2-mil-pre-opened-poly-bags-on-roll-1750-ct-auto-fill" },
      { sku: "AB219", title: "8x12 2 Mil Pre-Opened Poly Bags on Roll", path: "/products/8x12-2-mil-pre-opened-poly-bags-on-roll-auto-fill-ready-1250-roll" },
      { sku: "AB221", title: "10x12 2 Mil Pre-Opened Poly Bags on Roll", path: "/products/10x12-2-mil-pre-opened-poly-bags-on-roll-1250-roll" },
      { sku: "AB312", title: "5x7 4 Mil Pre-Opened Poly Bags on Roll", path: "/products/5x7-4-mil-pre-opened-poly-bags-on-roll-1000ct-auto-fill" },
      { sku: "AB313", title: "5x8 4 Mil Clear Poly Bags on Roll", path: "/products/5x8-4-mil-clear-poly-bags-on-roll-auto-fill-compatible-1000-roll" },
      { sku: "AB315", title: "6x8 4 Mil Pre-Opened Poly Bags on Roll", path: "/products/6x8-4-mil-pre-opened-poly-bags-on-roll-750-count" },
    ],
  },
  "/pages/tape-sizes-by-width-length-and-adhesive": {
    heading: "Popular exact-spec tape SKUs",
    body: "Direct links from tape width, length, and adhesive research to Packrift tape product pages.",
    items: [
      { sku: "T155000", title: "1.5 x 500 Kraft Water Activated Tape", path: "/products/1-5-x-500-kraft-water-activated-tape-strong-carton-seal-case-of-20" },
      { sku: "T901131", title: "2 x 55 yds 3.1 Mil Clear Acrylic Carton Sealing Tape", path: "/products/2-x-55-yds-3-1-mil-clear-acrylic-carton-sealing-tape-quiet-release-case-of-36" },
      { sku: "T901170", title: "2 x 55 yds Clear Acrylic Carton Sealing Tape", path: "/products/2-x-55-yds-clear-acrylic-carton-sealing-tape-1-8-mil-case-of-36" },
      { sku: "T901220", title: "2 x 55 yds Clear Acrylic Carton Sealing Tape", path: "/products/2-x-55-yds-clear-acrylic-carton-sealing-tape-industrial-grade-case-of-36" },
      { sku: "T90122B6PK", title: "2 x 55 yds Blue Carton Sealing Tape", path: "/products/2-x-55-yds-blue-carton-sealing-tape-2-2-mil-acrylic-6-pack" },
      { sku: "T90122BK18PK", title: "2 x 55 yds Black Carton Sealing Tape", path: "/products/2-x-55-yds-black-carton-sealing-tape-2-2-mil-acrylic-18-pack" },
      { sku: "T90122O", title: "2 x 55 yds Orange Carton Sealing Tape", path: "/products/2-x-55-yds-orange-carton-sealing-tape-2-2-mil-acrylic-adhesive-case-of-36" },
      { sku: "T901260CC12P", title: "2 x 55 yds Clear Carton Sealing Tape", path: "/products/2-x-55-yds-clear-carton-sealing-tape-2-6-mil-case-of-12" },
    ],
  },
  "/pages/stretch-film-by-width-gauge-and-core": {
    heading: "Popular exact-spec stretch film SKUs",
    body: "Direct links from stretch film width, gauge, and core research to Packrift stretch film product pages.",
    items: [
      { sku: "MSF2060B", title: "20 x 60 Gauge x 7500 Blown Machine Stretch Film", path: "/products/20-x-60-gauge-x-7500-blown-machine-stretch-film-superior-load-retention" },
      { sku: "MSF2060C", title: "20 x 60 Gauge x 7500 Cast Machine Stretch Film", path: "/products/20-x-60-gauge-x-7500-cast-machine-stretch-film-250-stretch-1-roll" },
      { sku: "MSF20755B", title: "20 x 75 Gauge x 5000 Blown Machine Stretch Film", path: "/products/20-x-75-gauge-x-5000-blown-machine-stretch-film-superior-load-retention" },
      { sku: "MSF20755C", title: "20 x 75 Gauge Cast Machine Stretch Film", path: "/products/20-x-75-gauge-cast-machine-stretch-film-5000-roll-ultra-clear-pallet-wrap" },
      { sku: "MSF2080ORG", title: "20 x 80 Gauge x 6000 Orange Cast Machine Stretch Film", path: "/products/20-x-80-gauge-x-6000-orange-cast-machine-stretch-film-high-load-retention-1-roll" },
      { sku: "MSF2080RED", title: "20 x 80 Gauge x 6000 Red Cast Machine Stretch Film", path: "/products/20-x-80-gauge-x-6000-red-cast-machine-stretch-film-superior-load-retention" },
      { sku: "MSF30805C", title: "30 x 80 Gauge Cast Machine Stretch Film", path: "/products/30-x-80-gauge-cast-machine-stretch-film-5000-250-stretch-ultra-clear" },
      { sku: "SF1015", title: "6.5 Blue Plastic Stretch Film Cutter", path: "/products/6-5-blue-plastic-stretch-film-cutter-easy-grip-handle-case-of-2" },
    ],
  },
  "/pages/box-size-calculator": {
    heading: "Exact-size SKUs to verify after calculating",
    body: "After calculating fit, confirm the exact SKU, dimensions, material, and pack count on the live product page.",
    items: [
      { sku: "1066", title: "10x6x6 ECT-32 Kraft Long Corrugated Boxes", path: "/products/10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle" },
      { sku: "MFL1295", title: "12 1/8 x 9 1/4 x 5 White Corrugated Literature Mailer", path: "/products/12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack" },
      { sku: "10212SSFOL", title: "10 7/8x2x12 1/4 ECT-32 Self Seal Side Load Box", path: "/products/10-7-8x2x12-1-4-ect-32-self-seal-side-load-box-25-pack" },
      { sku: "1044", title: "10x4x4 ECT-32 Kraft Corrugated Long Boxes", path: "/products/10x4x4-ect-32-kraft-corrugated-long-boxes-25-pack-bundle" },
      { sku: "1054", title: "10x5x4 ECT-32 Kraft Corrugated Boxes", path: "/products/10x5x4-ect-32-kraft-corrugated-boxes-ai-long-side-opening-bundle-of-25" },
      { sku: "1055", title: "10x5x5 ECT-32 Kraft Corrugated Boxes", path: "/products/10x5x5-ect-32-kraft-corrugated-boxes-long-design-bundle-of-25" },
      { sku: "1065", title: "10x6x5 ECT-32 Kraft Corrugated Boxes", path: "/products/10x6x5-ect-32-kraft-corrugated-boxes-25-pack-bundle" },
      { sku: "1086W", title: "10x8x6 White Corrugated Boxes", path: "/products/10x8x6-white-corrugated-boxes-ect-32-single-wall-25-pack-bundle" },
    ],
  },
  "/pages/dimensional-weight-calculator": {
    heading: "Exact-size SKUs to verify after calculating",
    body: "After calculating dimensional weight, confirm the exact SKU, dimensions, material, and pack count on the live product page.",
    items: [
      { sku: "1066", title: "10x6x6 ECT-32 Kraft Long Corrugated Boxes", path: "/products/10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle" },
      { sku: "MFL1295", title: "12 1/8 x 9 1/4 x 5 White Corrugated Literature Mailer", path: "/products/12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack" },
      { sku: "10212SSFOL", title: "10 7/8x2x12 1/4 ECT-32 Self Seal Side Load Box", path: "/products/10-7-8x2x12-1-4-ect-32-self-seal-side-load-box-25-pack" },
      { sku: "1044", title: "10x4x4 ECT-32 Kraft Corrugated Long Boxes", path: "/products/10x4x4-ect-32-kraft-corrugated-long-boxes-25-pack-bundle" },
      { sku: "1054", title: "10x5x4 ECT-32 Kraft Corrugated Boxes", path: "/products/10x5x4-ect-32-kraft-corrugated-boxes-ai-long-side-opening-bundle-of-25" },
      { sku: "1055", title: "10x5x5 ECT-32 Kraft Corrugated Boxes", path: "/products/10x5x5-ect-32-kraft-corrugated-boxes-long-design-bundle-of-25" },
      { sku: "1065", title: "10x6x5 ECT-32 Kraft Corrugated Boxes", path: "/products/10x6x5-ect-32-kraft-corrugated-boxes-25-pack-bundle" },
      { sku: "1086W", title: "10x8x6 White Corrugated Boxes", path: "/products/10x8x6-white-corrugated-boxes-ect-32-single-wall-25-pack-bundle" },
    ],
  },
  "/pages/find-packaging-by-exact-spec": {
    heading: "Starter exact-spec product links",
    body: "Direct product links for common exact-spec searches. Use these as examples and continue to the Spec Finder for more matches.",
    items: [
      { sku: "1066", title: "10x6x6 ECT-32 Kraft Long Corrugated Boxes", path: "/products/10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle" },
      { sku: "LL251WR", title: "2 5/8 x 1 Weather-Resistant Polyester Laser Labels", path: "/products/2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case" },
      { sku: "MFL1295", title: "12 1/8 x 9 1/4 x 5 White Corrugated Literature Mailer", path: "/products/12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack" },
      { sku: "AB205", title: "3x5 2 Mil Clear Poly Bags on Roll", path: "/products/3x5-2-mil-clear-poly-bags-on-roll-auto-fill-compatible-3000-roll" },
      { sku: "T155000", title: "1.5 x 500 Kraft Water Activated Tape", path: "/products/1-5-x-500-kraft-water-activated-tape-strong-carton-seal-case-of-20" },
      { sku: "MSF2060B", title: "20 x 60 Gauge x 7500 Blown Machine Stretch Film", path: "/products/20-x-60-gauge-x-7500-blown-machine-stretch-film-superior-load-retention" },
      { sku: "1044", title: "10x4x4 ECT-32 Kraft Corrugated Long Boxes", path: "/products/10x4x4-ect-32-kraft-corrugated-long-boxes-25-pack-bundle" },
      { sku: "M1033", title: "10x3x3 ECT-32-B White Corrugated Mailers", path: "/products/10x3x3-ect-32-b-white-corrugated-mailers-crush-resistant-50-bundle" },
    ],
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeBasicEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function firstMatch(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeBasicEntities(stripTags(match[1]));
  }
  return "";
}

function safeEventText(value: unknown, maxLength = 180): string {
  return String(value ?? "")
    .replace(/[^\w\s:/?&.=#%+@-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeEventNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function aiSalesCorsHeaders(origin: string | undefined | null): Record<string, string> {
  const allowedOrigins = new Set(["https://packrift.com", "https://www.packrift.com", "https://mcp.packrift.com"]);
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : "https://packrift.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeAiSalesDate(value: string | null): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? String(value) : todayUtc();
}

function normalizeAiSalesEvent(raw: Record<string, unknown>, request: Request) {
  const event = safeEventText(raw.event, 80);
  if (!AI_SALES_ALLOWED_EVENTS.has(event)) return null;
  const pageUrl = safeEventText(raw.page_url, 500);
  const requestUserAgent = request.headers.get("User-Agent") ?? "";
  const userAgent = safeEventText(raw.user_agent, 240) || safeEventText(requestUserAgent, 240);
  const botFamily = safeEventText(raw.bot_family, 80) || classifyAgentFamily(userAgent);
  let hostname = "";
  try {
    hostname = pageUrl ? safeEventText(new URL(pageUrl).hostname, 80) : "";
  } catch {
    hostname = "";
  }
  return {
    event,
    source: safeEventText(raw.source, 80) || "unknown",
    tool_name: safeEventText(raw.tool_name, 80),
    release: safeEventText(raw.release, 120),
    sku: safeEventText(raw.sku, 80),
    handle: safeEventText(raw.handle, 180),
    family: safeEventText(raw.family, 80),
    product_id: safeEventText(raw.product_id, 80),
    variant_id: safeEventText(raw.variant_id, 80),
    quantity: safeEventText(raw.quantity, 40),
    cart_item_count: safeEventText(raw.cart_item_count, 40),
    result_count: safeEventNumber(raw.result_count),
    fit_score: safeEventNumber(raw.fit_score),
    requested_spec: safeEventText(raw.requested_spec, 220),
    query: safeEventText(raw.query, 220),
    match_type: safeEventText(raw.match_type, 80),
    packrift_ai_id:
      safeEventText(raw.packrift_ai_id, 160) ||
      safeEventText(raw.ai_commerce_id, 160) ||
      safeEventText(raw.mcp_journey, 160) ||
      safeEventText(raw.mcp_key, 120),
    ai_commerce_id:
      safeEventText(raw.ai_commerce_id, 160) ||
      safeEventText(raw.packrift_ai_id, 160) ||
      safeEventText(raw.mcp_journey, 160) ||
      safeEventText(raw.mcp_key, 120),
    mcp_key: safeEventText(raw.mcp_key, 120),
    mcp_journey: safeEventText(raw.mcp_journey, 160),
    mcp_session_id: safeEventText(raw.mcp_session_id, 120),
    mcp_source_context: safeEventText(raw.mcp_source_context, 80),
    mcp_install_target: safeEventText(raw.mcp_install_target, 80),
    mcp_result_set: safeEventText(raw.mcp_result_set, 160),
    utm_source: safeEventText(raw.utm_source, 80),
    utm_medium: safeEventText(raw.utm_medium, 80),
    utm_campaign: safeEventText(raw.utm_campaign, 120),
    utm_content: safeEventText(raw.utm_content, 120),
    utm_term: safeEventText(raw.utm_term, 160),
    source_url: safeEventText(raw.source_url, 500),
    cart_url: safeEventText(raw.cart_url, 500),
    final_cart_url: safeEventText(raw.final_cart_url, 500),
    page_url: pageUrl,
    referrer: safeEventText(raw.referrer, 500),
    bot_family: botFamily,
    format: safeEventText(raw.format, 40),
    user_agent: userAgent,
    hostname,
    received_at: new Date().toISOString(),
  };
}

function classifyAgentFamily(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("oai-searchbot")) return "openai_oai_searchbot";
  if (ua.includes("chatgpt-user")) return "openai_chatgpt_user";
  if (ua.includes("gptbot")) return "openai_gptbot";
  if (ua.includes("perplexitybot")) return "perplexity_bot";
  if (ua.includes("perplexity-user")) return "perplexity_user";
  if (ua.includes("storebot-google")) return "google_storebot";
  if (ua.includes("googlebot-image")) return "googlebot_image";
  if (ua.includes("googlebot")) return "googlebot";
  if (ua.includes("bingpreview")) return "bing_preview";
  if (ua.includes("bingbot")) return "bingbot";
  if (ua.includes("claudebot")) return "anthropic_claudebot";
  if (ua.includes("anthropic-ai")) return "anthropic_ai";
  if (ua.includes("cline")) return "cline_mcp_client";
  if (ua.includes("cursor")) return "cursor_mcp_client";
  if (ua.includes("windsurf")) return "windsurf_mcp_client";
  if (ua.includes("roo")) return "roo_mcp_client";
  if (ua.includes("vscode") || ua.includes("vs code")) return "vscode_mcp_client";
  if (ua.includes("codex")) return "codex_mcp_client";
  if (ua.includes("claude")) return "claude_mcp_client";
  if (ua.includes("browserbase") || ua.includes("browse")) return "browserbase_browse_client";
  if (ua.includes("glama")) return "glama_mcp_client";
  if (ua.includes("smithery")) return "smithery_mcp_client";
  if (ua.includes("chatmcp") || ua.includes("mcp.so")) return "mcp_so_client";
  if (ua.includes("modelcontextprotocol") || ua.includes("mcp-client") || /\bmcp\b/.test(ua)) return "generic_mcp_client";
  if (ua.includes("bytespider")) return "bytedance_bytespider";
  if (ua.includes("duckduckbot")) return "duckduckbot";
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) return "other_bot";
  return "browser_or_unknown";
}

function shouldSkipInternalTelemetry(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("packrift-") ||
    ua.includes("packriftmcp") ||
    ua.includes("routecatalogqa") ||
    ua.includes("packriftqa") ||
    ua.includes("criticalpathqa")
  );
}

function shouldRecordSkuPageViewTelemetry(env: Env, userAgent: string, botFamily: string): boolean {
  if (env.AI_SALES_SKU_PAGE_TELEMETRY !== "enabled") return false;
  if (shouldSkipInternalTelemetry(userAgent)) return false;
  return botFamily === "browser_or_unknown" || botFamily === "openai_chatgpt_user" || botFamily === "perplexity_user";
}

function conversionRouteTelemetrySurface(pathname: string): "conversion_route_catalog" | "conversion_starter_routes" | "conversion_route_telemetry_watch" | "measured_handoff_directory" | "" {
  if (pathname.startsWith("/ai/conversion-route-catalog.")) return "conversion_route_catalog";
  if (pathname.startsWith("/ai/conversion-starter-routes.")) return "conversion_starter_routes";
  if (pathname.startsWith("/ai/conversion-route-telemetry-watch.")) return "conversion_route_telemetry_watch";
  if (pathname.startsWith("/ai/measured-handoffs.")) return "measured_handoff_directory";
  return "";
}

function compactDate(value = new Date()): string {
  return value.toISOString().slice(0, 10).replaceAll("-", "");
}

function campaignDate(value = new Date()): string {
  return value.toISOString().slice(0, 10).replaceAll("-", "_");
}

function shouldRecordConversionRouteResourceTelemetry(env: Env, userAgent: string): boolean {
  if (env.AI_SALES_SKU_PAGE_TELEMETRY !== "enabled") return false;
  return !shouldSkipInternalTelemetry(userAgent);
}

function routeLandingTelemetrySurface(
  url: URL
): "conversion_route_catalog" | "conversion_starter_routes" | "measured_handoff_directory" | "shopify_ai_exact_spec_data_page" | "create_cart_url" | "" {
  const source = (url.searchParams.get("utm_source") ?? "").toLowerCase();
  const medium = (url.searchParams.get("utm_medium") ?? "").toLowerCase();
  const campaign = (url.searchParams.get("utm_campaign") ?? "").toLowerCase();
  if (source === "chatgpt-mcp" && medium === "mcp_tool" && campaign === "create_cart_url") return "create_cart_url";
  if (source === "conversion_route_catalog") return "conversion_route_catalog";
  if (source === "conversion_starter_routes") return "conversion_starter_routes";
  if (source === "measured_handoff_directory") return "measured_handoff_directory";
  if (source === "shopify_ai_exact_spec_data_page") return "shopify_ai_exact_spec_data_page";

  const continuity = [
    url.searchParams.get("packrift_ai_id"),
    url.searchParams.get("ai_commerce_id"),
    url.searchParams.get("mcp_journey"),
    url.searchParams.get("mcp_result_set"),
    url.searchParams.get("utm_campaign"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (continuity.includes("conversion_route_catalog")) return "conversion_route_catalog";
  if (continuity.includes("conversion_starter_routes")) return "conversion_starter_routes";
  if (continuity.includes("measured_handoff_directory")) return "measured_handoff_directory";
  if (continuity.includes("shopify_ai_exact_spec_data_page")) return "shopify_ai_exact_spec_data_page";
  return "";
}

function routeLandingEventName(url: URL): "product_click" | "reorder_click" | "quote_click" | "cart_click" | "ai_corpus_click" {
  const content = (url.searchParams.get("utm_content") ?? "").toLowerCase();
  const campaign = (url.searchParams.get("utm_campaign") ?? "").toLowerCase();
  if (url.pathname.startsWith("/cart/") || content === "create_cart_url" || content === "cart_click" || campaign === "create_cart_url") {
    return "cart_click";
  }
  if (url.pathname.startsWith("/products/") || content === "view_product" || content === "product_click") {
    return "product_click";
  }
  if (url.pathname === "/pages/reorder-packaging-by-sku" || content === "reorder_by_sku" || content === "reorder_click") {
    return "reorder_click";
  }
  if (
    url.pathname === "/pages/bulk-quote" ||
    content === "request_bulk_quote" ||
    content === "bulk_quote" ||
    content === "quote_click"
  ) {
    return "quote_click";
  }
  return "ai_corpus_click";
}

function hasInternalProofParams(url: URL): boolean {
  return ["proof", "synthetic", "qa", "smoke", "test"].some((key) => {
    const value = url.searchParams.get(key);
    return value !== null && value !== "0" && value.toLowerCase() !== "false";
  });
}

function routeLandingHandle(url: URL): string {
  if (!url.pathname.startsWith("/products/")) return "";
  const handle = url.pathname.split("/").filter(Boolean).pop() ?? "";
  try {
    return decodeURIComponent(handle);
  } catch {
    return handle;
  }
}

function copyRouteTrackingParams(source: URL, target: URL): URL {
  const fields = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "packrift_ai_id",
    "ai_commerce_id",
    "mcp_key",
    "mcp_journey",
    "mcp_result_set",
    "match_type",
  ];
  for (const field of fields) {
    const value = source.searchParams.get(field);
    if (value) target.searchParams.set(field, value);
  }
  return target;
}

function copyRouteCartAttributeParams(source: URL, target: URL): URL {
  const attributes: Record<string, string | null> = {
    packrift_packrift_ai_id: source.searchParams.get("packrift_ai_id") ?? source.searchParams.get("ai_commerce_id"),
    packrift_ai_commerce_id: source.searchParams.get("ai_commerce_id") ?? source.searchParams.get("packrift_ai_id"),
    packrift_mcp_handoff_id: source.searchParams.get("mcp_handoff_id"),
    packrift_mcp_key: source.searchParams.get("mcp_key"),
    packrift_mcp_journey: source.searchParams.get("mcp_journey"),
    packrift_mcp_result_set: source.searchParams.get("mcp_result_set"),
    packrift_match_type: source.searchParams.get("match_type"),
    packrift_utm_source: source.searchParams.get("utm_source"),
    packrift_utm_medium: source.searchParams.get("utm_medium"),
    packrift_utm_campaign: source.searchParams.get("utm_campaign"),
    packrift_utm_content: source.searchParams.get("utm_content"),
    packrift_utm_term: source.searchParams.get("utm_term"),
  };
  for (const [key, value] of Object.entries(attributes)) {
    if (value) target.searchParams.set(`attributes[${key}]`, value);
  }
  return target;
}

function routeRedirectTargetUrl(action: RouteRedirectAction, item: ApprovedCatalogItem, requestUrl: URL): URL {
  if (action === "product") {
    return copyRouteTrackingParams(requestUrl, new URL(productHandoffUrlForItem(item)));
  }
  if (action === "reorder") {
    const target = new URL("https://packrift.com/pages/reorder-packaging-by-sku");
    target.searchParams.set("view", "packrift_ai_reorder_live_r07");
    target.searchParams.set("sku", item.sku);
    target.hash = skuAnchor(item.sku);
    return copyRouteTrackingParams(requestUrl, target);
  }
  if (action === "cart") {
    const quantity = boundedInteger(requestUrl.searchParams.get("qty") ?? requestUrl.searchParams.get("quantity"), 1, 1, 999);
    return copyRouteCartAttributeParams(requestUrl, copyRouteTrackingParams(requestUrl, new URL(cartUrlForItem(item, quantity))));
  }

  const target = new URL("https://packrift.com/pages/bulk-quote");
  target.searchParams.set("sku", item.sku);
  target.searchParams.set("product", item.title);
  target.searchParams.set("product_url", productUrlForItem(item));
  if (item.family) target.searchParams.set("family", item.family);
  const spec = requestUrl.searchParams.get("spec");
  target.searchParams.set("spec", spec || item.title);
  return copyRouteTrackingParams(requestUrl, target);
}

function cartLandingResponse(requestUrl: URL, item: ApprovedCatalogItem): Response {
  const quantity = boundedInteger(requestUrl.searchParams.get("qty") ?? requestUrl.searchParams.get("quantity"), 1, 1, 999);
  const finalCartUrl = routeRedirectTargetUrl("cart", item, requestUrl).toString();
  const pageTitle = `Packrift cart for ${item.sku}`;
  const suppressGa4CartLanding = hasInternalProofParams(requestUrl);
  const cartLandingScript = suppressGa4CartLanding
    ? "window.setTimeout(continueToCart, 750);"
    : `gtag('event', 'mcp_cart_landing', {
      event_callback: continueToCart,
      event_timeout: 2500,
      transport_type: 'beacon',
      sku: ${JSON.stringify(item.sku)},
      quantity: ${quantity},
      page_location: window.location.href,
      source: ${JSON.stringify(requestUrl.searchParams.get("utm_source") ?? "")},
      medium: ${JSON.stringify(requestUrl.searchParams.get("utm_medium") ?? "")},
      campaign: ${JSON.stringify(requestUrl.searchParams.get("utm_campaign") ?? "")},
      content: ${JSON.stringify(requestUrl.searchParams.get("utm_content") ?? "")},
      term: ${JSON.stringify(requestUrl.searchParams.get("utm_term") ?? "")},
      packrift_ai_id: ${JSON.stringify(requestUrl.searchParams.get("packrift_ai_id") ?? "")},
      ai_commerce_id: ${JSON.stringify(requestUrl.searchParams.get("ai_commerce_id") ?? "")},
      mcp_handoff_id: ${JSON.stringify(requestUrl.searchParams.get("mcp_handoff_id") ?? "")},
      mcp_key: ${JSON.stringify(requestUrl.searchParams.get("mcp_key") ?? "")},
      mcp_journey: ${JSON.stringify(requestUrl.searchParams.get("mcp_journey") ?? "")},
      mcp_result_set: ${JSON.stringify(requestUrl.searchParams.get("mcp_result_set") ?? "")},
      match_type: ${JSON.stringify(requestUrl.searchParams.get("match_type") ?? "")}
    });
    window.setTimeout(continueToCart, 3000);`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, follow">
  <title>${escapeHtml(pageTitle)}</title>
  <script async src="https://www.googletagmanager.com/gtag/js?id=${PACKRIFT_GA4_MEASUREMENT_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${PACKRIFT_GA4_MEASUREMENT_ID}', {
      page_location: window.location.href,
      send_page_view: true
    });
    const finalCartUrl = ${JSON.stringify(finalCartUrl)};
    let redirected = false;
    function continueToCart() {
      if (redirected) return;
      redirected = true;
      window.location.replace(finalCartUrl);
    }
    ${cartLandingScript}
  </script>
  <noscript><meta http-equiv="refresh" content="1;url=${escapeHtml(finalCartUrl)}"></noscript>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f6f1;color:#182235}
    main{max-width:520px;padding:28px}
    h1{font-size:1.35rem;margin:0 0 8px}
    p{margin:0 0 14px;color:#526070;line-height:1.45}
    a{color:#0f5caa}
  </style>
</head>
<body>
  <main>
    <h1>Preparing Packrift cart</h1>
    <p>SKU ${escapeHtml(item.sku)} is being opened in a tracked Packrift cart.</p>
    <p><a href="${escapeHtml(finalCartUrl)}">Continue to cart</a></p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "x-packrift-cart-landing-shim": CART_LANDING_SHIM_RELEASE,
    },
  });
}

function routeRedirectUrlForItem(item: ApprovedCatalogItem, action: RouteRedirectAction, source = "conversion_route_catalog"): string {
  const actionContent =
    action === "product"
      ? "view_product"
      : action === "reorder"
        ? "reorder_by_sku"
        : action === "cart"
          ? "create_cart_url"
          : "request_bulk_quote";
  const url = new URL(`https://mcp.packrift.com/r/${action}/${encodeURIComponent(item.sku)}`);
  const day = compactDate();
  url.searchParams.set("utm_source", action === "cart" ? "chatgpt-mcp" : source);
  url.searchParams.set("utm_medium", action === "cart" ? "mcp_tool" : "ai_retrieval");
  url.searchParams.set("utm_campaign", action === "cart" ? "create_cart_url" : `packrift_${source}_${campaignDate()}`);
  url.searchParams.set("utm_content", action === "cart" ? item.sku : actionContent);
  url.searchParams.set("utm_term", item.sku);
  url.searchParams.set("packrift_ai_id", `${source}_${day}_${item.sku}_${actionContent}`);
  url.searchParams.set("ai_commerce_id", `${source}_${day}_${item.sku}_${actionContent}`);
  url.searchParams.set("mcp_key", item.sku);
  url.searchParams.set("mcp_journey", `${source}:${item.sku}:${actionContent}`);
  url.searchParams.set("mcp_result_set", `${source}_${day}`);
  url.searchParams.set("match_type", "exact_match");
  if (action === "reorder") {
    url.searchParams.set("view", "packrift_ai_reorder_live_r07");
    url.searchParams.set("sku", item.sku);
    url.hash = skuAnchor(item.sku);
  }
  if (action === "quote") {
    url.searchParams.set("sku", item.sku);
    url.searchParams.set("family", item.family || "other");
    url.searchParams.set("spec", item.title);
    url.searchParams.set("product", item.title);
    url.searchParams.set("product_url", productUrlForItem(item));
  }
  if (action === "cart") {
    url.searchParams.set("ref", "mcp");
    url.searchParams.set("qty", "1");
  }
  return url.toString();
}

function mcpStartRedirectTargetUrl(source: string, requestUrl: URL): URL {
  const day = compactDate();
  const url = new URL("https://mcp.packrift.com/start");
  const content = requestUrl.searchParams.get("utm_content") || "start_page";
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", requestUrl.searchParams.get("utm_medium") || "directory_recrawl");
  url.searchParams.set("utm_campaign", requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_start");
  url.searchParams.set("utm_content", content);
  url.searchParams.set("packrift_ai_id", `mcp_start_${source}_${day}`);
  url.searchParams.set("ai_commerce_id", `mcp_start_${source}_${day}`);
  url.searchParams.set("mcp_key", `start:${source}`);
  url.searchParams.set("mcp_journey", `directory_recrawl:${source}:start`);
  url.searchParams.set("mcp_result_set", `mcp_start_${day}`);
  return url;
}

async function recordMcpStartRedirectTelemetry(
  env: Env,
  request: Request,
  requestUrl: URL,
  source: string,
  targetUrl: URL
): Promise<void> {
  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!shouldRecordRouteLandingTelemetry(env, userAgent)) return;
  const packriftAiId = targetUrl.searchParams.get("packrift_ai_id") || `mcp_start_${source}_${compactDate()}`;
  await recordAiSalesEvent(env, {
    event: "mcp_start_click",
    source: "mcp_start_redirect",
    release: MCP_START_REDIRECT_TELEMETRY_RELEASE,
    packrift_ai_id: packriftAiId,
    ai_commerce_id: targetUrl.searchParams.get("ai_commerce_id") || packriftAiId,
    mcp_key: targetUrl.searchParams.get("mcp_key") ?? `start:${source}`,
    mcp_journey: targetUrl.searchParams.get("mcp_journey") ?? `directory_recrawl:${source}:start`,
    mcp_result_set: targetUrl.searchParams.get("mcp_result_set") ?? `mcp_start_${compactDate()}`,
    utm_source: targetUrl.searchParams.get("utm_source") ?? source,
    utm_medium: targetUrl.searchParams.get("utm_medium") ?? "directory_recrawl",
    utm_campaign: targetUrl.searchParams.get("utm_campaign") ?? "packrift_mcp_start",
    utm_content: targetUrl.searchParams.get("utm_content") ?? "start_page",
    source_url: requestUrl.toString(),
    page_url: targetUrl.toString(),
    referrer: request.headers.get("Referer") ?? "",
    bot_family: classifyAgentFamily(userAgent),
  });
}

async function recordMcpInstallIntentTelemetry(
  env: Env,
  request: Request,
  requestUrl: URL,
  source: string,
  target: string,
  resultSizeBytes: number
): Promise<void> {
  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!shouldRecordRouteLandingTelemetry(env, userAgent)) return;
  const day = compactDate();
  const id = `mcp_install_intent_${source}_${target}_${day}`;
  const format = safeEventText(requestUrl.searchParams.get("format") || "json", 40);
  await recordAiSalesEvent(env, {
    event: "mcp_install_intent",
    source: "mcp_install_action",
    release: MCP_INSTALL_ACTION_RELEASE,
    ok: true,
    mcp_method: "http_get",
    tool_name: safeEventText(target, 80),
    resource_uri: `https://mcp.packrift.com/r/install/${source}/${target}`,
    format,
    result_count: 1,
    result_size_bytes: resultSizeBytes,
    transport: "http_get",
    user_agent: safeEventText(userAgent, 240),
    bot_family: classifyAgentFamily(userAgent),
    packrift_ai_id: id,
    ai_commerce_id: id,
    mcp_key: `install_intent:${source}:${target}`,
    mcp_journey: `mcp_install_action:${source}:open:${target}`,
    mcp_result_set: `mcp_install_action_${day}`,
    utm_source: source,
    utm_medium: requestUrl.searchParams.get("utm_medium") || "install_action",
    utm_campaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_install",
    utm_content: requestUrl.searchParams.get("utm_content") || target,
    source_url: `https://mcp.packrift.com/r/install/${source}/${target}`,
    page_url: requestUrl.toString(),
    referrer: request.headers.get("Referer") ?? "",
  });
}

async function recordMcpFirstRunIntentTelemetry(
  env: Env,
  request: Request,
  requestUrl: URL,
  source: string,
  target: string,
  resultSizeBytes: number
): Promise<void> {
  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!shouldRecordRouteLandingTelemetry(env, userAgent)) return;
  const day = compactDate();
  const id = `mcp_first_run_intent_${source}_${target}_${day}`;
  const format = safeEventText(requestUrl.searchParams.get("format") || "json", 40);
  await recordAiSalesEvent(env, {
    event: "mcp_first_run_intent",
    source: "mcp_first_run_action",
    release: MCP_FIRST_RUN_ACTION_RELEASE,
    ok: true,
    mcp_method: "http_get",
    tool_name: safeEventText(target, 80),
    resource_uri: `https://mcp.packrift.com/r/run/${source}/${target}`,
    format,
    result_count: 1,
    result_size_bytes: resultSizeBytes,
    transport: "http_get",
    user_agent: safeEventText(userAgent, 240),
    bot_family: classifyAgentFamily(userAgent),
    packrift_ai_id: id,
    ai_commerce_id: id,
    mcp_key: `first_run:${source}:${target}`,
    mcp_journey: `mcp_first_run_action:${source}:open:${target}`,
    mcp_result_set: `mcp_first_run_action_${day}`,
    utm_source: source,
    utm_medium: requestUrl.searchParams.get("utm_medium") || "first_run_action",
    utm_campaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_activation",
    utm_content: requestUrl.searchParams.get("utm_content") || target,
    source_url: `https://mcp.packrift.com/r/run/${source}/${target}`,
    page_url: requestUrl.toString(),
    referrer: request.headers.get("Referer") ?? "",
  });
}

async function recordMcpFirstRunExecutionTelemetry(
  env: Env,
  request: Request,
  requestUrl: URL,
  meta: {
    source: string;
    target: string;
    ok: boolean;
    sku?: string;
    handle?: string;
    variantId?: string;
    cartUrl?: string;
    finalCartUrl?: string;
    error?: string;
    latencyMs?: number;
  }
): Promise<void> {
  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!shouldRecordRouteLandingTelemetry(env, userAgent)) return;
  const day = compactDate();
  const id = `mcp_first_run_execution_${meta.source}_${meta.target}_${day}`;
  const cartParams = urlParamsFromValue(meta.cartUrl);
  await recordAiSalesEvent(env, {
    event: "mcp_first_run_execution",
    source: "mcp_first_run_action",
    release: MCP_FIRST_RUN_ACTION_RELEASE,
    ok: meta.ok,
    mcp_method: "http_get_execute",
    tool_name: safeEventText(meta.target, 80),
    sku: safeEventText(meta.sku, 80),
    handle: safeEventText(meta.handle, 180),
    variant_id: safeEventText(meta.variantId, 80),
    match_type: "first_run_action_browser_execution",
    resource_uri: `https://mcp.packrift.com/r/run/${meta.source}/${meta.target}`,
    format: "browser_execute",
    result_count: meta.ok ? 1 : 0,
    latency_ms: meta.latencyMs ?? null,
    transport: "http_get",
    user_agent: safeEventText(userAgent, 240),
    bot_family: classifyAgentFamily(userAgent),
    packrift_ai_id: id,
    ai_commerce_id: id,
    mcp_handoff_id: cartParams?.get("mcp_handoff_id") ?? "",
    mcp_key: `first_run_execution:${meta.source}:${meta.target}`,
    mcp_journey: `mcp_first_run_action:${meta.source}:execute:${meta.target}`,
    mcp_result_set: `mcp_first_run_action_${day}`,
    utm_source: meta.source,
    utm_medium: requestUrl.searchParams.get("utm_medium") || "first_run_action",
    utm_campaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_activation",
    utm_content: requestUrl.searchParams.get("utm_content") || meta.target,
    utm_term: meta.sku ?? "1066",
    source_url: `https://mcp.packrift.com/r/run/${meta.source}/${meta.target}`,
    page_url: requestUrl.toString(),
    referrer: request.headers.get("Referer") ?? "",
    cart_url: safeEventText(meta.cartUrl, 500),
    final_cart_url: safeEventText(meta.finalCartUrl, 500),
    error: safeEventText(meta.error, 240),
  });
}

async function recordRouteRedirectTelemetry(
  env: Env,
  request: Request,
  requestUrl: URL,
  action: RouteRedirectAction,
  item: ApprovedCatalogItem
): Promise<void> {
  if (action === "cart" && hasInternalProofParams(requestUrl)) return;
  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!shouldRecordRouteLandingTelemetry(env, userAgent)) return;
  const surface = routeLandingTelemetrySurface(requestUrl) || "mcp_route_redirect";
  const event = action === "product" ? "product_click" : action === "reorder" ? "reorder_click" : action === "cart" ? "cart_click" : "quote_click";
  const packriftAiId =
    requestUrl.searchParams.get("packrift_ai_id") ||
    requestUrl.searchParams.get("ai_commerce_id") ||
    `${surface}_${compactDate()}_${item.sku}_${event}`;

  const basePayload = {
    source: surface,
    release: ROUTE_REDIRECT_SERVER_TELEMETRY_RELEASE,
    sku: item.sku,
    handle: item.handle,
    family: item.family || "",
    variant_id: action === "cart" ? item.variantId : "",
    quantity: action === "cart" ? String(boundedInteger(requestUrl.searchParams.get("qty") ?? requestUrl.searchParams.get("quantity"), 1, 1, 999)) : "",
    requested_spec: requestUrl.searchParams.get("spec") ?? "",
    match_type: requestUrl.searchParams.get("match_type") ?? "",
    packrift_ai_id: packriftAiId,
    ai_commerce_id: requestUrl.searchParams.get("ai_commerce_id") || packriftAiId,
    mcp_handoff_id: requestUrl.searchParams.get("mcp_handoff_id") ?? "",
    mcp_key: requestUrl.searchParams.get("mcp_key") ?? item.sku,
    mcp_journey: requestUrl.searchParams.get("mcp_journey") ?? `${surface}:${item.sku}:${event}`,
    mcp_result_set: requestUrl.searchParams.get("mcp_result_set") ?? `${surface}_${compactDate()}`,
    utm_source: requestUrl.searchParams.get("utm_source") ?? surface,
    utm_medium: requestUrl.searchParams.get("utm_medium") ?? "ai_retrieval",
    utm_campaign: requestUrl.searchParams.get("utm_campaign") ?? "",
    utm_content: requestUrl.searchParams.get("utm_content") ?? event,
    utm_term: requestUrl.searchParams.get("utm_term") ?? item.sku,
    source_url: requestUrl.toString(),
    page_url: requestUrl.toString(),
    referrer: request.headers.get("Referer") ?? "",
    bot_family: classifyAgentFamily(userAgent),
  };

  await recordAiSalesEvent(env, {
    event,
    ...basePayload,
  });

  if (action === "cart") {
    await recordAiSalesEvent(env, {
      event: "mcp_cart_landing",
      ...basePayload,
      landing_url: requestUrl.toString(),
    });
  }
}

function shouldRecordRouteLandingTelemetry(env: Env, userAgent: string): boolean {
  if (env.AI_SALES_SKU_PAGE_TELEMETRY !== "enabled") return false;
  return !shouldSkipInternalTelemetry(userAgent);
}

async function maybeRecordRouteLandingTelemetry(
  env: Env,
  request: Request,
  url: URL,
  response: Response
): Promise<void> {
  if (request.method !== "GET" || response.status < 200 || response.status >= 400) return;
  const surface = routeLandingTelemetrySurface(url);
  if (!surface) return;

  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!shouldRecordRouteLandingTelemetry(env, userAgent)) return;

  const event = routeLandingEventName(url);
  const sku =
    url.searchParams.get("utm_term") ||
    url.searchParams.get("sku") ||
    url.searchParams.get("mcp_key") ||
    "";
  const fallbackId = `${surface}_${compactDate()}_${sku || "unknown"}_${event}`;
  const packriftAiId = url.searchParams.get("packrift_ai_id") || url.searchParams.get("ai_commerce_id") || fallbackId;
  const botFamily = classifyAgentFamily(userAgent);

  await recordAiSalesEvent(env, {
    event,
    source: surface,
    release: ROUTE_LANDING_SERVER_TELEMETRY_RELEASE,
    sku,
    handle: routeLandingHandle(url),
    family: url.searchParams.get("family") ?? "",
    requested_spec: url.searchParams.get("spec") ?? "",
    match_type: url.searchParams.get("match_type") ?? "",
    packrift_ai_id: packriftAiId,
    ai_commerce_id: url.searchParams.get("ai_commerce_id") || packriftAiId,
    mcp_handoff_id: url.searchParams.get("mcp_handoff_id") ?? "",
    mcp_key: url.searchParams.get("mcp_key") ?? sku,
    mcp_journey: url.searchParams.get("mcp_journey") ?? "",
    mcp_result_set: url.searchParams.get("mcp_result_set") ?? "",
    utm_source: url.searchParams.get("utm_source") ?? "",
    utm_medium: url.searchParams.get("utm_medium") ?? "",
    utm_campaign: url.searchParams.get("utm_campaign") ?? "",
    utm_content: url.searchParams.get("utm_content") ?? "",
    utm_term: url.searchParams.get("utm_term") ?? sku,
    source_url: url.toString(),
    page_url: url.toString(),
    referrer: request.headers.get("Referer") ?? "",
    bot_family: botFamily,
  });
}

async function recordAiSalesEvent(env: Env, payload: Record<string, unknown>): Promise<void> {
  const receivedAt = new Date().toISOString();
  try {
    await env.CATALOG_CACHE.put(
      `${AI_SALES_EVENT_PREFIX}/${receivedAt.slice(0, 10)}/${receivedAt}-${crypto.randomUUID()}.json`,
      JSON.stringify({ ...payload, received_at: receivedAt }),
      { expirationTtl: AI_SALES_EVENT_TTL_SECONDS }
    );
  } catch {
    // Telemetry must never affect buyer or crawler access.
  }
}

function jsonByteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function urlParamsFromValue(value: unknown): URLSearchParams | null {
  if (typeof value !== "string" || !value) return null;
  try {
    return new URL(value).searchParams;
  } catch {
    return null;
  }
}

function textFrom(...values: unknown[]): string {
  for (const value of values) {
    const text = safeEventText(value, 180);
    if (text) return text;
  }
  return "";
}

function measuredCartUrlFromText(value: unknown): string {
  const text = safeEventText(value, 500);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.hostname === "mcp.packrift.com" && url.pathname.startsWith("/r/cart/") ? url.toString() : "";
  } catch {
    return "";
  }
}

function measuredCartUrlFromEvent(event: Record<string, unknown>): string {
  return measuredCartUrlFromText(event.cart_url) || measuredCartUrlFromText(event.source_url);
}

function buildToolResultAttribution(out: unknown): Record<string, unknown> {
  const row = objectValue(out);
  if (!row) return {};
  const nestedCart = objectValue(row.cart);
  const cartTracking = objectValue(row.cart_tracking) ?? objectValue(nestedCart?.cart_tracking);
  const utm = objectValue(row.utm) ?? objectValue(nestedCart?.utm);
  const sourceUrl = typeof row.url === "string" && row.url ? row.url : typeof nestedCart?.url === "string" ? nestedCart.url : "";
  const finalCartUrl =
    typeof row.final_cart_url === "string" && row.final_cart_url
      ? row.final_cart_url
      : typeof nestedCart?.final_cart_url === "string"
        ? nestedCart.final_cart_url
        : "";
  const params = urlParamsFromValue(sourceUrl);
  return {
    packrift_ai_id: textFrom(cartTracking?.packrift_ai_id, params?.get("packrift_ai_id")),
    ai_commerce_id: textFrom(cartTracking?.ai_commerce_id, params?.get("ai_commerce_id"), cartTracking?.packrift_ai_id),
    mcp_handoff_id: textFrom(cartTracking?.mcp_handoff_id, params?.get("mcp_handoff_id")),
    mcp_key: textFrom(cartTracking?.mcp_key, cartTracking?.continuity_key, params?.get("mcp_key")),
    mcp_journey: textFrom(cartTracking?.mcp_journey, cartTracking?.journey_id, params?.get("mcp_journey")),
    mcp_result_set: textFrom(cartTracking?.mcp_result_set, cartTracking?.result_set_id, params?.get("mcp_result_set")),
    utm_source: textFrom(cartTracking?.utm_source, utm?.source, params?.get("utm_source")),
    utm_medium: textFrom(cartTracking?.utm_medium, utm?.medium, params?.get("utm_medium")),
    utm_campaign: textFrom(cartTracking?.utm_campaign, utm?.campaign, params?.get("utm_campaign")),
    utm_content: textFrom(cartTracking?.utm_content, utm?.content, params?.get("utm_content")),
    utm_term: textFrom(cartTracking?.utm_term, utm?.term, params?.get("utm_term")),
    source_url: safeEventText(sourceUrl, 500),
    cart_url: measuredCartUrlFromText(sourceUrl),
    final_cart_url: safeEventText(finalCartUrl, 500),
  };
}

function buildMcpToolCallEvent(
  name: string,
  out: unknown,
  meta: {
    latencyMs: number;
    resultSizeBytes: number;
    sessionId?: string;
    userAgent?: string;
    sourceSlug?: string;
    installTarget?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    ok: boolean;
    errorMessage?: string;
  }
): Record<string, unknown> {
  const row = summarizeToolResult(out);
  const attribution = mergeNonEmptyAttribution(mcpContinuityAttribution(meta, name), buildToolResultAttribution(out));
  const userAgent = meta.userAgent ?? "";
  return {
    event: "mcp_tool_call",
    source: "mcp_tool_call",
    tool_name: safeEventText(name, 80),
    ok: meta.ok,
    latency_ms: meta.latencyMs,
    result_size_bytes: meta.resultSizeBytes,
    mcp_session_id: safeEventText(meta.sessionId, 120),
    transport: "streamable_http",
    user_agent: safeEventText(userAgent, 240),
    bot_family: classifyAgentFamily(userAgent),
    error: safeEventText(meta.errorMessage, 240),
    result_count: row.result_count,
    sku: row.sku,
    handle: row.handle,
    family: row.family,
    match_type: row.match_type,
    ...attribution,
  };
}

async function recordMcpDiscoveryEvent(
  env: Env,
  eventName: string,
  meta: {
    mcpMethod: string;
    resultCount?: number;
    latencyMs?: number;
    resultSizeBytes?: number;
    sessionId?: string;
    userAgent?: string;
    sourceSlug?: string;
    installTarget?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    ok: boolean;
    errorMessage?: string;
    promptName?: string;
    resourceUri?: string;
    format?: string;
  }
): Promise<void> {
  const userAgent = meta.userAgent ?? "";
  if (shouldSkipInternalTelemetry(userAgent)) return;
  const attribution = mcpContinuityAttribution(meta, meta.mcpMethod);
  await recordAiSalesEvent(env, {
    event: eventName,
    source: "mcp_discovery",
    release: MCP_DISCOVERY_TELEMETRY_RELEASE,
    ok: meta.ok,
    mcp_method: safeEventText(meta.mcpMethod, 80),
    prompt_name: safeEventText(meta.promptName, 120),
    resource_uri: safeEventText(meta.resourceUri, 500),
    format: safeEventText(meta.format, 80),
    result_count: typeof meta.resultCount === "number" ? meta.resultCount : null,
    latency_ms: typeof meta.latencyMs === "number" ? meta.latencyMs : null,
    result_size_bytes: typeof meta.resultSizeBytes === "number" ? meta.resultSizeBytes : null,
    mcp_session_id: safeEventText(meta.sessionId, 120),
    transport: "streamable_http",
    user_agent: safeEventText(userAgent, 240),
    bot_family: classifyAgentFamily(userAgent),
    error: safeEventText(meta.errorMessage, 240),
    ...attribution,
  });
}

async function recordGeneratedAiResourceFetch(
  c: AppContext,
  pathname: string,
  source: string,
  resultSizeBytes: number,
  attribution?: {
    sourceSlug?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    mcpKeyPrefix?: string;
  }
): Promise<void> {
  if (c.env.AI_SALES_SKU_PAGE_TELEMETRY !== "enabled") return;
  const userAgent = c.req.header("User-Agent") ?? "";
  if (shouldSkipInternalTelemetry(userAgent)) return;
  const lastPathSegment = pathname.split("/").pop() ?? "";
  const format = lastPathSegment.includes(".") ? (lastPathSegment.split(".").pop() ?? "") : "json";
  const day = compactDate();
  const sourceSlug = attribution?.sourceSlug ? attribution.sourceSlug.toLowerCase() : "";
  const id = sourceSlug ? `${source}_${sourceSlug}_${day}_http_get_${format}` : `${source}_${day}_http_get_${format}`;
  const mcpKey = sourceSlug ? `${attribution?.mcpKeyPrefix ?? "config"}:${sourceSlug}` : source;
  await recordAiSalesEvent(c.env, {
    event: "mcp_resource_read",
    source,
    release: GENERATED_AI_RESOURCE_TELEMETRY_RELEASE,
    ok: true,
    mcp_method: "http_get",
    resource_uri: `https://mcp.packrift.com${pathname}`,
    format,
    result_count: 1,
    result_size_bytes: resultSizeBytes,
    transport: "http_get",
    user_agent: safeEventText(userAgent, 240),
    bot_family: classifyAgentFamily(userAgent),
    packrift_ai_id: id,
    ai_commerce_id: id,
    mcp_key: mcpKey,
    mcp_journey: sourceSlug ? `${source}:${sourceSlug}:http_get:${format}` : `${source}:http_get:${format}`,
    mcp_result_set: `${source}_${day}`,
    utm_source: sourceSlug || source,
    utm_medium: attribution?.utmMedium ?? "ai_resource",
    utm_campaign: attribution?.utmCampaign ?? `packrift_${source}_${campaignDate()}`,
    utm_content: attribution?.utmContent ?? `http_get_${format}`,
    source_url: `https://mcp.packrift.com${pathname}`,
    page_url: c.req.url,
    referrer: c.req.header("Referer") ?? "",
  });
}

function summarizeToolResult(out: unknown): {
  result_count: number;
  sku: string;
  handle: string;
  family: string;
  match_type: string;
} {
  const obj = out && typeof out === "object" ? (out as Record<string, unknown>) : {};
  const rows = Array.isArray(out)
    ? out
    : Array.isArray(obj.results)
      ? obj.results
      : Array.isArray(obj.items)
        ? obj.items
      : [];
  const first = (rows[0] && typeof rows[0] === "object" ? (rows[0] as Record<string, unknown>) : obj) ?? {};
  const match = first.match && typeof first.match === "object" ? (first.match as Record<string, unknown>) : {};
  const card = first.product_card && typeof first.product_card === "object" ? (first.product_card as Record<string, unknown>) : {};
  const noMatch = Boolean(obj.no_match_recovery || first.no_match_recovery);
  return {
    result_count: rows.length,
    sku: safeEventText(first.approved_sku ?? first.sku ?? card.sku, 80),
    handle: safeEventText(first.handle ?? card.handle, 180),
    family: safeEventText(first.approved_family ?? first.family ?? card.family, 80),
    match_type: safeEventText(match.match_type ?? first.match_type ?? (noMatch ? "no_exact_match" : rows.length ? "result" : "tool_call"), 80),
  };
}

function summarizeAiSalesEvents(events: Array<Record<string, unknown>>) {
  const byEvent: Record<string, number> = {};
  const bySku: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  const byPrompt: Record<string, number> = {};
  const byResource: Record<string, number> = {};
  const byMcpMethod: Record<string, number> = {};
  const byBotFamily: Record<string, number> = {};
  const byPackriftAiId: Record<string, number> = {};
  const byMcpHandoffId: Record<string, number> = {};
  const byMcpSessionId: Record<string, number> = {};
  const byMcpKey: Record<string, number> = {};
  const byMcpJourney: Record<string, number> = {};
  const byToolMcpKey: Record<string, number> = {};
  const byMcpSourceContext: Record<string, number> = {};
  const byMcpInstallTarget: Record<string, number> = {};
  const byToolMcpSourceContext: Record<string, number> = {};
  const byUtmSource: Record<string, number> = {};
  const byUtmMedium: Record<string, number> = {};
  const byUtmCampaign: Record<string, number> = {};
  const byUtmContent: Record<string, number> = {};
  const byEventSource: Record<string, number> = {};
  const byEventAttribution: Record<string, number> = {};
  const byStartSource: Record<string, number> = {};
  const byTrackedConfigSource: Record<string, number> = {};
  const byInstallIntentSource: Record<string, number> = {};
  const byInstallIntentTarget: Record<string, number> = {};
  const byFirstRunIntentSource: Record<string, number> = {};
  const byFirstRunIntentTarget: Record<string, number> = {};
  const byInstallCopySource: Record<string, number> = {};
  const byInstallCopyTarget: Record<string, number> = {};
  const latencyByTool: Record<string, number[]> = {};
  const trackedConfigSourceFromEvent = (event: Record<string, unknown>) => {
    if (String(event.event ?? "") !== "mcp_resource_read") return "";
    if (String(event.source ?? "") !== "mcp_client_config") return "";
    const eventMcpKey = String(event.mcp_key ?? "");
    if (eventMcpKey.startsWith("config:")) return safeEventText(eventMcpKey.slice("config:".length), 80);
    const eventResourceUri = String(event.resource_uri ?? "");
    const match = eventResourceUri.match(/\/r\/config\/([a-z0-9_]{2,64})(?:[/?#]|$)/);
    if (match?.[1]) return match[1];
    const eventUtmSource = safeEventText(event.utm_source, 80);
    return eventUtmSource && eventUtmSource !== "mcp_client_config" ? eventUtmSource : "";
  };
  for (const event of events) {
    const eventName = String(event.event ?? "unknown");
    const sku = String(event.sku ?? "") || "unknown";
    const source = String(event.source ?? "") || "unknown";
    const toolName = String(event.tool_name ?? "") || "unknown";
    const promptName = String(event.prompt_name ?? "") || "unknown";
    const resourceUri = String(event.resource_uri ?? "") || "unknown";
    const mcpMethod = String(event.mcp_method ?? "") || "unknown";
    const botFamily = String(event.bot_family ?? "") || "unknown";
    const packriftAiId = String(event.packrift_ai_id ?? event.ai_commerce_id ?? "") || "unknown";
    const mcpHandoffId = String(event.mcp_handoff_id ?? "") || "unknown";
    const mcpSessionId = String(event.mcp_session_id ?? "") || "unknown";
    const mcpKey = String(event.mcp_key ?? "") || "unknown";
    const mcpJourney = String(event.mcp_journey ?? "") || "unknown";
    const mcpSourceContext = String(event.mcp_source_context ?? "") || "unknown";
    const mcpInstallTarget = String(event.mcp_install_target ?? "") || "unknown";
    const utmSource = String(event.utm_source ?? "") || "unknown";
    const utmMedium = String(event.utm_medium ?? "") || "unknown";
    const utmCampaign = String(event.utm_campaign ?? "") || "unknown";
    const utmContent = String(event.utm_content ?? "") || "unknown";
    const matchType = String(event.match_type ?? "") || "unknown";
    byEvent[eventName] = (byEvent[eventName] ?? 0) + 1;
    bySku[sku] = (bySku[sku] ?? 0) + 1;
    bySource[source] = (bySource[source] ?? 0) + 1;
    byUtmSource[utmSource] = (byUtmSource[utmSource] ?? 0) + 1;
    byUtmMedium[utmMedium] = (byUtmMedium[utmMedium] ?? 0) + 1;
    byUtmCampaign[utmCampaign] = (byUtmCampaign[utmCampaign] ?? 0) + 1;
    byUtmContent[utmContent] = (byUtmContent[utmContent] ?? 0) + 1;
    byEventSource[`${eventName}|${source}`] = (byEventSource[`${eventName}|${source}`] ?? 0) + 1;
    byEventAttribution[`${eventName}|${source}|${utmSource}|${utmMedium}|${utmCampaign}|${mcpKey}|${matchType}|${botFamily}`] =
      (byEventAttribution[`${eventName}|${source}|${utmSource}|${utmMedium}|${utmCampaign}|${mcpKey}|${matchType}|${botFamily}`] ?? 0) + 1;
    if (eventName === "mcp_start_click") {
      const startSource = utmSource !== "unknown" ? utmSource : mcpKey.startsWith("start:") ? mcpKey.slice("start:".length) : "unknown";
      byStartSource[startSource] = (byStartSource[startSource] ?? 0) + 1;
    }
    const trackedConfigSource = trackedConfigSourceFromEvent(event);
    if (trackedConfigSource) {
      byTrackedConfigSource[trackedConfigSource] = (byTrackedConfigSource[trackedConfigSource] ?? 0) + 1;
    }
    if (eventName === "mcp_install_intent") {
      const installSource = utmSource !== "unknown" ? utmSource : mcpKey.startsWith("install_intent:") ? mcpKey.split(":")[1] || "unknown" : "unknown";
      const installTarget = toolName !== "unknown" ? toolName : utmContent !== "unknown" ? utmContent : "unknown";
      byInstallIntentSource[installSource] = (byInstallIntentSource[installSource] ?? 0) + 1;
      byInstallIntentTarget[installTarget] = (byInstallIntentTarget[installTarget] ?? 0) + 1;
    }
    if (eventName === "mcp_first_run_intent") {
      const firstRunSource = utmSource !== "unknown" ? utmSource : mcpKey.startsWith("first_run:") ? mcpKey.split(":")[1] || "unknown" : "unknown";
      const firstRunTarget = toolName !== "unknown" ? toolName : utmContent !== "unknown" ? utmContent : "unknown";
      byFirstRunIntentSource[firstRunSource] = (byFirstRunIntentSource[firstRunSource] ?? 0) + 1;
      byFirstRunIntentTarget[firstRunTarget] = (byFirstRunIntentTarget[firstRunTarget] ?? 0) + 1;
    }
    if (eventName === "mcp_install_copy") {
      const installSource = utmSource !== "unknown" ? utmSource : mcpKey.startsWith("install_copy:") ? mcpKey.split(":")[1] || "unknown" : "unknown";
      const installTarget = toolName !== "unknown" ? toolName : utmContent !== "unknown" ? utmContent : "unknown";
      byInstallCopySource[installSource] = (byInstallCopySource[installSource] ?? 0) + 1;
      byInstallCopyTarget[installTarget] = (byInstallCopyTarget[installTarget] ?? 0) + 1;
    }
    if (eventName === "mcp_prompt_get") byPrompt[promptName] = (byPrompt[promptName] ?? 0) + 1;
    if (eventName === "mcp_resource_read") byResource[resourceUri] = (byResource[resourceUri] ?? 0) + 1;
    if (mcpMethod !== "unknown") byMcpMethod[mcpMethod] = (byMcpMethod[mcpMethod] ?? 0) + 1;
    if (eventName === "mcp_tool_call") {
      byTool[toolName] = (byTool[toolName] ?? 0) + 1;
      if (mcpKey !== "unknown") {
        byToolMcpKey[`${toolName} | ${mcpKey}`] = (byToolMcpKey[`${toolName} | ${mcpKey}`] ?? 0) + 1;
      }
      if (typeof event.latency_ms === "number" && Number.isFinite(event.latency_ms)) {
        latencyByTool[toolName] = [...(latencyByTool[toolName] ?? []), event.latency_ms];
      }
    }
    byBotFamily[botFamily] = (byBotFamily[botFamily] ?? 0) + 1;
    byPackriftAiId[packriftAiId] = (byPackriftAiId[packriftAiId] ?? 0) + 1;
    if (mcpHandoffId !== "unknown") byMcpHandoffId[mcpHandoffId] = (byMcpHandoffId[mcpHandoffId] ?? 0) + 1;
    if (mcpSessionId !== "unknown") byMcpSessionId[mcpSessionId] = (byMcpSessionId[mcpSessionId] ?? 0) + 1;
    if (mcpKey !== "unknown") byMcpKey[mcpKey] = (byMcpKey[mcpKey] ?? 0) + 1;
    if (mcpJourney !== "unknown") byMcpJourney[mcpJourney] = (byMcpJourney[mcpJourney] ?? 0) + 1;
    if (mcpSourceContext !== "unknown") byMcpSourceContext[mcpSourceContext] = (byMcpSourceContext[mcpSourceContext] ?? 0) + 1;
    if (mcpInstallTarget !== "unknown") byMcpInstallTarget[mcpInstallTarget] = (byMcpInstallTarget[mcpInstallTarget] ?? 0) + 1;
    if (eventName === "mcp_tool_call" && mcpSourceContext !== "unknown") {
      byToolMcpSourceContext[`${toolName} | ${mcpSourceContext}`] = (byToolMcpSourceContext[`${toolName} | ${mcpSourceContext}`] ?? 0) + 1;
    }
  }
  const top = (obj: Record<string, number>, limit = 25) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([key, count]) => ({ key, count }));
  const latency = (rows: number[]) => {
    const sorted = [...rows].sort((a, b) => a - b);
    if (sorted.length === 0) return { count: 0, avg: null, p95: null };
    const avg = Math.round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length);
    const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return { count: sorted.length, avg, p95: sorted[p95Index] ?? null };
  };
  const toolLatency = Object.fromEntries(
    Object.entries(latencyByTool)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .slice(0, 25)
      .map(([toolName, rows]) => [toolName, latency(rows)])
  );
  const recent = (eventName: string, predicate?: (event: Record<string, unknown>) => boolean) =>
    events
      .filter((event) => String(event.event ?? "") === eventName && (!predicate || predicate(event)))
      .sort((a, b) => String(b.received_at ?? "").localeCompare(String(a.received_at ?? "")))
      .slice(0, 25)
      .map((event) => ({
        received_at: safeEventText(event.received_at, 40),
        source: safeEventText(event.source, 80),
        sku: safeEventText(event.sku, 80) || null,
        tool_name: safeEventText(event.tool_name, 80) || null,
        ok: typeof event.ok === "boolean" ? event.ok : null,
        latency_ms: typeof event.latency_ms === "number" ? event.latency_ms : null,
        result_size_bytes: typeof event.result_size_bytes === "number" ? event.result_size_bytes : null,
        handle: safeEventText(event.handle, 160) || null,
        family: safeEventText(event.family, 80) || null,
        requested_spec: safeEventText(event.requested_spec, 180) || null,
        query: safeEventText(event.query, 180) || null,
        prompt_name: safeEventText(event.prompt_name, 120) || null,
        resource_uri: safeEventText(event.resource_uri, 500) || null,
        mcp_method: safeEventText(event.mcp_method, 80) || null,
        use_case: safeEventText(event.use_case, 80) || null,
        result_count: typeof event.result_count === "number" ? event.result_count : null,
        fit_score: typeof event.fit_score === "number" ? event.fit_score : null,
        match_type: safeEventText(event.match_type, 80) || null,
        bot_family: safeEventText(event.bot_family, 80) || null,
        packrift_ai_id: safeEventText(event.packrift_ai_id ?? event.ai_commerce_id, 160) || null,
        mcp_handoff_id: safeEventText(event.mcp_handoff_id, 160) || null,
        mcp_session_id: safeEventText(event.mcp_session_id, 120) || null,
        mcp_key: safeEventText(event.mcp_key, 120) || null,
        mcp_journey: safeEventText(event.mcp_journey, 160) || null,
        mcp_source_context: safeEventText(event.mcp_source_context, 80) || null,
        mcp_install_target: safeEventText(event.mcp_install_target, 80) || null,
        mcp_result_set: safeEventText(event.mcp_result_set, 160) || null,
        cart_url: measuredCartUrlFromEvent(event) || null,
        final_cart_url: safeEventText(event.final_cart_url, 500) || null,
        utm_source: safeEventText(event.utm_source, 80) || null,
        utm_medium: safeEventText(event.utm_medium, 80) || null,
        utm_campaign: safeEventText(event.utm_campaign, 120) || null,
        utm_content: safeEventText(event.utm_content, 120) || null,
        utm_term: safeEventText(event.utm_term, 160) || null,
      }));
  return {
    total_events: events.length,
    by_event: top(byEvent),
    by_sku: top(bySku),
    by_source: top(bySource),
    by_tool: top(byTool),
    by_prompt: top(byPrompt),
    by_resource: top(byResource),
    by_mcp_method: top(byMcpMethod),
    tool_latency_ms: toolLatency,
    by_bot_family: top(byBotFamily),
    by_packrift_ai_id: top(byPackriftAiId),
    by_mcp_handoff_id: top(byMcpHandoffId),
    by_mcp_session_id: top(byMcpSessionId),
    by_mcp_key: top(byMcpKey),
    by_mcp_journey: top(byMcpJourney),
    by_tool_mcp_key: top(byToolMcpKey),
    by_mcp_source_context: top(byMcpSourceContext),
    by_mcp_install_target: top(byMcpInstallTarget),
    by_tool_mcp_source_context: top(byToolMcpSourceContext),
    by_utm_source: top(byUtmSource),
    by_utm_medium: top(byUtmMedium),
    by_utm_campaign: top(byUtmCampaign),
    by_utm_content: top(byUtmContent),
    by_event_source: top(byEventSource, 100),
    by_event_attribution: top(byEventAttribution, 100),
    by_start_source: top(byStartSource),
    by_tracked_config_source: top(byTrackedConfigSource),
    tracked_config_fetches: Object.values(byTrackedConfigSource).reduce((sum, count) => sum + count, 0),
    by_install_intent_source: top(byInstallIntentSource),
    by_install_intent_target: top(byInstallIntentTarget),
    by_first_run_intent_source: top(byFirstRunIntentSource),
    by_first_run_intent_target: top(byFirstRunIntentTarget),
    by_install_copy_source: top(byInstallCopySource),
    by_install_copy_target: top(byInstallCopyTarget),
    recent_start_clicks: recent("mcp_start_click"),
    recent_tracked_config_fetches: recent("mcp_resource_read", (event) => Boolean(trackedConfigSourceFromEvent(event))),
    recent_install_intents: recent("mcp_install_intent"),
    recent_first_run_intents: recent("mcp_first_run_intent"),
    recent_install_copies: recent("mcp_install_copy"),
    recent_activation_cart_ready: recent("mcp_activation_cart_ready"),
    recent_tool_calls: recent("mcp_tool_call"),
    recent_prompt_gets: recent("mcp_prompt_get"),
    recent_resource_reads: recent("mcp_resource_read"),
    recent_cart_landings: recent("mcp_cart_landing"),
    recent_no_matches: recent("no_match"),
    recent_exact_matches: recent("exact_match"),
    recent_multi_matches: recent("multi_match"),
  };
}

function topRowsToRecord(rows: Array<{ key: string; count: number }> | undefined): Record<string, number> {
  return Object.fromEntries((rows ?? []).map((row) => [row.key, row.count]));
}

function countEventsByStringField(events: Array<Record<string, unknown>>, field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const key = safeEventText(event[field], 160);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const MONTHLY_QUALIFIED_VISITOR_LOOKBACK_DAYS = 30;
const MONTHLY_QUALIFIED_VISITOR_THRESHOLD = 1000;
const MONTHLY_QUALIFIED_VISITOR_EVENT_READ_LIMIT = 10000;
const MCP_QUALIFIED_VISITOR_SIGNAL_EVENTS = new Set([
  "mcp_start_click",
  "mcp_install_intent",
  "mcp_first_run_intent",
  "mcp_first_run_execution",
  "mcp_install_copy",
  "mcp_activation_cart_ready",
  "mcp_tool_call",
  "cart_click",
  "mcp_cart_landing",
]);

function dateStringsEndingAt(endDate: string, days: number): string[] {
  const parts = endDate.split("-").map((part) => Number.parseInt(part, 10));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const end = year !== undefined && month !== undefined && day !== undefined && Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(Date.UTC(year, month - 1, day))
    : new Date();
  return Array.from({ length: Math.max(1, days) }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - index);
    return date.toISOString().slice(0, 10);
  });
}

async function readAiSalesEventsRange(env: Env, endDate: string, days: number, totalLimit: number): Promise<Array<Record<string, unknown>>> {
  const dates = dateStringsEndingAt(endDate, days);
  const boundedTotalLimit = Math.max(1, totalLimit);
  const perDayLimit = Math.max(1, Math.ceil(boundedTotalLimit / dates.length));
  const eventGroups = await Promise.all(dates.map((date) => readAiSalesEvents(env, date, perDayLimit).catch(() => [])));
  return eventGroups
    .flat()
    .sort((a, b) => String(b.received_at ?? "").localeCompare(String(a.received_at ?? "")))
    .slice(0, boundedTotalLimit);
}

function isQualifiedMcpVisitorSignal(event: Record<string, unknown>): boolean {
  const eventName = String(event.event ?? "");
  return MCP_QUALIFIED_VISITOR_SIGNAL_EVENTS.has(eventName) && isQualifiedPublicFunnelEvent(event);
}

function topVisitorProofRows(events: Array<Record<string, unknown>>, field: "event" | "source" | "utm_source" | "mcp_source_context") {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const key = safeEventText(event[field], 120) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([key, count]) => ({ key, count }));
}

function qualifiedMcpIdentityKey(event: Record<string, unknown>): { key: string; type: "mcp_session_id" | "mcp_handoff_id" | "ai_commerce_journey_id" } | null {
  const sessionId = safeEventText(event.mcp_session_id, 120);
  if (sessionId) return { key: `session:${sessionId}`, type: "mcp_session_id" };
  const handoffId = safeEventText(event.mcp_handoff_id, 160);
  if (handoffId) return { key: `handoff:${handoffId}`, type: "mcp_handoff_id" };
  const journeyId = safeEventText(event.ai_commerce_id ?? event.packrift_ai_id ?? event.mcp_journey, 160);
  if (journeyId) return { key: `journey:${journeyId}`, type: "ai_commerce_journey_id" };
  return null;
}

function uniqueQualifiedMcpIdentityProof(events: Array<Record<string, unknown>>) {
  const qualifiedEvents = events.filter((event) => isQualifiedMcpVisitorSignal(event));
  const uniqueByType: Record<"mcp_session_id" | "mcp_handoff_id" | "ai_commerce_journey_id", Set<string>> = {
    mcp_session_id: new Set<string>(),
    mcp_handoff_id: new Set<string>(),
    ai_commerce_journey_id: new Set<string>(),
  };
  const allKeys = new Set<string>();
  const sourceKeys = new Map<string, Set<string>>();
  let withoutIdentity = 0;
  for (const event of qualifiedEvents) {
    const identity = qualifiedMcpIdentityKey(event);
    if (!identity) {
      withoutIdentity += 1;
      continue;
    }
    uniqueByType[identity.type].add(identity.key);
    allKeys.add(identity.key);
    const source =
      safeEventText(event.mcp_source_context, 80) ||
      safeEventText(event.utm_source, 80) ||
      safeEventText(event.source, 80) ||
      "unknown";
    const sourceSet = sourceKeys.get(source) ?? new Set<string>();
    sourceSet.add(identity.key);
    sourceKeys.set(source, sourceSet);
  }
  const topSourcesByUniqueIdentity = [...sourceKeys.entries()]
    .map(([key, value]) => ({ key, count: value.size }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 10);
  return {
    basis: "explicit_mcp_session_handoff_or_journey_ids_no_ip_or_cookie_fingerprint",
    caveat:
      "This is a privacy-safe first-party uniqueness proxy for MCP activation breadth. It is not a GA4 user count and does not replace the GA4-qualified session_start gate.",
    qualified_event_signals: qualifiedEvents.length,
    events_with_identity: qualifiedEvents.length - withoutIdentity,
    events_without_identity: withoutIdentity,
    unique_identity_signals: allKeys.size,
    unique_mcp_session_ids: uniqueByType.mcp_session_id.size,
    unique_mcp_handoff_ids: uniqueByType.mcp_handoff_id.size,
    unique_ai_commerce_journey_ids: uniqueByType.ai_commerce_journey_id.size,
    top_sources_by_unique_identity: topSourcesByUniqueIdentity,
  };
}

function monthlyQualifiedVisitorProof(events: Array<Record<string, unknown>>, lookbackDays: number, threshold: number, readLimit: number) {
  const qualifiedEvents = events.filter(isQualifiedMcpVisitorSignal);
  const qualifiedSignals = qualifiedEvents.length;
  const uniqueIdentityProof = uniqueQualifiedMcpIdentityProof(events);
  return {
    gate_name: "thousands_of_qualified_visitors",
    status: qualifiedSignals >= threshold ? "threshold_met_by_first_party_proxy" : "below_threshold",
    basis: "first_party_qualified_mcp_event_signals_proxy",
    canonical_note:
      "This public Worker proof uses qualified first-party MCP event signals. GA4 session_start remains the stronger canonical visitor proof when the local full funnel artifact is built.",
    lookback_days: lookbackDays,
    threshold,
    qualified_external_mcp_event_signals: qualifiedSignals,
    remaining_to_threshold: Math.max(0, threshold - qualifiedSignals),
    progress_pct: Number(Math.min(100, (qualifiedSignals / threshold) * 100).toFixed(1)),
    events_scanned: events.length,
    read_limit: readLimit,
    truncated_by_read_limit: events.length >= readLimit,
    included_event_names: [...MCP_QUALIFIED_VISITOR_SIGNAL_EVENTS],
    top_events: topVisitorProofRows(qualifiedEvents, "event"),
    top_sources: topVisitorProofRows(qualifiedEvents, "source"),
    top_utm_sources: topVisitorProofRows(qualifiedEvents, "utm_source"),
    top_runtime_sources: topVisitorProofRows(qualifiedEvents, "mcp_source_context"),
    unique_identity_proof: uniqueIdentityProof,
  };
}

async function monthlyQualifiedVisitorProofForDate(env: Env, date: string) {
  const events = await readAiSalesEventsRange(
    env,
    date,
    MONTHLY_QUALIFIED_VISITOR_LOOKBACK_DAYS,
    MONTHLY_QUALIFIED_VISITOR_EVENT_READ_LIMIT
  );
  return monthlyQualifiedVisitorProof(
    events,
    MONTHLY_QUALIFIED_VISITOR_LOOKBACK_DAYS,
    MONTHLY_QUALIFIED_VISITOR_THRESHOLD,
    MONTHLY_QUALIFIED_VISITOR_EVENT_READ_LIMIT
  );
}

function missingMcpGa4FunnelProof(status: "missing" | "invalid", error?: string): PublicMcpGa4FunnelProof {
  return {
    release: MCP_GA4_FUNNEL_PROOF_RELEASE,
    generated_at: null,
    status,
    canonical_endpoint: "https://mcp.packrift.com/mcp",
    privacy: "Public aggregate proof only. No buyer identifiers, order rows, raw CSV rows, local paths, or credentials are exposed.",
    error,
    links: {
      live_worker_funnel_snapshot_json: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      activation_command_center: "https://mcp.packrift.com/r/activate",
    },
    next_actions: [
      "Run npm run snapshot:funnel, then npm run publish:ga4-funnel-proof -- --publish-kv to refresh the public GA4 proof.",
    ],
  };
}

function mcpGa4FunnelProofLooksSafe(value: PublicMcpGa4FunnelProof): boolean {
  return !/(\/Users\/|Downloads|env-|\.csv|ga4-pull|MCP_STATS_TOKEN|CLOUDFLARE_API_TOKEN)/i.test(JSON.stringify(value));
}

function normalizeMcpGa4FunnelProof(value: unknown): PublicMcpGa4FunnelProof | null {
  if (!value || typeof value !== "object") return null;
  const proof = value as Partial<PublicMcpGa4FunnelProof>;
  if (proof.release !== MCP_GA4_FUNNEL_PROOF_RELEASE) return null;
  if (proof.status !== "proven" && proof.status !== "not_proven") return null;
  const normalized: PublicMcpGa4FunnelProof = {
    release: MCP_GA4_FUNNEL_PROOF_RELEASE,
    generated_at: typeof proof.generated_at === "string" ? proof.generated_at : null,
    source_snapshot_generated_at:
      typeof proof.source_snapshot_generated_at === "string" ? proof.source_snapshot_generated_at : null,
    source_snapshot_status: typeof proof.source_snapshot_status === "string" ? proof.source_snapshot_status : "unknown",
    status: proof.status,
    canonical_endpoint: typeof proof.canonical_endpoint === "string" ? proof.canonical_endpoint : "https://mcp.packrift.com/mcp",
    privacy:
      typeof proof.privacy === "string"
        ? proof.privacy
        : "Public aggregate proof only. No buyer identifiers, order rows, raw CSV rows, local paths, or credentials are exposed.",
    measurement_window: proof.measurement_window,
    proof_gate: proof.proof_gate,
    visitor_goal: proof.visitor_goal,
    cart_and_revenue_proof: proof.cart_and_revenue_proof,
    first_party_mcp: proof.first_party_mcp,
    traffic_quality: proof.traffic_quality,
    distribution_counts: proof.distribution_counts,
    blockers: Array.isArray(proof.blockers) ? proof.blockers : [],
    next_actions: Array.isArray(proof.next_actions) ? proof.next_actions : [],
    links: proof.links,
  };
  return mcpGa4FunnelProofLooksSafe(normalized) ? normalized : null;
}

async function mcpGa4FunnelProofPayload(env: Env): Promise<PublicMcpGa4FunnelProof> {
  try {
    const text = await env.CATALOG_CACHE.get(MCP_GA4_FUNNEL_PROOF_KV_KEY, "text");
    if (!text) return missingMcpGa4FunnelProof("missing", "No public GA4 funnel proof is published in KV yet.");
    const normalized = normalizeMcpGa4FunnelProof(JSON.parse(text) as unknown);
    if (!normalized) return missingMcpGa4FunnelProof("invalid", "Published GA4 funnel proof is missing required fields or contains non-public references.");
    return normalized;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return missingMcpGa4FunnelProof("invalid", message);
  }
}

async function mcpUsageSnapshotPayload(env: Env, date = todayUtc(), limit = 1000) {
  const events = await readAiSalesEvents(env, date, limit);
  const monthlyVisitorProof = await monthlyQualifiedVisitorProofForDate(env, date);
  const uniqueIdentityProof = uniqueQualifiedMcpIdentityProof(events);
  const summary = summarizeAiSalesEvents(events);
  const byEvent = countEventsByStringField(events, "event");
  const bySource = countEventsByStringField(events, "source");
  const mcpDiscoveryEvents =
    (byEvent.mcp_tools_list ?? 0) +
    (byEvent.mcp_prompt_list ?? 0) +
    (byEvent.mcp_prompt_get ?? 0) +
    (byEvent.mcp_resource_list ?? 0) +
    (byEvent.mcp_resource_templates_list ?? 0) +
    (byEvent.mcp_resource_read ?? 0);
  const mcpToolCalls = byEvent.mcp_tool_call ?? 0;
  const createCartUrlCalls = (summary.by_tool ?? []).find((row) => row.key === "create_cart_url")?.count ?? 0;
  const qualifiedMcpToolCalls = countQualifiedPublicMcpToolCalls(events);
  const qualifiedCreateCartUrlCalls = countQualifiedPublicMcpToolCalls(events, "create_cart_url");
  const cartClicks = byEvent.mcp_cart_click ?? 0;
  const cartLandings = byEvent.mcp_cart_landing ?? 0;
  const startClicks = byEvent.mcp_start_click ?? 0;
  const trackedConfigFetches = summary.tracked_config_fetches;
  const installIntents = byEvent.mcp_install_intent ?? 0;
  const firstRunIntents = byEvent.mcp_first_run_intent ?? 0;
  const firstRunExecutions = byEvent.mcp_first_run_execution ?? 0;
  const installCopies = byEvent.mcp_install_copy ?? 0;
  const activationCartReady = byEvent.mcp_activation_cart_ready ?? 0;
  const mcpSourceAttributedRuntimeEvents = (summary.by_mcp_source_context ?? []).reduce((total, row) => total + row.count, 0);
  const postInstallCartActivation = postInstallCartActivationBySource(events);
  const sourceActivationPriorityQueue = mcpSourceActivationPriorityQueue(postInstallCartActivation);
  const uniqueMcpHandoffIds = new Set(events.map((event) => safeEventText(event.mcp_handoff_id, 160)).filter(Boolean)).size;
  const noMatches = byEvent.no_match ?? 0;
  const exactMatches = byEvent.exact_match ?? 0;
  const directAgentResourceSources = [
    "mcp_start",
    "all_agent_capture",
    "mcp_adoption_kit",
    "mcp_install_matrix",
    "mcp_install_actions",
    "mcp_first_run_actions",
    "mcp_client_config",
    "mcp_usage_snapshot",
    "mcp_funnel_snapshot",
    "mcp_ga4_funnel_proof",
    "mcp_buyer_use_cases",
    "mcp_cart_activation",
    "mcp_first_run_proof",
    "mcp_workflow_gallery",
    "browser_agent_bridge",
    "browserbase_browse_skill_pack",
    "mcp_directory_refresh",
    "mcp_directory_submit_actions",
    "mcp_reviewer_activation",
    "mcp_source_activation_queue",
    "mcp_activation_experiments",
    "claude_connector_submission",
    "agent_capture_outreach",
    "mcp_cart_handoff_candidates",
  ];
  const directAgentResourceEvents = directAgentResourceSources.reduce((total, source) => total + (bySource[source] ?? 0), 0);
  const totalMcpSignals =
    mcpDiscoveryEvents +
    mcpToolCalls +
    cartClicks +
    cartLandings +
    startClicks +
    trackedConfigFetches +
    installIntents +
    firstRunIntents +
    firstRunExecutions +
    installCopies +
    activationCartReady +
    directAgentResourceEvents;
  return {
    release: "PACKRIFT-MCP-USAGE-SNAPSHOT-R24",
    generated_at: new Date().toISOString(),
    date,
    limit,
    canonical_endpoint: "https://mcp.packrift.com/mcp",
    status: totalMcpSignals > 0 ? "usage_visible" : "no_usage_seen_for_date",
    purpose:
      "Public, aggregate Packrift MCP usage proof for agents, directory reviewers, and Packrift iteration. This is not the canonical GA4 revenue report; it is first-party MCP and AI-commerce event telemetry from the hosted endpoint.",
    privacy:
      "Aggregated counts only. Raw event bodies, buyer identifiers, and private admin stats are not exposed here.",
    runtime: {
      server_version: serverCard.version,
      tools_count: TOOLS.length,
      resources_count: MCP_RESOURCES.length,
      prompts_count: PROMPTS.length,
    },
    counts: {
      total_events: summary.total_events,
      mcp_discovery_events: mcpDiscoveryEvents,
      mcp_tool_calls: mcpToolCalls,
      create_cart_url_calls: createCartUrlCalls,
      mcp_cart_clicks: cartClicks,
      mcp_cart_landings: cartLandings,
      mcp_start_clicks: startClicks,
      mcp_tracked_config_fetches: trackedConfigFetches,
      mcp_install_intent_events: installIntents,
      mcp_first_run_intent_events: firstRunIntents,
      mcp_first_run_execution_events: firstRunExecutions,
      mcp_install_copy_events: installCopies,
      mcp_activation_cart_ready_events: activationCartReady,
      mcp_source_attributed_runtime_events: mcpSourceAttributedRuntimeEvents,
      unique_mcp_handoff_ids: uniqueMcpHandoffIds,
      unique_qualified_mcp_identity_signals: uniqueIdentityProof.unique_identity_signals,
      unique_qualified_mcp_session_ids: uniqueIdentityProof.unique_mcp_session_ids,
      unique_qualified_mcp_handoff_ids: uniqueIdentityProof.unique_mcp_handoff_ids,
      unique_qualified_ai_commerce_journey_ids: uniqueIdentityProof.unique_ai_commerce_journey_ids,
      qualified_mcp_events_with_identity: uniqueIdentityProof.events_with_identity,
      qualified_mcp_events_without_identity: uniqueIdentityProof.events_without_identity,
      exact_match_events: exactMatches,
      no_match_events: noMatches,
      external_qualified_mcp_tool_calls: qualifiedMcpToolCalls,
      external_qualified_create_cart_url_calls: qualifiedCreateCartUrlCalls,
      post_install_sources_waiting_on_create_cart_url: postInstallCartActivation.filter(
        (row) => row.install_intents + row.first_run_actions + row.tracked_config_fetches > 0 && row.create_cart_url_calls === 0
      ).length,
      post_install_sources_waiting_on_cart_landing: postInstallCartActivation.filter(
        (row) => row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0
      ).length,
      source_activation_priority_sources: sourceActivationPriorityQueue.length,
      source_activation_priority_critical: sourceActivationPriorityQueue.filter((row) => row.priority === "critical").length,
      monthly_qualified_visitor_signals: monthlyVisitorProof.qualified_external_mcp_event_signals,
      monthly_qualified_visitor_threshold: monthlyVisitorProof.threshold,
      monthly_qualified_visitor_remaining: monthlyVisitorProof.remaining_to_threshold,
      monthly_qualified_visitor_lookback_days: monthlyVisitorProof.lookback_days,
      monthly_qualified_visitor_events_scanned: monthlyVisitorProof.events_scanned,
      monthly_qualified_visitor_read_limit: monthlyVisitorProof.read_limit,
      direct_agent_resource_events: directAgentResourceEvents,
      direct_agent_resource_sources: directAgentResourceSources,
      mcp_start_resource_events: bySource.mcp_start ?? 0,
      adoption_kit_resource_events: bySource.mcp_adoption_kit ?? 0,
      install_matrix_resource_events: bySource.mcp_install_matrix ?? 0,
      install_actions_resource_events: bySource.mcp_install_actions ?? 0,
      first_run_actions_resource_events: bySource.mcp_first_run_actions ?? 0,
      client_config_resource_events: bySource.mcp_client_config ?? 0,
      all_agent_capture_resource_events: bySource.all_agent_capture ?? 0,
      buyer_use_case_resource_events: bySource.mcp_buyer_use_cases ?? 0,
      browser_agent_bridge_resource_events: bySource.browser_agent_bridge ?? 0,
      directory_refresh_resource_events: bySource.mcp_directory_refresh ?? 0,
      directory_submit_action_resource_events: bySource.mcp_directory_submit_actions ?? 0,
      reviewer_activation_resource_events: bySource.mcp_reviewer_activation ?? 0,
      source_activation_queue_resource_events: bySource.mcp_source_activation_queue ?? 0,
      activation_experiments_resource_events: bySource.mcp_activation_experiments ?? 0,
      cart_handoff_candidate_resource_events: bySource.mcp_cart_handoff_candidates ?? 0,
      cart_activation_resource_events: bySource.mcp_cart_activation ?? 0,
      first_run_proof_resource_events: bySource.mcp_first_run_proof ?? 0,
      workflow_gallery_resource_events: bySource.mcp_workflow_gallery ?? 0,
      usage_snapshot_resource_events: bySource.mcp_usage_snapshot ?? 0,
      funnel_snapshot_resource_events: bySource.mcp_funnel_snapshot ?? 0,
      browserbase_browse_skill_pack_resource_events: bySource.browserbase_browse_skill_pack ?? 0,
      sources: bySource,
    },
    proof_gate: {
      usage_exists: totalMcpSignals > 0,
      tracked_config_fetch_seen: trackedConfigFetches > 0,
      install_intent_seen: installIntents > 0,
      first_run_intent_seen: firstRunIntents > 0,
      first_run_execution_seen: firstRunExecutions > 0,
      install_copy_seen: installCopies > 0,
      activation_cart_ready_seen: activationCartReady > 0,
      mcp_runtime_source_continuity_seen: mcpSourceAttributedRuntimeEvents > 0,
      create_cart_url_seen: qualifiedCreateCartUrlCalls > 0,
      material_tool_usage_50_plus: qualifiedMcpToolCalls >= 50,
      thousands_of_qualified_visitors: monthlyVisitorProof.qualified_external_mcp_event_signals >= monthlyVisitorProof.threshold,
      measurable_mcp_sales: false,
    },
    monthly_qualified_visitor_proof: monthlyVisitorProof,
    unique_qualified_identity_proof: uniqueIdentityProof,
    top: {
      events: summary.by_event,
      tools: summary.by_tool,
      skus: summary.by_sku,
      bot_families: summary.by_bot_family,
      mcp_methods: summary.by_mcp_method,
      utm_sources: summary.by_utm_source,
      start_sources: summary.by_start_source,
      tracked_config_sources: summary.by_tracked_config_source,
      install_intent_sources: summary.by_install_intent_source,
      install_intent_targets: summary.by_install_intent_target,
      first_run_intent_sources: summary.by_first_run_intent_source,
      first_run_intent_targets: summary.by_first_run_intent_target,
      install_copy_sources: summary.by_install_copy_source,
      install_copy_targets: summary.by_install_copy_target,
      mcp_keys: summary.by_mcp_key,
      mcp_journeys: summary.by_mcp_journey,
      mcp_handoff_ids: summary.by_mcp_handoff_id,
      mcp_session_ids: summary.by_mcp_session_id,
      tool_mcp_keys: summary.by_tool_mcp_key,
      mcp_runtime_sources: summary.by_mcp_source_context,
      mcp_install_targets: summary.by_mcp_install_target,
      tool_runtime_sources: summary.by_tool_mcp_source_context,
      event_sources: summary.by_event_source,
      event_attribution: summary.by_event_attribution,
      post_install_cart_activation_by_source: postInstallCartActivation,
    },
    source_activation_priority_queue: sourceActivationPriorityQueue,
    source_attribution: {
      tracked_start_template: "https://mcp.packrift.com/r/start/{source}",
      tracked_config_template: "https://mcp.packrift.com/r/config/{source}",
      tracked_install_template: "https://mcp.packrift.com/r/install/{source}/{target}",
      tracked_run_template: "https://mcp.packrift.com/r/run/{source}/{target}",
      tracked_reviewer_activation_template: "https://mcp.packrift.com/r/activate/{source}",
      tracked_reviewer_activation_html_template: "https://mcp.packrift.com/r/activate/{source}?format=html",
      mcp_start_click_sources: summary.by_start_source,
      tracked_config_sources: summary.by_tracked_config_source,
      install_intent_sources: summary.by_install_intent_source,
      install_intent_targets: summary.by_install_intent_target,
      first_run_intent_sources: summary.by_first_run_intent_source,
      first_run_intent_targets: summary.by_first_run_intent_target,
      install_copy_sources: summary.by_install_copy_source,
      install_copy_targets: summary.by_install_copy_target,
      utm_sources: summary.by_utm_source,
      utm_campaigns: summary.by_utm_campaign,
      mcp_keys: summary.by_mcp_key,
      mcp_journeys: summary.by_mcp_journey,
      mcp_handoff_ids: summary.by_mcp_handoff_id,
      mcp_session_ids: summary.by_mcp_session_id,
      tool_mcp_keys: summary.by_tool_mcp_key,
      mcp_runtime_sources: summary.by_mcp_source_context,
      mcp_install_targets: summary.by_mcp_install_target,
      tool_runtime_sources: summary.by_tool_mcp_source_context,
      event_attribution: summary.by_event_attribution,
      recent_start_clicks: summary.recent_start_clicks,
      recent_tracked_config_fetches: summary.recent_tracked_config_fetches,
      recent_install_intents: summary.recent_install_intents,
      recent_first_run_intents: summary.recent_first_run_intents,
      recent_install_copies: summary.recent_install_copies,
      recent_activation_cart_ready: summary.recent_activation_cart_ready,
      recent_tool_calls: summary.recent_tool_calls,
      recent_cart_landings: summary.recent_cart_landings,
      post_install_cart_activation_by_source: postInstallCartActivation,
      source_activation_priority_queue: sourceActivationPriorityQueue,
    },
    links: {
      usage_snapshot_json: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      usage_snapshot_markdown: "https://mcp.packrift.com/ai/mcp-usage-snapshot.md",
      funnel_snapshot_json: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      funnel_snapshot_markdown: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.md",
      live_summary_api: `https://mcp.packrift.com/events/ai-sales/summary?date=${date}&limit=${limit}`,
      dashboard: `https://mcp.packrift.com/events/ai-sales/dashboard?date=${date}`,
      mcp_start: "https://mcp.packrift.com/ai/mcp-start.json",
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      install_actions: "https://mcp.packrift.com/ai/mcp-install-actions.json",
      tracked_install_generic_codex: "https://mcp.packrift.com/r/install/generic/codex",
      first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
      tracked_run_generic: "https://mcp.packrift.com/r/run/generic/generic_streamable_http",
      client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
      tracked_config_generic: "https://mcp.packrift.com/r/config/generic",
      root_mcp_json: "https://mcp.packrift.com/mcp.json",
      well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      reviewer_activation: "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      source_activation_queue_html: "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
      activation_experiments: "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
      activation_experiments_html: "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
      activation_command_center: "https://mcp.packrift.com/r/activate",
      tracked_reviewer_activation_runner_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
    },
    next_actions: [
      "Work the source_activation_priority_queue first; it ranks sources by the next event most likely to move Packrift from directory proof into real MCP carts.",
      "Push directory recrawls and partner installs toward /r/run/{source}/{target} first-run actions, not only tools/list and config fetches.",
      "Use /r/activate/{source}?format=html after proof clicks to move reviewers into real MCP client calls and measured create_cart_url output.",
      "Drive real workflows through get_cart_handoff_candidates, get_pricing, check_inventory, create_cart_url, and then the returned /r/cart URL; the public post_install_cart_activation_by_source table shows which sources are stuck before cart URL creation or landing.",
      "Do not call the adoption goal complete until material MCP tool usage, stamped cart landings, and MCP-attributed sales are visible.",
    ],
  };
}

function mcpUsageSnapshotMarkdown(payload: Awaited<ReturnType<typeof mcpUsageSnapshotPayload>>): string {
  const table = (rows: Array<{ key: string; count: number }> | undefined) =>
    (rows ?? []).slice(0, 10).map((row) => `| ${row.key} | ${row.count} |`).join("\n") || "| none | 0 |";
  return [
    "# Packrift MCP Usage Snapshot",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Date: ${payload.date}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    `Status: ${payload.status}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Counts",
    "",
    `- Total first-party events: ${payload.counts.total_events}`,
    `- MCP discovery events: ${payload.counts.mcp_discovery_events}`,
    `- MCP tool calls: ${payload.counts.mcp_tool_calls}`,
    `- create_cart_url calls: ${payload.counts.create_cart_url_calls}`,
    `- External-qualified MCP tool calls: ${payload.counts.external_qualified_mcp_tool_calls}`,
    `- External-qualified create_cart_url calls: ${payload.counts.external_qualified_create_cart_url_calls}`,
    `- Post-install sources waiting on create_cart_url: ${payload.counts.post_install_sources_waiting_on_create_cart_url}`,
    `- Post-install sources waiting on cart landing: ${payload.counts.post_install_sources_waiting_on_cart_landing}`,
    `- Source activation priority sources: ${payload.counts.source_activation_priority_sources}`,
    `- Critical source activation priorities: ${payload.counts.source_activation_priority_critical}`,
    `- Monthly qualified visitor signals: ${payload.counts.monthly_qualified_visitor_signals} / ${payload.counts.monthly_qualified_visitor_threshold}`,
    `- Monthly qualified visitor gap: ${payload.counts.monthly_qualified_visitor_remaining}`,
    `- Unique qualified MCP identity signals: ${payload.counts.unique_qualified_mcp_identity_signals}`,
    `- Unique qualified MCP session IDs: ${payload.counts.unique_qualified_mcp_session_ids}`,
    `- Unique qualified MCP handoff IDs: ${payload.counts.unique_qualified_mcp_handoff_ids}`,
    `- Unique qualified AI-commerce journey IDs: ${payload.counts.unique_qualified_ai_commerce_journey_ids}`,
    `- Qualified MCP events with identity: ${payload.counts.qualified_mcp_events_with_identity}`,
    `- Qualified MCP events without identity: ${payload.counts.qualified_mcp_events_without_identity}`,
    `- MCP cart clicks: ${payload.counts.mcp_cart_clicks}`,
    `- MCP cart landings: ${payload.counts.mcp_cart_landings}`,
    `- MCP start clicks: ${payload.counts.mcp_start_clicks}`,
    `- MCP tracked config fetches: ${payload.counts.mcp_tracked_config_fetches}`,
    `- MCP install-intent events: ${payload.counts.mcp_install_intent_events}`,
    `- MCP first-run-intent events: ${payload.counts.mcp_first_run_intent_events}`,
    `- MCP first-run execution events: ${payload.counts.mcp_first_run_execution_events}`,
    `- MCP install-copy events: ${payload.counts.mcp_install_copy_events}`,
    `- MCP activation cart-ready events: ${payload.counts.mcp_activation_cart_ready_events}`,
    `- MCP source-attributed runtime events: ${payload.counts.mcp_source_attributed_runtime_events}`,
    `- Exact-match events: ${payload.counts.exact_match_events}`,
    `- No-match events: ${payload.counts.no_match_events}`,
    `- Direct agent resource events: ${payload.counts.direct_agent_resource_events}`,
    `- MCP start resource events: ${payload.counts.mcp_start_resource_events}`,
    `- Adoption kit resource events: ${payload.counts.adoption_kit_resource_events}`,
    `- Install matrix resource events: ${payload.counts.install_matrix_resource_events}`,
    `- Install actions resource events: ${payload.counts.install_actions_resource_events}`,
    `- First-run actions resource events: ${payload.counts.first_run_actions_resource_events}`,
    `- Client config resource events: ${payload.counts.client_config_resource_events}`,
    `- Buyer use-case resource events: ${payload.counts.buyer_use_case_resource_events}`,
    `- Browser-agent bridge resource events: ${payload.counts.browser_agent_bridge_resource_events}`,
    `- Browserbase Browse skill-pack resource events: ${payload.counts.browserbase_browse_skill_pack_resource_events}`,
    `- Directory refresh resource events: ${payload.counts.directory_refresh_resource_events}`,
    `- Directory submit-action resource events: ${payload.counts.directory_submit_action_resource_events}`,
    `- Reviewer activation resource events: ${payload.counts.reviewer_activation_resource_events}`,
    `- Cart-handoff candidate resource events: ${payload.counts.cart_handoff_candidate_resource_events}`,
    `- Cart activation resource events: ${payload.counts.cart_activation_resource_events}`,
    `- First-run proof resource events: ${payload.counts.first_run_proof_resource_events}`,
    `- Workflow gallery resource events: ${payload.counts.workflow_gallery_resource_events}`,
    `- Funnel snapshot resource events: ${payload.counts.funnel_snapshot_resource_events}`,
    "",
    "## Source Attribution",
    "",
    `Tracked start template: \`${payload.source_attribution.tracked_start_template}\``,
    `Tracked config template: \`${payload.source_attribution.tracked_config_template}\``,
    `Tracked install template: \`${payload.source_attribution.tracked_install_template}\``,
    `Tracked first-run template: \`${payload.source_attribution.tracked_run_template}\``,
    `Tracked reviewer activation template: \`${payload.source_attribution.tracked_reviewer_activation_template}\``,
    `Tracked reviewer activation browser runner template: \`${payload.source_attribution.tracked_reviewer_activation_html_template}\``,
    "",
    "### Source Activation Priority Queue",
    "",
    "| Priority | Source | Current stage | Target event | Recommended action | Action URL | Recent measured cart URL | Directory status |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    payload.source_activation_priority_queue
      .slice(0, 10)
      .map(
        (row) =>
          `| ${row.priority} | ${row.source} | ${markdownTableCell(row.current_stage)} | ${row.target_event_to_watch} | ${markdownTableCell(row.recommended_action)} | ${row.primary_action_url} | ${row.recent_measured_cart_urls[0] ?? ""} | ${markdownTableCell(row.directory_status)} |`
      )
      .join("\n") || "| none | none | none | none | none | none | none | none |",
    "",
    "### MCP Start Click Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.mcp_start_click_sources),
    "",
    "### MCP Tracked Config Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.tracked_config_sources),
    "",
    "### MCP Install Intent Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.install_intent_sources),
    "",
    "### MCP Install Intent Targets",
    "",
    "| Target | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.install_intent_targets),
    "",
    "### MCP First-Run Intent Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.first_run_intent_sources),
    "",
    "### MCP First-Run Intent Targets",
    "",
    "| Target | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.first_run_intent_targets),
    "",
    "### MCP Install Copy Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.install_copy_sources),
    "",
    "### MCP Install Copy Targets",
    "",
    "| Target | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.install_copy_targets),
    "",
    "### UTM Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.utm_sources),
    "",
    "### MCP Runtime Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.mcp_runtime_sources),
    "",
    "### MCP Keys",
    "",
    "| MCP key | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.mcp_keys),
    "",
    "### Tool Calls By MCP Key",
    "",
    "| Tool and MCP key | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.tool_mcp_keys),
    "",
    "### Tool Calls By Runtime Source",
    "",
    "| Tool and source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.tool_runtime_sources),
    "",
    "### Post-Install Cart Activation By Source",
    "",
    "| Source | Starts | Config fetches | Installs | First-run actions | Browser executions | Tool calls | Candidates | Price | Inventory | Cart URLs | Cart-ready | Cart clicks | Cart landings | Qualified cart landings | External-qualified cart URLs | Recent measured cart URL | Missing next step |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    payload.source_attribution.post_install_cart_activation_by_source
      .slice(0, 10)
      .map(
        (row) =>
          `| ${row.source} | ${row.starts} | ${row.tracked_config_fetches} | ${row.install_intents} | ${row.first_run_actions} | ${row.first_run_executions} | ${row.mcp_tool_calls} | ${row.get_cart_handoff_candidates} | ${row.get_pricing} | ${row.check_inventory} | ${row.create_cart_url_calls} | ${row.activation_cart_ready} | ${row.cart_clicks} | ${row.cart_landings} | ${row.qualified_cart_landings} | ${row.external_qualified_create_cart_url_calls} | ${row.recent_measured_cart_urls[0] ?? ""} | ${row.missing_next_step} |`
      )
      .join("\n") || "| none | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | none | none |",
    "",
    "## Proof Gate",
    "",
    `- Usage exists: ${payload.proof_gate.usage_exists ? "yes" : "no"}`,
    `- Tracked config fetch seen: ${payload.proof_gate.tracked_config_fetch_seen ? "yes" : "no"}`,
    `- Install intent seen: ${payload.proof_gate.install_intent_seen ? "yes" : "no"}`,
    `- First-run intent seen: ${payload.proof_gate.first_run_intent_seen ? "yes" : "no"}`,
    `- First-run execution seen: ${payload.proof_gate.first_run_execution_seen ? "yes" : "no"}`,
    `- Install copy seen: ${payload.proof_gate.install_copy_seen ? "yes" : "no"}`,
    `- Activation cart-ready seen: ${payload.proof_gate.activation_cart_ready_seen ? "yes" : "no"}`,
    `- Runtime source continuity seen: ${payload.proof_gate.mcp_runtime_source_continuity_seen ? "yes" : "no"}`,
    `- External-qualified create_cart_url seen: ${payload.proof_gate.create_cart_url_seen ? "yes" : "no"}`,
    `- External-qualified material tool usage 50+: ${payload.proof_gate.material_tool_usage_50_plus ? "yes" : "no"}`,
    `- Thousands of qualified visitors: ${payload.proof_gate.thousands_of_qualified_visitors ? "yes" : "no"}`,
    `- Measurable MCP sales: ${payload.proof_gate.measurable_mcp_sales ? "yes" : "no"}`,
    "",
    "## Monthly Qualified Visitor Proof",
    "",
    `- Status: ${payload.monthly_qualified_visitor_proof.status}`,
    `- Basis: ${payload.monthly_qualified_visitor_proof.basis}`,
    `- Lookback days: ${payload.monthly_qualified_visitor_proof.lookback_days}`,
    `- Qualified external MCP event signals: ${payload.monthly_qualified_visitor_proof.qualified_external_mcp_event_signals}`,
    `- Threshold: ${payload.monthly_qualified_visitor_proof.threshold}`,
    `- Remaining to threshold: ${payload.monthly_qualified_visitor_proof.remaining_to_threshold}`,
    `- Progress: ${payload.monthly_qualified_visitor_proof.progress_pct}%`,
    `- Events scanned: ${payload.monthly_qualified_visitor_proof.events_scanned}`,
    `- Read limit: ${payload.monthly_qualified_visitor_proof.read_limit}`,
    `- Truncated by read limit: ${payload.monthly_qualified_visitor_proof.truncated_by_read_limit ? "yes" : "no"}`,
    `- Note: ${payload.monthly_qualified_visitor_proof.canonical_note}`,
    "",
    "## Unique Qualified Identity Proof",
    "",
    `- Basis: ${payload.unique_qualified_identity_proof.basis}`,
    `- Caveat: ${payload.unique_qualified_identity_proof.caveat}`,
    `- Qualified event signals: ${payload.unique_qualified_identity_proof.qualified_event_signals}`,
    `- Events with identity: ${payload.unique_qualified_identity_proof.events_with_identity}`,
    `- Events without identity: ${payload.unique_qualified_identity_proof.events_without_identity}`,
    `- Unique identity signals: ${payload.unique_qualified_identity_proof.unique_identity_signals}`,
    `- Unique MCP session IDs: ${payload.unique_qualified_identity_proof.unique_mcp_session_ids}`,
    `- Unique MCP handoff IDs: ${payload.unique_qualified_identity_proof.unique_mcp_handoff_ids}`,
    `- Unique AI-commerce journey IDs: ${payload.unique_qualified_identity_proof.unique_ai_commerce_journey_ids}`,
    "",
    "### Top Sources By Unique Qualified Identity",
    "",
    "| Source | Unique identities |",
    "| --- | ---: |",
    table(payload.unique_qualified_identity_proof.top_sources_by_unique_identity),
    "",
    "## Top Events",
    "",
    "| Event | Count |",
    "| --- | --- |",
    table(payload.top.events),
    "",
    "## Top Tools",
    "",
    "| Tool | Count |",
    "| --- | --- |",
    table(payload.top.tools),
    "",
    "## Top SKUs",
    "",
    "| SKU | Count |",
    "| --- | --- |",
    table(payload.top.skus),
    "",
    "## Links",
    "",
    Object.entries(payload.links)
      .map(([name, url]) => `- ${name}: ${url}`)
      .join("\n"),
    "",
    "## Next Actions",
    "",
    payload.next_actions.map((item) => `- ${item}`).join("\n"),
    "",
  ].join("\n");
}

const MCP_FUNNEL_SNAPSHOT_RELEASE = "PACKRIFT-MCP-FUNNEL-SNAPSHOT-R18";
const MCP_GA4_FUNNEL_PROOF_RELEASE = "PACKRIFT-MCP-GA4-FUNNEL-PROOF-R01";
const MCP_GA4_FUNNEL_PROOF_KV_KEY = "mcp-ga4-funnel-proof:latest";

type PublicMcpGa4FunnelProof = {
  release: string;
  generated_at: string | null;
  source_snapshot_generated_at?: string | null;
  source_snapshot_status?: string;
  status: "available" | "missing" | "invalid" | "not_proven" | "proven";
  canonical_endpoint?: string;
  privacy?: string;
  measurement_window?: {
    ga4_range?: {
      start_date?: string | null;
      end_date?: string | null;
    };
    first_party_mcp_date?: string | null;
    shopify_order_lookback_days?: number | null;
    shopify_orders_scanned?: number | null;
  };
  proof_gate?: Record<string, boolean>;
  visitor_goal?: {
    basis?: string;
    threshold?: number;
    qualified_external_mcp_session_starts?: number;
    remaining_to_threshold?: number;
    progress_pct?: number;
    raw_mcp_specific_session_starts?: number;
    raw_ai_mcp_session_starts?: number;
  };
  cart_and_revenue_proof?: {
    raw_stamped_mcp_cart_landings?: number;
    raw_first_party_mcp_cart_landings?: number;
    qualified_ga4_cart_landings?: number;
    qualified_first_party_mcp_cart_landings?: number;
    qualified_external_cart_landings?: number;
    qualified_external_cart_revenue?: number;
    first_party_mcp_orders?: number;
    first_party_mcp_order_revenue?: number;
    currency?: string;
  };
  first_party_mcp?: Record<string, unknown>;
  traffic_quality?: Record<string, unknown>;
  distribution_counts?: Record<string, unknown>;
  blockers?: string[];
  next_actions?: string[];
  links?: Record<string, string>;
  error?: string;
};

function matchesPublicFunnelInternalSynthetic(text: string): boolean {
  return (
    /(localhost|manual_verify|codex_probe|runtime_probe|first_useful_run_probe|mcp_cart_handoff_smoke|packrift-agent|packrift-mcp-funnel|packrift-mcp-cart-handoff-smoke|packrift-static|packrift-conversion-gap-audit|packrift-reorder-route-sanity|routecatalogqa|packriftqa|criticalpathqa)/i.test(text) ||
    /(^|[^a-z0-9])(qa|smoke|synthetic|eval|test)([^a-z0-9]|$)/i.test(text)
  );
}

function matchesPublicFunnelSelfGenerated(text: string): boolean {
  return /(mcp_ai_corpus|mcp_sku_page|conversion_route|conversion_starter|measured_handoff|ai_commerce_id_stitching|directory|submission|outreach|indexnow|sitemap|llms|resource_read|resources\/list|browser_agent_bridge|mcp_buyer_use_cases|mcp_usage_snapshot|mcp_funnel_snapshot|mcp_ga4_funnel_proof|mcp_install_matrix|mcp_directory_refresh|mcp_activation_experiments|generated_ai_resource)/i.test(text);
}

function matchesPublicFunnelQualifiedDemand(text: string): boolean {
  return /(chatgpt-mcp|mcp_tool|create_cart_url|get_cart_handoff_candidates|get_pricing|check_inventory|get_product|search_products|cart_click|quote_click|reorder_click)/i.test(text);
}

function publicFunnelEventText(event: Record<string, unknown>): string {
  return [
    event.event,
    event.source,
    event.tool_name,
    event.mcp_source_context,
    event.mcp_install_target,
    event.user_agent,
    event.packrift_ai_id,
    event.ai_commerce_id,
    event.mcp_key,
    event.mcp_journey,
    event.mcp_result_set,
    event.utm_source,
    event.utm_medium,
    event.utm_campaign,
    event.utm_content,
    event.match_type,
    event.bot_family,
  ]
    .map((value) => safeEventText(value, 240).toLowerCase())
    .filter(Boolean)
    .join("|");
}

function isQualifiedPublicFunnelEvent(event: Record<string, unknown>): boolean {
  const text = publicFunnelEventText(event);
  if (matchesPublicFunnelInternalSynthetic(text) || matchesPublicFunnelSelfGenerated(text)) return false;
  return matchesPublicFunnelQualifiedDemand(text);
}

function countQualifiedPublicMcpToolCalls(events: Array<Record<string, unknown>>, toolName?: string): number {
  return events.filter((event) => {
    if (String(event.event ?? "") !== "mcp_tool_call") return false;
    if (toolName && String(event.tool_name ?? "") !== toolName) return false;
    return isQualifiedPublicFunnelEvent(event);
  }).length;
}

function sourceFromMcpAttributionText(value: unknown): string {
  const text = safeEventText(value, 800).toLowerCase();
  if (!text) return "";

  const directPatterns = [
    /^mcp_runtime:([a-z0-9_]{2,64}):/,
    /^mcp_first_run_action:([a-z0-9_]{2,64}):/,
    /^directory_recrawl:([a-z0-9_]{2,64}):/,
    /^mcp_install_(.+?)_(?:1066|mfl1295|ll251wr)_/,
    /^mcp_install_first_run_(.+)$/,
  ];
  for (const pattern of directPatterns) {
    const match = text.match(pattern);
    const source = safeEventText(match?.[1], 80);
    if (source && MCP_START_SOURCE_PATTERN.test(source)) return source;
  }

  const knownSources = [...MCP_START_SOURCE_POLICY.recommended_sources, ...MCP_START_SOURCE_POLICY.custom_examples].sort(
    (a, b) => b.length - a.length || a.localeCompare(b)
  );
  for (const source of knownSources) {
    if (text.includes(source)) return source;
  }
  return "";
}

function postInstallActivationSource(event: Record<string, unknown>): string {
  const eventName = String(event.event ?? "");
  const mcpSource = safeEventText(event.mcp_source_context, 80);
  if ((eventName === "mcp_tool_call" || eventName === "mcp_activation_cart_ready") && mcpSource) return mcpSource;
  const attributedSource = sourceFromMcpAttributionText(
    [event.mcp_journey, event.mcp_result_set, event.packrift_ai_id, event.ai_commerce_id].filter(Boolean).join("|")
  );
  if (attributedSource) return attributedSource;
  const utmSource = safeEventText(event.utm_source, 80);
  if (utmSource && utmSource !== "unknown" && utmSource !== "chatgpt-mcp") return utmSource;
  const mcpKey = safeEventText(event.mcp_key, 120);
  if (mcpKey.startsWith("start:")) return safeEventText(mcpKey.slice("start:".length), 80);
  if (mcpKey.startsWith("config:")) return safeEventText(mcpKey.slice("config:".length), 80);
  if (mcpKey.startsWith("install_intent:") || mcpKey.startsWith("install_copy:")) return safeEventText(mcpKey.split(":")[1], 80);
  if (mcpKey.startsWith("first_run:")) return safeEventText(mcpKey.split(":")[1], 80);
  if (mcpKey.startsWith("first_run_execution:")) return safeEventText(mcpKey.split(":")[1], 80);
  return "";
}

function postInstallMissingNextStep(row: {
  install_intents: number;
  first_run_actions: number;
  first_run_executions: number;
  tracked_config_fetches: number;
  mcp_tool_calls: number;
  get_cart_handoff_candidates: number;
  get_pricing: number;
  check_inventory: number;
  create_cart_url_calls: number;
  activation_cart_ready: number;
  cart_clicks: number;
  cart_landings: number;
  qualified_cart_landings: number;
  external_qualified_create_cart_url_calls: number;
}) {
  if (row.install_intents === 0 && row.first_run_actions === 0 && row.tracked_config_fetches === 0) return "drive_tracked_install_or_config_fetch";
  if (row.first_run_actions === 0) return "open_tracked_first_run_action";
  if (row.first_run_executions === 0 && row.mcp_tool_calls === 0) return "execute_first_run_browser_or_curl_sequence";
  if (row.first_run_executions > 0 && row.mcp_tool_calls === 0) return "convert_browser_execution_into_real_mcp_tool_call_or_cart_landing";
  if (row.get_cart_handoff_candidates === 0) return "call_get_cart_handoff_candidates_for_sku_1066";
  if (row.get_pricing === 0) return "call_get_pricing_for_sku_1066";
  if (row.check_inventory === 0) return "call_check_inventory_for_sku_1066";
  if (row.create_cart_url_calls === 0) return "call_create_cart_url_for_sku_1066_no_order_created";
  if (row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0) return "open_returned_mcp_cart_url_to_record_cart_landing";
  return "monitor_cart_landing_and_order_progression";
}

function postInstallCartActivationBySource(events: Array<Record<string, unknown>>) {
  const rows = new Map<
    string,
    {
      source: string;
      starts: number;
      tracked_config_fetches: number;
      install_intents: number;
      first_run_actions: number;
      first_run_executions: number;
      install_copies: number;
      mcp_tool_calls: number;
      get_cart_handoff_candidates: number;
      get_pricing: number;
      check_inventory: number;
      create_cart_url_calls: number;
      activation_cart_ready: number;
      cart_clicks: number;
      cart_landings: number;
      qualified_cart_landings: number;
      external_qualified_create_cart_url_calls: number;
      recent_measured_cart_urls: string[];
      install_targets: Record<string, number>;
    }
  >();
  const ensure = (source: string) => {
    const key = source || "unknown";
    const existing = rows.get(key);
    if (existing) return existing;
    const row = {
      source: key,
      starts: 0,
      tracked_config_fetches: 0,
      install_intents: 0,
      first_run_actions: 0,
      first_run_executions: 0,
      install_copies: 0,
      mcp_tool_calls: 0,
      get_cart_handoff_candidates: 0,
      get_pricing: 0,
      check_inventory: 0,
      create_cart_url_calls: 0,
      activation_cart_ready: 0,
      cart_clicks: 0,
      cart_landings: 0,
      qualified_cart_landings: 0,
      external_qualified_create_cart_url_calls: 0,
      recent_measured_cart_urls: [],
      install_targets: {} as Record<string, number>,
    };
    rows.set(key, row);
    return row;
  };
  for (const event of events) {
    const source = postInstallActivationSource(event);
    if (!source) continue;
    const row = ensure(source);
    const eventName = String(event.event ?? "");
    const toolName = String(event.tool_name ?? "");
    const measuredCartUrl = measuredCartUrlFromEvent(event);
    if (
      measuredCartUrl &&
      (eventName === "mcp_activation_cart_ready" || (eventName === "mcp_tool_call" && toolName === "create_cart_url")) &&
      !row.recent_measured_cart_urls.includes(measuredCartUrl) &&
      row.recent_measured_cart_urls.length < 3
    ) {
      row.recent_measured_cart_urls.push(measuredCartUrl);
    }
    if (eventName === "mcp_start_click") row.starts += 1;
    if (eventName === "mcp_resource_read" && String(event.mcp_key ?? "").startsWith("config:")) row.tracked_config_fetches += 1;
    if (eventName === "mcp_install_intent") row.install_intents += 1;
    if (eventName === "mcp_first_run_intent") row.first_run_actions += 1;
    if (eventName === "mcp_first_run_execution") row.first_run_executions += 1;
    if (eventName === "mcp_install_copy") row.install_copies += 1;
    if (eventName === "mcp_activation_cart_ready") row.activation_cart_ready += 1;
    if (eventName === "cart_click") row.cart_clicks += 1;
    if (eventName === "mcp_cart_landing") {
      row.cart_landings += 1;
      if (isQualifiedPublicFunnelEvent(event)) row.qualified_cart_landings += 1;
    }
    if (eventName === "mcp_install_intent" || eventName === "mcp_first_run_intent" || eventName === "mcp_first_run_execution" || eventName === "mcp_install_copy" || eventName === "mcp_tool_call") {
      const target = safeEventText(event.mcp_install_target || event.tool_name || event.utm_content, 80);
      if (target) row.install_targets[target] = (row.install_targets[target] ?? 0) + 1;
    }
    if (eventName !== "mcp_tool_call") continue;
    row.mcp_tool_calls += 1;
    if (toolName === "get_cart_handoff_candidates") row.get_cart_handoff_candidates += 1;
    if (toolName === "get_pricing") row.get_pricing += 1;
    if (toolName === "check_inventory") row.check_inventory += 1;
    if (toolName === "create_cart_url") {
      row.create_cart_url_calls += 1;
      if (isQualifiedPublicFunnelEvent(event)) row.external_qualified_create_cart_url_calls += 1;
    }
  }
  return [...rows.values()]
    .filter(
      (row) =>
        row.source !== "mcp_route_redirect" ||
        row.starts +
          row.tracked_config_fetches +
          row.install_intents +
          row.first_run_actions +
          row.first_run_executions +
          row.install_copies +
          row.mcp_tool_calls +
          row.activation_cart_ready +
          row.external_qualified_create_cart_url_calls >
          0
    )
    .map((row) => ({
      ...row,
      install_targets: Object.entries(row.install_targets)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([key, count]) => ({ key, count })),
      recent_measured_cart_urls: row.recent_measured_cart_urls,
      missing_next_step: postInstallMissingNextStep(row),
    }))
    .sort(
      (a, b) =>
        b.qualified_cart_landings - a.qualified_cart_landings ||
        b.external_qualified_create_cart_url_calls - a.external_qualified_create_cart_url_calls ||
        b.cart_landings - a.cart_landings ||
        b.create_cart_url_calls - a.create_cart_url_calls ||
        b.first_run_executions - a.first_run_executions ||
        b.first_run_actions - a.first_run_actions ||
        b.install_intents - a.install_intents ||
        b.tracked_config_fetches - a.tracked_config_fetches ||
        b.starts - a.starts ||
        a.source.localeCompare(b.source)
    )
    .slice(0, 25);
}

function countQualifiedFirstPartyCartLandings(events: Array<Record<string, unknown>>): number {
  return events.filter((event) => String(event.event ?? "") === "mcp_cart_landing" && isQualifiedPublicFunnelEvent(event)).length;
}

function markdownTableCell(value: unknown): string {
  return safeEventText(value, 500).replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

interface PostInstallActivationRow {
  source: string;
  starts: number;
  tracked_config_fetches: number;
  install_intents: number;
  first_run_actions: number;
  first_run_executions: number;
  mcp_tool_calls: number;
  get_cart_handoff_candidates: number;
  get_pricing: number;
  check_inventory: number;
  create_cart_url_calls: number;
  external_qualified_create_cart_url_calls: number;
  qualified_cart_landings: number;
  recent_measured_cart_urls: string[];
}

const SOURCE_ACTIVATION_INTERNAL_SOURCES = new Set([
  "generic",
  "partner_demo",
  "codex",
  "codex_probe",
  "codex_probe_r04",
  "mcp_route_redirect",
]);

const SOURCE_ACTIVATION_DIRECTORY_STATUS: Record<string, string> = {
  cline_mcp_marketplace: "pending marketplace issue; convert reviewer/browser proof into a real hosted MCP client run",
  mcp_so: "stale public listing; issue updated, now needs returned measured cart URL opened",
  mcpservers_org: "submitted and stale; needs first-run action after listing/recrawl",
  mcp_directory: "queued and not visible; needs first-run action after listing appears",
  official_registry: "core registry live; needs downstream first-run and tool-call activation",
  glama_connector: "hosted connector healthy; needs downstream first-run and tool-call activation",
  glama_server_listing: "source listing stale; needs recrawl to hosted no-auth endpoint",
  docker_mcp_catalog: "remote-server PR open; needs review and post-merge activation",
  anthropic_connectors_directory: "manual connector submission still needed",
  smithery: "publish or claim blocked on authentication",
  browse_sh: "catalog live and installable; monitor installs and drive MCP-first runs",
};

const SOURCE_ACTIVATION_SEED_SOURCES = Object.keys(SOURCE_ACTIVATION_DIRECTORY_STATUS);

function emptySourceActivationRow(source: string): PostInstallActivationRow {
  return {
    source,
    starts: 0,
    tracked_config_fetches: 0,
    install_intents: 0,
    first_run_actions: 0,
    first_run_executions: 0,
    mcp_tool_calls: 0,
    get_cart_handoff_candidates: 0,
    get_pricing: 0,
    check_inventory: 0,
    create_cart_url_calls: 0,
    external_qualified_create_cart_url_calls: 0,
    qualified_cart_landings: 0,
    recent_measured_cart_urls: [],
  };
}

function sourceActivationRowsWithSeeds(rows: PostInstallActivationRow[]): PostInstallActivationRow[] {
  const bySource = new Map(rows.map((row) => [row.source, row]));
  for (const source of SOURCE_ACTIVATION_SEED_SOURCES) {
    if (!bySource.has(source)) bySource.set(source, emptySourceActivationRow(source));
  }
  return [...bySource.values()];
}

function sourcePreferredActivationTarget(source: string): string {
  if (source === "cline_mcp_marketplace") return "cline";
  return "generic_streamable_http";
}

function sourceActivationUrls(source: string) {
  const slug = encodeURIComponent(source);
  const target = sourcePreferredActivationTarget(source);
  const encodedTarget = encodeURIComponent(target);
  const trackedRun = `https://mcp.packrift.com/r/run/${slug}/${encodedTarget}`;
  const trackedInstallBase = `https://mcp.packrift.com/r/install/${slug}/${encodedTarget}`;
  return {
    preferred_target: target,
    tracked_start_url: `https://mcp.packrift.com/r/start/${slug}`,
    tracked_config_url: `https://mcp.packrift.com/r/config/${slug}`,
    tracked_install_url: `${trackedInstallBase}?format=html`,
    tracked_install_json_url: `${trackedInstallBase}?format=json`,
    tracked_first_run_url: `${trackedRun}?format=html`,
    tracked_first_run_execute_url: `${trackedRun}?execute=1`,
    reviewer_activation_url: `https://mcp.packrift.com/r/activate/${slug}`,
    reviewer_activation_runner_url: `https://mcp.packrift.com/r/activate/${slug}?format=html`,
    directory_update_card_json_url: `https://mcp.packrift.com/ai/mcp-directory-update/${slug}.json`,
    directory_update_card_markdown_url: `https://mcp.packrift.com/ai/mcp-directory-update/${slug}.md`,
  };
}

function sourceActivationStage(row: PostInstallActivationRow): string {
  if (row.qualified_cart_landings > 0 && row.mcp_tool_calls > 0) return "qualified cart landing and MCP tool calls visible";
  if (row.qualified_cart_landings > 0) return "qualified cart landing visible but real MCP tool calls missing";
  if (row.external_qualified_create_cart_url_calls > 0) return "external-qualified cart URL created but /r/cart landing missing";
  if (row.create_cart_url_calls > 0) return "cart URL created from unqualified or internal source";
  if (row.check_inventory > 0) return "live inventory checked, create_cart_url missing";
  if (row.get_pricing > 0) return "live price checked, inventory and cart URL missing";
  if (row.get_cart_handoff_candidates > 0) return "cart candidates fetched, price/inventory/cart sequence incomplete";
  if (row.mcp_tool_calls > 0) return "MCP tool calls visible, purchase sequence incomplete";
  if (row.first_run_executions > 0) return "browser first-run executions visible, real MCP tool calls missing";
  if (row.first_run_actions > 0) return "first-run action opens visible, execution/tool calls missing";
  if (row.install_intents > 0 || row.tracked_config_fetches > 0) return "install or config intent visible, first useful run missing";
  if (row.starts > 0) return "tracked start clicks only";
  return "discovery only";
}

function sourceActivationTargetEvent(row: PostInstallActivationRow): string {
  if (row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0) return "mcp_cart_landing";
  if (row.qualified_cart_landings > 0 && row.mcp_tool_calls === 0) return "mcp_tool_call";
  if (row.first_run_executions > 0 && row.mcp_tool_calls === 0) return "mcp_tool_call";
  if (row.create_cart_url_calls === 0 && row.check_inventory > 0) return "mcp_tool_call:create_cart_url";
  if (row.check_inventory === 0 && row.get_pricing > 0) return "mcp_tool_call:check_inventory";
  if (row.get_pricing === 0 && row.get_cart_handoff_candidates > 0) return "mcp_tool_call:get_pricing";
  if (row.get_cart_handoff_candidates === 0 && row.mcp_tool_calls > 0) return "mcp_tool_call:get_cart_handoff_candidates";
  if (row.first_run_actions > 0) return "mcp_first_run_execution";
  if (row.install_intents + row.tracked_config_fetches > 0) return "mcp_first_run_intent";
  return "mcp_install_intent";
}

function sourceActivationRecommendedAction(row: PostInstallActivationRow): string {
  if (row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0) {
    return "Send the returned measured /r/cart URL to the source reviewer or a real MCP-host user and count the blocker as resolved only when they open it from their side.";
  }
  if (row.qualified_cart_landings > 0 && row.mcp_tool_calls === 0) {
    if (sourcePreferredActivationTarget(row.source) === "cline") {
      return "Open the tracked Cline install page, copy the streamableHttp config into Cline, then paste the source-specific agent prompt so the source records real get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url tool calls.";
    }
    return "Paste the source-specific agent prompt into a real MCP host so the source records get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url tool calls, not only browser proof landings.";
  }
  if (row.first_run_executions > 0 && row.mcp_tool_calls === 0) {
    return "Convert browser first-run proof into a real MCP client run using the source-specific reviewer activation runner.";
  }
  if (row.create_cart_url_calls === 0 && row.mcp_tool_calls > 0) {
    return "Complete the purchase-ready MCP sequence for SKU 1066 through create_cart_url, then hand the returned measured cart URL to a real reviewer or buyer.";
  }
  if (row.first_run_actions > 0) return "Run the source-specific first-run page and require the live proof to finish with create_cart_url.";
  if (row.install_intents + row.tracked_config_fetches > 0) return "Open the source-specific first-run action after install/config so the source progresses beyond setup intent.";
  return "Use the source-specific tracked install page and agent prompt to create an attributed first useful run.";
}

function sourceActivationExternalActivationRequired(row: PostInstallActivationRow): boolean {
  return (
    (row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0) ||
    (row.qualified_cart_landings > 0 && row.mcp_tool_calls === 0) ||
    (row.first_run_executions > 0 && row.mcp_tool_calls === 0)
  );
}

function sourceActivationOperatorSafetyRule(row: PostInstallActivationRow): string {
  if (row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0) {
    return "Do not self-open this cart URL as completion proof. Share it with the source reviewer, directory operator, or a real MCP-host user; the row is complete only after an external source-side cart landing appears.";
  }
  if (row.qualified_cart_landings > 0 && row.mcp_tool_calls === 0) {
    return "Do not count browser proof as source activation. The missing proof is a real MCP host calling the hosted endpoint with the source-aware config.";
  }
  if (row.first_run_executions > 0 && row.mcp_tool_calls === 0) {
    return "Do not treat browser first-run execution as source activation. Convert it into a real MCP client run before counting the source as activated.";
  }
  return "Use source-aware links and only count proof created by a real external reviewer, MCP host, buyer, or directory surface.";
}

function sourceActivationExternalMessage(row: PostInstallActivationRow, urls: ReturnType<typeof sourceActivationUrls>): string {
  const cartUrl = row.recent_measured_cart_urls[0] ?? "";
  if (row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0) {
    return [
      "Packrift MCP produced a measured cart handoff for this source.",
      "",
      `Source: ${row.source}`,
      "Endpoint: https://mcp.packrift.com/mcp",
      `Directory update card: ${urls.directory_update_card_json_url}`,
      cartUrl ? `Measured cart URL to review: ${cartUrl}` : `Activation runner: ${urls.reviewer_activation_runner_url}`,
      `Install/config handoff: ${urls.tracked_install_url}`,
      "",
      "Please open the measured /r/cart URL from your review environment or MCP host so the source records a real qualified cart landing before Shopify checkout.",
    ].join("\n");
  }
  if (row.qualified_cart_landings > 0 && row.mcp_tool_calls === 0) {
    return [
      "Packrift MCP has source-attributed cart proof, but it still needs real MCP host tool calls.",
      "",
      `Source: ${row.source}`,
      "Endpoint: https://mcp.packrift.com/mcp",
      `Directory update card: ${urls.directory_update_card_json_url}`,
      `Install/config handoff: ${urls.tracked_install_url}`,
      `Machine-readable config: ${urls.tracked_install_json_url}`,
      `First-run prompt: ${urls.tracked_first_run_url}`,
      "",
      "Please install the hosted Streamable HTTP endpoint in the MCP host and run get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url for SKU 1066.",
    ].join("\n");
  }
  if (row.first_run_executions > 0 && row.mcp_tool_calls === 0) {
    return [
      "Packrift MCP browser proof is visible for this source, but the activation gate needs a real MCP client run.",
      "",
      `Source: ${row.source}`,
      "Endpoint: https://mcp.packrift.com/mcp",
      `Directory update card: ${urls.directory_update_card_json_url}`,
      `Activation runner: ${urls.reviewer_activation_runner_url}`,
      `Install/config handoff: ${urls.tracked_install_url}`,
      "",
      "Please run the sequence from an MCP host so the source records tools/list and tools/call events through the hosted endpoint.",
    ].join("\n");
  }
  return [
    "Packrift MCP is ready for source-aware activation.",
    "",
    `Source: ${row.source}`,
    "Endpoint: https://mcp.packrift.com/mcp",
    `Directory update card: ${urls.directory_update_card_json_url}`,
    `Install/config handoff: ${urls.tracked_install_url}`,
    `First-run action: ${urls.tracked_first_run_url}`,
    "",
    "Use these links in the source, directory listing, reviewer flow, or MCP host instructions so new visitors stay attributed to the source.",
  ].join("\n");
}

function sourceActivationPrimaryUrl(row: PostInstallActivationRow, urls: ReturnType<typeof sourceActivationUrls>): string {
  if (row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0) {
    return row.recent_measured_cart_urls[0] ?? urls.reviewer_activation_runner_url;
  }
  if (row.qualified_cart_landings > 0 && row.mcp_tool_calls === 0) {
    return urls.preferred_target === "cline" ? urls.tracked_install_url : urls.reviewer_activation_runner_url;
  }
  if (row.first_run_executions > 0 && row.mcp_tool_calls === 0) return urls.reviewer_activation_runner_url;
  if (row.first_run_actions > 0 || row.mcp_tool_calls > 0) return urls.tracked_first_run_url;
  if (row.install_intents + row.tracked_config_fetches > 0) return urls.tracked_first_run_url;
  return urls.tracked_install_url;
}

function sourceActivationPriorityScore(row: PostInstallActivationRow): number {
  const signalScore =
    Math.min(30, row.starts + row.tracked_config_fetches + row.install_intents + row.first_run_actions + row.first_run_executions) +
    Math.min(20, row.mcp_tool_calls * 2) +
    Math.min(20, row.qualified_cart_landings * 5);
  if (SOURCE_ACTIVATION_DIRECTORY_STATUS[row.source] && signalScore === 0) return 50;
  if (row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0) return 120 + signalScore;
  if (row.qualified_cart_landings > 0 && row.mcp_tool_calls === 0) return 110 + signalScore;
  if (row.first_run_executions > 0 && row.mcp_tool_calls === 0) return 100 + signalScore;
  if (row.create_cart_url_calls === 0 && row.mcp_tool_calls > 0) return 90 + signalScore;
  if (row.first_run_actions > 0) return 80 + signalScore;
  if (row.install_intents + row.tracked_config_fetches > 0) return 70 + signalScore;
  if (row.starts > 0) return 50 + signalScore;
  return signalScore;
}

function mcpSourceActivationPriorityQueue(rows: PostInstallActivationRow[]) {
  return sourceActivationRowsWithSeeds(rows)
    .filter((row) => !SOURCE_ACTIVATION_INTERNAL_SOURCES.has(row.source))
    .map((row) => {
      const urls = sourceActivationUrls(row.source);
      const score = sourceActivationPriorityScore(row);
      const priority = score >= 110 ? "critical" : score >= 80 ? "high" : score >= 50 ? "medium" : "watch";
      const firstUsefulRun = mcpFirstUsefulRun(row.source, urls.preferred_target);
      return {
        source: row.source,
        priority,
        priority_score: score,
        current_stage: sourceActivationStage(row),
        target_event_to_watch: sourceActivationTargetEvent(row),
        recommended_action: sourceActivationRecommendedAction(row),
        external_activation_required: sourceActivationExternalActivationRequired(row),
        operator_safety_rule: sourceActivationOperatorSafetyRule(row),
        external_activation_message: sourceActivationExternalMessage(row, urls),
        primary_action_url: sourceActivationPrimaryUrl(row, urls),
        preferred_target: urls.preferred_target,
        cart_landing_action_url: row.recent_measured_cart_urls[0] ?? null,
        recent_measured_cart_urls: row.recent_measured_cart_urls,
        directory_status: SOURCE_ACTIVATION_DIRECTORY_STATUS[row.source] ?? "source-attributed MCP activity visible; keep progressing toward real tool calls, measured carts, and orders",
        tracked_start_url: urls.tracked_start_url,
        tracked_config_url: urls.tracked_config_url,
        tracked_install_url: urls.tracked_install_url,
        tracked_install_json_url: urls.tracked_install_json_url,
        tracked_first_run_url: urls.tracked_first_run_url,
        tracked_first_run_execute_url: urls.tracked_first_run_execute_url,
        reviewer_activation_url: urls.reviewer_activation_url,
        reviewer_activation_runner_url: urls.reviewer_activation_runner_url,
        directory_update_card_json_url: urls.directory_update_card_json_url,
        directory_update_card_markdown_url: urls.directory_update_card_markdown_url,
        source_aware_endpoint: firstUsefulRun.endpoint,
        agent_prompt: firstUsefulRun.agent_prompt,
        acceptance_criteria: [
          `Source remains attributed as ${row.source}.`,
          `The agent host calls tools/list against ${firstUsefulRun.endpoint}.`,
          "The workflow calls get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url for SKU 1066.",
          "The returned measured https://mcp.packrift.com/r/cart/1066 URL is opened by an external reviewer, MCP host user, or buyer before any Shopify cart handoff.",
          "The funnel source row moves closer to material MCP tool calls, qualified cart landings, and attributed orders.",
        ],
        current_counts: {
          starts: row.starts,
          tracked_config_fetches: row.tracked_config_fetches,
          install_intents: row.install_intents,
          first_run_actions: row.first_run_actions,
          first_run_executions: row.first_run_executions,
          preferred_target: urls.preferred_target,
          mcp_tool_calls: row.mcp_tool_calls,
          create_cart_url_calls: row.create_cart_url_calls,
          external_qualified_create_cart_url_calls: row.external_qualified_create_cart_url_calls,
          qualified_cart_landings: row.qualified_cart_landings,
          recent_measured_cart_urls: row.recent_measured_cart_urls,
        },
      };
    })
    .filter((row) => row.priority !== "watch" || row.current_counts.starts + row.current_counts.install_intents + row.current_counts.first_run_actions > 0)
    .sort((a, b) => b.priority_score - a.priority_score || a.source.localeCompare(b.source))
    .slice(0, 25);
}

async function mcpSourceActivationQueuePayload(env: Env, date = todayUtc(), limit = 5000, orderDays = 90, orderLimit = 250) {
  const funnel = await mcpFunnelSnapshotPayload(env, date, limit, orderDays, orderLimit);
  const blockingGates = Object.entries(funnel.proof_gate)
    .filter(([, value]) => value === false)
    .map(([key]) => key);
  return {
    release: "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R09",
    generated_at: new Date().toISOString(),
    date,
    canonical_endpoint: "https://mcp.packrift.com/mcp",
    status: funnel.source_activation_priority_queue.length > 0 ? "activation_needed" : "no_priority_sources",
    purpose:
      "Public next-best-action queue for converting Packrift MCP directory/source activity into real MCP tool calls, qualified /r/cart landings, and MCP-attributed purchases.",
    source_snapshot: {
      funnel_release: funnel.release,
      funnel_status: funnel.status,
      external_qualified_mcp_tool_calls: funnel.counts.external_qualified_mcp_tool_calls,
      material_tool_usage_50_plus: funnel.proof_gate.material_tool_usage_50_plus,
      qualified_first_party_mcp_cart_landings: funnel.counts.qualified_first_party_mcp_cart_landings,
      first_party_mcp_orders: funnel.counts.first_party_mcp_orders,
      first_party_mcp_order_revenue: funnel.counts.first_party_mcp_order_revenue,
      unique_qualified_mcp_identity_signals: funnel.counts.unique_qualified_mcp_identity_signals,
      unique_qualified_mcp_session_ids: funnel.counts.unique_qualified_mcp_session_ids,
      unique_qualified_mcp_handoff_ids: funnel.counts.unique_qualified_mcp_handoff_ids,
      unique_qualified_ai_commerce_journey_ids: funnel.counts.unique_qualified_ai_commerce_journey_ids,
      monthly_qualified_visitor_signals: funnel.counts.monthly_qualified_visitor_signals,
      monthly_qualified_visitor_threshold: funnel.counts.monthly_qualified_visitor_threshold,
      monthly_qualified_visitor_remaining: funnel.counts.monthly_qualified_visitor_remaining,
      ga4_qualified_external_mcp_session_starts: funnel.counts.ga4_qualified_external_mcp_session_starts,
      ga4_qualified_external_mcp_session_threshold: funnel.counts.ga4_qualified_external_mcp_session_threshold,
      ga4_canonical_visitor_proof: funnel.ga4_canonical_visitor_proof,
      traffic_quality: funnel.traffic_quality,
      monthly_qualified_visitor_proof: funnel.monthly_qualified_visitor_proof,
    },
    queue_count: funnel.source_activation_priority_queue.length,
    critical_count: funnel.source_activation_priority_queue.filter((row) => row.priority === "critical").length,
    blocking_goal_gates: blockingGates,
    critical_actions: funnel.source_activation_priority_queue
      .filter((row) => row.priority === "critical")
      .slice(0, 5)
      .map((row) => ({
        source: row.source,
        current_stage: row.current_stage,
        target_event_to_watch: row.target_event_to_watch,
        recommended_action: row.recommended_action,
        external_activation_required: row.external_activation_required,
        operator_safety_rule: row.operator_safety_rule,
        external_activation_message: row.external_activation_message,
        run_real_mcp_check_url: row.reviewer_activation_runner_url,
        host_install_url: row.tracked_install_url,
        host_install_json_url: row.tracked_install_json_url,
        directory_update_card_json_url: row.directory_update_card_json_url,
        directory_update_card_markdown_url: row.directory_update_card_markdown_url,
        source_aware_endpoint: row.source_aware_endpoint,
        cart_landing_action_url: row.cart_landing_action_url,
        recent_measured_cart_urls: row.recent_measured_cart_urls,
        primary_action_url: row.primary_action_url,
      })),
    queue: funnel.source_activation_priority_queue,
    links: {
      source_activation_queue_json: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      source_activation_queue_markdown: "https://mcp.packrift.com/ai/mcp-source-activation-queue.md",
      source_activation_queue_html: "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
      activation_experiments_json: "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
      activation_experiments_markdown: "https://mcp.packrift.com/ai/mcp-activation-experiments.md",
      activation_experiments_html: "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
      activation_command_center: "https://mcp.packrift.com/r/activate",
      funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      ga4_funnel_proof: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      reviewer_activation: "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      directory_update_card_template: "https://mcp.packrift.com/ai/mcp-directory-update/{source}.json",
      agent_capture_outreach: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
    },
    operating_rule:
      "Work this queue until source rows show real MCP tool calls, qualified cart landings, and attributed orders. This queue is not completion proof by itself.",
  };
}

function mcpSourceActivationQueueMarkdown(payload: Awaited<ReturnType<typeof mcpSourceActivationQueuePayload>>): string {
  return [
    "# Packrift MCP Source Activation Queue",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Date: ${payload.date}`,
    `Status: ${payload.status}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    payload.purpose,
    "",
    "## Funnel Snapshot",
    "",
    `- Funnel release: ${payload.source_snapshot.funnel_release}`,
    `- Funnel status: ${payload.source_snapshot.funnel_status}`,
    `- External-qualified MCP tool calls: ${payload.source_snapshot.external_qualified_mcp_tool_calls}`,
    `- Qualified MCP cart landings: ${payload.source_snapshot.qualified_first_party_mcp_cart_landings}`,
    `- Monthly qualified visitor signals: ${payload.source_snapshot.monthly_qualified_visitor_signals} / ${payload.source_snapshot.monthly_qualified_visitor_threshold}`,
    `- Monthly qualified visitor gap: ${payload.source_snapshot.monthly_qualified_visitor_remaining}`,
    `- GA4 qualified external MCP sessions: ${payload.source_snapshot.ga4_qualified_external_mcp_session_starts} / ${payload.source_snapshot.ga4_qualified_external_mcp_session_threshold}`,
    `- GA4 proof status: ${payload.source_snapshot.ga4_canonical_visitor_proof.status}`,
    `- First-party MCP orders: ${payload.source_snapshot.first_party_mcp_orders}`,
    `- First-party MCP revenue: ${payload.source_snapshot.first_party_mcp_order_revenue}`,
    `- Unique qualified MCP identity signals: ${payload.source_snapshot.unique_qualified_mcp_identity_signals}`,
    `- Unique qualified MCP session IDs: ${payload.source_snapshot.unique_qualified_mcp_session_ids}`,
    `- Blocking gates: ${payload.blocking_goal_gates.join(", ") || "none"}`,
    "",
    "## Priority Queue",
    "",
    "| Priority | Source | Current stage | Target event | Primary action | Action URL | Update card | Host install | Recent measured cart URL |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    payload.queue
      .slice(0, 15)
      .map(
        (row) =>
          `| ${row.priority} | ${row.source} | ${markdownTableCell(row.current_stage)} | ${row.target_event_to_watch} | ${markdownTableCell(row.recommended_action)} | ${row.primary_action_url} | ${row.directory_update_card_json_url} | ${row.tracked_install_url} | ${row.recent_measured_cart_urls[0] ?? ""} |`
      )
      .join("\n") || "| none | none | none | none | none | none | none | none | none |",
    "",
    "## Acceptance Rule",
    "",
    payload.operating_rule,
    "",
    "## Command Center",
    "",
    `- HTML command center: ${payload.links.activation_command_center}`,
    `- Source activation queue HTML: ${payload.links.source_activation_queue_html}`,
    `- Activation experiments: ${payload.links.activation_experiments_json}`,
    `- Activation experiments HTML: ${payload.links.activation_experiments_html}`,
    `- GA4 funnel proof: ${payload.links.ga4_funnel_proof}`,
    "",
  ].join("\n");
}

function mcpSourceActivationQueueHtml(payload: Awaited<ReturnType<typeof mcpSourceActivationQueuePayload>>): string {
  const criticalRows = payload.queue.filter((row) => row.priority === "critical");
  const rows = (criticalRows.length ? criticalRows : payload.queue).slice(0, 12);
  const queueCards = rows
    .map((row, index) => {
      const counts = row.current_counts;
      const cartLandingActionUrl = row.cart_landing_action_url || "";
      const needsHostToolCall = row.target_event_to_watch.startsWith("mcp_tool_call") && counts.mcp_tool_calls === 0;
      const primaryLabel = cartLandingActionUrl
        ? "Share returned cart URL"
        : needsHostToolCall && row.preferred_target === "cline"
          ? "Install in Cline"
          : needsHostToolCall
            ? "Install in MCP host"
            : "Run real MCP check";
      const secondaryCheckLink =
        cartLandingActionUrl && row.reviewer_activation_runner_url !== row.primary_action_url
          ? `<a class="button" href="${escapeHtml(row.reviewer_activation_runner_url)}">Run real MCP check</a>`
          : "";
      const hostConfigLink =
        needsHostToolCall && row.tracked_install_json_url
          ? `<a class="button" href="${escapeHtml(row.tracked_install_json_url)}">Copy host config</a>`
          : "";
      const firstRecentCartUrl = row.recent_measured_cart_urls[0] ?? "";
      const agentPrompt = row.agent_prompt || "";
      const recentCartUrls = firstRecentCartUrl
        ? `<p class="cart-url">Returned cart URL: <a href="${escapeHtml(firstRecentCartUrl)}">${escapeHtml(firstRecentCartUrl)}</a></p>`
        : "";
      const safetyRule = row.operator_safety_rule ? `<p class="safety">${escapeHtml(row.operator_safety_rule)}</p>` : "";
      const externalMessage = row.external_activation_message
        ? `<details class="activation-message" open>
          <summary>External activation message</summary>
          <pre>${escapeHtml(row.external_activation_message)}</pre>
        </details>`
        : "";
      return `<article class="row ${escapeHtml(row.priority)}">
        <div class="row-head">
          <div>
            <p class="eyebrow">${escapeHtml(row.priority)} · #${index + 1}</p>
            <h2>${escapeHtml(row.source)}</h2>
          </div>
          <span class="target">${escapeHtml(row.target_event_to_watch)}</span>
        </div>
        <p class="stage">${escapeHtml(row.current_stage)}</p>
        <p>${escapeHtml(row.recommended_action)}</p>
        ${safetyRule}
        <p class="endpoint">Source-aware endpoint: <code>${escapeHtml(row.source_aware_endpoint)}</code></p>
        ${recentCartUrls}
        <div class="metrics">
          <span>starts ${counts.starts}</span>
          <span>installs ${counts.install_intents}</span>
          <span>runs ${counts.first_run_executions}</span>
          <span>tools ${counts.mcp_tool_calls}</span>
          <span>carts ${counts.qualified_cart_landings}</span>
        </div>
        <div class="actions">
          <a class="button primary" href="${escapeHtml(row.primary_action_url)}">${primaryLabel}</a>
          ${secondaryCheckLink}
          ${hostConfigLink}
          <a class="button" href="${escapeHtml(row.directory_update_card_markdown_url)}">Update card</a>
          <a class="button" href="${escapeHtml(row.tracked_install_url)}">Install path</a>
          <a class="button" href="${escapeHtml(row.tracked_first_run_execute_url)}">Live proof</a>
        </div>
        ${externalMessage}
        <details>
          <summary>Acceptance criteria</summary>
          <ul>${row.acceptance_criteria.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </details>
        <details>
          <summary>Source-specific agent prompt</summary>
          <pre>${escapeHtml(agentPrompt)}</pre>
        </details>
      </article>`;
    })
    .join("");
  const blocking = payload.blocking_goal_gates.map((gate) => `<span>${escapeHtml(gate)}</span>`).join("") || "<span>none</span>";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift MCP Activation Command Center</title>
  <meta name="description" content="Source-ranked Packrift MCP activation queue with one-click real MCP runner links for moving installs and proofs into measured cart handoff.">
  <style>
    :root{color-scheme:light;--ink:#17211d;--muted:#596a63;--line:#d7ded8;--paper:#f7f8f5;--panel:#fff;--green:#0f6b4f;--blue:#245f9b;--amber:#96610f;--red:#9f2d20}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1160px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:16px;padding-bottom:24px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4.6rem);line-height:.96;letter-spacing:0}
    h2{margin:0;font-size:1.15rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:840px}
    a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px}
    .status,.metrics,.actions,.blocking{display:flex;flex-wrap:wrap;gap:8px}
    .status span,.metrics span,.blocking span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .queue{display:grid;gap:14px;margin-top:22px}
    .row{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}
    .row.critical{border-left:5px solid var(--red)}
    .row.high{border-left:5px solid var(--amber)}
    .row-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .eyebrow{font-size:.82rem;text-transform:uppercase;color:var(--muted);letter-spacing:0;margin-bottom:2px}
    .target{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:5px 9px;font-size:.86rem;color:var(--green);white-space:nowrap}
    .stage{font-weight:650;color:var(--ink);margin:10px 0 4px}
    .cart-url{margin-top:8px;overflow-wrap:anywhere}
    .safety{margin-top:8px;color:var(--red);font-weight:650}
    .activation-message{margin-top:12px}
    .endpoint{margin-top:8px;overflow-wrap:anywhere}
    code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#f9faf8;padding:12px;color:var(--ink);font-size:.88rem}
    .metrics{margin:12px 0}
    .button{display:inline-flex;align-items:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    details{margin-top:12px}
    summary{cursor:pointer;font-weight:650}
    li{margin:5px 0;color:var(--muted)}
    .links{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px}
    @media (max-width:680px){.row-head{display:grid}.target{white-space:normal}.button{width:100%;justify-content:center}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift MCP Activation Command Center</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>Status: ${escapeHtml(payload.status)}</span>
        <span>Queue: ${payload.queue_count}</span>
        <span>Critical: ${payload.critical_count}</span>
        <span>Tool calls: ${payload.source_snapshot.external_qualified_mcp_tool_calls}</span>
        <span>Cart landings: ${payload.source_snapshot.qualified_first_party_mcp_cart_landings}</span>
        <span>Qualified visitors: ${payload.source_snapshot.monthly_qualified_visitor_signals}/${payload.source_snapshot.monthly_qualified_visitor_threshold}</span>
        <span>Unique identity signals: ${payload.source_snapshot.unique_qualified_mcp_identity_signals}</span>
        <span>Orders: ${payload.source_snapshot.first_party_mcp_orders}</span>
      </div>
      <div class="blocking">${blocking}</div>
      <div class="links">
        <a href="${escapeHtml(payload.links.source_activation_queue_json)}">JSON</a>
        <a href="${escapeHtml(payload.links.source_activation_queue_markdown)}">Markdown</a>
        <a href="${escapeHtml(payload.links.activation_experiments_html)}">Experiments</a>
        <a href="${escapeHtml(payload.links.funnel_snapshot)}">Funnel snapshot</a>
        <a href="${escapeHtml(payload.links.usage_snapshot)}">Usage snapshot</a>
      </div>
    </header>
    <section class="queue">${queueCards || "<p>No priority source rows are waiting right now.</p>"}</section>
  </main>
</body>
</html>`;
}

interface SourceActivationExperimentQueueRow {
  source: string;
  priority: string;
  priority_score: number;
  current_stage: string;
  target_event_to_watch: string;
  recommended_action: string;
  external_activation_required: boolean;
  operator_safety_rule: string;
  external_activation_message: string;
  primary_action_url: string;
  preferred_target: string;
  cart_landing_action_url: string | null;
  recent_measured_cart_urls: string[];
  directory_status: string;
  tracked_start_url: string;
  tracked_config_url: string;
  tracked_install_url: string;
  tracked_install_json_url: string;
  tracked_first_run_url: string;
  tracked_first_run_execute_url: string;
  reviewer_activation_url: string;
  reviewer_activation_runner_url: string;
  directory_update_card_json_url: string;
  directory_update_card_markdown_url: string;
  source_aware_endpoint: string;
  agent_prompt: string;
  acceptance_criteria: string[];
  current_counts: {
    starts: number;
    tracked_config_fetches: number;
    install_intents: number;
    first_run_actions: number;
    first_run_executions: number;
    preferred_target: string;
    mcp_tool_calls: number;
    create_cart_url_calls: number;
    external_qualified_create_cart_url_calls: number;
    qualified_cart_landings: number;
    recent_measured_cart_urls: string[];
  };
}

function sourceActivationExperimentHypothesis(row: SourceActivationExperimentQueueRow): string {
  if (row.target_event_to_watch === "mcp_cart_landing") {
    return "A measured cart URL already exists for this source; getting it opened by a real source-side reviewer or MCP host should lift qualified first-party cart landings without inflating tool-call proof.";
  }
  if (row.target_event_to_watch.startsWith("mcp_tool_call") && row.current_counts.qualified_cart_landings > 0) {
    return "This source can reach a qualified cart landing, but the missing proof is a real MCP host calling the hosted endpoint through the source-aware config.";
  }
  if (row.target_event_to_watch.startsWith("mcp_tool_call")) {
    return "The source has enough setup or runtime signal to justify a source-aware MCP host run that completes the tool sequence through create_cart_url.";
  }
  if (row.target_event_to_watch === "mcp_first_run_execution") {
    return "The source has first-run interest; running the source-specific first-run path should move it from intent into executable proof.";
  }
  if (row.target_event_to_watch === "mcp_first_run_intent") {
    return "The source has install or config intent; the next useful lift is a tracked first-run action tied to the same source.";
  }
  return "The source is visible enough to test; a tracked install handoff should create the first measurable activation signal.";
}

function sourceActivationExpectedSnapshotDelta(row: SourceActivationExperimentQueueRow) {
  const target = row.target_event_to_watch;
  if (target === "mcp_cart_landing") {
    return {
      source_activation_queue: `Source ${row.source} should move past ${target} once an external /r/cart landing appears.`,
      usage_snapshot: "mcp_cart_landings and qualified cart landing-related source rows should increase.",
      funnel_snapshot: "qualified_first_party_mcp_cart_landings should increase; the cart proof gate should remain tied to first-party /r/cart telemetry.",
      ga4_funnel_proof: "GA4 visitor proof only changes if the external cart landing also creates a qualified GA4 session; do not backfill this from browser checks.",
    };
  }
  if (target.startsWith("mcp_tool_call")) {
    return {
      source_activation_queue: `Source ${row.source} should show more MCP tool-call depth and progress toward create_cart_url.`,
      usage_snapshot: "external_qualified_mcp_tool_calls should increase; create_cart_url-specific counts increase only if the sequence reaches create_cart_url.",
      funnel_snapshot: "external_qualified_mcp_tool_calls should move toward the 50+ material usage gate.",
      ga4_funnel_proof: "Tool calls alone do not prove thousands of visitors; GA4 session proof must stay separate.",
    };
  }
  if (target === "mcp_first_run_execution") {
    return {
      source_activation_queue: `Source ${row.source} should move from first-run intent into first-run execution and then tool calls.`,
      usage_snapshot: "mcp_first_run_execution_events should increase for the source.",
      funnel_snapshot: "mcp_first_run_execution_events should increase, but revenue and visitor gates remain unproven until external sessions and orders appear.",
      ga4_funnel_proof: "No GA4 visitor lift should be claimed from a local first-run execution by itself.",
    };
  }
  if (target === "mcp_first_run_intent") {
    return {
      source_activation_queue: `Source ${row.source} should move from install/config intent toward a first useful run.`,
      usage_snapshot: "mcp_first_run_intent_events should increase for the source.",
      funnel_snapshot: "mcp_first_run_intent_events should increase; the next experiment should target first-run execution or tool calls.",
      ga4_funnel_proof: "No GA4 visitor lift should be claimed from setup intent by itself.",
    };
  }
  return {
    source_activation_queue: `Source ${row.source} should move from discovery toward install intent.`,
    usage_snapshot: "mcp_install_intent_events or tracked config fetches should increase for the source.",
    funnel_snapshot: "Install/config proof should improve, but material tool usage, visitor, and revenue gates remain separate.",
    ga4_funnel_proof: "No GA4 visitor lift should be claimed until a real external session_start appears.",
  };
}

function sourceActivationSuppressionRules(row: SourceActivationExperimentQueueRow): string[] {
  return [
    row.operator_safety_rule,
    "Do not count Codex local smoke checks, localhost probes, distribution_check requests, manual_verify events, or mcp_cart_handoff_smoke events as source activation.",
    "Do not count generated resource fetches, /resources/list, proof-page opens, or sitemap crawling as buyer demand.",
    "Do not self-open a returned /r/cart URL to close a cart-landing experiment; completion requires a source-side reviewer, MCP host user, or buyer.",
    "Keep GA4-qualified visitor proof separate from MCP tool proof; the thousands-of-visitors gate closes only from qualified external GA4 session_start evidence.",
  ];
}

function sourceActivationCopyReadyRequest(row: SourceActivationExperimentQueueRow): string {
  if (row.external_activation_message.trim()) return row.external_activation_message;
  return [
    "Packrift MCP source activation request",
    "",
    `Source: ${row.source}`,
    "Endpoint: https://mcp.packrift.com/mcp",
    `Directory update card: ${row.directory_update_card_json_url}`,
    `Install/config handoff: ${row.tracked_install_url}`,
    `Machine-readable config: ${row.tracked_install_json_url}`,
    `First-run action: ${row.tracked_first_run_url}`,
    `Activation runner: ${row.reviewer_activation_runner_url}`,
    "",
    "Please install the hosted Streamable HTTP endpoint in a real MCP host and run get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url for SKU 1066. Use the returned https://mcp.packrift.com/r/cart/ URL as the measured cart handoff.",
  ].join("\n");
}

function sourceActivationExperimentRows(rows: SourceActivationExperimentQueueRow[]) {
  return rows.slice(0, 25).map((row, index) => {
    const target = row.target_event_to_watch;
    return {
      experiment_id: `${row.source}:${target}`,
      priority_rank: index + 1,
      source: row.source,
      priority: row.priority,
      priority_score: row.priority_score,
      current_stage: row.current_stage,
      directory_status: row.directory_status,
      hypothesis: sourceActivationExperimentHypothesis(row),
      target_event_to_watch: target,
      required_external_actor: row.external_activation_required
        ? "A source-side reviewer, directory operator, real MCP host user, or buyer outside Packrift self-checks."
        : "A real MCP host or directory reviewer using the source-aware links; local proof can prepare the path but does not close buyer or visitor gates.",
      recommended_action: row.recommended_action,
      tracked_start_url: row.tracked_start_url,
      tracked_config_url: row.tracked_config_url,
      tracked_install_url: row.tracked_install_url,
      tracked_install_json_url: row.tracked_install_json_url,
      tracked_first_run_url: row.tracked_first_run_url,
      tracked_first_run_execute_url: row.tracked_first_run_execute_url,
      reviewer_activation_url: row.reviewer_activation_url,
      reviewer_activation_runner_url: row.reviewer_activation_runner_url,
      directory_update_card_json_url: row.directory_update_card_json_url,
      directory_update_card_markdown_url: row.directory_update_card_markdown_url,
      primary_action_url: row.primary_action_url,
      cart_landing_action_url: row.cart_landing_action_url,
      recent_measured_cart_urls: row.recent_measured_cart_urls,
      source_aware_endpoint: row.source_aware_endpoint,
      agent_prompt: row.agent_prompt,
      expected_snapshot_delta: sourceActivationExpectedSnapshotDelta(row),
      suppression_rules: sourceActivationSuppressionRules(row),
      success_gate: `Complete only when ${target} is visible for source=${row.source} in the source activation queue or funnel snapshot from non-suppressed external proof.`,
      copy_ready_activation_request: sourceActivationCopyReadyRequest(row),
      measurement_urls: {
        activation_experiments: "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
        activation_experiments_html: "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
        source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
        source_activation_queue_html: "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
        directory_update_card: row.directory_update_card_json_url,
        activation_command_center: "https://mcp.packrift.com/r/activate",
        usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
        funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
        ga4_funnel_proof: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
      },
      current_counts: row.current_counts,
      acceptance_criteria: row.acceptance_criteria,
    };
  });
}

async function mcpActivationExperimentsPayload(env: Env, date = todayUtc(), limit = 5000, orderDays = 90, orderLimit = 250) {
  const queuePayload = await mcpSourceActivationQueuePayload(env, date, limit, orderDays, orderLimit);
  const experiments = sourceActivationExperimentRows(queuePayload.queue);
  return {
    release: "PACKRIFT-MCP-ACTIVATION-EXPERIMENTS-R02",
    generated_at: new Date().toISOString(),
    date,
    canonical_endpoint: "https://mcp.packrift.com/mcp",
    status: experiments.length > 0 ? "experiments_ready" : "no_priority_experiments",
    purpose:
      "Public source-specific activation experiments for turning Packrift MCP directory/source activity into measurable external MCP tool calls, qualified cart landings, GA4-qualified sessions, and attributed orders.",
    source_queue_release: queuePayload.release,
    source_queue_status: queuePayload.status,
    source_snapshot: queuePayload.source_snapshot,
    blocking_goal_gates: queuePayload.blocking_goal_gates,
    experiment_count: experiments.length,
    critical_count: experiments.filter((row) => row.priority === "critical").length,
    experiments,
    links: {
      activation_experiments_json: "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
      activation_experiments_markdown: "https://mcp.packrift.com/ai/mcp-activation-experiments.md",
      activation_experiments_html: "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
      source_activation_queue_json: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      source_activation_queue_html: "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
      activation_command_center: "https://mcp.packrift.com/r/activate",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      ga4_funnel_proof: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
    },
    operating_rule:
      "Run the highest-priority experiments first, but do not treat experiment creation, proof-page views, or self-opened cart URLs as goal completion. Completion requires non-suppressed external proof in the linked snapshots.",
  };
}

function mcpActivationExperimentsMarkdown(payload: Awaited<ReturnType<typeof mcpActivationExperimentsPayload>>): string {
  return [
    "# Packrift MCP Activation Experiments",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Date: ${payload.date}`,
    `Status: ${payload.status}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    payload.purpose,
    "",
    "## Funnel Gate Snapshot",
    "",
    `- Source queue release: ${payload.source_queue_release}`,
    `- External-qualified MCP tool calls: ${payload.source_snapshot.external_qualified_mcp_tool_calls}`,
    `- Qualified MCP cart landings: ${payload.source_snapshot.qualified_first_party_mcp_cart_landings}`,
    `- GA4 qualified external MCP sessions: ${payload.source_snapshot.ga4_qualified_external_mcp_session_starts} / ${payload.source_snapshot.ga4_qualified_external_mcp_session_threshold}`,
    `- Monthly qualified visitor signals: ${payload.source_snapshot.monthly_qualified_visitor_signals} / ${payload.source_snapshot.monthly_qualified_visitor_threshold}`,
    `- First-party MCP orders: ${payload.source_snapshot.first_party_mcp_orders}`,
    `- First-party MCP revenue: ${payload.source_snapshot.first_party_mcp_order_revenue}`,
    `- Unique qualified MCP identity signals: ${payload.source_snapshot.unique_qualified_mcp_identity_signals}`,
    `- Unique qualified MCP session IDs: ${payload.source_snapshot.unique_qualified_mcp_session_ids}`,
    `- Blocking gates: ${payload.blocking_goal_gates.join(", ") || "none"}`,
    "",
    "## Experiments",
    "",
    "| Rank | Priority | Source | Target event | Hypothesis | Success gate | Primary action |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    payload.experiments
      .slice(0, 15)
      .map(
        (row) =>
          `| ${row.priority_rank} | ${row.priority} | ${row.source} | ${row.target_event_to_watch} | ${markdownTableCell(row.hypothesis)} | ${markdownTableCell(row.success_gate)} | ${row.primary_action_url} |`
      )
      .join("\n") || "| none | none | none | none | none | none | none |",
    "",
    "## Operating Rule",
    "",
    payload.operating_rule,
    "",
    "## Measurement URLs",
    "",
    `- Experiments JSON: ${payload.links.activation_experiments_json}`,
    `- Experiments HTML: ${payload.links.activation_experiments_html}`,
    `- Source activation queue: ${payload.links.source_activation_queue_json}`,
    `- Funnel snapshot: ${payload.links.funnel_snapshot}`,
    `- GA4 funnel proof: ${payload.links.ga4_funnel_proof}`,
    "",
  ].join("\n");
}

function mcpActivationExperimentsHtml(payload: Awaited<ReturnType<typeof mcpActivationExperimentsPayload>>): string {
  const cards = payload.experiments
    .slice(0, 15)
    .map((row) => {
      const counts = row.current_counts;
      const rules = row.suppression_rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("");
      return `<article class="experiment ${escapeHtml(row.priority)}">
        <div class="head">
          <div>
            <p class="eyebrow">${escapeHtml(row.priority)} · #${row.priority_rank}</p>
            <h2>${escapeHtml(row.source)}</h2>
          </div>
          <span>${escapeHtml(row.target_event_to_watch)}</span>
        </div>
        <p class="stage">${escapeHtml(row.current_stage)}</p>
        <p>${escapeHtml(row.hypothesis)}</p>
        <p class="gate">${escapeHtml(row.success_gate)}</p>
        <div class="metrics">
          <span>starts ${counts.starts}</span>
          <span>installs ${counts.install_intents}</span>
          <span>runs ${counts.first_run_executions}</span>
          <span>tools ${counts.mcp_tool_calls}</span>
          <span>carts ${counts.qualified_cart_landings}</span>
        </div>
        <div class="actions">
          <a class="button primary" href="${escapeHtml(row.primary_action_url)}">Primary action</a>
          <a class="button" href="${escapeHtml(row.tracked_install_url)}">Install</a>
          <a class="button" href="${escapeHtml(row.tracked_first_run_url)}">First run</a>
          <a class="button" href="${escapeHtml(row.reviewer_activation_runner_url)}">Activation runner</a>
        </div>
        <details>
          <summary>Expected snapshot delta</summary>
          <ul>
            <li>${escapeHtml(row.expected_snapshot_delta.source_activation_queue)}</li>
            <li>${escapeHtml(row.expected_snapshot_delta.usage_snapshot)}</li>
            <li>${escapeHtml(row.expected_snapshot_delta.funnel_snapshot)}</li>
            <li>${escapeHtml(row.expected_snapshot_delta.ga4_funnel_proof)}</li>
          </ul>
        </details>
        <details>
          <summary>Suppression rules</summary>
          <ul>${rules}</ul>
        </details>
        <details>
          <summary>Copy-ready activation request</summary>
          <pre>${escapeHtml(row.copy_ready_activation_request)}</pre>
        </details>
        <details>
          <summary>Source-specific agent prompt</summary>
          <pre>${escapeHtml(row.agent_prompt)}</pre>
        </details>
      </article>`;
    })
    .join("");
  const blockers = payload.blocking_goal_gates.map((gate) => `<span>${escapeHtml(gate)}</span>`).join("") || "<span>none</span>";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift MCP Activation Experiments</title>
  <meta name="description" content="Source-specific Packrift MCP activation experiments tied to external proof gates, snapshot deltas, and suppression rules.">
  <style>
    :root{color-scheme:light;--ink:#18211e;--muted:#5b6964;--line:#d8ded9;--paper:#f6f7f4;--panel:#fff;--green:#0d684c;--blue:#245f9b;--red:#9f2d20;--amber:#8c6218}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1160px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:16px;padding-bottom:24px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4.4rem);line-height:.98;letter-spacing:0}
    h2{margin:0;font-size:1.15rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:880px}
    a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px}
    .status,.metrics,.actions,.blockers,.links{display:flex;flex-wrap:wrap;gap:8px}
    .status span,.metrics span,.blockers span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .experiments{display:grid;gap:14px;margin-top:22px}
    .experiment{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}
    .experiment.critical{border-left:5px solid var(--red)}
    .experiment.high{border-left:5px solid var(--amber)}
    .head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .head span{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:5px 9px;font-size:.86rem;color:var(--green);white-space:nowrap}
    .eyebrow{font-size:.82rem;text-transform:uppercase;color:var(--muted);letter-spacing:0;margin-bottom:2px}
    .stage{font-weight:650;color:var(--ink);margin:10px 0 4px}
    .gate{margin-top:8px;color:var(--red);font-weight:650}
    .metrics{margin:12px 0}
    .button{display:inline-flex;align-items:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#f9faf8;padding:12px;color:var(--ink);font-size:.88rem}
    details{margin-top:12px}
    summary{cursor:pointer;font-weight:650}
    li{margin:5px 0;color:var(--muted)}
    @media (max-width:680px){.head{display:grid}.head span{white-space:normal}.button{width:100%;justify-content:center}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift MCP Activation Experiments</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>Status: ${escapeHtml(payload.status)}</span>
        <span>Experiments: ${payload.experiment_count}</span>
        <span>Critical: ${payload.critical_count}</span>
        <span>GA4 sessions: ${payload.source_snapshot.ga4_qualified_external_mcp_session_starts}/${payload.source_snapshot.ga4_qualified_external_mcp_session_threshold}</span>
        <span>Unique identity signals: ${payload.source_snapshot.unique_qualified_mcp_identity_signals}</span>
        <span>Tool calls: ${payload.source_snapshot.external_qualified_mcp_tool_calls}</span>
        <span>Orders: ${payload.source_snapshot.first_party_mcp_orders}</span>
      </div>
      <div class="blockers">${blockers}</div>
      <div class="links">
        <a href="${escapeHtml(payload.links.activation_experiments_json)}">JSON</a>
        <a href="${escapeHtml(payload.links.activation_experiments_markdown)}">Markdown</a>
        <a href="${escapeHtml(payload.links.source_activation_queue_html)}">Source queue</a>
        <a href="${escapeHtml(payload.links.funnel_snapshot)}">Funnel snapshot</a>
        <a href="${escapeHtml(payload.links.ga4_funnel_proof)}">GA4 proof</a>
      </div>
    </header>
    <section class="experiments">${cards || "<p>No activation experiments are ready right now.</p>"}</section>
  </main>
</body>
</html>`;
}

function publicFunnelTrafficBuckets(summary: ReturnType<typeof summarizeAiSalesEvents>) {
  const buckets = {
    external_qualified_demand: 0,
    external_unqualified_ai_crawl: 0,
    internal_synthetic: 0,
    self_generated_distribution: 0,
    unknown: 0,
  };
  const rows = summary.by_event_attribution ?? [];
  for (const row of rows) {
    const text = safeEventText(row.key, 500).toLowerCase();
    const count = Number(row.count || 0);
    if (matchesPublicFunnelInternalSynthetic(text)) buckets.internal_synthetic += count;
    else if (matchesPublicFunnelSelfGenerated(text)) buckets.self_generated_distribution += count;
    else if (matchesPublicFunnelQualifiedDemand(text)) buckets.external_qualified_demand += count;
    else if (/bot|crawler|spider|gptbot|oai_searchbot|claude|anthropic|google|bing|duckduck|bytespider/.test(text)) {
      buckets.external_unqualified_ai_crawl += count;
    } else {
      buckets.unknown += count;
    }
  }
  return buckets;
}

function publicOrderSourceBuckets(orders: Array<Record<string, unknown>> | undefined) {
  const counts: Record<string, number> = {};
  for (const order of orders ?? []) {
    const attribution = objectValue(order.attribution);
    const source = safeEventText(attribution?.utm_source, 80) || "unknown";
    counts[source] = (counts[source] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([key, count]) => ({ key, count }));
}

function publicMcpOrderUnavailableSummary(error: string, days: number, limit: number) {
  return {
    ok: false,
    release: MCP_ORDER_ATTRIBUTION_RELEASE,
    error,
    lookback_days: days,
    scan_limit: limit,
    scanned_order_count: null,
    attributed_order_count: 0,
    attributed_revenue: 0,
    currency: "USD",
    proof_gate: {
      first_party_mcp_orders_seen: false,
      first_party_mcp_revenue_seen: false,
    },
    top_attribution_sources: [],
  };
}

async function publicMcpOrderSummary(env: Env, days: number, limit: number) {
  if (!env.SHOPIFY_PACKRIFT_TOKEN) {
    return publicMcpOrderUnavailableSummary("shopify_token_not_configured", days, limit);
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error("shopify_order_attribution_timeout"));
      }, PUBLIC_MCP_ORDER_SUMMARY_TIMEOUT_MS);
    });
    const payload = await Promise.race([
      shopifyMcpOrderAttributionPayload(env, days, limit, controller.signal),
      timeout,
    ]);
    const orders = Array.isArray(payload.orders) ? payload.orders : [];
    return {
      ok: payload.ok,
      release: payload.release,
      generated_at: payload.generated_at,
      lookback_days: payload.lookback_days,
      scan_limit: payload.scan_limit,
      scanned_order_count: payload.scanned_order_count,
      attributed_order_count: payload.attributed_order_count,
      attributed_revenue: payload.attributed_revenue,
      currency: payload.currency,
      proof_gate: payload.proof_gate,
      top_attribution_sources: publicOrderSourceBuckets(orders),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return publicMcpOrderUnavailableSummary(safeEventText(message, 500), days, limit);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function mcpFunnelSnapshotPayload(env: Env, date = todayUtc(), limit = 5000, orderDays = 90, orderLimit = 250) {
  const events = await readAiSalesEvents(env, date, limit);
  const monthlyVisitorProof = await monthlyQualifiedVisitorProofForDate(env, date);
  const uniqueIdentityProof = uniqueQualifiedMcpIdentityProof(events);
  const ga4CanonicalProof = await mcpGa4FunnelProofPayload(env);
  const ga4CanonicalVisitorProofIsAvailable =
    ga4CanonicalProof.status === "proven" || ga4CanonicalProof.status === "not_proven";
  const ga4QualifiedMcpSessions = Number(ga4CanonicalProof.visitor_goal?.qualified_external_mcp_session_starts ?? 0);
  const ga4QualifiedMcpSessionThreshold = Number(
    ga4CanonicalProof.visitor_goal?.threshold ?? MONTHLY_QUALIFIED_VISITOR_THRESHOLD
  );
  const summary = summarizeAiSalesEvents(events);
  const byEvent = topRowsToRecord(summary.by_event);
  const mcpDiscoveryEvents =
    (byEvent.mcp_tools_list ?? 0) +
    (byEvent.mcp_prompt_list ?? 0) +
    (byEvent.mcp_prompt_get ?? 0) +
    (byEvent.mcp_resource_list ?? 0) +
    (byEvent.mcp_resource_templates_list ?? 0) +
    (byEvent.mcp_resource_read ?? 0);
  const mcpToolCalls = byEvent.mcp_tool_call ?? 0;
  const createCartUrlCalls = (summary.by_tool ?? []).find((row) => row.key === "create_cart_url")?.count ?? 0;
  const qualifiedMcpToolCalls = countQualifiedPublicMcpToolCalls(events);
  const qualifiedCreateCartUrlCalls = countQualifiedPublicMcpToolCalls(events, "create_cart_url");
  const cartClicks = (byEvent.cart_click ?? 0) + (byEvent.mcp_cart_click ?? 0);
  const cartLandings = byEvent.mcp_cart_landing ?? 0;
  const startClicks = byEvent.mcp_start_click ?? 0;
  const trackedConfigFetches = summary.tracked_config_fetches;
  const installIntents = byEvent.mcp_install_intent ?? 0;
  const firstRunIntents = byEvent.mcp_first_run_intent ?? 0;
  const firstRunExecutions = byEvent.mcp_first_run_execution ?? 0;
  const installCopies = byEvent.mcp_install_copy ?? 0;
  const activationCartReady = byEvent.mcp_activation_cart_ready ?? 0;
  const mcpSourceAttributedRuntimeEvents = (summary.by_mcp_source_context ?? []).reduce((total, row) => total + row.count, 0);
  const postInstallCartActivation = postInstallCartActivationBySource(events);
  const sourceActivationPriorityQueue = mcpSourceActivationPriorityQueue(postInstallCartActivation);
  const uniqueMcpHandoffIds = new Set(events.map((event) => safeEventText(event.mcp_handoff_id, 160)).filter(Boolean)).size;
  const qualifiedCartLandings = countQualifiedFirstPartyCartLandings(events);
  const orderSummary = await publicMcpOrderSummary(env, orderDays, orderLimit);
  const attributedOrderCount = Number(orderSummary.attributed_order_count || 0);
  const attributedRevenue = Number(orderSummary.attributed_revenue || 0);
  const proofGate = {
    usage_exists: events.length > 0,
    external_mcp_starts_or_installs_seen: startClicks + trackedConfigFetches + installIntents + firstRunIntents + firstRunExecutions + installCopies > 0,
    first_run_intent_seen: firstRunIntents > 0,
    first_run_execution_seen: firstRunExecutions > 0,
    activation_cart_ready_seen: activationCartReady > 0,
    mcp_runtime_source_continuity_seen: mcpSourceAttributedRuntimeEvents > 0,
    material_tool_usage_50_plus: qualifiedMcpToolCalls >= 50,
    create_cart_url_seen: qualifiedCreateCartUrlCalls > 0,
    qualified_first_party_cart_landing_seen: qualifiedCartLandings > 0,
    first_party_mcp_order_seen: attributedOrderCount > 0,
    measurable_mcp_revenue_seen: attributedRevenue > 0,
    thousands_of_qualified_visitors: ga4CanonicalVisitorProofIsAvailable
      ? ga4QualifiedMcpSessions >= ga4QualifiedMcpSessionThreshold
      : monthlyVisitorProof.qualified_external_mcp_event_signals >= monthlyVisitorProof.threshold,
  };
  const status =
    proofGate.thousands_of_qualified_visitors &&
    proofGate.material_tool_usage_50_plus &&
    proofGate.qualified_first_party_cart_landing_seen &&
    proofGate.measurable_mcp_revenue_seen
      ? "proven"
      : "not_proven";

  return {
    release: MCP_FUNNEL_SNAPSHOT_RELEASE,
    generated_at: new Date().toISOString(),
    date,
    limit,
    order_lookback_days: orderDays,
    order_scan_limit: orderLimit,
    canonical_endpoint: "https://mcp.packrift.com/mcp",
    status,
    purpose:
      "Public aggregate Packrift MCP funnel proof gate for directory reviewers, agents, and Packrift iteration: discovery, install intent, tool usage, cart landing, and MCP-attributed order totals.",
    privacy:
      "Aggregated counts only. Raw event bodies, buyer identifiers, order rows, and private admin tokens are not exposed.",
    scope_note:
      "This public snapshot uses first-party MCP telemetry plus aggregate Shopify order attribution. When available, the thousands-of-qualified-visitors gate uses the sanitized public GA4 proof published from the local full funnel artifact; the monthly first-party event proof remains a directional proxy.",
    runtime: {
      server_version: serverCard.version,
      tools_count: TOOLS.length,
      resources_count: MCP_RESOURCES.length,
      prompts_count: PROMPTS.length,
    },
    counts: {
      total_first_party_events: events.length,
      mcp_discovery_events: mcpDiscoveryEvents,
      mcp_start_clicks: startClicks,
      mcp_tracked_config_fetches: trackedConfigFetches,
      mcp_install_intent_events: installIntents,
      mcp_first_run_intent_events: firstRunIntents,
      mcp_first_run_execution_events: firstRunExecutions,
      mcp_install_copy_events: installCopies,
      mcp_activation_cart_ready_events: activationCartReady,
      mcp_source_attributed_runtime_events: mcpSourceAttributedRuntimeEvents,
      unique_mcp_handoff_ids: uniqueMcpHandoffIds,
      unique_qualified_mcp_identity_signals: uniqueIdentityProof.unique_identity_signals,
      unique_qualified_mcp_session_ids: uniqueIdentityProof.unique_mcp_session_ids,
      unique_qualified_mcp_handoff_ids: uniqueIdentityProof.unique_mcp_handoff_ids,
      unique_qualified_ai_commerce_journey_ids: uniqueIdentityProof.unique_ai_commerce_journey_ids,
      qualified_mcp_events_with_identity: uniqueIdentityProof.events_with_identity,
      qualified_mcp_events_without_identity: uniqueIdentityProof.events_without_identity,
      mcp_tool_calls: mcpToolCalls,
      create_cart_url_calls: createCartUrlCalls,
      external_qualified_mcp_tool_calls: qualifiedMcpToolCalls,
      external_qualified_create_cart_url_calls: qualifiedCreateCartUrlCalls,
      post_install_sources_waiting_on_create_cart_url: postInstallCartActivation.filter(
        (row) => row.install_intents + row.first_run_actions + row.tracked_config_fetches > 0 && row.create_cart_url_calls === 0
      ).length,
      post_install_sources_waiting_on_cart_landing: postInstallCartActivation.filter(
        (row) => row.external_qualified_create_cart_url_calls > 0 && row.qualified_cart_landings === 0
      ).length,
      source_activation_priority_sources: sourceActivationPriorityQueue.length,
      source_activation_priority_critical: sourceActivationPriorityQueue.filter((row) => row.priority === "critical").length,
      monthly_qualified_visitor_signals: monthlyVisitorProof.qualified_external_mcp_event_signals,
      monthly_qualified_visitor_threshold: monthlyVisitorProof.threshold,
      monthly_qualified_visitor_remaining: monthlyVisitorProof.remaining_to_threshold,
      monthly_qualified_visitor_lookback_days: monthlyVisitorProof.lookback_days,
      monthly_qualified_visitor_events_scanned: monthlyVisitorProof.events_scanned,
      monthly_qualified_visitor_read_limit: monthlyVisitorProof.read_limit,
      ga4_qualified_external_mcp_session_starts: ga4QualifiedMcpSessions,
      ga4_qualified_external_mcp_session_threshold: ga4QualifiedMcpSessionThreshold,
      mcp_cart_clicks: cartClicks,
      raw_first_party_mcp_cart_landings: cartLandings,
      qualified_first_party_mcp_cart_landings: qualifiedCartLandings,
      first_party_mcp_orders: attributedOrderCount,
      first_party_mcp_order_revenue: attributedRevenue,
      first_party_mcp_order_currency: orderSummary.currency,
    },
    proof_gate: proofGate,
    traffic_quality: publicFunnelTrafficBuckets(summary),
    monthly_qualified_visitor_proof: monthlyVisitorProof,
    unique_qualified_identity_proof: uniqueIdentityProof,
    ga4_canonical_visitor_proof: ga4CanonicalProof,
    source_activation_priority_queue: sourceActivationPriorityQueue,
    source_attribution: {
      tracked_start_template: "https://mcp.packrift.com/r/start/{source}",
      tracked_config_template: "https://mcp.packrift.com/r/config/{source}",
      tracked_install_template: "https://mcp.packrift.com/r/install/{source}/{target}",
      tracked_run_template: "https://mcp.packrift.com/r/run/{source}/{target}",
      tracked_reviewer_activation_template: "https://mcp.packrift.com/r/activate/{source}",
      tracked_reviewer_activation_html_template: "https://mcp.packrift.com/r/activate/{source}?format=html",
      start_sources: summary.by_start_source,
      tracked_config_sources: summary.by_tracked_config_source,
      install_intent_sources: summary.by_install_intent_source,
      install_intent_targets: summary.by_install_intent_target,
      first_run_intent_sources: summary.by_first_run_intent_source,
      first_run_intent_targets: summary.by_first_run_intent_target,
      install_copy_sources: summary.by_install_copy_source,
      install_copy_targets: summary.by_install_copy_target,
      recent_activation_cart_ready: summary.recent_activation_cart_ready,
      mcp_runtime_sources: summary.by_mcp_source_context,
      mcp_install_targets: summary.by_mcp_install_target,
      tool_mcp_keys: summary.by_tool_mcp_key,
      mcp_session_ids: summary.by_mcp_session_id,
      mcp_handoff_ids: summary.by_mcp_handoff_id,
      tool_runtime_sources: summary.by_tool_mcp_source_context,
      post_install_cart_activation_by_source: postInstallCartActivation,
      source_activation_priority_queue: sourceActivationPriorityQueue,
      order_attribution_sources: orderSummary.top_attribution_sources,
    },
    top: {
      events: summary.by_event,
      tools: summary.by_tool,
      utm_sources: summary.by_utm_source,
      event_attribution: summary.by_event_attribution?.slice(0, 25),
      skus: summary.by_sku,
      bot_families: summary.by_bot_family,
    },
    orders: orderSummary,
    links: {
      funnel_snapshot_json: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      funnel_snapshot_markdown: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.md",
      ga4_funnel_proof_json: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
      ga4_funnel_proof_markdown: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.md",
      usage_snapshot_json: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      usage_snapshot_markdown: "https://mcp.packrift.com/ai/mcp-usage-snapshot.md",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      reviewer_activation: "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      source_activation_queue_html: "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
      activation_experiments: "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
      activation_experiments_html: "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
      activation_command_center: "https://mcp.packrift.com/r/activate",
      install_actions: "https://mcp.packrift.com/ai/mcp-install-actions.json",
      first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
      tracked_run_generic: "https://mcp.packrift.com/r/run/generic/generic_streamable_http",
      tracked_reviewer_activation_runner_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    },
    next_actions: [
      "Work the source_activation_priority_queue first; it is the public next-best-action list for turning source-level MCP proof into qualified carts.",
      "Use the activation experiments surface to run each source as a measurable experiment with target events, expected snapshot deltas, and suppression rules.",
      "Use tracked install-action and first-run links in every stale directory refresh so starts, installs, and first useful runs stay source-attributed.",
      "Use source-specific reviewer activation browser runners to convert proof clicks into real MCP client calls and create_cart_url output.",
      "Push external users from install intent into get_cart_handoff_candidates, get_pricing, check_inventory, create_cart_url, and then the returned /r/cart URL; use post_install_cart_activation_by_source to see the exact stuck source.",
      "Do not call the MCP goal complete until qualified visitor volume, qualified cart landings, and MCP-attributed revenue are all visible.",
    ],
  };
}

function mcpFunnelSnapshotMarkdown(payload: Awaited<ReturnType<typeof mcpFunnelSnapshotPayload>>): string {
  const table = (rows: Array<{ key: string; count: number }> | undefined) =>
    (rows ?? []).slice(0, 10).map((row) => `| ${row.key} | ${row.count} |`).join("\n") || "| none | 0 |";
  const gateRows = Object.entries(payload.proof_gate)
    .map(([key, value]) => `| ${key} | ${value ? "yes" : "no"} |`)
    .join("\n");
  return [
    "# Packrift MCP Funnel Snapshot",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Date: ${payload.date}`,
    `Status: ${payload.status}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    payload.purpose,
    "",
    "## Counts",
    "",
    `- Total first-party events: ${payload.counts.total_first_party_events}`,
    `- MCP discovery events: ${payload.counts.mcp_discovery_events}`,
    `- MCP start clicks: ${payload.counts.mcp_start_clicks}`,
    `- MCP tracked config fetches: ${payload.counts.mcp_tracked_config_fetches}`,
    `- MCP install-intent events: ${payload.counts.mcp_install_intent_events}`,
    `- MCP first-run-intent events: ${payload.counts.mcp_first_run_intent_events}`,
    `- MCP first-run execution events: ${payload.counts.mcp_first_run_execution_events}`,
    `- MCP install-copy events: ${payload.counts.mcp_install_copy_events}`,
    `- MCP activation cart-ready events: ${payload.counts.mcp_activation_cart_ready_events}`,
    `- MCP source-attributed runtime events: ${payload.counts.mcp_source_attributed_runtime_events}`,
    `- MCP tool calls: ${payload.counts.mcp_tool_calls}`,
    `- create_cart_url calls: ${payload.counts.create_cart_url_calls}`,
    `- External-qualified MCP tool calls: ${payload.counts.external_qualified_mcp_tool_calls}`,
    `- External-qualified create_cart_url calls: ${payload.counts.external_qualified_create_cart_url_calls}`,
    `- Source activation priority sources: ${payload.counts.source_activation_priority_sources}`,
    `- Critical source activation priorities: ${payload.counts.source_activation_priority_critical}`,
    `- Monthly qualified visitor signals: ${payload.counts.monthly_qualified_visitor_signals} / ${payload.counts.monthly_qualified_visitor_threshold}`,
    `- Monthly qualified visitor gap: ${payload.counts.monthly_qualified_visitor_remaining}`,
    `- GA4 qualified external MCP sessions: ${payload.counts.ga4_qualified_external_mcp_session_starts} / ${payload.counts.ga4_qualified_external_mcp_session_threshold}`,
    `- Unique qualified MCP identity signals: ${payload.counts.unique_qualified_mcp_identity_signals}`,
    `- Unique qualified MCP session IDs: ${payload.counts.unique_qualified_mcp_session_ids}`,
    `- Unique qualified MCP handoff IDs: ${payload.counts.unique_qualified_mcp_handoff_ids}`,
    `- Unique qualified AI-commerce journey IDs: ${payload.counts.unique_qualified_ai_commerce_journey_ids}`,
    `- Qualified MCP events with identity: ${payload.counts.qualified_mcp_events_with_identity}`,
    `- Qualified MCP events without identity: ${payload.counts.qualified_mcp_events_without_identity}`,
    `- Post-install sources waiting on cart landing: ${payload.counts.post_install_sources_waiting_on_cart_landing}`,
    `- MCP cart clicks: ${payload.counts.mcp_cart_clicks}`,
    `- Raw first-party MCP cart landings: ${payload.counts.raw_first_party_mcp_cart_landings}`,
    `- Qualified first-party MCP cart landings: ${payload.counts.qualified_first_party_mcp_cart_landings}`,
    `- First-party MCP orders: ${payload.counts.first_party_mcp_orders}`,
    `- First-party MCP order revenue: ${payload.counts.first_party_mcp_order_revenue} ${payload.counts.first_party_mcp_order_currency}`,
    "",
    "## Proof Gate",
    "",
    "| Gate | Proven |",
    "| --- | --- |",
    gateRows,
    "",
    "## Monthly Qualified Visitor Proof",
    "",
    `- Status: ${payload.monthly_qualified_visitor_proof.status}`,
    `- Basis: ${payload.monthly_qualified_visitor_proof.basis}`,
    `- Lookback days: ${payload.monthly_qualified_visitor_proof.lookback_days}`,
    `- Qualified external MCP event signals: ${payload.monthly_qualified_visitor_proof.qualified_external_mcp_event_signals}`,
    `- Threshold: ${payload.monthly_qualified_visitor_proof.threshold}`,
    `- Remaining to threshold: ${payload.monthly_qualified_visitor_proof.remaining_to_threshold}`,
    `- Progress: ${payload.monthly_qualified_visitor_proof.progress_pct}%`,
    `- Events scanned: ${payload.monthly_qualified_visitor_proof.events_scanned}`,
    `- Read limit: ${payload.monthly_qualified_visitor_proof.read_limit}`,
    `- Truncated by read limit: ${payload.monthly_qualified_visitor_proof.truncated_by_read_limit ? "yes" : "no"}`,
    `- Note: ${payload.monthly_qualified_visitor_proof.canonical_note}`,
    "",
    "## Unique Qualified Identity Proof",
    "",
    `- Basis: ${payload.unique_qualified_identity_proof.basis}`,
    `- Caveat: ${payload.unique_qualified_identity_proof.caveat}`,
    `- Qualified event signals: ${payload.unique_qualified_identity_proof.qualified_event_signals}`,
    `- Events with identity: ${payload.unique_qualified_identity_proof.events_with_identity}`,
    `- Events without identity: ${payload.unique_qualified_identity_proof.events_without_identity}`,
    `- Unique identity signals: ${payload.unique_qualified_identity_proof.unique_identity_signals}`,
    `- Unique MCP session IDs: ${payload.unique_qualified_identity_proof.unique_mcp_session_ids}`,
    `- Unique MCP handoff IDs: ${payload.unique_qualified_identity_proof.unique_mcp_handoff_ids}`,
    `- Unique AI-commerce journey IDs: ${payload.unique_qualified_identity_proof.unique_ai_commerce_journey_ids}`,
    "",
    "### Top Sources By Unique Qualified Identity",
    "",
    "| Source | Unique identities |",
    "| --- | ---: |",
    table(payload.unique_qualified_identity_proof.top_sources_by_unique_identity),
    "",
    "## GA4 Canonical Visitor Proof",
    "",
    `- Status: ${payload.ga4_canonical_visitor_proof.status}`,
    `- Proof generated: ${payload.ga4_canonical_visitor_proof.generated_at || "not published"}`,
    `- Source snapshot: ${payload.ga4_canonical_visitor_proof.source_snapshot_generated_at || "not published"}`,
    `- Basis: ${payload.ga4_canonical_visitor_proof.visitor_goal?.basis || "not published"}`,
    `- Qualified external MCP sessions: ${payload.ga4_canonical_visitor_proof.visitor_goal?.qualified_external_mcp_session_starts ?? 0} / ${payload.ga4_canonical_visitor_proof.visitor_goal?.threshold ?? 1000}`,
    `- Remaining to threshold: ${payload.ga4_canonical_visitor_proof.visitor_goal?.remaining_to_threshold ?? 1000}`,
    `- Qualified external cart landings: ${payload.ga4_canonical_visitor_proof.cart_and_revenue_proof?.qualified_external_cart_landings ?? 0}`,
    `- First-party MCP orders: ${payload.ga4_canonical_visitor_proof.cart_and_revenue_proof?.first_party_mcp_orders ?? 0}`,
    "",
    "## Source Attribution",
    "",
    `Tracked start template: \`${payload.source_attribution.tracked_start_template}\``,
    `Tracked config template: \`${payload.source_attribution.tracked_config_template}\``,
    `Tracked install template: \`${payload.source_attribution.tracked_install_template}\``,
    `Tracked first-run template: \`${payload.source_attribution.tracked_run_template}\``,
    `Tracked reviewer activation template: \`${payload.source_attribution.tracked_reviewer_activation_template}\``,
    `Tracked reviewer activation browser runner template: \`${payload.source_attribution.tracked_reviewer_activation_html_template}\``,
    "",
    "### Source Activation Priority Queue",
    "",
    "| Priority | Source | Current stage | Target event | Recommended action | Action URL | Recent measured cart URL | Directory status |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    payload.source_activation_priority_queue
      .slice(0, 10)
      .map(
        (row) =>
          `| ${row.priority} | ${row.source} | ${markdownTableCell(row.current_stage)} | ${row.target_event_to_watch} | ${markdownTableCell(row.recommended_action)} | ${row.primary_action_url} | ${row.recent_measured_cart_urls[0] ?? ""} | ${markdownTableCell(row.directory_status)} |`
      )
      .join("\n") || "| none | none | none | none | none | none | none | none |",
    "",
    "### Start Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.start_sources),
    "",
    "### Install Intent Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.install_intent_sources),
    "",
    "### First-Run Intent Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.first_run_intent_sources),
    "",
    "### Tool Calls By MCP Key",
    "",
    "| Tool and MCP key | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.tool_mcp_keys),
    "",
    "### MCP Runtime Sources",
    "",
    "| Source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.mcp_runtime_sources),
    "",
    "### Tool Calls By Runtime Source",
    "",
    "| Tool and source | Count |",
    "| --- | ---: |",
    table(payload.source_attribution.tool_runtime_sources),
    "",
    "### Post-Install Cart Activation By Source",
    "",
    "| Source | Starts | Config fetches | Installs | First-run actions | Browser executions | Tool calls | Cart URLs | Cart-ready | Cart landings | Qualified cart landings | Recent measured cart URL | Missing next step |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    payload.source_attribution.post_install_cart_activation_by_source
      .slice(0, 10)
      .map(
        (row) =>
          `| ${row.source} | ${row.starts} | ${row.tracked_config_fetches} | ${row.install_intents} | ${row.first_run_actions} | ${row.first_run_executions} | ${row.mcp_tool_calls} | ${row.create_cart_url_calls} | ${row.activation_cart_ready} | ${row.cart_landings} | ${row.qualified_cart_landings} | ${row.recent_measured_cart_urls[0] ?? ""} | ${row.missing_next_step} |`
      )
      .join("\n") || "| none | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | none | none |",
    "",
    "## Orders",
    "",
    `- Order scan ok: ${payload.orders.ok ? "yes" : "no"}`,
    `- Scanned orders: ${payload.orders.scanned_order_count ?? "unknown"}`,
    `- Attributed orders: ${payload.orders.attributed_order_count ?? "unknown"}`,
    `- Attributed revenue: ${payload.orders.attributed_revenue ?? "unknown"} ${payload.orders.currency}`,
    "",
    "## Top Events",
    "",
    "| Event | Count |",
    "| --- | ---: |",
    table(payload.top.events),
    "",
    "## Links",
    "",
    Object.entries(payload.links)
      .map(([name, url]) => `- ${name}: ${url}`)
      .join("\n"),
    "",
    "## Next Actions",
    "",
    payload.next_actions.map((item) => `- ${item}`).join("\n"),
    "",
  ].join("\n");
}

function mcpGa4FunnelProofMarkdown(payload: PublicMcpGa4FunnelProof): string {
  const gateRows = Object.entries(payload.proof_gate ?? {})
    .map(([key, value]) => `| ${key} | ${value ? "yes" : "no"} |`)
    .join("\n") || "| not_published | no |";
  const blockers = payload.blockers?.length ? payload.blockers.map((item) => `- ${item}`).join("\n") : "- none";
  const nextActions = payload.next_actions?.length ? payload.next_actions.map((item) => `- ${item}`).join("\n") : "- Refresh and publish the GA4 proof.";
  const currency = payload.cart_and_revenue_proof?.currency || "USD";
  return [
    "# Packrift MCP GA4 Funnel Proof",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at || "not published"}`,
    `Source snapshot: ${payload.source_snapshot_generated_at || "not published"}`,
    `Status: ${payload.status}`,
    `Canonical endpoint: ${payload.canonical_endpoint || "https://mcp.packrift.com/mcp"}`,
    "",
    payload.privacy || "Public aggregate proof only.",
    "",
    "## Visitor Goal",
    "",
    `- Basis: ${payload.visitor_goal?.basis || "GA4 qualified external MCP session_start events"}`,
    `- Qualified external MCP sessions: ${payload.visitor_goal?.qualified_external_mcp_session_starts ?? 0} / ${payload.visitor_goal?.threshold ?? 1000}`,
    `- Remaining: ${payload.visitor_goal?.remaining_to_threshold ?? 1000}`,
    `- Progress: ${payload.visitor_goal?.progress_pct ?? 0}%`,
    `- Raw MCP-specific sessions: ${payload.visitor_goal?.raw_mcp_specific_session_starts ?? 0}`,
    "",
    "## Cart And Revenue Proof",
    "",
    `- Qualified external cart landings: ${payload.cart_and_revenue_proof?.qualified_external_cart_landings ?? 0}`,
    `- Qualified external cart revenue: ${payload.cart_and_revenue_proof?.qualified_external_cart_revenue ?? 0} ${currency}`,
    `- First-party MCP orders: ${payload.cart_and_revenue_proof?.first_party_mcp_orders ?? 0}`,
    `- First-party MCP order revenue: ${payload.cart_and_revenue_proof?.first_party_mcp_order_revenue ?? 0} ${currency}`,
    "",
    "## Proof Gate",
    "",
    "| Gate | Proven |",
    "| --- | --- |",
    gateRows,
    "",
    "## Blockers",
    "",
    blockers,
    "",
    "## Next Actions",
    "",
    nextActions,
    "",
  ].join("\n");
}

interface ShopifyOrderMoneySet {
  shopMoney?: { amount?: string | number | null; currencyCode?: string | null } | null;
}

interface ShopifyMcpOrderNode {
  id: string;
  name: string;
  createdAt: string;
  processedAt?: string | null;
  displayFinancialStatus?: string | null;
  totalPriceSet?: ShopifyOrderMoneySet | null;
  currentTotalPriceSet?: ShopifyOrderMoneySet | null;
  customAttributes?: Array<{ key: string; value?: string | null }> | null;
  tags?: string[] | null;
  lineItems?: {
    edges?: Array<{
      node?: {
        sku?: string | null;
        title?: string | null;
        quantity?: number | null;
        discountedTotalSet?: ShopifyOrderMoneySet | null;
        variant?: {
          id?: string | null;
          product?: { handle?: string | null } | null;
        } | null;
      } | null;
    }>;
  } | null;
}

interface ShopifyMcpOrdersResponse {
  orders: {
    edges: Array<{ cursor: string; node: ShopifyMcpOrderNode }>;
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  };
}

const SHOPIFY_MCP_ORDERS_QUERY = `
  query McpAttributedOrders($first: Int!, $after: String, $query: String!) {
    orders(first: $first, after: $after, reverse: true, sortKey: CREATED_AT, query: $query) {
      edges {
        cursor
        node {
          id
          name
          createdAt
          processedAt
          displayFinancialStatus
          tags
          customAttributes { key value }
          totalPriceSet { shopMoney { amount currencyCode } }
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 25) {
            edges {
              node {
                sku
                title
                quantity
                discountedTotalSet { shopMoney { amount currencyCode } }
                variant { id product { handle } }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

function isoDateDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function moneyAmount(set: ShopifyOrderMoneySet | null | undefined): number {
  const raw = set?.shopMoney?.amount;
  const value = typeof raw === "number" ? raw : Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function moneyCurrency(set: ShopifyOrderMoneySet | null | undefined): string {
  return safeEventText(set?.shopMoney?.currencyCode, 12) || "USD";
}

function orderAttributeMap(order: ShopifyMcpOrderNode): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of order.customAttributes ?? []) {
    const key = safeEventText(attr.key, 120);
    if (!key) continue;
    attrs[key] = safeEventText(attr.value, 500);
  }
  return attrs;
}

function mcpOrderAttribution(attrs: Record<string, string>) {
  const get = (key: string) => attrs[key] || attrs[`_${key}`] || "";
  return {
    packrift_ai_id: get("packrift_packrift_ai_id") || get("packrift_ai_id"),
    ai_commerce_id: get("packrift_ai_commerce_id") || get("ai_commerce_id"),
    mcp_handoff_id: get("packrift_mcp_handoff_id") || get("mcp_handoff_id"),
    mcp_key: get("packrift_mcp_key") || get("mcp_key"),
    mcp_journey: get("packrift_mcp_journey") || get("mcp_journey"),
    mcp_result_set: get("packrift_mcp_result_set") || get("mcp_result_set"),
    match_type: get("packrift_match_type") || get("match_type"),
    utm_source: get("packrift_utm_source") || get("utm_source"),
    utm_medium: get("packrift_utm_medium") || get("utm_medium"),
    utm_campaign: get("packrift_utm_campaign") || get("utm_campaign"),
    utm_content: get("packrift_utm_content") || get("utm_content"),
    utm_term: get("packrift_utm_term") || get("utm_term"),
  };
}

function orderHasMcpAttribution(order: ShopifyMcpOrderNode): boolean {
  const attrs = orderAttributeMap(order);
  const attribution = mcpOrderAttribution(attrs);
  const text = [
    ...Object.keys(attrs),
    ...Object.values(attrs),
    ...(order.tags ?? []),
    ...Object.values(attribution),
  ]
    .join(" ")
    .toLowerCase();
  return (
    attribution.utm_source === "chatgpt-mcp" ||
    attribution.utm_medium === "mcp_tool" ||
    attribution.utm_campaign === "create_cart_url" ||
    Boolean(attribution.mcp_key || attribution.mcp_journey || attribution.packrift_ai_id || attribution.ai_commerce_id) ||
    /chatgpt-mcp|mcp_tool|create_cart_url|packrift_mcp|mcp_key|mcp_journey|ref=mcp/.test(text)
  );
}

function summarizedLineItems(order: ShopifyMcpOrderNode) {
  return (order.lineItems?.edges ?? [])
    .map((edge) => edge.node)
    .filter(Boolean)
    .map((line) => ({
      sku: safeEventText(line?.sku, 80) || null,
      title: safeEventText(line?.title, 180) || null,
      quantity: typeof line?.quantity === "number" ? line.quantity : null,
      variant_id: safeEventText(line?.variant?.id, 120) || null,
      handle: safeEventText(line?.variant?.product?.handle, 180) || null,
      revenue: moneyAmount(line?.discountedTotalSet),
      currency: moneyCurrency(line?.discountedTotalSet),
    }));
}

async function shopifyMcpOrderAttributionPayload(env: Env, days: number, limit: number, signal?: AbortSignal) {
  const boundedDays = Math.max(1, Math.min(365, Math.floor(days)));
  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const query = `created_at:>=${isoDateDaysAgo(boundedDays)}`;
  let after: string | null = null;
  let scannedOrderCount = 0;
  const attributedOrders: Array<Record<string, unknown>> = [];

  while (scannedOrderCount < boundedLimit) {
    const first = Math.min(100, boundedLimit - scannedOrderCount);
    const data: ShopifyMcpOrdersResponse = await shopifyQuery<ShopifyMcpOrdersResponse>(
      env,
      SHOPIFY_MCP_ORDERS_QUERY,
      {
        first,
        after,
        query,
      },
      { signal }
    );
    const edges = data.orders.edges ?? [];
    if (edges.length === 0) break;

    for (const edge of edges) {
      const order = edge.node;
      scannedOrderCount += 1;
      if (orderHasMcpAttribution(order)) {
        const attrs = orderAttributeMap(order);
        const attribution = mcpOrderAttribution(attrs);
        const revenueSet = order.currentTotalPriceSet ?? order.totalPriceSet;
        attributedOrders.push({
          id: order.id,
          name: order.name,
          created_at: order.createdAt,
          processed_at: order.processedAt ?? null,
          financial_status: order.displayFinancialStatus ?? null,
          revenue: moneyAmount(revenueSet),
          currency: moneyCurrency(revenueSet),
          attribution,
          line_items: summarizedLineItems(order),
        });
      }
      if (scannedOrderCount >= boundedLimit) break;
    }

    if (!data.orders.pageInfo.hasNextPage || !data.orders.pageInfo.endCursor) break;
    after = data.orders.pageInfo.endCursor;
  }

  const attributedRevenue = attributedOrders.reduce((sum, order) => sum + moneyAmount({ shopMoney: { amount: order.revenue as number } }), 0);
  const currency =
    safeEventText(attributedOrders.find((order) => safeEventText(order.currency, 12))?.currency, 12) || "USD";
  return {
    ok: true,
    release: MCP_ORDER_ATTRIBUTION_RELEASE,
    generated_at: new Date().toISOString(),
    query,
    lookback_days: boundedDays,
    scan_limit: boundedLimit,
    scanned_order_count: scannedOrderCount,
    attributed_order_count: attributedOrders.length,
    attributed_revenue: Number(attributedRevenue.toFixed(2)),
    currency,
    proof_gate: {
      first_party_mcp_orders_seen: attributedOrders.length > 0,
      first_party_mcp_revenue_seen: attributedRevenue > 0,
    },
    orders: attributedOrders,
  };
}

async function readAiSalesEvents(env: Env, date: string, limit: number): Promise<Array<Record<string, unknown>>> {
  const prefix = `${AI_SALES_EVENT_PREFIX}/${date}/`;
  const allKeys: Array<{ name: string }> = [];
  let cursor: string | undefined;
  do {
    const listed = await env.CATALOG_CACHE.list({ prefix, cursor, limit: 1000 });
    allKeys.push(...listed.keys.map((key) => ({ name: key.name })));
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  const keys = allKeys.slice(-Math.max(1, limit));
  const events: Array<Record<string, unknown>> = [];
  for (let index = 0; index < keys.length && events.length < limit; index += AI_SALES_EVENT_READ_CONCURRENCY) {
    const chunk = keys.slice(index, index + AI_SALES_EVENT_READ_CONCURRENCY);
    const bodies = await Promise.all(chunk.map((key) => env.CATALOG_CACHE.get(key.name, "json").catch(() => null)));
    for (const body of bodies) {
      if (body && typeof body === "object") events.push(body as Record<string, unknown>);
      if (events.length >= limit) break;
    }
  }
  return events.sort((a, b) => String(b.received_at ?? "").localeCompare(String(a.received_at ?? ""))).slice(0, limit);
}

function aiSalesDashboardHtml(date: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift AI Sales Events</title>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f7f6f3;color:#1a2640}
    main{max-width:980px;margin:0 auto;padding:28px 18px 48px}
    h1{font-size:1.55rem;margin:0 0 6px}
    p{color:#526070;line-height:1.5}
    .toolbar{display:flex;gap:10px;align-items:center;margin:18px 0 20px;flex-wrap:wrap}
    input,button{font:inherit;border:1px solid #d8d4cc;border-radius:6px;padding:8px 10px;background:#fff;color:#1a2640}
    button{cursor:pointer}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .panel{background:#fff;border:1px solid #e0ddd8;border-radius:8px;padding:14px;min-width:0}
    .metric{font-size:2rem;font-weight:700;margin:8px 0}
    table{width:100%;border-collapse:collapse;font-size:.9rem}
    th,td{text-align:left;border-bottom:1px solid #ebe8e2;padding:7px 4px;vertical-align:top}
    th{font-size:.78rem;text-transform:uppercase;color:#67717d}
    td:first-child{overflow-wrap:anywhere}
    @media(max-width:760px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main>
    <h1>Packrift AI Sales Events</h1>
    <p>First-party aggregate view of MCP, PDP procurement, reorder, quote, cart, and copy-spec handoffs. No customer PII is shown.</p>
    <div class="toolbar">
      <label>Date <input id="date" type="date" value="${escapeHtml(date)}"></label>
      <button id="refresh" type="button">Refresh</button>
      <span id="status">Loading</span>
    </div>
    <div class="grid">
      <section class="panel"><h2>Total</h2><div id="total" class="metric">0</div></section>
      <section class="panel"><h2>By Event</h2><table id="by-event"></table></section>
      <section class="panel"><h2>By Source</h2><table id="by-source"></table></section>
      <section class="panel"><h2>By Bot / Agent</h2><table id="by-bot-family"></table></section>
      <section class="panel" style="grid-column:1/-1"><h2>Top SKUs</h2><table id="by-sku"></table></section>
      <section class="panel" style="grid-column:1/-1"><h2>Recent No-Match Demand</h2><table id="recent-no-matches"></table></section>
      <section class="panel" style="grid-column:1/-1"><h2>Recent Exact Matches</h2><table id="recent-exact-matches"></table></section>
      <section class="panel" style="grid-column:1/-1"><h2>Recent Multi-Match Choices</h2><table id="recent-multi-matches"></table></section>
    </div>
  </main>
  <script>
    const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const table = (id, rows) => {
      document.getElementById(id).innerHTML = '<tr><th>Name</th><th>Count</th></tr>' + rows.map((row) =>
        '<tr><td>' + esc(row.key) + '</td><td>' + row.count + '</td></tr>'
      ).join('');
    };
    const eventRows = (id, rows) => {
      document.getElementById(id).innerHTML = '<tr><th>When</th><th>Source</th><th>Spec / Query</th><th>SKU</th><th>Result</th></tr>' + rows.map((row) =>
        '<tr><td>' + esc(row.received_at).slice(11, 19) + '</td><td>' + esc(row.source) + '</td><td>' + esc(row.requested_spec || row.query || row.use_case) + '</td><td>' + esc(row.sku || row.handle || '') + '</td><td>' + esc(row.match_type || row.fit_score || row.result_count || '') + '</td></tr>'
      ).join('');
    };
    async function load() {
      const date = document.getElementById('date').value;
      document.getElementById('status').textContent = 'Loading';
      const res = await fetch('/events/ai-sales/summary?date=' + encodeURIComponent(date) + '&limit=1000', { cache: 'no-store' });
      const data = await res.json();
      document.getElementById('total').textContent = data.total_events || 0;
      table('by-event', data.by_event || []);
      table('by-source', data.by_source || []);
      table('by-bot-family', data.by_bot_family || []);
      table('by-sku', data.by_sku || []);
      eventRows('recent-no-matches', data.recent_no_matches || []);
      eventRows('recent-exact-matches', data.recent_exact_matches || []);
      eventRows('recent-multi-matches', data.recent_multi_matches || []);
      document.getElementById('status').textContent = 'Updated';
    }
    document.getElementById('refresh').addEventListener('click', load);
    load().catch(() => { document.getElementById('status').textContent = 'Could not load'; });
  </script>
</body>
</html>`;
}

function buildPdpProcurementHandoff(html: string, url: URL): string {
  const sku = firstMatch(html, [
    /<span class="ph__sku"[\s\S]*?<strong>([\s\S]*?)<\/strong>/i,
    /"sku"\s*:\s*"([^"]+)"/i,
  ]);
  const title = firstMatch(html, [
    /<h1 class="ph__title">([\s\S]*?)<\/h1>/i,
    /<meta property="og:title" content="([^"]+)"/i,
    /<title>([\s\S]*?)<\/title>/i,
  ]);
  const safeSku = sku || url.pathname.split("/").pop() || "product";
  const safeTitle = title || "Packrift product";
  const productUrl = `https://packrift.com${url.pathname}`;
  const procurementSpec = `SKU ${safeSku}: ${safeTitle}. Product URL: ${productUrl}`;
  const aiSkuUrl = `https://mcp.packrift.com/ai/sku/${encodeURIComponent(safeSku)}.md`;
  const reorderUrl = new URL("https://packrift.com/pages/reorder-packaging-by-sku");
  reorderUrl.searchParams.set("view", "packrift_ai_reorder_live_r07");
  reorderUrl.searchParams.set("sku", safeSku);
  reorderUrl.hash = skuAnchor(safeSku);
  reorderUrl.searchParams.set("utm_source", "packrift");
  reorderUrl.searchParams.set("utm_medium", "pdp");
  reorderUrl.searchParams.set("utm_campaign", "pdp_procurement_handoff");
  reorderUrl.searchParams.set("utm_content", "reorder_by_sku");
  const quoteUrl = new URL("https://packrift.com/pages/bulk-quote");
  quoteUrl.searchParams.set("sku", safeSku);
  quoteUrl.searchParams.set("product", safeTitle);
  quoteUrl.searchParams.set("product_url", productUrl);
  quoteUrl.searchParams.set("utm_source", "packrift");
  quoteUrl.searchParams.set("utm_medium", "pdp");
  quoteUrl.searchParams.set("utm_campaign", "pdp_procurement_handoff");
  quoteUrl.searchParams.set("utm_content", "bulk_quote");

  return `
<section class="packrift-pdp-procurement packrift-pdp-procurement--edge" data-release="${PDP_PROCUREMENT_RELEASE}" data-source="cloudflare-edge" data-packrift-sku="${escapeHtml(safeSku)}" data-packrift-handle="${escapeHtml(url.pathname.split("/").pop() ?? "")}">
  <style>
    .packrift-pdp-procurement{border:1px solid var(--ph-border,#e0ddd8);border-radius:6px;padding:16px;background:rgba(26,38,64,.035);display:grid;gap:10px;margin-top:14px;color:var(--ph-body,#555)}
    .packrift-pdp-procurement__eyebrow{font-size:.78rem;line-height:1.2;text-transform:uppercase;color:var(--ph-muted,#777)}
    .packrift-pdp-procurement__body,.packrift-pdp-procurement__note{margin:0;font-size:.92rem;line-height:1.45}
    .packrift-pdp-procurement__note{color:var(--ph-muted,#777)}
    .packrift-pdp-procurement__facts{margin:0;display:grid;gap:6px}
    .packrift-pdp-procurement__facts>div{display:grid;grid-template-columns:minmax(54px,max-content) minmax(0,1fr);gap:10px;align-items:baseline}
    .packrift-pdp-procurement__facts dt{font-size:.78rem;color:var(--ph-muted,#777)}
    .packrift-pdp-procurement__facts dd{margin:0;min-width:0;overflow-wrap:anywhere;font-size:.9rem}
    .packrift-pdp-procurement__actions{display:flex;flex-wrap:wrap;gap:8px}
    .packrift-pdp-procurement__action{min-height:38px;border:1px solid var(--ph-border,#d7d1c8);border-radius:6px;padding:8px 10px;background:#fff;color:var(--ph-heading,#1a2640);text-decoration:none;font:inherit;font-size:.86rem;line-height:1.2;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
    .packrift-pdp-procurement__action:hover{border-color:var(--ph-accent,#e87722)}
    @media(max-width:749px){.packrift-pdp-procurement__actions{display:grid;grid-template-columns:1fr}}
  </style>
  <div class="packrift-pdp-procurement__eyebrow">Exact-spec procurement</div>
  <p class="packrift-pdp-procurement__body">Use this when you need repeat-volume pricing or a bulk request tied to the exact item on this page.</p>
  <dl class="packrift-pdp-procurement__facts">
    <div><dt>SKU</dt><dd>${escapeHtml(safeSku)}</dd></div>
    <div><dt>Product</dt><dd>${escapeHtml(safeTitle)}</dd></div>
  </dl>
  <div class="packrift-pdp-procurement__actions">
    <a class="packrift-pdp-procurement__action packrift-pdp-procurement__action--primary" href="${escapeHtml(quoteUrl.toString())}" data-packrift-event="quote_click">Request Bulk</a>
  </div>
  <p class="packrift-pdp-procurement__note">Bulk requests keep the SKU, product title, and product URL attached.</p>
</section>
<script>
(() => {
  const root = document.currentScript && document.currentScript.previousElementSibling;
  if (!root || root.dataset.copyBound === 'true') return;
  root.dataset.copyBound = 'true';
  const clean = (value, max) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, max);
  const continuityFields = ['packrift_ai_id', 'ai_commerce_id', 'mcp_handoff_id', 'mcp_key', 'mcp_journey', 'mcp_result_set', 'match_type', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const readContinuity = () => {
    const params = new URLSearchParams(window.location.search);
    let saved = {};
    try {
      saved = JSON.parse(window.sessionStorage.getItem('packrift_ai_sales_context') || window.localStorage.getItem('packrift_ai_sales_context') || '{}') || {};
    } catch (error) {
      saved = {};
    }
    const context = {};
    for (const field of continuityFields) {
      const value = params.get(field) || saved[field] || '';
      if (value) context[field] = clean(value, field === 'page_url' ? 500 : 160);
    }
    if (!context.packrift_ai_id && context.ai_commerce_id) context.packrift_ai_id = context.ai_commerce_id;
    if (!context.ai_commerce_id && context.packrift_ai_id) context.ai_commerce_id = context.packrift_ai_id;
    if (!context.packrift_ai_id && context.mcp_journey) context.packrift_ai_id = context.mcp_journey;
    if (!context.ai_commerce_id && context.packrift_ai_id) context.ai_commerce_id = context.packrift_ai_id;
    if (context.packrift_ai_id || context.mcp_key || context.mcp_journey) {
      try {
        const serialized = JSON.stringify(context);
        window.sessionStorage.setItem('packrift_ai_sales_context', serialized);
        window.localStorage.setItem('packrift_ai_sales_context', serialized);
      } catch (error) {
      }
    }
    return context;
  };
  const writeCartAttributes = (context) => {
    if (!context || !(context.packrift_ai_id || context.mcp_key || context.mcp_journey)) return;
    const attributes = {};
    for (const field of continuityFields) {
      if (context[field]) attributes['packrift_' + field] = context[field];
    }
    if (!Object.keys(attributes).length) return;
    try {
      fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes }),
        keepalive: true
      });
    } catch (error) {
    }
  };
  const track = (eventName) => {
    const payload = {
      event: eventName,
      release: root.dataset.release,
      source: 'pdp_procurement_handoff_edge',
      sku: root.dataset.packriftSku,
      handle: root.dataset.packriftHandle,
      page_url: window.location.href,
      source_url: window.location.href,
      referrer: document.referrer,
      ...readContinuity()
    };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    window.dispatchEvent(new CustomEvent('packrift:pdp-procurement', { detail: payload }));
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('https://mcp.packrift.com/events/ai-sales', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('https://mcp.packrift.com/events/ai-sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        });
      }
    } catch (error) {
      // Tracking failure should never interrupt buying or copying.
    }
  };
  root.addEventListener('click', async (event) => {
    const eventTarget = event.target.closest('[data-packrift-event]');
    if (eventTarget) track(eventTarget.dataset.packriftEvent);
    const button = event.target.closest('[data-packrift-copy-spec]');
    if (!button) return;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(button.dataset.packriftCopySpec);
      button.textContent = 'Copied';
    } catch (error) {
      button.textContent = 'Copy manually';
    }
    window.setTimeout(() => { button.textContent = original; }, 1800);
  });
  const addToCartRelease = '${AI_SALES_ADD_TO_CART_RELEASE}';
  if (window.__packriftAiSalesAddToCart !== addToCartRelease) {
    window.__packriftAiSalesAddToCart = addToCartRelease;
    const seen = new Map();
    const clean = (value, max) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, max);
    document.addEventListener('cart:update', (event) => {
      const detail = event.detail || {};
      const data = detail.data || {};
      if (data.didError) return;
      const variantId = clean(data.variantId || data.variant_id || detail.sourceId || document.querySelector('product-form-component input[name="id"], form[action*="/cart/add"] input[name="id"]')?.value || '', 80);
      if (!variantId) return;
      const dedupeKey = [variantId, data.productId || '', data.itemCount || '', Math.floor(Date.now() / 2500)].join(':');
      if (seen.has(dedupeKey)) return;
      seen.set(dedupeKey, Date.now());
      for (const [key, timestamp] of seen) {
      if (Date.now() - timestamp > 15000) seen.delete(key);
      }
      const continuity = readContinuity();
      const payload = {
        event: 'add_to_cart',
        release: addToCartRelease,
        source: 'pdp_procurement_handoff_edge_cart_update',
        sku: root.dataset.packriftSku,
        handle: root.dataset.packriftHandle,
        product_id: clean(data.productId || '', 80),
        variant_id: variantId,
        quantity: clean(data.itemCount || '', 40),
        cart_item_count: clean(data.itemCount || '', 40),
        page_url: window.location.href,
        source_url: window.location.href,
        referrer: document.referrer,
        ...continuity
      };
      writeCartAttributes(continuity);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ ...payload, packrift_ai_sales: true });
      window.dispatchEvent(new CustomEvent('packrift:ai-sales-add-to-cart', { detail: payload }));
      try {
        const body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
          navigator.sendBeacon('https://mcp.packrift.com/events/ai-sales', new Blob([body], { type: 'application/json' }));
        } else {
          fetch('https://mcp.packrift.com/events/ai-sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true
          });
        }
      } catch (error) {
        // Tracking failure should never interrupt buying.
      }
    }, true);
  }
})();
</script>`;
}

function buildAiSalesAddToCartListener(): string {
  return `<script>
(() => {
  const release = '${AI_SALES_ADD_TO_CART_RELEASE}';
  if (window.__packriftAiSalesAddToCart === release) return;
  window.__packriftAiSalesAddToCart = release;
  const root = document.querySelector('.packrift-pdp-procurement[data-packrift-sku], [data-packrift-sku]');
  const seen = new Map();
  const clean = (value, max) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, max);
  const continuityFields = ['packrift_ai_id', 'ai_commerce_id', 'mcp_handoff_id', 'mcp_key', 'mcp_journey', 'mcp_result_set', 'match_type', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const readContinuity = () => {
    const params = new URLSearchParams(window.location.search);
    let saved = {};
    try {
      saved = JSON.parse(window.sessionStorage.getItem('packrift_ai_sales_context') || window.localStorage.getItem('packrift_ai_sales_context') || '{}') || {};
    } catch (error) {
      saved = {};
    }
    const context = {};
    for (const field of continuityFields) {
      const value = params.get(field) || saved[field] || '';
      if (value) context[field] = clean(value, 160);
    }
    if (!context.packrift_ai_id && context.ai_commerce_id) context.packrift_ai_id = context.ai_commerce_id;
    if (!context.ai_commerce_id && context.packrift_ai_id) context.ai_commerce_id = context.packrift_ai_id;
    if (!context.packrift_ai_id && context.mcp_journey) context.packrift_ai_id = context.mcp_journey;
    if (!context.ai_commerce_id && context.packrift_ai_id) context.ai_commerce_id = context.packrift_ai_id;
    if (context.packrift_ai_id || context.mcp_key || context.mcp_journey) {
      try {
        const serialized = JSON.stringify(context);
        window.sessionStorage.setItem('packrift_ai_sales_context', serialized);
        window.localStorage.setItem('packrift_ai_sales_context', serialized);
      } catch (error) {
      }
    }
    return context;
  };
  const writeCartAttributes = (context) => {
    if (!context || !(context.packrift_ai_id || context.mcp_key || context.mcp_journey)) return;
    const attributes = {};
    for (const field of continuityFields) {
      if (context[field]) attributes['packrift_' + field] = context[field];
    }
    if (!Object.keys(attributes).length) return;
    try {
      fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes }),
        keepalive: true
      });
    } catch (error) {
    }
  };
  const jsonLdSku = () => {
    const visit = (node) => {
      if (!node || typeof node !== 'object') return '';
      if (node.sku) return clean(node.sku, 80);
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = visit(child);
          if (found) return found;
        }
      }
      for (const key of ['@graph', 'offers', 'hasVariant']) {
        const found = visit(node[key]);
        if (found) return found;
      }
      return '';
    };
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const found = visit(JSON.parse(script.textContent || 'null'));
        if (found) return found;
      } catch (error) {
      }
    }
    return '';
  };
  const handleFromPath = () => {
    const match = window.location.pathname.match(/\\/products\\/([^/?#]+)/);
    return match ? clean(match[1], 180) : '';
  };
  const currentVariantId = (data, detail) => clean(
    data.variantId ||
    data.variant_id ||
    detail.sourceId ||
    (root && root.dataset ? root.dataset.packriftVariantId : '') ||
    document.querySelector('product-form-component input[name="id"], form[action*="/cart/add"] input[name="id"]')?.value ||
    '',
    80
  );
  document.addEventListener('cart:update', (event) => {
    const detail = event.detail || {};
    const data = detail.data || {};
    if (data.didError) return;
    const variantId = currentVariantId(data, detail);
    if (!variantId) return;
    const dedupeKey = [variantId, data.productId || '', data.itemCount || '', Math.floor(Date.now() / 2500)].join(':');
    if (seen.has(dedupeKey)) return;
    seen.set(dedupeKey, Date.now());
    for (const [key, timestamp] of seen) {
      if (Date.now() - timestamp > 15000) seen.delete(key);
    }
    const continuity = readContinuity();
    const payload = {
      event: 'add_to_cart',
      release,
      source: 'pdp_procurement_handoff_edge_cart_update',
      sku: clean((root && root.dataset ? root.dataset.packriftSku : '') || jsonLdSku(), 80),
      handle: clean((root && root.dataset ? root.dataset.packriftHandle : '') || handleFromPath(), 180),
      product_id: clean(data.productId || (root && root.dataset ? root.dataset.packriftProductId : '') || '', 80),
      variant_id: variantId,
      quantity: clean(data.itemCount || '', 40),
      cart_item_count: clean(data.itemCount || '', 40),
      page_url: window.location.href,
      source_url: window.location.href,
      referrer: document.referrer,
      ...continuity
    };
    writeCartAttributes(continuity);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ...payload, packrift_ai_sales: true });
    window.dispatchEvent(new CustomEvent('packrift:ai-sales-add-to-cart', { detail: payload }));
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('https://mcp.packrift.com/events/ai-sales', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('https://mcp.packrift.com/events/ai-sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        });
      }
    } catch (error) {
      // Tracking failure should never interrupt buying.
    }
  }, true);
})();
</script>`;
}

function ensureAiSalesAddToCartListener(html: string): { html: string; added: boolean } {
  if (html.includes(AI_SALES_ADD_TO_CART_RELEASE)) {
    return { html, added: false };
  }
  const listener = buildAiSalesAddToCartListener();
  if (html.includes("</body>")) {
    return { html: html.replace("</body>", `${listener}</body>`), added: true };
  }
  return { html: `${html}${listener}`, added: true };
}

function buildOwnedPageProductLinks(block: OwnedPageProductLinkBlock): string {
  const rows = block.items
    .map((item) => {
      const reorderUrl = new URL("https://packrift.com/pages/reorder-packaging-by-sku");
      reorderUrl.searchParams.set("view", "packrift_ai_reorder_live_r07");
      reorderUrl.hash = skuAnchor(item.sku);
      return `<li><a href="${escapeHtml(item.path)}"><strong>${escapeHtml(item.sku)}</strong> - ${escapeHtml(item.title)}</a> <a href="${escapeHtml(reorderUrl.pathname + reorderUrl.search + reorderUrl.hash)}">Reorder by SKU</a></li>`;
    })
    .join("");

  return `
<section class="packrift-owned-product-links packrift-owned-product-links--edge" data-packrift-release="${OWNED_PAGE_PRODUCT_LINKS_RELEASE}" data-source="cloudflare-edge">
  <style>
    .packrift-owned-product-links{border:1px solid rgba(26,38,64,.16);border-radius:6px;margin:24px 0;padding:18px;background:rgba(248,246,242,.65)}
    .packrift-owned-product-links h2{margin:0 0 8px;font-size:1.25rem;line-height:1.25}
    .packrift-owned-product-links p{margin:0 0 12px}
    .packrift-owned-product-links ul{margin:0 0 14px;padding-left:1.15rem;display:grid;gap:8px}
    .packrift-owned-product-links li{line-height:1.35}
    .packrift-owned-product-links a{overflow-wrap:anywhere}
  </style>
  <h2>${escapeHtml(block.heading)}</h2>
  <p>${escapeHtml(block.body)}</p>
  <ul>${rows}</ul>
  <p><a href="/pages/find-packaging-by-exact-spec">Find more exact packaging specs</a> | <a href="/pages/reorder-packaging-by-sku?view=packrift_ai_reorder_live_r07">Reorder by SKU</a> | <a href="/pages/packrift-ai-exact-spec-data">AI exact-spec data</a> | <a href="https://mcp.packrift.com/ai/conversion-route-catalog.json">AI purchase route catalog</a> | <a href="https://mcp.packrift.com/ai/conversion-route-catalog.md">Crawler route guide</a> | <a href="https://mcp.packrift.com/ai/top-1000-ai-sales-sitemap.xml">Top 1,000 AI SKU sitemap</a> | <a href="https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl">AI-approved product JSONL</a></p>
</section>`;
}

function buildReorderFeaturedSkuBlock(): string {
  const rows = REORDER_FEATURED_SKUS.map((item) => {
    const reorderUrl = new URL("https://packrift.com/pages/reorder-packaging-by-sku");
    reorderUrl.searchParams.set("view", "packrift_ai_reorder_live_r07");
    reorderUrl.hash = skuAnchor(item.sku);
    reorderUrl.searchParams.set("utm_source", "openai");
    reorderUrl.searchParams.set("utm_medium", "reorder_loop");
    reorderUrl.searchParams.set("utm_campaign", "ai_order_winner_reorder_2026_05_10");
    reorderUrl.searchParams.set("utm_content", "reorder_by_sku");
    const aiSkuUrl = `https://mcp.packrift.com/ai/sku/${encodeURIComponent(item.sku)}.md`;
    return `<tr><td><strong>${escapeHtml(item.sku)}</strong></td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.spec)}</td><td><a href="${escapeHtml(item.path)}">View product</a><br><a href="${escapeHtml(reorderUrl.pathname + reorderUrl.search + reorderUrl.hash)}">Reorder by SKU</a><br><a href="${escapeHtml(aiSkuUrl)}">AI SKU page</a><br><a href="/pages/packrift-ai-exact-spec-data">AI data</a></td></tr>`;
  }).join("");

  return `
<section class="packrift-reorder-featured-skus packrift-reorder-featured-skus--edge" data-packrift-release="${REORDER_PAGE_FEATURED_RELEASE}" data-source="cloudflare-edge">
  <style>
    .packrift-reorder-featured-skus{border:1px solid rgba(26,38,64,.16);border-radius:6px;margin:24px 0;padding:18px;background:rgba(248,246,242,.72)}
    .packrift-reorder-featured-skus h2{margin:0 0 8px;font-size:1.25rem;line-height:1.25}
    .packrift-reorder-featured-skus p{margin:0 0 12px}
    .packrift-reorder-featured-skus table{width:100%;border-collapse:collapse}
    .packrift-reorder-featured-skus th,.packrift-reorder-featured-skus td{border-bottom:1px solid rgba(26,38,64,.12);padding:8px;text-align:left;vertical-align:top}
    .packrift-reorder-featured-skus a{overflow-wrap:anywhere}
  </style>
  <h2>Featured exact-spec reorder SKUs</h2>
  <p>These high-priority Packrift SKUs have direct product, reorder, and machine-readable SKU pages for exact-spec procurement handoff.</p>
  <table><thead><tr><th>SKU</th><th>Product</th><th>Spec</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>
  <p><a href="/pages/find-packaging-by-exact-spec">Find packaging by exact spec</a> | <a href="/pages/packrift-ai-exact-spec-data">AI exact-spec data</a> | <a href="https://mcp.packrift.com/ai/conversion-route-catalog.json">AI purchase route catalog</a> | <a href="https://mcp.packrift.com/ai/conversion-route-catalog.md">Crawler route guide</a> | <a href="https://mcp.packrift.com/ai/top-1000-ai-sales-sitemap.xml">Top 1,000 AI SKU sitemap</a></p>
</section>`;
}

function repairReorderPageHtml(html: string): string {
  let updated = html
    .replace(/PACKRIFT-REORDER-PAGE-TOP1000-\d{4}-\d{2}-\d{2}-R\d{2}/g, REORDER_PAGE_FEATURED_RELEASE)
    .replace(/view=packrift_ai_reorder_v\d+(#sku-)/g, `view=${REORDER_PAGE_CANONICAL_VIEW}$1`)
    .replace(/view=raw(#sku-)/g, `view=${REORDER_PAGE_CANONICAL_VIEW}$1`);

  if (!updated.includes(REORDER_PAGE_EDGE_REPAIR_RELEASE)) {
    const marker = `\n<!-- ${REORDER_PAGE_EDGE_REPAIR_RELEASE} -->`;
    updated = updated.includes("</main>") ? updated.replace("</main>", `${marker}</main>`) : `${updated}${marker}`;
  }
  return updated;
}

function repairPaidSkuInternalNote(html: string, pathname: string): { html: string; repaired: boolean } {
  const repair = PAID_SKU_NOTE_REPAIRS[pathname];
  if (!repair || !html.includes(repair.internalNote)) {
    return { html, repaired: false };
  }
  return {
    html: html.replaceAll(repair.internalNote, repair.buyerNote),
    repaired: true,
  };
}

function buildPaidPdpExactSpecCard(pathname: string): string {
  return "";
}

function repairPaidPdpExactSpecCard(html: string, pathname: string): { html: string; repaired: boolean } {
  const card = PDP_EXACT_SPEC_CARDS[pathname];
  if (!card) return { html, repaired: false };
  let updated = html;
  let repaired = false;
  const exactCardPattern =
    /(?:<style data-packrift-exact-spec-card-style>[\s\S]*?<\/style>\s*)?<div\b[^>]*data-packrift-exact-spec-card[^>]*>[\s\S]*?(?=\s*<dl class="packrift-pdp-procurement__facts">)/;

  if (exactCardPattern.test(updated)) {
    const replaced = updated.replace(exactCardPattern, "");
    if (replaced !== updated) {
      updated = replaced;
      repaired = true;
    }
  }

  const actionRepaired = updated.replace(
    /<div class="packrift-pdp-procurement__actions">[\s\S]*?<\/div>/g,
    (block) => {
      const quoteHref = block.match(/href="([^"]*\/pages\/bulk-quote[^"]*)"/i)?.[1];
      if (!quoteHref) return block;
      return `<div class="packrift-pdp-procurement__actions">
      <a class="packrift-pdp-procurement__action packrift-pdp-procurement__action--primary" href="${quoteHref}" data-packrift-event="quote_click">Request Bulk</a>
    </div>`;
    }
  );
  if (actionRepaired !== updated) {
    updated = actionRepaired;
    repaired = true;
  }

  const bodyRepaired = updated
    .replace(
      /<p class="packrift-pdp-procurement__body">[\s\S]*?<\/p>/,
      '<p class="packrift-pdp-procurement__body">Use this when you need repeat-volume pricing or a bulk request tied to the exact item on this page.</p>'
    )
    .replace(
      /<p class="packrift-pdp-procurement__note">[\s\S]*?<\/p>/,
      '<p class="packrift-pdp-procurement__note">Bulk requests keep the SKU, product title, and product URL attached.</p>'
    );
  if (bodyRepaired !== updated) {
    updated = bodyRepaired;
    repaired = true;
  }

  return { html: updated, repaired };
}

async function storefrontPassThrough(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const upstreamUrl = new URL(request.url);
  const shouldBypass36x16x16PageCache =
    request.method === "GET" &&
    url.hostname === "packrift.com" &&
    url.pathname === "/pages/36x16x16-boxes" &&
    !url.searchParams.has("view");
  if (shouldBypass36x16x16PageCache) {
    upstreamUrl.searchParams.set("view", "default");
  }
  const upstreamRequest = shouldBypass36x16x16PageCache ? new Request(upstreamUrl.toString(), request) : request;
  const response = await fetch(upstreamRequest);
  await maybeRecordRouteLandingTelemetry(env, request, url, response);
  if (shouldBypass36x16x16PageCache && response.status === 200) {
    const headers = new Headers(response.headers);
    headers.set("x-packrift-page-cache-bypass", SEMRUSH_36X16X16_PAGE_CACHE_BYPASS_RELEASE);
    headers.delete("content-length");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  const isHtmlGet =
    request.method === "GET" &&
    response.status === 200 &&
    response.headers.get("content-type")?.includes("text/html");
  if (url.pathname === "/pages/reorder-packaging-by-sku" && isHtmlGet) {
    const html = await response.text();
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("x-packrift-reorder-link-repair", REORDER_PAGE_EDGE_REPAIR_RELEASE);
    let updated = repairReorderPageHtml(html);
    const hasFeaturedSection = updated.includes("packrift-reorder-featured-skus--edge");
    headers.set("x-packrift-reorder-featured-skus", hasFeaturedSection ? "origin-or-existing-edge" : "edge");
    if (!hasFeaturedSection) {
      const injection = buildReorderFeaturedSkuBlock();
      updated = updated.includes("<h2>Top AI-ready reorder SKUs</h2>")
        ? updated.replace("<h2>Top AI-ready reorder SKUs</h2>", `${injection}<h2>Top AI-ready reorder SKUs</h2>`)
        : updated.replace("</main>", `${injection}</main>`);
    }
    return new Response(updated, { status: response.status, statusText: response.statusText, headers });
  }
  const ownedPageBlock = OWNED_PAGE_PRODUCT_LINK_BLOCKS[url.pathname];
  if (ownedPageBlock && isHtmlGet) {
    const html = await response.text();
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("x-packrift-owned-page-product-links", html.includes(OWNED_PAGE_PRODUCT_LINKS_RELEASE) ? "origin" : "edge");
    if (html.includes(OWNED_PAGE_PRODUCT_LINKS_RELEASE)) {
      return new Response(html, { status: response.status, statusText: response.statusText, headers });
    }
    const injection = buildOwnedPageProductLinks(ownedPageBlock);
    const updated = html.includes("</rte-formatter>")
      ? html.replace("</rte-formatter>", `${injection}</rte-formatter>`)
      : html.replace("</main>", `${injection}</main>`);
    return new Response(updated, { status: response.status, statusText: response.statusText, headers });
  }
  if (
    !isHtmlGet ||
    !url.pathname.startsWith("/products/") ||
    url.pathname.endsWith(".js")
  ) {
    return response;
  }

  const rawHtml = await response.text();
  const paidSkuRepair = repairPaidSkuInternalNote(rawHtml, url.pathname);
  const exactSpecRepair = repairPaidPdpExactSpecCard(paidSkuRepair.html, url.pathname);
  const html = exactSpecRepair.html;
  const passThroughHeaders = new Headers(response.headers);
  passThroughHeaders.set("x-packrift-product-edge-release", "PACKRIFT-PRODUCT-EDGE-2026-05-16-R01");
  passThroughHeaders.set("x-packrift-product-edge-paid-pdp", PAID_PDP_EXACT_SPEC_CARDS[url.pathname] ? "true" : "false");
  passThroughHeaders.set("x-packrift-product-edge-exact-spec-pdp", PDP_EXACT_SPEC_CARDS[url.pathname] ? "true" : "false");
  if (paidSkuRepair.repaired || exactSpecRepair.repaired) {
    passThroughHeaders.delete("content-length");
  }
  if (paidSkuRepair.repaired) {
    passThroughHeaders.set("x-packrift-paid-sku-note-repair", PAID_SKU_NOTE_REPAIR_RELEASE);
  }
  if (exactSpecRepair.repaired) {
    passThroughHeaders.set("x-packrift-pdp-exact-spec-card-edge", PDP_EXACT_SPEC_CARD_EDGE_RELEASE);
  }
  const addToCartListener = ensureAiSalesAddToCartListener(html);
  if (html.includes(PDP_PROCUREMENT_RELEASE) || !html.includes('class="ph__sidebar-inner"')) {
    if (addToCartListener.added) {
      passThroughHeaders.delete("content-length");
      passThroughHeaders.set("x-packrift-ai-sales-add-to-cart", AI_SALES_ADD_TO_CART_RELEASE);
    }
    return new Response(addToCartListener.html, {
      status: response.status,
      statusText: response.statusText,
      headers: passThroughHeaders,
    });
  }

  const injection = buildPdpProcurementHandoff(html, url);
  const insertionPoint = "</form><!-- Trust Badges -->";
  const updated = html.includes(insertionPoint)
    ? html.replace(insertionPoint, `</form>${injection}<!-- Trust Badges -->`)
    : html.replace("</div><!-- /.ph__sidebar-inner -->", `${injection}</div><!-- /.ph__sidebar-inner -->`);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-packrift-product-edge-release", "PACKRIFT-PRODUCT-EDGE-2026-05-16-R01");
  headers.set("x-packrift-product-edge-paid-pdp", PAID_PDP_EXACT_SPEC_CARDS[url.pathname] ? "true" : "false");
  headers.set("x-packrift-product-edge-exact-spec-pdp", PDP_EXACT_SPEC_CARDS[url.pathname] ? "true" : "false");
  headers.set("x-packrift-pdp-procurement-handoff", PDP_PROCUREMENT_RELEASE);
  if (paidSkuRepair.repaired) {
    headers.set("x-packrift-paid-sku-note-repair", PAID_SKU_NOTE_REPAIR_RELEASE);
  }
  return new Response(updated, { status: response.status, statusText: response.statusText, headers });
}

const AI_CORPUS_ROUTES: Record<string, { key: string; contentType: string }> = {
  "/ai/packrift-exact-spec-packaging-catalog.md": {
    key: "ai/packrift-exact-spec-packaging-catalog.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/packrift-ai-approved-products.jsonl": {
    key: "ai/packrift-ai-approved-products.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/products.jsonl": {
    key: "ai/packrift-ai-approved-products.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/packrift-ai-approved-products.csv": {
    key: "ai/packrift-ai-approved-products.csv",
    contentType: "text/csv; charset=utf-8",
  },
  "/ai/top-1000-ai-sales-skus.md": {
    key: "ai/top-1000-ai-sales-skus.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/top-1000-ai-sales-skus.csv": {
    key: "ai/top-1000-ai-sales-skus.csv",
    contentType: "text/csv; charset=utf-8",
  },
  "/ai/products.csv": {
    key: "ai/packrift-ai-approved-products.csv",
    contentType: "text/csv; charset=utf-8",
  },
  "/ai/packrift-openai-products-strict-stable-current.tsv": {
    key: "ai/packrift-openai-products-strict-stable-current.tsv",
    contentType: "text/tab-separated-values; charset=utf-8",
  },
  "/ai/openai-products.tsv": {
    key: "ai/packrift-openai-products-strict-stable-current.tsv",
    contentType: "text/tab-separated-values; charset=utf-8",
  },
  "/ai/corrugated-box-sizes.jsonl": {
    key: "ai/corrugated-box-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/mailer-sizes.jsonl": {
    key: "ai/mailer-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/label-sizes.jsonl": {
    key: "ai/label-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/tape-sizes.jsonl": {
    key: "ai/tape-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/poly-bag-sizes.jsonl": {
    key: "ai/poly-bag-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/stretch-film-sizes.jsonl": {
    key: "ai/stretch-film-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/strapping-sizes.jsonl": {
    key: "ai/strapping-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/strapping.jsonl": {
    key: "ai/strapping-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/tag-sizes.jsonl": {
    key: "ai/tag-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/tags.jsonl": {
    key: "ai/tag-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/void-fill-sizes.jsonl": {
    key: "ai/void-fill-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/void-fill.jsonl": {
    key: "ai/void-fill-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/waste-containment-sizes.jsonl": {
    key: "ai/waste-containment-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/waste-containment.jsonl": {
    key: "ai/waste-containment-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/packing-list-envelope-sizes.jsonl": {
    key: "ai/packing-list-envelope-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/packing-list-envelopes.jsonl": {
    key: "ai/packing-list-envelope-sizes.jsonl",
    contentType: "application/x-ndjson; charset=utf-8",
  },
  "/ai/reorder-by-sku.md": {
    key: "ai/reorder-by-sku.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/spec-finder-tools.md": {
    key: "ai/spec-finder-tools.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/mcp-tools.json": {
    key: "ai/mcp-tools.json",
    contentType: "application/json; charset=utf-8",
  },
  "/ai/no-match-policy.md": {
    key: "ai/no-match-policy.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/packaging-procurement-prompts.md": {
    key: "ai/packaging-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/ai-sales-critical-path.md": {
    key: "ai/ai-sales-critical-path.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/shopify-native-ucp-commerce-surface.md": {
    key: "ai/shopify-native-ucp-commerce-surface.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/shopify-native-search-exceptions.md": {
    key: "ai/shopify-native-search-exceptions.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/crawler-safe-purchase-paths.md": {
    key: "ai/crawler-safe-purchase-paths.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/packrift-agent-endpoints-status.json": {
    key: "ai/packrift-agent-endpoints-status.json",
    contentType: "application/json; charset=utf-8",
  },
  "/ai/conversion-starter-routes.json": {
    key: "ai/conversion-starter-routes.json",
    contentType: "application/json; charset=utf-8",
  },
  "/ai/conversion-starter-routes.md": {
    key: "ai/conversion-starter-routes.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/conversion-route-catalog.json": {
    key: "ai/conversion-route-catalog.json",
    contentType: "application/json; charset=utf-8",
  },
  "/ai/conversion-route-catalog.md": {
    key: "ai/conversion-route-catalog.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/conversion-route-catalog.csv": {
    key: "ai/conversion-route-catalog.csv",
    contentType: "text/csv; charset=utf-8",
  },
  "/ai/conversion-route-telemetry-watch.json": {
    key: "ai/conversion-route-telemetry-watch.json",
    contentType: "application/json; charset=utf-8",
  },
  "/ai/conversion-route-telemetry-watch.md": {
    key: "ai/conversion-route-telemetry-watch.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/corrugated-box-procurement-prompts.md": {
    key: "ai/corrugated-box-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/mailer-procurement-prompts.md": {
    key: "ai/mailer-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/label-procurement-prompts.md": {
    key: "ai/label-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/tape-procurement-prompts.md": {
    key: "ai/tape-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/poly-bag-procurement-prompts.md": {
    key: "ai/poly-bag-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/stretch-film-procurement-prompts.md": {
    key: "ai/stretch-film-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/strapping-procurement-prompts.md": {
    key: "ai/strapping-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/tag-procurement-prompts.md": {
    key: "ai/tag-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/void-fill-procurement-prompts.md": {
    key: "ai/void-fill-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/waste-containment-procurement-prompts.md": {
    key: "ai/waste-containment-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
  "/ai/packing-list-envelope-procurement-prompts.md": {
    key: "ai/packing-list-envelope-procurement-prompts.md",
    contentType: "text/markdown; charset=utf-8",
  },
};

const EMPTY_OK_AI_CORPUS_KEYS = new Set(["ai/tag-sizes.jsonl", "ai/waste-containment-sizes.jsonl"]);

function aiCorpusBodyIsLoaded(route: { key: string }, body: string | null): boolean {
  return body !== null && (body.length > 0 || EMPTY_OK_AI_CORPUS_KEYS.has(route.key));
}

const AI_SALES_PRIORITY_SKUS = ["1066", "LL251WR", "MFL1295"] as const;
const AI_SALES_SKU_ROUTE_LIMIT = 1000;
const MCP_SOURCE_ACTIVATION_SITEMAP_URL = "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml";
const MCP_SOURCE_ACTIVATION_SITEMAP_SOURCES = [
  { source: "official_registry", target: "generic_streamable_http" },
  { source: "mcpservers_org", target: "generic_streamable_http" },
  { source: "glama_connector", target: "glama_connector" },
  { source: "glama_server_listing", target: "generic_streamable_http" },
  { source: "mcp_directory", target: "generic_streamable_http" },
  { source: "anthropic_connectors_directory", target: "claude_code" },
  { source: "smithery", target: "generic_streamable_http" },
  { source: "cline_mcp_marketplace", target: "cline" },
  { source: "mcp_so", target: "generic_streamable_http" },
  { source: "browse_sh", target: "codex" },
  { source: "mcpmarket_com", target: "mcp_marketplace" },
  { source: "cursor_directory", target: "cursor_windsurf_vscode" },
  { source: "mcpcentral", target: "generic_streamable_http" },
  { source: "mcpfinder", target: "generic_streamable_http" },
  { source: "pulsemcp_packrift", target: "generic_streamable_http" },
  { source: "mcpskills", target: "generic_streamable_http" },
  { source: "agentndx", target: "generic_streamable_http" },
  { source: "mcpbench", target: "generic_streamable_http" },
  { source: "chiark", target: "generic_streamable_http" },
  { source: "mcp_marketplace_io", target: "mcp_marketplace" },
  { source: "mcplist_ai", target: "generic_streamable_http" },
  { source: "mcphubz", target: "generic_streamable_http" },
  { source: "mcp_blue", target: "generic_streamable_http" },
  { source: "findmcp_dev", target: "generic_streamable_http" },
  { source: "mcplane", target: "generic_streamable_http" },
  { source: "mcpsolutions_dev", target: "generic_streamable_http" },
  { source: "gpmcp", target: "generic_streamable_http" },
  { source: "theresamcpforthat", target: "generic_streamable_http" },
  { source: "mcpserverfinder", target: "generic_streamable_http" },
  { source: "docker_mcp_catalog", target: "generic_streamable_http" },
  { source: "generic", target: "generic_streamable_http" },
] as const;
const MCP_DIRECTORY_UPDATE_CARD_URLS = MCP_SOURCE_ACTIVATION_SITEMAP_SOURCES.flatMap(({ source }) => [
  `https://mcp.packrift.com/ai/mcp-directory-update/${source}.json`,
  `https://mcp.packrift.com/ai/mcp-directory-update/${source}.md`,
]);
const APPROVED_CATALOG_BY_SKU = new Map(
  APPROVED_CATALOG.map((item) => [item.sku.toUpperCase(), item])
);
const APPROVED_CATALOG_BY_HANDLE = new Map(
  APPROVED_CATALOG.map((item) => [item.handle.toLowerCase(), item])
);
const FIRST20_EXACT_SPEC_VIEW_SKUS = [
  "10103",
  "B803SS25PK",
  "AB205",
  "EP2212120BX",
  "BD1212AS",
  "GSA20EL",
  "BING110",
  "10108",
  "B804SS",
  "AB211",
  "GD101R",
  "BD31624",
  "PL1",
  "BING111",
  "10212SSFOL",
  "B805SS",
  "AB213",
  "MSF20755B",
  "EP2212225BX",
  "BD51612AS",
] as const;

const AI_DISCOVERY_URLS = [
  "https://mcp.packrift.com/start",
  "https://mcp.packrift.com/SKILL.md",
  "https://mcp.packrift.com/llms.txt",
  "https://mcp.packrift.com/llms-full.txt",
  "https://mcp.packrift.com/mcp.json",
  "https://mcp.packrift.com/manifest",
  "https://mcp.packrift.com/resources",
  "https://mcp.packrift.com/health",
  "https://mcp.packrift.com/ai/mcp-start.json",
  "https://mcp.packrift.com/ai/mcp-start.md",
  "https://mcp.packrift.com/ai/mcp-start.html",
  "https://mcp.packrift.com/r/config/generic",
  "https://mcp.packrift.com/r/install/generic/codex",
  "https://mcp.packrift.com/r/run/generic/generic_streamable_http",
  "https://mcp.packrift.com/server-card.json",
  "https://mcp.packrift.com/.well-known/mcp.json",
  "https://mcp.packrift.com/.well-known/mcp/server-card.json",
  "https://mcp.packrift.com/.well-known/glama.json",
  "https://mcp.packrift.com/.well-known/mcp-marketplace.json",
  "https://mcp.packrift.com/ai/packrift-ai-agent-instructions.md",
  "https://packrift.com/agents.md",
  "https://mcp.packrift.com/ai/packrift-exact-spec-packaging-catalog.md",
  "https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl",
  "https://mcp.packrift.com/ai/packrift-ai-approved-products.csv",
  "https://mcp.packrift.com/ai/purchase-paths.jsonl",
  "https://mcp.packrift.com/ai/top-1000-ai-sales-skus.md",
  "https://mcp.packrift.com/ai/top-1000-ai-sales-skus.csv",
  "https://mcp.packrift.com/ai/top-1000-ai-sales-sitemap.xml",
  "https://mcp.packrift.com/ai/all-ai-approved-sku-sitemap.xml",
  "https://mcp.packrift.com/ai/packrift-openai-products-strict-stable-current.tsv",
  "https://mcp.packrift.com/ai/corrugated-box-sizes.jsonl",
  "https://mcp.packrift.com/ai/mailer-sizes.jsonl",
  "https://mcp.packrift.com/ai/label-sizes.jsonl",
  "https://mcp.packrift.com/ai/tape-sizes.jsonl",
  "https://mcp.packrift.com/ai/poly-bag-sizes.jsonl",
  "https://mcp.packrift.com/ai/stretch-film-sizes.jsonl",
  "https://mcp.packrift.com/ai/strapping-sizes.jsonl",
  "https://mcp.packrift.com/ai/tag-sizes.jsonl",
  "https://mcp.packrift.com/ai/void-fill-sizes.jsonl",
  "https://mcp.packrift.com/ai/packing-list-envelope-sizes.jsonl",
  "https://mcp.packrift.com/ai/reorder-by-sku.md",
  "https://mcp.packrift.com/ai/spec-finder-tools.md",
  "https://mcp.packrift.com/ai/mcp-tools.json",
  "https://mcp.packrift.com/ai/no-match-policy.md",
  "https://mcp.packrift.com/ai/packaging-procurement-prompts.md",
  "https://mcp.packrift.com/ai/ai-sales-critical-path.md",
  "https://mcp.packrift.com/ai/shopify-native-ucp-commerce-surface.md",
  "https://mcp.packrift.com/ai/shopify-native-search-exceptions.md",
  "https://mcp.packrift.com/ai/crawler-safe-purchase-paths.md",
  "https://mcp.packrift.com/ai/all-agent-capture.json",
  "https://mcp.packrift.com/ai/all-agent-capture.md",
  "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
  "https://mcp.packrift.com/ai/mcp-adoption-kit.md",
  "https://mcp.packrift.com/ai/mcp-install-matrix.json",
  "https://mcp.packrift.com/ai/mcp-install-matrix.md",
  "https://mcp.packrift.com/ai/mcp-install-actions.json",
  "https://mcp.packrift.com/ai/mcp-install-actions.md",
  "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
  "https://mcp.packrift.com/ai/mcp-first-run-actions.md",
  "https://mcp.packrift.com/ai/mcp-client-config.json",
  "https://mcp.packrift.com/ai/mcp-client-config.md",
  "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
  "https://mcp.packrift.com/ai/mcp-usage-snapshot.md",
  "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
  "https://mcp.packrift.com/ai/mcp-funnel-snapshot.md",
  "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
  "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.md",
  "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
  "https://mcp.packrift.com/ai/mcp-source-activation-queue.md",
  "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
  MCP_SOURCE_ACTIVATION_SITEMAP_URL,
  "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
  "https://mcp.packrift.com/ai/mcp-activation-experiments.md",
  "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
  "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
  "https://mcp.packrift.com/ai/mcp-buyer-use-cases.md",
  "https://mcp.packrift.com/ai/mcp-cart-activation.json",
  "https://mcp.packrift.com/ai/mcp-cart-activation.md",
  "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
  "https://mcp.packrift.com/ai/mcp-first-run-proof.md",
  "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
  "https://mcp.packrift.com/ai/mcp-workflow-gallery.md",
  "https://mcp.packrift.com/ai/browser-agent-bridge.json",
  "https://mcp.packrift.com/ai/browser-agent-bridge.md",
  "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
  "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.md",
  "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md",
  "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
  "https://mcp.packrift.com/ai/mcp-directory-refresh.md",
  "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
  "https://mcp.packrift.com/ai/mcp-directory-submit-actions.md",
  ...MCP_DIRECTORY_UPDATE_CARD_URLS,
  "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
  "https://mcp.packrift.com/ai/mcp-reviewer-activation.md",
  "https://mcp.packrift.com/r/activate",
  "https://mcp.packrift.com/r/activate/generic",
  "https://mcp.packrift.com/r/activate/generic?format=html",
  "https://mcp.packrift.com/ai/claude-connector-submission.json",
  "https://mcp.packrift.com/ai/claude-connector-submission.md",
  "https://mcp.packrift.com/ai/agent-capture-outreach.json",
  "https://mcp.packrift.com/ai/agent-capture-outreach.md",
  "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
  "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.md",
  "https://mcp.packrift.com/ai/packrift-agent-endpoints-status.json",
  "https://mcp.packrift.com/ai/conversion-starter-routes.json",
  "https://mcp.packrift.com/ai/conversion-starter-routes.md",
  "https://mcp.packrift.com/ai/conversion-route-catalog.json",
  "https://mcp.packrift.com/ai/conversion-route-catalog.md",
  "https://mcp.packrift.com/ai/conversion-route-catalog.csv",
  "https://mcp.packrift.com/ai/measured-handoffs.json",
  "https://mcp.packrift.com/ai/measured-handoffs.md",
  "https://mcp.packrift.com/ai/measured-handoffs.csv",
  "https://mcp.packrift.com/ai/first20-exact-spec-routes.json",
  "https://mcp.packrift.com/ai/first20-exact-spec-routes.md",
  "https://mcp.packrift.com/ai/conversion-route-redirect-sitemap.xml",
  "https://mcp.packrift.com/ai/conversion-route-telemetry-watch.json",
  "https://mcp.packrift.com/ai/conversion-route-telemetry-watch.md",
  "https://mcp.packrift.com/ai/corrugated-box-procurement-prompts.md",
  "https://mcp.packrift.com/ai/mailer-procurement-prompts.md",
  "https://mcp.packrift.com/ai/label-procurement-prompts.md",
  "https://mcp.packrift.com/ai/tape-procurement-prompts.md",
  "https://mcp.packrift.com/ai/poly-bag-procurement-prompts.md",
  "https://mcp.packrift.com/ai/stretch-film-procurement-prompts.md",
  "https://mcp.packrift.com/ai/strapping-procurement-prompts.md",
  "https://mcp.packrift.com/ai/tag-procurement-prompts.md",
  "https://mcp.packrift.com/ai/void-fill-procurement-prompts.md",
  "https://mcp.packrift.com/ai/packing-list-envelope-procurement-prompts.md",
];

const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  "/llms.txt": "Short Packrift agent index with MCP, corpus, and family file links.",
  "/llms-full.txt": "Dense Packrift agent reference for packaging categories, tools, guides, and discovery links.",
  "/mcp.json": "Copy-ready remote MCP client config for installing Packrift MCP in common agent hosts.",
  "/robots.txt": "MCP subdomain crawler policy and sitemap references.",
  "/sitemap.xml": "MCP discovery sitemap for machine-readable Packrift resources.",
  "/ai/sitemap.xml": "AI corpus sitemap for exact-spec Packrift product data files.",
  "/SKILL.md": "Canonical Browse/browser-agent SKILL.md that installs Packrift as a thin wrapper around the hosted MCP endpoint.",
  "/start": "Packrift MCP start page for developers, agents, directory reviewers, install snippets, and measured cart handoff.",
  "/manifest": "REST discovery manifest for Packrift MCP tools, prompts, resources, and health endpoints.",
  "/resources": "Paginated REST resource adapter listing Packrift MCP and AI-commerce discovery resources.",
  "/health": "Packrift MCP health check with version, tool count, resource count, and KV status.",
  "/ai/mcp-start.json": "One-link Packrift MCP start pack for installs, first useful flow, proof URLs, and measured cart handoff.",
  "/ai/mcp-start.md": "Markdown Packrift MCP start guide for humans, agents, and directory reviewers.",
  "/ai/mcp-start.html": "HTML Packrift MCP start page for developers and agent operators.",
  "/r/config/generic": "Source-attributed remote MCP client config fetch for generic directories and agent handoffs.",
  "/r/install/generic/codex": "Source-attributed Codex install-action payload for Packrift MCP.",
  "/r/run/generic/generic_streamable_http": "Source-attributed first useful Packrift MCP run ending at create_cart_url with no order created.",
  "/server-card.json": "Root Packrift MCP server discovery card.",
  "/.well-known/mcp.json": "Well-known copy-ready remote MCP client config for installing Packrift MCP.",
  "/.well-known/mcp/server-card.json": "Packrift MCP server discovery card.",
  "/.well-known/glama.json": "Glama remote connector claim file for the Packrift hosted MCP endpoint.",
  "/.well-known/mcp-marketplace.json": "MCP Marketplace discovery manifest for Packrift MCP.",
  "/agents.md": "Root-domain Packrift exact-spec AI-agent instructions.",
  "/ai/packrift-ai-agent-instructions.md": "Machine-readable Packrift AI-agent instructions, exact-match policy, and handoff rules.",
  "/ai/packrift-exact-spec-packaging-catalog.md": "Human and crawler-readable exact-spec catalog overview.",
  "/ai/packrift-ai-approved-products.jsonl": "Primary AI_APPROVE-only product/spec JSONL corpus.",
  "/ai/packrift-ai-approved-products.csv": "Spreadsheet-friendly AI_APPROVE-only product/spec corpus.",
  "/ai/purchase-paths.jsonl": "Top 1,000 AI-sales SKU purchase-path map with MCP SKU records, variant IDs, product, reorder, quote, and cart-candidate handoffs.",
  "/ai/top-1000-ai-sales-skus.md": "Revenue-prioritized AI_APPROVE SKU index for agentic procurement and reorder flows.",
  "/ai/top-1000-ai-sales-skus.csv": "Spreadsheet-friendly top 1,000 AI-sales SKU index.",
  "/ai/top-1000-ai-sales-sitemap.xml": "Crawl map for top AI-sales SKU-level markdown pages.",
  "/ai/all-ai-approved-sku-sitemap.xml": "Full crawl map for every AI_APPROVE SKU-level markdown and JSON page.",
  "/ai/packrift-openai-products-strict-stable-current.tsv": "Strict stable OpenAI-shaped product snapshot for QA.",
  "/ai/corrugated-box-sizes.jsonl": "AI-approved corrugated boxes by exact spec.",
  "/ai/mailer-sizes.jsonl": "AI-approved mailers by exact spec.",
  "/ai/label-sizes.jsonl": "AI-approved labels by exact spec.",
  "/ai/tape-sizes.jsonl": "AI-approved tape by exact spec.",
  "/ai/poly-bag-sizes.jsonl": "AI-approved poly bags by exact spec.",
  "/ai/stretch-film-sizes.jsonl": "AI-approved stretch film by exact spec.",
  "/ai/strapping-sizes.jsonl": "AI-approved strapping by exact spec.",
  "/ai/tag-sizes.jsonl": "AI-approved tags by exact spec.",
  "/ai/void-fill-sizes.jsonl": "AI-approved void fill by exact spec.",
  "/ai/packing-list-envelope-sizes.jsonl": "AI-approved packing list envelopes by exact spec.",
  "/ai/reorder-by-sku.md": "Reorder-focused SKU corpus for repeat procurement workflows.",
  "/ai/spec-finder-tools.md": "Spec Finder and MCP tool behavior guide.",
  "/ai/mcp-tools.json": "Machine-readable MCP tool and conversion URL map.",
  "/ai/no-match-policy.md": "Exact-match and no-match safety policy.",
  "/ai/packaging-procurement-prompts.md": "Prompt templates for exact-spec packaging procurement.",
  "/ai/ai-sales-critical-path.md": "Buyer-critical Packrift AI-commerce routes and MCP behavior.",
  "/ai/shopify-native-ucp-commerce-surface.md": "Guide for using Packrift Shopify-native UCP alongside the Packrift exact-spec MCP.",
  "/ai/shopify-native-search-exceptions.md": "Known Shopify native search ranking collisions and safe exact-SKU fallback routes.",
  "/ai/crawler-safe-purchase-paths.md": "Fallback purchase handoff guide for AI agents when Shopify PDP fetches are challenged or unavailable.",
  "/ai/all-agent-capture.json": "Machine-readable capture matrix for every Packrift agent surface: MCP clients, ChatGPT/OpenAI commerce, Shopify UCP, Claude, Cursor, Windsurf, Codex, Glama, registries, corpora, crawlers, and Browserbase Browse candidates.",
  "/ai/all-agent-capture.md": "Crawler-readable Packrift all-agent capture matrix and operating rules.",
  "/ai/mcp-adoption-kit.json": "Machine-readable Packrift MCP adoption kit with install snippets, first-five-minute JSON-RPC calls, curl/JavaScript/Python examples, demo SKUs, useful workflows, proof URLs, and exact-match rules.",
  "/ai/mcp-adoption-kit.md": "Crawler-readable Packrift MCP adoption kit for developers, agents, marketplaces, and AI-commerce workflows with copy-paste hosted endpoint examples.",
  "/ai/mcp-install-matrix.json": "Machine-readable Packrift MCP install matrix for common agent hosts, copy-ready remote MCP config, smoke tests, and measured cart handoff rules.",
  "/ai/mcp-install-matrix.md": "Crawler-readable Packrift MCP install matrix for developers, directories, and agent hosts.",
  "/ai/mcp-install-actions.json": "Machine-readable tracked Packrift MCP install-action URLs for common client targets and directory handoffs.",
  "/ai/mcp-install-actions.md": "Crawler-readable tracked Packrift MCP install-action URLs for common client targets and directory handoffs.",
  "/ai/mcp-first-run-actions.json": "Machine-readable tracked Packrift MCP first-run actions that move installs into live SKU, price, inventory, and cart URL verification.",
  "/ai/mcp-first-run-actions.md": "Crawler-readable tracked Packrift MCP first-run actions with pasteable curl scripts for post-install cart verification.",
  "/ai/mcp-client-config.json": "Small copy-ready Packrift MCP client config bundle for IDEs, agent hosts, and directory reviewers.",
  "/ai/mcp-client-config.md": "Markdown Packrift MCP client config bundle with install commands and first tests.",
  "/ai/mcp-usage-snapshot.json": "Machine-readable public aggregate usage snapshot for Packrift MCP discovery, tool calls, cart handoff, and proof-gate iteration.",
  "/ai/mcp-usage-snapshot.md": "Crawler-readable Packrift MCP usage snapshot for agents, directory reviewers, and proof-driven iteration.",
  "/ai/mcp-funnel-snapshot.json": "Machine-readable public aggregate MCP funnel snapshot with starts, installs, tool calls, qualified cart landings, and order proof gates.",
  "/ai/mcp-funnel-snapshot.md": "Crawler-readable Packrift MCP funnel proof gate for directory reviewers, agents, and Packrift operators.",
  "/ai/mcp-ga4-funnel-proof.json": "Machine-readable sanitized GA4 canonical MCP funnel proof with qualified external sessions, cart landings, and MCP-attributed order progress.",
  "/ai/mcp-ga4-funnel-proof.md": "Crawler-readable sanitized GA4 canonical MCP funnel proof for reviewers, agents, and Packrift operators.",
  "/ai/mcp-source-activation-queue.json": "Machine-readable next-best-action queue that ranks Packrift MCP sources by the event needed to progress toward real tool calls, cart landings, and orders.",
  "/ai/mcp-source-activation-queue.md": "Crawler-readable Packrift MCP source activation queue with source-specific action URLs, target events, and acceptance criteria.",
  "/ai/mcp-source-activation-queue.html": "Human-facing Packrift MCP activation command center that ranks sources and deep-links into the real source-specific MCP runner.",
  "/ai/mcp-source-activation-sitemap.xml": "Finite crawl map for source-specific Packrift MCP start, install, first-run, and reviewer activation URLs.",
  "/ai/mcp-activation-experiments.json": "Machine-readable Packrift MCP source activation experiments with hypotheses, target events, expected snapshot deltas, and suppression rules.",
  "/ai/mcp-activation-experiments.md": "Crawler-readable Packrift MCP activation experiment plan for turning source activity into measurable tool calls, cart landings, and orders.",
  "/ai/mcp-activation-experiments.html": "Human-facing Packrift MCP activation experiment board with copy-ready external requests and measurement links.",
  "/ai/mcp-buyer-use-cases.json": "Machine-readable buyer-facing Packrift MCP use cases for exact SKU reorder, fit-by-dimensions, mailer selection, labels, no-match quote recovery, and procurement handoff.",
  "/ai/mcp-buyer-use-cases.md": "Crawler-readable buyer-facing Packrift MCP use-case map and starter prompts for qualified AI-commerce demand.",
  "/ai/mcp-cart-activation.json": "Machine-readable Packrift MCP cart activation playbook for turning exact buyer intent into measured /r/cart landings after live checks.",
  "/ai/mcp-cart-activation.md": "Crawler-readable Packrift MCP cart activation playbook with buyer prompts, JSON-RPC sequences, and measured cart landing rules.",
  "/ai/mcp-first-run-proof.json": "Machine-readable first-run Packrift MCP proof that runs the live exact SKU, price, inventory, and measured cart landing sequence in synthetic read-only mode.",
  "/ai/mcp-first-run-proof.md": "Crawler-readable first-run Packrift MCP proof for external agents and developers evaluating live price, inventory, and cart handoff.",
  "/ai/mcp-workflow-gallery.json": "Machine-readable Packrift MCP workflow gallery with copy-ready buyer prompts and JSON-RPC sequences for agent hosts, evals, demos, and cart handoff examples.",
  "/ai/mcp-workflow-gallery.md": "Crawler-readable Packrift MCP workflow gallery for developers and AI-commerce agents building exact SKU, fit-by-dimensions, and no-exact-match flows.",
  "/ai/browser-agent-bridge.json": "Machine-readable bridge for Browserbase Browse, browser-use, Playwright, CUA, and browser agents that should read public Packrift resources and confirm live commerce facts through MCP.",
  "/ai/browser-agent-bridge.md": "Crawler-readable browser-agent bridge that keeps Browse-style workflows routed through the canonical Packrift MCP endpoint.",
  "/ai/browserbase-browse-skill-pack.json": "Machine-readable Browse/browser-skill starter pack that wraps public Packrift reads around the canonical MCP endpoint without creating a duplicate CLI or buyer surface.",
  "/ai/browserbase-browse-skill-pack.md": "Crawler-readable Browse/browser-skill starter pack with copy-ready rules, URLs, prompts, and JSON-RPC calls for MCP-confirmed Packrift workflows.",
  "/ai/browserbase-browse/SKILL.md": "Canonical Browse/browser-agent SKILL.md mirror with YAML frontmatter, install snippets, JSON-RPC examples, and MCP-only purchase-handoff rules.",
  "/ai/mcp-directory-refresh.json": "Machine-readable Packrift MCP directory recrawl pack with listing copy, proof URLs, stale directory targets, and recrawl request text.",
  "/ai/mcp-directory-refresh.md": "Crawler-readable Packrift MCP directory recrawl pack for MCP directories, marketplaces, and agent indexes.",
  "/ai/mcp-directory-submit-actions.json": "Machine-readable Packrift MCP directory action queue with stale-surface statuses, proof URLs, and copy-ready recrawl messages.",
  "/ai/mcp-directory-submit-actions.md": "Crawler-readable Packrift MCP directory submit-action queue for support teams, reviewers, and agent indexes.",
  "/ai/mcp-reviewer-activation.json": "Machine-readable Packrift MCP reviewer activation handoff for moving proof clicks into real MCP client calls and measured cart URLs.",
  "/ai/mcp-reviewer-activation.md": "Crawler-readable Packrift MCP reviewer activation handoff with source-specific install, proof, JSON-RPC, and cart URL acceptance rules.",
  "/r/activate": "Packrift MCP activation command center for working the source queue without creating a duplicate CLI or buyer surface.",
  "/r/activate/generic": "Source-attributed Packrift MCP activation packet and browser runner that converts review/proof interest into a real MCP client run.",
  "/ai/claude-connector-submission.json": "Machine-readable Claude Connectors Directory submission packet for Packrift MCP with form fields, proof URLs, and safety rules.",
  "/ai/claude-connector-submission.md": "Crawler-readable Claude Connectors Directory submission packet for reviewers and Packrift operators.",
  "/ai/agent-capture-outreach.json": "Machine-readable Packrift MCP outreach packet combining install snippets, proof links, tracked directory URLs, recrawl messages, and browser-agent handoff rules.",
  "/ai/agent-capture-outreach.md": "Crawler-readable Packrift MCP outreach packet for directory reviewers, partners, agent hosts, and Packrift operators.",
  "/ai/mcp-cart-handoff-candidates.json": "Machine-readable MCP cart handoff candidates for priority exact-spec SKUs with create_cart_url arguments and UTM-stamped cart candidates.",
  "/ai/mcp-cart-handoff-candidates.md": "Crawler-readable MCP cart handoff playbook for turning exact-spec SKU retrieval into tracked cart handoff.",
  "/ai/packrift-agent-endpoints-status.json": "Machine-readable status map for Packrift agent, MCP, UCP, corpus, and reserved root routes.",
  "/ai/conversion-starter-routes.json": "Machine-readable top conversion starter routes with product, reorder, quote, cart, SKU markdown, SKU JSON, and copy-procurement-spec handoffs.",
  "/ai/conversion-starter-routes.md": "Crawler-readable top conversion starter routes for exact AI_APPROVE product, reorder, quote, cart, and procurement-spec handoffs.",
  "/ai/conversion-route-catalog.json": "Machine-readable conversion route catalog for all verified purchase-ready SKUs with product, reorder, quote, cart, SKU markdown, SKU JSON, and copy-procurement-spec handoffs.",
  "/ai/conversion-route-catalog.md": "Crawler-readable conversion route catalog summary for top verified purchase-ready SKUs.",
  "/ai/conversion-route-catalog.csv": "Spreadsheet-friendly conversion route catalog for verified purchase-ready SKUs.",
  "/ai/measured-handoffs.json": "Compact MCP-controlled measured handoff directory for priority exact-spec SKUs with product, reorder, quote, cart, SKU markdown, SKU JSON, and copy-procurement-spec routes.",
  "/ai/measured-handoffs.md": "Crawler-readable measured handoff directory for priority exact-spec SKU product, reorder, quote, cart, and no-match recovery routes.",
  "/ai/measured-handoffs.csv": "Spreadsheet-friendly measured handoff directory for priority exact-spec SKU routes including measured cart URLs.",
  "/ai/first20-exact-spec-routes.json": "Machine-readable first-20 PDP spec-graph route map using canonical-preserving exact-spec view URLs while Shopify bare PDP page_cache is gated.",
  "/ai/first20-exact-spec-routes.md": "Crawler-readable first-20 PDP spec-graph route map and Shopify page-cache gate note.",
  "/ai/conversion-route-redirect-sitemap.xml": "Crawl map of measured MCP redirect handoffs for product, reorder, and quote routes.",
  "/ai/conversion-route-telemetry-watch.json": "Machine-readable watch for conversion-route product, reorder, quote, cart, copy-spec, and discovery telemetry.",
  "/ai/conversion-route-telemetry-watch.md": "Crawler-readable telemetry watch for conversion-route signal lift and path integrity.",
  "/ai/corrugated-box-procurement-prompts.md": "Family-specific exact-spec prompts for corrugated box procurement.",
  "/ai/mailer-procurement-prompts.md": "Family-specific exact-spec prompts for mailer procurement.",
  "/ai/label-procurement-prompts.md": "Family-specific exact-spec prompts for label procurement.",
  "/ai/tape-procurement-prompts.md": "Family-specific exact-spec prompts for tape procurement.",
  "/ai/poly-bag-procurement-prompts.md": "Family-specific exact-spec prompts for poly bag procurement.",
  "/ai/stretch-film-procurement-prompts.md": "Family-specific exact-spec prompts for stretch film procurement.",
  "/ai/strapping-procurement-prompts.md": "Family-specific exact-spec prompts for strapping procurement.",
  "/ai/tag-procurement-prompts.md": "Family-specific exact-spec prompts for tag procurement.",
  "/ai/void-fill-procurement-prompts.md": "Family-specific exact-spec prompts for void fill procurement.",
  "/ai/packing-list-envelope-procurement-prompts.md": "Family-specific exact-spec prompts for packing list envelope procurement.",
};

function resourceName(pathname: string): string {
  return pathname.replace(/^\/+/, "").replace(/[-_/]/g, " ").replace(/\.\w+$/, "");
}

function resourceDescription(pathname: string): string {
  if (pathname.match(/^\/ai\/mcp-directory-update\/[a-z0-9_]{2,64}\.(json|md)$/)) {
    return "Source-specific Packrift MCP directory update card with canonical listing data, tracked install URLs, first-run proof, and acceptance gate.";
  }
  return RESOURCE_DESCRIPTIONS[pathname] ?? "Packrift MCP discovery resource.";
}

function normalizeProductIdentifier(value: string): string {
  const withoutExtension = value.replace(/\.(json|md)$/i, "");
  try {
    return decodeURIComponent(withoutExtension).trim();
  } catch {
    return withoutExtension.trim();
  }
}

function catalogItemByHandleOrSku(value: string): ApprovedCatalogItem | null {
  const identifier = normalizeProductIdentifier(value);
  return APPROVED_CATALOG_BY_SKU.get(identifier.toUpperCase()) ?? APPROVED_CATALOG_BY_HANDLE.get(identifier.toLowerCase()) ?? null;
}

async function cachedStaticTextResponse(
  c: AppContext,
  cacheName: string,
  body: string,
  contentType: string
): Promise<Response> {
  const url = new URL(c.req.url);
  if (url.pathname === "/ai/purchase-paths.jsonl") {
    return new Response(purchasePathsJsonl(), {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        ...PURCHASE_PATHS_HEADERS,
      },
    });
  }
  url.search = "";
  const cacheRequest = new Request(url.toString(), { method: "GET" });
  const edgeCache = typeof caches !== "undefined" ? caches.default : null;
  const cached = edgeCache ? await edgeCache.match(cacheRequest) : null;
  if (cached) return cached;

  const mirrorKey = `${STATIC_CACHE_MIRROR_PREFIX}${cacheName}`;
  const overrideKey = `${STATIC_CACHE_OVERRIDE_PREFIX}${cacheName}`;
  const [overrideBody, mirrorBody] = await Promise.all([
    c.env.CATALOG_CACHE.get(overrideKey, "text"),
    c.env.CATALOG_CACHE.get(mirrorKey, "text"),
  ]);
  let responseBody = body;
  let cacheState = "fresh";
  if (overrideBody !== null) {
    responseBody = overrideBody;
    cacheState = "kv-override";
  } else if (mirrorBody === body) {
    responseBody = mirrorBody;
    cacheState = "kv-hit";
  } else {
    await c.env.CATALOG_CACHE.put(mirrorKey, body, { expirationTtl: STATIC_CACHE_TTL_SECONDS });
  }
  const response = new Response(responseBody, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "X-Packrift-Static-Cache": cacheState,
      ...RAW_HEADERS,
    },
  });
  if (edgeCache) await edgeCache.put(cacheRequest, response.clone());
  return response;
}

const MCP_RESOURCE_TEMPLATES = [
  {
    uriTemplate: "https://mcp.packrift.com/ai/sku/{sku}.md",
    name: "Packrift AI-approved SKU markdown page",
    description:
      "AI-readable exact-spec product page for one Packrift AI_APPROVE SKU, including product, reorder, quote, MCP handoff, and no-match policy.",
    mimeType: "text/markdown",
  },
  {
    uriTemplate: "https://mcp.packrift.com/ai/sku/{sku}.json",
    name: "Packrift AI-approved SKU JSON record",
    description:
      "Machine-readable exact-spec product record for one Packrift AI_APPROVE SKU, including product, reorder, quote, MCP handoff, and no-match policy.",
    mimeType: "application/json",
  },
];

const AI_SALES_PRIORITY_SKU_RESOURCE_URLS = AI_SALES_PRIORITY_SKUS.flatMap((sku) => [
  `https://mcp.packrift.com/ai/sku/${sku}.md`,
  `https://mcp.packrift.com/ai/sku/${sku}.json`,
]);

const MCP_RESOURCES = [...AI_DISCOVERY_URLS, ...AI_SALES_PRIORITY_SKU_RESOURCE_URLS].map((uri) => {
  const parsed = new URL(uri);
  const pathname = parsed.pathname;
  const explicitFormat = parsed.searchParams.get("format")?.toLowerCase();
  const route = AI_CORPUS_ROUTES[pathname];
  const mimeType =
    pathname.match(/^\/ai\/sku\/[^/]+\.md$/)
      ? "text/markdown"
      : pathname.match(/^\/ai\/sku\/[^/]+\.json$/)
        ? "application/json"
        : explicitFormat === "html"
          ? "text/html"
        : pathname === "/manifest" || pathname === "/resources" || pathname === "/health" || pathname.startsWith("/r/config/") || pathname.startsWith("/r/install/") || pathname.startsWith("/r/run/") || pathname.startsWith("/r/activate/")
          ? "application/json"
        : pathname.endsWith(".jsonl")
          ? "application/x-ndjson"
        : route?.contentType.split(";")[0] ??
    (pathname.endsWith(".xml")
      ? "application/xml"
      : pathname.endsWith(".json")
        ? "application/json"
        : pathname === "/start" || pathname.endsWith(".html")
          ? "text/html"
        : pathname.endsWith(".md")
          ? "text/markdown"
          : pathname.endsWith(".csv")
            ? "text/csv"
            : "text/plain");
  return {
    uri,
    name: resourceName(pathname),
    description: resourceDescription(pathname),
    mimeType,
  };
});

async function readResourceText(env: Env, uri: string): Promise<string> {
  const parsed = new URL(uri);
  const pathname = parsed.pathname;
  const explicitFormat = parsed.searchParams.get("format")?.toLowerCase();
  if (pathname === "/llms.txt") return llmsTxt;
  if (pathname === "/llms-full.txt") return llmsFullTxt;
  if (pathname === "/mcp.json") return JSON.stringify(mcpClientConfigPayload(clientConfigRuntime()).config, null, 2);
  if (pathname === "/robots.txt") return robotsTxt();
  if (pathname === "/sitemap.xml" || pathname === "/ai/sitemap.xml") return aiSitemapXml();
  if (pathname === "/ai/top-1000-ai-sales-sitemap.xml") return topAiSalesSkuSitemapXml();
  if (pathname === "/ai/all-ai-approved-sku-sitemap.xml") return allAiApprovedSkuSitemapXml();
  if (pathname === "/ai/conversion-route-redirect-sitemap.xml") return routeRedirectSitemapXml();
  if (pathname === "/SKILL.md") return browserbaseBrowseSkillMd(browserbaseBrowseSkillPackRuntime());
  if (pathname === "/start") return mcpStartHtml(mcpStartRuntime());
  if (pathname === "/manifest") return JSON.stringify(mcpManifestPayload(), null, 2);
  if (pathname === "/resources") return JSON.stringify(mcpResourcesPayload(MCP_RESOURCES.length, 0), null, 2);
  if (pathname === "/health") return JSON.stringify(await mcpHealthPayload(env), null, 2);
  if (pathname === "/server-card.json") return JSON.stringify(mcpServerCardPayload(), null, 2);
  if (pathname === "/.well-known/mcp.json") return JSON.stringify(mcpClientConfigPayload(clientConfigRuntime()).config, null, 2);
  if (pathname === "/.well-known/mcp/server-card.json") return JSON.stringify(mcpServerCardPayload(), null, 2);
  if (pathname === "/.well-known/glama.json") return JSON.stringify(glamaConnectorClaim(), null, 2);
  if (pathname === "/.well-known/mcp-marketplace.json") return JSON.stringify(mcpMarketplaceDiscoveryPayload(), null, 2);
  if (pathname === "/agents.md") return agentInstructionsMd;
  if (pathname === "/ai/packrift-ai-agent-instructions.md") return agentInstructionsMd;
  if (pathname === "/ai/crawler-safe-purchase-paths.md") return crawlerSafePurchasePathsMarkdown();
  if (pathname === "/ai/mcp-start.json") return JSON.stringify(mcpStartPayload(mcpStartRuntime()), null, 2);
  if (pathname === "/ai/mcp-start.md") return mcpStartMarkdown(mcpStartRuntime());
  if (pathname === "/ai/mcp-start.html") return mcpStartHtml(mcpStartRuntime());
  if (pathname === "/r/config/generic") return JSON.stringify(sourceAwareMcpJson("generic"), null, 2);
  if (pathname === "/r/install/generic/codex") return JSON.stringify(mcpInstallActionPayload({ source: "generic", target: "codex" }), null, 2);
  if (pathname === "/r/run/generic/generic_streamable_http") return JSON.stringify(mcpFirstRunActionPayload({ source: "generic", target: "generic_streamable_http" }), null, 2);
  if (pathname === "/r/activate/generic") {
    return explicitFormat === "html"
      ? mcpReviewerActivationHtml(reviewerActivationRuntime(), "generic")
      : JSON.stringify(mcpReviewerActivationPayload(reviewerActivationRuntime(), "generic"), null, 2);
  }
  if (pathname === "/ai/all-agent-capture.json") return JSON.stringify(allAgentCapturePayload(agentCaptureRuntime()), null, 2);
  if (pathname === "/ai/all-agent-capture.md") return allAgentCaptureMarkdown(agentCaptureRuntime());
  if (pathname === "/ai/mcp-adoption-kit.json") return JSON.stringify(mcpAdoptionKitPayload(adoptionKitRuntime()), null, 2);
  if (pathname === "/ai/mcp-adoption-kit.md") return mcpAdoptionKitMarkdown(adoptionKitRuntime());
  if (pathname === "/ai/mcp-install-matrix.json") return JSON.stringify(mcpInstallMatrixPayload(installMatrixRuntime()), null, 2);
  if (pathname === "/ai/mcp-install-matrix.md") return mcpInstallMatrixMarkdown(installMatrixRuntime());
  if (pathname === "/ai/mcp-install-actions.json") return JSON.stringify(mcpInstallActionsPayload(installActionRuntime()), null, 2);
  if (pathname === "/ai/mcp-install-actions.md") return mcpInstallActionsMarkdown(installActionRuntime());
  if (pathname === "/ai/mcp-first-run-actions.json") return JSON.stringify(mcpFirstRunActionsPayload(firstRunActionRuntime()), null, 2);
  if (pathname === "/ai/mcp-first-run-actions.md") return mcpFirstRunActionsMarkdown(firstRunActionRuntime());
  if (pathname === "/ai/mcp-client-config.json") return JSON.stringify(mcpClientConfigPayload(clientConfigRuntime()), null, 2);
  if (pathname === "/ai/mcp-client-config.md") return mcpClientConfigMarkdown(clientConfigRuntime());
  if (pathname === "/ai/mcp-usage-snapshot.json") return JSON.stringify(await mcpUsageSnapshotPayload(env), null, 2);
  if (pathname === "/ai/mcp-usage-snapshot.md") return mcpUsageSnapshotMarkdown(await mcpUsageSnapshotPayload(env));
  if (pathname === "/ai/mcp-funnel-snapshot.json") return JSON.stringify(await mcpFunnelSnapshotPayload(env), null, 2);
  if (pathname === "/ai/mcp-funnel-snapshot.md") return mcpFunnelSnapshotMarkdown(await mcpFunnelSnapshotPayload(env));
  if (pathname === "/ai/mcp-ga4-funnel-proof.json") return JSON.stringify(await mcpGa4FunnelProofPayload(env), null, 2);
  if (pathname === "/ai/mcp-ga4-funnel-proof.md") return mcpGa4FunnelProofMarkdown(await mcpGa4FunnelProofPayload(env));
  if (pathname === "/ai/mcp-source-activation-queue.json") return JSON.stringify(await mcpSourceActivationQueuePayload(env), null, 2);
  if (pathname === "/ai/mcp-source-activation-queue.md") return mcpSourceActivationQueueMarkdown(await mcpSourceActivationQueuePayload(env));
  if (pathname === "/ai/mcp-source-activation-sitemap.xml") return sourceActivationSitemapXml();
  if (pathname === "/ai/mcp-activation-experiments.json") return JSON.stringify(await mcpActivationExperimentsPayload(env), null, 2);
  if (pathname === "/ai/mcp-activation-experiments.md") return mcpActivationExperimentsMarkdown(await mcpActivationExperimentsPayload(env));
  if (pathname === "/ai/mcp-activation-experiments.html") return mcpActivationExperimentsHtml(await mcpActivationExperimentsPayload(env));
  if (pathname === "/ai/mcp-buyer-use-cases.json") return JSON.stringify(mcpBuyerUseCasesPayload(buyerUseCasesRuntime()), null, 2);
  if (pathname === "/ai/mcp-buyer-use-cases.md") return mcpBuyerUseCasesMarkdown(buyerUseCasesRuntime());
  if (pathname === "/ai/mcp-cart-activation.json") return JSON.stringify(mcpCartActivationPayload(cartActivationRuntime()), null, 2);
  if (pathname === "/ai/mcp-cart-activation.md") return mcpCartActivationMarkdown(cartActivationRuntime());
  if (pathname === "/ai/mcp-first-run-proof.json") return JSON.stringify(mcpFirstRunProofPayload(firstRunProofRuntime(), await firstRunProofDemo(env)), null, 2);
  if (pathname === "/ai/mcp-first-run-proof.md") return mcpFirstRunProofMarkdown(firstRunProofRuntime(), await firstRunProofDemo(env));
  if (pathname === "/ai/mcp-workflow-gallery.json") return JSON.stringify(mcpWorkflowGalleryPayload(workflowGalleryRuntime()), null, 2);
  if (pathname === "/ai/mcp-workflow-gallery.md") return mcpWorkflowGalleryMarkdown(workflowGalleryRuntime());
  if (pathname === "/ai/browser-agent-bridge.json") return JSON.stringify(browserAgentBridgePayload(browserAgentBridgeRuntime()), null, 2);
  if (pathname === "/ai/browser-agent-bridge.md") return browserAgentBridgeMarkdown(browserAgentBridgeRuntime());
  if (pathname === "/ai/browserbase-browse-skill-pack.json") return JSON.stringify(browserbaseBrowseSkillPackPayload(browserbaseBrowseSkillPackRuntime()), null, 2);
  if (pathname === "/ai/browserbase-browse-skill-pack.md") return browserbaseBrowseSkillPackMarkdown(browserbaseBrowseSkillPackRuntime());
  if (pathname === "/ai/browserbase-browse/SKILL.md") return browserbaseBrowseSkillMd(browserbaseBrowseSkillPackRuntime());
  if (pathname === "/ai/mcp-directory-refresh.json") return JSON.stringify(mcpDirectoryRefreshPayload(directoryRefreshRuntime()), null, 2);
  if (pathname === "/ai/mcp-directory-refresh.md") return mcpDirectoryRefreshMarkdown(directoryRefreshRuntime());
  if (pathname === "/ai/mcp-directory-submit-actions.json") return JSON.stringify(mcpDirectorySubmitActionsPayload(directorySubmitActionsRuntime()), null, 2);
  if (pathname === "/ai/mcp-directory-submit-actions.md") return mcpDirectorySubmitActionsMarkdown(directorySubmitActionsRuntime());
  const directoryUpdateMatch = pathname.match(/^\/ai\/mcp-directory-update\/([a-z0-9_]{2,64})\.(json|md)$/);
  if (directoryUpdateMatch) {
    const source = directoryUpdateMatch[1] ?? "";
    const format = directoryUpdateMatch[2] ?? "json";
    const payload = mcpDirectorySubmitActionPayload(directorySubmitActionsRuntime(), source);
    if (!payload) throw new Error(`Unsupported directory update source: ${source}`);
    return format === "json"
      ? JSON.stringify(payload, null, 2)
      : mcpDirectorySubmitActionMarkdown(directorySubmitActionsRuntime(), source) ?? "";
  }
  if (pathname === "/ai/mcp-reviewer-activation.json") return JSON.stringify(mcpReviewerActivationPayload(reviewerActivationRuntime()), null, 2);
  if (pathname === "/ai/mcp-reviewer-activation.md") return mcpReviewerActivationMarkdown(reviewerActivationRuntime());
  if (pathname === "/ai/claude-connector-submission.json") return JSON.stringify(claudeConnectorSubmissionPayload(claudeConnectorSubmissionRuntime()), null, 2);
  if (pathname === "/ai/claude-connector-submission.md") return claudeConnectorSubmissionMarkdown(claudeConnectorSubmissionRuntime());
  if (pathname === "/ai/agent-capture-outreach.json") return JSON.stringify(agentCaptureOutreachPayload(agentCaptureOutreachRuntime()), null, 2);
  if (pathname === "/ai/agent-capture-outreach.md") return agentCaptureOutreachMarkdown(agentCaptureOutreachRuntime());
  if (pathname === "/ai/mcp-cart-handoff-candidates.json") return JSON.stringify(cartHandoffCandidatesPayload(), null, 2);
  if (pathname === "/ai/mcp-cart-handoff-candidates.md") return cartHandoffCandidatesMarkdown();
  if (pathname === "/ai/first20-exact-spec-routes.json") return JSON.stringify(first20ExactSpecRoutePayload(), null, 2);
  if (pathname === "/ai/first20-exact-spec-routes.md") return first20ExactSpecRouteMarkdown();
  if (pathname === "/ai/measured-handoffs.json") return JSON.stringify(measuredHandoffDirectoryPayload(), null, 2);
  if (pathname === "/ai/measured-handoffs.md") return measuredHandoffDirectoryMarkdown();
  if (pathname === "/ai/measured-handoffs.csv") return measuredHandoffDirectoryCsv();
  if (pathname === "/ai/purchase-paths.jsonl") return purchasePathsJsonl();
  const skuMatch = pathname.match(/^\/ai\/sku\/([^/]+)\.(md|json)$/);
  if (skuMatch) {
    const item = skuRouteItem(skuMatch[1] ?? "");
    if (!item) throw new Error(`SKU is not in the AI_APPROVE catalog: ${skuMatch[1] ?? ""}`);
    return skuMatch[2] === "json"
      ? JSON.stringify(skuPagePayload(item), null, 2)
      : skuPageMarkdown(item);
  }

  const route = AI_CORPUS_ROUTES[pathname];
  if (!route) {
    throw new Error(`Unsupported resource path: ${pathname}`);
  }
  const body = await env.CATALOG_CACHE.get(route.key, "text");
  if (!aiCorpusBodyIsLoaded(route, body)) {
    throw new Error(`Packrift AI corpus file is not loaded in KV: ${route.key}`);
  }
  return body ?? "";
}

function aiSitemapXml(): string {
  const now = new Date().toISOString().slice(0, 10);
  const urls = AI_DISCOVERY_URLS.map(
    (url) => `  <url><loc>${url}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq></url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function sourceActivationSitemapUrls(): string[] {
  return MCP_SOURCE_ACTIVATION_SITEMAP_SOURCES.flatMap(({ source, target }) => [
    ...MCP_DIRECTORY_UPDATE_CARD_URLS.filter((url) => url.includes(`/mcp-directory-update/${source}.`)),
    `https://mcp.packrift.com/r/start/${source}`,
    `https://mcp.packrift.com/start?utm_source=${source}`,
    `https://mcp.packrift.com/r/config/${source}`,
    trackedInstallUrl(source, target),
    `${trackedInstallUrl(source, target)}&format=html`,
    `${trackedInstallUrl(source, target)}&format=json`,
    trackedRunUrl(source, target),
    `${trackedRunUrl(source, target)}&format=html`,
    `https://mcp.packrift.com/r/activate/${source}`,
    `https://mcp.packrift.com/r/activate/${source}?format=html`,
  ]);
}

function sourceActivationSitemapXml(): string {
  const now = new Date().toISOString().slice(0, 10);
  const urls = sourceActivationSitemapUrls()
    .map((url) => `  <url><loc>${escapeXml(url)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function mcpHealthPayload(env: Env) {
  let kvStatus: "ok" | "error" = "ok";
  try {
    await env.CATALOG_CACHE.get("health:probe");
  } catch {
    kvStatus = "error";
  }
  return {
    ok: kvStatus === "ok",
    server: serverCard.name,
    version: serverCard.version,
    uptime_seconds: workerUptimeSeconds(),
    kv_status: kvStatus,
    resources_count: MCP_RESOURCES.length,
    tools_count: TOOLS.length,
  };
}

function mcpManifestPayload() {
  return {
    ...serverCard,
    endpoint_url: "https://mcp.packrift.com/mcp",
    sse_url: "https://mcp.packrift.com/sse",
    health_url: "https://mcp.packrift.com/health",
    resources_url: "https://mcp.packrift.com/resources",
    product_resource_template: "https://mcp.packrift.com/products/{handle_or_sku}",
    resource_count: MCP_RESOURCES.length,
    tool_count: TOOLS.length,
    tools: TOOLS.map((tool) => tool.schema.name),
    prompts: PROMPTS.map((prompt) => prompt.name),
    mcp_start: "https://mcp.packrift.com/start",
    mcp_start_json: "https://mcp.packrift.com/ai/mcp-start.json",
    mcp_start_markdown: "https://mcp.packrift.com/ai/mcp-start.md",
    all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
    mcp_adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
    mcp_install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
    mcp_install_actions: "https://mcp.packrift.com/ai/mcp-install-actions.json",
    tracked_install_template: "https://mcp.packrift.com/r/install/{source}/{target}",
    tracked_install_generic_codex: "https://mcp.packrift.com/r/install/generic/codex",
    mcp_first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
    tracked_run_template: "https://mcp.packrift.com/r/run/{source}/{target}",
    tracked_run_generic: "https://mcp.packrift.com/r/run/generic/generic_streamable_http",
    mcp_client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
    root_mcp_json: "https://mcp.packrift.com/mcp.json",
    well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
    tracked_config_template: "https://mcp.packrift.com/r/config/{source}",
    tracked_config_generic: "https://mcp.packrift.com/r/config/generic",
    mcp_usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
    mcp_source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
    mcp_source_activation_queue_html: "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
    mcp_source_activation_sitemap: MCP_SOURCE_ACTIVATION_SITEMAP_URL,
    mcp_activation_experiments: "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
    mcp_activation_experiments_html: "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
    mcp_activation_command_center: "https://mcp.packrift.com/r/activate",
    mcp_buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
    mcp_cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
    mcp_first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
    mcp_workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
    browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
    mcp_directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    mcp_directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
    mcp_reviewer_activation: "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
    tracked_reviewer_activation_template: "https://mcp.packrift.com/r/activate/{source}",
    tracked_reviewer_activation_generic: "https://mcp.packrift.com/r/activate/generic",
    tracked_reviewer_activation_html_template: "https://mcp.packrift.com/r/activate/{source}?format=html",
    tracked_reviewer_activation_html_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
    claude_connector_submission: "https://mcp.packrift.com/ai/claude-connector-submission.json",
    agent_capture_outreach: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
  };
}

function mcpServerCardPayload() {
  return {
    ...serverCard,
    serverInfo: {
      name: serverCard.name,
      version: serverCard.version,
    },
    authentication: {
      required: false,
      schemes: [],
    },
    endpoint_url: "https://mcp.packrift.com/mcp",
    transport_url: "https://mcp.packrift.com/mcp",
    resource_links: serverCard.resources,
    tool_names: serverCard.tools,
    prompt_names: serverCard.prompts,
    tools: TOOLS.map((tool) => tool.schema),
    prompts: PROMPTS.map(promptListItem),
    resources: MCP_RESOURCES,
    resource_templates: MCP_RESOURCE_TEMPLATES,
    registry_distribution: {
      directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      reviewer_activation: "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      source_activation_queue_html: "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
      source_activation_sitemap: MCP_SOURCE_ACTIVATION_SITEMAP_URL,
      activation_experiments: "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
      activation_experiments_html: "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
      activation_command_center: "https://mcp.packrift.com/r/activate",
      tracked_reviewer_activation_template: "https://mcp.packrift.com/r/activate/{source}",
      tracked_reviewer_activation_html_template: "https://mcp.packrift.com/r/activate/{source}?format=html",
      tracked_reviewer_activation_html_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
      tracked_start_template: "https://mcp.packrift.com/r/start/{source}",
      tracked_install_template: "https://mcp.packrift.com/r/install/{source}/{target}",
      tracked_run_template: "https://mcp.packrift.com/r/run/{source}/{target}",
      claude_connector_submission: "https://mcp.packrift.com/ai/claude-connector-submission.json",
      agent_capture_outreach: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
    },
    client_config: {
      root_mcp_json: "https://mcp.packrift.com/mcp.json",
      well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
      full_bundle: "https://mcp.packrift.com/ai/mcp-client-config.json",
      markdown: "https://mcp.packrift.com/ai/mcp-client-config.md",
      tracked_config_template: "https://mcp.packrift.com/r/config/{source}",
      tracked_config_generic: "https://mcp.packrift.com/r/config/generic",
      tracked_install_template: "https://mcp.packrift.com/r/install/{source}/{target}",
      tracked_install_codex_generic: "https://mcp.packrift.com/r/install/generic/codex",
      first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
      tracked_run_template: "https://mcp.packrift.com/r/run/{source}/{target}",
    },
    static_server_card: {
      well_known_url: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      root_url: "https://mcp.packrift.com/server-card.json",
      compatible_fields: ["serverInfo", "authentication", "tools", "resources", "prompts"],
    },
  };
}

function agentCaptureRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function mcpStartRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function adoptionKitRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function installMatrixRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function installActionRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function firstRunActionRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function clientConfigRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function buyerUseCasesRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function cartActivationRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function firstRunProofRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function workflowGalleryRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

async function firstRunProofDemo(env: Env): Promise<FirstRunProofDemo> {
  const sku = "1066";
  const variantId = "53472879935856";
  const handle = "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle";
  const title = "10x6x6 ECT-32 Kraft Long Corrugated Boxes - 25 Bundle";
  const quantity = 1;
  const common = {
    selected_sku: sku,
    selected_handle: handle,
    match_type: "first_run_proof",
    journey_id: `mcp_first_run_proof_${sku}_${variantId}`,
    result_set_id: "mcp_first_run_proof",
  };
  const [product, pricing, inventory] = await Promise.all([
    getProductHandler(env, { handle }) as Promise<Record<string, unknown>>,
    getPricingHandler(env, { variant_ids: [variantId], quantity, ...common }) as Promise<Array<Record<string, unknown>>>,
    checkInventoryHandler(env, { variant_ids: [variantId], ...common }) as Promise<Array<Record<string, unknown>>>,
  ]);
  const cart = (await createCartUrlHandler(env, {
    items: [{ variant_id: variantId, qty: quantity }],
    source_context: "mcp_first_run_proof",
    utm_term: sku,
    suppress_analytics: true,
    analytics_context: { synthetic: true, source: "mcp_first_run_proof" },
    ...common,
  })) as Record<string, unknown>;

  return {
    mode: "synthetic_read_only_live_demo",
    live_systems_mutated: false,
    analytics_recorded: false,
    sku,
    title,
    variant_id: variantId,
    handle,
    quantity,
    product: {
      handle: product.handle,
      title: product.title,
      url: product.url,
      ai_status: product.ai_status,
      approval_gate: product.approval_gate,
      primary_variant_id: variantId,
      dimensions: product.dimensions,
    },
    pricing: pricing[0] ?? {},
    inventory: inventory[0] ?? {},
    cart: {
      url: cart.url,
      final_cart_url: cart.final_cart_url,
      utm: cart.utm,
      items: cart.items,
    },
  };
}

async function firstRunActionExecutionDemo(
  env: Env,
  request: Request,
  requestUrl: URL,
  source: string,
  target: string
): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  const sku = "1066";
  const variantId = "53472879935856";
  const handle = "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle";
  const title = "10x6x6 ECT-32 Kraft Long Corrugated Boxes - 25 Bundle";
  const quantity = 1;
  const day = compactDate();
  const runId = `mcp_first_run_action_${source}_${target}_${sku}_${day}`;
  const userAgent = request.headers.get("User-Agent") ?? "";
  const suppressCartAnalytics = !shouldRecordRouteLandingTelemetry(env, userAgent);
  const common = {
    selected_sku: sku,
    selected_handle: handle,
    match_type: "first_run_action_browser_execution",
    journey_id: runId,
    result_set_id: `mcp_first_run_action_${source}_${day}`,
    packrift_ai_id: runId,
    ai_commerce_id: runId,
    source_context: `mcp_first_run_action_${source}`,
    utm_term: sku,
  };
  try {
    const [product, pricing, inventory] = await Promise.all([
      getProductHandler(env, { handle }) as Promise<Record<string, unknown>>,
      getPricingHandler(env, { variant_ids: [variantId], quantity, ...common }) as Promise<Array<Record<string, unknown>>>,
      checkInventoryHandler(env, { variant_ids: [variantId], ...common }) as Promise<Array<Record<string, unknown>>>,
    ]);
    const cart = (await createCartUrlHandler(env, {
      sku,
      quantity,
      ...common,
      suppress_analytics: suppressCartAnalytics,
    })) as Record<string, unknown>;
    const payload = {
      release: MCP_FIRST_RUN_ACTION_RELEASE,
      generated_at: new Date().toISOString(),
      mode: "browser_executable_first_run",
      status: "ok",
      source,
      target,
      no_order_created: true,
      canonical_endpoint: "https://mcp.packrift.com/mcp",
      sku,
      title,
      variant_id: variantId,
      handle,
      quantity,
      analytics_recorded: !suppressCartAnalytics,
      product: {
        handle: product.handle,
        title: product.title,
        url: product.url,
        ai_status: product.ai_status,
        approval_gate: product.approval_gate,
        primary_variant_id: variantId,
        dimensions: product.dimensions,
      },
      pricing: pricing[0] ?? {},
      inventory: inventory[0] ?? {},
      cart: {
        mcp_handoff_id: cart.mcp_handoff_id,
        url: cart.url,
        final_cart_url: cart.final_cart_url,
        utm: cart.utm,
        items: cart.items,
      },
      success_signals: [
        "Product lookup returned the expected AI_APPROVE SKU 1066.",
        "Live pricing returned before cart handoff.",
        "Live inventory returned before cart handoff.",
        "create_cart_url returned a measured https://mcp.packrift.com/r/cart/1066 URL.",
        "No order was placed.",
      ],
    };
    await recordMcpFirstRunExecutionTelemetry(env, request, requestUrl, {
      source,
      target,
      ok: true,
      sku,
      handle,
      variantId,
      cartUrl: String(cart.url ?? ""),
      finalCartUrl: String(cart.final_cart_url ?? ""),
      latencyMs: Date.now() - startedAt,
    });
    return payload;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordMcpFirstRunExecutionTelemetry(env, request, requestUrl, {
      source,
      target,
      ok: false,
      sku,
      handle,
      variantId,
      error: message,
      latencyMs: Date.now() - startedAt,
    });
    return {
      release: MCP_FIRST_RUN_ACTION_RELEASE,
      generated_at: new Date().toISOString(),
      mode: "browser_executable_first_run",
      status: "error",
      source,
      target,
      no_order_created: true,
      sku,
      title,
      variant_id: variantId,
      handle,
      quantity,
      error: message,
    };
  }
}

function mcpFirstRunActionHtml(payload: ReturnType<typeof mcpFirstRunActionPayload>, execution?: Record<string, unknown>): string {
  const executionCart = execution && typeof execution.cart === "object" ? (execution.cart as Record<string, unknown>) : null;
  const cartUrl = typeof executionCart?.url === "string" ? executionCart.url : "";
  const status = typeof execution?.status === "string" ? execution.status : "";
  const executeUrl = new URL(payload.tracked_run_execute_url);
  executeUrl.searchParams.set("format", "html");
  const markdownUrl = payload.tracked_run_markdown_url;
  const shellUrl = payload.tracked_run_shell_url;
  const executionJson = execution ? JSON.stringify(execution, null, 2) : "";
  const agentPromptJson = JSON.stringify(payload.first_useful_run.agent_prompt)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift MCP First Run</title>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f7f6f3;color:#1b2533}
    main{max-width:980px;margin:0 auto;padding:28px 18px 48px}
    h1{font-size:1.7rem;margin:0 0 8px}
    h2{font-size:1rem;margin:22px 0 8px}
    p{line-height:1.5;color:#4f5d6b}
    .bar{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
    a.button,button{display:inline-flex;align-items:center;border:1px solid #1b2533;border-radius:6px;background:#1b2533;color:#fff;padding:9px 12px;text-decoration:none;font:inherit;cursor:pointer}
    a.secondary,button.secondary{background:#fff;color:#1b2533}
    button.copied{background:#1f8f55;border-color:#1f8f55;color:#fff}
    .panel{background:#fff;border:1px solid #dfd9ce;border-radius:8px;padding:14px;margin:14px 0}
    .pill{display:inline-block;border:1px solid #d4cec3;border-radius:999px;padding:4px 8px;margin:2px 4px 2px 0;font-size:.84rem;background:#fff}
    pre{white-space:pre-wrap;word-break:break-word;background:#101820;color:#f4f8fb;border-radius:8px;padding:12px;overflow:auto}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .ok{border-left:4px solid #1f8f55}
    .warn{border-left:4px solid #b86b00}
  </style>
</head>
<body>
  <main>
    <h1>Packrift MCP First Run</h1>
    <p>${escapeHtml(payload.purpose)}</p>
    <div>
      <span class="pill">Source: ${escapeHtml(payload.source)}</span>
      <span class="pill">Target: ${escapeHtml(payload.target)}</span>
      <span class="pill">Final tool: create_cart_url</span>
      <span class="pill">No order created</span>
    </div>
    <div class="bar">
      <a class="button" href="${escapeHtml(executeUrl.toString())}">Run live proof</a>
      <button class="secondary" id="copy-agent-prompt" type="button">Copy agent prompt</button>
      ${cartUrl ? `<a class="button secondary" href="${escapeHtml(cartUrl)}">Open measured cart URL</a>` : ""}
      <a class="button secondary" href="${escapeHtml(markdownUrl)}">Markdown</a>
      <a class="button secondary" href="${escapeHtml(shellUrl)}">Shell script</a>
    </div>
    ${execution ? `<section class="panel ${status === "ok" ? "ok" : "warn"}"><h2>Live Result</h2><pre>${escapeHtml(executionJson)}</pre></section>` : ""}
    <section class="panel">
      <h2>Endpoint</h2>
      <pre>${escapeHtml(payload.first_useful_run.endpoint)}</pre>
    </section>
    <section class="panel">
      <h2>Shell One-Liner</h2>
      <pre>${escapeHtml(payload.shell_one_liner)}</pre>
    </section>
    <section class="panel">
      <h2>Agent Prompt</h2>
      <p>Paste this into the MCP host after install. It requires the real Packrift MCP tools and a measured cart URL.</p>
      <pre>${escapeHtml(payload.first_useful_run.agent_prompt)}</pre>
    </section>
    <section class="panel">
      <h2>JSON-RPC Sequence</h2>
      <pre>${escapeHtml(JSON.stringify(payload.first_useful_run.sequence, null, 2))}</pre>
    </section>
  </main>
  <script>
    const agentPrompt = ${agentPromptJson};
    const copyButton = document.getElementById("copy-agent-prompt");
    copyButton && copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(agentPrompt);
        copyButton.textContent = "Copied";
        copyButton.classList.add("copied");
      } catch {
        copyButton.textContent = "Select prompt";
      }
      setTimeout(() => {
        copyButton.textContent = "Copy agent prompt";
        copyButton.classList.remove("copied");
      }, 1400);
    });
  </script>
</body>
</html>`;
}

function browserAgentBridgeRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function browserbaseBrowseSkillPackRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function directoryRefreshRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function directorySubmitActionsRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
    toolNames: TOOLS.map((tool) => tool.schema.name),
  };
}

function reviewerActivationRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function claudeConnectorSubmissionRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function agentCaptureOutreachRuntime() {
  return {
    serverVersion: serverCard.version,
    toolsCount: TOOLS.length,
    resourcesCount: MCP_RESOURCES.length,
    promptsCount: PROMPTS.length,
  };
}

function mcpMarketplaceDiscoveryPayload() {
  return {
    schema_version: "1",
    name: "Packrift MCP",
    description:
      "Hosted MCP server for exact-spec packaging search with live price, stock, shipping, and attributed cart handoff.",
    url: "https://mcp.packrift.com",
    contact_email: "farhan@packrift.com",
    mcp_server: {
      name: "packrift",
      version: serverCard.version,
      transport: "streamable-http",
      url: "https://mcp.packrift.com/mcp",
      auth: "none",
      install: {
        claude_code: "claude mcp add --transport http packrift https://mcp.packrift.com/mcp",
        codex: "codex mcp add packrift --url https://mcp.packrift.com/mcp",
        claude_desktop_config: {
          mcpServers: {
            packrift: {
              url: "https://mcp.packrift.com/mcp",
            },
          },
        },
      },
      tools: TOOLS.map((tool) => ({
        name: tool.schema.name,
        description: tool.schema.description,
      })),
    },
    discovery: {
      llms_txt: "https://mcp.packrift.com/llms.txt",
      llms_full_txt: "https://mcp.packrift.com/llms-full.txt",
      manifest: "https://mcp.packrift.com/manifest",
      resources: "https://mcp.packrift.com/resources",
      health: "https://mcp.packrift.com/health",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      launch_guide: "https://github.com/Packrift/packrift-mcp/blob/main/LAUNCHGUIDE.md",
      sitemap: "https://mcp.packrift.com/sitemap.xml",
      robots: "https://mcp.packrift.com/robots.txt",
      mcp_start: "https://mcp.packrift.com/start",
      mcp_start_json: "https://mcp.packrift.com/ai/mcp-start.json",
      mcp_start_markdown: "https://mcp.packrift.com/ai/mcp-start.md",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      mcp_adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      mcp_install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      mcp_install_actions: "https://mcp.packrift.com/ai/mcp-install-actions.json",
      mcp_first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
      mcp_client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
      root_mcp_json: "https://mcp.packrift.com/mcp.json",
      well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
      tracked_config_template: "https://mcp.packrift.com/r/config/{source}",
      tracked_config_generic: "https://mcp.packrift.com/r/config/generic",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      source_activation_sitemap: "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml",
      mcp_usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      mcp_funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      mcp_ga4_funnel_proof: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
      mcp_activation_experiments: "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
      mcp_activation_experiments_html: "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
      mcp_buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      mcp_cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      mcp_first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      mcp_workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      mcp_directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      mcp_directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      mcp_reviewer_activation: "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
      tracked_reviewer_activation_template: "https://mcp.packrift.com/r/activate/{source}",
      tracked_reviewer_activation_html_template: "https://mcp.packrift.com/r/activate/{source}?format=html",
      tracked_reviewer_activation_html_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
      claude_connector_submission: "https://mcp.packrift.com/ai/claude-connector-submission.json",
      agent_capture_outreach: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
    },
    signals: {
      category: "Business Tools",
      runtime_source_inference_release: MCP_RUNTIME_SOURCE_INFERENCE_RELEASE,
      runtime_source_inference:
        "MCP calls with packrift_mcp_source, mcp_source, or utm_source keep explicit source attribution. Direct untracked MCP clients are source-attributed from recognizable user-agent families such as Cline, Cursor, Windsurf, Codex, Claude, Glama, Smithery, Browse, MCP.so, and generic MCP clients.",
      tags: [
        "mcp",
        "ecommerce",
        "packaging",
        "procurement",
        "shopify",
        "inventory",
        "shipping",
        "cart-handoff",
        "remote-mcp",
        "ai-commerce",
      ],
      tool_count: TOOLS.length,
      tool_names: TOOLS.map((tool) => tool.schema.name),
      required_current_tools: [
        "search_products",
        "get_product",
        "get_pricing",
        "check_inventory",
        "find_packaging_for_item",
        "get_shipping_estimate",
        "get_cart_handoff_candidates",
        "create_cart_url",
        "prepare_purchase_handoff",
        "compare_alternatives",
        "pack_calculator",
        "inventory_status",
        "get_reorder_link",
        "get_bulk_quote_link",
        "explain_no_exact_match",
      ],
      resource_count: MCP_RESOURCES.length,
      hosted_endpoint_requires_auth: false,
    },
  };
}

function mcpResourcesPayload(limit: number, offset: number) {
  const boundedLimit = Math.max(1, Math.min(500, limit));
  const boundedOffset = Math.max(0, offset);
  const resources = MCP_RESOURCES.slice(boundedOffset, boundedOffset + boundedLimit);
  const nextCursor = boundedOffset + resources.length < MCP_RESOURCES.length ? String(boundedOffset + resources.length) : null;
  return {
    ok: true,
    total: MCP_RESOURCES.length,
    limit: boundedLimit,
    cursor: String(boundedOffset),
    next_cursor: nextCursor,
    resources,
  };
}

function topAiSalesSkuItems(limit = AI_SALES_SKU_ROUTE_LIMIT): ApprovedCatalogItem[] {
  const selected: ApprovedCatalogItem[] = [];
  const seen = new Set<string>();

  for (const sku of PURCHASE_READY_SKUS) {
    if (selected.length >= limit) break;
    const normalizedSku = sku.toUpperCase();
    const item = APPROVED_CATALOG_BY_SKU.get(normalizedSku);
    if (item && !seen.has(item.sku.toUpperCase())) {
      selected.push(item);
      seen.add(item.sku.toUpperCase());
    }
  }

  return selected;
}

const AI_EXACT_SPEC_VIEW_SKUS = new Set([
  "1066",
  "MFL1295",
  "LL251WR",
  ...FIRST20_EXACT_SPEC_VIEW_SKUS,
]);

const PAID_CHATGPT_SKU_SIGNALS: Record<string, {
  order: string;
  source: string;
  attribution: string;
  family: string;
}> = {
  "1066": {
    order: "1003",
    source: "ChatGPT product card",
    attribution: "OpenAI catalog feed via Shopify Catalog",
    family: "10 x 6 x 6 ECT-32 kraft corrugated boxes, 25 bundle",
  },
  MFL1295: {
    order: "1004",
    source: "ChatGPT product card",
    attribution: "OpenAI catalog feed via Shopify Catalog",
    family: "12 1/8 x 9 1/4 x 5 white self-seal literature mailers, 50 pack",
  },
  LL251WR: {
    order: "1005",
    source: "ChatGPT product card",
    attribution: "OpenAI catalog feed via Shopify Catalog",
    family: "2 5/8 x 1 weather-resistant polyester laser labels, 3000/case",
  },
};

function productUrlForItem(item: ApprovedCatalogItem): string {
  return `https://packrift.com/products/${encodeURIComponent(item.handle)}`;
}

function productHandoffUrlForItem(item: ApprovedCatalogItem): string {
  const url = new URL(productUrlForItem(item));
  if (AI_EXACT_SPEC_VIEW_SKUS.has(item.sku.toUpperCase())) {
    url.searchParams.set("view", "ai-exact-spec-r2");
  }
  return url.toString();
}

function first20ExactSpecItems(): ApprovedCatalogItem[] {
  return FIRST20_EXACT_SPEC_VIEW_SKUS
    .map((sku) => APPROVED_CATALOG_BY_SKU.get(sku.toUpperCase()))
    .filter((item): item is ApprovedCatalogItem => Boolean(item));
}

function first20ExactSpecRoutePayload() {
  return {
    release: "PACKRIFT-FIRST20-EXACT-SPEC-ROUTES-2026-05-17-R02",
    generated_at: new Date().toISOString(),
    status: "controlled_view_route_clean_bare_pdp_cache_gated",
    rule:
      "Use exact_spec_view_url or measured_product_url for controlled agent/QA exact-spec rendering while bare Shopify PDP page_cache variants are inconsistent. Canonical URLs remain the bare product URLs.",
    cache_gate_evidence:
      "first20-pdp-spec-graph-view-route-source-qa-retry-2026-05-17.json passed 20/20. Current slow browser-like recheck first20-pdp-cache-gate-recheck-current-2026-05-17.json passed exact-spec view 20/20 but found only 31/60 fresh bare PDP attempts.",
    products: first20ExactSpecItems().map((item) => {
      const canonicalProductUrl = productUrlForItem(item);
      const exactSpecViewUrl = productHandoffUrlForItem(item);
      return {
        sku: item.sku,
        title: item.title,
        family: item.family || "other",
        canonical_product_url: canonicalProductUrl,
        exact_spec_view_url: exactSpecViewUrl,
        measured_product_url: routeRedirectUrlForItem(item, "product", "first20_exact_spec_routes"),
        measured_reorder_url: routeRedirectUrlForItem(item, "reorder", "first20_exact_spec_routes"),
        measured_quote_url: routeRedirectUrlForItem(item, "quote", "first20_exact_spec_routes"),
        mcp_sku_md: `https://mcp.packrift.com/ai/sku/${encodeURIComponent(item.sku)}.md`,
        mcp_sku_json: `https://mcp.packrift.com/ai/sku/${encodeURIComponent(item.sku)}.json`,
        bare_pdp_status: "shopify_page_cache_not_deterministic_as_of_2026-05-17",
        view_route_status: "qa_passed",
      };
    }),
  };
}

function first20ExactSpecRouteMarkdown(): string {
  const payload = first20ExactSpecRoutePayload();
  const rows = payload.products
    .map(
      (item) =>
        `| ${escapeMarkdown(item.sku)} | ${escapeMarkdown(item.title)} | ${item.exact_spec_view_url} | ${item.measured_product_url} | ${item.mcp_sku_md} |`
    )
    .join("\n");
  return [
    "# Packrift First-20 Exact-Spec PDP Routes",
    "",
    `Release: ${payload.release}`,
    "",
    "## Status",
    "",
    payload.status,
    "",
    "## Rule",
    "",
    payload.rule,
    "",
    "## Evidence",
    "",
    payload.cache_gate_evidence,
    "",
    "## Routes",
    "",
    "| SKU | Product | Exact-spec view URL | Measured product URL | MCP SKU record |",
    "| --- | --- | --- | --- | --- |",
    rows,
    "",
  ].join("\n");
}

function skuPageTrackingForItem(item: ApprovedCatalogItem) {
  return buildTrackingContext({
    source: "mcp_sku_page",
    sku: item.sku,
    handle: item.handle,
    variantId: item.variantId,
    selectedSku: item.sku,
    selectedHandle: item.handle,
    matchType: "ai_sku_page",
    utmTerm: item.sku,
  });
}

function reorderUrlForItem(item: ApprovedCatalogItem): string {
  const url = new URL("https://packrift.com/pages/reorder-packaging-by-sku");
  url.searchParams.set("view", "packrift_ai_reorder_live_r07");
  url.searchParams.set("sku", item.sku);
  url.hash = skuAnchor(item.sku);
  return trackedUrl(url.toString(), { ...skuPageTrackingForItem(item), utm_content: "reorder_click" });
}

function quoteUrlForItem(item: ApprovedCatalogItem): string {
  const url = new URL("https://packrift.com/pages/bulk-quote");
  url.searchParams.set("sku", item.sku);
  url.searchParams.set("spec", item.title);
  url.searchParams.set("product", item.title);
  url.searchParams.set("product_url", productUrlForItem(item));
  return trackedUrl(url.toString(), { ...skuPageTrackingForItem(item), utm_content: "quote_click" });
}

function cartUrlForItem(item: ApprovedCatalogItem, quantity = 1): string {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  return trackedUrl(`https://packrift.com/cart/${encodeURIComponent(item.variantId)}:${safeQuantity}`, {
    ...skuPageTrackingForItem(item),
    source: "create_cart_url",
    utm_source: "chatgpt-mcp",
    utm_medium: "mcp_tool",
    utm_campaign: "create_cart_url",
    utm_content: item.sku,
    match_type: "cart_handoff_candidate",
  });
}

function measuredCartLandingUrlForItem(item: ApprovedCatalogItem, quantity = 1, source = "mcp_cart_handoff_candidates"): string {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const url = new URL(routeRedirectUrlForItem(item, "cart", source));
  url.searchParams.set("qty", String(safeQuantity));
  return url.toString();
}

function cartHandoffForItem(item: ApprovedCatalogItem, quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const measuredCartUrl = measuredCartLandingUrlForItem(item, safeQuantity);
  const finalShopifyCartUrl = cartUrlForItem(item, safeQuantity);
  return {
    status: "candidate_requires_live_confirmation",
    purpose: "Turn this exact AI_APPROVE SKU into a GA4-visible MCP cart handoff after live price and inventory checks.",
    mcp_endpoint: "https://mcp.packrift.com/mcp",
    prompt_name: "prepare_cart_handoff",
    discovery_tool: "get_cart_handoff_candidates",
    create_cart_url_tool: "create_cart_url",
    required_sequence: ["get_product", "get_pricing", "check_inventory", "create_cart_url"],
    required_before_presenting_cart_url: ["exact SKU confirmed", "variant ID confirmed", "live price confirmed", "inventory confirmed", "buyer quantity confirmed"],
    create_cart_url_arguments: {
      items: [{ variant_id: item.variantId, qty: safeQuantity }],
      selected_sku: item.sku,
      selected_handle: item.handle,
      match_type: "cart_handoff_candidate",
      source_context: "exact_spec_ai_agent",
      journey_id: `mcp_${item.sku}_${item.variantId}`,
      result_set_id: "mcp_cart_handoff_candidates",
      utm_term: item.sku,
    },
    create_cart_url_sku_arguments: {
      sku: item.sku,
      quantity: safeQuantity,
      selected_handle: item.handle,
      match_type: "cart_handoff_candidate",
      source_context: "exact_spec_ai_agent",
      journey_id: `mcp_${item.sku}_${item.variantId}`,
      result_set_id: "mcp_cart_handoff_candidates",
      utm_term: item.sku,
    },
    cart_url_candidate: measuredCartUrl,
    cart_url_candidate_type: "mcp_cart_landing_redirect",
    measured_cart_url: measuredCartUrl,
    final_shopify_cart_url_candidate: finalShopifyCartUrl,
    measurement_rule:
      "Present the MCP cart landing URL first. It records the mcp_cart_landing event, then forwards to the final Shopify cart URL with the same MCP attribution and cart attributes.",
    attribution: {
      utm_source: "chatgpt-mcp",
      utm_medium: "mcp_tool",
      utm_campaign: "create_cart_url",
      utm_content: item.sku,
      utm_term: item.sku,
    },
    measured_fallbacks: {
      product: routeRedirectUrlForItem(item, "product"),
      reorder: routeRedirectUrlForItem(item, "reorder"),
      quote: routeRedirectUrlForItem(item, "quote"),
      cart: measuredCartUrl,
    },
    no_match_rule:
      "If the buyer-requested dimensions, material, color, count, SKU, closure, adhesive, printer type, or product family differ, do not create a cart URL; explain no exact match and route to quote recovery.",
  };
}

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function skuRouteItem(sku: string): ApprovedCatalogItem | undefined {
  return APPROVED_CATALOG_BY_SKU.get(decodeURIComponent(sku).toUpperCase());
}

function skuPagePayload(item: ApprovedCatalogItem) {
  const canonicalProductUrl = productUrlForItem(item);
  const tracking = skuPageTrackingForItem(item);
  const directTrackedProductUrl = trackedUrl(productHandoffUrlForItem(item), { ...tracking, utm_content: "product_click" });
  const directReorderUrl = reorderUrlForItem(item);
  const directQuoteUrl = quoteUrlForItem(item);
  const measuredProductUrl = routeRedirectUrlForItem(item, "product");
  const measuredReorderUrl = routeRedirectUrlForItem(item, "reorder");
  const measuredQuoteUrl = routeRedirectUrlForItem(item, "quote");
  const retrievalSafeUrl = `https://mcp.packrift.com/ai/sku/${encodeURIComponent(item.sku)}.md`;
  const retrievalSafeJsonUrl = `https://mcp.packrift.com/ai/sku/${encodeURIComponent(item.sku)}.json`;
  const paidChatgptSignal = PAID_CHATGPT_SKU_SIGNALS[item.sku.toUpperCase()] ?? null;
  const exactMatchRule = "Exact-spec procurement only: do not substitute nearby dimensions, material, color, count, or product family unless the buyer explicitly accepts a substitute. Do not present a nearby product as exact.";
  const mcpCartHandoff = cartHandoffForItem(item, 1);
  return {
    packrift_ai_id: tracking.packrift_ai_id,
    ai_commerce_id: tracking.ai_commerce_id,
    sku: item.sku,
    variant_id: item.variantId,
    product_id: item.productId,
    handle: item.handle,
    title: item.title,
    family: item.family || "other",
    status: "AI_APPROVE",
    next_action: "For checkout handoff, use mcp_cart_handoff.required_sequence and create_cart_url_arguments after live price and inventory confirmation.",
    mcp_cart_handoff: mcpCartHandoff,
    paid_chatgpt_family: paidChatgptSignal,
    ai_commerce_signal: paidChatgptSignal
      ? {
          channel: "paid ChatGPT exact-spec procurement",
          evidence: `Order #${paidChatgptSignal.order}`,
          source: paidChatgptSignal.source,
          attribution: paidChatgptSignal.attribution,
          product_family: paidChatgptSignal.family,
        }
      : null,
    openai_catalog_feed_attribution: paidChatgptSignal?.attribution ?? null,
    exact_match_rule: exactMatchRule,
    canonical_product_url: canonicalProductUrl,
    product_url: measuredProductUrl,
    measured_product_url: measuredProductUrl,
    measured_reorder_url: measuredReorderUrl,
    measured_quote_url: measuredQuoteUrl,
    agent_handoff_url: measuredProductUrl,
    direct_tracked_product_url: directTrackedProductUrl,
    retrieval_safe_url: retrievalSafeUrl,
    retrieval_safe_json_url: retrievalSafeJsonUrl,
    crawler_safe_purchase_fallback:
      "If the Shopify product page fetch is challenged or unavailable to an AI crawler, use this MCP SKU record for exact-spec retrieval, then hand the buyer to the measured product, reorder, or quote URL after live MCP price and inventory confirmation.",
    reorder_url: measuredReorderUrl,
    quote_url: measuredQuoteUrl,
    bulk_quote_url: measuredQuoteUrl,
    direct_reorder_url: directReorderUrl,
    direct_quote_url: directQuoteUrl,
    direct_bulk_quote_url: directQuoteUrl,
    cart_url_template: `https://packrift.com/cart/${item.variantId}:{quantity}`,
    cart_url_qty_1_candidate: mcpCartHandoff.cart_url_candidate,
    measured_cart_url: mcpCartHandoff.measured_cart_url,
    final_shopify_cart_url_qty_1_candidate: mcpCartHandoff.final_shopify_cart_url_candidate,
    cart_confirmation_required: true,
    mcp_endpoint: "https://mcp.packrift.com/mcp",
    recommended_mcp_sequence: ["search_products", "get_product", "get_pricing", "check_inventory", "create_cart_url"],
    no_match_policy: `No-match policy: ${exactMatchRule}`,
    live_confirmation_required: ["price", "inventory", "shipping", "cart"],
    copy_procurement_spec: `SKU ${item.sku}: ${item.title}.`,
    updated_at: new Date().toISOString().slice(0, 10),
  };
}

function skuPageMarkdown(item: ApprovedCatalogItem): string {
  const payload = skuPagePayload(item);
  return [
    `# Packrift SKU ${payload.sku}`,
    "",
    `${payload.title}`,
    "",
    "## Fast Cart Handoff",
    "",
    "For buyer checkout, first confirm the exact SKU, variant, live price, inventory, and buyer-selected quantity through MCP. Then use `create_cart_url` with the arguments below so the landing is stamped as `chatgpt-mcp / mcp_tool / create_cart_url` in GA4.",
    "",
    `- Prompt: \`${payload.mcp_cart_handoff.prompt_name}\``,
    `- Required sequence: ${payload.mcp_cart_handoff.required_sequence.map((step: string) => `\`${step}\``).join(" -> ")}`,
    `- create_cart_url arguments: \`${JSON.stringify(payload.mcp_cart_handoff.create_cart_url_arguments)}\``,
    `- Cart URL candidate after confirmation: ${payload.mcp_cart_handoff.cart_url_candidate}`,
    `- Quote fallback if specs differ: ${payload.mcp_cart_handoff.measured_fallbacks.quote}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| SKU | ${escapeMarkdown(payload.sku)} |`,
    `| Variant ID | ${escapeMarkdown(payload.variant_id)} |`,
    `| Product family | ${escapeMarkdown(payload.family)} |`,
    "| Catalog status | AI_APPROVE |",
    payload.ai_commerce_signal
      ? `| AI-commerce signal | paid ChatGPT exact-spec procurement; ${escapeMarkdown(payload.ai_commerce_signal.evidence)}; ${escapeMarkdown(payload.ai_commerce_signal.attribution)} |`
      : null,
    `| Canonical product URL | ${payload.canonical_product_url} |`,
    `| Agent handoff URL | ${payload.agent_handoff_url} |`,
    `| Measured product URL | ${payload.measured_product_url} |`,
    `| Direct tracked product URL | ${payload.direct_tracked_product_url} |`,
    `| Crawler-safe SKU URL | ${payload.retrieval_safe_url} |`,
    `| Measured reorder URL | ${payload.measured_reorder_url} |`,
    `| Measured bulk quote URL | ${payload.measured_quote_url} |`,
    `| Cart URL candidate | ${payload.cart_url_qty_1_candidate} |`,
    `| Final Shopify cart URL candidate | ${payload.final_shopify_cart_url_qty_1_candidate} |`,
    `| Copy procurement spec | ${escapeMarkdown(payload.copy_procurement_spec)} |`,
    "",
    "## Agent Purchase Handoff",
    "",
    "Use the Packrift MCP server for live product confirmation before sending a buyer to checkout.",
    "",
    "1. Call `search_products` with the SKU or exact product title.",
    "2. Call `get_product` for product facts and variant IDs.",
    "3. Call `get_pricing` and `check_inventory` before cart handoff.",
    "4. Use the measured product, reorder, or quote URL for buyer handoff after live confirmation.",
    "5. Use `create_cart_url` only after live price and inventory confirmation.",
    "6. If a requested spec differs from this product, call `explain_no_exact_match` and route to the measured quote URL.",
    "",
    "## If The Shopify Product Page Is Challenged",
    "",
    "Use this MCP SKU page as the crawler-safe exact-spec record. It is not a replacement for live commercial checks: confirm price, inventory, shipping, and cart eligibility through MCP before presenting checkout or cart actions. Treat the cart URL as a candidate until those checks pass.",
    "",
    `Crawler-safe record: ${payload.retrieval_safe_url}`,
    `Crawler-safe JSON: ${payload.retrieval_safe_json_url}`,
    "",
    payload.ai_commerce_signal
      ? [
          "## Paid ChatGPT / OpenAI Catalog Signal",
          "",
          `This SKU is a known paid ChatGPT exact-spec procurement family from ${payload.ai_commerce_signal.evidence}.`,
          `Attribution path: ${payload.ai_commerce_signal.attribution}.`,
          `Product family: ${payload.ai_commerce_signal.product_family}.`,
          "",
        ].join("\n")
      : null,
    "## Exact-Match Rule",
    "",
    payload.exact_match_rule,
    "",
    "## No-Match Policy",
    "",
    payload.no_match_policy,
    "",
  ].filter((line) => line !== null).join("\n");
}

function purchasePathPayload(item: ApprovedCatalogItem) {
  const payload = skuPagePayload(item);
  return {
    sku: payload.sku,
    product_id: payload.product_id,
    variant_id: payload.variant_id,
    handle: payload.handle,
    title: payload.title,
    family: payload.family,
    status: payload.status,
    next_action: payload.next_action,
    mcp_cart_handoff: payload.mcp_cart_handoff,
    paid_chatgpt_family: payload.paid_chatgpt_family,
    ai_commerce_signal: payload.ai_commerce_signal,
    openai_catalog_feed_attribution: payload.openai_catalog_feed_attribution,
    exact_match_rule: payload.exact_match_rule,
    canonical_product_url: payload.canonical_product_url,
    product_url: payload.product_url,
    measured_product_url: payload.measured_product_url,
    measured_reorder_url: payload.measured_reorder_url,
    measured_quote_url: payload.measured_quote_url,
    agent_handoff_url: payload.agent_handoff_url,
    direct_tracked_product_url: payload.direct_tracked_product_url,
    mcp_sku_md: payload.retrieval_safe_url,
    mcp_sku_json: payload.retrieval_safe_json_url,
    reorder_url: payload.reorder_url,
    quote_url: payload.quote_url,
    direct_reorder_url: payload.direct_reorder_url,
    direct_quote_url: payload.direct_quote_url,
    cart_url_template: payload.cart_url_template,
    cart_url_qty_1_candidate: payload.cart_url_qty_1_candidate,
    measured_cart_url: payload.measured_cart_url,
    final_shopify_cart_url_qty_1_candidate: payload.final_shopify_cart_url_qty_1_candidate,
    cart_confirmation_required: payload.cart_confirmation_required,
    live_confirmation_required: payload.live_confirmation_required,
    mcp_endpoint: payload.mcp_endpoint,
    recommended_mcp_sequence: payload.recommended_mcp_sequence,
    no_match_policy: payload.no_match_policy,
    copy_procurement_spec: payload.copy_procurement_spec,
    updated_at: payload.updated_at,
  };
}

function purchasePathsJsonl(): string {
  return `${topAiSalesSkuItems().map((item) => JSON.stringify(purchasePathPayload(item))).join("\n")}\n`;
}

function measuredHandoffItem(item: ApprovedCatalogItem) {
  const payload = skuPagePayload(item);
  return {
    sku: payload.sku,
    title: payload.title,
    family: payload.family,
    status: payload.status,
    mcp_cart_handoff: payload.mcp_cart_handoff,
    canonical_product_url: payload.canonical_product_url,
    mcp_sku_md: payload.retrieval_safe_url,
    mcp_sku_json: payload.retrieval_safe_json_url,
    measured_product_url: routeRedirectUrlForItem(item, "product", "measured_handoff_directory"),
    measured_reorder_url: routeRedirectUrlForItem(item, "reorder", "measured_handoff_directory"),
    measured_quote_url: routeRedirectUrlForItem(item, "quote", "measured_handoff_directory"),
    measured_cart_url: routeRedirectUrlForItem(item, "cart", "measured_handoff_directory"),
    final_shopify_cart_url_candidate: payload.final_shopify_cart_url_qty_1_candidate,
    cart_confirmation_required: true,
    live_confirmation_required: payload.live_confirmation_required,
    copy_procurement_spec: payload.copy_procurement_spec,
    no_match_policy: payload.no_match_policy,
    updated_at: payload.updated_at,
  };
}

function measuredHandoffDirectoryPayload(limit = 250) {
  return {
    release: "PACKRIFT-MEASURED-HANDOFF-DIRECTORY-R02",
    generated_at: new Date().toISOString(),
    source: "measured_handoff_directory",
    status: "live_mcp_controlled_directory",
    purpose:
      "Give AI agents and crawlers a compact MCP-hosted purchase handoff directory that avoids Shopify page-cache dependence while preserving exact-match and live-confirmation rules.",
    rule:
      "Use only AI_APPROVE products. Confirm live price, inventory, shipping, and cart eligibility through MCP before presenting checkout or cart actions. If the requested spec differs, return no exact match and route to quote recovery.",
    telemetry_watch_url: "https://mcp.packrift.com/ai/conversion-route-telemetry-watch.json",
    route_catalog_url: "https://mcp.packrift.com/ai/conversion-route-catalog.json",
    purchase_paths_url: "https://mcp.packrift.com/ai/purchase-paths.jsonl",
    no_match_policy:
      "Do not substitute nearby dimensions, material, color, count, printer type, closure, adhesive, strength rating, or SKU as an exact match.",
    items: topAiSalesSkuItems(limit).map((item) => measuredHandoffItem(item)),
  };
}

function measuredHandoffDirectoryMarkdown(limit = 75): string {
  const payload = measuredHandoffDirectoryPayload(limit);
  const rows = payload.items
    .map(
      (item) =>
        `| ${escapeMarkdown(item.sku)} | ${escapeMarkdown(item.title)} | ${escapeMarkdown(item.family)} | ${item.mcp_sku_md} | ${item.measured_product_url} | ${item.measured_reorder_url} | ${item.measured_quote_url} | ${item.measured_cart_url} |`
    )
    .join("\n");
  return [
    "# Packrift Measured Handoff Directory",
    "",
    `Release: ${payload.release}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Rule",
    "",
    payload.rule,
    "",
    "## Telemetry",
    "",
    `Route signal watch: ${payload.telemetry_watch_url}`,
    "",
    "## Priority Exact-Spec Handoffs",
    "",
    "| SKU | Product | Family | MCP SKU record | Measured product | Measured reorder | Measured quote | Measured cart |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    rows,
    "",
    "## No-Match Policy",
    "",
    payload.no_match_policy,
    "",
  ].join("\n");
}

function csvField(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function measuredHandoffDirectoryCsv(limit = 250): string {
  const rows = measuredHandoffDirectoryPayload(limit).items.map((item) =>
    [
      item.sku,
      item.title,
      item.family,
      item.status,
      item.canonical_product_url,
      item.mcp_sku_md,
      item.mcp_sku_json,
      item.measured_product_url,
      item.measured_reorder_url,
      item.measured_quote_url,
      item.measured_cart_url,
      item.final_shopify_cart_url_candidate,
      item.copy_procurement_spec,
    ].map(csvField).join(",")
  );
  return [
    [
      "sku",
      "title",
      "family",
      "status",
      "canonical_product_url",
      "mcp_sku_md",
      "mcp_sku_json",
      "measured_product_url",
      "measured_reorder_url",
      "measured_quote_url",
      "measured_cart_url",
      "final_shopify_cart_url_candidate",
      "copy_procurement_spec",
    ].join(","),
    ...rows,
    "",
  ].join("\n");
}

function cartHandoffCandidateItem(item: ApprovedCatalogItem, quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const payload = skuPagePayload(item);
  return {
    sku: item.sku,
    title: item.title,
    family: item.family || "other",
    variant_id: item.variantId,
    quantity: safeQuantity,
    status: "AI_APPROVE",
    live_confirmation_required: payload.mcp_cart_handoff.required_sequence.slice(0, 3),
    cart_confirmation_required: true,
    mcp_endpoint: payload.mcp_cart_handoff.mcp_endpoint,
    prompt_name: payload.mcp_cart_handoff.prompt_name,
    create_cart_url_tool: payload.mcp_cart_handoff.create_cart_url_tool,
    create_cart_url_arguments: payload.mcp_cart_handoff.create_cart_url_arguments,
    create_cart_url_sku_arguments: payload.mcp_cart_handoff.create_cart_url_sku_arguments,
    cart_url_qty_1_candidate: payload.mcp_cart_handoff.cart_url_candidate,
    cart_url_candidate_type: payload.mcp_cart_handoff.cart_url_candidate_type,
    final_shopify_cart_url_candidate: payload.mcp_cart_handoff.final_shopify_cart_url_candidate,
    mcp_sku_md: payload.retrieval_safe_url,
    mcp_sku_json: payload.retrieval_safe_json_url,
    measured_product_url: payload.measured_product_url,
    measured_reorder_url: payload.measured_reorder_url,
    measured_quote_url: payload.measured_quote_url,
    measured_cart_url: payload.mcp_cart_handoff.measured_fallbacks.cart,
    no_match_policy: payload.no_match_policy,
  };
}

function cartHandoffCandidatesPayload(limit = 50) {
  return {
    release: "PACKRIFT-MCP-CART-HANDOFF-CANDIDATES-R03",
    generated_at: new Date().toISOString(),
    source: "mcp_cart_handoff_candidates",
    purpose:
      "Give AI agents a compact exact-spec path from MCP product retrieval to a GA4-visible cart handoff while preserving live price and inventory confirmation.",
    attribution_rule:
      "Cart candidates point to the MCP cart landing shim first, then forward to Shopify with utm_source=chatgpt-mcp, utm_medium=mcp_tool, and utm_campaign=create_cart_url so GA4 can isolate MCP-driven cart landings.",
    safety_rule:
      "Do not present a cart handoff until get_product, get_pricing, and check_inventory confirm the exact SKU, variant, live price, and inventory. If any requested spec differs, use the measured quote URL instead.",
    mcp_sequence: ["search_products", "get_product", "get_pricing", "check_inventory", "create_cart_url"],
    items: topAiSalesSkuItems(limit).map((item) => cartHandoffCandidateItem(item, 1)),
  };
}

function cartHandoffCandidatesMarkdown(limit = 25): string {
  const payload = cartHandoffCandidatesPayload(limit);
  const rows = payload.items
    .map(
      (item) =>
        `| ${escapeMarkdown(item.sku)} | ${escapeMarkdown(item.title)} | ${escapeMarkdown(item.family)} | ${item.mcp_sku_md} | ${item.cart_url_qty_1_candidate} | ${item.final_shopify_cart_url_candidate} |`
    )
    .join("\n");
  return [
    "# Packrift MCP Cart Handoff Candidates",
    "",
    `Release: ${payload.release}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Attribution Rule",
    "",
    payload.attribution_rule,
    "",
    "## Safety Rule",
    "",
    payload.safety_rule,
    "",
    "## Required MCP Sequence",
    "",
    payload.mcp_sequence.map((step, index) => `${index + 1}. \`${step}\``).join("\n"),
    "",
    "After live confirmation, agents may call `create_cart_url` with `create_cart_url_sku_arguments` from the JSON payload. Variant-ID arguments remain available for hosts that require explicit cart line items.",
    "",
    "## Priority Cart Candidates",
    "",
    "| SKU | Product | Family | MCP SKU record | MCP cart landing candidate | Final Shopify cart URL |",
    "| --- | --- | --- | --- | --- | --- |",
    rows,
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    "",
  ].join("\n");
}

function crawlerSafePurchasePathsMarkdown(): string {
  const examples = topAiSalesSkuItems(25)
    .map((item) => {
      const payload = skuPagePayload(item);
      return [
        `| ${escapeMarkdown(item.sku)} | ${escapeMarkdown(item.title)} | ${payload.retrieval_safe_url} | ${routeRedirectUrlForItem(item, "product")} | ${routeRedirectUrlForItem(item, "reorder")} | ${routeRedirectUrlForItem(item, "quote")} |`,
      ].join("");
    })
    .join("\n");

  return [
    "# Packrift Crawler-Safe Purchase Paths",
    "",
    "Use this guide when a buyer or AI agent needs a Packrift exact-spec product but a direct Shopify product-page fetch is challenged, blocked, slow, or unavailable.",
    "",
    "## Rule",
    "",
    "Do not treat a crawler-safe MCP record as live checkout confirmation. Use it for exact-spec retrieval and continuity, then confirm price, inventory, shipping, and cart eligibility through the Packrift MCP server before presenting a cart or checkout handoff.",
    "",
    "## Fallback Sequence",
    "",
    "1. Search the Packrift MCP catalog by SKU or exact spec.",
    "2. Read the SKU record at `https://mcp.packrift.com/ai/sku/{SKU}.md` or `.json`.",
    "3. Confirm the SKU is `AI_APPROVE` and that required dimensions, material, color, count, family, and SKU match the buyer request.",
    "4. Call `get_pricing` and `check_inventory` for current commercial facts.",
    "5. Hand off to the tracked product URL, reorder URL, bulk quote URL, or a cart URL created through MCP.",
    "6. If any required field differs, return no exact match and use the quote URL instead of suggesting a nearby product as exact.",
    "",
    "## Core Endpoints",
    "",
    "- MCP endpoint: https://mcp.packrift.com/mcp",
    "- AI purchase paths JSONL: https://mcp.packrift.com/ai/purchase-paths.jsonl",
    "- Measured route redirect sitemap: https://mcp.packrift.com/ai/conversion-route-redirect-sitemap.xml",
    "- Measured conversion route catalog: https://mcp.packrift.com/ai/conversion-route-catalog.json",
    "- All AI-approved SKU sitemap: https://mcp.packrift.com/ai/all-ai-approved-sku-sitemap.xml",
    "- Top 1,000 AI-sales SKU sitemap: https://mcp.packrift.com/ai/top-1000-ai-sales-sitemap.xml",
    "- AI-approved product corpus: https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl",
    "- Reorder guide: https://mcp.packrift.com/ai/reorder-by-sku.md",
    "- No-match policy: https://mcp.packrift.com/ai/no-match-policy.md",
    "",
    "## Priority SKU Examples",
    "",
    "| SKU | Product | Crawler-safe record | Product handoff | Reorder handoff | Quote handoff |",
    "| --- | --- | --- | --- | --- | --- |",
    examples,
    "",
  ].join("\n");
}

function routeRedirectSitemapXml(limit = AI_SALES_SKU_ROUTE_LIMIT): string {
  const now = new Date().toISOString().slice(0, 10);
  const urls = topAiSalesSkuItems(limit).flatMap((item) =>
    (["product", "reorder", "quote"] as const).map(
      (action) =>
        `  <url><loc>${escapeXml(routeRedirectUrlForItem(item, action))}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq></url>`
    )
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

function topAiSalesSkuSitemapXml(): string {
  const now = new Date().toISOString().slice(0, 10);
  const urls = topAiSalesSkuItems().map((item) => {
    const sku = encodeURIComponent(item.sku);
    return [
      `  <url><loc>https://mcp.packrift.com/ai/sku/${escapeXml(sku)}.md</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq></url>`,
      `  <url><loc>https://mcp.packrift.com/ai/sku/${escapeXml(sku)}.json</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq></url>`,
    ].join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

function allAiApprovedSkuSitemapXml(): string {
  const now = new Date().toISOString().slice(0, 10);
  const urls = [...APPROVED_CATALOG]
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((item) => {
      const sku = encodeURIComponent(item.sku);
      return [
        `  <url><loc>https://mcp.packrift.com/ai/sku/${escapeXml(sku)}.md</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq></url>`,
        `  <url><loc>https://mcp.packrift.com/ai/sku/${escapeXml(sku)}.json</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq></url>`,
      ].join("\n");
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

function robotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Sitemap: https://mcp.packrift.com/sitemap.xml",
    "Sitemap: https://mcp.packrift.com/ai/sitemap.xml",
    "Sitemap: https://mcp.packrift.com/ai/top-1000-ai-sales-sitemap.xml",
    "Sitemap: https://mcp.packrift.com/ai/all-ai-approved-sku-sitemap.xml",
    "Sitemap: https://mcp.packrift.com/ai/conversion-route-redirect-sitemap.xml",
    `Sitemap: ${MCP_SOURCE_ACTIVATION_SITEMAP_URL}`,
    "",
  ].join("\n");
}

function faviconSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    '<rect width="64" height="64" rx="12" fill="#111827"/>',
    '<path d="M18 18h19c7.2 0 12 4.7 12 11.5S44.2 41 37 41h-8v11H18V18Zm11 9v5.5h7.2c1.8 0 2.9-1 2.9-2.8s-1.1-2.7-2.9-2.7H29Z" fill="#f9fafb"/>',
    '<path d="M18 52h31v-7H29v-4H18v11Z" fill="#22c55e"/>',
    "</svg>",
  ].join("");
}

app.get("/llms.txt", (c) => cachedStaticTextResponse(c, "llms.txt", llmsTxt, "text/plain; charset=utf-8"));

app.get("/llms-full.txt", (c) =>
  cachedStaticTextResponse(c, "llms-full.txt", llmsFullTxt, "text/plain; charset=utf-8")
);

app.get("/.well-known/mcp/server-card.json", (c) =>
  cachedStaticTextResponse(
    c,
    "server-card.json",
    JSON.stringify(mcpServerCardPayload(), null, 2),
    "application/json; charset=utf-8"
  )
);

app.get("/.well-known/mcp.json", async (c) => {
  const config = mcpClientConfigPayload(clientConfigRuntime()).config;
  await recordGeneratedAiResourceFetch(c, "/.well-known/mcp.json", "mcp_client_config", jsonByteSize(config));
  return cachedStaticTextResponse(
    c,
    "mcp.json",
    JSON.stringify(config, null, 2),
    "application/json; charset=utf-8"
  );
});

function glamaConnectorClaim() {
  return {
    $schema: "https://glama.ai/mcp/schemas/connector.json",
    maintainers: [{ email: "farhan@packrift.com" }],
  };
}

app.get("/.well-known/glama.json", (c) =>
  cachedStaticTextResponse(
    c,
    "glama.json",
    JSON.stringify(glamaConnectorClaim(), null, 2),
    "application/json; charset=utf-8"
  )
);

app.get("/.well-known/mcp-marketplace.json", (c) =>
  cachedStaticTextResponse(
    c,
    "mcp-marketplace.json",
    JSON.stringify(mcpMarketplaceDiscoveryPayload(), null, 2),
    "application/json; charset=utf-8"
  )
);

app.get("/agents.md", (c) =>
  cachedStaticTextResponse(c, "agents.md", agentInstructionsMd, "text/markdown; charset=utf-8")
);

app.get("/5050e763abb8dafdc736a5971e107171.txt", (c) => {
  const indexnowKey = c.env.INDEXNOW_ROOT_KEY;
  if (!indexnowKey) {
    return c.text("IndexNow key is not configured.", 500);
  }
  return c.text(indexnowKey, 200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=300",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Packrift-IndexNow-Key": "root-direct-worker",
  });
});

// Convenience aliases — some crawlers look for the file at the apex too.
app.get("/server-card.json", (c) =>
  cachedStaticTextResponse(
    c,
    "server-card.json",
    JSON.stringify(mcpServerCardPayload(), null, 2),
    "application/json; charset=utf-8"
  )
);

app.get("/mcp.json", async (c) => {
  const config = mcpClientConfigPayload(clientConfigRuntime()).config;
  await recordGeneratedAiResourceFetch(c, "/mcp.json", "mcp_client_config", jsonByteSize(config));
  return cachedStaticTextResponse(
    c,
    "mcp.json",
    JSON.stringify(config, null, 2),
    "application/json; charset=utf-8"
  );
});

app.get("/robots.txt", (c) =>
  c.body(robotsTxt(), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/favicon.ico", (c) =>
  c.body(faviconSvg(), 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/sitemap.xml", (c) =>
  c.body(aiSitemapXml(), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/sitemap.xml", (c) =>
  c.body(aiSitemapXml(), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/top-1000-ai-sales-sitemap.xml", (c) =>
  c.body(topAiSalesSkuSitemapXml(), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/all-ai-approved-sku-sitemap.xml", (c) =>
  c.body(allAiApprovedSkuSitemapXml(), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/conversion-route-redirect-sitemap.xml", (c) =>
  c.body(routeRedirectSitemapXml(), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/mcp-source-activation-sitemap.xml", (c) =>
  c.body(sourceActivationSitemapXml(), 200, {
    "Content-Type": "application/xml; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/packrift-ai-agent-instructions.md", (c) =>
  c.body(agentInstructionsMd, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/crawler-safe-purchase-paths.md", (c) =>
  c.body(crawlerSafePurchasePathsMarkdown(), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/mcp-start.json", async (c) => {
  const payload = mcpStartPayload(mcpStartRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-start.json", "mcp_start", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-start.md", async (c) => {
  const body = mcpStartMarkdown(mcpStartRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-start.md", "mcp_start", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-start.html", async (c) => mcpStartHtmlResponse(c));

app.get("/SKILL.md", async (c) => {
  const body = browserbaseBrowseSkillMd(browserbaseBrowseSkillPackRuntime());
  await recordGeneratedAiResourceFetch(c, "/SKILL.md", "browserbase_browse_skill_pack", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/all-agent-capture.json", async (c) => {
  const payload = allAgentCapturePayload(agentCaptureRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/all-agent-capture.json", "all_agent_capture", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/all-agent-capture.md", async (c) => {
  const body = allAgentCaptureMarkdown(agentCaptureRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/all-agent-capture.md", "all_agent_capture", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-adoption-kit.json", async (c) => {
  const payload = mcpAdoptionKitPayload(adoptionKitRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-adoption-kit.json", "mcp_adoption_kit", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-adoption-kit.md", async (c) => {
  const body = mcpAdoptionKitMarkdown(adoptionKitRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-adoption-kit.md", "mcp_adoption_kit", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-install-matrix.json", async (c) => {
  const payload = mcpInstallMatrixPayload(installMatrixRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-install-matrix.json", "mcp_install_matrix", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-install-matrix.md", async (c) => {
  const body = mcpInstallMatrixMarkdown(installMatrixRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-install-matrix.md", "mcp_install_matrix", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-install-actions.json", async (c) => {
  const payload = mcpInstallActionsPayload(installActionRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-install-actions.json", "mcp_install_actions", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-install-actions.md", async (c) => {
  const body = mcpInstallActionsMarkdown(installActionRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-install-actions.md", "mcp_install_actions", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-first-run-actions.json", async (c) => {
  const payload = mcpFirstRunActionsPayload(firstRunActionRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-first-run-actions.json", "mcp_first_run_actions", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-first-run-actions.md", async (c) => {
  const body = mcpFirstRunActionsMarkdown(firstRunActionRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-first-run-actions.md", "mcp_first_run_actions", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-client-config.json", async (c) => {
  const payload = mcpClientConfigPayload(clientConfigRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-client-config.json", "mcp_client_config", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-client-config.md", async (c) => {
  const body = mcpClientConfigMarkdown(clientConfigRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-client-config.md", "mcp_client_config", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-usage-snapshot.json", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "1000", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(1000, requestedLimit)) : 1000;
  const payload = await mcpUsageSnapshotPayload(c.env, date, limit);
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-usage-snapshot.json", "mcp_usage_snapshot", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-usage-snapshot.md", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "1000", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(1000, requestedLimit)) : 1000;
  const body = mcpUsageSnapshotMarkdown(await mcpUsageSnapshotPayload(c.env, date, limit));
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-usage-snapshot.md", "mcp_usage_snapshot", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-funnel-snapshot.json", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "5000", 10);
  const requestedOrderDays = Number.parseInt(url.searchParams.get("order_days") ?? "90", 10);
  const requestedOrderLimit = Number.parseInt(url.searchParams.get("order_limit") ?? "250", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
  const orderDays = Number.isFinite(requestedOrderDays) ? Math.max(1, Math.min(365, requestedOrderDays)) : 90;
  const orderLimit = Number.isFinite(requestedOrderLimit) ? Math.max(1, Math.min(500, requestedOrderLimit)) : 250;
  const payload = await mcpFunnelSnapshotPayload(c.env, date, limit, orderDays, orderLimit);
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-funnel-snapshot.json", "mcp_funnel_snapshot", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-funnel-snapshot.md", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "5000", 10);
  const requestedOrderDays = Number.parseInt(url.searchParams.get("order_days") ?? "90", 10);
  const requestedOrderLimit = Number.parseInt(url.searchParams.get("order_limit") ?? "250", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
  const orderDays = Number.isFinite(requestedOrderDays) ? Math.max(1, Math.min(365, requestedOrderDays)) : 90;
  const orderLimit = Number.isFinite(requestedOrderLimit) ? Math.max(1, Math.min(500, requestedOrderLimit)) : 250;
  const body = mcpFunnelSnapshotMarkdown(await mcpFunnelSnapshotPayload(c.env, date, limit, orderDays, orderLimit));
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-funnel-snapshot.md", "mcp_funnel_snapshot", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-ga4-funnel-proof.json", async (c) => {
  const payload = await mcpGa4FunnelProofPayload(c.env);
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-ga4-funnel-proof.json", "mcp_ga4_funnel_proof", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-ga4-funnel-proof.md", async (c) => {
  const body = mcpGa4FunnelProofMarkdown(await mcpGa4FunnelProofPayload(c.env));
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-ga4-funnel-proof.md", "mcp_ga4_funnel_proof", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-source-activation-queue.json", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "5000", 10);
  const requestedOrderDays = Number.parseInt(url.searchParams.get("order_days") ?? "90", 10);
  const requestedOrderLimit = Number.parseInt(url.searchParams.get("order_limit") ?? "250", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
  const orderDays = Number.isFinite(requestedOrderDays) ? Math.max(1, Math.min(365, requestedOrderDays)) : 90;
  const orderLimit = Number.isFinite(requestedOrderLimit) ? Math.max(1, Math.min(500, requestedOrderLimit)) : 250;
  const payload = await mcpSourceActivationQueuePayload(c.env, date, limit, orderDays, orderLimit);
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-source-activation-queue.json", "mcp_source_activation_queue", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-source-activation-queue.md", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "5000", 10);
  const requestedOrderDays = Number.parseInt(url.searchParams.get("order_days") ?? "90", 10);
  const requestedOrderLimit = Number.parseInt(url.searchParams.get("order_limit") ?? "250", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
  const orderDays = Number.isFinite(requestedOrderDays) ? Math.max(1, Math.min(365, requestedOrderDays)) : 90;
  const orderLimit = Number.isFinite(requestedOrderLimit) ? Math.max(1, Math.min(500, requestedOrderLimit)) : 250;
  const body = mcpSourceActivationQueueMarkdown(await mcpSourceActivationQueuePayload(c.env, date, limit, orderDays, orderLimit));
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-source-activation-queue.md", "mcp_source_activation_queue", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-source-activation-queue.html", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "5000", 10);
  const requestedOrderDays = Number.parseInt(url.searchParams.get("order_days") ?? "90", 10);
  const requestedOrderLimit = Number.parseInt(url.searchParams.get("order_limit") ?? "250", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
  const orderDays = Number.isFinite(requestedOrderDays) ? Math.max(1, Math.min(365, requestedOrderDays)) : 90;
  const orderLimit = Number.isFinite(requestedOrderLimit) ? Math.max(1, Math.min(500, requestedOrderLimit)) : 250;
  const body = mcpSourceActivationQueueHtml(await mcpSourceActivationQueuePayload(c.env, date, limit, orderDays, orderLimit));
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-source-activation-queue.html", "mcp_source_activation_queue", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/html; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-activation-experiments.json", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "5000", 10);
  const requestedOrderDays = Number.parseInt(url.searchParams.get("order_days") ?? "90", 10);
  const requestedOrderLimit = Number.parseInt(url.searchParams.get("order_limit") ?? "250", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
  const orderDays = Number.isFinite(requestedOrderDays) ? Math.max(1, Math.min(365, requestedOrderDays)) : 90;
  const orderLimit = Number.isFinite(requestedOrderLimit) ? Math.max(1, Math.min(500, requestedOrderLimit)) : 250;
  const payload = await mcpActivationExperimentsPayload(c.env, date, limit, orderDays, orderLimit);
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-activation-experiments.json", "mcp_activation_experiments", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-activation-experiments.md", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "5000", 10);
  const requestedOrderDays = Number.parseInt(url.searchParams.get("order_days") ?? "90", 10);
  const requestedOrderLimit = Number.parseInt(url.searchParams.get("order_limit") ?? "250", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
  const orderDays = Number.isFinite(requestedOrderDays) ? Math.max(1, Math.min(365, requestedOrderDays)) : 90;
  const orderLimit = Number.isFinite(requestedOrderLimit) ? Math.max(1, Math.min(500, requestedOrderLimit)) : 250;
  const body = mcpActivationExperimentsMarkdown(await mcpActivationExperimentsPayload(c.env, date, limit, orderDays, orderLimit));
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-activation-experiments.md", "mcp_activation_experiments", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-activation-experiments.html", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "5000", 10);
  const requestedOrderDays = Number.parseInt(url.searchParams.get("order_days") ?? "90", 10);
  const requestedOrderLimit = Number.parseInt(url.searchParams.get("order_limit") ?? "250", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
  const orderDays = Number.isFinite(requestedOrderDays) ? Math.max(1, Math.min(365, requestedOrderDays)) : 90;
  const orderLimit = Number.isFinite(requestedOrderLimit) ? Math.max(1, Math.min(500, requestedOrderLimit)) : 250;
  const body = mcpActivationExperimentsHtml(await mcpActivationExperimentsPayload(c.env, date, limit, orderDays, orderLimit));
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-activation-experiments.html", "mcp_activation_experiments", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/html; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-buyer-use-cases.json", async (c) => {
  const payload = mcpBuyerUseCasesPayload(buyerUseCasesRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-buyer-use-cases.json", "mcp_buyer_use_cases", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-buyer-use-cases.md", async (c) => {
  const body = mcpBuyerUseCasesMarkdown(buyerUseCasesRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-buyer-use-cases.md", "mcp_buyer_use_cases", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-cart-activation.json", async (c) => {
  const payload = mcpCartActivationPayload(cartActivationRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-cart-activation.json", "mcp_cart_activation", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-cart-activation.md", async (c) => {
  const body = mcpCartActivationMarkdown(cartActivationRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-cart-activation.md", "mcp_cart_activation", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-first-run-proof.json", async (c) => {
  const demo = await firstRunProofDemo(c.env);
  const payload = mcpFirstRunProofPayload(firstRunProofRuntime(), demo);
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-first-run-proof.json", "mcp_first_run_proof", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-first-run-proof.md", async (c) => {
  const demo = await firstRunProofDemo(c.env);
  const body = mcpFirstRunProofMarkdown(firstRunProofRuntime(), demo);
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-first-run-proof.md", "mcp_first_run_proof", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-workflow-gallery.json", async (c) => {
  const payload = mcpWorkflowGalleryPayload(workflowGalleryRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-workflow-gallery.json", "mcp_workflow_gallery", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-workflow-gallery.md", async (c) => {
  const body = mcpWorkflowGalleryMarkdown(workflowGalleryRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-workflow-gallery.md", "mcp_workflow_gallery", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/browser-agent-bridge.json", async (c) => {
  const payload = browserAgentBridgePayload(browserAgentBridgeRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/browser-agent-bridge.json", "browser_agent_bridge", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/browser-agent-bridge.md", async (c) => {
  const body = browserAgentBridgeMarkdown(browserAgentBridgeRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/browser-agent-bridge.md", "browser_agent_bridge", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/browserbase-browse-skill-pack.json", async (c) => {
  const payload = browserbaseBrowseSkillPackPayload(browserbaseBrowseSkillPackRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/browserbase-browse-skill-pack.json", "browserbase_browse_skill_pack", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/browserbase-browse-skill-pack.md", async (c) => {
  const body = browserbaseBrowseSkillPackMarkdown(browserbaseBrowseSkillPackRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/browserbase-browse-skill-pack.md", "browserbase_browse_skill_pack", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/browserbase-browse/SKILL.md", async (c) => {
  const body = browserbaseBrowseSkillMd(browserbaseBrowseSkillPackRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/browserbase-browse/SKILL.md", "browserbase_browse_skill_pack", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-directory-refresh.json", async (c) => {
  const payload = mcpDirectoryRefreshPayload(directoryRefreshRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-directory-refresh.json", "mcp_directory_refresh", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-directory-refresh.md", async (c) => {
  const body = mcpDirectoryRefreshMarkdown(directoryRefreshRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-directory-refresh.md", "mcp_directory_refresh", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-directory-submit-actions.json", async (c) => {
  const payload = mcpDirectorySubmitActionsPayload(directorySubmitActionsRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-directory-submit-actions.json", "mcp_directory_submit_actions", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-directory-submit-actions.md", async (c) => {
  const body = mcpDirectorySubmitActionsMarkdown(directorySubmitActionsRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-directory-submit-actions.md", "mcp_directory_submit_actions", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-directory-update/*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  const match = pathname.match(/^\/ai\/mcp-directory-update\/([a-z0-9_]{2,64})\.(json|md)$/);
  if (!match) {
    return c.json({ error: "not_found", message: "Use /ai/mcp-directory-update/{source}.json or .md." }, 404, RAW_HEADERS);
  }
  const source = match[1] ?? "";
  const format = match[2] ?? "json";
  const runtime = directorySubmitActionsRuntime();
  const payload = mcpDirectorySubmitActionPayload(runtime, source);
  if (!payload) {
    return c.json({ error: "unknown_directory_update_source", source }, 404, RAW_HEADERS);
  }
  if (format === "json") {
    await recordGeneratedAiResourceFetch(c, `/ai/mcp-directory-update/${source}.json`, "mcp_directory_update_card", jsonByteSize(payload));
    return c.json(payload, 200, RAW_HEADERS);
  }
  const body = mcpDirectorySubmitActionMarkdown(runtime, source) ?? "";
  await recordGeneratedAiResourceFetch(c, `/ai/mcp-directory-update/${source}.md`, "mcp_directory_update_card", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-reviewer-activation.json", async (c) => {
  const source = new URL(c.req.url).searchParams.get("source") ?? "generic";
  const payload = mcpReviewerActivationPayload(reviewerActivationRuntime(), source);
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-reviewer-activation.json", "mcp_reviewer_activation", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-reviewer-activation.md", async (c) => {
  const source = new URL(c.req.url).searchParams.get("source") ?? "generic";
  const body = mcpReviewerActivationMarkdown(reviewerActivationRuntime(), source);
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-reviewer-activation.md", "mcp_reviewer_activation", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/claude-connector-submission.json", async (c) => {
  const payload = claudeConnectorSubmissionPayload(claudeConnectorSubmissionRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/claude-connector-submission.json", "claude_connector_submission", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/claude-connector-submission.md", async (c) => {
  const body = claudeConnectorSubmissionMarkdown(claudeConnectorSubmissionRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/claude-connector-submission.md", "claude_connector_submission", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/agent-capture-outreach.json", async (c) => {
  const payload = agentCaptureOutreachPayload(agentCaptureOutreachRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/agent-capture-outreach.json", "agent_capture_outreach", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/agent-capture-outreach.md", async (c) => {
  const body = agentCaptureOutreachMarkdown(agentCaptureOutreachRuntime());
  await recordGeneratedAiResourceFetch(c, "/ai/agent-capture-outreach.md", "agent_capture_outreach", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/mcp-cart-handoff-candidates.json", async (c) => {
  const payload = cartHandoffCandidatesPayload();
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-cart-handoff-candidates.json", "mcp_cart_handoff_candidates", jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/ai/mcp-cart-handoff-candidates.md", async (c) => {
  const body = cartHandoffCandidatesMarkdown();
  await recordGeneratedAiResourceFetch(c, "/ai/mcp-cart-handoff-candidates.md", "mcp_cart_handoff_candidates", jsonByteSize(body));
  return c.body(body, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/measured-handoffs.json", (c) =>
  c.json(measuredHandoffDirectoryPayload(), 200, RAW_HEADERS)
);

app.get("/ai/measured-handoffs.md", (c) =>
  c.body(measuredHandoffDirectoryMarkdown(), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/measured-handoffs.csv", (c) =>
  c.body(measuredHandoffDirectoryCsv(), 200, {
    "Content-Type": "text/csv; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/first20-exact-spec-routes.json", (c) =>
  c.json(first20ExactSpecRoutePayload(), 200, RAW_HEADERS)
);

app.get("/ai/first20-exact-spec-routes.md", (c) =>
  c.body(first20ExactSpecRouteMarkdown(), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  })
);

app.get("/ai/purchase-paths.jsonl", (c) =>
  c.body(purchasePathsJsonl(), 200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    ...PURCHASE_PATHS_HEADERS,
  })
);

app.get("/health", async (c) => {
  const url = new URL(c.req.url);
  if (url.hostname === "packrift.com" || url.hostname === "www.packrift.com") {
    return storefrontPassThrough(c.req.raw, c.env);
  }
  const payload = await mcpHealthPayload(c.env);
  return c.json(
    payload,
    payload.ok ? 200 : 503,
    { ...RAW_HEADERS, "Cache-Control": "no-store" }
  );
});

app.get("/manifest", (c) => {
  const url = new URL(c.req.url);
  if (url.hostname === "packrift.com" || url.hostname === "www.packrift.com") {
    return storefrontPassThrough(c.req.raw, c.env);
  }
  return c.json(
    mcpManifestPayload(),
    200,
    RAW_HEADERS
  );
});

app.get("/resources", (c) => {
  const url = new URL(c.req.url);
  if (url.hostname === "packrift.com" || url.hostname === "www.packrift.com") {
    return storefrontPassThrough(c.req.raw, c.env);
  }
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(500, requestedLimit)) : 100;
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("cursor") ?? "0", 10) || 0);
  return c.json(
    mcpResourcesPayload(limit, offset),
    200,
    RAW_HEADERS
  );
});

app.get("/pages/mcp-cart/:sku", async (c) => {
  const requestUrl = new URL(c.req.url);
  if (requestUrl.hostname !== "packrift.com") {
    requestUrl.protocol = "https:";
    requestUrl.hostname = "packrift.com";
    return c.redirect(requestUrl.toString(), 302);
  }

  const item = skuRouteItem(c.req.param("sku"));
  if (!item) {
    return c.json(
      {
        error: "sku_not_ai_approved",
        message: "This cart landing only works for Packrift AI_APPROVE public MCP catalog SKUs.",
        sku: decodeURIComponent(c.req.param("sku") ?? ""),
      },
      404,
      { ...RAW_HEADERS, "Cache-Control": "no-store" }
    );
  }

  await recordRouteRedirectTelemetry(c.env, c.req.raw, requestUrl, "cart", item);
  return cartLandingResponse(requestUrl, item);
});

app.get("/products/:identifier", async (c) => {
  const url = new URL(c.req.url);
  if (url.hostname === "packrift.com" || url.hostname === "www.packrift.com") {
    return storefrontPassThrough(c.req.raw, c.env);
  }
  const identifier = c.req.param("identifier");
  const item = catalogItemByHandleOrSku(identifier);
  if (!item) {
    return c.json(
      {
        error: "product_not_ai_approved",
        message: "Use an AI_APPROVE Packrift product handle or SKU.",
        identifier: normalizeProductIdentifier(identifier),
      },
      404,
      RAW_HEADERS
    );
  }

  const userAgent = c.req.header("User-Agent") ?? "";
  const botFamily = classifyAgentFamily(userAgent);
  if (shouldRecordSkuPageViewTelemetry(c.env, userAgent, botFamily)) {
    await recordAiSalesEvent(c.env, {
      event: "sku_page_view",
      source: "mcp_rest_product",
      sku: item.sku,
      handle: item.handle,
      family: item.family || "other",
      bot_family: botFamily,
      format: "json",
      page_url: c.req.url,
      referrer: c.req.header("Referer") ?? "",
    });
  }

  try {
    const product = await getProductHandler(c.env, { handle: item.handle });
    return c.json(
      {
        next_action: "For checkout handoff, use mcp_cart_handoff.required_sequence and create_cart_url_arguments after live price and inventory confirmation.",
        mcp_cart_handoff: cartHandoffForItem(item, 1),
        mcp_sku_record: `https://mcp.packrift.com/ai/sku/${encodeURIComponent(item.sku)}.json`,
        mcp_sku_markdown: `https://mcp.packrift.com/ai/sku/${encodeURIComponent(item.sku)}.md`,
        mcp_cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
        ...(product && typeof product === "object" ? product : { product }),
      },
      200,
      RAW_HEADERS
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        error: "product_lookup_failed",
        message: msg,
        identifier: normalizeProductIdentifier(identifier),
        sku: item.sku,
        handle: item.handle,
      },
      502,
      { ...RAW_HEADERS, "Cache-Control": "no-store" }
    );
  }
});

app.get("/ai/sku/*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  const match = pathname.match(/^\/ai\/sku\/([^/]+)\.(md|json)$/);
  if (!match) {
    return c.json({ error: "not_found", message: "Use /ai/sku/{SKU}.md or /ai/sku/{SKU}.json." }, 404, RAW_HEADERS);
  }

  const requestedSku = match[1] ?? "";
  const format = match[2] ?? "md";
  const item = skuRouteItem(requestedSku);
  if (!item) {
    return c.json(
      {
        error: "sku_not_ai_approved",
        message: "This SKU is not present in Packrift's AI_APPROVE public MCP catalog.",
        sku: decodeURIComponent(requestedSku),
      },
      404,
      RAW_HEADERS
    );
  }

  const userAgent = c.req.header("User-Agent") ?? "";
  const botFamily = classifyAgentFamily(userAgent);
  const requestUrl = new URL(c.req.url);
  if (shouldRecordSkuPageViewTelemetry(c.env, userAgent, botFamily)) {
    await recordAiSalesEvent(c.env, {
      event: "sku_page_view",
      source: `mcp_sku_page_${format}`,
      sku: item.sku,
      handle: item.handle,
      family: item.family || "other",
      bot_family: botFamily,
      format,
      packrift_ai_id: safeEventText(requestUrl.searchParams.get("packrift_ai_id"), 160),
      ai_commerce_id: safeEventText(requestUrl.searchParams.get("ai_commerce_id") ?? requestUrl.searchParams.get("packrift_ai_id"), 160),
      mcp_key: safeEventText(requestUrl.searchParams.get("mcp_key"), 120),
      mcp_journey: safeEventText(requestUrl.searchParams.get("mcp_journey"), 160),
      mcp_result_set: safeEventText(requestUrl.searchParams.get("mcp_result_set"), 160),
      page_url: c.req.url,
      referrer: c.req.header("Referer") ?? "",
    });
  }

  if (format === "json") {
    return c.json(skuPagePayload(item), 200, RAW_HEADERS);
  }

  return c.body(skuPageMarkdown(item), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  });
});

app.get("/ai/*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname === "/ai/purchase-paths.jsonl") {
    return c.body(purchasePathsJsonl(), 200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      ...PURCHASE_PATHS_HEADERS,
    });
  }

  const route = AI_CORPUS_ROUTES[pathname];
  if (!route) {
    return c.json({ error: "not_found", message: "Unknown Packrift AI corpus file." }, 404, RAW_HEADERS);
  }

  const body = await c.env.CATALOG_CACHE.get(route.key, "text");
  if (!aiCorpusBodyIsLoaded(route, body)) {
    return c.json(
      {
        error: "corpus_not_loaded",
        message: "Packrift AI corpus file is not loaded in the Cloudflare KV namespace yet.",
        key: route.key,
      },
      503,
      RAW_HEADERS
    );
  }

  const userAgent = c.req.header("User-Agent") ?? "";
  const botFamily = classifyAgentFamily(userAgent);
  const routeSurface = conversionRouteTelemetrySurface(pathname);
  if (routeSurface && shouldRecordConversionRouteResourceTelemetry(c.env, userAgent)) {
    const format = pathname.split(".").pop() ?? "";
    const day = compactDate();
    const id = `${routeSurface}_${day}_resource_fetch_${format}`;
    await recordAiSalesEvent(c.env, {
      event: "ai_corpus_click",
      source: routeSurface,
      corpus_url: `https://mcp.packrift.com${pathname}`,
      format,
      bot_family: botFamily,
      packrift_ai_id: id,
      ai_commerce_id: id,
      mcp_key: routeSurface,
      mcp_journey: `${routeSurface}:resource_fetch:${format}`,
      mcp_result_set: `${routeSurface}_${day}`,
      utm_source: routeSurface,
      utm_medium: "ai_retrieval",
      utm_campaign: `packrift_${routeSurface}_${campaignDate()}`,
      utm_content: `resource_fetch_${format}`,
      page_url: c.req.url,
      source_url: `https://mcp.packrift.com${pathname}`,
      referrer: c.req.header("Referer") ?? "",
    });
  } else if (shouldRecordSkuPageViewTelemetry(c.env, userAgent, botFamily)) {
    await recordAiSalesEvent(c.env, {
      event: "ai_corpus_click",
      source: "mcp_ai_corpus",
      corpus_url: `https://mcp.packrift.com${pathname}`,
      format: pathname.split(".").pop() ?? "",
      bot_family: botFamily,
      page_url: c.req.url,
      referrer: c.req.header("Referer") ?? "",
    });
  }

  return c.body(body ?? "", 200, {
    "Content-Type": route.contentType,
    ...RAW_HEADERS,
  });
});

app.get("/r/start/:source", async (c) => {
  const requestUrl = new URL(c.req.url);
  const rawSource = decodeURIComponent(c.req.param("source") ?? "").trim();
  const source = rawSource.toLowerCase();
  if (!MCP_START_SOURCE_PATTERN.test(source)) {
    return c.json(
      {
        error: "invalid_mcp_start_source",
        message: "Use /r/start/{source} with a lowercase source slug containing only letters, numbers, and underscores.",
        valid_format: MCP_START_SOURCE_POLICY.accepted_source_format,
        partner_specific_sources_allowed: MCP_START_SOURCE_POLICY.partner_specific_sources_allowed,
        recommended_sources: MCP_START_SOURCE_POLICY.recommended_sources,
        custom_examples: MCP_START_SOURCE_POLICY.custom_examples,
      },
      404,
      RAW_HEADERS
    );
  }

  const targetUrl = mcpStartRedirectTargetUrl(source, requestUrl);
  await recordMcpStartRedirectTelemetry(c.env, c.req.raw, requestUrl, source, targetUrl);
  return c.redirect(targetUrl.toString(), 302);
});

app.get("/r/config/:source", async (c) => {
  const requestUrl = new URL(c.req.url);
  const rawSource = decodeURIComponent(c.req.param("source") ?? "").trim();
  const source = rawSource.toLowerCase();
  if (!MCP_START_SOURCE_PATTERN.test(source)) {
    return c.json(
      {
        error: "invalid_mcp_config_source",
        message: "Use /r/config/{source} with a lowercase source slug containing only letters, numbers, and underscores.",
        valid_format: MCP_START_SOURCE_POLICY.accepted_source_format,
        partner_specific_sources_allowed: MCP_START_SOURCE_POLICY.partner_specific_sources_allowed,
        recommended_sources: MCP_START_SOURCE_POLICY.recommended_sources,
        custom_examples: MCP_START_SOURCE_POLICY.custom_examples,
      },
      404,
      RAW_HEADERS
    );
  }

  const config = sourceAwareMcpJson(source);
  await recordGeneratedAiResourceFetch(c, `/r/config/${source}`, "mcp_client_config", jsonByteSize(config), {
    sourceSlug: source,
    utmMedium: requestUrl.searchParams.get("utm_medium") || "directory_config",
    utmCampaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_install",
    utmContent: requestUrl.searchParams.get("utm_content") || "tracked_client_config",
    mcpKeyPrefix: "config",
  });
  return c.json(config, 200, RAW_HEADERS);
});

app.get("/r/install/:source/:target", async (c) => {
  const requestUrl = new URL(c.req.url);
  const rawSource = decodeURIComponent(c.req.param("source") ?? "").trim();
  const rawTarget = decodeURIComponent(c.req.param("target") ?? "").trim();
  const source = rawSource.toLowerCase();
  const target = normalizeInstallTarget(rawTarget);
  if (!MCP_START_SOURCE_PATTERN.test(source)) {
    return c.json(
      {
        error: "invalid_mcp_install_source",
        message: "Use /r/install/{source}/{target} with a lowercase source slug containing only letters, numbers, and underscores.",
        valid_format: MCP_START_SOURCE_POLICY.accepted_source_format,
        partner_specific_sources_allowed: MCP_START_SOURCE_POLICY.partner_specific_sources_allowed,
        recommended_sources: MCP_START_SOURCE_POLICY.recommended_sources,
        custom_examples: MCP_START_SOURCE_POLICY.custom_examples,
      },
      404,
      RAW_HEADERS
    );
  }
  if (!target) {
    return c.json(
      {
        error: "invalid_mcp_install_target",
        message: "Use a supported install target.",
        valid_targets: mcpInstallActionsPayload(installActionRuntime()).targets.map((row) => row.id),
        template: "https://mcp.packrift.com/r/install/{source}/{target}",
      },
      404,
      RAW_HEADERS
    );
  }

  const payload = mcpInstallActionPayload({ source, target: target.id });
  if (!payload) {
    return c.json({ error: "invalid_mcp_install_target" }, 404, RAW_HEADERS);
  }

  const format = (requestUrl.searchParams.get("format") ?? "").toLowerCase();
  const accept = c.req.header("Accept") ?? "";
  const wantsHtml = format === "html" || (!format && accept.toLowerCase().includes("text/html") && !wantsJson(accept));
  if (wantsHtml) {
    const body = mcpInstallActionHtml(payload);
    await recordMcpInstallIntentTelemetry(c.env, c.req.raw, requestUrl, source, payload.target.id, jsonByteSize(body));
    return c.body(body, 200, {
      "Content-Type": "text/html; charset=utf-8",
      ...RAW_HEADERS,
    });
  }
  if (format === "text" || format === "txt") {
    const body = `${payload.copy_text}\n`;
    await recordMcpInstallIntentTelemetry(c.env, c.req.raw, requestUrl, source, payload.target.id, jsonByteSize(body));
    return c.body(body, 200, {
      "Content-Type": "text/plain; charset=utf-8",
      ...RAW_HEADERS,
    });
  }
  if (format === "md" || format === "markdown") {
    const body = mcpInstallActionMarkdown(payload);
    await recordMcpInstallIntentTelemetry(c.env, c.req.raw, requestUrl, source, payload.target.id, jsonByteSize(body));
    return c.body(body, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      ...RAW_HEADERS,
    });
  }
  await recordMcpInstallIntentTelemetry(c.env, c.req.raw, requestUrl, source, payload.target.id, jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/r/install/:source", (c) =>
  c.json(
    {
      error: "invalid_mcp_install_target",
      message: "Use /r/install/{source}/{target}; target is required.",
      valid_targets: mcpInstallActionsPayload(installActionRuntime()).targets.map((row) => row.id),
      template: "https://mcp.packrift.com/r/install/{source}/{target}",
    },
    404,
    RAW_HEADERS
  )
);

app.get("/r/run/:source/:target", async (c) => {
  const requestUrl = new URL(c.req.url);
  const rawSource = decodeURIComponent(c.req.param("source") ?? "").trim();
  const rawTarget = decodeURIComponent(c.req.param("target") ?? "").trim();
  const source = rawSource.toLowerCase();
  const target = normalizeInstallTarget(rawTarget);
  if (!MCP_START_SOURCE_PATTERN.test(source)) {
    return c.json(
      {
        error: "invalid_mcp_first_run_source",
        message: "Use /r/run/{source}/{target} with a lowercase source slug containing only letters, numbers, and underscores.",
        valid_format: MCP_START_SOURCE_POLICY.accepted_source_format,
        partner_specific_sources_allowed: MCP_START_SOURCE_POLICY.partner_specific_sources_allowed,
        recommended_sources: MCP_START_SOURCE_POLICY.recommended_sources,
        custom_examples: MCP_START_SOURCE_POLICY.custom_examples,
      },
      404,
      RAW_HEADERS
    );
  }
  if (!target) {
    return c.json(
      {
        error: "invalid_mcp_first_run_target",
        message: "Use a supported install target.",
        valid_targets: mcpFirstRunActionsPayload(firstRunActionRuntime()).targets.map((row) => row.id),
        template: "https://mcp.packrift.com/r/run/{source}/{target}",
      },
      404,
      RAW_HEADERS
    );
  }

  const payload = mcpFirstRunActionPayload({ source, target: target.id });
  const format = (requestUrl.searchParams.get("format") ?? "").toLowerCase();
  const accept = c.req.header("Accept") ?? "";
  const wantsHtml = format === "html" || (!format && accept.toLowerCase().includes("text/html") && !wantsJson(accept));
  const shouldExecute = requestUrl.searchParams.get("execute") === "1" || format === "result";
  if (shouldExecute) {
    const execution = await firstRunActionExecutionDemo(c.env, c.req.raw, requestUrl, source, payload.target);
    if (format === "json" || wantsJson(accept)) {
      return c.json(execution, String(execution.status ?? "") === "ok" ? 200 : 502, {
        ...RAW_HEADERS,
        "Cache-Control": "no-store, max-age=0",
      });
    }
    return c.body(mcpFirstRunActionHtml(payload, execution), String(execution.status ?? "") === "ok" ? 200 : 502, {
      "Content-Type": "text/html; charset=utf-8",
      ...RAW_HEADERS,
      "Cache-Control": "no-store, max-age=0",
    });
  }
  if (wantsHtml) {
    const body = mcpFirstRunActionHtml(payload);
    await recordMcpFirstRunIntentTelemetry(c.env, c.req.raw, requestUrl, source, payload.target, jsonByteSize(body));
    return c.body(body, 200, {
      "Content-Type": "text/html; charset=utf-8",
      ...RAW_HEADERS,
    });
  }
  if (format === "sh" || format === "shell") {
    const body = `${payload.first_useful_run.curl_script}\n`;
    await recordMcpFirstRunIntentTelemetry(c.env, c.req.raw, requestUrl, source, payload.target, jsonByteSize(body));
    return c.body(body, 200, {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      ...RAW_HEADERS,
    });
  }
  if (format === "md" || format === "markdown") {
    const body = mcpFirstRunActionMarkdown(payload);
    await recordMcpFirstRunIntentTelemetry(c.env, c.req.raw, requestUrl, source, payload.target, jsonByteSize(body));
    return c.body(body, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      ...RAW_HEADERS,
    });
  }
  await recordMcpFirstRunIntentTelemetry(c.env, c.req.raw, requestUrl, source, payload.target, jsonByteSize(payload));
  return c.json(payload, 200, RAW_HEADERS);
});

app.get("/r/run/:source", (c) =>
  c.json(
    {
      error: "invalid_mcp_first_run_target",
      message: "Use /r/run/{source}/{target}; target is required.",
      valid_targets: mcpFirstRunActionsPayload(firstRunActionRuntime()).targets.map((row) => row.id),
      template: "https://mcp.packrift.com/r/run/{source}/{target}",
    },
    404,
    RAW_HEADERS
  )
);

app.get("/r/activate", async (c) => {
  const requestUrl = new URL(c.req.url);
  const date = normalizeAiSalesDate(requestUrl.searchParams.get("date"));
  const requestedLimit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "5000", 10);
  const requestedOrderDays = Number.parseInt(requestUrl.searchParams.get("order_days") ?? "90", 10);
  const requestedOrderLimit = Number.parseInt(requestUrl.searchParams.get("order_limit") ?? "250", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
  const orderDays = Number.isFinite(requestedOrderDays) ? Math.max(1, Math.min(365, requestedOrderDays)) : 90;
  const orderLimit = Number.isFinite(requestedOrderLimit) ? Math.max(1, Math.min(500, requestedOrderLimit)) : 250;
  const payload = await mcpSourceActivationQueuePayload(c.env, date, limit, orderDays, orderLimit);
  const format = (requestUrl.searchParams.get("format") ?? "").toLowerCase();
  const accept = c.req.header("Accept") ?? "";
  const wantsHtml = format === "html" || (!format && accept.toLowerCase().includes("text/html") && !wantsJson(accept));
  if (format === "json" || wantsJson(accept)) {
    await recordGeneratedAiResourceFetch(c, "/r/activate", "mcp_source_activation_queue", jsonByteSize(payload), {
      utmMedium: requestUrl.searchParams.get("utm_medium") || "activation_command_center",
      utmCampaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_activation",
      utmContent: requestUrl.searchParams.get("utm_content") || "source_queue_json",
      mcpKeyPrefix: "activation_queue",
    });
    return c.json(payload, 200, RAW_HEADERS);
  }
  if (format === "md" || format === "markdown") {
    const body = mcpSourceActivationQueueMarkdown(payload);
    await recordGeneratedAiResourceFetch(c, "/r/activate", "mcp_source_activation_queue", jsonByteSize(body), {
      utmMedium: requestUrl.searchParams.get("utm_medium") || "activation_command_center",
      utmCampaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_activation",
      utmContent: requestUrl.searchParams.get("utm_content") || "source_queue_markdown",
      mcpKeyPrefix: "activation_queue",
    });
    return c.body(body, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      ...RAW_HEADERS,
    });
  }
  if (wantsHtml || !format) {
    const body = mcpSourceActivationQueueHtml(payload);
    await recordGeneratedAiResourceFetch(c, "/r/activate", "mcp_source_activation_queue", jsonByteSize(body), {
      utmMedium: requestUrl.searchParams.get("utm_medium") || "activation_command_center",
      utmCampaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_activation",
      utmContent: requestUrl.searchParams.get("utm_content") || "source_queue_html",
      mcpKeyPrefix: "activation_queue",
    });
    return c.body(body, 200, {
      "Content-Type": "text/html; charset=utf-8",
      ...RAW_HEADERS,
      Link: "<https://mcp.packrift.com/r/activate>; rel=\"canonical\"",
    });
  }
  return c.json(
    {
      error: "invalid_mcp_activation_format",
      message: "Use /r/activate, /r/activate?format=json, /r/activate?format=md, or /r/activate/{source}.",
      valid_formats: ["html", "json", "md"],
    },
    404,
    RAW_HEADERS
  );
});

app.get("/r/activate/:source", async (c) => {
  const requestUrl = new URL(c.req.url);
  const rawSource = decodeURIComponent(c.req.param("source") ?? "").trim();
  const source = rawSource.toLowerCase();
  if (!MCP_START_SOURCE_PATTERN.test(source)) {
    return c.json(
      {
        error: "invalid_mcp_reviewer_activation_source",
        message: "Use /r/activate/{source} with a lowercase source slug containing only letters, numbers, and underscores.",
        valid_format: MCP_START_SOURCE_POLICY.accepted_source_format,
        partner_specific_sources_allowed: MCP_START_SOURCE_POLICY.partner_specific_sources_allowed,
        recommended_sources: MCP_START_SOURCE_POLICY.recommended_sources,
        custom_examples: MCP_START_SOURCE_POLICY.custom_examples,
        template: "https://mcp.packrift.com/r/activate/{source}",
      },
      404,
      RAW_HEADERS
    );
  }

  const format = (requestUrl.searchParams.get("format") ?? "").toLowerCase();
  const accept = c.req.header("Accept") ?? "";
  const wantsHtml = format === "html" || (!format && accept.toLowerCase().includes("text/html") && !wantsJson(accept));
  if (format === "md" || format === "markdown") {
    const body = mcpReviewerActivationMarkdown(reviewerActivationRuntime(), source);
    await recordGeneratedAiResourceFetch(c, `/r/activate/${source}`, "mcp_reviewer_activation", jsonByteSize(body), {
      sourceSlug: source,
      utmMedium: requestUrl.searchParams.get("utm_medium") || "reviewer_activation",
      utmCampaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_activation",
      utmContent: requestUrl.searchParams.get("utm_content") || "real_mcp_client_run",
      mcpKeyPrefix: "activation",
    });
    return c.body(body, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      ...RAW_HEADERS,
    });
  }
  if (wantsHtml) {
    const body = mcpReviewerActivationHtml(reviewerActivationRuntime(), source);
    await recordGeneratedAiResourceFetch(c, `/r/activate/${source}`, "mcp_reviewer_activation", jsonByteSize(body), {
      sourceSlug: source,
      utmMedium: requestUrl.searchParams.get("utm_medium") || "reviewer_activation",
      utmCampaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_activation",
      utmContent: requestUrl.searchParams.get("utm_content") || "real_mcp_client_run",
      mcpKeyPrefix: "activation",
    });
    return c.body(body, 200, {
      "Content-Type": "text/html; charset=utf-8",
      ...RAW_HEADERS,
      Link: `<${trackedReviewerActivationUrl(source)}>; rel="canonical"`,
    });
  }

  const payload = mcpReviewerActivationPayload(reviewerActivationRuntime(), source);
  await recordGeneratedAiResourceFetch(c, `/r/activate/${source}`, "mcp_reviewer_activation", jsonByteSize(payload), {
    sourceSlug: source,
    utmMedium: requestUrl.searchParams.get("utm_medium") || "reviewer_activation",
    utmCampaign: requestUrl.searchParams.get("utm_campaign") || "packrift_mcp_activation",
    utmContent: requestUrl.searchParams.get("utm_content") || "real_mcp_client_run",
    mcpKeyPrefix: "activation",
  });
  return c.json(payload, 200, {
    ...RAW_HEADERS,
    Link: `<${trackedReviewerActivationUrl(source)}>; rel="canonical"`,
  });
});

app.get("/r/*", async (c) => {
  const requestUrl = new URL(c.req.url);
  const match = requestUrl.pathname.match(/^\/r\/(product|reorder|quote|cart)\/([^/]+)$/);
  if (!match) {
    return c.json(
      {
        error: "not_found",
        message: "Use /r/product/{SKU}, /r/reorder/{SKU}, /r/quote/{SKU}, /r/cart/{SKU}, /r/install/{source}/{target}, /r/run/{source}/{target}, or /r/activate/{source}.",
      },
      404,
      RAW_HEADERS
    );
  }

  const action = match[1] as RouteRedirectAction;
  const sku = match[2] ?? "";
  const item = skuRouteItem(sku);
  if (!item) {
    return c.json(
      {
        error: "sku_not_ai_approved",
        message: "This redirect only works for Packrift AI_APPROVE public MCP catalog SKUs.",
        sku: decodeURIComponent(sku),
      },
      404,
      RAW_HEADERS
    );
  }

  await recordRouteRedirectTelemetry(c.env, c.req.raw, requestUrl, action, item);
  if (action === "cart") {
    return cartLandingResponse(requestUrl, item);
  }
  const target = routeRedirectTargetUrl(action, item, requestUrl);
  return c.redirect(target.toString(), 302);
});

app.options("/events/ai-sales", (c) => c.body(null, 204, aiSalesCorsHeaders(c.req.header("Origin"))));

app.post("/events/ai-sales", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400, aiSalesCorsHeaders(c.req.header("Origin")));
  }
  const normalized = normalizeAiSalesEvent(
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {},
    c.req.raw
  );
  if (!normalized) {
    return c.json({ ok: false, error: "unsupported_event" }, 400, aiSalesCorsHeaders(c.req.header("Origin")));
  }
  const date = normalized.received_at.slice(0, 10);
  const key = `${AI_SALES_EVENT_PREFIX}/${date}/${normalized.received_at}-${crypto.randomUUID()}.json`;
  await c.env.CATALOG_CACHE.put(key, JSON.stringify(normalized), { expirationTtl: AI_SALES_EVENT_TTL_SECONDS });
  return c.json(
    {
      ok: true,
      key,
      event: normalized.event,
      sku: normalized.sku || null,
      received_at: normalized.received_at,
    },
    202,
    aiSalesCorsHeaders(c.req.header("Origin"))
  );
});

app.options("/events/ai-sales/summary", (c) => c.body(null, 204, aiSalesCorsHeaders(c.req.header("Origin"))));

app.get("/events/ai-sales/dashboard", (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  return c.body(aiSalesDashboardHtml(date), 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.get("/events/ai-sales/summary", async (c) => {
  const url = new URL(c.req.url);
  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "1000", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(1000, requestedLimit)) : 1000;
  const prefix = `${AI_SALES_EVENT_PREFIX}/${date}/`;
  const events = await readAiSalesEvents(c.env, date, limit);
  return c.json(
    {
      ok: true,
      date,
      prefix,
      limit,
      ...summarizeAiSalesEvents(events),
    },
    200,
    aiSalesCorsHeaders(c.req.header("Origin"))
  );
});

app.get("/admin/mcp-orders", async (c) => {
  const url = new URL(c.req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!c.env.MCP_STATS_TOKEN) {
    return c.json({ ok: false, error: "stats_token_not_configured" }, 503, { "Cache-Control": "no-store" });
  }
  if (token !== c.env.MCP_STATS_TOKEN) {
    return c.json({ ok: false, error: "unauthorized" }, 401, { "Cache-Control": "no-store" });
  }
  if (!c.env.SHOPIFY_PACKRIFT_TOKEN) {
    return c.json({ ok: false, error: "shopify_token_not_configured" }, 503, { "Cache-Control": "no-store" });
  }

  const requestedDays = Number.parseInt(url.searchParams.get("days") ?? "90", 10);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "250", 10);
  const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(365, requestedDays)) : 90;
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(500, requestedLimit)) : 250;
  try {
    return c.json(await shopifyMcpOrderAttributionPayload(c.env, days, limit), 200, { "Cache-Control": "no-store" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { ok: false, release: MCP_ORDER_ATTRIBUTION_RELEASE, error: safeEventText(message, 500) },
      502,
      { "Cache-Control": "no-store" }
    );
  }
});

app.get("/admin/mcp-stats", async (c) => {
  const url = new URL(c.req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!c.env.MCP_STATS_TOKEN) {
    return c.json({ ok: false, error: "stats_token_not_configured" }, 503, { "Cache-Control": "no-store" });
  }
  if (token !== c.env.MCP_STATS_TOKEN) {
    return c.json({ ok: false, error: "unauthorized" }, 401, { "Cache-Control": "no-store" });
  }

  const date = normalizeAiSalesDate(url.searchParams.get("date"));
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "1000", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 1000;
  const events = await readAiSalesEvents(c.env, date, limit);
  const toolEvents = events.filter((event) => String(event.event ?? "") === "mcp_tool_call");
  return c.json(
    {
      ok: true,
      admin_schema_release: MCP_DISCOVERY_TELEMETRY_RELEASE,
      date,
      limit,
      total_tool_calls: toolEvents.length,
      ...summarizeAiSalesEvents(events),
    },
    200,
    { "Cache-Control": "no-store" }
  );
});

// MCP endpoint — Streamable HTTP transport.
// POST: client sends a JSON-RPC request or batch; server replies once. We do not
// stream SSE here because none of the tools need server-initiated events.
// GET: clients may open an SSE stream for server->client notifications. We hold
// it open with no events; this keeps interop with clients that probe GET first.
app.post("/mcp", async (c) => {
  const env = c.env;
  const requestUrl = new URL(c.req.url);
  const userAgent = c.req.header("User-Agent") ?? "";
  const continuity = mcpSourceContinuityFromUrl(requestUrl, userAgent);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(rpcError(null, -32700, "Parse error"), 400);
  }

  // Generate / echo session id per MCP transport guidance.
  const sessionId = c.req.header("Mcp-Session-Id") ?? crypto.randomUUID();

  const respond = (payload: unknown, status: number = 200) => {
    const r = new Response(JSON.stringify(payload), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Mcp-Session-Id": sessionId,
        "Access-Control-Allow-Origin": "*",
      },
    });
    return r;
  };

  const rpcContext = { sessionId, userAgent, ...continuity };

  if (Array.isArray(body)) {
    const results = await Promise.all(body.map((req) => handleRpc(env, req as JsonRpcRequest, rpcContext)));
    const filtered = results.filter((r) => r !== null);
    if (filtered.length === 0) return new Response(null, { status: 202, headers: { "Mcp-Session-Id": sessionId } });
    return respond(filtered);
  }

  const result = await handleRpc(env, body as JsonRpcRequest, rpcContext);
  if (result === null) {
    return new Response(null, { status: 202, headers: { "Mcp-Session-Id": sessionId } });
  }
  return respond(result);
});

app.get("/mcp", (c) => {
  // Minimal SSE stream. We don't push anything because nothing is async.
  const sessionId = c.req.header("Mcp-Session-Id") ?? crypto.randomUUID();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": ready\n\n"));
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Mcp-Session-Id": sessionId,
      "Access-Control-Allow-Origin": "*",
    },
  });
});

app.get("/sse", (c) => {
  const sessionId = c.req.header("Mcp-Session-Id") ?? crypto.randomUUID();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": ready\n\n"));
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Mcp-Session-Id": sessionId,
      "Access-Control-Allow-Origin": "*",
    },
  });
});

app.options("/mcp", (c) =>
  c.body(null, 204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id",
  })
);

app.notFound((c) => {
  const url = new URL(c.req.url);

  if (url.hostname === "packrift.com" || url.hostname === "www.packrift.com") {
    if (url.pathname.startsWith("/products/") && url.searchParams.get("_packrift_worker_probe") === "1") {
      return c.json(
        {
          ok: true,
          release: "PACKRIFT-PRODUCT-WORKER-PROBE-2026-05-17-R01",
          pathname: url.pathname,
          paid_pdp: Boolean(PAID_PDP_EXACT_SPEC_CARDS[url.pathname]),
          exact_spec_pdp: Boolean(PDP_EXACT_SPEC_CARDS[url.pathname]),
        },
        200,
        {
          ...RAW_HEADERS,
          "Cache-Control": "no-store",
          "x-packrift-product-worker-probe": "PACKRIFT-PRODUCT-WORKER-PROBE-2026-05-17-R01",
        }
      );
    }
    const indexnowKey = c.env.INDEXNOW_ROOT_KEY;
    if (indexnowKey && url.pathname === `/${indexnowKey}.txt`) {
      return c.text(indexnowKey, 200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Packrift-IndexNow-Key": "root-direct-worker",
      });
    }
    if (url.pathname === "/pages/bulk-packaging-quote") {
      url.pathname = "/pages/bulk-quote";
      return c.redirect(url.toString(), 301);
    }
    return storefrontPassThrough(c.req.raw, c.env);
  }

  return c.json({ error: "not_found", message: "Unknown Packrift MCP endpoint." }, 404, RAW_HEADERS);
});

export default app;
