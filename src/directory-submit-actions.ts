import { TRACKED_INSTALL_TEMPLATE, mcpFirstUsefulRun, trackedInstallUrl } from "./install-action.js";
import { TRACKED_RUN_TEMPLATE, trackedRunUrl } from "./first-run-action.js";

export interface DirectorySubmitActionsRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
  toolNames?: string[];
  sourceActivationQueue?: DirectorySubmitSourceActivationQueue;
}

export interface DirectorySubmitSourceActivationCounts {
  starts?: number;
  tracked_config_fetches?: number;
  install_intents?: number;
  first_run_actions?: number;
  first_run_executions?: number;
  preferred_target?: string;
  mcp_tool_calls?: number;
  create_cart_url_calls?: number;
  external_qualified_create_cart_url_calls?: number;
  qualified_cart_landings?: number;
}

export interface DirectorySubmitSourceActivationState {
  source: string;
  priority?: string;
  priority_score?: number;
  current_stage?: string;
  target_event_to_watch?: string;
  recommended_action?: string;
  primary_action_url?: string;
  buyer_handoff_url?: string | null;
  current_counts?: DirectorySubmitSourceActivationCounts;
}

export interface DirectorySubmitSourceActivationQueue {
  release?: string | null;
  status?: string | null;
  operator_url?: string | null;
  rows?: DirectorySubmitSourceActivationState[];
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const MCP_START_URL = "https://mcp.packrift.com/start";
const MCP_START_JSON_URL = "https://mcp.packrift.com/ai/mcp-start.json";
const MCP_TRACKED_START_TEMPLATE = "https://mcp.packrift.com/r/start/{source}";
const MCP_TRACKED_CONFIG_TEMPLATE = "https://mcp.packrift.com/r/config/{source}";
const DIRECTORY_REFRESH_URL = "https://mcp.packrift.com/ai/mcp-directory-refresh.json";
const INSTALL_MATRIX_URL = "https://mcp.packrift.com/ai/mcp-install-matrix.json";
const CLIENT_CONFIG_URL = "https://mcp.packrift.com/ai/mcp-client-config.json";
const ROOT_MCP_JSON_URL = "https://mcp.packrift.com/mcp.json";
const WELL_KNOWN_MCP_JSON_URL = "https://mcp.packrift.com/.well-known/mcp.json";
const DIRECTORY_SUBMIT_ACTIONS_URL = "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json";
const CLAUDE_CONNECTOR_SUBMISSION_URL = "https://mcp.packrift.com/ai/claude-connector-submission.json";
const AGENT_CAPTURE_OUTREACH_URL = "https://mcp.packrift.com/ai/agent-capture-outreach.json";
const AGENT_CAPTURE_OUTREACH_HTML_URL = "https://mcp.packrift.com/ai/agent-capture-outreach.html";
const CART_ACTIVATION_URL = "https://mcp.packrift.com/ai/mcp-cart-activation.json";
const FUNNEL_SNAPSHOT_URL = "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json";
const USAGE_SNAPSHOT_URL = "https://mcp.packrift.com/ai/mcp-usage-snapshot.json";
const GA4_FUNNEL_PROOF_URL = "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json";
const SOURCE_ACTIVATION_QUEUE_URL = "https://mcp.packrift.com/ai/mcp-source-activation-queue.json";
const SOURCE_ACTIVATION_SITEMAP_URL = "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml";
const ACTIVATION_EXPERIMENTS_URL = "https://mcp.packrift.com/ai/mcp-activation-experiments.json";
const ACTIVATION_WAVE_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.json";
const ACTIVATION_WAVE_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.md";
const ACTIVATION_WAVE_HTML_URL = "https://mcp.packrift.com/ai/mcp-activation-wave.html";
const ACTIVATION_WAVE_RUNNER_URL = "https://mcp.packrift.com/ai/mcp-activation-wave-runner.sh";
const EXTERNAL_ACTIVATION_BRIEF_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief.json";
const EXTERNAL_ACTIVATION_BRIEF_HTML_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief.html";
const EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief-tasks.jsonl";
const EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief-tasks.csv";
const EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief-runner.sh";
const REVENUE_CONVERSION_QUEUE_URL = "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.json";
const REVENUE_CONVERSION_QUEUE_HTML_URL = "https://mcp.packrift.com/ai/mcp-revenue-conversion-queue.html";
const BUYER_ORDER_HANDOFFS_URL = "https://mcp.packrift.com/ai/mcp-buyer-order-handoffs.json";
const BUYER_ORDER_HANDOFFS_HTML_URL = "https://mcp.packrift.com/ai/mcp-buyer-order-handoffs.html";
const INSTALL_ACTIONS_URL = "https://mcp.packrift.com/ai/mcp-install-actions.json";
const FIRST_RUN_PROOF_URL = "https://mcp.packrift.com/ai/mcp-first-run-proof.json";
const WORKFLOW_GALLERY_URL = "https://mcp.packrift.com/ai/mcp-workflow-gallery.json";
const MCP_EVAL_PACK_URL = "https://mcp.packrift.com/ai/mcp-eval-pack.json";
const MCP_EVAL_PACK_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-eval-pack.md";
const MCP_TOOL_DISCOVERY_URL = "https://mcp.packrift.com/ai/mcp-tools.json";
const MCP_TOOL_DISCOVERY_MARKDOWN_URL = "https://mcp.packrift.com/ai/spec-finder-tools.md";
const REVIEWER_ACTIVATION_URL = "https://mcp.packrift.com/ai/mcp-reviewer-activation.json";
const MCP_TRACKED_REVIEWER_ACTIVATION_TEMPLATE = "https://mcp.packrift.com/r/activate/{source}";
const MCP_TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE = "https://mcp.packrift.com/r/activate/{source}?format=html";
const MCP_TRACKED_ORDER_HANDOFF_TEMPLATE = "https://mcp.packrift.com/r/order/{source}";
const MCP_TRACKED_ORDER_HANDOFF_HTML_TEMPLATE = "https://mcp.packrift.com/r/order/{source}?format=html";
const MARKETPLACE_MANIFEST_URL = "https://mcp.packrift.com/.well-known/mcp-marketplace.json";
const ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/SKILL.md";
const BROWSERBASE_BROWSE_SKILL_PACK_URL = "https://mcp.packrift.com/ai/browserbase-browse-skill-pack.json";
const CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL = "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md";
const DEFAULT_TOOL_NAMES = [
  "search_products",
  "get_product",
  "get_pricing",
  "check_inventory",
  "find_packaging_for_item",
  "get_shipping_estimate",
  "get_cart_handoff_candidates",
  "create_cart_url",
  "prepare_purchase_handoff",
  "compare_alternatives",
  "pack_calculator",
  "inventory_status",
  "get_reorder_link",
  "get_bulk_quote_link",
  "explain_no_exact_match",
];

const ACTIONS = [
  {
    id: "official_registry",
    label: "Official MCP Registry",
    action_status: "published_current",
    directory_status: "pass",
    priority: "core",
    method: "Published through the official MCP Registry server package.",
    evidence: "Official registry latest version is current and points at the hosted Packrift MCP endpoint.",
    stale_markers: [],
    recrawl_subject: "Keep official MCP Registry Packrift MCP entry current",
    next_action: "Publish with mcp-publisher whenever the public MCP surface changes.",
    listing_url: "https://registry.modelcontextprotocol.io/servers/io.github.Packrift/packrift-mcp",
    submission_url: "https://github.com/modelcontextprotocol/registry",
  },
  {
    id: "mcpservers_org",
    label: "mcpservers.org",
    action_status: "published_current",
    directory_status: "pass",
    priority: "high",
    method: "Submitted through the public listing flow.",
    evidence:
      "mcpservers.org now publishes the current Packrift MCP listing with the hosted endpoint, current cart-handoff tool surface, and no stale proof markers in the live distribution check.",
    stale_markers: [],
    recrawl_subject: "Monitor mcpservers.org Packrift MCP listing",
    next_action:
      "Do not resubmit. Monitor the live listing and use the source-specific install, first-run, eval-pack, and order-handoff links only if mcpservers.org asks for refreshed proof.",
    listing_url: "https://mcpservers.org/servers/packrift/packrift-mcp",
    submission_url: "https://mcpservers.org/submit",
  },
  {
    id: "glama_connector",
    label: "Glama hosted connector",
    action_status: "hosted_connector_live",
    directory_status: "pass",
    priority: "high",
    method: "Hosted Glama connector ingestion.",
    evidence: "Glama hosted connector is healthy and lists the current 15-tool remote MCP surface.",
    stale_markers: [],
    recrawl_subject: "Keep Glama hosted connector Packrift MCP entry current",
    next_action: "Monitor the hosted connector and use the source server listing only as secondary recrawl cleanup.",
    listing_url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    submission_url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
  },
  {
    id: "glama_server_listing",
    label: "Glama source server listing",
    action_status: "manual_support_refresh_needed",
    directory_status: "stale",
    priority: "high",
    method: "Glama source-listing admin release and sync.",
    evidence:
      "The hosted Glama connector is healthy, but the source server listing has no Glama release, no quality evaluation, and still returns zero tools in the Glama source API.",
    stale_markers: ["no Glama release", "quality not tested", "zero tools"],
    recrawl_subject: "Release and sync Glama Packrift MCP source listing",
    next_action:
      "Use Glama source-listing admin to claim the server, configure the repo Dockerfile, make a Glama release, then sync the server so quality scoring can run.",
    listing_url: "https://glama.ai/mcp/servers/ye4xxr7qiu",
    submission_url: "https://glama.ai/",
  },
  {
    id: "mcp_directory",
    label: "MCP.Directory",
    action_status: "already_submitted",
    directory_status: "stale",
    priority: "high",
    method: "Repository already submitted through the public API.",
    evidence: "The repository submission is already queued for review, but Packrift is not yet visible in search.",
    stale_markers: ["Packrift not visible in search"],
    recrawl_subject: "Refresh MCP.Directory Packrift MCP listing to current hosted endpoint",
    next_action: "Use the refreshed proof message to request review, claim, or update access.",
    listing_url: "https://mcp.directory/servers?q=packrift",
    submission_url: "https://mcp.directory/submit",
  },
  {
    id: "anthropic_connectors_directory",
    label: "Claude Connectors Directory",
    action_status: "auth_gated_manual",
    directory_status: "unlisted",
    priority: "high",
    method: "Manual Google Forms submission after sign-in.",
    evidence:
      "The Claude connector directory submission URL redirects to a Google Forms sign-in page; the Packrift submission packet is ready, but the form needs an authenticated browser session.",
    stale_markers: ["Packrift not yet visible in Claude connector discovery"],
    recrawl_subject: "Submit Packrift MCP to the Claude Connectors Directory",
    next_action:
      "Submit through an authenticated Google Forms session using the Claude connector submission packet with hosted endpoint, no-auth policy, legal/support links, first-run proof, and tracked start/config URLs.",
    listing_url: "https://claude.com/connectors",
    submission_url: "https://clau.de/mcp-directory-submission",
  },
  {
    id: "smithery",
    label: "Smithery",
    action_status: "api_key_required",
    directory_status: "unlisted",
    priority: "high",
    method: "Smithery publish flow or CLI publish with API key.",
    evidence: "The CLI publish path is gated by a Smithery API key; the public server card now exposes schema-friendly fields.",
    stale_markers: ["Packrift not visible in Smithery search"],
    recrawl_subject: "Publish Packrift MCP to Smithery",
    next_action: "Publish through Smithery with the hosted endpoint after authenticating, then monitor search listing and installs.",
    listing_url: "https://smithery.ai/servers?q=Packrift",
    submission_url: "https://smithery.ai/new",
  },
  {
    id: "cline_mcp_marketplace",
    label: "Cline MCP Marketplace",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "high",
    method: "GitHub issue submission.",
    evidence:
      "Cline MCP Marketplace issue #1610 is open; the latest proof comment now includes first-run, usage, and funnel snapshots plus the source-aware first_useful_run sequence.",
    stale_markers: ["Packrift not yet visible as a published Cline marketplace listing"],
    recrawl_subject: "Review Cline MCP Marketplace Packrift MCP submission",
    next_action:
      "Monitor for marketplace publication; reviewers can use the linked first_useful_run sequence, and further comments should only respond to maintainer requests.",
    listing_url: "https://github.com/cline/mcp-marketplace/issues/1610",
    submission_url: "https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml",
  },
  {
    id: "mcp_so",
    label: "MCP.so",
    action_status: "submitted_pending",
    directory_status: "unlisted",
    priority: "high",
    method: "GitHub issue submission updated after the auth-gated public submit form.",
    evidence:
      "chatmcp/mcpso issue #2189 is open and was updated on 2026-05-19 with the current hosted endpoint, 15-tool surface, tracked install page, and MCP.so activation runner.",
    stale_markers: ["Packrift not visible as a confirmed MCP.so server result"],
    recrawl_subject: "Review MCP.so Packrift MCP submission",
    next_action:
      "Monitor issue #2189 and MCP.so search; do not create a duplicate submission unless MCP.so asks for a fresh owner-authenticated form entry.",
    listing_url: "https://mcp.so/servers?keyword=Packrift",
    submission_url: "https://github.com/chatmcp/mcpso/issues/2189",
  },
  {
    id: "punkpeye_awesome_mcp",
    label: "punkpeye/awesome-mcp-servers",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "high",
    method: "GitHub pull request.",
    evidence:
      "punkpeye/awesome-mcp-servers PR #5606 is the canonical Packrift submission; duplicate automated PR #6649 was closed, and the remaining blocker is the Glama source listing quality score.",
    stale_markers: ["Glama source/server listing quality not tested"],
    recrawl_subject: "Review Packrift MCP punkpeye/awesome-mcp-servers PR",
    next_action:
      "Keep PR #5606 current with hosted connector and score proof until the Glama score blocker clears; avoid duplicate automated PRs.",
    listing_url: "https://github.com/punkpeye/awesome-mcp-servers/pull/5606",
    submission_url: "https://github.com/punkpeye/awesome-mcp-servers/pull/5606",
  },
  {
    id: "browse_sh",
    label: "Browserbase Browse / browse.sh",
    action_status: "catalog_live_installable",
    directory_status: "pass",
    priority: "high",
    method: "Browse Add website / catalog skill submission flow.",
    evidence:
      "Browse accepted and published Packrift on 2026-05-19 as packrift.com/exact-spec-packaging-procurement-e4ujmy. browse skills find returns verified=true, recommendedMethod=mcp, proxies=true, and browse skills add installed the skill locally.",
    stale_markers: [],
    recrawl_subject: "Keep Packrift Browse catalog skill current",
    next_action:
      "Monitor Browse install count and skill quality, keep the Packrift MCP endpoint current, and update the skill if Browserbase changes the generated source or catalog slug.",
    listing_url: "https://browse.sh/",
    submission_url: "https://browse.sh/",
  },
  {
    id: "mcp_marketplace_io",
    label: "MCP Marketplace",
    action_status: "email_draft_ready",
    directory_status: "stale",
    priority: "medium",
    method: "Support-address recrawl draft after public creator flow stayed stale.",
    evidence:
      "The public MCP Marketplace listing exists but still shows the older 14-tool surface; the hosted marketplace manifest exposes the full 15-tool no-auth remote endpoint, and an unsent support@mcp-marketplace.io draft is ready.",
    stale_markers: ["toolCount 14", "prepare_purchase_handoff missing", "hosted endpoint framed as self-host credentials"],
    recrawl_subject: "Refresh MCP Marketplace Packrift listing to the current 15-tool hosted endpoint",
    next_action:
      "Review and send the existing support@mcp-marketplace.io draft with the hosted marketplace manifest, selected external activation task feeds, server card, and mcp_marketplace_io first-run activation card.",
    listing_url: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
    submission_url: "mailto:support@mcp-marketplace.io",
  },
  {
    id: "pulsemcp_packrift",
    label: "PulseMCP",
    action_status: "manual_support_refresh_needed",
    directory_status: "blocked",
    priority: "high",
    method: "Support recrawl request using official-registry proof.",
    evidence:
      "Automated verification can be blocked, but the official MCP registry and Packrift hosted endpoint are current.",
    stale_markers: ["checker blocked or listing unavailable"],
    recrawl_subject: "Refresh PulseMCP Packrift MCP listing to current hosted endpoint",
    next_action: "Ask PulseMCP to refresh from the official registry, server.json, and public proof URLs.",
    listing_url: "https://www.pulsemcp.com/servers/packrift",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
  },
  {
    id: "mcpmarket_com",
    label: "MCP Market",
    action_status: "email_draft_ready",
    directory_status: "blocked",
    priority: "medium",
    method: "Public Terms contact route after Vercel checkpoint blocked browser update flow.",
    evidence:
      "Automated checks hit a Vercel security checkpoint; MCP Market Terms lists hi@mcpmarketplace.com as the Sitka Labs contact address, so a review-ready draft is the safest available update path.",
    stale_markers: ["checker blocked", "hosted endpoint/current server card not verified by automation", "submit page blocked by Vercel checkpoint"],
    recrawl_subject: "Update MCP Market Packrift MCP listing to current hosted endpoint",
    next_action: "Review and send the hi@mcpmarketplace.com draft with the hosted endpoint, current server card, and mcpmarket_com first-run proof.",
    listing_url: "https://mcpmarket.com/server/packrift",
    submission_url: "mailto:hi@mcpmarketplace.com",
  },
  {
    id: "cursor_directory",
    label: "Cursor Directory",
    action_status: "auth_gated_manual",
    directory_status: "blocked",
    priority: "medium",
    method: "Auth-gated manual submit flow.",
    evidence: "Automated checks hit a Vercel security checkpoint before reaching the plugin submission flow.",
    stale_markers: ["checker blocked", "Packrift not verified in Cursor Directory"],
    recrawl_subject: "Submit Packrift MCP to Cursor Directory",
    next_action: "Use the Cursor Directory plugin submit flow after browser auth, with hosted endpoint and tracked start URL.",
    listing_url: "https://cursor.directory/",
    submission_url: "https://cursor.directory/plugins/new",
  },
  {
    id: "mcpcentral",
    label: "MCP Central",
    action_status: "auth_gated_manual",
    directory_status: "blocked",
    priority: "medium",
    method: "Browser-side submit flow.",
    evidence: "Automated checks hit a Cloudflare challenge.",
    stale_markers: ["checker blocked", "Packrift not verified in MCP Central"],
    recrawl_subject: "Submit Packrift MCP to MCP Central",
    next_action: "Use the browser-side MCP Central submit flow or request review access if auth is required.",
    listing_url: "https://mcpcentral.io/servers",
    submission_url: "https://mcpcentral.io/submit-server",
  },
  {
    id: "mcpfinder",
    label: "MCPfinder",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "medium",
    method: "Manual submit form.",
    evidence:
      "On 2026-05-19, the MCPfinder submit form reported that https://github.com/Packrift/packrift-mcp has already been submitted and is under review; Packrift is not visible in the browsable index yet.",
    stale_markers: ["Packrift not visible in MCPfinder"],
    recrawl_subject: "Monitor MCPfinder Packrift MCP submission",
    next_action: "Monitor for listing approval and provide endpoint proof if MCPfinder asks for more detail.",
    listing_url: "https://www.mcpfinder.org/",
    submission_url: "https://www.mcpfinder.org/submit",
  },
  {
    id: "mcpbench",
    label: "MCPBench",
    action_status: "monitor_upstream_registry",
    directory_status: "stale",
    priority: "medium",
    method: "Registry-derived monitoring.",
    evidence: "The official MCP registry is current; MCPBench appears to lag upstream ingestion.",
    stale_markers: ["latest official registry version not visible"],
    recrawl_subject: "Refresh MCPBench Packrift MCP listing from official registry",
    next_action: "Monitor for official-registry ingestion and cite the directory refresh pack if requesting a recrawl.",
    listing_url: "https://mcpbench.ai/servers/io.github.Packrift/packrift-mcp",
    submission_url: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
  },
  {
    id: "mcpskills",
    label: "MCPSkills",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "medium",
    method: "Submitted through the public /api/submit endpoint.",
    evidence: "Submission returned a success redirect after posting the GitHub repo, ai-tools category, and short hosted MCP description.",
    stale_markers: ["Packrift not yet visible on the server directory"],
    recrawl_subject: "Review MCPSkills Packrift MCP submission",
    next_action: "Monitor for listing publication; use the refreshed proof message if review asks for current endpoint evidence.",
    listing_url: "https://mcpskills.app/servers",
    submission_url: "https://mcpskills.app/submit",
  },
  {
    id: "agentndx",
    label: "AgentNDX",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "medium",
    method: "Submitted through the public /api/submit endpoint.",
    evidence: "Submission returned a success redirect after posting name, GitHub repo, hosted start page, MCP protocol, and short description.",
    stale_markers: ["Packrift not yet visible on the browse directory"],
    recrawl_subject: "Review AgentNDX Packrift MCP submission",
    next_action: "Monitor for listing publication; use the refreshed proof message if review asks for current endpoint evidence.",
    listing_url: "https://agentndx.ai/browse",
    submission_url: "https://agentndx.ai/submit",
  },
  {
    id: "chiark",
    label: "Chiark",
    action_status: "monitor_upstream_registry",
    directory_status: "stale",
    priority: "medium",
    method: "Upstream registry monitoring.",
    evidence: "Chiark is expected to crawl upstream MCP registry and marketplace surfaces.",
    stale_markers: ["Packrift not visible by endpoint or name"],
    recrawl_subject: "Refresh Chiark Packrift MCP coverage from upstream registries",
    next_action: "Monitor after official registry and high-priority directory refreshes propagate.",
    listing_url: "https://chiark.ai/",
    submission_url: "https://chiark.ai/methodology",
  },
  {
    id: "mcplist_ai",
    label: "MCPLIST",
    action_status: "email_draft_ready",
    directory_status: "unlisted",
    priority: "medium",
    method: "Gmail submission draft created; no public submit form found.",
    evidence:
      "A Gmail submission draft is ready for contact@mcplist.ai. MCPLIST has a public MCP server directory, no public submit form was found, and the About page exposes contact@mcplist.ai for contact.",
    stale_markers: ["Packrift not visible in MCPLIST"],
    recrawl_subject: "Submit Packrift MCP to MCPLIST",
    next_action: "Review and send the existing Gmail draft with hosted endpoint, marketplace manifest, update card, and first-useful-run proof.",
    listing_url: "https://www.mcplist.ai/?search=packrift",
    submission_url: "mailto:contact@mcplist.ai",
  },
  {
    id: "mcphubz",
    label: "MCPHubz",
    action_status: "login_required_contact_broken",
    directory_status: "unlisted",
    priority: "medium",
    method: "Login-gated submit page; public contact form endpoint is broken.",
    evidence:
      "MCPHubz /submit redirects to login, unauthenticated /api/servers returns 401, and its public Formspree contact action returned FORM_NOT_FOUND when used for a listing request.",
    stale_markers: ["Packrift not visible in MCPHubz"],
    recrawl_subject: "Submit Packrift MCP to MCPHubz",
    next_action:
      "Use an authenticated MCPHubz session or a working owner contact path before retrying; do not treat the public contact page as a valid submission route.",
    listing_url: "https://mcphubz.com/",
    submission_url: "https://mcphubz.com/submit",
  },
  {
    id: "mcp_blue",
    label: "MCP Blue",
    action_status: "parked_domain_blocked",
    directory_status: "blocked",
    priority: "medium",
    method: "Live submit check blocked by parked/fingerprint-gated domain.",
    evidence:
      "https://www.mcp.blue/submit returns 200 but behaves like a parked/fingerprint gate, sets a __tad cookie, and following the gate reaches ww17.mcp.blue/submit with 'Error. Page cannot be displayed.'",
    stale_markers: ["MCP Blue domain parked or dead", "Packrift not visible in MCP Blue"],
    recrawl_subject: "Recheck MCP Blue domain before submitting Packrift MCP",
    next_action: "Do not spend time submitting until the directory domain is live again; monitor only.",
    listing_url: "https://www.mcp.blue/",
    submission_url: "https://www.mcp.blue/submit",
  },
  {
    id: "findmcp_dev",
    label: "FindMCP",
    action_status: "email_draft_ready",
    directory_status: "unlisted",
    priority: "medium",
    method: "Submit route renders the directory landing page; owner contact route now has an unsent Gmail draft.",
    evidence:
      "https://findmcp.dev/submit renders the homepage instead of a form; Coder AI is the listed parent project for FindMCP/MCPfinder, and an unsent draft to hello@coderai.dev is ready with the source-aware activation request.",
    stale_markers: ["Packrift not visible in FindMCP"],
    recrawl_subject: "Submit Packrift MCP to FindMCP",
    next_action: "Review and send the hello@coderai.dev draft; do not retry the broken submit page unless it is fixed.",
    listing_url: "https://findmcp.dev/",
    submission_url: "mailto:hello@coderai.dev",
  },
  {
    id: "mcplane",
    label: "MCPLane",
    action_status: "validator_rejected_contact_route_identified",
    directory_status: "blocked",
    priority: "medium",
    method: "Publish Server form attempted and rejected the public GitHub repository; public owner routes are identified.",
    evidence:
      "On 2026-05-19, MCPLane /mcp_servers/new returned 'Repository not found or private' for the public https://github.com/Packrift/packrift-mcp repo. The current MCPlane site links to https://github.com/MCPlane and its LinkedIn company page as public owner routes.",
    stale_markers: ["Packrift not visible in MCPLane"],
    recrawl_subject: "Submit Packrift MCP to MCPLane",
    next_action: "Use the MCPlane GitHub organization or LinkedIn company route, or retry only after their GitHub validator accepts public org repositories.",
    listing_url: "https://mcplane.com/mcp_servers?query=packrift",
    submission_url: "https://github.com/MCPlane",
  },
  {
    id: "mcpsolutions_dev",
    label: "MCP Solutions",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "medium",
    method: "Submitted through the public Formspree-backed listing form as a basic/free listing.",
    evidence: "MCP Solutions form submission returned ok=true after posting the hosted endpoint, GitHub repo, source-specific proof, and no-auth MCP config.",
    stale_markers: ["Packrift not yet visible in MCP Solutions explore"],
    recrawl_subject: "Review MCP Solutions Packrift MCP submission",
    next_action: "Monitor MCP Solutions explore/search for publication; use the source-specific update card if review asks for current endpoint proof.",
    listing_url: "https://mcpsolutions.dev/explore/",
    submission_url: "https://mcpsolutions.dev/submit/",
  },
  {
    id: "gpmcp",
    label: "GPMCP",
    action_status: "support_email_only",
    directory_status: "unlisted",
    priority: "medium",
    method: "Support email only; no real no-login submit path found.",
    evidence:
      "GPMCP has placeholder product links, no public marketplace/search API, /api returns 404, and support@gpmcp.com is the only usable contact path found.",
    stale_markers: ["Packrift not visible in GPMCP"],
    recrawl_subject: "Evaluate GPMCP listing or hosting path for Packrift MCP",
    next_action: "Review the existing support@gpmcp.com draft or hold until GPMCP exposes a real submit/import path.",
    listing_url: "https://www.gpmcp.com/",
    submission_url: "https://www.gpmcp.com/",
  },
  {
    id: "theresamcpforthat",
    label: "There's an MCP for That",
    action_status: "static_directory_no_submit",
    directory_status: "unlisted",
    priority: "medium",
    method: "Static directory monitoring; no submit/contact path found.",
    evidence:
      "There's an MCP for That has a public static directory search showing no Packrift result, but no public submit, contact, or repository path was found.",
    stale_markers: ["Packrift not visible in There's an MCP for That"],
    recrawl_subject: "Submit Packrift MCP to There's an MCP for That",
    next_action: "Monitor only until a real submit, contact, or upstream ingestion path appears.",
    listing_url: "https://theresamcpforthat.com/directory?search=packrift",
    submission_url: "https://theresamcpforthat.com/",
  },
  {
    id: "mcpserverfinder",
    label: "MCP Server Finder",
    action_status: "email_draft_ready",
    directory_status: "unlisted",
    priority: "medium",
    method: "Gmail submission draft created via public submit email.",
    evidence: "A Gmail submission draft is ready for info@mcpserverfinder.com. MCP Server Finder exposes a Submit mailto link and search returned no Packrift result.",
    stale_markers: ["Packrift not visible in MCP Server Finder"],
    recrawl_subject: "Submit Packrift MCP to MCP Server Finder",
    next_action: "Review and send the existing Gmail draft with the hosted endpoint, marketplace manifest, update card, and first-useful-run proof.",
    listing_url: "https://www.mcpserverfinder.com/?q=packrift",
    submission_url: "mailto:info@mcpserverfinder.com",
  },
  {
    id: "mcpserver_cc",
    label: "mcpserver.cc",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "medium",
    method: "Submitted through the public submit API.",
    evidence:
      "mcpserver.cc /api/submit-server returned ok with uuid a33d70b5-aafd-4961-b8c2-29a70c664e76 after receiving the Packrift MCP GitHub repository.",
    stale_markers: ["Packrift not yet visible in mcpserver.cc"],
    recrawl_subject: "Review Packrift MCP mcpserver.cc submission",
    next_action:
      "Monitor mcpserver.cc for publication; use the source-specific update card or support@mcpserver.cc if review asks for hosted endpoint proof.",
    listing_url: "https://mcpserver.cc/",
    submission_url: "https://mcpserver.cc/submit",
  },
  {
    id: "mcpserverspot",
    label: "MCP Server Spot",
    action_status: "submitted_pending",
    directory_status: "pending",
    priority: "medium",
    method: "Submitted through the public no-login MCP Server Spot form.",
    evidence:
      "MCP Server Spot returned the browser confirmation 'Server Submitted Successfully! Your server has been added to the directory.' after receiving Packrift MCP fields, hosted endpoint, GitHub repo, and live directory refresh proof.",
    stale_markers: ["Packrift not yet visible in MCP Server Spot search"],
    recrawl_subject: "Review Packrift MCP MCP Server Spot submission",
    next_action:
      "Monitor MCP Server Spot search for publication; use the source-specific update card if review asks for hosted endpoint proof.",
    listing_url: "https://www.mcpserverspot.com/servers?q=packrift",
    submission_url: "https://www.mcpserverspot.com/submit",
  },
  {
    id: "generic",
    label: "Generic MCP source",
    action_status: "source_template",
    directory_status: "not_directory_specific",
    priority: "medium",
    method: "Reusable source-specific activation template.",
    evidence: "Generic tracked start, config, install, run, and activation URLs are available for partner, campaign, and unclassified MCP traffic.",
    stale_markers: [],
    recrawl_subject: "Use generic Packrift MCP source activation template",
    next_action: "Use this only when the source does not have a named directory or host-specific card.",
    listing_url: "https://mcp.packrift.com/start",
    submission_url: "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
  },
  {
    id: "docker_mcp_catalog",
    label: "Docker MCP Catalog",
    action_status: "pending_merge",
    directory_status: "pending",
    priority: "medium",
    method: "GitHub pull request.",
    evidence:
      "Docker MCP Catalog PR #3388 is open and mergeable; the latest proof comment now includes first-run, usage, and funnel snapshots plus the source-aware first_useful_run sequence.",
    recrawl_subject: "Refresh Docker MCP Catalog Packrift entry to current hosted endpoint",
    next_action:
      "Monitor for Docker review and publication; reviewers can use the linked first_useful_run sequence, and further comments should only respond to maintainer requests.",
    listing_url: "https://github.com/docker/mcp-registry/pull/3388",
    submission_url: "https://github.com/docker/mcp-registry/pull/3388",
  },
] as const;

function trackedStartUrl(source: string): string {
  const url = new URL(`https://mcp.packrift.com/r/start/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "directory_recrawl");
  url.searchParams.set("utm_campaign", "packrift_mcp_start");
  url.searchParams.set("utm_content", "directory_submit_actions");
  return url.toString();
}

function trackedConfigUrl(source: string): string {
  const url = new URL(`https://mcp.packrift.com/r/config/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "directory_config");
  url.searchParams.set("utm_campaign", "packrift_mcp_install");
  url.searchParams.set("utm_content", "directory_submit_actions");
  return url.toString();
}

function normalizeDirectoryUpdateSource(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function sourceEvalPackUrl(source: string, format: "json" | "md" = "json"): string {
  const url = new URL(format === "json" ? MCP_EVAL_PACK_URL : MCP_EVAL_PACK_MARKDOWN_URL);
  url.searchParams.set("source", normalizeDirectoryUpdateSource(source));
  return url.toString();
}

function jsonRpcToolCall(id: string, name: string, args: Record<string, unknown>) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

function sourcePreparePurchaseShortcut(source: string, target: string) {
  const sourceSlug = normalizeDirectoryUpdateSource(source) || "generic";
  const targetSlug = normalizeDirectoryUpdateSource(target) || "generic_streamable_http";
  const sourceContext = `${sourceSlug}_directory_prepare_purchase`.slice(0, 80);
  const baseArgs = {
    sku: "1066",
    quantity: 1,
    source_context: sourceContext,
    mcp_source_context: sourceSlug,
    mcp_install_target: targetSlug,
    journey_id: `mcp_directory_review_${sourceSlug}_1066`,
    result_set_id: "mcp_directory_update_prepare_purchase",
    utm_term: "1066",
  };
  const unconfirmedArgs = { ...baseArgs, buyer_confirmed: false };
  const confirmedArgs = { ...baseArgs, buyer_confirmed: true };
  return {
    release: "PACKRIFT-MCP-SOURCE-PREPARE-PURCHASE-SHORTCUT-R01",
    tool_name: "prepare_purchase_handoff",
    endpoint: mcpFirstUsefulRun(sourceSlug, targetSlug).endpoint,
    sku: "1066",
    quantity: 1,
    order_handoff_url: `https://mcp.packrift.com/r/order/${sourceSlug}?format=html`,
    buyer_confirmation_rule:
      "Run buyer_confirmed=false first to confirm live product, price, and inventory. Run buyer_confirmed=true only after a buyer or reviewer approves SKU 1066, quantity 1, and checkout review.",
    no_duplicate_surface_rule:
      "This is a copy-ready call against the existing hosted Packrift MCP endpoint, not a new CLI, server, buyer surface, or checkout path.",
    unconfirmed_arguments: unconfirmedArgs,
    confirmed_arguments_after_buyer_approval: confirmedArgs,
    unconfirmed_json_rpc: jsonRpcToolCall("prepare-1066-unconfirmed", "prepare_purchase_handoff", unconfirmedArgs),
    confirmed_json_rpc_after_buyer_approval: jsonRpcToolCall("prepare-1066-confirmed", "prepare_purchase_handoff", confirmedArgs),
    copy_ready_unconfirmed_json_rpc: JSON.stringify(
      jsonRpcToolCall("prepare-1066-unconfirmed", "prepare_purchase_handoff", unconfirmedArgs),
      null,
      2
    ),
    copy_ready_confirmed_json_rpc_after_buyer_approval: JSON.stringify(
      jsonRpcToolCall("prepare-1066-confirmed", "prepare_purchase_handoff", confirmedArgs),
      null,
      2
    ),
    success_gate:
      `The confirmed call should return a measured https://mcp.packrift.com/r/cart/1066 URL containing mcp_source_context=${sourceSlug} and mcp_install_target=${targetSlug}; it still does not place an order.`,
  };
}

function duplicateWorkGuard(action: (typeof ACTIONS)[number]) {
  const publicThreadIds = new Set(["cline_mcp_marketplace", "mcp_so", "punkpeye_awesome_mcp", "docker_mcp_catalog"]);
  const publishedCurrent =
    action.directory_status === "pass" ||
    ["published_current", "hosted_connector_live", "catalog_live_installable"].includes(action.action_status);
  const alreadySubmitted =
    publicThreadIds.has(action.id) || ["submitted_pending", "pending_merge"].includes(action.action_status);
  const emailDraftReady = action.action_status === "email_draft_ready";

  if (publishedCurrent) {
    return {
      release: "PACKRIFT-MCP-DUPLICATE-WORK-GUARD-R01",
      status: "do_not_resubmit",
      reason:
        "This surface is already live or current enough to monitor. Additional submissions would create duplicate work and could dilute reviewer signal.",
      allowed_next_actions: [
        "Monitor the live listing and health checks.",
        "Use source-specific install, first-run, eval-pack, and order-handoff links only if the directory asks for proof.",
        "Keep the existing hosted endpoint https://mcp.packrift.com/mcp as the canonical integration path.",
      ],
      blocked_actions: [
        "Do not submit a duplicate listing.",
        "Do not post another unsolicited public comment.",
        "Do not create a separate Packrift CLI, buyer surface, or checkout path.",
      ],
    };
  }

  if (alreadySubmitted) {
    return {
      release: "PACKRIFT-MCP-DUPLICATE-WORK-GUARD-R01",
      status: "monitor_existing_submission",
      reason:
        "A canonical public issue, PR, or pending submission already exists. New work should update or monitor that existing lane instead of creating a parallel submission.",
      allowed_next_actions: [
        "Monitor the existing issue, PR, or submitted listing.",
        "Reply only when maintainers request more evidence.",
        "Use the source-specific activation and order-handoff proof URLs as the single evidence bundle.",
      ],
      blocked_actions: [
        "Do not open a duplicate issue or PR.",
        "Do not post another unsolicited proof dump.",
        "Do not create a new wrapper surface instead of using the hosted MCP endpoint.",
      ],
    };
  }

  if (emailDraftReady) {
    return {
      release: "PACKRIFT-MCP-DUPLICATE-WORK-GUARD-R01",
      status: "single_reviewed_outreach_only",
      reason:
        "A single owner/contact path is ready. Send or update that one route only after review; do not fan out duplicate messages to unrelated contacts.",
      allowed_next_actions: [
        "Review the existing draft or concise email payload.",
        "Send one current proof packet to the identified owner route.",
        "Track replies against this source-specific action row.",
      ],
      blocked_actions: [
        "Do not send multiple near-duplicate emails.",
        "Do not retry broken public submit forms unless their status changes.",
        "Do not create a separate Packrift integration surface for the directory.",
      ],
    };
  }

  return {
    release: "PACKRIFT-MCP-DUPLICATE-WORK-GUARD-R01",
    status: "action_allowed_with_current_packet",
    reason:
      "This lane can still move forward, but only by using the existing Packrift MCP endpoint and the source-specific packet attached to this action row.",
    allowed_next_actions: [
      "Use the listed submission or owner route once.",
      "Include the tracked source-specific proof URLs.",
      "Verify the listing after submission before taking further action.",
    ],
    blocked_actions: [
      "Do not create a duplicate buyer or CLI surface.",
      "Do not submit without the current no-auth hosted MCP endpoint proof.",
      "Do not count browser-only proof as source activation.",
    ],
  };
}

function formattedUrl(value: string, format: "html" | "md" | "json" | "sh"): string {
  const url = new URL(value);
  url.searchParams.set("format", format);
  return url.toString();
}

function mailtoRecipient(action: (typeof ACTIONS)[number]): string | null {
  if (!action.submission_url.startsWith("mailto:")) return null;
  try {
    return decodeURIComponent(new URL(action.submission_url).pathname);
  } catch {
    return action.submission_url.replace(/^mailto:/, "") || null;
  }
}

function sourceReleaseReadiness(action: (typeof ACTIONS)[number]) {
  if (action.id === "glama_server_listing") {
    return {
      release: "PACKRIFT-MCP-SOURCE-LISTING-READINESS-R01",
      status: "ready_for_glama_admin_release",
      blocker:
        "Glama's hosted connector is current, but the source server API still reports zero tools and a required SHOPIFY_PACKRIFT_TOKEN.",
      no_duplicate_surface_rule:
        "Release and sync the existing Packrift/packrift-mcp repository and hosted Packrift MCP endpoint; do not create a separate Packrift CLI or buyer surface.",
      source_api_url: "https://glama.ai/api/mcp/v1/servers/Packrift/packrift-mcp",
      hosted_connector_url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
      repository_url: "https://github.com/Packrift/packrift-mcp",
      docker_readiness: {
        dockerfile: "Dockerfile",
        image: "ghcr.io/packrift/packrift-mcp:latest",
        local_run_without_token: "docker run --rm -p 8787:8787 ghcr.io/packrift/packrift-mcp:latest",
        tools_list_without_token: true,
        expected_tools_count: 15,
        expected_resources_min: 600,
        token_policy:
          "SHOPIFY_PACKRIFT_TOKEN is not required for MCP tools/list, resources/list, discovery, or directory scanning. It is required only when self-hosting live Shopify-backed catalog, pricing, inventory, shipping, and cart tool calls.",
      },
      admin_steps: [
        "Claim the Packrift source server in Glama admin.",
        "Use the repository Dockerfile for source-listing release checks.",
        "Run the release/sync so Glama re-evaluates tools/list and resources/list.",
        "Confirm the source API shows at least 15 tools and no longer treats SHOPIFY_PACKRIFT_TOKEN as required for basic MCP discovery.",
        "Keep traffic pointed at the hosted no-auth Streamable HTTP endpoint https://mcp.packrift.com/mcp.",
      ],
      acceptance_check: [
        "Hosted connector remains healthy with 15 tools.",
        "Source listing API reports at least 15 tools.",
        "Source listing quality can run without a buyer-side API key.",
        "punkpeye/awesome-mcp-servers PR #5606 no longer has a Glama source quality blocker.",
      ],
      proof_urls: {
        hosted_endpoint: MCP_ENDPOINT,
        health: "https://mcp.packrift.com/health",
        tool_discovery: MCP_TOOL_DISCOVERY_URL,
        source_update_card: "https://mcp.packrift.com/ai/mcp-directory-update/glama_server_listing.json",
        source_eval_pack: sourceEvalPackUrl("glama_server_listing"),
        directory_actions: DIRECTORY_SUBMIT_ACTIONS_URL,
      },
    };
  }

  if (action.id === "punkpeye_awesome_mcp") {
    return {
      release: "PACKRIFT-MCP-SOURCE-LISTING-READINESS-R01",
      status: "blocked_by_glama_source_quality",
      blocker:
        "The canonical punkpeye/awesome-mcp-servers PR is open and mergeable; the remaining blocker is Glama source-listing quality for Packrift.",
      no_duplicate_surface_rule:
        "Keep PR #5606 as the canonical submission and do not open duplicate automated PRs.",
      canonical_pr_url: "https://github.com/punkpeye/awesome-mcp-servers/pull/5606",
      unblocker_update_card: "https://mcp.packrift.com/ai/mcp-directory-update/glama_server_listing.json",
      acceptance_check: [
        "Glama source listing reports the current Packrift MCP tools.",
        "PR #5606 stays open or merges cleanly.",
        "After merge, run a real external MCP host activation, not a browser-only proof.",
      ],
    };
  }

  return null;
}

function conciseDirectoryEmail(runtime: DirectorySubmitActionsRuntime, action: (typeof ACTIONS)[number]) {
  const trackedStart = trackedStartUrl(action.id);
  const trackedConfig = trackedConfigUrl(action.id);
  const trackedInstall = trackedInstallUrl(action.id, "generic_streamable_http");
  const trackedRun = trackedRunUrl(action.id, "generic_streamable_http");
  const reviewerActivationHtml = `https://mcp.packrift.com/r/activate/${action.id}?format=html`;
  const orderHandoffHtml = `https://mcp.packrift.com/r/order/${action.id}?format=html`;
  const evalPack = sourceEvalPackUrl(action.id);
  const preferredTarget = sourceActivationStateFor(runtime, action.id)?.current_counts?.preferred_target ?? "generic_streamable_http";
  const preparePurchaseShortcut = sourcePreparePurchaseShortcut(action.id, preferredTarget);
  const staleLine =
    "stale_markers" in action && action.stale_markers?.length
      ? `Current stale/missing markers: ${action.stale_markers.join(", ")}.`
      : "Current stale/missing markers: none.";
  const sourceActivation = sourceActivationStateFor(runtime, action.id);
  const sourceActivationLine = sourceActivationReviewLine(sourceActivation);
  const sourceActivationNextAction = sourceActivation?.recommended_action
    ? `Source-specific next action: ${sourceActivation.recommended_action}`
    : null;
  const proofUrls = {
    endpoint: MCP_ENDPOINT,
    health: "https://mcp.packrift.com/health",
    start: MCP_START_URL,
    tracked_start: trackedStart,
    tracked_config: trackedConfig,
    tracked_install: formattedUrl(trackedInstall, "html"),
    first_run: formattedUrl(trackedRun, "html"),
    activation_runner: reviewerActivationHtml,
    order_handoff: orderHandoffHtml,
    eval_pack: evalPack,
    tool_discovery: MCP_TOOL_DISCOVERY_URL,
    client_config: CLIENT_CONFIG_URL,
    marketplace_manifest: MARKETPLACE_MANIFEST_URL,
    outreach_board: AGENT_CAPTURE_OUTREACH_HTML_URL,
  };

  return {
    release: "PACKRIFT-MCP-DIRECTORY-CONCISE-EMAIL-R02",
    to: mailtoRecipient(action),
    subject: action.recrawl_subject,
    body: [
      "Hi,",
      "",
      `Please review or refresh Packrift MCP for ${action.label}. The hosted MCP endpoint is live at ${MCP_ENDPOINT} and requires no buyer-side API key.`,
      "",
      `Current proof: ${runtime.toolsCount} tools, ${runtime.resourcesCount} resources, ${runtime.promptsCount} prompts; exact-spec packaging search, live price, live inventory, no-match handling, and measured cart handoff are all exposed through MCP.`,
      staleLine,
      ...(sourceActivationLine ? [sourceActivationLine] : []),
      ...(sourceActivationNextAction ? [sourceActivationNextAction] : []),
      "",
      "Fast review links:",
      `- Tool discovery: ${MCP_TOOL_DISCOVERY_URL}`,
      `- Client config: ${CLIENT_CONFIG_URL}`,
      `- Marketplace manifest: ${MARKETPLACE_MANIFEST_URL}`,
      `- Tracked start: ${trackedStart}`,
      `- Install page: ${proofUrls.tracked_install}`,
      `- First-run page: ${proofUrls.first_run}`,
      `- Reviewer activation runner: ${reviewerActivationHtml}`,
      `- Host acceptance eval pack: ${evalPack}`,
      `- Buyer/reviewer order handoff: ${orderHandoffHtml}`,
      `- Source-preserving prepare_purchase_handoff shortcut: ${preparePurchaseShortcut.order_handoff_url}`,
      `- Outreach board: ${AGENT_CAPTURE_OUTREACH_HTML_URL}`,
      "",
      "Acceptance check: install the existing hosted Packrift MCP endpoint, run tools/list, then run get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url. For exact SKU review, prepare_purchase_handoff can collapse live product, price, inventory, and source-preserving cart handoff; run buyer_confirmed=false first and buyer_confirmed=true only after buyer/reviewer approval. Please do not treat a browser-only proof page or duplicate public comment as activation.",
      "",
      "Thanks,",
      "Packrift",
    ].join("\n"),
    proof_urls: proofUrls,
    source_activation_state: sourceActivation ?? null,
    acceptance_check: [
      "Install the existing hosted Packrift MCP endpoint only.",
      "Run tools/list from a real MCP host.",
      "Run get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url.",
      "For exact SKU review, run prepare_purchase_handoff with buyer_confirmed=false first, then buyer_confirmed=true only after buyer/reviewer approval.",
      "Accept activation only after create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
      "Do not count browser-only proof, Packrift self-checks, or duplicate public comments as source activation.",
    ],
  };
}

function sourceActivationStateFor(runtime: DirectorySubmitActionsRuntime, source: string): DirectorySubmitSourceActivationState | undefined {
  return runtime.sourceActivationQueue?.rows?.find((row) => row.source === source);
}

function sourceActivationReviewLine(state?: DirectorySubmitSourceActivationState): string | null {
  if (!state) return null;
  const counts = state.current_counts ?? {};
  const proof = [
    `${counts.mcp_tool_calls ?? 0} MCP tool calls`,
    `${counts.create_cart_url_calls ?? 0} create_cart_url calls`,
    `${counts.qualified_cart_landings ?? 0} qualified cart landings`,
  ].join(", ");
  return `Source-specific activation state: ${state.current_stage ?? "activation state available"}; target event: ${state.target_event_to_watch ?? "unknown"}; current proof: ${proof}.`;
}

function sourceActivationRecrawlLines(runtime: DirectorySubmitActionsRuntime, source: string): string[] {
  const state = sourceActivationStateFor(runtime, source);
  if (!state) return [];
  return [
    sourceActivationReviewLine(state) ?? "",
    state.recommended_action ? `Source-specific next action: ${state.recommended_action}` : "",
    state.primary_action_url ? `- Source-specific primary action: ${state.primary_action_url}` : "",
    state.buyer_handoff_url ? `- Buyer/reviewer handoff for this source: ${state.buyer_handoff_url}` : "",
    runtime.sourceActivationQueue?.operator_url ? `- Full source activation queue: ${runtime.sourceActivationQueue.operator_url}` : "",
    "",
  ].filter(Boolean);
}

function proofLine(runtime: DirectorySubmitActionsRuntime): string {
  return `Current proof: live MCP returns ${runtime.toolsCount} tools, ${runtime.resourcesCount} resources, and ${runtime.promptsCount} prompts. Live tool discovery is ${MCP_TOOL_DISCOVERY_URL} and the crawler-readable tool guide is ${MCP_TOOL_DISCOVERY_MARKDOWN_URL}. Start page is ${MCP_START_URL}; client config is ${CLIENT_CONFIG_URL}; marketplace manifest is ${MARKETPLACE_MANIFEST_URL}; source activation sitemap is ${SOURCE_ACTIVATION_SITEMAP_URL}; install actions are ${INSTALL_ACTIONS_URL}; tracked config template is ${MCP_TRACKED_CONFIG_TEMPLATE}; tracked install template is ${TRACKED_INSTALL_TEMPLATE}; tracked run template is ${TRACKED_RUN_TEMPLATE}; reviewer activation template is ${MCP_TRACKED_REVIEWER_ACTIVATION_TEMPLATE}; reviewer activation browser runner template is ${MCP_TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE}; buyer/reviewer order handoff template is ${MCP_TRACKED_ORDER_HANDOFF_TEMPLATE}; browser order handoff template is ${MCP_TRACKED_ORDER_HANDOFF_HTML_TEMPLATE}; usage snapshot is ${USAGE_SNAPSHOT_URL}; funnel snapshot is ${FUNNEL_SNAPSHOT_URL}; GA4 funnel proof is ${GA4_FUNNEL_PROOF_URL}; source activation queue is ${SOURCE_ACTIVATION_QUEUE_URL}; activation experiments are ${ACTIVATION_EXPERIMENTS_URL}; activation wave is ${ACTIVATION_WAVE_URL}; external activation brief is ${EXTERNAL_ACTIVATION_BRIEF_URL}; selected external activation task feeds are ${EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL} and ${EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL}; guarded activation wave runner is ${ACTIVATION_WAVE_RUNNER_URL}; revenue conversion queue is ${REVENUE_CONVERSION_QUEUE_URL}; buyer order handoffs hub is ${BUYER_ORDER_HANDOFFS_URL}; first-run proof is ${FIRST_RUN_PROOF_URL}; reviewer activation handoff is ${REVIEWER_ACTIVATION_URL}; workflow gallery is ${WORKFLOW_GALLERY_URL}; eval pack is ${MCP_EVAL_PACK_URL}; Browserbase Browse SKILL.md is ${ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL}; Browserbase Browse skill pack is ${BROWSERBASE_BROWSE_SKILL_PACK_URL}; directory refresh pack is ${DIRECTORY_REFRESH_URL}; directory outreach packet is ${AGENT_CAPTURE_OUTREACH_URL}; Claude connector submission packet is ${CLAUDE_CONNECTOR_SUBMISSION_URL}; install matrix is ${INSTALL_MATRIX_URL}; cart activation proof is ${CART_ACTIVATION_URL}; tracked first-run actions include a browser page, copy-ready agent prompt, and one-click live proof that reach create_cart_url after live price and inventory checks; tracked first-run actions preserve source into order handoffs without placing an order.`;
}

function recrawlMessage(runtime: DirectorySubmitActionsRuntime, action: (typeof ACTIONS)[number]): string {
  const staleMarkers = "stale_markers" in action && action.stale_markers?.length ? [`Current stale/missing markers: ${action.stale_markers.join(", ")}.`, ""] : [];
  const trackedStart = trackedStartUrl(action.id);
  const trackedConfig = trackedConfigUrl(action.id);
  const trackedInstallCodex = trackedInstallUrl(action.id, "codex");
  const trackedInstallGeneric = trackedInstallUrl(action.id, "generic_streamable_http");
  const trackedInstallClaudeCode = trackedInstallUrl(action.id, "claude_code");
  const trackedInstallCline = trackedInstallUrl(action.id, "cline");
  const trackedInstallGenericMd = `${trackedInstallGeneric}&format=md`;
  const trackedRunGeneric = trackedRunUrl(action.id, "generic_streamable_http");
  const trackedRunGenericHtml = `${trackedRunGeneric}&format=html`;
  const trackedRunGenericExecute = `${trackedRunGeneric}&execute=1`;
  const trackedRunClaudeCode = trackedRunUrl(action.id, "claude_code");
  const trackedRunCline = trackedRunUrl(action.id, "cline");
  const trackedRunGenericSh = `${trackedRunGeneric}&format=sh`;
  const reviewerActivation = `https://mcp.packrift.com/r/activate/${action.id}`;
  const reviewerActivationHtml = `${reviewerActivation}?format=html`;
  const trackedOrderHandoff = `https://mcp.packrift.com/r/order/${action.id}`;
  const trackedOrderHandoffHtml = `${trackedOrderHandoff}?format=html`;
  const trackedOrderHandoffJson = `${trackedOrderHandoff}?format=json`;
  const preferredTarget = sourceActivationStateFor(runtime, action.id)?.current_counts?.preferred_target ?? "generic_streamable_http";
  const preparePurchaseShortcut = sourcePreparePurchaseShortcut(action.id, preferredTarget);
  const evalPack = sourceEvalPackUrl(action.id);
  const evalPackMarkdown = sourceEvalPackUrl(action.id, "md");
  return [
    `Subject: ${action.recrawl_subject}`,
    "",
    "Hi,",
    "",
    "Packrift MCP is live as a hosted Streamable HTTP MCP server at https://mcp.packrift.com/mcp.",
    "",
    proofLine(runtime),
    "It requires no buyer-side API key and exposes exact-spec packaging search, live price, live inventory, no-match handling, and measured cart handoff.",
    "",
    ...staleMarkers,
    ...sourceActivationRecrawlLines(runtime, action.id),
    "Please recrawl/update Packrift and run the post-install cart verification using:",
    "- Server name: io.github.Packrift/packrift-mcp",
    "- Title: Packrift MCP",
    "- Remote endpoint: https://mcp.packrift.com/mcp",
    `- Tracked start page: ${trackedStart}`,
    `- Tracked MCP JSON config: ${trackedConfig}`,
    `- Tracked Codex install action: ${trackedInstallCodex}`,
    `- Tracked Claude Code install action: ${trackedInstallClaudeCode}`,
    `- Tracked Cline install action: ${trackedInstallCline}`,
    `- Tracked generic install action: ${trackedInstallGeneric}`,
    `- Markdown install action with first-useful-run sequence: ${trackedInstallGenericMd}`,
    `- Tracked first-run action: ${trackedRunGeneric}`,
    `- Tracked Claude Code first-run action: ${trackedRunClaudeCode}`,
    `- Tracked Cline first-run action: ${trackedRunCline}`,
    `- Browser first-run page: ${trackedRunGenericHtml}`,
    `- One-click live proof: ${trackedRunGenericExecute}`,
    `- Reviewer-to-real-MCP activation handoff: ${reviewerActivation}`,
    `- Reviewer activation browser runner: ${reviewerActivationHtml}`,
    `- Buyer/reviewer order handoff: ${trackedOrderHandoffHtml}`,
    `- Buyer/reviewer order handoff JSON: ${trackedOrderHandoffJson}`,
    `- Source-preserving prepare_purchase_handoff shortcut: ${preparePurchaseShortcut.order_handoff_url}`,
    `- Copy-ready unconfirmed prepare_purchase_handoff JSON-RPC: ${preparePurchaseShortcut.copy_ready_unconfirmed_json_rpc.replace(/\n/g, " ")}`,
    `- Copy-ready confirmed prepare_purchase_handoff JSON-RPC after buyer approval: ${preparePurchaseShortcut.copy_ready_confirmed_json_rpc_after_buyer_approval.replace(/\n/g, " ")}`,
    `- Host acceptance eval pack: ${evalPack}`,
    `- Host acceptance eval pack Markdown: ${evalPackMarkdown}`,
    `- Copy-ready agent prompt: use the Copy agent prompt button at ${trackedRunGenericHtml} or ${reviewerActivationHtml}; it is also exposed as first_useful_run.agent_prompt in this action payload.`,
    `- One-line first-run shell script: curl -sS '${trackedRunGenericSh}' | bash`,
    `- First useful run: open ${trackedRunGenericHtml}, click Run live proof, then use ${reviewerActivationHtml} to run the same sequence through a real MCP client. It reaches get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url.`,
    `- Agent prompt acceptance rule: paste the prompt into the MCP host and require tools/list, get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url before accepting the listing as activated.`,
    "- Activation proof rule: browser proof is review evidence only; source activation requires a real MCP host or external reviewer to call the hosted endpoint and reach create_cart_url.",
    "- Order handoff rule: use the source-specific /r/order/{source} page or prepare_purchase_handoff shortcut only after a real buyer or reviewer has source-level MCP tool-call and cart proof; it carries the source into checkout review and does not place an order.",
    `- Canonical start page: ${MCP_START_URL}`,
    "- Repository: https://github.com/Packrift/packrift-mcp",
    "- Website: https://packrift.com/pages/packrift-ai-agent-instructions",
    "- Description: Exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match.",
    "- All-agent evidence: https://mcp.packrift.com/ai/all-agent-capture.json",
    `- Start pack: ${MCP_START_JSON_URL}`,
    `- Install matrix: ${INSTALL_MATRIX_URL}`,
    `- Install actions: ${INSTALL_ACTIONS_URL}`,
    `- Client config: ${CLIENT_CONFIG_URL}`,
    `- Tracked config template: ${MCP_TRACKED_CONFIG_TEMPLATE}`,
    `- Tracked install template: ${TRACKED_INSTALL_TEMPLATE}`,
    `- Root MCP JSON config: ${ROOT_MCP_JSON_URL}`,
    `- Well-known MCP JSON config: ${WELL_KNOWN_MCP_JSON_URL}`,
    `- Marketplace manifest with full 15-tool surface: ${MARKETPLACE_MANIFEST_URL}`,
    `- Live tool discovery JSON: ${MCP_TOOL_DISCOVERY_URL}`,
    `- Live tool discovery Markdown: ${MCP_TOOL_DISCOVERY_MARKDOWN_URL}`,
    `- Source activation sitemap: ${SOURCE_ACTIVATION_SITEMAP_URL}`,
    `- Activation wave: ${ACTIVATION_WAVE_URL}`,
    `- Activation wave HTML: ${ACTIVATION_WAVE_HTML_URL}`,
    `- External activation brief: ${EXTERNAL_ACTIVATION_BRIEF_URL}`,
    `- External activation brief HTML: ${EXTERNAL_ACTIVATION_BRIEF_HTML_URL}`,
    `- Selected external activation tasks JSONL: ${EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL}`,
    `- Selected external activation tasks CSV: ${EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL}`,
    `- Selected external activation runner: ${EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL}`,
    `- Guarded activation wave runner: ${ACTIVATION_WAVE_RUNNER_URL}`,
    `- One-command external wave runner: PACKRIFT_EXTERNAL_ACTIVATION=1 curl -sS '${ACTIVATION_WAVE_RUNNER_URL}' | bash`,
    "- Wave runner rule: use this only from a real external reviewer or host context; Packrift self-runs, generated resource fetches, and browser-only proof do not complete source activation.",
    `- Revenue conversion queue: ${REVENUE_CONVERSION_QUEUE_URL}`,
    `- Revenue conversion queue HTML: ${REVENUE_CONVERSION_QUEUE_HTML_URL}`,
    `- Buyer order handoffs hub: ${BUYER_ORDER_HANDOFFS_URL}`,
    `- Buyer order handoffs hub HTML: ${BUYER_ORDER_HANDOFFS_HTML_URL}`,
    "- Directory refresh pack: https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    `- Directory submit actions: ${DIRECTORY_SUBMIT_ACTIONS_URL}`,
    `- Reviewer activation handoff: ${REVIEWER_ACTIVATION_URL}`,
    `- Source activation queue: ${SOURCE_ACTIVATION_QUEUE_URL}`,
    `- Activation experiments: ${ACTIVATION_EXPERIMENTS_URL}`,
    `- Agent capture outreach packet: ${AGENT_CAPTURE_OUTREACH_URL}`,
    `- Claude connector submission packet: ${CLAUDE_CONNECTOR_SUBMISSION_URL}`,
    `- First-run proof: ${FIRST_RUN_PROOF_URL}`,
    `- Workflow gallery: ${WORKFLOW_GALLERY_URL}`,
    `- Browserbase Browse SKILL.md: ${ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL}`,
    `- Browserbase Browse skill pack: ${BROWSERBASE_BROWSE_SKILL_PACK_URL}`,
    `- Canonical Browse skill file: ${CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL}`,
    `- Cart activation playbook: ${CART_ACTIVATION_URL}`,
    `- Usage snapshot: ${USAGE_SNAPSHOT_URL}`,
    `- Funnel proof snapshot: ${FUNNEL_SNAPSHOT_URL}`,
    `- GA4 funnel proof: ${GA4_FUNNEL_PROOF_URL}`,
    "- Cart handoff candidates: https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
    "",
    "Thanks,",
    "Packrift",
  ].join("\n");
}

export function mcpDirectorySubmitActionsPayload(runtime: DirectorySubmitActionsRuntime) {
  const firstUsefulRun = mcpFirstUsefulRun("generic", "generic_streamable_http");
  const actions = ACTIONS.map((action) => {
    const sourceActivation = sourceActivationStateFor(runtime, action.id);
    const preferredTarget = sourceActivation?.current_counts?.preferred_target ?? "generic_streamable_http";
    const preparePurchaseShortcut = sourcePreparePurchaseShortcut(action.id, preferredTarget);
    const duplicateGuard = duplicateWorkGuard(action);
    return {
      ...action,
      duplicate_work_guard: duplicateGuard,
      source_activation_state: sourceActivation ?? null,
      tracked_start_url: trackedStartUrl(action.id),
      tracked_config_url: trackedConfigUrl(action.id),
      tracked_install_urls: {
        generic_streamable_http: trackedInstallUrl(action.id, "generic_streamable_http"),
        claude_code: trackedInstallUrl(action.id, "claude_code"),
        codex: trackedInstallUrl(action.id, "codex"),
        cursor_windsurf_vscode: trackedInstallUrl(action.id, "cursor_windsurf_vscode"),
        cline: trackedInstallUrl(action.id, "cline"),
        glama_connector: trackedInstallUrl(action.id, "glama_connector"),
        mcp_marketplace: trackedInstallUrl(action.id, "mcp_marketplace"),
      },
      tracked_run_urls: {
        generic_streamable_http: trackedRunUrl(action.id, "generic_streamable_http"),
        generic_streamable_http_browser: `${trackedRunUrl(action.id, "generic_streamable_http")}&format=html`,
        generic_streamable_http_execute: `${trackedRunUrl(action.id, "generic_streamable_http")}&execute=1`,
        claude_code: trackedRunUrl(action.id, "claude_code"),
        codex: trackedRunUrl(action.id, "codex"),
        cursor_windsurf_vscode: trackedRunUrl(action.id, "cursor_windsurf_vscode"),
        cline: trackedRunUrl(action.id, "cline"),
        glama_connector: trackedRunUrl(action.id, "glama_connector"),
        mcp_marketplace: trackedRunUrl(action.id, "mcp_marketplace"),
      },
      first_useful_run: mcpFirstUsefulRun(action.id, "generic_streamable_http"),
      source_preserving_prepare_purchase_handoff: preparePurchaseShortcut,
      proof_urls: {
      hosted_endpoint: MCP_ENDPOINT,
      start_page: MCP_START_URL,
      tracked_start: trackedStartUrl(action.id),
      tracked_config: trackedConfigUrl(action.id),
      tracked_install_codex: trackedInstallUrl(action.id, "codex"),
      tracked_install_claude_code: trackedInstallUrl(action.id, "claude_code"),
      tracked_install_cline: trackedInstallUrl(action.id, "cline"),
      tracked_run_generic: trackedRunUrl(action.id, "generic_streamable_http"),
      tracked_run_generic_browser: `${trackedRunUrl(action.id, "generic_streamable_http")}&format=html`,
      tracked_run_generic_execute: `${trackedRunUrl(action.id, "generic_streamable_http")}&execute=1`,
      tracked_reviewer_activation: `https://mcp.packrift.com/r/activate/${action.id}`,
      tracked_reviewer_activation_html: `https://mcp.packrift.com/r/activate/${action.id}?format=html`,
      tracked_order_handoff: `https://mcp.packrift.com/r/order/${action.id}`,
      tracked_order_handoff_html: `https://mcp.packrift.com/r/order/${action.id}?format=html`,
      tracked_order_handoff_json: `https://mcp.packrift.com/r/order/${action.id}?format=json`,
      source_eval_pack: sourceEvalPackUrl(action.id),
      source_eval_pack_markdown: sourceEvalPackUrl(action.id, "md"),
      tracked_run_codex: trackedRunUrl(action.id, "codex"),
      start_pack: MCP_START_JSON_URL,
      health: "https://mcp.packrift.com/health",
      manifest: "https://mcp.packrift.com/manifest",
      official_registry: "https://registry.modelcontextprotocol.io/v0/servers?search=Packrift",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      install_matrix: INSTALL_MATRIX_URL,
      install_actions: INSTALL_ACTIONS_URL,
      directory_refresh: DIRECTORY_REFRESH_URL,
      directory_submit_actions: DIRECTORY_SUBMIT_ACTIONS_URL,
      reviewer_activation: REVIEWER_ACTIVATION_URL,
      agent_capture_outreach: AGENT_CAPTURE_OUTREACH_URL,
      claude_connector_submission: CLAUDE_CONNECTOR_SUBMISSION_URL,
      cart_activation: CART_ACTIVATION_URL,
      usage_snapshot: USAGE_SNAPSHOT_URL,
      funnel_snapshot: FUNNEL_SNAPSHOT_URL,
      ga4_funnel_proof: GA4_FUNNEL_PROOF_URL,
      source_activation_queue: SOURCE_ACTIVATION_QUEUE_URL,
      source_activation_sitemap: SOURCE_ACTIVATION_SITEMAP_URL,
      marketplace_manifest: MARKETPLACE_MANIFEST_URL,
      tool_discovery_json: MCP_TOOL_DISCOVERY_URL,
      tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
      activation_experiments: ACTIVATION_EXPERIMENTS_URL,
      activation_wave: ACTIVATION_WAVE_URL,
      activation_wave_markdown: ACTIVATION_WAVE_MARKDOWN_URL,
      activation_wave_html: ACTIVATION_WAVE_HTML_URL,
      external_activation_brief: EXTERNAL_ACTIVATION_BRIEF_URL,
      external_activation_brief_html: EXTERNAL_ACTIVATION_BRIEF_HTML_URL,
      external_activation_brief_tasks_jsonl: EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL,
      external_activation_brief_tasks_csv: EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL,
      external_activation_brief_runner_shell: EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL,
      revenue_conversion_queue: REVENUE_CONVERSION_QUEUE_URL,
      revenue_conversion_queue_html: REVENUE_CONVERSION_QUEUE_HTML_URL,
      buyer_order_handoffs: BUYER_ORDER_HANDOFFS_URL,
      buyer_order_handoffs_html: BUYER_ORDER_HANDOFFS_HTML_URL,
      eval_pack: MCP_EVAL_PACK_URL,
      first_run_proof: FIRST_RUN_PROOF_URL,
      workflow_gallery: WORKFLOW_GALLERY_URL,
      root_browserbase_browse_skill_md: ROOT_BROWSERBASE_BROWSE_SKILL_MD_URL,
      browserbase_browse_skill_pack: BROWSERBASE_BROWSE_SKILL_PACK_URL,
      canonical_browserbase_browse_skill_md: CANONICAL_BROWSERBASE_BROWSE_SKILL_MD_URL,
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      },
      activation_packet: {
      source: action.id,
      endpoint: MCP_ENDPOINT,
      reviewer_runner: `https://mcp.packrift.com/r/activate/${action.id}?format=html`,
      order_handoff: `https://mcp.packrift.com/r/order/${action.id}?format=html`,
      source_preserving_prepare_purchase_handoff: preparePurchaseShortcut,
      quickest_install_by_host: {
        generic_streamable_http: trackedInstallUrl(action.id, "generic_streamable_http"),
        claude_code: trackedInstallUrl(action.id, "claude_code"),
        codex: trackedInstallUrl(action.id, "codex"),
        cline: trackedInstallUrl(action.id, "cline"),
        glama_connector: trackedInstallUrl(action.id, "glama_connector"),
        mcp_marketplace: trackedInstallUrl(action.id, "mcp_marketplace"),
      },
      quickest_first_run_by_host: {
        generic_streamable_http: trackedRunUrl(action.id, "generic_streamable_http"),
        claude_code: trackedRunUrl(action.id, "claude_code"),
        codex: trackedRunUrl(action.id, "codex"),
        cline: trackedRunUrl(action.id, "cline"),
        glama_connector: trackedRunUrl(action.id, "glama_connector"),
        mcp_marketplace: trackedRunUrl(action.id, "mcp_marketplace"),
      },
      acceptance_gate: [
        "Install the existing hosted Packrift MCP endpoint only.",
        "Run the source-aware endpoint from a real MCP host, not just a browser proof page.",
        "Use the source-specific eval pack when host reviewers need copy-ready acceptance cases.",
        "Require tools/list plus get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url.",
        "For exact SKU review, run prepare_purchase_handoff with buyer_confirmed=false first, then buyer_confirmed=true only after buyer/reviewer approval.",
        "Accept activation only after create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
        "Use the source-specific /r/order/{source} page only for buyer or reviewer checkout follow-through after MCP tool and cart proof; it does not place an order.",
      ],
      crawler_inputs: {
        live_tool_discovery_json: MCP_TOOL_DISCOVERY_URL,
        live_tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
        marketplace_manifest: MARKETPLACE_MANIFEST_URL,
        source_activation_sitemap: SOURCE_ACTIVATION_SITEMAP_URL,
        source_activation_queue: SOURCE_ACTIVATION_QUEUE_URL,
        activation_wave: ACTIVATION_WAVE_URL,
        activation_wave_markdown: ACTIVATION_WAVE_MARKDOWN_URL,
        activation_wave_html: ACTIVATION_WAVE_HTML_URL,
        activation_wave_runner_shell: ACTIVATION_WAVE_RUNNER_URL,
        external_activation_brief: EXTERNAL_ACTIVATION_BRIEF_URL,
        external_activation_brief_html: EXTERNAL_ACTIVATION_BRIEF_HTML_URL,
        external_activation_brief_tasks_jsonl: EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL,
        external_activation_brief_tasks_csv: EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL,
        external_activation_brief_runner_shell: EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL,
        revenue_conversion_queue: REVENUE_CONVERSION_QUEUE_URL,
        revenue_conversion_queue_html: REVENUE_CONVERSION_QUEUE_HTML_URL,
        buyer_order_handoffs: BUYER_ORDER_HANDOFFS_URL,
        buyer_order_handoffs_html: BUYER_ORDER_HANDOFFS_HTML_URL,
        mcp_eval_pack: MCP_EVAL_PACK_URL,
        source_eval_pack: sourceEvalPackUrl(action.id),
        ga4_funnel_proof: GA4_FUNNEL_PROOF_URL,
      },
      },
      concise_email: conciseDirectoryEmail(runtime, action),
      source_release_readiness: sourceReleaseReadiness(action),
      recrawl_message: recrawlMessage(runtime, action),
    };
  });
  return {
    release: "PACKRIFT-MCP-DIRECTORY-SUBMIT-ACTIONS-R50",
    generated_at: new Date().toISOString(),
    purpose:
      "Public action queue for converting stale and pending MCP directory surfaces into current Packrift MCP listings that can drive external agent discovery.",
    canonical_endpoint: MCP_ENDPOINT,
    tracked_start_template: MCP_TRACKED_START_TEMPLATE,
    tracked_config_template: MCP_TRACKED_CONFIG_TEMPLATE,
    tracked_install_template: TRACKED_INSTALL_TEMPLATE,
    tracked_run_template: TRACKED_RUN_TEMPLATE,
    tracked_reviewer_activation_template: MCP_TRACKED_REVIEWER_ACTIVATION_TEMPLATE,
    tracked_reviewer_activation_html_template: MCP_TRACKED_REVIEWER_ACTIVATION_HTML_TEMPLATE,
    tracked_order_handoff_template: MCP_TRACKED_ORDER_HANDOFF_TEMPLATE,
    tracked_order_handoff_html_template: MCP_TRACKED_ORDER_HANDOFF_HTML_TEMPLATE,
    source_directory_refresh: DIRECTORY_REFRESH_URL,
    source_activation_queue: SOURCE_ACTIVATION_QUEUE_URL,
    source_activation_queue_runtime: {
      release: runtime.sourceActivationQueue?.release ?? null,
      status: runtime.sourceActivationQueue?.status ?? null,
      operator_url: runtime.sourceActivationQueue?.operator_url ?? null,
      row_count: runtime.sourceActivationQueue?.rows?.length ?? 0,
    },
    source_activation_sitemap: SOURCE_ACTIVATION_SITEMAP_URL,
    source_activation_experiments: ACTIVATION_EXPERIMENTS_URL,
    source_activation_wave: ACTIVATION_WAVE_URL,
    source_activation_wave_markdown: ACTIVATION_WAVE_MARKDOWN_URL,
    source_activation_wave_html: ACTIVATION_WAVE_HTML_URL,
    source_activation_wave_runner_shell: ACTIVATION_WAVE_RUNNER_URL,
    external_activation_brief: EXTERNAL_ACTIVATION_BRIEF_URL,
    external_activation_brief_html: EXTERNAL_ACTIVATION_BRIEF_HTML_URL,
    external_activation_brief_tasks_jsonl: EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL,
    external_activation_brief_tasks_csv: EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL,
    external_activation_brief_runner_shell: EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL,
    revenue_conversion_queue: REVENUE_CONVERSION_QUEUE_URL,
    revenue_conversion_queue_html: REVENUE_CONVERSION_QUEUE_HTML_URL,
    buyer_order_handoffs: BUYER_ORDER_HANDOFFS_URL,
    buyer_order_handoffs_html: BUYER_ORDER_HANDOFFS_HTML_URL,
    source_eval_pack_template: "https://mcp.packrift.com/ai/mcp-eval-pack.json?source={source}",
    source_marketplace_manifest: MARKETPLACE_MANIFEST_URL,
    source_tool_discovery_json: MCP_TOOL_DISCOVERY_URL,
    source_tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
    source_usage_snapshot: USAGE_SNAPSHOT_URL,
    source_funnel_snapshot: FUNNEL_SNAPSHOT_URL,
    source_ga4_funnel_proof: GA4_FUNNEL_PROOF_URL,
    source_mcp_eval_pack: MCP_EVAL_PACK_URL,
    source_install_actions: INSTALL_ACTIONS_URL,
    source_install_matrix: INSTALL_MATRIX_URL,
    source_client_config: CLIENT_CONFIG_URL,
    source_root_mcp_json: ROOT_MCP_JSON_URL,
    source_well_known_mcp_json: WELL_KNOWN_MCP_JSON_URL,
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    duplicate_work_summary: {
      release: "PACKRIFT-MCP-DUPLICATE-WORK-GUARD-R01",
      policy:
        "Use one canonical action lane per directory or host. Published, current, pending, or public-thread-backed rows are monitor/update-only; do not create duplicate submissions.",
      monitor_only_sources: actions
        .filter((action) => action.duplicate_work_guard.status === "do_not_resubmit")
        .map((action) => action.id),
      existing_submission_sources: actions
        .filter((action) => action.duplicate_work_guard.status === "monitor_existing_submission")
        .map((action) => action.id),
      single_outreach_sources: actions
        .filter((action) => action.duplicate_work_guard.status === "single_reviewed_outreach_only")
        .map((action) => action.id),
      still_actionable_sources: actions
        .filter((action) => action.duplicate_work_guard.status === "action_allowed_with_current_packet")
        .map((action) => action.id),
    },
    status_counts: actions.reduce<Record<string, number>>((acc, action) => {
      acc[action.action_status] = (acc[action.action_status] ?? 0) + 1;
      return acc;
    }, {}),
    actions,
    first_useful_run_agent_prompt: firstUsefulRun.agent_prompt,
    first_useful_run_agent_prompt_success_criteria: firstUsefulRun.agent_prompt_success_criteria,
    public_comment_policy:
      "Do not post another unsolicited update to already-submitted public issues or PRs such as Cline #1610, MCP.so #2189, or Docker #3388. Use this packet as central evidence and only comment when maintainers ask for more proof.",
    operating_rule:
      "Use this as a support/reviewer queue, not as proof that the MCP revenue goal is complete. Completion still requires qualified external MCP sessions, cart landings, and attributed orders.",
  };
}

export function mcpDirectorySubmitActionPayload(runtime: DirectorySubmitActionsRuntime, source: string) {
  const sourceSlug = normalizeDirectoryUpdateSource(source);
  const payload = mcpDirectorySubmitActionsPayload(runtime);
  const action = payload.actions.find((row) => row.id === sourceSlug);
  if (!sourceSlug || !action) return null;
  const toolNames = runtime.toolNames?.length ? runtime.toolNames : DEFAULT_TOOL_NAMES;
  const sourceActivationState = action.source_activation_state ?? null;
  return {
    release: "PACKRIFT-MCP-DIRECTORY-UPDATE-CARD-R18",
    generated_at: new Date().toISOString(),
    purpose:
      "One source-specific, no-auth update card for stale MCP directories, marketplaces, and agent indexes to recrawl Packrift MCP and run the activation gate.",
    source: sourceSlug,
    directory: {
      id: action.id,
      label: action.label,
      action_status: action.action_status,
      directory_status: action.directory_status,
      priority: action.priority,
      listing_url: action.listing_url,
      submission_url: action.submission_url,
      stale_markers: "stale_markers" in action ? action.stale_markers ?? [] : [],
      next_action: action.next_action,
      duplicate_work_guard: action.duplicate_work_guard,
    },
    source_activation_queue_runtime: payload.source_activation_queue_runtime,
    source_activation_state: sourceActivationState,
    canonical_listing: {
      server_name: "Packrift MCP",
      registry_name: "io.github.Packrift/packrift-mcp",
      endpoint: MCP_ENDPOINT,
      authentication: "none_required_for_hosted_endpoint",
      version: runtime.serverVersion,
      description: "Exact-spec Packrift packaging search with live price, stock, shipping, cart handoff, and no-match.",
      tool_count: runtime.toolsCount,
      tool_names: toolNames,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
      repository_url: "https://github.com/Packrift/packrift-mcp",
      website_url: "https://packrift.com/pages/packrift-ai-agent-instructions",
      marketplace_manifest: MARKETPLACE_MANIFEST_URL,
      tool_discovery_json: MCP_TOOL_DISCOVERY_URL,
      tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
      source_activation_sitemap: SOURCE_ACTIVATION_SITEMAP_URL,
      activation_wave: ACTIVATION_WAVE_URL,
      activation_wave_html: ACTIVATION_WAVE_HTML_URL,
      external_activation_brief: EXTERNAL_ACTIVATION_BRIEF_URL,
      external_activation_brief_html: EXTERNAL_ACTIVATION_BRIEF_HTML_URL,
      external_activation_brief_tasks_jsonl: EXTERNAL_ACTIVATION_BRIEF_TASKS_JSONL_URL,
      external_activation_brief_tasks_csv: EXTERNAL_ACTIVATION_BRIEF_TASKS_CSV_URL,
      external_activation_brief_runner_shell: EXTERNAL_ACTIVATION_BRIEF_RUNNER_URL,
      revenue_conversion_queue: REVENUE_CONVERSION_QUEUE_URL,
      revenue_conversion_queue_html: REVENUE_CONVERSION_QUEUE_HTML_URL,
      buyer_order_handoffs: BUYER_ORDER_HANDOFFS_URL,
      buyer_order_handoffs_html: BUYER_ORDER_HANDOFFS_HTML_URL,
    },
    tracked_urls: {
      start: action.tracked_start_url,
      config: action.tracked_config_url,
      install: action.tracked_install_urls,
      first_run: action.tracked_run_urls,
      live_proof: action.tracked_run_urls.generic_streamable_http_execute,
      tool_discovery_json: MCP_TOOL_DISCOVERY_URL,
      tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
      reviewer_activation: action.proof_urls.tracked_reviewer_activation,
      reviewer_activation_html: action.proof_urls.tracked_reviewer_activation_html,
      order_handoff: action.proof_urls.tracked_order_handoff,
      order_handoff_html: action.proof_urls.tracked_order_handoff_html,
      order_handoff_json: action.proof_urls.tracked_order_handoff_json,
      eval_pack: action.proof_urls.source_eval_pack,
      eval_pack_markdown: action.proof_urls.source_eval_pack_markdown,
      activation_wave: action.proof_urls.activation_wave,
      activation_wave_html: action.proof_urls.activation_wave_html,
      external_activation_brief: action.proof_urls.external_activation_brief,
      external_activation_brief_html: action.proof_urls.external_activation_brief_html,
      external_activation_brief_tasks_jsonl: action.proof_urls.external_activation_brief_tasks_jsonl,
      external_activation_brief_tasks_csv: action.proof_urls.external_activation_brief_tasks_csv,
      external_activation_brief_runner_shell: action.proof_urls.external_activation_brief_runner_shell,
      revenue_conversion_queue: action.proof_urls.revenue_conversion_queue,
      revenue_conversion_queue_html: action.proof_urls.revenue_conversion_queue_html,
      buyer_order_handoffs: action.proof_urls.buyer_order_handoffs,
      buyer_order_handoffs_html: action.proof_urls.buyer_order_handoffs_html,
    },
    duplicate_work_guard: action.duplicate_work_guard,
    source_preserving_prepare_purchase_handoff: action.source_preserving_prepare_purchase_handoff,
    acceptance_gate: [
      "Install the hosted no-auth Streamable HTTP endpoint.",
      "Run tools/list against the source-aware endpoint.",
      "Run the source-specific eval pack acceptance cases when a marketplace, MCP host, or reviewer needs host-side proof.",
      "Run get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url.",
      "For exact SKU review, run prepare_purchase_handoff with buyer_confirmed=false first, then buyer_confirmed=true only after buyer/reviewer approval.",
      "Treat the listing as activated only when create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
      "Use the source-specific order handoff only when a real buyer or reviewer is ready to evaluate checkout after MCP proof; it does not create an order.",
    ],
    crawler_inputs: action.activation_packet.crawler_inputs,
    proof_urls: action.proof_urls,
    source_release_readiness: action.source_release_readiness,
    copy_ready_concise_email: action.concise_email,
    copy_ready_recrawl_message: action.recrawl_message,
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function fencedText(value: string): string {
  return ["```text", value, "```"].join("\n");
}

export function mcpDirectorySubmitActionMarkdown(runtime: DirectorySubmitActionsRuntime, source: string): string | null {
  const payload = mcpDirectorySubmitActionPayload(runtime, source);
  if (!payload) return null;
  return [
    "# Packrift MCP Directory Update Card",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Source: ${payload.source}`,
    `Directory: ${payload.directory.label}`,
    `Canonical endpoint: ${payload.canonical_listing.endpoint}`,
    "",
    "## Canonical Listing",
    "",
    `Server name: ${payload.canonical_listing.server_name}`,
    `Registry name: ${payload.canonical_listing.registry_name}`,
    `Authentication: ${payload.canonical_listing.authentication}`,
    `Version: ${payload.canonical_listing.version}`,
    `Tools: ${payload.canonical_listing.tool_count} (${payload.canonical_listing.tool_names.join(", ")})`,
    `Marketplace manifest: ${payload.canonical_listing.marketplace_manifest}`,
    `Live tool discovery JSON: ${payload.canonical_listing.tool_discovery_json}`,
    `Live tool discovery Markdown: ${payload.canonical_listing.tool_discovery_markdown}`,
    `Source activation sitemap: ${payload.canonical_listing.source_activation_sitemap}`,
    `Activation wave: ${payload.canonical_listing.activation_wave}`,
    `Activation wave HTML: ${payload.canonical_listing.activation_wave_html}`,
    `External activation brief: ${payload.canonical_listing.external_activation_brief}`,
    `External activation brief HTML: ${payload.canonical_listing.external_activation_brief_html}`,
    `Selected external activation tasks JSONL: ${payload.canonical_listing.external_activation_brief_tasks_jsonl}`,
    `Selected external activation tasks CSV: ${payload.canonical_listing.external_activation_brief_tasks_csv}`,
    `Selected external activation runner: ${payload.canonical_listing.external_activation_brief_runner_shell}`,
    `Revenue conversion queue: ${payload.canonical_listing.revenue_conversion_queue}`,
    `Revenue conversion queue HTML: ${payload.canonical_listing.revenue_conversion_queue_html}`,
    `Buyer order handoffs: ${payload.canonical_listing.buyer_order_handoffs}`,
    `Buyer order handoffs HTML: ${payload.canonical_listing.buyer_order_handoffs_html}`,
    `Host acceptance eval pack: ${payload.tracked_urls.eval_pack}`,
    "",
    "## Current Directory State",
    "",
    `Action status: ${payload.directory.action_status}`,
    `Directory status: ${payload.directory.directory_status}`,
    `Priority: ${payload.directory.priority}`,
    `Listing URL: ${payload.directory.listing_url}`,
    `Submission URL: ${payload.directory.submission_url}`,
    `Stale markers: ${payload.directory.stale_markers.length ? payload.directory.stale_markers.join(", ") : "none"}`,
    "",
    "## Duplicate Work Guard",
    "",
    `Status: ${payload.duplicate_work_guard.status}`,
    `Reason: ${payload.duplicate_work_guard.reason}`,
    "",
    "Allowed next actions:",
    "",
    payload.duplicate_work_guard.allowed_next_actions.map((rule: string) => `- ${rule}`).join("\n"),
    "",
    "Blocked actions:",
    "",
    payload.duplicate_work_guard.blocked_actions.map((rule: string) => `- ${rule}`).join("\n"),
    "",
    ...(payload.source_activation_state
      ? [
          "## Source Activation State",
          "",
          `Queue release: ${payload.source_activation_queue_runtime.release ?? "unknown"}`,
          `Current stage: ${payload.source_activation_state.current_stage ?? "unknown"}`,
          `Target event: ${payload.source_activation_state.target_event_to_watch ?? "unknown"}`,
          `Primary action: ${payload.source_activation_state.primary_action_url ?? "none"}`,
          `Buyer handoff: ${payload.source_activation_state.buyer_handoff_url ?? "none"}`,
          "",
          fencedJson(payload.source_activation_state.current_counts ?? {}),
          "",
        ]
      : []),
    "## Tracked URLs",
    "",
    fencedJson(payload.tracked_urls),
    "",
    "## Source-Preserving Prepare Purchase Shortcut",
    "",
    `Tool: ${payload.source_preserving_prepare_purchase_handoff.tool_name}`,
    `Endpoint: ${payload.source_preserving_prepare_purchase_handoff.endpoint}`,
    `Buyer confirmation rule: ${payload.source_preserving_prepare_purchase_handoff.buyer_confirmation_rule}`,
    `Success gate: ${payload.source_preserving_prepare_purchase_handoff.success_gate}`,
    "",
    "Unconfirmed live-check call:",
    "",
    "```json",
    payload.source_preserving_prepare_purchase_handoff.copy_ready_unconfirmed_json_rpc,
    "```",
    "",
    "Confirmed call after buyer/reviewer approval:",
    "",
    "```json",
    payload.source_preserving_prepare_purchase_handoff.copy_ready_confirmed_json_rpc_after_buyer_approval,
    "```",
    "",
    "## Acceptance Gate",
    "",
    payload.acceptance_gate.map((rule) => `- ${rule}`).join("\n"),
    "",
    ...(payload.source_release_readiness
      ? ["## Source Release Readiness", "", fencedJson(payload.source_release_readiness), ""]
      : []),
    "## Copy-Ready Concise Email",
    "",
    `To: ${payload.copy_ready_concise_email.to ?? ""}`,
    `Subject: ${payload.copy_ready_concise_email.subject}`,
    "",
    fencedText(payload.copy_ready_concise_email.body),
    "",
    "## Copy-Ready Recrawl Message",
    "",
    fencedText(payload.copy_ready_recrawl_message),
    "",
    `Machine-readable version: https://mcp.packrift.com/ai/mcp-directory-update/${payload.source}.json`,
    "",
  ].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function mcpDirectorySubmitActionsMarkdown(runtime: DirectorySubmitActionsRuntime): string {
  const payload = mcpDirectorySubmitActionsPayload(runtime);
  const rows = payload.actions
    .map(
      (action) =>
        `| ${escapeMarkdown(action.label)} | ${action.action_status} | ${action.directory_status} | ${action.priority} | ${action.tracked_start_url} | ${action.tracked_config_url} | ${action.tracked_install_urls.codex} | ${action.tracked_run_urls.generic_streamable_http} | ${action.tracked_run_urls.generic_streamable_http_execute} | ${action.proof_urls.tracked_reviewer_activation} | ${action.proof_urls.tracked_reviewer_activation_html} | ${action.proof_urls.tracked_order_handoff_html} | ${escapeMarkdown(action.next_action)} |`
    )
    .join("\n");
  const messages = payload.actions
    .filter(
      (action) =>
        !["monitor_upstream_registry", "submitted_pending", "pending_merge"].includes(action.action_status) &&
        !["do_not_resubmit", "monitor_existing_submission"].includes(action.duplicate_work_guard.status)
    )
    .map((action) => [`### ${action.label}`, "", action.recrawl_message].join("\n"))
    .join("\n\n");
  const conciseEmails = payload.actions
    .filter(
      (action) =>
        action.action_status !== "monitor_upstream_registry" &&
        !["do_not_resubmit", "monitor_existing_submission"].includes(action.duplicate_work_guard.status)
    )
    .map((action) =>
      [`### ${action.label}`, "", `To: ${action.concise_email.to ?? ""}`, `Subject: ${action.concise_email.subject}`, "", action.concise_email.body].join("\n")
    )
    .join("\n\n");
  return [
    "# Packrift MCP Directory Submit Actions",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Action Queue",
    "",
    `Tracked start template: ${payload.tracked_start_template}`,
    `Tracked config template: ${payload.tracked_config_template}`,
    `Tracked install template: ${payload.tracked_install_template}`,
    `Tracked run template: ${payload.tracked_run_template}`,
    `Tracked reviewer activation template: ${payload.tracked_reviewer_activation_template}`,
    `Tracked reviewer activation browser runner template: ${payload.tracked_reviewer_activation_html_template}`,
    `Tracked order handoff template: ${payload.tracked_order_handoff_template}`,
    `Tracked order handoff browser template: ${payload.tracked_order_handoff_html_template}`,
    `Activation wave: ${payload.source_activation_wave}`,
    `Activation wave HTML: ${payload.source_activation_wave_html}`,
    `External activation brief: ${payload.external_activation_brief}`,
    `External activation brief HTML: ${payload.external_activation_brief_html}`,
    `Selected external activation tasks JSONL: ${payload.external_activation_brief_tasks_jsonl}`,
    `Selected external activation tasks CSV: ${payload.external_activation_brief_tasks_csv}`,
    `Selected external activation runner: ${payload.external_activation_brief_runner_shell}`,
    `Revenue conversion queue: ${payload.revenue_conversion_queue}`,
    `Revenue conversion queue HTML: ${payload.revenue_conversion_queue_html}`,
    `Buyer order handoffs: ${payload.buyer_order_handoffs}`,
    `Buyer order handoffs HTML: ${payload.buyer_order_handoffs_html}`,
    "",
    "## Duplicate Work Guard",
    "",
    payload.duplicate_work_summary.policy,
    "",
    `Monitor-only sources: ${payload.duplicate_work_summary.monitor_only_sources.join(", ") || "none"}`,
    `Existing-submission sources: ${payload.duplicate_work_summary.existing_submission_sources.join(", ") || "none"}`,
    `Single-outreach sources: ${payload.duplicate_work_summary.single_outreach_sources.join(", ") || "none"}`,
    `Still-actionable sources: ${payload.duplicate_work_summary.still_actionable_sources.join(", ") || "none"}`,
    "",
    "| Target | Action status | Directory status | Priority | Tracked start URL | Tracked config URL | Tracked Codex install URL | Tracked first-run URL | Live proof URL | Activation handoff | Activation runner | Order handoff | Next action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    rows,
    "",
    "## Copy-Ready Concise Emails",
    "",
    conciseEmails,
    "",
    "## Copy-Ready Recrawl Messages",
    "",
    messages,
    "",
    "## Operating Rule",
    "",
    payload.operating_rule,
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
    "",
  ].join("\n");
}
