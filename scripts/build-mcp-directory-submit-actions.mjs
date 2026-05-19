#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const OUT_ROOT = resolve(REPO_ROOT, "outputs/mcp-directory-submit-actions");
const PACK_PATH = resolve(REPO_ROOT, "outputs/mcp-directory-submission-pack/latest.json");
const PREVIOUS_PATH = resolve(REPO_ROOT, "outputs/mcp-directory-submit-actions/latest.json");
const CLAUDE_CONNECTOR_SUBMISSION_URL = "https://mcp.packrift.com/ai/claude-connector-submission.json";

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
  anthropic_connectors_directory: {
    status: "manual_submission_ready",
    method: "Manual Claude connector directory submission",
    evidence: "Claude connector submission is form-based and requires manual review; use the Packrift Claude submission packet for form-ready fields and proof.",
    next_action: "Submit the hosted endpoint, no-auth policy, legal/support links, first-run proof, tracked start/config URLs, and directory refresh pack through the Claude form.",
  },
  smithery: {
    status: "api_key_required",
    method: "Smithery publish flow or CLI publish",
    evidence: "Smithery publishing is gated by an API key; the public server card exposes schema-friendly fields for static ingestion.",
    next_action: "Authenticate with Smithery, publish the hosted endpoint, then monitor search visibility and installs.",
  },
  cline_mcp_marketplace: {
    status: "submitted_pending",
    method: "GitHub issue submission",
    evidence:
      "Cline MCP Marketplace issue #1610 is open for Packrift MCP; refreshed hosted-endpoint, tracked-config, and cart-handoff proof was added in issue comment https://github.com/cline/mcp-marketplace/issues/1610#issuecomment-4484204915.",
    next_action: "Monitor for maintainer response and publication; respond with the directory refresh pack only if they ask for more evidence.",
  },
  mcp_so: {
    status: "manual_submission_ready",
    method: "Manual MCP.so submit form",
    evidence: "The submit form is reachable, but Packrift is not confirmed as a listed server.",
    next_action: "Submit or claim Packrift MCP with hosted endpoint, tracked start URL, and exact-spec packaging copy.",
  },
  browse_sh: {
    status: "manual_submission_ready",
    method: "Browse Add website / catalog skill submission flow",
    evidence:
      "browse skills find packrift returns no Packrift skill, while Packrift already has a root SKILL.md and Browse skill pack that route browser agents to the hosted MCP endpoint.",
    next_action:
      "Submit Packrift to Browse with the root SKILL.md, Browse skill pack, hosted endpoint, tracked start URL, and exact-spec packaging procurement copy.",
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
  mcpmarket_com: {
    status: "manual_update_needed",
    method: "Manual listing claim/update",
    evidence: "Automated checks hit a Vercel checkpoint; use browser-side verification and the update flow.",
    next_action: "Open the MCP Market listing/update flow in the browser and align it to the hosted endpoint and current server card.",
  },
  cursor_directory: {
    status: "auth_gated_manual",
    method: "Auth-gated manual submit flow",
    evidence: "Automated checks hit a Vercel checkpoint before reaching the plugin submission flow.",
    next_action: "Use the Cursor Directory plugin submit flow after browser auth, with hosted endpoint and tracked start URL.",
  },
  mcpcentral: {
    status: "auth_gated_manual",
    method: "Browser-side submit flow",
    evidence: "Automated checks hit a Cloudflare challenge.",
    next_action: "Use the browser-side MCP Central submit flow or request review access if auth is required.",
  },
  mcpfinder: {
    status: "submitted_pending",
    method: "Manual MCPfinder submit form",
    evidence: "Free listing form POST returned 200 OK; Packrift is not visible in the browsable index yet.",
    next_action: "Monitor for listing approval and provide endpoint proof if MCPfinder asks for more detail.",
  },
  mcpskills: {
    status: "submitted_pending",
    method: "Submitted to MCPSkills public API",
    evidence: "Public API returned a success redirect after posting the Packrift GitHub repo, category, and hosted MCP description.",
    next_action: "Monitor for listing publication; cite the directory refresh pack if review asks for endpoint proof.",
  },
  agentndx: {
    status: "submitted_pending",
    method: "Submitted to AgentNDX public API",
    evidence: "Public API returned a success redirect after posting the Packrift name, GitHub repo, hosted start page, MCP protocol, and description.",
    next_action: "Monitor for listing publication; cite the directory refresh pack if review asks for endpoint proof.",
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
    evidence:
      "Docker MCP Catalog PR #3388 is open and mergeable in the latest distribution proof; refreshed hosted-endpoint, tracked-config, and remote-only server.json proof was added in PR comment https://github.com/docker/mcp-registry/pull/3388#issuecomment-4484205544.",
    next_action: "Monitor for Docker review and publication; respond only if Docker requests changes.",
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

function trackedStartUrl(source) {
  const url = new URL(`https://mcp.packrift.com/r/start/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "directory_recrawl");
  url.searchParams.set("utm_campaign", "packrift_mcp_start");
  url.searchParams.set("utm_content", "directory_submit_actions");
  return url.toString();
}

function trackedConfigUrl(source) {
  const url = new URL(`https://mcp.packrift.com/r/config/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "directory_config");
  url.searchParams.set("utm_campaign", "packrift_mcp_install");
  url.searchParams.set("utm_content", "directory_submit_actions");
  return url.toString();
}

function publicProofLine(pack) {
  const proof = pack.live_proof ?? {};
  const tools = proof.mcp_tools_list?.tools_count ?? pack.copy?.tools_count ?? 14;
  const resources = proof.mcp_resources_list?.resources_count ?? proof.health?.resources_count ?? 83;
  const prompts = proof.mcp_prompts_list?.prompts_count ?? 9;
  const directoryRelease = proof.mcp_directory_refresh?.release ?? "PACKRIFT-MCP-DIRECTORY-REFRESH-R10";
  const directoryTargets = proof.mcp_directory_refresh?.targets_count ?? 17;
  const firstRunRelease = proof.mcp_first_run_proof?.release ?? "PACKRIFT-MCP-FIRST-RUN-PROOF-R01";
  const workflowGalleryRelease = proof.mcp_workflow_gallery?.release ?? "PACKRIFT-MCP-WORKFLOW-GALLERY-R01";
  const browserbaseRelease = proof.browserbase_browse_skill_pack?.release ?? "PACKRIFT-BROWSERBASE-BROWSE-SKILL-PACK-R03";
  const clientConfigRelease = proof.mcp_client_config?.release ?? "PACKRIFT-MCP-CLIENT-CONFIG-R02";
  return `Current proof: live MCP returns ${tools} tools, ${resources} resources, and ${prompts} prompts. Client config is ${clientConfigRelease}; tracked config template is https://mcp.packrift.com/r/config/{source}. First-run proof is ${firstRunRelease}. Workflow gallery is ${workflowGalleryRelease}. Browserbase Browse SKILL.md is https://mcp.packrift.com/SKILL.md. Browserbase Browse skill pack is ${browserbaseRelease}. Directory refresh pack is ${directoryRelease} with ${directoryTargets} targets. Claude connector submission packet is ${CLAUDE_CONNECTOR_SUBMISSION_URL}.`;
}

function recrawlMessage(pack, target) {
  const missing = target.missing?.length ? `\nCurrent stale/missing markers: ${target.missing.join(", ")}.\n` : "";
  const trackedStart = trackedStartUrl(target.name);
  const trackedConfig = trackedConfigUrl(target.name);
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
    `- Tracked start page: ${trackedStart}`,
    `- Tracked MCP JSON config: ${trackedConfig}`,
    "- Canonical start page: https://mcp.packrift.com/start",
    "- Repository: https://github.com/Packrift/packrift-mcp",
    "- Website: https://packrift.com/pages/packrift-ai-agent-instructions",
    "- Description: Exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match.",
    "- All-agent evidence: https://mcp.packrift.com/ai/all-agent-capture.json",
    "- Start pack: https://mcp.packrift.com/ai/mcp-start.json",
    "- Install matrix: https://mcp.packrift.com/ai/mcp-install-matrix.json",
    "- Client config: https://mcp.packrift.com/ai/mcp-client-config.json",
    "- Tracked config template: https://mcp.packrift.com/r/config/{source}",
    "- Root MCP JSON config: https://mcp.packrift.com/mcp.json",
    "- Well-known MCP JSON config: https://mcp.packrift.com/.well-known/mcp.json",
    "- Directory refresh pack: https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    "- First-run proof: https://mcp.packrift.com/ai/mcp-first-run-proof.json",
    "- Workflow gallery: https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
    `- Claude connector submission packet: ${CLAUDE_CONNECTOR_SUBMISSION_URL}`,
    "- Browserbase Browse SKILL.md: https://mcp.packrift.com/SKILL.md",
    "- Browserbase Browse skill pack: https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json",
    "- Canonical Browse skill file: https://mcp.packrift.com/ai/browserbase-browse/SKILL.md",
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
    tracked_start_url: trackedStartUrl(target.name),
    tracked_config_url: trackedConfigUrl(target.name),
    previous_status: previous?.status ?? null,
    form_fields: target.form_fields,
    proof_urls: {
      ...target.proof_urls,
      tracked_start: trackedStartUrl(target.name),
      tracked_config: trackedConfigUrl(target.name),
      claude_connector_submission: CLAUDE_CONNECTOR_SUBMISSION_URL,
    },
    recrawl_message: recrawlMessage(pack, target),
  };
}

function markdown(payload) {
  const rows = payload.actions
    .map(
      (action) =>
        `| ${action.label} | ${action.status} | ${action.current_distribution_status} | ${action.priority} | ${action.tracked_start_url} | ${action.tracked_config_url} | ${action.next_action} |`
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
    `Tracked start template: ${payload.tracked_start_template}`,
    `Tracked config template: ${payload.tracked_config_template}`,
    `Directory proof: ${payload.directory_refresh_url}`,
    "",
    "## Summary",
    "",
    publicProofLine(payload.source_pack),
    "",
    "## Action Queue",
    "",
    "| Target | Action status | Directory status | Priority | Tracked start URL | Tracked config URL | Next action |",
    "| --- | --- | --- | --- | --- | --- | --- |",
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
    tracked_start_template: "https://mcp.packrift.com/r/start/{source}",
    tracked_config_template: "https://mcp.packrift.com/r/config/{source}",
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
