#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const PACKAGE_JSON = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
const EXPECTED_VERSION = process.env.PACKRIFT_MCP_EXPECTED_VERSION || PACKAGE_JSON.version;
const OUT_ROOT = resolve(process.cwd(), "outputs/mcp-distribution-check");
const RUN_CACHE_BUST = Date.now().toString(36);
const PACKRIFT_ORIGIN = "https://mcp.packrift.com";
const execFileAsync = promisify(execFile);

const SURFACE_GUIDANCE = {
  official_registry: {
    listing_url: "https://registry.modelcontextprotocol.io/servers/io.github.Packrift/packrift-mcp",
    submission_url: "https://github.com/modelcontextprotocol/registry",
    priority: "core",
    follow_up_action: "Keep server.json published with mcp-publisher whenever the public MCP surface changes.",
  },
  live_mcp_surface: {
    listing_url: "https://mcp.packrift.com/health",
    submission_url: "https://mcp.packrift.com/manifest",
    priority: "core",
    follow_up_action: "Keep the live health, manifest, server-card, and cart-handoff resources passing before pushing directory refreshes.",
  },
  mcpservers_org: {
    listing_url: "https://mcpservers.org/servers/packrift/packrift-mcp",
    submission_url: "https://mcpservers.org/submit",
    priority: "high",
    follow_up_action: "Submitted through the public form on 2026-05-19; monitor review/recrawl until the listing reflects the current 15-tool cart-handoff README.",
  },
  mcpbench: {
    listing_url: "https://mcpbench.ai/servers/io.github.Packrift/packrift-mcp",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    priority: "medium",
    follow_up_action: "Monitor its official-registry ingestion and use the current official-registry pass as recrawl evidence.",
  },
  glama_connector: {
    listing_url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    submission_url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    priority: "high",
    follow_up_action: "Keep the hosted Glama connector healthy and listing all 15 current tools.",
  },
  glama_server_listing: {
    listing_url: "https://glama.ai/mcp/servers/ye4xxr7qiu",
    submission_url: "https://glama.ai/",
    priority: "high",
    follow_up_action: "Refresh the open-source server listing so it no longer shows the old token-required zero-tool record.",
  },
  mcp_directory: {
    listing_url: "https://mcp.directory/servers?q=packrift",
    submission_url: "https://mcp.directory/submit",
    priority: "high",
    follow_up_action: "Repository submission is already queued; monitor search and request claim/edit access if Packrift appears from auto-discovery.",
  },
  anthropic_connectors_directory: {
    listing_url: "https://claude.com/connectors",
    submission_url: "https://clau.de/mcp-directory-submission",
    priority: "high",
    follow_up_action: "Submit Packrift MCP through the Claude connector directory form with endpoint, no-auth policy, and first-run proof.",
  },
  smithery: {
    listing_url: "https://smithery.ai/servers?q=Packrift",
    submission_url: "https://smithery.ai/new",
    priority: "high",
    follow_up_action: "Publish or claim Packrift on Smithery after authenticating; use the hosted endpoint and schema-friendly server card.",
  },
  cline_mcp_marketplace: {
    listing_url: "https://github.com/cline/mcp-marketplace/issues/1610",
    submission_url: "https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml",
    priority: "high",
    follow_up_action: "Keep the Cline MCP Marketplace submission issue current until it is published.",
  },
  mcp_so: {
    listing_url: "https://mcp.so/servers?keyword=Packrift",
    submission_url: "https://github.com/chatmcp/mcpso/issues/2189",
    priority: "high",
    follow_up_action: "MCP.so issue #2189 was updated with current 15-tool hosted endpoint proof on 2026-05-19; monitor for publication before attempting a duplicate form submission.",
  },
  browse_sh: {
    listing_url: "https://browse.sh/",
    submission_url: "https://browse.sh/",
    priority: "high",
    follow_up_action: "Browse catalog search finds Packrift and browse skills add installs it; monitor install count and keep the MCP-first skill current.",
  },
  chiark: {
    listing_url: "https://chiark.ai/",
    submission_url: "https://chiark.ai/methodology",
    priority: "medium",
    follow_up_action: "Chiark crawls upstream registries daily, so push official/PulseMCP/Smithery-style coverage first and then monitor for Packrift by endpoint URL.",
  },
  mcp_marketplace_io: {
    listing_url: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
    submission_url: "https://mcp-marketplace.io/for-creators",
    priority: "medium",
    follow_up_action: "Keep LAUNCHGUIDE.md and the public marketplace discovery manifest current, then monitor marketplace score and installs.",
  },
  pulsemcp_packrift: {
    listing_url: "https://www.pulsemcp.com/servers/packrift",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    priority: "high",
    follow_up_action: "PulseMCP is blocked to this checker; use official-registry publication and public server.json as the recrawl source.",
  },
  mcpmarket_com: {
    listing_url: "https://mcpmarket.com/server/packrift",
    submission_url: "https://mcpmarket.com/submit",
    priority: "medium",
    follow_up_action: "Use browser-side verification or the submit/update flow; automated checks hit a Vercel checkpoint.",
  },
  cursor_directory: {
    listing_url: "https://cursor.directory/",
    submission_url: "https://cursor.directory/plugins/new",
    priority: "medium",
    follow_up_action: "Use the Cursor Directory plugin submission flow after browser auth with the hosted MCP config.",
  },
  mcpcentral: {
    listing_url: "https://mcpcentral.io/servers",
    submission_url: "https://mcpcentral.io/submit-server",
    priority: "medium",
    follow_up_action: "Use browser-side MCP Central submission or request review access because automated checks hit a challenge.",
  },
  mcpfinder: {
    listing_url: "https://www.mcpfinder.org/",
    submission_url: "https://www.mcpfinder.org/submit",
    priority: "medium",
    follow_up_action: "Submit Packrift MCP through MCPfinder with hosted endpoint proof and tracked start URL.",
  },
  mcpskills: {
    listing_url: "https://mcpskills.app/servers",
    submission_url: "https://mcpskills.app/submit",
    priority: "medium",
    follow_up_action: "MCPSkills direct submission is queued; monitor for Packrift appearing in the public server directory.",
  },
  agentndx: {
    listing_url: "https://agentndx.ai/browse",
    submission_url: "https://agentndx.ai/submit",
    priority: "medium",
    follow_up_action: "AgentNDX direct submission is queued; monitor for Packrift appearing in browse/API results.",
  },
  docker_mcp_catalog: {
    listing_url: "https://github.com/docker/mcp-registry/pull/3388",
    submission_url: "https://github.com/docker/mcp-registry/pull/3388",
    priority: "medium",
    follow_up_action: "Keep the Docker MCP Catalog remote-server PR mergeable until Docker reviews and merges it.",
  },
};

const TEXT_HEADERS = {
  "User-Agent": "Packrift-MCP-Distribution-Check/1.0 (+https://mcp.packrift.com/mcp)",
  Accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

function cacheBustedUrl(url) {
  if (!url.startsWith(PACKRIFT_ORIGIN)) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("packrift_check", RUN_CACHE_BUST);
  return parsed.toString();
}

async function fetchText(url) {
  try {
    const response = await fetch(cacheBustedUrl(url), { headers: TEXT_HEADERS, redirect: "follow" });
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, text };
  } catch (error) {
    return { ok: false, status: 0, url, text: "", error: error.message };
  }
}

async function fetchRedirect(url) {
  try {
    const response = await fetch(cacheBustedUrl(url), { headers: TEXT_HEADERS, redirect: "manual" });
    return {
      ok: response.status >= 300 && response.status < 400,
      status: response.status,
      url: response.url,
      location: response.headers.get("location") ?? "",
    };
  } catch (error) {
    return { ok: false, status: 0, url, location: "", error: error.message };
  }
}

async function fetchMcp(method, params = undefined) {
  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: {
        ...TEXT_HEADERS,
        "Content-Type": "application/json",
        Accept: "application/json",
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
    return { ok: false, status: 0, url: MCP_ENDPOINT, value: null, error: error.message };
  }
}

function hasAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function parseJsonOrNull(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function parseUrlOrNull(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function check(name, status, details = {}) {
  return { name, status, ...details };
}

function withGuidance(row) {
  const guidance = SURFACE_GUIDANCE[row.name] ?? {};
  return {
    ...guidance,
    ...row,
    listing_url: row.listing_url ?? guidance.listing_url ?? row.url ?? null,
    submission_url: row.submission_url ?? guidance.submission_url ?? null,
    follow_up_action: row.follow_up_action ?? guidance.follow_up_action ?? "Review and refresh this surface manually.",
    priority: row.priority ?? guidance.priority ?? "medium",
  };
}

async function officialRegistryCheck() {
  const result = await fetchText("https://registry.modelcontextprotocol.io/v0/servers?search=Packrift");
  if (!result.ok) return check("official_registry", "fail", { http_status: result.status, url: result.url });

  const parsed = JSON.parse(result.text);
  const versions = parsed.servers
    .filter((row) => row.server?.name === "io.github.Packrift/packrift-mcp")
    .map((row) => ({
      version: row.server.version,
      description: row.server.description,
      status: row._meta?.["io.modelcontextprotocol.registry/official"]?.status,
      is_latest: row._meta?.["io.modelcontextprotocol.registry/official"]?.isLatest,
    }));
  const latest = versions.find((row) => row.is_latest);
  return check(
    "official_registry",
    latest?.version === EXPECTED_VERSION && latest?.status === "active" ? "pass" : "stale",
    { expected_version: EXPECTED_VERSION, latest, versions }
  );
}

async function liveMcpCheck() {
  const [
    healthResult,
    serverCardResult,
    startResult,
    cartResult,
    agentCaptureResult,
    adoptionKitResult,
    installMatrixResult,
    installActionsResult,
    firstRunActionsResult,
    clientConfigResult,
    rootMcpJsonResult,
    wellKnownMcpJsonResult,
    trackedConfigGenericResult,
    trackedInstallCodexResult,
    trackedInstallCodexHtmlResult,
    trackedFirstRunGenericResult,
    trackedFirstRunHtmlResult,
    trackedFirstRunExecuteResult,
    usageSnapshotResult,
    funnelSnapshotResult,
    buyerUseCasesResult,
    cartActivationResult,
    firstRunProofResult,
    workflowGalleryResult,
    browserAgentBridgeResult,
    browserbaseBrowseSkillPackResult,
    directoryRefreshResult,
    directorySubmitActionsResult,
    reviewerActivationResult,
    trackedReviewerActivationGenericResult,
    trackedReviewerActivationHtmlResult,
    claudeConnectorSubmissionResult,
    agentCaptureOutreachResult,
    trackedStartPartnerResult,
    trackedStartHtmlPartnerResult,
    invalidStartSourceResult,
    invalidConfigSourceResult,
    invalidInstallSourceResult,
    invalidInstallTargetResult,
    invalidFirstRunSourceResult,
    invalidFirstRunTargetResult,
    invalidReviewerActivationSourceResult,
    toolsResult,
    resourcesResult,
    promptsResult,
  ] = await Promise.all([
    fetchText("https://mcp.packrift.com/health"),
    fetchText("https://mcp.packrift.com/.well-known/mcp/server-card.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-start.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json"),
    fetchText("https://mcp.packrift.com/ai/all-agent-capture.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-adoption-kit.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-install-matrix.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-install-actions.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-first-run-actions.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-client-config.json"),
    fetchText("https://mcp.packrift.com/mcp.json"),
    fetchText("https://mcp.packrift.com/.well-known/mcp.json"),
    fetchText("https://mcp.packrift.com/r/config/generic?utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/install/generic/codex?format=text&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/install/generic/codex?format=html&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/run/generic/generic_streamable_http?format=sh&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/run/generic/generic_streamable_http?format=html&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/run/generic/generic_streamable_http?execute=1&format=json&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/ai/mcp-usage-snapshot.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-funnel-snapshot.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-buyer-use-cases.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-cart-activation.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-first-run-proof.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-workflow-gallery.json"),
    fetchText("https://mcp.packrift.com/ai/browser-agent-bridge.json"),
    fetchText("https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-refresh.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-submit-actions.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-reviewer-activation.json"),
    fetchText("https://mcp.packrift.com/r/activate/generic?format=json&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/activate/generic?format=html&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/ai/claude-connector-submission.json"),
    fetchText("https://mcp.packrift.com/ai/agent-capture-outreach.json"),
    fetchRedirect("https://mcp.packrift.com/r/start/partner_demo?utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/start?utm_source=partner_demo&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/start/bad-source"),
    fetchText("https://mcp.packrift.com/r/config/bad-source"),
    fetchText("https://mcp.packrift.com/r/install/bad-source/codex"),
    fetchText("https://mcp.packrift.com/r/install/generic/not_a_real_target"),
    fetchText("https://mcp.packrift.com/r/run/bad-source/generic_streamable_http"),
    fetchText("https://mcp.packrift.com/r/run/generic/not_a_real_target"),
    fetchText("https://mcp.packrift.com/r/activate/bad-source"),
    fetchMcp("tools/list"),
    fetchMcp("resources/list"),
    fetchMcp("prompts/list"),
  ]);
  const health = healthResult.ok ? JSON.parse(healthResult.text) : null;
  const serverCard = serverCardResult.ok ? JSON.parse(serverCardResult.text) : null;
  const start = startResult.ok ? JSON.parse(startResult.text) : null;
  const cart = cartResult.ok ? JSON.parse(cartResult.text) : null;
  const agentCapture = agentCaptureResult.ok ? JSON.parse(agentCaptureResult.text) : null;
  const adoptionKit = adoptionKitResult.ok ? JSON.parse(adoptionKitResult.text) : null;
  const installMatrix = installMatrixResult.ok ? JSON.parse(installMatrixResult.text) : null;
  const installActions = installActionsResult.ok ? JSON.parse(installActionsResult.text) : null;
  const firstRunActions = firstRunActionsResult.ok ? JSON.parse(firstRunActionsResult.text) : null;
  const clientConfig = clientConfigResult.ok ? JSON.parse(clientConfigResult.text) : null;
  const rootMcpJson = rootMcpJsonResult.ok ? JSON.parse(rootMcpJsonResult.text) : null;
  const wellKnownMcpJson = wellKnownMcpJsonResult.ok ? JSON.parse(wellKnownMcpJsonResult.text) : null;
  const trackedConfigGeneric = trackedConfigGenericResult.ok ? JSON.parse(trackedConfigGenericResult.text) : null;
  const trackedFirstRunExecute = trackedFirstRunExecuteResult.ok ? JSON.parse(trackedFirstRunExecuteResult.text) : null;
  const usageSnapshot = usageSnapshotResult.ok ? JSON.parse(usageSnapshotResult.text) : null;
  const funnelSnapshot = funnelSnapshotResult.ok ? JSON.parse(funnelSnapshotResult.text) : null;
  const buyerUseCases = buyerUseCasesResult.ok ? JSON.parse(buyerUseCasesResult.text) : null;
  const cartActivation = cartActivationResult.ok ? JSON.parse(cartActivationResult.text) : null;
  const firstRunProof = firstRunProofResult.ok ? JSON.parse(firstRunProofResult.text) : null;
  const workflowGallery = workflowGalleryResult.ok ? JSON.parse(workflowGalleryResult.text) : null;
  const browserAgentBridge = browserAgentBridgeResult.ok ? JSON.parse(browserAgentBridgeResult.text) : null;
  const browserbaseBrowseSkillPack = browserbaseBrowseSkillPackResult.ok ? JSON.parse(browserbaseBrowseSkillPackResult.text) : null;
  const directoryRefresh = directoryRefreshResult.ok ? JSON.parse(directoryRefreshResult.text) : null;
  const directorySubmitActions = directorySubmitActionsResult.ok ? JSON.parse(directorySubmitActionsResult.text) : null;
  const reviewerActivation = reviewerActivationResult.ok ? JSON.parse(reviewerActivationResult.text) : null;
  const trackedReviewerActivationGeneric = trackedReviewerActivationGenericResult.ok ? JSON.parse(trackedReviewerActivationGenericResult.text) : null;
  const claudeConnectorSubmission = claudeConnectorSubmissionResult.ok ? JSON.parse(claudeConnectorSubmissionResult.text) : null;
  const agentCaptureOutreach = agentCaptureOutreachResult.ok ? JSON.parse(agentCaptureOutreachResult.text) : null;
  const trackedStartTarget = parseUrlOrNull(trackedStartPartnerResult.location);
  const invalidStartSource = parseJsonOrNull(invalidStartSourceResult.text);
  const invalidConfigSource = parseJsonOrNull(invalidConfigSourceResult.text);
  const invalidInstallSource = parseJsonOrNull(invalidInstallSourceResult.text);
  const invalidInstallTarget = parseJsonOrNull(invalidInstallTargetResult.text);
  const invalidFirstRunSource = parseJsonOrNull(invalidFirstRunSourceResult.text);
  const invalidFirstRunTarget = parseJsonOrNull(invalidFirstRunTargetResult.text);
  const invalidReviewerActivationSource = parseJsonOrNull(invalidReviewerActivationSourceResult.text);
  const firstCartUrl = cart?.items?.[0]?.cart_url_qty_1_candidate ?? "";
  const firstFinalCartUrl = cart?.items?.[0]?.final_shopify_cart_url_candidate ?? "";
  const toolNames = (toolsResult.value?.result?.tools ?? []).map((tool) => tool.name).filter(Boolean);
  const resources = resourcesResult.value?.result?.resources ?? [];
  const resourcesCount = resources.length;
  const resourceUris = new Set(resources.map((resource) => resource.uri));
  const promptsCount = promptsResult.value?.result?.prompts?.length ?? 0;
  return check(
    "live_mcp_surface",
    health?.version === EXPECTED_VERSION &&
      health?.resources_count >= 65 &&
      health?.tools_count >= 15 &&
      serverCard?.serverInfo?.name === "Packrift MCP" &&
      serverCard?.authentication?.required === false &&
      serverCard?.endpoint_url === MCP_ENDPOINT &&
      serverCard?.client_config?.root_mcp_json === "https://mcp.packrift.com/mcp.json" &&
      serverCard?.client_config?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      serverCard?.client_config?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      serverCard?.registry_distribution?.reviewer_activation === "https://mcp.packrift.com/ai/mcp-reviewer-activation.json" &&
      serverCard?.registry_distribution?.tracked_reviewer_activation_template === "https://mcp.packrift.com/r/activate/{source}" &&
      serverCard?.registry_distribution?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      serverCard?.registry_distribution?.tracked_reviewer_activation_html_generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      Array.isArray(serverCard?.tools) &&
      serverCard.tools.length >= 15 &&
      serverCard.tools.some((tool) => tool?.name === "create_cart_url" && tool?.inputSchema) &&
      serverCard.tools.some((tool) => tool?.name === "prepare_purchase_handoff" && tool?.inputSchema) &&
      Array.isArray(serverCard?.resources) &&
      serverCard.resources.length >= 65 &&
      Array.isArray(serverCard?.prompts) &&
      serverCard.prompts.length >= 7 &&
      Array.isArray(serverCard?.tool_names) &&
      serverCard.tool_names.includes("create_cart_url") &&
      toolNames.length >= 15 &&
      toolNames.includes("create_cart_url") &&
      toolNames.includes("get_cart_handoff_candidates") &&
      toolNames.includes("prepare_purchase_handoff") &&
      resourcesCount >= 65 &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-funnel-snapshot.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-funnel-snapshot.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-actions.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-actions.md") &&
      promptsCount >= 7 &&
      cart?.release === "PACKRIFT-MCP-CART-HANDOFF-CANDIDATES-R03" &&
      cart?.items?.length >= 50 &&
      cart?.items?.[0]?.cart_url_candidate_type === "mcp_cart_landing_redirect" &&
      start?.release === "PACKRIFT-MCP-START-R09" &&
      start?.canonical_endpoint === MCP_ENDPOINT &&
      start?.first_flow?.length >= 6 &&
      start?.first_flow?.some((step) => step?.request?.params?.name === "create_cart_url") &&
      start?.first_useful_run?.endpoint?.startsWith(`${MCP_ENDPOINT}?`) &&
      start?.first_useful_run?.sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      start?.first_useful_run?.curl_script?.includes("curl -sS") &&
      start?.first_useful_run?.curl_script?.includes("create_cart_url") &&
      start?.first_useful_run?.curl_commands?.length >= 5 &&
      start?.start_urls?.tracked_start_template === "https://mcp.packrift.com/r/start/{source}" &&
      start?.start_urls?.source_aware_html_template === "https://mcp.packrift.com/start?utm_source={source}" &&
      start?.start_urls?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      start?.start_urls?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      start?.start_urls?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      start?.start_urls?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      start?.start_urls?.source_policy?.partner_specific_sources_allowed === true &&
      start?.start_urls?.source_policy?.accepted_source_format === "^[a-z0-9_]{2,64}$" &&
      start?.start_urls?.tracked_examples?.mcpservers_org?.startsWith("https://mcp.packrift.com/r/start/mcpservers_org") &&
      start?.start_urls?.tracked_examples?.anthropic_connectors_directory?.startsWith("https://mcp.packrift.com/r/start/anthropic_connectors_directory") &&
      start?.start_urls?.tracked_examples?.smithery?.startsWith("https://mcp.packrift.com/r/start/smithery") &&
      start?.start_urls?.tracked_examples?.mcpfinder?.startsWith("https://mcp.packrift.com/r/start/mcpfinder") &&
      start?.start_urls?.tracked_config_examples?.smithery?.startsWith("https://mcp.packrift.com/r/config/smithery") &&
      start?.start_urls?.tracked_config_examples?.mcpfinder?.startsWith("https://mcp.packrift.com/r/config/mcpfinder") &&
      start?.start_urls?.tracked_install_examples?.mcpfinder?.codex?.startsWith("https://mcp.packrift.com/r/install/mcpfinder/codex") &&
      start?.start_urls?.tracked_run_examples?.mcpfinder?.startsWith("https://mcp.packrift.com/r/run/mcpfinder/generic_streamable_http") &&
      start?.proof_urls?.usage_snapshot === "https://mcp.packrift.com/ai/mcp-usage-snapshot.json" &&
      start?.proof_urls?.install_actions === "https://mcp.packrift.com/ai/mcp-install-actions.json" &&
      start?.proof_urls?.first_run_actions === "https://mcp.packrift.com/ai/mcp-first-run-actions.json" &&
      start?.proof_urls?.client_config === "https://mcp.packrift.com/ai/mcp-client-config.json" &&
      trackedStartPartnerResult.status === 302 &&
      trackedStartTarget?.origin === PACKRIFT_ORIGIN &&
      trackedStartTarget?.pathname === "/start" &&
      trackedStartTarget?.searchParams?.get("utm_source") === "partner_demo" &&
      trackedStartTarget?.searchParams?.get("utm_content") === "distribution_check" &&
      trackedStartTarget?.searchParams?.get("mcp_key") === "start:partner_demo" &&
      trackedStartTarget?.searchParams?.get("mcp_journey") === "directory_recrawl:partner_demo:start" &&
      trackedStartHtmlPartnerResult.ok &&
      trackedStartHtmlPartnerResult.text.includes("Tracked install source: partner demo") &&
      trackedStartHtmlPartnerResult.text.includes("https://mcp.packrift.com/r/config/partner_demo") &&
      trackedStartHtmlPartnerResult.text.includes("https://mcp.packrift.com/r/install/partner_demo/codex") &&
      trackedStartHtmlPartnerResult.text.includes("https://mcp.packrift.com/r/run/partner_demo/generic_streamable_http") &&
      trackedStartHtmlPartnerResult.text.includes("https://mcp.packrift.com/r/activate/partner_demo?format=html") &&
      trackedStartHtmlPartnerResult.text.includes("Activation runner") &&
      trackedStartHtmlPartnerResult.text.includes("Run After Install") &&
      trackedStartHtmlPartnerResult.text.includes("data-copy-target=\"first_useful_sequence\"") &&
      trackedStartHtmlPartnerResult.text.includes("data-copy-target=\"first_useful_curl_script\"") &&
      trackedStartHtmlPartnerResult.text.includes("packrift_mcp_source=partner_demo") &&
      trackedStartHtmlPartnerResult.text.includes("mcp_install_copy") &&
      trackedStartHtmlPartnerResult.text.includes("data-copy-target=\"tracked_config_url\"") &&
      trackedStartHtmlPartnerResult.text.includes("data-copy-target=\"tracked_run_url\"") &&
      trackedStartHtmlPartnerResult.text.includes("Copy config URL") &&
      invalidStartSourceResult.status === 404 &&
      invalidStartSource?.error === "invalid_mcp_start_source" &&
      invalidStartSource?.valid_format === "^[a-z0-9_]{2,64}$" &&
      invalidStartSource?.partner_specific_sources_allowed === true &&
      invalidConfigSourceResult.status === 404 &&
      invalidConfigSource?.error === "invalid_mcp_config_source" &&
      invalidConfigSource?.valid_format === "^[a-z0-9_]{2,64}$" &&
      invalidConfigSource?.partner_specific_sources_allowed === true &&
      invalidInstallSourceResult.status === 404 &&
      invalidInstallSource?.error === "invalid_mcp_install_source" &&
      invalidInstallTargetResult.status === 404 &&
      invalidInstallTarget?.error === "invalid_mcp_install_target" &&
      invalidFirstRunSourceResult.status === 404 &&
      invalidFirstRunSource?.error === "invalid_mcp_first_run_source" &&
      invalidFirstRunTargetResult.status === 404 &&
      invalidFirstRunTarget?.error === "invalid_mcp_first_run_target" &&
      invalidReviewerActivationSourceResult.status === 404 &&
      invalidReviewerActivationSource?.error === "invalid_mcp_reviewer_activation_source" &&
      trackedInstallCodexResult.ok &&
      trackedInstallCodexResult.text.includes("codex mcp add packrift --url") &&
      trackedInstallCodexResult.text.includes("https://mcp.packrift.com/mcp") &&
      trackedInstallCodexResult.text.includes("packrift_mcp_source=generic") &&
      trackedFirstRunGenericResult.ok &&
      trackedFirstRunGenericResult.text.includes("create_cart_url") &&
      trackedFirstRunGenericResult.text.includes("packrift_mcp_source=generic") &&
      trackedFirstRunGenericResult.text.includes("MCP-First-Run/1.0") &&
      trackedFirstRunHtmlResult.ok &&
      trackedFirstRunHtmlResult.text.includes("Packrift MCP First Run") &&
      trackedFirstRunHtmlResult.text.includes("Run live proof") &&
      trackedFirstRunHtmlResult.text.includes("create_cart_url") &&
      trackedFirstRunHtmlResult.text.includes("Shell One-Liner") &&
      trackedFirstRunExecuteResult.ok &&
      trackedFirstRunExecute?.release === "PACKRIFT-MCP-FIRST-RUN-ACTION-R03" &&
      trackedFirstRunExecute?.status === "ok" &&
      trackedFirstRunExecute?.sku === "1066" &&
      trackedFirstRunExecute?.cart?.url?.startsWith("https://mcp.packrift.com/r/cart/1066") &&
      trackedFirstRunExecute?.no_order_created === true &&
      agentCapture?.release === "PACKRIFT-ALL-AGENT-CAPTURE-R12" &&
      agentCapture?.surfaces?.length >= 22 &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_start" && surface.canonical_url === "https://mcp.packrift.com/start" && surface.install_or_call?.includes("/r/start/{source}")) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_install_actions" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-install-actions.json") &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_first_run_actions" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-first-run-actions.json" && surface.install_or_call?.includes("/r/run/{source}/{target}")) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_reviewer_activation" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-reviewer-activation.json" && surface.install_or_call?.includes("/r/activate/{source}?format=html")) &&
      agentCapture?.hub_urls?.tracked_reviewer_activation_runner_generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_client_config" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-client-config.json") &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_funnel_snapshot" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json") &&
      agentCapture?.surfaces?.some((surface) => surface.id === "agent_capture_outreach_packet" && surface.canonical_url === "https://mcp.packrift.com/ai/agent-capture-outreach.json") &&
      adoptionKit?.release === "PACKRIFT-MCP-ADOPTION-KIT-R03" &&
      adoptionKit?.first_five_minutes?.length >= 6 &&
      adoptionKit?.developer_examples?.length >= 4 &&
      adoptionKit?.install?.reviewer_activation_runner_generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      adoptionKit?.proof_urls?.reviewer_activation_runner_generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      adoptionKit?.expected_first_flow_outcomes?.some((outcome) => outcome.includes("https://mcp.packrift.com/r/cart/")) &&
      installMatrix?.release === "PACKRIFT-MCP-INSTALL-MATRIX-R03" &&
      installMatrix?.hosts?.length >= 8 &&
      installMatrix?.smoke_tests?.length >= 6 &&
      installMatrix?.smoke_tests?.some((test) => test.id === "cart-1066" && test.request?.params?.name === "create_cart_url") &&
      installMatrix?.hosts?.filter((host) => host.preferred).every((host) => host.first_test_ids?.includes("cart-1066")) &&
      installMatrix?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      installMatrix?.tracked_install_examples?.codex?.startsWith("https://mcp.packrift.com/r/install/generic/codex") &&
      installMatrix?.proof_urls?.client_config === "https://mcp.packrift.com/ai/mcp-client-config.json" &&
      installMatrix?.proof_urls?.install_actions === "https://mcp.packrift.com/ai/mcp-install-actions.json" &&
      installActions?.release === "PACKRIFT-MCP-INSTALL-ACTIONS-R06" &&
      installActions?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      installActions?.targets?.some((target) => target.id === "codex" && target.tracked_install_url?.startsWith("https://mcp.packrift.com/r/install/generic/codex")) &&
      installActions?.targets?.some((target) => target.id === "codex" && target.tracked_install_html_url?.includes("format=html")) &&
      installActions?.targets?.some((target) => target.id === "codex" && target.tracked_run_html_url?.startsWith("https://mcp.packrift.com/r/run/generic/codex")) &&
      installActions?.targets?.some((target) => target.id === "codex" && target.source_aware_endpoint?.includes("packrift_mcp_source=generic")) &&
      installActions?.targets?.every((target) => target.required_post_install_final_tool === "create_cart_url") &&
      installActions?.first_useful_run?.sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      installActions?.first_useful_run?.curl_script?.includes("create_cart_url") &&
      installActions?.first_useful_run?.agent_prompt?.includes("Required tool sequence") &&
      installActions?.first_useful_run?.agent_prompt?.includes("create_cart_url") &&
      installActions?.required_post_install_verification?.required_final_tool === "create_cart_url" &&
      trackedInstallCodexHtmlResult.ok &&
      trackedInstallCodexHtmlResult.text.includes("Packrift MCP Install") &&
      trackedInstallCodexHtmlResult.text.includes("Copy install") &&
      trackedInstallCodexHtmlResult.text.includes("Copy agent prompt") &&
      trackedInstallCodexHtmlResult.text.includes("mcp_install_copy") &&
      trackedInstallCodexHtmlResult.text.includes("Open first run") &&
      trackedInstallCodexHtmlResult.text.includes("Run real MCP check") &&
      firstRunActions?.release === "PACKRIFT-MCP-FIRST-RUN-ACTIONS-R03" &&
      firstRunActions?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      firstRunActions?.targets?.length >= 7 &&
      firstRunActions?.targets?.every((target) => target.tracked_run_url?.startsWith("https://mcp.packrift.com/r/run/generic/")) &&
      firstRunActions?.targets?.every((target) => target.tracked_run_html_url?.startsWith("https://mcp.packrift.com/r/run/generic/") && target.tracked_run_html_url?.includes("format=html")) &&
      firstRunActions?.targets?.every((target) => target.tracked_run_execute_url?.includes("execute=1")) &&
      firstRunActions?.targets?.every((target) => target.required_final_tool === "create_cart_url") &&
      firstRunActions?.first_run?.release === "PACKRIFT-MCP-FIRST-RUN-ACTION-R03" &&
      firstRunActions?.first_run?.tracked_run_url?.startsWith("https://mcp.packrift.com/r/run/generic/generic_streamable_http") &&
      firstRunActions?.first_run?.tracked_run_html_url?.startsWith("https://mcp.packrift.com/r/run/generic/generic_streamable_http") &&
      firstRunActions?.first_run?.tracked_run_html_url?.includes("format=html") &&
      firstRunActions?.first_run?.tracked_run_execute_url?.includes("execute=1") &&
      firstRunActions?.first_run?.first_useful_run?.curl_script?.includes("create_cart_url") &&
      firstRunActions?.first_run?.first_useful_run?.agent_prompt?.includes("Packrift MCP") &&
      firstRunActions?.first_run?.first_useful_run?.agent_prompt?.includes("create_cart_url") &&
      firstRunActions?.first_run?.shell_one_liner?.includes("format=sh") &&
      clientConfig?.release === "PACKRIFT-MCP-CLIENT-CONFIG-R06" &&
      clientConfig?.canonical_endpoint === MCP_ENDPOINT &&
      clientConfig?.config?.mcpServers?.packrift?.url === MCP_ENDPOINT &&
      clientConfig?.first_useful_run?.sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      clientConfig?.first_useful_run?.curl_script?.includes("create_cart_url") &&
      clientConfig?.required_post_install_verification?.required_final_tool === "create_cart_url" &&
      clientConfig?.required_post_install_verification?.sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      clientConfig?.aliases?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      clientConfig?.aliases?.tracked_config_generic?.startsWith("https://mcp.packrift.com/r/config/generic") &&
      clientConfig?.aliases?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      clientConfig?.aliases?.tracked_install_examples?.codex?.startsWith("https://mcp.packrift.com/r/install/generic/codex") &&
      clientConfig?.aliases?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      clientConfig?.aliases?.tracked_run_examples?.codex?.startsWith("https://mcp.packrift.com/r/run/generic/codex") &&
      clientConfig?.authentication?.required === false &&
      clientConfig?.first_tests?.some((test) => test.id === "tools-list") &&
      rootMcpJson?.mcpServers?.packrift?.url === MCP_ENDPOINT &&
      wellKnownMcpJson?.mcpServers?.packrift?.url === MCP_ENDPOINT &&
      trackedConfigGeneric?.mcpServers?.packrift?.url?.startsWith(`${MCP_ENDPOINT}?`) &&
      trackedConfigGeneric?.mcpServers?.packrift?.url?.includes("packrift_mcp_source=generic") &&
      trackedConfigGeneric?.mcpServers?.packrift?.url?.includes("packrift_mcp_target=tracked_config") &&
      usageSnapshot?.release === "PACKRIFT-MCP-USAGE-SNAPSHOT-R18" &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_start") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_client_config") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_cart_activation") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_funnel_snapshot") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_first_run_actions") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_reviewer_activation") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_first_run_proof") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_workflow_gallery") &&
      typeof usageSnapshot?.counts?.mcp_cart_landings === "number" &&
      typeof usageSnapshot?.counts?.mcp_tracked_config_fetches === "number" &&
      typeof usageSnapshot?.counts?.mcp_install_intent_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_first_run_intent_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_first_run_execution_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_install_copy_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_activation_cart_ready_events === "number" &&
      typeof usageSnapshot?.counts?.reviewer_activation_resource_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_source_attributed_runtime_events === "number" &&
      typeof usageSnapshot?.counts?.external_qualified_mcp_tool_calls === "number" &&
      typeof usageSnapshot?.counts?.external_qualified_create_cart_url_calls === "number" &&
      typeof usageSnapshot?.counts?.post_install_sources_waiting_on_create_cart_url === "number" &&
      typeof usageSnapshot?.counts?.post_install_sources_waiting_on_cart_landing === "number" &&
      typeof usageSnapshot?.proof_gate?.tracked_config_fetch_seen === "boolean" &&
      typeof usageSnapshot?.proof_gate?.install_intent_seen === "boolean" &&
      typeof usageSnapshot?.proof_gate?.first_run_intent_seen === "boolean" &&
      typeof usageSnapshot?.proof_gate?.first_run_execution_seen === "boolean" &&
      typeof usageSnapshot?.proof_gate?.activation_cart_ready_seen === "boolean" &&
      typeof usageSnapshot?.proof_gate?.mcp_runtime_source_continuity_seen === "boolean" &&
      usageSnapshot?.source_attribution?.tracked_start_template === "https://mcp.packrift.com/r/start/{source}" &&
      usageSnapshot?.source_attribution?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      usageSnapshot?.source_attribution?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      usageSnapshot?.source_attribution?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      usageSnapshot?.source_attribution?.tracked_reviewer_activation_template === "https://mcp.packrift.com/r/activate/{source}" &&
      usageSnapshot?.source_attribution?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      Array.isArray(usageSnapshot?.top?.event_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.mcp_start_click_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.tracked_config_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.install_intent_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.install_intent_targets) &&
      Array.isArray(usageSnapshot?.source_attribution?.first_run_intent_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.first_run_intent_targets) &&
      Array.isArray(usageSnapshot?.source_attribution?.install_copy_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.install_copy_targets) &&
      Array.isArray(usageSnapshot?.source_attribution?.recent_activation_cart_ready) &&
      Array.isArray(usageSnapshot?.source_attribution?.tool_mcp_keys) &&
      Array.isArray(usageSnapshot?.source_attribution?.mcp_runtime_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.tool_runtime_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.post_install_cart_activation_by_source) &&
      usageSnapshot?.source_attribution?.post_install_cart_activation_by_source?.every((row) => typeof row.qualified_cart_landings === "number") &&
      funnelSnapshot?.release === "PACKRIFT-MCP-FUNNEL-SNAPSHOT-R10" &&
      funnelSnapshot?.canonical_endpoint === MCP_ENDPOINT &&
      typeof funnelSnapshot?.counts?.mcp_start_clicks === "number" &&
      typeof funnelSnapshot?.counts?.mcp_install_intent_events === "number" &&
      typeof funnelSnapshot?.counts?.mcp_first_run_intent_events === "number" &&
      typeof funnelSnapshot?.counts?.mcp_first_run_execution_events === "number" &&
      typeof funnelSnapshot?.counts?.mcp_activation_cart_ready_events === "number" &&
      typeof funnelSnapshot?.counts?.mcp_tool_calls === "number" &&
      typeof funnelSnapshot?.counts?.external_qualified_mcp_tool_calls === "number" &&
      typeof funnelSnapshot?.counts?.external_qualified_create_cart_url_calls === "number" &&
      typeof funnelSnapshot?.counts?.post_install_sources_waiting_on_create_cart_url === "number" &&
      typeof funnelSnapshot?.counts?.post_install_sources_waiting_on_cart_landing === "number" &&
      typeof funnelSnapshot?.counts?.mcp_source_attributed_runtime_events === "number" &&
      typeof funnelSnapshot?.counts?.qualified_first_party_mcp_cart_landings === "number" &&
      typeof funnelSnapshot?.counts?.first_party_mcp_orders === "number" &&
      typeof funnelSnapshot?.counts?.first_party_mcp_order_revenue === "number" &&
      typeof funnelSnapshot?.proof_gate?.thousands_of_qualified_visitors === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.first_run_intent_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.first_run_execution_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.activation_cart_ready_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.mcp_runtime_source_continuity_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.qualified_first_party_cart_landing_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.measurable_mcp_revenue_seen === "boolean" &&
      funnelSnapshot?.source_attribution?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      funnelSnapshot?.source_attribution?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      funnelSnapshot?.source_attribution?.tracked_reviewer_activation_template === "https://mcp.packrift.com/r/activate/{source}" &&
      funnelSnapshot?.source_attribution?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      Array.isArray(funnelSnapshot?.source_attribution?.mcp_runtime_sources) &&
      Array.isArray(funnelSnapshot?.source_attribution?.first_run_intent_sources) &&
      Array.isArray(funnelSnapshot?.source_attribution?.first_run_intent_targets) &&
      Array.isArray(funnelSnapshot?.source_attribution?.recent_activation_cart_ready) &&
      Array.isArray(funnelSnapshot?.source_attribution?.tool_runtime_sources) &&
      Array.isArray(funnelSnapshot?.source_attribution?.post_install_cart_activation_by_source) &&
      funnelSnapshot?.source_attribution?.post_install_cart_activation_by_source?.every((row) => typeof row.qualified_cart_landings === "number") &&
      funnelSnapshot?.links?.cart_activation === "https://mcp.packrift.com/ai/mcp-cart-activation.json" &&
      funnelSnapshot?.links?.first_run_actions === "https://mcp.packrift.com/ai/mcp-first-run-actions.json" &&
      funnelSnapshot?.links?.tracked_run_generic === "https://mcp.packrift.com/r/run/generic/generic_streamable_http" &&
      buyerUseCases?.release === "PACKRIFT-MCP-BUYER-USE-CASES-R01" &&
      buyerUseCases?.use_cases?.length >= 6 &&
      cartActivation?.release === "PACKRIFT-MCP-CART-ACTIVATION-R02" &&
      cartActivation?.activation_paths?.length >= 4 &&
      cartActivation?.primary_rule?.includes("https://mcp.packrift.com/r/cart/") &&
      cartActivation?.proof_urls?.funnel_snapshot === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json" &&
      firstRunProof?.release === "PACKRIFT-MCP-FIRST-RUN-PROOF-R01" &&
      firstRunProof?.canonical_endpoint === MCP_ENDPOINT &&
      firstRunProof?.live_demo?.sku === "1066" &&
      firstRunProof?.live_demo?.pricing?.unit_price != null &&
      firstRunProof?.live_demo?.pricing?.currency &&
      firstRunProof?.live_demo?.inventory?.in_stock === true &&
      firstRunProof?.live_demo?.cart?.url?.startsWith("https://mcp.packrift.com/r/cart/") &&
      hasAll(firstRunProof?.live_demo?.cart?.url ?? "", ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url"]) &&
      workflowGallery?.release === "PACKRIFT-MCP-WORKFLOW-GALLERY-R01" &&
      workflowGallery?.canonical_endpoint === MCP_ENDPOINT &&
      workflowGallery?.workflow_count >= 5 &&
      workflowGallery?.workflows?.some((workflow) => workflow.id === "one_call_purchase_handoff_1066") &&
      workflowGallery?.workflows?.some((workflow) => workflow.id === "exact_sku_reorder_1066") &&
      workflowGallery?.workflows?.some((workflow) => workflow.id === "no_exact_match_quote_recovery") &&
      browserAgentBridge?.release === "PACKRIFT-BROWSER-AGENT-BRIDGE-R01" &&
      browserAgentBridge?.workflows?.length >= 3 &&
      browserbaseBrowseSkillPack?.release === "PACKRIFT-BROWSERBASE-BROWSE-SKILL-PACK-R05" &&
      browserbaseBrowseSkillPack?.canonical_endpoint === MCP_ENDPOINT &&
      browserbaseBrowseSkillPack?.browse_skill_candidate?.skill_md_url === "https://mcp.packrift.com/SKILL.md" &&
      browserbaseBrowseSkillPack?.browse_catalog_submission?.check_command === "browse skills find packrift" &&
      browserbaseBrowseSkillPack?.browse_catalog_submission?.tracked_start_url === "https://mcp.packrift.com/r/start/browse_sh" &&
      browserbaseBrowseSkillPack?.browse_catalog_submission?.tracked_install_codex_url === "https://mcp.packrift.com/r/install/browse_sh/codex" &&
      browserbaseBrowseSkillPack?.skill_md?.canonical_url === "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md" &&
      browserbaseBrowseSkillPack?.demo_sequence?.length >= 6 &&
      browserbaseBrowseSkillPack?.demo_sequence?.some((step) => step?.request?.params?.name === "prepare_purchase_handoff") &&
      browserbaseBrowseSkillPack?.demo_sequence?.some((step) => step?.request?.params?.name === "create_cart_url") &&
      directoryRefresh?.release === "PACKRIFT-MCP-DIRECTORY-REFRESH-R14" &&
      directoryRefresh?.live_proof?.mcp_start === "https://mcp.packrift.com/ai/mcp-start.json" &&
      directoryRefresh?.live_proof?.tracked_start_template === "https://mcp.packrift.com/r/start/{source}" &&
      directoryRefresh?.live_proof?.tracked_start_partner_demo === "https://mcp.packrift.com/r/start/partner_demo" &&
      directoryRefresh?.live_proof?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      directoryRefresh?.live_proof?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      directoryRefresh?.live_proof?.tracked_install_codex_generic?.startsWith("https://mcp.packrift.com/r/install/generic/codex") &&
      directoryRefresh?.live_proof?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      directoryRefresh?.live_proof?.tracked_run_generic_browser?.includes("format=html") &&
      directoryRefresh?.live_proof?.tracked_run_generic_execute?.includes("execute=1") &&
      directoryRefresh?.live_proof?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      directoryRefresh?.live_proof?.tracked_reviewer_activation_html_generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      directoryRefresh?.live_proof?.first_run_actions === "https://mcp.packrift.com/ai/mcp-first-run-actions.json" &&
      directoryRefresh?.live_proof?.install_actions === "https://mcp.packrift.com/ai/mcp-install-actions.json" &&
      directoryRefresh?.live_proof?.funnel_snapshot === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json" &&
      directoryRefresh?.live_proof?.client_config === "https://mcp.packrift.com/ai/mcp-client-config.json" &&
      directoryRefresh?.canonical_listing?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      directoryRefresh?.canonical_listing?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      directoryRefresh?.canonical_listing?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      directoryRefresh?.canonical_listing?.tracked_install_examples?.codex?.startsWith("https://mcp.packrift.com/r/install/generic/codex") &&
      directoryRefresh?.canonical_listing?.tracked_first_run_examples?.live_proof?.includes("execute=1") &&
      directoryRefresh?.canonical_listing?.tracked_reviewer_activation_template === "https://mcp.packrift.com/r/activate/{source}" &&
      directoryRefresh?.canonical_listing?.tracked_reviewer_activation_examples?.generic === "https://mcp.packrift.com/r/activate/generic" &&
      directoryRefresh?.canonical_listing?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      directoryRefresh?.canonical_listing?.tracked_reviewer_activation_html_examples?.generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      directoryRefresh?.canonical_listing?.client_config_url === "https://mcp.packrift.com/ai/mcp-client-config.json" &&
      directoryRefresh?.canonical_listing?.tracked_start_source_policy?.partner_specific_sources_allowed === true &&
      directoryRefresh?.live_proof?.browserbase_browse_skill_pack === "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json" &&
      directoryRefresh?.priority_refresh_targets?.length >= 18 &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "smithery") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "anthropic_connectors_directory") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "browse_sh" && target.tracked_install_urls?.codex?.startsWith("https://mcp.packrift.com/r/install/browse_sh/codex")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_install_urls?.codex?.startsWith("https://mcp.packrift.com/r/install/")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_run_urls?.generic_streamable_http_browser?.includes("format=html")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_run_urls?.generic_streamable_http_execute?.includes("execute=1")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_reviewer_activation_url?.startsWith("https://mcp.packrift.com/r/activate/")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_reviewer_activation_html_url?.startsWith("https://mcp.packrift.com/r/activate/") && target.tracked_reviewer_activation_html_url?.includes("format=html")) &&
      directoryRefresh?.recrawl_request?.includes("/r/install/") &&
      directoryRefresh?.recrawl_request?.includes("execute=1") &&
      directoryRefresh?.recrawl_request?.includes("/r/activate/{source}?format=html") &&
      directorySubmitActions?.release === "PACKRIFT-MCP-DIRECTORY-SUBMIT-ACTIONS-R22" &&
      directorySubmitActions?.actions?.length >= 18 &&
      directorySubmitActions?.actions?.some((action) => action.id === "anthropic_connectors_directory") &&
      directorySubmitActions?.actions?.some((action) => action.id === "smithery") &&
      directorySubmitActions?.actions?.some((action) => action.id === "cline_mcp_marketplace") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcp_so") &&
      directorySubmitActions?.actions?.some((action) => action.id === "browse_sh" && action.action_status === "catalog_live_installable") &&
      directorySubmitActions?.actions?.some((action) => action.id === "smithery" && action.action_status === "api_key_required") &&
      directorySubmitActions?.actions?.some((action) => action.id === "cline_mcp_marketplace" && action.action_status === "submitted_pending") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcp_so" && action.action_status === "submitted_pending") &&
      directorySubmitActions?.tracked_start_template === "https://mcp.packrift.com/r/start/{source}" &&
      directorySubmitActions?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      directorySubmitActions?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      directorySubmitActions?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      directorySubmitActions?.tracked_reviewer_activation_template === "https://mcp.packrift.com/r/activate/{source}" &&
      directorySubmitActions?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      directorySubmitActions?.actions?.every((action) => action.tracked_start_url?.startsWith("https://mcp.packrift.com/r/start/")) &&
      directorySubmitActions?.actions?.every((action) => action.tracked_config_url?.startsWith("https://mcp.packrift.com/r/config/")) &&
      directorySubmitActions?.actions?.every((action) => action.tracked_install_urls?.codex?.startsWith("https://mcp.packrift.com/r/install/")) &&
      directorySubmitActions?.actions?.every((action) => action.tracked_run_urls?.generic_streamable_http?.startsWith("https://mcp.packrift.com/r/run/")) &&
      directorySubmitActions?.actions?.every((action) => action.tracked_run_urls?.generic_streamable_http_browser?.includes("format=html")) &&
      directorySubmitActions?.actions?.every((action) => action.tracked_run_urls?.generic_streamable_http_execute?.includes("execute=1")) &&
      directorySubmitActions?.actions?.every((action) => action.first_useful_run?.sequence?.some((step) => step?.params?.name === "create_cart_url")) &&
      directorySubmitActions?.actions?.every((action) => action.first_useful_run?.curl_script?.includes("create_cart_url")) &&
      directorySubmitActions?.actions?.every((action) => action.first_useful_run?.agent_prompt?.includes("create_cart_url")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_start?.startsWith("https://mcp.packrift.com/r/start/")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_config?.startsWith("https://mcp.packrift.com/r/config/")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_install_codex?.startsWith("https://mcp.packrift.com/r/install/")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_run_generic?.startsWith("https://mcp.packrift.com/r/run/")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_run_generic_browser?.includes("format=html")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_run_generic_execute?.includes("execute=1")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_reviewer_activation?.startsWith("https://mcp.packrift.com/r/activate/")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_reviewer_activation_html?.startsWith("https://mcp.packrift.com/r/activate/") && action.proof_urls?.tracked_reviewer_activation_html?.includes("format=html")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.funnel_snapshot === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json") &&
      directorySubmitActions?.source_install_matrix === "https://mcp.packrift.com/ai/mcp-install-matrix.json" &&
      directorySubmitActions?.source_client_config === "https://mcp.packrift.com/ai/mcp-client-config.json" &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-start.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-client-config.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("/r/start/")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("/r/config/")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("/r/install/")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("One-click live proof")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("execute=1")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("Reviewer-to-real-MCP activation handoff")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("Reviewer activation browser runner")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("format=md")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-cart-activation.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-first-run-proof.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-workflow-gallery.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("claude-connector-submission.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("agent-capture-outreach.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("browserbase-browse-skill-pack.json")) &&
      reviewerActivation?.release === "PACKRIFT-MCP-REVIEWER-ACTIVATION-R05" &&
      reviewerActivation?.target_source?.id === "generic" &&
      reviewerActivation?.target_source?.tracked_reviewer_activation_url?.startsWith("https://mcp.packrift.com/r/activate/generic") &&
      reviewerActivation?.target_source?.tracked_first_run_live_proof_url?.includes("execute=1") &&
      reviewerActivation?.real_mcp_client_run?.sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      reviewerActivation?.real_mcp_client_run?.agent_prompt?.includes("Required tool sequence") &&
      reviewerActivation?.real_mcp_client_run?.browser_executable === true &&
      reviewerActivation?.real_mcp_client_run?.browser_runner_url?.includes("format=html") &&
      reviewerActivation?.proof_urls?.usage_snapshot === "https://mcp.packrift.com/ai/mcp-usage-snapshot.json" &&
      trackedReviewerActivationGeneric?.release === "PACKRIFT-MCP-REVIEWER-ACTIVATION-R05" &&
      trackedReviewerActivationGeneric?.target_source?.id === "generic" &&
      trackedReviewerActivationGeneric?.source_aware_endpoint?.includes("packrift_mcp_source=generic") &&
      trackedReviewerActivationGeneric?.real_mcp_client_run?.required_final_tool === "create_cart_url" &&
      trackedReviewerActivationGeneric?.real_mcp_client_run?.agent_prompt?.includes("create_cart_url") &&
      trackedReviewerActivationHtmlResult.ok &&
      trackedReviewerActivationHtmlResult.text.includes("Run real MCP check") &&
      trackedReviewerActivationHtmlResult.text.includes("Copy agent prompt") &&
      trackedReviewerActivationHtmlResult.text.includes("activation.real_mcp_client_run.endpoint") &&
      trackedReviewerActivationHtmlResult.text.includes("mcp_activation_cart_ready") &&
      trackedReviewerActivationHtmlResult.text.includes("This records cart-ready only") &&
      trackedReviewerActivationHtmlResult.text.includes("create_cart_url") &&
      claudeConnectorSubmission?.release === "PACKRIFT-CLAUDE-CONNECTOR-SUBMISSION-R01" &&
      claudeConnectorSubmission?.status === "manual_submission_ready" &&
      claudeConnectorSubmission?.server?.remote_endpoint === "https://mcp.packrift.com/mcp" &&
      claudeConnectorSubmission?.server?.authentication === "none_required_for_hosted_endpoint" &&
      claudeConnectorSubmission?.claude_install?.tracked_config_url?.startsWith("https://mcp.packrift.com/r/config/anthropic_connectors_directory") &&
      claudeConnectorSubmission?.checklist?.some((row) => row.item === "Legal and support links") &&
      agentCaptureOutreach?.release === "PACKRIFT-AGENT-CAPTURE-OUTREACH-R10" &&
      agentCaptureOutreach?.canonical_endpoint === MCP_ENDPOINT &&
      agentCaptureOutreach?.priority_queue?.some((action) => action.id === "anthropic_connectors_directory") &&
      agentCaptureOutreach?.priority_queue?.some((action) => action.id === "browse_sh") &&
      agentCaptureOutreach?.agent_install_snippets?.claude_code?.includes(MCP_ENDPOINT) &&
      agentCaptureOutreach?.agent_install_snippets?.generic_tracked_reviewer_activation_runner === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.submission_url === "https://github.com/chatmcp/mcpso/issues/2189" &&
      agentCaptureOutreach?.browser_assisted_submissions?.browse_sh?.catalog_check_command === "browse skills find packrift" &&
      agentCaptureOutreach?.browserbase_browse_candidate?.status === "catalog_live_installable" &&
      agentCaptureOutreach?.browserbase_browse_candidate?.catalog_slug === "packrift.com/exact-spec-packaging-procurement-e4ujmy" &&
      agentCaptureOutreach?.browserbase_browse_candidate?.install_check?.status === "pass" &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_start_template === "https://mcp.packrift.com/r/start/{source}" &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_reviewer_activation_template === "https://mcp.packrift.com/r/activate/{source}" &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("Current stale/missing markers")) &&
      resourceUris.has("https://mcp.packrift.com/start") &&
      resourceUris.has("https://mcp.packrift.com/ai/all-agent-capture.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/all-agent-capture.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-start.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-start.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-start.html") &&
      resourceUris.has("https://mcp.packrift.com/r/config/generic") &&
      resourceUris.has("https://mcp.packrift.com/r/install/generic/codex") &&
      resourceUris.has("https://mcp.packrift.com/r/run/generic/generic_streamable_http") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-adoption-kit.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-adoption-kit.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-install-matrix.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-install-matrix.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-install-actions.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-install-actions.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-actions.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-actions.md") &&
      resourceUris.has("https://mcp.packrift.com/mcp.json") &&
      resourceUris.has("https://mcp.packrift.com/.well-known/mcp.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-client-config.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-client-config.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-usage-snapshot.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-usage-snapshot.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-buyer-use-cases.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-buyer-use-cases.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-cart-activation.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-cart-activation.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-proof.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-proof.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-workflow-gallery.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-workflow-gallery.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/browser-agent-bridge.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/browser-agent-bridge.md") &&
      resourceUris.has("https://mcp.packrift.com/SKILL.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/browserbase-browse-skill-pack.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/browserbase-browse/SKILL.md") &&
      resourceUris.has("https://mcp.packrift.com/r/install/generic/codex") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-install-actions.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-install-actions.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-refresh.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-refresh.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-submit-actions.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-submit-actions.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-reviewer-activation.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-reviewer-activation.md") &&
      resourceUris.has("https://mcp.packrift.com/r/activate/generic") &&
      resourceUris.has("https://mcp.packrift.com/r/activate/generic?format=html") &&
      resourceUris.has("https://mcp.packrift.com/ai/claude-connector-submission.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/claude-connector-submission.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/agent-capture-outreach.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/agent-capture-outreach.md") &&
      firstCartUrl.startsWith("https://mcp.packrift.com/r/cart/") &&
      hasAll(firstCartUrl, ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url", "qty=1"]) &&
      firstFinalCartUrl.startsWith("https://packrift.com/cart/") &&
      hasAll(firstFinalCartUrl, ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url"])
      ? "pass"
      : "fail",
    {
      health,
      server_card_schema: {
        status: serverCardResult.status,
        server_info: serverCard?.serverInfo ?? null,
        authentication: serverCard?.authentication ?? null,
        tools_count: serverCard?.tools?.length ?? 0,
        resources_count: serverCard?.resources?.length ?? 0,
        prompts_count: serverCard?.prompts?.length ?? 0,
        tool_names_count: serverCard?.tool_names?.length ?? 0,
        client_config: serverCard?.client_config ?? null,
      },
      client_config: {
        status: clientConfigResult.status,
        release: clientConfig?.release ?? null,
        endpoint: clientConfig?.canonical_endpoint ?? null,
        root_mcp_json_status: rootMcpJsonResult.status,
        well_known_mcp_json_status: wellKnownMcpJsonResult.status,
        tracked_config_generic_status: trackedConfigGenericResult.status,
        tracked_install_codex_status: trackedInstallCodexResult.status,
      },
      start_release: start?.release ?? null,
      start_tracked_template: start?.start_urls?.tracked_start_template ?? null,
      start_source_aware_html_template: start?.start_urls?.source_aware_html_template ?? null,
      start_source_policy: start?.start_urls?.source_policy ?? null,
      tracked_start_partner_demo: {
        status: trackedStartPartnerResult.status,
        location: trackedStartPartnerResult.location,
        target_utm_source: trackedStartTarget?.searchParams?.get("utm_source") ?? null,
        target_mcp_key: trackedStartTarget?.searchParams?.get("mcp_key") ?? null,
      },
      tracked_start_html_partner_demo: {
        status: trackedStartHtmlPartnerResult.status,
        has_source_config: trackedStartHtmlPartnerResult.text.includes("https://mcp.packrift.com/r/config/partner_demo"),
        has_source_install_action: trackedStartHtmlPartnerResult.text.includes("https://mcp.packrift.com/r/install/partner_demo/codex"),
        has_copy_action: trackedStartHtmlPartnerResult.text.includes("Copy config URL"),
        has_install_copy_telemetry: trackedStartHtmlPartnerResult.text.includes("mcp_install_copy"),
      },
      invalid_start_source: {
        status: invalidStartSourceResult.status,
        valid_format: invalidStartSource?.valid_format ?? null,
        partner_specific_sources_allowed: invalidStartSource?.partner_specific_sources_allowed ?? null,
      },
      invalid_config_source: {
        status: invalidConfigSourceResult.status,
        valid_format: invalidConfigSource?.valid_format ?? null,
        partner_specific_sources_allowed: invalidConfigSource?.partner_specific_sources_allowed ?? null,
      },
      invalid_install_source: {
        status: invalidInstallSourceResult.status,
        error: invalidInstallSource?.error ?? null,
      },
      invalid_install_target: {
        status: invalidInstallTargetResult.status,
        error: invalidInstallTarget?.error ?? null,
        valid_targets: invalidInstallTarget?.valid_targets ?? [],
      },
      start_flow_steps: start?.first_flow?.length ?? 0,
      cart_release: cart?.release ?? null,
      cart_items: cart?.items?.length ?? 0,
      agent_capture_release: agentCapture?.release ?? null,
      agent_capture_surfaces: agentCapture?.surfaces?.length ?? 0,
      adoption_kit_release: adoptionKit?.release ?? null,
      adoption_kit_steps: adoptionKit?.first_five_minutes?.length ?? 0,
      adoption_kit_developer_examples: adoptionKit?.developer_examples?.length ?? 0,
      install_matrix_release: installMatrix?.release ?? null,
      install_matrix_hosts: installMatrix?.hosts?.length ?? 0,
      install_matrix_smoke_tests: installMatrix?.smoke_tests?.length ?? 0,
      install_actions_release: installActions?.release ?? null,
      install_actions_targets: installActions?.targets?.length ?? 0,
      tracked_install_codex_html_status: trackedInstallCodexHtmlResult.status,
      tracked_install_codex_html_has_copy: trackedInstallCodexHtmlResult.text.includes("Copy install"),
      first_run_actions_release: firstRunActions?.release ?? null,
      first_run_actions_targets: firstRunActions?.targets?.length ?? 0,
      tracked_first_run_generic_status: trackedFirstRunGenericResult.status,
      tracked_first_run_html_status: trackedFirstRunHtmlResult.status,
      tracked_first_run_html_has_button: trackedFirstRunHtmlResult.text.includes("Run live proof"),
      tracked_first_run_execute_status: trackedFirstRunExecuteResult.status,
      tracked_first_run_execute_ok: trackedFirstRunExecute?.status ?? null,
      tracked_first_run_execute_sku: trackedFirstRunExecute?.sku ?? null,
      tracked_first_run_execute_cart_url: trackedFirstRunExecute?.cart?.url ?? null,
      usage_snapshot_release: usageSnapshot?.release ?? null,
      usage_snapshot_status: usageSnapshot?.status ?? null,
      usage_snapshot_tracked_start_template: usageSnapshot?.source_attribution?.tracked_start_template ?? null,
      usage_snapshot_tracked_install_template: usageSnapshot?.source_attribution?.tracked_install_template ?? null,
      usage_snapshot_tracked_run_template: usageSnapshot?.source_attribution?.tracked_run_template ?? null,
      usage_snapshot_tracked_reviewer_activation_template: usageSnapshot?.source_attribution?.tracked_reviewer_activation_template ?? null,
      usage_snapshot_cart_landings: usageSnapshot?.counts?.mcp_cart_landings ?? null,
      usage_snapshot_tracked_config_fetches: usageSnapshot?.counts?.mcp_tracked_config_fetches ?? null,
      usage_snapshot_install_intent_events: usageSnapshot?.counts?.mcp_install_intent_events ?? null,
      usage_snapshot_first_run_intent_events: usageSnapshot?.counts?.mcp_first_run_intent_events ?? null,
      usage_snapshot_first_run_execution_events: usageSnapshot?.counts?.mcp_first_run_execution_events ?? null,
      usage_snapshot_install_copy_events: usageSnapshot?.counts?.mcp_install_copy_events ?? null,
      usage_snapshot_start_sources: usageSnapshot?.source_attribution?.mcp_start_click_sources ?? [],
      usage_snapshot_tracked_config_sources: usageSnapshot?.source_attribution?.tracked_config_sources ?? [],
      usage_snapshot_install_intent_sources: usageSnapshot?.source_attribution?.install_intent_sources ?? [],
      usage_snapshot_install_intent_targets: usageSnapshot?.source_attribution?.install_intent_targets ?? [],
      usage_snapshot_first_run_intent_sources: usageSnapshot?.source_attribution?.first_run_intent_sources ?? [],
      usage_snapshot_first_run_intent_targets: usageSnapshot?.source_attribution?.first_run_intent_targets ?? [],
      usage_snapshot_install_copy_sources: usageSnapshot?.source_attribution?.install_copy_sources ?? [],
      usage_snapshot_install_copy_targets: usageSnapshot?.source_attribution?.install_copy_targets ?? [],
      usage_snapshot_direct_agent_resource_sources: usageSnapshot?.counts?.direct_agent_resource_sources ?? [],
      funnel_snapshot_release: funnelSnapshot?.release ?? null,
      funnel_snapshot_status: funnelSnapshot?.status ?? null,
      funnel_snapshot_cart_landings: funnelSnapshot?.counts?.qualified_first_party_mcp_cart_landings ?? null,
      funnel_snapshot_orders: funnelSnapshot?.counts?.first_party_mcp_orders ?? null,
      funnel_snapshot_revenue: funnelSnapshot?.counts?.first_party_mcp_order_revenue ?? null,
      buyer_use_cases_release: buyerUseCases?.release ?? null,
      buyer_use_cases_count: buyerUseCases?.use_cases?.length ?? 0,
      cart_activation_release: cartActivation?.release ?? null,
      cart_activation_paths: cartActivation?.activation_paths?.length ?? 0,
      first_run_proof_release: firstRunProof?.release ?? null,
      first_run_proof_mode: firstRunProof?.live_demo?.mode ?? null,
      first_run_proof_price: firstRunProof?.live_demo?.pricing?.unit_price ?? null,
      first_run_proof_currency: firstRunProof?.live_demo?.pricing?.currency ?? null,
      first_run_proof_in_stock: firstRunProof?.live_demo?.inventory?.in_stock ?? null,
      first_run_proof_cart_url: firstRunProof?.live_demo?.cart?.url ?? null,
      workflow_gallery_release: workflowGallery?.release ?? null,
      workflow_gallery_count: workflowGallery?.workflow_count ?? null,
      workflow_gallery_ids: (workflowGallery?.workflows ?? []).map((workflow) => workflow.id),
      browser_agent_bridge_release: browserAgentBridge?.release ?? null,
      browser_agent_bridge_workflows: browserAgentBridge?.workflows?.length ?? 0,
      browserbase_browse_skill_pack_release: browserbaseBrowseSkillPack?.release ?? null,
      browserbase_browse_skill_pack_steps: browserbaseBrowseSkillPack?.demo_sequence?.length ?? 0,
      directory_refresh_release: directoryRefresh?.release ?? null,
      directory_refresh_tracked_start_template: directoryRefresh?.live_proof?.tracked_start_template ?? null,
      directory_refresh_tracked_install_template: directoryRefresh?.live_proof?.tracked_install_template ?? null,
      directory_refresh_targets: directoryRefresh?.priority_refresh_targets?.length ?? 0,
      directory_refresh_tracked_install_urls: directoryRefresh?.priority_refresh_targets?.filter((target) =>
        target.tracked_install_urls?.codex?.startsWith("https://mcp.packrift.com/r/install/")
      ).length ?? 0,
      directory_submit_actions_release: directorySubmitActions?.release ?? null,
      directory_submit_actions_count: directorySubmitActions?.actions?.length ?? 0,
      directory_submit_actions_tracked_start_urls: directorySubmitActions?.actions?.filter((action) =>
        action.tracked_start_url?.startsWith("https://mcp.packrift.com/r/start/")
      ).length ?? 0,
      directory_submit_actions_tracked_config_urls: directorySubmitActions?.actions?.filter((action) =>
        action.tracked_config_url?.startsWith("https://mcp.packrift.com/r/config/")
      ).length ?? 0,
      directory_submit_actions_tracked_install_urls: directorySubmitActions?.actions?.filter((action) =>
        action.tracked_install_urls?.codex?.startsWith("https://mcp.packrift.com/r/install/")
      ).length ?? 0,
      directory_submit_actions_tracked_start_messages: directorySubmitActions?.actions?.filter((action) =>
        action.recrawl_message?.includes("/r/start/")
      ).length ?? 0,
      directory_submit_actions_tracked_install_messages: directorySubmitActions?.actions?.filter((action) =>
        action.recrawl_message?.includes("/r/install/")
      ).length ?? 0,
      directory_submit_actions_start_messages: directorySubmitActions?.actions?.filter((action) =>
        action.recrawl_message?.includes("mcp-start.json")
      ).length ?? 0,
      directory_submit_actions_cart_activation_messages: directorySubmitActions?.actions?.filter((action) =>
        action.recrawl_message?.includes("mcp-cart-activation.json")
      ).length ?? 0,
      directory_submit_actions_first_run_proof_messages: directorySubmitActions?.actions?.filter((action) =>
        action.recrawl_message?.includes("mcp-first-run-proof.json")
      ).length ?? 0,
      directory_submit_actions_workflow_gallery_messages: directorySubmitActions?.actions?.filter((action) =>
        action.recrawl_message?.includes("mcp-workflow-gallery.json")
      ).length ?? 0,
      directory_submit_actions_browserbase_browse_messages: directorySubmitActions?.actions?.filter((action) =>
        action.recrawl_message?.includes("browserbase-browse-skill-pack.json")
      ).length ?? 0,
      reviewer_activation_release: reviewerActivation?.release ?? null,
      reviewer_activation_target: reviewerActivation?.target_source?.id ?? null,
      reviewer_activation_priority_sources: reviewerActivation?.priority_sources_waiting_on_real_mcp_run?.length ?? null,
      tracked_reviewer_activation_status: trackedReviewerActivationGenericResult.status,
      tracked_reviewer_activation_target: trackedReviewerActivationGeneric?.target_source?.id ?? null,
      tracked_reviewer_activation_html_status: trackedReviewerActivationHtmlResult.status,
      tracked_reviewer_activation_html_has_runner: trackedReviewerActivationHtmlResult.text.includes("Run real MCP check"),
      agent_capture_outreach_release: agentCaptureOutreach?.release ?? null,
      agent_capture_outreach_priority_queue: agentCaptureOutreach?.priority_queue?.length ?? 0,
      agent_capture_outreach_directory_refreshes: agentCaptureOutreach?.directory_refreshes?.length ?? 0,
      first_cart_url_candidate_type: cart?.items?.[0]?.cart_url_candidate_type ?? null,
      first_final_shopify_cart_url_present: Boolean(firstFinalCartUrl),
      mcp_introspection: {
        endpoint: MCP_ENDPOINT,
        tools_count: toolNames.length,
        tool_names: toolNames,
        resources_count: resourcesCount,
        prompts_count: promptsCount,
        tools_status: toolsResult.status,
        resources_status: resourcesResult.status,
        prompts_status: promptsResult.status,
      },
      first_cart_url_has_mcp_attribution: hasAll(firstCartUrl, [
        "utm_source=chatgpt-mcp",
        "utm_medium=mcp_tool",
        "utm_campaign=create_cart_url",
      ]),
      first_cart_url_is_mcp_landing: firstCartUrl.startsWith("https://mcp.packrift.com/r/cart/"),
    }
  );
}

