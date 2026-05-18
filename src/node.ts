import { serve } from "@hono/node-server";
import process from "node:process";
import app from "./index.js";
import type { Env } from "./shopify.js";

type CacheEntry = {
  value: string;
  expiresAt?: number;
};

function createMemoryKV(): KVNamespace {
  const store = new Map<string, CacheEntry>();

  return {
    async get(key: string, type?: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      if (type === "json") return JSON.parse(entry.value);
      if (type === "arrayBuffer") return new TextEncoder().encode(entry.value).buffer;
      return entry.value;
    },
    async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: KVNamespacePutOptions) {
      if (typeof value !== "string") {
        throw new Error("Node fallback CATALOG_CACHE only supports string values");
      }
      const ttl = options?.expirationTtl ? options.expirationTtl * 1000 : undefined;
      store.set(key, { value, expiresAt: ttl ? Date.now() + ttl : undefined });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(options?: KVNamespaceListOptions) {
      const prefix = options?.prefix ?? "";
      const limit = Math.max(1, Math.min(1000, options?.limit ?? 1000));
      const offset = options?.cursor ? Number.parseInt(options.cursor, 10) || 0 : 0;
      const now = Date.now();
      const names = [...store.entries()]
        .filter(([key, entry]) => {
          if (entry.expiresAt && now > entry.expiresAt) {
            store.delete(key);
            return false;
          }
          return key.startsWith(prefix);
        })
        .map(([key]) => key)
        .sort();
      const page = names.slice(offset, offset + limit);
      const nextOffset = offset + page.length;
      return {
        keys: page.map((name) => ({ name })),
        list_complete: nextOffset >= names.length,
        cursor: nextOffset < names.length ? String(nextOffset) : undefined,
      };
    },
  } as unknown as KVNamespace;
}

const env: Env = {
  SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN ?? "packrift.myshopify.com",
  SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION ?? "2025-04",
  STOREFRONT_DOMAIN: process.env.STOREFRONT_DOMAIN ?? "packrift.com",
  SHOPIFY_PACKRIFT_TOKEN: process.env.SHOPIFY_PACKRIFT_TOKEN ?? "",
  AI_SALES_SKU_PAGE_TELEMETRY: process.env.AI_SALES_SKU_PAGE_TELEMETRY,
  MCP_STATS_TOKEN: process.env.MCP_STATS_TOKEN,
  CATALOG_CACHE: createMemoryKV(),
};

const port = Number.parseInt(process.env.PORT ?? "8787", 10);

serve(
  {
    port,
    fetch: (request, _nodeEnv) => app.fetch(request, env),
  },
  (info) => {
    console.log(`Packrift MCP server listening on http://0.0.0.0:${info.port}`);
  }
);
