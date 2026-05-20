#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const RELEASE = "PACKRIFT-OPENAI-PRODUCT-FEED-MANIFEST-R01";
const OUTPUT_PATH = resolve(process.cwd(), "outputs/openai-product-feed-manifest.json");
const BASE_URL = "https://mcp.packrift.com";

const FEEDS = [
  {
    id: "strict_public_current",
    role: "public_qa_surface",
    url: `${BASE_URL}/ai/packrift-openai-products-strict-stable-current.tsv`,
    format: "tsv",
    expected_rows: 3405,
    validation_status: "tracked_openai_shape_qa_surface",
    note: "Strict public 3,405-row OpenAI-shaped product-feed QA surface.",
  },
  {
    id: "preferred_direct_current",
    role: "approved_direct_handoff",
    url: `${BASE_URL}/ai/packrift-openai-products-preferred-direct-current.tsv`,
    format: "tsv",
    expected_rows: 4847,
    validation_status: "validated_direct_handoff_zero_simulated_rejects_or_warnings",
    note: "Current preferred direct handoff for approved upload, SFTP, or API ingestion.",
  },
  {
    id: "preferred_direct_current_gzip",
    role: "approved_direct_handoff_compressed",
    url: `${BASE_URL}/ai/packrift-openai-products-preferred-direct-current.tsv.gz`,
    format: "gzip",
    expected_rows: null,
    validation_status: "compressed_current_direct_handoff",
    note: "Compressed current preferred direct handoff.",
  },
  {
    id: "preferred_direct_immutable_4837_20260520",
    role: "immutable_direct_handoff_snapshot",
    url: `${BASE_URL}/ai/packrift-openai-products-preferred-direct-4837-20260520.tsv`,
    format: "tsv",
    expected_rows: 4837,
    validation_status: "immutable_validated_direct_handoff_snapshot",
    note: "Immutable 4,837-row direct handoff snapshot from 2026-05-20.",
  },
  {
    id: "preferred_direct_immutable_4837_20260520_gzip",
    role: "immutable_direct_handoff_snapshot_compressed",
    url: `${BASE_URL}/ai/packrift-openai-products-preferred-direct-4837-20260520.tsv.gz`,
    format: "gzip",
    expected_rows: null,
    validation_status: "compressed_immutable_direct_handoff_snapshot",
    note: "Compressed immutable 4,837-row direct handoff snapshot from 2026-05-20.",
  },
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function rowCount(text) {
  const normalized = text.trimEnd();
  if (!normalized) return 0;
  return Math.max(0, normalized.split(/\r?\n/).length - 1);
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Packrift-OpenAI-Feed-Manifest-Builder/1.0 (+https://mcp.packrift.com/mcp)",
      Accept: "*/*",
      "Cache-Control": "no-cache",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function buildFeed(row) {
  const bytes = await fetchBuffer(row.url);
  const text = row.format === "tsv" ? bytes.toString("utf8") : "";
  const observedRows = row.format === "tsv" ? rowCount(text) : null;
  const header = row.format === "tsv" ? text.split(/\r?\n/, 1)[0] ?? "" : "";
  return {
    id: row.id,
    role: row.role,
    url: row.url,
    format: row.format,
    expected_rows: row.expected_rows,
    observed_rows: observedRows,
    row_count_ok: row.expected_rows === null ? null : observedRows === row.expected_rows,
    bytes: bytes.length,
    sha256: sha256(bytes),
    validation_status: row.validation_status,
    header_columns: header ? header.split("\t").length : null,
    note: row.note,
  };
}

const feeds = [];
for (const row of FEEDS) {
  feeds.push(await buildFeed(row));
}

const manifest = {
  release: RELEASE,
  generated_at: new Date().toISOString(),
  status: feeds.every((feed) => feed.row_count_ok !== false) ? "ready_for_approved_ingestion_handoff" : "needs_review",
  canonical_mcp_endpoint: `${BASE_URL}/mcp`,
  purpose:
    "Give OpenAI, ChatGPT, MCP hosts, and AI-commerce reviewers one stable manifest for Packrift's OpenAI-shaped product feed handoffs without creating a duplicate Packrift buyer surface.",
  source_reality: {
    public_self_serve_openai_ingestion: false,
    official_ingestion_blocker:
      "Packrift can publish validated feed files publicly, but official OpenAI product feed ingestion still requires an approved upload, file, SFTP, or API handoff channel.",
    current_best_handoff: "preferred_direct_current",
    no_duplicate_surface_rule:
      "Use these feeds and https://mcp.packrift.com/mcp as discovery and cart-handoff inputs; do not create a separate Packrift CLI or checkout surface.",
  },
  feeds: Object.fromEntries(feeds.map((feed) => [feed.id, feed])),
  validation_summary: {
    total_feeds: feeds.length,
    tsv_feeds: feeds.filter((feed) => feed.format === "tsv").length,
    gzip_feeds: feeds.filter((feed) => feed.format === "gzip").length,
    all_expected_row_counts_ok: feeds.every((feed) => feed.row_count_ok !== false),
    preferred_direct_current_rows: feeds.find((feed) => feed.id === "preferred_direct_current")?.observed_rows ?? null,
    strict_public_current_rows: feeds.find((feed) => feed.id === "strict_public_current")?.observed_rows ?? null,
  },
  related_mcp_surfaces: {
    mcp_endpoint: `${BASE_URL}/mcp`,
    tools_discovery: `${BASE_URL}/ai/mcp-tools.json`,
    cart_handoff_candidates: `${BASE_URL}/ai/mcp-cart-handoff-candidates.json`,
    first_run_actions: `${BASE_URL}/ai/mcp-first-run-actions.json`,
    adoption_progress: `${BASE_URL}/ai/mcp-agent-adoption-progress.json`,
    llms_txt: `${BASE_URL}/llms.txt`,
    llms_full: `${BASE_URL}/llms-full.txt`,
  },
  next_actions_for_reviewer: [
    "Use feeds.preferred_direct_current.url for the current direct ingestion file when an approved feed channel exists.",
    "Verify sha256 before ingesting or forwarding a feed file.",
    "Use https://mcp.packrift.com/mcp for live exact-spec search, price, inventory, and measured cart handoff after feed discovery.",
  ],
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output: OUTPUT_PATH, release: manifest.release, status: manifest.status, validation_summary: manifest.validation_summary }, null, 2));
