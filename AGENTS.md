# AGENTS.md – MicYou Automation

Probot GitHub App for [LanRhyme/MicYou](https://github.com/LanRhyme/MicYou), deployed on Vercel. See [README.md](README.md) for setup and deployment.

## Quick commands

```bash
pnpm build          # tsc → dist/
pnpm start          # build + probot run ./dist/app.js
pnpm test           # ts-node ./test/app.test.ts (uvu runner)
pnpm lint           # biome lint .
pnpm format         # biome format --write .
```

## Architecture

```
webhook → api/github/webhooks/index.ts → handler.ts → app.ts → src/targets/<event>.ts
```

### Source file map

| File | Purpose |
|---|---|
| `src/values.ts` | Label ID constants, category helpers (`isPositiveLabel`, etc.), `Context.prototype.label()` extension |
| `src/data.ts` | In-memory transient store (`TDATA`) — **lost on cold start** (Vercel serverless) |
| `src/utils.ts` | `hasWritePermission()`, `isNotUserEvent()` |
| `src/targets/issues.opened.ts` | Spam filter ("Rubbish killer") — closes issues with auto-checked template boxes |
| `src/targets/issues.labeled.ts` | Label state machine — handles both `labeled` and `unlabeled` events |
| `src/targets/issues.closed.ts` | Auto-label on close + permission checks |
| `src/targets/issues.reopened.ts` | Reopen handling |
| `src/targets/issue_comment.ts` | `/command` parser with transient state (`TDATA`) for multi-step workflows |
| `src/targets/pull_request.ts` | PR workflow + GraphQL mergeability checks + review handling |

All targets are default-exported async functions with `Context<"event.action">` signatures, registered in [src/app.ts](src/app.ts).

## Critical conventions

### ESM imports require `.js` extension

```typescript
// ✅ correct
import { Labels } from "../values.js";
// ❌ wrong — will fail at runtime
import { Labels } from "../values";
```

### Labels are numeric IDs, not names

All label constants in `values.ts` are GitHub label **IDs** (numbers like `6820804547`).  
Use `context.label(...ids)` to convert IDs → label names before calling the REST API.

```typescript
const names = await context.label(Labels.done, Labels.bug);
await octokit.issues.addLabels(context.issue({ labels: names }));
```

### Context extension pattern

`values.ts` extends Probot's `Context` via `declare module "probot"` — add new helpers there, not inline.

### Non-user sender filtering

Always filter out bots/actions at the top of every handler:

```typescript
if (sender.type !== "User") return;
```

### PR mergeability requires GraphQL

The REST API doesn't expose `mergeStateStatus` / `reviewDecision`.  
`pull_request.ts` uses a GraphQL query for this. Follow that pattern for new merge checks.

### Label state machine rules

| Add label →                              | Issue closed →                                     | Issue open →                              |
| ---------------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| Positive (process/done)                  | Reopen (if process) / Close as completed (if done) | Remove negative labels                    |
| Negative (not-planned/duplicate/needing) | Reopen (if needing)                                | Close as not-planned + strip other labels |
| Size labels                              | —                                                  | Mutually exclusive (auto-replace)         |
| Markup (high-quality/breaking)           | Never auto-removed                                 | Never auto-removed                        |

### Command parser (`/command`)

[issue_comment.ts](src/targets/issue_comment.ts) parses `/command arg1 "arg 2"` from comment first lines:
- Only processes comments starting with `/`
- Supports quoted multi-word arguments
- Uses [TDATA](src/data.ts) for transient state between commands (e.g., `/duplicate` → confirm flow)
- Always checks `hasWritePermission()` before mutating issues

### TDATA caveat

[data.ts](src/data.ts) is a plain `Map` — **all state is lost on Vercel cold starts**. Multi-step command flows that rely on TDATA (like `/duplicate` confirmations) will break across cold starts. Keep this in mind when adding new stateful commands.

## Patterns & gotchas

### Rubbish killer (spam filter)

[issues.opened.ts](src/targets/issues.opened.ts) auto-closes issues whose body contains unchecked YAML template checkboxes (e.g., `- [ ]` markers from bug_report.yaml or feature_request.yaml). New spam heuristics should follow this pattern.

## Testing

- Framework: **uvu** + **nock** for HTTP mocking
- Tests use `Probot` constructor with `githubToken: "test"` (no real auth needed)
- Current test suite is minimal — add tests in `test/` using the existing pattern

## Deployment

Deployed to **Vercel** as serverless functions. Webhook URL: `POST /api/github/webhooks`.  
Environment variables must be configured in Vercel (see README).

## Logging levels

- `console.info()` — State changes (issue/PR label updates)
- `console.debug()` — Permissions, sender types, internal details
- `console.warn()` — Errors and rejections
