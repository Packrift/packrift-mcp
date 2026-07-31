import { TRACKED_INSTALL_TEMPLATE, mcpFirstUsefulRun, trackedInstallUrl } from "./install-action.js";
import { TRACKED_RUN_TEMPLATE, trackedRunUrl } from "./first-run-action.js";

export interface DirectoryRefreshRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const MCP_START_URL = "https://mcp.packrift.com/start";
const MCP_START_JSON_URL = "https://mcp.packrift.com/ai/mcp-start.json";
const MCP_TRACKED_START_TEMPLATE = "https://mcp.packrift.com/r/start/{source}";
const MCP_TRACKED_CONFIG_TEMPLATE = "https://mcp.packrift.com/r/config/{source}";
const MCP_TRACKED_CONFIG_GENERIC_URL = "https://mcp.packrift.com/r/config/generic";
const INSTALL_ACTIONS_URL = "https://mcp.packrift.com/ai/mcp-install-actions.json";
const REVIEWER_ACTIVATION_URL = "https://mcp.packrift.com/ai/mcp-reviewer-activation.json";
const MCP_TRACKED_REVIEWER_ACTIVATION_TEMPLATE = "https://mcp.packrift.com/r/activate/{source}";
const MCP_TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE = "https://mcp.packrift.com/r/activate/{source}?format=html";
const ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/SKILL.md";
const BROWSERBASE_BROWSE_SKILL_PACK_URL = "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json";
const CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md";
const MCP_CLIENT_CONFIG_URL = "https://mcp.packrift.com/ai/mcp-client-config.json";
const MCP_FUNNEL_SNAPSHOT_URL = "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json";
const MCP_SOURCE_ACTIVATION_QUEUE_URL = "https://mcp.packrift.com/ai/mcp-source-activation-queue.json";
const MCP_SOURCE_ACTIVATION_QUEUE_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-source-activation-queue.md";
const MCP_SOURCE_ACTIVATION_SITEMAP_URL = "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml";
const MCP_ACTIVATION_WAVE_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.json";
const MCP_ACTIVATION_WAVE_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.md";
const MCP_ACTIVATION_WAVE_HTML_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.html";
const ROOT_MCP_JSON_URL = "https://mcp.packrift.com/mcp.json";
const WELL_KNOWN_MCP_JSON_URL = "https://mcp.packrift.com/.well-known/mcp.json";
const MCP_OPENAPI_JSON_URL = "https://mcp.packrift.com/openapi.json";
const MCP_WELL_KNOWN_OPENAPI_JSON_URL = "https://mcp.packrift.com/.well-known/openapi.json";
const MCP_AI_PLUGIN_JSON_URL = "https://mcp.packrift.com/ai-plugin.json";
const MCP_WELL_KNOWN_AI_PLUGIN_JSON_URL = "https://mcp.packrift.com/.well-known/ai-plugin.json";
const MCP_AGENT_WEB_MANIFEST_URL = "https://mcp.packrift.com/.well-known/agent.json";
const MCP_ROOT_AGENT_WEB_MANIFEST_URL = "https://mcp.packrift.com/agent.json";
const MCP_CAPABILITY_CARD_URL = "https://mcp.packrift.com/.well-known/capability-card.json";
const MCP_MARKETPLACE_MANIFEST_URL = "https://mcp.packrift.com/.well-known/mcp-marketplace.json";
const MCP_TOOL_DISCOVERY_URL = "https://mcp.packrift.com/ai/mcp-tools.json";
const MCP_TOOL_DISCOVERY_MARKDOWN_URL = "https://mcp.packrift.com/ai/spec-finder-tools.md";
const MCP_UCP_STARTER_CATALOG_URL = "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.json";
const MCP_UCP_STARTER_CATALOG_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.md";
const MCP_UCP_STARTER_CATALOG_HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.html";
const MCP_UCP_BUILDER_KIT_URL = "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.json";
const MCP_UCP_BUILDER_KIT_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.md";
const MCP_UCP_BUILDER_KIT_HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.html";
const MCP_UCP_STOREFRONT_IMPORT_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.json";
const MCP_UCP_STOREFRONT_IMPORT_JSONL_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.jsonl";
const MCP_UCP_STOREFRONT_IMPORT_CSV_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.csv";
const MCP_UCP_STOREFRONT_IMPORT_HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.html";
const MCP_UCP_STOREFRONT_SHELF_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf.json";
const MCP_UCP_STOREFRONT_SHELF_HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf.html";
const MCP_UCP_STOREFRONT_SHELF_EMBED_JS_URL = "https://mcp.packrift.com/ai/packrift-ucp-shelf.js";
const MCP_UCP_STOREFRONT_ADOPTION_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-adoption.json";
const MCP_UCP_STOREFRONT_ADOPTION_HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-adoption.html";
const MCP_UCP_BUILDER_ACTIVATION_HANDOFF_URL = "https://mcp.packrift.com/ai/mcp-ucp-builder-activation-handoff.json";
const MCP_UCP_BUILDER_ACTIVATION_HANDOFF_HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-builder-activation-handoff.html";
const PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-starter-kit.json";
const PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-starter-kit.html";
const PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-storefront-template.json";
const PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-storefront-template.html";
const MCP_UCP_STOREFRONT_SHELF_DEMO_STACK412_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf-demo/stack412_style_storefront.html";
const OFFICIAL_REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0/servers/io.github.Packrift%2Fpackrift-mcp/versions/0.2.13";
const OFFICIAL_REGISTRY_SEARCH_URL = "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift";
const SOURCE_README_URL = "https://github.com/Packrift/packrift-mcp/blob/main/README.md";
const SOURCE_README_RAW_URL = "https://raw.githubusercontent.com/Packrift/packrift-mcp/main/README.md";
const PUBLIC_DOCS_HYGIENE = {
  release: "PACKRIFT-MCP-PUBLIC-DOCS-HYGIENE-R01",
  status: "passing",
  build_gate: "npm run check:public-doc-hygiene",
  policy:
    "Public documentation and directory packets must not publish token-shaped Shopify/API placeholders; hosted Packrift MCP remains no-auth at https://mcp.packrift.com/mcp.",
  current_source_docs: {
    readme: SOURCE_README_URL,
    raw_readme: SOURCE_README_RAW_URL,
    marketplace_manifest: MCP_MARKETPLACE_MANIFEST_URL,
    tool_discovery_json: MCP_TOOL_DISCOVERY_URL,
    tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
    ucp_starter_catalog_json: MCP_UCP_STARTER_CATALOG_URL,
    ucp_starter_catalog_markdown: MCP_UCP_STARTER_CATALOG_MARKDOWN_URL,
    ucp_starter_catalog_html: MCP_UCP_STARTER_CATALOG_HTML_URL,
    ucp_builder_kit_json: MCP_UCP_BUILDER_KIT_URL,
    ucp_builder_kit_markdown: MCP_UCP_BUILDER_KIT_MARKDOWN_URL,
    ucp_builder_kit_html: MCP_UCP_BUILDER_KIT_HTML_URL,
    ucp_storefront_import_json: MCP_UCP_STOREFRONT_IMPORT_URL,
    ucp_storefront_import_jsonl: MCP_UCP_STOREFRONT_IMPORT_JSONL_URL,
    ucp_storefront_import_csv: MCP_UCP_STOREFRONT_IMPORT_CSV_URL,
    ucp_storefront_import_html: MCP_UCP_STOREFRONT_IMPORT_HTML_URL,
    ucp_storefront_shelf_json: MCP_UCP_STOREFRONT_SHELF_URL,
    ucp_storefront_shelf_html: MCP_UCP_STOREFRONT_SHELF_HTML_URL,
    ucp_storefront_shelf_embed_js: MCP_UCP_STOREFRONT_SHELF_EMBED_JS_URL,
    ucp_storefront_adoption_json: MCP_UCP_STOREFRONT_ADOPTION_URL,
    ucp_storefront_adoption_html: MCP_UCP_STOREFRONT_ADOPTION_HTML_URL,
    ucp_builder_activation_handoff_json: MCP_UCP_BUILDER_ACTIVATION_HANDOFF_URL,
    ucp_builder_activation_handoff_html: MCP_UCP_BUILDER_ACTIVATION_HANDOFF_HTML_URL,
    ucp_shipping_supplies_starter_kit_json: PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_URL,
    ucp_shipping_supplies_starter_kit_html: PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
    ucp_shipping_supplies_storefront_template_json: PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_URL,
    ucp_shipping_supplies_storefront_template_html: PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
    ucp_storefront_shelf_demo_stack412: MCP_UCP_STOREFRONT_SHELF_DEMO_STACK412_URL,
  },
};
const MCP_TRACKED_START_SOURCE_POLICY = {
  accepted_source_format: "^[a-z0-9_]{2,64}$",
  partner_specific_sources_allowed: true,
  custom_examples: ["agency_partner", "browser_agent_demo", "newsletter_mcp"],
};

