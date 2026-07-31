#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const OUT_ROOT = resolve(REPO_ROOT, "outputs/mcp-directory-submission-pack");
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const SERVER_JSON = JSON.parse(readFileSync(resolve(REPO_ROOT, "server.json"), "utf8"));
const DISTRIBUTION_LATEST = resolve(REPO_ROOT, "outputs/mcp-distribution-check/latest.json");

const CONTACT_EMAIL_PLACEHOLDER = "[directory contact email]";
const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const RUN_CACHE_BUST = Date.now().toString(36);
const PACKRIFT_ORIGIN = "https://mcp.packrift.com";
const TRACKED_INSTALL_TEMPLATE = "https://mcp.packrift.com/r/install/{source}/{target}";
const TRACKED_RUN_TEMPLATE = "https://mcp.packrift.com/r/run/{source}/{target}";

const TARGETS = [
  {
    name: "mcpservers_org",
    label: "mcpservers.org",
    listing_url: "https://mcpservers.org/servers/packrift/packrift-mcp",
    submission_url: "https://mcpservers.org/submit",
    category: "Other",
    priority: "high",
    action: "Submit the GitHub repo and request a recrawl so the listing includes the current tools and cart-handoff resources.",
  },
  {
    name: "glama_connector",
    label: "Glama Connector",
    listing_url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    submission_url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    category: "Business",
    priority: "high",
    action: "Monitor the hosted Glama connector; it should stay healthy and list the 15 live tools.",
  },
  {
    name: "glama_server_listing",
    label: "Glama Server Listing",
    listing_url: "https://glama.ai/mcp/servers/ye4xxr7qiu",
    submission_url: "https://glama.ai/",
    category: "Business",
    priority: "high",
    action:
      "Use Glama source-listing admin to claim the server, configure the repo Dockerfile, make a Glama release, then sync the server so quality scoring can run.",
  },
  {
    name: "mcp_directory",
    label: "MCP.Directory",
    listing_url: "https://mcp.directory/servers?q=packrift",
    submission_url: "https://mcp.directory/submit",
    category: "Business",
    priority: "high",
    action: "Submit the GitHub repo, remote endpoint, short description, and contact email.",
  },
  {
    name: "anthropic_connectors_directory",
    label: "Claude Connectors Directory",
    listing_url: "https://claude.com/connectors",
    submission_url: "https://clau.de/mcp-directory-submission",
    category: "Business",
    priority: "high",
    action: "Submit Packrift MCP through an authenticated Google Forms session with hosted endpoint, no-auth policy, and first-run proof.",
  },
  {
    name: "smithery",
    label: "Smithery",
    listing_url: "https://smithery.ai/servers?q=Packrift",
    submission_url: "https://smithery.ai/new",
    category: "Business",
    priority: "high",
    action: "Publish or claim Packrift MCP on Smithery after authenticating, using the hosted endpoint and public server card.",
  },
  {
    name: "cline_mcp_marketplace",
    label: "Cline MCP Marketplace",
    listing_url: "https://github.com/cline/mcp-marketplace/issues/1610",
    submission_url: "https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml",
    category: "Business",
    priority: "high",
    action: "Keep the Packrift Cline MCP Marketplace submission issue current until the listing is published.",
  },
  {
    name: "mcp_so",
    label: "MCP.so",
    listing_url: "https://mcp.so/servers?keyword=Packrift",
    submission_url: "https://mcp.so/submit",
    category: "Business",
    priority: "high",
    action: "Submit or claim Packrift MCP with hosted endpoint, tracked start URL, and exact-spec packaging copy.",
  },
  {
    name: "punkpeye_awesome_mcp",
    label: "punkpeye/awesome-mcp-servers",
    listing_url: "https://github.com/punkpeye/awesome-mcp-servers/pull/5606",
    submission_url: "https://github.com/punkpeye/awesome-mcp-servers/pull/5606",
    category: "Business",
    priority: "high",
    action:
      "Keep the canonical Packrift PR #5606 current until the Glama score blocker clears; do not create duplicate automated PRs.",
  },
  {
    name: "browse_sh",
    label: "Browserbase Browse / browse.sh",
    listing_url: "https://browse.sh/",
    submission_url: "https://browse.sh/",
    category: "Shopping",
    priority: "high",
    action:
      "Submit Packrift as a Browse catalog skill with the root SKILL.md, Browse skill pack, hosted MCP endpoint, and exact-spec packaging procurement copy.",
  },
  {
    name: "pulsemcp_packrift",
    label: "PulseMCP",
    listing_url: "https://www.pulsemcp.com/servers/packrift",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    category: "Business",
    priority: "high",
    action: "Use official-registry publication and public server.json as the recrawl source; this checker may see a 403 from PulseMCP.",
  },
  {
    name: "mcpmarket_com",
    label: "MCP Market",
    listing_url: "https://mcpmarket.com/server/packrift",
    submission_url: "https://mcpmarket.com/submit",
    category: "Business",
    priority: "medium",
    action: "Claim or update the MCP Market listing so it points at the hosted endpoint and current server card.",
  },
  {
    name: "cursor_directory",
    label: "Cursor Directory",
    listing_url: "https://cursor.directory/",
    submission_url: "https://cursor.directory/plugins/new",
    category: "Business",
    priority: "medium",
    action: "Submit Packrift MCP for Cursor users with the hosted MCP config and tracked start source.",
  },
  {
    name: "mcpcentral",
    label: "MCP Central",
    listing_url: "https://mcpcentral.io/servers",
    submission_url: "https://mcpcentral.io/submit-server",
    category: "Business",
    priority: "medium",
    action: "Submit Packrift MCP to MCP Central or request review if browser-side auth is required.",
  },
  {
    name: "mcpfinder",
    label: "MCPfinder",
    listing_url: "https://www.mcpfinder.org/",
    submission_url: "https://www.mcpfinder.org/submit",
    category: "Business",
    priority: "medium",
    action:
      "MCPfinder reports the Packrift MCP repository is already submitted and under review; monitor approval and provide endpoint proof if review asks.",
  },
  {
    name: "mcpskills",
    label: "MCPSkills",
    listing_url: "https://mcpskills.app/servers",
    submission_url: "https://mcpskills.app/submit",
    category: "AI Tools",
    priority: "medium",
    action: "Monitor the submitted listing and provide hosted endpoint proof if review asks for validation.",
  },
  {
    name: "agentndx",
    label: "AgentNDX",
    listing_url: "https://agentndx.ai/browse",
    submission_url: "https://agentndx.ai/submit",
    category: "Business",
    priority: "medium",
    action: "Monitor the submitted MCP protocol listing and provide hosted start page proof if review asks for validation.",
  },
  {
    name: "mcpbench",
    label: "MCPBench",
    listing_url: "https://mcpbench.ai/servers/io.github.Packrift/packrift-mcp",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    category: "Business",
    priority: "medium",
    action: "Monitor official-registry ingestion and cite the current registry pass if requesting a recrawl.",
  },
  {
    name: "chiark",
    label: "Chiark",
    listing_url: "https://chiark.ai/",
    submission_url: "https://chiark.ai/methodology",
    category: "Business",
    priority: "medium",
    action: "Chiark crawls upstream registries, so refresh upstream listings first and then monitor for Packrift by endpoint URL.",
  },
  {
    name: "mcp_marketplace_io",
    label: "MCP Marketplace",
    listing_url: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
    submission_url: "https://mcp-marketplace.io/for-creators",
    category: "Business",
    priority: "medium",
    action: "Keep LAUNCHGUIDE.md and the public marketplace discovery manifest current, then monitor marketplace score and installs.",
  },
  {
    name: "mcplist_ai",
    label: "MCPLIST",
    listing_url: "https://www.mcplist.ai/?search=packrift",
    submission_url: "mailto:contact@mcplist.ai",
    category: "Business",
    priority: "medium",
    action: "Review and send the existing Gmail draft with the hosted endpoint, marketplace manifest, source-specific update card, and first-useful-run proof.",
  },
  {
    name: "mcphubz",
    label: "MCPHubz",
    listing_url: "https://mcphubz.com/",
    submission_url: "https://mcphubz.com/submit",
    category: "Business",
    priority: "medium",
    action: "Use an authenticated MCPHubz session or working owner contact path before retrying; the public contact Formspree endpoint returned FORM_NOT_FOUND.",
  },
  {
    name: "mcp_blue",
    label: "MCP Blue",
    listing_url: "https://www.mcp.blue/",
    submission_url: "https://www.mcp.blue/submit",
    category: "Business",
    priority: "medium",
    action: "Do not spend time submitting until MCP Blue is live again; the submit URL behaves like a parked/fingerprint-gated domain and the gate leads to an error page.",
  },
  {
    name: "findmcp_dev",
    label: "FindMCP",
    listing_url: "https://findmcp.dev/",
    submission_url: "https://findmcp.dev/submit",
    category: "Business",
    priority: "medium",
    action: "Find a real contact, repository, or fixed submit endpoint; /submit renders the landing page and the visible submit CTA errors.",
  },
  {
    name: "mcplane",
    label: "MCPLane",
    listing_url: "https://mcplane.com/mcp_servers?query=packrift",
    submission_url: "https://mcplane.com/mcp_servers/new",
    category: "Business",
    priority: "medium",
    action: "Contact MCPLane or retry only after its GitHub validator accepts the public Packrift/packrift-mcp repository.",
  },
  {
    name: "mcpsolutions_dev",
    label: "MCP Solutions",
    listing_url: "https://mcpsolutions.dev/explore/",
    submission_url: "https://mcpsolutions.dev/submit/",
    category: "Business",
    priority: "medium",
    action: "Monitor the submitted basic listing for publication and provide the source-specific update card if review asks for current endpoint proof.",
  },
  {
    name: "gpmcp",
    label: "GPMCP",
    listing_url: "https://www.gpmcp.com/",
    submission_url: "https://www.gpmcp.com/",
    category: "Business",
    priority: "medium",
    action: "Review the existing support@gpmcp.com draft or hold until GPMCP exposes a real submit/import path.",
  },
  {
    name: "theresamcpforthat",
    label: "There's an MCP for That",
    listing_url: "https://theresamcpforthat.com/directory?search=packrift",
    submission_url: "https://theresamcpforthat.com/",
    category: "Business",
    priority: "medium",
    action: "Monitor only until a real submit, contact, or upstream ingestion path appears.",
  },
  {
    name: "mcpserverfinder",
    label: "MCP Server Finder",
    listing_url: "https://www.mcpserverfinder.com/?q=packrift",
    submission_url: "mailto:info@mcpserverfinder.com",
    category: "Business",
    priority: "medium",
    action: "Review and send the existing Gmail draft with the hosted endpoint, marketplace manifest, source-specific update card, and first-useful-run proof.",
  },
  {
    name: "mcpserver_cc",
    label: "mcpserver.cc",
    listing_url: "https://mcpserver.cc/",
    submission_url: "https://mcpserver.cc/submit",
    category: "Business",
    priority: "medium",
    action: "Monitor the submitted API listing for publication and provide the source-specific update card if review asks for hosted endpoint proof.",
  },
  {
    name: "mcpserverspot",
    label: "MCP Server Spot",
    listing_url: "https://www.mcpserverspot.com/servers?q=packrift",
    submission_url: "https://www.mcpserverspot.com/submit",
    category: "Business",
    priority: "medium",
    action: "Monitor the submitted public form listing for publication and provide the source-specific update card if review asks for hosted endpoint proof.",
  },
  {
    name: "docker_mcp_catalog",
    label: "Docker MCP Catalog",
    listing_url: "https://github.com/docker/mcp-registry/pull/3388",
    submission_url: "https://github.com/docker/mcp-registry/pull/3388",
    category: "Ecommerce",
    priority: "medium",
    action: "Keep the hosted remote-server PR mergeable so Packrift can enter Docker Desktop MCP Toolkit and Docker MCP Catalog discovery.",
  },
];

