# Stack map — paths to framework-reference skills

Used by `add-feature`, `modify-feature`, `fix-bug`, `polish-ui`, `audit`, `remove-feature` in their Phase 0 stack-detection step. Maps monorepo paths to the framework-reference skills that should be consulted when a task touches that path.

## Mapping

| Path | Stack | Reference skills |
|---|---|---|
| `apps/web/**` | TanStack Start / React Router SSR / Vite | `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `shadcn` (when shadcn/ui components are involved) |
| `apps/native/**` | Expo + React Native | `building-native-ui`, `heroui-native`, `native-data-fetching`, `vercel-react-native-skills`, `expo-dev-client`, `expo-tailwind-setup`, `expo-deployment`, `expo-cicd-workflows` |
| `apps/server/**` | Elysia + tRPC + Bun | `elysiajs` |
| `packages/auth/**` | Better-Auth | `better-auth-best-practices` |
| `packages/db/**` | Drizzle ORM + PostgreSQL | (no dedicated ref — query `context7` for Drizzle docs when needed) |
| `packages/ui/**` | shadcn/ui shared components | `shadcn` |
| `packages/api/**` | tRPC contracts shared by web + native | (no dedicated ref — `elysiajs` covers server-side; the web/native client refs cover client-side) |
| `packages/{env,config}/**` | Zod env validation, shared ts/eslint config | (no dedicated ref) |
| `turbo.json`, `pnpm-workspace.yaml`, root `package.json` | Monorepo orchestration | `turborepo` |

## Multi-stack tasks

A single task often crosses multiple stacks. Examples:

- **"Add Stripe checkout"** → `apps/web` (checkout flow) + `apps/native` (mobile pay sheet) + `apps/server` (webhook handler) + `packages/db` (orders schema) → consult `vercel-react-best-practices`, `web-design-guidelines`, `heroui-native`, `building-native-ui`, `elysiajs`.
- **"Refactor user profile"** → `apps/web` + `apps/native` + `packages/auth` + `packages/db` → consult `vercel-composition-patterns`, `heroui-native`, `better-auth-best-practices`.
- **"Add a CRON job"** → `apps/server` only → consult `elysiajs`.

List refs for **all** touched stacks, then produce ONE plan that spans them. Do not split a coherent feature into separate `/ship` runs unless the user explicitly asked.

## How to consult a ref

Reference skills live at `.claude/skills/<name>/SKILL.md`. Invoke via the `Skill` tool when working in the relevant phase (e.g., `Skill(skill="heroui-native", args="...")`), or `Read` the file directly when you need a quick lookup without a full skill run.

These are reference docs — they describe patterns, API surface, and conventions. They are **not workflows** and do not own gates. Use them to inform decisions during exploration, design, and implementation.

## When to skip refs

- Single-line copy or styling tweak where the ref adds nothing — skip.
- Pure config / TypeScript-only edits not touching framework APIs — skip.
- Test-fixture or mock-only changes — skip.

When in doubt, skim the ref's frontmatter description; if the description matches the task, consult it.

## Announcing detected stack

In your initial response (Phase 1 or earlier), list the detected app(s)/package(s) and the refs you'll consult. Example:

```
Detected stacks: apps/native, apps/server, packages/db
Refs to consult: heroui-native, building-native-ui, elysiajs
```

This makes the assumption visible and lets the user correct it before deep work begins.
