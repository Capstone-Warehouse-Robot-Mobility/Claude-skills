---
name: open-mr
description: Open a GitLab merge request with a title and Summary/Test-plan body generated from the branch's full commit range and diff against the base branch — not just the latest commit. Runs the full `check-mr-readiness` gauntlet (typecheck, lint, test suite, residue sweep) before publishing and blocks on red gates so the MR goes out shippable, not provisional. Pushes the branch with -u when there's no upstream, picks the repo's default base branch, offers to auto-branch when invoked from the base branch (and returns to it after publishing), marks the MR as draft when commits signal WIP, and shows the proposed title/body for confirmation before publishing. Accepts `mode=fast|balanced|production` (default: `production`). Trigger phrases — "open an MR", "create a merge request", "make an MR", "/open-mr", "raise an MR", "submit an MR", "MR with description", "open a draft MR". Skip for — pushing without an MR, editing an existing MR's body (use `glab mr update`), repos without a GitLab remote.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Open MR

Phased workflow. Do not skip the confirmation gate — a published MR notifies reviewers and is hard to un-publish.

## Preflight — Self-hosted GitLab auth

Before any `glab` call, verify auth against the self-hosted host:

```bash
glab auth status --hostname git.websentinel.net
```

If the auth check fails, surface to the user: "run `glab auth login --hostname git.websentinel.net` first, then retry." Alternative: export `GITLAB_HOST=git.websentinel.net` and `GITLAB_TOKEN=<token>` env vars.

Resolve the project id once (used for API calls that need a numeric project reference):

```bash
PID=$(glab repo view --output json | jq -r .id)
```

## Modes

Accepts `mode=fast|balanced|production`. Default — when no `mode=` is specified — is `production`. **An MR is a public artifact.** Reviewers will assume the diff is shippable; the mode controls how thoroughly we verify that before publishing.

| Mode | Pre-publish gate (Phase 2.5) |
|---|---|
| `fast` | Residue sweep only (console.log / `.only` / debugger / merge markers / TODO additions). Blocks on merge markers; warns on the rest. |
| `balanced` | `fast` + typecheck + lint on the cumulative diff. Blocks on type/lint errors. |
| `production` (default) | Full `check-mr-readiness` against the branch vs. base. Blocks on any red gate (typecheck, lint, formatter, tests, residue, large/binary additions, lockfile drift). |

**Override:** explicit `mode=…` in the user's prompt wins.

## Phase 1 — Gather

Run the reflexive checks (`git status`, current branch) plus these non-obvious ones in parallel:

- `glab repo view --output json | jq -r .default_branch` — base branch (do NOT assume `main`)
- `git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null` — does upstream exist?
- `git log <base>..HEAD --pretty=format:'%h %s'` — every commit on the branch
- `git diff <base>...HEAD --stat` and `git diff <base>...HEAD` — cumulative diff (note the **three dots** — diff from merge-base, not two)

Stop conditions:
- Uncommitted changes → ask whether to commit, stash, or include them. Do not silently ignore.
- Branch == base branch → see **On base branch** below. Do NOT silently stop.
- No commits ahead of base → stop. Nothing to MR.
- No GitLab remote (`glab repo view` fails) → stop. Tell the user.

### On base branch

If the current branch is the base branch (e.g., user is on `main` with local commits they want to MR), do not stop — offer to branch out first:

1. Check `git log origin/<base>..HEAD` for unpushed commits. If empty, stop with "nothing to MR."
2. If there are unpushed commits, synthesize a default branch name from the cumulative commits/diff (e.g., `feat/<short-subject>`, `fix/<short-subject>` — kebab-case, ≤40 chars). Ask via `AskUserQuestion`:
   - **Create branch `<suggested-name>` and continue** (recommended)
   - **Cancel**
3. On confirm: `git checkout -b <name>` from HEAD. The commits travel with the new branch; local `<base>` is unchanged.
4. Remember the original base branch — Phase 4 returns to it after the MR is created.

Note: local `<base>` will still contain the same commits as the new branch until the MR merges and the user pulls. This is expected and safe; do NOT reset `<base>` to `origin/<base>`.

## Phase 2 — Draft

Before drafting, ask: **what does a reviewer need in order to engage with this MR?** That answer drives the title and the Summary bullets — not the commit log.

Title:
- 1 commit on branch → use the commit subject verbatim (already curated).
- 2+ commits → synthesize from the **cumulative diff**, not the last commit. ≤70 chars. Imperative mood. No trailing period. No issue numbers unless the user added them.

Body — exactly this template:

```
## Summary
- <bullet 1: what changed and why, grounded in the diff>
- <bullet 2>
- <bullet 3 — optional>

## Test plan
- [ ] <concrete check tied to a changed file/path>
- [ ] <concrete check>
```

Summary rules:
- 1–3 bullets. Each names a concrete area (file, module, behavior). No "various improvements" / "refactoring" / "cleanup."
- Lead with WHY when the diff alone doesn't reveal it.

