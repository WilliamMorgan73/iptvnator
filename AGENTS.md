# AGENTS.md

This file provides guidance to coding agents working in this repository.

> This file mirrors, verbatim, the process/workflow sections of `CLAUDE.md`
> (Plan Mode, Documentation After Changes, Upgrade And Migration
> Compatibility, Regression Prevention, Agent Bootstrap, Electron CDP
> Debugging) plus the "Repo Skills" and auto-managed Nx sections below, which
> are unique to this file. When updating one of the mirrored sections, apply
> the same edit to both files. `CLAUDE.md` is the canonical source for
> everything else — project structure, architecture, and feature-by-feature
> behavior contracts (most of which also link out to `docs/architecture/*.md`)
> — and is not duplicated here; an agent that can read `CLAUDE.md` should do
> so for that context.

## Plan Mode

- When an agent is in Plan Mode and produces a final `<proposed_plan>`, it must also save that finalized plan as a Markdown file in the repo-root `.plans/` directory.
- Save only finalized plans. Do not write interim exploration, question turns, or draft revisions to `.plans/`.
- Use the filename pattern `YYYY-MM-DD-short-topic.md` such as `.plans/2026-03-12-channel-filtering.md`.
- If the intended filename already exists, append a numeric suffix such as `-2`, `-3`, and so on.

## Documentation After Changes

- After implementing a meaningful change, agents must assess whether canonical repo docs need updates before considering the task complete.
- Meaningful changes include new or changed user-visible behavior, architecture or data-flow changes, non-obvious maintenance workflows, new setup/debugging steps, and new subsystem contracts or boundaries.
- Skip doc updates for trivial refactors with unchanged behavior, formatting-only edits, and isolated test-only changes.
- Prefer updating an existing authoritative doc before creating a new one:
    1. `README.md` for top-level developer or user workflows
    2. `docs/architecture/` for architecture, ownership, and behavior contracts
    3. the nearest module `README.md` for local usage or behavior
- Keep `CLAUDE.md` up to date. It is a living document: whenever a change touches something it describes — monorepo structure (new/moved/renamed apps or libs), routes, database schema/tables, stores and their features, key components, commands, environment behavior, or coding conventions — update the affected `CLAUDE.md` sections as part of the same task, and keep the mirrored process sections in this file in sync.
- When adding a new feature area, check whether the Architecture or Key Features sections of `CLAUDE.md` describe the surrounding area; if they do, reflect the addition there instead of leaving the description stale.
- Do not let `CLAUDE.md` or this file drift: a stale path or route in either file poisons the context of every future agent session. If you notice an outdated claim while working, fix it (or flag it in the final summary) even if it is unrelated to the current task.
- Repo docs are canonical even when they were originally drafted by an LLM.
- Final task summaries should state whether docs were updated and which doc changed.

## Upgrade And Migration Compatibility

- Users may skip releases. The application must apply all required migrations in dependency order when upgrading directly from an older release; never assume that users installed or launched every intermediate version.
- Preserve migration paths for existing persisted data. Do not make deleting a database/profile or reinstalling the application a normal upgrade requirement. Any unavoidable intermediate-version requirement must be an explicitly documented exception.
- Create required tables first, add missing columns before dependent indexes/triggers/queries, and make startup migrations safe to run again. `CREATE TABLE IF NOT EXISTS` does not update an existing table's columns.
- For persistence changes, test real SQLite initialization with representative historical schemas and data, including skipped releases, the previous release, a fresh database, and repeated startup. Assert preservation of user data as well as the resulting schema; SQL mocks alone cannot verify upgrade compatibility. Cover equivalent persisted-state transitions for non-SQLite stores.
- See `libs/shared/database/README.md` for SQLite migration ownership and validation guidance.

## Regression Prevention And Test Updates

