import { serverCard } from "./server-card.js";

export const agentWebManifest = {
  awp_version: "0.2",
  domain: "mcp.packrift.com",
  intent:
    "Packrift's public agent surface for exact-spec packaging procurement. Agents can discover Packrift MCP, read machine-friendly catalog resources, verify SKU fit, and prepare cart or quote handoffs after live price and inventory checks.",
  capabilities: {
    streaming: true,
    batch_actions: false,
    webhooks: false,
    pagination: "cursor",
    idempotency: false,
  },
  auth: {
    type: "none",
    required_for: [],
    optional_for: [],
  },
  protocols: {
    mcp: {
      name: serverCard.name,
      version: serverCard.version,
      transport: serverCard.transport,
      endpoint: "https://mcp.packrift.com/mcp",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      client_config: "https://mcp.packrift.com/.well-known/mcp.json",
    },
    capindex: {
      capability_card: "https://mcp.packrift.com/.well-known/capability-card.json",
    },
    openapi: {
      url: "https://mcp.packrift.com/openapi.json",
      well_known_url: "https://mcp.packrift.com/.well-known/openapi.json",
    },
  },
  entities: {
    packaging_product: {
      fields: {
        sku: "string",
        title: "string",
        family: "string",
        dimensions: "string",
        material: "string",
        color: "string",
        count: "string",
        product_url: "url",
      },
    },
    cart_handoff: {
      fields: {
        cart_url: "url",
        sku: "string",
        quantity: "integer",
        live_price_checked: "boolean",
        live_inventory_checked: "boolean",
      },
    },
  },
  actions: [
    {
      id: "search_packaging_exact_spec",
      description:
        "Search Packrift's exact-spec packaging catalog by SKU, dimensions, material, grade, color, count, closure, printer type, or use case.",
      auth_required: false,
      inputs: {
        query: {
          type: "string",
          required: true,
          description: "Natural-language packaging spec or known Packrift SKU.",
        },
      },
      outputs: {
        products: "array[packaging_product]",
        no_match_guidance: "string",
      },
      endpoint: "https://mcp.packrift.com/mcp",
      method: "POST",
      via: "mcp",
      sensitivity: "standard",
      requires_human_confirmation: false,
      reversible: true,
    },
    {
      id: "read_public_sku_record",
      description:
        "Read a crawler-safe Packrift SKU record after a SKU has been identified. This does not confirm live price, inventory, or shipping.",
      auth_required: false,
      inputs: {
        sku: {
          type: "string",
          required: true,
          description: "Packrift SKU.",
        },
      },
      outputs: {
        product: "packaging_product",
      },
      endpoint: "https://mcp.packrift.com/ai/sku/{sku}.json",
      method: "GET",
      sensitivity: "standard",
      requires_human_confirmation: false,
      reversible: true,
    },
    {
      id: "create_guarded_cart_handoff",
      description:
        "Create a Packrift cart handoff only after the MCP server checks live price and inventory. This does not place an order.",
      auth_required: false,
      inputs: {
        sku: {
          type: "string",
          required: true,
          description: "Exact Packrift SKU to add to cart.",
        },
        quantity: {
          type: "integer",
          required: true,
          description: "Quantity requested by the buyer.",
        },
      },
      outputs: {
        cart_handoff: "cart_handoff",
      },
      endpoint: "https://mcp.packrift.com/mcp",
      method: "POST",
      via: "mcp",
      sensitivity: "standard",
      requires_human_confirmation: true,
      reversible: true,
    },
  ],
  errors: {
    NO_EXACT_MATCH: {
      recovery: "Do not suggest a nearby SKU as exact. Use the Packrift quote or contact route.",
    },
    LIVE_PRICE_REQUIRED: {
      recovery: "Call Packrift MCP pricing before presenting commercial facts.",
    },
    LIVE_INVENTORY_REQUIRED: {
      recovery: "Call Packrift MCP inventory before presenting availability or a cart handoff.",
    },
  },
  dependencies: {
    create_guarded_cart_handoff: ["search_packaging_exact_spec"],
  },
  agent_hints: {
    exact_match_policy:
      "Treat dimensions, material, color, count, family, closure, grade, and SKU as binding exact-match fields. Do not invent substitutions.",
    checkout_policy:
      "A cart handoff is not an order. The buyer must complete Shopify checkout before any purchase is placed.",
    public_corpus:
      "Use https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl and SKU pages for retrieval, then use MCP for live commercial confirmation.",
  },
  agent_status: {
    operational: true,
    status_endpoint: "https://mcp.packrift.com/health",
  },
  release: "PACKRIFT-AGENT-WEB-MANIFEST-2026-05-21-R01",
  updated_at: "2026-05-21",
} as const;
