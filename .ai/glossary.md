# Glossary

- **deploy PR** — a PR this action opens that changes `image.tag`. Identified downstream by
  the `glueops-deploy` marker in its body, not by branch name or title.
- **marker** — the hidden `<!-- glueops-deploy:{"app","env","tag"} -->` HTML comment
  `formatMarker` writes into a deploy PR body. A byte-for-byte contract with the cleanup
  action (`__tests__/marker.golden`).
- **`sanitizeTag`** — turns a git ref into a valid container tag; MUST stay byte-identical to
  `github-actions-create-container-tags` (parity test).
- **`computeTag`** — picks the tag: the release/tag name (sanitized) on tag events, else
  `sha[:7]`.
- **`values.yaml`** — `apps/<app>/envs/<env>/values.yaml` in the config repo; this action
  edits its `image.tag` (comment-preserving via the `yaml` Document API).
- **`CREATE_PR`** — `true` → open a PR; `false` → commit directly to the config repo's
  default branch (with optimistic-concurrency retry).
- **`DEPLOYMENT_CONFIGS_APP_NAME`** — overrides the `apps/<…>` folder + marker + PR title app
  name when it differs from the source repo (needed for monorepos with multiple apps).
- **scoped App token** — the short-lived installation token minted in `src/octokit.ts`,
  limited to one repo + `contents`/`pull_requests` write, and `setSecret`-masked.
- **committed `dist/`** — the `ncc` bundle GitHub runs directly from the ref; rebuilt and
  committed by `build-dist.yml`, never by hand.
