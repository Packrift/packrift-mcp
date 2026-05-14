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
  } as unknown as KVNamespace;
}

const env: Env = {
  SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN ?? "packrift.myshopify.com",
  SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION ?? "2025-04",
  STOREFRONT_DOMAIN: process.env.STOREFRONT_DOMAIN ?? "packrift.com",
  SHOPIFY_PACKRIFT_TOKEN: process.env.SHOPIFY_PACKRIFT_TOKEN ?? "",
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
