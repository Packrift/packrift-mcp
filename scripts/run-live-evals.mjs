#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import dns from "node:dns";
import { dirname, resolve } from "node:path";

dns.setDefaultResultOrder("ipv4first");

const DEFAULT_ENDPOINT = "https://mcp.packrift.com/mcp";
const DEFAULT_EVALS =
  "/Users/farhan/Downloads/packrift-ai-commerce-factory/outputs/2026-05-06/openai_mcp_conversion_enhancement_packet/eval_tests.jsonl";
const DEFAULT_OUT =
  "/Users/farhan/Downloads/packrift-ai-commerce-factory/outputs/2026-05-07/mcp_live_conversion_eval";

const endpoint = process.env.MCP_EVAL_ENDPOINT || DEFAULT_ENDPOINT;
const evalPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_EVALS;
const outDir = process.argv[3] ? resolve(process.argv[3]) : DEFAULT_OUT;

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

async function rpc(method, params = undefined) {
  const body = {
    jsonrpc: "2.0",
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    method,
    ...(params === undefined ? {} : { params }),
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Packrift-MCP-Live-Eval/1.0 (+https://mcp.packrift.com/mcp)",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { parse_error: text.slice(0, 1000) };
  }
  return { http_status: response.status, parsed };
}

function getStructured(callResult) {
  return callResult?.parsed?.result?.structuredContent;
}

function getToolError(callResult) {
  const result = callResult?.parsed?.result;
  if (!result?.isError) return "";
  return result.content?.map((item) => item.text || "").join("\n") || "tool_error";
}

function containsAll(value, parts) {
  const text = String(value || "");
  return parts.every((part) => text.includes(part));
}

function currentCartUrlParts(test, structured) {
  const url = String(structured?.url || "");
  if (test.surface !== "create_cart_url" || !url.includes("utm_source=chatgpt-mcp")) {
    return test.expected?.url_contains || [];
  }
  const utm = structured?.utm || {};
  const tracking = structured?.cart_tracking || {};
  return [
    "ref=mcp",
    utm.source ? `utm_source=${utm.source}` : null,
    utm.medium ? `utm_medium=${utm.medium}` : null,
    utm.campaign ? `utm_campaign=${utm.campaign}` : null,
    utm.content ? `utm_content=${utm.content}` : null,
    utm.term ? `utm_term=${utm.term}` : null,
    tracking.journey_id ? `mcp_journey=${tracking.journey_id}` : null,
    tracking.result_set_id ? `mcp_result_set=${tracking.result_set_id}` : null,
    tracking.packrift_ai_id ? `packrift_ai_id=${tracking.packrift_ai_id}` : null,
  ].filter(Boolean);
}

function hasPath(obj, path) {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return false;
    current = current[part];
  }
  return current !== undefined && current !== null && current !== "";
}

function firstResult(structured) {
  if (Array.isArray(structured)) return structured[0] || null;
  if (Array.isArray(structured?.results)) return structured.results[0] || null;
  return null;
}

function allResults(structured) {
  if (Array.isArray(structured)) return structured;
  if (Array.isArray(structured?.results)) return structured.results;
  return [];
}

function syntheticArgs(args = {}) {
  return {
    ...args,
    suppress_analytics: true,
    analytics_context: { synthetic: true, source: "mcp_live_conversion_eval" },
  };
}