const LIVE_PROOF_URLS = {
  health: "https://mcp.packrift.com/health",
  mcp_start: "https://mcp.packrift.com/ai/mcp-start.json",
  manifest: "https://mcp.packrift.com/manifest",
  server_card: "https://mcp.packrift.com/server-card.json",
  well_known_server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
  glama_claim: "https://mcp.packrift.com/.well-known/glama.json",
  marketplace_manifest: "https://mcp.packrift.com/.well-known/mcp-marketplace.json",
  brand_agent_web_manifest: "https://packrift.com/agent.json",
  agent_web_manifest: "https://mcp.packrift.com/.well-known/agent.json",
  root_agent_web_manifest: "https://mcp.packrift.com/agent.json",
  capability_card: "https://mcp.packrift.com/.well-known/capability-card.json",
  source_activation_sitemap: "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml",
  cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
  all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
  mcp_adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
  mcp_install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
  mcp_client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
  tracked_config_generic: "https://mcp.packrift.com/r/config/generic",
  root_mcp_json: "https://mcp.packrift.com/mcp.json",
  well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
  mcp_usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
  mcp_buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
  mcp_ucp_starter_catalog: "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.json",
  mcp_ucp_starter_catalog_markdown: "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.md",
  mcp_ucp_starter_catalog_html: "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.html",
  mcp_ucp_builder_kit: "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.json",
  mcp_ucp_builder_kit_markdown: "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.md",
  mcp_ucp_builder_kit_html: "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.html",
  mcp_ucp_storefront_import: "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.json",
  mcp_ucp_storefront_import_jsonl: "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.jsonl",
  mcp_ucp_storefront_import_csv: "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.csv",
  mcp_ucp_storefront_import_html: "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.html",
  mcp_ucp_storefront_shelf: "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf.json",
  mcp_ucp_storefront_shelf_html: "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf.html",
  mcp_ucp_storefront_shelf_embed_js: "https://mcp.packrift.com/ai/packrift-ucp-shelf.js",
  mcp_ucp_storefront_adoption: "https://mcp.packrift.com/ai/mcp-ucp-storefront-adoption.json",
  mcp_ucp_storefront_adoption_html: "https://mcp.packrift.com/ai/mcp-ucp-storefront-adoption.html",
  mcp_ucp_builder_activation_handoff: "https://mcp.packrift.com/ai/mcp-ucp-builder-activation-handoff.json",
  mcp_ucp_builder_activation_handoff_html: "https://mcp.packrift.com/ai/mcp-ucp-builder-activation-handoff.html",
  packrift_ucp_builder_launchpad: "https://mcp.packrift.com/ai/packrift-ucp-builder-launchpad.json",
  packrift_ucp_builder_launchpad_html: "https://mcp.packrift.com/ai/packrift-ucp-builder-launchpad.html",
  packrift_ucp_builder_approval_packet: "https://mcp.packrift.com/ai/packrift-ucp-builder-approval-packet.json",
  packrift_ucp_builder_approval_packet_html: "https://mcp.packrift.com/ai/packrift-ucp-builder-approval-packet.html",
  packrift_ucp_builder_approval_packet_open_scout: "https://mcp.packrift.com/ai/packrift-ucp-builder-approval-packet/open_scout_shopping_agent.json",
  packrift_ucp_builder_approval_packet_upsonic: "https://mcp.packrift.com/ai/packrift-ucp-builder-approval-packet/upsonic_ucp_agent_framework.json",
  packrift_ucp_builder_approval_packet_agorio: "https://mcp.packrift.com/ai/packrift-ucp-builder-approval-packet/agorio_shopping_agent_sdk.json",
  packrift_ucp_builder_integration_pack: "https://mcp.packrift.com/ai/packrift-ucp-builder-integration-pack.json",
  packrift_ucp_builder_integration_pack_html: "https://mcp.packrift.com/ai/packrift-ucp-builder-integration-pack.html",
  packrift_ucp_builder_integration_pack_open_scout: "https://mcp.packrift.com/ai/packrift-ucp-builder-integration-pack/open_scout_shopping_agent.json",
  packrift_ucp_builder_integration_pack_upsonic: "https://mcp.packrift.com/ai/packrift-ucp-builder-integration-pack/upsonic_ucp_agent_framework.json",
  packrift_ucp_builder_integration_pack_agorio: "https://mcp.packrift.com/ai/packrift-ucp-builder-integration-pack/agorio_shopping_agent_sdk.json",
  packrift_ucp_builder_pr_activation_pack: "https://mcp.packrift.com/ai/packrift-ucp-builder-pr-activation-pack.json",
  packrift_ucp_builder_pr_activation_pack_html: "https://mcp.packrift.com/ai/packrift-ucp-builder-pr-activation-pack.html",
  packrift_ucp_shipping_supplies_starter_kit: "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-starter-kit.json",
  packrift_ucp_shipping_supplies_starter_kit_html: "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-starter-kit.html",
  packrift_ucp_shipping_supplies_storefront_template: "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-storefront-template.json",
  packrift_ucp_shipping_supplies_storefront_template_html: "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-storefront-template.html",
  packrift_ucp_shipping_supplies_collection_map: "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-collection-map.json",
  packrift_ucp_shipping_supplies_collection_map_markdown: "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-collection-map.md",
  packrift_ucp_shipping_supplies_collection_map_html: "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-collection-map.html",
  packrift_ucp_builder_sales_loop: "https://mcp.packrift.com/ai/packrift-ucp-builder-sales-loop.json",
  packrift_ucp_builder_sales_loop_markdown: "https://mcp.packrift.com/ai/packrift-ucp-builder-sales-loop.md",
  packrift_ucp_builder_sales_loop_html: "https://mcp.packrift.com/ai/packrift-ucp-builder-sales-loop.html",
  packrift_ucp_stack412_shipping_supplies_aisle: "https://mcp.packrift.com/ai/packrift-ucp-stack412-shipping-supplies-aisle.json",
  packrift_ucp_stack412_shipping_supplies_aisle_html: "https://mcp.packrift.com/ai/packrift-ucp-stack412-shipping-supplies-aisle.html",
  packrift_ucp_plugthatshop_contextual_shelf: "https://mcp.packrift.com/ai/packrift-ucp-plugthatshop-contextual-shelf.json",
  packrift_ucp_plugthatshop_contextual_shelf_html: "https://mcp.packrift.com/ai/packrift-ucp-plugthatshop-contextual-shelf.html",
  packrift_ucp_open_scout_shopping_agent_path: "https://mcp.packrift.com/ai/packrift-ucp-open-scout-shopping-agent-path.json",
  packrift_ucp_open_scout_shopping_agent_path_html: "https://mcp.packrift.com/ai/packrift-ucp-open-scout-shopping-agent-path.html",
  packrift_ucp_upsonic_agent_workflow: "https://mcp.packrift.com/ai/packrift-ucp-upsonic-agent-workflow.json",
  packrift_ucp_upsonic_agent_workflow_html: "https://mcp.packrift.com/ai/packrift-ucp-upsonic-agent-workflow.html",
  mcp_ucp_storefront_shelf_demo_stack412: "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf-demo/stack412_style_storefront.html",
  mcp_ucp_storefront_shelf_demo_plugthatshop: "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf-demo/plugthatshop_style_embed.html",
  mcp_ucp_storefront_shelf_demo_open_scout: "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf-demo/open_scout_shopping_agent.html",
  mcp_ucp_storefront_shelf_demo_upsonic: "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf-demo/upsonic_ucp_agent_framework.html",
  mcp_ucp_storefront_shelf_demo_agorio: "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf-demo/agorio_shopping_agent_sdk.html",
  mcp_cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
  mcp_first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
  mcp_workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
  mcp_eval_pack: "https://mcp.packrift.com/ai/mcp-eval-pack.json",
  browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
  root_browserbase_browse_skill_md: "https://mcp.packrift.com/SKILL.md",
  browserbase_browse_skill_pack: "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
  canonical_browserbase_browse_skill_md: "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md",
  mcp_directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
  mcp_directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
  claude_connector_submission: "https://mcp.packrift.com/ai/claude-connector-submission.json",
  docker_mcp_catalog_pr: "https://api.github.com/repos/docker/mcp-registry/pulls/3388",
};
const TRACKED_START_TEMPLATE = "https://mcp.packrift.com/r/start/{source}";
const TRACKED_CONFIG_TEMPLATE = "https://mcp.packrift.com/r/config/{source}";

function trackedInstallUrl(source, target) {
  return TRACKED_INSTALL_TEMPLATE.replace("{source}", source).replace("{target}", target);
}

function trackedRunUrl(source, target) {
  return TRACKED_RUN_TEMPLATE.replace("{source}", source).replace("{target}", target);
}

function sourceEvalPackUrl(source) {
  const url = new URL(LIVE_PROOF_URLS.mcp_eval_pack);
  url.searchParams.set("source", source);
  return url.toString();
}

function cacheBustedUrl(url) {
  if (!url.startsWith(PACKRIFT_ORIGIN)) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("packrift_check", RUN_CACHE_BUST);
  return parsed.toString();
}

async function fetchJson(url) {
  try {
    const response = await fetch(cacheBustedUrl(url), {
      headers: {
        "User-Agent": "Packrift-MCP-Directory-Pack/1.0 (+https://mcp.packrift.com/mcp)",
        Accept: "application/json,*/*;q=0.8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      redirect: "follow",
    });
    const text = await response.text();
    const nonJsonProofPath = /\.(xml|md|html|csv|jsonl|js)(?:[?#]|$)/i.test(new URL(url).pathname);
    const value = response.ok && !nonJsonProofPath ? JSON.parse(text) : text;
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      value: response.ok ? value : null,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      value: null,
      error: error.message,
    };
  }
}

async function fetchMcp(method, params = undefined) {
  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "User-Agent": "Packrift-MCP-Directory-Pack/1.0 (+https://mcp.packrift.com/mcp)",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: method,
        method,
        ...(params ? { params } : {}),
      }),
      redirect: "follow",
    });
    const text = await response.text();
    const value = text ? JSON.parse(text) : null;
    return {
      ok: response.ok && !value?.error,
      status: response.status,
      url: response.url,
      value,
      error: value?.error?.message ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url: MCP_ENDPOINT,
      value: null,
      error: error.message,
    };
  }
}

function readDistribution() {
  if (!existsSync(DISTRIBUTION_LATEST)) return null;
  return JSON.parse(readFileSync(DISTRIBUTION_LATEST, "utf8"));
}

