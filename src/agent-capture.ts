export interface AgentCaptureRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

interface AgentCaptureSurface {
  id: string;
  name: string;
  agent_type: string;
  audience: string;
  status: "live" | "ready" | "monitored" | "stale" | "blocked" | "candidate";
  priority: "core" | "high" | "medium" | "watch";
  packrift_owned: boolean;
  canonical_url: string;
  install_or_call: string;
  proof_url: string;
  fallback_url?: string;
  next_action: string;
  notes?: string;
}

function surface(row: AgentCaptureSurface): AgentCaptureSurface {
  return row;
}

export function allAgentCapturePayload(runtime: AgentCaptureRuntime) {
  const surfaces = [
    surface({
      id: "hosted_mcp_endpoint",
      name: "Packrift hosted MCP endpoint",
      agent_type: "remote_mcp",
      audience: "Any MCP-capable agent, including ChatGPT, Claude, Cursor, Windsurf, Codex, and VS Code clients.",
      status: "live",
      priority: "core",
      packrift_owned: true,
      canonical_url: "https://mcp.packrift.com/mcp",
      install_or_call:
        "Add a remote Streamable HTTP MCP server named packrift at https://mcp.packrift.com/mcp. No buyer-side API key is required for the hosted endpoint.",
      proof_url: "https://mcp.packrift.com/health",
      fallback_url: "https://mcp.packrift.com/manifest",
      next_action: "Keep tools/list, resources/list, prompts/list, health, and cart handoff smoke checks green.",
    }),
    surface({
      id: "chatgpt_openai_product_cards",
      name: "ChatGPT and OpenAI product-card commerce",
      agent_type: "chat_commerce",
      audience: "OpenAI product and shopping agents that resolve exact products before purchase handoff.",
      status: "live",
      priority: "core",
      packrift_owned: false,
      canonical_url: "https://packrift.com",
      install_or_call:
        "Use the OpenAI-shaped product feed and Packrift MCP exact-spec records to resolve SKU, variant, price, inventory, and cart handoff.",
      proof_url: "https://mcp.packrift.com/ai/packrift-openai-products-strict-stable-current.tsv",
      fallback_url: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      next_action: "Keep paid ChatGPT SKU families mapped to MCP product records and measured cart routes.",
      notes: "Conversion-proven examples include SKUs 1066, MFL1295, and LL251WR.",
    }),
    surface({
      id: "shopify_native_ucp",
      name: "Shopify native UCP MCP",
      agent_type: "ucp_mcp",
      audience: "Agents that support Shopify UCP profile metadata and native Shopify catalog/cart behavior.",
      status: "ready",
      priority: "high",
      packrift_owned: false,
      canonical_url: "https://packrift.com/api/ucp/mcp",
      install_or_call:
        "Call only when the host agent sends a valid UCP profile at params.arguments.meta.ucp-agent.profile; otherwise use the Packrift exact-spec MCP first.",
      proof_url: "https://mcp.packrift.com/ai/shopify-native-ucp-commerce-surface.md",
      fallback_url: "https://mcp.packrift.com/mcp",
      next_action: "Use UCP for Shopify-native behavior after exact SKU safety is established through Packrift MCP.",
    }),
    surface({
      id: "claude_desktop_and_claude_code",
      name: "Claude Desktop and Claude Code",
      agent_type: "remote_mcp_client",
      audience: "Claude users adding Packrift as a remote HTTP MCP server.",
      status: "ready",
      priority: "high",
      packrift_owned: false,
      canonical_url: "https://mcp.packrift.com/mcp",
      install_or_call: "claude mcp add --transport http packrift https://mcp.packrift.com/mcp",
      proof_url: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      fallback_url: "https://github.com/Packrift/packrift-mcp",
      next_action: "Keep Claude install snippets in llms-install.md, README, server card, and marketplace manifests consistent.",
    }),
    surface({
      id: "cursor_windsurf_vscode",
      name: "Cursor, Windsurf, and VS Code MCP clients",
      agent_type: "remote_mcp_client",
      audience: "IDE agents that read MCP JSON config or remote endpoint URLs.",
      status: "ready",
      priority: "high",
      packrift_owned: false,
      canonical_url: "https://mcp.packrift.com/mcp",
      install_or_call:
        "{\"mcpServers\":{\"packrift\":{\"type\":\"http\",\"url\":\"https://mcp.packrift.com/mcp\"}}}",
      proof_url: "https://mcp.packrift.com/manifest",
      fallback_url: "https://mcp.packrift.com/resources",
      next_action: "Keep the config snippet minimal so IDE agents do not self-host unless they need local development.",
    }),
    surface({
      id: "codex_remote_mcp",
      name: "Codex remote MCP",
      agent_type: "remote_mcp_client",
      audience: "Codex workspaces that should use the current hosted endpoint instead of a duplicate CLI.",
      status: "ready",
      priority: "high",
      packrift_owned: false,
      canonical_url: "https://mcp.packrift.com/mcp",
      install_or_call: "codex mcp add packrift --url https://mcp.packrift.com/mcp",
      proof_url: "https://mcp.packrift.com/ai/packrift-ai-agent-instructions.md",
      fallback_url: "https://github.com/Packrift/packrift-mcp",
      next_action: "Keep this as a thin remote endpoint install path; do not fork a separate Packrift CLI surface.",
    }),
    surface({
      id: "glama_hosted_connector",
      name: "Glama hosted connector",
      agent_type: "mcp_connector_directory",
      audience: "Agents and users who prefer a hosted MCP connector directory install.",
      status: "monitored",
      priority: "high",
      packrift_owned: false,
      canonical_url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
      install_or_call: "Install Packrift from the Glama hosted connector and confirm the hosted endpoint remains healthy.",
      proof_url: "https://mcp.packrift.com/.well-known/glama.json",
      fallback_url: "https://mcp.packrift.com/mcp",
      next_action: "Distribution check must keep Glama healthy with all current tools visible.",
    }),
    surface({
      id: "official_mcp_registry",
      name: "Official MCP Registry",
      agent_type: "mcp_registry",
      audience: "MCP clients and downstream directories that ingest the official registry.",
      status: "monitored",
      priority: "core",
      packrift_owned: false,
      canonical_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
      install_or_call: "Resolve io.github.Packrift/packrift-mcp and use the remote https://mcp.packrift.com/mcp transport.",
      proof_url: "https://mcp.packrift.com/server-card.json",
      fallback_url: "https://github.com/Packrift/packrift-mcp/blob/main/server.json",
      next_action: "Republish server.json whenever the public MCP surface changes.",
    }),
    surface({
      id: "mcp_marketplace",
      name: "MCP Marketplace",
      agent_type: "mcp_directory",
      audience: "Agents browsing MCP servers through marketplace-style discovery.",
      status: "monitored",
      priority: "medium",
      packrift_owned: false,
      canonical_url: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
      install_or_call: "Use the public marketplace listing, then call the hosted Packrift MCP endpoint.",
      proof_url: "https://mcp.packrift.com/.well-known/mcp-marketplace.json",
      fallback_url: "https://mcp.packrift.com/mcp",
      next_action: "Keep marketplace discovery manifest aligned with server card, tool count, and launch guide.",
    }),
    surface({
      id: "github_source_and_container",
      name: "GitHub source and GHCR container",
      agent_type: "source_package",
      audience: "Directories and local environments that require a package or container install surface.",
      status: "ready",
      priority: "medium",
      packrift_owned: true,
      canonical_url: "https://github.com/Packrift/packrift-mcp",
      install_or_call: "docker pull ghcr.io/packrift/packrift-mcp:latest",
      proof_url: "https://github.com/Packrift/packrift-mcp/blob/main/server.json",
      fallback_url: "https://mcp.packrift.com/mcp",
      next_action: "Keep the hosted endpoint primary; use the container only where package-style installation is required.",
    }),
    surface({
      id: "llms_txt_and_full_corpus",
      name: "llms.txt and llms-full.txt",
      agent_type: "crawler_corpus",
      audience: "Search, answer, and shopping agents that crawl public text files before tool calling.",
      status: "live",
      priority: "core",
      packrift_owned: true,
      canonical_url: "https://mcp.packrift.com/llms.txt",
      install_or_call: "Fetch llms.txt first, then llms-full.txt for dense exact-spec Packrift context.",
      proof_url: "https://mcp.packrift.com/llms-full.txt",
      fallback_url: "https://mcp.packrift.com/ai/sitemap.xml",
      next_action: "Keep static availability checks green across crawler user agents.",
    }),
    surface({
      id: "root_agents_md",
      name: "Root agents.md",
      agent_type: "crawler_instruction",
      audience: "Agents that look for root-domain instructions before crawling product or tool surfaces.",
      status: "live",
      priority: "core",
      packrift_owned: true,
      canonical_url: "https://packrift.com/agents.md",
      install_or_call: "Read root-domain agent instructions, then use the Packrift MCP endpoint for live facts.",
      proof_url: "https://mcp.packrift.com/ai/packrift-ai-agent-instructions.md",
      fallback_url: "https://mcp.packrift.com/mcp",
      next_action: "Keep the Shopify-root route and MCP-hosted copy consistent.",
    }),
    surface({
      id: "ai_product_corpus",
      name: "AI-approved product corpus",
      agent_type: "structured_catalog",
      audience: "Offline indexing agents, retrieval systems, and shopping agents that need exact SKU/spec records.",
      status: "live",
      priority: "core",
      packrift_owned: true,
      canonical_url: "https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl",
      install_or_call: "Index only AI_APPROVE rows and preserve SKU, variant, family, dimensions, pack count, product URL, and no-match rules.",
      proof_url: "https://mcp.packrift.com/ai/all-ai-approved-sku-sitemap.xml",
      fallback_url: "https://mcp.packrift.com/ai/purchase-paths.jsonl",
      next_action: "Refresh product corpus through the existing approved-catalog pipeline rather than editing rows by hand.",
    }),
    surface({
      id: "measured_handoff_directory",
      name: "Measured handoff directory",
      agent_type: "conversion_handoff",
      audience: "Agents that can recommend a product but need a safe measured buyer handoff path.",
      status: "live",
      priority: "core",
      packrift_owned: true,
      canonical_url: "https://mcp.packrift.com/ai/measured-handoffs.json",
      install_or_call: "Use measured product, reorder, quote, cart, SKU markdown, SKU JSON, and copy-procurement-spec routes after live MCP confirmation.",
      proof_url: "https://mcp.packrift.com/ai/measured-handoffs.md",
      fallback_url: "https://mcp.packrift.com/ai/conversion-route-catalog.json",
      next_action: "Keep route telemetry and cart smoke checks tied to priority exact-spec SKUs.",
    }),
    surface({
      id: "cart_handoff_candidates",
      name: "MCP cart handoff candidates",
      agent_type: "tool_callable_cart",
      audience: "Agents that need ready create_cart_url arguments for priority exact SKUs.",
      status: "live",
      priority: "core",
      packrift_owned: true,
      canonical_url: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      install_or_call: "Call get_cart_handoff_candidates, then get_product, get_pricing, check_inventory, and create_cart_url only after exact SKU and quantity are confirmed.",
      proof_url: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.md",
      fallback_url: "https://mcp.packrift.com/ai/crawler-safe-purchase-paths.md",
      next_action: "Keep synthetic cart checks on 1066, LL251WR, and MFL1295 passing.",
    }),
    surface({
      id: "browserbase_browse_candidate",
      name: "Browserbase Browse / browse.sh",
      agent_type: "browser_skill_candidate",
      audience: "Browser agents that install open-web skills and use browser primitives for dynamic sites.",
      status: "candidate",
      priority: "watch",
      packrift_owned: false,
      canonical_url: "https://browse.sh/",
      install_or_call:
        "Candidate only: create a read-only Packrift Browse skill if Browserbase opens or documents a retailer submission path that fits Packrift product search and cart handoff.",
      proof_url: "https://www.browserbase.com/browse-cli/",
      fallback_url: "https://mcp.packrift.com/mcp",
      next_action:
        "Monitor Browse skill submission/packaging options. Do not build a parallel Packrift CLI unless it is a thin wrapper around the hosted MCP endpoint.",
      notes:
        "Browse is useful as an agent browser-skill pattern; Packrift's current canonical agent surface remains MCP plus corpus.",
    }),
    surface({
      id: "mcp_directory_refreshes",
      name: "Secondary MCP directory refreshes",
      agent_type: "mcp_directory",
      audience: "MCPBench, mcpservers.org, mcp.directory, PulseMCP, Chiark, and other secondary discovery surfaces.",
      status: "monitored",
      priority: "high",
      packrift_owned: false,
      canonical_url: "https://mcp.packrift.com/ai/all-agent-capture.json",
      install_or_call: "Use this capture matrix plus server.json, server card, live health, and tool list as recrawl evidence.",
      proof_url: "https://mcp.packrift.com/ai/all-agent-capture.md",
      fallback_url: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      next_action: "Push stale directory refreshes from the current submission pack instead of creating separate Packrift surfaces.",
    }),
    surface({
      id: "search_and_answer_crawlers",
      name: "Search and answer-engine crawlers",
      agent_type: "crawler",
      audience: "Google, Bing, Perplexity-style, Gemini-style, and answer-engine crawlers that discover structured commerce pages.",
      status: "ready",
      priority: "high",
      packrift_owned: false,
      canonical_url: "https://mcp.packrift.com/sitemap.xml",
      install_or_call: "Crawl sitemaps, llms files, per-SKU pages, product corpus, and measured handoff directories.",
      proof_url: "https://mcp.packrift.com/robots.txt",
      fallback_url: "https://packrift.com/sitemap.xml",
      next_action: "Keep public sitemaps, root agents.md, IndexNow, and AI corpus files in sync.",
    }),
  ];

  const generatedAt = new Date().toISOString();
  return {
    release: "PACKRIFT-ALL-AGENT-CAPTURE-R01",
    generated_at: generatedAt,
    status: "canonical_current_mcp_capture_layer",
    owner: "Packrift",
    canonical_endpoint: "https://mcp.packrift.com/mcp",
    hub_urls: {
      json: "https://mcp.packrift.com/ai/all-agent-capture.json",
      markdown: "https://mcp.packrift.com/ai/all-agent-capture.md",
      agent_instructions: "https://mcp.packrift.com/ai/packrift-ai-agent-instructions.md",
      llms: "https://mcp.packrift.com/llms.txt",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
    },
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    operating_rules: [
      "Use the current hosted Packrift MCP endpoint as the canonical agent surface.",
      "Do not create a separate Packrift CLI or duplicate buyer interface unless it is only a thin wrapper around the hosted MCP endpoint.",
      "Use exact AI_APPROVE SKU/spec matching before product, reorder, quote, or cart handoff.",
      "Confirm live price, inventory, shipping, and cart eligibility through MCP tools before presenting a cart or checkout action.",
      "When an external directory is stale or blocked, refresh that directory with this matrix, server.json, health, resources/list, tools/list, and cart smoke evidence.",
    ],
    counts: {
      total_surfaces: surfaces.length,
      live: surfaces.filter((row) => row.status === "live").length,
      ready: surfaces.filter((row) => row.status === "ready").length,
      monitored: surfaces.filter((row) => row.status === "monitored").length,
      candidate: surfaces.filter((row) => row.status === "candidate").length,
      stale: surfaces.filter((row) => row.status === "stale").length,
      blocked: surfaces.filter((row) => row.status === "blocked").length,
    },
    surfaces,
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function allAgentCaptureMarkdown(runtime: AgentCaptureRuntime): string {
  const payload = allAgentCapturePayload(runtime);
  const rows = payload.surfaces
    .map(
      (row) =>
        `| ${escapeMarkdown(row.name)} | ${row.status} | ${row.priority} | ${escapeMarkdown(row.agent_type)} | ${row.canonical_url} | ${escapeMarkdown(row.next_action)} |`
    )
    .join("\n");
  const rules = payload.operating_rules.map((rule) => `- ${rule}`).join("\n");
  return [
    "# Packrift All-Agent Capture Matrix",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical MCP endpoint: ${payload.canonical_endpoint}`,
    "",
    "## What This Is",
    "",
    "One current Packrift map for every agent surface we care about: MCP clients, ChatGPT/OpenAI commerce, Shopify UCP, Claude, Cursor, Windsurf, Codex, Glama, registries, crawlable corpora, search crawlers, and Browserbase Browse as a candidate browser-skill lane.",
    "",
    "## Operating Rules",
    "",
    rules,
    "",
    "## Runtime",
    "",
    `- Server version: ${payload.runtime.server_version}`,
    `- Tools: ${payload.runtime.tools_count}`,
    `- Resources: ${payload.runtime.resources_count}`,
    `- Prompts: ${payload.runtime.prompts_count}`,
    "",
    "## Surfaces",
    "",
    "| Surface | Status | Priority | Agent type | Canonical URL | Next action |",
    "| --- | --- | --- | --- | --- | --- |",
    rows,
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/all-agent-capture.json",
    "",
  ].join("\n");
}
