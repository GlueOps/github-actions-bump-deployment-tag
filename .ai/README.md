# .ai/

Extra orientation for AI coding tools working in this repo. The human-facing docs are the
root [README.md](../README.md) (usage + contributing/Development) and the one-click page's
[docs/README.md](../docs/README.md); this folder holds agent-oriented context that
complements them without duplicating.

- [context.md](./context.md) — what this action does, the CD system it's part of, and the
  marker contract.
- [related-repos.md](./related-repos.md) — the sibling repos and how they connect.
- [glossary.md](./glossary.md) — domain terms.

Entry point is [AGENTS.md](../AGENTS.md) at the repo root, which imports the essentials from
here.

## Planned

- `using-this-action.md` — a **consumer-facing guide for AI agents wiring this action into a
  workflow** (correct inputs, App/token setup, common mistakes). Until it lands, the
  [README.md](../README.md) *Inputs / Usage / Outputs / Prerequisites* sections are
  authoritative. When adding it, link it here and from [AGENTS.md](../AGENTS.md).
