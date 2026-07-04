# Related repos

| Repo | Relationship |
|------|--------------|
| [github-actions-cleanup-deployment-prs](https://github.com/GlueOps/github-actions-cleanup-deployment-prs) | The **consumer** of the marker this action writes. Runs in the config repo and closes superseded deploy PRs. Shares the `marker.golden` wire contract (CI parity-checked). |
| [github-actions-create-container-tags](https://github.com/GlueOps/github-actions-create-container-tags) | Produces the image tag the build **pushes**. This action's `sanitizeTag` MUST stay byte-identical to that action's bash sanitization, or the config tag won't match the pushed image. Guarded by a golden parity test in `__tests__/lib.test.ts`. |
| [e2e-github-actions-deployment-configurations](https://github.com/GlueOps/e2e-github-actions-deployment-configurations) | The throwaway end-to-end test repo that runs this action (and cleanup) against real GitHub, hourly. It can pin `bump_ref` to a branch/PR to test an unmerged change before merging. |
| `deployment-configurations` (per-tenant) | The GitOps config repo this action writes to: `apps/<app>/envs/<env>/values.yaml` holds `image.tag`, watched by ArgoCD. |

## The GitHub App

Consumers install a dedicated **GlueOps Deployment** App (Contents R/W, Pull requests R/W,
Metadata R/O) on their `deployment-configurations` repo, and store its App ID +
private key as `GLUEOPS_DEPLOYMENT_APP_ID` (org variable) + `GLUEOPS_DEPLOYMENT_APP_PRIVATE_KEY`
(org secret). The one-click page under `docs/` creates that App via GitHub's App Manifest
flow. See [../docs/README.md](../docs/README.md).