function checksByName(distribution) {
  return Object.fromEntries((distribution?.checks ?? []).map((row) => [row.name, row]));
}

function canonicalListingCopy(liveProof) {
  const toolsCount = liveProof.mcp_tools_list?.value?.result?.tools?.length ?? liveProof.health?.value?.tools_count ?? 14;
  const resourcesCount =
    liveProof.mcp_resources_list?.value?.result?.resources?.length ?? liveProof.health?.value?.resources_count ?? 70;
  const promptsCount = liveProof.mcp_prompts_list?.value?.result?.prompts?.length ?? liveProof.manifest?.value?.prompts?.length ?? 7;
  return {
    server_name: SERVER_JSON.title,
    registry_name: SERVER_JSON.name,
    version: SERVER_JSON.version ?? PACKAGE_JSON.version,
    short_description: SERVER_JSON.description,
    long_description:
      "Packrift MCP lets AI agents find exact-spec packaging products, confirm live price and inventory, compare alternatives, estimate shipping, and hand off attributed carts to Packrift.",
    website_url: SERVER_JSON.websiteUrl,
    tracked_start_template: TRACKED_START_TEMPLATE,
    tracked_config_template: TRACKED_CONFIG_TEMPLATE,
    tracked_config_generic: TRACKED_CONFIG_TEMPLATE.replace("{source}", "generic"),
    repository_url: SERVER_JSON.repository?.url,
    remote_endpoint: SERVER_JSON.remotes?.[0]?.url,
    install_config: {
      mcpServers: {
        packrift: {
          type: "http",
          url: SERVER_JSON.remotes?.[0]?.url,
        },
      },
    },
    category: "Business",
    tags: ["mcp", "ecommerce", "packaging", "procurement", "shopify", "cart-handoff", "inventory"],
    proof_summary: `${toolsCount} tools, ${promptsCount} prompts, ${resourcesCount} resources, direct live MCP introspection, public manifests, brand-domain Agent Web discovery, valid Glama claim, source-attributed /r/config/{source} config links, a builder-ready UCP starter catalog, storefront integration kit, flat import feed, copy-paste shelf renderer, public builder activation handoff, self-serve builder launchpad, owner-approval packets, source-specific integration packs, a public UCP builder PR activation pack, a one-link shipping-supplies starter kit, a copy-ready shipping-supplies storefront template, a shipping-supplies collection route map, a UCP builder sales loop, a Stack412-style shipping-supplies aisle, a PlugThatShop-style contextual shipping shelf, an Open Scout-style shopping-agent packaging path, an Upsonic-style UCP agent workflow, and MCP-attributed cart handoff candidates.`,
    contact_email: CONTACT_EMAIL_PLACEHOLDER,
  };
}

function targetRows(distribution, copy) {
  const byName = checksByName(distribution);
  return TARGETS.map((target) => ({
    ...target,
    current_status: byName[target.name]?.status ?? "not_checked",
    current_evidence_url: byName[target.name]?.url ?? target.listing_url,
    missing: byName[target.name]?.missing ?? [],
    distribution_observation: byName[target.name] ?? null,
    form_fields: {
      server_name: copy.server_name,
      short_description: copy.short_description,
      repository_url: copy.repository_url,
      website_url: copy.website_url,
      remote_endpoint: copy.remote_endpoint,
      category: target.category,
      contact_email: copy.contact_email,
    },
    proof_urls: {
      hosted_endpoint: copy.remote_endpoint,
      tracked_start: TRACKED_START_TEMPLATE.replace("{source}", target.name),
      tracked_config: TRACKED_CONFIG_TEMPLATE.replace("{source}", target.name),
      live_health: LIVE_PROOF_URLS.health,
      live_manifest: LIVE_PROOF_URLS.manifest,
      mcp_tools_list: `${MCP_ENDPOINT} via JSON-RPC method tools/list`,
      glama_claim: LIVE_PROOF_URLS.glama_claim,
      brand_agent_web_manifest: LIVE_PROOF_URLS.brand_agent_web_manifest,
      agent_web_manifest: LIVE_PROOF_URLS.agent_web_manifest,
      root_agent_web_manifest: LIVE_PROOF_URLS.root_agent_web_manifest,
      capability_card: LIVE_PROOF_URLS.capability_card,
      cart_handoff_candidates: LIVE_PROOF_URLS.cart_handoff_candidates,
      all_agent_capture: LIVE_PROOF_URLS.all_agent_capture,
      mcp_adoption_kit: LIVE_PROOF_URLS.mcp_adoption_kit,
      mcp_install_matrix: LIVE_PROOF_URLS.mcp_install_matrix,
      mcp_client_config: LIVE_PROOF_URLS.mcp_client_config,
      tracked_config_generic: LIVE_PROOF_URLS.tracked_config_generic,
      root_mcp_json: LIVE_PROOF_URLS.root_mcp_json,
      well_known_mcp_json: LIVE_PROOF_URLS.well_known_mcp_json,
      mcp_usage_snapshot: LIVE_PROOF_URLS.mcp_usage_snapshot,
      mcp_buyer_use_cases: LIVE_PROOF_URLS.mcp_buyer_use_cases,
      mcp_ucp_starter_catalog: LIVE_PROOF_URLS.mcp_ucp_starter_catalog,
      mcp_ucp_starter_catalog_markdown: LIVE_PROOF_URLS.mcp_ucp_starter_catalog_markdown,
      mcp_ucp_starter_catalog_html: LIVE_PROOF_URLS.mcp_ucp_starter_catalog_html,
      mcp_ucp_builder_kit: LIVE_PROOF_URLS.mcp_ucp_builder_kit,
      mcp_ucp_builder_kit_markdown: LIVE_PROOF_URLS.mcp_ucp_builder_kit_markdown,
      mcp_ucp_builder_kit_html: LIVE_PROOF_URLS.mcp_ucp_builder_kit_html,
      mcp_ucp_storefront_import: LIVE_PROOF_URLS.mcp_ucp_storefront_import,
      mcp_ucp_storefront_import_jsonl: LIVE_PROOF_URLS.mcp_ucp_storefront_import_jsonl,
      mcp_ucp_storefront_import_csv: LIVE_PROOF_URLS.mcp_ucp_storefront_import_csv,
      mcp_ucp_storefront_import_html: LIVE_PROOF_URLS.mcp_ucp_storefront_import_html,
      mcp_ucp_storefront_shelf: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf,
      mcp_ucp_storefront_shelf_html: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_html,
      mcp_ucp_storefront_shelf_embed_js: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_embed_js,
      mcp_ucp_storefront_adoption: LIVE_PROOF_URLS.mcp_ucp_storefront_adoption,
      mcp_ucp_storefront_adoption_html: LIVE_PROOF_URLS.mcp_ucp_storefront_adoption_html,
      mcp_ucp_builder_activation_handoff: LIVE_PROOF_URLS.mcp_ucp_builder_activation_handoff,
      mcp_ucp_builder_activation_handoff_html: LIVE_PROOF_URLS.mcp_ucp_builder_activation_handoff_html,
      packrift_ucp_builder_launchpad: LIVE_PROOF_URLS.packrift_ucp_builder_launchpad,
      packrift_ucp_builder_launchpad_html: LIVE_PROOF_URLS.packrift_ucp_builder_launchpad_html,
      packrift_ucp_builder_approval_packet: LIVE_PROOF_URLS.packrift_ucp_builder_approval_packet,
      packrift_ucp_builder_approval_packet_html: LIVE_PROOF_URLS.packrift_ucp_builder_approval_packet_html,
      packrift_ucp_builder_approval_packet_agorio: LIVE_PROOF_URLS.packrift_ucp_builder_approval_packet_agorio,
      packrift_ucp_builder_integration_pack: LIVE_PROOF_URLS.packrift_ucp_builder_integration_pack,
      packrift_ucp_builder_integration_pack_html: LIVE_PROOF_URLS.packrift_ucp_builder_integration_pack_html,
      packrift_ucp_builder_integration_pack_agorio: LIVE_PROOF_URLS.packrift_ucp_builder_integration_pack_agorio,
      packrift_ucp_builder_pr_activation_pack: LIVE_PROOF_URLS.packrift_ucp_builder_pr_activation_pack,
      packrift_ucp_builder_pr_activation_pack_html: LIVE_PROOF_URLS.packrift_ucp_builder_pr_activation_pack_html,
      packrift_ucp_shipping_supplies_starter_kit: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_starter_kit,
      packrift_ucp_shipping_supplies_starter_kit_html: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_starter_kit_html,
      packrift_ucp_shipping_supplies_storefront_template: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_storefront_template,
      packrift_ucp_shipping_supplies_storefront_template_html: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_storefront_template_html,
      packrift_ucp_shipping_supplies_collection_map: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_collection_map,
      packrift_ucp_shipping_supplies_collection_map_markdown: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_collection_map_markdown,
      packrift_ucp_shipping_supplies_collection_map_html: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_collection_map_html,
      packrift_ucp_builder_sales_loop: LIVE_PROOF_URLS.packrift_ucp_builder_sales_loop,
      packrift_ucp_builder_sales_loop_markdown: LIVE_PROOF_URLS.packrift_ucp_builder_sales_loop_markdown,
      packrift_ucp_builder_sales_loop_html: LIVE_PROOF_URLS.packrift_ucp_builder_sales_loop_html,
      packrift_ucp_stack412_shipping_supplies_aisle: LIVE_PROOF_URLS.packrift_ucp_stack412_shipping_supplies_aisle,
      packrift_ucp_stack412_shipping_supplies_aisle_html: LIVE_PROOF_URLS.packrift_ucp_stack412_shipping_supplies_aisle_html,
      packrift_ucp_plugthatshop_contextual_shelf: LIVE_PROOF_URLS.packrift_ucp_plugthatshop_contextual_shelf,
      packrift_ucp_plugthatshop_contextual_shelf_html: LIVE_PROOF_URLS.packrift_ucp_plugthatshop_contextual_shelf_html,
      packrift_ucp_open_scout_shopping_agent_path: LIVE_PROOF_URLS.packrift_ucp_open_scout_shopping_agent_path,
      packrift_ucp_open_scout_shopping_agent_path_html: LIVE_PROOF_URLS.packrift_ucp_open_scout_shopping_agent_path_html,
      packrift_ucp_upsonic_agent_workflow: LIVE_PROOF_URLS.packrift_ucp_upsonic_agent_workflow,
      packrift_ucp_upsonic_agent_workflow_html: LIVE_PROOF_URLS.packrift_ucp_upsonic_agent_workflow_html,
      mcp_ucp_storefront_shelf_demo_stack412: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_demo_stack412,
      mcp_ucp_storefront_shelf_demo_plugthatshop: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_demo_plugthatshop,
      mcp_ucp_storefront_shelf_demo_agorio: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_demo_agorio,
      mcp_cart_activation: LIVE_PROOF_URLS.mcp_cart_activation,
      mcp_first_run_proof: LIVE_PROOF_URLS.mcp_first_run_proof,
      mcp_workflow_gallery: LIVE_PROOF_URLS.mcp_workflow_gallery,
      browser_agent_bridge: LIVE_PROOF_URLS.browser_agent_bridge,
      root_browserbase_browse_skill_md: LIVE_PROOF_URLS.root_browserbase_browse_skill_md,
      browserbase_browse_skill_pack: LIVE_PROOF_URLS.browserbase_browse_skill_pack,
      canonical_browserbase_browse_skill_md: LIVE_PROOF_URLS.canonical_browserbase_browse_skill_md,
      mcp_directory_refresh: LIVE_PROOF_URLS.mcp_directory_refresh,
      mcp_directory_submit_actions: LIVE_PROOF_URLS.mcp_directory_submit_actions,
      claude_connector_submission: LIVE_PROOF_URLS.claude_connector_submission,
      docker_mcp_catalog_pr: "https://github.com/docker/mcp-registry/pull/3388",
      official_registry: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    },
  }));
}

