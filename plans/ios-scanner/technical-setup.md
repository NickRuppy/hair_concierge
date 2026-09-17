# Local iOS technical setup

2026-09-12 · **Tooling ready for isolated B1–B4 implementation.** · `codex/ios-technical-setup` at base `469d41f5`.

Scope: approved B1–B4 prerequisites. The implementation task owns the product app, local configuration, migrations, fixtures and application integration. The approved planning worktree was read without modification. No production environment, provider project, customer message, membership purchase or publication was used.

## Tool paths

| Tool | Verified version / usable path |
|---|---|
| Host | macOS 26.4, Apple silicon arm64, 16 GiB RAM |
| Xcode | 26.6 (17F113), `/Applications/Xcode.app/Contents/Developer`; first-launch check passes |
| Swift / simulator SDK | Swift 6.3.3; iPhoneSimulator SDK 26.5; `/usr/bin/xcrun` and `/usr/bin/xcodebuild` |
| Simulator runtime | iOS 26.5 (23F77), `com.apple.CoreSimulator.SimRuntime.iOS-26-5` |
| Simulator device | iPhone 17 Pro, `26C40D88-109F-4071-A7FF-D0A982963B9C` |
| Node / npm | Existing `/usr/local/bin/node` 22.12.0 (native arm64), `/usr/local/bin/npm` 10.9.0 |
| Supabase CLI | Existing `/Users/nick/AI_work/hair_conscierge/node_modules/.bin/supabase` 2.98.0, matching repository lockfile |
| Container tools | `/opt/homebrew/bin/colima` 0.10.3, `/opt/homebrew/bin/limactl` 2.2.0, `/opt/homebrew/bin/docker` 29.8.0; Docker server 29.5.2 |

Runtime bundle: `/Library/Developer/CoreSimulator/Volumes/iOS_23F77/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 26.5.simruntime`.

Apple's `xcodebuild -downloadPlatform iOS -architectureVariant arm64` installed the runtime. The requested 18.5 arm64-only download was unavailable; 26.5 supports the approved iOS 18+ target. Minimum-OS behavior on an actual iOS 18 runtime is not proven by this setup. Existing iOS 17.2 was retained. Default Homebrew Node 23.7.0 and shell startup files were left unchanged.

## Per-worktree environment

Use a fresh shell and select Node 22 explicitly:

```sh
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export DOCKER_HOST=unix:///Users/nick/.colima/chaarlie/docker.sock
export SUPABASE_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1
node --version
npm --version
```

In the implementation worktree `/Users/nick/.codex/worktrees/a475/hair_conscierge`, install from its lockfile. The implementation task reports it completed `npm ci --ignore-scripts --no-audit --no-fund` under Node 22. That deliberately skips package scripts: apply the existing repository `patch-package` patches before Next.js runs, and run `npm rebuild supabase` if a worktree-local CLI is wanted. Verify `./node_modules/.bin/supabase --version` is 2.98.0. Until then the absolute root CLI above works without copying dependencies or environment files. Supabase is already a repository dependency; no global CLI upgrade was needed.

Do not copy or source existing `.env*` files. The repository Supabase config contains real SMTP settings and production redirects. `npm run dev:worktree` is not proof of isolation. The implementation task must supply its dedicated local configuration and environment, disable live mail hooks/SMTP and analytics integrations, and inspect localhost URLs before starting migrations or test-account writes. No `supabase login`, `link`, `db push` or remote project credentials are needed for local setup.

## Container profile

Installed Colima and Docker CLI through Homebrew without auto-update or installation cleanup. Supabase documents Colima as a supported Docker-compatible runtime. No Docker Desktop, OrbStack, Kubernetes, extra framework, Xcode project generator or login service was installed.

Profile configuration: `/Users/nick/.colima/chaarlie/colima.yaml`. Apple Virtualization framework (`vz`), arm64, 2 CPUs, 4 GiB RAM, 24 GiB sparse data disk and 12 GiB sparse root disk. Docker context `colima-chaarlie` exists but is not activated globally. VM mounts are read-only: `/Users/nick/.codex/worktrees`, `/Users/nick/AI_work/hair_conscierge/.worktrees`, `/private/tmp`.

```sh
/opt/homebrew/bin/colima start chaarlie
DOCKER_HOST=unix:///Users/nick/.colima/chaarlie/docker.sock /opt/homebrew/bin/docker version
# Stop the owning local Supabase project first, then release VM memory:
/opt/homebrew/bin/colima stop chaarlie
```

The profile sets Docker `ip: 127.0.0.1` and `default-network-opts.bridge.com.docker.network.bridge.host_binding_ipv4: 127.0.0.1`. This corrects the observed all-interface forwarding default. It applies to newly created bridge networks; explicitly requesting a different published address can override it. Check actual host listeners when creating a new stack.

