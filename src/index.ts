import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "./shopify.js";
import { serverCard } from "./server-card.js";
import { llmsTxt } from "./llms-content.js";
import { llmsFullTxt } from "./llms-full-content.js";
import { agentInstructionsMd } from "./agent-instructions-content.js";
import { APPROVED_CATALOG, type ApprovedCatalogItem } from "./approved-catalog.js";
import { PURCHASE_READY_SKUS } from "./purchase-ready-skus.js";

import { searchProductsSchema, searchProductsHandler } from "./tools/search_products.js";
import { getProductSchema, getProductHandler } from "./tools/get_product.js";
import { getPricingSchema, getPricingHandler } from "./tools/get_pricing.js";
import { checkInventorySchema, checkInventoryHandler } from "./tools/check_inventory.js";
import { recommendPackagingSchema, recommendPackagingHandler } from "./tools/recommend_packaging.js";
import { getShippingEstimateSchema, getShippingEstimateHandler } from "./tools/get_shipping_estimate.js";
import { createCartUrlSchema, createCartUrlHandler } from "./tools/create_cart_url.js";
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
      "Reorder Packrift SKU {{sku}}. Use search_products with the SKU, then get_product, get_pricing, and check_inventory. Return the product URL, reorder URL, copy-procurement-spec text, and cart URL only after live commercial facts are confirmed.",
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
}

type RouteRedirectAction = "product" | "reorder" | "quote" | "cart";

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
        ? "For a selected item, call get_product, get_pricing, and check_inventory. After the buyer confirms exact SKU and quantity, pass create_cart_url_arguments to create_cart_url."
        : "No priority cart handoff candidate matched this filter. Use search_products for the exact spec, or get_bulk_quote_link when no exact approved match exists.",
  };
}

