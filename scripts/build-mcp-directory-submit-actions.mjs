#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const OUT_ROOT = resolve(REPO_ROOT, "outputs/mcp-directory-submit-actions");
const PACK_PATH = resolve(REPO_ROOT, "outputs/mcp-directory-submission-pack/latest.json");
const PREVIOUS_PATH = resolve(REPO_ROOT, "outputs/mcp-directory-submit-actions/latest.json");
const CLAUDE_CONNECTOR_SUBMISSION_URL = "https://mcp.packrift.com/ai/claude-connector-submission.json";
const TRACKED_INSTALL_TEMPLATE = "https://mcp.packrift.com/r/install/{source}/{target}";
const TRACKED_RUN_TEMPLATE = "https://mcp.packrift.com/r/run/{source}/{target}";

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
    status: "auth_gated_manual",
    method: "Manual Google Forms submission after sign-in",
    evidence:
      "The Claude connector directory submission URL redirects to a Google Forms sign-in page; the Packrift Claude submission packet is ready for authenticated submission.",
    next_action:
      "Submit the hosted endpoint, no-auth policy, legal/support links, first-run proof, tracked start/config URLs, and directory refresh pack through an authenticated Google Forms session.",
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
    status: "submitted_pending",
    method: "GitHub issue submission updated after auth-gated public submit form",
    evidence: "MCP.so issue #2189 is open and has current hosted endpoint and 15-tool proof; Packrift is not confirmed as a listed server.",
    next_action: "Monitor issue #2189 and MCP.so search; avoid a duplicate owner-authenticated submission unless MCP.so requests it.",
  },
  browse_sh: {
    status: "catalog_live_installable",
    method: "Browse Add website / catalog skill submission flow",
    evidence:
      "Browse accepted and published Packrift on 2026-05-19 as packrift.com/exact-spec-packaging-procurement-e4ujmy. browse skills find returns verified=true, recommendedMethod=mcp, proxies=true, and browse skills add installed the skill locally.",
    next_action:
      "Monitor Browse install count and skill quality, keep the Packrift MCP endpoint current, and update the skill if Browserbase changes the generated source or catalog slug.",
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
    evidence:
      "On 2026-05-19, the MCPfinder submit form reported that https://github.com/Packrift/packrift-mcp has already been submitted and is under review; Packrift is not visible in the browsable index yet.",
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
  mcplist_ai: {
    status: "submit_path_unclear",
    method: "Directory search plus unclear submit path",
    evidence: "MCPLIST has a public MCP server directory; its FAQ references submission through a form or GitHub repository, but no clean public submit URL was confirmed.",
    next_action: "Find the current MCPLIST submission form or repository path, then submit the hosted endpoint and source-specific update card.",
  },
  mcphubz: {
    status: "login_required_contact_broken",
    method: "Login-gated submit page; public contact form endpoint is broken",
    evidence:
      "MCPHubz /submit redirects to login, unauthenticated /api/servers returns 401, and the public contact Formspree action returned FORM_NOT_FOUND for the Packrift listing request.",
    next_action:
      "Use an authenticated MCPHubz session or a working owner contact path before retrying; do not treat the public contact page as a valid submission route.",
  },
  mcp_blue: {
    status: "parked_domain_blocked",
    method: "Live submit check blocked by parked/fingerprint-gated domain",
    evidence:
      "https://www.mcp.blue/submit returns 200 but behaves like a parked/fingerprint gate, sets a __tad cookie, and following the gate reaches ww17.mcp.blue/submit with 'Error. Page cannot be displayed.'",
    next_action: "Do not spend time submitting until the directory domain is live again; monitor only.",
  },
  findmcp_dev: {
    status: "submit_cta_broken",
    method: "Submit route renders the directory landing page and the submit CTA is broken",
    evidence:
      "https://findmcp.dev/submit renders the homepage instead of a form; the visible List Your Server CTA triggers the frontend error openWaitlist is not defined.",
    next_action: "Find a real contact, repository, or fixed submit endpoint before attempting another submission.",
  },
  mcplane: {
    status: "validator_rejected_public_repo",
    method: "Publish Server form attempted and rejected the public GitHub repository",
    evidence: "On 2026-05-19, MCPLane /mcp_servers/new returned 'Repository not found or private' for the public https://github.com/Packrift/packrift-mcp repo, which GitHub confirms is public.",
    next_action: "Contact MCPLane or retry only after their GitHub validator accepts public org repositories.",
  },
  mcpsolutions_dev: {
    status: "submitted_pending",
    method: "MCP Solutions public Formspree-backed listing form",
    evidence: "MCP Solutions basic listing form returned ok=true after receiving the hosted endpoint, GitHub repo, source-specific proof, and no-auth MCP config.",
    next_action: "Monitor MCP Solutions explore/search for publication; use the source-specific update card if review asks for current endpoint proof.",
  },
  gpmcp: {
    status: "manual_contact_or_hosting_evaluation",
    method: "Manual contact or hosting/provider evaluation",
    evidence: "GPMCP exposes MCP hosting and browsing, but no public submit/update form was found.",
    next_action: "Monitor GPMCP for a listing/import/contact path and use the source-specific update card if one opens.",
  },
  theresamcpforthat: {
    status: "monitor_or_submit",
    method: "Directory monitoring and manual submit/contact if available",
    evidence: "There's an MCP for That is a public MCP discovery directory; no public submit/update instruction was visible.",
    next_action: "Monitor for a public submit or repository path and use the source-specific update card when available.",
  },
  mcpserverfinder: {
    status: "email_submission_ready",
    method: "Public submit email",
    evidence: "MCP Server Finder exposes a Submit mailto link and search returned no Packrift result.",
    next_action: "Email MCP Server Finder with the hosted endpoint, marketplace manifest, and source-specific update card.",
  },
  mcpserver_cc: {
    status: "submitted_pending",
    method: "Submitted through mcpserver.cc public submit API",
    evidence:
      "mcpserver.cc /api/submit-server returned ok with uuid a33d70b5-aafd-4961-b8c2-29a70c664e76 after receiving the Packrift MCP GitHub repository.",
    next_action:
      "Monitor mcpserver.cc for publication; use the source-specific update card or support@mcpserver.cc if review asks for hosted endpoint proof.",
  },
  mcpserverspot: {
    status: "submitted_pending",
    method: "MCP Server Spot public no-login submit form",
    evidence:
      "MCP Server Spot returned the browser confirmation 'Server Submitted Successfully! Your server has been added to the directory.' after receiving Packrift MCP fields, hosted endpoint, GitHub repo, and live directory refresh proof.",
    next_action:
      "Monitor MCP Server Spot search for publication; use the source-specific update card if review asks for hosted endpoint proof.",
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

function trackedInstallUrl(source, target) {
  return TRACKED_INSTALL_TEMPLATE.replace("{source}", source).replace("{target}", target);
}

function trackedRunUrl(source, target) {
  return TRACKED_RUN_TEMPLATE.replace("{source}", source).replace("{target}", target);
}

function directoryUpdateCardUrl(source) {
  return `https://mcp.packrift.com/ai/mcp-directory-update/${source}.json`;
}

function publicProofLine(pack) {
  const proof = pack.live_proof ?? {};
  const tools = proof.mcp_tools_list?.tools_count ?? pack.copy?.tools_count ?? 14;
  const resources = proof.mcp_resources_list?.resources_count ?? proof.health?.resources_count ?? 83;
  const prompts = proof.mcp_prompts_list?.prompts_count ?? 9;
  const directoryRelease = proof.mcp_directory_refresh?.release ?? "PACKRIFT-MCP-DIRECTORY-REFRESH-R13";
  const directoryTargets = proof.mcp_directory_refresh?.targets_count ?? 17;
  const firstRunRelease = proof.mcp_first_run_proof?.release ?? "PACKRIFT-MCP-FIRST-RUN-PROOF-R01";
  const workflowGalleryRelease = proof.mcp_workflow_gallery?.release ?? "PACKRIFT-MCP-WORKFLOW-GALLERY-R01";
  const browserbaseRelease = proof.browserbase_browse_skill_pack?.release ?? "PACKRIFT-BROWSERBASE-BROWSE-SKILL-PACK-R05";
  const clientConfigRelease = proof.mcp_client_config?.release ?? "PACKRIFT-MCP-CLIENT-CONFIG-R02";
  return `Current proof: live MCP returns ${tools} tools, ${resources} resources, and ${prompts} prompts. Client config is ${clientConfigRelease}; tracked config template is https://mcp.packrift.com/r/config/{source}. First-run proof is ${firstRunRelease}. Workflow gallery is ${workflowGalleryRelease}. Browserbase Browse SKILL.md is https://mcp.packrift.com/SKILL.md. Browserbase Browse skill pack is ${browserbaseRelease}. Directory refresh pack is ${directoryRelease} with ${directoryTargets} targets. Claude connector submission packet is ${CLAUDE_CONNECTOR_SUBMISSION_URL}.`;
}

function recrawlMessage(pack, target) {
  const missing = target.missing?.length ? `\nCurrent stale/missing markers: ${target.missing.join(", ")}.\n` : "";
  const trackedStart = trackedStartUrl(target.name);
  const trackedConfig = trackedConfigUrl(target.name);
  const trackedInstall = trackedInstallUrl(target.name, "generic_streamable_http");
  const trackedRun = trackedRunUrl(target.name, "generic_streamable_http");
  const trackedRunHtml = `${trackedRun}?format=html`;
  const trackedRunExecute = `${trackedRun}?execute=1`;
  const reviewerActivation = `https://mcp.packrift.com/r/activate/${target.name}?format=html`;
  const updateCard = directoryUpdateCardUrl(target.name);
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
    `- Source-specific update card: ${updateCard}`,
    `- Tracked MCP JSON config: ${trackedConfig}`,
    `- Tracked generic install action: ${trackedInstall}`,
    `- Tracked first-run action: ${trackedRun}`,
    `- Browser first-run page: ${trackedRunHtml}`,
    `- One-click live proof: ${trackedRunExecute}`,
    `- Reviewer activation browser runner: ${reviewerActivation}`,
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
    "- Source activation sitemap: https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml",
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
    directory_update_card_url: directoryUpdateCardUrl(target.name),
    tracked_install_url: trackedInstallUrl(target.name, "generic_streamable_http"),
    tracked_first_run_url: trackedRunUrl(target.name, "generic_streamable_http"),
    tracked_first_run_live_proof_url: `${trackedRunUrl(target.name, "generic_streamable_http")}?execute=1`,
    reviewer_activation_runner_url: `https://mcp.packrift.com/r/activate/${target.name}?format=html`,
    previous_status: previous?.status ?? null,
    form_fields: target.form_fields,
    proof_urls: {
      ...target.proof_urls,
      tracked_start: trackedStartUrl(target.name),
      tracked_config: trackedConfigUrl(target.name),
      directory_update_card: directoryUpdateCardUrl(target.name),
      tracked_install_generic: trackedInstallUrl(target.name, "generic_streamable_http"),
      tracked_first_run_generic: trackedRunUrl(target.name, "generic_streamable_http"),
      tracked_first_run_generic_execute: `${trackedRunUrl(target.name, "generic_streamable_http")}?execute=1`,
      reviewer_activation_runner: `https://mcp.packrift.com/r/activate/${target.name}?format=html`,
      claude_connector_submission: CLAUDE_CONNECTOR_SUBMISSION_URL,
    },
    recrawl_message: recrawlMessage(pack, target),
  };
}

function markdown(payload) {
  const rows = payload.actions
    .map(
      (action) =>
        `| ${action.label} | ${action.status} | ${action.current_distribution_status} | ${action.priority} | ${action.directory_update_card_url} | ${action.tracked_start_url} | ${action.tracked_config_url} | ${action.tracked_first_run_live_proof_url} | ${action.next_action} |`
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
    "| Target | Action status | Directory status | Priority | Update card | Tracked start URL | Tracked config URL | Live proof URL | Next action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
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
