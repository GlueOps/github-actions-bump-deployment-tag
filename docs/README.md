# One-click setup page (`docs/`)

`index.html` is a **single self-contained static page** that runs GitHub's [App Manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest) so a customer can **one-click create the "GlueOps Deployment" GitHub App** in their own org, then paste the resulting App ID + private key into their org secrets.

Served via **GitHub Pages from this repo's `/docs`** → `https://glueops.github.io/github-actions-bump-deployment-tag/`. There is **no backend**: the page POSTs a manifest to GitHub, GitHub redirects back with a one-time `code`, and the page exchanges it at `POST https://api.github.com/app-manifests/{code}/conversions` (CORS-enabled) client-side. The private key is **displayed once for the customer to copy** and never touches a GlueOps server.

## ⚠️ Supply-chain risk of hosting it here (accepted tradeoff)
This repo has an **auto-committing** pipeline (`build-dist.yml` pushes to `main`/PR branches and runs `npm run build`). Because this page renders every customer's private key, a compromised build dependency could in principle rewrite these bytes and exfiltrate keys — the Security review's **H1** finding. Hosting the page here was a deliberate choice to accept that tradeoff in exchange for co-location.

**Mitigations applied:** all workflows use `npm ci --ignore-scripts` (blocks install-hook malware); deps are pinned (`package-lock.json`), scanned (`npm audit`), and Renovate-updated; `build-dist` normally only `git add dist` (never `docs/`).

**Strongly recommended to close most of the residual risk:**
- Enable **branch protection** on the Pages-served branch (require PR review; do **not** let the Actions bot bypass) so a compromised build token can't silently rewrite `docs/index.html`. If serving from `main`, note this also gates `build-dist`'s main self-heal push — acceptable, since dist is already correct via the PR flow.
- Even stronger: serve Pages from a dedicated branch `build-dist` never writes.
- Enforce org 2FA/SSO (org takeover = total compromise).

## Pages setup
Settings → Pages → **Deploy from a branch → `main` / `/docs`**. The committed `.nojekyll` disables Jekyll (so the inline JS's `{{ }}` isn't mangled). Turn on **Enforce HTTPS**. `redirect_url` is derived at runtime (`location.origin + location.pathname`), so it follows the served path automatically.

## Security model of the page itself
Client-side display-and-paste is **safer than a backend** (per-org blast radius vs centralizing all keys). Hardening in `index.html`:
- Strict **CSP** via `<meta>` with a **script hash** (no `unsafe-inline`), `connect-src https://api.github.com`, `form-action https://github.com`, `img-src 'self' data:`, `default-src 'none'`.
- **Zero third-party requests**: logo inlined as a `data:` URI; no analytics/CDN/fonts.
- `referrer: no-referrer` + `history.replaceState()` scrubs the one-time `code` on load.
- `state` CSRF check; framebust; key never persisted, cleared on bfcache restore; all dynamic values via `textContent`.
- Surfaces only the numeric **App ID** + **PEM**; discards the `client_secret`/`webhook_secret` the API also returns.

## Editing
If you change the inline `<script>`, **recompute the CSP `script-src` hash**:
```bash
node -e "const fs=require('fs'),c=require('crypto');const b=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];console.log('sha256-'+c.createHash('sha256').update(b,'utf8').digest('base64'))"
```
and update the `script-src 'sha256-…'` value in the CSP meta.

To bump the permissions generation (only when the app's `default_permissions` change), edit the `PERM_GEN` constant in the script (`v1` → `v2`) — decoupled from the action's semver on purpose.