Ownership/ports: implementation API **3218**; product Supabase API/database/mail **54321/54322/54324**, subject to a fresh availability check. Disposable tooling smoke used **55421/55422/55424**, project ID `chaarlie-tooling-smoke`; never reuse its data as product fixtures.

## Verification

- Node 22 executed a real `.ts` file using locked `tsx` 4.21.0, with a passing assertion. No backend feature code changed.
- Disposable, dependency-free SwiftUI Xcode project built with `-jobs 2`, `CODE_SIGNING_ALLOWED=NO` and deployment target 18.0. Generated app `MinimumOSVersion` is 18.0. No signing team or Apple account needed for this simulator build.
- Clean Supabase CLI initialization used an empty temporary directory and `env -i` with only local tooling settings. No repository migrations, seeds or environment were loaded.
- Reduced stack (PostgreSQL, Auth, Kong, REST, Mailpit) passed startup health checks. PostgreSQL 17.6 arm64 query succeeded; REST returned HTTP 200; Auth health reported GoTrue 2.188.1.
- A synthetic `example.invalid` existing account requested an OTP; exactly one message appeared in local Mailpit. SMTP host was the internal mail container, and no enabled Auth hooks were present. The synthetic account was removed. No email left through a real mail provider.
- Simulator install and launch passed (`dev.chaarlie.toolingsmoke`, running PID 40222). A screenshot visibly confirmed the SwiftUI text “Technikprüfung erfolgreich”. This is a tooling smoke screen, not an approved product design.
- First boot spent several minutes initializing and its app-termination command stalled; a direct simulator shutdown succeeded. A subsequent warm boot completed `simctl bootstatus -b` successfully in **8 seconds**, resolving the initial lifecycle concern.
- After that warm boot, app launch (1.76 s), terminate (0.44 s), uninstall (2.20 s), and simulator shutdown (3.45 s) all passed. The disposable app is no longer installed.
- Recreated the smoke stack after restarting the configured VM: Docker network options contain the localhost binding, and macOS `lsof` shows **127.0.0.1 only** on all three API/database/mail ports. Auth health, local mailbox access and PostgreSQL query passed again after this change.

Disposable source/build/log area: `/private/tmp/chaarlie-technical-smoke-15towd4q`. It is outside the repository and is not the product app. Generated-key startup output is discarded. Build command:

```sh
xcodebuild \
  -project /private/tmp/chaarlie-technical-smoke-15towd4q/NativeSmoke/NativeSmoke.xcodeproj \
  -scheme NativeSmoke -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/chaarlie-technical-smoke-15towd4q/DerivedData \
  -jobs 2 CODE_SIGNING_ALLOWED=NO build
```

For product builds use the implementation task's project/scheme and its own DerivedData directory. Boot only the named simulator, and stop it with `xcrun simctl shutdown 26C40D88-109F-4071-A7FF-D0A982963B9C` after use. Initial runtime installation/first boot builds system caches and takes longer than later boots.

## Remaining work and handoff

This receipt certifies tooling, not B1–B4 completion. Product migrations/fixtures, native auth and API integration, free/paid-owner cases, accessibility and recovery walkthroughs remain implementation checks. Physical camera, real-device signing, universal links, push and release/App Store checks are outside this setup.

No tooling, interactive credential or license blocker remains. The disposable Supabase containers and volumes were removed using the exact smoke project ID; downloaded images remain reusable. The Colima VM is stopped, with no login autostart. The simulator is shut down after use; temporary smoke source/build evidence remains under the path above. No unrelated system cleanup occurred. Recheck free disk and memory before concurrent native/backend work; use two build jobs and one simulator. This 16 GiB Mac does not need parallel simulator boots or the full optional Supabase service set for these prerequisite checks.

Final snapshot: zero booted simulators, Colima `Stopped`, Docker default context still `default`, all assigned smoke/product ports free, approximately **99 GiB disk available** and **55% system-wide memory free**. These are point-in-time measurements. The only repository change is this receipt; whitespace validation passed.

Handoff: implementation task `01a0952c-12d9-7d22-8c49-8e5b9d8eee9e`, worktree `/Users/nick/.codex/worktrees/a475/hair_conscierge`. Receipt stays uncommitted in this setup worktree; implementation may retain it with the approved plan package. Scope and port ownership were coordinated directly.

References checked: [Apple runtime installation](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components), [Supabase local CLI/runtime support](https://supabase.com/docs/guides/local-development/cli/getting-started), [Colima](https://github.com/abiosoft/colima), [Docker localhost binding defaults](https://docs.docker.com/engine/network/port-publishing/). Supabase changelog reviewed; the self-hosted Envoy change explicitly excludes CLI-managed local services, and the tested Auth URL already contains `/auth/v1`.
