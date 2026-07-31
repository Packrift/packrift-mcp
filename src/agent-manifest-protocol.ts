import { serverCard } from "./server-card.js";

export const agentManifestProtocolManifest = {
  spec_version: "agentmanifest-0.3",
  name: "Packrift MCP Exact-Spec Packaging Procurement",
  version: serverCard.version,
  description:
    "Packrift MCP is a no-auth public Model Context Protocol API for exact-spec packaging procurement. Agents can search Packrift packaging SKUs by dimensions, material, grade, color, count, use case, or known SKU; read machine-friendly catalog records; check live pricing and inventory; and prepare guarded Shopify cart or quote handoffs without placing an order.",
  homepage: "https://mcp.packrift.com/start",
  documentation: "https://mcp.packrift.com/llms.txt",
  categories: ["commerce", "logistics", "engineering", "computing"],
  primary_category: "live",
  endpoints: [
    {
      path: "/mcp",
      method: "POST",
      description:
        "Call the Packrift MCP streamable HTTP endpoint for exact-spec product search, product reads, live pricing, inventory checks, and guarded cart handoffs.",
      parameters: [
        {
          name: "jsonrpc_request",
          type: "object",
          required: true,
          description:
            "JSON-RPC MCP request body. Use tools/list first, then call read-only tools before any cart handoff tool.",
        },
      ],
      response_description:
        "MCP JSON-RPC response containing tool lists, product matches, live commercial facts, no-match guidance, or a guarded cart handoff URL.",
    },
    {
      path: "/ai/mcp-tools.json",
      method: "GET",
      description:
        "Fetch the public Packrift MCP tool discovery document before selecting a tool or generating an MCP request.",
      parameters: [],
      response_description:
        "JSON tool catalog with Packrift MCP tool names, use cases, safety notes, input hints, and first-run guidance.",
    },
    {
      path: "/ai/packrift-ai-approved-products.jsonl",
      method: "GET",
      description:
        "Download the AI-approved Packrift exact-spec product corpus for retrieval and SKU candidate matching.",
      parameters: [],
      response_description:
        "JSONL records for public AI_APPROVE products including SKU, title, family, dimensions, material, color, count, and product links.",
    },
    {
      path: "/ai/sku/1066.json",
      method: "GET",
      description:
        "Fetch a sample crawler-safe Packrift SKU JSON record to inspect the product-record format used by per-SKU pages.",
      parameters: [],
      response_description:
        "JSON record for one Packrift SKU with source product facts and safe purchase-path metadata.",
    },
    {
      path: "/r/config/generic",
      method: "GET",
      description:
        "Fetch a copy-ready generic remote MCP client config for installing Packrift MCP in compatible agent hosts.",
      parameters: [],
      response_description:
        "JSON MCP client configuration pointing to the hosted Packrift streamable HTTP endpoint with source attribution.",
    },
    {
      path: "/health",
      method: "GET",
      description:
        "Check Packrift MCP public health, tool count, resource count, runtime version, and cache availability.",
      parameters: [],
      response_description:
        "JSON health response with operational status and public server metadata.",
    },
    {
      path: "/openapi.json",
      method: "GET",
      description:
        "Fetch the OpenAPI discovery adapter for agents or directories that inspect REST manifests before MCP.",
      parameters: [],
      response_description:
        "OpenAPI 3.1 document for Packrift MCP discovery, activation, catalog, and source-aware utility routes.",
    },
    {
      path: "/llms.txt",
      method: "GET",
      description:
        "Fetch the compact Packrift MCP agent-readable overview, install links, exact-match policy, and public resource map.",
      parameters: [],
      response_description:
        "Plain-text guide for agents covering Packrift MCP use cases, safety boundaries, installation URLs, and corpus links.",
    },
  ],
  authentication: {
    required: false,
    type: "none",
    instructions: null,
  },
  pricing: {
    model: "free",
    free_tier: {
      queries_per_day: null,
      queries_per_month: null,
    },
    paid_tier: null,
    support_url: "https://packrift.com/pages/contact",
  },
  payment: null,
  rate_limits: {
    requests_per_minute: 60,
    requests_per_day: null,
  },
  reliability: {
    maintained_by: "organization",
    status_url: "https://mcp.packrift.com/health",
    expected_uptime_pct: null,
  },
  agent_notes:
    "Use Packrift MCP for exact-spec packaging procurement workflows where dimensions, material, color, count, closure, grade, and SKU continuity matter. No Packrift account is required for the public MCP discovery, catalog, pricing, inventory, or guarded cart-handoff checks described in this manifest. Do not invent substitutes or claim a nearby SKU is exact. A Packrift MCP cart handoff only creates a Shopify cart URL after live facts are checked; it never places an order, stores payment data, or completes checkout. Do not enter credentials, tokens, payment details, or buyer secrets through this manifest. Confirm live price, inventory, shipping, and buyer quantity before presenting a cart handoff. If no exact AI_APPROVE match exists, route to Packrift quote/contact paths instead of forcing a product recommendation.",
  contact: {
    email: "farhan@packrift.com",
    support_url: "https://packrift.com/pages/contact",
    github: "https://github.com/Packrift/packrift-mcp",
  },
  listing_requested: true,
  last_updated: "2026-05-31T19:05:00Z",
} as const;
