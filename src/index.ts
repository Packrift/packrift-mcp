import { Hono } from "hono";
import type { Env } from "./shopify.js";
import { serverCard } from "./server-card.js";

import { searchProductsSchema, searchProductsHandler } from "./tools/search_products.js";
import { getProductSchema, getProductHandler } from "./tools/get_product.js";
import { getPricingSchema, getPricingHandler } from "./tools/get_pricing.js";
import { checkInventorySchema, checkInventoryHandler } from "./tools/check_inventory.js";
import { recommendPackagingSchema, recommendPackagingHandler } from "./tools/recommend_packaging.js";
import { getShippingEstimateSchema, getShippingEstimateHandler } from "./tools/get_shipping_estimate.js";
import { createCartUrlSchema, createCartUrlHandler } from "./tools/create_cart_url.js";

type Bindings = Env;

const app = new Hono<{ Bindings: Bindings }>();

interface ToolDef {
  schema: { name: string; description: string; inputSchema: unknown };
  handler: (env: Env, args: unknown) => unknown | Promise<unknown>;
}

const TOOLS: ToolDef[] = [
  { schema: searchProductsSchema, handler: searchProductsHandler },
  { schema: getProductSchema, handler: getProductHandler },
  { schema: getPricingSchema, handler: getPricingHandler },
  { schema: checkInventorySchema, handler: checkInventoryHandler },
  { schema: recommendPackagingSchema, handler: recommendPackagingHandler },
  { schema: getShippingEstimateSchema, handler: getShippingEstimateHandler },
  { schema: createCartUrlSchema, handler: createCartUrlHandler },
];

const PROTOCOL_VERSION = "2025-06-18";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: unknown, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

async function handleRpc(env: Env, req: JsonRpcRequest): Promise<unknown | null> {
  const { method, params, id } = req;
  // Notifications (no id) get no response.
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: serverCard.name, version: serverCard.version },
          capabilities: { tools: { listChanged: false } },
          instructions:
            "Packrift packaging-supplies catalog. Use search_products and get_product for browse, get_pricing/check_inventory for live data, recommend_packaging for fit suggestions, create_cart_url to hand off to checkout.",
        });

      case "notifications/initialized":
      case "initialized":
        return null;

      case "ping":
        return rpcResult(id, {});

      case "tools/list":
        return rpcResult(id, { tools: TOOLS.map((t) => t.schema) });

      case "tools/call": {
        const name = (params?.["name"] as string) ?? "";
        const args = (params?.["arguments"] as unknown) ?? {};
        const tool = TOOLS.find((t) => t.schema.name === name);
        if (!tool) {
          return rpcError(id, -32602, `Unknown tool: ${name}`);
        }
        try {
          const out = await tool.handler(env, args);
          return rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
            structuredContent: out,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Per MCP spec, tool errors are returned in `result` with isError:true,
          // not as JSON-RPC errors — this lets the model see what went wrong.
          return rpcResult(id, {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          });
        }
      }

      case "resources/list":
        return rpcResult(id, { resources: [] });
      case "prompts/list":
        return rpcResult(id, { prompts: [] });

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

app.get("/.well-known/mcp/server-card.json", (c) => c.json(serverCard));

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

  if (Array.isArray(body)) {
    const results = await Promise.all(body.map((req) => handleRpc(env, req as JsonRpcRequest)));
    const filtered = results.filter((r) => r !== null);
    if (filtered.length === 0) return new Response(null, { status: 202, headers: { "Mcp-Session-Id": sessionId } });
    return respond(filtered);
  }

  const result = await handleRpc(env, body as JsonRpcRequest);
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

app.options("/mcp", (c) =>
  c.body(null, 204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id",
  })
);

export default app;
