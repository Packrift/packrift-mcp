#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const OUT_ROOT = resolve(REPO_ROOT, "outputs/mcp-directory-submission-pack");
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const SERVER_JSON = JSON.parse(readFileSync(resolve(REPO_ROOT, "server.json"), "utf8"));
const DISTRIBUTION_LATEST = resolve(REPO_ROOT, "outputs/mcp-distribution-check/latest.json");

const CONTACT_EMAIL_PLACEHOLDER = "[directory contact email]";

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
    name: "glama",
    label: "Glama",
    listing_url: "https://glama.ai/mcp/servers/ye4xxr7qiu",
    submission_url: "https://glama.ai/",
    category: "Business",
    priority: "high",
    action: "Refresh the GitHub repo listing and verify Glama indexes the 14 live tools, not just the connector shell.",
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
];

const LIVE_PROOF_URLS = {
  health: "https://mcp.packrift.com/health",
  manifest: "https://mcp.packrift.com/manifest",
  server_card: "https://mcp.packrift.com/server-card.json",
  well_known_server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
  cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
};

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Packrift-MCP-Directory-Pack/1.0 (+https://mcp.packrift.com/mcp)",
        Accept: "application/json,*/*;q=0.8",
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

function readDistribution() {
  if (!existsSync(DISTRIBUTION_LATEST)) return null;
  return JSON.parse(readFileSync(DISTRIBUTION_LATEST, "utf8"));
}

function checksByName(distribution) {
  return Object.fromEntries((distribution?.checks ?? []).map((row) => [row.name, row]));
}

function canonicalListingCopy(liveProof) {
  const toolsCount = liveProof.health?.value?.tools_count ?? 14;
  const resourcesCount = liveProof.health?.value?.resources_count ?? 70;
  const promptsCount = liveProof.manifest?.value?.prompts?.length ?? 7;
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
    proof_summary: `${toolsCount} tools, ${promptsCount} prompts, ${resourcesCount} resources, live health check, public manifest, public server cards, and MCP-attributed cart handoff candidates.`,
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
    form_fields: {
      server_name: copy.server_name,
      short_description: copy.short_description,
      repository_url: copy.repository_url,
      website_url: copy.website_url,
      remote_endpoint: copy.remote_endpoint,
      category: target.category,
      contact_email: copy.contact_email,
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
    cart_handoff_candidates: {
      ok: liveProof.cart_handoff_candidates.ok,
      status: liveProof.cart_handoff_candidates.status,
      url: liveProof.cart_handoff_candidates.url,
      release: liveProof.cart_handoff_candidates.value?.release ?? null,
      items_count: liveProof.cart_handoff_candidates.value?.items?.length ?? null,
    },
  };
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
  ].join("\n");
}

async function main() {
  const liveProofRaw = Object.fromEntries(
    await Promise.all(Object.entries(LIVE_PROOF_URLS).map(async ([name, url]) => [name, await fetchJson(url)]))
  );
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