const DIRECTORY_TARGETS = [
  {
    id: "mcpservers_org",
    name: "mcpservers.org",
    listing_url: "https://mcpservers.org/servers/packrift/packrift-mcp",
    refresh_url: "https://mcpservers.org/submit",
    priority: "high",
    requested_action: "Recrawl the GitHub repository and hosted endpoint so the listing shows current cart-handoff and exploration tools.",
  },
  {
    id: "mcp_directory",
    name: "MCP.Directory",
    listing_url: "https://mcp.directory/servers?q=packrift",
    refresh_url: "https://mcp.directory/submit",
    priority: "high",
    requested_action: "Add Packrift MCP with the hosted Streamable HTTP endpoint, repo URL, and current exact-spec procurement copy.",
  },
  {
    id: "anthropic_connectors_directory",
    name: "Claude Connectors Directory",
    listing_url: "https://claude.com/connectors",
    refresh_url: "https://clau.de/mcp-directory-submission",
    priority: "high",
    requested_action:
      "Submit through an authenticated Google Forms session with the hosted endpoint, no-auth policy, and first-run cart-handoff proof.",
  },
  {
    id: "smithery",
    name: "Smithery",
    listing_url: "https://smithery.ai/servers?q=Packrift",
    refresh_url: "https://smithery.ai/new",
    priority: "high",
    requested_action:
      "Publish or claim Packrift MCP on Smithery using the hosted endpoint and the richer /.well-known/mcp/server-card.json schema fields.",
  },
  {
    id: "cline_mcp_marketplace",
    name: "Cline MCP Marketplace",
    listing_url: "https://github.com/cline/mcp-marketplace/issues?q=Packrift",
    refresh_url: "https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml",
    priority: "high",
    requested_action:
      "Keep the Packrift MCP submission issue current until it is published in the Cline MCP Marketplace.",
  },
  {
    id: "mcp_so",
    name: "MCP.so",
    listing_url: "https://mcp.so/servers?keyword=Packrift",
    refresh_url: "https://github.com/chatmcp/mcpso/issues/2189",
    priority: "high",
    requested_action:
      "Monitor the updated MCP.so submission issue #2189 and wait for listing publication before attempting any duplicate owner-authenticated submission.",
  },
  {
    id: "punkpeye_awesome_mcp",
    name: "punkpeye/awesome-mcp-servers",
    listing_url: "https://github.com/punkpeye/awesome-mcp-servers/pull/5606",
    refresh_url: "https://github.com/punkpeye/awesome-mcp-servers/pull/5606",
    priority: "high",
    requested_action:
      "Keep the canonical Packrift PR #5606 current until the Glama score blocker clears; do not create duplicate automated PRs.",
  },
  {
    id: "browse_sh",
    name: "Browserbase Browse / browse.sh",
    listing_url: "https://browse.sh/",
    refresh_url: "https://browse.sh/",
    priority: "high",
    requested_action:
      "Add Packrift as a Browse catalog skill using the root SKILL.md and hosted MCP endpoint, so browser agents can discover Packrift without a duplicate CLI.",
  },
  {
    id: "glama_server_listing",
    name: "Glama open-source server listing",
    listing_url: "https://glama.ai/mcp/servers/ye4xxr7qiu",
    refresh_url: "https://glama.ai/",
    priority: "high",
    requested_action:
      "Use Glama source-listing admin to claim the server, configure the repo Dockerfile, make a Glama release, then sync the server so quality scoring can run.",
  },
  {
    id: "mcpbench",
    name: "MCPBench",
    listing_url: "https://mcpbench.ai/servers/io.github.Packrift/packrift-mcp",
    refresh_url: OFFICIAL_REGISTRY_URL,
    priority: "medium",
    requested_action: "Refresh from the official registry latest version and hosted endpoint proof.",
  },
  {
    id: "chiark",
    name: "Chiark",
    listing_url: "https://chiark.ai/",
    refresh_url: "https://chiark.ai/methodology",
    priority: "medium",
    requested_action: "Ingest Packrift from upstream MCP registry and marketplace surfaces by endpoint URL.",
  },
  {
    id: "pulsemcp_packrift",
    name: "PulseMCP",
    listing_url: "https://www.pulsemcp.com/servers/packrift",
    refresh_url: OFFICIAL_REGISTRY_URL,
    priority: "high",
    requested_action: "Use the official registry entry and public server.json as the recrawl source if direct crawler access is blocked.",
  },
  {
    id: "mcpmarket_com",
    name: "MCP Market",
    listing_url: "https://mcpmarket.com/server/packrift",
    refresh_url: "https://mcpmarket.com/submit",
    priority: "medium",
    requested_action:
      "Claim or update the Packrift MCP Market listing so it points at the hosted endpoint and current server card.",
  },
  {
    id: "mcp_marketplace_io",
    name: "MCP Marketplace",
    listing_url: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
    refresh_url: "https://mcp-marketplace.io/for-creators",
    priority: "medium",
    requested_action:
      "Recrawl the hosted marketplace manifest and update the public listing to 15 tools, including prepare_purchase_handoff, with no buyer-required credentials for the hosted endpoint.",
  },
  {
    id: "mcplist_ai",
    name: "MCPLIST",
    listing_url: "https://www.mcplist.ai/?search=packrift",
    refresh_url: "mailto:contact@mcplist.ai",
    priority: "medium",
    requested_action:
      "Review and send the existing Gmail draft with the hosted endpoint, marketplace manifest, source-specific update card, and first-useful-run proof.",
  },
  {
    id: "mcphubz",
    name: "MCPHubz",
    listing_url: "https://mcphubz.com/",
    refresh_url: "https://mcphubz.com/submit",
    priority: "medium",
    requested_action:
      "Use an authenticated MCPHubz session or working owner contact path before retrying; the public contact Formspree endpoint returned FORM_NOT_FOUND.",
  },
  {
    id: "mcp_blue",
    name: "MCP Blue",
    listing_url: "https://www.mcp.blue/",
    refresh_url: "https://www.mcp.blue/submit",
    priority: "medium",
    requested_action:
      "Do not spend time submitting until MCP Blue is live again; the submit URL behaves like a parked/fingerprint-gated domain and the gate leads to an error page.",
  },
  {
    id: "findmcp_dev",
    name: "FindMCP",
    listing_url: "https://findmcp.dev/",
    refresh_url: "https://findmcp.dev/submit",
    priority: "medium",
    requested_action:
      "Find a real contact, repository, or fixed submit endpoint; /submit renders the landing page and the visible submit CTA errors.",
  },
  {
    id: "mcplane",
    name: "MCPLane",
    listing_url: "https://mcplane.com/mcp_servers?query=packrift",
    refresh_url: "https://mcplane.com/mcp_servers/new",
    priority: "medium",
    requested_action:
      "Contact MCPLane or retry only after its GitHub validator accepts the public Packrift/packrift-mcp repository.",
  },
  {
    id: "mcpsolutions_dev",
    name: "MCP Solutions",
    listing_url: "https://mcpsolutions.dev/explore/",
    refresh_url: "https://mcpsolutions.dev/submit/",
    priority: "medium",
    requested_action:
      "Monitor the submitted basic listing for publication and provide the source-specific update card if review asks for current endpoint proof.",
  },
  {
    id: "gpmcp",
    name: "GPMCP",
    listing_url: "https://www.gpmcp.com/",
    refresh_url: "https://www.gpmcp.com/",
    priority: "medium",
    requested_action:
      "Review the existing support@gpmcp.com draft or hold until GPMCP exposes a real submit/import path.",
  },
  {
    id: "theresamcpforthat",
    name: "There's an MCP for That",
    listing_url: "https://theresamcpforthat.com/directory?search=packrift",
    refresh_url: "https://theresamcpforthat.com/",
    priority: "medium",
    requested_action:
      "Monitor only until a real submit, contact, or upstream ingestion path appears.",
  },
  {
    id: "mcpserverfinder",
    name: "MCP Server Finder",
    listing_url: "https://www.mcpserverfinder.com/?q=packrift",
    refresh_url: "mailto:info@mcpserverfinder.com",
    priority: "medium",
    requested_action:
      "Review and send the existing Gmail draft with the hosted endpoint, marketplace manifest, source-specific update card, and first-useful-run proof.",
  },
  {
    id: "mcpserver_cc",
    name: "mcpserver.cc",
    listing_url: "https://mcpserver.cc/",
    refresh_url: "https://mcpserver.cc/submit",
    priority: "medium",
    requested_action:
      "Monitor the submitted API listing for publication and provide the source-specific update card if review asks for hosted endpoint proof.",
  },
  {
    id: "mcpserverspot",
    name: "MCP Server Spot",
    listing_url: "https://www.mcpserverspot.com/servers?q=packrift",
    refresh_url: "https://www.mcpserverspot.com/submit",
    priority: "medium",
    requested_action:
      "Monitor the submitted public form listing for publication and provide the source-specific update card if review asks for hosted endpoint proof.",
  },
  {
    id: "cursor_directory",
    name: "Cursor Directory",
    listing_url: "https://cursor.directory/",
    refresh_url: "https://cursor.directory/plugins/new",
    priority: "medium",
    requested_action:
      "Submit Packrift MCP for Cursor users with the hosted MCP config and tracked start source.",
  },
  {
    id: "mcpcentral",
    name: "MCP Central",
    listing_url: "https://mcpcentral.io/servers",
    refresh_url: "https://mcpcentral.io/submit-server",
    priority: "medium",
    requested_action:
      "Submit Packrift MCP to MCP Central or request review if browser-side auth is required.",
  },
  {
    id: "mcpfinder",
    name: "MCPfinder",
    listing_url: "https://www.mcpfinder.org/",
    refresh_url: "https://www.mcpfinder.org/submit",
    priority: "medium",
    requested_action:
      "MCPfinder reports the Packrift MCP repository is already submitted and under review; monitor approval and provide endpoint proof if review asks.",
  },
  {
    id: "mcpskills",
    name: "MCPSkills",
    listing_url: "https://mcpskills.app/servers",
    refresh_url: "https://mcpskills.app/submit",
    priority: "medium",
    requested_action: "Review the direct submission and list Packrift from the public GitHub repo with the hosted no-auth MCP endpoint.",
  },
  {
    id: "agentndx",
    name: "AgentNDX",
    listing_url: "https://agentndx.ai/browse",
    refresh_url: "https://agentndx.ai/submit",
    priority: "medium",
    requested_action: "Review the direct submission and list Packrift as an MCP protocol service with the hosted start page.",
  },
  {
    id: "docker_mcp_catalog",
    name: "Docker MCP Catalog",
    listing_url: "https://github.com/docker/mcp-registry/pull/3388",
    refresh_url: "https://github.com/docker/mcp-registry/pull/3388",
    priority: "medium",
    requested_action:
      "Review and merge the hosted remote-server entry so Packrift can appear in Docker Desktop MCP Toolkit and Docker MCP Catalog discovery.",
  },
] as const;