- Before the final summary for any feature, behavior change, bug fix, data-flow change, Electron IPC/database change, or user-visible UI workflow change, complete a test impact pass. Identify the affected projects and decide whether unit, integration, E2E, build, lint, or manual/CDP verification is required.
- Bug fixes must normally include regression coverage that fails on the old behavior and passes with the fix. If automated coverage is not practical, document why in the final summary and include the strongest manual validation performed.
- Feature work and behavior changes must update existing tests when assertions, fixtures, mocks, routes, or E2E flows are now stale, incomplete, or missing. Prefer extending the closest existing spec or E2E file before adding a new suite.
- Default validation ladder:
    1. Run targeted unit tests for directly affected projects with `pnpm nx test <project>` or existing scripts such as `pnpm run test:frontend`, `pnpm run test:backend`, or `pnpm run test:unit:ci` when the scope is broader.
    2. Run affected E2E coverage when changing user-visible workflows, routing, persistence, playback, portals, settings, import flows, or Electron-only behavior.
    3. Use `pnpm nx show projects --withTarget test` and `pnpm nx show projects --withTarget e2e` when project ownership or available validation targets are unclear.
    4. Prefer specific atomized E2E targets before broad suites when they cover the changed behavior, for example `pnpm nx run web-e2e:e2e-ci--src/xtream.e2e.ts` or `pnpm nx run electron-backend-e2e:e2e-ci--src/search.e2e.ts`.
- Electron-specific changes affecting IPC, SQLite, packaged runtime, external players, native file access, or Electron-only routes require Electron E2E coverage where available, or CDP/manual verification with `agent-browser` and the tracing flags documented below.
- Final task summaries must list tests added or updated, validation commands run with results, and any skipped validation with the reason. For docs-only changes, state that unit/E2E validation was not required and verify the changed Markdown instead.

## Agent Bootstrap

```bash
pnpm install --frozen-lockfile
pnpm nx show projects
```