function liveProofDigest(liveProof) {
  return {
    health: {
      ok: liveProof.health.ok,
      status: liveProof.health.status,
      url: liveProof.health.url,
      version: liveProof.health.value?.version ?? null,
      tools_count: liveProof.health.value?.tools_count ?? null,
      resources_count: liveProof.health.value?.resources_count ?? null,
    },
    manifest: {
      ok: liveProof.manifest.ok,
      status: liveProof.manifest.status,
      url: liveProof.manifest.url,
      tools_count: liveProof.manifest.value?.tools?.length ?? null,
      prompts_count: liveProof.manifest.value?.prompts?.length ?? null,
      resources_count: liveProof.manifest.value?.resources?.length ?? null,
    },
    server_card: {
      ok: liveProof.server_card.ok,
      status: liveProof.server_card.status,
      url: liveProof.server_card.url,
      name: liveProof.server_card.value?.name ?? null,
      version: liveProof.server_card.value?.version ?? null,
    },
    well_known_server_card: {
      ok: liveProof.well_known_server_card.ok,
      status: liveProof.well_known_server_card.status,
      url: liveProof.well_known_server_card.url,
      name: liveProof.well_known_server_card.value?.name ?? null,
      version: liveProof.well_known_server_card.value?.version ?? null,
    },
    glama_claim: {
      ok: liveProof.glama_claim.ok,
      status: liveProof.glama_claim.status,
      url: liveProof.glama_claim.url,
      schema: liveProof.glama_claim.value?.$schema ?? null,
      maintainers_count: liveProof.glama_claim.value?.maintainers?.length ?? null,
    },
    marketplace_manifest: {
      ok: liveProof.marketplace_manifest.ok,
      status: liveProof.marketplace_manifest.status,
      url: liveProof.marketplace_manifest.url,
      tool_count: liveProof.marketplace_manifest.value?.signals?.tool_count ?? null,
      hosted_endpoint_requires_auth: liveProof.marketplace_manifest.value?.signals?.hosted_endpoint_requires_auth ?? null,
    },
    source_activation_sitemap: {
      ok: liveProof.source_activation_sitemap.ok,
      status: liveProof.source_activation_sitemap.status,
      url: liveProof.source_activation_sitemap.url,
    },
    mcp_tools_list: {
      ok: liveProof.mcp_tools_list.ok,
      status: liveProof.mcp_tools_list.status,
      url: liveProof.mcp_tools_list.url,
      tools_count: liveProof.mcp_tools_list.value?.result?.tools?.length ?? null,
      tool_names: (liveProof.mcp_tools_list.value?.result?.tools ?? []).map((tool) => tool.name),
    },
    mcp_resources_list: {
      ok: liveProof.mcp_resources_list.ok,
      status: liveProof.mcp_resources_list.status,
      url: liveProof.mcp_resources_list.url,
      resources_count: liveProof.mcp_resources_list.value?.result?.resources?.length ?? null,
    },
    mcp_prompts_list: {
      ok: liveProof.mcp_prompts_list.ok,
      status: liveProof.mcp_prompts_list.status,
      url: liveProof.mcp_prompts_list.url,
      prompts_count: liveProof.mcp_prompts_list.value?.result?.prompts?.length ?? null,
      prompt_names: (liveProof.mcp_prompts_list.value?.result?.prompts ?? []).map((prompt) => prompt.name),
    },
    cart_handoff_candidates: {
      ok: liveProof.cart_handoff_candidates.ok,
      status: liveProof.cart_handoff_candidates.status,
      url: liveProof.cart_handoff_candidates.url,
      release: liveProof.cart_handoff_candidates.value?.release ?? null,
      items_count: liveProof.cart_handoff_candidates.value?.items?.length ?? null,
    },
    all_agent_capture: {
      ok: liveProof.all_agent_capture.ok,
      status: liveProof.all_agent_capture.status,
      url: liveProof.all_agent_capture.url,
      release: liveProof.all_agent_capture.value?.release ?? null,
      surfaces_count: liveProof.all_agent_capture.value?.surfaces?.length ?? null,
      canonical_endpoint: liveProof.all_agent_capture.value?.canonical_endpoint ?? null,
    },
    mcp_adoption_kit: {
      ok: liveProof.mcp_adoption_kit.ok,
      status: liveProof.mcp_adoption_kit.status,
      url: liveProof.mcp_adoption_kit.url,
      release: liveProof.mcp_adoption_kit.value?.release ?? null,
      steps_count: liveProof.mcp_adoption_kit.value?.first_five_minutes?.length ?? null,
      canonical_endpoint: liveProof.mcp_adoption_kit.value?.canonical_endpoint ?? null,
    },
    mcp_install_matrix: {
      ok: liveProof.mcp_install_matrix.ok,
      status: liveProof.mcp_install_matrix.status,
      url: liveProof.mcp_install_matrix.url,
      release: liveProof.mcp_install_matrix.value?.release ?? null,
      hosts_count: liveProof.mcp_install_matrix.value?.hosts?.length ?? null,
      smoke_tests_count: liveProof.mcp_install_matrix.value?.smoke_tests?.length ?? null,
      canonical_endpoint: liveProof.mcp_install_matrix.value?.canonical_endpoint ?? null,
    },
    mcp_client_config: {
      ok: liveProof.mcp_client_config.ok,
      status: liveProof.mcp_client_config.status,
      url: liveProof.mcp_client_config.url,
      release: liveProof.mcp_client_config.value?.release ?? null,
      canonical_endpoint: liveProof.mcp_client_config.value?.canonical_endpoint ?? null,
      config_endpoint: liveProof.mcp_client_config.value?.config?.mcpServers?.packrift?.url ?? null,
      tracked_config_template: liveProof.mcp_client_config.value?.aliases?.tracked_config_template ?? null,
    },
    tracked_config_generic: {
      ok: liveProof.tracked_config_generic.ok,
      status: liveProof.tracked_config_generic.status,
      url: liveProof.tracked_config_generic.url,
      config_endpoint: liveProof.tracked_config_generic.value?.mcpServers?.packrift?.url ?? null,
    },
    root_mcp_json: {
      ok: liveProof.root_mcp_json.ok,
      status: liveProof.root_mcp_json.status,
      url: liveProof.root_mcp_json.url,
      config_endpoint: liveProof.root_mcp_json.value?.mcpServers?.packrift?.url ?? null,
    },
    well_known_mcp_json: {
      ok: liveProof.well_known_mcp_json.ok,
      status: liveProof.well_known_mcp_json.status,
      url: liveProof.well_known_mcp_json.url,
      config_endpoint: liveProof.well_known_mcp_json.value?.mcpServers?.packrift?.url ?? null,
    },
    mcp_usage_snapshot: {
      ok: liveProof.mcp_usage_snapshot.ok,
      status: liveProof.mcp_usage_snapshot.status,
      url: liveProof.mcp_usage_snapshot.url,
      release: liveProof.mcp_usage_snapshot.value?.release ?? null,
      snapshot_status: liveProof.mcp_usage_snapshot.value?.status ?? null,
      canonical_endpoint: liveProof.mcp_usage_snapshot.value?.canonical_endpoint ?? null,
    },
    mcp_buyer_use_cases: {
      ok: liveProof.mcp_buyer_use_cases.ok,
      status: liveProof.mcp_buyer_use_cases.status,
      url: liveProof.mcp_buyer_use_cases.url,
      release: liveProof.mcp_buyer_use_cases.value?.release ?? null,
      use_cases_count: liveProof.mcp_buyer_use_cases.value?.use_cases?.length ?? null,
      canonical_endpoint: liveProof.mcp_buyer_use_cases.value?.canonical_endpoint ?? null,
    },
    mcp_ucp_starter_catalog: {
      ok: liveProof.mcp_ucp_starter_catalog.ok,
      status: liveProof.mcp_ucp_starter_catalog.status,
      url: liveProof.mcp_ucp_starter_catalog.url,
      release: liveProof.mcp_ucp_starter_catalog.value?.release ?? null,
      bundle_count: liveProof.mcp_ucp_starter_catalog.value?.starter_catalog_summary?.bundle_count ?? null,
      unique_sku_count: liveProof.mcp_ucp_starter_catalog.value?.starter_catalog_summary?.unique_sku_count ?? null,
      source_slugs: liveProof.mcp_ucp_starter_catalog.value?.starter_catalog_summary?.source_slugs ?? null,
    },
    mcp_ucp_builder_kit: {
      ok: liveProof.mcp_ucp_builder_kit.ok,
      status: liveProof.mcp_ucp_builder_kit.status,
      url: liveProof.mcp_ucp_builder_kit.url,
      release: liveProof.mcp_ucp_builder_kit.value?.release ?? null,
      recipe_count: liveProof.mcp_ucp_builder_kit.value?.builder_recipes?.length ?? null,
      starter_unique_sku_count: liveProof.mcp_ucp_builder_kit.value?.starter_catalog?.unique_sku_count ?? null,
      source_slugs: liveProof.mcp_ucp_builder_kit.value?.starter_catalog?.source_slugs ?? null,
    },
    mcp_ucp_storefront_import: {
      ok: liveProof.mcp_ucp_storefront_import.ok,
      status: liveProof.mcp_ucp_storefront_import.status,
      url: liveProof.mcp_ucp_storefront_import.url,
      release: liveProof.mcp_ucp_storefront_import.value?.release ?? null,
      row_count: liveProof.mcp_ucp_storefront_import.value?.row_count ?? null,
      unique_sku_count: liveProof.mcp_ucp_storefront_import.value?.unique_sku_count ?? null,
      source_slug_count: liveProof.mcp_ucp_storefront_import.value?.source_slug_count ?? null,
    },
    mcp_ucp_storefront_shelf: {
      ok: liveProof.mcp_ucp_storefront_shelf.ok,
      status: liveProof.mcp_ucp_storefront_shelf.status,
      url: liveProof.mcp_ucp_storefront_shelf.url,
      release: liveProof.mcp_ucp_storefront_shelf.value?.release ?? null,
      row_count: liveProof.mcp_ucp_storefront_shelf.value?.row_count ?? null,
      unique_sku_count: liveProof.mcp_ucp_storefront_shelf.value?.unique_sku_count ?? null,
      source_slug_count: liveProof.mcp_ucp_storefront_shelf.value?.source_slug_count ?? null,
      shelf_count: liveProof.mcp_ucp_storefront_shelf.value?.shelves?.length ?? null,
      embed_script_url: liveProof.mcp_ucp_storefront_shelf.value?.embed_contract?.script_url ?? null,
    },
    mcp_ucp_storefront_adoption: {
      ok: liveProof.mcp_ucp_storefront_adoption.ok,
      status: liveProof.mcp_ucp_storefront_adoption.status,
      url: liveProof.mcp_ucp_storefront_adoption.url,
      release: liveProof.mcp_ucp_storefront_adoption.value?.release ?? null,
      source_slug_count: liveProof.mcp_ucp_storefront_adoption.value?.source_slug_count ?? null,
      source_adoption_count: liveProof.mcp_ucp_storefront_adoption.value?.source_adoption?.length ?? null,
      demo_template: liveProof.mcp_ucp_storefront_adoption.value?.assets?.demo_template ?? null,
    },
    mcp_ucp_builder_activation_handoff: {
      ok: liveProof.mcp_ucp_builder_activation_handoff.ok,
      status: liveProof.mcp_ucp_builder_activation_handoff.status,
      url: liveProof.mcp_ucp_builder_activation_handoff.url,
      release: liveProof.mcp_ucp_builder_activation_handoff.value?.release ?? null,
      source_target_count: liveProof.mcp_ucp_builder_activation_handoff.value?.source_targets?.length ?? null,
      completion_boundary: liveProof.mcp_ucp_builder_activation_handoff.value?.completion_boundary ?? null,
      external_send_requires_farhan_approval:
        liveProof.mcp_ucp_builder_activation_handoff.value?.outreach_policy?.external_send_requires_farhan_approval ?? null,
    },
    packrift_ucp_builder_launchpad: {
      ok: liveProof.packrift_ucp_builder_launchpad.ok,
      status: liveProof.packrift_ucp_builder_launchpad.status,
      url: liveProof.packrift_ucp_builder_launchpad.url,
      release: liveProof.packrift_ucp_builder_launchpad.value?.release ?? null,
	      source_count: liveProof.packrift_ucp_builder_launchpad.value?.launchpad_source_count ?? null,
	      has_first_run_actions: Boolean(liveProof.packrift_ucp_builder_launchpad.value?.launchpad_sources?.every((source) => source.first_run_url)),
	      has_order_handoff_actions: Boolean(liveProof.packrift_ucp_builder_launchpad.value?.launchpad_sources?.every((source) => source.order_handoff_url)),
	      has_embed_snippets: Boolean(liveProof.packrift_ucp_builder_launchpad.value?.launchpad_sources?.every((source) => source.embed_snippet)),
	      completion_boundary: liveProof.packrift_ucp_builder_launchpad.value?.completion_boundary ?? null,
	    },
    packrift_ucp_builder_approval_packet: {
      ok: liveProof.packrift_ucp_builder_approval_packet.ok,
      status: liveProof.packrift_ucp_builder_approval_packet.status,
      url: liveProof.packrift_ucp_builder_approval_packet.url,
      release: liveProof.packrift_ucp_builder_approval_packet.value?.release ?? null,
      packet_count: liveProof.packrift_ucp_builder_approval_packet.value?.packet_count ?? null,
      external_send_requires_farhan_approval:
        liveProof.packrift_ucp_builder_approval_packet.value?.policy?.external_send_requires_farhan_approval ?? null,
      do_not_send_from_agent:
        liveProof.packrift_ucp_builder_approval_packet.value?.policy?.do_not_send_from_agent ?? null,
      completion_boundary: liveProof.packrift_ucp_builder_approval_packet.value?.completion_boundary ?? null,
    },
    packrift_ucp_builder_integration_pack: {
      ok: liveProof.packrift_ucp_builder_integration_pack.ok,
      status: liveProof.packrift_ucp_builder_integration_pack.status,
      url: liveProof.packrift_ucp_builder_integration_pack.url,
      release: liveProof.packrift_ucp_builder_integration_pack.value?.release ?? null,
      integration_count: liveProof.packrift_ucp_builder_integration_pack.value?.integration_count ?? null,
      source_slugs: liveProof.packrift_ucp_builder_integration_pack.value?.source_slugs ?? null,
      external_send_requires_farhan_approval:
        liveProof.packrift_ucp_builder_integration_pack.value?.policy?.external_send_requires_farhan_approval ?? null,
      buyer_confirmation_required:
        liveProof.packrift_ucp_builder_integration_pack.value?.policy?.do_not_generate_cart_url_until_buyer_confirms_exact_sku_and_quantity ?? null,
      completion_boundary: liveProof.packrift_ucp_builder_integration_pack.value?.completion_boundary ?? null,
    },
    packrift_ucp_builder_approval_packet_agorio: {
      ok: liveProof.packrift_ucp_builder_approval_packet_agorio.ok,
      status: liveProof.packrift_ucp_builder_approval_packet_agorio.status,
      url: liveProof.packrift_ucp_builder_approval_packet_agorio.url,
      release: liveProof.packrift_ucp_builder_approval_packet_agorio.value?.release ?? null,
      packet_count: liveProof.packrift_ucp_builder_approval_packet_agorio.value?.packet_count ?? null,
      contact_status:
        liveProof.packrift_ucp_builder_approval_packet_agorio.value?.target_packets?.[0]?.contact?.contact_status ?? null,
      public_contact_route:
        liveProof.packrift_ucp_builder_approval_packet_agorio.value?.target_packets?.[0]?.contact?.public_contact_route ?? null,
    },
    packrift_ucp_builder_integration_pack_agorio: {
      ok: liveProof.packrift_ucp_builder_integration_pack_agorio.ok,
      status: liveProof.packrift_ucp_builder_integration_pack_agorio.status,
      url: liveProof.packrift_ucp_builder_integration_pack_agorio.url,
      release: liveProof.packrift_ucp_builder_integration_pack_agorio.value?.release ?? null,
      integration_count: liveProof.packrift_ucp_builder_integration_pack_agorio.value?.integration_count ?? null,
      source_slugs: liveProof.packrift_ucp_builder_integration_pack_agorio.value?.source_slugs ?? null,
      repository_or_surface:
        liveProof.packrift_ucp_builder_integration_pack_agorio.value?.integrations?.[0]?.repository_or_surface ?? null,
      source_aware_mcp_endpoint:
        liveProof.packrift_ucp_builder_integration_pack_agorio.value?.integrations?.[0]?.source_aware_mcp_endpoint ?? null,
    },
    mcp_ucp_storefront_shelf_demo_agorio: {
      ok: liveProof.mcp_ucp_storefront_shelf_demo_agorio.ok,
      status: liveProof.mcp_ucp_storefront_shelf_demo_agorio.status,
      url: liveProof.mcp_ucp_storefront_shelf_demo_agorio.url,
    },
    packrift_ucp_builder_pr_activation_pack: {
      ok: liveProof.packrift_ucp_builder_pr_activation_pack.ok,
      status: liveProof.packrift_ucp_builder_pr_activation_pack.status,
      url: liveProof.packrift_ucp_builder_pr_activation_pack.url,
      release: liveProof.packrift_ucp_builder_pr_activation_pack.value?.release ?? null,
      target_count: liveProof.packrift_ucp_builder_pr_activation_pack.value?.target_count ?? null,
      target_ids: liveProof.packrift_ucp_builder_pr_activation_pack.value?.target_ids ?? null,
      external_send_requires_farhan_approval:
        liveProof.packrift_ucp_builder_pr_activation_pack.value?.policy?.external_send_requires_farhan_approval ?? null,
      public_pack_excludes_local_filesystem_paths_and_operator_credentials:
        liveProof.packrift_ucp_builder_pr_activation_pack.value?.policy?.public_pack_excludes_local_filesystem_paths_and_operator_credentials ?? null,
      completion_boundary: liveProof.packrift_ucp_builder_pr_activation_pack.value?.completion_boundary ?? null,
    },
    packrift_ucp_shipping_supplies_starter_kit: {
      ok: liveProof.packrift_ucp_shipping_supplies_starter_kit.ok,
      status: liveProof.packrift_ucp_shipping_supplies_starter_kit.status,
      url: liveProof.packrift_ucp_shipping_supplies_starter_kit.url,
      release: liveProof.packrift_ucp_shipping_supplies_starter_kit.value?.release ?? null,
      source_slug_count: liveProof.packrift_ucp_shipping_supplies_starter_kit.value?.source_slug_count ?? null,
      source_slugs: liveProof.packrift_ucp_shipping_supplies_starter_kit.value?.source_slugs ?? null,
      default_source_slug: liveProof.packrift_ucp_shipping_supplies_starter_kit.value?.default_source_slug ?? null,
      completion_boundary: liveProof.packrift_ucp_shipping_supplies_starter_kit.value?.completion_boundary ?? null,
    },
    packrift_ucp_shipping_supplies_storefront_template: {
      ok: liveProof.packrift_ucp_shipping_supplies_storefront_template.ok,
      status: liveProof.packrift_ucp_shipping_supplies_storefront_template.status,
      url: liveProof.packrift_ucp_shipping_supplies_storefront_template.url,
      release: liveProof.packrift_ucp_shipping_supplies_storefront_template.value?.release ?? null,
      source_slug: liveProof.packrift_ucp_shipping_supplies_storefront_template.value?.source_slug ?? null,
      mcp_install_target: liveProof.packrift_ucp_shipping_supplies_storefront_template.value?.mcp_install_target ?? null,
      has_standalone_html: Boolean(liveProof.packrift_ucp_shipping_supplies_storefront_template.value?.copy_paste?.standalone_html),
      buyer_confirmation_required:
        liveProof.packrift_ucp_shipping_supplies_storefront_template.value?.policy?.do_not_generate_cart_url_until_buyer_confirms_exact_sku_and_quantity ?? null,
      completion_boundary: liveProof.packrift_ucp_shipping_supplies_storefront_template.value?.completion_boundary ?? null,
    },
    packrift_ucp_shipping_supplies_collection_map: {
      ok: liveProof.packrift_ucp_shipping_supplies_collection_map.ok,
      status: liveProof.packrift_ucp_shipping_supplies_collection_map.status,
      url: liveProof.packrift_ucp_shipping_supplies_collection_map.url,
      release: liveProof.packrift_ucp_shipping_supplies_collection_map.value?.release ?? null,
      target_intents: liveProof.packrift_ucp_shipping_supplies_collection_map.value?.summary?.target_intents ?? null,
      live_seed_covered: liveProof.packrift_ucp_shipping_supplies_collection_map.value?.summary?.live_seed_covered ?? null,
      approval_required_or_seed_gap:
        liveProof.packrift_ucp_shipping_supplies_collection_map.value?.summary?.approval_required_or_seed_gap ?? null,
      starter_seed_skus: liveProof.packrift_ucp_shipping_supplies_collection_map.value?.summary?.starter_seed_skus ?? null,
      route_count: liveProof.packrift_ucp_shipping_supplies_collection_map.value?.collection_routes?.length ?? null,
    },
    packrift_ucp_builder_sales_loop: {
      ok: liveProof.packrift_ucp_builder_sales_loop.ok,
      status: liveProof.packrift_ucp_builder_sales_loop.status,
      url: liveProof.packrift_ucp_builder_sales_loop.url,
      release: liveProof.packrift_ucp_builder_sales_loop.value?.release ?? null,
      source_count: liveProof.packrift_ucp_builder_sales_loop.value?.source_rows?.length ?? null,
      fastest_sales_first_move: liveProof.packrift_ucp_builder_sales_loop.value?.fastest_sales_first_move?.source_slug ?? null,
      fastest_public_builder_move:
        liveProof.packrift_ucp_builder_sales_loop.value?.fastest_public_builder_move?.source_slug ?? null,
      sales_proof_done: liveProof.packrift_ucp_builder_sales_loop.value?.current_reality?.sales_proof_done ?? null,
      external_send_done: liveProof.packrift_ucp_builder_sales_loop.value?.current_reality?.external_send_done ?? null,
      completion_boundary: liveProof.packrift_ucp_builder_sales_loop.value?.completion_boundary ?? null,
    },
    packrift_ucp_stack412_shipping_supplies_aisle: {
      ok: liveProof.packrift_ucp_stack412_shipping_supplies_aisle.ok,
      status: liveProof.packrift_ucp_stack412_shipping_supplies_aisle.status,
      url: liveProof.packrift_ucp_stack412_shipping_supplies_aisle.url,
      release: liveProof.packrift_ucp_stack412_shipping_supplies_aisle.value?.release ?? null,
      source_slug: liveProof.packrift_ucp_stack412_shipping_supplies_aisle.value?.source_slug ?? null,
      mcp_install_target: liveProof.packrift_ucp_stack412_shipping_supplies_aisle.value?.mcp_install_target ?? null,
      row_count: liveProof.packrift_ucp_stack412_shipping_supplies_aisle.value?.aisle_summary?.row_count ?? null,
      recommended_first_link:
        liveProof.packrift_ucp_stack412_shipping_supplies_aisle.value?.recommended_first_link_for_outreach ?? null,
      completion_boundary: liveProof.packrift_ucp_stack412_shipping_supplies_aisle.value?.completion_boundary ?? null,
    },
    packrift_ucp_plugthatshop_contextual_shelf: {
      ok: liveProof.packrift_ucp_plugthatshop_contextual_shelf.ok,
      status: liveProof.packrift_ucp_plugthatshop_contextual_shelf.status,
      url: liveProof.packrift_ucp_plugthatshop_contextual_shelf.url,
      release: liveProof.packrift_ucp_plugthatshop_contextual_shelf.value?.release ?? null,
      source_slug: liveProof.packrift_ucp_plugthatshop_contextual_shelf.value?.source_slug ?? null,
      mcp_install_target: liveProof.packrift_ucp_plugthatshop_contextual_shelf.value?.mcp_install_target ?? null,
      row_count: liveProof.packrift_ucp_plugthatshop_contextual_shelf.value?.shelf_summary?.row_count ?? null,
      recommended_first_link:
        liveProof.packrift_ucp_plugthatshop_contextual_shelf.value?.recommended_first_link_for_outreach ?? null,
      completion_boundary: liveProof.packrift_ucp_plugthatshop_contextual_shelf.value?.completion_boundary ?? null,
    },
    packrift_ucp_open_scout_shopping_agent_path: {
      ok: liveProof.packrift_ucp_open_scout_shopping_agent_path.ok,
      status: liveProof.packrift_ucp_open_scout_shopping_agent_path.status,
      url: liveProof.packrift_ucp_open_scout_shopping_agent_path.url,
      release: liveProof.packrift_ucp_open_scout_shopping_agent_path.value?.release ?? null,
      source_slug: liveProof.packrift_ucp_open_scout_shopping_agent_path.value?.source_slug ?? null,
      mcp_install_target: liveProof.packrift_ucp_open_scout_shopping_agent_path.value?.mcp_install_target ?? null,
      row_count: liveProof.packrift_ucp_open_scout_shopping_agent_path.value?.agent_path_summary?.row_count ?? null,
      recommended_first_link:
        liveProof.packrift_ucp_open_scout_shopping_agent_path.value?.recommended_first_link_for_outreach ?? null,
      route_first_for_intents:
        liveProof.packrift_ucp_open_scout_shopping_agent_path.value?.agent_routing_rule?.route_first_for_intents?.length ?? null,
      completion_boundary: liveProof.packrift_ucp_open_scout_shopping_agent_path.value?.completion_boundary ?? null,
    },
    packrift_ucp_upsonic_agent_workflow: {
      ok: liveProof.packrift_ucp_upsonic_agent_workflow.ok,
      status: liveProof.packrift_ucp_upsonic_agent_workflow.status,
      url: liveProof.packrift_ucp_upsonic_agent_workflow.url,
      release: liveProof.packrift_ucp_upsonic_agent_workflow.value?.release ?? null,
      source_slug: liveProof.packrift_ucp_upsonic_agent_workflow.value?.source_slug ?? null,
      mcp_install_target: liveProof.packrift_ucp_upsonic_agent_workflow.value?.mcp_install_target ?? null,
      row_count: liveProof.packrift_ucp_upsonic_agent_workflow.value?.workflow_summary?.row_count ?? null,
      recommended_first_link:
        liveProof.packrift_ucp_upsonic_agent_workflow.value?.recommended_first_link_for_outreach ?? null,
      workflow_step_count:
        liveProof.packrift_ucp_upsonic_agent_workflow.value?.workflow_steps?.length ?? null,
      completion_boundary: liveProof.packrift_ucp_upsonic_agent_workflow.value?.completion_boundary ?? null,
    },
    mcp_cart_activation: {
      ok: liveProof.mcp_cart_activation.ok,
      status: liveProof.mcp_cart_activation.status,
      url: liveProof.mcp_cart_activation.url,
      release: liveProof.mcp_cart_activation.value?.release ?? null,
      activation_paths_count: liveProof.mcp_cart_activation.value?.activation_paths?.length ?? null,
      canonical_endpoint: liveProof.mcp_cart_activation.value?.canonical_endpoint ?? null,
    },
    mcp_first_run_proof: {
      ok: liveProof.mcp_first_run_proof.ok,
      status: liveProof.mcp_first_run_proof.status,
      url: liveProof.mcp_first_run_proof.url,
      release: liveProof.mcp_first_run_proof.value?.release ?? null,
      sku: liveProof.mcp_first_run_proof.value?.live_demo?.sku ?? null,
      cart_url: liveProof.mcp_first_run_proof.value?.live_demo?.cart?.url ?? null,
      canonical_endpoint: liveProof.mcp_first_run_proof.value?.canonical_endpoint ?? null,
    },
    mcp_workflow_gallery: {
      ok: liveProof.mcp_workflow_gallery.ok,
      status: liveProof.mcp_workflow_gallery.status,
      url: liveProof.mcp_workflow_gallery.url,
      release: liveProof.mcp_workflow_gallery.value?.release ?? null,
      workflow_count: liveProof.mcp_workflow_gallery.value?.workflow_count ?? null,
      canonical_endpoint: liveProof.mcp_workflow_gallery.value?.canonical_endpoint ?? null,
    },
    browser_agent_bridge: {
      ok: liveProof.browser_agent_bridge.ok,
      status: liveProof.browser_agent_bridge.status,
      url: liveProof.browser_agent_bridge.url,
      release: liveProof.browser_agent_bridge.value?.release ?? null,
      workflows_count: liveProof.browser_agent_bridge.value?.workflows?.length ?? null,
      canonical_endpoint: liveProof.browser_agent_bridge.value?.canonical_endpoint ?? null,
    },
    browserbase_browse_skill_pack: {
      ok: liveProof.browserbase_browse_skill_pack.ok,
      status: liveProof.browserbase_browse_skill_pack.status,
      url: liveProof.browserbase_browse_skill_pack.url,
      release: liveProof.browserbase_browse_skill_pack.value?.release ?? null,
      demo_steps_count: liveProof.browserbase_browse_skill_pack.value?.demo_sequence?.length ?? null,
      canonical_endpoint: liveProof.browserbase_browse_skill_pack.value?.canonical_endpoint ?? null,
    },
    mcp_directory_refresh: {
      ok: liveProof.mcp_directory_refresh.ok,
      status: liveProof.mcp_directory_refresh.status,
      url: liveProof.mcp_directory_refresh.url,
      release: liveProof.mcp_directory_refresh.value?.release ?? null,
      targets_count: liveProof.mcp_directory_refresh.value?.priority_refresh_targets?.length ?? null,
      canonical_endpoint: liveProof.mcp_directory_refresh.value?.canonical_listing?.remote_endpoint ?? null,
    },
    mcp_directory_submit_actions: {
      ok: liveProof.mcp_directory_submit_actions.ok,
      status: liveProof.mcp_directory_submit_actions.status,
      url: liveProof.mcp_directory_submit_actions.url,
      release: liveProof.mcp_directory_submit_actions.value?.release ?? null,
      actions_count: liveProof.mcp_directory_submit_actions.value?.actions?.length ?? null,
      canonical_endpoint: liveProof.mcp_directory_submit_actions.value?.canonical_endpoint ?? null,
    },
    claude_connector_submission: {
      ok: liveProof.claude_connector_submission.ok,
      status: liveProof.claude_connector_submission.status,
      url: liveProof.claude_connector_submission.url,
      release: liveProof.claude_connector_submission.value?.release ?? null,
      packet_status: liveProof.claude_connector_submission.value?.status ?? null,
      canonical_endpoint: liveProof.claude_connector_submission.value?.server?.remote_endpoint ?? null,
    },
    docker_mcp_catalog_pr: {
      ok: liveProof.docker_mcp_catalog_pr.ok,
      status: liveProof.docker_mcp_catalog_pr.status,
      url: liveProof.docker_mcp_catalog_pr.value?.html_url ?? liveProof.docker_mcp_catalog_pr.url,
      state: liveProof.docker_mcp_catalog_pr.value?.state ?? null,
      mergeable: liveProof.docker_mcp_catalog_pr.value?.mergeable ?? null,
      merged_at: liveProof.docker_mcp_catalog_pr.value?.merged_at ?? null,
    },
  };
}