export function mcpDirectoryRefreshPayload(runtime: DirectoryRefreshRuntime) {
  const genericFirstUsefulRun = mcpFirstUsefulRun("generic", "generic_streamable_http");
  const proofSummary = `${runtime.toolsCount} tools, ${runtime.promptsCount} prompts, ${runtime.resourcesCount} resources, hosted Streamable HTTP endpoint, public start page, public server card, Agent Web manifest, CapIndex capability card, live tool discovery JSON and Markdown, builder-ready UCP starter catalog, storefront integration kit, flat import feed, and copy-paste shelf renderer for curated storefront shelves, legacy OpenAPI discovery, AI plugin-style discovery manifests, copy-ready MCP client config, copy-ready first-useful-run agent prompt, source-attributed /r/config/{source} config links, tracked /r/install/{source}/{target} install-action links, browser-executable /r/run/{source}/{target} first-run proof, reviewer-to-real-MCP /r/activate/{source} handoffs, browser runner /r/activate/{source}?format=html, source activation queue, activation wave, official registry entry, install matrix, workflow gallery, browser-agent bridge, Browserbase Browse SKILL.md, Browserbase Browse skill pack, usage snapshot, and MCP-attributed cart handoff candidates.`;
  return {
    release: "PACKRIFT-MCP-DIRECTORY-REFRESH-R34",
    generated_at: new Date().toISOString(),
    purpose:
      "Single public recrawl pack for MCP directories, marketplaces, and agent indexes that need current Packrift MCP listing fields and live proof URLs.",
    canonical_listing: {
      server_name: "Packrift MCP",
      registry_name: "io.github.Packrift/packrift-mcp",
      short_description:
        "Exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match.",
      long_description:
        "Packrift MCP lets AI agents find exact-spec packaging products, confirm live price and inventory, compare alternatives, estimate shipping, and hand off attributed carts to Packrift.",
      category: "Business",
      tags: ["mcp", "ecommerce", "packaging", "procurement", "shopify", "cart-handoff", "inventory"],
      version: runtime.serverVersion,
      tool_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
      official_registry: OFFICIAL_REGISTRY_URL,
      official_registry_search: OFFICIAL_REGISTRY_SEARCH_URL,
      website_url: "https://packrift.com/pages/packrift-ai-agent-instructions",
      start_url: MCP_START_URL,
      tracked_start_template: MCP_TRACKED_START_TEMPLATE,
      tracked_config_template: MCP_TRACKED_CONFIG_TEMPLATE,
      tracked_install_template: TRACKED_INSTALL_TEMPLATE,
      tracked_run_template: TRACKED_RUN_TEMPLATE,
      tracked_reviewer_activation_template: MCP_TRACKED_REVIEWER_ACTIVATION_TEMPLATE,
      tracked_reviewer_activation_html_template: MCP_TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE,
      tracked_config_generic: MCP_TRACKED_CONFIG_GENERIC_URL,
      tracked_install_examples: {
        generic_streamable_http: trackedInstallUrl("generic", "generic_streamable_http"),
        claude_code: trackedInstallUrl("generic", "claude_code"),
        codex: trackedInstallUrl("generic", "codex"),
        cursor_windsurf_vscode: trackedInstallUrl("generic", "cursor_windsurf_vscode"),
        cline: trackedInstallUrl("generic", "cline"),
      },
      tracked_first_run_examples: {
        generic_streamable_http: trackedRunUrl("generic", "generic_streamable_http"),
        browser: `${trackedRunUrl("generic", "generic_streamable_http")}&format=html`,
        live_proof: `${trackedRunUrl("generic", "generic_streamable_http")}&execute=1`,
      },
      tracked_reviewer_activation_examples: {
        generic: "https://mcp.packrift.com/r/activate/generic",
        mcp_so: "https://mcp.packrift.com/r/activate/mcp_so",
        browse_sh: "https://mcp.packrift.com/r/activate/browse_sh",
      },
      tracked_reviewer_activation_html_examples: {
        generic: "https://mcp.packrift.com/r/activate/generic?format=html",
        mcp_so: "https://mcp.packrift.com/r/activate/mcp_so?format=html",
        browse_sh: "https://mcp.packrift.com/r/activate/browse_sh?format=html",
      },
      first_useful_run_agent_prompt: genericFirstUsefulRun.agent_prompt,
      first_useful_run_agent_prompt_success_criteria: genericFirstUsefulRun.agent_prompt_success_criteria,
      tracked_start_source_policy: MCP_TRACKED_START_SOURCE_POLICY,
      repository_url: "https://github.com/Packrift/packrift-mcp",
      remote_endpoint: MCP_ENDPOINT,
      contact_email: "farhan@packrift.com",
      install_config: {
        mcpServers: {
          packrift: {
            type: "http",
            url: MCP_ENDPOINT,
          },
        },
      },
      client_config_url: MCP_CLIENT_CONFIG_URL,
      source_activation_queue_url: MCP_SOURCE_ACTIVATION_QUEUE_URL,
      source_activation_sitemap_url: MCP_SOURCE_ACTIVATION_SITEMAP_URL,
      activation_wave_url: MCP_ACTIVATION_WAVE_URL,
      activation_wave_markdown_url: MCP_ACTIVATION_WAVE_MARKDOWN_URL,
      activation_wave_html_url: MCP_ACTIVATION_WAVE_HTML_URL,
      marketplace_manifest_url: MCP_MARKETPLACE_MANIFEST_URL,
      tool_discovery_json_url: MCP_TOOL_DISCOVERY_URL,
      tool_discovery_markdown_url: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
      ucp_starter_catalog_json_url: MCP_UCP_STARTER_CATALOG_URL,
      ucp_starter_catalog_markdown_url: MCP_UCP_STARTER_CATALOG_MARKDOWN_URL,
      ucp_starter_catalog_html_url: MCP_UCP_STARTER_CATALOG_HTML_URL,
      ucp_builder_kit_json_url: MCP_UCP_BUILDER_KIT_URL,
      ucp_builder_kit_markdown_url: MCP_UCP_BUILDER_KIT_MARKDOWN_URL,
      ucp_builder_kit_html_url: MCP_UCP_BUILDER_KIT_HTML_URL,
      ucp_storefront_import_json_url: MCP_UCP_STOREFRONT_IMPORT_URL,
      ucp_storefront_import_jsonl_url: MCP_UCP_STOREFRONT_IMPORT_JSONL_URL,
      ucp_storefront_import_csv_url: MCP_UCP_STOREFRONT_IMPORT_CSV_URL,
      ucp_storefront_import_html_url: MCP_UCP_STOREFRONT_IMPORT_HTML_URL,
      ucp_storefront_shelf_json_url: MCP_UCP_STOREFRONT_SHELF_URL,
      ucp_storefront_shelf_html_url: MCP_UCP_STOREFRONT_SHELF_HTML_URL,
      ucp_storefront_shelf_embed_js_url: MCP_UCP_STOREFRONT_SHELF_EMBED_JS_URL,
      ucp_storefront_adoption_json_url: MCP_UCP_STOREFRONT_ADOPTION_URL,
      ucp_storefront_adoption_html_url: MCP_UCP_STOREFRONT_ADOPTION_HTML_URL,
      ucp_builder_activation_handoff_json_url: MCP_UCP_BUILDER_ACTIVATION_HANDOFF_URL,
      ucp_builder_activation_handoff_html_url: MCP_UCP_BUILDER_ACTIVATION_HANDOFF_HTML_URL,
      ucp_shipping_supplies_starter_kit_json_url: PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_URL,
      ucp_shipping_supplies_starter_kit_html_url: PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      ucp_shipping_supplies_storefront_template_json_url: PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_URL,
      ucp_shipping_supplies_storefront_template_html_url: PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      ucp_storefront_shelf_demo_stack412_url: MCP_UCP_STOREFRONT_SHELF_DEMO_STACK412_URL,
      root_mcp_json: ROOT_MCP_JSON_URL,
      well_known_mcp_json: WELL_KNOWN_MCP_JSON_URL,
      openapi_json: MCP_OPENAPI_JSON_URL,
      well_known_openapi_json: MCP_WELL_KNOWN_OPENAPI_JSON_URL,
      ai_plugin_json: MCP_AI_PLUGIN_JSON_URL,
      well_known_ai_plugin_json: MCP_WELL_KNOWN_AI_PLUGIN_JSON_URL,
      agent_web_manifest: MCP_AGENT_WEB_MANIFEST_URL,
      root_agent_web_manifest: MCP_ROOT_AGENT_WEB_MANIFEST_URL,
      capability_card: MCP_CAPABILITY_CARD_URL,
      public_docs_hygiene: PUBLIC_DOCS_HYGIENE,
      proof_summary: proofSummary,
    },
    live_proof: {
      health: "https://mcp.packrift.com/health",
      manifest: "https://mcp.packrift.com/manifest",
      mcp_start: MCP_START_JSON_URL,
      tracked_start_template: MCP_TRACKED_START_TEMPLATE,
      tracked_start_partner_demo: "https://mcp.packrift.com/r/start/partner_demo",
      tracked_config_template: MCP_TRACKED_CONFIG_TEMPLATE,
      tracked_config_generic: MCP_TRACKED_CONFIG_GENERIC_URL,
      tracked_install_template: TRACKED_INSTALL_TEMPLATE,
      tracked_install_codex_generic: trackedInstallUrl("generic", "codex"),
      tracked_run_template: TRACKED_RUN_TEMPLATE,
      tracked_run_generic: trackedRunUrl("generic", "generic_streamable_http"),
      tracked_run_generic_browser: `${trackedRunUrl("generic", "generic_streamable_http")}&format=html`,
      tracked_run_generic_execute: `${trackedRunUrl("generic", "generic_streamable_http")}&execute=1`,
      copy_ready_agent_prompt_locations: [
        "https://mcp.packrift.com/ai/mcp-start.json first_useful_run.agent_prompt",
        "https://mcp.packrift.com/ai/mcp-client-config.json first_useful_run.agent_prompt",
        "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json first_useful_run_agent_prompt",
        `${trackedRunUrl("generic", "generic_streamable_http")}&format=html Copy agent prompt button`,
        "https://mcp.packrift.com/r/activate/generic?format=html Copy agent prompt button",
      ],
      tracked_reviewer_activation_template: MCP_TRACKED_REVIEWER_ACTIVATION_TEMPLATE,
      tracked_reviewer_activation_html_template: MCP_TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE,
      tracked_reviewer_activation_generic: "https://mcp.packrift.com/r/activate/generic",
      tracked_reviewer_activation_html_generic: "https://mcp.packrift.com/r/activate/generic?format=html",
      reviewer_activation: REVIEWER_ACTIVATION_URL,
      first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
      install_actions: INSTALL_ACTIONS_URL,
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      official_registry: OFFICIAL_REGISTRY_URL,
      official_registry_search: OFFICIAL_REGISTRY_SEARCH_URL,
      glama_claim: "https://mcp.packrift.com/.well-known/glama.json",
      marketplace_manifest: MCP_MARKETPLACE_MANIFEST_URL,
      tool_discovery_json: MCP_TOOL_DISCOVERY_URL,
      tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
      ucp_starter_catalog_json: MCP_UCP_STARTER_CATALOG_URL,
      ucp_starter_catalog_markdown: MCP_UCP_STARTER_CATALOG_MARKDOWN_URL,
      ucp_starter_catalog_html: MCP_UCP_STARTER_CATALOG_HTML_URL,
      ucp_builder_kit_json: MCP_UCP_BUILDER_KIT_URL,
      ucp_builder_kit_markdown: MCP_UCP_BUILDER_KIT_MARKDOWN_URL,
      ucp_builder_kit_html: MCP_UCP_BUILDER_KIT_HTML_URL,
      ucp_storefront_import_json: MCP_UCP_STOREFRONT_IMPORT_URL,
      ucp_storefront_import_jsonl: MCP_UCP_STOREFRONT_IMPORT_JSONL_URL,
      ucp_storefront_import_csv: MCP_UCP_STOREFRONT_IMPORT_CSV_URL,
      ucp_storefront_import_html: MCP_UCP_STOREFRONT_IMPORT_HTML_URL,
      ucp_storefront_shelf_json: MCP_UCP_STOREFRONT_SHELF_URL,
      ucp_storefront_shelf_html: MCP_UCP_STOREFRONT_SHELF_HTML_URL,
      ucp_storefront_shelf_embed_js: MCP_UCP_STOREFRONT_SHELF_EMBED_JS_URL,
      ucp_storefront_adoption_json: MCP_UCP_STOREFRONT_ADOPTION_URL,
      ucp_storefront_adoption_html: MCP_UCP_STOREFRONT_ADOPTION_HTML_URL,
      ucp_builder_activation_handoff_json: MCP_UCP_BUILDER_ACTIVATION_HANDOFF_URL,
      ucp_builder_activation_handoff_html: MCP_UCP_BUILDER_ACTIVATION_HANDOFF_HTML_URL,
      ucp_shipping_supplies_starter_kit_json: PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_URL,
      ucp_shipping_supplies_starter_kit_html: PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      ucp_shipping_supplies_storefront_template_json: PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_URL,
      ucp_shipping_supplies_storefront_template_html: PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      ucp_storefront_shelf_demo_stack412: MCP_UCP_STOREFRONT_SHELF_DEMO_STACK412_URL,
      tools_list: `${MCP_ENDPOINT} via JSON-RPC tools/list`,
      resources_list: `${MCP_ENDPOINT} via JSON-RPC resources/list`,
      prompts_list: `${MCP_ENDPOINT} via JSON-RPC prompts/list`,
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      client_config: MCP_CLIENT_CONFIG_URL,
      root_mcp_json: ROOT_MCP_JSON_URL,
      well_known_mcp_json: WELL_KNOWN_MCP_JSON_URL,
      openapi_json: MCP_OPENAPI_JSON_URL,
      well_known_openapi_json: MCP_WELL_KNOWN_OPENAPI_JSON_URL,
      ai_plugin_json: MCP_AI_PLUGIN_JSON_URL,
      well_known_ai_plugin_json: MCP_WELL_KNOWN_AI_PLUGIN_JSON_URL,
      agent_web_manifest: MCP_AGENT_WEB_MANIFEST_URL,
      root_agent_web_manifest: MCP_ROOT_AGENT_WEB_MANIFEST_URL,
      capability_card: MCP_CAPABILITY_CARD_URL,
      source_readme: SOURCE_README_URL,
      source_readme_raw: SOURCE_README_RAW_URL,
      public_docs_hygiene: PUBLIC_DOCS_HYGIENE,
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      funnel_snapshot: MCP_FUNNEL_SNAPSHOT_URL,
      source_activation_queue: MCP_SOURCE_ACTIVATION_QUEUE_URL,
      source_activation_queue_markdown: MCP_SOURCE_ACTIVATION_QUEUE_MARKDOWN_URL,
      source_activation_sitemap: MCP_SOURCE_ACTIVATION_SITEMAP_URL,
      activation_wave: MCP_ACTIVATION_WAVE_URL,
      activation_wave_markdown: MCP_ACTIVATION_WAVE_MARKDOWN_URL,
      activation_wave_html: MCP_ACTIVATION_WAVE_HTML_URL,
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      root_browserbase_browse_skill_md: ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL,
      browserbase_browse_skill_pack: BROWSERBASE_BROWSE_SKILL_PACK_URL,
      canonical_browserbase_browse_skill_md: CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL,
      directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      agent_capture_outreach: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
      docker_mcp_catalog_pr: "https://github.com/docker/mcp-registry/pull/3388",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
    },
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    priority_refresh_targets: DIRECTORY_TARGETS.map((target) => ({
      ...target,
      tracked_start_url: `https://mcp.packrift.com/r/start/${target.id}`,
      tracked_config_url: `https://mcp.packrift.com/r/config/${target.id}`,
      tracked_install_urls: {
        generic_streamable_http: trackedInstallUrl(target.id, "generic_streamable_http"),
        claude_code: trackedInstallUrl(target.id, "claude_code"),
        codex: trackedInstallUrl(target.id, "codex"),
        cursor_windsurf_vscode: trackedInstallUrl(target.id, "cursor_windsurf_vscode"),
        cline: trackedInstallUrl(target.id, "cline"),
        mcp_marketplace: trackedInstallUrl(target.id, "mcp_marketplace"),
      },
      tracked_run_urls: {
        generic_streamable_http: trackedRunUrl(target.id, "generic_streamable_http"),
        generic_streamable_http_browser: `${trackedRunUrl(target.id, "generic_streamable_http")}&format=html`,
        generic_streamable_http_execute: `${trackedRunUrl(target.id, "generic_streamable_http")}&execute=1`,
        mcp_marketplace: trackedRunUrl(target.id, "mcp_marketplace"),
        mcp_marketplace_execute: `${trackedRunUrl(target.id, "mcp_marketplace")}&execute=1`,
      },
      tracked_reviewer_activation_url: `https://mcp.packrift.com/r/activate/${target.id}`,
      tracked_reviewer_activation_html_url: `https://mcp.packrift.com/r/activate/${target.id}?format=html`,
      copy_ready_agent_prompt_url: `${trackedRunUrl(target.id, "generic_streamable_http")}&format=html`,
      crawler_input_urls: {
        marketplace_manifest: MCP_MARKETPLACE_MANIFEST_URL,
        tool_discovery_json: MCP_TOOL_DISCOVERY_URL,
        tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
        ucp_starter_catalog_json: MCP_UCP_STARTER_CATALOG_URL,
        ucp_starter_catalog_html: MCP_UCP_STARTER_CATALOG_HTML_URL,
        ucp_builder_kit_json: MCP_UCP_BUILDER_KIT_URL,
        ucp_builder_kit_html: MCP_UCP_BUILDER_KIT_HTML_URL,
        ucp_storefront_import_json: MCP_UCP_STOREFRONT_IMPORT_URL,
        ucp_storefront_import_csv: MCP_UCP_STOREFRONT_IMPORT_CSV_URL,
        ucp_storefront_import_html: MCP_UCP_STOREFRONT_IMPORT_HTML_URL,
        ucp_storefront_shelf_json: MCP_UCP_STOREFRONT_SHELF_URL,
        ucp_storefront_shelf_html: MCP_UCP_STOREFRONT_SHELF_HTML_URL,
        ucp_storefront_shelf_embed_js: MCP_UCP_STOREFRONT_SHELF_EMBED_JS_URL,
        ucp_storefront_adoption_json: MCP_UCP_STOREFRONT_ADOPTION_URL,
        ucp_storefront_adoption_html: MCP_UCP_STOREFRONT_ADOPTION_HTML_URL,
        ucp_builder_activation_handoff_json: MCP_UCP_BUILDER_ACTIVATION_HANDOFF_URL,
        ucp_builder_activation_handoff_html: MCP_UCP_BUILDER_ACTIVATION_HANDOFF_HTML_URL,
        ucp_shipping_supplies_starter_kit_json: PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_URL,
        ucp_shipping_supplies_starter_kit_html: PACKRIFT_UCP_SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
        ucp_shipping_supplies_storefront_template_json: PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_URL,
        ucp_shipping_supplies_storefront_template_html: PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
        ucp_storefront_shelf_demo_stack412: MCP_UCP_STOREFRONT_SHELF_DEMO_STACK412_URL,
        openapi_json: MCP_OPENAPI_JSON_URL,
        well_known_openapi_json: MCP_WELL_KNOWN_OPENAPI_JSON_URL,
        ai_plugin_json: MCP_AI_PLUGIN_JSON_URL,
        well_known_ai_plugin_json: MCP_WELL_KNOWN_AI_PLUGIN_JSON_URL,
        source_activation_sitemap: MCP_SOURCE_ACTIVATION_SITEMAP_URL,
        source_activation_queue: MCP_SOURCE_ACTIVATION_QUEUE_URL,
        activation_wave: MCP_ACTIVATION_WAVE_URL,
      },
      agent_prompt_acceptance_rule:
        "Paste the source-specific agent prompt into the MCP host and require tools/list, get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url before treating this source as activated.",
    })),
    recrawl_request:
      `Please recrawl Packrift MCP as a hosted no-auth Streamable HTTP MCP server at ${MCP_ENDPOINT}. Use ${MCP_MARKETPLACE_MANIFEST_URL} as the compact marketplace manifest, ${MCP_AGENT_WEB_MANIFEST_URL} for Agent Web discovery, ${MCP_CAPABILITY_CARD_URL} for capability-card discovery, ${MCP_UCP_STARTER_CATALOG_HTML_URL} or ${MCP_UCP_STARTER_CATALOG_URL} for the curated-UCP storefront starter catalog, ${MCP_UCP_BUILDER_KIT_HTML_URL} or ${MCP_UCP_BUILDER_KIT_URL} for the storefront integration kit, ${MCP_UCP_STOREFRONT_IMPORT_HTML_URL}, ${MCP_UCP_STOREFRONT_IMPORT_URL}, or ${MCP_UCP_STOREFRONT_IMPORT_CSV_URL} for flat import rows that add Packrift as a packaging shelf, ${MCP_UCP_STOREFRONT_SHELF_HTML_URL} or ${MCP_UCP_STOREFRONT_SHELF_EMBED_JS_URL} for copy-paste shelf rendering, ${PACKRIFT_UCP_SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL} for a copy-ready shipping-supplies storefront scaffold, ${MCP_OPENAPI_JSON_URL} or ${MCP_WELL_KNOWN_OPENAPI_JSON_URL} for legacy OpenAPI discovery, ${MCP_AI_PLUGIN_JSON_URL} or ${MCP_WELL_KNOWN_AI_PLUGIN_JSON_URL} for AI plugin-style discovery, use ${MCP_TOOL_DISCOVERY_URL} or ${MCP_TOOL_DISCOVERY_MARKDOWN_URL} for the current live ${runtime.toolsCount}-tool surface, use ${MCP_SOURCE_ACTIVATION_SITEMAP_URL} as the source-specific activation sitemap, use ${MCP_ACTIVATION_WAVE_URL} as the current non-duplicative activation wave for real host-side tool calls, use tracked install-action links like ${trackedInstallUrl("generic", "codex")} when linking to client-specific setup, use browser proof links like ${trackedRunUrl("generic", "generic_streamable_http")}&execute=1 when validating the first useful run, use the Copy agent prompt button at ${trackedRunUrl("generic", "generic_streamable_http")}&format=html, use ${REVIEWER_ACTIVATION_URL} plus /r/activate/{source}?format=html to convert proof clicks into real MCP client calls, and use ${MCP_SOURCE_ACTIVATION_QUEUE_URL} to pick the next source-specific activation run. Current proof: ${proofSummary}`,
    operating_rules: [
      "The hosted endpoint is the primary listing target; do not require users to self-host or provide a Shopify token for normal MCP use.",
      "Use the official registry name io.github.Packrift/packrift-mcp and the remote endpoint https://mcp.packrift.com/mcp.",
      "Use /r/start/{source} for directory, partner, campaign, and agent handoff attribution; use /r/config/{source} when the directory or host can fetch MCP JSON config directly; use /r/install/{source}/{target} when the directory can link to client-specific setup. Custom source slugs are allowed when they match ^[a-z0-9_]{2,64}$.",
      "Use /r/run/{source}/{target}?format=html for reviewer-friendly first-run pages and /r/run/{source}/{target}?execute=1 for one-click live proof.",
      "Use the copy-ready agent prompt in mcp-start, mcp-client-config, directory submit actions, first-run pages, and reviewer activation pages to move installs into real tool calls.",
      "Use /r/activate/{source}?format=html when a reviewer has clicked proof but still needs a browser-run real MCP client sequence ending in create_cart_url.",
      "Use the source activation queue to decide which directory or agent host needs the next start, install, first-run, tool-call, cart-landing, or order event.",
      "Use the activation wave when a directory or agent host needs a current, source-aware task packet for real host-side MCP tool calls; do not turn it into a duplicate CLI or separate buyer surface.",
      "Keep stale directory listings separate from the live MCP truth. The live health, server card, tools/list, resources/list, prompts/list, current raw README, and public docs hygiene gate are authoritative.",
      "If a directory shows stale copied README snippets, recrawl the raw README, marketplace manifest, tool discovery JSON, and this refresh pack before displaying cached examples.",
      "Discovery is not the final goal. Recrawls should drive external MCP sessions, tool calls, stamped cart landings, and measurable revenue.",
    ],
    success_metrics: [
      "stale directory listings become current",
      "directory referral sessions appear in analytics",
      "tracked install-action opens appear by directory source and target in the usage snapshot",
      "tracked first-run browser executions appear by directory source in the usage and funnel snapshots",
      "copy-ready agent prompt opens or copy events turn into source-attributed first-run executions",
      "reviewer activation handoff opens appear by directory source before real MCP tool calls",
      "external agents call tools/list or resources/list from directory referrals",
      "real workflows call get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url",
      "qualified MCP cart landings and MCP-attributed sales become visible",
    ],
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function mcpDirectoryRefreshMarkdown(runtime: DirectoryRefreshRuntime): string {
  const payload = mcpDirectoryRefreshPayload(runtime);
  const targetRows = payload.priority_refresh_targets
    .map(
      (target) =>
        `| ${escapeMarkdown(target.name)} | ${target.priority} | ${target.listing_url} | ${target.refresh_url} | ${target.tracked_install_urls.codex} | ${target.tracked_run_urls.generic_streamable_http_execute} | ${target.copy_ready_agent_prompt_url} | ${target.tracked_reviewer_activation_url} | ${target.tracked_reviewer_activation_html_url} | ${escapeMarkdown(target.requested_action)} |`
    )
    .join("\n");
  const proofRows = Object.entries(payload.live_proof)
    .map(([key, value]) => `- ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n");
  const rules = payload.operating_rules.map((rule) => `- ${rule}`).join("\n");
  return [
    "# Packrift MCP Directory Refresh Pack",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical MCP endpoint: ${payload.canonical_listing.remote_endpoint}`,
    "",
    "## Canonical Listing Copy",
    "",
    `Server name: ${payload.canonical_listing.server_name}`,
    `Registry name: ${payload.canonical_listing.registry_name}`,
    `Official registry version: ${payload.canonical_listing.official_registry}`,
    `Registry search fallback: ${payload.canonical_listing.official_registry_search}`,
    `Short description: ${payload.canonical_listing.short_description}`,
    `Long description: ${payload.canonical_listing.long_description}`,
    `Start page: ${payload.canonical_listing.start_url}`,
    `Tracked start template: ${payload.canonical_listing.tracked_start_template}`,
    `Tracked config template: ${payload.canonical_listing.tracked_config_template}`,
    `Tracked install template: ${payload.canonical_listing.tracked_install_template}`,
    `Tracked first-run template: ${payload.canonical_listing.tracked_run_template}`,
    `Tracked reviewer activation template: ${payload.canonical_listing.tracked_reviewer_activation_template}`,
    `Tracked reviewer activation browser runner template: ${payload.canonical_listing.tracked_reviewer_activation_html_template}`,
    `Tracked Codex install example: ${payload.canonical_listing.tracked_install_examples.codex}`,
    `Tracked live proof example: ${payload.canonical_listing.tracked_first_run_examples.live_proof}`,
    `Tracked reviewer activation example: ${payload.canonical_listing.tracked_reviewer_activation_examples.generic}`,
    `Tracked reviewer activation browser runner example: ${payload.canonical_listing.tracked_reviewer_activation_html_examples.generic}`,
    `Marketplace manifest: ${payload.canonical_listing.marketplace_manifest_url}`,
    `Live tool discovery JSON: ${payload.canonical_listing.tool_discovery_json_url}`,
    `Live tool discovery Markdown: ${payload.canonical_listing.tool_discovery_markdown_url}`,
    `UCP starter catalog JSON: ${payload.canonical_listing.ucp_starter_catalog_json_url}`,
    `UCP starter catalog HTML: ${payload.canonical_listing.ucp_starter_catalog_html_url}`,
    `UCP builder kit JSON: ${payload.canonical_listing.ucp_builder_kit_json_url}`,
    `UCP builder kit HTML: ${payload.canonical_listing.ucp_builder_kit_html_url}`,
    `UCP storefront import JSON: ${payload.canonical_listing.ucp_storefront_import_json_url}`,
    `UCP storefront import JSONL: ${payload.canonical_listing.ucp_storefront_import_jsonl_url}`,
    `UCP storefront import CSV: ${payload.canonical_listing.ucp_storefront_import_csv_url}`,
    `UCP storefront import HTML: ${payload.canonical_listing.ucp_storefront_import_html_url}`,
    `UCP storefront shelf JSON: ${payload.canonical_listing.ucp_storefront_shelf_json_url}`,
    `UCP storefront shelf HTML: ${payload.canonical_listing.ucp_storefront_shelf_html_url}`,
    `UCP storefront shelf embed JS: ${payload.canonical_listing.ucp_storefront_shelf_embed_js_url}`,
    `UCP storefront adoption JSON: ${payload.canonical_listing.ucp_storefront_adoption_json_url}`,
    `UCP storefront adoption HTML: ${payload.canonical_listing.ucp_storefront_adoption_html_url}`,
    `UCP builder activation handoff JSON: ${payload.canonical_listing.ucp_builder_activation_handoff_json_url}`,
    `UCP builder activation handoff HTML: ${payload.canonical_listing.ucp_builder_activation_handoff_html_url}`,
    `Stack412-style shelf demo: ${payload.canonical_listing.ucp_storefront_shelf_demo_stack412_url}`,
    `OpenAPI discovery adapter: ${payload.canonical_listing.openapi_json}`,
    `Well-known OpenAPI discovery adapter: ${payload.canonical_listing.well_known_openapi_json}`,
    `AI plugin-style manifest: ${payload.canonical_listing.ai_plugin_json}`,
    `Well-known AI plugin-style manifest: ${payload.canonical_listing.well_known_ai_plugin_json}`,
    `Source activation sitemap: ${payload.canonical_listing.source_activation_sitemap_url}`,
    `Activation wave: ${payload.canonical_listing.activation_wave_url}`,
    `Activation wave HTML: ${payload.canonical_listing.activation_wave_html_url}`,
    "Copy-ready agent prompt:",
    "",
    "```text",
    payload.canonical_listing.first_useful_run_agent_prompt,
    "```",
    "",
    `Tracked source format: ${payload.canonical_listing.tracked_start_source_policy.accepted_source_format}`,
    `Repository: ${payload.canonical_listing.repository_url}`,
    `Source README: ${payload.canonical_listing.public_docs_hygiene.current_source_docs.readme}`,
    `Raw README for recrawlers: ${payload.canonical_listing.public_docs_hygiene.current_source_docs.raw_readme}`,
    `Public docs hygiene: ${payload.canonical_listing.public_docs_hygiene.status} (${payload.canonical_listing.public_docs_hygiene.build_gate})`,
    `Website: ${payload.canonical_listing.website_url}`,
    `Tags: ${payload.canonical_listing.tags.join(", ")}`,
    `Proof summary: ${payload.canonical_listing.proof_summary}`,
    "",
    "```json",
    JSON.stringify(payload.canonical_listing.install_config, null, 2),
    "```",
    "",
    "## Priority Refresh Targets",
    "",
    "| Directory | Priority | Current listing | Refresh URL | Tracked Codex install URL | Live proof URL | Agent prompt URL | Activation handoff | Activation runner | Requested action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    targetRows,
    "",
    "## Live Proof URLs",
    "",
    proofRows,
    "",
    "## Operating Rules",
    "",
    rules,
    "",
    "## Recrawl Request",
    "",
    payload.recrawl_request,
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    "",
  ].join("\n");
}
