# github-actions-bump-deployment-tag

Update an application's image tag in the GlueOps `deployment-configurations` repo — the change that actually triggers a deploy (ArgoCD reconciles the new tag onto the cluster).

Runs in an **app source repo** on a release or tag. A TypeScript `node24` action that, using the GitHub API only (no `git`/`gh`/`yq`, no checkout):

1. Mints a **short-lived GitHub App installation token** scoped to *only* the `deployment-configurations` repo **and** only `contents`+`pull_requests` write (`@octokit/auth-app`); the token is masked via `core.setSecret`.
2. Computes an image tag — the release/tag name (sanitized to a valid container tag), or the short commit SHA for non-release events. `sanitizeTag` is byte-for-byte identical to `create-container-tags`, so the config tag matches the image the build pushed.
3. Reads `apps/<app>/envs/<env>/values.yaml`, sets `image.tag` (via the `yaml` Document API, **preserving comments/formatting**), with **optimistic-concurrency retry** so concurrent bumps don't clobber each other.
4. Either opens a PR in `deployment-configurations` (`CREATE_PR: true`) or commits directly to its default branch (`CREATE_PR: false`). PRs carry a machine-readable `<!-- glueops-deploy:{...} -->` marker (app/env/tag) that [`github-actions-cleanup-deployment-prs`](https://github.com/GlueOps/github-actions-cleanup-deployment-prs) reads to find superseded PRs.

## Why `node24` (not Docker or a composite/bash action)

It must run on **both GitHub-hosted and self-hosted runners**. A Docker action needs the Docker daemon (not guaranteed on self-hosted); a bash/composite action needs `gh`/`yq` preinstalled. A `node24` action runs on the Actions runner's bundled Node — no Docker, no preinstalled tools, any OS/arch. (`node20` reached end-of-life in April 2026.)

## Why a GitHub App (not a PAT)

Replaces a classic `repo`-scoped user PAT stored org-wide. The App token is **scoped to a single repo**, carries only `Contents` + `Pull requests` write, and **expires in ~1 hour**. Unlike the built-in `GITHUB_TOKEN`, an App-token-authored PR *does* trigger downstream workflows — which is what lets [`github-actions-cleanup-deployment-prs`](https://github.com/GlueOps/github-actions-cleanup-deployment-prs) run.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `ENV` | yes | — | Environment; matches the folder under `apps/<app>/envs/`. |
| `CREATE_PR` | yes | — | `true` → open a PR; `false` → commit to the default branch. |
| `DEPLOYMENT_CONFIGS_APP_NAME` | no | `''` | Override the app folder name if it differs from this repo's name. |
| `DEPLOYMENT_CONFIGS_REPO` | no | `deployment-configurations` | Name of the config repo in this org. |
| `DEPLOYMENT_CONFIGS_REPO_DEFAULT_BRANCH` | no | `main` | Default branch of the config repo. |
| `app-id` | yes | — | GitHub App ID of the GlueOps Deployment App. |
| `private-key` | yes | — | PEM private key of the GlueOps Deployment App. |

## Usage

```yaml
- uses: GlueOps/github-actions-bump-deployment-tag@v1.0.0 # x-release-please-version
  with:
    ENV: prod
    CREATE_PR: true
    app-id: ${{ vars.GLUEOPS_DEPLOYMENT_APP_ID }}
    private-key: ${{ secrets.GLUEOPS_DEPLOYMENT_APP_PRIVATE_KEY }}
```

See [`examples/`](./examples) for release- and tag-triggered workflows.

## Outputs

| Output | Description |
|---|---|
| `tag` | The image tag that was applied. |
| `action` | `created-pr`, `updated-pr`, `committed`, or `noop`. |
| `pr-number` | PR number (when a PR was created/updated). |
| `pr-url` | PR URL (when a PR was created/updated). |

## Prerequisites

A dedicated **GlueOps Deployment GitHub App** installed on the `deployment-configurations` repo, with `Contents: R/W`, `Pull requests: R/W`, `Metadata: R/O`. Store `GLUEOPS_DEPLOYMENT_APP_ID` as an **org variable** and `GLUEOPS_DEPLOYMENT_APP_PRIVATE_KEY` as an **org secret** (repo-allowlisted to the repos that run CD).

## No Marketplace publishing required

Consume it directly via `uses: GlueOps/github-actions-bump-deployment-tag@<sha>`. If this repo is **private/internal**, enable *Settings → Actions → General → Access* so other org repos may use it. Marketplace listing is optional and only affects discoverability.

## Development

Build tooling runs in Docker, so nothing needs installing locally:

```bash
docker run --rm -v "$PWD":/app -w /app node:24-bookworm-slim \
  sh -c "npm ci --ignore-scripts && npm run typecheck && npm run build"
```

Run the tests the same way:

```bash
docker run --rm -v "$PWD":/app -w /app node:24-bookworm-slim \
  sh -c "npm ci --ignore-scripts && npm test"
```

`dist/index.js` is a committed [`ncc`](https://github.com/vercel/ncc) bundle — GitHub runs it directly from the ref (no build step at consumption). **You never hand-build it:** `build-dist.yml` rebuilds it on every PR (including Renovate dependency PRs) and commits the fresh bundle back to the branch, and self-heals `main`. `ci.yml` validates source only (typecheck + Jest + `npm audit`, plus the one-click page's CSP-hash guard and the cross-repo marker-contract check) and asserts `.nvmrc` matches the action runtime. Dependencies are pinned via `package-lock.json` (`npm ci`); the build toolchain (Node via `.nvmrc`, `ncc`, `typescript`) is exact-pinned; the org Renovate bot keeps them updated. Releases are cut by **release-please** (`release-please.yaml`) from Conventional Commits (App-token auth, plain `vX.Y.Z` tags); its release job attaches **build provenance** (`actions/attest-build-provenance`) to the bundle. Pure logic lives in `src/lib.ts` (unit-tested); `src/main.ts` is thin orchestration.

> Note on required checks: `build-dist.yml` commits the rebuilt `dist/` with the built-in `GITHUB_TOKEN`, which by design does **not** re-trigger workflows — so on a runtime-dep PR (where `dist/` changes) that final commit has no fresh `validate` run. If you enforce required status checks, that commit can sit "waiting for status" and block the merge. On these internal repos with reviewed manual merges that's a non-issue; if you need required checks, have `build-dist` push with a GitHub App token instead of `GITHUB_TOKEN` so CI re-runs. Fork PRs can't be pushed to (read-only token), so their `git push` fails and surfaces the drift for a maintainer.