Test plan rules:
- Items must be checkable by a reviewer (run X, click Y, hit endpoint Z). Not "tests pass."
- If you genuinely can't form a test plan from the diff (docs-only, config-only), write one bullet: `- [ ] Visual review of <file>` and stop.

Draft flag — open as draft if any commit subject contains `WIP`, `wip`, `draft`, or `[WIP]`, OR if the user asked for a draft. GitLab marks drafts by either passing `--draft` to `glab mr create` (which prefixes the title with `Draft:`) or by prefixing the title with `Draft:` manually.

## Phase 2.5 — Pre-publish quality gate (mandatory)

Run the mode-appropriate gate from the **Modes** table above against the cumulative diff (`git diff <base>...HEAD`).

- `mode=production` → invoke `check-mr-readiness` and pipe its report through verbatim.
- `mode=balanced` / `mode=fast` → run the scoped checks listed in the table.

If any gate fails, **stop**. Ask via `AskUserQuestion`:
- **Fix and retry** → exit; user fixes and re-invokes `/open-mr`.
- **Open as draft anyway** → switch the MR to draft and append a "## Known failing gates" section to the body listing each red gate. Require an explicit acknowledgement string. Do not open as a non-draft MR with failing gates.

Skip the gate when the branch has zero diff vs. base or the diff is doc/comment-only.

## Phase 3 — Confirm (mandatory gate)

Show the user:

```
Base: <base-branch>
Branch: <current-branch>     [will push with -u]   ← only if no upstream
Draft: yes/no
Title: <title>

Body:
<body>

Open MR? (y / edit / cancel)
```

- `y` → Phase 4
- `edit` → ask what to change, redraft, show again
- `cancel` → stop

Do not skip this gate even if the user said "open an MR" — the title and body are your synthesis, not theirs.

## Phase 4 — Push & Create

If no upstream: `git push -u origin <branch>`. If push fails (non-fast-forward, protected branch), surface the error — do **not** force-push.

Then:

```bash
glab mr create \
  --target-branch <base> \
  --source-branch <branch> \
  --title "<title>" \
  [--draft] \
  --description "$(cat <<'EOF'
<body>
EOF
)"
```

Always use a HEREDOC for `--description` to preserve newlines and checkbox syntax. After success, print the MR URL from stdout.

If Phase 1 auto-created a branch from the base branch, run `git checkout <base>` to return the user to where they started, then tell them: "Local `<base>` still has the MR'd commits; they'll be reconciled when the MR merges and you run `git pull`." Do NOT reset local `<base>`.

## NEVER

- **NEVER derive the title from only the latest commit when the branch has multiple commits**
  **Instead:** Synthesize from `git diff <base>...HEAD`.
  **Why:** Mid-branch commits like "fix typo" or "address review" become misleading MR titles that hide the real change.

- **NEVER skip the confirmation gate**
  **Instead:** Show title + body and wait for `y / edit / cancel`.
  **Why:** MRs are visible to teammates and trigger notifications/CI. The synthesis is yours, not the user's — they need to see it before it ships.

- **NEVER skip the Phase 2.5 pre-publish quality gate**
  **Instead:** Run the mode-appropriate gate against the cumulative diff. On red gates, only proceed as a draft MR with the failing gates documented in the body.
  **Why:** A non-draft MR signals "ready for review." Reviewers waste cycles on an MR that fails CI on first push, and trust in the system erodes when "ready" doesn't mean ready.

- **NEVER assume the base branch is `main`**
  **Instead:** Read it from `glab repo view --output json | jq -r .default_branch`.
  **Why:** Repos using `master`, `develop`, or `trunk` get MRs targeted at a non-existent or wrong branch and fail or merge into the wrong place.

- **NEVER force-push to make `glab mr create` succeed**
  **Instead:** Surface the push error to the user and let them decide.
  **Why:** A non-fast-forward error usually means upstream has commits the user hasn't seen — force-pushing destroys them.

- **NEVER write generic boilerplate in Summary ("various improvements", "refactoring", "cleanup")**
  **Instead:** Name the concrete files/modules/behaviors from the diff.
  **Why:** Reviewers skim the Summary to decide whether to engage. Boilerplate trains them to skip your MRs.

- **NEVER open an MR against a protected branch you can't target**
  **Instead:** If `glab mr create` fails with a permission/protection error, surface it; ask whether to retarget or open from a fork.
  **Why:** Protected branches reject MRs from contributors without write access, and `glab`'s error wording is often opaque — translating it saves the user a confused debug loop.

- **NEVER use two-dot `git diff <base>..HEAD`**
  **Instead:** Use three dots: `git diff <base>...HEAD`.
  **Why:** Two-dot includes upstream changes the branch hasn't merged yet, polluting the diff. Three-dot shows only what the branch added since merge-base.
