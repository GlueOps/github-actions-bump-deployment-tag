# Context: what this action does

`bump-deployment-tag` is the **producer** half of GlueOps Continuous Delivery. It runs in an
**app source repo** on a release/tag and moves that app's new image tag into the GitOps
config repo, which is what actually triggers a deploy.

## The flow

1. An app repo cuts a release/tag → this action mints a **short-lived GitHub App
   installation token** (`@octokit/auth-app`) scoped to *only* the `deployment-configurations`
   repo and only `contents` + `pull_requests` write; the token is `core.setSecret`-masked.
2. It computes the image tag — the release/tag name (`sanitizeTag`), or `sha[:7]` for
   non-release events — and edits `apps/<app>/envs/<env>/values.yaml` `image.tag` via the
   `yaml` Document API (**comments preserved**), with optimistic-concurrency retry.
3. It opens a PR (`CREATE_PR: true`) or commits directly (`false`). PRs carry the
   `glueops-deploy` marker so the **cleanup** action can find superseded deploy PRs.
4. ArgoCD watches the config repo and reconciles the new tag onto the cluster.

Uses a GitHub **App** token (not `GITHUB_TOKEN`) on purpose: `GITHUB_TOKEN`-authored PRs
don't trigger downstream workflows, so cleanup wouldn't run.

## The marker contract (shared with cleanup)

`formatMarker` writes a hidden HTML comment into each deploy PR body:

```
<!-- glueops-deploy:{"app":"<app>","env":"<env>","tag":"<tag>"} -->
```

The cleanup action classifies deploy PRs **solely** by this marker. The exact format is a
byte-for-byte contract — the golden lives in `__tests__/marker.golden` (identical in both
repos) and a CI parity check fails if they drift. See
[related-repos.md](./related-repos.md).

## Source layout

`src/lib.ts` = pure logic (tag compute + sanitize, marker format/parse, YAML edit — unit
tested). `src/octokit.ts` = the App-token minting seam. `src/run.ts` = the orchestration
(`run(deps)` with an injected Octokit). `src/main.ts` = thin ncc entrypoint. `docs/` = the
one-click install page. Tests inject a fake Octokit; the real ESM Octokit is never loaded
under ts-jest.
