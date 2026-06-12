# AGENTS.md

## Mission and Engineering Principles
- Build a robust, verifiable web-first application with a Hono-based Node.js backend and a Vite React SPA, featuring a type-safe RPC boundary.
- Prefer KISS over abstraction-heavy designs.
- Optimize for deterministic, headless feedback loops that can run in CLI agents.
- Favor real implementation tests (real DB, in-memory Fetch requests) over synthetic mocks.
- Build graph-ready personal note extraction that preserves full-note context while remaining strictly span-grounded.

## Hard Rules
- Commits must be self-contained and complete.
- Never commit unfinished feature/task/bug states.
- Always commit completed work before finishing a user request.
- Use `--no-gpg-sign` for commits in this repository workflow.
- Mocking in tests is forbidden unless the user explicitly approves it for the current task.
- `@repo/auto-extract` must be mocked/injected in tests by default; running real model extraction in tests is forbidden unless the user explicitly approves it for the current task.
- Do not override explicit user decisions without asking for permission first.
- Keep solutions minimal, robust, and future-proof.
- Declare external dependencies in root `package.json` only (monolith dependency management).
- Avoid experimental runtime/platform features by default; require explicit user approval before using them.
- Prefer latest stable package versions and LTS runtime baselines where practical.
- All data access and Kysely calls must live in either `packages/db/src/primary` or `packages/db/src/user` and be accessed via dependency-injected interfaces in route handlers.
- Any DB schema change must include migration + regenerated DB types in the same commit.
- `pnpm verify` must pass before commit.
- `pnpm verify` must complete with zero warnings and zero errors.
- Full type safety is mandatory; avoid unsafe type escapes (`any`, `as never`, chained unknown casts, ts-ignore directives).
- NO `any` in production code.
- NO type casts (`as ...`) in production code unless absolutely unavoidable (e.g., third-party library interop) and documented.
- End-to-end type safety via Hono RPC is mandatory.
- Data-access interfaces must be fully typed and injected into the Hono context.
- AGENTS-first workflow is mandatory: update `AGENTS.md` before implementing any new convention-driven code change.

## Architecture Boundaries
- `apps/renderer`: React UI only; backend interactions via Hono RPC (`hc`), with Vite proxy for dev to avoid CORS.
- `apps/server`: Hono application handling auth, middleware, business logic, and serving static frontend assets in production.
- `packages/db`: DB runtime, migrations, and generated schema types, strictly partitioned into:
  - `src/primary`: PrimaryDbClient for users/sessions.
  - `src/user`: UserDbClient for notes/history.
- Route Domain: Handlers receive injected data access interfaces (e.g., `noteRepository`) via Context, never raw DB clients. `primaryDb` is restricted to middleware only.

## Testing Policy
- Vitest + JSDOM is the primary integration testing strategy. React network calls intercept to Web standard `Request` objects passed directly to `honoApp.request(req)` with injected in-memory SQLite databases.
- Playwright E2E tests are reserved for critical user paths (e.g., login, rendering) and must run against the production build (`apps/server` serving the built UI). A separate minimal smoke test verifies the dev proxy.
- Backend/route tests always use a real in-memory SQLite database.
- E2E suite must cover both fresh and seeded DB profiles within a single run.
- Mocks are blocked by policy checker unless explicitly authorized by user.
- Real `@repo/auto-extract` inference is blocked in tests by policy checker due cost/latency; test flows must use injected/mocked extraction dependencies unless explicitly user-approved for the current task.

