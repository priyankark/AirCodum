# AirCodum with Rusty Robot

Rust is the default for desktop input, screen capture, screenshots, and image
processing. The release includes prebuilt native binaries. No Rust toolchain,
Git checkout, or native compilation is needed for a released installation.

Install AirCodum 0.5.0 from the VS Code Marketplace or its release VSIX.

## Compatibility backend

The original RobotJS/JavaScript media path is an explicit opt-in:

```sh
AIRCODUM_INPUT_BACKEND=robotjs code
```

`AIRCODUM_MEDIA_BACKEND=robotjs` selects only the original media path. Rust
load failures are reported; they never silently select another implementation.
Quit all VS Code instances before changing launch environment variables, or use a separate `--user-data-dir`.

## Platform support

macOS 14+ on Intel/Apple Silicon; Windows 10/11 on x64/ARM64; Linux X11 on
x64/ARM64 with glibc 2.35+ (Ubuntu 22.04+ and Debian 12+). Native Wayland and
musl/Alpine are unsupported. macOS needs Accessibility and Screen Recording
permissions for the actual host. Input permission errors are checked when input
is requested, so granting access does not require restarting the app.

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

## Development source builds

The shared package is pinned to `@priyankark/rusty-robot@0.1.2`. CI builds
and validates its binaries on every target and checks minimum/current Node hosts.
For local Rust changes only, use `npm run build:rusty-robot` with Rust 1.88+ and
Git, then set `AIRCODUM_RUSTY_ROBOT_PATH` to the absolute built addon path.
`RUSTY_ROBOT_SOURCE` can select an absolute trusted source checkout.

Requires VS Code 1.101 or newer, whose Electron 35 runtime provides Node 22
across the supported architectures, including Windows ARM64.


### Published dependency source

The lockfile pins Rusty Robot 0.1.2 to its public GitHub release archive and npm
integrity hash while the `@priyankark` registry mirror awaits publication.
`npm ci` downloads the verified prebuilt package; the import remains
`@priyankark/rusty-robot`, and no Rust compiler is required.