async function handleRpc(env: Env, req: JsonRpcRequest, context: RpcExecutionContext = {}): Promise<unknown | null> {
  const { method, params, id } = req;
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
            "Packrift finds the right packaging supply for a given item. All product discovery, product detail, price, inventory, shipping, reorder, quote, and cart handoff tools are AI_APPROVE-gated where a product SKU is involved. Hero use case: the user has an item's dimensions (or a use case like 'mailer' / 'fragile') and needs the smallest box, mailer, or container that fits — call find_packaging_for_item. Use search_products only when the user names a specific product type and dimensions are unknown. Use get_cart_handoff_candidates to discover priority AI-approved SKUs with ready create_cart_url arguments for agentic cart exploration. After picking a SKU, use get_product for full detail, get_pricing/check_inventory for live confirmation, get_reorder_link or get_bulk_quote_link for procurement handoff, get_shipping_estimate for rates, then create_cart_url to hand off to checkout (always carries ?ref=mcp). If no exact match exists, call explain_no_exact_match.",
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
          sessionId: context.sessionId,
          userAgent: context.userAgent,
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
        const startedAt = Date.now();
        try {
          const out = await tool.handler(env, args);
          if (!isSyntheticToolCall(args)) {
            await recordAiSalesEvent(
              env,
              buildMcpToolCallEvent(name, out, {
                latencyMs: Date.now() - startedAt,
                resultSizeBytes: jsonByteSize(out),
                sessionId: context.sessionId,
                userAgent: context.userAgent,
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
          if (!isSyntheticToolCall(args)) {
            await recordAiSalesEvent(
              env,
              buildMcpToolCallEvent(name, { error: msg }, {
                latencyMs: Date.now() - startedAt,
                resultSizeBytes: jsonByteSize({ error: msg }),
                sessionId: context.sessionId,
                userAgent: context.userAgent,
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
          sessionId: context.sessionId,
          userAgent: context.userAgent,
          ok: true,
        });
        return rpcResult(id, { resources: MCP_RESOURCES });

      case "resources/templates/list":
        await recordMcpDiscoveryEvent(env, "mcp_resource_templates_list", {
          mcpMethod: method,
          resultCount: MCP_RESOURCE_TEMPLATES.length,
          resultSizeBytes: jsonByteSize(MCP_RESOURCE_TEMPLATES),
          sessionId: context.sessionId,
          userAgent: context.userAgent,
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
            sessionId: context.sessionId,
            userAgent: context.userAgent,
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
          sessionId: context.sessionId,
          userAgent: context.userAgent,
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
          sessionId: context.sessionId,
          userAgent: context.userAgent,
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
            sessionId: context.sessionId,
            userAgent: context.userAgent,
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
            sessionId: context.sessionId,
            userAgent: context.userAgent,
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
          sessionId: context.sessionId,
          userAgent: context.userAgent,
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

app.get("/", (c) => c.json({ status: "ok", server: serverCard.name, version: serverCard.version }));

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
const STATIC_CACHE_TTL_SECONDS = 300;
const STATIC_CACHE_MIRROR_PREFIX = "static:";
const STATIC_CACHE_OVERRIDE_PREFIX = "static-override:";

const PDP_PROCUREMENT_RELEASE = "PACKRIFT-PDP-PROCUREMENT-HANDOFF-2026-05-17-R04";
const PAID_SKU_NOTE_REPAIR_RELEASE = "PACKRIFT-PAID-SKU-NOTE-REPAIR-2026-05-13-R01";
const PDP_EXACT_SPEC_CARD_EDGE_RELEASE = "PACKRIFT-PDP-EXACT-SPEC-CARD-EDGE-RETIRED-2026-05-17-R02";
const OWNED_PAGE_PRODUCT_LINKS_RELEASE = "PACKRIFT-OWNED-PAGE-PRODUCT-LINKS-2026-05-16-R02";
const REORDER_PAGE_FEATURED_RELEASE = "PACKRIFT-REORDER-PAGE-TOP1000-2026-05-16-R03";
const AI_SALES_ADD_TO_CART_RELEASE = "PACKRIFT-AI-SALES-ADD-TO-CART-2026-05-14-R02";
const ROUTE_LANDING_SERVER_TELEMETRY_RELEASE = "PACKRIFT-ROUTE-LANDING-SERVER-TELEMETRY-2026-05-16-R01";
const ROUTE_REDIRECT_SERVER_TELEMETRY_RELEASE = "PACKRIFT-MCP-ROUTE-REDIRECT-TELEMETRY-2026-05-16-R01";
const MCP_DISCOVERY_TELEMETRY_RELEASE = "PACKRIFT-MCP-DISCOVERY-TELEMETRY-R01";
const CART_LANDING_SHIM_RELEASE = "PACKRIFT-MCP-CART-LANDING-SHIM-R02";
const PACKRIFT_GA4_MEASUREMENT_ID = "G-HPMNFWG4DV";
const SEMRUSH_36X16X16_PAGE_CACHE_BYPASS_RELEASE = "PACKRIFT-SEMRUSH-36X16X16-WORKER-BYPASS-2026-05-18-R01";
const AI_SALES_EVENT_PREFIX = "events/ai-sales";
const AI_SALES_EVENT_TTL_SECONDS = 60 * 60 * 24 * 90;
const AI_SALES_ALLOWED_EVENTS = new Set([
  "add_to_cart",
  "product_click",
  "reorder_click",
  "quote_click",
  "cart_click",
  "mcp_cart_click",
  "copy_procurement_spec",
  "ai_corpus_click",
  "mcp_tool_call",
  "mcp_tools_list",
  "mcp_prompt_list",
  "mcp_prompt_get",
  "mcp_resource_list",
  "mcp_resource_templates_list",
  "mcp_resource_read",
  "spec_search",
  "exact_match",
  "multi_match",
  "no_match",
  "sku_page_view",
]);

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
    mcp_result_set: safeEventText(raw.mcp_result_set, 160),
    utm_source: safeEventText(raw.utm_source, 80),
    utm_medium: safeEventText(raw.utm_medium, 80),
    utm_campaign: safeEventText(raw.utm_campaign, 120),
    utm_content: safeEventText(raw.utm_content, 120),
    utm_term: safeEventText(raw.utm_term, 160),
    source_url: safeEventText(raw.source_url, 500),
    page_url: pageUrl,
    referrer: safeEventText(raw.referrer, 500),
    bot_family: safeEventText(raw.bot_family, 80),
    format: safeEventText(raw.format, 40),
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
    ua.includes("codex") ||
    ua.includes("criticalpathqa") ||
    ua.includes("curl/") ||
    ua.includes("python-urllib")
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
    target.searchParams.set("view", "packrift_ai_reorder_live_r05");
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
    gtag('event', 'mcp_cart_landing', {
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
      mcp_key: ${JSON.stringify(requestUrl.searchParams.get("mcp_key") ?? "")},
      mcp_journey: ${JSON.stringify(requestUrl.searchParams.get("mcp_journey") ?? "")},
      mcp_result_set: ${JSON.stringify(requestUrl.searchParams.get("mcp_result_set") ?? "")},
      match_type: ${JSON.stringify(requestUrl.searchParams.get("match_type") ?? "")}
    });
    window.setTimeout(continueToCart, 3000);
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
    url.searchParams.set("view", "packrift_ai_reorder_live_r05");
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

async function recordRouteRedirectTelemetry(
  env: Env,
  request: Request,
  requestUrl: URL,
  action: RouteRedirectAction,
  item: ApprovedCatalogItem
): Promise<void> {
  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!shouldRecordRouteLandingTelemetry(env, userAgent)) return;
  const surface = routeLandingTelemetrySurface(requestUrl) || "mcp_route_redirect";
  const event = action === "product" ? "product_click" : action === "reorder" ? "reorder_click" : action === "cart" ? "cart_click" : "quote_click";
  const packriftAiId =
    requestUrl.searchParams.get("packrift_ai_id") ||
    requestUrl.searchParams.get("ai_commerce_id") ||
    `${surface}_${compactDate()}_${item.sku}_${event}`;

  await recordAiSalesEvent(env, {
    event,
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
  });
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

function buildMcpToolCallEvent(
  name: string,
  out: unknown,
  meta: {
    latencyMs: number;
    resultSizeBytes: number;
    sessionId?: string;
    userAgent?: string;
    ok: boolean;
    errorMessage?: string;
  }
): Record<string, unknown> {
  const row = summarizeToolResult(out);
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
    ok: boolean;
    errorMessage?: string;
    promptName?: string;
    resourceUri?: string;
    format?: string;
  }
): Promise<void> {
  const userAgent = meta.userAgent ?? "";
  if (shouldSkipInternalTelemetry(userAgent)) return;
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
  const latencyByTool: Record<string, number[]> = {};
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
    byEvent[eventName] = (byEvent[eventName] ?? 0) + 1;
    bySku[sku] = (bySku[sku] ?? 0) + 1;
    bySource[source] = (bySource[source] ?? 0) + 1;
    if (eventName === "mcp_prompt_get") byPrompt[promptName] = (byPrompt[promptName] ?? 0) + 1;
    if (eventName === "mcp_resource_read") byResource[resourceUri] = (byResource[resourceUri] ?? 0) + 1;
    if (mcpMethod !== "unknown") byMcpMethod[mcpMethod] = (byMcpMethod[mcpMethod] ?? 0) + 1;
    if (eventName === "mcp_tool_call") {
      byTool[toolName] = (byTool[toolName] ?? 0) + 1;
      if (typeof event.latency_ms === "number" && Number.isFinite(event.latency_ms)) {
        latencyByTool[toolName] = [...(latencyByTool[toolName] ?? []), event.latency_ms];
      }
    }
    byBotFamily[botFamily] = (byBotFamily[botFamily] ?? 0) + 1;
    byPackriftAiId[packriftAiId] = (byPackriftAiId[packriftAiId] ?? 0) + 1;
  }
  const top = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 25)
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
  const recent = (eventName: string) =>
    events
      .filter((event) => String(event.event ?? "") === eventName)
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
    recent_tool_calls: recent("mcp_tool_call"),
    recent_prompt_gets: recent("mcp_prompt_get"),
    recent_resource_reads: recent("mcp_resource_read"),
    recent_no_matches: recent("no_match"),
    recent_exact_matches: recent("exact_match"),
    recent_multi_matches: recent("multi_match"),
  };
}

async function readAiSalesEvents(env: Env, date: string, limit: number): Promise<Array<Record<string, unknown>>> {
  const prefix = `${AI_SALES_EVENT_PREFIX}/${date}/`;
  const events: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;
  while (events.length < limit) {
    const listed = await env.CATALOG_CACHE.list({ prefix, cursor, limit: Math.min(1000, limit - events.length) });
    for (const key of listed.keys) {
      const body = await env.CATALOG_CACHE.get(key.name, "json");
      if (body && typeof body === "object") events.push(body as Record<string, unknown>);
      if (events.length >= limit) break;
    }
    if (listed.list_complete || !listed.cursor || events.length >= limit) break;
    cursor = listed.cursor;
  }
  return events;
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
  reorderUrl.searchParams.set("view", "packrift_ai_reorder_live_r05");
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
  const continuityFields = ['packrift_ai_id', 'ai_commerce_id', 'mcp_key', 'mcp_journey', 'mcp_result_set', 'match_type', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
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
  const continuityFields = ['packrift_ai_id', 'ai_commerce_id', 'mcp_key', 'mcp_journey', 'mcp_result_set', 'match_type', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
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
      reorderUrl.searchParams.set("view", "packrift_ai_reorder_live_r05");
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
  <p><a href="/pages/find-packaging-by-exact-spec">Find more exact packaging specs</a> | <a href="/pages/reorder-packaging-by-sku?view=packrift_ai_reorder_live_r05">Reorder by SKU</a> | <a href="/pages/packrift-ai-exact-spec-data">AI exact-spec data</a> | <a href="https://mcp.packrift.com/ai/conversion-route-catalog.json">AI purchase route catalog</a> | <a href="https://mcp.packrift.com/ai/conversion-route-catalog.md">Crawler route guide</a> | <a href="https://mcp.packrift.com/ai/top-1000-ai-sales-sitemap.xml">Top 1,000 AI SKU sitemap</a> | <a href="https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl">AI-approved product JSONL</a></p>
</section>`;
}

function buildReorderFeaturedSkuBlock(): string {
  const rows = REORDER_FEATURED_SKUS.map((item) => {
    const reorderUrl = new URL("https://packrift.com/pages/reorder-packaging-by-sku");
    reorderUrl.searchParams.set("view", "packrift_ai_reorder_live_r05");
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
    headers.set("x-packrift-reorder-featured-skus", html.includes(REORDER_PAGE_FEATURED_RELEASE) ? "origin" : "edge");
    if (html.includes(REORDER_PAGE_FEATURED_RELEASE)) {
      return new Response(html, { status: response.status, statusText: response.statusText, headers });
    }
    const injection = buildReorderFeaturedSkuBlock();
    const markerUpdated = html.replace(
      /PACKRIFT-REORDER-PAGE-TOP1000-\d{4}-\d{2}-\d{2}-R\d{2}/,
      REORDER_PAGE_FEATURED_RELEASE
    );
    const updated = markerUpdated.includes("<h2>Top AI-ready reorder SKUs</h2>")
      ? markerUpdated.replace("<h2>Top AI-ready reorder SKUs</h2>", `${injection}<h2>Top AI-ready reorder SKUs</h2>`)
      : markerUpdated.replace("</main>", `${injection}</main>`);
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
  "https://mcp.packrift.com/llms.txt",
  "https://mcp.packrift.com/llms-full.txt",
  "https://mcp.packrift.com/manifest",
  "https://mcp.packrift.com/resources",
  "https://mcp.packrift.com/health",
  "https://mcp.packrift.com/server-card.json",
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
  "/robots.txt": "MCP subdomain crawler policy and sitemap references.",
  "/sitemap.xml": "MCP discovery sitemap for machine-readable Packrift resources.",
  "/ai/sitemap.xml": "AI corpus sitemap for exact-spec Packrift product data files.",
  "/manifest": "REST discovery manifest for Packrift MCP tools, prompts, resources, and health endpoints.",
  "/resources": "Paginated REST resource adapter listing Packrift MCP and AI-commerce discovery resources.",
  "/health": "Packrift MCP health check with version, tool count, resource count, and KV status.",
  "/server-card.json": "Root Packrift MCP server discovery card.",
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
  const pathname = new URL(uri).pathname;
  const route = AI_CORPUS_ROUTES[pathname];
  const mimeType =
    pathname.match(/^\/ai\/sku\/[^/]+\.md$/)
      ? "text/markdown"
      : pathname.match(/^\/ai\/sku\/[^/]+\.json$/)
        ? "application/json"
        : pathname === "/manifest" || pathname === "/resources" || pathname === "/health"
          ? "application/json"
        : pathname.endsWith(".jsonl")
          ? "application/x-ndjson"
        : route?.contentType.split(";")[0] ??
    (pathname.endsWith(".xml")
      ? "application/xml"
      : pathname.endsWith(".json")
        ? "application/json"
        : pathname.endsWith(".md")
          ? "text/markdown"
          : pathname.endsWith(".csv")
            ? "text/csv"
            : "text/plain");
  return {
    uri,
    name: resourceName(pathname),
    description: RESOURCE_DESCRIPTIONS[pathname] ?? "Packrift MCP discovery resource.",
    mimeType,
  };
});

async function readResourceText(env: Env, uri: string): Promise<string> {
  const pathname = new URL(uri).pathname;
  if (pathname === "/llms.txt") return llmsTxt;
  if (pathname === "/llms-full.txt") return llmsFullTxt;
  if (pathname === "/robots.txt") return robotsTxt();
  if (pathname === "/sitemap.xml" || pathname === "/ai/sitemap.xml") return aiSitemapXml();
  if (pathname === "/ai/top-1000-ai-sales-sitemap.xml") return topAiSalesSkuSitemapXml();
  if (pathname === "/ai/all-ai-approved-sku-sitemap.xml") return allAiApprovedSkuSitemapXml();
  if (pathname === "/ai/conversion-route-redirect-sitemap.xml") return routeRedirectSitemapXml();
  if (pathname === "/manifest") return JSON.stringify(mcpManifestPayload(), null, 2);
  if (pathname === "/resources") return JSON.stringify(mcpResourcesPayload(MCP_RESOURCES.length, 0), null, 2);
  if (pathname === "/health") return JSON.stringify(await mcpHealthPayload(env), null, 2);
  if (pathname === "/server-card.json") return JSON.stringify(serverCard, null, 2);
  if (pathname === "/.well-known/mcp/server-card.json") return JSON.stringify(serverCard, null, 2);
  if (pathname === "/.well-known/glama.json") return JSON.stringify(glamaConnectorClaim(), null, 2);
  if (pathname === "/.well-known/mcp-marketplace.json") return JSON.stringify(mcpMarketplaceDiscoveryPayload(), null, 2);
  if (pathname === "/agents.md") return agentInstructionsMd;
  if (pathname === "/ai/packrift-ai-agent-instructions.md") return agentInstructionsMd;
  if (pathname === "/ai/crawler-safe-purchase-paths.md") return crawlerSafePurchasePathsMarkdown();
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
    },
    signals: {
      category: "Business Tools",
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
  url.searchParams.set("view", "packrift_ai_reorder_live_r05");
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

function cartHandoffForItem(item: ApprovedCatalogItem, quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(quantity));
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
    cart_url_candidate: cartUrlForItem(item, safeQuantity),
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
      cart: routeRedirectUrlForItem(item, "cart"),
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
    mcp_cart_handoff: cartHandoffForItem(item, 1),
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
    cart_url_qty_1_candidate: cartUrlForItem(item, 1),
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
    cart_url_qty_1_candidate: payload.mcp_cart_handoff.cart_url_candidate,
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
    release: "PACKRIFT-MCP-CART-HANDOFF-CANDIDATES-R02",
    generated_at: new Date().toISOString(),
    source: "mcp_cart_handoff_candidates",
    purpose:
      "Give AI agents a compact exact-spec path from MCP product retrieval to a GA4-visible cart handoff while preserving live price and inventory confirmation.",
    attribution_rule:
      "Cart candidates and create_cart_url calls use utm_source=chatgpt-mcp, utm_medium=mcp_tool, and utm_campaign=create_cart_url so GA4 can isolate MCP-driven cart landings.",
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
        `| ${escapeMarkdown(item.sku)} | ${escapeMarkdown(item.title)} | ${escapeMarkdown(item.family)} | ${item.mcp_sku_md} | ${item.measured_cart_url} | ${item.cart_url_qty_1_candidate} |`
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
    "## Priority Cart Candidates",
    "",
    "| SKU | Product | Family | MCP SKU record | Measured cart redirect | UTM-stamped cart candidate |",
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
    "",
  ].join("\n");
}

app.get("/llms.txt", (c) => cachedStaticTextResponse(c, "llms.txt", llmsTxt, "text/plain; charset=utf-8"));

app.get("/llms-full.txt", (c) =>
  cachedStaticTextResponse(c, "llms-full.txt", llmsFullTxt, "text/plain; charset=utf-8")
);

app.get("/.well-known/mcp/server-card.json", (c) =>
  cachedStaticTextResponse(
    c,
    "server-card.json",
    JSON.stringify(serverCard, null, 2),
    "application/json; charset=utf-8"
  )
);

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
    JSON.stringify(serverCard, null, 2),
    "application/json; charset=utf-8"
  )
);

app.get("/robots.txt", (c) =>
  c.body(robotsTxt(), 200, {
    "Content-Type": "text/plain; charset=utf-8",
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

app.get("/ai/mcp-cart-handoff-candidates.json", (c) =>
  c.json(cartHandoffCandidatesPayload(), 200, RAW_HEADERS)
);

app.get("/ai/mcp-cart-handoff-candidates.md", (c) =>
  c.body(cartHandoffCandidatesMarkdown(), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    ...RAW_HEADERS,
  })
);

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
    ...RAW_HEADERS,
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

app.get("/r/*", async (c) => {
  const requestUrl = new URL(c.req.url);
  const match = requestUrl.pathname.match(/^\/r\/(product|reorder|quote|cart)\/([^/]+)$/);
  if (!match) {
    return c.json(
      {
        error: "not_found",
        message: "Use /r/product/{SKU}, /r/reorder/{SKU}, /r/quote/{SKU}, or /r/cart/{SKU}.",
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

  const userAgent = c.req.header("User-Agent") ?? "";

  if (Array.isArray(body)) {
    const results = await Promise.all(body.map((req) => handleRpc(env, req as JsonRpcRequest, { sessionId, userAgent })));
    const filtered = results.filter((r) => r !== null);
    if (filtered.length === 0) return new Response(null, { status: 202, headers: { "Mcp-Session-Id": sessionId } });
    return respond(filtered);
  }

  const result = await handleRpc(env, body as JsonRpcRequest, { sessionId, userAgent });
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
