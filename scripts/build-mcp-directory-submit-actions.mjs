#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const OUT_ROOT = resolve(REPO_ROOT, "outputs/mcp-directory-submit-actions");
const PACK_PATH = resolve(REPO_ROOT, "outputs/mcp-directory-submission-pack/latest.json");
const PREVIOUS_PATH = resolve(REPO_ROOT, "outputs/mcp-directory-submit-actions/latest.json");

const DIRECT_STATUS = {
  mcpservers_org: {
    status: "submitted_pending",
    method: "Already submitted to mcpservers.org server function",
    evidence: "Previous submission returned id 2468, status pending, plan free, paymentStatus not_required.",
    next_action: "Use the refreshed proof message only if support or review asks for updated evidence.",
  },
  mcp_directory: {
    status: "already_submitted",
    method: "Already submitted to MCP.Directory API",
    evidence: "Previous API response returned 409 Conflict: repository already submitted and awaiting review.",
    next_action: "Use the refreshed proof message to request review, claim, or update access.",
  },
  glama_server_listing: {
    status: "manual_support_refresh_needed",
    method: "Support/email/manual recrawl request",
    evidence: "Hosted Glama connector is healthy, but the source server listing remains stale with the old zero-tool/token-required record.",
    next_action: "Send or update the Glama support request and ask them to reconcile the source listing with the hosted connector.",
  },
  pulsemcp_packrift: {
    status: "manual_support_refresh_needed",
    method: "Support/email/manual recrawl request",
    evidence: "Automated checker is Cloudflare-blocked; use official registry plus server.json and public proof URLs as the recrawl source.",
    next_action: "Send or update the PulseMCP support request with official-registry and public proof.",
  },
  mcpbench: {
    status: "monitor_upstream_registry",
    method: "No direct submit endpoint found",
    evidence: "MCPBench appears registry-derived; the official registry is current at 0.2.10.",
    next_action: "Monitor for registry ingestion; cite the directory refresh pack if requesting a recrawl.",
  },
  chiark: {
    status: "monitor_upstream_registry",
    method: "No direct submit endpoint found",
    evidence: "Chiark methodology indicates upstream crawling rather than direct submissions.",
    next_action: "Monitor after official registry and high-priority directory refreshes propagate.",
  },
  docker_mcp_catalog: {
    status: "pending_merge",
    method: "GitHub pull request",
    evidence: "Docker MCP Catalog PR #3388 is open and mergeable in the latest distribution proof.",
    next_action: "Keep the PR mergeable and respond if Docker review requests changes.",
  },
};

function requireJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}. Run npm run build:directory-submission-pack first.`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function readPrevious() {
  if (!existsSync(PREVIOUS_PATH)) return null;
  return JSON.parse(readFileSync(PREVIOUS_PATH, "utf8"));
}

function slugNow(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function targetLabel(target) {
  return target.label ?? target.name;
}

function publicProofLine(pack) {
  const proof = pack.live_proof ?? {};
  const tools = proof.mcp_tools_list?.tools_count ?? pack.copy?.tools_count ?? 14;
  const resources = proof.mcp_resources_list?.resources_count ?? proof.health?.resources_count ?? 83;
  const prompts = proof.mcp_prompts_list?.prompts_count ?? 9;
  const directoryRelease = proof.mcp_directory_refresh?.release ?? "PACKRIFT-MCP-DIRECTORY-REFRESH-R02";
  const directoryTargets = proof.mcp_directory_refresh?.targets_count ?? 7;
  return `Current proof: live MCP returns ${tools} tools, ${resources} resources, and ${prompts} prompts. Directory refresh pack is ${directoryRelease} with ${directoryTargets} targets.`;
}

function recrawlMessage(pack, target) {
  const missing = target.missing?.length ? `\nCurrent stale/missing markers: ${target.missing.join(", ")}.\n` : "";
  return [
    `Subject: Refresh ${targetLabel(target)} Packrift MCP listing to current hosted endpoint`,
    "",
    "Hi,",
    "",
    "Packrift MCP is live as a hosted Streamable HTTP MCP server at https://mcp.packrift.com/mcp.",
    "",
    publicProofLine(pack),
    "It requires no buyer-side API key and exposes exact-spec packaging search, live price, live inventory, no-match handling, and measured cart handoff.",
    missing,
    "Please recrawl/update Packrift using:",
    "- Server name: io.github.Packrift/packrift-mcp",
    "- Title: Packrift MCP",
    "- Remote endpoint: https://mcp.packrift.com/mcp",
    "- Repository: https://github.com/Packrift/packrift-mcp",
    "- Website: https://packrift.com/pages/packrift-ai-agent-instructions",
    "- Description: Exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match.",
    "- All-agent evidence: https://mcp.packrift.com/ai/all-agent-capture.json",
    "- Install matrix: https://mcp.packrift.com/ai/mcp-install-matrix.json",
    "- Directory refresh pack: https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    "- Cart activation playbook: https://mcp.packrift.com/ai/mcp-cart-activation.json",
    "- Cart handoff candidates: https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    "",
    "Thanks,",
    "Packrift",
  ].join("\n");
}

function buildAction(pack, previousByName, target) {
  const defaults = DIRECT_STATUS[target.name] ?? {
    status: target.current_status,
    method: "Review latest distribution proof",
    evidence: target.action,
    next_action: target.action,
  };
  const previous = previousByName[target.name] ?? null;
  return {
    name: target.name,
    label: targetLabel(target),
    status: defaults.status,
    current_distribution_status: target.current_status,
    priority: target.priority,
    method: defaults.method,
    evidence: defaults.evidence,
    next_action: defaults.next_action,
    listing_url: target.listing_url,
    submission_url: target.submission_url,
    previous_status: previous?.status ?? null,
    form_fields: target.form_fields,
    proof_urls: target.proof_urls,
    recrawl_message: recrawlMessage(pack, target),
  };
}

function markdown(payload) {
  const rows = payload.actions
    .map(
      (action) =>
        `| ${action.label} | ${action.status} | ${action.current_distribution_status} | ${action.priority} | ${action.next_action} |`
    )
    .join("\n");
  const messages = payload.actions
    .filter((action) => action.status !== "monitor_upstream_registry")
    .map((action) => [`### ${action.label}`, "", action.recrawl_message].join("\n"))
    .join("\n\n");
  return [
    "# Packrift MCP Directory Submit Actions",
    "",
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    `Directory proof: ${payload.directory_refresh_url}`,
    "",
    "## Summary",
    "",
    publicProofLine(payload.source_pack),
    "",
    "## Action Queue",
    "",
    "| Target | Action status | Directory status | Priority | Next action |",
    "| --- | --- | --- | --- | --- |",
    rows,
    "",
    "## Copy-Ready Recrawl Messages",
    "",
    messages,
    "",
  ].join("\n");
}

function main() {
  const pack = requireJson(PACK_PATH);
  const previous = readPrevious();
  const previousByName = Object.fromEntries((previous?.actions ?? []).map((row) => [row.name, row]));
  const actions = (pack.targets ?? [])
    .filter((target) => !["pass"].includes(target.current_status))
    .map((target) => buildAction(pack, previousByName, target));
  const payload = {
    generated_at: new Date().toISOString(),
    canonical_endpoint: "https://mcp.packrift.com/mcp",
    directory_refresh_url: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    source_pack_generated_at: pack.generated_at,
    source_distribution_counts: pack.distribution_counts,
    source_pack: {
      live_proof: pack.live_proof,
      copy: pack.copy,
    },
    actions,
  };
  const stamp = slugNow();
  const outDir = resolve(OUT_ROOT, stamp);
  mkdirSync(outDir, { recursive: true });
  const json = JSON.stringify(payload, null, 2);
  const md = markdown(payload);
  writeFileSync(resolve(outDir, "directory-submit-actions.json"), `${json}\n`);
  writeFileSync(resolve(outDir, "directory-submit-actions.md"), md);
  writeFileSync(resolve(OUT_ROOT, "latest.json"), `${json}\n`);
  writeFileSync(resolve(OUT_ROOT, "latest.md"), md);
  console.log(
    JSON.stringify(
      {
        generated_at: payload.generated_at,
        actions: payload.actions.length,
        statuses: payload.actions.reduce((acc, action) => {
          acc[action.status] = (acc[action.status] ?? 0) + 1;
          return acc;
        }, {}),
      },
      null,
      2
    )
  );
}

main();