- Run the install step in a fresh worktree before relying on Nx discovery, lint, test, or build commands. Without `node_modules`, local Nx modules are unavailable.
- Re-run the install whenever the checkout moves — `git pull`, `git reset --hard`, a rebase, or a worktree branch being re-pointed. Git rewrites `pnpm-lock.yaml` but never re-links `node_modules`, so a tree installed at an older commit keeps serving the old dependency versions and tests fail locally while CI stays green. Check with `cmp pnpm-lock.yaml node_modules/.pnpm/lock.yaml`; any difference means the tree is stale, and a plain `pnpm install --frozen-lockfile` in that directory repairs it. Each worktree needs its own install — with no local `node_modules`, Nx aborts with `Could not find ".modules.yaml"`.
- Never run `prettier --write` on `CLAUDE.md`, `AGENTS.md` or `docs/**`. These files are not Prettier-clean upstream, so a whole-file write reflows passages the change never touched — a nested list item loses its indentation, a `+ player` continuation line turns into a `- player` bullet — and the review bots flag the diff as corrupted guidance (PR #1628). Format only the lines you wrote. If a write already happened, restore the file from the branch's merge base (`git show $(git merge-base HEAD origin/master):CLAUDE.md > CLAUDE.md`) and re-apply the intended edit by hand.
- Use scoped path aliases from `tsconfig.base.json` such as `@iptvnator/services`, `@iptvnator/shared/interfaces`, and `@iptvnator/ui/components`.
- Do not add new imports from legacy bare aliases such as `services`, `shared-interfaces`, `components`, `m3u-state`, or `database`.
- Every Nx project should keep `scope:*`, `domain:*`, and `type:*` tags in `project.json`.
- See `docs/architecture/nx-workspace-boundaries.md` for the current Nx tag and alias policy.
- Keep `nx` and every official `@nx/*` package on the same exact version; run
  `pnpm run deps:nx:validate` after dependency updates.
- Use the Node version in `.nvmrc` for development and CI. Angular 22 requires
  Node `^22.22.3 || ^24.15.0` and TypeScript `>=6.0 <6.1` in this workspace.
- Vite `8.1.5`, resolved through Angular's build tooling, retains upstream
  precise matchers and adds bounded raw-code prefilters through
  `patches/vite@8.1.5.patch`. Keep the patch until upstream also preserves
  comment-bearing asset/worker expressions; run `pnpm run deps:vite:test`
  after related dependency updates.
- `app-builder-lib` `26.15.7` (electron-builder's macOS signing) is patched in
  `patches/app-builder-lib@26.15.7.patch` with the upstream backport
  electron-userland/electron-builder#10172: `security set-key-partition-list -k`
  must receive the temporary keychain's own password, not the `.p12` import
  password. macOS runner images since `macos-26-arm64` 20260831 verify that
  password, and `Build on macos arm64` failed with `SecKeychainUnlock: The user
  name or passphrase you entered is not correct`. Keep the patch until
  electron-builder resolves an `app-builder-lib` containing the fix (26.16.1+),
  and run `pnpm run deps:electron-builder:test` after related dependency
  updates — the test fails when the patched version no longer matches the
  installed one.
- `node-gyp` is a declared root devDependency because
  `apps/electron-backend/build-embedded-mpv.js` resolves it with
  `require.resolve`. Do not drop it as "unused": without the declaration it is
  reachable only through pnpm's hidden hoist (`node_modules/.pnpm/node_modules`),
  which pnpm's `.bin` shims put on `NODE_PATH` — so `pnpm nx …` and CI keep
  working while a plain `node apps/electron-backend/build-embedded-mpv.js`
  fails on a clean install with "Unable to resolve node-gyp".
- `nx-electron@22.0.0` uses a local Nx 23 export-path patch and an explicit
  `webpack-node-externals` package extension. Scoped peer allowances for it
  and `ngx-indexed-db@22.0.0` live in `pnpm-workspace.yaml`; they are project
  compatibility bridges, not upstream support declarations. See
  `docs/architecture/nx-workspace-boundaries.md` before removing them.
- A directory holding files consumed by other projects must be an Nx project.
  Nx builds its graph from TypeScript imports only, so a relative SCSS `@use`
  across project roots creates no edge and the imported file lands in no task
  hash — edits then return a cache hit instead of rebuilding. Shared partials
  live in `libs/ui/styles` (project `ui-styles`), and each consumer declares
  `"implicitDependencies": ["ui-styles"]`. Run `pnpm run styles:inputs:validate`
  after adding a cross-project stylesheet import.
- Update Nx with `pnpm nx migrate nx@<target> --skipInstall`, regenerate the
  lockfile, run generated migrations when present, and validate before opening
  a PR. Major updates are always manual. Replace incomplete Dependabot security
  PRs with a coordinated update instead of editing the bot branch.
- Repository-specific skills live under `.codex/skills/`.
- Frontmatter descriptions are trigger-only and begin with `Use when`; keep
  each skill at or below 500 words.
- Run `pnpm run skills:validate` after editing a committed skill or a literal
  path it documents.
- Keep `.codex` and `.claude` copies of `release-notes` and `release-cut`
  byte-identical.

## Electron CDP Debugging

- Start Electron in dev mode with: `nx serve electron-backend`
- Package-script equivalent: `pnpm run serve:backend`
- The workspace is configured to always launch Electron with: `--remote-debugging-port=9222`
- Use CDP clients (Chrome DevTools Protocol tools) against: `127.0.0.1:9222`
- When the task is Electron automation/debugging, use the `electron` skill
- Do not auto-open DevTools during normal CDP automation. In development, DevTools is opt-in via `ELECTRON_OPEN_DEVTOOLS=1`.
- If DevTools is open, `agent-browser --cdp 9222 ...` may attach to the DevTools page instead of the IPTVnator window (symptoms: `tab list` shows `about:blank`, empty snapshots, black screenshots). Inspect targets with `curl http://127.0.0.1:9222/json/list` and connect directly to the app page's `webSocketDebuggerUrl`.
- The app holds a single-instance lock (`acquireSingleInstanceLock` in `apps/electron-backend/src/app/services/single-instance.ts`): a second launch against the same `userData` quits immediately and focuses the running window. To attach a second CDP-enabled instance to the same profile, set `IPTVNATOR_ALLOW_MULTIPLE_INSTANCES=1` — knowing that only one of the two processes will own the renderer's IndexedDB, so settings written by the other are lost. Before focusing, the guard forwards the second launch's argv to `onSecondInstance`, which is how a playlist path handed to an already-running app reaches the open queue.

For startup tracing or white-screen debugging:

```bash
IPTVNATOR_TRACE_STARTUP=1 nx serve electron-backend
```

Useful narrower flags:

- `IPTVNATOR_TRACE_IPC=1` traces renderer `window.electron.*` bridge calls
- `IPTVNATOR_TRACE_DB=1` traces DB worker requests and DB progress events
- `IPTVNATOR_TRACE_SQL=1` traces SQLite statements in both main and worker connections
- `IPTVNATOR_TRACE_WINDOW=1` traces BrowserWindow navigation/load lifecycle
- `IPTVNATOR_TRACE_PLAYER=1` traces external-player activity, bounded Embedded MPV runtime-probe stderr, and embedded MPV session status transitions (the input of the reconnect policy; never the stream URL)
- `IPTVNATOR_TRACE_RENDERER_CONSOLE=1` mirrors renderer console logs into the Electron terminal
- `IPTVNATOR_PERF_CAPTURE=1` enables development/test-only, redacted M3U and Xtream preload IPC request/completion markers plus count-only M3U acquire/parse/normalize, Xtream main network/JSON-transform/success-response-ready/cancel-dispatch, and renderer store phase capture; renderer wrappers emit only while the benchmark installs its Symbol hook, benchmark tooling sets the flag explicitly, and production launches must leave it unset
- `IPTVNATOR_PERF_WORKER_PROFILING=1` enables development/test-only, request-scoped worker receive/work/response-post timestamps, thread CPU, event-loop utilization/delay, count-only playlist serialization/SQLite write/read/deserialization plus Xtream category/content/cache-clear/delete/in-source-search phase events, profiling-only worker cancel-receipt acknowledgements, valid-sample-counted isolate peak memory, and the database worker's idle-only one-shot post-GC heap probe; overlapping database requests are explicitly invalidated instead of misattributed, the performance benchmark sets the flag automatically, and production launches must leave it unset

Settings, portal request/response, and trace payloads must use
`@iptvnator/shared/logging` or the redacting portal logger before reaching
`console.*`; never log raw credentials while debugging.

If the Nx daemon gets into a bad state before rerunning Electron:

```bash
pnpm nx reset
```

Use global `agent-browser` (preferred):

```bash
# Verify CDP targets
agent-browser --cdp 9222 tab list

# Switch to the app tab and inspect interactive elements
agent-browser --cdp 9222 tab 1
agent-browser --cdp 9222 snapshot -i -c -d 4

# Capture debug artifacts
agent-browser --cdp 9222 screenshot /tmp/iptvnator-cdp.png
agent-browser --cdp 9222 trace start /tmp/iptvnator.trace.zip
agent-browser --cdp 9222 wait 1500
agent-browser --cdp 9222 trace stop /tmp/iptvnator.trace.zip
```

If `agent-browser` is not in PATH, use:

```bash
npx --yes agent-browser --cdp 9222 tab list
```

## Repo Skills

- `.codex/skills/iptvnator-nx-architecture/SKILL.md`
- `.codex/skills/iptvnator-sqlite-db-worker/SKILL.md`
- `.codex/skills/iptvnator-theme-style/SKILL.md`
- `.codex/skills/iptvnator-ui-design/SKILL.md`
- `.codex/skills/release-cut/SKILL.md`
- `.codex/skills/release-notes/SKILL.md`
- `.codex/skills/stalker-portal/SKILL.md`
- `.codex/skills/xtream-electron/SKILL.md`

Descriptions and trigger conditions are canonical in each skill's frontmatter;
do not duplicate them here.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first when it is available - it has patterns for querying projects, targets, and dependencies. If it is unavailable, use `pnpm nx show projects`, `pnpm nx graph`, and project `project.json` files directly.
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
