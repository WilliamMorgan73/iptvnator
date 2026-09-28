# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> The process sections below (Plan Mode, Documentation After Changes, Upgrade And Migration Compatibility, Regression Prevention, Agent Bootstrap, Electron CDP Debugging) are mirrored in `AGENTS.md`, which is the canonical copy for agent workflows. When updating one, keep the other in sync.

## Plan Mode

- When Claude Code is in Plan Mode and produces a final `<proposed_plan>`, it must also save that finalized plan as a Markdown file in the repo-root `.plans/` directory.
- Save only finalized plans. Do not write interim exploration, question turns, or draft revisions to `.plans/`.
- Use the filename pattern `YYYY-MM-DD-short-topic.md` such as `.plans/2026-03-12-channel-filtering.md`.
- If the intended filename already exists, append a numeric suffix such as `-2`, `-3`, and so on.

## Documentation After Changes

- After implementing a meaningful change, Claude Code must assess whether canonical repo docs need updates before considering the task complete.
- Meaningful changes include new or changed user-visible behavior, architecture or data-flow changes, non-obvious maintenance workflows, new setup/debugging steps, and new subsystem contracts or boundaries.
- Skip doc updates for trivial refactors with unchanged behavior, formatting-only edits, and isolated test-only changes.
- Prefer updating an existing authoritative doc before creating a new one:
    1. `README.md` for top-level developer or user workflows
    2. `docs/architecture/` for architecture, ownership, and behavior contracts
    3. the nearest module `README.md` for local usage or behavior
- Keep this file (`CLAUDE.md`) itself up to date. It is a living document: whenever a change touches something it describes — monorepo structure (new/moved/renamed apps or libs), routes, database schema/tables, stores and their features, key components, commands, environment behavior, or coding conventions — update the affected `CLAUDE.md` sections as part of the same task, and keep the mirrored process sections in `AGENTS.md` in sync.
- When adding a new feature area, check whether the Architecture or Key Features sections of `CLAUDE.md` describe the surrounding area; if they do, reflect the addition there instead of leaving the description stale.
- Do not let `CLAUDE.md` drift: a stale path or route in this file poisons the context of every future agent session. If you notice an outdated claim while working, fix it (or flag it in the final summary) even if it is unrelated to the current task.
- Repo docs are canonical even when they were originally drafted by an LLM.
- Final task summaries should state whether docs were updated and which doc changed.

## Release Notes For User-Visible Changes

