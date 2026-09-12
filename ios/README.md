# Chaarlie native scanner — milestone B1–B4

One iPhone app, SwiftUI and AVFoundation, iOS 18+. It uses the versioned TypeScript mobile API for authentication, admission, profile and assessment. There are no package dependencies or Swift package lockfile: URLSession, Keychain, SwiftUI and AVFoundation are Apple frameworks. The committed standard Xcode project builds without a project generator.

Open `ios/Chaarlie.xcodeproj`, scheme `Chaarlie`. Build/test only after the separate technical setup receipt is verified. No Development Team or distribution/signing identity is assumed. Debug defaults to `http://127.0.0.1:3218/api/mobile/v1`; `CHAARLIE_API_BASE_URL` may override it with a loopback HTTP address. It rejects remote/prod addresses, credentials, query strings and fragments. Only Debug has local-network ATS permission and the `chaarlie-local` URL scheme. Release fails closed until an approved release API/configuration and public-release work exist.

From repository root, once setup is ready:

```sh
xcodebuild -project ios/Chaarlie.xcodeproj -scheme Chaarlie -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
xcodebuild -project ios/Chaarlie.xcodeproj -scheme Chaarlie -destination 'platform=iOS Simulator,id=<verified simulator UUID>' -derivedDataPath ios/DerivedData -jobs 2 -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- test
```

