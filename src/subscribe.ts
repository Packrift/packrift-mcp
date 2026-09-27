// Email capture endpoint for packrift.com (added 2026-09-07).
//
// POST /subscribe  (JSON or form-encoded)
//   email        required
//   source       short slug: footer | popup | inline-guide | estimate | calculator | quote | ...
//   first_name   optional
//   tags         optional array or comma list (max 8, each <= 40 chars)
//   props        optional flat object of strings (max 12 keys) -> Omnisend customProperties
//   page         optional path the form was on
//   website      honeypot, must be empty
//
// Writes the contact to Omnisend as an email subscriber (sendWelcomeMessage on)
// with tags `source:site`, `capture:<source>`, `price-report`. Existing contacts
// are looked up by email and patched (tags merged, status set to subscribed).
// Per-IP throttle in KV. CORS limited to the storefront origins.
import { Env } from "./shopify.js";

const ALLOWED_ORIGINS = new Set([
  "https://packrift.com",
  "https://www.packrift.com",
  "https://packrift.myshopify.com",
]);
const OMNISEND_API = "https://api.omnisend.com/api";
const OMNISEND_VERSION = "2026-03-15";
const RATE_LIMIT = 8; // submissions per IP per hour
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9:_-]{0,39}$/;

type Body = Record<string, unknown>;

function corsHeaders(origin: string): Record<string, string> {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://packrift.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

async function readBody(req: Request): Promise<Body> {
  const ct = (req.headers.get("Content-Type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) return (await req.json()) as Body;
    const form = await req.formData();
    const out: Body = {};
    for (const [k, v] of form.entries()) {
      if (typeof v !== "string") continue;
      const m = k.match(/^props\[([a-z0-9_]+)\]$/i);
      const propKey = m ? m[1] : "";
      if (propKey) {
        const props = (out.props as Body) || {};
        props[propKey] = v;
        out.props = props;
      } else out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function slug(v: unknown): string {
  const s = str(v, 40).toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
  return SLUG_RE.test(s) ? s : "";
}

function cleanTags(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  const out: string[] = [];
  for (const t of raw) {
    const s = slug(t);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= 8) break;
  }
  return out;
}

function cleanProps(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object") return out;
  let n = 0;
  for (const [k, val] of Object.entries(v as Body)) {
    const key = k.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 40);
    const s = typeof val === "number" ? String(val) : str(val, 240);
    if (!key || !s) continue;
    out[key] = s;
    if (++n >= 12) break;
  }
  return out;
}

async function throttle(env: Env, ip: string): Promise<boolean> {
  if (!ip) return true;
  const key = `subscribe:rl:v1:${ip}`;
  const cur = Number((await env.CATALOG_CACHE.get(key)) || "0");
  if (cur >= RATE_LIMIT) return false;
  await env.CATALOG_CACHE.put(key, String(cur + 1), { expirationTtl: 3600 });
  return true;
}

async function omni(env: Env, path: string, method: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(`${OMNISEND_API}/${path}`, {
    method,
    headers: {
      Authorization: `Omnisend-API-Key ${env.OMNISEND_API_KEY}`,
      "Omnisend-Version": OMNISEND_VERSION,
      "Content-Type": "application/json",
      "User-Agent": "PackriftCapture/1.0",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { status: res.status, data };
}

async function findContact(env: Env, email: string): Promise<any | null> {
  const r = await omni(env, `contacts?email=${encodeURIComponent(email)}&limit=1`, "GET");
  const list = r.data?.contacts;
  if (Array.isArray(list) && list.length && String(list[0].email || "").toLowerCase() === email) return list[0];
  return null;
}

export async function subscribe(env: Env, req: Request): Promise<Response> {
  const cors = corsHeaders(req.headers.get("Origin") || "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
  if (!env.OMNISEND_API_KEY) return json({ error: "not_configured" }, 503, cors);

  const body = await readBody(req);
  const email = str(body.email, 254).toLowerCase();
  const honeypot = str(body.website, 50);
  const source = slug(body.source) || "site";
  const firstName = str(body.first_name, 60);
  const page = str(body.page, 200);
  const tags = cleanTags(body.tags);
  const props = cleanProps(body.props);
  const ip = (req.headers.get("CF-Connecting-IP") || "").trim();
  const ua = (req.headers.get("User-Agent") || "").slice(0, 160);

  // Bots: pretend success, write nothing.
  if (honeypot) return json({ ok: true, status: "ok" }, 202, cors);
  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400, cors);
  if (!(await throttle(env, ip))) return json({ error: "rate_limited" }, 429, cors);

  const now = new Date().toISOString();
  const allTags = Array.from(new Set(["source:site", `capture:${source}`, "price-report", ...tags]));
  const customProperties: Record<string, string> = {
    ...props,
    capture_source: source,
    capture_page: page || "unknown",
    capture_at: now,
    consent_channel: "email",
    consent_text: "Signed up on packrift.com for the Packrift Price Watch, a monthly packaging price report",
    consent_ua: ua,
  };

  try {
    const existing = await findContact(env, email);
    if (existing && existing.id) {
      const mergedTags = Array.from(new Set([...(Array.isArray(existing.tags) ? existing.tags : []), ...allTags]));
      const patch: Body = {
        tags: mergedTags,
        customProperties: { ...(existing.customProperties || {}), ...customProperties },
        identifiers: [
          {
            type: "email",
            id: email,
            channels: { email: { status: "subscribed", statusDate: now } },
            consent: { source: `packrift.com ${page || "site"} capture:${source} (Packrift Price Watch signup form)`, createdAt: now, ip: ip || undefined, userAgent: ua || undefined },
            sendWelcomeMessage: existing.status !== "subscribed",
            source: "api",
          },
        ],
      };
      if (firstName && !existing.firstName) patch.firstName = firstName;
      const r = await omni(env, `contacts/${existing.id}`, "PATCH", patch);
      if (r.status >= 200 && r.status < 300) {
        return json({ ok: true, status: existing.status === "subscribed" ? "already_subscribed" : "resubscribed" }, 200, cors);
      }
      return json({ error: "omnisend_update_failed", detail: r.data?.detail || r.data?.title || r.status }, 502, cors);
    }

    const create: Body = {
      identifiers: [
        {
          type: "email",
          id: email,
          channels: { email: { status: "subscribed", statusDate: now } },
          consent: { source: `packrift.com ${page || "site"} capture:${source} (Packrift Price Watch signup form)`, createdAt: now, ip: ip || undefined, userAgent: ua || undefined },
          sendWelcomeMessage: true,
          source: "api",
        },
      ],
      tags: allTags,
      customProperties,
    };
    if (firstName) create.firstName = firstName;
    const r = await omni(env, "contacts", "POST", create);
    if (r.status >= 200 && r.status < 300) return json({ ok: true, status: "subscribed" }, 200, cors);
    return json({ error: "omnisend_create_failed", detail: r.data?.detail || r.data?.title || r.status }, 502, cors);
  } catch (e) {
    return json({ error: "subscribe_unavailable", detail: String((e as Error).message).slice(0, 200) }, 502, cors);
  }
}
