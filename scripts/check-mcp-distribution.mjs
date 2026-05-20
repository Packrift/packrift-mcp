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
const PACKRIFT_GA4_MEASUREMENT_ID = "G-HPMNFWG4DV";
const MCP_PAGE_ANALYTICS_RELEASE = "PACKRIFT-MCP-PAGE-ANALYTICS-R01";
const MCP_COMMERCE_HELD_SKUS = new Set(["12104", "CRR40W", "FWUPS116S24P"]);
const FETCH_TIMEOUT_MS = 20000;
const execFileAsync = promisify(execFile);

const SURFACE_GUIDANCE = {
  official_registry: {
    listing_url: "https://registry.modelcontextprotocol.io/servers/io.github.Packrift/packrift-mcp",
    submission_url: "https://github.com/modelcontextprotocol/registry",
    priority: "core",
    follow_up_action: "Keep server.json published with mcp-publisher whenever the public MCP surface changes.",
  },
  github_release: {
    listing_url: "https://github.com/Packrift/packrift-mcp/releases/latest",
    submission_url: "https://github.com/Packrift/packrift-mcp/releases/new",
    priority: "core",
    follow_up_action: "Publish a GitHub release whenever package.json and server.json move to a new public MCP version.",
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
    follow_up_action:
      "Use Glama source-listing admin: claim the server, configure the repo Dockerfile, make a Glama release, then sync the server so quality scoring can run.",
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
    follow_up_action:
      "Submit Packrift MCP through an authenticated Google Forms session with endpoint, no-auth policy, and first-run proof.",
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
  punkpeye_awesome_mcp: {
    listing_url: "https://github.com/punkpeye/awesome-mcp-servers/pull/5606",
    submission_url: "https://github.com/punkpeye/awesome-mcp-servers/pull/5606",
    priority: "high",
    follow_up_action:
      "Keep the canonical punkpeye/awesome-mcp-servers PR #5606 current until the Glama score blocker clears; do not create duplicate automated PRs.",
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
  mcplist_ai: {
    listing_url: "https://www.mcplist.ai/?search=packrift",
    submission_url: "mailto:contact@mcplist.ai",
    priority: "medium",
    follow_up_action: "Review and send the existing Gmail draft with the hosted endpoint, source-specific update card, and first-useful-run proof.",
  },
  mcphubz: {
    listing_url: "https://mcphubz.com/",
    submission_url: "https://mcphubz.com/submit",
    priority: "medium",
    follow_up_action:
      "Use an authenticated MCPHubz session or working owner contact path before retrying; the public contact Formspree endpoint returned FORM_NOT_FOUND.",
  },
  mcp_blue: {
    listing_url: "https://www.mcp.blue/",
    submission_url: "https://www.mcp.blue/submit",
    priority: "medium",
    follow_up_action:
      "MCP Blue behaves like a parked/fingerprint-gated domain and the gate leads to an error page; do not spend time submitting until the domain is live again.",
  },
  findmcp_dev: {
    listing_url: "https://findmcp.dev/",
    submission_url: "mailto:hello@coderai.dev",
    priority: "medium",
    follow_up_action:
      "FindMCP /submit renders the homepage and the submit CTA errors; review and send the hello@coderai.dev draft instead of retrying the broken submit page.",
  },
  mcplane: {
    listing_url: "https://mcplane.com/mcp_servers?query=packrift",
    submission_url: "https://github.com/MCPlane",
    priority: "medium",
    follow_up_action:
      "MCPLane rejected the public Packrift GitHub repository as not found/private; use the public GitHub/LinkedIn owner routes or retry after validator repair.",
  },
  mcpsolutions_dev: {
    listing_url: "https://mcpsolutions.dev/explore/",
    submission_url: "https://mcpsolutions.dev/submit/",
    priority: "medium",
    follow_up_action: "MCP Solutions basic listing form was submitted; monitor explore/search for Packrift publication and provide the update card if review asks.",
  },
  gpmcp: {
    listing_url: "https://www.gpmcp.com/",
    submission_url: "https://www.gpmcp.com/",
    priority: "medium",
    follow_up_action: "Review the existing support@gpmcp.com draft or hold until GPMCP exposes a real submit/import path.",
  },
  theresamcpforthat: {
    listing_url: "https://theresamcpforthat.com/directory?search=packrift",
    submission_url: "https://theresamcpforthat.com/",
    priority: "medium",
    follow_up_action: "Monitor only until a real submit, contact, or upstream ingestion path appears.",
  },
  mcpserverfinder: {
    listing_url: "https://www.mcpserverfinder.com/?q=packrift",
    submission_url: "mailto:info@mcpserverfinder.com",
    priority: "medium",
    follow_up_action: "Review and send the existing Gmail draft with the hosted endpoint, marketplace manifest, source-specific update card, and first-useful-run proof.",
  },
  mcpserver_cc: {
    listing_url: "https://mcpserver.cc/",
    submission_url: "https://mcpserver.cc/submit",
    priority: "medium",
    follow_up_action:
      "mcpserver.cc accepted the public API submission; monitor for publication and use the source-specific update card if review asks for hosted endpoint proof.",
  },
  mcpserverspot: {
    listing_url: "https://www.mcpserverspot.com/servers?q=packrift",
    submission_url: "https://www.mcpserverspot.com/submit",
    priority: "medium",
    follow_up_action:
      "MCP Server Spot accepted the public form submission; monitor search for publication and use the source-specific update card if review asks for hosted endpoint proof.",
  },
  pulsemcp_packrift: {
    listing_url: "https://www.pulsemcp.com/servers/packrift",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
    priority: "high",
    follow_up_action: "PulseMCP is blocked to this checker; use official-registry publication and public server.json as the recrawl source.",
  },
  mcpmarket_com: {
    listing_url: "https://mcpmarket.com/server/packrift",
    submission_url: "mailto:hi@mcpmarketplace.com",
    priority: "medium",
    follow_up_action: "Review and send the hi@mcpmarketplace.com draft because the browser submit/update flow hits a Vercel checkpoint.",
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
    follow_up_action:
      "MCPfinder reports the Packrift MCP repository is already submitted and under review; monitor approval and provide endpoint proof if review asks.",
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
const MCP_ACTIVATION_WAVE_JSON_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.json";
const MCP_ACTIVATION_WAVE_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.md";
const MCP_ACTIVATION_WAVE_HTML_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.html";
const MCP_ACTIVATION_WAVE_TASKS_JSONL_URL = "https://mcp.packrift.com/ai/mcp-activation-wave-tasks.jsonl";
const MCP_ACTIVATION_WAVE_TASKS_CSV_URL = "https://mcp.packrift.com/ai/mcp-activation-wave-tasks.csv";
const MCP_ACTIVATION_WAVE_RUNNER_URL = "https://mcp.packrift.com/ai/mcp-activation-wave-runner.sh";
const MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief.json";
const MCP_EXTERNAL_ACTIVATION_BRIEF_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief.md";
const MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief.html";
const MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief-tasks.jsonl";
const MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief-tasks.csv";
const MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief-runner.sh";
const MCP_AUTOMATION_WORKFLOWS_JSON_URL = "https://mcp.packrift.com/ai/mcp-automation-workflows.json";
const MCP_AUTOMATION_WORKFLOWS_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-automation-workflows.md";
const MCP_AUTOMATION_WORKFLOWS_HTML_URL = "https://mcp.packrift.com/ai/mcp-automation-workflows.html";
const MCP_N8N_WORKFLOW_JSON_URL = "https://mcp.packrift.com/ai/mcp-n8n-workflow.json";
const MCP_REVENUE_CONVERSION_QUEUE_JSON_URL = "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.json";
const MCP_REVENUE_CONVERSION_QUEUE_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.md";
const MCP_REVENUE_CONVERSION_QUEUE_HTML_URL = "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.html";
const MCP_BUYER_ORDER_HANDOFFS_JSON_URL = "https://mcp.packrift.com/ai/mcp-buyer-order-handoffs.json";
const MCP_BUYER_ORDER_HANDOFFS_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-buyer-order-handoffs.md";
const MCP_BUYER_ORDER_HANDOFFS_HTML_URL = "https://mcp.packrift.com/ai/mcp-buyer-order-handoffs.html";
const OPENAI_STRICT_PUBLIC_PRODUCT_FEED_TSV_URL =
  "https://mcp.packrift.com/ai/packrift-openai-products-strict-stable-current.tsv";
const OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_TSV_URL =
  "https://mcp.packrift.com/ai/packrift-openai-products-preferred-direct-current.tsv";
const OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_GZIP_URL =
  "https://mcp.packrift.com/ai/packrift-openai-products-preferred-direct-current.tsv.gz";
const OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_IMMUTABLE_TSV_URL =
  "https://mcp.packrift.com/ai/packrift-openai-products-preferred-direct-4837-20260520.tsv";
const OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_IMMUTABLE_GZIP_URL =
  "https://mcp.packrift.com/ai/packrift-openai-products-preferred-direct-4837-20260520.tsv.gz";

function cacheBustedUrl(url) {
  if (!url.startsWith(PACKRIFT_ORIGIN)) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("packrift_check", RUN_CACHE_BUST);
  return parsed.toString();
}

async function fetchText(url) {
  try {
    const response = await fetch(cacheBustedUrl(url), { headers: TEXT_HEADERS, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, text };
  } catch (error) {
    return { ok: false, status: 0, url, text: "", error: error.message };
  }
}

async function fetchRedirect(url) {
  try {
    const response = await fetch(cacheBustedUrl(url), { headers: TEXT_HEADERS, redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchMcp(method, params = undefined) {
  let lastResult = { ok: false, status: 0, url: MCP_ENDPOINT, value: null, error: "not attempted" };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(MCP_ENDPOINT, {
        method: "POST",
        headers: {
          ...TEXT_HEADERS,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: method,
          method,
          ...(params ? { params } : {}),
        }),
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const text = await response.text();
      const value = parseMcpResponseText(text);
      lastResult = {
        ok: response.ok && !value?.error,
        status: response.status,
        url: response.url,
        value,
        error: value?.error?.message ?? null,
        attempts: attempt,
      };
      if (lastResult.ok || response.status < 500) return lastResult;
    } catch (error) {
      lastResult = { ok: false, status: 0, url: MCP_ENDPOINT, value: null, error: error.message, attempts: attempt };
    }
    await sleep(250 * attempt);
  }
  return lastResult;
}

function hasAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function hasMcpPageAnalytics(text, pageType, extraNeedles = []) {
  return hasAll(text, [
    `googletagmanager.com/gtag/js?id=${PACKRIFT_GA4_MEASUREMENT_ID}`,
    PACKRIFT_GA4_MEASUREMENT_ID,
    MCP_PAGE_ANALYTICS_RELEASE,
    "packrift_mcp_page_view",
    `"page_type":"${pageType}"`,
    ...extraNeedles,
  ]);
}

function parseJsonOrNull(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function parseMcpResponseText(text) {
  const direct = parseJsonOrNull(text);
  if (direct) return direct;
  const dataLines = String(text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter(Boolean);
  for (const line of dataLines.toReversed()) {
    const parsed = parseJsonOrNull(line);
    if (parsed) return parsed;
  }
  return null;
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

async function githubReleaseCheck() {
  const result = await fetchText("https://api.github.com/repos/Packrift/packrift-mcp/releases/latest");
  if (!result.ok) return check("github_release", "blocked", { http_status: result.status, url: result.url, error: result.error ?? null });

  const parsed = JSON.parse(result.text);
  const expectedTag = `v${EXPECTED_VERSION}`;
  return check("github_release", parsed.tag_name === expectedTag && parsed.draft === false ? "pass" : "stale", {
    http_status: result.status,
    url: parsed.html_url ?? result.url,
    expected_tag: expectedTag,
    tag_name: parsed.tag_name,
    release_name: parsed.name,
    draft: parsed.draft,
    prerelease: parsed.prerelease,
    published_at: parsed.published_at,
    target_commitish: parsed.target_commitish,
  });
}

async function liveMcpCheck() {
  const [
    healthResult,
    serverCardResult,
    startResult,
    cartResult,
    measuredHandoffsResult,
    purchasePathsResult,
    heldSku12104JsonResult,
    heldSku12104MarkdownResult,
    heldSkuFwupsJsonResult,
    heldSkuFwupsMarkdownResult,
    mcpToolsDiscoveryResult,
    specFinderToolsResult,
    agentCaptureResult,
    agentHostRolloutResult,
    adoptionKitResult,
    installMatrixResult,
    installActionsResult,
    firstRunActionsResult,
    clientConfigResult,
    rootMcpJsonResult,
    wellKnownMcpJsonResult,
    marketplaceManifestResult,
    llmsTxtResult,
    llmsFullTxtResult,
    strictPublicProductFeedResult,
    preferredDirectProductFeedResult,
    preferredDirectProductFeedGzipResult,
    preferredDirectProductFeedImmutableResult,
    preferredDirectProductFeedImmutableGzipResult,
    trackedConfigGenericResult,
    trackedInstallCodexResult,
    trackedInstallCodexHtmlResult,
    trackedInstallClineJsonResult,
    trackedInstallClineHtmlResult,
    trackedFirstRunGenericResult,
    trackedFirstRunHtmlResult,
    trackedFirstRunClineJsonResult,
    trackedFirstRunClineHtmlResult,
    trackedFirstRunExecuteResult,
    usageSnapshotResult,
    funnelSnapshotResult,
    ga4FunnelProofResult,
    sourceActivationQueueResult,
    sourceActivationQueueHtmlResult,
    revenueConversionQueueResult,
    revenueConversionQueueMarkdownResult,
    revenueConversionQueueHtmlResult,
    buyerOrderHandoffsResult,
    buyerOrderHandoffsMarkdownResult,
    buyerOrderHandoffsHtmlResult,
    sourceActivationSitemapResult,
    sourceActivationClineJsonResult,
    sourceActivationClineMarkdownResult,
    sourceActivationClineHtmlResult,
    sourceActivationCodexJsonResult,
    sourceActivationClaudeJsonResult,
    sourceActivationGlamaJsonResult,
    sourceActivationAnthropicJsonResult,
    activationExperimentsResult,
    activationExperimentsMarkdownResult,
    activationExperimentsHtmlResult,
    activationWaveResult,
    activationWaveMarkdownResult,
    activationWaveHtmlResult,
    activationWaveTasksJsonlResult,
    activationWaveTasksCsvResult,
    activationWaveRunnerResult,
    externalActivationBriefResult,
    externalActivationBriefMarkdownResult,
    externalActivationBriefHtmlResult,
    externalActivationBriefTasksJsonlResult,
    externalActivationBriefTasksCsvResult,
    externalActivationBriefRunnerResult,
    activationCommandCenterResult,
    agentAdoptionProgressResult,
    agentAdoptionProgressMarkdownResult,
    agentAdoptionProgressHtmlResult,
    buyerUseCasesResult,
    buyerUseCasesHtmlResult,
    cartActivationResult,
    cartActivationHtmlResult,
    firstRunProofResult,
    workflowGalleryResult,
    workflowGalleryHtmlResult,
    automationWorkflowsResult,
    automationWorkflowsMarkdownResult,
    automationWorkflowsHtmlResult,
    n8nWorkflowResult,
    evalPackResult,
    browserAgentBridgeResult,
    browserbaseBrowseSkillPackResult,
    directoryRefreshResult,
    directorySubmitActionsResult,
    directoryUpdateGlamaServerJsonResult,
    directoryUpdatePunkpeyeJsonResult,
    directoryUpdateClineJsonResult,
    directoryUpdateClineMarkdownResult,
    directoryUpdateMcpSoJsonResult,
    directoryUpdateMarketplaceJsonResult,
    directoryUpdateBrowseJsonResult,
    directoryUpdateBrowseMarkdownResult,
    directoryUpdateMcplistJsonResult,
    directoryUpdateMcpBlueJsonResult,
    directoryUpdateMcpServerFinderJsonResult,
    directoryUpdateMcpServerCcJsonResult,
    directoryUpdateMcpServerSpotJsonResult,
    reviewerActivationResult,
    trackedReviewerActivationGenericResult,
    trackedReviewerActivationHtmlResult,
    trackedReviewerActivationShellResult,
    trackedReviewerActivationClineResult,
    trackedOrderClineResult,
    trackedOrderMcpSoResult,
    trackedOrderMcpSoHtmlResult,
    trackedOrderMcpSoMarkdownResult,
    claudeConnectorSubmissionResult,
    agentCaptureOutreachResult,
    agentCaptureOutreachHtmlResult,
    trackedStartPartnerResult,
    trackedStartHtmlPartnerResult,
    invalidStartSourceResult,
    invalidConfigSourceResult,
    invalidInstallSourceResult,
    invalidInstallTargetResult,
    invalidFirstRunSourceResult,
    invalidFirstRunTargetResult,
    invalidReviewerActivationSourceResult,
    sourceRunResourceShellResult,
    sourceRunResourceMarkdownResult,
    sourceActivateResourceShellResult,
    sourceOrderResourceMarkdownResult,
    sourceAwarePreparePurchaseResult,
    toolsResult,
    resourcesResult,
    resourceTemplatesResult,
    promptsResult,
  ] = await Promise.all([
    fetchText("https://mcp.packrift.com/health"),
    fetchText("https://mcp.packrift.com/.well-known/mcp/server-card.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-start.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json"),
    fetchText("https://mcp.packrift.com/ai/measured-handoffs.json"),
    fetchText("https://mcp.packrift.com/ai/purchase-paths.jsonl"),
    fetchText("https://mcp.packrift.com/ai/sku/12104.json"),
    fetchText("https://mcp.packrift.com/ai/sku/12104.md"),
    fetchText("https://mcp.packrift.com/ai/sku/FWUPS116S24P.json"),
    fetchText("https://mcp.packrift.com/ai/sku/FWUPS116S24P.md"),
    fetchText("https://mcp.packrift.com/ai/mcp-tools.json"),
    fetchText("https://mcp.packrift.com/ai/spec-finder-tools.md"),
    fetchText("https://mcp.packrift.com/ai/all-agent-capture.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-agent-host-rollout.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-adoption-kit.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-install-matrix.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-install-actions.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-first-run-actions.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-client-config.json"),
    fetchText("https://mcp.packrift.com/mcp.json"),
    fetchText("https://mcp.packrift.com/.well-known/mcp.json"),
    fetchText("https://mcp.packrift.com/.well-known/mcp-marketplace.json"),
    fetchText("https://mcp.packrift.com/llms.txt"),
    fetchText("https://mcp.packrift.com/llms-full.txt"),
    fetchText(OPENAI_STRICT_PUBLIC_PRODUCT_FEED_TSV_URL),
    fetchText(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_TSV_URL),
    fetchText(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_GZIP_URL),
    fetchText(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_IMMUTABLE_TSV_URL),
    fetchText(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_IMMUTABLE_GZIP_URL),
    fetchText("https://mcp.packrift.com/r/config/generic?utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/install/generic/codex?format=text&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/install/generic/codex?format=html&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/install/cline_mcp_marketplace/cline?format=json&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/install/cline_mcp_marketplace/cline?format=html&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/run/generic/generic_streamable_http?format=sh&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/run/generic/generic_streamable_http?format=html&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline?format=json&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline?format=html&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/run/generic/generic_streamable_http?execute=1&format=json&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/ai/mcp-usage-snapshot.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-funnel-snapshot.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation-queue.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation-queue.html"),
    fetchText(`${MCP_REVENUE_CONVERSION_QUEUE_JSON_URL}?limit=20000&order_days=90&order_limit=250`),
    fetchText(`${MCP_REVENUE_CONVERSION_QUEUE_MARKDOWN_URL}?limit=20000&order_days=90&order_limit=250`),
    fetchText(`${MCP_REVENUE_CONVERSION_QUEUE_HTML_URL}?limit=20000&order_days=90&order_limit=250`),
    fetchText(`${MCP_BUYER_ORDER_HANDOFFS_JSON_URL}?limit=20000&order_days=90&order_limit=250`),
    fetchText(`${MCP_BUYER_ORDER_HANDOFFS_MARKDOWN_URL}?limit=20000&order_days=90&order_limit=250`),
    fetchText(`${MCP_BUYER_ORDER_HANDOFFS_HTML_URL}?limit=20000&order_days=90&order_limit=250`),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml"),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation/cline_mcp_marketplace.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation/cline_mcp_marketplace.md"),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation/cline_mcp_marketplace.html"),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation/codex_remote_mcp.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation/claude_remote_mcp.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation/glama_connector.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-source-activation/anthropic_connectors_directory.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-activation-experiments.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-activation-experiments.md"),
    fetchText("https://mcp.packrift.com/ai/mcp-activation-experiments.html"),
    fetchText("https://mcp.packrift.com/ai/mcp-activation-wave.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-activation-wave.md"),
    fetchText("https://mcp.packrift.com/ai/mcp-activation-wave.html"),
    fetchText(MCP_ACTIVATION_WAVE_TASKS_JSONL_URL),
    fetchText(MCP_ACTIVATION_WAVE_TASKS_CSV_URL),
    fetchText(MCP_ACTIVATION_WAVE_RUNNER_URL),
    fetchText(MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL),
    fetchText(MCP_EXTERNAL_ACTIVATION_BRIEF_MARKDOWN_URL),
    fetchText(MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL),
    fetchText(MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL),
    fetchText(MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL),
    fetchText(MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL),
    fetchText("https://mcp.packrift.com/r/activate?utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/ai/mcp-agent-adoption-progress.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-agent-adoption-progress.md"),
    fetchText("https://mcp.packrift.com/ai/mcp-agent-adoption-progress.html"),
    fetchText("https://mcp.packrift.com/ai/mcp-buyer-use-cases.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-buyer-use-cases.html"),
    fetchText("https://mcp.packrift.com/ai/mcp-cart-activation.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-cart-activation.html"),
    fetchText("https://mcp.packrift.com/ai/mcp-first-run-proof.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-workflow-gallery.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-workflow-gallery.html"),
    fetchText(MCP_AUTOMATION_WORKFLOWS_JSON_URL),
    fetchText(MCP_AUTOMATION_WORKFLOWS_MARKDOWN_URL),
    fetchText(MCP_AUTOMATION_WORKFLOWS_HTML_URL),
    fetchText(MCP_N8N_WORKFLOW_JSON_URL),
    fetchText("https://mcp.packrift.com/ai/mcp-eval-pack.json"),
    fetchText("https://mcp.packrift.com/ai/browser-agent-bridge.json"),
    fetchText("https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-refresh.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-submit-actions.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/glama_server_listing.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/punkpeye_awesome_mcp.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/cline_mcp_marketplace.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/cline_mcp_marketplace.md"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/mcp_so.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/mcp_marketplace_io.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/browse_sh.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/browse_sh.md"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/mcplist_ai.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/mcp_blue.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/mcpserverfinder.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/mcpserver_cc.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-directory-update/mcpserverspot.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-reviewer-activation.json"),
    fetchText("https://mcp.packrift.com/r/activate/generic?format=json&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/activate/generic?format=html&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/activate/generic?format=sh&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=json&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=json&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/order/mcp_so?format=json&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/order/mcp_so?format=html&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/order/mcp_so?format=md&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/ai/claude-connector-submission.json"),
    fetchText("https://mcp.packrift.com/ai/agent-capture-outreach.json"),
    fetchText("https://mcp.packrift.com/ai/agent-capture-outreach.html"),
    fetchRedirect("https://mcp.packrift.com/r/start/partner_demo?utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/start?utm_source=partner_demo&utm_content=distribution_check"),
    fetchText("https://mcp.packrift.com/r/start/bad-source"),
    fetchText("https://mcp.packrift.com/r/config/bad-source"),
    fetchText("https://mcp.packrift.com/r/install/bad-source/codex"),
    fetchText("https://mcp.packrift.com/r/install/generic/not_a_real_target"),
    fetchText("https://mcp.packrift.com/r/run/bad-source/generic_streamable_http"),
    fetchText("https://mcp.packrift.com/r/run/generic/not_a_real_target"),
    fetchText("https://mcp.packrift.com/r/activate/bad-source"),
    fetchMcp("resources/read", { uri: "https://mcp.packrift.com/r/run/mcp_so/generic_streamable_http?format=sh" }),
    fetchMcp("resources/read", { uri: "https://mcp.packrift.com/r/run/browse_sh/codex?format=md" }),
    fetchMcp("resources/read", { uri: "https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=sh" }),
    fetchMcp("resources/read", { uri: "https://mcp.packrift.com/r/order/mcp_so?format=md" }),
    fetchMcp("tools/call", {
      name: "prepare_purchase_handoff",
      arguments: {
        sku: "1066",
        quantity: 1,
        buyer_confirmed: true,
        source_context: "distribution_check_purchase_handoff",
        mcp_source_context: "cline_mcp_marketplace",
        mcp_install_target: "cline",
        suppress_analytics: true,
        analytics_context: { synthetic: true, source: "distribution_check" },
      },
    }),
    fetchMcp("tools/list"),
    fetchMcp("resources/list"),
    fetchMcp("resources/templates/list"),
    fetchMcp("prompts/list"),
  ]);
  const health = healthResult.ok ? JSON.parse(healthResult.text) : null;
  const serverCard = serverCardResult.ok ? JSON.parse(serverCardResult.text) : null;
  const start = startResult.ok ? JSON.parse(startResult.text) : null;
  const cart = cartResult.ok ? JSON.parse(cartResult.text) : null;
  const measuredHandoffs = measuredHandoffsResult.ok ? JSON.parse(measuredHandoffsResult.text) : null;
  const mcpToolsDiscovery = mcpToolsDiscoveryResult.ok ? JSON.parse(mcpToolsDiscoveryResult.text) : null;
  const agentCapture = agentCaptureResult.ok ? JSON.parse(agentCaptureResult.text) : null;
  const agentHostRollout = agentHostRolloutResult.ok ? JSON.parse(agentHostRolloutResult.text) : null;
  const agentHostRolloutMcpSo = agentHostRollout?.rows?.find((row) => row.source === "mcp_so");
  const agentHostRolloutGlama = agentHostRollout?.rows?.find((row) => row.source === "glama_connector");
  const adoptionKit = adoptionKitResult.ok ? JSON.parse(adoptionKitResult.text) : null;
  const installMatrix = installMatrixResult.ok ? JSON.parse(installMatrixResult.text) : null;
  const installActions = installActionsResult.ok ? JSON.parse(installActionsResult.text) : null;
  const firstRunActions = firstRunActionsResult.ok ? JSON.parse(firstRunActionsResult.text) : null;
  const clientConfig = clientConfigResult.ok ? JSON.parse(clientConfigResult.text) : null;
  const rootMcpJson = rootMcpJsonResult.ok ? JSON.parse(rootMcpJsonResult.text) : null;
  const wellKnownMcpJson = wellKnownMcpJsonResult.ok ? JSON.parse(wellKnownMcpJsonResult.text) : null;
  const marketplaceManifest = marketplaceManifestResult.ok ? JSON.parse(marketplaceManifestResult.text) : null;
  const trackedConfigGeneric = trackedConfigGenericResult.ok ? JSON.parse(trackedConfigGenericResult.text) : null;
  const trackedFirstRunExecute = trackedFirstRunExecuteResult.ok ? JSON.parse(trackedFirstRunExecuteResult.text) : null;
  const usageSnapshot = usageSnapshotResult.ok ? JSON.parse(usageSnapshotResult.text) : null;
  const funnelSnapshot = funnelSnapshotResult.ok ? JSON.parse(funnelSnapshotResult.text) : null;
  const ga4FunnelProof = ga4FunnelProofResult.ok ? JSON.parse(ga4FunnelProofResult.text) : null;
  const sourceActivationQueue = sourceActivationQueueResult.ok ? JSON.parse(sourceActivationQueueResult.text) : null;
  const revenueConversionQueue = revenueConversionQueueResult.ok ? JSON.parse(revenueConversionQueueResult.text) : null;
  const buyerOrderHandoffs = buyerOrderHandoffsResult.ok ? JSON.parse(buyerOrderHandoffsResult.text) : null;
  const sourceActivationCline = sourceActivationClineJsonResult.ok ? JSON.parse(sourceActivationClineJsonResult.text) : null;
  const sourceActivationCodex = sourceActivationCodexJsonResult.ok ? JSON.parse(sourceActivationCodexJsonResult.text) : null;
  const sourceActivationClaude = sourceActivationClaudeJsonResult.ok ? JSON.parse(sourceActivationClaudeJsonResult.text) : null;
  const sourceActivationGlama = sourceActivationGlamaJsonResult.ok ? JSON.parse(sourceActivationGlamaJsonResult.text) : null;
  const sourceActivationAnthropic = sourceActivationAnthropicJsonResult.ok ? JSON.parse(sourceActivationAnthropicJsonResult.text) : null;
  const activationExperiments = activationExperimentsResult.ok ? JSON.parse(activationExperimentsResult.text) : null;
  const activationWave = activationWaveResult.ok ? JSON.parse(activationWaveResult.text) : null;
  const externalActivationBrief = externalActivationBriefResult.ok ? JSON.parse(externalActivationBriefResult.text) : null;
  const activationWaveTaskRows = activationWaveTasksJsonlResult.ok
    ? activationWaveTasksJsonlResult.text.trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const externalActivationBriefTaskRows = externalActivationBriefTasksJsonlResult.ok
    ? externalActivationBriefTasksJsonlResult.text.trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const agentAdoptionProgress = agentAdoptionProgressResult.ok ? JSON.parse(agentAdoptionProgressResult.text) : null;
  const buyerUseCases = buyerUseCasesResult.ok ? JSON.parse(buyerUseCasesResult.text) : null;
  const cartActivation = cartActivationResult.ok ? JSON.parse(cartActivationResult.text) : null;
  const firstRunProof = firstRunProofResult.ok ? JSON.parse(firstRunProofResult.text) : null;
  const workflowGallery = workflowGalleryResult.ok ? JSON.parse(workflowGalleryResult.text) : null;
  const automationWorkflows = automationWorkflowsResult.ok ? JSON.parse(automationWorkflowsResult.text) : null;
  const n8nWorkflow = n8nWorkflowResult.ok ? JSON.parse(n8nWorkflowResult.text) : null;
  const automationN8nNodeNames = (automationWorkflows?.workflows?.n8n?.workflow?.nodes ?? []).map((node) => node?.name).filter(Boolean);
  const n8nWorkflowNodeNames = (n8nWorkflow?.nodes ?? []).map((node) => node?.name).filter(Boolean);
  const automationZapierSteps = automationWorkflows?.workflows?.zapier?.steps ?? [];
  const automationPipedreamCode = automationWorkflows?.workflows?.pipedream?.code ?? "";
  const evalPack = evalPackResult.ok ? JSON.parse(evalPackResult.text) : null;
  const browserAgentBridge = browserAgentBridgeResult.ok ? JSON.parse(browserAgentBridgeResult.text) : null;
  const browserbaseBrowseSkillPack = browserbaseBrowseSkillPackResult.ok ? JSON.parse(browserbaseBrowseSkillPackResult.text) : null;
  const directoryRefresh = directoryRefreshResult.ok ? JSON.parse(directoryRefreshResult.text) : null;
  const directorySubmitActions = directorySubmitActionsResult.ok ? JSON.parse(directorySubmitActionsResult.text) : null;
  const directoryUpdateGlamaServer = directoryUpdateGlamaServerJsonResult.ok ? JSON.parse(directoryUpdateGlamaServerJsonResult.text) : null;
  const directoryUpdatePunkpeye = directoryUpdatePunkpeyeJsonResult.ok ? JSON.parse(directoryUpdatePunkpeyeJsonResult.text) : null;
  const directoryUpdateCline = directoryUpdateClineJsonResult.ok ? JSON.parse(directoryUpdateClineJsonResult.text) : null;
  const directoryUpdateMcpSo = directoryUpdateMcpSoJsonResult.ok ? JSON.parse(directoryUpdateMcpSoJsonResult.text) : null;
  const directoryUpdateMarketplace = directoryUpdateMarketplaceJsonResult.ok ? JSON.parse(directoryUpdateMarketplaceJsonResult.text) : null;
  const directoryUpdateBrowse = directoryUpdateBrowseJsonResult.ok ? JSON.parse(directoryUpdateBrowseJsonResult.text) : null;
  const directoryUpdateMcplist = directoryUpdateMcplistJsonResult.ok ? JSON.parse(directoryUpdateMcplistJsonResult.text) : null;
  const directoryUpdateMcpBlue = directoryUpdateMcpBlueJsonResult.ok ? JSON.parse(directoryUpdateMcpBlueJsonResult.text) : null;
  const directoryUpdateMcpServerFinder = directoryUpdateMcpServerFinderJsonResult.ok ? JSON.parse(directoryUpdateMcpServerFinderJsonResult.text) : null;
  const directoryUpdateMcpServerCc = directoryUpdateMcpServerCcJsonResult.ok ? JSON.parse(directoryUpdateMcpServerCcJsonResult.text) : null;
  const directoryUpdateMcpServerSpot = directoryUpdateMcpServerSpotJsonResult.ok ? JSON.parse(directoryUpdateMcpServerSpotJsonResult.text) : null;
  const reviewerActivation = reviewerActivationResult.ok ? JSON.parse(reviewerActivationResult.text) : null;
  const trackedReviewerActivationGeneric = trackedReviewerActivationGenericResult.ok ? JSON.parse(trackedReviewerActivationGenericResult.text) : null;
  const trackedReviewerActivationCline = trackedReviewerActivationClineResult.ok ? JSON.parse(trackedReviewerActivationClineResult.text) : null;
  const trackedOrderCline = trackedOrderClineResult.ok ? JSON.parse(trackedOrderClineResult.text) : null;
  const trackedOrderMcpSo = trackedOrderMcpSoResult.ok ? JSON.parse(trackedOrderMcpSoResult.text) : null;
  const sourceAwarePreparePurchase = sourceAwarePreparePurchaseResult.value?.result?.structuredContent ?? null;
  const claudeConnectorSubmission = claudeConnectorSubmissionResult.ok ? JSON.parse(claudeConnectorSubmissionResult.text) : null;
  const agentCaptureOutreach = agentCaptureOutreachResult.ok ? JSON.parse(agentCaptureOutreachResult.text) : null;
  const agentCaptureOutreachHtml = agentCaptureOutreachHtmlResult.ok ? agentCaptureOutreachHtmlResult.text : "";
  const trackedStartTarget = parseUrlOrNull(trackedStartPartnerResult.location);
  const invalidStartSource = parseJsonOrNull(invalidStartSourceResult.text);
  const invalidConfigSource = parseJsonOrNull(invalidConfigSourceResult.text);
  const invalidInstallSource = parseJsonOrNull(invalidInstallSourceResult.text);
  const invalidInstallTarget = parseJsonOrNull(invalidInstallTargetResult.text);
  const invalidFirstRunSource = parseJsonOrNull(invalidFirstRunSourceResult.text);
  const invalidFirstRunTarget = parseJsonOrNull(invalidFirstRunTargetResult.text);
  const invalidReviewerActivationSource = parseJsonOrNull(invalidReviewerActivationSourceResult.text);
  const trackedInstallClineJson = parseJsonOrNull(trackedInstallClineJsonResult.text);
  const cartItems = Array.isArray(cart?.items) ? cart.items : [];
  const measuredHandoffItems = Array.isArray(measuredHandoffs?.items) ? measuredHandoffs.items : [];
  const firstCartUrl = cartItems[0]?.cart_url_qty_1_candidate ?? "";
  const firstFinalCartUrl = cartItems[0]?.final_shopify_cart_url_candidate ?? "";
  const heldSkuPolicySkus = Array.isArray(cart?.held_sku_policy?.held_skus)
    ? cart.held_sku_policy.held_skus.map((sku) => String(sku).toUpperCase())
    : [];
  const cartHandoffHeldSkus = cartItems
    .map((item) => String(item?.sku ?? "").toUpperCase())
    .filter((sku) => MCP_COMMERCE_HELD_SKUS.has(sku));
  const measuredHandoffHeldSkus = measuredHandoffItems
    .map((item) => String(item?.sku ?? "").toUpperCase())
    .filter((sku) => MCP_COMMERCE_HELD_SKUS.has(sku));
  const purchasePathsHeldSkus = [...MCP_COMMERCE_HELD_SKUS].filter((sku) => purchasePathsResult.text.includes(`"sku":"${sku}"`));
  const heldSkuPageCartLeakText = [
    heldSku12104JsonResult.text,
    heldSku12104MarkdownResult.text,
    heldSkuFwupsJsonResult.text,
    heldSkuFwupsMarkdownResult.text,
  ].join("\n");
  const heldSkuPagesAvoidCartUrls =
    !heldSkuPageCartLeakText.includes("https://packrift.com/cart/") &&
    !heldSkuPageCartLeakText.includes("https://mcp.packrift.com/r/cart/12104") &&
    !heldSkuPageCartLeakText.includes("https://mcp.packrift.com/r/cart/FWUPS116S24P");
  const cartHandoffExcludesHeldSkus = cartHandoffHeldSkus.length === 0;
  const measuredHandoffsExcludeHeldSkus = measuredHandoffHeldSkus.length === 0;
  const purchasePathsExcludeHeldSkus = purchasePathsHeldSkus.length === 0;
  const cartHandoffHoldPolicyOk = ["12104", "CRR40W", "FWUPS116S24P"].every((sku) => heldSkuPolicySkus.includes(sku));
  const mcpToolsDiscoveryToolNames = (mcpToolsDiscovery?.tools ?? []).map((tool) => tool.name).filter(Boolean);
  const preparePurchaseTool = (toolsResult.value?.result?.tools ?? []).find((tool) => tool.name === "prepare_purchase_handoff");
  const toolNames = (toolsResult.value?.result?.tools ?? []).map((tool) => tool.name).filter(Boolean);
  const resources = resourcesResult.value?.result?.resources ?? [];
  const resourcesCount = resources.length;
  const resourceUris = new Set(resources.map((resource) => resource.uri));
  const resourceTemplates = resourceTemplatesResult.value?.result?.resourceTemplates ?? [];
  const resourceTemplateUris = new Set(resourceTemplates.map((resource) => resource.uriTemplate));
  const sourceRunResourceShellText = sourceRunResourceShellResult.value?.result?.contents?.[0]?.text ?? "";
  const sourceRunResourceMarkdownText = sourceRunResourceMarkdownResult.value?.result?.contents?.[0]?.text ?? "";
  const sourceActivateResourceShellText = sourceActivateResourceShellResult.value?.result?.contents?.[0]?.text ?? "";
  const strictPublicProductFeedOk =
    strictPublicProductFeedResult.ok &&
    strictPublicProductFeedResult.text.startsWith("is_eligible_search\tis_eligible_checkout\titem_id\t");
  const preferredDirectProductFeedOk =
    preferredDirectProductFeedResult.ok &&
    preferredDirectProductFeedResult.text.startsWith("is_eligible_search\tis_eligible_checkout\titem_id\tgtin\t") &&
    preferredDirectProductFeedResult.text.includes("\n");
  const preferredDirectProductFeedGzipOk =
    preferredDirectProductFeedGzipResult.ok && preferredDirectProductFeedGzipResult.text.charCodeAt(0) === 0x1f;
  const preferredDirectProductFeedImmutableOk =
    preferredDirectProductFeedImmutableResult.ok &&
    preferredDirectProductFeedImmutableResult.text.startsWith("is_eligible_search\tis_eligible_checkout\titem_id\tgtin\t") &&
    preferredDirectProductFeedImmutableResult.text.includes("\n");
  const preferredDirectProductFeedImmutableGzipOk =
    preferredDirectProductFeedImmutableGzipResult.ok &&
    preferredDirectProductFeedImmutableGzipResult.text.charCodeAt(0) === 0x1f;
  const promptsCount = promptsResult.value?.result?.prompts?.length ?? 0;
  const sourceActivationCriticalActions = Array.isArray(sourceActivationQueue?.critical_actions) ? sourceActivationQueue.critical_actions : [];
  const sourceActivationCriticalActionsOk =
    Array.isArray(sourceActivationQueue?.critical_actions) &&
    (Number(sourceActivationQueue?.critical_count ?? 0) === 0
      ? sourceActivationQueue?.queue?.some(
          (row) =>
            row.external_activation_required === true &&
            row.operator_safety_rule?.includes("Do not ") &&
            row.copy_ready_host_configs?.generic_mcp_json?.includes('"mcpServers"') &&
            row.fast_activation_path?.first_run_shell_one_liner?.includes("/r/run/") &&
            row.fast_activation_path?.first_run_shell_one_liner?.includes("format=sh") &&
            row.one_command_external_runner?.includes("curl -sS") &&
            row.one_command_external_runner?.includes("| bash")
        )
      : sourceActivationCriticalActions.some((row) => row.external_activation_required === true && row.operator_safety_rule?.includes("Do not ")) &&
        sourceActivationCriticalActions.every(
          (row) =>
            ["real_mcp_tool_call_needed", "cart_landing_needed", "buyer_checkout_needed", "activation_needed"].includes(row.status) &&
            row.activation_status === row.status
        ) &&
        sourceActivationCriticalActions.some(
          (row) =>
            row.copy_ready_host_configs?.generic_mcp_json?.includes('"mcpServers"') &&
            row.run_real_mcp_shell_url?.includes("format=sh") &&
            row.fast_activation_path?.first_run_shell_one_liner?.includes("format=sh") &&
            row.one_command_external_runner?.includes("curl -sS") &&
            row.one_command_external_runner?.includes("| bash")
        ));
  const sourceActivationClineRowOk = sourceActivationQueue?.queue?.some((row) => {
    if (row.source !== "cline_mcp_marketplace" || row.preferred_target !== "cline") return false;
    const targetEventOk = ["mcp_install_intent", "mcp_first_run_execution", "mcp_tool_call", "mcp_attributed_order"].includes(row.target_event_to_watch);
    const primaryActionOk =
      row.primary_action_url?.includes("/r/install/cline_mcp_marketplace/cline?format=html") ||
      row.primary_action_url?.includes("/r/activate/cline_mcp_marketplace?format=html") ||
      row.primary_action_url?.includes("/r/run/cline_mcp_marketplace/cline?format=html") ||
      row.primary_action_url?.includes("/r/order/cline_mcp_marketplace?format=html") ||
      row.primary_action_url?.includes("/r/cart/1066");
    const commonOk =
      targetEventOk &&
      row.external_activation_required === true &&
      (row.operator_safety_rule?.includes("real MCP") ||
        row.operator_safety_rule?.includes("real buyer") ||
        row.operator_safety_rule?.includes("MCP-attributed order")) &&
      row.source_aware_endpoint?.includes("packrift_mcp_source=cline_mcp_marketplace") &&
      row.source_aware_endpoint?.includes("packrift_mcp_target=cline") &&
      row.eval_pack_json_url === "https://mcp.packrift.com/ai/mcp-eval-pack.json?source=cline_mcp_marketplace" &&
      row.eval_pack_markdown_url === "https://mcp.packrift.com/ai/mcp-eval-pack.md?source=cline_mcp_marketplace" &&
      row.agent_prompt?.includes("target=cline") &&
      row.copy_ready_host_configs?.claude_code_command?.includes("packrift_mcp_source=cline_mcp_marketplace") &&
      row.copy_ready_host_configs?.codex_command?.startsWith("codex mcp add packrift --url") &&
      row.copy_ready_host_configs?.cline_mcp_json?.includes('"streamableHttp"') &&
      row.copy_ready_host_configs?.curl_script?.includes("create_cart_url") &&
      row.copy_ready_host_configs?.first_run_shell_one_liner?.includes("format=sh") &&
      (row.copy_ready_host_configs?.success_gate?.includes("create_cart_url") ||
        row.copy_ready_host_configs?.success_gate?.includes("buyer/reviewer checkout") ||
        row.copy_ready_host_configs?.success_gate?.includes("first_party_mcp_orders")) &&
      row.tracked_first_run_shell_url?.includes("/r/run/cline_mcp_marketplace/cline") &&
      row.tracked_first_run_shell_url?.includes("format=sh") &&
      row.first_run_shell_one_liner?.includes("/r/run/cline_mcp_marketplace/cline") &&
      row.first_run_shell_one_liner?.includes("format=sh") &&
      row.fast_activation_path?.required_final_tool === "create_cart_url" &&
      row.fast_activation_path?.first_run_shell_one_liner?.includes("format=sh") &&
      row.fast_activation_path?.install_page_url?.includes("/r/install/cline_mcp_marketplace/cline") &&
      row.one_command_external_runner?.includes("/r/activate/cline_mcp_marketplace?format=sh") &&
      row.external_activation_message?.includes("One-command external runner") &&
      (row.external_activation_message?.includes("does not place an order") ||
        row.external_activation_message?.includes("without placing an order") ||
        row.external_activation_message?.includes("MCP-attributed order")) &&
      row.directory_update_card_json_url === "https://mcp.packrift.com/ai/mcp-directory-update/cline_mcp_marketplace.json" &&
      row.directory_update_card_markdown_url === "https://mcp.packrift.com/ai/mcp-directory-update/cline_mcp_marketplace.md" &&
      row.source_order_handoff?.buyer_handoff_url === "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html" &&
      row.source_order_handoff?.buyer_action_url?.includes("mcp_source_context=cline_mcp_marketplace") &&
      row.source_order_handoff?.buyer_action_url?.includes("mcp_install_target=cline") &&
      row.source_order_handoff?.proof_boundary?.includes("not source activation proof") &&
      row.buyer_handoff_preview?.buyer_handoff_url === row.source_order_handoff?.buyer_handoff_url &&
      row.external_activation_message?.includes("mcp-directory-update/cline_mcp_marketplace.json") &&
      row.external_activation_message?.includes("Shell activation script") &&
      row.reviewer_activation_shell_url?.includes("/r/activate/cline_mcp_marketplace?format=sh") &&
      primaryActionOk &&
      row.acceptance_criteria?.some((rule) => rule.includes("create_cart_url") || rule.includes("first_party_mcp_orders")) &&
      row.tracked_install_json_url?.includes("/r/install/cline_mcp_marketplace/cline?format=json") &&
      row.tracked_first_run_url?.includes("/r/run/cline_mcp_marketplace/cline");
    if (!commonOk) return false;
    if (!row.order_conversion_handoff) {
      return (
        row.cart_landing_action_url == null &&
        (row.current_stage?.includes("discovery only") ||
          row.current_stage?.includes("first-run action") ||
          row.current_stage?.includes("tool calls missing") ||
          row.current_stage?.includes("qualified cart landing") ||
          row.current_stage?.includes("install"))
      );
    }
    return (
      row.order_conversion_handoff?.status === "order_proof_needed" &&
      row.order_conversion_handoff?.source === "cline_mcp_marketplace" &&
      row.primary_action_url === "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html" &&
      row.order_conversion_handoff?.buyer_handoff_url === row.primary_action_url &&
      row.order_conversion_handoff?.primary_order_handoff_url === row.primary_action_url &&
      row.order_conversion_handoff?.buyer_ready_summary?.includes("Exact SKU 1066") &&
      row.order_conversion_handoff?.product?.sku === "1066" &&
      row.order_conversion_handoff?.product?.variant_id === "53472879935856" &&
      row.order_conversion_handoff?.product?.product_url?.includes("/products/10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle") &&
      row.cart_landing_action_url?.includes("mcp_source_context=cline_mcp_marketplace") &&
      row.order_conversion_handoff?.buyer_action_url?.includes("/r/cart/1066") &&
      row.order_conversion_handoff?.buyer_action_url?.includes("mcp_source_context=cline_mcp_marketplace") &&
      row.order_conversion_handoff?.buyer_action_url?.includes("mcp_install_target=cline") &&
      row.order_conversion_handoff?.cart_landing_action_url === row.order_conversion_handoff?.buyer_action_url &&
      (row.order_conversion_handoff?.measured_cart_url_source_preserving
        ? row.order_conversion_handoff?.buyer_action_url === row.order_conversion_handoff?.measured_cart_url
        : row.order_conversion_handoff?.buyer_action_url === row.order_conversion_handoff?.fallback_source_preserving_cart_url) &&
      row.order_conversion_handoff?.previous_measured_cart_url?.includes("/r/cart/1066") &&
      row.order_conversion_handoff?.fallback_source_preserving_cart_url?.includes("mcp_source_context=cline_mcp_marketplace") &&
      row.order_conversion_handoff?.source_aware_endpoint?.includes("packrift_mcp_source=cline_mcp_marketplace") &&
      row.order_conversion_handoff?.source_aware_endpoint?.includes("packrift_mcp_target=cline") &&
      row.order_conversion_handoff?.source_specific_first_run_url?.includes("/r/run/cline_mcp_marketplace/cline") &&
      row.order_conversion_handoff?.required_shopify_cart_attributes?.includes("packrift_mcp_source_context") &&
      row.order_conversion_handoff?.required_shopify_cart_attributes?.includes("packrift_mcp_install_target") &&
      row.order_conversion_handoff?.proof_gate?.includes("first_party_mcp_orders") &&
      row.order_conversion_handoff?.attribution_rule?.includes("packrift_mcp_source_context")
    );
  });
  const revenueConversionRows = Array.isArray(revenueConversionQueue?.rows) ? revenueConversionQueue.rows : [];
  const revenueConversionMcpSoRow = revenueConversionRows.find((row) => row.source === "mcp_so");
  const revenueConversionClineRow = revenueConversionRows.find((row) => row.source === "cline_mcp_marketplace");
  const buyerOrderHandoffRows = Array.isArray(buyerOrderHandoffs?.handoffs) ? buyerOrderHandoffs.handoffs : [];
  const mcpPageAnalyticsDiagnostics = {
    start_html: hasMcpPageAnalytics(trackedStartHtmlPartnerResult.text, "mcp_start"),
    install_html: hasMcpPageAnalytics(trackedInstallCodexHtmlResult.text, "mcp_install"),
    first_run_html: hasMcpPageAnalytics(trackedFirstRunHtmlResult.text, "mcp_first_run"),
    activation_html: hasMcpPageAnalytics(trackedReviewerActivationHtmlResult.text, "mcp_activation"),
    source_activation_queue_html: hasMcpPageAnalytics(sourceActivationQueueHtmlResult.text, "mcp_source_activation_queue"),
    source_activation_packet_html: hasMcpPageAnalytics(sourceActivationClineHtmlResult.text, "mcp_source_activation_packet"),
    activation_experiments_html: hasMcpPageAnalytics(activationExperimentsHtmlResult.text, "mcp_activation_experiments"),
    activation_wave_html: hasMcpPageAnalytics(activationWaveHtmlResult.text, "mcp_activation_wave"),
    external_activation_brief_html: hasMcpPageAnalytics(externalActivationBriefHtmlResult.text, "mcp_external_activation_brief"),
    agent_adoption_progress_html: hasMcpPageAnalytics(agentAdoptionProgressHtmlResult.text, "mcp_agent_adoption_progress"),
    order_handoff_html: hasMcpPageAnalytics(trackedOrderMcpSoHtmlResult.text, "mcp_order_handoff", [
      "utm_source=chatgpt-mcp",
      "utm_medium=mcp_tool",
      "utm_campaign=packrift_mcp_order_handoff",
      "mcp_source_context=mcp_so",
      "mcp_install_target=generic_streamable_http",
    ]),
    revenue_queue_html: hasMcpPageAnalytics(revenueConversionQueueHtmlResult.text, "mcp_revenue_queue"),
    buyer_order_handoffs_html: hasMcpPageAnalytics(buyerOrderHandoffsHtmlResult.text, "mcp_buyer_order_handoffs"),
  };
  const mcpPageAnalyticsOk = Object.values(mcpPageAnalyticsDiagnostics).every(Boolean);
  const buyerOrderHandoffsDiagnostics = {
    json_ok: buyerOrderHandoffsResult.ok,
    markdown_ok: buyerOrderHandoffsMarkdownResult.ok,
    html_ok: buyerOrderHandoffsHtmlResult.ok,
    release: buyerOrderHandoffs?.release === "PACKRIFT-MCP-BUYER-ORDER-HANDOFFS-R01",
    status: buyerOrderHandoffs?.status === "buyer_reviewer_handoffs_ready",
    canonical_endpoint: buyerOrderHandoffs?.canonical_endpoint === MCP_ENDPOINT,
    json_link: buyerOrderHandoffs?.links?.buyer_order_handoffs_json === MCP_BUYER_ORDER_HANDOFFS_JSON_URL,
    markdown_link: buyerOrderHandoffs?.links?.buyer_order_handoffs_markdown === MCP_BUYER_ORDER_HANDOFFS_MARKDOWN_URL,
    html_link: buyerOrderHandoffs?.links?.buyer_order_handoffs_html === MCP_BUYER_ORDER_HANDOFFS_HTML_URL,
    revenue_queue_link: buyerOrderHandoffs?.links?.revenue_conversion_queue_json === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL,
    handoff_rows_present: buyerOrderHandoffRows.length >= 1,
    mcp_so_handoff: buyerOrderHandoffRows.some(
      (row) =>
        row.source === "mcp_so" &&
        row.status === "buyer_checkout_needed" &&
        row.buyer_handoff_html_url === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
        row.source_preserving_cart_url?.includes("mcp_source_context=mcp_so") &&
        row.source_preserving_cart_url?.includes("mcp_install_target=generic_streamable_http") &&
        row.copy_ready_buyer_request?.includes("only place the order if it is actually approved") &&
        row.suppression_rule?.includes("Do not count synthetic proof")
    ),
    cline_handoff: buyerOrderHandoffRows.some(
      (row) =>
        row.source === "cline_mcp_marketplace" &&
        row.status === "buyer_checkout_needed" &&
        row.buyer_handoff_html_url === "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html" &&
        row.source_preserving_cart_url?.includes("mcp_source_context=cline_mcp_marketplace") &&
        row.source_preserving_cart_url?.includes("mcp_install_target=cline")
    ),
    markdown_title: buyerOrderHandoffsMarkdownResult.text.includes("Packrift MCP Buyer Order Handoffs"),
    markdown_mcp_so: buyerOrderHandoffsMarkdownResult.text.includes("mcp_so"),
    markdown_cline: buyerOrderHandoffsMarkdownResult.text.includes("cline_mcp_marketplace"),
    html_title: buyerOrderHandoffsHtmlResult.text.includes("Packrift MCP Buyer Order Handoffs"),
    html_copy_ready: buyerOrderHandoffsHtmlResult.text.includes("Copy-ready buyer request"),
    html_mcp_so: buyerOrderHandoffsHtmlResult.text.includes("mcp_so"),
    html_cline: buyerOrderHandoffsHtmlResult.text.includes("cline_mcp_marketplace"),
    html_analytics: mcpPageAnalyticsDiagnostics.buyer_order_handoffs_html,
  };
  const buyerOrderHandoffsOk = Object.values(buyerOrderHandoffsDiagnostics).every(Boolean);
  const sourceAwarePreparePurchaseOk =
    sourceAwarePreparePurchaseResult.ok &&
    sourceAwarePreparePurchase?.status === "cart_handoff_ready" &&
    sourceAwarePreparePurchase?.source_attribution?.mcp_source_context === "cline_mcp_marketplace" &&
    sourceAwarePreparePurchase?.source_attribution?.mcp_install_target === "cline" &&
    sourceAwarePreparePurchase?.cart_arguments_if_buyer_confirms?.mcp_source_context === "cline_mcp_marketplace" &&
    sourceAwarePreparePurchase?.cart_arguments_if_buyer_confirms?.mcp_install_target === "cline" &&
    sourceAwarePreparePurchase?.cart?.url?.startsWith("https://mcp.packrift.com/r/cart/1066") &&
    sourceAwarePreparePurchase?.cart?.url?.includes("mcp_source_context=cline_mcp_marketplace") &&
    sourceAwarePreparePurchase?.cart?.url?.includes("mcp_install_target=cline") &&
    sourceAwarePreparePurchase?.cart_handoff?.primary_url === sourceAwarePreparePurchase?.cart?.url &&
    sourceAwarePreparePurchase?.cart_handoff?.attribution_required?.mcp_source_context === "cline_mcp_marketplace" &&
    sourceAwarePreparePurchase?.cart_handoff?.attribution_required?.mcp_install_target === "cline";
  const revenueConversionRowsOk =
    revenueConversionRows.length >= 1 &&
    [revenueConversionMcpSoRow, revenueConversionClineRow].some(
      (row) =>
        row?.status === "buyer_checkout_needed" &&
        row?.mcp_source_context === row.source &&
        typeof row?.mcp_install_target === "string" &&
        row?.buyer_handoff_url?.startsWith("https://mcp.packrift.com/r/order/") &&
        row?.source_preserving_cart_url?.startsWith("https://mcp.packrift.com/r/cart/1066") &&
        row?.source_preserving_cart_url?.includes(`mcp_source_context=${row.source}`) &&
        row?.proof_gate?.includes("first_party_mcp_orders") &&
        row?.suppression_rule?.includes("self-opened cart") &&
        row?.suppression_rule?.includes("shell runner") &&
        row?.current_counts?.mcp_tool_calls > 0 &&
        row?.current_counts?.qualified_cart_landings > 0
    );
  const sourceActivationHostPacketsOk =
    sourceActivationCodex?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-PACKET-R04" &&
    sourceActivationCodex?.source === "codex_remote_mcp" &&
    sourceActivationCodex?.preferred_target === "codex" &&
    sourceActivationCodex?.source_aware_endpoint?.includes("packrift_mcp_target=codex") &&
    sourceActivationCodex?.real_host_run?.first_run_shell_url?.includes("/r/run/codex_remote_mcp/codex") &&
    sourceActivationCodex?.copy_ready?.codex_command?.includes("packrift_mcp_target=codex") &&
    sourceActivationClaude?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-PACKET-R04" &&
    sourceActivationClaude?.source === "claude_remote_mcp" &&
    sourceActivationClaude?.preferred_target === "claude_code" &&
    sourceActivationClaude?.source_aware_endpoint?.includes("packrift_mcp_target=claude_code") &&
    sourceActivationClaude?.real_host_run?.first_run_shell_url?.includes("/r/run/claude_remote_mcp/claude_code") &&
    sourceActivationClaude?.copy_ready?.claude_code_command?.includes("packrift_mcp_target=claude_code") &&
    sourceActivationGlama?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-PACKET-R04" &&
    sourceActivationGlama?.source === "glama_connector" &&
    sourceActivationGlama?.preferred_target === "glama_connector" &&
    sourceActivationGlama?.source_aware_endpoint?.includes("packrift_mcp_target=glama_connector") &&
    sourceActivationGlama?.real_host_run?.first_run_shell_url?.includes("/r/run/glama_connector/glama_connector") &&
    sourceActivationAnthropic?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-PACKET-R04" &&
    sourceActivationAnthropic?.source === "anthropic_connectors_directory" &&
    sourceActivationAnthropic?.preferred_target === "claude_code" &&
    sourceActivationAnthropic?.source_aware_endpoint?.includes("packrift_mcp_target=claude_code") &&
    sourceActivationAnthropic?.real_host_run?.first_run_shell_url?.includes("/r/run/anthropic_connectors_directory/claude_code");
  const sourceActivationHostIntentRowsRequireExternalOk = ["claude_remote_mcp", "codex_remote_mcp", "glama_connector"].every((source) => {
    const row = sourceActivationQueue?.queue?.find((candidate) => candidate.source === source);
    if (!row) return true;
    return (
      row.external_activation_required === true &&
      ["mcp_install_intent", "mcp_first_run_intent", "mcp_first_run_execution", "mcp_tool_call", "mcp_cart_landing", "mcp_attributed_order"].includes(
        row.target_event_to_watch
      ) &&
      row.source_aware_endpoint?.includes(`packrift_mcp_source=${source}`) &&
      row.source_aware_endpoint?.includes("packrift_mcp_target=") &&
      (row.primary_action_url?.startsWith("https://mcp.packrift.com/r/install/") ||
        row.primary_action_url?.startsWith("https://mcp.packrift.com/r/run/") ||
        row.primary_action_url?.startsWith("https://mcp.packrift.com/r/activate/") ||
        row.primary_action_url?.startsWith("https://mcp.packrift.com/r/order/") ||
        row.primary_action_url?.startsWith("https://mcp.packrift.com/r/cart/")) &&
      row.tracked_first_run_url?.startsWith("https://mcp.packrift.com/r/run/") &&
      row.tracked_first_run_shell_url?.includes("format=sh") &&
      (row.recommended_action?.includes("install") ||
        row.recommended_action?.includes("first-run") ||
        row.recommended_action?.includes("first useful run") ||
        row.recommended_action?.includes("real MCP host") ||
        row.recommended_action?.includes("source-specific") ||
        row.recommended_action?.includes("cart URL") ||
        row.recommended_action?.includes("source reviewer") ||
        row.recommended_action?.includes("MCP-attributed order") ||
        row.current_stage?.includes("tracked start clicks") ||
        row.current_stage?.includes("first useful run missing") ||
        row.current_stage?.includes("tool calls missing"))
    );
  });
  const sourceActivationMcpSoExternalOk = sourceActivationQueue?.queue?.some((row) => {
    if (row.source !== "mcp_so" || row.external_activation_required !== true) return false;
    if (row.current_counts?.first_run_actions > 0 && row.current_counts?.mcp_tool_calls === 0) {
      return row.recommended_action?.includes("first-run");
    }
    return (
      row.target_event_to_watch === "mcp_attributed_order" &&
      row.current_counts?.mcp_tool_calls > 0 &&
      row.order_conversion_handoff?.status === "order_proof_needed" &&
      row.source_order_handoff?.buyer_handoff_url === "https://mcp.packrift.com/r/order/mcp_so?format=html"
    );
  });
  const requiredCoreResourceUris = [
    "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
    "https://mcp.packrift.com/ai/mcp-funnel-snapshot.md",
    "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
    "https://mcp.packrift.com/ai/mcp-source-activation-queue.md",
    "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
    MCP_REVENUE_CONVERSION_QUEUE_JSON_URL,
    MCP_REVENUE_CONVERSION_QUEUE_MARKDOWN_URL,
    MCP_REVENUE_CONVERSION_QUEUE_HTML_URL,
    MCP_BUYER_ORDER_HANDOFFS_JSON_URL,
    MCP_BUYER_ORDER_HANDOFFS_MARKDOWN_URL,
    MCP_BUYER_ORDER_HANDOFFS_HTML_URL,
    "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.json",
    "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.md",
    "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.html",
    "https://mcp.packrift.com/r/order/mcp_so?format=md",
    MCP_ACTIVATION_WAVE_RUNNER_URL,
    MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL,
    MCP_EXTERNAL_ACTIVATION_BRIEF_MARKDOWN_URL,
    MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL,
    MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL,
    MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL,
    MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL,
  ];
  const liveMcpFailureDiagnostics = {
    core_server:
      health?.version === EXPECTED_VERSION &&
      health?.resources_count >= 68 &&
      health?.tools_count >= 15 &&
      serverCard?.serverInfo?.name === "Packrift MCP" &&
      serverCard?.authentication?.required === false &&
      serverCard?.endpoint_url === MCP_ENDPOINT,
    mcp_lists:
      toolNames.length >= 15 &&
      toolNames.includes("create_cart_url") &&
      resourcesCount >= 68 &&
      promptsCount >= 7,
    feeds:
      strictPublicProductFeedOk &&
      preferredDirectProductFeedOk &&
      preferredDirectProductFeedGzipOk &&
      preferredDirectProductFeedImmutableOk &&
      preferredDirectProductFeedImmutableGzipOk,
    usage_and_funnel:
      usageSnapshot?.release === "PACKRIFT-MCP-USAGE-SNAPSHOT-R26" &&
      funnelSnapshot?.release === "PACKRIFT-MCP-FUNNEL-SNAPSHOT-R23" &&
      funnelSnapshot?.agent_adoption_progress?.release === "PACKRIFT-MCP-AGENT-ADOPTION-PROGRESS-R02" &&
      ga4FunnelProof?.release === "PACKRIFT-MCP-GA4-FUNNEL-PROOF-R01",
    source_activation:
      sourceActivationCriticalActionsOk &&
      sourceActivationClineRowOk &&
      sourceActivationHostPacketsOk &&
      sourceActivationHostIntentRowsRequireExternalOk &&
      sourceActivationMcpSoExternalOk,
    revenue_conversion:
      revenueConversionQueue?.release === "PACKRIFT-MCP-REVENUE-CONVERSION-QUEUE-R02" &&
      revenueConversionQueue?.status === "buyer_checkout_needed" &&
      revenueConversionRowsOk,
    buyer_order_handoffs: buyerOrderHandoffsOk,
    source_aware_prepare_purchase_handoff: sourceAwarePreparePurchaseOk,
    tracked_orders:
      trackedOrderCline?.mcp_source_context === "cline_mcp_marketplace" &&
      trackedOrderCline?.mcp_install_target === "cline" &&
      trackedOrderMcpSo?.mcp_source_context === "mcp_so" &&
      trackedOrderMcpSo?.mcp_install_target === "generic_streamable_http",
    agent_capture:
      agentCapture?.release === "PACKRIFT-ALL-AGENT-CAPTURE-R27" &&
      (agentCapture?.operating_rules ?? []).some(
        (rule) =>
          /OpenAI\/ChatGPT/.test(rule) &&
          /LangChain/.test(rule) &&
          /n8n/.test(rule) &&
          /MCP Inspector/.test(rule) &&
          /Goose/.test(rule) &&
          /major MCP directories/.test(rule)
      ),
    runtime_source_inference:
      marketplaceManifest?.signals?.runtime_source_inference_release === "PACKRIFT-MCP-RUNTIME-SOURCE-INFERENCE-R03" &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_count >= 65 &&
      usageSnapshot?.runtime_source_inference?.release === "PACKRIFT-MCP-RUNTIME-SOURCE-INFERENCE-R03" &&
      usageSnapshot?.runtime_source_inference?.rule_count >= 65 &&
      funnelSnapshot?.runtime_source_inference?.release === "PACKRIFT-MCP-RUNTIME-SOURCE-INFERENCE-R03" &&
      funnelSnapshot?.runtime_source_inference?.rule_count >= 65,
    agent_progress:
      agentAdoptionProgress?.release === "PACKRIFT-MCP-AGENT-ADOPTION-PROGRESS-R02" &&
      agentAdoptionProgressHtmlResult.ok,
    agent_host_rollout:
      agentHostRollout?.release === "PACKRIFT-MCP-AGENT-HOST-ROLLOUT-R02" &&
      agentHostRollout?.activation_queue?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      Number(agentHostRollout?.priority_source_count ?? 0) >= 10 &&
      agentHostRolloutMcpSo?.buyer_handoff_url === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
      ["mcp_first_run_execution", "mcp_tool_call", "mcp_cart_landing", "mcp_attributed_order"].includes(agentHostRolloutMcpSo?.target_event_to_watch) &&
      agentHostRolloutGlama?.activation_priority === "critical" &&
      ["real_mcp_tool_call_needed", "cart_landing_needed", "buyer_checkout_needed"].includes(agentHostRolloutGlama?.activation_status) &&
      typeof agentHostRolloutGlama?.current_counts?.mcp_tool_calls === "number",
    commerce_hold_guard:
      cartHandoffExcludesHeldSkus &&
      measuredHandoffsExcludeHeldSkus &&
      purchasePathsExcludeHeldSkus &&
      heldSkuPagesAvoidCartUrls &&
      cartHandoffHoldPolicyOk,
    cart_handoff:
      firstCartUrl.startsWith("https://mcp.packrift.com/r/cart/") &&
      firstFinalCartUrl.startsWith("https://packrift.com/cart/") &&
      hasAll(firstCartUrl, ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url", "qty=1"]) &&
      hasAll(firstFinalCartUrl, ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url"]),
    mcp_page_analytics: mcpPageAnalyticsOk,
    required_core_resource_uris_missing: requiredCoreResourceUris.filter((uri) => !resourceUris.has(uri)),
  };
  return check(
    "live_mcp_surface",
    health?.version === EXPECTED_VERSION &&
      health?.resources_count >= 68 &&
      health?.tools_count >= 15 &&
      serverCard?.serverInfo?.name === "Packrift MCP" &&
      serverCard?.authentication?.required === false &&
      serverCard?.endpoint_url === MCP_ENDPOINT &&
      serverCard?.client_config?.root_mcp_json === "https://mcp.packrift.com/mcp.json" &&
      serverCard?.client_config?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      serverCard?.client_config?.tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      serverCard?.client_config?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      serverCard?.client_config?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      serverCard?.registry_distribution?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      serverCard?.registry_distribution?.tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      serverCard?.registry_distribution?.reviewer_activation === "https://mcp.packrift.com/ai/mcp-reviewer-activation.json" &&
      serverCard?.registry_distribution?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      serverCard?.registry_distribution?.source_activation_queue_html === "https://mcp.packrift.com/ai/mcp-source-activation-queue.html" &&
      serverCard?.registry_distribution?.revenue_conversion_queue === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      serverCard?.registry_distribution?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      serverCard?.registry_distribution?.buyer_order_handoffs === MCP_BUYER_ORDER_HANDOFFS_JSON_URL &&
      serverCard?.registry_distribution?.buyer_order_handoffs_html === MCP_BUYER_ORDER_HANDOFFS_HTML_URL &&
      serverCard?.registry_distribution?.source_activation_sitemap === "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml" &&
      serverCard?.registry_distribution?.activation_experiments === "https://mcp.packrift.com/ai/mcp-activation-experiments.json" &&
      serverCard?.registry_distribution?.activation_experiments_html === "https://mcp.packrift.com/ai/mcp-activation-experiments.html" &&
      serverCard?.registry_distribution?.activation_wave === "https://mcp.packrift.com/ai/mcp-activation-wave.json" &&
      serverCard?.registry_distribution?.activation_wave_html === "https://mcp.packrift.com/ai/mcp-activation-wave.html" &&
      serverCard?.registry_distribution?.activation_wave_tasks_jsonl === MCP_ACTIVATION_WAVE_TASKS_JSONL_URL &&
      serverCard?.registry_distribution?.activation_wave_tasks_csv === MCP_ACTIVATION_WAVE_TASKS_CSV_URL &&
      serverCard?.registry_distribution?.activation_wave_runner_shell === MCP_ACTIVATION_WAVE_RUNNER_URL &&
      serverCard?.registry_distribution?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      serverCard?.registry_distribution?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      serverCard?.registry_distribution?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      serverCard?.registry_distribution?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      serverCard?.registry_distribution?.external_activation_brief_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      serverCard?.registry_distribution?.automation_workflows === MCP_AUTOMATION_WORKFLOWS_JSON_URL &&
      serverCard?.registry_distribution?.automation_workflows_html === MCP_AUTOMATION_WORKFLOWS_HTML_URL &&
      serverCard?.registry_distribution?.n8n_workflow_import === MCP_N8N_WORKFLOW_JSON_URL &&
      serverCard?.registry_distribution?.activation_command_center === "https://mcp.packrift.com/r/activate" &&
      serverCard?.registry_distribution?.tracked_reviewer_activation_template === "https://mcp.packrift.com/r/activate/{source}" &&
      serverCard?.registry_distribution?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      serverCard?.registry_distribution?.tracked_reviewer_activation_html_generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      serverCard?.registry_distribution?.tracked_reviewer_activation_shell_template === "https://mcp.packrift.com/r/activate/{source}?format=sh" &&
      serverCard?.registry_distribution?.tracked_reviewer_activation_shell_generic === "https://mcp.packrift.com/r/activate/generic?format=sh" &&
      serverCard?.resource_links?.openaiStrictPublicProductFeedTsv === OPENAI_STRICT_PUBLIC_PRODUCT_FEED_TSV_URL &&
      serverCard?.resource_links?.openaiPreferredDirectProductFeedTsv === OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_TSV_URL &&
      serverCard?.resource_links?.openaiPreferredDirectProductFeedGzip === OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_GZIP_URL &&
      serverCard?.resource_links?.mcpRevenueConversionQueueJson === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      serverCard?.resource_links?.mcpRevenueConversionQueueHtml === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      serverCard?.resource_links?.mcpBuyerOrderHandoffsJson === MCP_BUYER_ORDER_HANDOFFS_JSON_URL &&
      serverCard?.resource_links?.mcpBuyerOrderHandoffsMarkdown === MCP_BUYER_ORDER_HANDOFFS_MARKDOWN_URL &&
      serverCard?.resource_links?.mcpBuyerOrderHandoffsHtml === MCP_BUYER_ORDER_HANDOFFS_HTML_URL &&
      serverCard?.resource_links?.mcpActivationWaveRunnerShell === MCP_ACTIVATION_WAVE_RUNNER_URL &&
      serverCard?.resource_links?.mcpActivationWaveTasksJsonl === MCP_ACTIVATION_WAVE_TASKS_JSONL_URL &&
      serverCard?.resource_links?.mcpActivationWaveTasksCsv === MCP_ACTIVATION_WAVE_TASKS_CSV_URL &&
      serverCard?.resource_links?.mcpExternalActivationBriefJson === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      serverCard?.resource_links?.mcpExternalActivationBriefHtml === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      serverCard?.resource_links?.mcpExternalActivationBriefTasksJsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      serverCard?.resource_links?.mcpExternalActivationBriefTasksCsv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      serverCard?.resource_links?.mcpExternalActivationBriefRunnerShell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      Array.isArray(serverCard?.tools) &&
      serverCard.tools.length >= 15 &&
      serverCard.tools.some((tool) => tool?.name === "create_cart_url" && tool?.inputSchema) &&
      serverCard.tools.some((tool) => tool?.name === "prepare_purchase_handoff" && tool?.inputSchema) &&
      serverCard?.tool_discovery?.json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      serverCard?.tool_discovery?.markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      Array.isArray(serverCard?.resources) &&
      serverCard.resources.length >= 68 &&
      Array.isArray(serverCard?.prompts) &&
      serverCard.prompts.length >= 7 &&
      Array.isArray(serverCard?.tool_names) &&
      serverCard.tool_names.includes("create_cart_url") &&
      toolNames.length >= 15 &&
      toolNames.includes("create_cart_url") &&
      toolNames.includes("get_cart_handoff_candidates") &&
      toolNames.includes("prepare_purchase_handoff") &&
      preparePurchaseTool?.inputSchema?.properties?.mcp_source_context &&
      preparePurchaseTool?.inputSchema?.properties?.mcp_install_target &&
      sourceAwarePreparePurchaseOk &&
      resourcesCount >= 68 &&
      resourceUris.has("https://mcp.packrift.com/r/run/mcp_so/generic_streamable_http?format=sh") &&
      resourceUris.has("https://mcp.packrift.com/r/run/browse_sh/codex?format=md") &&
      resourceUris.has("https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=sh") &&
      resourceUris.has("https://mcp.packrift.com/r/order/mcp_so?format=md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-source-activation/cline_mcp_marketplace.md") &&
      resourceUris.has("https://mcp.packrift.com/r/config/anthropic_connectors_directory") &&
      resourceTemplatesResult.ok &&
      resourceTemplateUris.has("https://mcp.packrift.com/ai/mcp-source-activation/{source}.json") &&
      resourceTemplateUris.has("https://mcp.packrift.com/r/run/{source}/{target}") &&
      resourceTemplateUris.has("https://mcp.packrift.com/r/run/{source}/{target}?format=sh") &&
      resourceTemplateUris.has("https://mcp.packrift.com/r/run/{source}/{target}?execute=1&format=json") &&
      resourceTemplateUris.has("https://mcp.packrift.com/r/activate/{source}?format=sh") &&
      resourceTemplateUris.has("https://mcp.packrift.com/r/order/{source}") &&
      sourceRunResourceShellResult.ok &&
      sourceRunResourceShellText.includes("mcp_so") &&
      sourceRunResourceShellText.includes("create_cart_url") &&
      sourceRunResourceMarkdownResult.ok &&
      sourceRunResourceMarkdownText.includes("browse_sh") &&
      sourceRunResourceMarkdownText.includes("codex") &&
      sourceActivateResourceShellResult.ok &&
      sourceActivateResourceShellText.includes("cline_mcp_marketplace") &&
      sourceActivateResourceShellText.includes("create_cart_url") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-funnel-snapshot.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-funnel-snapshot.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-activation-experiments.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-activation-experiments.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-activation-experiments.html") &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_JSON_URL) &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_MARKDOWN_URL) &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_HTML_URL) &&
      resourceUris.has(MCP_BUYER_ORDER_HANDOFFS_JSON_URL) &&
      resourceUris.has(MCP_BUYER_ORDER_HANDOFFS_MARKDOWN_URL) &&
      resourceUris.has(MCP_BUYER_ORDER_HANDOFFS_HTML_URL) &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-activation-wave.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-activation-wave.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-activation-wave.html") &&
      resourceUris.has(MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL) &&
      resourceUris.has(MCP_EXTERNAL_ACTIVATION_BRIEF_MARKDOWN_URL) &&
      resourceUris.has(MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL) &&
      resourceUris.has(MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL) &&
      resourceUris.has(MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL) &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_JSON_URL) &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_MARKDOWN_URL) &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_HTML_URL) &&
      resourceUris.has(MCP_AUTOMATION_WORKFLOWS_JSON_URL) &&
      resourceUris.has(MCP_AUTOMATION_WORKFLOWS_MARKDOWN_URL) &&
      resourceUris.has(MCP_AUTOMATION_WORKFLOWS_HTML_URL) &&
      resourceUris.has(MCP_N8N_WORKFLOW_JSON_URL) &&
      resourceUris.has(OPENAI_STRICT_PUBLIC_PRODUCT_FEED_TSV_URL) &&
      resourceUris.has(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_TSV_URL) &&
      resourceUris.has(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_IMMUTABLE_TSV_URL) &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-actions.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-actions.md") &&
      promptsCount >= 7 &&
      cart?.release === "PACKRIFT-MCP-CART-HANDOFF-CANDIDATES-R04" &&
      cart?.items?.length >= 50 &&
      cart?.items?.[0]?.cart_url_candidate_type === "mcp_cart_landing_redirect" &&
      start?.release === "PACKRIFT-MCP-START-R15" &&
      start?.canonical_endpoint === MCP_ENDPOINT &&
      start?.first_flow?.length >= 6 &&
      start?.first_flow?.some((step) => step?.request?.params?.name === "create_cart_url") &&
      start?.first_useful_run?.endpoint?.startsWith(`${MCP_ENDPOINT}?`) &&
      start?.first_useful_run?.sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      start?.first_useful_run?.curl_script?.includes("curl -sS") &&
      start?.first_useful_run?.curl_script?.includes("create_cart_url") &&
      start?.first_useful_run?.agent_prompt?.includes("create_cart_url") &&
      start?.first_useful_run?.curl_commands?.length >= 5 &&
      start?.external_activation_handoff?.status === "selected_contact_ready_runs_available" &&
      start?.external_activation_handoff?.selected_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      start?.external_activation_handoff?.selected_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      start?.external_activation_handoff?.brief_json === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      start?.external_activation_handoff?.brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      start?.external_activation_handoff?.guarded_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      start?.external_activation_handoff?.success_gate?.includes("real external MCP host") &&
      start?.external_activation_handoff?.no_duplicate_work_rule?.includes("Do not build a separate Packrift CLI") &&
      marketplaceManifest?.mcp_server?.tools?.length >= 15 &&
      marketplaceManifest?.mcp_server?.tools?.some((tool) => tool?.name === "prepare_purchase_handoff") &&
      marketplaceManifest?.signals?.tool_count >= 15 &&
      marketplaceManifest?.signals?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      marketplaceManifest?.signals?.tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      marketplaceManifest?.signals?.tool_names?.includes("prepare_purchase_handoff") &&
      marketplaceManifest?.signals?.required_current_tools?.length >= 15 &&
      mcpToolsDiscoveryResult.ok &&
      mcpToolsDiscovery?.release === "PACKRIFT-MCP-TOOL-DISCOVERY-R01" &&
      mcpToolsDiscovery?.generated_from === "live_worker_tools_registry" &&
      mcpToolsDiscovery?.endpoint === MCP_ENDPOINT &&
      mcpToolsDiscovery?.auth_required === false &&
      mcpToolsDiscovery?.tool_count >= 15 &&
      mcpToolsDiscoveryToolNames.length >= 15 &&
      mcpToolsDiscoveryToolNames.includes("prepare_purchase_handoff") &&
      mcpToolsDiscoveryToolNames.includes("compare_alternatives") &&
      mcpToolsDiscoveryToolNames.includes("pack_calculator") &&
      mcpToolsDiscoveryToolNames.includes("inventory_status") &&
      mcpToolsDiscoveryToolNames.includes("create_cart_url") &&
      mcpToolsDiscovery?.conversion_urls?.source_activation_sitemap === "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml" &&
      mcpToolsDiscovery?.conversion_urls?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      mcpToolsDiscovery?.conversion_urls?.revenue_conversion_queue === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      mcpToolsDiscovery?.conversion_urls?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      mcpToolsDiscovery?.conversion_urls?.buyer_order_handoffs === MCP_BUYER_ORDER_HANDOFFS_JSON_URL &&
      mcpToolsDiscovery?.conversion_urls?.buyer_order_handoffs_html === MCP_BUYER_ORDER_HANDOFFS_HTML_URL &&
      mcpToolsDiscovery?.conversion_urls?.activation_wave === "https://mcp.packrift.com/ai/mcp-activation-wave.json" &&
      mcpToolsDiscovery?.conversion_urls?.activation_wave_html === "https://mcp.packrift.com/ai/mcp-activation-wave.html" &&
      mcpToolsDiscovery?.conversion_urls?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      mcpToolsDiscovery?.conversion_urls?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      mcpToolsDiscovery?.conversion_urls?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      mcpToolsDiscovery?.conversion_urls?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      mcpToolsDiscovery?.conversion_urls?.automation_workflows === MCP_AUTOMATION_WORKFLOWS_JSON_URL &&
      mcpToolsDiscovery?.conversion_urls?.automation_workflows_html === MCP_AUTOMATION_WORKFLOWS_HTML_URL &&
      mcpToolsDiscovery?.conversion_urls?.n8n_workflow_import === MCP_N8N_WORKFLOW_JSON_URL &&
      mcpToolsDiscovery?.conversion_urls?.eval_pack === "https://mcp.packrift.com/ai/mcp-eval-pack.json" &&
      mcpToolsDiscovery?.conversion_urls?.eval_pack_template === "https://mcp.packrift.com/ai/mcp-eval-pack.json?source={source}" &&
      mcpToolsDiscovery?.conversion_urls?.directory_update_card_template === "https://mcp.packrift.com/ai/mcp-directory-update/{source}.json" &&
      mcpToolsDiscovery?.conversion_urls?.reviewer_activation_shell_template === "https://mcp.packrift.com/r/activate/{source}?format=sh" &&
      mcpToolsDiscovery?.source_activation?.source_count >= 40 &&
      mcpToolsDiscovery?.source_activation?.sources?.includes("codex_remote_mcp") &&
      mcpToolsDiscovery?.source_activation?.sources?.includes("claude_remote_mcp") &&
      mcpToolsDiscovery?.source_activation?.sources?.includes("openai_chatgpt") &&
      mcpToolsDiscovery?.source_activation?.sources?.includes("langchain_agent") &&
      mcpToolsDiscovery?.source_activation?.sources?.includes("n8n_automation") &&
      mcpToolsDiscovery?.source_activation?.sources?.includes("mcp_inspector") &&
      mcpToolsDiscovery?.source_activation?.sitemap_url_count >= 500 &&
      specFinderToolsResult.ok &&
      specFinderToolsResult.text.includes("prepare_purchase_handoff") &&
      specFinderToolsResult.text.includes("compare_alternatives") &&
      specFinderToolsResult.text.includes("pack_calculator") &&
      specFinderToolsResult.text.includes("inventory_status") &&
      specFinderToolsResult.text.includes("create_cart_url") &&
      specFinderToolsResult.text.includes("https://mcp.packrift.com/ai/mcp-eval-pack.json") &&
      specFinderToolsResult.text.includes("https://mcp.packrift.com/ai/mcp-source-activation-queue.json") &&
      specFinderToolsResult.text.includes(MCP_REVENUE_CONVERSION_QUEUE_JSON_URL) &&
      specFinderToolsResult.text.includes(MCP_BUYER_ORDER_HANDOFFS_JSON_URL) &&
      specFinderToolsResult.text.includes("https://mcp.packrift.com/ai/mcp-activation-wave.json") &&
      specFinderToolsResult.text.includes(MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL) &&
      specFinderToolsResult.text.includes("https://mcp.packrift.com/r/activate/{source}?format=sh") &&
      strictPublicProductFeedOk &&
      preferredDirectProductFeedOk &&
      preferredDirectProductFeedGzipOk &&
      preferredDirectProductFeedImmutableOk &&
      preferredDirectProductFeedImmutableGzipOk &&
      marketplaceManifest?.signals?.runtime_source_inference_release === "PACKRIFT-MCP-RUNTIME-SOURCE-INFERENCE-R03" &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_count >= 65 &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_families?.some((rule) => rule?.source_slug === "openai_chatgpt") &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_families?.some((rule) => rule?.source_slug === "langchain_agent") &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_families?.some((rule) => rule?.source_slug === "n8n_automation") &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_families?.some((rule) => rule?.source_slug === "mcp_inspector") &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_families?.some((rule) => rule?.source_slug === "goose_agent") &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_families?.some((rule) => rule?.source_slug === "sourcegraph_cody") &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_families?.some((rule) => rule?.source_slug === "official_registry") &&
      marketplaceManifest?.signals?.runtime_source_inference_rule_families?.some((rule) => rule?.source_slug === "mcpservers_org") &&
      marketplaceManifest?.discovery?.source_activation_sitemap === "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml" &&
      marketplaceManifest?.discovery?.mcp_first_run_actions === "https://mcp.packrift.com/ai/mcp-first-run-actions.json" &&
      marketplaceManifest?.discovery?.mcp_tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      marketplaceManifest?.discovery?.mcp_tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      marketplaceManifest?.discovery?.tracked_start_template === "https://mcp.packrift.com/r/start/{source}" &&
      marketplaceManifest?.discovery?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      marketplaceManifest?.discovery?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      marketplaceManifest?.discovery?.tracked_run_codex_generic === "https://mcp.packrift.com/r/run/generic/codex" &&
      marketplaceManifest?.discovery?.mcp_external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      marketplaceManifest?.discovery?.mcp_external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      marketplaceManifest?.discovery?.tracked_reviewer_activation_shell_template === "https://mcp.packrift.com/r/activate/{source}?format=sh" &&
      marketplaceManifest?.discovery?.tracked_reviewer_activation_shell_generic === "https://mcp.packrift.com/r/activate/generic?format=sh" &&
      llmsTxtResult.ok &&
      llmsTxtResult.text.includes("https://mcp.packrift.com/r/install/{source}/{target}") &&
      llmsTxtResult.text.includes("https://mcp.packrift.com/r/run/{source}/{target}") &&
      llmsTxtResult.text.includes("https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml") &&
      llmsTxtResult.text.includes("https://mcp.packrift.com/r/activate/{source}?format=sh") &&
      llmsTxtResult.text.includes(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_TSV_URL) &&
      llmsTxtResult.text.includes(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_GZIP_URL) &&
      llmsFullTxtResult.ok &&
      llmsFullTxtResult.text.includes("Tracked MCP first-run template: https://mcp.packrift.com/r/run/{source}/{target}") &&
      llmsFullTxtResult.text.includes("MCP source activation sitemap: https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml") &&
      llmsFullTxtResult.text.includes("Tracked reviewer activation shell template: https://mcp.packrift.com/r/activate/{source}?format=sh") &&
      llmsFullTxtResult.text.includes(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_TSV_URL) &&
      llmsFullTxtResult.text.includes(OPENAI_PREFERRED_DIRECT_PRODUCT_FEED_GZIP_URL) &&
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
      start?.start_urls?.tracked_install_examples?.cline_mcp_marketplace?.cline?.startsWith("https://mcp.packrift.com/r/install/cline_mcp_marketplace/cline") &&
      start?.start_urls?.tracked_run_examples?.mcpfinder?.startsWith("https://mcp.packrift.com/r/run/mcpfinder/generic_streamable_http") &&
      start?.proof_urls?.usage_snapshot === "https://mcp.packrift.com/ai/mcp-usage-snapshot.json" &&
      start?.proof_urls?.install_actions === "https://mcp.packrift.com/ai/mcp-install-actions.json" &&
      start?.proof_urls?.first_run_actions === "https://mcp.packrift.com/ai/mcp-first-run-actions.json" &&
      start?.proof_urls?.client_config === "https://mcp.packrift.com/ai/mcp-client-config.json" &&
      start?.proof_urls?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      start?.proof_urls?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      start?.proof_urls?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      start?.proof_urls?.external_activation_selected_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      start?.proof_urls?.external_activation_selected_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      start?.proof_urls?.external_activation_selected_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      start?.operating_rules?.some((rule) => rule.includes("selected external activation JSONL/CSV task feed")) &&
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
      trackedStartHtmlPartnerResult.text.includes("https://mcp.packrift.com/r/install/partner_demo/cline") &&
      trackedStartHtmlPartnerResult.text.includes("https://mcp.packrift.com/r/run/partner_demo/generic_streamable_http") &&
      trackedStartHtmlPartnerResult.text.includes("https://mcp.packrift.com/r/activate/partner_demo?format=html") &&
      trackedStartHtmlPartnerResult.text.includes(MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL) &&
      trackedStartHtmlPartnerResult.text.includes(MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL) &&
      trackedStartHtmlPartnerResult.text.includes("External Activation") &&
      trackedStartHtmlPartnerResult.text.includes("packrift_mcp_target=generic_streamable_http") &&
      trackedStartHtmlPartnerResult.text.includes("packrift_mcp_target=claude_code") &&
      trackedStartHtmlPartnerResult.text.includes("packrift_mcp_target=codex") &&
      trackedStartHtmlPartnerResult.text.includes("Activation runner") &&
      trackedStartHtmlPartnerResult.text.includes("Tracked Cline install") &&
      trackedStartHtmlPartnerResult.text.includes("install cline: partner demo") &&
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
      invalidInstallTarget?.valid_targets?.includes("stdio_mcp_remote") &&
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
      trackedFirstRunGenericResult.text.includes("mcp_source_context") &&
      trackedFirstRunGenericResult.text.includes("mcp_install_target") &&
      trackedFirstRunGenericResult.text.includes("MCP-First-Run/1.1") &&
      trackedFirstRunHtmlResult.ok &&
      trackedFirstRunHtmlResult.text.includes("Packrift MCP First Run") &&
      trackedFirstRunHtmlResult.text.includes("Run live proof") &&
      trackedFirstRunHtmlResult.text.includes("create_cart_url") &&
      trackedFirstRunHtmlResult.text.includes("Shell One-Liner") &&
      trackedFirstRunExecuteResult.ok &&
      trackedFirstRunExecute?.release === "PACKRIFT-MCP-FIRST-RUN-ACTION-R08" &&
      trackedFirstRunExecute?.status === "ok" &&
      trackedFirstRunExecute?.sku === "1066" &&
      trackedFirstRunExecute?.cart?.url?.startsWith("https://mcp.packrift.com/r/cart/1066") &&
      trackedFirstRunExecute?.cart?.url?.includes("mcp_handoff_id=") &&
      trackedFirstRunExecute?.no_order_created === true &&
      agentCapture?.release === "PACKRIFT-ALL-AGENT-CAPTURE-R27" &&
      agentCapture?.surfaces?.length >= 22 &&
      agentCapture?.agent_host_fast_paths_release === "PACKRIFT-AGENT-HOST-FAST-PATHS-R01" &&
      agentCapture?.counts?.agent_host_fast_paths >= 12 &&
      agentCapture?.agent_host_fast_paths?.some(
        (row) =>
          row.source === "cline_mcp_marketplace" &&
          row.target === "cline" &&
          row.source_aware_endpoint?.includes("packrift_mcp_source=cline_mcp_marketplace") &&
          row.tracked_first_run_shell_url === "https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline?format=sh"
      ) &&
      agentCapture?.agent_host_fast_paths?.some(
        (row) =>
          row.source === "browse_sh" &&
          row.source_aware_endpoint === "https://mcp.packrift.com/mcp?packrift_mcp_source=browse_sh&packrift_mcp_target=generic_streamable_http"
      ) &&
      agentCapture?.agent_host_fast_paths?.some((row) => row.source === "mcp_so" && /order|revenue/i.test(row.success_gate ?? "")) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_start" && surface.canonical_url === "https://mcp.packrift.com/start" && surface.install_or_call?.includes("/r/start/{source}")) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_agent_host_rollout" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-agent-host-rollout.json") &&
      agentCapture?.hub_urls?.agent_host_rollout === "https://mcp.packrift.com/ai/mcp-agent-host-rollout.json" &&
      agentHostRollout?.release === "PACKRIFT-MCP-AGENT-HOST-ROLLOUT-R02" &&
      agentHostRollout?.source_count >= 35 &&
      agentHostRollout?.activation_queue?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      agentHostRollout?.activation_queue?.status === "activation_needed" &&
      agentHostRollout?.activation_queue?.blocking_goal_gates?.includes("material_tool_usage_50_plus") &&
      typeof agentHostRollout?.activation_queue?.source_snapshot?.external_qualified_mcp_tool_calls === "number" &&
      Number(agentHostRollout?.priority_source_count ?? 0) >= 10 &&
      agentHostRollout?.rows?.some((row) => row.source === "openai_chatgpt" && row.source_aware_endpoint?.includes("packrift_mcp_source=openai_chatgpt")) &&
      agentHostRollout?.rows?.some((row) => row.source === "langchain_agent" && row.tracked_first_run_shell_url?.includes("/r/run/langchain_agent/")) &&
      agentHostRollout?.rows?.some((row) => row.source === "n8n_automation" && row.reviewer_activation_shell_url === "https://mcp.packrift.com/r/activate/n8n_automation?format=sh") &&
      agentHostRollout?.rows?.some(
        (row) =>
          row.source === "mcp_so" &&
          row.buyer_handoff_url === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
          ["mcp_first_run_execution", "mcp_tool_call", "mcp_cart_landing", "mcp_attributed_order"].includes(row.target_event_to_watch) &&
          typeof row.current_counts?.first_run_actions === "number"
      ) &&
      agentHostRollout?.rows?.some(
        (row) =>
          row.source === "glama_connector" &&
          row.activation_priority === "critical" &&
          ["real_mcp_tool_call_needed", "cart_landing_needed", "buyer_checkout_needed"].includes(row.activation_status) &&
          typeof row.current_counts?.mcp_tool_calls === "number" &&
          (
            row.primary_action_url?.startsWith("https://mcp.packrift.com/r/activate/glama_connector") ||
            row.primary_action_url?.startsWith("https://mcp.packrift.com/r/cart/") ||
            row.buyer_handoff_url === "https://mcp.packrift.com/r/order/glama_connector?format=html"
          )
      ) &&
      agentCapture?.surfaces?.some(
        (surface) =>
          surface.id === "mcp_install_actions" &&
          surface.canonical_url === "https://mcp.packrift.com/ai/mcp-install-actions.json" &&
          surface.install_or_call?.includes("stdio_mcp_remote")
      ) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_first_run_actions" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-first-run-actions.json" && surface.install_or_call?.includes("/r/run/{source}/{target}")) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_reviewer_activation" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-reviewer-activation.json" && surface.install_or_call?.includes("/r/activate/{source}?format=html")) &&
      agentCapture?.hub_urls?.tracked_reviewer_activation_runner_generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      agentCapture?.hub_urls?.tracked_reviewer_activation_shell_runner_generic === "https://mcp.packrift.com/r/activate/generic?format=sh" &&
      agentCapture?.hub_urls?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      agentCapture?.hub_urls?.source_activation_queue_html === "https://mcp.packrift.com/ai/mcp-source-activation-queue.html" &&
      agentCapture?.hub_urls?.revenue_conversion_queue === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      agentCapture?.hub_urls?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      agentCapture?.hub_urls?.buyer_order_handoffs === MCP_BUYER_ORDER_HANDOFFS_JSON_URL &&
      agentCapture?.hub_urls?.buyer_order_handoffs_html === MCP_BUYER_ORDER_HANDOFFS_HTML_URL &&
      agentCapture?.hub_urls?.activation_experiments === "https://mcp.packrift.com/ai/mcp-activation-experiments.json" &&
      agentCapture?.hub_urls?.activation_experiments_html === "https://mcp.packrift.com/ai/mcp-activation-experiments.html" &&
      agentCapture?.hub_urls?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      agentCapture?.hub_urls?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      agentCapture?.hub_urls?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      agentCapture?.hub_urls?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      agentCapture?.hub_urls?.external_activation_brief_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      agentCapture?.hub_urls?.ga4_funnel_proof === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json" &&
      agentCapture?.hub_urls?.activation_command_center === "https://mcp.packrift.com/r/activate" &&
      agentCapture?.hub_urls?.eval_pack === "https://mcp.packrift.com/ai/mcp-eval-pack.json" &&
      agentCapture?.hub_urls?.automation_workflows === MCP_AUTOMATION_WORKFLOWS_JSON_URL &&
      agentCapture?.hub_urls?.n8n_workflow_import === MCP_N8N_WORKFLOW_JSON_URL &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_client_config" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-client-config.json") &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_funnel_snapshot" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json") &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_ga4_funnel_proof" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json") &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_source_activation_queue" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" && surface.proof_url === "https://mcp.packrift.com/ai/mcp-source-activation-queue.html") &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_revenue_conversion_queue" && surface.canonical_url === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL && surface.proof_url === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL && surface.install_or_call?.includes("source-preserving buyer/reviewer handoff")) &&
      agentCapture?.surfaces?.some(
        (surface) =>
          surface.id === "mcp_buyer_order_handoffs" &&
          surface.canonical_url === MCP_BUYER_ORDER_HANDOFFS_JSON_URL &&
          surface.proof_url === MCP_BUYER_ORDER_HANDOFFS_HTML_URL &&
          surface.install_or_call?.includes("never places an order")
      ) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_activation_experiments" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-activation-experiments.json" && surface.proof_url === "https://mcp.packrift.com/ai/mcp-activation-experiments.html") &&
      agentCapture?.surfaces?.some(
        (surface) =>
          surface.id === "mcp_external_activation_brief" &&
          surface.canonical_url === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
          surface.proof_url === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
          surface.install_or_call?.includes("create_cart_url") &&
          surface.install_or_call?.includes("https://mcp.packrift.com/mcp")
      ) &&
      agentCapture?.surfaces?.some(
        (surface) =>
          surface.id === "mcp_automation_workflows" &&
          surface.canonical_url === MCP_AUTOMATION_WORKFLOWS_JSON_URL &&
          surface.install_or_call?.includes("n8n workflow JSON") &&
          surface.install_or_call?.includes("create_cart_url")
      ) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "mcp_eval_pack" && surface.canonical_url === "https://mcp.packrift.com/ai/mcp-eval-pack.json" && surface.install_or_call?.includes("create_cart_url")) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "claude_desktop_and_claude_code" && surface.install_or_call?.includes("packrift_mcp_source=claude_remote_mcp")) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "cursor_windsurf_vscode" && surface.install_or_call?.includes("packrift_mcp_source=cursor_directory")) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "codex_remote_mcp" && surface.install_or_call?.includes("packrift_mcp_source=codex_remote_mcp")) &&
      agentCapture?.surfaces?.some((surface) => surface.id === "browserbase_browse_candidate" && surface.install_or_call?.includes("packrift_mcp_source=browse_sh")) &&
      agentCapture?.surfaces?.some(
        (surface) =>
          surface.id === "agent_capture_outreach_packet" &&
          surface.canonical_url === "https://mcp.packrift.com/ai/agent-capture-outreach.json" &&
          surface.proof_url === "https://mcp.packrift.com/ai/agent-capture-outreach.html"
      ) &&
      adoptionKit?.release === "PACKRIFT-MCP-ADOPTION-KIT-R11" &&
      adoptionKit?.first_five_minutes?.length >= 6 &&
      adoptionKit?.developer_examples?.length >= 4 &&
      adoptionKit?.developer_examples?.some((example) => example.id === "curl-tools-list" && example.code?.includes("accept: application/json, text/event-stream")) &&
      adoptionKit?.developer_examples?.some((example) => example.id === "javascript-first-flow" && example.code?.includes("parseMcpPayload")) &&
      adoptionKit?.developer_examples?.some((example) => example.id === "python-first-flow" && example.code?.includes("parse_mcp_payload")) &&
      adoptionKit?.developer_share_pack?.shareable_source_links?.length >= 8 &&
      adoptionKit?.developer_share_pack?.shareable_source_links?.some(
        (link) =>
          link.source === "cline_mcp_marketplace" &&
          link.preferred_target === "cline" &&
          link.tracked_first_run_urls?.preferred_shell?.includes("/r/run/cline_mcp_marketplace/cline")
      ) &&
      adoptionKit?.developer_share_pack?.shareable_source_links?.every((link) => link.reviewer_activation_runner?.includes("/r/activate/")) &&
      adoptionKit?.developer_share_pack?.shareable_source_links?.every((link) => link.one_command_external_runner?.includes("format=sh")) &&
      adoptionKit?.developer_share_pack?.activation_wave === MCP_ACTIVATION_WAVE_JSON_URL &&
      adoptionKit?.developer_share_pack?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      adoptionKit?.developer_share_pack?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      adoptionKit?.developer_share_pack?.external_activation_selected_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      adoptionKit?.developer_share_pack?.external_activation_selected_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      adoptionKit?.developer_share_pack?.external_activation_selected_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      adoptionKit?.developer_share_pack?.external_activation_success_gate?.includes("real external MCP host") &&
      adoptionKit?.install?.reviewer_activation_runner_generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      adoptionKit?.install?.activation_wave === MCP_ACTIVATION_WAVE_JSON_URL &&
      adoptionKit?.install?.activation_wave_html === MCP_ACTIVATION_WAVE_HTML_URL &&
      adoptionKit?.install?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      adoptionKit?.install?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      adoptionKit?.install?.external_activation_selected_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      adoptionKit?.install?.external_activation_selected_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      adoptionKit?.install?.external_activation_selected_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      adoptionKit?.proof_urls?.eval_pack === "https://mcp.packrift.com/ai/mcp-eval-pack.json" &&
      adoptionKit?.install?.stdio_mcp_remote?.mcpServers?.packrift?.command === "npx" &&
      adoptionKit?.install?.stdio_mcp_remote?.mcpServers?.packrift?.args?.includes("mcp-remote") &&
      adoptionKit?.install?.stdio_mcp_remote?.mcpServers?.packrift?.args?.includes(MCP_ENDPOINT) &&
      adoptionKit?.install?.stdio_mcp_remote_command === `npx -y mcp-remote ${MCP_ENDPOINT}` &&
      adoptionKit?.install?.cline?.mcpServers?.packrift?.type === "streamableHttp" &&
      adoptionKit?.install?.cline?.mcpServers?.packrift?.url === MCP_ENDPOINT &&
      adoptionKit?.proof_urls?.reviewer_activation_runner_generic === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      adoptionKit?.proof_urls?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      adoptionKit?.proof_urls?.activation_wave === MCP_ACTIVATION_WAVE_JSON_URL &&
      adoptionKit?.proof_urls?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      adoptionKit?.proof_urls?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      adoptionKit?.proof_urls?.external_activation_selected_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      adoptionKit?.proof_urls?.external_activation_selected_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      adoptionKit?.proof_urls?.external_activation_selected_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      adoptionKit?.expected_first_flow_outcomes?.some((outcome) => outcome.includes("https://mcp.packrift.com/r/cart/")) &&
      adoptionKit?.expected_first_flow_outcomes?.some((outcome) => outcome.includes("external_activation_selected_tasks_jsonl")) &&
      adoptionKit?.rules?.some((rule) => rule.includes("selected external activation task feed")) &&
      installMatrix?.release === "PACKRIFT-MCP-INSTALL-MATRIX-R09" &&
      installMatrix?.hosts?.length >= 8 &&
      installMatrix?.hosts?.some(
        (host) =>
          host.id === "stdio_mcp_remote" &&
          host.preferred === true &&
          host.install?.mcpServers?.packrift?.command === "npx" &&
          host.install?.mcpServers?.packrift?.args?.includes("mcp-remote") &&
          host.install?.mcpServers?.packrift?.args?.includes(MCP_ENDPOINT)
      ) &&
      installMatrix?.hosts?.some((host) => host.id === "cline" && host.preferred === true) &&
      installMatrix?.hosts?.some((host) => host.id === "cline" && host.install?.mcpServers?.packrift?.type === "streamableHttp") &&
      installMatrix?.hosts?.some((host) => host.id === "cline" && host.install?.mcpServers?.packrift?.url === MCP_ENDPOINT) &&
      installMatrix?.smoke_tests?.length >= 6 &&
      installMatrix?.smoke_tests?.some((test) => test.id === "cart-1066" && test.request?.params?.name === "create_cart_url") &&
      installMatrix?.hosts?.filter((host) => host.preferred).every((host) => host.first_test_ids?.includes("cart-1066")) &&
      installMatrix?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      installMatrix?.tracked_install_examples?.codex?.startsWith("https://mcp.packrift.com/r/install/generic/codex") &&
      installMatrix?.tracked_install_examples?.stdio_mcp_remote?.startsWith("https://mcp.packrift.com/r/install/generic/stdio_mcp_remote") &&
      installMatrix?.tracked_install_examples?.cline?.startsWith("https://mcp.packrift.com/r/install/generic/cline") &&
      installMatrix?.runtime_source_attribution?.release === "PACKRIFT-MCP-RUNTIME-SOURCE-INFERENCE-R03" &&
      installMatrix?.runtime_source_attribution?.endpoint_query_params?.includes("packrift_mcp_source") &&
      installMatrix?.runtime_source_attribution?.request_signal_headers_if_supported?.includes("X-MCP-Client-Name") &&
      installMatrix?.runtime_source_attribution?.no_duplicate_work_rule?.includes("Do not create a separate Packrift CLI") &&
      installMatrix?.source_aware_install_examples?.some(
        (example) =>
          example.source === "mcp_so" &&
          example.target === "generic_streamable_http" &&
          example.source_aware_endpoint?.includes("packrift_mcp_source=mcp_so") &&
          example.generic_remote_mcp_json?.mcpServers?.packrift?.url?.includes("packrift_mcp_target=generic_streamable_http") &&
          example.tracked_first_run_shell_url === "https://mcp.packrift.com/r/run/mcp_so/generic_streamable_http?format=sh" &&
          example.order_handoff_url === "https://mcp.packrift.com/r/order/mcp_so?format=html"
      ) &&
      installMatrix?.source_aware_install_examples?.some(
        (example) =>
          example.source === "cline_mcp_marketplace" &&
          example.target === "cline" &&
          example.source_aware_endpoint?.includes("packrift_mcp_source=cline_mcp_marketplace") &&
          example.cline_streamable_http_json?.mcpServers?.packrift?.type === "streamableHttp"
      ) &&
      installMatrix?.source_aware_install_examples?.some(
        (example) =>
          example.source === "glama_connector" &&
          example.target === "glama_connector" &&
          example.client_signal_headers_if_supported?.["X-MCP-Client-Name"] === "glama_connector"
      ) &&
      installMatrix?.proof_urls?.client_config === "https://mcp.packrift.com/ai/mcp-client-config.json" &&
      installMatrix?.proof_urls?.install_actions === "https://mcp.packrift.com/ai/mcp-install-actions.json" &&
      installMatrix?.proof_urls?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      installMatrix?.proof_urls?.activation_wave === MCP_ACTIVATION_WAVE_JSON_URL &&
      installMatrix?.activation_wave?.url === MCP_ACTIVATION_WAVE_JSON_URL &&
      installMatrix?.activation_wave?.no_duplicate_work_rule?.includes("Do not create a Packrift CLI") &&
      installActions?.release === "PACKRIFT-MCP-INSTALL-ACTIONS-R11" &&
      installActions?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      installActions?.targets?.some((target) => target.id === "codex" && target.tracked_install_url?.startsWith("https://mcp.packrift.com/r/install/generic/codex")) &&
      installActions?.targets?.some((target) => target.id === "codex" && target.tracked_install_html_url?.includes("format=html")) &&
      installActions?.targets?.some((target) => target.id === "codex" && target.tracked_run_html_url?.startsWith("https://mcp.packrift.com/r/run/generic/codex")) &&
      installActions?.targets?.some((target) => target.id === "codex" && target.tracked_run_shell_url?.startsWith("https://mcp.packrift.com/r/run/generic/codex") && target.shell_one_liner?.includes("format=sh")) &&
      installActions?.targets?.some((target) => target.id === "codex" && target.source_aware_endpoint?.includes("packrift_mcp_source=generic")) &&
      installActions?.targets?.some(
        (target) =>
          target.id === "stdio_mcp_remote" &&
          target.tracked_install_url?.startsWith("https://mcp.packrift.com/r/install/generic/stdio_mcp_remote") &&
          target.source_aware_endpoint?.includes("packrift_mcp_target=stdio_mcp_remote") &&
          target.host_install_steps?.some((step) => step.includes("npx -y mcp-remote"))
      ) &&
      installActions?.targets?.some((target) => target.id === "cline" && target.tracked_install_url?.startsWith("https://mcp.packrift.com/r/install/generic/cline")) &&
      installActions?.targets?.some((target) => target.id === "cline" && target.source_aware_endpoint?.includes("packrift_mcp_target=cline")) &&
      installActions?.targets?.some((target) => target.id === "cline" && target.host_install_steps?.some((step) => step.includes("Cline's MCP Servers settings"))) &&
      installActions?.targets?.every((target) => target.required_post_install_final_tool === "create_cart_url") &&
      installActions?.first_useful_run?.sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      installActions?.first_useful_run?.sequence?.every(
        (step) =>
          step?.method !== "tools/call" ||
          (step?.params?.arguments?.source_context && step?.params?.arguments?.journey_id && step?.params?.arguments?.result_set_id)
      ) &&
      installActions?.first_useful_run?.curl_script?.includes("create_cart_url") &&
      installActions?.first_useful_run?.agent_prompt?.includes("Required tool sequence") &&
      installActions?.first_useful_run?.agent_prompt?.includes("source_context") &&
      installActions?.first_useful_run?.agent_prompt?.includes("create_cart_url") &&
      installActions?.required_post_install_verification?.required_final_tool === "create_cart_url" &&
      trackedInstallCodexHtmlResult.ok &&
      trackedInstallCodexHtmlResult.text.includes("Packrift MCP Install") &&
      trackedInstallCodexHtmlResult.text.includes("Copy install") &&
      trackedInstallCodexHtmlResult.text.includes("Copy agent prompt") &&
      trackedInstallCodexHtmlResult.text.includes("Copy shell one-liner") &&
      trackedInstallCodexHtmlResult.text.includes("Fastest Activation Path") &&
      trackedInstallCodexHtmlResult.text.includes("mcp_install_copy") &&
      trackedInstallCodexHtmlResult.text.includes("Open first run") &&
      trackedInstallCodexHtmlResult.text.includes("Run real MCP check") &&
      trackedInstallClineHtmlResult.ok &&
      trackedInstallClineJsonResult.ok &&
      trackedInstallClineJson?.release === "PACKRIFT-MCP-INSTALL-ACTION-R12" &&
      trackedInstallClineJson?.install?.mcpServers?.packrift?.type === "streamableHttp" &&
      trackedInstallClineJson?.install?.mcpServers?.packrift?.url?.includes("packrift_mcp_source=cline_mcp_marketplace") &&
      trackedInstallClineJson?.install?.mcpServers?.packrift?.url?.includes("packrift_mcp_target=cline") &&
      trackedInstallClineJson?.tracked_run_shell_url?.includes("/r/run/cline_mcp_marketplace/cline") &&
      trackedInstallClineJson?.tracked_run_shell_url?.includes("format=sh") &&
      trackedInstallClineJson?.copy_ready_shell_one_liner?.includes("format=sh") &&
      trackedInstallClineJson?.copy_ready_agent_prompt?.includes("create_cart_url") &&
      trackedInstallClineJson?.fastest_activation_path?.required_final_tool === "create_cart_url" &&
      trackedInstallClineJson?.fastest_activation_path?.shell_one_liner?.includes("format=sh") &&
      trackedInstallClineJson?.fastest_activation_path?.browser_proof_rule?.includes("Browser proof alone") &&
      trackedInstallClineJson?.host_install_steps?.some((step) => step.includes("Cline's MCP Servers settings")) &&
      trackedInstallClineJson?.activation_acceptance_gate?.real_host_required === true &&
      trackedInstallClineJson?.activation_acceptance_gate?.browser_proof_is_not_enough === true &&
      trackedInstallClineJson?.activation_acceptance_gate?.required_host_target === "cline" &&
      trackedInstallClineHtmlResult.text.includes("Packrift MCP Install") &&
      trackedInstallClineHtmlResult.text.includes("Host Install Steps") &&
      trackedInstallClineHtmlResult.text.includes("Fastest Activation Path") &&
      trackedInstallClineHtmlResult.text.includes("Copy shell one-liner") &&
      trackedInstallClineHtmlResult.text.includes("Cline&#39;s MCP Servers settings") &&
      trackedInstallClineHtmlResult.text.includes("Browser proof alone is review evidence") &&
      trackedInstallClineHtmlResult.text.includes("packrift_mcp_target=cline") &&
      firstRunActions?.release === "PACKRIFT-MCP-FIRST-RUN-ACTIONS-R07" &&
      firstRunActions?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      firstRunActions?.targets?.length >= 7 &&
      firstRunActions?.targets?.some((target) => target.id === "stdio_mcp_remote" && target.tracked_run_url?.startsWith("https://mcp.packrift.com/r/run/generic/stdio_mcp_remote")) &&
      firstRunActions?.targets?.some((target) => target.id === "cline" && target.tracked_run_url?.startsWith("https://mcp.packrift.com/r/run/generic/cline")) &&
      firstRunActions?.targets?.every((target) => target.tracked_run_url?.startsWith("https://mcp.packrift.com/r/run/generic/")) &&
      firstRunActions?.targets?.every((target) => target.tracked_run_html_url?.startsWith("https://mcp.packrift.com/r/run/generic/") && target.tracked_run_html_url?.includes("format=html")) &&
      firstRunActions?.targets?.every((target) => target.tracked_run_execute_url?.includes("execute=1")) &&
      firstRunActions?.targets?.every((target) => target.required_final_tool === "create_cart_url") &&
      firstRunActions?.first_run?.release === "PACKRIFT-MCP-FIRST-RUN-ACTION-R08" &&
      firstRunActions?.first_run?.tracked_run_url?.startsWith("https://mcp.packrift.com/r/run/generic/generic_streamable_http") &&
      firstRunActions?.first_run?.tracked_run_html_url?.startsWith("https://mcp.packrift.com/r/run/generic/generic_streamable_http") &&
      firstRunActions?.first_run?.tracked_run_html_url?.includes("format=html") &&
      firstRunActions?.first_run?.tracked_run_execute_url?.includes("execute=1") &&
      firstRunActions?.first_run?.first_useful_run?.curl_script?.includes("create_cart_url") &&
      firstRunActions?.first_run?.first_useful_run?.curl_script?.includes("accept: application/json, text/event-stream") &&
      firstRunActions?.first_run?.first_useful_run?.curl_script?.includes("normalize_mcp_response") &&
      firstRunActions?.first_run?.first_useful_run?.sequence?.every(
        (step) =>
          step?.method !== "tools/call" ||
          (step?.params?.arguments?.source_context && step?.params?.arguments?.journey_id && step?.params?.arguments?.result_set_id)
      ) &&
      firstRunActions?.first_run?.first_useful_run?.agent_prompt?.includes("Packrift MCP") &&
      firstRunActions?.first_run?.first_useful_run?.agent_prompt?.includes("source_context") &&
      firstRunActions?.first_run?.first_useful_run?.agent_prompt?.includes("create_cart_url") &&
      firstRunActions?.first_run?.shell_one_liner?.includes("format=sh") &&
      clientConfig?.release === "PACKRIFT-MCP-CLIENT-CONFIG-R12" &&
      clientConfig?.canonical_endpoint === MCP_ENDPOINT &&
      clientConfig?.stdio_mcp_remote_config?.mcpServers?.packrift?.command === "npx" &&
      clientConfig?.stdio_mcp_remote_config?.mcpServers?.packrift?.args?.includes("mcp-remote") &&
      clientConfig?.stdio_mcp_remote_config?.mcpServers?.packrift?.args?.includes(MCP_ENDPOINT) &&
      clientConfig?.install_commands?.stdio_mcp_remote === `npx -y mcp-remote ${MCP_ENDPOINT}` &&
      clientConfig?.cline_config?.mcpServers?.packrift?.type === "streamableHttp" &&
      clientConfig?.cline_config?.mcpServers?.packrift?.url === MCP_ENDPOINT &&
      clientConfig?.aliases?.tracked_install_examples?.stdio_mcp_remote?.startsWith("https://mcp.packrift.com/r/install/generic/stdio_mcp_remote") &&
      clientConfig?.aliases?.tracked_run_examples?.stdio_mcp_remote?.startsWith("https://mcp.packrift.com/r/run/generic/stdio_mcp_remote") &&
      clientConfig?.aliases?.tracked_install_examples?.cline?.startsWith("https://mcp.packrift.com/r/install/generic/cline") &&
      clientConfig?.aliases?.tracked_run_examples?.cline?.startsWith("https://mcp.packrift.com/r/run/generic/cline") &&
      clientConfig?.aliases?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      clientConfig?.aliases?.tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      clientConfig?.aliases?.source_aware_endpoint_template === "https://mcp.packrift.com/mcp?packrift_mcp_source={source}&packrift_mcp_target={target}" &&
      clientConfig?.aliases?.source_aware_examples?.browse_sh?.commands?.codex?.includes("packrift_mcp_source=browse_sh") &&
      clientConfig?.aliases?.source_aware_examples?.browse_sh?.commands?.codex?.includes("packrift_mcp_target=codex") &&
      clientConfig?.aliases?.source_aware_examples?.browse_sh?.remote_mcp_json?.mcpServers?.packrift?.url?.includes("packrift_mcp_target=generic_streamable_http") &&
      clientConfig?.aliases?.source_aware_examples?.browse_sh?.stdio_mcp_remote_json?.mcpServers?.packrift?.args?.some((arg) => String(arg).includes("packrift_mcp_target=stdio_mcp_remote")) &&
      clientConfig?.aliases?.source_aware_examples?.cline_mcp_marketplace?.cline_mcp_json?.mcpServers?.packrift?.url?.includes("packrift_mcp_target=cline") &&
      clientConfig?.host_notes?.some((note) => String(note).includes("aliases.source_aware_examples")) &&
      trackedFirstRunClineHtmlResult.ok &&
      trackedFirstRunClineJsonResult.ok &&
      trackedFirstRunClineJsonResult.text.includes('"mcp_source_context":"cline_mcp_marketplace"') &&
      trackedFirstRunClineJsonResult.text.includes('"mcp_install_target":"cline"') &&
      trackedFirstRunClineJsonResult.text.includes("mcp_source_context") &&
      trackedFirstRunClineHtmlResult.text.includes("Packrift MCP First Run") &&
      trackedFirstRunClineHtmlResult.text.includes("packrift_mcp_target=cline") &&
      trackedFirstRunClineHtmlResult.text.includes("mcp_source_context") &&
      trackedFirstRunClineHtmlResult.text.includes("mcp_install_target") &&
      clientConfig?.config?.mcpServers?.packrift?.url === MCP_ENDPOINT &&
      clientConfig?.first_useful_run?.sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      clientConfig?.first_useful_run?.curl_script?.includes("create_cart_url") &&
      clientConfig?.first_useful_run?.agent_prompt?.includes("create_cart_url") &&
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
      clientConfig?.proof_urls?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      clientConfig?.proof_urls?.tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      clientConfig?.proof_urls?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      rootMcpJson?.mcpServers?.packrift?.url === MCP_ENDPOINT &&
      wellKnownMcpJson?.mcpServers?.packrift?.url === MCP_ENDPOINT &&
      trackedConfigGeneric?.mcpServers?.packrift?.url?.startsWith(`${MCP_ENDPOINT}?`) &&
      trackedConfigGeneric?.mcpServers?.packrift?.url?.includes("packrift_mcp_source=generic") &&
      trackedConfigGeneric?.mcpServers?.packrift?.url?.includes("packrift_mcp_target=tracked_config") &&
      usageSnapshot?.release === "PACKRIFT-MCP-USAGE-SNAPSHOT-R26" &&
      usageSnapshot?.runtime?.default_public_event_limit === 500 &&
      usageSnapshot?.runtime?.full_event_limit_hint?.includes("limit=1000") &&
      usageSnapshot?.runtime_source_inference?.release === "PACKRIFT-MCP-RUNTIME-SOURCE-INFERENCE-R03" &&
      usageSnapshot?.runtime_source_inference?.rule_count >= 65 &&
      usageSnapshot?.runtime_source_inference?.rule_families?.some((rule) => rule?.source_slug === "openai_chatgpt") &&
      usageSnapshot?.runtime_source_inference?.rule_families?.some((rule) => rule?.source_slug === "langchain_agent") &&
      usageSnapshot?.runtime_source_inference?.rule_families?.some((rule) => rule?.source_slug === "n8n_automation") &&
      usageSnapshot?.runtime_source_inference?.rule_families?.some((rule) => rule?.source_slug === "goose_agent") &&
      usageSnapshot?.runtime_source_inference?.rule_families?.some((rule) => rule?.source_slug === "mcpservers_org") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_start") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_agent_host_rollout") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_client_config") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_cart_activation") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_funnel_snapshot") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_activation_experiments") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_activation_wave") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_activation_wave_runner") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_external_activation_brief") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_first_run_actions") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_reviewer_activation") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_order_handoff") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_first_run_proof") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_workflow_gallery") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_automation_workflows") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_revenue_conversion_queue") &&
      usageSnapshot?.counts?.direct_agent_resource_sources?.includes("mcp_eval_pack") &&
      typeof usageSnapshot?.counts?.mcp_cart_landings === "number" &&
      typeof usageSnapshot?.counts?.mcp_tracked_config_fetches === "number" &&
      typeof usageSnapshot?.counts?.mcp_install_intent_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_first_run_intent_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_first_run_execution_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_install_copy_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_activation_cart_ready_events === "number" &&
      typeof usageSnapshot?.counts?.agent_host_rollout_resource_events === "number" &&
      typeof usageSnapshot?.counts?.reviewer_activation_resource_events === "number" &&
      typeof usageSnapshot?.counts?.order_handoff_resource_events === "number" &&
      typeof usageSnapshot?.counts?.source_activation_packet_resource_events === "number" &&
      typeof usageSnapshot?.counts?.activation_experiments_resource_events === "number" &&
      typeof usageSnapshot?.counts?.activation_wave_runner_resource_events === "number" &&
      typeof usageSnapshot?.counts?.external_activation_brief_resource_events === "number" &&
      typeof usageSnapshot?.counts?.automation_workflows_resource_events === "number" &&
      typeof usageSnapshot?.counts?.revenue_conversion_queue_resource_events === "number" &&
      typeof usageSnapshot?.counts?.eval_pack_resource_events === "number" &&
      typeof usageSnapshot?.counts?.mcp_source_attributed_runtime_events === "number" &&
      typeof usageSnapshot?.counts?.unique_mcp_handoff_ids === "number" &&
      typeof usageSnapshot?.counts?.unique_qualified_mcp_identity_signals === "number" &&
      typeof usageSnapshot?.counts?.unique_qualified_mcp_session_ids === "number" &&
      typeof usageSnapshot?.counts?.unique_qualified_mcp_handoff_ids === "number" &&
      typeof usageSnapshot?.counts?.unique_qualified_ai_commerce_journey_ids === "number" &&
      typeof usageSnapshot?.counts?.qualified_mcp_events_with_identity === "number" &&
      typeof usageSnapshot?.counts?.qualified_mcp_events_without_identity === "number" &&
      typeof usageSnapshot?.counts?.external_qualified_mcp_tool_calls === "number" &&
      typeof usageSnapshot?.counts?.external_qualified_create_cart_url_calls === "number" &&
      typeof usageSnapshot?.counts?.post_install_sources_waiting_on_create_cart_url === "number" &&
      typeof usageSnapshot?.counts?.post_install_sources_waiting_on_cart_landing === "number" &&
      typeof usageSnapshot?.counts?.source_activation_priority_sources === "number" &&
      typeof usageSnapshot?.counts?.source_activation_priority_critical === "number" &&
      typeof usageSnapshot?.counts?.monthly_qualified_visitor_signals === "number" &&
      typeof usageSnapshot?.counts?.monthly_qualified_visitor_threshold === "number" &&
      typeof usageSnapshot?.counts?.monthly_qualified_visitor_remaining === "number" &&
      usageSnapshot?.monthly_qualified_visitor_proof?.gate_name === "thousands_of_qualified_visitors" &&
      typeof usageSnapshot?.monthly_qualified_visitor_proof?.qualified_external_mcp_event_signals === "number" &&
      typeof usageSnapshot?.monthly_qualified_visitor_proof?.remaining_to_threshold === "number" &&
      typeof usageSnapshot?.monthly_qualified_visitor_proof?.progress_pct === "number" &&
      typeof usageSnapshot?.monthly_qualified_visitor_proof?.truncated_by_read_limit === "boolean" &&
      usageSnapshot?.unique_qualified_identity_proof?.basis === "explicit_mcp_session_handoff_or_journey_ids_no_ip_or_cookie_fingerprint" &&
      typeof usageSnapshot?.unique_qualified_identity_proof?.qualified_event_signals === "number" &&
      typeof usageSnapshot?.unique_qualified_identity_proof?.events_with_identity === "number" &&
      typeof usageSnapshot?.unique_qualified_identity_proof?.events_without_identity === "number" &&
      typeof usageSnapshot?.unique_qualified_identity_proof?.unique_identity_signals === "number" &&
      typeof usageSnapshot?.unique_qualified_identity_proof?.unique_mcp_session_ids === "number" &&
      typeof usageSnapshot?.unique_qualified_identity_proof?.unique_mcp_handoff_ids === "number" &&
      typeof usageSnapshot?.unique_qualified_identity_proof?.unique_ai_commerce_journey_ids === "number" &&
      Array.isArray(usageSnapshot?.unique_qualified_identity_proof?.top_sources_by_unique_identity) &&
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
      Array.isArray(usageSnapshot?.source_attribution?.mcp_session_ids) &&
      Array.isArray(usageSnapshot?.source_attribution?.mcp_handoff_ids) &&
      Array.isArray(usageSnapshot?.source_attribution?.mcp_runtime_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.tool_runtime_sources) &&
      Array.isArray(usageSnapshot?.source_attribution?.post_install_cart_activation_by_source) &&
      Array.isArray(usageSnapshot?.source_activation_priority_queue) &&
      Array.isArray(usageSnapshot?.source_attribution?.source_activation_priority_queue) &&
      usageSnapshot?.source_activation_priority_queue?.every(
        (row) =>
          typeof row.source === "string" &&
          typeof row.priority === "string" &&
          typeof row.current_stage === "string" &&
          typeof row.target_event_to_watch === "string" &&
          row.tracked_first_run_url?.startsWith("https://mcp.packrift.com/r/run/")
      ) &&
      usageSnapshot?.source_attribution?.post_install_cart_activation_by_source?.every((row) => typeof row.qualified_cart_landings === "number") &&
      !usageSnapshot?.source_attribution?.post_install_cart_activation_by_source?.some((row) => row.source === "mcp_route_redirect") &&
      funnelSnapshot?.release === "PACKRIFT-MCP-FUNNEL-SNAPSHOT-R23" &&
      funnelSnapshot?.canonical_endpoint === MCP_ENDPOINT &&
      funnelSnapshot?.limit === 1000 &&
      funnelSnapshot?.event_lookback_days === 2 &&
      funnelSnapshot?.snapshot_coverage?.snapshot_mode === "fast_public_snapshot" &&
      funnelSnapshot?.snapshot_coverage?.operator_url ===
        "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json?limit=20000&order_days=90&order_limit=250" &&
      funnelSnapshot?.links?.funnel_snapshot_operator_json === funnelSnapshot?.snapshot_coverage?.operator_url &&
      funnelSnapshot?.links?.source_activation_queue_operator_json ===
        "https://mcp.packrift.com/ai/mcp-source-activation-queue.json?limit=20000&order_days=90&order_limit=250" &&
      funnelSnapshot?.runtime?.default_public_event_limit === 1000 &&
      funnelSnapshot?.runtime?.default_public_event_lookback_days === 2 &&
      funnelSnapshot?.runtime_source_inference?.release === "PACKRIFT-MCP-RUNTIME-SOURCE-INFERENCE-R03" &&
      funnelSnapshot?.runtime_source_inference?.rule_count >= 65 &&
      funnelSnapshot?.runtime_source_inference?.rule_families?.some((rule) => rule?.source_slug === "openai_chatgpt") &&
      funnelSnapshot?.runtime_source_inference?.rule_families?.some((rule) => rule?.source_slug === "goose_agent") &&
      funnelSnapshot?.runtime_source_inference?.rule_families?.some((rule) => rule?.source_slug === "official_registry") &&
      funnelSnapshot?.ga4_canonical_visitor_proof?.release === "PACKRIFT-MCP-GA4-FUNNEL-PROOF-R01" &&
      ga4FunnelProof?.release === "PACKRIFT-MCP-GA4-FUNNEL-PROOF-R01" &&
      typeof ga4FunnelProof?.visitor_goal?.qualified_external_mcp_session_starts === "number" &&
      typeof ga4FunnelProof?.cart_and_revenue_proof?.first_party_mcp_orders === "number" &&
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
      typeof funnelSnapshot?.counts?.source_activation_priority_sources === "number" &&
      typeof funnelSnapshot?.counts?.source_activation_priority_critical === "number" &&
      typeof funnelSnapshot?.counts?.monthly_qualified_visitor_signals === "number" &&
      typeof funnelSnapshot?.counts?.monthly_qualified_visitor_threshold === "number" &&
      typeof funnelSnapshot?.counts?.monthly_qualified_visitor_remaining === "number" &&
      typeof funnelSnapshot?.counts?.ga4_qualified_external_mcp_session_starts === "number" &&
      typeof funnelSnapshot?.counts?.ga4_qualified_external_mcp_session_threshold === "number" &&
      typeof funnelSnapshot?.counts?.mcp_source_attributed_runtime_events === "number" &&
      typeof funnelSnapshot?.counts?.unique_mcp_handoff_ids === "number" &&
      typeof funnelSnapshot?.counts?.unique_qualified_mcp_identity_signals === "number" &&
      typeof funnelSnapshot?.counts?.unique_qualified_mcp_session_ids === "number" &&
      typeof funnelSnapshot?.counts?.unique_qualified_mcp_handoff_ids === "number" &&
      typeof funnelSnapshot?.counts?.unique_qualified_ai_commerce_journey_ids === "number" &&
      typeof funnelSnapshot?.counts?.qualified_mcp_events_with_identity === "number" &&
      typeof funnelSnapshot?.counts?.qualified_mcp_events_without_identity === "number" &&
      typeof funnelSnapshot?.counts?.qualified_first_party_mcp_cart_landings === "number" &&
      (funnelSnapshot?.counts?.qualified_first_party_mcp_cart_landings === 0 ||
        funnelSnapshot?.proof_gate?.qualified_first_party_cart_landing_seen === true) &&
      typeof funnelSnapshot?.counts?.first_party_mcp_orders === "number" &&
      typeof funnelSnapshot?.counts?.first_party_mcp_order_revenue === "number" &&
      typeof funnelSnapshot?.proof_gate?.thousands_of_qualified_visitors === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.first_run_intent_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.first_run_execution_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.activation_cart_ready_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.mcp_runtime_source_continuity_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.qualified_first_party_cart_landing_seen === "boolean" &&
      typeof funnelSnapshot?.proof_gate?.measurable_mcp_revenue_seen === "boolean" &&
      funnelSnapshot?.agent_adoption_progress?.release === "PACKRIFT-MCP-AGENT-ADOPTION-PROGRESS-R02" &&
      funnelSnapshot?.agent_adoption_progress?.goal_name === "thousands_of_qualified_agents_and_ai_commerce_workflows" &&
      typeof funnelSnapshot?.agent_adoption_progress?.progress_bars?.monthly_ga4_qualified_visitors_1000?.progress_pct === "number" &&
      typeof funnelSnapshot?.agent_adoption_progress?.commerce_gate?.first_party_mcp_orders === "number" &&
      Array.isArray(funnelSnapshot?.agent_adoption_progress?.next_proof_needed) &&
      funnelSnapshot?.proof_boundaries?.commerce_gate?.includes("Orders and revenue require") &&
      funnelSnapshot?.monthly_qualified_visitor_proof?.gate_name === "thousands_of_qualified_visitors" &&
      typeof funnelSnapshot?.monthly_qualified_visitor_proof?.qualified_external_mcp_event_signals === "number" &&
      typeof funnelSnapshot?.monthly_qualified_visitor_proof?.remaining_to_threshold === "number" &&
      typeof funnelSnapshot?.monthly_qualified_visitor_proof?.progress_pct === "number" &&
      typeof funnelSnapshot?.monthly_qualified_visitor_proof?.truncated_by_read_limit === "boolean" &&
      funnelSnapshot?.unique_qualified_identity_proof?.basis === "explicit_mcp_session_handoff_or_journey_ids_no_ip_or_cookie_fingerprint" &&
      typeof funnelSnapshot?.unique_qualified_identity_proof?.unique_identity_signals === "number" &&
      Array.isArray(funnelSnapshot?.unique_qualified_identity_proof?.top_sources_by_unique_identity) &&
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
      Array.isArray(funnelSnapshot?.source_activation_priority_queue) &&
      Array.isArray(funnelSnapshot?.source_attribution?.source_activation_priority_queue) &&
      funnelSnapshot?.source_activation_priority_queue?.every(
        (row) =>
          typeof row.source === "string" &&
          typeof row.priority === "string" &&
          typeof row.current_stage === "string" &&
          typeof row.target_event_to_watch === "string" &&
          row.tracked_first_run_url?.startsWith("https://mcp.packrift.com/r/run/")
      ) &&
      funnelSnapshot?.source_attribution?.post_install_cart_activation_by_source?.every((row) => typeof row.qualified_cart_landings === "number") &&
      !funnelSnapshot?.source_attribution?.post_install_cart_activation_by_source?.some((row) => row.source === "mcp_route_redirect") &&
      funnelSnapshot?.links?.cart_activation === "https://mcp.packrift.com/ai/mcp-cart-activation.json" &&
      funnelSnapshot?.links?.first_run_actions === "https://mcp.packrift.com/ai/mcp-first-run-actions.json" &&
      funnelSnapshot?.links?.activation_experiments === "https://mcp.packrift.com/ai/mcp-activation-experiments.json" &&
      funnelSnapshot?.links?.activation_experiments_html === "https://mcp.packrift.com/ai/mcp-activation-experiments.html" &&
      funnelSnapshot?.links?.tracked_run_generic === "https://mcp.packrift.com/r/run/generic/generic_streamable_http" &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/activate/generic?format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/order/mcp_so?format=html") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/codex_remote_mcp/codex?format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/claude_remote_mcp/claude_code?format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/openai_chatgpt/generic_streamable_http?format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/langchain_agent/generic_streamable_http?format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/n8n_automation/generic_streamable_http?format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/mcp_inspector/generic_streamable_http?format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/browse_sh/generic_streamable_http?format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-eval-pack.json?source=cline_mcp_marketplace") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-eval-pack.md?source=cline_mcp_marketplace") &&
      sourceActivationQueue?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      sourceActivationQueue?.canonical_endpoint === MCP_ENDPOINT &&
      sourceActivationQueue?.event_read_limit === 20000 &&
      sourceActivationQueue?.event_lookback_days === 2 &&
      sourceActivationQueue?.snapshot_coverage?.snapshot_mode === "full_operator_snapshot" &&
      sourceActivationQueue?.snapshot_coverage?.operator_url ===
        "https://mcp.packrift.com/ai/mcp-source-activation-queue.json?limit=20000&order_days=90&order_limit=250" &&
      sourceActivationQueue?.links?.source_activation_queue_operator_json === sourceActivationQueue?.snapshot_coverage?.operator_url &&
      sourceActivationQueue?.links?.funnel_snapshot_operator_json === funnelSnapshot?.snapshot_coverage?.operator_url &&
      sourceActivationQueue?.source_context_normalization?.release === "PACKRIFT-MCP-SOURCE-CONTEXT-NORMALIZATION-R01" &&
      sourceActivationQueue?.source_context_normalization?.examples?.some(
        (example) => example.raw === "cline_mcp_marketplace_first_cart_run" && example.normalized === "cline_mcp_marketplace"
      ) &&
      sourceActivationQueue?.source_context_normalization?.examples?.some(
        (example) => example.raw === "mcp_so_first_cart_run" && example.normalized === "mcp_so"
      ) &&
      sourceActivationQueue?.source_context_normalization?.examples?.some(
        (example) => example.raw === "browse_sh_first_cart_run" && example.normalized === "browse_sh"
      ) &&
      sourceActivationQueue?.links?.funnel_snapshot === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json" &&
      sourceActivationQueue?.links?.usage_snapshot === "https://mcp.packrift.com/ai/mcp-usage-snapshot.json" &&
      sourceActivationQueue?.links?.source_activation_queue_html === "https://mcp.packrift.com/ai/mcp-source-activation-queue.html" &&
      sourceActivationQueue?.links?.revenue_conversion_queue_json === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      sourceActivationQueue?.links?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      sourceActivationQueue?.links?.activation_experiments_json === "https://mcp.packrift.com/ai/mcp-activation-experiments.json" &&
      sourceActivationQueue?.links?.activation_experiments_html === "https://mcp.packrift.com/ai/mcp-activation-experiments.html" &&
      sourceActivationQueue?.links?.activation_wave_json === "https://mcp.packrift.com/ai/mcp-activation-wave.json" &&
      sourceActivationQueue?.links?.activation_wave_html === "https://mcp.packrift.com/ai/mcp-activation-wave.html" &&
      sourceActivationQueue?.links?.activation_command_center === "https://mcp.packrift.com/r/activate" &&
      sourceActivationQueue?.links?.ga4_funnel_proof === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json" &&
      sourceActivationQueue?.links?.directory_update_card_template === "https://mcp.packrift.com/ai/mcp-directory-update/{source}.json" &&
      sourceActivationQueue?.links?.eval_pack_template === "https://mcp.packrift.com/ai/mcp-eval-pack.json?source={source}" &&
      sourceActivationQueue?.source_snapshot?.ga4_canonical_visitor_proof?.release === "PACKRIFT-MCP-GA4-FUNNEL-PROOF-R01" &&
      typeof sourceActivationQueue?.source_snapshot?.unique_qualified_mcp_identity_signals === "number" &&
      typeof sourceActivationQueue?.source_snapshot?.unique_qualified_mcp_session_ids === "number" &&
      sourceActivationQueue?.agent_adoption_progress?.release === "PACKRIFT-MCP-AGENT-ADOPTION-PROGRESS-R02" &&
      sourceActivationQueue?.source_snapshot?.agent_adoption_progress?.release === "PACKRIFT-MCP-AGENT-ADOPTION-PROGRESS-R02" &&
      sourceActivationQueue?.proof_boundaries?.ga4_visitor_gate?.includes("MCP tool calls") &&
      sourceActivationQueue?.proof_boundaries?.commerce_gate?.includes("Shopify") &&
      sourceActivationQueue?.critical_actions?.every(
        (row) =>
          row.source_order_handoff?.buyer_handoff_url?.startsWith("https://mcp.packrift.com/r/order/") &&
          row.buyer_handoff_preview?.buyer_action_url?.includes(`mcp_source_context=${row.source}`) &&
          row.buyer_handoff_url === row.source_order_handoff?.buyer_handoff_url
      ) &&
      (!sourceActivationQueue?.queue?.some((row) => row.source === "mcp_so") ||
        sourceActivationQueue?.queue?.some(
          (row) =>
            row.source === "mcp_so" &&
            row.primary_action_url?.startsWith("https://mcp.packrift.com/r/") &&
            row.target_event_to_watch?.startsWith("mcp_") &&
            row.directory_update_card_json_url === "https://mcp.packrift.com/ai/mcp-directory-update/mcp_so.json" &&
            row.tracked_first_run_shell_url?.includes("format=sh") &&
            row.copy_ready_host_configs?.generic_mcp_json?.includes('"mcpServers"') &&
            row.source_order_handoff?.buyer_handoff_url === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
            row.source_order_handoff?.buyer_action_url?.includes("mcp_source_context=mcp_so") &&
            row.source_order_handoff?.buyer_action_url?.includes("mcp_install_target=generic_streamable_http") &&
            row.source_order_handoff?.proof_boundary?.includes("not source activation proof") &&
            row.buyer_handoff_preview?.buyer_handoff_url === row.source_order_handoff?.buyer_handoff_url &&
            (!row.order_conversion_handoff ||
              (row.order_conversion_handoff?.cart_landing_action_url === row.order_conversion_handoff?.buyer_action_url &&
                row.order_conversion_handoff?.buyer_action_url?.includes("mcp_source_context=mcp_so") &&
                row.order_conversion_handoff?.buyer_action_url?.includes("mcp_install_target=generic_streamable_http") &&
                (row.order_conversion_handoff?.measured_cart_url_source_preserving
                  ? row.order_conversion_handoff?.buyer_action_url === row.order_conversion_handoff?.measured_cart_url
                  : row.order_conversion_handoff?.buyer_action_url === row.order_conversion_handoff?.fallback_source_preserving_cart_url) &&
                row.order_conversion_handoff?.fallback_source_preserving_cart_url?.includes("mcp_source_context=mcp_so")))
        )) &&
      sourceActivationCriticalActionsOk &&
      typeof sourceActivationQueue?.queue_count === "number" &&
      typeof sourceActivationQueue?.critical_count === "number" &&
      Array.isArray(sourceActivationQueue?.blocking_goal_gates) &&
      Array.isArray(sourceActivationQueue?.queue) &&
      sourceActivationQueue?.queue?.some((row) => row.primary_action_url?.startsWith("https://mcp.packrift.com/r/")) &&
      sourceActivationHostIntentRowsRequireExternalOk &&
      sourceActivationMcpSoExternalOk &&
      sourceActivationQueue?.queue?.every(
        (row) =>
          row.tracked_first_run_shell_url?.startsWith("https://mcp.packrift.com/r/run/") &&
          row.tracked_first_run_shell_url?.includes("format=sh") &&
          row.first_run_shell_one_liner?.includes("format=sh") &&
          row.fast_activation_path?.first_run_shell_one_liner?.includes("format=sh") &&
          row.fast_activation_path?.required_final_tool === "create_cart_url"
      ) &&
      sourceActivationClineRowOk &&
      sourceActivationQueueHtmlResult.ok &&
      sourceActivationQueueHtmlResult.text.includes("Packrift MCP Activation Command Center") &&
      sourceActivationQueueHtmlResult.text.includes("External activation message") &&
      sourceActivationQueueHtmlResult.text.includes("Do not ") &&
      sourceActivationQueueHtmlResult.text.includes("Source-aware endpoint") &&
      sourceActivationQueueHtmlResult.text.includes("Source-specific agent prompt") &&
      sourceActivationQueueHtmlResult.text.includes("Copy-ready host configs") &&
      sourceActivationQueueHtmlResult.text.includes("Fast activation path") &&
      sourceActivationQueueHtmlResult.text.includes("First-run shell") &&
      sourceActivationQueueHtmlResult.text.includes("Buyer/reviewer handoff") &&
      (sourceActivationQueueHtmlResult.text.includes("Buyer handoff") ||
        sourceActivationQueueHtmlResult.text.includes("Run real MCP check") ||
        sourceActivationQueueHtmlResult.text.includes("Install in MCP host") ||
        sourceActivationQueueHtmlResult.text.includes("Install in Cline")) &&
      sourceActivationQueueHtmlResult.text.includes("Proof boundaries") &&
      sourceActivationQueueHtmlResult.text.includes("Adoption:") &&
      sourceActivationQueueHtmlResult.text.includes("codex mcp add packrift --url") &&
      sourceActivationQueueHtmlResult.text.includes("Full operator queue") &&
      sourceActivationQueueHtmlResult.text.includes("Revenue queue") &&
      (sourceActivationQueueHtmlResult.text.includes("Activation runner") ||
        sourceActivationQueueHtmlResult.text.includes("Run real MCP check") ||
        sourceActivationQueueHtmlResult.text.includes("Install in Cline") ||
        sourceActivationQueueHtmlResult.text.includes("One-command external runner")) &&
      revenueConversionQueue?.release === "PACKRIFT-MCP-REVENUE-CONVERSION-QUEUE-R02" &&
      revenueConversionQueue?.canonical_endpoint === MCP_ENDPOINT &&
      revenueConversionQueue?.status === "buyer_checkout_needed" &&
      revenueConversionQueue?.source_queue_release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      revenueConversionQueue?.snapshot_coverage?.operator_url ===
        "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.json?limit=20000&order_days=90&order_limit=250" &&
      revenueConversionQueue?.links?.revenue_conversion_queue_json === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      revenueConversionQueue?.links?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      revenueConversionQueue?.links?.source_activation_queue_json === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      revenueConversionQueue?.links?.ga4_funnel_proof === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json" &&
      Number(revenueConversionQueue?.row_count ?? 0) >= 1 &&
      Number(revenueConversionQueue?.mature_source_count ?? 0) >= 1 &&
      Array.isArray(revenueConversionQueue?.suppression_rules) &&
      revenueConversionQueue?.suppression_rules?.some((rule) => String(rule).includes("self-opened carts")) &&
      revenueConversionQueue?.proof_gate?.order_or_revenue_required?.includes("first_party_mcp_orders") &&
      revenueConversionRowsOk &&
      revenueConversionQueueMarkdownResult.ok &&
      revenueConversionQueueMarkdownResult.text.includes("Packrift MCP Revenue Conversion Queue") &&
      revenueConversionQueueMarkdownResult.text.includes("Revenue Rows") &&
      revenueConversionQueueMarkdownResult.text.includes("Suppression Rules") &&
      revenueConversionQueueHtmlResult.ok &&
      revenueConversionQueueHtmlResult.text.includes("Packrift MCP Revenue Conversion Queue") &&
      revenueConversionQueueHtmlResult.text.includes("Revenue proof boundary") &&
      revenueConversionQueueHtmlResult.text.includes("Buyer handoff") &&
      buyerOrderHandoffsOk &&
      trackedOrderCline?.release === "PACKRIFT-MCP-ORDER-CONVERSION-HANDOFF-R05" &&
      trackedOrderCline?.source === "cline_mcp_marketplace" &&
      trackedOrderCline?.preferred_target === "cline" &&
      trackedOrderCline?.mcp_source_context === "cline_mcp_marketplace" &&
      trackedOrderCline?.mcp_install_target === "cline" &&
      trackedOrderCline?.buyer_handoff_url === "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html" &&
      trackedOrderCline?.buyer_action_url?.startsWith("https://mcp.packrift.com/r/cart/1066") &&
      trackedOrderCline?.buyer_action_url?.includes("mcp_source_context=cline_mcp_marketplace") &&
      trackedOrderCline?.buyer_action_url?.includes("mcp_install_target=cline") &&
      trackedOrderCline?.copy_ready_messages?.buyer_request?.includes("only place the order if it is actually approved") &&
      trackedOrderCline?.copy_ready_messages?.agent_prompt?.includes("mcp_source_context=\"cline_mcp_marketplace\"") &&
      trackedOrderCline?.source_activation_state?.target_event_to_watch === "mcp_attributed_order" &&
      trackedOrderCline?.source_activation_queue_runtime?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      trackedOrderMcpSo?.release === "PACKRIFT-MCP-ORDER-CONVERSION-HANDOFF-R05" &&
      trackedOrderMcpSo?.source === "mcp_so" &&
      trackedOrderMcpSo?.mcp_source_context === "mcp_so" &&
      trackedOrderMcpSo?.mcp_install_target === "generic_streamable_http" &&
      trackedOrderMcpSo?.source_activation_queue_runtime?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      trackedOrderMcpSo?.source_activation_queue_runtime?.operator_url === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json?limit=20000&order_days=90&order_limit=250" &&
      trackedOrderMcpSo?.source_activation_state?.target_event_to_watch === "mcp_attributed_order" &&
      Number(trackedOrderMcpSo?.source_activation_state?.current_counts?.mcp_tool_calls ?? 0) >= 1 &&
      Number(trackedOrderMcpSo?.source_activation_state?.current_counts?.qualified_cart_landings ?? 0) >= 1 &&
      trackedOrderMcpSo?.buyer_handoff_url === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
      trackedOrderMcpSo?.primary_order_handoff_url === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
      trackedOrderMcpSo?.source_specific_first_run_url?.includes("/r/run/mcp_so/generic_streamable_http") &&
      trackedOrderMcpSo?.source_specific_first_run_shell_url?.includes("format=sh") &&
      trackedOrderMcpSo?.buyer_ready_summary?.includes("Exact SKU 1066") &&
      trackedOrderMcpSo?.product?.sku === "1066" &&
      trackedOrderMcpSo?.product?.variant_id === "53472879935856" &&
      trackedOrderMcpSo?.product?.product_url === "https://packrift.com/products/10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle" &&
      trackedOrderMcpSo?.buyer_action_url?.startsWith("https://mcp.packrift.com/r/cart/1066") &&
      trackedOrderMcpSo?.buyer_action_url?.includes("mcp_source_context=mcp_so") &&
      trackedOrderMcpSo?.buyer_action_url?.includes("mcp_install_target=generic_streamable_http") &&
      trackedOrderMcpSo?.required_shopify_cart_attributes?.includes("packrift_mcp_source_context") &&
      trackedOrderMcpSo?.required_shopify_cart_attributes?.includes("packrift_mcp_install_target") &&
      trackedOrderMcpSo?.attribution_rule?.includes("packrift_mcp_source_context") &&
      trackedOrderMcpSo?.checkout_guardrails?.some((rule) => rule.includes("do not place an order without explicit approval")) &&
      trackedOrderMcpSo?.no_order_created_by_this_page === true &&
      trackedOrderMcpSo?.buyer_confirmation_required === true &&
      trackedOrderMcpSo?.copy_ready_messages?.buyer_request?.includes("only place the order if it is actually approved") &&
      trackedOrderMcpSo?.copy_ready_messages?.agent_prompt?.includes("Required tool sequence") &&
      trackedOrderMcpSo?.browser_live_confirmation?.status === "available" &&
      trackedOrderMcpSo?.browser_live_confirmation?.endpoint?.includes("packrift_mcp_source=mcp_so") &&
      trackedOrderMcpSo?.browser_live_confirmation?.required_final_tool === "create_cart_url" &&
      trackedOrderMcpSo?.browser_live_confirmation?.required_cart_url_prefix === "https://mcp.packrift.com/r/cart/1066" &&
      Array.isArray(trackedOrderMcpSo?.browser_live_confirmation?.sequence) &&
      trackedOrderMcpSo?.proof_gate?.name === "mcp_attributed_order" &&
      trackedOrderMcpSoHtmlResult.ok &&
      trackedOrderMcpSoHtmlResult.text.includes("Packrift MCP Buyer Handoff") &&
      trackedOrderMcpSoHtmlResult.text.includes("Review source-preserved cart") &&
      trackedOrderMcpSoHtmlResult.text.includes("Current source proof") &&
      trackedOrderMcpSoHtmlResult.text.includes("Run live MCP confirmation") &&
      trackedOrderMcpSoHtmlResult.text.includes("Live MCP Confirmation") &&
      trackedOrderMcpSoHtmlResult.text.includes("Review fresh MCP cart") &&
      trackedOrderMcpSoHtmlResult.text.includes("mcp_order_handoff_live_confirmation") &&
      trackedOrderMcpSoHtmlResult.text.includes("Source Attribution Required") &&
      trackedOrderMcpSoHtmlResult.text.includes("packrift_mcp_source_context") &&
      mcpPageAnalyticsDiagnostics.order_handoff_html &&
      trackedOrderMcpSoHtmlResult.text.includes("Product") &&
      trackedOrderMcpSoMarkdownResult.ok &&
      trackedOrderMcpSoMarkdownResult.text.includes("Buyer/Reviewer Order Handoff") &&
      trackedOrderMcpSoMarkdownResult.text.includes("Current Source Proof") &&
      trackedOrderMcpSoMarkdownResult.text.includes("Browser Live Confirmation") &&
      trackedOrderMcpSoMarkdownResult.text.includes("Source Attribution Required") &&
      sourceOrderResourceMarkdownResult.value?.result?.contents?.[0]?.text?.includes("Buyer/Reviewer Order Handoff") &&
      sourceActivationQueueHtmlResult.text.includes("Shell script") &&
      sourceActivationQueueHtmlResult.text.includes("Update card") &&
      sourceActivationQueueHtmlResult.text.includes("mcp-directory-update/") &&
      sourceActivationQueueHtmlResult.text.includes("/r/activate/") &&
      sourceActivationQueueHtmlResult.text.includes("Experiments") &&
      revenueConversionQueue?.release === "PACKRIFT-MCP-REVENUE-CONVERSION-QUEUE-R02" &&
      revenueConversionQueue?.canonical_endpoint === MCP_ENDPOINT &&
      revenueConversionQueue?.source_queue_release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      revenueConversionQueue?.snapshot_coverage?.operator_url ===
        "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.json?limit=20000&order_days=90&order_limit=250" &&
      revenueConversionQueue?.links?.revenue_conversion_queue_json === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      revenueConversionQueue?.links?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      revenueConversionQueue?.links?.source_activation_queue_json === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      revenueConversionQueue?.links?.ga4_funnel_proof === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json" &&
      revenueConversionQueue?.proof_gate?.order_or_revenue_required?.includes("first_party_mcp_orders") &&
      typeof revenueConversionQueue?.proof_gate?.current_orders === "number" &&
      typeof revenueConversionQueue?.proof_gate?.current_revenue === "number" &&
      typeof revenueConversionQueue?.proof_gate?.visitor_gate_remaining === "number" &&
      typeof revenueConversionQueue?.row_count === "number" &&
      Array.isArray(revenueConversionQueue?.rows) &&
      (revenueConversionQueue?.rows?.length === 0 ||
        revenueConversionQueue?.rows?.every(
          (row) =>
            row.status === "buyer_checkout_needed" &&
            row.target_event_to_watch === "mcp_attributed_order" &&
            row.mcp_source_context === row.source &&
            typeof row.mcp_install_target === "string" &&
            row.buyer_handoff_url?.startsWith("https://mcp.packrift.com/r/order/") &&
            row.buyer_action_url?.startsWith("https://mcp.packrift.com/r/cart/1066") &&
            row.source_preserving_cart_url?.includes(`mcp_source_context=${row.source}`) &&
            row.product?.sku === "1066" &&
            row.product?.variant_id === "53472879935856" &&
            row.order_proof_watch === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json" &&
            row.proof_gate?.includes("first_party_mcp_orders") &&
            row.suppression_rule?.includes("Do not count") &&
            row.acceptance_criteria?.some((rule) => rule.includes("Shopify order") || rule.includes("GA4 purchase"))
        )) &&
      revenueConversionQueueMarkdownResult.ok &&
      revenueConversionQueueMarkdownResult.text.includes("Packrift MCP Revenue Conversion Queue") &&
      revenueConversionQueueMarkdownResult.text.includes("Required evidence") &&
      revenueConversionQueueHtmlResult.ok &&
      revenueConversionQueueHtmlResult.text.includes("Packrift MCP Revenue Conversion Queue") &&
      revenueConversionQueueHtmlResult.text.includes("Revenue proof boundary") &&
      revenueConversionQueueHtmlResult.text.includes("Buyer request") &&
      mcpPageAnalyticsDiagnostics.revenue_queue_html &&
      revenueConversionQueueHtmlResult.text.includes("Order attribution required") &&
      sourceActivationCline?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-PACKET-R04" &&
      sourceActivationCline?.source === "cline_mcp_marketplace" &&
      sourceActivationCline?.preferred_target === "cline" &&
      ["real_host_tool_call_needed", "buyer_checkout_needed"].includes(sourceActivationCline?.status) &&
      (sourceActivationCline?.target_event_to_watch?.startsWith("mcp_tool_call") ||
        ["mcp_first_run_execution", "mcp_install_intent", "mcp_attributed_order"].includes(
          sourceActivationCline?.target_event_to_watch
        )) &&
      sourceActivationCline?.source_aware_endpoint?.includes("packrift_mcp_source=cline_mcp_marketplace") &&
      sourceActivationCline?.source_aware_endpoint?.includes("packrift_mcp_target=cline") &&
      sourceActivationCline?.cline_real_host_run?.mcp_json?.includes('"type": "streamableHttp"') &&
      sourceActivationCline?.cline_real_host_run?.acceptance_gate?.includes("browser proof") &&
      sourceActivationCline?.copy_ready?.agent_prompt?.includes("create_cart_url") &&
      sourceActivationCline?.source_order_handoff?.buyer_handoff_url === "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html" &&
      sourceActivationCline?.buyer_handoff_preview?.buyer_action_url?.includes("mcp_source_context=cline_mcp_marketplace") &&
      sourceActivationCline?.links?.source_packet_html === "https://mcp.packrift.com/ai/mcp-source-activation/cline_mcp_marketplace.html" &&
      sourceActivationClineMarkdownResult.ok &&
      sourceActivationClineMarkdownResult.text.includes("Packrift MCP Source Activation Packet") &&
      sourceActivationClineMarkdownResult.text.includes("Cline Real-Host Run") &&
      sourceActivationClineMarkdownResult.text.includes("First-run shell one-liner") &&
      sourceActivationClineHtmlResult.ok &&
      sourceActivationClineHtmlResult.text.includes("Packrift MCP Source Activation") &&
      sourceActivationClineHtmlResult.text.includes("Cline Real-Host Run") &&
      sourceActivationClineHtmlResult.text.includes("Copy-Ready External Request") &&
      sourceActivationHostPacketsOk &&
      activationExperiments?.release === "PACKRIFT-MCP-ACTIVATION-EXPERIMENTS-R13" &&
      activationExperiments?.canonical_endpoint === MCP_ENDPOINT &&
      activationExperiments?.source_queue_release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      activationExperiments?.agent_adoption_progress?.release === "PACKRIFT-MCP-AGENT-ADOPTION-PROGRESS-R02" &&
      activationExperiments?.snapshot_coverage?.operator_url ===
        "https://mcp.packrift.com/ai/mcp-activation-experiments.json?limit=20000&order_days=90&order_limit=250" &&
      activationExperiments?.proof_boundaries?.ga4_visitor_gate?.includes("MCP tool calls") &&
      typeof activationExperiments?.source_snapshot?.unique_qualified_mcp_identity_signals === "number" &&
      typeof activationExperiments?.source_snapshot?.unique_qualified_mcp_session_ids === "number" &&
      typeof activationExperiments?.experiment_count === "number" &&
      typeof activationExperiments?.critical_count === "number" &&
      Array.isArray(activationExperiments?.blocking_goal_gates) &&
      Array.isArray(activationExperiments?.experiments) &&
      activationExperiments?.links?.source_activation_queue_json === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      activationExperiments?.links?.activation_experiments_html === "https://mcp.packrift.com/ai/mcp-activation-experiments.html" &&
      activationExperiments?.links?.activation_wave_json === "https://mcp.packrift.com/ai/mcp-activation-wave.json" &&
      activationExperiments?.links?.activation_wave_html === "https://mcp.packrift.com/ai/mcp-activation-wave.html" &&
      activationExperiments?.links?.eval_pack_template === "https://mcp.packrift.com/ai/mcp-eval-pack.json?source={source}" &&
      activationExperiments?.experiments?.every(
        (experiment) =>
          typeof experiment.source === "string" &&
          typeof experiment.hypothesis === "string" &&
          typeof experiment.target_event_to_watch === "string" &&
          typeof experiment.success_gate === "string" &&
          Array.isArray(experiment.suppression_rules) &&
          experiment.suppression_rules.some((rule) => rule.includes("Do not ")) &&
          experiment.tracked_install_url?.startsWith("https://mcp.packrift.com/r/install/") &&
          experiment.tracked_first_run_url?.startsWith("https://mcp.packrift.com/r/run/") &&
          experiment.tracked_first_run_shell_url?.startsWith("https://mcp.packrift.com/r/run/") &&
          experiment.tracked_first_run_shell_url?.includes("format=sh") &&
          experiment.first_run_shell_one_liner?.includes("format=sh") &&
          experiment.directory_update_card_json_url?.startsWith("https://mcp.packrift.com/ai/mcp-directory-update/") &&
          experiment.source_order_handoff?.buyer_handoff_url?.startsWith("https://mcp.packrift.com/r/order/") &&
          experiment.buyer_handoff_preview?.checkout_guardrail?.includes("does not place an order") &&
          experiment.eval_pack_json_url?.startsWith("https://mcp.packrift.com/ai/mcp-eval-pack.json?source=") &&
          experiment.copy_ready_activation_request?.includes("mcp-directory-update/") &&
          experiment.copy_ready_activation_request?.includes("mcp-eval-pack.json") &&
          experiment.copy_ready_activation_request?.includes("Claude Code:") &&
          experiment.copy_ready_host_configs?.generic_mcp_json?.includes('"mcpServers"') &&
          experiment.copy_ready_host_configs?.agent_prompt?.includes("create_cart_url") &&
          experiment.copy_ready_host_configs?.curl_script?.includes("create_cart_url") &&
          experiment.copy_ready_host_configs?.first_run_shell_one_liner?.includes("format=sh") &&
          experiment.fast_activation_path?.first_run_shell_one_liner?.includes("format=sh") &&
          experiment.reviewer_activation_runner_url?.startsWith("https://mcp.packrift.com/r/activate/") &&
          experiment.reviewer_activation_shell_url?.includes("format=sh") &&
          experiment.copy_ready_activation_request?.includes("Shell activation script") &&
          experiment.expected_snapshot_delta?.funnel_snapshot &&
          experiment.measurement_urls?.ga4_funnel_proof === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json"
      ) &&
      activationExperimentsMarkdownResult.ok &&
      activationExperimentsMarkdownResult.text.includes("Packrift MCP Activation Experiments") &&
      activationExperimentsMarkdownResult.text.includes("Agent Adoption Progress") &&
      activationExperimentsMarkdownResult.text.includes("MCP tool calls") &&
      activationExperimentsMarkdownResult.text.includes("format=sh") &&
      activationExperimentsHtmlResult.ok &&
      activationExperimentsHtmlResult.text.includes("Packrift MCP Activation Experiments") &&
      activationExperimentsHtmlResult.text.includes("Proof boundaries") &&
      activationExperimentsHtmlResult.text.includes("Adoption:") &&
      activationExperimentsHtmlResult.text.includes("Expected snapshot delta") &&
      activationExperimentsHtmlResult.text.includes("Suppression rules") &&
      activationExperimentsHtmlResult.text.includes("Copy-ready activation request") &&
      activationExperimentsHtmlResult.text.includes("Copy-ready host configs") &&
      activationExperimentsHtmlResult.text.includes("First-run shell") &&
      activationExperimentsHtmlResult.text.includes("Shell script") &&
      activationWave?.release === "PACKRIFT-MCP-ACTIVATION-WAVE-R05" &&
      activationWave?.canonical_endpoint === MCP_ENDPOINT &&
      activationWave?.source_queue_release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      activationWave?.snapshot_coverage?.operator_url ===
        "https://mcp.packrift.com/ai/mcp-activation-wave.json?limit=20000&order_days=90&order_limit=250" &&
      activationWave?.links?.activation_wave_operator_json === activationWave?.snapshot_coverage?.operator_url &&
      activationWave?.links?.activation_wave_tasks_jsonl === MCP_ACTIVATION_WAVE_TASKS_JSONL_URL &&
      activationWave?.links?.activation_wave_tasks_csv === MCP_ACTIVATION_WAVE_TASKS_CSV_URL &&
      activationWave?.no_duplicate_work_rule?.includes("Do not build a separate Packrift CLI") &&
      activationWave?.tool_call_gap?.material_usage_threshold === 50 &&
      activationWave?.links?.activation_wave_runner_shell === MCP_ACTIVATION_WAVE_RUNNER_URL &&
      activationWave?.links?.one_command_wave_runner?.includes("PACKRIFT_EXTERNAL_ACTIVATION=1") &&
      activationWave?.links?.one_command_wave_runner?.includes(MCP_ACTIVATION_WAVE_RUNNER_URL) &&
      activationWave?.links?.one_command_full_capture_runner?.includes("PACKRIFT_ACTIVATION_WAVE_SCOPE=full") &&
      activationWave?.links?.one_command_full_capture_runner?.includes(MCP_ACTIVATION_WAVE_RUNNER_URL) &&
      typeof activationWave?.tool_call_gap?.remaining_to_threshold === "number" &&
      typeof activationWave?.tool_call_gap?.expected_tool_call_lift_if_all_tasks_run === "number" &&
      activationWave?.tool_call_gap?.expected_tool_call_lift_if_all_tasks_run > 0 &&
      activationWave?.tool_call_gap?.projected_external_qualified_mcp_tool_calls_after_wave >
        activationWave?.tool_call_gap?.current_external_qualified_mcp_tool_calls &&
      activationWave?.tool_call_gap?.enough_to_clear_material_tool_usage_gate === true &&
      typeof activationWave?.tool_call_gap?.full_capture_source_count === "number" &&
      activationWave?.tool_call_gap?.full_capture_source_count >= activationWave?.wave_tasks?.length &&
      typeof activationWave?.tool_call_gap?.full_capture_expected_tool_call_lift_if_all_tasks_run === "number" &&
      activationWave?.tool_call_gap?.full_capture_expected_tool_call_lift_if_all_tasks_run > 0 &&
      activationWave?.tool_call_gap?.projected_external_qualified_mcp_tool_calls_after_full_capture >
        activationWave?.tool_call_gap?.current_external_qualified_mcp_tool_calls &&
      activationWave?.full_capture_wave?.scope === "all_current_tool_call_sources" &&
      activationWave?.full_capture_wave?.runner_env?.includes("PACKRIFT_ACTIVATION_WAVE_SCOPE=full") &&
      activationWave?.full_capture_wave?.source_count === activationWave?.tool_call_gap?.full_capture_source_count &&
      activationWave?.full_capture_wave?.tasks?.length === activationWave?.full_capture_wave?.source_count &&
      activationWave?.full_capture_wave?.tasks?.length >= activationWave?.wave_tasks?.length &&
      activationWave?.full_capture_wave?.tasks?.every(
        (task) =>
          typeof task.source === "string" &&
          (task.target_event_to_watch?.startsWith("mcp_tool_call") ||
            ["mcp_first_run_execution", "mcp_first_run_intent", "mcp_install_intent"].includes(task.target_event_to_watch)) &&
          task.external_activation_required === true &&
          task.expected_tool_call_lift > 0 &&
          task.tracked_first_run_shell_url?.includes("format=sh") &&
          task.copy_ready_host_configs?.generic_mcp_json?.includes('"mcpServers"') &&
          task.success_gate?.includes("external-qualified MCP tool calls")
      ) &&
      activationWave?.full_capture_wave?.tasks?.some((task) =>
        ["official_registry", "glama_connector", "cline_mcp_marketplace", "browse_sh"].includes(task.source)
      ) &&
      Array.isArray(activationWave?.blocking_goal_gates) &&
      Array.isArray(activationWave?.suppression_rules) &&
      activationWave?.suppression_rules?.some((rule) => rule.includes("Do not count this activation wave page")) &&
      activationWave?.suppression_rules?.some((rule) => rule.includes("Full-source capture mode")) &&
      Array.isArray(activationWave?.wave_tasks) &&
      activationWave?.wave_tasks?.length > 0 &&
      activationWaveTasksJsonlResult.ok &&
      activationWaveTasksCsvResult.ok &&
      activationWaveTaskRows.length === activationWave?.full_capture_wave?.source_count &&
      activationWaveTaskRows.some((row) => row.in_threshold_wave === true) &&
      activationWaveTaskRows.every(
        (row) =>
          row.release === activationWave?.release &&
          row.canonical_endpoint === MCP_ENDPOINT &&
          row.external_activation_required === true &&
          row.expected_tool_call_lift > 0 &&
          row.one_command_external_runner?.includes("/r/run/") &&
          row.tracked_first_run_shell_url?.includes("format=sh") &&
          row.eval_pack_json_url?.startsWith("https://mcp.packrift.com/ai/mcp-eval-pack.json?source=") &&
          row.buyer_handoff_url?.startsWith("https://mcp.packrift.com/r/order/") &&
          row.no_duplicate_work_rule?.includes("Do not build a separate Packrift CLI")
      ) &&
      activationWaveTasksCsvResult.text.startsWith("release,wave_rank,in_threshold_wave,source,preferred_target") &&
      activationWaveTasksCsvResult.text.includes("one_command_external_runner") &&
      activationWaveTasksCsvResult.text.includes("https://mcp.packrift.com/r/run/") &&
      activationWave?.wave_tasks?.every(
        (task) =>
          typeof task.source === "string" &&
          (task.target_event_to_watch?.startsWith("mcp_tool_call") ||
            ["mcp_first_run_execution", "mcp_first_run_intent", "mcp_install_intent"].includes(task.target_event_to_watch)) &&
          task.external_activation_required === true &&
          task.expected_tool_call_lift > 0 &&
          task.source_aware_endpoint?.startsWith(`${MCP_ENDPOINT}?`) &&
          task.tracked_install_json_url?.startsWith("https://mcp.packrift.com/r/install/") &&
          task.tracked_first_run_shell_url?.includes("format=sh") &&
          task.reviewer_activation_shell_url?.includes("format=sh") &&
          task.one_command_external_runner?.includes("format=sh") &&
          task.eval_pack_json_url?.startsWith("https://mcp.packrift.com/ai/mcp-eval-pack.json?source=") &&
          task.directory_update_card_json_url?.startsWith("https://mcp.packrift.com/ai/mcp-directory-update/") &&
          task.copy_ready_activation_request?.includes("MCP") &&
          task.copy_ready_host_configs?.generic_mcp_json?.includes('"mcpServers"') &&
          task.agent_prompt?.includes("create_cart_url") &&
          Array.isArray(task.must_not_count) &&
          task.must_not_count.some((rule) => rule.includes("Do not ")) &&
          task.success_gate?.includes("external-qualified MCP tool calls")
      ) &&
      activationWave?.wave_tasks?.some((task) => ["cline_mcp_marketplace", "glama_connector", "browse_sh"].includes(task.source)) &&
      activationWaveMarkdownResult.ok &&
      activationWaveMarkdownResult.text.includes("Packrift MCP Activation Wave") &&
      activationWaveMarkdownResult.text.includes("No Duplicate Work Rule") &&
      activationWaveMarkdownResult.text.includes("Tool-Call Gap") &&
      activationWaveMarkdownResult.text.includes("Full Source Capture") &&
      activationWaveMarkdownResult.text.includes("Automation Exports") &&
      activationWaveMarkdownResult.text.includes(MCP_ACTIVATION_WAVE_TASKS_JSONL_URL) &&
      activationWaveMarkdownResult.text.includes("Copy-Ready Source Requests") &&
      activationWaveMarkdownResult.text.includes(MCP_ACTIVATION_WAVE_RUNNER_URL) &&
      activationWaveHtmlResult.ok &&
      activationWaveHtmlResult.text.includes("Packrift MCP Activation Wave") &&
      activationWaveHtmlResult.text.includes("No duplicate work") &&
      activationWaveHtmlResult.text.includes("Full-source capture runner") &&
      activationWaveHtmlResult.text.includes("Full operator wave") &&
      activationWaveHtmlResult.text.includes("JSONL tasks") &&
      activationWaveHtmlResult.text.includes("CSV tasks") &&
      activationWaveHtmlResult.text.includes("Source-aware endpoint") &&
      activationWaveHtmlResult.text.includes("Copy-ready host configs") &&
      activationWaveHtmlResult.text.includes("One-command external runner") &&
      activationWaveHtmlResult.text.includes("Do not count") &&
      activationWaveRunnerResult.ok &&
      activationWaveRunnerResult.text.includes("#!/usr/bin/env bash") &&
      activationWaveRunnerResult.text.includes("PACKRIFT_EXTERNAL_ACTIVATION=1") &&
      activationWaveRunnerResult.text.includes("PACKRIFT_ACTIVATION_WAVE_SCOPE=full") &&
      activationWaveRunnerResult.text.includes("Refusing to execute") &&
      activationWaveRunnerResult.text.includes("mcp-source-activation-queue.json") &&
      activationWaveRunnerResult.text.includes("/r/run/") &&
      activationWaveRunnerResult.text.includes("format=sh") &&
      externalActivationBrief?.release === "PACKRIFT-MCP-EXTERNAL-ACTIVATION-BRIEF-R05" &&
      externalActivationBrief?.canonical_endpoint === MCP_ENDPOINT &&
      externalActivationBrief?.activation_wave_release === activationWave?.release &&
      externalActivationBrief?.source_queue_release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      externalActivationBrief?.proof_urls?.external_activation_brief_json === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      externalActivationBrief?.proof_urls?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      externalActivationBrief?.proof_urls?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      externalActivationBrief?.proof_urls?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      externalActivationBrief?.proof_urls?.external_activation_brief_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      externalActivationBrief?.proof_urls?.activation_wave_runner_shell === MCP_ACTIVATION_WAVE_RUNNER_URL &&
      externalActivationBrief?.external_runner?.selected_contact_ready?.includes("PACKRIFT_EXTERNAL_ACTIVATION=1") &&
      externalActivationBrief?.external_runner?.selected_contact_ready?.includes(MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL) &&
      externalActivationBrief?.external_runner?.selected_contact_ready_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      externalActivationBrief?.external_runner?.threshold_wave?.includes("PACKRIFT_EXTERNAL_ACTIVATION=1") &&
      externalActivationBrief?.external_runner?.threshold_wave?.includes(MCP_ACTIVATION_WAVE_RUNNER_URL) &&
      externalActivationBrief?.goal_summary?.material_usage?.threshold === 50 &&
      externalActivationBrief?.goal_summary?.material_usage?.expected_tool_call_lift_if_selected_runs_complete ===
        externalActivationBrief?.selected_external_runs?.reduce((total, task) => total + Number(task.expected_tool_call_lift ?? 0), 0) &&
      externalActivationBrief?.goal_summary?.qualified_visitors?.threshold >= 1000 &&
      externalActivationBrief?.goal_summary?.cart_and_order?.first_party_mcp_orders ===
        activationWave?.source_snapshot?.first_party_mcp_orders &&
      externalActivationBrief?.selected_external_run_count >= activationWave?.tool_call_gap?.required_sources_to_clear_gate &&
      externalActivationBrief?.selected_external_runs?.length === externalActivationBrief?.selected_external_run_count &&
      externalActivationBriefTaskRows.length === externalActivationBrief?.selected_external_run_count &&
      externalActivationBriefTasksJsonlResult.ok &&
      externalActivationBriefTasksJsonlResult.text.includes("one_command_external_runner") &&
      externalActivationBriefTasksJsonlResult.text.includes("review_handoff_primary_surface") &&
      externalActivationBriefTaskRows.every(
        (task) =>
          task.release === externalActivationBrief?.release &&
          task.source &&
          task.priority &&
          typeof task.priority_score === "number" &&
          task.activation_status?.includes("needed") &&
          task.tracked_first_run_shell_url?.includes("format=sh") &&
          task.one_command_external_runner?.includes("/r/run/") &&
          task.review_handoff_primary_surface &&
          task.copy_ready_generic_mcp_json?.includes('"mcpServers"') &&
          task.copy_ready_agent_prompt?.includes("create_cart_url") &&
          task.copy_ready_codex_command?.includes("packrift_mcp_source=") &&
          task.fast_activation_path_first_run_shell_url?.includes("format=sh") &&
          task.fast_activation_path_required_final_tool === "create_cart_url" &&
          task.success_gate?.includes("external-qualified MCP tool calls")
      ) &&
      externalActivationBriefTasksCsvResult.ok &&
      externalActivationBriefTasksCsvResult.text.includes("selected_rank,selected_contact_rank,wave_rank,source,preferred_target,priority,priority_score,activation_status") &&
      externalActivationBriefTasksCsvResult.text.includes("copy_ready_codex_command") &&
      externalActivationBriefTasksCsvResult.text.includes("fast_activation_path_required_final_tool") &&
      externalActivationBriefTasksCsvResult.text.includes("review_handoff_primary_surface") &&
      externalActivationBrief?.selection_rule?.includes("handoff readiness") &&
      externalActivationBrief?.selected_external_runs?.every(
        (task) =>
          task.source &&
          task.priority &&
          typeof task.priority_score === "number" &&
          task.activation_status?.includes("needed") &&
          task.tracked_first_run_shell_url?.includes("format=sh") &&
          task.eval_pack_json_url?.startsWith("https://mcp.packrift.com/ai/mcp-eval-pack.json?source=") &&
          task.one_command_external_runner?.includes("/r/run/") &&
          task.copy_ready_host_configs?.generic_mcp_json?.includes('"mcpServers"') &&
          task.copy_ready_host_configs?.agent_prompt?.includes("create_cart_url") &&
          task.fast_activation_path?.required_final_tool === "create_cart_url" &&
          task.external_review_handoff?.primary_surface &&
          task.external_review_handoff?.next_contact_action &&
          task.success_gate?.includes("external-qualified MCP tool calls")
      ) &&
      externalActivationBrief?.selected_external_runs?.some(
        (task) =>
          task.source === "glama_connector" &&
          task.external_review_handoff?.support_email === "support@glama.ai" &&
          task.external_review_handoff?.primary_surface === "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp"
      ) &&
      externalActivationBrief?.selected_external_runs?.some(
        (task) =>
          task.source === "mcplist_ai" &&
          task.external_review_handoff?.support_email === "contact@mcplist.ai" &&
          task.external_review_handoff?.primary_surface === "https://www.mcplist.ai/?search=packrift"
      ) &&
      externalActivationBrief?.selected_external_runs?.some(
        (task) =>
          task.source === "mcpserverfinder" &&
          task.external_review_handoff?.support_email === "info@mcpserverfinder.com" &&
          task.external_review_handoff?.primary_surface === "https://www.mcpserverfinder.com/?q=packrift"
      ) &&
      externalActivationBrief?.selected_external_runs?.some(
        (task) =>
          task.source === "docker_mcp_catalog" &&
          task.external_review_handoff?.public_comment_url === "https://github.com/docker/mcp-registry/pull/3388#issuecomment-4487822288"
      ) &&
      externalActivationBrief?.safety_rules?.some((rule) => rule.includes("real external MCP host")) &&
      externalActivationBrief?.safety_rules?.some((rule) => rule.includes("Do not place an order")) &&
      externalActivationBriefMarkdownResult.ok &&
      externalActivationBriefMarkdownResult.text.includes("Packrift MCP External Activation Brief") &&
      externalActivationBriefMarkdownResult.text.includes("External Runner") &&
      externalActivationBriefMarkdownResult.text.includes("Selected-runs runner") &&
      externalActivationBriefMarkdownResult.text.includes(MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL) &&
      externalActivationBriefMarkdownResult.text.includes(MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL) &&
      externalActivationBriefMarkdownResult.text.includes("Reviewer handoff") &&
      externalActivationBriefMarkdownResult.text.includes("Copy-Ready Requests") &&
      externalActivationBriefMarkdownResult.text.includes(MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL) &&
      externalActivationBriefHtmlResult.ok &&
      externalActivationBriefHtmlResult.text.includes("Packrift MCP External Activation Brief") &&
      externalActivationBriefHtmlResult.text.includes("Guarded selected-runs runner") &&
      externalActivationBriefHtmlResult.text.includes("JSONL tasks") &&
      externalActivationBriefHtmlResult.text.includes("CSV tasks") &&
      externalActivationBriefHtmlResult.text.includes("Full activation wave") &&
      externalActivationBriefHtmlResult.text.includes("Reviewer surface") &&
      externalActivationBriefRunnerResult.ok &&
      externalActivationBriefRunnerResult.text.includes("#!/usr/bin/env bash") &&
      externalActivationBriefRunnerResult.text.includes("selected-runs runner") &&
      externalActivationBriefRunnerResult.text.includes("PACKRIFT_EXTERNAL_ACTIVATION=1") &&
      externalActivationBriefRunnerResult.text.includes("mcplist_ai") &&
      externalActivationBriefRunnerResult.text.includes("mcpserverfinder") &&
      !externalActivationBriefRunnerResult.text.includes("mcphubz") &&
      !externalActivationBriefRunnerResult.text.includes("mcplane") &&
      activationCommandCenterResult.ok &&
      activationCommandCenterResult.text.includes("Packrift MCP Activation Command Center") &&
      activationCommandCenterResult.text.includes("Funnel snapshot") &&
      agentAdoptionProgress?.release === "PACKRIFT-MCP-AGENT-ADOPTION-PROGRESS-R02" &&
      agentAdoptionProgress?.source_funnel_release === "PACKRIFT-MCP-FUNNEL-SNAPSHOT-R23" &&
      agentAdoptionProgress?.snapshot_coverage?.snapshot_mode === "full_operator_snapshot" &&
      agentAdoptionProgress?.snapshot_coverage?.operator_url ===
        "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.json?limit=20000&order_days=90&order_limit=250" &&
      agentAdoptionProgress?.links?.funnel_snapshot_operator_json === funnelSnapshot?.snapshot_coverage?.operator_url &&
      agentAdoptionProgress?.progress?.goal_name === "thousands_of_qualified_agents_and_ai_commerce_workflows" &&
      typeof agentAdoptionProgress?.counts?.ga4_qualified_external_mcp_session_starts === "number" &&
      Array.isArray(agentAdoptionProgress?.next_actions) &&
      agentAdoptionProgressMarkdownResult.ok &&
      agentAdoptionProgressMarkdownResult.text.includes("Packrift MCP Agent Adoption Progress") &&
      agentAdoptionProgressMarkdownResult.text.includes("Proof Boundaries") &&
      agentAdoptionProgressHtmlResult.ok &&
      agentAdoptionProgressHtmlResult.text.includes("Packrift MCP Agent Adoption Progress") &&
      agentAdoptionProgressHtmlResult.text.includes("GA4 qualified visitors") &&
      agentAdoptionProgressHtmlResult.text.includes("Full operator snapshot") &&
      agentAdoptionProgressHtmlResult.text.includes("Source queue") &&
      buyerUseCases?.release === "PACKRIFT-MCP-BUYER-USE-CASES-R01" &&
      buyerUseCases?.use_cases?.length >= 6 &&
      buyerUseCasesHtmlResult.ok &&
      buyerUseCasesHtmlResult.text.includes("Packrift MCP Buyer Use Cases") &&
      buyerUseCasesHtmlResult.text.includes("Cart activation") &&
      buyerUseCasesHtmlResult.text.includes("Run generic check") &&
      cartActivation?.release === "PACKRIFT-MCP-CART-ACTIVATION-R02" &&
      cartActivation?.activation_paths?.length >= 4 &&
      cartActivation?.primary_rule?.includes("https://mcp.packrift.com/r/cart/") &&
      cartActivation?.proof_urls?.funnel_snapshot === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json" &&
      cartActivationHtmlResult.ok &&
      cartActivationHtmlResult.text.includes("Packrift MCP Cart Activation") &&
      cartActivationHtmlResult.text.includes("create_cart_url") &&
      cartActivationHtmlResult.text.includes("measured") &&
      firstRunProof?.release === "PACKRIFT-MCP-FIRST-RUN-PROOF-R01" &&
      firstRunProof?.canonical_endpoint === MCP_ENDPOINT &&
      firstRunProof?.live_demo?.sku === "1066" &&
      firstRunProof?.live_demo?.pricing?.unit_price != null &&
      firstRunProof?.live_demo?.pricing?.currency &&
      firstRunProof?.live_demo?.inventory?.in_stock === true &&
      firstRunProof?.live_demo?.cart?.url?.startsWith("https://mcp.packrift.com/r/cart/") &&
      hasAll(firstRunProof?.live_demo?.cart?.url ?? "", ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url", "mcp_handoff_id="]) &&
      workflowGallery?.release === "PACKRIFT-MCP-WORKFLOW-GALLERY-R02" &&
      workflowGallery?.canonical_endpoint === MCP_ENDPOINT &&
      workflowGallery?.workflow_count >= 5 &&
      workflowGallery?.workflows?.some((workflow) => workflow.id === "one_call_purchase_handoff_1066") &&
      workflowGallery?.workflows?.some((workflow) => workflow.id === "exact_sku_reorder_1066") &&
      workflowGallery?.workflows?.some((workflow) => workflow.id === "no_exact_match_quote_recovery") &&
      workflowGallery?.proof_urls?.automation_workflows === MCP_AUTOMATION_WORKFLOWS_JSON_URL &&
      workflowGallery?.proof_urls?.n8n_workflow_import === MCP_N8N_WORKFLOW_JSON_URL &&
      automationN8nNodeNames.includes("Create measured MCP cart URL") &&
      workflowGalleryHtmlResult.ok &&
      workflowGalleryHtmlResult.text.includes("Packrift MCP Workflow Gallery") &&
      workflowGalleryHtmlResult.text.includes("prepare_purchase_handoff") &&
      workflowGalleryHtmlResult.text.includes("Automation Templates") &&
      workflowGalleryHtmlResult.text.includes("Adoption progress") &&
      automationWorkflows?.release === "PACKRIFT-MCP-AUTOMATION-WORKFLOWS-R01" &&
      automationWorkflows?.canonical_endpoint === MCP_ENDPOINT &&
      automationWorkflows?.no_duplicate_work_rule?.includes("Do not create a separate Packrift CLI") &&
      automationWorkflows?.workflows?.n8n?.source === "n8n_automation" &&
      automationWorkflows?.workflows?.n8n?.import_url === MCP_N8N_WORKFLOW_JSON_URL &&
      automationWorkflows?.workflows?.n8n?.endpoint?.includes("packrift_mcp_source=n8n_automation") &&
      automationWorkflows?.workflows?.zapier?.endpoint?.includes("packrift_mcp_source=zapier_automation") &&
      automationWorkflows?.workflows?.pipedream?.endpoint?.includes("packrift_mcp_source=pipedream_automation") &&
      automationN8nNodeNames.includes("List Packrift MCP tools") &&
      automationN8nNodeNames.includes("Get live price") &&
      automationN8nNodeNames.includes("Check live inventory") &&
      automationN8nNodeNames.includes("Record measured cart landing") &&
      automationWorkflowsResult.text.includes("create_cart_url") &&
      automationWorkflowsResult.text.includes("get_pricing") &&
      automationWorkflowsResult.text.includes("check_inventory") &&
      automationWorkflowsResult.text.includes("Mcp-Session-Id") &&
      automationZapierSteps.length >= 5 &&
      JSON.stringify(automationZapierSteps).includes("create_cart_url") &&
      automationPipedreamCode.includes("fetch(endpoint") &&
      automationPipedreamCode.includes("create_cart_url") &&
      automationWorkflowsMarkdownResult.ok &&
      automationWorkflowsMarkdownResult.text.includes("Packrift MCP Automation Workflows") &&
      automationWorkflowsMarkdownResult.text.includes("n8n import JSON") &&
      automationWorkflowsHtmlResult.ok &&
      automationWorkflowsHtmlResult.text.includes("Packrift MCP Automation Workflows") &&
      automationWorkflowsHtmlResult.text.includes("n8n import JSON") &&
      n8nWorkflow?.name === "Packrift MCP first useful run" &&
      n8nWorkflowNodeNames.includes("Create measured MCP cart URL") &&
      n8nWorkflowNodeNames.includes("Record measured cart landing") &&
      n8nWorkflowResult.text.includes("create_cart_url") &&
      n8nWorkflowResult.text.includes("get_pricing") &&
      n8nWorkflowResult.text.includes("check_inventory") &&
      n8nWorkflowResult.text.includes("Mcp-Session-Id") &&
      n8nWorkflowResult.text.includes("packrift_mcp_source=n8n_automation") &&
      evalPack?.release === "PACKRIFT-MCP-EVAL-PACK-R01" &&
      evalPack?.canonical_endpoint === MCP_ENDPOINT &&
      evalPack?.acceptance_gate?.real_mcp_host_required === true &&
      evalPack?.acceptance_gate?.no_order_created === true &&
      evalPack?.cases?.some((test) => test.id === "host_tools_list") &&
      evalPack?.cases?.some((test) => test.id === "live_price") &&
      evalPack?.cases?.some((test) => test.id === "live_inventory") &&
      evalPack?.cases?.some((test) => test.id === "measured_cart_handoff") &&
      evalPack?.copy_ready?.one_line_shell?.includes("/r/run/") &&
      evalPack?.copy_ready?.one_line_shell?.includes("format=sh") &&
      evalPack?.tracked_actions?.activation_shell?.includes("/r/activate/") &&
      browserAgentBridge?.release === "PACKRIFT-BROWSER-AGENT-BRIDGE-R01" &&
      browserAgentBridge?.workflows?.length >= 3 &&
      browserbaseBrowseSkillPack?.release === "PACKRIFT-BROWSERBASE-BROWSE-SKILL-PACK-R07" &&
      browserbaseBrowseSkillPack?.browse_catalog_submission?.install_count_observed >= 6 &&
      browserbaseBrowseSkillPack?.canonical_endpoint === MCP_ENDPOINT &&
      browserbaseBrowseSkillPack?.source_aware_endpoint ===
        "https://mcp.packrift.com/mcp?packrift_mcp_source=browse_sh&packrift_mcp_target=generic_streamable_http" &&
      browserbaseBrowseSkillPack?.browse_skill_candidate?.skill_md_url === "https://mcp.packrift.com/SKILL.md" &&
      browserbaseBrowseSkillPack?.browse_skill_candidate?.source_aware_endpoint === browserbaseBrowseSkillPack?.source_aware_endpoint &&
      browserbaseBrowseSkillPack?.browse_catalog_submission?.check_command === "browse skills find packrift" &&
      browserbaseBrowseSkillPack?.browse_catalog_submission?.tracked_start_url === "https://mcp.packrift.com/r/start/browse_sh" &&
      browserbaseBrowseSkillPack?.browse_catalog_submission?.tracked_install_codex_url === "https://mcp.packrift.com/r/install/browse_sh/codex" &&
      browserbaseBrowseSkillPack?.browse_catalog_submission?.tracked_first_run_shell_url ===
        "https://mcp.packrift.com/r/run/browse_sh/generic_streamable_http?format=sh" &&
      browserbaseBrowseSkillPack?.skill_md?.canonical_url === "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md" &&
      browserbaseBrowseSkillPack?.demo_sequence?.length >= 6 &&
      browserbaseBrowseSkillPack?.demo_sequence?.some(
        (step) =>
          step?.url === browserbaseBrowseSkillPack?.source_aware_endpoint &&
          step?.request?.params?.arguments?.source_context === "browse_sh_first_cart_run"
      ) &&
      browserbaseBrowseSkillPack?.demo_sequence?.some((step) => step?.request?.params?.name === "prepare_purchase_handoff") &&
      browserbaseBrowseSkillPack?.demo_sequence?.some((step) => step?.request?.params?.name === "create_cart_url") &&
      directoryRefresh?.release === "PACKRIFT-MCP-DIRECTORY-REFRESH-R29" &&
      directoryRefresh?.live_proof?.mcp_start === "https://mcp.packrift.com/ai/mcp-start.json" &&
      directoryRefresh?.live_proof?.tracked_start_template === "https://mcp.packrift.com/r/start/{source}" &&
      directoryRefresh?.live_proof?.tracked_start_partner_demo === "https://mcp.packrift.com/r/start/partner_demo" &&
      directoryRefresh?.live_proof?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      directoryRefresh?.live_proof?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      directoryRefresh?.live_proof?.tracked_install_codex_generic?.startsWith("https://mcp.packrift.com/r/install/generic/codex") &&
      directoryRefresh?.live_proof?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      directoryRefresh?.live_proof?.tracked_run_generic_browser?.includes("format=html") &&
      directoryRefresh?.canonical_listing?.source_activation_queue_url === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      directoryRefresh?.canonical_listing?.activation_wave_url === MCP_ACTIVATION_WAVE_JSON_URL &&
      directoryRefresh?.canonical_listing?.activation_wave_markdown_url === MCP_ACTIVATION_WAVE_MARKDOWN_URL &&
      directoryRefresh?.canonical_listing?.activation_wave_html_url === MCP_ACTIVATION_WAVE_HTML_URL &&
      directoryRefresh?.live_proof?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      directoryRefresh?.canonical_listing?.tool_discovery_json_url === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      directoryRefresh?.canonical_listing?.tool_discovery_markdown_url === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      directoryRefresh?.live_proof?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      directoryRefresh?.live_proof?.tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      directoryRefresh?.live_proof?.tracked_run_generic_execute?.includes("execute=1") &&
      directoryRefresh?.live_proof?.copy_ready_agent_prompt_locations?.some((location) => String(location).includes("Copy agent prompt")) &&
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
      directoryRefresh?.canonical_listing?.first_useful_run_agent_prompt?.includes("create_cart_url") &&
      directoryRefresh?.canonical_listing?.client_config_url === "https://mcp.packrift.com/ai/mcp-client-config.json" &&
      directoryRefresh?.canonical_listing?.source_activation_sitemap_url === "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml" &&
      directoryRefresh?.canonical_listing?.marketplace_manifest_url === "https://mcp.packrift.com/.well-known/mcp-marketplace.json" &&
      directoryRefresh?.canonical_listing?.tracked_start_source_policy?.partner_specific_sources_allowed === true &&
      directoryRefresh?.live_proof?.marketplace_manifest === "https://mcp.packrift.com/.well-known/mcp-marketplace.json" &&
      directoryRefresh?.live_proof?.source_activation_sitemap === "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml" &&
      directoryRefresh?.live_proof?.activation_wave === MCP_ACTIVATION_WAVE_JSON_URL &&
      directoryRefresh?.live_proof?.activation_wave_markdown === MCP_ACTIVATION_WAVE_MARKDOWN_URL &&
      directoryRefresh?.live_proof?.activation_wave_html === MCP_ACTIVATION_WAVE_HTML_URL &&
      directoryRefresh?.live_proof?.browserbase_browse_skill_pack === "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json" &&
      directoryRefresh?.priority_refresh_targets?.length >= 27 &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "smithery") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "anthropic_connectors_directory") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "mcp_marketplace_io") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "mcplist_ai" && target.refresh_url === "mailto:contact@mcplist.ai") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "mcphubz" && target.refresh_url === "https://mcphubz.com/submit") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "mcp_blue" && target.refresh_url === "https://www.mcp.blue/submit") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "findmcp_dev" && target.refresh_url === "https://findmcp.dev/submit") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "mcplane" && target.refresh_url === "https://mcplane.com/mcp_servers/new") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "mcpserverfinder" && target.refresh_url === "mailto:info@mcpserverfinder.com") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "mcpserver_cc" && target.refresh_url === "https://mcpserver.cc/submit") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "mcpserverspot" && target.refresh_url === "https://www.mcpserverspot.com/submit") &&
      directoryRefresh?.priority_refresh_targets?.some((target) => target.id === "browse_sh" && target.tracked_install_urls?.codex?.startsWith("https://mcp.packrift.com/r/install/browse_sh/codex")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_install_urls?.codex?.startsWith("https://mcp.packrift.com/r/install/")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_run_urls?.generic_streamable_http_browser?.includes("format=html")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_run_urls?.generic_streamable_http_execute?.includes("execute=1")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.copy_ready_agent_prompt_url?.includes("format=html")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.agent_prompt_acceptance_rule?.includes("create_cart_url")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_reviewer_activation_url?.startsWith("https://mcp.packrift.com/r/activate/")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.tracked_reviewer_activation_html_url?.startsWith("https://mcp.packrift.com/r/activate/") && target.tracked_reviewer_activation_html_url?.includes("format=html")) &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.crawler_input_urls?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json") &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.crawler_input_urls?.tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md") &&
      directoryRefresh?.priority_refresh_targets?.every((target) => target.crawler_input_urls?.activation_wave === MCP_ACTIVATION_WAVE_JSON_URL) &&
      directoryRefresh?.recrawl_request?.includes("/r/install/") &&
      directoryRefresh?.recrawl_request?.includes("execute=1") &&
      directoryRefresh?.recrawl_request?.includes("Copy agent prompt") &&
      directoryRefresh?.recrawl_request?.includes("/r/activate/{source}?format=html") &&
      directoryRefresh?.recrawl_request?.includes("mcp-source-activation-queue.json") &&
      directoryRefresh?.recrawl_request?.includes("mcp-source-activation-sitemap.xml") &&
      directoryRefresh?.recrawl_request?.includes("mcp-activation-wave.json") &&
      directoryRefresh?.recrawl_request?.includes("mcp-tools.json") &&
      directoryRefresh?.recrawl_request?.includes(".well-known/mcp-marketplace.json") &&
      directorySubmitActions?.release === "PACKRIFT-MCP-DIRECTORY-SUBMIT-ACTIONS-R48" &&
      directorySubmitActions?.source_mcp_eval_pack === "https://mcp.packrift.com/ai/mcp-eval-pack.json" &&
      directorySubmitActions?.actions?.length >= 28 &&
      directorySubmitActions?.actions?.some((action) => action.id === "anthropic_connectors_directory" && action.action_status === "auth_gated_manual") &&
      directorySubmitActions?.actions?.some((action) => action.id === "smithery") &&
      directorySubmitActions?.actions?.some((action) => action.id === "cline_mcp_marketplace") &&
      directorySubmitActions?.actions?.some(
        (action) => action.id === "mcp_marketplace_io" && action.action_status === "email_draft_ready" && action.submission_url === "mailto:support@mcp-marketplace.io"
      ) &&
      directorySubmitActions?.actions?.some(
        (action) => action.id === "mcpmarket_com" && action.action_status === "email_draft_ready" && action.submission_url === "mailto:hi@mcpmarketplace.com"
      ) &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcplist_ai" && action.action_status === "email_draft_ready") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcphubz" && action.action_status === "login_required_contact_broken") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcp_blue" && action.action_status === "parked_domain_blocked") &&
      directorySubmitActions?.actions?.some(
        (action) => action.id === "findmcp_dev" && action.action_status === "email_draft_ready" && action.submission_url === "mailto:hello@coderai.dev"
      ) &&
      directorySubmitActions?.actions?.some(
        (action) => action.id === "mcplane" && action.action_status === "validator_rejected_contact_route_identified" && action.submission_url === "https://github.com/MCPlane"
      ) &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcpsolutions_dev" && action.action_status === "submitted_pending") &&
      directorySubmitActions?.actions?.some(
        (action) => action.id === "mcpserverfinder" && action.action_status === "email_draft_ready" && action.submission_url === "mailto:info@mcpserverfinder.com"
      ) &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcpserver_cc" && action.action_status === "submitted_pending") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcpserverspot" && action.action_status === "submitted_pending") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcp_so") &&
      directorySubmitActions?.actions?.some((action) => action.id === "punkpeye_awesome_mcp" && action.action_status === "submitted_pending") &&
      directorySubmitActions?.actions?.some(
        (action) =>
          action.id === "glama_server_listing" &&
          action.source_release_readiness?.release === "PACKRIFT-MCP-SOURCE-LISTING-READINESS-R01" &&
          action.source_release_readiness?.docker_readiness?.tools_list_without_token === true &&
          action.source_release_readiness?.docker_readiness?.expected_tools_count === 15
      ) &&
      directorySubmitActions?.actions?.some(
        (action) =>
          action.id === "punkpeye_awesome_mcp" &&
          action.source_release_readiness?.status === "blocked_by_glama_source_quality" &&
          action.source_release_readiness?.unblocker_update_card?.includes("glama_server_listing")
      ) &&
      directorySubmitActions?.actions?.some((action) => action.id === "browse_sh" && action.action_status === "catalog_live_installable") &&
      directorySubmitActions?.actions?.some((action) => action.id === "smithery" && action.action_status === "api_key_required") &&
      directorySubmitActions?.actions?.some((action) => action.id === "cline_mcp_marketplace" && action.action_status === "submitted_pending") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcp_so" && action.action_status === "submitted_pending") &&
      directorySubmitActions?.tracked_start_template === "https://mcp.packrift.com/r/start/{source}" &&
      directorySubmitActions?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      directorySubmitActions?.source_activation_sitemap === "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml" &&
      directorySubmitActions?.source_activation_experiments === "https://mcp.packrift.com/ai/mcp-activation-experiments.json" &&
      directorySubmitActions?.source_activation_wave === MCP_ACTIVATION_WAVE_JSON_URL &&
      directorySubmitActions?.source_activation_wave_markdown === MCP_ACTIVATION_WAVE_MARKDOWN_URL &&
      directorySubmitActions?.source_activation_wave_html === MCP_ACTIVATION_WAVE_HTML_URL &&
      directorySubmitActions?.source_activation_wave_runner_shell === MCP_ACTIVATION_WAVE_RUNNER_URL &&
      directorySubmitActions?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      directorySubmitActions?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      directorySubmitActions?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      directorySubmitActions?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      directorySubmitActions?.external_activation_brief_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      directorySubmitActions?.revenue_conversion_queue === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      directorySubmitActions?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      directorySubmitActions?.buyer_order_handoffs === MCP_BUYER_ORDER_HANDOFFS_JSON_URL &&
      directorySubmitActions?.buyer_order_handoffs_html === MCP_BUYER_ORDER_HANDOFFS_HTML_URL &&
      directorySubmitActions?.source_marketplace_manifest === "https://mcp.packrift.com/.well-known/mcp-marketplace.json" &&
      directorySubmitActions?.source_tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      directorySubmitActions?.source_tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md" &&
      directorySubmitActions?.source_usage_snapshot === "https://mcp.packrift.com/ai/mcp-usage-snapshot.json" &&
      directorySubmitActions?.source_funnel_snapshot === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json" &&
      directorySubmitActions?.source_ga4_funnel_proof === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json" &&
      directorySubmitActions?.source_install_actions === "https://mcp.packrift.com/ai/mcp-install-actions.json" &&
      directorySubmitActions?.public_comment_policy?.includes("Do not post another unsolicited update") &&
      directorySubmitActions?.tracked_config_template === "https://mcp.packrift.com/r/config/{source}" &&
      directorySubmitActions?.tracked_install_template === "https://mcp.packrift.com/r/install/{source}/{target}" &&
      directorySubmitActions?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      directorySubmitActions?.tracked_reviewer_activation_template === "https://mcp.packrift.com/r/activate/{source}" &&
      directorySubmitActions?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      directorySubmitActions?.tracked_order_handoff_template === "https://mcp.packrift.com/r/order/{source}" &&
      directorySubmitActions?.tracked_order_handoff_html_template === "https://mcp.packrift.com/r/order/{source}?format=html" &&
      directorySubmitActions?.first_useful_run_agent_prompt?.includes("Required tool sequence") &&
      directorySubmitActions?.first_useful_run_agent_prompt_success_criteria?.some((rule) => String(rule).includes("measured https://mcp.packrift.com/r/cart/1066")) &&
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
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_order_handoff?.startsWith("https://mcp.packrift.com/r/order/")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_order_handoff_html?.startsWith("https://mcp.packrift.com/r/order/") && action.proof_urls?.tracked_order_handoff_html?.includes("format=html")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tracked_order_handoff_json?.startsWith("https://mcp.packrift.com/r/order/") && action.proof_urls?.tracked_order_handoff_json?.includes("format=json")) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.install_actions === "https://mcp.packrift.com/ai/mcp-install-actions.json") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.usage_snapshot === "https://mcp.packrift.com/ai/mcp-usage-snapshot.json") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.funnel_snapshot === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.ga4_funnel_proof === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.source_activation_sitemap === "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.marketplace_manifest === "https://mcp.packrift.com/.well-known/mcp-marketplace.json") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.tool_discovery_markdown === "https://mcp.packrift.com/ai/spec-finder-tools.md") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.activation_experiments === "https://mcp.packrift.com/ai/mcp-activation-experiments.json") &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.activation_wave === MCP_ACTIVATION_WAVE_JSON_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.activation_wave_markdown === MCP_ACTIVATION_WAVE_MARKDOWN_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.activation_wave_html === MCP_ACTIVATION_WAVE_HTML_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.external_activation_brief_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.revenue_conversion_queue === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.buyer_order_handoffs === MCP_BUYER_ORDER_HANDOFFS_JSON_URL) &&
      directorySubmitActions?.actions?.every((action) => action.proof_urls?.buyer_order_handoffs_html === MCP_BUYER_ORDER_HANDOFFS_HTML_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.quickest_install_by_host?.cline?.startsWith("https://mcp.packrift.com/r/install/")) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.quickest_first_run_by_host?.claude_code?.startsWith("https://mcp.packrift.com/r/run/")) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.order_handoff?.startsWith("https://mcp.packrift.com/r/order/") && action.activation_packet?.order_handoff?.includes("format=html")) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.acceptance_gate?.some((rule) => String(rule).includes("real MCP host"))) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.acceptance_gate?.some((rule) => String(rule).includes("/r/order/{source}"))) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.source_activation_sitemap === "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml") &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.marketplace_manifest === "https://mcp.packrift.com/.well-known/mcp-marketplace.json") &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.live_tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json") &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.activation_wave === MCP_ACTIVATION_WAVE_JSON_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.activation_wave_markdown === MCP_ACTIVATION_WAVE_MARKDOWN_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.activation_wave_html === MCP_ACTIVATION_WAVE_HTML_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.external_activation_brief_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.revenue_conversion_queue === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.buyer_order_handoffs === MCP_BUYER_ORDER_HANDOFFS_JSON_URL) &&
      directorySubmitActions?.actions?.every((action) => action.activation_packet?.crawler_inputs?.buyer_order_handoffs_html === MCP_BUYER_ORDER_HANDOFFS_HTML_URL) &&
      directorySubmitActions?.actions?.every((action) => action.concise_email?.release === "PACKRIFT-MCP-DIRECTORY-CONCISE-EMAIL-R01") &&
      directorySubmitActions?.actions?.every((action) => action.concise_email?.body?.includes("https://mcp.packrift.com/mcp")) &&
      directorySubmitActions?.actions?.every((action) => action.concise_email?.body?.includes("mcp-tools.json")) &&
      directorySubmitActions?.actions?.every((action) => action.concise_email?.body?.includes("/r/activate/")) &&
      directorySubmitActions?.actions?.every((action) => action.concise_email?.body?.includes("mcp-eval-pack.json?source=")) &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcplist_ai" && action.concise_email?.to === "contact@mcplist.ai") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcpserverfinder" && action.concise_email?.to === "info@mcpserverfinder.com") &&
      directorySubmitActions?.source_install_matrix === "https://mcp.packrift.com/ai/mcp-install-matrix.json" &&
      directorySubmitActions?.source_client_config === "https://mcp.packrift.com/ai/mcp-client-config.json" &&
      directorySubmitActions?.source_eval_pack_template === "https://mcp.packrift.com/ai/mcp-eval-pack.json?source={source}" &&
      directorySubmitActions?.source_activation_queue_runtime?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      directorySubmitActions?.source_activation_queue_runtime?.status === "activation_needed" &&
      directorySubmitActions?.source_activation_queue_runtime?.operator_url === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json?limit=20000&order_days=90&order_limit=250" &&
      directorySubmitActions?.source_activation_queue_runtime?.row_count > 0 &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcp_so" && action.source_activation_state?.target_event_to_watch === "mcp_attributed_order" && action.source_activation_state?.primary_action_url === "https://mcp.packrift.com/r/order/mcp_so?format=html") &&
      directorySubmitActions?.actions?.some((action) => action.id === "glama_connector" && action.source_activation_state?.target_event_to_watch === "mcp_tool_call" && action.source_activation_state?.primary_action_url === "https://mcp.packrift.com/r/activate/glama_connector?format=html") &&
      directoryUpdateCline?.release === "PACKRIFT-MCP-DIRECTORY-UPDATE-CARD-R16" &&
      directoryUpdateCline?.source === "cline_mcp_marketplace" &&
      directoryUpdateCline?.source_activation_queue_runtime?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      directoryUpdateCline?.source_activation_state?.target_event_to_watch === "mcp_attributed_order" &&
      directoryUpdateCline?.source_activation_state?.primary_action_url === "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html" &&
      directoryUpdateCline?.canonical_listing?.endpoint === "https://mcp.packrift.com/mcp" &&
      directoryUpdateCline?.canonical_listing?.authentication === "none_required_for_hosted_endpoint" &&
      directoryUpdateCline?.canonical_listing?.tool_names?.includes("prepare_purchase_handoff") &&
      directoryUpdateCline?.canonical_listing?.tool_names?.length >= 15 &&
      directoryUpdateCline?.canonical_listing?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      directoryUpdateCline?.canonical_listing?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      directoryUpdateCline?.canonical_listing?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      directoryUpdateCline?.tracked_urls?.tool_discovery_json === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      directoryUpdateCline?.tracked_urls?.config?.startsWith("https://mcp.packrift.com/r/config/cline_mcp_marketplace") &&
      directoryUpdateCline?.tracked_urls?.first_run?.cline?.startsWith("https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline") &&
      directoryUpdateCline?.tracked_urls?.reviewer_activation_html === "https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=html" &&
      directoryUpdateCline?.tracked_urls?.order_handoff_html === "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html" &&
      directoryUpdateCline?.tracked_urls?.eval_pack === "https://mcp.packrift.com/ai/mcp-eval-pack.json?source=cline_mcp_marketplace" &&
      directoryUpdateCline?.tracked_urls?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      directoryUpdateCline?.tracked_urls?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      directoryUpdateCline?.acceptance_gate?.some((rule) => String(rule).includes("create_cart_url")) &&
      directoryUpdateCline?.acceptance_gate?.some((rule) => String(rule).includes("eval pack")) &&
      directoryUpdateCline?.copy_ready_recrawl_message?.includes(".well-known/mcp-marketplace.json") &&
      directoryUpdateCline?.copy_ready_recrawl_message?.includes("mcp-tools.json") &&
      directoryUpdateCline?.copy_ready_recrawl_message?.includes("Buyer/reviewer order handoff") &&
      directoryUpdateCline?.copy_ready_concise_email?.body?.includes("Acceptance check") &&
      directoryUpdateCline?.copy_ready_concise_email?.proof_urls?.tool_discovery === "https://mcp.packrift.com/ai/mcp-tools.json" &&
      directoryUpdateClineMarkdownResult.ok &&
      directoryUpdateClineMarkdownResult.text.includes("Packrift MCP Directory Update Card") &&
      directoryUpdateClineMarkdownResult.text.includes("Copy-Ready Concise Email") &&
      directoryUpdateClineMarkdownResult.text.includes("Live tool discovery JSON") &&
      directoryUpdateClineMarkdownResult.text.includes("cline_mcp_marketplace") &&
      directoryUpdateGlamaServer?.release === "PACKRIFT-MCP-DIRECTORY-UPDATE-CARD-R16" &&
      directoryUpdateGlamaServer?.source === "glama_server_listing" &&
      directoryUpdateGlamaServer?.source_release_readiness?.status === "ready_for_glama_admin_release" &&
      directoryUpdateGlamaServer?.source_release_readiness?.docker_readiness?.tools_list_without_token === true &&
      directoryUpdateGlamaServer?.source_release_readiness?.docker_readiness?.expected_resources_min >= 600 &&
      directoryUpdateGlamaServer?.source_release_readiness?.admin_steps?.some((step) => String(step).includes("release/sync")) &&
      directoryUpdatePunkpeye?.release === "PACKRIFT-MCP-DIRECTORY-UPDATE-CARD-R16" &&
      directoryUpdatePunkpeye?.source === "punkpeye_awesome_mcp" &&
      directoryUpdatePunkpeye?.source_release_readiness?.status === "blocked_by_glama_source_quality" &&
      directoryUpdateMcpSo?.source === "mcp_so" &&
      directoryUpdateMcpSo?.source_activation_queue_runtime?.release === "PACKRIFT-MCP-SOURCE-ACTIVATION-QUEUE-R26" &&
      directoryUpdateMcpSo?.source_activation_state?.target_event_to_watch === "mcp_attributed_order" &&
      directoryUpdateMcpSo?.source_activation_state?.primary_action_url === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
      directoryUpdateMcpSo?.tracked_urls?.config?.startsWith("https://mcp.packrift.com/r/config/mcp_so") &&
      directoryUpdateMcpSo?.acceptance_gate?.some((rule) => String(rule).includes("measured https://mcp.packrift.com/r/cart/1066")) &&
      directoryUpdateMarketplace?.source === "mcp_marketplace_io" &&
      directoryUpdateMarketplace?.directory?.action_status === "email_draft_ready" &&
      directoryUpdateMarketplace?.directory?.submission_url === "mailto:support@mcp-marketplace.io" &&
      directoryUpdateMarketplace?.directory?.stale_markers?.some((marker) => String(marker).includes("prepare_purchase_handoff")) &&
      directoryUpdateMarketplace?.tracked_urls?.first_run?.mcp_marketplace?.startsWith("https://mcp.packrift.com/r/run/mcp_marketplace_io/mcp_marketplace") &&
      directoryUpdateMarketplace?.copy_ready_recrawl_message?.includes("mcp_marketplace_io") &&
      directoryUpdateBrowse?.source === "browse_sh" &&
      directoryUpdateBrowse?.directory?.action_status === "catalog_live_installable" &&
      directoryUpdateBrowse?.tracked_urls?.install?.codex?.startsWith("https://mcp.packrift.com/r/install/browse_sh/codex") &&
      directoryUpdateBrowseMarkdownResult.ok &&
      directoryUpdateBrowseMarkdownResult.text.includes("Browserbase Browse / browse.sh") &&
      directoryUpdateMcplist?.source === "mcplist_ai" &&
      directoryUpdateMcplist?.directory?.action_status === "email_draft_ready" &&
      directoryUpdateMcplist?.tracked_urls?.config?.startsWith("https://mcp.packrift.com/r/config/mcplist_ai") &&
      directoryUpdateMcplist?.copy_ready_concise_email?.to === "contact@mcplist.ai" &&
      directoryUpdateMcpBlue?.source === "mcp_blue" &&
      directoryUpdateMcpBlue?.directory?.action_status === "parked_domain_blocked" &&
      directoryUpdateMcpBlue?.tracked_urls?.first_run?.generic_streamable_http?.startsWith("https://mcp.packrift.com/r/run/mcp_blue/generic_streamable_http") &&
      directoryUpdateMcpServerFinder?.source === "mcpserverfinder" &&
      directoryUpdateMcpServerFinder?.directory?.action_status === "email_draft_ready" &&
      directoryUpdateMcpServerFinder?.directory?.submission_url === "mailto:info@mcpserverfinder.com" &&
      directoryUpdateMcpServerFinder?.copy_ready_concise_email?.to === "info@mcpserverfinder.com" &&
      directoryUpdateMcpServerCc?.source === "mcpserver_cc" &&
      directoryUpdateMcpServerCc?.directory?.action_status === "submitted_pending" &&
      directoryUpdateMcpServerCc?.tracked_urls?.config?.startsWith("https://mcp.packrift.com/r/config/mcpserver_cc") &&
      directoryUpdateMcpServerSpot?.source === "mcpserverspot" &&
      directoryUpdateMcpServerSpot?.directory?.action_status === "submitted_pending" &&
      directoryUpdateMcpServerSpot?.tracked_urls?.config?.startsWith("https://mcp.packrift.com/r/config/mcpserverspot") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcp_marketplace_io" && action.proof_urls?.marketplace_manifest === "https://mcp.packrift.com/.well-known/mcp-marketplace.json") &&
      directorySubmitActions?.actions?.some((action) => action.id === "mcp_marketplace_io" && action.tracked_run_urls?.mcp_marketplace?.startsWith("https://mcp.packrift.com/r/run/mcp_marketplace_io/mcp_marketplace")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-start.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-client-config.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("/r/start/")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("/r/config/")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("/r/install/")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("One-click live proof")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("Copy agent prompt")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("Agent prompt acceptance rule")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("Activation proof rule")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("execute=1")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("Tracked Cline install action")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("Reviewer-to-real-MCP activation handoff")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("Reviewer activation browser runner")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("format=md")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-cart-activation.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-first-run-proof.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-workflow-gallery.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-source-activation-queue.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-source-activation-sitemap.xml")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes(".well-known/mcp-marketplace.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-activation-experiments.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-activation-wave.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-activation-wave-runner.sh")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("PACKRIFT_EXTERNAL_ACTIVATION=1")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-usage-snapshot.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("mcp-ga4-funnel-proof.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("claude-connector-submission.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("agent-capture-outreach.json")) &&
      directorySubmitActions?.actions?.some((action) => action.recrawl_message?.includes("browserbase-browse-skill-pack.json")) &&
      reviewerActivation?.release === "PACKRIFT-MCP-REVIEWER-ACTIVATION-R11" &&
      reviewerActivation?.target_source?.id === "generic" &&
      reviewerActivation?.target_source?.tracked_reviewer_activation_url?.startsWith("https://mcp.packrift.com/r/activate/generic") &&
      reviewerActivation?.target_source?.tracked_first_run_live_proof_url?.includes("execute=1") &&
      reviewerActivation?.target_source?.tracked_reviewer_activation_shell_url?.includes("format=sh") &&
      reviewerActivation?.copy_ready_host_configs?.source === "generic" &&
      reviewerActivation?.copy_ready_host_configs?.generic_mcp_json?.includes('"mcpServers"') &&
      reviewerActivation?.copy_ready_host_configs?.codex_command?.includes("packrift_mcp_source=generic") &&
      reviewerActivation?.agent_prompt?.includes("create_cart_url") &&
      reviewerActivation?.json_rpc_sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      reviewerActivation?.curl_script?.includes("tools/call") &&
      reviewerActivation?.curl_script?.includes("accept: application/json, text/event-stream") &&
      reviewerActivation?.curl_script?.includes("normalize_mcp_response") &&
      reviewerActivation?.real_mcp_client_run?.sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      reviewerActivation?.real_mcp_client_run?.agent_prompt?.includes("Required tool sequence") &&
      reviewerActivation?.real_mcp_client_run?.browser_executable === true &&
      reviewerActivation?.real_mcp_client_run?.browser_runner_url?.includes("format=html") &&
      reviewerActivation?.proof_urls?.tracked_reviewer_activation_shell?.includes("format=sh") &&
      reviewerActivation?.proof_urls?.usage_snapshot === "https://mcp.packrift.com/ai/mcp-usage-snapshot.json" &&
      trackedReviewerActivationGeneric?.release === "PACKRIFT-MCP-REVIEWER-ACTIVATION-R11" &&
      trackedReviewerActivationGeneric?.target_source?.id === "generic" &&
      trackedReviewerActivationGeneric?.source_aware_endpoint?.includes("packrift_mcp_source=generic") &&
      trackedReviewerActivationGeneric?.copy_ready_host_configs?.source_aware_endpoint?.includes("packrift_mcp_source=generic") &&
      trackedReviewerActivationGeneric?.copy_ready_host_configs?.generic_mcp_json?.includes("packrift_mcp_source=generic") &&
      trackedReviewerActivationGeneric?.copy_ready_host_configs?.agent_prompt?.includes("create_cart_url") &&
      trackedReviewerActivationGeneric?.real_mcp_client_run?.required_final_tool === "create_cart_url" &&
      trackedReviewerActivationGeneric?.real_mcp_client_run?.agent_prompt?.includes("create_cart_url") &&
      trackedReviewerActivationGeneric?.proof_urls?.tracked_reviewer_activation_shell?.includes("format=sh") &&
      trackedReviewerActivationShellResult.ok &&
      trackedReviewerActivationShellResult.text.includes("tools/call") &&
      trackedReviewerActivationShellResult.text.includes("accept: application/json, text/event-stream") &&
      trackedReviewerActivationShellResult.text.includes("normalize_mcp_response") &&
      trackedReviewerActivationShellResult.text.includes("packrift_mcp_source=generic") &&
      trackedReviewerActivationShellResult.text.includes("create_cart_url") &&
      trackedReviewerActivationCline?.release === "PACKRIFT-MCP-REVIEWER-ACTIVATION-R11" &&
      trackedReviewerActivationCline?.target_source?.id === "cline_mcp_marketplace" &&
      trackedReviewerActivationCline?.target_source?.preferred_target === "cline" &&
      trackedReviewerActivationCline?.source_aware_endpoint?.includes("packrift_mcp_target=cline") &&
      trackedReviewerActivationCline?.copy_ready_host_configs?.preferred_target === "cline" &&
      trackedReviewerActivationCline?.copy_ready_host_configs?.cline_mcp_json?.includes('"streamableHttp"') &&
      trackedReviewerActivationCline?.copy_ready_host_configs?.claude_code_command?.includes("packrift_mcp_source=cline_mcp_marketplace") &&
      trackedReviewerActivationCline?.proof_urls?.tracked_reviewer_activation_shell?.includes("format=sh") &&
      trackedReviewerActivationHtmlResult.ok &&
      trackedReviewerActivationHtmlResult.text.includes("Run real MCP check") &&
      trackedReviewerActivationHtmlResult.text.includes("Copy agent prompt") &&
      trackedReviewerActivationHtmlResult.text.includes("Shell script") &&
      trackedReviewerActivationHtmlResult.text.includes("Copy-Ready Host Configs") &&
      trackedReviewerActivationHtmlResult.text.includes("activation.real_mcp_client_run.endpoint") &&
      trackedReviewerActivationHtmlResult.text.includes("mcp_activation_cart_ready") &&
      trackedReviewerActivationHtmlResult.text.includes("mcp_session_id") &&
      trackedReviewerActivationHtmlResult.text.includes("activationSessionId") &&
      trackedReviewerActivationHtmlResult.text.includes("parseMcpResponse") &&
      trackedReviewerActivationHtmlResult.text.includes("application/json, text/event-stream") &&
      trackedReviewerActivationHtmlResult.text.includes("This records cart-ready only") &&
      trackedReviewerActivationHtmlResult.text.includes("create_cart_url") &&
      claudeConnectorSubmission?.release === "PACKRIFT-CLAUDE-CONNECTOR-SUBMISSION-R04" &&
      claudeConnectorSubmission?.status === "manual_submission_ready" &&
      claudeConnectorSubmission?.server?.remote_endpoint === "https://mcp.packrift.com/mcp" &&
      claudeConnectorSubmission?.server?.authentication === "none_required_for_hosted_endpoint" &&
      claudeConnectorSubmission?.claude_install?.tracked_config_url?.startsWith("https://mcp.packrift.com/r/config/anthropic_connectors_directory") &&
      claudeConnectorSubmission?.claude_install?.tracked_install_claude_code_url?.startsWith("https://mcp.packrift.com/r/install/anthropic_connectors_directory/claude_code") &&
      claudeConnectorSubmission?.claude_install?.tracked_first_run_claude_code_url?.startsWith("https://mcp.packrift.com/r/run/anthropic_connectors_directory/claude_code") &&
      claudeConnectorSubmission?.claude_install?.reviewer_activation_runner_url?.startsWith("https://mcp.packrift.com/r/activate/anthropic_connectors_directory") &&
      claudeConnectorSubmission?.claude_install?.source_aware_claude_code_command?.includes("packrift_mcp_source=anthropic_connectors_directory") &&
      claudeConnectorSubmission?.claude_install?.source_aware_mcp_json_config?.mcpServers?.packrift?.url?.includes("packrift_mcp_target=claude_code") &&
      claudeConnectorSubmission?.claude_install?.copy_ready_first_run_prompt?.includes("create_cart_url") &&
      claudeConnectorSubmission?.claude_install?.copy_ready_review_request?.includes("Claude connector activation request") &&
      claudeConnectorSubmission?.live_proof_urls?.usage_snapshot === "https://mcp.packrift.com/ai/mcp-usage-snapshot.json" &&
      claudeConnectorSubmission?.live_proof_urls?.funnel_snapshot === "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json" &&
      claudeConnectorSubmission?.live_proof_urls?.ga4_funnel_proof === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json" &&
      claudeConnectorSubmission?.live_proof_urls?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      claudeConnectorSubmission?.live_proof_urls?.activation_experiments === "https://mcp.packrift.com/ai/mcp-activation-experiments.json" &&
      claudeConnectorSubmission?.activation_readiness?.source === "anthropic_connectors_directory" &&
      claudeConnectorSubmission?.activation_readiness?.copy_ready_first_run_prompt?.includes("source=anthropic_connectors_directory") &&
      claudeConnectorSubmission?.activation_readiness?.required_first_run_tools?.includes("create_cart_url") &&
      claudeConnectorSubmission?.activation_readiness?.suppressions?.some((rule) => String(rule).includes("Do not count Packrift self-checks")) &&
      claudeConnectorSubmission?.checklist?.some((row) => row.item === "Legal and support links") &&
      claudeConnectorSubmission?.checklist?.some((row) => row.item === "Activation proof loop") &&
      agentCaptureOutreach?.release === "PACKRIFT-AGENT-CAPTURE-OUTREACH-R28" &&
      agentCaptureOutreach?.canonical_endpoint === MCP_ENDPOINT &&
      agentCaptureOutreachHtml.includes("Packrift Agent Capture Outreach") &&
      agentCaptureOutreachHtml.includes("Use This, Not A Duplicate Surface") &&
      agentCaptureOutreachHtml.includes("Priority Agent Capture Queue") &&
      agentCaptureOutreachHtml.includes("Activation queue") &&
      agentCaptureOutreachHtml.includes("External brief") &&
      agentCaptureOutreachHtml.includes("Task JSONL") &&
      agentCaptureOutreachHtml.includes("Task CSV") &&
      agentCaptureOutreachHtml.includes("Selected runner") &&
      agentCaptureOutreachHtml.includes("Acceptance check") &&
      agentCaptureOutreach?.priority_queue?.some((action) => action.id === "anthropic_connectors_directory") &&
      agentCaptureOutreach?.priority_queue?.some((action) => action.id === "browse_sh") &&
      agentCaptureOutreach?.directory_refreshes?.every((action) => action.concise_email?.release === "PACKRIFT-MCP-DIRECTORY-CONCISE-EMAIL-R01") &&
      agentCaptureOutreach?.directory_refreshes?.some((action) => action.id === "glama_server_listing" && action.source_release_readiness?.status === "ready_for_glama_admin_release") &&
      agentCaptureOutreach?.release === "PACKRIFT-AGENT-CAPTURE-OUTREACH-R28" &&
      agentCaptureOutreach?.directory_submit_actions?.release === "PACKRIFT-MCP-DIRECTORY-SUBMIT-ACTIONS-R48" &&
      agentCaptureOutreach?.activation_handoff?.canonical_endpoint === MCP_ENDPOINT &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.activation_experiments === "https://mcp.packrift.com/ai/mcp-activation-experiments.json" &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.activation_wave === MCP_ACTIVATION_WAVE_JSON_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.activation_wave_html === MCP_ACTIVATION_WAVE_HTML_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.activation_wave_runner_shell === MCP_ACTIVATION_WAVE_RUNNER_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.external_activation_brief_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.revenue_conversion_queue === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.buyer_order_handoffs === MCP_BUYER_ORDER_HANDOFFS_JSON_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.buyer_order_handoffs_html === MCP_BUYER_ORDER_HANDOFFS_HTML_URL &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.order_handoff_template === "https://mcp.packrift.com/r/order/{source}" &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.order_handoff_mcp_so === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.eval_pack === "https://mcp.packrift.com/ai/mcp-eval-pack.json" &&
      agentCaptureOutreach?.activation_handoff?.proof_urls?.ga4_funnel_proof === "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json" &&
      agentCaptureOutreach?.activation_handoff?.reviewer_acceptance_gate?.some((rule) => String(rule).includes("Do not create duplicate")) &&
      agentCaptureOutreach?.activation_handoff?.reviewer_acceptance_gate?.some((rule) => String(rule).includes("/r/order/{source}")) &&
      agentCaptureOutreach?.agent_install_snippets?.claude_code?.includes(MCP_ENDPOINT) &&
      agentCaptureOutreach?.agent_install_snippets?.generic_tracked_install_cline?.startsWith("https://mcp.packrift.com/r/install/generic/cline") &&
      agentCaptureOutreach?.agent_install_snippets?.cline_config?.mcpServers?.packrift?.type === "streamableHttp" &&
      agentCaptureOutreach?.agent_install_snippets?.cline_config?.mcpServers?.packrift?.url === MCP_ENDPOINT &&
      agentCaptureOutreach?.agent_install_snippets?.generic_agent_prompt?.includes("create_cart_url") &&
      agentCaptureOutreach?.agent_install_snippets?.generic_tracked_first_run_agent_prompt_page?.includes("format=html") &&
      agentCaptureOutreach?.agent_install_snippets?.generic_tracked_reviewer_activation_runner === "https://mcp.packrift.com/r/activate/generic?format=html" &&
      agentCaptureOutreach?.agent_install_snippets?.tracked_order_handoff_template === "https://mcp.packrift.com/r/order/{source}" &&
      agentCaptureOutreach?.agent_install_snippets?.mcp_eval_pack === "https://mcp.packrift.com/ai/mcp-eval-pack.json" &&
      agentCaptureOutreach?.agent_install_snippets?.mcp_external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      agentCaptureOutreach?.agent_install_snippets?.mcp_external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      agentCaptureOutreach?.agent_install_snippets?.mcp_external_activation_brief_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      agentCaptureOutreach?.evidence?.mcp_source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      agentCaptureOutreach?.evidence?.mcp_revenue_conversion_queue === MCP_REVENUE_CONVERSION_QUEUE_JSON_URL &&
      agentCaptureOutreach?.evidence?.mcp_revenue_conversion_queue_html === MCP_REVENUE_CONVERSION_QUEUE_HTML_URL &&
      agentCaptureOutreach?.evidence?.mcp_buyer_order_handoffs === MCP_BUYER_ORDER_HANDOFFS_JSON_URL &&
      agentCaptureOutreach?.evidence?.mcp_buyer_order_handoffs_html === MCP_BUYER_ORDER_HANDOFFS_HTML_URL &&
      agentCaptureOutreach?.evidence?.agent_capture_outreach_html === "https://mcp.packrift.com/ai/agent-capture-outreach.html" &&
      agentCaptureOutreach?.evidence?.mcp_activation_wave_runner_shell === MCP_ACTIVATION_WAVE_RUNNER_URL &&
      agentCaptureOutreach?.evidence?.mcp_external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      agentCaptureOutreach?.evidence?.mcp_external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      agentCaptureOutreach?.evidence?.mcp_external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      agentCaptureOutreach?.evidence?.mcp_external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      agentCaptureOutreach?.evidence?.mcp_external_activation_brief_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      agentCaptureOutreach?.evidence?.mcp_order_handoff_mcp_so === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
      agentCaptureOutreach?.evidence?.mcp_eval_pack === "https://mcp.packrift.com/ai/mcp-eval-pack.json" &&
      agentCaptureOutreach?.directory_submit_actions?.source_activation_queue === "https://mcp.packrift.com/ai/mcp-source-activation-queue.json" &&
      agentCaptureOutreach?.directory_submit_actions?.source_activation_wave === MCP_ACTIVATION_WAVE_JSON_URL &&
      agentCaptureOutreach?.directory_submit_actions?.source_activation_wave_html === MCP_ACTIVATION_WAVE_HTML_URL &&
      agentCaptureOutreach?.directory_submit_actions?.source_activation_wave_runner_shell === MCP_ACTIVATION_WAVE_RUNNER_URL &&
      agentCaptureOutreach?.directory_submit_actions?.selected_external_activation_runner_shell === MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL &&
      agentCaptureOutreach?.directory_submit_actions?.external_activation_brief === MCP_EXTERNAL_ACTIVATION_BRIEF_JSON_URL &&
      agentCaptureOutreach?.directory_submit_actions?.external_activation_brief_html === MCP_EXTERNAL_ACTIVATION_BRIEF_HTML_URL &&
      agentCaptureOutreach?.directory_submit_actions?.external_activation_brief_tasks_jsonl === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL &&
      agentCaptureOutreach?.directory_submit_actions?.external_activation_brief_tasks_csv === MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_order_handoff_template === "https://mcp.packrift.com/r/order/{source}" &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.submission_url === "https://github.com/chatmcp/mcpso/issues/2189" &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.buyer_order_handoff === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.agent_prompt_support?.source === "mcp_so" &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.agent_prompt_support?.copy_ready_agent_prompt?.includes("Required tool sequence") &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.agent_prompt_support?.copy_ready_curl_script?.includes("create_cart_url") &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.agent_prompt_support?.first_run_execute_url?.includes("execute=1") &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.agent_prompt_support?.buyer_order_handoff === "https://mcp.packrift.com/r/order/mcp_so?format=html" &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.agent_prompt_support?.json_rpc_sequence?.some((step) => step?.params?.name === "create_cart_url") &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.agent_prompt_support?.activation_experiments === "https://mcp.packrift.com/ai/mcp-activation-experiments.json" &&
      agentCaptureOutreach?.browser_assisted_submissions?.mcp_so?.agent_prompt_support?.eval_pack === "https://mcp.packrift.com/ai/mcp-eval-pack.json?source=mcp_so" &&
      agentCaptureOutreach?.browser_assisted_submissions?.claude_connectors_directory?.agent_prompt_support?.source === "anthropic_connectors_directory" &&
      agentCaptureOutreach?.browser_assisted_submissions?.claude_connectors_directory?.agent_prompt_support?.source_aware_endpoint?.includes("packrift_mcp_target=claude_code") &&
      agentCaptureOutreach?.browser_assisted_submissions?.claude_connectors_directory?.agent_prompt_support?.copy_ready_curl_script?.includes("anthropic_connectors_directory") &&
      agentCaptureOutreach?.browser_assisted_submissions?.claude_connectors_directory?.activation_packet?.tracked_claude_code_install?.startsWith("https://mcp.packrift.com/r/install/anthropic_connectors_directory/claude_code") &&
      agentCaptureOutreach?.browser_assisted_submissions?.claude_connectors_directory?.activation_packet?.source_aware_mcp_json?.mcpServers?.packrift?.url?.includes("packrift_mcp_source=anthropic_connectors_directory") &&
      agentCaptureOutreach?.browser_assisted_submissions?.browse_sh?.agent_prompt_support?.source === "browse_sh" &&
      agentCaptureOutreach?.browser_assisted_submissions?.browse_sh?.agent_prompt_support?.copy_ready_curl_script?.includes("browse_sh") &&
      agentCaptureOutreach?.browser_assisted_submissions?.browse_sh?.catalog_check_command === "browse skills find packrift" &&
      agentCaptureOutreach?.browserbase_browse_candidate?.status === "catalog_live_installable" &&
      agentCaptureOutreach?.browserbase_browse_candidate?.catalog_slug === "packrift.com/exact-spec-packaging-procurement-e4ujmy" &&
      agentCaptureOutreach?.browserbase_browse_candidate?.install_count_observed >= 6 &&
      agentCaptureOutreach?.browserbase_browse_candidate?.install_check?.status === "pass" &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_start_template === "https://mcp.packrift.com/r/start/{source}" &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_run_template === "https://mcp.packrift.com/r/run/{source}/{target}" &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_reviewer_activation_template === "https://mcp.packrift.com/r/activate/{source}" &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_reviewer_activation_html_template === "https://mcp.packrift.com/r/activate/{source}?format=html" &&
      agentCaptureOutreach?.directory_submit_actions?.tracked_order_handoff_html_template === "https://mcp.packrift.com/r/order/{source}?format=html" &&
      directorySubmitActions?.actions?.every((action) => action.recrawl_message?.includes("mcp-eval-pack.json")) &&
      directorySubmitActions?.actions?.every((action) => action.recrawl_message?.includes("Buyer/reviewer order handoff")) &&
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
      resourceUris.has("https://mcp.packrift.com/ai/mcp-source-activation-queue.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-source-activation-queue.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml") &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_JSON_URL) &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_MARKDOWN_URL) &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_HTML_URL) &&
      resourceUris.has(MCP_BUYER_ORDER_HANDOFFS_JSON_URL) &&
      resourceUris.has(MCP_BUYER_ORDER_HANDOFFS_MARKDOWN_URL) &&
      resourceUris.has(MCP_BUYER_ORDER_HANDOFFS_HTML_URL) &&
      resourceUris.has("https://mcp.packrift.com/r/order/mcp_so?format=md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-agent-adoption-progress.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-agent-adoption-progress.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-agent-adoption-progress.html") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-activation-experiments.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-activation-experiments.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-activation-experiments.html") &&
      resourceUris.has(MCP_ACTIVATION_WAVE_RUNNER_URL) &&
      resourceUris.has(MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL) &&
      resourceUris.has(MCP_EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL) &&
      resourceUris.has(MCP_EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL) &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-buyer-use-cases.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-buyer-use-cases.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-buyer-use-cases.html") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-cart-activation.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-cart-activation.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-cart-activation.html") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-proof.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-first-run-proof.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-workflow-gallery.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-workflow-gallery.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-workflow-gallery.html") &&
      resourceUris.has(MCP_AUTOMATION_WORKFLOWS_JSON_URL) &&
      resourceUris.has(MCP_AUTOMATION_WORKFLOWS_MARKDOWN_URL) &&
      resourceUris.has(MCP_AUTOMATION_WORKFLOWS_HTML_URL) &&
      resourceUris.has(MCP_N8N_WORKFLOW_JSON_URL) &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-eval-pack.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-eval-pack.md") &&
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
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/cline_mcp_marketplace.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/cline_mcp_marketplace.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcp_so.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcp_so.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/browse_sh.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/browse_sh.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcplist_ai.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcplist_ai.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcpsolutions_dev.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcpsolutions_dev.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcpserverfinder.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcpserverfinder.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcpserver_cc.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcpserver_cc.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcpserverspot.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-directory-update/mcpserverspot.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-reviewer-activation.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-reviewer-activation.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-source-activation-queue.html") &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_JSON_URL) &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_MARKDOWN_URL) &&
      resourceUris.has(MCP_REVENUE_CONVERSION_QUEUE_HTML_URL) &&
      sourceActivationSitemapResult.ok &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/start/cline_mcp_marketplace") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-directory-update/cline_mcp_marketplace.json") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-eval-pack.json?source=cline_mcp_marketplace") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-eval-pack.md?source=cline_mcp_marketplace") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-directory-update/mcp_so.md") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-eval-pack.json?source=mcp_so") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-directory-update/browse_sh.json") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-eval-pack.json?source=browse_sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/browse_sh/codex") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/browse_sh/codex?utm_source=browse_sh") &&
      sourceActivationSitemapResult.text.includes("format=md") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/install/cline_mcp_marketplace/cline") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline?utm_source=cline_mcp_marketplace") &&
      sourceActivationSitemapResult.text.includes("format=sh") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=html") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/mcp_so/generic_streamable_http") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/mcp_so/generic_streamable_http?utm_source=mcp_so") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/order/mcp_so?format=json") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-directory-update/mcplist_ai.json") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/mcplist_ai/generic_streamable_http") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-directory-update/mcpsolutions_dev.md") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/install/mcpsolutions_dev/generic_streamable_http") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-directory-update/mcpserverfinder.json") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/activate/mcpserverfinder?format=html") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-directory-update/mcpserver_cc.md") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/mcpserver_cc/generic_streamable_http") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/ai/mcp-directory-update/mcpserverspot.json") &&
      sourceActivationSitemapResult.text.includes("https://mcp.packrift.com/r/run/mcpserverspot/generic_streamable_http") &&
      resourceUris.has("https://mcp.packrift.com/r/activate") &&
      resourceUris.has("https://mcp.packrift.com/r/activate/generic") &&
      resourceUris.has("https://mcp.packrift.com/r/activate/generic?format=html") &&
      resourceUris.has("https://mcp.packrift.com/r/activate/generic?format=sh") &&
      resourceUris.has("https://mcp.packrift.com/ai/claude-connector-submission.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/claude-connector-submission.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/agent-capture-outreach.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/agent-capture-outreach.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/agent-capture-outreach.html") &&
      cartHandoffExcludesHeldSkus &&
      measuredHandoffsExcludeHeldSkus &&
      purchasePathsExcludeHeldSkus &&
      heldSkuPagesAvoidCartUrls &&
      cartHandoffHoldPolicyOk &&
      firstCartUrl.startsWith("https://mcp.packrift.com/r/cart/") &&
      hasAll(firstCartUrl, ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url", "qty=1"]) &&
      firstFinalCartUrl.startsWith("https://packrift.com/cart/") &&
      hasAll(firstFinalCartUrl, ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url"]) &&
      mcpPageAnalyticsOk
      ? "pass"
      : "fail",
    {
      failure_diagnostics: liveMcpFailureDiagnostics,
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
        marketplace_manifest_status: marketplaceManifestResult.status,
        marketplace_manifest_tool_count: marketplaceManifest?.signals?.tool_count ?? null,
        marketplace_manifest_has_prepare_purchase_handoff: Boolean(
          marketplaceManifest?.signals?.tool_names?.includes("prepare_purchase_handoff")
        ),
        marketplace_manifest_source_inference_release:
          marketplaceManifest?.signals?.runtime_source_inference_release ?? null,
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
      mcp_tools_discovery: {
        status: mcpToolsDiscoveryResult.status,
        release: mcpToolsDiscovery?.release ?? null,
        generated_from: mcpToolsDiscovery?.generated_from ?? null,
        tool_count: mcpToolsDiscovery?.tool_count ?? null,
        tool_names: mcpToolsDiscoveryToolNames,
        has_prepare_purchase_handoff: mcpToolsDiscoveryToolNames.includes("prepare_purchase_handoff"),
        has_compare_alternatives: mcpToolsDiscoveryToolNames.includes("compare_alternatives"),
        has_pack_calculator: mcpToolsDiscoveryToolNames.includes("pack_calculator"),
        has_inventory_status: mcpToolsDiscoveryToolNames.includes("inventory_status"),
        eval_pack: mcpToolsDiscovery?.conversion_urls?.eval_pack ?? null,
        source_activation_sitemap: mcpToolsDiscovery?.conversion_urls?.source_activation_sitemap ?? null,
        source_activation_queue: mcpToolsDiscovery?.conversion_urls?.source_activation_queue ?? null,
        source_count: mcpToolsDiscovery?.source_activation?.source_count ?? null,
        sitemap_url_count: mcpToolsDiscovery?.source_activation?.sitemap_url_count ?? null,
      },
      spec_finder_tools: {
        status: specFinderToolsResult.status,
        has_prepare_purchase_handoff: specFinderToolsResult.text.includes("prepare_purchase_handoff"),
        has_compare_alternatives: specFinderToolsResult.text.includes("compare_alternatives"),
        has_pack_calculator: specFinderToolsResult.text.includes("pack_calculator"),
        has_inventory_status: specFinderToolsResult.text.includes("inventory_status"),
        has_eval_pack: specFinderToolsResult.text.includes("https://mcp.packrift.com/ai/mcp-eval-pack.json"),
        has_source_activation_queue: specFinderToolsResult.text.includes("https://mcp.packrift.com/ai/mcp-source-activation-queue.json"),
      },
      agent_capture_release: agentCapture?.release ?? null,
      agent_capture_surfaces: agentCapture?.surfaces?.length ?? 0,
      agent_host_rollout_release: agentHostRollout?.release ?? null,
      agent_host_rollout_source_count: agentHostRollout?.source_count ?? null,
      agent_host_rollout_priority_source_count: agentHostRollout?.priority_source_count ?? null,
      agent_host_rollout_activation_queue_release: agentHostRollout?.activation_queue?.release ?? null,
      agent_host_rollout_activation_queue_status: agentHostRollout?.activation_queue?.status ?? null,
      agent_host_rollout_mcp_so: {
        activation_priority: agentHostRolloutMcpSo?.activation_priority ?? null,
        activation_status: agentHostRolloutMcpSo?.activation_status ?? null,
        target_event_to_watch: agentHostRolloutMcpSo?.target_event_to_watch ?? null,
        buyer_handoff_url: agentHostRolloutMcpSo?.buyer_handoff_url ?? null,
        current_counts: agentHostRolloutMcpSo?.current_counts ?? null,
      },
      agent_host_rollout_glama_connector: {
        activation_priority: agentHostRolloutGlama?.activation_priority ?? null,
        activation_status: agentHostRolloutGlama?.activation_status ?? null,
        target_event_to_watch: agentHostRolloutGlama?.target_event_to_watch ?? null,
        primary_action_url: agentHostRolloutGlama?.primary_action_url ?? null,
        buyer_handoff_url: agentHostRolloutGlama?.buyer_handoff_url ?? null,
        current_counts: agentHostRolloutGlama?.current_counts ?? null,
      },
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
      mcp_page_analytics: mcpPageAnalyticsDiagnostics,
      tracked_first_run_execute_status: trackedFirstRunExecuteResult.status,
      tracked_first_run_execute_ok: trackedFirstRunExecute?.status ?? null,
      tracked_first_run_execute_sku: trackedFirstRunExecute?.sku ?? null,
      tracked_first_run_execute_cart_url: trackedFirstRunExecute?.cart?.url ?? null,
      tracked_first_run_execute_mcp_handoff_id_present: String(trackedFirstRunExecute?.cart?.url ?? "").includes("mcp_handoff_id="),
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
      usage_snapshot_unique_mcp_handoff_ids: usageSnapshot?.counts?.unique_mcp_handoff_ids ?? null,
      usage_snapshot_unique_qualified_identity_signals: usageSnapshot?.counts?.unique_qualified_mcp_identity_signals ?? null,
      usage_snapshot_unique_qualified_mcp_session_ids: usageSnapshot?.counts?.unique_qualified_mcp_session_ids ?? null,
      usage_snapshot_qualified_mcp_events_with_identity: usageSnapshot?.counts?.qualified_mcp_events_with_identity ?? null,
      usage_snapshot_start_sources: usageSnapshot?.source_attribution?.mcp_start_click_sources ?? [],
      usage_snapshot_tracked_config_sources: usageSnapshot?.source_attribution?.tracked_config_sources ?? [],
      usage_snapshot_install_intent_sources: usageSnapshot?.source_attribution?.install_intent_sources ?? [],
      usage_snapshot_install_intent_targets: usageSnapshot?.source_attribution?.install_intent_targets ?? [],
      usage_snapshot_first_run_intent_sources: usageSnapshot?.source_attribution?.first_run_intent_sources ?? [],
      usage_snapshot_first_run_intent_targets: usageSnapshot?.source_attribution?.first_run_intent_targets ?? [],
      usage_snapshot_install_copy_sources: usageSnapshot?.source_attribution?.install_copy_sources ?? [],
      usage_snapshot_install_copy_targets: usageSnapshot?.source_attribution?.install_copy_targets ?? [],
      usage_snapshot_direct_agent_resource_sources: usageSnapshot?.counts?.direct_agent_resource_sources ?? [],
      usage_snapshot_agent_host_rollout_resource_events: usageSnapshot?.counts?.agent_host_rollout_resource_events ?? null,
      usage_snapshot_activation_experiments_resource_events: usageSnapshot?.counts?.activation_experiments_resource_events ?? null,
      usage_snapshot_activation_wave_runner_resource_events: usageSnapshot?.counts?.activation_wave_runner_resource_events ?? null,
      usage_snapshot_eval_pack_resource_events: usageSnapshot?.counts?.eval_pack_resource_events ?? null,
      funnel_snapshot_release: funnelSnapshot?.release ?? null,
      funnel_snapshot_status: funnelSnapshot?.status ?? null,
      funnel_snapshot_cart_landings: funnelSnapshot?.counts?.qualified_first_party_mcp_cart_landings ?? null,
      funnel_snapshot_unique_mcp_handoff_ids: funnelSnapshot?.counts?.unique_mcp_handoff_ids ?? null,
      funnel_snapshot_unique_qualified_identity_signals: funnelSnapshot?.counts?.unique_qualified_mcp_identity_signals ?? null,
      funnel_snapshot_unique_qualified_mcp_session_ids: funnelSnapshot?.counts?.unique_qualified_mcp_session_ids ?? null,
      funnel_snapshot_orders: funnelSnapshot?.counts?.first_party_mcp_orders ?? null,
      funnel_snapshot_revenue: funnelSnapshot?.counts?.first_party_mcp_order_revenue ?? null,
      source_activation_sitemap_status: sourceActivationSitemapResult.status,
      source_activation_sitemap_url_count: (sourceActivationSitemapResult.text.match(/<url>/g) ?? []).length,
      source_activation_sitemap_eval_pack_url_count:
        (sourceActivationSitemapResult.text.match(/mcp-eval-pack\.(?:json|md)\?source=/g) ?? []).length,
      activation_experiments_release: activationExperiments?.release ?? null,
      activation_experiments_status: activationExperiments?.status ?? null,
      activation_experiments_count: activationExperiments?.experiment_count ?? null,
      activation_experiments_critical_count: activationExperiments?.critical_count ?? null,
      activation_experiments_html_status: activationExperimentsHtmlResult.status,
      activation_experiments_markdown_status: activationExperimentsMarkdownResult.status,
      buyer_order_handoffs: {
        status: buyerOrderHandoffsResult.status,
        release: buyerOrderHandoffs?.release ?? null,
        hub_status: buyerOrderHandoffs?.status ?? null,
        handoff_count: buyerOrderHandoffRows.length,
        sources: buyerOrderHandoffRows.map((row) => row.source),
        diagnostics: buyerOrderHandoffsDiagnostics,
      },
      agent_adoption_progress_release: agentAdoptionProgress?.release ?? null,
      agent_adoption_progress_status: agentAdoptionProgress?.status ?? null,
      agent_adoption_progress_html_status: agentAdoptionProgressHtmlResult.status,
      buyer_use_cases_release: buyerUseCases?.release ?? null,
      buyer_use_cases_count: buyerUseCases?.use_cases?.length ?? 0,
      buyer_use_cases_html_status: buyerUseCasesHtmlResult.status,
      cart_activation_release: cartActivation?.release ?? null,
      cart_activation_paths: cartActivation?.activation_paths?.length ?? 0,
      cart_activation_html_status: cartActivationHtmlResult.status,
      first_run_proof_release: firstRunProof?.release ?? null,
      first_run_proof_mode: firstRunProof?.live_demo?.mode ?? null,
      first_run_proof_price: firstRunProof?.live_demo?.pricing?.unit_price ?? null,
      first_run_proof_currency: firstRunProof?.live_demo?.pricing?.currency ?? null,
      first_run_proof_in_stock: firstRunProof?.live_demo?.inventory?.in_stock ?? null,
      first_run_proof_cart_url: firstRunProof?.live_demo?.cart?.url ?? null,
      workflow_gallery_release: workflowGallery?.release ?? null,
      workflow_gallery_count: workflowGallery?.workflow_count ?? null,
      workflow_gallery_html_status: workflowGalleryHtmlResult.status,
      workflow_gallery_ids: (workflowGallery?.workflows ?? []).map((workflow) => workflow.id),
      eval_pack_release: evalPack?.release ?? null,
      eval_pack_cases: evalPack?.cases?.length ?? 0,
      eval_pack_no_order_gate: evalPack?.acceptance_gate?.no_order_created ?? null,
      eval_pack_one_line_shell: evalPack?.copy_ready?.one_line_shell ?? null,
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
      directory_submit_actions_eval_pack_messages: directorySubmitActions?.actions?.filter((action) =>
        action.recrawl_message?.includes("mcp-eval-pack.json")
      ).length ?? 0,
      directory_submit_actions_concise_emails: directorySubmitActions?.actions?.filter((action) =>
        action.concise_email?.release === "PACKRIFT-MCP-DIRECTORY-CONCISE-EMAIL-R01"
      ).length ?? 0,
      directory_submit_actions_concise_email_recipients: directorySubmitActions?.actions?.filter((action) => action.concise_email?.to).length ?? 0,
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
      tracked_reviewer_activation_shell_status: trackedReviewerActivationShellResult.status,
      tracked_reviewer_activation_shell_has_cart: trackedReviewerActivationShellResult.text.includes("create_cart_url"),
      agent_capture_outreach_release: agentCaptureOutreach?.release ?? null,
      agent_capture_outreach_html_status: agentCaptureOutreachHtmlResult.status,
      agent_capture_outreach_html_has_board: agentCaptureOutreachHtml.includes("Priority Agent Capture Queue"),
      agent_capture_outreach_priority_queue: agentCaptureOutreach?.priority_queue?.length ?? 0,
      agent_capture_outreach_directory_refreshes: agentCaptureOutreach?.directory_refreshes?.length ?? 0,
      commerce_hold_guard: {
        cart_handoff_policy_ok: cartHandoffHoldPolicyOk,
        cart_handoff_held_skus_present: cartHandoffHeldSkus,
        measured_handoffs_held_skus_present: measuredHandoffHeldSkus,
        purchase_paths_held_skus_present: purchasePathsHeldSkus,
        held_sku_pages_avoid_cart_urls: heldSkuPagesAvoidCartUrls,
        policy: cart?.held_sku_policy ?? null,
      },
      first_cart_url_candidate_type: cartItems[0]?.cart_url_candidate_type ?? null,
      first_final_shopify_cart_url_present: Boolean(firstFinalCartUrl),
      source_aware_prepare_purchase_handoff: {
        ok: sourceAwarePreparePurchaseOk,
        status: sourceAwarePreparePurchase?.status ?? null,
        cart_url: sourceAwarePreparePurchase?.cart?.url ?? null,
        source_attribution: sourceAwarePreparePurchase?.source_attribution ?? null,
      },
      mcp_introspection: {
        endpoint: MCP_ENDPOINT,
        tools_count: toolNames.length,
        tool_names: toolNames,
        resources_count: resourcesCount,
        prompts_count: promptsCount,
        tools_status: toolsResult.status,
        resources_status: resourcesResult.status,
        source_activation_direct_resource_count: resources.filter((resource) => /\/r\/(config|run|activate)\//.test(resource.uri)).length,
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

async function punkpeyeAwesomeMcpCheck() {
  const result = await fetchText("https://api.github.com/repos/punkpeye/awesome-mcp-servers/pulls/5606");
  if (!result.ok) return check("punkpeye_awesome_mcp", "blocked", { http_status: result.status, url: result.url, error: result.error ?? null });
  const parsed = JSON.parse(result.text);
  const merged = parsed.merged_at != null;
  const open = parsed.state === "open";
  const clean = parsed.mergeable_state === "clean" || parsed.mergeable_state == null;
  return check("punkpeye_awesome_mcp", merged ? "pass" : open && clean ? "pending" : open ? "stale" : "stale", {
    http_status: result.status,
    url: parsed.html_url ?? result.url,
    state: parsed.state,
    merged_at: parsed.merged_at,
    mergeable: parsed.mergeable,
    mergeable_state: parsed.mergeable_state,
    title: parsed.title,
    head_ref: parsed.head?.ref,
    base_ref: parsed.base?.ref,
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
      githubReleaseCheck(),
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
      punkpeyeAwesomeMcpCheck(),
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
      simplePresenceCheck("mcplist_ai", "https://www.mcplist.ai/?search=packrift", ["Packrift"]),
      simplePresenceCheck("mcphubz", "https://mcphubz.com/api/discover?search=packrift", ["Packrift"]),
      simplePresenceCheck("mcp_blue", "https://www.mcp.blue/", ["Packrift"]),
      simplePresenceCheck("findmcp_dev", "https://findmcp.dev/", ["Packrift"]),
      simplePresenceCheck("mcplane", "https://mcplane.com/mcp_servers?query=packrift", ["Packrift"]),
      simplePresenceCheck("mcpsolutions_dev", "https://mcpsolutions.dev/explore/", ["Packrift"]),
      simplePresenceCheck("gpmcp", "https://www.gpmcp.com/", ["Packrift"]),
      simplePresenceCheck("theresamcpforthat", "https://theresamcpforthat.com/directory?search=packrift", ["Packrift"]),
      simplePresenceCheck("mcpserverfinder", "https://www.mcpserverfinder.com/?q=packrift", ["Packrift"]),
      simplePresenceCheck("mcpserver_cc", "https://mcpserver.cc/", ["Packrift"]),
      simplePresenceCheck("mcpserverspot", "https://www.mcpserverspot.com/servers?q=packrift", ["Packrift"]),
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
