# Changelog

## 1.0.0 (2026-07-04)


### Features

* initial implementation — bump-deployment-tag action + one-click App install page ([#1](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/1)) ([49cb793](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/49cb79354b52caa1f2097217d4d991cd530b5afd))


### Bug Fixes

* harden Octokit typing, marker parsing, large-file read; lock marker contract ([#9](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/9)) ([e44da96](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/e44da966eb4b37f7a55f669055a14fd7d50dcdb6))
* make deploy PR title + commit message conventional-commit compliant ([#5](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/5)) ([e568278](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/e56827882cf5d583ceb7ce705a2c2f8ddb9dac93))
* **page:** make every copy button work + switch to small copy icons ([#14](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/14)) ([5e299a7](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/5e299a77fbb398a997092137c6bbfe67297b2946))
* **page:** register copy delegation before the code-path early return ([#15](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/15)) ([0161872](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/0161872da857bdfa0d04a2658e05249418e9852c))
* use app name (not source repo) in deploy PR title + commit subject ([#6](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/6)) ([50f944d](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/50f944dc6f0deedaf07276b5406148876fcabd06))


### Documentation

* add AGENTS.md + CLAUDE.md + .ai/ for AI tools ([#11](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/11)) ([d7d91de](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/d7d91de9366ad96f88394624f3f95ea36664d2a7))
* fix npm ci dev commands (--ignore-scripts) + note CI checks ([#10](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/10)) ([5c0549c](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/5c0549c139d8b1fcda07c5410a3445a96a4994de))
* **page:** clearer copy + scannable step layout; fix key-loss link bug ([#16](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/16)) ([6aa8bac](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/6aa8bacf08e91ebddc281fd51c29270e23dedd02))
* **page:** frame the app as the optional happy-path + link glueops-dev ([#17](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/17)) ([c40a683](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/c40a6835b841bd3d2f217a9f2e3acf55d09c247b))


### Miscellaneous Chores

* lock file maintenance ([#13](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/13)) ([69a0d64](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/69a0d6400f54a8554b41f0519e9e7b091a7562e4))


### Tests

* lock sanitizeTag parity contract with create-container-tags ([#7](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/7)) ([0aed4b6](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/0aed4b6bb00cfb144d880034f20376aee7edf2ab))


### Continuous Integration

* guard the one-click page's CSP script hash ([#8](https://github.com/GlueOps/github-actions-bump-deployment-tag/issues/8)) ([ca7a4e4](https://github.com/GlueOps/github-actions-bump-deployment-tag/commit/ca7a4e447824170e131ff15972e9dd0c26cecf4f))