function directoryUpdateCard(payload, target) {
  const toolNames = payload.live_proof.mcp_tools_list.tool_names ?? [];
  return {
    release: "PACKRIFT-MCP-DIRECTORY-UPDATE-CARD-R10",
    generated_at: payload.generated_at,
    source: target.name,
    directory: {
      id: target.name,
      label: target.label,
      current_status: target.current_status,
      priority: target.priority,
      listing_url: target.listing_url,
      submission_url: target.submission_url,
      stale_markers: target.missing ?? [],
      requested_action: target.action,
    },
    canonical_listing: {
      server_name: payload.copy.server_name,
      registry_name: payload.copy.registry_name,
      endpoint: MCP_ENDPOINT,
      authentication: "none_required_for_hosted_endpoint",
      version: payload.copy.version,
      description: payload.copy.short_description,
      tool_count: payload.live_proof.mcp_tools_list.tools_count ?? toolNames.length,
      tool_names: toolNames,
      repository_url: payload.copy.repository_url,
      website_url: payload.copy.website_url,
      brand_agent_web_manifest: LIVE_PROOF_URLS.brand_agent_web_manifest,
      agent_web_manifest: LIVE_PROOF_URLS.agent_web_manifest,
      capability_card: LIVE_PROOF_URLS.capability_card,
      marketplace_manifest: LIVE_PROOF_URLS.marketplace_manifest,
      ucp_starter_catalog_json: LIVE_PROOF_URLS.mcp_ucp_starter_catalog,
      ucp_starter_catalog_html: LIVE_PROOF_URLS.mcp_ucp_starter_catalog_html,
      ucp_builder_kit_json: LIVE_PROOF_URLS.mcp_ucp_builder_kit,
      ucp_builder_kit_html: LIVE_PROOF_URLS.mcp_ucp_builder_kit_html,
      ucp_storefront_import_json: LIVE_PROOF_URLS.mcp_ucp_storefront_import,
      ucp_storefront_import_jsonl: LIVE_PROOF_URLS.mcp_ucp_storefront_import_jsonl,
      ucp_storefront_import_csv: LIVE_PROOF_URLS.mcp_ucp_storefront_import_csv,
      ucp_storefront_import_html: LIVE_PROOF_URLS.mcp_ucp_storefront_import_html,
      ucp_storefront_shelf_json: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf,
      ucp_storefront_shelf_html: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_html,
      ucp_storefront_shelf_embed_js: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_embed_js,
      ucp_storefront_adoption_json: LIVE_PROOF_URLS.mcp_ucp_storefront_adoption,
      ucp_storefront_adoption_html: LIVE_PROOF_URLS.mcp_ucp_storefront_adoption_html,
      ucp_builder_activation_handoff_json: LIVE_PROOF_URLS.mcp_ucp_builder_activation_handoff,
      ucp_builder_activation_handoff_html: LIVE_PROOF_URLS.mcp_ucp_builder_activation_handoff_html,
      ucp_builder_launchpad_json: LIVE_PROOF_URLS.packrift_ucp_builder_launchpad,
      ucp_builder_launchpad_html: LIVE_PROOF_URLS.packrift_ucp_builder_launchpad_html,
      ucp_builder_approval_packet_json: LIVE_PROOF_URLS.packrift_ucp_builder_approval_packet,
      ucp_builder_approval_packet_html: LIVE_PROOF_URLS.packrift_ucp_builder_approval_packet_html,
      ucp_builder_approval_packet_agorio_json: LIVE_PROOF_URLS.packrift_ucp_builder_approval_packet_agorio,
      ucp_builder_integration_pack_json: LIVE_PROOF_URLS.packrift_ucp_builder_integration_pack,
      ucp_builder_integration_pack_html: LIVE_PROOF_URLS.packrift_ucp_builder_integration_pack_html,
      ucp_builder_integration_pack_agorio_json: LIVE_PROOF_URLS.packrift_ucp_builder_integration_pack_agorio,
      ucp_builder_pr_activation_pack_json: LIVE_PROOF_URLS.packrift_ucp_builder_pr_activation_pack,
      ucp_builder_pr_activation_pack_html: LIVE_PROOF_URLS.packrift_ucp_builder_pr_activation_pack_html,
      ucp_shipping_supplies_starter_kit_json: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_starter_kit,
      ucp_shipping_supplies_starter_kit_html: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_starter_kit_html,
      ucp_shipping_supplies_storefront_template_json: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_storefront_template,
      ucp_shipping_supplies_storefront_template_html: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_storefront_template_html,
      ucp_shipping_supplies_collection_map_json: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_collection_map,
      ucp_shipping_supplies_collection_map_markdown: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_collection_map_markdown,
      ucp_shipping_supplies_collection_map_html: LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_collection_map_html,
      ucp_builder_sales_loop_json: LIVE_PROOF_URLS.packrift_ucp_builder_sales_loop,
      ucp_builder_sales_loop_markdown: LIVE_PROOF_URLS.packrift_ucp_builder_sales_loop_markdown,
      ucp_builder_sales_loop_html: LIVE_PROOF_URLS.packrift_ucp_builder_sales_loop_html,
      ucp_stack412_shipping_supplies_aisle_json: LIVE_PROOF_URLS.packrift_ucp_stack412_shipping_supplies_aisle,
      ucp_stack412_shipping_supplies_aisle_html: LIVE_PROOF_URLS.packrift_ucp_stack412_shipping_supplies_aisle_html,
      ucp_plugthatshop_contextual_shelf_json: LIVE_PROOF_URLS.packrift_ucp_plugthatshop_contextual_shelf,
      ucp_plugthatshop_contextual_shelf_html: LIVE_PROOF_URLS.packrift_ucp_plugthatshop_contextual_shelf_html,
      ucp_open_scout_shopping_agent_path_json: LIVE_PROOF_URLS.packrift_ucp_open_scout_shopping_agent_path,
      ucp_open_scout_shopping_agent_path_html: LIVE_PROOF_URLS.packrift_ucp_open_scout_shopping_agent_path_html,
      ucp_upsonic_agent_workflow_json: LIVE_PROOF_URLS.packrift_ucp_upsonic_agent_workflow,
      ucp_upsonic_agent_workflow_html: LIVE_PROOF_URLS.packrift_ucp_upsonic_agent_workflow_html,
      ucp_storefront_shelf_demo_stack412: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_demo_stack412,
      ucp_storefront_shelf_demo_plugthatshop: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_demo_plugthatshop,
      ucp_storefront_shelf_demo_agorio: LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_demo_agorio,
      source_activation_sitemap: LIVE_PROOF_URLS.source_activation_sitemap,
    },
    tracked_urls: {
      start: TRACKED_START_TEMPLATE.replace("{source}", target.name),
      config: TRACKED_CONFIG_TEMPLATE.replace("{source}", target.name),
      install_generic: trackedInstallUrl(target.name, "generic_streamable_http"),
      install_codex: trackedInstallUrl(target.name, "codex"),
      install_cline: trackedInstallUrl(target.name, "cline"),
      first_run_generic: trackedRunUrl(target.name, "generic_streamable_http"),
      first_run_live_proof: `${trackedRunUrl(target.name, "generic_streamable_http")}?execute=1`,
      reviewer_activation: `https://mcp.packrift.com/r/activate/${target.name}`,
      reviewer_activation_html: `https://mcp.packrift.com/r/activate/${target.name}?format=html`,
      eval_pack: sourceEvalPackUrl(target.name),
      brand_agent_web_manifest: LIVE_PROOF_URLS.brand_agent_web_manifest,
    },
    acceptance_gate: [
      "Install the hosted no-auth Streamable HTTP endpoint.",
      "Run tools/list against the source-aware endpoint.",
      "Run the source-specific eval pack acceptance cases when a marketplace, MCP host, or reviewer needs host-side proof.",
      "Run get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url.",
      "Treat the listing as activated only when create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
    ],
    copy_ready_update_message: [
      `Subject: Refresh ${target.label} Packrift MCP listing`,
      "",
      `Please recrawl Packrift MCP from ${LIVE_PROOF_URLS.marketplace_manifest} and ${LIVE_PROOF_URLS.source_activation_sitemap}.`,
      `Endpoint: ${MCP_ENDPOINT}`,
      `Brand-domain Agent Web manifest: ${LIVE_PROOF_URLS.brand_agent_web_manifest}`,
      `UCP starter catalog: ${LIVE_PROOF_URLS.mcp_ucp_starter_catalog_html}`,
      `UCP storefront builder kit: ${LIVE_PROOF_URLS.mcp_ucp_builder_kit_html}`,
      `UCP storefront import feed: ${LIVE_PROOF_URLS.mcp_ucp_storefront_import_html}`,
      `UCP storefront shelf renderer: ${LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_html}`,
      `UCP storefront adoption kit: ${LIVE_PROOF_URLS.mcp_ucp_storefront_adoption_html}`,
      `UCP builder activation handoff: ${LIVE_PROOF_URLS.mcp_ucp_builder_activation_handoff_html}`,
      `UCP builder launchpad: ${LIVE_PROOF_URLS.packrift_ucp_builder_launchpad_html}`,
      `UCP builder approval packet: ${LIVE_PROOF_URLS.packrift_ucp_builder_approval_packet_html}`,
      `UCP builder integration pack: ${LIVE_PROOF_URLS.packrift_ucp_builder_integration_pack_html}`,
      `UCP builder PR activation pack: ${LIVE_PROOF_URLS.packrift_ucp_builder_pr_activation_pack_html}`,
      `UCP shipping-supplies starter kit: ${LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_starter_kit_html}`,
      `UCP shipping-supplies storefront template: ${LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_storefront_template_html}`,
      `UCP shipping-supplies collection route map: ${LIVE_PROOF_URLS.packrift_ucp_shipping_supplies_collection_map_html}`,
      `UCP builder sales loop: ${LIVE_PROOF_URLS.packrift_ucp_builder_sales_loop_html}`,
      `Stack412-style shipping-supplies aisle: ${LIVE_PROOF_URLS.packrift_ucp_stack412_shipping_supplies_aisle_html}`,
      `PlugThatShop-style contextual shipping shelf: ${LIVE_PROOF_URLS.packrift_ucp_plugthatshop_contextual_shelf_html}`,
      `Open Scout-style shopping-agent packaging path: ${LIVE_PROOF_URLS.packrift_ucp_open_scout_shopping_agent_path_html}`,
      `Upsonic-style UCP agent packaging workflow: ${LIVE_PROOF_URLS.packrift_ucp_upsonic_agent_workflow_html}`,
      `Stack412-style shelf demo: ${LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_demo_stack412}`,
      `PlugThatShop-style shelf demo: ${LIVE_PROOF_URLS.mcp_ucp_storefront_shelf_demo_plugthatshop}`,
      `Source-specific update card: https://mcp.packrift.com/ai/mcp-directory-update/${target.name}.json`,
      `Tracked config: ${TRACKED_CONFIG_TEMPLATE.replace("{source}", target.name)}`,
      `Live first-run proof: ${trackedRunUrl(target.name, "generic_streamable_http")}?execute=1`,
      `Activation runner: https://mcp.packrift.com/r/activate/${target.name}?format=html`,
      `Host acceptance eval pack: ${sourceEvalPackUrl(target.name)}`,
      "",
      "Acceptance gate: tools/list -> get_cart_handoff_candidates -> get_pricing -> check_inventory -> create_cart_url.",
    ].join("\n"),
  };
}

