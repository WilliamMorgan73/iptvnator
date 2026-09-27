# TV Mode Live Recording

`apps/tv` (the controller-first/D-pad remote app, `libs/tv/*`) records live TV
independently of the Embedded MPV native addon desktop optionally uses for the
same feature — tv mode never loads that addon at all, so it needed its own
recorder rather than reusing `EmbeddedMpvRecordingTracker`.

## Two writers, one table

Both recorders persist into the same `recordings` SQLite table
(`libs/shared/database/src/lib/schema.ts`) and are read back through the same
`RECORDINGS_GET_LIST`/`RECORDINGS_GET` IPC and the same `RecordingsService`
(`libs/services/src/lib/recordings.service.ts`) on the renderer side — a
recording is a recording regardless of which engine wrote it, and the desktop
Recordings UI and tv mode's own Recordings panel both list every row.

The table needed no migration: `sourceType` already covered
`'m3u' | 'xtream' | 'stalker'`, and `sessionId`/`ownerPid`/`filePath`/`status`
were already source-agnostic. The one dispatch problem is `RECORDINGS_STOP`
(`apps/electron-backend/src/app/events/database/recordings.events.ts`), which
previously called `embeddedMpvNativeService.stopRecording()` unconditionally.
tv-mode's `TvRecordingService`
(`apps/electron-backend/src/app/services/tv-recording.service.ts`) mints a
synthetic `sessionId` prefixed `tv:` (`isTvRecordingSessionId()`), and
`RECORDINGS_STOP` branches on that prefix to call
`tvRecordingService.stop(sessionId)` instead. This is an implicit contract —
nothing else in the schema marks a row's writer — so do not "clean up" the
prefix check without reading this file first. `recording-recovery.ts`'s
startup repair pass (`reconcileStaleRecordings()`) unions
`embeddedMpvRecordingTracker.activeRowIds()` with
`tvRecordingService.activeRowIds()` so a row either process is actively
writing is left alone; the actual repair logic (process-alive checks, file
probes, playable/failed determination) is already source-agnostic and needed
no changes.

## The recording pipeline

`TvRecordingService.start()` is a plain HTTP GET piped straight to a file in
the main process (`requestWithValidatedRedirects`, the same validated-redirect
helper the Xtream catch-up archive downloader uses, with
`allowPrivateNetworks: true` since IPTV panels are routinely on local
networks). It deliberately does **not** reuse
`embedded-mpv-recording-tracker.ts`'s settle-window/stop-acknowledgement
machinery — that complexity exists entirely for mpv's async
`stream-record` property set; a Node stream's stopped state is synchronous
and known immediately, so `TvRecordingService` finalizes the row directly from
its own stream event handlers (`readable`'s `error`/`close`, the write
stream's `error`, or an explicit `stop()`). Finalization always waits for the
write stream's own `finish` event (via `node:stream/promises`'s `finished()`)
before statting the file — the readable side closing is not proof every
buffered byte has reached disk yet.

The target path is reserved with the same `openSync(path, 'wx')` exclusivity
+ sanitized-filename + timestamp scheme `EmbeddedMpvNativeService` uses
(`app.getPath('downloads')`, always a `.ts` extension, a `-2`/`-3` suffix on
collision) — duplicated rather than shared, since the two reservation call
sites otherwise have nothing else in common (mpv's targets a path an addon
call receives, tv mode's targets a path `createWriteStream()` opens directly).

**Recording only supports a direct continuous MPEG-TS stream.** Before
touching the network, `start()` routes the URL through the same
`resolvePlaybackUrlSourceKind()` (`libs/playback/util`) every built-in web
player already uses for engine selection, and refuses anything that isn't
`PlaybackSourceKind.MpegTs`. An HLS (`.m3u8`) or DASH manifest is not a media
stream itself — piping its bytes to a file would save the tiny
playlist/manifest text, not the video — so this fails closed with a clear
error rather than producing a useless file. This is a deliberate v1 gap, not
a bug; extending it to HLS would need real segment-fetching/muxing, which is
out of scope for "pipe bytes to disk."

## Renderer side

`RecordingsService.startTvRecording()` is the one method this repo added to
the existing, already-shared `RecordingsService` — every other method
(`loadRecordings`, `stopRecording`, `removeRecording`, `revealFile`,
`playFile`, the `activeRecording`/`recordings` signals) is reused completely
unchanged between desktop and tv mode. `TvRecordingController`
(`libs/tv/ui/src/lib/video-engine/tv-recording.controller.ts`) is a small,
DI-free class (same shape as `TvPlaybackController`/`TvDigitEntryController`)
that toggles the recorder on/off for whatever is currently playing; only one
recording is ever active at a time (matching desktop's own single-recording
reality), so toggling never needs to know which channel a running recording
belongs to. Starting a **new** recording always resolves a fresh stream URL
(`TvLiveCatalogFacade.resolvePlayback()`) rather than reusing whatever URL is
already on screen — Stalker's temporary playback links live only a few
seconds, so an old one cannot be reused for a long-running recording.

Playing back a finished recording (`TvVideoEngine.loadRecording()`) always
routes through mpegts.js with `isLive: false` (a live channel uses
`isLive: true`) so the file is seekable and reports a real duration, over a
`file://` URL built by a small `toFileUrl()` helper — the renderer has no
Node `url` module under context isolation, so this reimplements just enough
of `pathToFileURL()` (backslash normalization, a guaranteed leading slash,
percent-encoding).

## UI surface

- **Record** — gamepad RT/R2, keyboard `KeyR` — starts/stops recording the
  active channel. `TvRecordingIndicatorComponent` shows a persistent
  (non-fading, unlike `TvPlaybackHudComponent`) corner badge with elapsed
  time while a recording is active.
- **Recordings** — gamepad left-stick click, keyboard `KeyL` — opens the
  Recordings pane (`TvRecordingsPanelComponent`, same
  `TvListPaneController`/heading-plus-rows shell as the Recently Viewed and
  source-switcher panes). Play-only in v1: activating a row plays it, and a
  row still being written (`status === 'recording'`) is shown but not
  activatable since its file is incomplete. No delete affordance from a
  remote — removing a recording stays a desktop-app task via its own
  Recordings manager, since a D-pad/gamepad has no spare input budget for a
  second "are you sure" flow.

Manual stop only in v1 — there is no scheduled or EPG-driven "record this
upcoming programme" yet; that needs the EPG guide feature (a separate,
larger piece of work) to know what is coming up in the first place.
