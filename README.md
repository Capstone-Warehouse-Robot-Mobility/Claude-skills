# AI setup — priming kit (single-directory layout)

Extracted from `Project-Hings` @ branch `sprint1-blue` (tip `ee9be3e7`), then
flattened: the original split `.agents/` + symlinked `.claude/` has been
collapsed into one real directory, and the `.codex/` + `.cursor/` adapters
have been dropped. Claude Code only. No symlinks.

## Layout

```
.claude/
  skills/<name>/SKILL.md   48 skills — workflows + framework references
  agents/<name>.md         16 read-only subagent definitions
  commands/<name>.md       22 slash-command shims
  scripts/
    guard-pnpm.mjs           PreToolUse hook — blocks npm/yarn/bun installs
    check-skill-routing.mjs  CI check for skill routing drift
  stack-map.md             monorepo path -> reference-skill routing table
  settings.json            hook registration

.mcp.json                MCP servers (context7, shadcn, better-auth, expo-mcp)
skills-lock.json         provenance + hashes for vendored upstream skills
```

## Installing into a new repo

1. Copy `.claude/`, `.mcp.json`, and `skills-lock.json` to the repo root.
   Plain files and directories — no `core.symlinks`, no Developer Mode.
2. Optionally wire the routing check into `package.json`:
   ```json
   "check:routing": "node .claude/scripts/check-skill-routing.mjs"
   ```
3. Rewrite `.claude/stack-map.md` for the new repo's paths. It is the only
   project-specific file in the kit; everything else is portable.
4. `guard-pnpm.mjs` assumes pnpm. Edit the regexes or drop the hook from
   `settings.json` if the repo uses a different package manager.

## What changed from the original

| Original | Here |
|---|---|
| `.agents/` canonical + 4 symlinks in `.claude/` | one real `.claude/` |
| `stack-map.md` at `.agents/`, unreachable from `.claude/` | `.claude/stack-map.md` |
| skills referenced both `.agents/skills/…` and `.claude/skills/…` | all `.claude/skills/…` |
| `check-skill-routing.mjs` hardcoded `.agents/skills` | `.claude/skills` |
| `.codex/` (15 TOML agents) + `.cursor/mcp.json` | removed |

Re-derive the original at any time:
`git archive sprint1-blue .agents .claude .codex .cursor .mcp.json skills-lock.json`
