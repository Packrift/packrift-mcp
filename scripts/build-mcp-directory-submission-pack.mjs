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
    action: "Refresh the GitHub repo listing so it no longer shows the old zero-tool, token-required server record.",
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
    submission_url: "https://www.mcplist.ai/",
    category: "Business",
    priority: "medium",
    action: "Find the current MCPLIST submission form or repository path, then submit Packrift with the hosted endpoint and source-specific update card.",
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
    action: "Monitor GPMCP for a listing/import/contact path and use the source-specific update card if a submission path opens.",
  },
  {
    name: "theresamcpforthat",
    label: "There's an MCP for That",
    listing_url: "https://theresamcpforthat.com/directory?search=packrift",
    submission_url: "https://theresamcpforthat.com/",
    category: "Business",
    priority: "medium",
    action: "Monitor for a public submit or repository path and use the source-specific update card when a path is available.",
  },
  {
    name: "mcpserverfinder",
    label: "MCP Server Finder",
    listing_url: "https://www.mcpserverfinder.com/?q=packrift",
    submission_url: "mailto:info@mcpserverfinder.com",
    category: "Business",
    priority: "medium",
    action: "Email MCP Server Finder with the hosted endpoint, marketplace manifest, and source-specific update card.",
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
  mcp_cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
  mcp_first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
  mcp_workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
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
    const value = response.ok && !url.endsWith(".xml") ? JSON.parse(text) : text;
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
    proof_summary: `${toolsCount} tools, ${promptsCount} prompts, ${resourcesCount} resources, direct live MCP introspection, public manifests, valid Glama claim, source-attributed /r/config/{source} config links, and MCP-attributed cart handoff candidates.`,
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
    release: "PACKRIFT-MCP-DIRECTORY-UPDATE-CARD-R06",
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
      marketplace_manifest: LIVE_PROOF_URLS.marketplace_manifest,
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
    },
    acceptance_gate: [
      "Install the hosted no-auth Streamable HTTP endpoint.",
      "Run tools/list against the source-aware endpoint.",
      "Run get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url.",
      "Treat the listing as activated only when create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
    ],
    copy_ready_update_message: [
      `Subject: Refresh ${target.label} Packrift MCP listing`,
      "",
      `Please recrawl Packrift MCP from ${LIVE_PROOF_URLS.marketplace_manifest} and ${LIVE_PROOF_URLS.source_activation_sitemap}.`,
      `Endpoint: ${MCP_ENDPOINT}`,
      `Source-specific update card: https://mcp.packrift.com/ai/mcp-directory-update/${target.name}.json`,
      `Tracked config: ${TRACKED_CONFIG_TEMPLATE.replace("{source}", target.name)}`,
      `Live first-run proof: ${trackedRunUrl(target.name, "generic_streamable_http")}?execute=1`,
      `Activation runner: https://mcp.packrift.com/r/activate/${target.name}?format=html`,
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
    `Marketplace manifest: ${card.canonical_listing.marketplace_manifest}`,
    `Source activation sitemap: ${card.canonical_listing.source_activation_sitemap}`,
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
