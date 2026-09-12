# Isolated connected iOS verification

This stack contains three synthetic existing accounts and six synthetic products. It never loads the production-linked Supabase config or application env files. Its API is on `127.0.0.1:54321`, PostgreSQL on `54322`, captured email on `54324`, and Next on `3218`. Mobile admission is enabled locally; the web freemium flag stays off. Global Auth signup remains disabled; the email provider must be enabled for existing-account OTP.

Use Node22 and the tooling in `plans/ios-scanner/technical-setup.md`. The CLI defaults to the already installed compatible repository Supabase binary; override `MOBILE_SUPABASE_CLI` only with an equivalent local CLI. Colima profile `chaarlie` owns the Docker socket. No default Docker context changes are needed.

```sh
colima start chaarlie
node scripts/mobile/local-stack.mjs prepare
node scripts/mobile/local-stack.mjs start
node scripts/mobile/local-stack.mjs environment
node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/seed.ts
node scripts/mobile/local-stack.mjs web
```

Seed once on a fresh stack. Its catalog transaction validates exact V1/V2 protocols and existing curated publication constraints. It does not disable database safeguards. Profile fixtures include an actual immutable refined source, a nonempty portfolio and routine, an owned product, and a synthetic local billing row. These are application-state fixtures, not provider billing verification.

Run in another terminal while Next is running:

```sh
node scripts/mobile/check-migrations.mjs
node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/auth-integration.ts
node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/context-integration.ts
node --import ./tests/server-only-register.cjs --import tsx scripts/mobile/web-isolation-integration.ts
```

The auth script captures only this stack's synthetic emails. Code and link consume the same server attempt. The template uses a literal local app scheme with an encoded callback because Go's HTML template filtering rejects a dynamically inserted custom scheme. Credentials and sessions are stored only in ignored mode0600 files under `tmp/mobile-stack`; do not attach them, mail bodies, or successful CLI status output to reviews. The web runner temporarily holds worktree-provisioned `.env*` files under that ignored directory without reading them and restores them when Next exits. If the runner is forcibly killed, restore any `held-.env*` files before a later launch; never overwrite another file.

The context test covers concurrent duplicate publication, real transaction lock commit/rollback, immutable versions, changed-payload collisions, profile ABA, refined-answer preservation after basic-profile edits, source-failure recovery, owner RLS, and unchanged paid-state fingerprints. The web test installs real SSR cookies and verifies free denial/paid access for Profile and the composed web scanner with the old web gate, checks that native metadata stays off the web wire, rejects a client-selected native owner, and resolves an EAN to its exact synthetic product. Native build/UI/connected commands are in `ios/README.md`.

For real system-link delivery, run `node scripts/mobile/open-test-link.mjs <verified simulator UUID> free` (or `detailed`). It captures only newly delivered synthetic mail from this auth start and cold-opens the local app without printing credentials. Add `warm` as the fourth argument to keep the app running and check account-switch confirmation. Inspect the resulting native state; dispatch success alone is not login proof.

After stopping the dev server, `node scripts/mobile/local-stack.mjs build` runs the Next production compiler using only the isolated local environment and restores held env files afterward. It does not deploy or configure a production service.

## Historical replay limitations

The repository history cannot create a usable fresh database on its own. This isolated setup explicitly reconstructs missing legacy `leads`, vector extension placement, pg_cron, and the nonrecursive profiles read policy. Leads/policy/function metadata was verified by read-only schema queries on2026-09-12; no production user rows were copied.

The local preparation preserves all repository migration versions but omits reviewed catalog data blocks whose original product cohorts are not seeded. The exact exclusions are listed in `local-stack.mjs`: metadata corrections, Mask identity correction, Leave-in cohort/protocol reconciliation, Monday coverage, K18 readiness, Oil reconciliation, and bounded catalog retirement/preflight/postflight blocks. Schema/function changes within mixed migrations remain included, including the dynamic Stage5 executor rewrite. These exceptions are only in ignored copies; repository migrations are unchanged. This proves the new migrations against the reconstructed schema and real Postgres/Auth, not an unmodified historical production-data replay.

Stop Next so env files restore, then:

```sh
node scripts/mobile/local-stack.mjs stop
colima stop chaarlie
```

Stopping retains the synthetic database volume. Physical camera behavior, physical-device networking, Universal Links, signing, and release remain separate checks.
