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
    action: "Monitor the hosted Glama connector; it should stay healthy and list the 14 live tools.",
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
    name: "pulsemcp_packrift",
    label: "PulseMCP",
    listing_url: "https://www.pulsemcp.com/servers/packrift",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    category: "Business",
    priority: "high",
    action: "Use official-registry publication and public server.json as the recrawl source; this checker may see a 403 from PulseMCP.",
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
  manifest: "https://mcp.packrift.com/manifest",
  server_card: "https://mcp.packrift.com/server-card.json",
  well_known_server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
  glama_claim: "https://mcp.packrift.com/.well-known/glama.json",
  marketplace_manifest: "https://mcp.packrift.com/.well-known/mcp-marketplace.json",
  cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
  all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
  mcp_adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
  mcp_install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
  mcp_usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
  mcp_buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
  browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
  mcp_directory_refresh: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
  mcp_directory_submit_actions: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
  docker_mcp_catalog_pr: "https://api.github.com/repos/docker/mcp-registry/pulls/3388",
};

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
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      value: response.ok ? JSON.parse(text) : null,
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
    proof_summary: `${toolsCount} tools, ${promptsCount} prompts, ${resourcesCount} resources, direct live MCP introspection, public manifests, valid Glama claim, and MCP-attributed cart handoff candidates.`,
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
      live_health: LIVE_PROOF_URLS.health,
      live_manifest: LIVE_PROOF_URLS.manifest,
      mcp_tools_list: `${MCP_ENDPOINT} via JSON-RPC method tools/list`,
      glama_claim: LIVE_PROOF_URLS.glama_claim,
      cart_handoff_candidates: LIVE_PROOF_URLS.cart_handoff_candidates,
      all_agent_capture: LIVE_PROOF_URLS.all_agent_capture,
      mcp_adoption_kit: LIVE_PROOF_URLS.mcp_adoption_kit,
      mcp_install_matrix: LIVE_PROOF_URLS.mcp_install_matrix,
      mcp_usage_snapshot: LIVE_PROOF_URLS.mcp_usage_snapshot,
      mcp_buyer_use_cases: LIVE_PROOF_URLS.mcp_buyer_use_cases,
      browser_agent_bridge: LIVE_PROOF_URLS.browser_agent_bridge,
      mcp_directory_refresh: LIVE_PROOF_URLS.mcp_directory_refresh,
      mcp_directory_submit_actions: LIVE_PROOF_URLS.mcp_directory_submit_actions,
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
    browser_agent_bridge: {
      ok: liveProof.browser_agent_bridge.ok,
      status: liveProof.browser_agent_bridge.status,
      url: liveProof.browser_agent_bridge.url,
      release: liveProof.browser_agent_bridge.value?.release ?? null,
      workflows_count: liveProof.browser_agent_bridge.value?.workflows?.length ?? null,
      canonical_endpoint: liveProof.browser_agent_bridge.value?.canonical_endpoint ?? null,
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
  writeFileSync(resolve(OUT_ROOT, "latest.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(OUT_ROOT, "latest.md"), markdownReport(payload));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