- Any change a user could notice — new behavior, changed behavior, bug fix, performance win, breaking change — must add one note file under `.changes/` in the same PR. Format, field table, and writing rules: `.changes/README.md`.
- Name it `<area>-<short-slug>.md`; `area` matches the conventional-commit scope. There is no version field — the release version is chosen at release time.
- Write the body for a user, not a reviewer: "the player now remembers volume between episodes", not "hoist volume state into the session". Max 400 characters; depth belongs in the release blog post.
- `type: internal` records invisible maintenance. Internal notes stay collapsed in `CHANGELOG.md`, are omitted from the blog scaffold, and are removed from the authored public GitHub body by `extract-changelog-section.mjs --public`; GitHub's generated commit list remains separate, so an internal-only release can have an empty authored body.
- `highlight: <short headline>` (max 60 characters, rejected on `type: internal`) marks a note as one of the release's two or three headline changes. Highlights lead the Telegram/Reddit announcement drafts, open the blog scaffold (a "What changed" table row plus a leading `##` section each, while the remaining features fold into themed sections and non-highlighted fixes collapse under a spoiler — `tools/release/release-notes-blog.mjs`), and are the input the highlight-card generator renders from. A release where everything is a highlight has none.
- Skip the note for test-only changes, docs, CI/workflow plumbing, and pure refactors with no behavior change. When skipping on a PR that touches `apps/**` or `libs/**`, apply the `no-release-note` label.
- CI enforces this: the "Release note gate" job in `.github/workflows/ci.yml` fails PRs that change runtime code without an added `.changes/*.md` or the label (policy in `tools/release/check-release-note-gate.mjs`; tests/e2e/website/mock-server/docs paths are auto-exempt).
- The `release-notes` skill covers writing notes; the `release-cut` skill covers the full release sequence. Canonical contract — surfaces, ordering constraints, the required draft asset set: `docs/architecture/release-pipeline.md`.
- Validate before finishing: `pnpm run release:notes:validate`.
- Announcement drafts and highlight cards are built from the same notes: `pnpm --silent run release:notes:telegram` and `pnpm --silent run release:notes:reddit` print paste-ready posts to stdout (Telegram is guaranteed to fit its 4096-character limit; `--silent` keeps pnpm's lifecycle banner out of a redirected post), and `pnpm run release:cards:generate` renders branded 1200×630 highlight cards plus a release hero into `dist/release-highlight-cards/v<version>/`. All three read `highlight:` metadata that exists only in the note files, so they must run before `build-release-notes.mjs --consume`; the cards additionally need `release:screenshots` to have run. Nothing is posted or copied into the website tree automatically.
- Pushes to `master` and `v*` can publish Docker images. A `v*` tag build creates a draft GitHub release.
- `pnpm run release:verify:draft` waits for that tag build (polling until the run is indexed, then `gh run watch`) and verifies the draft's status, authored body, and complete required asset set. It is read-only and deliberately fails on an already-published release, because it is the gate that runs before publication.
- Publishing the GitHub release verifies its Snap assets and automatically uploads them to `edge`; installed-Snap smoke and candidate/stable promotion remain manual.
- Release-post screenshots come only from the release capture script running against the mock servers. Never add a screenshot taken from a real playlist or account to `apps/website/public/blog/**` — real streams, logos, and metadata are copyrighted, and credentials must never reach a published image. Website guide screenshots use the same script: manifest shots with `"group": "guides"` are captured only by `pnpm release:screenshots --group guides` and land in `apps/website/public/blog/guides/screenshots/`. A manifest shot may carry `browser: {url, viewport}` to frame a loopback page the app serves (the remote-control phone view) in a separate mobile-sized Chromium instead of the Electron window, behind the same network and content guards; the Xtream mock's `marketing`/`marketing2` scenarios serve movie, episode and live stream URLs from local bytes so download and playback shots never leave the machine.
- Final task summaries should state whether a release note was added or why it was skipped.

## AppImage Manager Metadata

AppManager full-download discovery uses `appImage.desktop.entry` URL fields.
Electron Builder generates the version; `extraMetadata.desktopName=iptvnator`
preserves Linux window identity without a shared `linux.desktop.entry` object
(builder's nested merge would leak AppImage fields into Snap). This does not
enable AppImageUpdate/zsync. Contract: `docs/architecture/release-pipeline.md`
(AppImage external-manager metadata).

## Upgrade And Migration Compatibility

- Users may skip releases. The application must apply all required migrations in dependency order when upgrading directly from an older release; never assume that users installed or launched every intermediate version.
- Preserve migration paths for existing persisted data. Do not make deleting a database/profile or reinstalling the application a normal upgrade requirement. Any unavoidable intermediate-version requirement must be an explicitly documented exception.
- Create required tables first, add missing columns before dependent indexes/triggers/queries, and make startup migrations safe to run again. `CREATE TABLE IF NOT EXISTS` does not update an existing table's columns.
- For persistence changes, test real SQLite initialization with representative historical schemas and data, including skipped releases, the previous release, a fresh database, and repeated startup. Assert preservation of user data as well as the resulting schema; SQL mocks alone cannot verify upgrade compatibility. Cover equivalent persisted-state transitions for non-SQLite stores.
- See `libs/shared/database/README.md` for SQLite migration ownership and validation guidance.

## Regression Prevention And Test Updates

- Before the final summary for any feature, behavior change, bug fix, data-flow change, Electron IPC/database change, or user-visible UI workflow change, Claude Code must complete a test impact pass. Identify the affected projects and decide whether unit, integration, E2E, build, lint, or manual/CDP verification is required.
- Bug fixes must normally include regression coverage that fails on the old behavior and passes with the fix. If automated coverage is not practical, document why in the final summary and include the strongest manual validation performed.
- Feature work and behavior changes must update existing tests when assertions, fixtures, mocks, routes, or E2E flows are now stale, incomplete, or missing. Prefer extending the closest existing spec or E2E file before adding a new suite.
- Default validation ladder:
    1. Run targeted unit tests for directly affected projects with `pnpm nx test <project>` or existing scripts such as `pnpm run test:frontend`, `pnpm run test:backend`, or `pnpm run test:unit:ci` when the scope is broader.
    2. Run affected E2E coverage when changing user-visible workflows, routing, persistence, playback, portals, settings, import flows, or Electron-only behavior.
    3. Use `pnpm nx show projects --withTarget test` and `pnpm nx show projects --withTarget e2e` when project ownership or available validation targets are unclear.
    4. Prefer specific atomized E2E targets before broad suites when they cover the changed behavior, for example `pnpm nx run web-e2e:e2e-ci--src/xtream.e2e.ts` or `pnpm nx run electron-backend-e2e:e2e-ci--src/search.e2e.ts`.
- Electron-specific changes affecting IPC, SQLite, packaged runtime, external players, native file access, or Electron-only routes require Electron E2E coverage where available, or CDP/manual verification with `agent-browser` and the tracing flags documented below.
- Final task summaries must list tests added or updated, validation commands run with results, and any skipped validation with the reason. For docs-only changes, state that unit/E2E validation was not required and verify the changed Markdown instead.

## Project Overview

IPTVnator is a cross-platform IPTV player application built with Angular and Electron, supporting M3U/M3U8 playlists, Xtream Codes API, and Stalker portals.

**Dual Environment Support**: The application is designed to work in both Electron and as a Progressive Web App (PWA). The architecture uses a factory pattern to inject environment-specific services at runtime, ensuring the same codebase works in both contexts.

## Development Commands

### Agent Bootstrap

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
- ESLint enforces `max-lines` on TypeScript files: production code targets under 300 with a hard maximum of 400, while tests (`**/*.spec.ts`, `**/*.spec-data.ts`, `**/*.e2e.ts`, `apps/*-e2e/**`) are held to 1200 — a long spec signals coverage, not the design debt the production limit catches. Blank lines and comments are not counted, so a docblock never forces a split. Limits live in `tools/eslint/max-lines-config.mjs`, imported by both `eslint.config.mjs` and the generator so the rule and the baseline cannot drift. Files that predate the rule are baselined in `tools/eslint/max-lines-baseline.mjs`; after splitting a file, regenerate it with `node tools/eslint/generate-max-lines-baseline.mjs` (it runs ESLint's own rule rather than counting lines itself). Never add new files to the baseline — the list must only shrink. A new file that genuinely cannot be split (for example a function serialized into another process) instead carries its own file-wide `/* eslint-disable max-lines -- <why> */`; the generator skips those files, so a justified exemption never lands in the baseline. Remove such a directive once ESLint reports it as unused. Full rationale: "Linting" below.
- Project `lint` targets that shell out to eslint must quote the glob, e.g. `eslint "apps/<project>/**/*.ts"`. An unquoted `**` is expanded by the POSIX shell on Linux and macOS (which has no `globstar`, so it matches only a shallow subset of files) while Windows passes the literal pattern to ESLint, which expands it recursively — the two hosts then lint different file sets. The target still reports success either way, so a broken glob hides missing coverage instead of failing. After changing such a target, compare the linted file count against `find <project> -name '*.ts' | wc -l`.
- Repository-specific skills live under `.codex/skills/`.
- Frontmatter descriptions are trigger-only and begin with `Use when`; keep
  each skill at or below 500 words.
- Run `pnpm run skills:validate` after editing a committed skill or a literal
  path it documents.
- Keep `.codex` and `.claude` copies of `release-notes` and `release-cut`
  byte-identical.

### Building and Serving

```bash
# Serve the Angular web app only (development mode, baseHref="/")
pnpm run serve:frontend
# or
nx serve web

# Serve with PWA configuration (optimized, baseHref="/")
pnpm run serve:frontend:pwa
# or
nx serve web --configuration=pwa

# Serve the Electron app (starts both frontend and backend)
pnpm run serve:backend
# or
nx serve electron-backend

# Build frontend for Electron (baseHref="./")
pnpm run build:frontend
# or
nx build web

# Build frontend for PWA deployment (baseHref="/")
pnpm run build:frontend:pwa
# or
nx build web --configuration=pwa

# Build backend (Electron)
pnpm run build:backend
# or
nx build electron-backend

# Package the app (creates distributable without installers)
pnpm run package:app
# or
nx run electron-backend:package

# Create installers/executables
pnpm run make:app
# or
nx run electron-backend:make
```

### Windows Embedded MPV Pin Maintenance

- PR, master, and tag builds resolve the Windows runtime only from
  `tools/embedded-mpv/windows-runtime-pin.json`; repository variables are not
  build inputs.
- Validate the checked-in schema and provenance with
  `pnpm embedded-mpv:windows-runtime-pin:check`.
- Prepare a manual rotation with
  `pnpm embedded-mpv:windows-runtime-pin:refresh -- --force`. The weekly
  `refresh-windows-embedded-mpv-runtime.yaml` workflow runs the same updater
  and opens a reviewable PR before upstream retention expires.
- The PAT-backed refresh job must keep every third-party action pinned to a
  full commit. Do not mirror the upstream binary without complete
  corresponding source, build records, license notices, and a validated
  transitive license closure.

### Electron CDP Debugging

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

### Testing

```bash
# Run frontend tests
pnpm run test:frontend
# or
pnpm nx test web

# Run backend tests
pnpm run test:backend
# or
pnpm nx test electron-backend

# Run targeted E2E tests (Playwright)
pnpm nx run web-e2e:e2e-ci--src/xtream.e2e.ts
pnpm nx run electron-backend-e2e:e2e-ci--src/search.e2e.ts

# Run broad E2E suites only when the impact justifies it
pnpm nx e2e web-e2e
pnpm nx e2e electron-backend-e2e

# Run tests with coverage when needed
pnpm nx test web --configuration=ci
```

Before finishing behavior changes or bug fixes, follow `Regression Prevention And Test Updates` above and report the test impact decision in the final summary.

### Linting

```bash
# Lint all projects (CI runs this on master; PRs lint affected projects)
pnpm run lint

# Lint a single project
nx lint web
nx lint electron-backend
```

CI lints affected projects on PRs (`nx affected`) and every project on master
pushes (`.github/workflows/ci.yml`). This enforces the
Nx module-boundary tags, the legacy bare-alias ban, and a `max-lines` ESLint
rule. The limits and their rationale live in one place,
`tools/eslint/max-lines-config.mjs`, which both `eslint.config.mjs` and the
baseline generator import so the enforced rule and the generated list cannot
drift:

- **Production TypeScript: hard maximum 400 lines.**
- **Tests: 1200.** `**/*.spec.ts`, `**/*.spec-data.ts`, `**/*.e2e.ts` and
  everything under `apps/*-e2e/**` — a spec is a flat list of independent
  cases, so splitting one at the production limit yields arbitrary
  `-2.spec.ts` files, and length there signals coverage rather than the
  design debt the production limit catches. `.spec-data.ts` fixtures (flat
  case lists consumed only by a spec, e.g. the worker IPC contract table)
  grow with coverage the same way.
- **Blank lines and comments are not counted** (`skipBlankLines`,
  `skipComments`), so a docblock is never the reason a file must be split.

Pre-existing oversized files are baselined in
`tools/eslint/max-lines-baseline.mjs`; regenerate the baseline with
`node tools/eslint/generate-max-lines-baseline.mjs` after splitting a file. The
generator decides who belongs on the list by running ESLint's own `max-lines`
rule, not by counting lines itself — a private reimplementation would silently
disagree with the rule and produce a baseline that turns CI red while looking
correct. Never add new files to the baseline — the list must only shrink. A new
file that genuinely cannot be split (for example a function serialized into
another process) instead carries its own file-wide
`/* eslint-disable max-lines -- <why> */`; the generator skips those files, so
a justified exemption never lands in the baseline. If such a directive later
becomes unnecessary, ESLint reports it as an unused disable directive — remove
it rather than leaving a stale justification behind.

Project `lint` targets that shell out to eslint must quote the glob, e.g.
`eslint "apps/<project>/**/*.ts"`. An unquoted `**` is expanded by the POSIX
shell on Linux and macOS (which has no `globstar`, so it matches only a
shallow subset of files) while Windows passes the literal pattern to ESLint,
which expands it recursively — the two hosts then lint different file sets.
The target still reports success either way, so a broken glob hides missing
coverage instead of failing. After changing such a target, compare the linted
file count against `find <project> -name '*.ts' | wc -l`.

## Legacy Desktop Profile Migration

`electron-profile-bootstrap.ts` selects the known v0.19 `electron-backend`
profile before eager main-process imports only when current Chromium storage
is unused. Existing profiles retain their settings and offer explicit recovery
of missing sources from a disposable legacy snapshot. Playlist rows and a
completion receipt commit atomically in the DB worker; original IndexedDB is
retained, current payload rows are preserved, and completed imports never
replay deleted sources. Contract and recovery limits:
`docs/architecture/m3u-playlist-module.md` (Desktop upgrades from legacy profiles).

Startup shows `AppStartupStatusComponent` until the initial route and source
inventory are ready, including XMLTV reconciliation. Inventory reads retry once;
failed reads show an explicit Retry action instead of an empty library. Successful
inventory reads first await settings loading, then pending XMLTV reconciliation,
and retry failed cleanup
with its last committed URLs before exposing the workspace. See the
same contract for startup readiness and error handling.

## Architecture

### Monorepo Structure (Nx Workspace)

This is an Nx monorepo with the following structure:

- **apps/web** - Angular application (frontend, shared by Electron and PWA)
- **apps/electron-backend** - Electron main process
- **apps/web-backend** - HTTP backend for the self-hosted PWA (`/parse`, `/parse-xml`, `/xtream`, `/stalker` CORS proxy endpoints). At startup it raises Node's happy-eyeballs per-attempt connection timeout to 2500 ms (`applyDefaultAutoSelectFamilyAttemptTimeout` in `libs/shared/host-health`; the Electron main process and its playlist-refresh and EPG workers apply the same default through `apps/electron-backend/src/app/util/network-defaults.ts`, since Node keeps it per isolate) so dual-stack provider hostnames fall back to IPv4 behind IPv6-less VPN/Docker networks; an explicit `--network-family-autoselection-attempt-timeout` passed via `NODE_OPTIONS`/CLI always wins. Outbound provider failures are logged hostname-only with the underlying Node error codes and return the primary code in the error body (`provider-error.ts`) — the proxied URL query carries credentials and must never be logged. Every proxied request carries the same timeout as its Electron counterpart (Xtream 30 s, Stalker 15 s / 30 s for `create_link`, playlist and XMLTV 30 s). The shared per-host circuit breaker (`host-guard.ts`, injected via `WebBackendAppOptions.hostGuard`) covers `/xtream` and `/stalker` only — playlist/XMLTV downloads keep the timeout but no breaker, matching Electron. A fast-fail keeps the route's normal failure shape (HTTP 200 with a `{message, status}` body), `skipConnectionGuard=true` carries the Stalker discovery exemption through the proxy, and `POST /connectivity-guard/reset` is the PWA's counterpart to the `CONNECTIVITY_GUARD_RESET` IPC
- **apps/remote-control-web** - Mobile remote-control web app served by the Electron backend
- **apps/tv** - Controller-first (gamepad/D-pad) Angular app, live TV only for v1, sharing the existing data-access layer (XtreamStore, StalkerStore, `libs/m3u-state`) with an entirely new presentation layer (`libs/tv/*`); reachable in Electron via `Settings.tvMode` (Settings > General, default off, Electron only — same launch-time renderer-selection pattern as `Settings.startupWindowMode`: mirrored into the main-process config by `SETTINGS_UPDATE` and read by `getRendererAppName()`/`getRendererAppPort()` in `apps/electron-backend/src/app/constants.ts` before any renderer exists, so it applies on the next launch). Sources can be switched (source panel, Tab/Back-Select) and added entirely with a remote/gamepad: the `/add-source` route (`TvAddSourceScreenComponent`) supports Xtream, Stalker, and M3U-by-URL, with a custom on-screen keyboard (`TvOnscreenKeyboardComponent`, a 10×5 D-pad-navigable key grid) for every text field — tv mode has no physical keyboard to rely on. `Settings.tvLastPlaylistId` remembers the active source across launches. `Settings.showCaptions` (shared with desktop) toggles the first embedded HLS subtitle track on/off via `TvVideoEngine.setCaptionsEnabled()` — no track picker, no external files, applied live without reloading the stream. Numeric channel entry (`TvDigitEntryController` in `libs/tv/shell/feature`) lets a keyboard type a channel number to jump straight to it, searching the whole active source across every category (`TvLiveSourceAdapter.channelsAcrossCategories()`, an optional method each adapter implements — Xtream reads the store's already-loaded unfiltered `liveStreams()`, Stalker reads `StalkerItvCacheService`'s background-loaded full-portal cache, falling back to the current category until that finishes, M3U is unfiltered by construction) and matching against the real provider `channelNumber` (Xtream/Stalker) or, for M3U (which never has one), 1-based list position via the shared `getChannelItemByNumber()`. No gamepad equivalent in v1 (most gamepads have no digit buttons). A Recently Viewed panel (gamepad X, keyboard `KeyV`, same open/close-toggle shape as the source-switcher via the shared `TvListPaneController`) lists channels actually confirmed into playback (never a preview) for the active source — each adapter's optional `recordRecentlyViewed()`/`recentChannels()` reuse that source's existing recently-viewed storage (Xtream's `XtreamStore.addRecentItem()`/`recentItems`, Stalker and M3U the shared `playlists.recently_viewed` blob column via `PlaylistsService`), and selecting an entry reuses the same cross-category activation path numeric entry uses. Live recording (gamepad RT/R2, keyboard `KeyR`) records the active channel independently of Embedded MPV — `TvRecordingService` (`apps/electron-backend`) pipes a validated-redirect HTTP GET straight to a `.ts` file, refusing HLS/DASH URLs up front (MPEG-TS only in v1), and writes into the same `recordings` table Embedded MPV's own recorder uses via a `tv:`-prefixed synthetic `sessionId` `RECORDINGS_STOP` dispatches on; the Recordings pane (gamepad left-stick click, keyboard `KeyL`) is play-only, no delete affordance from a remote. Contract: `docs/architecture/tv-recording.md`. A full-screen programme guide (gamepad LT/L2, keyboard `KeyG`) shows the currently selected category's channels — not the whole source — in a channel×time grid (`TvEpgGuideGridComponent`/`TvEpgGuideRowComponent` in `libs/tv/ui`), taking over the whole panel edge to edge via the shell's `tv-live-screen__panel--guide` modifier (the same full-bleed treatment grid browse mode's `--grid` modifier uses, needed for the timeline to have real width), driven by a per-source `TvEpgGuideAdapter` returned from `TvLiveCatalogFacade.epgGuideAdapter()`. The adapter itself still returns the whole cross-category list; `TvEpgGuideController.open()` narrows it to the category selected when Guide was pressed, in that category's own order (`categoryChannelIds`, surfaced in the header as "Guide · <category name>" — `TvEpgGuideGridComponent`'s `categoryName` input), since the category doesn't change while the guide stays open (PageUp/PageDown steps the day, not the category — see below) — closing and reopening on a different category re-reads it. Xtream and M3U both read XMLTV data via `EpgRuntimeBridgeService` (Xtream only for channels with an XMLTV mapping; M3U's adapter is a small tv-owned duplicate of the desktop M3U guide source rather than a shared lib — rationale in `docs/architecture/nx-workspace-boundaries.md`), Stalker reads its own bulk 7-day `get_epg_info` cache. Day-stepping while the guide is open reuses the gamepad LB/RB `categoryStep` gesture (keyboard PageUp/PageDown); 2D grid focus (`TvEpgGuideFocusController` in `libs/tv/util`) is tv-mode's own, deliberately not desktop's dialog/mouse-coupled `EpgGuideKeyboardController`. Leaving the guide (second Guide press or Escape/Back) carries the row it was left on back into the channel list's own focus (`TvLiveScreenComponent.closeGuideWithContinuity()`, reading `TvEpgGuideController.focusedChannel()` before `close()` resets guide focus, then setting `TvLivePanesController.channelsController.focusedIndex` to that channel's position in `channels()`) — since the guide only ever shows the open category, the channel is always present there, no cross-category lookup needed. See `.plans/2026-09-20-tv-controller-app.md` for the full plan and milestone status, and `.plans/2026-09-26-tv-mode-five-features.md` for the follow-up feature set (subtitles, recently viewed, EPG guide, numeric channel entry, live recording)
- **apps/web-e2e** - Playwright E2E tests against the web app
- **apps/electron-backend-e2e** - Playwright E2E tests against the Electron app
- **apps/stalker-mock-server** - Mock Stalker/Ministra portal for dev and E2E
- **apps/xtream-mock-server** - Mock Xtream Codes API for dev and E2E
- **apps/website** - Astro + Tailwind landing page, blog (guides carry `faq:` frontmatter → FAQPage JSON-LD and open with `src/components/blog/ContentDisclaimer.astro`, whose `offline` variant is mandatory for posts about downloads or recordings; tags are a closed vocabulary in `src/lib/blog-tags.ts` enforced by the collection schema, each with a `/blog/tag/<tag>/` hub), per-OS download landing pages (`/download/`, `/download/{windows,macos,linux}/`) plus the Docker page (`/download/docker/`) feature landing pages (`/features/`, registry in `src/lib/features.ts`) and comparison pages (`/compare/`, registry in `src/lib/comparisons.ts`; most compare IPTVnator's own options, and a page that names other software must carry a dated `ThirdPartyNote` — see "Pages that name other software" in `apps/website/README.md`); direct asset links are resolved at build time from the GitHub Releases API with a `package.json` fallback (`src/lib/downloads.ts`, see `apps/website/README.md`)
- **libs/** - Shared libraries:
    - **epg/data-access** - EPG services, runtime bridge, program normalization
    - **m3u-state** - NgRx state management for M3U playlists
    - **playlist/import/feature** - Playlist import flows (file/URL/text upload, Xtream and Stalker import dialogs, and the "Auto-detect" method: paste a provider message, `detectProviderImportCandidates` in `libs/shared/interfaces` deterministically extracts URLs/credentials/MAC+device identity and prefills the matching form — detection only proposes, the target form's own validation and behavioral probes stay authoritative)
    - **playlist/m3u/feature-player** - M3U video player page and `/workspace/playlists/:id` routes
    - **playlist/shared/{ui,util}** - Shared playlist UI and utilities
    - **portal/xtream/{data-access,feature}** - XtreamStore, services, data sources; routed Xtream components
    - **portal/stalker/{data-access,feature}** - StalkerStore and routed Stalker components
    - **portal/catalog/feature** - Portal catalog UI
    - **portal/downloads/feature** - Download manager UI
    - **portal/shared/{data-access,ui,util}** - Cross-portal shared code: stateful collection services and VOD multi-source discovery/resolve/ranking live in `data-access`; reusable views live in `ui`; `util` is for pure contracts/helpers
    - **services** - Abstract DataService contract and shared app services (incl. the TMDB metadata enrichment module in `lib/tmdb/`)
    - **shared/interfaces** - TypeScript interfaces and types (incl. `ElectronBridgeApi`)
    - **shared/logging** - Dependency-free structured redaction for diagnostic logs
    - **shared/host-health** - Per-host circuit breaker for portal requests (`HostConnectivityGuard`), shared by the Electron main process and the web backend; transport-free, the owning app supplies the clock and owns the instance. Also home to the two Node networking helpers both backends share: the happy-eyeballs attempt-timeout default (`network-family-autoselection.ts`) and the socket-connect observer that feeds the guard's `connected` flag (`socket-connect-observer.ts`). Monotonic admission ids with per-endpoint failure boundaries distinguish parallel failures from later attempts even within one clock tick (#1438)
    - **shared/database** - Canonical Drizzle schema and DB connection (used by the Electron backend)
    - **shared/m3u-utils** - M3U playlist utilities
    - **shared/marketing-fixtures** - Provider-neutral fictional movie metadata, live channel list and the generated channel-logo SVG renderer shared by the Xtream and Stalker marketing mocks (both serve `/assets/marketing/logo/<slug>.svg`)
    - **shared/testing** - Shared test helpers
    - **tv/{shell/feature,ui,data-access,util}** - `apps/tv`'s presentation layer: `shell/feature` owns two screens: the Live screen (router root) driven identically by keyboard and gamepad input, over real categories/channels from `TvLiveCatalogFacade`, with real playback via a `TvPlaybackController` bound to a `<video>` element (preview-swap-on-focus, immersive-mode Up/Down=volume, Enter=play/pause, Left=reveal panel), and the `/add-source` route (`TvAddSourceScreenComponent` + `TvAddSourceController`, the same DI-free "controller owns state, component only renders" split as `TvLivePanesController`) — a tabs/fields/on-screen-keyboard flow for adding an Xtream, Stalker, or M3U-by-URL source; `TvLivePanesController` also owns a `TvDigitEntryController` sibling (`tv-digit-entry.controller.ts`, numeric channel entry) and shares its "vertical list you open/close" pane shape (sources, Recently Viewed, Recordings) through `TvListPaneController` rather than hand-rolling that toggle logic per pane; the shell instantiates a `TvEpgGuideController` (`libs/tv/ui`) directly rather than folding its state onto `TvLivePanesController` — the 'guide' pane itself is just an open/close toggle there (`onToggleGuide()`), with the guide's own channel list/day window/2D focus living entirely on that separate controller, and `onDirection()`/`onActivate()`/`onCategoryStep()` delegating to it (`onGuideDirection()`/`onGuideActivate()`/`onGuideStepDay()`) while the pane is active; `ui` holds pure presentational components (category pills, channel list row, `TvRecentPanelComponent`, `TvRecordingsPanelComponent`, `TvRecordingIndicatorComponent` (persistent, unlike the HUD), `TvDigitEntryOverlayComponent`, `TvEpgGuideGridComponent`/`TvEpgGuideRowComponent` (the programme guide's channel×time grid, percentage-positioned via `computeEpgGuideBlockLayout()`), `TvPlaybackHudComponent` — a transient volume/play-pause pill, not a persistent transport bar, `TvOnscreenKeyboardComponent` — a 50-key rectangular grid, `TvAddSourceFieldRowComponent`, `TvAddSourceStatusComponent`) and `TvKeyboardInputDirective` (arrows/Enter/Escape/PageUp/PageDown) with no Xtream/Stalker/M3U knowledge, plus the playback layer itself: `TvVideoEngine` (minimal hls.js/mpegts.js/native-`<video>` wrapper, deliberately not `HtmlVideoPlayerComponent`/`PlayerController` — those own external-subtitle files, subtitle delay/style customization, DRM, and quality-menus tv mode's UI has no room for; `TvVideoEngine` only goes as far as toggling the first embedded HLS WebVTT track on/off via `setCaptionsEnabled()`) `TvPlaybackController` (DI-free orchestration of debounced preview + HUD timing, reusing `ElectronStreamHeadersService` for header injection; also `loadRecording()`/`playRecording()` for a finished recording's local file, always `isLive: false` unlike a live channel), `TvRecordingController` (DI-free record on/off toggle, wired to the existing `RecordingsService` in `libs/services`, which also gained `startTvRecording()` — the one new method on an otherwise fully shared recordings surface), and `TvEpgGuideController` (DI-free day-window/fetch/2D-focus orchestration for the guide, reusing `getTodayEpgDateKey()`/`shiftEpgDateKey()`/`parseEpgDateKey()` from `@iptvnator/ui/epg` — pure date-key helpers, the one piece of desktop's guide worth sharing — over a stale-response-guarded `TvEpgGuideAdapter.loadPrograms()` call); `data-access` holds `GamepadInputService` (polls `navigator.getGamepads()`, standard mapping plus LB/RB category-flip), the three `TvLiveSourceAdapter` implementations (thin wrappers over `XtreamStore`/`StalkerStore`/`libs/m3u-state`, no changes to those stores; each also implements the interface's optional `channelsAcrossCategories()`/`recordRecentlyViewed()`/`recentChannels()`), `TvLiveCatalogFacade` (source-switching panel + `Settings.tvLastPlaylistId` "remember last source" — every successful activation persists its own id, so `initialize()` prefers it over `playlists[0]`; `addedNewSource(id)` refetches and activates a source that didn't exist yet at `initialize()` time, for the Add Source flow), `TvAddSourceService` (builds and persists a `Playlist` for any of the three source types — Xtream via `normalizeXtreamServerUrl`, Stalker via the shared `addStalkerSource()` also used by desktop's import dialog, M3U via `PLAYLIST_PARSE_BY_URL`), the three `TvEpgGuideAdapter` implementations in `epg-guide-adapters/` (Xtream and M3U both read XMLTV data via `EpgRuntimeBridgeService.getProgramsForChannels()`/`getProgramCoverage()` — Xtream only for channels with an XMLTV mapping, M3U's own small tv-owned duplicate of the desktop M3U guide source rather than a shared lib, since `libs/tv/data-access` is `type:data-access` and cannot depend on the `type:feature` project that owns it — rationale in `docs/architecture/nx-workspace-boundaries.md`; Stalker instead reads `StalkerStore.bulkItvEpgByChannel()`/`ensureBulkItvEpg()`, its own already-public bulk 7-day cache, no XMLTV IPC involved), selected by `TvLiveCatalogFacade.epgGuideAdapter()` the same way the live-source adapter is, and `provideTvDataAccess()`/`TvElectronDataService`/`TvBrowserFallbackDataService` (the DI wiring those stores need to construct, deliberately lean — not `ElectronService`, which pulls in MPV/VLC launch and auto-update-playlists machinery tv mode's UI cannot trigger); `util` holds `GridFocusController` (grid-capable roving focus — used by the channel grid, and by `TvAddSourceController` for its tabs/fields/on-screen-keyboard navigation), `TvEpgGuideFocusController` (a separate, deliberately NOT-`GridFocusController` 2D roving focus for the guide grid — each channel row has its own ragged programme-block count, unlike the channel grid's uniform columns; vertical movement resets to whole-row focus), the `TvEpgGuideAdapter`/`TvEpgGuideChannel`/`TvEpgGuideWindow` contracts and `computeEpgGuideBlockLayout()`/`computeEpgGuideNowPercent()` (pure percentage-position math for the guide's timeline blocks/now-line), the gamepad button/axis mapping and hold-repeat trackers, `TvLiveSourceAdapter`/`resolveTvLiveSourceKind`, the unified `TvLiveCategory`/`TvLiveChannel` shapes, and the Add Source screen's pure helpers (`TV_KEYBOARD_LAYOUT`/`resolveTvKeyboardChar` for the on-screen keyboard, `resolveTvAddSourceFields` for the per-type field set)
    - **ui/components** - Reusable UI components (incl. channel list)
    - **ui/epg** - EPG UI (timeline ribbon, programme guide grid via `EPG_GUIDE_SOURCE`, progress panel, program dialogs)
    - **ui/playback** - Player UI (video/audio players)
    - **ui/pipes** - Angular pipes
    - **ui/remote-control** - Remote-control UI pieces
    - **ui/shared-portals** - Shared portal types (`LiveEpgPanelSummary`)
    - **ui/styles** - Shared styles/theme
    - **workspace/{shell,dashboard}** - Workspace shell (layout/navigation) and dashboard

### Frontend Architecture (Angular)

**State Management**: Uses NgRx for playlist state management:

- Store configuration in `apps/web/src/app/app.config.ts`
- Playlist state, actions, effects, and reducers in `libs/m3u-state/`
- Entity adapter pattern for managing playlists collection
- Router store integration for route-based state

**XtreamStore Architecture** (Signal Store with Feature Composition):

The Xtream Codes module uses NgRx Signal Store with a layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│              Components use XtreamStore (facade)                 │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FACADE LAYER                             │
│                         XtreamStore                              │
│            (Composes feature stores, unified API)                │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ withPortal · withContent · withSelection · withSearch · withEpg │
│ withPlayer · withFavorites · withRecentItems                     │
│ withPlaybackPositions                                           │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA SOURCE LAYER                             │
│                   IXtreamDataSource                              │
│         ┌───────────────────┬───────────────────┐               │
│         ▼                   ▼                                    │
│  ElectronDataSource    PwaDataSource                            │
│  (DB-first + API)      (API-only)                               │
└─────────────────────────────────────────────────────────────────┘
```

File structure:

```
libs/portal/xtream/
├── data-access/src/lib/
│   ├── stores/
│   │   ├── features/
│   │   │   ├── with-portal.feature.ts             # Playlist & portal status
│   │   │   ├── with-content.feature.ts            # Categories & streams
│   │   │   ├── with-selection.feature.ts          # UI selection & infinite-scroll window
│   │   │   ├── with-search.feature.ts             # Search functionality
│   │   │   ├── with-epg.feature.ts                # EPG data
│   │   │   ├── with-player.feature.ts             # Stream URLs & player
│   │   │   ├── with-playback-positions.feature.ts # Resume/playback positions
│   │   │   └── index.ts
│   │   ├── xtream.store.ts                        # Facade composing all features
│   │   └── index.ts
│   ├── services/
│   │   ├── xtream-api.service.ts                  # Xtream Codes API calls
│   │   ├── xtream-url.service.ts                  # Stream URL construction
│   │   ├── favorites.service.ts                   # Favorites persistence
│   │   ├── epg-queue.service.ts                   # EPG fetch queueing
│   │   ├── xtream-xmltv-fallback.service.ts       # XMLTV fallback EPG
│   │   └── index.ts
│   ├── data-sources/
│   │   ├── xtream-data-source.interface.ts        # Abstract interface + types
│   │   ├── electron-xtream-data-source.ts         # DB-first implementation
│   │   ├── pwa-xtream-data-source.ts              # API-only implementation
│   │   └── index.ts                               # provideXtreamDataSource() factory
│   ├── with-favorites.feature.ts                  # Favorites feature
│   └── with-recent-items.ts                       # Recently viewed feature
└── feature/src/lib/                               # Routed components
    ├── xtream-feature.routes.ts                   # createXtreamRoutes(): /workspace/xtreams/:id tree
    ├── live-stream-layout/, vod-details/, serial-details/, ...
    └── global-search-results/                     # Global search (Electron-only route)
```

Key patterns:

- **Feature stores**: Each `with*.feature.ts` uses `signalStoreFeature()` for focused functionality
- **Facade pattern**: `XtreamStore` composes all features, maintaining backward compatibility
- **Data source abstraction**: `IXtreamDataSource` has SQLite-backed and
  API/in-memory implementations
- **Factory injection**: `provideXtreamDataSource()` selects
  `ElectronXtreamDataSource` only when
  `RuntimeCapabilitiesService.supportsXtreamSqliteDataSource`; otherwise it
  selects `PwaXtreamDataSource`
- **Catalog lazy loading**: catalog grids scroll infinitely instead of paging.
  `withSelection` keeps a `visibleCount` render window over the in-memory
  catalog plus bounded per-selection scroll snapshots for detail/tab
  round-trips; the shared `InfiniteScrollDirective`
  (`libs/portal/shared/ui`) measures container overflow to auto-fill tall
  viewports (terminating on lack of container growth, not on a load count)
  and fires `loadMore` near the bottom. The search layout routes its results
  container through the same directive (`nearEnd*` inputs). Stalker feeds the
  same contract from server-paged appends: portal pages accumulate into one
  deduplicated list, `hasMoreContent` derives from accumulated length vs
  `total_items`, a failed append keeps loaded pages and offers a tail retry,
  and the facade maps page 0 to the skeleton and later pages to the tail
  spinner. No paginator remains anywhere in the app

Xtream data strategies by runtime capability:

| Capability                        | Strategy                                                 |
| --------------------------------- | -------------------------------------------------------- |
| **Complete Xtream SQLite bridge** | DB-first: check DB → fetch API if missing → cache to DB  |
| **Bridge unavailable**            | API-only: fetch from API and keep session data in memory |

**M3U Playlist Module Architecture**:

The M3U playlist module handles traditional M3U/M3U8 playlists with support for 90,000+ channels.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VIDEO PLAYER PAGE                            │
│        libs/playlist/m3u/feature-player/src/lib/video-player/       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌───────────────────────────────────────────────┐│
│  │   Sidebar   │  │        Video Player (ArtPlayer/Video.js)      ││
│  │ ┌─────────┐ │  │                                               ││
│  │ │Channel  │ │  ├───────────────────────────────────────────────┤│
│  │ │List     │ │  │  EPG timeline ribbon (app-epg-timeline)       ││
│  │ │Container│ │  │  horizontal, under the player                 ││
│  │ └─────────┘ │  └───────────────────────────────────────────────┘│
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

The live EPG panel is a horizontal **timeline ribbon** under the player (`app-epg-timeline`, `libs/ui/epg/src/lib/epg-timeline/`), not a right-side drawer (reworked in PR #1102). See `docs/architecture/m3u-playlist-module.md` for the timeline's controllers and scroll behavior.

**Collapsible live channel rail** (M3U player, Xtream/Stalker live layouts, unified favorites/recent live tab): collapse state is owned by `LiveLayoutSidebarStateService` (`@iptvnator/portal/shared/util`) and kept per surface (`m3u` / `portal` / `collection`, localStorage `live-sidebar-state:<surface>`); the pre-split shared key `live-sidebar-state` is forgotten on startup and never read (issue #1458: one stored `collapsed` hid every channel list in the app behind a 32px chevron and survived restart, "Remove all playlists" and re-import). The workspace header renders a `view_sidebar` toggle on every route that renders its own rail (`resolveRouteLiveSidebarSurface`) so the control exists in both states, and a collapsed rail with nothing playing shows `app-channel-list-hidden-state` (title + hint + "Show channels list" button) instead of "select a channel". Contract: "Collapsible Live Sidebar" in `docs/architecture/iptvnator-ui-guidelines.md`.

**Cover grids** (Xtream/Stalker VOD + series catalogs, favorites/recent, dashboard rails): sized by `Settings.coverSize` (small/medium/large → `--cover-grid-min-width`/`--cover-rail-width`/`--cover-gap`, plus `--season-cover-width` 96/120/144px for the season cover on series detail pages, written to `<html data-cover-size>` in `app.component.ts`, tokens in `apps/web/src/_cover-size.scss`). `Settings.showCoverTitles` (Settings → General, default on; only an explicit `false` opts out, coerced with the other default-on flags in `libs/services/src/lib/settings-opt-out.util.ts`) turns VOD/series grids into a posters-only wall: the title row is dropped and a `.cover-title-overlay` caption slides in on hover/`:focus-visible`, pinned open when the cover is missing or failed. `CoverTitlesService` (`libs/portal/shared/ui`) is the single resolver — opt-out AND a `(any-hover: hover)` pointer, so touch-only devices keep titles. Live channel grids, search results (search pages pass `[allowPostersOnly]="false"` to `app-content-card`; `app-grid-list` and `app-unified-grid-tab` keep titles while their `searchTerm` is non-blank), "recently added" rails and dashboard rails always keep their labels. Catalog and collection cards are keyboard buttons (`role="button"`, Enter/Space, focus ring). Contract: "Cover Grids" in `docs/architecture/iptvnator-ui-guidelines.md`.

**Radio Channel Layout** (when `channel.radio === 'true'`):

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────┐  ┌────────────────────────────────────────────────┐│
│  │   Sidebar   │  │  Blurred backdrop (station logo)              ││
│  │             │  │  ┌──────────┐                                 ││
│  │             │  │  │ Artwork  │  ← cinematic hero layout        ││
│  │             │  │  └──────────┘                                 ││
│  │             │  │  Station Name                                 ││
│  │             │  │  [LIVE] badge                                 ││
│  │             │  │  ⏮  ▶/⏸  ⏭   ← transport controls          ││
│  │             │  │  🔊 ━━━━━━━━━  ← volume slider               ││
│  │             │  │  (no EPG panel)                               ││
│  └─────────────┘  └────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

Key radio behavior:

- Detection: `channel.radio === 'true'` (string from M3U `radio` attribute)
- The audio player always renders inline — `shouldShowInlinePlayer` is bypassed for radio
- EPG panel is conditionally hidden in the template when radio is active
- Volume is shared with video player via `localStorage` key `'volume'`
- Keyboard: ArrowUp/Down adjusts volume by 5%, M toggles mute
- Component: `libs/ui/playback/src/lib/audio-player/audio-player.component.ts`

**M3U Movie Recognition** (VOD detail instead of the EPG zone): an M3U entry
recognized as a movie FILE swaps the player + EPG area for the portals'
two-state VOD detail shell fed by TMDB, watch-first (activation still plays
immediately; Esc reveals the Browse hero). Detection is synchronous URL-shape
heuristics — movie container extension (`mkv`/`mp4`/…, never `ts`/`m3u8`/`mpd`)
or an Xtream-style `/movie|movies|vod/` path segment; radio, DASH, `/series/`
paths and episode-marker names (`S01E02`, "2 серия") fail toward the live
layout (`isLikelyM3uMovie` in `libs/shared/m3u-utils`). Gated on TMDB
enrichment being enabled AND `Settings.m3uVodDetails` (default on; checkbox in
Settings → Metadata (TMDB)). Host: `m3u-vod-detail/` in
`libs/playlist/m3u/feature-player` (shell + `PortalInlinePlayerComponent`,
parent's unchanged `embeddedPlayback()` payload); external MPV/VLC users
keep Browse. See "Movie Recognition (VOD Detail View)" in
`docs/architecture/m3u-playlist-module.md`.

M3U playback mode is independent of this metadata gate: `isLikelyM3uVod`
recognizes video-file extensions and exact `/movie|movies|vod|series/` URL
segments, including episodes. The M3U parent's `embeddedPlayback()` sets
`isLive: false` for those entries or a catch-up URL, even with TMDB/details
disabled; the detail host forwards that same payload. Ordinary HLS/TS and
unknown URLs without VOD evidence, DASH and radio retain their existing
behavior. Seeking requires a seekable source and duration. Xtream/Stalker,
external MPV/VLC launch payloads and session identity are unchanged. Contract:
`docs/architecture/m3u-playlist-module.md` (M3U Playback Mode).

Channel List Component Structure (parent coordinator pattern):

```
libs/ui/components/src/lib/channel-list-container/
├── channel-list-container.component.ts   # Parent - shared state coordinator
├── all-channels-view/                     # Virtual scroll + debounced search
├── groups-view/                           # Expansion panels + infinite scroll
├── favorites-view/                        # CDK drag-drop reordering
├── recent-view/                           # Recently viewed channels
└── channel-list-item/                     # Individual channel display
```

Key patterns:

- **EnrichedChannel**: Pre-computed EPG data attached to channels for performance
- **Parent coordinator**: Manages shared signals (`channelEpgMap`, `progressTick`, `favoriteIds`)
- **Virtual scrolling**: CDK virtual scroll for 90,000+ channel lists
- **Infinite scroll**: IntersectionObserver in groups view loads 50 items at a time
- **Global progress tick**: Single 30s interval instead of per-item intervals

State management via NgRx (`libs/m3u-state/`):

- `PlaylistActions`: loadPlaylists, addPlaylist, removePlaylist, parsePlaylist
- `ChannelActions`: setChannels, setActiveChannel, setAdjacentChannelAsActive
- `EpgActions`: setActiveEpgProgram, setCurrentEpgProgram, setEpgAvailableFlag
- `FavoritesActions`: updateFavorites, setFavorites, hydrateFavorites

See `docs/architecture/m3u-playlist-module.md` for complete documentation.

**Routing**: Lazy-loaded routes in `apps/web/src/app/app.routes.ts`. All user-facing routes are nested under the workspace shell (`/workspace/...`); `/` redirects into the workspace.

- Dashboard: `/workspace/dashboard`; sources overview: `/workspace/sources`
- M3U player: `/workspace/playlists/:id` (children: `favorites`, `recent`, `:view`) — routes in `libs/playlist/m3u/feature-player`
- Xtream Codes: `/workspace/xtreams/:id` (children: `live`, `vod`, `series`, `search`, `actor/:personId`, `discover`, `recently-added`, `favorites`, `recent`, `downloads`) — `libs/portal/xtream/feature/src/lib/xtream-feature.routes.ts`
- Stalker portal: `/workspace/stalker/:id` (children: `itv`, `vod`, `radio`, `series`, `favorites`, `recent`, `search`, `actor/:personId`, `discover`, `downloads`) — `libs/portal/stalker/feature/src/lib/stalker-feature.routes.ts`
- Global collections: `/workspace/global-favorites`, `/workspace/global-recent`
- Global search: `/workspace/search` (Electron-only; a guard redirects the PWA to `/workspace/sources`)
- Downloads: `/workspace/downloads` with focused
  `/workspace/downloads/:downloadId`; source-scoped equivalents are
  `/workspace/xtreams/:id/downloads/:downloadId` and
  `/workspace/stalker/:id/downloads/:downloadId`. Focused download details hide
  the workspace context panel.
- Settings: `/workspace/settings/:section` — one page per section (`general`, `playback`, `epg`, `dashboard`, `remote-control`, `tmdb`, `backup`, `reset`, `about`); `/workspace/settings` redirects to `general`, unknown or capability-gated sections redirect there too, and `/settings` redirects into the workspace. The `general` section's "Window on startup" select (`Settings.startupWindowMode`: `normal` / `maximized` / `fullscreen`, Electron only, gated on `RuntimeCapabilitiesService.supportsStartupWindowMode`) is mirrored into the main-process config by the `SETTINGS_UPDATE` handler and read synchronously at the next window creation — the renderer's IndexedDB is unreachable then, so it is the same pattern as `embeddedMpvFrameCopy`; `iptvnator --fullscreen` forces one fullscreen launch without persisting it, and F11 (`WINDOW:TOGGLE_FULLSCREEN`, bound in `WorkspaceKeyboardShortcutsService`, skipped while the player owns `document.fullscreenElement`) is the exit path on Windows/Linux, where the title bar is hidden (contract: `docs/architecture/workspace-shell.md`, "Startup window mode"). The shared form lives on the parent `SettingsComponent`, so edits survive section switches; a floating unsaved-changes bar (Save/Discard) replaces the old always-visible footer Save button. Leaving the settings AREA with a dirty form triggers `settingsUnsavedChangesGuard` (canDeactivate) and a save/discard/stay dialog — section switches deliberately bypass it, and a failed save cancels the navigation. Non-router exits are covered too: `SettingsUnloadGuardService` (provided by `SettingsComponent`) arms a `beforeunload` handler while the form is dirty (native leave prompt in the PWA) and arms an Electron main-process close guard (`window-close-guard.service.ts`) for the whole settings mount — mount-long on purpose, since arming on the first edit would race the close it protects against. The guard intercepts window close/app quit before `beforeunload` fires and completes the original intent only after the renderer confirms through the same dialog (a pristine form auto-confirms); Electron reloads are cancelled and re-triggered the same way, a failed save always keeps the window open, and installing an app update suspends the whole guard so the updater's quit passes unchallenged — every install entry point (settings About section and the global update notification panel) must go through the root `AppUpdateInstallService`, which owns that suspend/restore choreography

**Service Architecture** (Factory Pattern):

- Abstract `DataService` class in `libs/services/src/lib/data.service.ts` defines the contract
- Two environment-specific implementations:
    - `ElectronService` (`apps/web/src/app/services/electron.service.ts`) - Uses IPC to communicate with Electron backend
    - `PwaService` (`apps/web/src/app/services/pwa.service.ts`) - Uses HTTP API and IndexedDB for standalone web version
- Factory function `DataFactory()` in `apps/web/src/app/app.config.ts` determines which implementation to inject:
    ```typescript
    if (window.electron) {
        return inject(ElectronService);
    }
    return inject(PwaService);
    ```

**Data Storage (Environment-Specific)**:

- **Electron**: SQLite database via Drizzle ORM (`better-sqlite3` driver)
    - Location: `~/.iptvnator/databases/iptvnator.db`
    - Full-featured relational database with foreign keys and indexes
    - Canonical schema and connection live in `libs/shared/database`
- **PWA (Web)**: IndexedDB via `ngx-indexed-db`
    - Browser-based NoSQL storage
    - Same schema structure but implemented in IndexedDB
    - Limited by browser storage quotas

**TypeScript File Size Rule**:

Keep production TypeScript files under **300 lines**. Hard maximum is
**350–400 lines**, and CI enforces the 400. Blank lines and comments do not
count toward it, so documenting a file never costs you headroom. Tests
(`**/*.spec.ts`, `**/*.spec-data.ts`, `**/*.e2e.ts`, `apps/*-e2e/**`) are held
to 1200 instead — the guidance below is about production code.

- When creating new files, design them to stay within this limit from the start.
- When adding a feature to an existing file that would push it past 350 lines, **refactor first**: extract helpers, sub-services, or feature modules before adding the new code.
- When you notice a file already exceeds 350 lines, **proactively suggest a refactoring** (or perform it if the change is straightforward) — even if the immediate task is small.

Typical split strategies:

- Angular components: extract child components, move logic to a dedicated service or store feature
- Signal store features: split into smaller `with*` feature functions in separate files
- Services: split by responsibility (e.g. separate API, transformation, and state concerns)
- Utility files: group by domain and export from a barrel `index.ts`

This rule exists to keep the codebase navigable and reviewable. A 150-line file is always preferable to a 500-line file.

---

**Angular Coding Standards**:

This project uses modern Angular signal-based APIs and patterns. **ALWAYS** use the following:

- **Component Queries**: Use `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()` instead of `@ViewChild`, `@ViewChildren`, `@ContentChild`, `@ContentChildren` decorators

    ```typescript
    // ✅ Correct - Signal-based
    readonly menu = viewChild.required<MatMenu>('menuRef');
    readonly items = viewChildren<ElementRef>('item');

    // ❌ Incorrect - Old decorator syntax
    @ViewChild('menuRef') menu!: MatMenu;
    @ViewChildren('item') items!: QueryList<ElementRef>;
    ```

    **Important**: When using signals in templates with properties that expect non-signal values, unwrap the signal by calling it:

    ```html
    <!-- ✅ Correct - Unwrap the signal -->
    <button [matMenuTriggerFor]="menu()">Open Menu</button>

    <!-- ❌ Incorrect - Signal not unwrapped -->
    <button [matMenuTriggerFor]="menu">Open Menu</button>
    ```

- **Component Inputs/Outputs**: Use `input()` and `output()` functions instead of `@Input()` and `@Output()` decorators

    ```typescript
    // ✅ Correct - Signal-based
    readonly title = input.required<string>();
    readonly size = input<number>(10); // with default value
    readonly clicked = output<string>();

    // ❌ Incorrect - Old decorator syntax
    @Input({ required: true }) title!: string;
    @Input() size = 10;
    @Output() clicked = new EventEmitter<string>();
    ```

- **Reactive State**: Use signal primitives for reactive state management

    ```typescript
    // ✅ Use signal(), computed(), effect(), linkedSignal()
    readonly count = signal(0);
    readonly doubled = computed(() => this.count() * 2);

    constructor() {
        effect(() => {
            console.log('Count changed:', this.count());
        });
    }
    ```

- **Host Bindings**: Use `@HostBinding()` and `@HostListener()` decorators (these don't have signal equivalents yet)

    ```typescript
    @HostBinding('class.active') get isActive() { return this.active(); }
    @HostListener('click') onClick() { /* ... */ }
    ```

- **Control Flow**: Use `@if`, `@for`, `@switch` instead of `*ngIf`, `*ngFor`, `*ngSwitch`

    ```typescript
    // ✅ Correct - Modern syntax
    @if (isLoggedIn()) {
        <p>Welcome!</p>
    }

    @for (item of items(); track item.id) {
        <li>{{ item.name }}</li>
    }

    // ❌ Incorrect - Old syntax
    <p *ngIf="isLoggedIn">Welcome!</p>
    <li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>
    ```

### Backend Architecture (Electron)

**Main Entry**: `apps/electron-backend/src/main.ts`

- Bootstraps Electron app and initializes database
- Registers event handlers for IPC communication
- Creates the main window per the startup window mode (`app/app.ts` `initMainWindow`, resolver in `app/services/startup-window-mode.ts`): the electron-conf `STARTUP_WINDOW_MODE` mirror or the one-shot `--fullscreen` switch (consumed by the first window, so a window the macOS Dock re-creates in the same process follows the stored setting); `fullscreen: true` is a constructor option that Windows/Linux honour before the first paint, while macOS ignores it on a hidden window, so `ready-to-show` repeats the request after `show()` only when `isFullScreen()` is still false, through the same tracker the F11 toggle uses (`app/services/native-fullscreen-transitions.ts`: per-window fullscreen state seeded once at creation via `trackNativeFullScreen` and fed only by the enter/leave events afterwards, plus a pending record holding the latest target, cleared when an event lands on it, kept when an event lands on the other state, and ignored after 2 s; the tracker only observes and never issues a request itself, since a "repeat on mismatch" cannot be told apart from reversing the user's own green-button action — a toggle is never decided against `isFullScreen()`, which is stale mid-transition and, on Windows, even during the event), so F11 during the startup animation exits instead of re-requesting; `maximize()` waits for `ready-to-show` too (it would show a hidden window early). `attachWindowStateEvents` tracks native and HTML-element fullscreen as two flags OR-ed into `WINDOW:STATE_CHANGED`, because Electron leaves only the HTML state when the window was already natively fullscreen
- Persists the app zoom level (issue #1109): the preload restores it with `webFrame.setZoomLevel` (temporary, frame-bound zoom; level answered over the synchronous `WINDOW:GET_ZOOM_LEVEL` IPC, applied at `DOMContentLoaded` and acknowledged with `WINDOW:ZOOM_LEVEL_APPLIED` — any earlier `webFrame.setZoomLevel` leaves a hidden Linux/Windows window without `ready-to-show`), never `webContents.setZoomLevel` — under `file://` Chromium keys zoom by the full URL, so the app's path routing would reset it on the next resize after a section change, and dev mode (`http://localhost`) never shows that. `app/services/window-zoom-level.ts` writes the live level to electron-conf `ZOOM_LEVEL` on close, `before-quit` and before every cross-document navigation (a reload drops the temporary level). The zoom shortcuts (Cmd/Ctrl and +/−/0, numpad included) are a renderer key binding in `WorkspaceKeyboardShortcutsService` — the Windows/Linux window has no menu (`setMenu(null)`) — calling the synchronous preload-local bridge method `adjustZoomLevel`, which steps the same frame-bound level (`stepZoomLevel` in `libs/shared/interfaces`: 0.5 per press like Electron's `zoomIn`/`zoomOut` roles, clamped to levels −4…6, a stored level already outside them never moved against the request, so the returned level is not itself guaranteed in range); on macOS the renderer's `preventDefault()` keeps the menu role from stepping a second time. Contract: `docs/architecture/workspace-shell.md`, "Zoom level"
- Recovers a renderer reload on an in-app route: the packaged renderer is `index.html` over `file://` with path routing, so a reload of `file:///…/web/workspace/sources` asks for a path with no file behind it. A main-process reload (the macOS default menu's View › Reload, DevTools) failed with `ERR_FILE_NOT_FOUND` and stranded the window on Chromium's error page; a renderer-initiated one (the settings unsaved-changes guard's confirmed `location.reload()`) was cancelled by the `will-navigate` trust check and silently did nothing. `app/services/renderer-reload-fallback.ts` handles both — `attachRendererReloadFallback` answers the main-frame `did-fail-load` (deferred to the error page's `dom-ready`: a load issued from inside the failure event yields a document that never paints), and `handleRendererNavigation` recognizes a routed renderer URL (`resolveRoutedRendererUrl`) — by re-loading the packaged index with the route in the `restoreRoute` query parameter (`restoreRendererRoute`); `apps/web/src/main.ts` consumes it before Angular bootstraps (`resolveRestoredRendererRoute` in `libs/shared/interfaces`, resolved against `document.baseURI` and confined to the renderer directory). A failed `index.html` itself is never re-requested. Contract: `docs/architecture/workspace-shell.md`, "Reloading the renderer on an in-app route"
- Holds a single-instance lock (`app/services/single-instance.ts`), requested after the `userData` override so E2E runs with their own data dir keep independent locks. A second launch quits and focuses the running window; concurrent instances would otherwise share a Chromium profile whose IndexedDB only one of them can lock, silently breaking renderer-side settings persistence. `IPTVNATOR_ALLOW_MULTIPLE_INSTANCES=1` opts out for local debugging. The guard also forwards that launch's argv and working directory, so `iptvnator playlist.m3u` against a running app opens the playlist instead of being discarded.

**Database**:

- **ORM**: Drizzle ORM with `better-sqlite3` (local SQLite file)
- **Location**: `~/.iptvnator/databases/iptvnator.db` (avoids spaces in path)
- **Schema** (`libs/shared/database/src/lib/schema.ts` — canonical; `apps/electron-backend/src/app/database/schema.ts` is a backwards-compat re-export shim):
    - `playlists` - Playlist metadata (M3U, Xtream, Stalker)
    - `categories` - Content categories (live, movies, series)
    - `content` - Streams/VOD/series items. Besides the catalog fields it carries what a detail view learned and handed back: `backdrop_url`, plus the TMDB identity (`tmdb_id`, `release_year`, `original_title`) that lets an activity row repeat the detail view's lookup instead of rebuilding a weaker one from the display title
    - `favorites` - User favorites
    - `recentlyViewed` - Watch history
    - `epgChannels`, `epgPrograms` - Persisted EPG data
    - `epgChannelMappings` (`epg_channel_mappings`) - Manual EPG channel mappings (defined in `epg-mapping.schema.ts`, re-exported by `schema.ts`)
    - `playbackPositions` - Resume positions
    - `downloads` - Download manager state
    - `recordings` - Live-TV recording lifecycle + start-time channel/EPG snapshot (defined in `schema.ts` beside `downloads`)
    - `appState` - Key-value app state (also tracks one-off data migrations)
    - `tmdbMetadata` - TMDB enrichment cache (details payloads + search match resolutions, keyed by media type/lookup key/language)
    - `vodSourcePins` (`vod_source_pins`) - VOD multi-source per-movie preferred playlist, keyed by a portal-agnostic match key (defined in `vod-source-pins.schema.ts`, re-exported by `schema.ts`)
- **Connection**: `libs/shared/database/src/lib/connection.ts`
    - `createTables()` auto-creates tables on init (`CREATE TABLE IF NOT EXISTS`)
    - Provides full read-write access for `electron-backend` and a read-only mode
    - A root `drizzle.config.ts` configures Drizzle Kit tooling (points at the schema via the compat shim)

**IPC Communication**:

- **Preload script**: `apps/electron-backend/src/app/api/main.preload.ts`
    - Exposes `window.electron` API via `contextBridge`
    - All IPC channels defined here (playlist operations, EPG, database CRUD, external players, etc.)
    - The canonical TypeScript contract is `ElectronBridgeApi` in `libs/shared/interfaces/src/lib/electron-api.interface.ts`; `global.d.ts`, `apps/web/src/typings.d.ts`, and `main.preload.ts` must reference this shared type instead of maintaining separate method lists.
- **Event handlers**: `apps/electron-backend/src/app/events/`
    - `database.events.ts` - Database CRUD operations
    - `playlist.events.ts` - Playlist import/update
    - `playlist-open.events.ts` - Playlist files handed over by the OS (argv, file association, macOS `open-file`); the queue itself lives in `services/playlist-open-request.ts`
    - `epg.events.ts` - EPG IPC registration; freshness/fetch orchestration lives in `epg-fetch.service.ts`, manual channel-mapping resolution and CRUD in `epg-mapping.service.ts`, source orchestration in `epg-worker.service.ts`, per-import lifecycle in `epg-fetch-operation.ts`, worker bootstrap/shutdown and clear protocol in `epg-worker-runtime.ts`, DB lookups in `epg-query.service.ts`
    - `xtream.events.ts` - Xtream Codes API
    - `stalker.events.ts` - Stalker portal API
    - `connectivity-guard.events.ts` - `CONNECTIVITY_GUARD_RESET`: forgets the connection failures recorded for a portal host. Both portal handlers above run every request through the per-host circuit breaker (rules in `@iptvnator/shared/host-health`, process-wide instance in `util/host-connectivity-guard.ts`; the web backend runs the same breaker over its proxy routes) — after 2 consecutive connection-level failures (no HTTP response; `ETIMEDOUT`/`ENOTFOUND`/`ECONNREFUSED`/… but never `ECONNRESET`, and never a timeout after the TCP handshake — both transports report `connected` through an `onConnect` hook, and a panel that accepted the connection and then went silent is slow, not dead: the connection clears the streak the moment it happens through `reportConnected`, never when the timeout settles, never closes an open breaker, and is not credited at all through an environment proxy) requests to that endpoint fail immediately for 30 s. The key is `URL.origin`, not `URL.host`, which would give `http://panel` and `https://panel` one shared record and let a dead TLS listener fast-fail the working HTTP one instead of hanging the full 30 s/15 s axios timeout again, with one half-open trial request afterwards. Any HTTP response (4xx and 5xx included) clears the record. The refusal is a real `Error` whose wording is a renderer contract (`buildHostConnectivityFastFailMessage` in `libs/shared/interfaces`): it must carry no `HTTP Error <code>`, no timeout wording and none of the auth phrases, or Stalker endpoint discovery misclassifies it and lazy portal repair fires against a host just declared dead. Discovery probes are exempt via the `skipConnectionGuard` payload flag (bypass + no failure counting, but successes still clear the record). Every user-driven retry/refresh that issues portal requests must reset BEFORE its first request, or the affordance fast-fails and looks broken; automatic and first-load paths deliberately do not reset. Current senders: Xtream content-gate Retry, Stalker catalog append retry (`retryContentPage`), Stalker search-page retry, `StalkerItvCacheService.refresh()` (Live TV refresh), both account-info dialogs' Retry, the destructive Xtream refresh (`XtreamRefreshFlowService`, before it deletes the cached catalog — one flow shared by both entry points, `PlaylistRefreshActionService.refreshXtream()` and `RecentPlaylistsComponent.refreshXtreamPlaylist()`, which supply only a progress reporter), `StalkerPortalDiscoveryService.discover()`, and `PortalStatusService` on `skipCache`. Kill switch: `IPTVNATOR_DISABLE_CONNECTIVITY_GUARD=1`. Contract: `docs/architecture/host-connectivity-guard.md`
    - `player.events.ts` - External player IPC registration; MPV/VLC lifecycle logic lives in `mpv-session.service.ts`, `vlc-session.service.ts`, and shared `external-player-*` helpers
    - `settings.events.ts` - App settings
    - `electron.events.ts` - App version, etc.

**Workers** (`apps/electron-backend/src/app/workers/`):

- EPG parsing: `epg-parser.worker.ts`; main-process worker lifecycle is coordinated from `apps/electron-backend/src/app/events/epg-worker.service.ts`
- Non-EPG SQLite work: `database.worker.ts` (see `docs/architecture/sqlite-db-worker.md`). Catalog deletes and inserts commit in row-budgeted transactions of ~5,000 rows (`database/operations/catalog-deletion.ts`: per-category row counts → category groups → set-based `DELETE`s scoped to the captured category ids, never playlist-wide, since the worker interleaves requests between commits and a newer import's categories must survive an older refresh; never 100-row autocommit batches, which flush FTS5 segments and re-append index pages to the WAL on every commit, and never one giant transaction, which would starve the main-process and EPG-worker connections past their 5 s `busy_timeout`). Progress events are throttled to one per 100 ms per operation with summed `increment`s (`operation-progress-throttle.ts`); phase starts, totals reached and terminal events are never held back
- Playlist refresh: `playlist-refresh.worker.ts`; explicit cancellation is main-process-owned and terminates the one-shot worker before acknowledging `PLAYLIST_CANCEL_REFRESH` (see `docs/architecture/m3u-playlist-module.md`)

### Xtream Category Management

The Electron Live TV, Movies, and Series category dialog applies Select/Deselect
to search results while a filter is active and to the whole type otherwise.
Button states use the matching group; "Total selected" counts the whole catalog.
Save persists the complete draft, Close discards it, and refresh restores hidden
categories by provider ID and type. See `docs/architecture/category-management.md`.

### Key Features

#### Xtream Connection Test

Add/Edit source Test HTTPS and HTTP discloses plaintext credential use before
the click and can replace an unavailable HTTPS base with a
verified active HTTP base in the form. Only initial refused-port or TLS
wrong-version evidence permits the same-host attempt; HTTP errors, certificate
failures and redirect failures do not. Add/Save persists `serverUrl`, and the
routed session observes the metadata change. Passive checks never change the
protocol. Separate XMLTV and already-issued media/download URLs stay independent.
Contract: `docs/architecture/xtream-portal-compatibility.md`
("Explicit protocol discovery").

#### Xtream Live Auto Format

The routed Xtream live host supplies `liveAutoTsUrl` only for Auto with explicit
HLS+TS account evidence, using the canonical URL builder and original headers.
The same web player may try TS once after an owned initial terminal HTTP failure,
before `playing`; the old transport unmounts before the guarded render callback
starts TS. No player preference or playlist cache changes. Manual formats,
unknown formats, DRM, VOD/catch-up and stale sessions are excluded. External
MPV/VLC and Embedded MPV retain manual TS; Video.js segment retry cycles without
a terminal diagnostic also need manual TS. Contract and full support matrix:
`docs/architecture/xtream-portal-compatibility.md` (Initial Auto HLS failure).

#### Xtream Catch-Up Server Timezone

The `{Y-m-d:H-M}` segment of a timeshift URL is read by the panel in ITS
timezone (`server_info.timezone`), never the viewer's (issue #1562).
`withPortal.checkPortalStatus()` normalizes it with
`resolveXtreamServerTimezone()` (`libs/shared/interfaces`, an ICU-resolvable
name, else a `UTC±HH:MM` derived from the `time_now`/`timestamp_now` clock
pair) and persists it on the playlist row through
`IXtreamDataSource.rememberServerTimezone` — Electron: one conditional
`json_set` UPDATE (`DB_SET_PLAYLIST_SERVER_TIMEZONE`) guarded by the row's
current connection; PWA: `PlaylistsService.transformPlaylistMeta` — because
the Favorites / Recent resolver reads the STORED row, not the store, and the
worker interleaves requests, so no read may precede the write.
`DB_GET_PLAYLIST` projects it back from the row payload, and a server URL
change drops it until the next account-info check. The same value converts
timestamp-less EPG
`start`/`end` strings. Contract:
`docs/architecture/xtream-portal-compatibility.md` ("Start time is the
panel's clock, not the viewer's").

#### M3U URL User-Agent

- `PlaylistsService.getPlaylist()` joins the per-playlist mutation queue so a
  route opened during refresh reads after its pending save. Mutation-internal
  reads keep using `getPlaylistById()` directly to avoid queue re-entry.
- The URL import form accepts an optional User-Agent and stores it as
  `Playlist.userAgent`. Electron sends it on initial download, manual refresh,
  and startup auto-update. The self-hosted PWA sends it through the registered
  target `/parse` backend proxy for import and refresh; a matching backend is
  required, and browser playback-header restrictions still apply.
- Reuse the existing source editor and channel-over-playlist playback header
  precedence. Contract: `docs/architecture/m3u-playlist-module.md`
  ("User-Agent for URL sources").

**Playlist Support**:

- M3U/M3U8 files (local or URL)
- Xtream Codes API (`username`, `password`, `serverUrl`)
- Stalker portal (`macAddress`, `url`)

**Stalker playback links**: `create_link` runs only when the catalog row sets
`use_http_tmp_link` or `use_load_balancing`; otherwise the static `cmd` plays
directly. One helper decides
(`resolveStalkerStaticPlaybackUrl` in
`libs/portal/stalker/data-access/.../stalker-link-semantics.utils.ts`), applied
by `fetchStalkerPlaybackLink()` for ITV/VOD/radio and by
`StreamResolverService` for Favorites/Recently Viewed. It falls back to
`create_link` for anything it cannot resolve alone: no row to read flags from,
a relative/query-only command (the VOD `has_files` rewrite), a non-HTTP scheme,
or a loopback host; an episode (`series` set) always mints, since the parameter
selects the episode server-side. Temporary links live ~5 s, so no resolved URL
is persisted or replayed — favorites and recently-viewed store the `cmd`,
playback positions store ids, and the main-process context map stores headers
keyed by origin+path. Downloads are the one exception (they must retry a URL).
`forced_storage`/`play_token` are deliberately unwired. Contract:
`docs/architecture/stalker-portal.md` ("Playback Link Resolution").

**Opening a playlist from the OS** (Electron only): a `.m3u`/`.m3u8` path passed
on the command line, opened through a file association, or delivered by macOS'
`open-file` event is normalized to an absolute path in the main process
(`services/playlist-open-request.ts`) and queued there. The renderer
(`apps/web/src/app/services/playlist-open-request.service.ts`) subscribes to the
`OPEN_FILE` push **before** calling `announcePlaylistOpenListener`, which is
what makes the main process flush. `OPEN_FILE` is the only way out of the
queue, and a request stays there until the renderer confirms receipt via
`acknowledgePlaylistOpenRequest` — `webContents.send()` returns before the
listener runs, and a reload or dead render process keeps the `WebContents`
alive, so a successful push is not proof of delivery. Anything unacknowledged
is replayed to the next renderer that announces itself. The renderer
imports them on a single promise chain so a burst arrives in a deterministic
order. `addPlaylist$` in `libs/m3u-state` uses `concatMap` (not `switchMap`)
for the same reason: each action carries a different playlist, so a newer add
must never cancel an older one's write, EPG fetch and navigation. The import
itself reuses the normal file path
(`updatePlaylistFromFilePath` → `PlaylistActions.addPlaylist`), so persistence,
playlist-scoped EPG, and the navigation to the new playlist all behave exactly
like a dialog import.

The OS-level registration that makes those paths reachable is
`fileAssociations` in `electron-builder.json` — one entry per extension, each
with its own `mimeType`. Electron Builder derives all three platform
registrations from it: macOS `CFBundleDocumentTypes` (which is what makes
`open-file` fire from Finder), the NSIS registry entries, and, on Linux, the
desktop entry's `MimeType` plus `/usr/share/mime/packages/iptvnator.xml` for
deb/rpm/pacman. Two traps: it assigns the derived `MimeType` _after_ spreading
`linux.desktop.entry`, so declaring `MimeType` there is silently overwritten and
must not be used; and it appends `%U` to `Exec`, so Linux file managers hand
over percent-encoded `file://` URIs rather than paths —
`createPlaylistOpenRequest` decodes them before the extension check. `%U` is
also the _plural_ exec code, so a multi-file selection arrives as one launch
with one argument per file; `extractPlaylistOpenRequestsFromArgv` returns all
of them and `enqueueAll` queues the batch, because stopping at the first match
would silently drop the rest of the selection. Adding an exec code to
`linux.executableArgs` would suppress the `%U` but also pass that code to the
app as a real argument, so it is not an option.

**Video Players**:

- The Embedded MPV native-view dock follows app theme tokens as a solid app
  surface, including Material icon-button disabled states. Over-video
  loading/stalled/feedback overlays keep a paired light-on-dark palette, and
  video viewports stay black in windowed and fullscreen modes. Shared EPG
  panels use the library-local app-token palette in
  `libs/ui/epg/src/lib/_epg-theme.scss`. Theme/contrast contract:
  `docs/architecture/iptvnator-ui-guidelines.md`.
- Built-in web players: HTML5+hls.js, Video.js, and ArtPlayer. Source engine
  is picked by one URL rule, `resolvePlaybackUrlSourceKind()` in
  `libs/playback/util` (`mpd` → Shaka, `m3u8`/`m3u` → hls.js,
  `ts`/`m2ts`/extension-less → mpegts.js, else native `<video>`), so hls.js
  never receives an `.mkv`/`.webm` file. The HTML5 native `<source>` carries a
  `video/mp4` hint only for MP4-family files (`resolveNativeSourceMimeType`);
  a hint `canPlayType()` rejects would make the browser skip the source.
- mpegts.js `1.8.1` errors from all three built-in players cross one
  version-locked structured evidence boundary in `libs/playback/util`: it
  retains only exact public type/detail pairs, pair-derived stage/failure,
  terminal disposition, and a validated HTTP 4xx/5xx status — raw messages
  and arbitrary `info` never reach stored or rendered diagnostics.
  HTTP/network failures avoid false decoder recommendations, while exact
  format, codec, truncated-stream, and MediaSource failures retain actionable
  recovery guidance. This diagnostic layer stays separate from the shared
  `PlayerController` controls contract.
- Playback diagnostics and recovery policy live in `libs/playback/util`
  (`@iptvnator/playback/util`): public engine errors (mpegts.js, Shaka/DASH)
  cross allowlisted sanitizers into a `PlaybackDiagnostic`;
  `recommendPlaybackRecovery(context)` ranks up to three actions, and
  `WebPlayerViewComponent` executes only the action the user selects — never
  auto-switch, persist history, learn across sessions, or emit telemetry. DASH
  evidence observes existing Shaka manifest responses bounded to 2 MiB (no
  refetch, no retained license URLs/keys/XML) and is scoped to one engine,
  never proving playability; HTTP 401/403 segment failures never imply token
  expiry. Copy diagnostics produces a credential-free local report. Network
  and generic unknown evidence fail closed to Retry/alternative source, with
  the exact Shaka browser-unsupported preflight marker as the sole
  unknown-code exception; PWA capability suppresses managed MPV/VLC, and
  ClearKey/KODIPROP DRM suppresses external targets (payload not
  transferable). `WebPlayerViewComponent` owns a host-derived content-session
  key stable for the mounted logical selection, attempted target IDs, the
  temporary player override, and VOD handoff position; `PlaybackBinding` is
  exactly `{ generation, target }`, and three separate fieldless `Symbol`
  tokens track application/target/reload, diagnostic intent, and source
  revision (the revision clears only the VOD handoff position — target-only
  switches and Retry leave it stable). None of these primitives carries URLs,
  headers, DRM material, or credentials. A recommended built-in player
  temporarily outranks the host override/saved player for that session,
  never mutates `Settings.player`, and resumes finite VOD position
  best-effort (live returns to the live edge). Details:
  `docs/architecture/m3u-playlist-module.md` ("DASH + ClearKey Playback").
- External players (MPV/VLC via IPC) and Embedded MPV external-process
  handoffs follow a strict single-flight ownership/teardown contract: only
  one handshake/spawn is in flight per content session, a replacement always
  waits for confirmed teardown of the previous process before launching, and
  Stop is the only teardown affordance (closable errors stay stoppable;
  Dismiss is for terminal errors with no closer — the shared
  `isLiveExternalPlayerSession` predicate distinguishes the two, so consumers
  must not treat every `error` status as terminal). A source handoff fails
  closed while a live session has no closer (`canClose: false`); renderer
  Dismiss is never teardown confirmation. A process-wide teardown gate starts
  before any potentially slow teardown prep (VLC position flush, a reused
  player's protocol quit) and rejects every MPV/VLC spawn until that exact
  child reports exit; bounded graceful/forced confirmation windows apply, and
  if teardown can't confirm the exact session stays live and the replacement
  fails closed instead of overlapping it. Reusable MPV IPC commands are bound
  to the socket captured for the exact child, so a later process cannot
  inherit a stale protocol quit. VLC rechecks the gate at each concrete spawn
  after port allocation/reuse; a failed RC-port allocation never claims reuse
  ownership, so the fallback VLC child retains its own one-shot closer.
  Retained destination ownership is scoped to the initiating playlist/VOD
  route key, so route reuse can't expose Stop for the previous movie's
  session — Play/Resume capture that key before awaiting close and cancel if
  navigation changes it, and the Xtream VOD diagnostic-fallback handler
  records the same route-scoped destination/generation before invoking
  MPV/VLC. Do not add a second path that can spawn or close an external
  player outside this contract. Full state machine:
  `docs/architecture/player-controls-contract.md`.
- DASH + ClearKey (M3U module): `.mpd` channels play through a lazily loaded
  Shaka Player engine inside HTML5/ArtPlayer (no new player in Settings).
  ClearKey keys come from `#KODIPROP:inputstream.adaptive.*` lines via
  `extractDrmFromRaw()` (`libs/shared/m3u-utils`, hooked in
  `createPlaylistObject()` so every import path is covered; hex/Base64URL/
  Base64, strictly 128-bit key/KID). `isDashChannel()` bypasses the
  external-player setting (same precedent as radio) and routes Video.js/MPV/
  VLC/embedded-MPV users to the HTML5 player via `playerOverride` (ArtPlayer
  keeps ArtPlayer). Widevine/PlayReady are out of scope (need the castLabs
  Electron fork); ClearKey EME works in stock Electron. Its DOM-free Shaka
  `5.2.4` diagnostic boundary (`libs/playback/util`) version-locks public
  severity/category/code evidence, ignores recoverable error events, treats
  rejected loads as terminal, and never retains/renders raw messages or
  `error.data`; a failed browser-support preflight carries the exact
  `PlaybackRuntimeSupport.ShakaBrowserUnsupported` marker. Engine:
  `libs/ui/playback/src/lib/shaka-engine/`. Details:
  `docs/architecture/m3u-playlist-module.md` ("DASH + ClearKey Playback").
- Stream info popover: an `info` button on the shared controls overlay shows
  live stream data (resolution + aspect ratio, measured frame rate,
  video/audio codec and bitrate, audio channels/sample rate, container,
  buffer, dropped frames), rendered only when the engine reports
  `capabilities.streamStats`, sampled once a second while open. Web engines
  read the `<video>` element plus the active HLS/Shaka/VHS rendition;
  Embedded MPV reads observed mpv properties on the session snapshot
  (frame-copy engine only — native-view does not mount shared controls). Web
  FPS excludes dropped frames with a fresh measurement window on open;
  nominal FPS and aggregate rendition bitrate are separate rows; unknown
  video bitrate is never filled with aggregate bandwidth. See
  `docs/architecture/player-controls-contract.md` ("Stream info popover") and
  `docs/architecture/embedded-mpv-native.md` ("Stream Stats Properties").
- Display sleep during playback: `PlaybackKeepAwakeService`
  (`apps/web/src/app/services/playback-keep-awake.service.ts`) watches every
  `<video>` via document-level capture listeners (media events don't bubble)
  and, while any video is playing and visible — or in picture-in-picture,
  which survives a minimized window — holds a display-sleep lock: Electron
  main-process `powerSaveBlocker` behind `window.electron.setPlaybackKeepAwake`
  (auto-cleared on renderer reload/crash), PWA Screen Wake Lock API. Radio's
  `<audio>` never blocks it. Embedded MPV holds its own blocker in
  `EmbeddedMpvNativeService`; external MPV/VLC inhibit the screensaver
  themselves.
- Embedded MPV (experimental, macOS/Windows/Linux): renders mpv inside the
  Electron window via a native addon (native-view dock — macOS libmpv render
  API in an `NSOpenGLView`, Windows in-process libmpv with `--wid`, Linux an
  out-of-process `mpv --wid=<x11-window>` over JSON IPC, X11/XWayland only,
  requiring system `mpv`) or, on macOS Apple Silicon/Linux x64/Windows, an
  offscreen frame-copy engine (CGL/EGL/WGL renders offscreen into a shm ring;
  the preload frame pump uploads to `<canvas data-embedded-mpv-frame>`) that
  shares the DOM `app-player-controls` UI. Per-session options
  (`Settings.embeddedMpvExtraOptions` — free-form libmpv `key=value` lines,
  embed-critical keys refused by the form, network defaults
  `network-timeout=10` + ffmpeg `reconnect` prepended, applied via
  `mpv_set_option_string`/an `--include` config file/the frame-copy helper's
  first stdin line, never a command line where `ps` could read credentials;
  and `Settings.embeddedMpvAutoReconnect`, default on — `EmbeddedMpvReconnectCoordinator`
  reloads on `error`/`ended`-while-live only if it had played, 2s→30s
  backoff, six attempts per outage, budget reset after 30s stable, cancelled
  by user loads/pause/dispose; an in-flight recording finalizes as
  interrupted when the reload actually replaces the stream and restarts into
  a new file once the reload plays) are captured at session creation in the
  main process, never inside the renderer-facing service. mpv's own
  screensaver inhibition doesn't apply, so `EmbeddedMpvNativeService` holds
  its own `powerSaveBlocker` while any session is `playing`. Renderer bounds
  are CSS pixels; the main process converts to native units (× page zoom
  everywhere, × display scale on Windows/Linux) and re-syncs on
  `devicePixelRatio` change plus a 500ms drift-gated poll for shifts
  `ResizeObserver` can't see. Seeking uses the relative `seekEmbeddedMpvBy`
  IPC (mpv `seek <delta> relative+exact`), never an absolute target computed
  from the renderer's polled position — a stale base previously collapsed
  rapid presses onto ~1s of progress per press; only the timeline scrub
  commits an absolute `seek`. Packaging is platform- and profile-specific:
  DEB/RPM/Pacman depend on system libmpv (exact packages
  DEB=`libmpv2,libegl1,libgl1,libgbm1`, RPM=`mpv-libs,libglvnd-egl,libglvnd-glx,mesa-libgbm`,
  Pacman=`mpv,libglvnd,mesa`; DEB verified on Ubuntu 24.04+, 22.04 needs the
  x64 AppImage since Jammy ships `libmpv1`; ARM packages are marker-only);
  AppImage/Snap/Flatpak bundle a pinned LGPL closure (Snap is `core22`/strict
  with a private `shared-memory` plug plus a `graphics-core22` content plug,
  Flatpak keeps `iptvnator` as the real Electron ELF for Zypak); Linux
  frame-copy requires the sandboxed `iptvnator_mpv_helper` as the only
  process linking libmpv, and Windows package validation requires the exact
  MPV DLL named by the helper's PE import table beside the executable. Gated
  by a fail-closed packaged manifest/hash check plus a bounded
  `--embedded-mpv-runtime-probe` (one availability JSON line; explicit 16 MiB
  aggregate output ceiling; with `IPTVNATOR_TRACE_PLAYER=1`, a separate
  helper-stderr JSON line capped at 16,384 characters with a `truncated`
  field) — any failure falls back to native-view without crashing. Snap Store
  publication runs only from a public `v*` GitHub release that already
  contains the Snap assets and one source archive, with hash/tag/submodule
  verification before upload; candidate/stable promotion stays manual. Full
  architecture, packaging profiles, and Snap/Flatpak/notice provenance:
  `docs/architecture/embedded-mpv-native.md` and
  `tools/embedded-mpv/README.md`.
- Shared player-controls layer (`libs/ui/playback/src/lib/player-controls/`):
  engine-neutral `PlayerController` contract + `app-player-controls`, default
  ON via `Settings.webPlayerSharedControls` (explicit `false` reverts a
  player to legacy vendor chrome, checkbox shown only when HTML5/Video.js/
  ArtPlayer is selected). Provides capability-gated advanced subtitles
  (HTML5/ArtPlayer: DOM file picker + native `TextTrack`, `::cue` styling,
  a ±0.5s timing-offset row, size/color styling in the shared `subtitleStyle`
  localStorage key; Embedded MPV frame-copy: helper protocol commands
  `sub-add`/`sub-delay`/`sub-scale`/`sub-color`, ASS supported); a per-session
  quality menu (Auto + level picks via `setQualityLevel`,
  `AUTO_QUALITY_LEVEL_ID` restores ABR) when the manifest exposes >1
  rendition (multi-variant HLS, DASH via Shaka variant tracks, Video.js via
  videojs-contrib-quality-levels) — single-bitrate VOD/raw MPEG-TS never show
  it, and Embedded MPV/external players report the capability false; a
  fullscreen channel/episode side panel (`FULLSCREEN_CHANNEL_PANEL`,
  `Settings.fullscreenChannelPanel`, default on); and shared
  picture-in-picture (`PlayerController.pictureInPicture`; Embedded MPV
  reports the capability false). Touch semantics
  (`ControlsSurface.wasTouchInteraction`): viewport taps toggle overlay
  visibility instead of pausing, volume popover opens on tap, coarse
  pointers get a taller scrub strip, and at container widths ≤640px the bar
  reflows to two rows (full-width timeline above transport, wrapping actions
  cluster with 40px buttons). Each web player owns focus-release rules so a
  control click doesn't leave keyboard shortcuts routed to the wrong element
  (`wasPointerInteraction`/`wasPointerFocusRelease`/`wasPointerClick` — only
  keyboard-originated focus pins the bar open; a completed pointer click
  releases the focus it left on the clicked control, but Space/Enter from a
  keyboard activation keeps focus so the shortcut still works). The
  fullscreen channel/episode panel slides a list over the video: opens via a
  left-edge hover dwell, touch tap, or `C`; an edge hint tab fades after 2.5s
  idle; hover-away closes after 1s once the pointer was inside the panel (so
  a `C`-opened panel survives mouse roaming over the video). Providers per
  host: M3U `VideoPlayerComponent` (`app-m3u-fullscreen-channel-list`),
  Xtream `LiveStreamLayoutComponent`, `StalkerLiveStreamLayoutComponent`,
  `UnifiedLiveTabComponent`; series playback gets the same panel as an
  episode list via `PortalInlinePlayerComponent`
  (`app-fullscreen-episode-panel`, built by `buildFullscreenEpisodePanelSeasons`
  from `seriesEpisodes`/`episodePlaybackPositions`/`seasonLoadStates`), and
  `C` also opens it there. Legacy vendor-chrome players (preference off) keep
  Space/K/F/arrow seek/M shortcuts via `LegacyPlayerShortcuts`. Full
  behavior, touch semantics, and focus-ownership rules:
  `docs/architecture/player-controls-contract.md`.
- Shared web picture-in-picture stays inside the same default-on rollout:
  `PlayerController` exposes capability `pictureInPicture`, state
  `pictureInPictureActive`/`canPictureInPicture`, command
  `togglePictureInPicture()`. `WebVideoControlsAdapter` supplies its current
  video and binding generation to `WebVideoPictureInPictureController`
  (`web-video-picture-in-picture-lifecycle.ts`); binding generation plus
  exact video identity protects replacement/teardown from stale completion,
  and a one-shot listener on a retired video closes late native/vendor PiP
  entries without touching another video's PiP. HTML5/Video.js/ArtPlayer use
  standard element PiP; shared ArtPlayer keeps vendor `pip: false`. Embedded
  MPV reports capability/state false with a no-op command and no
  popup/mini-window. AirPlay, Cast, Document PiP, and a PiP keyboard shortcut
  are out of scope.
- M3U Favorites/Recently Viewed resolve `Channel.drm` the same way as the
  main M3U player (`StreamResolverService`), and route DASH inline
  regardless of the configured player.

**Download Manager**:

- Fresh Xtream downloads propagate the playlist's User-Agent/Referer/Origin
  (falling back to `XTREAM_CLIENT_USER_AGENT`, including for legacy/orphaned
  rows — a headerless legacy row whose playlist is already gone still gets
  the fallback; a known Stalker row is unaffected). Allowlisted connection
  resets after bytes reach disk retain the partial under a credential-safe
  `DOWNLOAD_NETWORK_INTERRUPTED` code. Retry resumes with Range/If-Range when
  a strong validator exists, else rewinds through a verified 256 KiB overlap
  window (`download-overlap.ts`) whose bytes must match the partial's tail; a
  smaller partial is verified in full from byte zero and appended (never
  rewritten in place, and reported progress is floored at the retained size
  while appending); a mismatch restarts from byte zero rather than risking
  mixed-representation corruption. `download-reconnect.ts` auto-reconnects
  interrupted transfers: reconnects continue only while attempts end ≥64 KiB
  past the previous attempt, restarts are an explicit `task.transferRestarts`
  signal capped at twice per transfer, and three consecutive stalled attempts
  surface the retained failure. Only the response's own total authorizes
  completion — a falsified or indeterminate range never counts as done.
- The desktop-only manager shares one global download store across global,
  Xtream-scoped, and Stalker-scoped routes; missing completed files move to
  Needs attention. Series downloads go through the provider-neutral
  `SeasonDownloadCoordinator` over the existing single `DOWNLOADS_START` IPC
  (one active transfer, FIFO queue), reporting added/skipped/failed counts;
  `reason: 'already-in-progress'`/`reason: 'already-downloaded'` are the IPC's
  stable skip results. A restored file resolves as a stable skip via a
  bounded, coalesced filesystem recheck: a one-second caller deadline starts
  before shared-slot acquisition, the underlying FS op is coalesced and
  charged against a four-probe cap, and only `ENOENT`/`ENOTDIR` prove
  absence. `.part` cleanup before a completed-missing/failed/canceled row
  clears its path uses a separate same-path-coalesced four-operation cap with
  its own one-second admission deadline.
- Episode ownership: normalized `episode.id` is the canonical `xtreamId` for
  both providers; full playlist/series/season/episode coordinates are a
  fail-closed legacy fallback. Numeric season zero (incl. fallback key `"0"`)
  is a valid Specials coordinate for both providers. Stalker's
  `episode_identity_scope` distinguishes `/series`, embedded VOD `series[]`,
  and lazy Ministra VOD `is_series` — mismatched scopes are treated as
  ambiguous, not matched. SQLite `null` and optional `undefined` coordinates
  both mean an incomplete legacy row.
- Ready cards (movie/series/episode) open a focused local detail (Play, Show
  in folder, Copy URL, Remove in the overflow menu); downloads capture a
  versioned metadata snapshot (incl. TMDB) at start time, backfilled later if
  sparse/stale. `View in portal` resolves a concrete route with one-shot
  `provider-only` presentation (hides Offline/local/download actions) — a
  separate, non-`provider-only` bridge exists for inline collection details
  (see **Collection Detail Portal Handoff**). Rows and local files survive
  source deletion; only provider handoff is disabled until the source exists
  again.
- Live-TV recordings (Embedded MPV `stream-record`) live in their own
  `recordings` table (no playlist FK, survive source deletion). Stop only
  REQUESTS a stop (`addon.stopRecording()` is async); `EmbeddedMpvRecordingTracker`
  finalizes once the session snapshot confirms inactive (bounded 10s, and
  only a recording that never went active has its empty reservation unlinked
  — mpv's own bytes are never deleted), and `owner_pid` lets startup repair
  recover a hard kill's leftovers as `interrupted`/`failed`. Channel/EPG
  metadata is snapshotted at recording START, since provider EPG never
  reaches SQLite for post-hoc lookup. `EmbeddedMpvPlayerComponent` emits
  `recordingStopped` for every trigger, including the manager's own Stop
  bypassing the player's toggle; the host then enriches with programs
  overlapping the recorded window via `RECORDINGS_UPDATE_PROGRAMS`, which
  awaits only the tracker's write queue and matches the newest row for that
  path in ANY status (`finalize()` never touches `programs_json`, so the two
  writes are order-independent). Own `RECORDINGS_*` IPC plus a
  `RECORDINGS_UPDATE_EVENT` ping, and a separate `supportsRecordings`
  capability gate. `apps/tv` (which never loads the Embedded MPV addon) writes
  into this same table through its own `TvRecordingService` — a plain HTTP
  GET piped to a `.ts` file, MPEG-TS only — via a `tv:`-prefixed synthetic
  `sessionId` `RECORDINGS_STOP` dispatches on; `reconcileStaleRecordings()`
  unions both recorders' active-row ledgers. Contract:
  `docs/architecture/tv-recording.md`.
- Canonical contract: `docs/architecture/download-manager.md`; provider handoff:
  `docs/architecture/portal-detail-navigation.md`.

**Collection Detail Portal Handoff** (`View in portal` for inline details):

- Details opened outside portal category context — global favorites/recent
  and a portal's own `favorites`/`recent` tabs — render full-width with no
  category sidebar, plus a separate-row hero action that jumps to the item
  inside its owning portal. Visibility is DI-gated via `VIEW_IN_PORTAL_HANDOFF`
  (`app-view-in-portal-action`), never URL-sniffed; sole providers are the
  Xtream/Stalker collection detail components.
- Targets come from `getUnifiedCollectionDetailNavigation()`
  (`libs/portal/shared/util`), which NEVER degrades to a category-only route
  — an unresolvable item keeps the action hidden rather than landing in a
  list. Stalker's section resolution (`resolveStalkerCollectionDetailMode()`)
  must not be simplified to `item.contentType`, since embedded VOD
  `series[]`/lazy Ministra `is_series` items report `series` but belong in
  the VOD catalog. Stalker also carries a history-based return marker
  (`stalkerReturnTo`/`stalkerReturnByHistory`) so the collection's active
  tab/scope survives Back+Forward without re-navigating to the default tab:
  the marker carries the handed-off item's identity, not a bare `true`
  (`openStalkerItem` is consumed on arrival while the return keys stay on the
  entry); a stale marker suppresses the whole return contract, and honouring
  it retires both keys so browser Forward can't replay them for a reopened
  title. `CategoryContentViewComponent` also retires the contract when it
  lands on an entry with no handoff item and no open detail (plain browser
  Back runs no affordance). The identity is restricted to what
  `buildStalkerSelectedVodItem()` preserves (`id ?? stream_id`; it drops
  `series_id`/`movie_id`). Only this builder sets the marker, so the
  dashboard handoff and other `stalkerReturnTo` callers keep re-navigating
  instead of using history-return. Unlike the download handoff, this bridge
  does NOT pass `detailPresentation: 'provider-only'` — the full normal
  detail (downloads included) is wanted.
- Contract: `docs/architecture/portal-detail-navigation.md`.

**VOD/Series Detail Pages (two-state layout)**:

- Xtream and Stalker detail pages use `PortalDetailShellComponent`
  (`libs/ui/components/src/lib/portal-detail-shell/`) with two states:
  **Browse** (hero + actions, episodes below) and **Watch** (hero collapses,
  the inline player takes full width, metadata moves to an About block).
  Watch state derives from `inlinePlayback() !== null` only; external
  MPV/VLC playback keeps Browse. Esc and the now-playing bar's "Close player"
  exit to Browse without navigation; the shell's sticky back arrow is
  route-level back in both states (`goBack()`), so the bar carries no second
  arrow. `PortalInlinePlayerComponent` renders a centered 16:9 theater stage
  (opt-in `playerAmbientMode`, default off, **built-in web players only**,
  blurs the poster into the letterbox); for series on wide windows it instead
  docks left and shows an "Up Next" rail (`playerUpNextRail`, default on,
  **web players only**, gated on a ≥320px leftover-width check via
  `ResizeObserver` — narrower windows keep the centered stage, and movies/live
  never show the rail; the rail is opaque and sits on top of the ambient
  fill). In fullscreen the same host offers the whole series as the slide-in
  episode panel (see "Video Players").
- Xtream VOD separates metadata presentation from playability: sparse
  `get_vod_info` keeps the curated fallback page, while Play/Resume/Favorite/
  Download stay available whenever a positive stream id + container
  extension resolve from `movie_data` or catalog fields (never a synthetic
  combination of incomplete candidates) — playback fields are selected as one
  atomic pair in detail → recovered catalog → owner-valid cached catalog
  order. In-memory VOD categories/streams carry their owner playlist, so
  cross-portal Favorites/Recent details ignore arrays from another playlist
  (colliding Xtream ids can't inject stale data). When the normalized catalog
  cache lacks the extension, the loader immediately publishes the sparse
  fallback and ends loading, then does a best-effort category-scoped raw
  catalog lookup and reactively upgrades on success — it maps the SQLite
  route category through all persisted categories (incl. hidden), accepts a
  cross-portal `xtream_id` from Similar links, and drops late
  detail/recovery responses after replacement/reset/teardown. Stalker
  preserves the same contract for `/series`, embedded VOD `series[]`, and
  lazy Ministra `is_series` (`is_series` normalized only from `true`/`1`/`'1'`).
  A successful external MPV/VLC episode launch immediately persists the
  selected episode as the latest playback-position entry and retargets the
  series CTA to `Play episode N`; real player telemetry overwrites that
  marker when available, so episode identity is reliable while exact
  external timestamps stay best-effort. Lazy VOD episode tracking IDs scope
  the parent series, provider episode, original season key, and episode
  number (the previous season/episode hash is only a compatibility alias);
  exact scoped positions win over compatible legacy rows, and the scoped row
  is persisted through a strict failure-propagating boundary before confirmed
  legacy cleanup (a failed save keeps the old row).
- Seasons are tabs (`SeasonTabsComponent`, dropdown beyond 6 seasons — its
  rows/trigger carry a 28×42 season thumbnail when available, no placeholder
  otherwise) with a season cover (`SeasonContainerComponent`, TMDB-first then
  Xtream `seasons[].cover_big`) and auto-selection (playing → resume →
  earliest unwatched → latest non-empty season; Stalker lazy-VOD with
  unhydrated seasons falls back to the first season). Both portals expose a
  bulk season/series watched toggle — season: `buildSeasonWatchToggleRequest`,
  series: `buildSeriesWatchToggleRequest`/`SeasonWatchPresenter` (all in
  `libs/ui/components/src/lib/season-container/season-watch-toggle.util.ts`
  and `season-watch-presenter.ts`) — writing full-progress playback-position
  rows for unwatched episodes only (skipping the episode currently
  playing/launching), disabled while that content is actively playing. Xtream
  persists via batch IPC `DB_SAVE/CLEAR_PLAYBACK_POSITIONS_BATCH` (one SQLite
  transaction) and refreshes `XtreamStore.loadAllPositions`; Stalker loops a
  serialized position-mutation queue with legacy-row reconciliation. Stalker
  lazy-VOD hydrates unloaded seasons sequentially first
  (`loadEpisodesForSeason` single-flight per season) before a bulk toggle can
  run.
- Movies get the same manual watched toggle in the action row via
  `createVodWatchedToggle` (`libs/portal/shared/util/src/lib/vod-watched-toggle.ts`
  — movie scope only, not season/series): marking writes a full-progress
  `vod` position row (duration fallback: stored duration → provider
  `duration_secs` → 1s), unmarking deletes the row, both through a rejecting
  `*OrThrow` persistence boundary. Disabled while the movie plays inline or
  externally (the ~15s position tick would overwrite the row); acts only on
  the route copy's row (a pinned multi-source alternative keeps its own).
  Catalog cards on both portals derive their corner badge from shared
  `PortalWatchState` (`resolvePortalWatchState`, 90% threshold;
  `resolvePortalSeriesWatchState` caps a series at `in-progress` since list
  payloads never carry the episode total).
- Dashboard hero/Continue-Watching "Resume episode" carries a one-shot resume
  target through the global-recent handoff, consumed only after playback
  positions load (a failed load leaves it detail-only rather than restarting
  from zero). Continue Watching cards' DEFAULT click is detail-only
  (movie-like, issue #1441); their `⋮` menu (`buildDashboardContinueWatchingActions`)
  also offers "Mark as Watched" (`DashboardDataService.markRecentItemWatched`
  maxes the existing position row) and "Remove from history".
- See `docs/architecture/embedded-inline-playback.md` ("Two-State Detail Layout").

**VOD Multi-Source** (alternative sources for a movie, Xtream ↔ Xtream,
movies only, Electron only — Stalker/M3U/PWA are out of scope today):

- Finds the same movie in the user's other Xtream playlists and adds a
  "Sources N" chip to the VOD action row (a 660px anchored CDK-overlay
  popover, `libs/ui/components/src/lib/vod-sources/`; not `MatMenu`, capped
  at 280px), reused unchanged in the now-playing bar and the playback-error
  screen. It opens ABOVE the chip (right edges aligned), height-capped by the
  overlay's flexible bounding box so only the source list scrolls, and flips
  below when less than the overlay `minHeight` remains above. Filter chips
  (All/Available/HD+/language) and per-row language guesses
  (`vodSourceLanguage`, from the title's own prefix or an unambiguous
  category-name match — both parsed guesses) are browse-only — never
  ranking/failover inputs.
- **Metadata provenance is the core contract**: every field is
  `{value, provenance}` where `api`/`probe` are facts and `parsed` is a
  title-regex guess (`~` prefix); `factualOnly()` in
  `vod-source-metadata.util.ts` is the only accessor ranking/failover may
  read, so a guess is structurally unable to influence a decision. Quality is
  derived from pixel width (letterboxing crops height), but a known height
  vetoes the answer on every tier — a taller frame is a different shape
  (1440×1080 anamorphic/1600×900 are not 720p, 960×540 is not 576p) and gets
  no tag rather than a wrong one carrying `api` provenance.
- Title/category language-guess parsing (`vod-source-language.util.ts`) is
  intentionally conservative — it also backs `normalizeTitleKeys`'s
  tag-stripping for discovery matching, so a wrong rule doesn't just cost a
  filter option, it corrupts identity. Leading-tag stripping shares
  `PROVIDER_PIPE_CLASS`; a wrong prior version (case-insensitive/Cyrillic
  pipe matching) corrupted 349 keys on 1.27M real titles (e.g. "Момо | Momo"
  — the name sits in the tag position). A strip leaving no real word behind
  is checked against `TRAILING_TAG_VOCABULARY` or a fixed prefix-only list
  (`NF`, `EX`, `NRC`, `AMZ`, `D+`, `P+`, `OSN`, `VO`, …; matched by a
  compound token's HEAD, so `4K-*` strips but "INU-OH"/"PC-4L" don't) —
  verified against the real catalog over both movies AND series before
  widening, since a movie-only derivation once missed `AMZ`/`D+`/`P+` and
  broke the numeric series 1923, 1883, 24, and 9-1-1.
- Probe checks run through a 4-slot queue; settled verdicts are cached 10 min
  per movie+source (`VodSourceProbeCacheService`).
- Discovery (`DB_FIND_TITLE_SOURCES`, trigram FTS over `content_title_fts`,
  GLOB scan fallback for titles too short to index) excludes the current
  playlist in SQL (except a `keepContentId` row the caller names, e.g. a pin
  pointing at another copy in the currently-viewed playlist). FTS keeps a
  60-row relevance-ranked window; the scan has no row limit since it can't
  rank. The year gate applies to both tiers but differently: the base tier
  accepts a bracketed-or-trailing year (it just stripped a trailing year),
  the exact tier accepts bracketed only (once titles match exactly, a
  trailing number is part of the name, e.g. "Blade Runner 2049"), so a
  stripped-bracket title like "Dune (1984)" never false-matches an unrelated
  year. `caseInsensitiveGlobPattern` folds non-ASCII case (GLOB's `LOWER()`
  is ASCII-only) by emitting one `[lowerUpper]` character class per
  character.
- Switching source is one `inlinePlayback.set({...next, startTime})` (never
  null-then-set) so the player survives and re-seeks; the carried position is
  read before the 15s persistence throttle, and a one-shot `resumeSettled`
  latch stops the resuming engine's first `timeupdate` from clobbering the
  resume point. Portal failures in this path log through the redacting
  `createLogger`/`redactSensitiveData` — an Xtream error message carries the
  stream URL, built from username and password.
- Pins (`vod_source_pins` table) are keyed portal-agnostically
  (`tmdb:{id}` → `title:{base}:{year}` → yearless fallback) via `pinKeysFor`:
  `lookup` passes every alias most-trusted-first, `write` holds only keys
  naming exactly one film (so an early title-only pin is still found once
  TMDB enrichment later resolves a better key), and `loaded` records where
  the pin on screen was found. A pinned source outranks everything else in
  failover ranking and in the primary Play action. `ownsContent()` is one
  shared predicate used by both the session matcher and the playback-position
  bridge, so an external-player session for an alternative source and its
  progress tracking never disagree about which copy is active. Two identity
  keys: `vodMultiSourceMovieKey` (title/year/tmdbId — triggers discovery
  rebuild) vs. `vodMultiSourceSessionKey` (`playlistId:contentId` — decides
  refresh vs. new session).
- Auto-failover (`Settings.vodAutoFailover`, opt-in, web engines only — the
  toggle is hidden in Settings and the sources menu on MPV/VLC/Embedded MPV,
  since only built-in web players raise the playback diagnostic that
  triggers it) tries each source at most once per session
  (`triedSourceIds` only grows) but SELECTION is not an attempt:
  `setActiveSource` only selects, `markPlaying` spends the turn, and
  `runFailover` retires whatever is on screen before picking — so discovery
  or a pin selecting a candidate before anything plays can't burn a healthy
  fallback. It continues past candidates that fail to resolve rather than
  stopping at the first one. Never auto-switches silently (toast names the
  destination + Undo), and warns "dub may differ" only when both sides state
  a spoken `audioLanguage` as fact (never inferred from codec, since AAC/AC3
  routinely carry the same dub while two AC3 tracks can carry different
  ones).
- HEAD probes reuse `apps/electron-backend/src/app/events/stream-probe.ts`
  (`STREAM_PROBE_URL`) and carry the playlist's own headers; no ffprobe.
- See `docs/architecture/vod-multi-source.md`.

**Radio Player**:

- Dedicated audio player for channels with `radio="true"` M3U attribute
- Cinematic layout: blurred station logo as backdrop, floating artwork card, transport controls
- Always uses the built-in inline player — external player settings (MPV/VLC) are ignored for radio
- EPG panel is hidden for radio channels (radio streams have no EPG data)
- Volume synced with video player via shared `localStorage` key `'volume'`
- Keyboard shortcuts: ArrowUp/ArrowDown (volume), M (mute)
- Component: `libs/ui/playback/src/lib/audio-player/audio-player.component.ts`

**EPG (Electronic Program Guide)**:

- XMLTV format support, from `http(s)` links or local files (Electron only): a `file:` URL, an absolute POSIX path, or a Windows drive/UNC path, plain `.xml` or gzip (detected by signature). A folder button beside each row opens the native picker (`EPG_OPEN_FILE_DIALOG`, `RuntimeCapabilitiesService.supportsEpgFilePicker`). Shape rules: `classifyEpgSourceReference` in `libs/shared/interfaces`; the worker opens both kinds through `openEpgSourceStream` (`workers/epg-source-stream.ts`). Only hand-chosen sources may be local: `extractM3uEpgUrls` harvests only remote links from M3U headers (legacy stored non-remote entries are dropped unless manual), and `EpgWorkerService.startFetch` asks the main-process `EpgLocalSourceAuthorizer` before a local path reaches the worker — picker results are trusted, a typed path is confirmed once in a native message box, allowed paths persist under `TRUSTED_LOCAL_EPG_SOURCES`, and the worker's local branch requires the main-set `allowLocalFile` flag (deny-all until wired). Contract: `docs/architecture/m3u-playlist-module.md` ("Local XMLTV files")
- Background parsing in worker thread; HTTP/file gzip compatibility follows `docs/architecture/m3u-playlist-module.md` ("XMLTV response compression").
- Stored in database for quick lookup
- Global display-time offset (`Settings.epgOffsetMinutes`, Settings → EPG, ±720 min, Electron only): display-only, provider data is never rewritten. Two equivalent forms in `libs/shared/interfaces/src/lib/epg-display-offset.util.ts` — `epgDisplayTimeMs` (shift the programme; `ui/epg` rendering via the `offsetMinutes` input, channel rows, dashboard/recording labels; the programme dialog and the programme guide read the store themselves) and `epgProviderClockMs` (shift "now"; every "currently airing" decision: the `GET_CURRENT_PROGRAMS_BATCH` lookup takes an explicit `nowMs` and `EpgService` tags its cache with the offset, Xtream/Stalker/M3U current-programme selection and previews, the unified collection resolver, dashboard progress, recording overlap). A consumer applies exactly one form per comparison. Contract: `docs/architecture/m3u-playlist-module.md` ("EPG display offset")
- Programme guide (Electron, M3U): `app-epg-guide` in `libs/ui/epg` fed by the host-provided `EPG_GUIDE_SOURCE`; the M3U host switches into guide mode (docked player strip, no sidebar/timeline, no remount) from the header action, the palette, the EPG panel's Guide button (timeline or list view) or `G`. Data: `EPG_GET_PROGRAMS_FOR_CHANNELS` / `EPG_GET_PROGRAM_COVERAGE` (keys resolved in main; manual mappings honoured). Contract: `docs/architecture/m3u-playlist-module.md` ("Programme guide").
- Manual EPG mapping (Electron only): right-click a channel in any list (M3U views, Xtream portal list, Stalker ITV sidebar, global favorites) → "Map EPG channel" attaches it to an uploaded-XMLTV channel; stored in `epg_channel_mappings` keyed by the M3U lookup key or a playlist-scoped portal key (`xtream:{playlistId}:{id}` / `stalker:{playlistId}:{id}`, helpers in `libs/shared/interfaces/src/lib/epg-mapping-key.util.ts`); resolved on every EPG path (single + batch IPC lookups, portal detail views, preview queues); dialog: `libs/ui/components/src/lib/channel-list-container/epg-mapping-dialog/`

**TMDB Metadata Enrichment** (opt-in):

- Enriches Xtream/Stalker VOD/series detail views (plot, cast, director,
  genres, rating, artwork, trailers) via a field-level merge — the provider
  stays authoritative for stream data and any field TMDB can't fill. The M3U
  player consumes it too for recognized movie files (`Settings.m3uVodDetails`,
  default on — see "M3U Movie Recognition" above).
- "Similar" rail in all detail views matches TMDB recommendations against the
  catalog by normalized title (`tmdb-similar.util.ts`); cross-portal matches
  from other Xtream playlists supplement/power it (`CrossPortalSimilarService`,
  batched `DB_MATCH_TITLES`, Electron only).
- Season/episode enrichment lazily fetches `/tv/{id}/season/{n}` and overlays
  real names/overviews/stills (`mergeEpisodesWithTmdb`); an explicit season
  marker in the title overrides the provider's renumbered season.
- Dashboard: opt-in "Trending this week" and "Because you watched" rails
  (`dashboardRails.tmdbTrending`/`tmdbRecommendations`), plus hero backdrop/
  rating/genre extras — all load async after first paint, matched via
  `DB_MATCH_TITLES` and various lookup-identity/exclusion helpers in
  `dashboard-tmdb-lookup.util.ts`.
- Actor pages (`actor/:personId`) show TMDB bio + filmography; clickable cast/
  director chips. Discover pages (`discover` route) offer clickable year/
  genre/country chips gated on `TmdbEnrichmentService.isEnabled()` (never on
  `typeof tmdb_id`, since a provider-sent id can predate enrichment).
- Match confidence: a provider `tmdb_id` is a hint, not gospel
  (`assessProviderId` weighs title/year agreement; a 404 marks the id
  permanently dead). Without a usable id: normalized-title + year (±1) search
  with a strict gate — no confident match means no enrichment.
- Opt-in via `Settings > Metadata (TMDB)`; distributed builds ship without a
  shared key (`DEFAULT_TMDB_API_KEY` is empty), users supply their own — this
  is project policy, not a TMDB terms restriction.
- Cached in SQLite `tmdb_metadata` (Electron) or in-memory (PWA), localized by
  app language. Search queries use `cleanTitleForSearch` (provider spelling),
  never the folded `normalizeTitle` key used for matching — Cyrillic/Arabic
  NFD folding can make TMDB return nothing for the folded form.
- Service layer: `libs/services/src/lib/tmdb/`; store glue in each portal's
  `data-access/.../*-tmdb-enrichment.ts`. TMDB attribution is required and
  shown in Settings and About.
- See `docs/architecture/tmdb-metadata-enrichment.md`.

**Portal Account Info**:

- Both portal types expose an account-info dialog through the same entry points: header playlist switcher (bottom section for the active playlist + per-row ⋮ menu), dashboard source card ⋮ menu, and the command palette. Gates use the shared predicates in `libs/shared/interfaces/src/lib/portal-account-playlist.utils.ts`; `WorkspaceShellHeaderService.openAccountInfoFor()` picks the dialog by playlist type.
- Xtream: `AccountInfoComponent` (`libs/portal/xtream/feature/src/lib/account-info/`), queries `get_account_info` live.
- Stalker: `StalkerAccountInfoComponent` (`libs/portal/stalker/feature/src/lib/stalker-account-info/`), cached-first — renders the import-time `stalkerAccountInfo` snapshot instantly, then `StalkerAccountInfoService` refreshes, routing by the observed portal MODE rather than the URL shape (full mode: handshake+`get_profile`; simple mode: best-effort `account_info/get_main_info`, nested `js.account_info` envelope or flat fields), and re-routing when a lazy repair changes the mode mid-request. Details: `docs/architecture/stalker-portal.md` ("Account Info Dialog").
- Dashboard source cards carry a passive subscription-expiry chip (amber within 7 days, error-toned once expired); account details remain behind ⋮ → Account info. `DashboardSourceExpiryService` (`libs/workspace/dashboard/data-access/`) gathers the facts: Xtream from `PortalStatusService.checkPortalStatusDetails()` (the switcher's cached status check, now carrying `exp_date`), Stalker from the persisted `stalkerAccountInfo` snapshot — it lives in the playlist payload, not on meta rows, so each Stalker source costs one memoized full-playlist read.

**Stalker Portal Mode and Endpoint Discovery**:

- Every resolved Edit commit is guarded by the source connection authority
  captured when Edit began (Electron: per-playlist write queue; PWA: one
  IndexedDB readwrite transaction plus a shared playlist-authority barrier and
  an origin-wide per-playlist Web Lock), so another tab/dialog cannot
  interleave a replacement, and delete/restore under the same playlist ID
  aborts stale writes.
- Portal mode (full vs. simple) follows OBSERVED behavior, never a URL
  substring: the single predicate is `isFullStalkerPortalPlaylist()` /
  `isFullStalkerPortalUrl()` in `@iptvnator/shared/interfaces`
  (`stalker-portal-mode.util.ts`) — the persisted `Playlist.isFullStalkerPortal`
  flag is authoritative, URL shape is a legacy-row fallback only. Three
  diverging copies of this rule used to exist and shipped broken
  configurations (#850/#686/#755) — never re-implement it. A token-enforcing
  `portal.php` panel is full; a token-free `server/load.php` is simple.
- Import probes candidates in order (a pasted `.php` endpoint, then
  `<base>/portal.php` → `<base>/server/load.php` →
  `<base>/stalker_portal/server/load.php`) and classifies each by behavior;
  `StalkerPortalDiscoveryService` persists the proven endpoint and mode. An
  unreachable panel-style import remains allowed with a warning; a bare host
  falls back to `<base>/portal.php`, while canonical-shaped unreachable
  addresses still abort. If bounded discovery returns while abandoned
  authentication remains on the wire, the refusal is shown immediately but
  Add and every form field stay disabled until its settlement promise
  resolves.
- The playlist-info Edit dialog loads the COMPLETE persisted row before
  enabling the form (Electron's startup projection omits payload-only
  serial/device/mode fields) — a summarized row must never render and then
  persist an empty portal identity. A metadata-only Save omits
  connection/mode fields and skips discovery. Changing connection fields
  blocks duplicate saves and re-runs discovery through
  `STALKER_PLAYLIST_CONNECTION_EDITOR`. Before discovery, PWA acquires a
  shared playlist-authority barrier plus an exclusive origin-wide
  per-playlist Web Lock (Add/delete/backup-restore/bulk-replacement take the
  same row lock; Delete All takes the barrier exclusively). Same-tab Save
  first publishes its local authentication owner and drains an existing lazy
  repair through actual Web Lock completion before requesting the row lock;
  PWA fails closed if Web Locks are unavailable, Electron relies on its
  single-instance local ownership. The reservation blocks every new
  authentication/repair and rechecks ownership after each async drain/rebase.
  Once Save starts, navigation or dialog teardown never discards a later
  successful `get_profile` result — it may already have pinned the submitted
  serial/device identity remotely and cannot be recalled — so Success uses
  one awaited write to atomically replace endpoint/mode/identity/session
  metadata before the state-only NgRx update, and the commit merges only
  connection/session fields via `transformPlaylistMeta()` inside the write
  queue.
- `executeStalkerRequest()` (`stores/utils/stalker-request.utils.ts`) is the
  choke point for catalog/content/playback requests: mode routing, the
  in-session repair override, and retry-once all live there. `StalkerAuthApi`,
  `StalkerPortalDiscoveryService`, `StalkerAccountInfoService.fetchViaProfile()`
  and the row-less `StreamResolverService` branch are the only callers outside
  it (they run below or before the thing it routes on). Anything new that is
  not auth or discovery belongs on `executeStalkerRequest()`.
- Existing playlists are repaired LAZILY (`StalkerPortalRepairService`) — only
  after a request fails with a wrong-endpoint/mode shape, at most once per
  source configuration per playlist per session, persisted atomically. There
  is deliberately **no eager one-shot migration**: a working portal is never
  re-probed. Each repair installs a session-level authentication fence
  synchronously, drains the existing token slot before probing, and keeps
  request routing ahead of effective-connection selection until repair
  finishes; an abandoned transport keeps both the repair and session fences
  until it actually settles. Explicit Edit advances the repair generation
  before installing its resolved session; lazy repair captures that
  generation before any probe-history row read and rechecks it against the
  active Edit fence before reserving discovery, so a repair that started
  earlier is discarded rather than restoring an older endpoint/mode/token
  after Edit commits.
- Both transports build the wire format from the same shared builders in
  `@iptvnator/shared/interfaces` (`buildStalkerRequestUrl()`,
  `buildStalkerIdentityRequestContext()`, `encodeStalkerCmdValue()`) — never
  fork them. Simple portals skip the auth lifecycle but still carry
  MAC-derived headers; they never carry the serial (`SN`/`__cfduid`), even
  though `buildStalkerExternalPlaybackHeaders()` sends it with no mode check.
- Contract: `docs/architecture/stalker-portal.md` ("Portal Mode and Endpoint
  Discovery", "Request Transport and `cmd` Encoding").

**Stalker Session Authentication**:

- Full portals authenticate through `StalkerSessionService`
  (`libs/portal/stalker/data-access/src/lib/stalker-session.service.ts`), a
  facade over auth API, authenticated request client, edited-session
  coordinator, watchdog controller, token cache (fingerprint-tagged), and
  session store.
- `get_profile`'s `js.status`: `0` = OK, `1` = refused (`device-conflict` or
  `blocked` by message), `2` = login required → `do_auth` then `get_profile`
  with `auth_second_step=1`. A bare `{status: 1}` with no message is still a
  refusal. Credentials come from the import dialog's username/password
  fields and are persisted so runtime re-auth can repeat `do_auth`; status is
  read through a numeric coercion since portals stringify it. Refusals throw
  `StalkerPortalError` carrying the portal's markup-stripped text — read it
  with `asStalkerPortalError()`, never `instanceof` in lazy-loaded code.
  `isStalkerDeviceConflictMessage` (narrow phrase set, structured `msg` only)
  splits `device-conflict` off from `blocked` — it's the one refusal with a
  remedy, and the portal's own "Your STB is damaged" wording points away
  from it, so both surfaces lead with their own headline and append the
  portal text. Auth failures are HTTP 200 + plain text, classified at the
  transport boundary; the Electron handler **returns** a
  `{stalkerAuthFailure}` marker rather than throwing (`ipcRenderer.invoke`
  strips custom properties off rejections).
- The handshake is idempotent: `Playlist.stalkerToken` is re-presented and
  `get_profile` skipped when unchanged, unless `stalkerSessionFingerprint`
  (endpoint origin+path+userinfo + identity + credentials) no longer matches
  — an edited endpoint/MAC/login must never inherit the previous session.
  Discovery preserves tenant base paths, so `/tenant-a/server/load.php` and
  `/tenant-b/server/load.php` are different portals on one host and must not
  share a session; URL parsers omit `user:pass@` from `origin`, so userinfo
  is tracked separately while endpoints without it keep their previous
  fingerprint across upgrades. The advertised watchdog cadence is persisted
  alongside the token precisely because that reuse skips the response
  carrying it, so a legacy token-only playlist profiles once instead of
  being stranded on the default — the effective cadence is stored, so stored
  absence means "never profiled" and nothing re-profiles on every start.
- Watchdog: `get_events` immediately (`init=1`), then every `watchdog_timeout`
  s (default 120, clamped 30–3600) offset by `timeslot`. A missed ping never
  invalidates auth, it only affects the portal's "online" reporting.
- Full contract: `docs/architecture/stalker-portal.md` ("Session
  Authentication Lifecycle").

**Stalker Identity Hardening**:

- MAC is canonicalized to `00:1A:79:XX:XX:XX` by `normalizeStalkerMacAddress`
  at the INPUT boundary only (import/edit dialog); stored MACs are never
  rewritten on read — the MAC is the account key, and a transport-level
  rewrite would move `stalkerSessionFingerprint` for every existing playlist
  with no user action.
- Format is enforced; the Infomir OUI is advisory only (`hasInfomirMacOui`) —
  the stock filter is off on most reseller panels, so refusing a non-Infomir
  MAC would lock out working setups (`AUTH_REJECTED_MAC` in `stalker.e2e.ts`
  relies on a non-Infomir MAC being importable). The edit dialog additionally
  grandfathers the stored value via `createStalkerMacAddressValidator` — a
  pre-validation playlist may hold arbitrary text, and blocking Save would
  strand its title/URL/EPG edits too.
- `deriveStalkerDeviceIdsFromMac` derives the StbEmu / `stalker-to-m3u` pair
  (`SHA256(MAC)` / `SHA256(MAC + 'stalker')`), offered as an opt-in checkbox
  at import only and persisted as literal strings — never recomputed at
  request time. They must differ — a real box reports them from separate
  firmware calls and never equal, and the pinning is permanent, so an
  identical pair could never be corrected. The portal pins the first
  non-empty device id to the MAC forever and treats a later empty value as a
  permanent lockout, so a value that silently followed a MAC edit would be
  unrecoverable; the edit dialog offers no derivation and shows
  `DEVICE_ID_PINNED_WARNING` once an ID is stored.
- `get_profile` reports one coherent MAG250 via `STALKER_STB_PROFILE_PARAMS`
  (`ver`, `stb_type`, `hw_version`, `image_version`, `client_type`,
  `num_banks`, `video_out`, `hd`) — constants, identical per playlist,
  deliberately outside both fingerprints.
- Contract: `docs/architecture/stalker-portal.md` ("Stalker Identity Policy").

**Favorites and Recently Viewed**:

- Per-playlist favorites and global favorites
- Recently viewed tracks watch history
- Live channels in the unified favorites/recent live tab (global collections
  and a portal's own tabs) carry the live counterpart of the VOD "View in
  portal" handoff: `getLiveCollectionPlaylistNavigation()`
  (`libs/portal/shared/util`) resolves the channel INSIDE its playlist —
  Xtream via `buildXtreamNavigationTarget` + `openXtreamLiveItemId` (the live
  layout's auto-open service plays it), M3U via `/workspace/playlists/:id/all`
  + `openM3uChannelUrl` (the player selects it by URL); Stalker resolves to
  `null` until its ITV layout gets an open-on-arrival contract, so the
  affordance is hidden there rather than landing on the section root. Two
  surfaces share that verdict: `app-open-in-playlist-chip`
  (`libs/portal/shared/ui`), projected into the EPG timeline/list-view
  toolbars through their `[epgToolbarAction]` slot beside the channel name
  (visible collapsed too; absent for radio and without EPG support), and an
  "Open in <playlist>" row in `app-global-favorites-list`'s context menu
  (`openInPlaylistRequested`), which also covers radio rows. Both label with
  `playlistDisplayLabel` and reuse `PORTALS.VIEW_IN_PORTAL_TOOLTIP`; the tab
  navigates. Contract: `docs/architecture/portal-detail-navigation.md`.

**Internationalization**:

- Uses `@ngx-translate` with 19 language files in `apps/web/src/assets/i18n/`

## Development Notes

### Environment Detection and Dual-Mode Architecture

The app determines whether it's running in Electron or as a PWA by checking:

```typescript
window.electron; // truthy in Electron, undefined in browser
```

**Why Dual Mode?**
IPTVnator supports both Electron (desktop app) and PWA (web browser) to provide flexibility:

- **Electron**: Full-featured desktop experience with local database, external player support (MPV/VLC), and native file system access
- **PWA**: Lightweight web version that runs in any browser without installation

**Environment-Specific Behavior**:

- `app.config.ts` - `DataFactory()` selects DataService implementation based on environment
- `app.routes.ts` - Same `/workspace/...` route tree in both environments; guards keep Electron-only routes (e.g. global search) out of the PWA
- Storage layer switches automatically:
    - Electron → SQLite/Drizzle ORM → `~/.iptvnator/databases/iptvnator.db`
    - PWA → IndexedDB → Browser storage
- External player support (MPV/VLC) only available in Electron
- File system operations only available in Electron (uploading playlists from disk)

**Base Href Configuration**:
The app uses different base href values depending on the build target:

- **Development & PWA**: `baseHref="/"` (from `index.html`)
    - Used by: `pnpm run serve:frontend`, `pnpm run build:frontend:pwa`
    - For web servers with proper routing
- **Electron Production**: `baseHref="./"` (overridden in build config)
    - Used by: `pnpm run build:backend`, `pnpm run make:app`
    - Required for `file://` protocol in Electron

Build configurations in `apps/web/project.json`:

- `production`: Electron build with `baseHref="./"`
- `pwa`: Web deployment with `baseHref="/"`
- `development`: Dev mode with `baseHref="/"` from index.html

**Factory Pattern Implementation**:
The factory pattern ensures a single codebase works in both environments without conditional checks scattered throughout the application. All environment-specific logic is encapsulated in the service implementations.

**Build Commit In About**:
CI injects the git commit into `apps/web/src/environments/build-commit.ts` via `tools/build/inject-build-commit.mjs` (same placeholder pattern as the TMDB key inject); `Settings > About` then shows `"<version> (<short-sha>)"`. The semver version itself stays untouched on PR and tag builds — a `-sha` suffix would flip electron-updater into prerelease mode and leak into installer/artifact version fields. Local/dev builds keep the placeholder empty and show the plain version.

**Nightly Builds And Update Channel**:
Master pushes are the nightly channel. The leading `nightly-version` job computes one `<patch>-nightly.<commit date>.<run number>` version per run (`tools/release/nightly-version.mjs`; the patch is bumped only when `v<package.json version>` already exists on origin, so the release-cut window stays below the imminent release), every build job writes it into `package.json` and sets `publish[0].channel: nightly` in `electron-builder.json` (`--apply --version`; electron-builder does not derive the channel from the prerelease tag for the GitHub provider), and the `create-release` job publishes the artifacts as a prerelease of `4gray/iptvnator-nightly` (secret `NIGHTLY_RELEASE_TOKEN`; missing token only warns) instead of the rolling `test-master` draft, keeping the newest 20. the explicit publish channel names the updater metadata `nightly-mac.yml` / `nightly.yml` / `nightly-linux.yml`, and upload globs plus the macOS merge accept both names. `Settings.updateChannel` (Settings → About, Electron only, default `stable`) is mirrored into the main-process config (`APP_UPDATE_CHANNEL`, `app-update-channel.ts`) for the startup check; `AppUpdateService` applies the channel to electron-updater before every check (`app-update-feed.ts`: feed repository, `allowPrerelease`, channel name, and `allowDowngrade` forced back to `false` — assigning a channel silently enables downgrades) and reads release notes from the repository the requested version belongs to (`AppUpdateReleaseCatalogs` in `app-update-release-notes.ts` over `app-update-release-catalog.ts`; a catalog is a process-lifetime snapshot, so a version missing from a fully paged list reloads it once, readers of one catalog are serialized through `runExclusive` because that reload rebuilds the array under an index another reader holds, and a newly found update drops every catalog — otherwise a nightly published after startup had "no release notes"; the dialog recognises that rejection by the shared `APP_UPDATE_RELEASE_NOTES_NOT_FOUND_MARKER` text and links to the channel's release list). Switching back to stable is forward-only: the nightly stays until a newer stable release exists, because a downgrade could hit a database schema a nightly migration already applied. The About section's status badge names the channel the verdict describes (`status.verdictChannel`, stamped by every check and kept across a channel change saved mid-download, since that download still belongs to the old channel), and while the select shows an unsaved other channel the plain "Check again" becomes "Save and check for <channel> updates" (submits the form; `setChannel` re-checks on its own) — a check against an unsaved channel is deliberately not offered. Contract: `docs/architecture/release-pipeline.md` ("Nightly channel").

### Testing Strategy

- **Unit tests**: Jest with `jest-preset-angular` and `ng-mocks`
- **E2E tests**: Playwright testing the web app and Electron app
- Backend tests use standard Jest
- Bug fixes should add focused regression coverage unless there is a documented reason not to.
- Use the impact-based validation policy in `Regression Prevention And Test Updates` to choose targeted unit tests, atomized E2E targets, broad suites, or CDP/manual verification.

### Nx Commands

Use `nx` CLI for better performance:

```bash
pnpm nx run <project>:<target>
# Example: pnpm nx run web:build
# Example: pnpm nx run electron-backend:serve
```

To run multiple projects:

```bash
pnpm nx run-many --target=test --all
```

### Electron Build Process

The Electron backend depends on the web app being built first:

- `electron-backend:build` depends on `web:build`
- Output goes to `dist/apps/electron-backend` (backend) and `dist/apps/web` (frontend)
- Packaging combines both into distributable

### Database Migrations

Database initialization is owned by `libs/shared/database/src/lib/connection.ts`. `createTables()` creates missing schema objects, and `runMigrations()` applies column/index migrations and dedicated schema/data upgrades. `CREATE TABLE IF NOT EXISTS` does not add columns to existing tables. One-off data migrations use completion keys stored in `app_state` (exported as `appState`). Follow the Upgrade And Migration Compatibility policy above and the validation guidance in `libs/shared/database/README.md`; a new release must not depend on users having launched intermediate releases.

### Common Patterns

**IPC Communication**:

1. Define handler in appropriate events file (e.g., `database.events.ts`)
2. Register with `ipcMain.handle()` in the event bootstrap function
3. Expose in preload script via `contextBridge.exposeInMainWorld()`
4. Call from Angular via `window.electron.<methodName>()`

**Adding New Playlist Source**:

1. Add type to `libs/shared/interfaces/src/lib/playlist.interface.ts`
2. Create event handler in `apps/electron-backend/src/app/events/`
3. Add the import flow in `libs/playlist/import/feature/` (add-playlist dialog + per-source import components) and surface it on the dashboard (`libs/workspace/dashboard/`) if needed
4. Update database schema if needed

**State Management**:

- Use NgRx for global application state (M3U playlists, `libs/m3u-state`)
- Use NgRx Signal Store with `signalStoreFeature()` composition for portal/feature state (XtreamStore, StalkerStore)
- Use NgRx signals for reactive data streams

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

## XMLTV Response Compression

Electron decodes HTTP compression before the gzip file layer. For `.gz`/gzip
metadata plus HTTP gzip, a streaming signature check unwraps one remaining
file layer while preserving single-layer providers. Errors and cancellation
close the decoding chain. Contract: `docs/architecture/m3u-playlist-module.md`
("XMLTV response compression").

## XMLTV Source Removal

Saving Settings → EPG reconciles cached XMLTV with committed global URLs and
all enabled M3U playlist sources. Startup runs the same reconciliation after
settings load and playlist migration. Ordinary saves skip unchanged normalized
source sets; an explicitly edited EPG field can retry a failed cleanup.
A cleanup failure after persistence still mirrors committed settings to Electron;
the form stays dirty for retry. Failed storage writes never mirror to main.
Failed settings reads and incomplete playlist migration never authorize pruning.
Removed sources retire queued/running imports and dismiss retained error rows
before worker-owned deletion. Retry waits for reconciliation and rechecks its
error row, including after trust-setting writes. Shared channel IDs survive while
another source has programmes or per-source channel metadata. The additive
`epg_channel_sources` table preserves each imported source's name, logo, URL and
timestamp plus transaction-ordered `write_order`, so removal restores the latest
surviving snapshot even when import timestamps tie; ambiguous legacy metadata
falls back to the XMLTV ID until reimport. Manual mappings remain user preferences, but no
longer resolve deleted data. Renderer lookup generations, Xtream previews and Stalker mapping-cache
invalidation prevent late results from restoring removed programmes. Provider
EPG is independent. See `docs/architecture/m3u-playlist-module.md`
("XMLTV source lifecycle").

## Web Backend Provider Redirects

All four provider proxy routes use `ValidatedHttpClient`: automatic redirects
are disabled, the initial URL and at most five redirect hops pass full URL/DNS
validation, and fresh agents pin each connection to that hop's validated IPs.
Host/SNI and TLS verification remain intact; outbound environment proxies are
disabled. Private-network opt-in applies to the chain. Cross-origin redirects
strip session headers; original query params are not replayed. One portal
admission owns the entire chain and final body, with explicit redirect evidence
preventing destination failures from penalizing the initial endpoint. Contracts:
`docs/architecture/pwa-self-hosted.md` and
`docs/architecture/host-connectivity-guard.md`.

## Portal Connectivity Preference

- Half-open trial slots follow the complete request lifetime with no elapsed-time
  expiry. All four Electron/web-backend portal handlers release in `finally`,
  independently of outcome reporting; cleanup preserves trial/epoch ownership
  and works while the environment override is disabled. Contract:
  `docs/architecture/host-connectivity-guard.md` ("Trial ownership follows the
  request lifetime").
- Desktop Settings > General > Portal connections exposes default-on
  `Settings.portalConnectivityGuard`. Only explicit false opts out. Save mirrors
  the value to Electron `PORTAL_CONNECTIVITY_GUARD` and applies it without restart;
  settings bootstrap restores it before the renderer loads. It controls Xtream
  and Stalker together. Preference transitions clear cooldowns and invalidate old
  request completions; unchanged saves preserve evidence. The environment switch
  `IPTVNATOR_DISABLE_CONNECTIVITY_GUARD=1` remains authoritative. PWA clients do not
  control the shared backend's guard.
- Both account-info dialogs explain guard refusals with localized paused-request
  copy and Retry now; Stalker preserves cached account data on a failed refresh.
  Contract: `docs/architecture/host-connectivity-guard.md`.

## Live TV Panel Levels

Portal live layouts (Xtream `live`, Stalker `itv`/`radio`) fold their panels
from the outside in, in three nested levels owned by `LiveSidebarState`
(`@iptvnator/portal/shared/util`): `expanded` (categories rail + channels rail
+ player), `categories-hidden` (channels rail + player) and `collapsed`
(player only). `LiveLayoutSidebarStateService` is the single source of truth, per
surface (`m3u` / `portal` / `collection`; the levels apply to `portal`); the
shell context sidebar folds the categories rail on
`areCategoriesHiddenFor('portal')` (at level 2 only while the portal store has
a selected category — the live root has no channels header to host the way
back — and always at level 3), the channels rail folds on
`isCollapsedFor('portal')`. While the rail is folded the
channels header turns its title into a category dropdown that opens the same
`WorkspaceContextPanelComponent` as a CDK popover through the
`LIVE_CATEGORIES_POPOVER` token: the workspace shell provides
`WorkspaceLiveCategoriesPopoverService` (focus-trapped `role="dialog"`,
closed by backdrop, Escape, selection, its footer and any `NavigationStart`),
the live layouts reach it through `createLivePanelsController()` (level
flags, dropdown bridge and focus handoff in one shared object; the token is
optional). `Cmd/Ctrl+B`, the header toggle and the
floating restore handle return to the level the user collapsed from (the
target is session-only; every level is restored as stored per surface).
Folded rails carry `inert`, and
`handoffFocusOnLiveSidebarChange()` / `focusIfFocusLost()` move focus to the
replacement affordance only when the activated button was removed or inerted.
M3U and the unified live tab have no categories rail and treat level 2 like
level 1. Contract: `docs/architecture/iptvnator-ui-guidelines.md`
("Collapsible Live Sidebar").

## Live Channel Return

Xtream and Stalker (including radio) capture displayed playback order on explicit
selection. Remote up/down, numbers and status use that queue while browsing
categories or search. Stalker commits after successful current URL resolution
and extends only loaded pages of the original scope. The conditional channel
header action clears search, returns to the accessible playing category and
focuses its row without changing playback. Contract:
`docs/architecture/remote-control.md` (Live channel return and playback order).

## Stalker Live Search

ITV sidebar and fullscreen searches independently filter the complete selected
category; only All Items searches the whole public catalog. Cached categories
search before windowing; missing/censored genres keep provider pagination,
including automatic continuation for short or empty search results. ITV search
never narrows shared provider pages or resets their index. Category changes
reset list windows and retain playback/active EPG. Contract:
`docs/architecture/stalker-portal.md` (Full ITV Channel List Cache).

## Channel and Detail Keyboard Scrolling

Channel scroll owners use `ChannelScrollFocusDirective`; pointer selection
focuses the viewport, native scrolling survives virtual row recycling, and
row Enter/Space activation stays separate from focus movement. Portal Live TV
uses ArrowRight from the selected category and ArrowLeft from the channels
pane to move between columns. Shared live sidebars reserve scrollbar space
beside the resize handle. `PortalDetailShellComponent` owns a visible native
scrollbar and guarded initial page focus. Its one sticky arrow is the host's
Back action in browse and watch alike; only Escape unwinds one level (close
inline playback to browse, then Back), and the now-playing bar's Close button
is the pointer way back to browse. Browse Escape requires
focus inside the shell; watch preserves the global close shortcut. Menus,
dialogs, fullscreen, editable fields, repeats and hidden/inert surfaces retain
their keys. M3U and collection bootstrap shells set `backAvailable=false` when
there is no browse return action. Contracts:
`docs/architecture/iptvnator-ui-guidelines.md` and
`docs/architecture/portal-detail-navigation.md`.

## Catch-Up URL Copying

EPG timeline/list programme details expose Copy archive URL for supported
Xtream/M3U archives, including Favorites/Recent. `EpgArchiveCopyService` owns
clipboard feedback; hosts resolve URLs without mutating playback. Stalker and
the currently non-catch-up M3U guide expose no action. See
`docs/architecture/m3u-playlist-module.md` (Copy archive URL).

## Xtream Archive Downloads

Desktop Xtream Live TV programme details can enqueue completed catch-up as
`contentType: catchup`. The queue uses the existing timeshift resolver, original
timestamps and playback headers. `programme_start` plus playlist/channel provides
identity; JSON `catchup` metadata retains channel, broadcast window and known
expiry. `download-schema.ts` owns the transactional CHECK/index migration;
`download-tables.ts` exports the download tables. The cascading
`download_archive_finalizations` table records write-ahead file identity/size
proof before promotion (before writing a fallback copy), allowing startup to
recover completed unknown-length archives and clean only their owned partials.
The same journal stores transfer-phase descriptor identity before truncation;
Resume checks it at open, and rejected replacements are preserved and detached
so Retry can reserve a fresh path. A synchronous completion-commit boundary
rejects late pause/cancel commands before awaited cleanup and persistence.
Archive ownership reads device/inode as BigInt and journals decimal strings
without losing 64-bit Windows file references, alongside positive creation time to reject
reused inodes after unlink; old proofs without creation time remain untrusted.
Fresh reservations atomically commit their row path/name and captured ownership
before the initial HTTP wait;
no preexisting partial is truncated without matching expected ownership.
Captured foreign files retain their recovery copy and journal even after public
restoration, until the user explicitly removes the recovery copy. Remove/Clear
show its full path and recovery instructions in a persistent dialog with Copy
recovery path.
Private cleanup captures are journaled before relocation, keeping failed
Remove/Clear/cancel cleanup retryable across restarts without hardlinks. Active
failures, promotion and startup share that cleanup; Remove waits for active
archive cancellation to settle before deleting its row and journal.
Archive transfers validate TS framing, restart from byte zero after interruption
and check expiry again at transfer start. Completed cards play locally and never
route to VOD details. Contract and EOF/duration limits:
`docs/architecture/download-manager.md` (Xtream archive downloads).

## Desktop Source Health

Electron switcher/source rows share bounded, cached Xtream/Stalker/M3U URL
checks through `SourceHealthService` in portal shared data access. Confirmed
account expiry/disablement is distinct from failed authorization or network
checks. Stalker probes reuse session ownership without endpoint repair; M3U
reads stop at 64 KiB. PWA retains existing Xtream behavior. Contract:
`docs/architecture/m3u-playlist-module.md` (Desktop source health).

Desktop Sources also offers library-wide selective cleanup through dialog-scoped
`SourceCleanupService`. Only confirmed expired/disabled accounts are preselected;
playback/import/refresh/delete-busy sources are skipped. Deletion goes through
one serialized `PlaylistsService` operation and awaited cleanup hooks;
`PlaylistActions.playlistRemovalCommitted` updates state without another DB
delete. Stop finishes the current source. Same contract: Desktop inactive-source
cleanup in `docs/architecture/m3u-playlist-module.md`.

Startup source auto-refresh uses `SourceActivityService` to protect busy IDs
from cleanup. Late batch refreshes skip deleted rows instead of recreating them.
Contract: `docs/architecture/m3u-playlist-module.md` (Desktop inactive-source cleanup).