async function mcpserversCheck() {
  const result = await fetchText("https://mcpservers.org/servers/packrift/packrift-mcp");
  const text = result.text;
  const required = [
    "get_cart_handoff_candidates",
    "prepare_purchase_handoff",
    "mcp-cart-handoff-candidates",
    "compare_alternatives",
    "pack_calculator",
    "inventory_status",
  ];
  return check(result.ok ? "mcpservers_org" : "mcpservers_org", result.ok && hasAll(text, required) ? "pass" : "stale", {
    http_status: result.status,
    url: result.url,
    missing: required.filter((needle) => !text.includes(needle)),
  });
}

async function mcpbenchCheck() {
  const result = await fetchText("https://mcpbench.ai/servers/io.github.Packrift/packrift-mcp");
  const text = result.text;
  return check("mcpbench", result.ok && text.includes(`Version:${EXPECTED_VERSION}`) ? "pass" : "stale", {
    http_status: result.status,
    url: result.url,
    observed_version_markers: Array.from(text.matchAll(/Version:([0-9.]+)/g)).map((match) => match[1]),
  });
}

async function glamaConnectorCheck() {
  const result = await fetchText("https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp");
  const text = result.text;
  const toolNames = [...new Set([...text.matchAll(/[?&]tool=([a-z_]+)/g)].map((match) => match[1]))].sort();
  const required = ["create_cart_url", "prepare_purchase_handoff", "get_cart_handoff_candidates", "find_packaging_for_item", "inventory_status"];
  return check("glama_connector", result.ok && text.includes("Healthy") && toolNames.length >= 15 && hasAll(text, required) ? "pass" : "stale", {
    http_status: result.status,
    url: result.url,
    status_label: text.includes("Healthy") ? "Healthy" : null,
    tools_count: toolNames.length,
    tool_names: toolNames,
    missing: required.filter((needle) => !text.includes(needle)),
  });
}

