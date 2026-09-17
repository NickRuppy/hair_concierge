# Hosted pilot preparation and later activation

Disabled/local implementation only. Publication, deployment, database migration, production environment values, Auth redirect/hook/template updates, external email and phone installation are NOT part of this execution. Setup owner retains live preflight and final activation approval.

## Prepared contract

Native `HostedPilot` uses `https://chaarlie.de/api/mobile/v1`, bundle/Keychain session/attempt/draft namespace `de.chaarlie.scanner.pilot`, callback `chaarlie-pilot://auth`. Debug retains separate local QA; Release remains unavailable. No embedded provider/signing secrets. The independent typography refinement is a separate worktree and not silently included here.

Server defaults deny every mobile route. Pilot requires all settings below; no invalid pilot setting falls back to raw local tokens.

| Setting | Required value/meaning |
|---|---|
| MOBILE_API_ENABLED | `true` only at approved activation |
| MOBILE_AUTH_MODE | `pilot` |
| MOBILE_PILOT_ENABLED | `true` only at approved activation |
| MOBILE_PILOT_AUDIENCE | `https://chaarlie.de/api/mobile/v1` |
| MOBILE_PILOT_ENVIRONMENT | fixed bounded identifier, identical on API and mail hook |
| MOBILE_PILOT_EXPIRES_AT | explicitly approved UTC ISO deadline with milliseconds |
| MOBILE_PILOT_ACCOUNTS | JSON array of exact canonical email + immutable `userId`; setup private identity receipt supplies actual values |
| MOBILE_PILOT_ACTIVE_KEY_ID | current nonsecret key version |
| MOBILE_PILOT_KEYS | strict JSON keyring of canonical base64url 32-byte random signing keys; same private settings on API and hook |
| MOBILE_AUTH_CALLBACK_URL | exactly `chaarlie-pilot://auth` |

Use a dedicated random signing key, never the Supabase JWT key. Signed credentials contain provider tokens and are authenticated, not encrypted; never paste/log them. Active key signs; retained prior keys verify through envelope and pilot expiry. Remove a key only with expected reauthentication impact understood. Cohort removal/flags/deadline stop the next mobile request. This is not a new independently revocable-session registry; provider logout/rotation rules remain authoritative.

## Later activation preflight, owned by setup

1. Refresh fresh-main/deployment identity and exact private email/UUID (already observed existing profile), supported catalog row count (observed348 before quarantine, below1000), migration history and target schema. No count inference after data changes.
2. Review/deploy only new migration versions `20260916175229`, `20260916175235`, `20260916175239` in order; original candidate timestamps remain unapplied and must not be replayed. Shared source-clock/profile triggers affect web tables independently of mobile flag, so assess that impact explicitly. Local proof is not production schema proof.
3. Reconcile deployed send-email v5 source with prepared source-aware hook. Configure identical pilot settings/keyring on API and hook. Hook signature verification occurs before adapting mail. Existing web signup/recovery/email-change/magiclink output stays unchanged. Pilot-only magiclink carries the attempt-bound authenticated proof and the numeric code.
4. Confirm real Auth hook assignment, allowed native callback, OTP length/expiry/no-signup policy, Customer.io active magic_link template rendering BOTH code and provided confirmation URL, deliverability, and secret permissions. Prior read-only Customer.io inspection was blocked by missing service-account token; no credentials requested or workaround used. These are still real activation prerequisites.
5. Approve exact test window and rollout/rollback, then explicitly authorize publication/deployment/schema/provider/env/mail actions. Bring both flags up only when configuration and hook are coherent. Rollback disables pilot/API first; do not delete shared schema or revoke unrelated web sessions.
6. Install/sign separate pilot bundle only through the setup owner's guarded device path. Verify real-host login code+link, profile/context/edit, scanner/search/result, app restart, session renewal/logout and Mac-off behavior. Keep default local app/data intact. Hosted build success is not this proof.

## Reproducible isolated proof

All local resources belong to project `chaarlie-hosted-proof`: API55321, DB55322, shadow55320, Mailpit55324, Next3224. Existing integration project `chaarlie-mobile-b1`/543xx/3218 is untouched. `scripts/mobile/local-stack.mjs` validates its own config and loopback environment; do not point it at production or reuse a different stack.

- `node scripts/mobile/local-stack.mjs prepare`, `start`, `environment` prepare/start the unique local stack and save synthetic credentials only in ignored mode0600 `tmp/mobile-stack/environment.json`.
- `node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/seed.ts` creates only synthetic fixture identities/catalog on that guarded stack.
- `scripts/mobile/pilot-integration.ts` imports real route handlers and uses real isolated Auth/PostgREST/Mailpit; tests code/link, rotation/parent retry, web-session isolation and scoped logout. Hook adapter is invoked locally, not deployed to the local Edge runtime.
- `scripts/mobile/profile-edit-postgres-check.ts` uses only owned network-none/no-port PostgreSQL container `chaarlie-hosted-profile-proof`, proving CAS/races/response-loss retry and paid-state preservation with38RPC calls.
- For local raw-protocol composition, `node scripts/mobile/local-stack.mjs web` starts3224 with explicit loopback-only local mode; use auth/context/web-isolation scripts against it. Production dotenv is held unread during this task.

Keep transient logs, test tokens, DerivedData and review output outside Git or under ignored tmp. Durable plan/source/test/provenance/verification files belong in the later PR. Teardown only the exact owned process/container/simulator resources; no cleanup of integration/phone state.
