#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  claudeConnectorSubmissionMarkdown,
  claudeConnectorSubmissionPayload,
} from "../dist/claude-connector-submission.js";

const REPO_ROOT = process.cwd();
const OUT_ROOT = resolve(REPO_ROOT, "outputs/claude-connector-submission");
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const DIRECTORY_PACK_PATH = resolve(REPO_ROOT, "outputs/mcp-directory-submission-pack/latest.json");

function slugNow(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function readDirectoryPack() {
  if (!existsSync(DIRECTORY_PACK_PATH)) return null;
  return JSON.parse(readFileSync(DIRECTORY_PACK_PATH, "utf8"));
}

function runtimeFromLatestProof() {
  const pack = readDirectoryPack();
  return {
    serverVersion: PACKAGE_JSON.version,
    toolsCount: pack?.live_proof?.mcp_tools_list?.tools_count ?? 15,
    resourcesCount: pack?.live_proof?.mcp_resources_list?.resources_count ?? 100,
    promptsCount: pack?.live_proof?.mcp_prompts_list?.prompts_count ?? 9,
  };
}

function main() {
  const runtime = runtimeFromLatestProof();
  const payload = claudeConnectorSubmissionPayload(runtime);
  const markdown = claudeConnectorSubmissionMarkdown(runtime);
  const stamp = slugNow();
  const outDir = resolve(OUT_ROOT, stamp);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(OUT_ROOT, { recursive: true });
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  writeFileSync(resolve(outDir, "claude-connector-submission.json"), json);
  writeFileSync(resolve(outDir, "claude-connector-submission.md"), markdown);
  writeFileSync(resolve(OUT_ROOT, "latest.json"), json);
  writeFileSync(resolve(OUT_ROOT, "latest.md"), markdown);
  console.log(
    JSON.stringify(
      {
        generated_at: payload.generated_at,
        status: payload.status,
        release: payload.release,
        endpoint: payload.server.remote_endpoint,
        tools: runtime.toolsCount,
        prompts: runtime.promptsCount,
        resources: runtime.resourcesCount,
      },
      null,
      2
    )
  );
}

main();