Runtime Keychain checks require simulator ad-hoc signing (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`). Debug includes an application identifier and Keychain group only for the simulator SDK. An unsigned compile remains useful, but its successful tests with in-memory stores do not prove Keychain persistence; the connected run found OSStatus -34018 without the simulator entitlement. This does not configure an Apple team, device signing or distribution.

Use the isolated product stack and synthetic users from `scripts/mobile/`; never copy repository `.env.local`, change shared tools, use production Supabase or send live mail. The app holds no Supabase key, service key or production secret. Access and rotating refresh tokens plus the pending login attempt are stored in non-synchronizing device-only Keychain items, excluded from backup migration. HTTP uses an ephemeral session, no cookies or cache, and refuses redirects. Session epoch validation rejects responses after account changes. Network refresh failures preserve the session for retry; failed authentication returns to login. No account/profile/result payload is logged. A lost successful refresh response can still require login if the provider later rejects the retained token; this client does not claim provider replay grace or invent an idempotency mechanism. A refresh response for another owner is rejected before persistence or data requests; the prior owner remains installed for retry.

Existing-account login sends a code and link through the same server attempt. Codes support paste/autofill and server-provided length. Resend stores the server-returned attempt; the server reuses a still-active attempt. Local links use `chaarlie-local://auth#attemptId=<UUID>&tokenHash=<hash>` or the local Go email template's encoded `callback=chaarlie-local://auth#attemptId=<UUID>` fragment plus outer `tokenHash`. Both URL layers are validated; query tokens, foreign schemes/hosts, extra fields and mismatched pending attempts are rejected. Signed-out cold-start links are verified by the server. A signed-in app never silently switches accounts through a link. Cold callbacks await the same single-flight startup restore before choosing verification or account-switch confirmation. No Universal Link association or real-device cross-install link delivery is claimed.

Scanner capture runs on one serial queue. The detector disarms on first read, while a request, result or retry is active, and re-arms after dismissal. Backgrounding, leaving Scan and opening manual search stop capture. A partially visible result preserves its preview and pauses detection. Requests retain the scanned identifier on network failure. Search uses request identities to ignore stale responses; account changes invalidate profile, search and scanner results. There are no native save/routine/billing requests.

The UI uses the approved German product header, main comparison table, verdict and factual mismatch summary; all authority-backed alternative rows remain available in the horizontal carousel. Main and alternative purchase buttons independently validate their own public HTTP(S) URLs (catalog images require HTTPS). Missing main shop links omit the entire footer. Read-only Profile displays persisted answers and logout; later edit/delete/onboarding/research controls are absent. The missing-product close fallback is explicitly development-only and does not constitute public-release research behavior.

`ChaarlieTests/Fixtures/scan-v1.json` is copied byte-for-byte from `tests/fixtures/mobile/scan-v1.json`; server validation and Swift decoding share that wire fixture. Refresh the native copy when the contract changes and verify equality. Fixtures are test resources, not app admission bypasses. Unit tests cover decoding, URL safety, callback binding, late profile/scan/auth responses and refresh after logout. The UI smoke test expects a signed-out synthetic simulator; it does not clear user data or call production.

Bundled fonts are the approved plan assets, copied unchanged from `plans/ios-scanner/evidence/fonts`. Redistribution licenses from the official Google Fonts repository are included beside them:

- Plus Jakarta Sans: https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt
- Playfair Display: https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/OFL.txt

Both use SIL Open Font License 1.1. Do not remove the licenses from distributions. Dynamic Type scales the fonts and switches comparison rows to vertically labeled values at accessibility sizes; no fixed-row clipping. Reduce Motion disables the alternatives fade. VoiceOver combines each comparison row and names each product's shop destination. Standard and largest-text simulator screenshots were inspected; targeted XCTest accessibility audits passed for element detection, sufficient descriptions and traits, with explicit comparison-value/target and product-specific shop-label assertions. Opening the fixture shop in system Safari and returning to the same native result also passed; merchant-page success is not claimed. Complete VoiceOver interaction and physical-device camera/permission/recovery remain verification work. See the implementation receipt for actual connected results. Simulator camera fallback does not prove physical barcode capture. App Store submission, production config, associated domains, onboarding, profile editing, deletion and research delivery are later gates.

## Native verification checkpoint

The generic simulator build passed with Xcode 26.6. The designated iPhone 17 Pro/iOS 26.5 simulator passed 20 unit tests and three fixture UI tests, including final label wrapping, explanation placement, alternate peek and largest-text scrolling. The separate connected UI test also passed: real HTTP code authentication, persisted Keychain warm restore, saved Profile, manual search, assessment, alternatives, dismissal and logout. The code is read through the scoped DEBUG mailbox hook; keyboard OTP entry and real system link delivery are distinct checks. A public catalog packshot loaded through native AsyncImage in the explicit domain fixture. No physical device or iOS 18 runtime has been tested. Capture currently supports EAN-8/EAN-13; compressed UPC-E is excluded until a tested GTIN expansion contract exists. Manual entry supports the server's accepted GTIN lengths.

A separate DEBUG rendering harness (`--ui-assessment-fixture` plus nonpersonal `CHAARLIE_UI_FIXTURE_JSON`) renders the same result component with an explicit “UI-Testdaten” label. It does not create a session, set admission or replace backend computation. The registered default UI tests exercise this harness and are not claimed as connected integration.

The opt-in connected UI test uses the real native HTTP start/verify/bootstrap/profile/search/resolve/logout flow against the isolated product stack. It reads only synthetic `scanner-free@example.test` mail from loopback Mailpit. XCTest would otherwise record `typeText`'s raw OTP argument, so a DEBUG `--connected-auth-mail` hook reads the exact pending attempt from fixed loopback Mailpit and passes its code once to the same verification method. No credential is passed through launch arguments/environment, a text field, log, screenshot or session fixture. This bypasses keyboard entry only; the server still validates and consumes the pending attempt. Raw tokens and mail bodies must never be retained in receipts.

Build the test products with the signed simulator command above, replacing `test` with `build-for-testing`. Enable the connected runner explicitly in a copy of its generated `.xctestrun` file; a command-line build setting alone did not propagate to XCTest on the verified Xcode version:

```sh
python3 - <<'PYTHON'
import pathlib, plistlib
products = pathlib.Path('/tmp/chaarlie-native-derived/Build/Products')
source = next(products.glob('Chaarlie_iphonesimulator*.xctestrun'))
run = plistlib.loads(source.read_bytes())
run['ChaarlieUITests'].setdefault('EnvironmentVariables', {})['CHAARLIE_CONNECTED_TESTS'] = '1'
(products / 'Chaarlie-Connected.xctestrun').write_bytes(plistlib.dumps(run))
PYTHON
xcodebuild test-without-building \
  -xctestrun /tmp/chaarlie-native-derived/Build/Products/Chaarlie-Connected.xctestrun \
  -destination 'platform=iOS Simulator,id=26C40D88-109F-4071-A7FF-D0A982963B9C' \
  -jobs 2 -parallel-testing-enabled NO \
  -only-testing:ChaarlieUITests/ChaarlieUITests/testConnectedLocalAuthProfileSearchResultLogout
```

Use `/tmp/chaarlie-native-derived` consistently for the preceding build. Do not run this until the owning task reports local migrations, seed, Mailpit and backend on port 3218 ready. Without the runner environment flag the connected test skips; a skipped test is not integration evidence. A signed-in login link asks for account-switch confirmation, with no silent account replacement; decline preserves the current session.

The subsequent [explanation position correction](../plans/ios-scanner/info-position-correction.md) passed four focused UI tests: repeated main-row transitions, alternative rows, long Accessibility XXXL content and Reduce Motion. Results retain a fixed 88% sheet detent; explanation cards center in the safe window area, fade for 180ms (no animation with Reduce Motion), and scroll internally when long. The real local app was rebuilt, relaunched and left open for Nick's walkthrough.