## Verification Pipeline
`pnpm verify` must run all checks in deterministic order:
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm type-safety:check`
4. `pnpm arch:check`
5. `pnpm db:verify`
6. `pnpm test:backend`
7. `pnpm test:rtl`
8. `pnpm test:e2e`
9. No warnings emitted in command output.

## Current Execution Plan
0. Execute Web Migration: Replace Electron with Hono server, implement multi-tenant SQLite with Google SSO, and switch to Vitest+JSDOM full-stack tests.
1. Stabilize global-context extraction pipeline in `@repo/auto-extract` with strict grounding and deterministic post-processing.
2. Keep extraction API additive and graph-ready around V2-only payloads (`extraction`, `debug`) with no V1 compatibility surface.
3. Improve renderer extraction UX: highlighted source text, entity excerpts, fact ownership/perspective clarity, and debug-copy workflow.
4. Maintain deterministic verification coverage (backend + RTL + E2E smoke) without brittle model-output assertions in E2E.
5. Prepare next persistence phase by keeping `extraction` graph projection and segment metadata stable for DB storage.
6. Add side-by-side extraction A/B benchmarking lanes (local llama + Claude + OpenAI) with additive API contracts and explicit loading/progress UX.
7. Persist full A/B compare lane snapshots in extraction history and render them as auto-expanded historical lane rows.

## Decision Log
- Auth convention: Real Google SSO implemented using raw `fetch` for zero vendor lock-in and minimal dependencies.
- Session convention: Sliding sessions implemented (e.g., refresh to 30 days if under 15 days remaining) on authenticated requests to prevent unexpected logouts.
- Testing convention: E2E tests run against the production build (`pnpm start`); dev server is validated with a separate smoke test configuration (`pnpm test:smoke`).
- Script convention: Added `start` script to root `package.json` for running the production server locally with environment variables.
- Chosen stack: pnpm workspace, Node.js + Hono, Vite React, Vitest, Playwright Web, Biome.
- API contract style: Hono RPC (`AppType` exported from server).
- Web Migration: Replaced Electron with a Hono web server. Adopted custom Google SSO and multi-tenant SQLite (primary DB for auth, individual user DBs for data).
- Dependency Injection convention: Route handlers receive domain-specific data access interfaces (e.g., `noteRepository`) via Hono Context, never raw DB clients.
- Error contract: typed Result union (`ok: true/false`).
- DB test performance strategy: per-suite cloned DB template + per-test savepoint rollback.
- Hook strategy: `simple-git-hooks` running full verify gate.
- Process rule: AGENTS.md is both policy and active execution plan, updated immediately on new user conventions.
- Runtime baseline: Node.js 22.x and pnpm 10.x.
- SQLite runtime baseline: `node:sqlite` with Kysely; `better-sqlite3` is deferred as an optional future perf optimization.
- Approved exception: `node:sqlite` is currently allowed by user for this repository.
- E2E convention: choose fresh/seeded profiles inside tests (or per-test hooks), not via separate CI/script runs.
- Dependency convention: monolith root dependency graph; workspace package manifests avoid separate dependency declarations.
- Execution convention: avoid `--experimental-*` CLI flags in tooling scripts when stable alternatives exist (use `tsx` for TS scripts).
- Collaboration convention: if implementation issues suggest reversing a user-selected tool/approach, pause and request approval before changing it.
- Type safety convention: enforcement is part of `pnpm verify`, not a best-effort guideline.
- Delivery convention: finish requests with a commit whenever work is completed.
- Commit convention: use `git commit --no-gpg-sign ...` by default.
- Auto-extract convention: `@repo/auto-extract` uses a local llama.cpp binary and local GGUF model auto-downloaded into `~/.auto-extract`, exposes V2-first APIs (`extractV2`, `extractWithDebug`, compare lanes), and has no Python runtime dependency.
- Package naming convention: all workspace packages must use the `@repo/*` scope prefix for consistency and tooling alignment.
- Testing exception convention: for RTL/backend tests, `auto-extract` behavior may be mocked when needed for deterministic test coverage, with explicit user-approved intent documented in the test.
- Auto-extract test convention: tests must not call real `@repo/auto-extract` inference by default; any temporary unmocking requires explicit per-task user permission and an in-file override marker documented with rationale, due cost and runtime volatility.
- Extraction pipeline convention: run one whole-note LLM extraction pass first (global-context), then deterministically derive segments from grounded spans; do not pre-split into multiple LLM calls by default.
- Attribution convention: every fact must carry `ownerEntityId` and `perspective` (`self`/`other`/`uncertain`) to avoid conflating notetaker facts with other entities.
- Notetaker-first convention: in first-person notes, the notetaker (`I`) is the default owner for first-person evidence; explicit third-party evidence remains `other`.
- Pronoun convention: `we` implies notetaker involvement and should map to notetaker ownership/perspective unless explicitly excluded.
- Terminology convention: extraction outputs/prompts should use "notetaker" terminology (or direct first-person `I`) and must not label the author as "narrator".
- Product framing convention: vision docs should describe a space where someone can be with their own thoughts; if an agent is involved, it serves the user in understanding themselves better and must not be framed as literally being the user or as a "chat with yourself" unless the user explicitly chooses that framing.
- Sentiment convention: use per-segment sentiment as primary query surface; top-level sentiment is a rollup and uses `varied` when segments differ.
- Fact language convention: predicates should be concise natural language (spaces), not snake_case, for cross-model consistency and UI readability.
- UI convention: extraction page must show original source text with color-matched entity highlights and excerpt snippets in the entity list.
- Debugging convention: extraction UI must provide a one-click debug export containing prompt, raw model output, validated/final payloads, segmentation trace, runtime metadata, and fallback/error info, available both in the history list and directly inside individual A/B compare lanes.
- E2E extraction convention: keep E2E assertions at smoke level for extraction UI controls (textarea + submit, fresh + seeded profiles), not model-inference content assertions.
- Runtime constraint convention: extraction must use local llama.cpp + local GGUF only (no Python), with first-call auto-download into `~/.auto-extract`.
- Latency target convention: optimize extraction for practical local responsiveness with a working target around <=2s on supported hardware/model, while prioritizing correctness and grounding over unrealistic token-speed assumptions.
- A/B benchmarking convention: extraction compare mode may call cloud providers via AI SDK (Anthropic + OpenAI) in parallel with local llama for side-by-side evaluation, while preserving the existing local-only `extract.run` path for compatibility.
- Task extraction convention: detect TODO/task/actionable intent from note text and represent it EXPLICITLY as objects in the `todos` array in the Extraction schema, preventing them from being miscategorized as standard facts.
- Segmentation convention: segments are additive debug metadata only; facts are the primary structured surface and must remain complete without segment reliance.
- Extraction UI convention: renderer must not display segment cards/lists; segment data may remain in debug payloads/contracts only.
- History compare convention: extraction history entries originating from A/B compare must preserve the full lane set (including skipped/error lanes) and render auto-expanded lane cards matching the live compare presentation.
- Compare density convention: A/B compare lanes use compact widget-style extraction cards sized for high information density, favoring dense row previews and hover/active expansion over block-level scrolling.
- Compare expansion convention: each compare lane expands/minimizes the full lane content in a single lane-level action (no nested "open full extraction" step), and both newly generated and historical lanes should default to an expanded state for immediate visibility.
- Compare compact row convention: in compact compare widgets, prefer stable vertical layout for item rows (entities/facts/relations) to prevent UI jumping during fast cursor movement; avoid auto-expanding excerpts on hover in high-density views.
- V1 deprecation convention: extraction V1 payloads/types/debug fields are removed from API/runtime/UI; only V2 extraction contracts are supported.
- Worktree convention: worktrees are optional; direct commits in the primary repository worktree are allowed when preferred to reduce workflow overhead.

## Convention Intake Process
When a new user convention appears:
1. Update AGENTS.md first.
2. Record the convention and rationale in `Decision Log`.
3. Continue implementation only after AGENTS update lands.
4. Keep conventions explicit, testable, and automation-friendly.

## Shell and Skills-Inspired Working Conventions
Inspired by [Shell + Skills + Compaction tips](https://developers.openai.com/blog/skills-shell-tips):
- Route complex recurring workflows into scripts under `scripts/`.
- Keep checks deterministic and CLI-friendly (no hidden UI-only validation).
- Encode negative cases as explicit failing checks (architecture/mocks/drift).
- Keep artifact boundaries explicit (contract package, data-access-only query layer).
