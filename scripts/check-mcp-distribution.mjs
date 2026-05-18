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
  glama: {
    listing_url: "https://glama.ai/mcp/servers/ye4xxr7qiu",
    submission_url: "https://glama.ai/",
    priority: "high",
    follow_up_action: "Resubmit or refresh the GitHub repo through Glama and verify it indexes tool schemas instead of only the connector shell.",
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

async function fetchText(url) {
  try {
    const response = await fetch(url, { headers: TEXT_HEADERS, redirect: "follow" });
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, text };
  } catch (error) {
    return { ok: false, status: 0, url, text: "", error: error.message };
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
  const [healthResult, cartResult] = await Promise.all([
    fetchText("https://mcp.packrift.com/health"),
    fetchText("https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json"),
  ]);
  const health = healthResult.ok ? JSON.parse(healthResult.text) : null;
  const cart = cartResult.ok ? JSON.parse(cartResult.text) : null;
  const firstCartUrl = cart?.items?.[0]?.cart_url_qty_1_candidate ?? "";
  return check(
    "live_mcp_surface",
    health?.version === EXPECTED_VERSION &&
      health?.resources_count >= 65 &&
      health?.tools_count >= 14 &&
      cart?.items?.length >= 50 &&
      hasAll(firstCartUrl, ["utm_source=chatgpt-mcp", "utm_medium=mcp_tool", "utm_campaign=create_cart_url"])
      ? "pass"
      : "fail",
    {
      health,
      cart_release: cart?.release ?? null,
      cart_items: cart?.items?.length ?? 0,
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

async function glamaCheck() {
  const result = await fetchText("https://glama.ai/api/mcp/v1/servers/Packrift/packrift-mcp");
  if (!result.ok) return check("glama", "fail", { http_status: result.status, url: result.url });
  const parsed = JSON.parse(result.text);
  return check("glama", Array.isArray(parsed.tools) && parsed.tools.length >= 14 ? "pass" : "stale", {
    http_status: result.status,
    url: parsed.url,
    id: parsed.id,
    attributes: parsed.attributes,
    tools_count: parsed.tools?.length ?? 0,
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
      glamaCheck(),
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