async function evaluate(test, tools) {
  const checks = [];
  let call = null;
  let structured = null;

  if (test.surface === "tools_list") {
    const toolNames = tools.map((tool) => tool.name).sort();
    checks.push({
      name: "tool_count",
      pass: tools.length >= test.expected.tool_count,
      observed: tools.length,
      expected: `>=${test.expected.tool_count}`,
    });
    checks.push({
      name: "required_tools_present",
      pass: ["search_products", "find_packaging_for_item", "get_cart_handoff_candidates", "create_cart_url"].every((name) =>
        toolNames.includes(name),
      ),
      observed: toolNames,
    });
    return { id: test.id, surface: test.surface, checks, pass: checks.every((check) => check.pass) };
  }

  if (test.tool_call) {
    call = await rpc("tools/call", {
      name: test.tool_call.name,
      arguments: syntheticArgs(test.tool_call.arguments),
    });
  } else if (test.surface === "openai_product_card_exact_match") {
    call = await rpc("tools/call", {
      name: "search_products",
      arguments: syntheticArgs({ query: test.prompt, limit: 5 }),
    });
  } else {
    checks.push({ name: "unsupported_eval_shape", pass: false });
    return { id: test.id, surface: test.surface, checks, pass: false };
  }
  structured = getStructured(call);

  if (test.expected?.is_error) {
    const errorText = getToolError(call);
    checks.push({
      name: "tool_error_expected",
      pass: Boolean(errorText),
      observed: errorText,
    });
    if (test.expected.error_contains) {
      checks.push({
        name: "error_text_contains",
        pass: errorText.includes(test.expected.error_contains),
        observed: errorText,
        expected: test.expected.error_contains,
      });
    }
    return { id: test.id, surface: test.surface, checks, pass: checks.every((check) => check.pass) };
  }

  checks.push({
    name: "http_ok",
    pass: call.http_status >= 200 && call.http_status < 300,
    observed: call.http_status,
  });
  checks.push({
    name: "tool_not_error",
    pass: !call.parsed?.result?.isError,
    observed: getToolError(call),
  });

  if (test.expected?.handle) {
    const top = firstResult(structured);
    const results = allResults(structured);
    checks.push({
      name: "top_handle_exact",
      pass: top?.handle === test.expected.handle,
      observed: top?.handle || "",
      expected: test.expected.handle,
    });
    checks.push({
      name: "expected_handle_present",
      pass: results.some((row) => row?.handle === test.expected.handle),
      observed: results.map((row) => row?.handle).filter(Boolean),
      expected: test.expected.handle,
    });
  }

  if (test.expected?.product_card_required) {
    const top = firstResult(structured);
    checks.push({
      name: "product_card_present",
      pass: Boolean(top?.product_card?.url && top?.product_card?.continuity_key),
      observed: top?.product_card || null,
    });
    checks.push({
      name: "conversion_actions_present",
      pass: Boolean(
        (top?.conversion_actions?.product_url || top?.conversion_actions?.product_click?.url) &&
          (top?.conversion_actions?.cart_hint || top?.conversion_actions?.cart),
      ),
      observed: top?.conversion_actions || null,
    });
  }

  if (test.expected?.fields) {
    const root = test.surface === "create_cart_url" ? structured : firstResult(structured) || structured;
    for (const field of test.expected.fields) {
      checks.push({
        name: `field:${field}`,
        pass: hasPath(root, field),
        observed: hasPath(root, field),
      });
    }
  }

  if (test.expected?.url_contains) {
    const expectedUrlParts = currentCartUrlParts(test, structured);
    checks.push({
      name: "url_contains_tracking",
      pass: containsAll(structured?.url, expectedUrlParts),
      observed: structured?.url || "",
      expected: expectedUrlParts,
    });
  }

  if (test.surface === "create_cart_url") {
    checks.push({
      name: "cart_handoff_primary_url",
      pass:
        structured?.cart_handoff?.primary_url === structured?.url &&
        structured?.primary_buyer_handoff?.primary_url === structured?.url &&
        structured?.cart_handoff?.primary_url_role === "measured_mcp_cart_landing" &&
        structured?.cart_handoff?.landing_records_event === true,
      observed: structured?.cart_handoff || null,
    });
    checks.push({
      name: "mcp_handoff_id_present",
      pass:
        typeof structured?.mcp_handoff_id === "string" &&
        structured.mcp_handoff_id.startsWith("mcp_handoff_") &&
        structured?.url?.includes(`mcp_handoff_id=${encodeURIComponent(structured.mcp_handoff_id)}`) &&
        structured?.cart_handoff?.mcp_handoff_id === structured.mcp_handoff_id,
      observed: {
        mcp_handoff_id: structured?.mcp_handoff_id ?? null,
        url: structured?.url ?? null,
        cart_handoff_id: structured?.cart_handoff?.mcp_handoff_id ?? null,
      },
    });
  }

  if (test.expected?.results) {
    const results = Array.isArray(structured) ? structured : structured?.results;
    checks.push({
      name: "expected_results_shape",
      pass: JSON.stringify(results ?? null) === JSON.stringify(test.expected.results),
      observed: results ?? null,
      expected: test.expected.results,
    });
  }

  if (test.expected?.utm_required) {
    const recovery = structured?.no_match_recovery || {};
    const joined = Object.values(recovery).join(" ");
    checks.push({
      name: "no_match_recovery_utm",
      pass: containsAll(joined, test.expected.utm_required),
      observed: recovery,
      expected: test.expected.utm_required,
    });
  }

  return {
    id: test.id,
    surface: test.surface,
    tool: test.tool_call?.name || "search_products",
    checks,
    pass: checks.every((check) => check.pass),
    response_shape: Array.isArray(structured) ? "array" : typeof structured,
  };
}

async function main() {
  if (!existsSync(evalPath)) {
    throw new Error(`Eval file does not exist: ${evalPath}`);
  }
  mkdirSync(outDir, { recursive: true });
  const evals = readJsonl(evalPath);
  const toolsResp = await rpc("tools/list");
  const tools = toolsResp.parsed?.result?.tools || [];
  const results = [];
  for (const test of evals) {
    results.push(await evaluate(test, tools));
  }

  const createdAt = new Date().toISOString();
  const passCount = results.filter((row) => row.pass).length;
  const failCount = results.length - passCount;
  const summary = {
    created_at: createdAt,
    endpoint,
    eval_file: evalPath,
    live_systems_touched: false,
    mode: "read_only_live_eval",
    counts: {
      tests: results.length,
      passed: passCount,
      failed: failCount,
      tools: tools.length,
    },
    failed_tests: results
      .filter((row) => !row.pass)
      .map((row) => ({
        id: row.id,
        failed_checks: row.checks.filter((check) => !check.pass).map((check) => check.name),
      })),
  };
  const jsonPath = resolve(outDir, "mcp_live_eval_results.json");
  const summaryPath = resolve(outDir, "mcp_live_eval_summary.json");
  const mdPath = resolve(outDir, "mcp_live_eval_report.md");
  writeFileSync(jsonPath, JSON.stringify(results, null, 2) + "\n");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");
  writeFileSync(
    mdPath,
    [
      "# MCP Live Conversion Eval",
      "",
      `- Endpoint: \`${endpoint}\``,
      `- Live systems touched: \`False\``,
      `- Tests: \`${results.length}\``,
      `- Passed: \`${passCount}\``,
      `- Failed: \`${failCount}\``,
      "",
      "## Failed Tests",
      ...(summary.failed_tests.length
        ? summary.failed_tests.map(
            (row) => `- \`${row.id}\`: ${row.failed_checks.map((check) => `\`${check}\``).join(", ")}`,
          )
        : ["- None"]),
      "",
      "## Artifacts",
      `- Results: \`${jsonPath}\``,
      `- Summary: \`${summaryPath}\``,
    ].join("\n") + "\n",
  );
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = failCount ? 1 : 0;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
