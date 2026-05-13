# AGENTS.md – PCL CE Automation

Probot GitHub App deployed on Vercel. See [README.md](README.md) for setup and deployment.

## Quick commands

```bash
pnpm build          # tsc → dist/
pnpm start          # build + probot run ./dist/app.js
pnpm test           # ts-node ./test/app.test.ts (uvu runner)
```

## Architecture

```
webhook → api/github/webhooks/index.ts → handler.ts → app.ts → src/targets/<event>.ts
```

- `src/values.ts` — Label ID constants + category checks + `Context.prototype.label()` extension
- `src/data.ts` — In-memory transient store (`TDATA`), lost on cold start
- `src/utils.ts` — `hasWritePermission()`, `isNotUserEvent()`
- `src/targets/` — One handler per event type, default-exported async functions

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