async function glamaServerListingCheck() {
  const result = await fetchText("https://glama.ai/api/mcp/v1/servers/Packrift/packrift-mcp");
  if (!result.ok) return check("glama_server_listing", "fail", { http_status: result.status, url: result.url });
  const parsed = JSON.parse(result.text);
  return check("glama_server_listing", Array.isArray(parsed.tools) && parsed.tools.length >= 15 ? "pass" : "stale", {
    http_status: result.status,
    url: parsed.url,
    id: parsed.id,
    attributes: parsed.attributes,
    tools_count: parsed.tools?.length ?? 0,
    tool_names: (parsed.tools ?? []).map((tool) => tool.name).filter(Boolean),
    environment_required: parsed.environmentVariablesJsonSchema?.required ?? [],
    environment_properties: Object.keys(parsed.environmentVariablesJsonSchema?.properties ?? {}),
    description: parsed.description,
  });
}

async function mcpMarketplaceCheck() {
  const result = await fetchText("https://mcp-marketplace.io/api/registry/search?q=packrift&limit=5");
  if (!result.ok) return check("mcp_marketplace_io", "fail", { http_status: result.status, url: result.url });
  const parsed = JSON.parse(result.text);
  const listing = parsed.results?.find((row) => row.slug === "io-github-packrift-packrift-mcp") ?? null;
  return check("mcp_marketplace_io", listing?.toolCount >= 15 && listing?.mode === "remote" ? "pass" : "stale", {
    http_status: result.status,
    url: listing?.url ?? result.url,
    listing,
    missing: listing ? [] : ["Packrift"],
  });
}

