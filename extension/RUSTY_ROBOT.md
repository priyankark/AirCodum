# AirCodum with Rusty Robot

This opt-in integration composes [Rusty Robot](https://github.com/priyankark/rusty-robot)'s
input library, Rust media library and shared Node-API bridge. RobotJS remains the
default during the preview. Selecting Rust enables native input and native media;
configured Rust failures do not silently switch implementations.

```sh
npm ci
npm run build:rusty-robot
AIRCODUM_INPUT_BACKEND=rusty-robot code --extensionDevelopmentPath="$PWD"
```

Build `npm run compile` before launching. The build script fetches the exact Git
revision in `native/rusty-robot/source.json`, builds with the checked-in Cargo lock,
and copies this host's addon. Rust 1.88+, a platform linker, Node and Git are needed.
For development only, `RUSTY_ROBOT_SOURCE=/absolute/trusted/checkout` overrides the
source; `AIRCODUM_RUSTY_ROBOT_PATH=/absolute/addon.node` overrides runtime loading.
VS Code must inherit these variables in its extension host; a separate
`--user-data-dir` avoids reusing a running instance with older environment settings.
The preview addon is built per host, not bundled as a universal VSIX/npm binary.

## What runs in Rust

Mouse, wheel, shortcuts, Unicode text, screen capture, image decode, SIMD/threaded
resize, BLAKE3 frame fingerprints, JPEG and PNG encoding. The host retains
authentication, transport, subscription scheduling and adaptive quality.
`AIRCODUM_MEDIA_BACKEND=robotjs|rusty-robot` can select media independently for
diagnostics. `AIRCODUM_CAPTURE_ADAPTIVE=0` fixes requested quality for comparisons.

The worker bridge accepts at most two outstanding image jobs and uses a shared
four-thread resize pool. Streaming keeps one capture in flight and discards late
results after stop or settings changes. Unchanged pixels skip encoding; periodic
refresh lets subscribers recover. Screenshots use the same Rust pipeline.

macOS needs Accessibility for input and Screen Recording for capture, granted to
the actual host. Input uses logical desktop coordinates; frame dimensions remain
explicit in the protocol. Text batches preserve UTF-16 scalar boundaries and use
native Return events. No clipboard paste or shell input synthesis is used.

## Verification

Run `npm run test:security` for adapter/capture/authentication regressions.
The native benchmark explicitly controls owned desktop fixtures; run only on an
unlocked authorized desktop. It records failed text deliveries separately from
timings, alternates backend order across three independent processes, and keeps
1440×810 JPEG quality 85 at target 30 FPS with adaptation disabled for video.
Host CPU excludes OS subprocesses/WindowServer; first-frame and ping latency are
not glass-to-glass latency. See the public benchmark data for measured limits.

The integration follows the [Rusty Robot agent skill](https://github.com/priyankark/rusty-robot/tree/main/skills/rusty-robot).
