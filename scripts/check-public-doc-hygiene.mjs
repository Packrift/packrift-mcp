import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const TARGETS = [
  "README.md",
  "LAUNCHGUIDE.md",
  "llms-install.md",
  "PACKRIFT-PACKAGING-REFERENCE.md",
  "server.json",
  "glama.json",
  "smithery.yaml",
  "docs",
];

const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml"]);

const FORBIDDEN_PATTERNS = [
  {
    label: "Shopify Admin token-shaped placeholder",
    pattern: /SHOPIFY_PACKRIFT_TOKEN\s*=\s*(?:\.{3}|shpat_)/i,
  },
  {
    label: "copy prompt that names a Shopify Admin token prefix",
    pattern: /paste\s+shpat_/i,
  },
  {
    label: "literal Shopify Admin token prefix",
    pattern: /shpat_[A-Za-z0-9_.-]*/i,
  },
];

function walk(target) {
  const absolute = path.join(ROOT, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  if (!stat.isDirectory()) return [];

  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const child = path.join(target, entry.name);
    files.push(...walk(child));
  }
  return files;
}

const files = TARGETS.flatMap(walk).filter((file) => ALLOWED_EXTENSIONS.has(path.extname(file)));
const failures = [];

for (const file of files) {
  const relative = path.relative(ROOT, file);
  const text = fs.readFileSync(file, "utf8");

  for (const { label, pattern } of FORBIDDEN_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      failures.push({ file: relative, label, match: match[0] });
    }
  }
}

if (failures.length > 0) {
  console.error("Public documentation hygiene check failed:");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.label} (${failure.match})`);
  }
  process.exit(1);
}

console.log(`Public documentation hygiene check passed (${files.length} files scanned).`);
