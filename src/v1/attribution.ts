// Client attribution without server-side session state. At initialize the
// server reads clientInfo.name and returns a session id that carries a short
// client slug ("pk1.claude.<uuid>"). Streamable HTTP clients echo that id on
// every later request, so tool calls and checkout links can be attributed to
// the assistant that sent them.

const CLIENT_RULES: Array<[RegExp, string]> = [
  [/claude[-_ ]?code/i, "claude_code"],
  [/cowork/i, "claude"],
  [/claude|anthropic/i, "claude"],
  [/chatgpt|openai/i, "chatgpt"],
  [/codex/i, "codex"],
  [/cursor/i, "cursor"],
  [/windsurf|codeium/i, "windsurf"],
  [/visual studio code|vscode|vs code|copilot/i, "vscode"],
  [/cline/i, "cline"],
  [/\bmuse\b/i, "muse"],
  [/gemini|google/i, "gemini"],
  [/perplexity/i, "perplexity"],
  [/inspector/i, "inspector"],
  [/glama/i, "glama"],
  [/smithery/i, "smithery"],
  [/n8n/i, "n8n"],
  [/zapier/i, "zapier"],
];

export function clientSlugFromName(name: unknown): string | null {
  const text = typeof name === "string" ? name.trim() : "";
  if (!text) return null;
  for (const [pattern, slug] of CLIENT_RULES) if (pattern.test(text)) return slug;
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return slug || null;
}

export function sessionIdForClient(clientSlug: string | null): string {
  const slug = clientSlug && /^[a-z0-9_]{1,24}$/.test(clientSlug) ? clientSlug : "unknown";
  return `pk1.${slug}.${crypto.randomUUID()}`;
}

export function clientSlugFromSessionId(sessionId: unknown): string | null {
  if (typeof sessionId !== "string") return null;
  const match = sessionId.match(/^pk1\.([a-z0-9_]{1,24})\.[0-9a-f-]{36}$/);
  if (!match || match[1] === "unknown") return null;
  return match[1]!;
}

/** utm_source for links, grouped so reports show one row per assistant. */
export function utmSourceForClient(slug: string | null | undefined): string {
  if (!slug) return "ai_agent";
  if (slug === "claude" || slug === "claude_code" || slug.startsWith("claude_")) return "claude";
  if (slug === "chatgpt" || slug.startsWith("openai")) return "chatgpt";
  return slug.replace(/[^a-z0-9_]/g, "").slice(0, 24) || "ai_agent";
}

export function productLink(url: string, clientSlug: string | null | undefined, content?: string | null): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("utm_source", utmSourceForClient(clientSlug));
    parsed.searchParams.set("utm_medium", "mcp_tool");
    parsed.searchParams.set("utm_campaign", "packrift_mcp");
    if (content) parsed.searchParams.set("utm_content", content.slice(0, 40));
    return parsed.toString();
  } catch {
    return url;
  }
}
