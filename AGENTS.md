# AGENTS.md

`github-actions-bump-deployment-tag` — a **node24 TypeScript GitHub Action**. On an app's
release/tag it mints a scoped GitHub App token and updates `image.tag` in a GlueOps
`deployment-configurations` repo (comment-preserving), opening a PR or committing directly.
It also hosts the **one-click App-install page** under `docs/` (served via GitHub Pages).

## Before you touch anything

- **`dist/index.js` is a committed [`ncc`](https://github.com/vercel/ncc) bundle that
  GitHub runs directly — never hand-edit it.** Change `src/`; `build-dist.yml` rebuilds and
  commits `dist/` on every PR.
- **The deploy-PR marker is a wire contract shared byte-for-byte with the cleanup action**
  (`__tests__/marker.golden`, enforced by a CI "marker contract parity" check). Never change
  the format on one side only — update both repos and the golden together.
- **`sanitizeTag` must stay byte-identical to
  [`github-actions-create-container-tags`](https://github.com/GlueOps/github-actions-create-container-tags)**,
  or the tag written to `values.yaml` won't match the image the build pushed. A golden
  parity test guards this — don't "fix" it by regenerating expected values.
- **The node runtime must match:** `.nvmrc` major == `action.yml` `using: node24` (CI
  asserts it) — bump them together.
- All `npm ci` uses `--ignore-scripts`; commit messages are **Conventional Commits**
  (release-please cuts releases + plain `vX.Y.Z` tags); the one-click page's inline script
  is CSP-hash-pinned (CI fails on drift). Build/test tooling runs in Docker.

## Where to look

- **Usage, inputs/outputs, prerequisites, and contributing/Development → [README.md](./README.md).**
  (The README's *Development* section is the authoritative contributor guide.)
- **The one-click install page (security model, CSP, Pages setup, editing) → [docs/README.md](./docs/README.md).**
- **Deeper agent-oriented context → [`.ai/`](./.ai/)** (imported essentials below).

@.ai/context.md
@.ai/glossary.md