async function simplePresenceCheck(name, url, needles) {
  const result = await fetchText(url);
  const text = result.text;
  return check(name, result.ok && hasAll(text, needles) ? "pass" : result.ok ? "stale" : "blocked", {
    http_status: result.status,
    url: result.url,
    missing: needles.filter((needle) => !text.includes(needle)),
    error: result.error ?? null,
  });
}

async function browseSkillsFindCheck() {
  try {
    const { stdout, stderr } = await execFileAsync("npx", ["--yes", "browse", "skills", "find", "packrift", "--json"], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(stdout);
    const skill = parsed.skills?.find((row) => row.slug === "packrift.com/exact-spec-packaging-procurement-e4ujmy") ?? null;
    const installed = skill?.verified === true && skill?.recommendedMethod === "mcp" && Number(skill?.installCount ?? 0) >= 1;
    return check("browse_sh", installed ? "pass" : skill ? "pending" : "stale", {
      http_status: null,
      url: skill?.sourceUrl ?? "https://browse.sh/",
      catalog_slug: skill?.slug ?? null,
      recommended_method: skill?.recommendedMethod ?? null,
      verified: skill?.verified ?? null,
      install_count: skill?.installCount ?? null,
      missing: installed ? [] : skill ? ["verified MCP install count"] : ["Packrift Browse skill"],
      error: stderr?.trim() || null,
      install_check_note:
        "browse skills add packrift.com/exact-spec-packaging-procurement-e4ujmy succeeded locally on 2026-05-19 and installed .agents/skills/exact-spec-packaging-procurement.",
    });
  } catch (error) {
    return check("browse_sh", "blocked", {
      http_status: null,
      url: "https://browse.sh/",
      missing: ["Packrift Browse skill check"],
      error: error.message,
    });
  }
}

async function clineMcpMarketplaceCheck() {
  const result = await fetchText("https://api.github.com/search/issues?q=repo:cline/mcp-marketplace%20Packrift");
  if (!result.ok) return check("cline_mcp_marketplace", "blocked", { http_status: result.status, url: result.url, error: result.error ?? null });
  const parsed = JSON.parse(result.text);
  const issue = parsed.items?.find((item) => /Packrift MCP/i.test(item.title ?? "")) ?? null;
  return check("cline_mcp_marketplace", issue?.state === "open" ? "pending" : issue ? "stale" : "stale", {
    http_status: result.status,
    url: issue?.html_url ?? result.url,
    issue_number: issue?.number ?? null,
    issue_state: issue?.state ?? null,
    title: issue?.title ?? null,
    total_count: parsed.total_count ?? 0,
    missing: issue ? [] : ["Packrift MCP submission issue"],
  });
}

async function dockerMcpCatalogCheck() {
  const result = await fetchText("https://api.github.com/repos/docker/mcp-registry/pulls/3388");
  if (!result.ok) return check("docker_mcp_catalog", "blocked", { http_status: result.status, url: result.url, error: result.error ?? null });
  const parsed = JSON.parse(result.text);
  const merged = parsed.merged_at != null;
  const open = parsed.state === "open";
  const mergeable = parsed.mergeable == null || parsed.mergeable === true;
  return check("docker_mcp_catalog", merged ? "pass" : open && mergeable ? "pending" : "stale", {
    http_status: result.status,
    url: parsed.html_url ?? result.url,
    state: parsed.state,
    merged_at: parsed.merged_at,
    mergeable: parsed.mergeable,
    title: parsed.title,
    head_ref: parsed.head?.ref,
    base_ref: parsed.base?.ref,
  });
}

function markdownReport(payload) {
  const rows = payload.checks
    .map(
      (row) =>
        `| ${row.name} | ${row.status} | ${row.priority} | ${row.url ?? row.latest?.version ?? row.listing_url ?? ""} | ${row.submission_url ?? ""} |`
    )
    .join("\n");
  const stale = payload.checks.filter((row) => row.status !== "pass");
  return [
    "# Packrift MCP Distribution Check",
    "",
    `Generated: ${payload.generated_at}`,
    `Expected version: ${payload.expected_version}`,
    "",
    "| Surface | Status | Priority | Evidence | Refresh URL |",
    "| --- | --- | --- | --- | --- |",
    rows,
    "",
    "## Follow-Up",
    "",
    ...(stale.length
      ? stale.map(
          (row) =>
            `- ${row.name}: ${row.status}${row.missing?.length ? `; missing ${row.missing.join(", ")}` : ""}. ${row.follow_up_action}`
        )
      : ["- None. All tracked distribution surfaces are current."]),
    "",
  ].join("\n");
}

async function main() {
  const checks = (
    await Promise.all([
      officialRegistryCheck(),
      liveMcpCheck(),
      mcpserversCheck(),
      mcpbenchCheck(),
      glamaConnectorCheck(),
      glamaServerListingCheck(),
      simplePresenceCheck("mcp_directory", "https://mcp.directory/servers?q=packrift", ["Packrift"]),
      simplePresenceCheck("anthropic_connectors_directory", "https://claude.com/connectors", ["Packrift MCP"]),
      simplePresenceCheck("smithery", "https://smithery.ai/servers?q=Packrift", ["Packrift MCP"]),
      clineMcpMarketplaceCheck(),
      simplePresenceCheck("mcp_so", "https://mcp.so/servers?keyword=Packrift", ["Exact-spec Packrift packaging search"]),
      browseSkillsFindCheck(),
      simplePresenceCheck("chiark", "https://chiark.ai/", ["Packrift"]),
      mcpMarketplaceCheck(),
      simplePresenceCheck("pulsemcp_packrift", "https://www.pulsemcp.com/servers/packrift", ["Packrift"]),
      simplePresenceCheck("mcpmarket_com", "https://mcpmarket.com/server/packrift", ["Packrift MCP"]),
      simplePresenceCheck("cursor_directory", "https://cursor.directory/", ["Packrift MCP"]),
      simplePresenceCheck("mcpcentral", "https://mcpcentral.io/servers", ["Packrift MCP"]),
      simplePresenceCheck("mcpfinder", "https://www.mcpfinder.org/", ["Packrift MCP"]),
      simplePresenceCheck("mcpskills", "https://mcpskills.app/servers", ["Packrift"]),
      simplePresenceCheck("agentndx", "https://agentndx.ai/browse", ["Packrift"]),
      dockerMcpCatalogCheck(),
    ])
  ).map(withGuidance);
  const generatedAt = new Date().toISOString();
  const outDir = resolve(OUT_ROOT, generatedAt.replace(/[:.]/g, "-"));
  mkdirSync(outDir, { recursive: true });
  const payload = {
    generated_at: generatedAt,
    expected_version: EXPECTED_VERSION,
    checks,
    counts: {
      pass: checks.filter((row) => row.status === "pass").length,
      stale: checks.filter((row) => row.status === "stale").length,
      pending: checks.filter((row) => row.status === "pending").length,
      blocked: checks.filter((row) => row.status === "blocked").length,
      fail: checks.filter((row) => row.status === "fail").length,
    },
  };
  writeFileSync(resolve(outDir, "distribution-check.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(outDir, "distribution-check.md"), markdownReport(payload));
  writeFileSync(resolve(OUT_ROOT, "latest.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(OUT_ROOT, "latest.md"), markdownReport(payload));
  console.log(JSON.stringify(payload, null, 2));
  if (payload.counts.fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
