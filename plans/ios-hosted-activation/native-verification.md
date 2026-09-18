# HostedPilot native verification

Branch `codex/ios-hosted-activation`, base `e7b93c670d64446f2ce094b6e95645c46a1e86c5`. Native source imported from the frozen reviewed candidate, recorded in `native-import.tsv`. The independent visual consistency branch is not included.

## Runtime separation

- Debug/local: `http://127.0.0.1:3218/api/mobile/v1`, `chaarlie-local`, bundle and Keychain service `de.chaarlie.scanner.local`.
- HostedPilot: fixed `https://chaarlie.de/api/mobile/v1`, `chaarlie-pilot`, bundle/session/attempt/draft namespace `de.chaarlie.scanner.pilot`. App compilation defines `HOSTED_PILOT` without `DEBUG`; no fixture routes compiled into the pilot app.
- Callback accepts a bounded compact JWS and exact attempt; raw local hashes, foreign scheme, nested callbacks and extra fields are rejected. Server owns cryptographic proof validation.
- Scheme Launch uses HostedPilot; Test uses Debug with explicitly injected runtime configurations. Archive/Profile use unavailable Release. No distribution signing or physical-device install occurred.

## Completed checks

- Plist validation, project/scheme listing and build-setting inspection passed.
- HostedPilot unsigned build: `/tmp/hosted-pilot-build.log`.
- Disabled Release unsigned build: `/tmp/hosted-release-build.log`.
- Main signed simulator Debug XCTest: **77/77 passed**, including actual Keychain session/attempt/draft isolation. `/tmp/ios-hosted-main-unit.log`, `/tmp/ios-hosted-main-unit.xcresult`.
- Behavioral red in a disposable source copy mapped the pilot service to local; the fixed-origin/namespace test failed with the expected two assertions. `/tmp/ios-hosted-native-red.log`, `/tmp/ios-hosted-native-red.xcresult`. Original source was not neutralized.
- Dedicated `Simulator-HostedPilot.entitlements` carries pilot application identifier and access group; local entitlement is unchanged. Final ad-hoc signed simulator build passed: `/tmp/ios-hosted-pilot-signed-build.log`. Generated `Chaarlie.app-Simulated.xcent` in `/tmp/hosted-pilot-derived/Build/Intermediates.noindex/Chaarlie.build/HostedPilot-iphonesimulator/Chaarlie.build/` contains the pilot identifiers; the linker embeds it in `__TEXT,__entitlements`. `codesign --entitlements` emits no separate entitlement blob for this simulator build, so it is not the evidence for these values.

Owned simulator `Hosted Activation 17 Pro` (`5A1A1607-AC29-4A43-A8CD-5D547B3951C2`) was used only for these local tests. Earlier queued test attempts stalled while other simulator runners were active; the successful main run supersedes them. The disposable red run also spent excessive time in Xcode diagnostics after reporting its expected failure; subsequent runs disabled test diagnostics.

No native HostedPilot network request, hosted authentication, real mail delivery, camera or phone behavior is proved here. Real provider lifecycle is separately verified against the isolated local Supabase stack; later hosted end-to-end activation remains setup-owned.
