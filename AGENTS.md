# AGENTS.md

## Mission and Engineering Principles
- Build a robust, verifiable Electron desktop app with a type-safe frontend-backend boundary.
- Prefer KISS over abstraction-heavy designs.
- Optimize for deterministic, headless feedback loops that can run in CLI agents.
- Favor real implementation tests (real DB, real IPC in E2E) over synthetic mocks.
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
- All Kysely calls must live in `packages/backend/src/data-access`.
- Any DB schema change must include migration + regenerated DB types in the same commit.
- `pnpm verify` must pass before commit.
- `pnpm verify` must complete with zero warnings and zero errors.
- Full type safety is mandatory; avoid unsafe type escapes (`as never`, chained unknown casts, ts-ignore directives).
- AGENTS-first workflow is mandatory: update `AGENTS.md` before implementing any new convention-driven code change.

## Architecture Boundaries
- `packages/api`: single shared TypeScript API contract and result types.
- `apps/electron`: transport boundary only (IPC + app lifecycle), no business logic.
- `packages/backend/src/services`: use-case/business logic.
- `packages/backend/src/data-access`: all persistence/query logic with Kysely.
- `packages/db`: DB runtime, migrations, seeding, generated schema types.
- `apps/renderer`: React UI only; backend interactions via injected API contract.

## Testing Policy
- Backend tests always use a real SQLite database.
- RTL frontend tests use the real backend implementation via API injection (no IPC transport).
- E2E tests exercise full implementation (Electron + IPC + backend + SQLite).
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
1. Stabilize global-context extraction pipeline in `@repo/auto-extract` with strict grounding and deterministic post-processing.
2. Keep extraction API additive and graph-ready (`extraction`, `extractionV2`, `debug`) while preserving V1 compatibility.
3. Improve renderer extraction UX: highlighted source text, entity excerpts, fact ownership/perspective clarity, segment cards, debug-copy workflow.
4. Maintain deterministic verification coverage (backend + RTL + E2E smoke) without brittle model-output assertions in E2E.
5. Prepare next persistence phase by keeping `extractionV2` graph projection and segment metadata stable for DB storage.
6. Add side-by-side extraction A/B benchmarking lanes (local llama + Claude + OpenAI) with additive API contracts and explicit loading/progress UX.

## Decision Log
- Chosen stack: pnpm workspace, electron-vite, Vite React, Vitest, Playwright Electron, Biome.
- API contract style: TypeScript-only shared types (no always-on runtime schema parsing).
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
- Auto-extract convention: `@repo/auto-extract` uses a local llama.cpp binary and local GGUF model auto-downloaded into `~/.auto-extract` with a single public API `extract(text)` and no Python runtime dependency.
- Package naming convention: all workspace packages must use the `@repo/*` scope prefix for consistency and tooling alignment.
- Testing exception convention: for RTL/backend tests, `auto-extract` behavior may be mocked when needed for deterministic test coverage, with explicit user-approved intent documented in the test.
- Auto-extract test convention: tests must not call real `@repo/auto-extract` inference by default; any temporary unmocking requires explicit per-task user permission and an in-file override marker documented with rationale, due cost and runtime volatility.
- Extraction pipeline convention: run one whole-note LLM extraction pass first (global-context), then deterministically derive segments from grounded spans; do not pre-split into multiple LLM calls by default.
- Attribution convention: every fact must carry `ownerEntityId` and `perspective` (`self`/`other`/`uncertain`) to avoid conflating narrator facts with other entities.
- Sentiment convention: use per-segment sentiment as primary query surface; top-level sentiment is a rollup and uses `varied` when segments differ.
- UI convention: extraction page must show original source text with color-matched entity highlights and excerpt snippets in the entity list.
- Debugging convention: extraction UI must provide a one-click debug export containing prompt, raw model output, validated/final payloads, segmentation trace, runtime metadata, and fallback/error info.
- E2E extraction convention: keep E2E assertions at smoke level for extraction UI controls (textarea + submit, fresh + seeded profiles), not model-inference content assertions.
- Runtime constraint convention: extraction must use local llama.cpp + local GGUF only (no Python), with first-call auto-download into `~/.auto-extract`.
- Latency target convention: optimize extraction for practical local responsiveness with a working target around <=2s on supported hardware/model, while prioritizing correctness and grounding over unrealistic token-speed assumptions.
- A/B benchmarking convention: extraction compare mode may call cloud providers via AI SDK (Anthropic + OpenAI) in parallel with local llama for side-by-side evaluation, while preserving the existing local-only `extract.run` path for compatibility.

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