function directoryUpdateCardMarkdown(card) {
  return [
    "# Packrift MCP Directory Update Card",
    "",
    `Release: ${card.release}`,
    `Generated: ${card.generated_at}`,
    `Source: ${card.source}`,
    `Directory: ${card.directory.label}`,
    `Endpoint: ${card.canonical_listing.endpoint}`,
    "",
    "## Canonical Listing",
    "",
    `Server name: ${card.canonical_listing.server_name}`,
    `Registry name: ${card.canonical_listing.registry_name}`,
    `Authentication: ${card.canonical_listing.authentication}`,
    `Version: ${card.canonical_listing.version}`,
    `Tools: ${card.canonical_listing.tool_count} (${card.canonical_listing.tool_names.join(", ")})`,
    `Brand-domain Agent Web manifest: ${card.canonical_listing.brand_agent_web_manifest}`,
    `Hosted Agent Web manifest: ${card.canonical_listing.agent_web_manifest}`,
    `Capability card: ${card.canonical_listing.capability_card}`,
    `Marketplace manifest: ${card.canonical_listing.marketplace_manifest}`,
    `UCP starter catalog JSON: ${card.canonical_listing.ucp_starter_catalog_json}`,
    `UCP starter catalog HTML: ${card.canonical_listing.ucp_starter_catalog_html}`,
    `UCP builder kit JSON: ${card.canonical_listing.ucp_builder_kit_json}`,
    `UCP builder kit HTML: ${card.canonical_listing.ucp_builder_kit_html}`,
    `UCP storefront import JSON: ${card.canonical_listing.ucp_storefront_import_json}`,
    `UCP storefront import JSONL: ${card.canonical_listing.ucp_storefront_import_jsonl}`,
    `UCP storefront import CSV: ${card.canonical_listing.ucp_storefront_import_csv}`,
    `UCP storefront import HTML: ${card.canonical_listing.ucp_storefront_import_html}`,
    `UCP storefront shelf JSON: ${card.canonical_listing.ucp_storefront_shelf_json}`,
    `UCP storefront shelf HTML: ${card.canonical_listing.ucp_storefront_shelf_html}`,
    `UCP storefront shelf embed JS: ${card.canonical_listing.ucp_storefront_shelf_embed_js}`,
    `UCP storefront adoption JSON: ${card.canonical_listing.ucp_storefront_adoption_json}`,
    `UCP storefront adoption HTML: ${card.canonical_listing.ucp_storefront_adoption_html}`,
    `UCP builder launchpad JSON: ${card.canonical_listing.ucp_builder_launchpad_json}`,
    `UCP builder launchpad HTML: ${card.canonical_listing.ucp_builder_launchpad_html}`,
    `UCP builder approval packet JSON: ${card.canonical_listing.ucp_builder_approval_packet_json}`,
    `UCP builder approval packet HTML: ${card.canonical_listing.ucp_builder_approval_packet_html}`,
    `UCP builder integration pack JSON: ${card.canonical_listing.ucp_builder_integration_pack_json}`,
    `UCP builder integration pack HTML: ${card.canonical_listing.ucp_builder_integration_pack_html}`,
    `UCP shipping-supplies starter kit JSON: ${card.canonical_listing.ucp_shipping_supplies_starter_kit_json}`,
    `UCP shipping-supplies starter kit HTML: ${card.canonical_listing.ucp_shipping_supplies_starter_kit_html}`,
    `UCP shipping-supplies storefront template JSON: ${card.canonical_listing.ucp_shipping_supplies_storefront_template_json}`,
    `UCP shipping-supplies storefront template HTML: ${card.canonical_listing.ucp_shipping_supplies_storefront_template_html}`,
    `UCP shipping-supplies collection map JSON: ${card.canonical_listing.ucp_shipping_supplies_collection_map_json}`,
    `UCP shipping-supplies collection map Markdown: ${card.canonical_listing.ucp_shipping_supplies_collection_map_markdown}`,
    `UCP shipping-supplies collection map HTML: ${card.canonical_listing.ucp_shipping_supplies_collection_map_html}`,
    `UCP builder sales loop JSON: ${card.canonical_listing.ucp_builder_sales_loop_json}`,
    `UCP builder sales loop Markdown: ${card.canonical_listing.ucp_builder_sales_loop_markdown}`,
    `UCP builder sales loop HTML: ${card.canonical_listing.ucp_builder_sales_loop_html}`,
    `Stack412-style shipping-supplies aisle JSON: ${card.canonical_listing.ucp_stack412_shipping_supplies_aisle_json}`,
    `Stack412-style shipping-supplies aisle HTML: ${card.canonical_listing.ucp_stack412_shipping_supplies_aisle_html}`,
    `PlugThatShop-style contextual shipping shelf JSON: ${card.canonical_listing.ucp_plugthatshop_contextual_shelf_json}`,
    `PlugThatShop-style contextual shipping shelf HTML: ${card.canonical_listing.ucp_plugthatshop_contextual_shelf_html}`,
    `Open Scout-style shopping-agent packaging path JSON: ${card.canonical_listing.ucp_open_scout_shopping_agent_path_json}`,
    `Open Scout-style shopping-agent packaging path HTML: ${card.canonical_listing.ucp_open_scout_shopping_agent_path_html}`,
    `Upsonic-style UCP agent packaging workflow JSON: ${card.canonical_listing.ucp_upsonic_agent_workflow_json}`,
    `Upsonic-style UCP agent packaging workflow HTML: ${card.canonical_listing.ucp_upsonic_agent_workflow_html}`,
    `Stack412-style shelf demo: ${card.canonical_listing.ucp_storefront_shelf_demo_stack412}`,
    `PlugThatShop-style shelf demo: ${card.canonical_listing.ucp_storefront_shelf_demo_plugthatshop}`,
    `Source activation sitemap: ${card.canonical_listing.source_activation_sitemap}`,
    `Host acceptance eval pack: ${card.tracked_urls.eval_pack}`,
    "",
    "## Directory State",
    "",
    `Current status: ${card.directory.current_status}`,
    `Priority: ${card.directory.priority}`,
    `Listing URL: ${card.directory.listing_url}`,
    `Submission URL: ${card.directory.submission_url}`,
    `Stale markers: ${card.directory.stale_markers.length ? card.directory.stale_markers.join(", ") : "none"}`,
    "",
    "## Tracked URLs",
    "",
    fencedJson(card.tracked_urls),
    "",
    "## Acceptance Gate",
    "",
    card.acceptance_gate.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Copy-Ready Update Message",
    "",
    card.copy_ready_update_message,
    "",
  ].join("\n");
}

