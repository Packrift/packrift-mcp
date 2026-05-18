#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGE_JSON = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
const EXPECTED_VERSION = process.env.PACKRIFT_MCP_EXPECTED_VERSION || PACKAGE_JSON.version;
const OUT_ROOT = resolve(process.cwd(), "outputs/mcp-distribution-check");

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
    follow_up_action: "Submit the GitHub repo and ask for the listing to be recrawled with the current 14-tool cart-handoff README.",
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
    follow_up_action: "Keep the hosted Glama connector healthy and listing all 14 current tools.",
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
    follow_up_action: "Submit the GitHub repo, remote endpoint, and short description; request verified edit access if it appears via auto-discovery.",
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
};

const TEXT_HEADERS = {
  "User-Agent": "Packrift-MCP-Distribution-Check/1.0 (+https://mcp.packrift.com/mcp)",
  Accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.8",
};

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

async function fetchText(url) {
  try {
    const response = await fetch(url, { headers: TEXT_HEADERS, redirect: "follow" });
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, text };
  } catch (error) {
    return { ok: false, status: 0, url, text: "", error: error.message };
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
  const [healthResult, cartResult, agentCaptureResult, adoptionKitResult, usageSnapshotResult, buyerUseCasesResult, browserAgentBridgeResult, toolsResult, resourcesResult, promptsResult] = await Promise.all([
    fetchText("https://mcp.packrift.com/health"),
    fetchText("https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json"),
    fetchText("https://mcp.packrift.com/ai/all-agent-capture.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-adoption-kit.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-usage-snapshot.json"),
    fetchText("https://mcp.packrift.com/ai/mcp-buyer-use-cases.json"),
    fetchText("https://mcp.packrift.com/ai/browser-agent-bridge.json"),
    fetchMcp("tools/list"),
    fetchMcp("resources/list"),
    fetchMcp("prompts/list"),
  ]);
  const health = healthResult.ok ? JSON.parse(healthResult.text) : null;
  const cart = cartResult.ok ? JSON.parse(cartResult.text) : null;
  const agentCapture = agentCaptureResult.ok ? JSON.parse(agentCaptureResult.text) : null;
  const adoptionKit = adoptionKitResult.ok ? JSON.parse(adoptionKitResult.text) : null;
  const usageSnapshot = usageSnapshotResult.ok ? JSON.parse(usageSnapshotResult.text) : null;
  const buyerUseCases = buyerUseCasesResult.ok ? JSON.parse(buyerUseCasesResult.text) : null;
  const browserAgentBridge = browserAgentBridgeResult.ok ? JSON.parse(browserAgentBridgeResult.text) : null;
  const firstCartUrl = cart?.items?.[0]?.cart_url_qty_1_candidate ?? "";
  const toolNames = (toolsResult.value?.result?.tools ?? []).map((tool) => tool.name).filter(Boolean);
  const resources = resourcesResult.value?.result?.resources ?? [];
  const resourcesCount = resources.length;
  const resourceUris = new Set(resources.map((resource) => resource.uri));
  const promptsCount = promptsResult.value?.result?.prompts?.length ?? 0;
  return check(
    "live_mcp_surface",
    health?.version === EXPECTED_VERSION &&
      health?.resources_count >= 65 &&
      health?.tools_count >= 14 &&
      toolNames.length >= 14 &&
      toolNames.includes("create_cart_url") &&
      toolNames.includes("get_cart_handoff_candidates") &&
      resourcesCount >= 65 &&
      promptsCount >= 7 &&
      cart?.items?.length >= 50 &&
      agentCapture?.release === "PACKRIFT-ALL-AGENT-CAPTURE-R01" &&
      agentCapture?.surfaces?.length >= 20 &&
      adoptionKit?.release === "PACKRIFT-MCP-ADOPTION-KIT-R01" &&
      adoptionKit?.first_five_minutes?.length >= 6 &&
      usageSnapshot?.release === "PACKRIFT-MCP-USAGE-SNAPSHOT-R01" &&
      buyerUseCases?.release === "PACKRIFT-MCP-BUYER-USE-CASES-R01" &&
      buyerUseCases?.use_cases?.length >= 6 &&
      browserAgentBridge?.release === "PACKRIFT-BROWSER-AGENT-BRIDGE-R01" &&
      browserAgentBridge?.workflows?.length >= 3 &&
      resourceUris.has("https://mcp.packrift.com/ai/all-agent-capture.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/all-agent-capture.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-adoption-kit.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-adoption-kit.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-usage-snapshot.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-usage-snapshot.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-buyer-use-cases.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/mcp-buyer-use-cases.md") &&
      resourceUris.has("https://mcp.packrift.com/ai/browser-agent-bridge.json") &&
      resourceUris.has("https://mcp.packrift.com/ai/browser-agent-bridge.md") &&
      hasAll(firstCartUrl, ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url"])
      ? "pass"
      : "fail",
    {
      health,
      cart_release: cart?.release ?? null,
      cart_items: cart?.items?.length ?? 0,
      agent_capture_release: agentCapture?.release ?? null,
      agent_capture_surfaces: agentCapture?.surfaces?.length ?? 0,
      adoption_kit_release: adoptionKit?.release ?? null,
      adoption_kit_steps: adoptionKit?.first_five_minutes?.length ?? 0,
      usage_snapshot_release: usageSnapshot?.release ?? null,
      usage_snapshot_status: usageSnapshot?.status ?? null,
      buyer_use_cases_release: buyerUseCases?.release ?? null,
      buyer_use_cases_count: buyerUseCases?.use_cases?.length ?? 0,
      browser_agent_bridge_release: browserAgentBridge?.release ?? null,
      browser_agent_bridge_workflows: browserAgentBridge?.workflows?.length ?? 0,
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
    }
  );
}

async function mcpserversCheck() {
  const result = await fetchText("https://mcpservers.org/servers/packrift/packrift-mcp");
  const text = result.text;
  const required = ["get_cart_handoff_candidates", "mcp-cart-handoff-candidates", "compare_alternatives", "pack_calculator", "inventory_status"];
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
  const required = ["create_cart_url", "get_cart_handoff_candidates", "find_packaging_for_item", "inventory_status"];
  return check("glama_connector", result.ok && text.includes("Healthy") && toolNames.length >= 14 && hasAll(text, required) ? "pass" : "stale", {
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
  return check("glama_server_listing", Array.isArray(parsed.tools) && parsed.tools.length >= 14 ? "pass" : "stale", {
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
  return check("mcp_marketplace_io", listing?.toolCount >= 14 && listing?.mode === "remote" ? "pass" : "stale", {
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
      simplePresenceCheck("chiark", "https://chiark.ai/", ["Packrift"]),
      mcpMarketplaceCheck(),
      simplePresenceCheck("pulsemcp_packrift", "https://www.pulsemcp.com/servers/packrift", ["Packrift"]),
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
      blocked: checks.filter((row) => row.status === "blocked").length,
      fail: checks.filter((row) => row.status === "fail").length,
    },
  };
  writeFileSync(resolve(outDir, "distribution-check.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(outDir, "distribution-check.md"), markdownReport(payload));
  writeFileSync(resolve(OUT_ROOT, "latest.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(OUT_ROOT, "latest.md"), markdownReport(payload));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
