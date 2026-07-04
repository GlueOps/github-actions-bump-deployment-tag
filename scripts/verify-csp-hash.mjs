// Verify the one-click install page's CSP script hashes.
//
// docs/index.html locks its inline <script> via a Content-Security-Policy
// `script-src 'sha256-…'`. If the script is edited without recomputing that
// hash, browsers SILENTLY block the script and the page dies. This guard
// recomputes each inline script's SHA-256 and fails if it isn't declared in
// the CSP — so the mismatch is caught in CI, not by a broken page.
//
// Usage: node scripts/verify-csp-hash.mjs [path/to/index.html]
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const file = process.argv[2] ?? "docs/index.html";
const html = readFileSync(file, "utf8");

// 1. Find the CSP <meta> and collect the sha256 hashes it declares.
const meta = html.match(
  /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i,
);
if (!meta) {
  console.error(`✗ ${file}: no Content-Security-Policy <meta> found`);
  process.exit(1);
}
const content = meta[0].match(/content\s*=\s*(["'])([\s\S]*?)\1/i);
if (!content) {
  console.error(`✗ ${file}: CSP <meta> has no content attribute`);
  process.exit(1);
}
const csp = content[2];
const declared = new Set(
  [...csp.matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)].map((m) => m[1]),
);

// 2. Hash every inline <script> (one without a src=) and require it be declared.
const scripts = [
  ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
].map((m) => m[1]);
if (scripts.length === 0) {
  console.error(`✗ ${file}: no inline <script> found`);
  process.exit(1);
}

let ok = true;
scripts.forEach((body, i) => {
  const hash = createHash("sha256").update(body, "utf8").digest("base64");
  if (declared.has(hash)) {
    console.log(`✓ inline script #${i + 1}: sha256-${hash} is present in the CSP`);
  } else {
    ok = false;
    console.error(
      `✗ inline script #${i + 1}: computed sha256-${hash} is NOT in the CSP script-src`,
    );
    console.error(
      `  CSP declares: ${[...declared].map((h) => `sha256-${h}`).join(", ") || "(none)"}`,
    );
    console.error(`  Fix: set script-src to 'sha256-${hash}' in the CSP <meta>.`);
  }
});

if (!ok) {
  console.error("\nCSP hash mismatch — the page would silently break in browsers.");
  process.exit(1);
}
console.log(`\n✓ ${file}: all inline scripts match the CSP.`);