function glamaRecrawlNote(payload) {
  const glamaConnector = payload.targets.find((target) => target.name === "glama_connector");
  const glamaServer = payload.targets.find((target) => target.name === "glama_server_listing");
  const glamaEnvRequired = glamaServer?.distribution_observation?.environment_required ?? [];
  const tools = payload.live_proof.mcp_tools_list.tool_names ?? [];
  return [
    "Packrift MCP has a current hosted Streamable HTTP endpoint at https://mcp.packrift.com/mcp that requires no user-supplied API token.",
    `Live JSON-RPC tools/list now returns ${payload.live_proof.mcp_tools_list.tools_count ?? tools.length} tools: ${tools.join(", ")}.`,
    `Live resources/list returns ${payload.live_proof.mcp_resources_list.resources_count ?? "unknown"} resources and prompts/list returns ${payload.live_proof.mcp_prompts_list.prompts_count ?? "unknown"} prompts.`,
    `Glama's hosted connector is ${glamaConnector?.current_status ?? "not checked"} at ${glamaConnector?.current_evidence_url ?? "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp"} and should remain the primary Glama traffic target.`,
    `The Glama ownership claim is live at ${payload.live_proof.glama_claim.url} and uses ${payload.live_proof.glama_claim.schema}.`,
    glamaServer?.current_status === "stale"
      ? `Glama's open-source server API is stale for ${glamaServer.current_evidence_url}: observed ${glamaServer.distribution_observation?.tools_count ?? 0} tools and required env vars ${glamaEnvRequired.length ? glamaEnvRequired.join(", ") : "none"}. Please recrawl the latest official registry entry and hosted endpoint.`
      : `Glama server-listing status is ${glamaServer?.current_status ?? "not checked"} in the latest distribution check.`,
  ].join("\n");
}

function fencedJson(value) {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function markdownReport(payload) {
  const targetTable = payload.targets
    .map(
      (target) =>
        `| ${target.label} | ${target.current_status} | ${target.priority} | ${target.submission_url} | ${target.action} |`
    )
    .join("\n");

  const proofTable = Object.entries(payload.live_proof)
    .map(([name, proof]) => `| ${name} | ${proof.ok ? "pass" : "fail"} | ${proof.status} | ${proof.url} |`)
    .join("\n");

  const copyBlocks = payload.targets
    .filter((target) => target.current_status !== "pass")
    .map((target) =>
      [
        `### ${target.label}`,
        "",
        `Action: ${target.action}`,
        "",
        "Form fields:",
        fencedJson(target.form_fields),
        "",
        `Proof summary: ${payload.copy.proof_summary}`,
        "",
        "Proof URLs:",
        fencedJson(target.proof_urls),
        "",
      ].join("\n")
    )
    .join("\n");

  return [
    "# Packrift MCP Directory Submission Pack",
    "",
    `Generated: ${payload.generated_at}`,
    `Version: ${payload.copy.version}`,
    "",
    "## Canonical Listing Copy",
    "",
    `Server name: ${payload.copy.server_name}`,
    `Registry name: ${payload.copy.registry_name}`,
    `Short description: ${payload.copy.short_description}`,
    `Long description: ${payload.copy.long_description}`,
    `Repository: ${payload.copy.repository_url}`,
    `Remote endpoint: ${payload.copy.remote_endpoint}`,
    `Tracked start template: ${payload.copy.tracked_start_template}`,
    `Tracked config template: ${payload.copy.tracked_config_template}`,
    `Website: ${payload.copy.website_url}`,
    `Tags: ${payload.copy.tags.join(", ")}`,
    `Proof summary: ${payload.copy.proof_summary}`,
    "",
    "Install config:",
    fencedJson(payload.copy.install_config),
    "",
    "## Live Proof",
    "",
    "| Surface | Status | HTTP | URL |",
    "| --- | --- | --- | --- |",
    proofTable,
    "",
    "## Directory Targets",
    "",
    "| Directory | Current Status | Priority | Refresh URL | Action |",
    "| --- | --- | --- | --- | --- |",
    targetTable,
    "",
    "## Copy Blocks",
    "",
    copyBlocks || "All tracked targets are already passing.",
    "",
    "## Glama Recrawl Note",
    "",
    payload.glama_recrawl_note,
    "",
  ].join("\n");
}

async function main() {
  const liveProofRaw = Object.fromEntries(
    await Promise.all(Object.entries(LIVE_PROOF_URLS).map(async ([name, url]) => [name, await fetchJson(url)]))
  );
  liveProofRaw.mcp_tools_list = await fetchMcp("tools/list");
  liveProofRaw.mcp_resources_list = await fetchMcp("resources/list");
  liveProofRaw.mcp_prompts_list = await fetchMcp("prompts/list");
  const distribution = readDistribution();
  const liveProof = liveProofDigest(liveProofRaw);
  const copy = canonicalListingCopy(liveProofRaw);
  const targets = targetRows(distribution, copy);
  const generatedAt = new Date().toISOString();
  const outDir = resolve(OUT_ROOT, generatedAt.replace(/[:.]/g, "-"));
  const payload = {
    generated_at: generatedAt,
    copy,
    live_proof: liveProof,
    targets,
    distribution_counts: distribution?.counts ?? null,
  };
  payload.glama_recrawl_note = glamaRecrawlNote(payload);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "directory-submission-pack.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(outDir, "directory-submission-pack.md"), markdownReport(payload));
  for (const target of targets) {
    const card = directoryUpdateCard(payload, target);
    writeFileSync(resolve(outDir, `directory-update-${target.name}.json`), JSON.stringify(card, null, 2) + "\n");
    writeFileSync(resolve(outDir, `directory-update-${target.name}.md`), directoryUpdateCardMarkdown(card));
  }
  writeFileSync(resolve(OUT_ROOT, "latest.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(OUT_ROOT, "latest.md"), markdownReport(payload));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
