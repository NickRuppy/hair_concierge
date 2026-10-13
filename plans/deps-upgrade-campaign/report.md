# Deps upgrade campaign: report

Branch `codex/deps-upgrade-campaign`, base main 746bf6df. All work is in local commits. Nothing was pushed.
Baseline: `plans/deps-upgrade-campaign/baseline.md`.

## Result

| `npm audit --omit=dev` | critical | high | moderate | low | total |
|---|---|---|---|---|---|
| Before (main) | 1 | 18 | 36 | 1 | 56 |
| After (HEAD) | 0 | 0 | 0 | 0 | **0** |

Full audit including dev dependencies went from 71 (2 critical, 28 high, 39 moderate, 2 low) to 9 high, all of them dev-only. They are listed below.

## Steps

Every DONE row ran the same checks. `ci:verify` (typecheck + lint + build) passed with 0 errors. `test:node` passed 11103, failed 0, skipped 15. `test:personal-plan` passed 3131, failed 0, skipped 1. `test:agent` passed 888 and failed 33; those 33 are the baseline `selectProducts … supabaseUrl is required` failures. Any deviation is noted in the row.

| # | Package | From → to | Status | Commit | Forced code change | Notes |
|---|---|---|---|---|---|---|
| 1 | audit fix + in-range minor/patch set | see commit | DONE | 29d3d1df | Explicit types on 2 supabase-js upsert payloads (type-only): `src/lib/stripe/checkout-activation.ts`, `scripts/catalog-additions/prepare-2026-06-27-products.ts` | Bumped @supabase/supabase-js 2.117.3, @sentry/* 10.76.2, @langfuse/* 5.13.1, openai 6.49, posthog-js 1.438.7, tailwind 4.3.3, playwright 1.64, tsx 4.23, and others. Held back: see the table below. |
| 1b | security override pins | dompurify 3.4.0→3.4.16, postcss 8.5.10→8.5.29, protobufjs 7.5.5→7.6.6 | DONE | 5cc681aa | none | The old `overrides` pins from 5901c8d3 were keeping the tree on vulnerable versions. |
| 2 | next + eslint-config-next | 16.2.4 → **16.3.8** (16.4.0 blocked) | DONE (partial) | ab18bd88 | Test harnesses only. 5 tests that fake React's dispatcher now return null for `LayoutRouterContext` and stub `useMemo`, because Next 16.3's `useRouter` reads both. | Patch renamed to `patches/next+16.3.8.patch` with identical content. It applies without warnings. 16.3.8 clears every next advisory, including the 3 criticals. Lint warnings went from 5 to 17 because of the new `no-location-assign-relative-destination` rule. These are warnings, not errors. |
| 3a | @supabase/ssr | 0.10.3 → 0.12.7 | DONE | ddb9f8bb | none | getAll/setAll API unchanged. Default `cookieEncoding` is still base64url. |
| 3b | @sentry/nextjs + @sentry/node | 10.76.2 → 11.6.0 | **BLOCKED** | — | — | See below. |
| 3c | openai | 6.49.0 → 7.31.0 | DONE | ede97426 | none | v7's only breaking change is Node >=22. 7.31/7.32 were published 1 day ago. |
| 3d | @stripe/stripe-js + @stripe/react-stripe-js | 9.17.0 → 10.0.0, 6.12.0 → 7.0.0 | **REVERTED** (commit c2f94193) | 0167e92b | none | **Switches the Stripe.js release train from `dahlia` to `endive`. Server stripe-node stays on `2026-04-22.dahlia`.** Reverted after the Codex whole-branch review (2026-10-11): stripe-js 10's `loadStripe` no longer caches the shared in-flight promise (`dist/pure.js` ~:120-160); a second caller removes the first caller's listeners and re-injects the script, so the first promise never resolves. The app has two independent loaders (`src/lib/stripe/offer-client-loader.ts:14`, `src/components/reactivation/membership-reactivation-checkout.tsx:188`). Codex reproduced `[pending, fulfilled]` on v10 vs `[fulfilled, fulfilled]` on v9. Stripe.js 9.17 has no advisory. Retry v10 only together with a single shared loader. |
| 3e | @paypal/react-paypal-js | 9.3.0 → 10.6.0 | DONE | 8a42aa52 | none | The v10 break (required `environment` on the v6 PayPalProvider) does not apply. We use the legacy PayPalScriptProvider/PayPalButtons. |
| 3f | @electric-sql/pglite | 0.3.16 → 0.5.8 | **BLOCKED** | — | — | See below. |
| 3g | @customerio/cdp-analytics-browser | 0.4.16 → 0.5.11 | DONE | 449e527b | none | Clears js-cookie (high) and uuid. Chose 0.5.11 over 0.6.0, which was 1 day old. |
| 3h | @types/jsdom | 28.0.3 → 30 | SKIPPED | — | — | jsdom is pinned at 28.1.0. Types for jsdom 30 would describe the wrong runtime. Bump both together or not at all. |
| 3i | clawpatch | 0.4.0 → 0.8.2 | DONE | dd6421ff | none | Offline checks pass: init, doctor, `map --source heuristic` (937 features), status, summary. review/revalidate need Codex and were not run. Gets a nested zod 4.6.5; the app stays on 4.4.3. |
| 3j | @modelcontextprotocol/sdk | 1.30.0 → 1.32.1 (exact pin kept) | DONE | 6954a847 | none | Fixes GHSA-6qxp-vccf-f47h. `tests/scan-dm-mcp-client.test.ts` 12/12. One unrelated flaky failure in this run: `mobile-registration-credentials` "completion capabilities … reject signed or cross-purpose substitution". It was green in 5/5 isolated reruns. It is random-IV tamper flakiness, with no MCP involvement. |
| 3k | @opentelemetry/sdk-node | 0.216.0 → 0.223.0 | DONE | 0e140de4 | none | Clears all remaining prod advisories. Offline smoke test of NodeSDK + LangfuseSpanProcessor: start, span, clean shutdown. |

Not run: all Playwright suites (they need a running server, so out of scope), `test:chat`, and clawpatch review/revalidate.

### Held back in Step 1 (still on main's version)

| Package | Why |
|---|---|
| prettier 3.8.3 | 3.9 reformats union types. lint-staged would churn every touched file. Do it as its own format-only PR. |
| zod 4.4.3 | 4.6 emits `anyOf:[{type:boolean},{type:null}]` instead of `type:[boolean,null]` in `toJSONSchema`. That breaks the bondbuilder transport-contract digest test (`tests/bondbuilder-internal-admission-postgres.test.ts`). |
| lucide-react 1.14.0 | 1.54 adds alias classes (`lucide-help-circle lucide-circle-help`). That breaks the scan-result-card rendered-DOM golden, which must not be regenerated. |
| eslint-plugin-react-hooks 7.0.1 (transitive) | 7.1.1 turns `set-state-in-effect` / `error-boundaries` into 110 lint errors across about 40 files. |
| stripe (node) 22.1.0 | 22.6 narrows `apiVersion` to `2026-08-26.dahlia`. Changing the API version is a behavior change. |
| @types/node ^22 | Runtime is Node 22 (`.nvmrc`, engines, CI). 22.20.5 installed. |
| typescript 5.9.3, react 19.2.5 (exact pin), start-server-and-test 2, sharp 0.34 | Not in scope (#463 shows TS 7 and sharp 0.35 break). |

### BLOCKED details

**Next 16.4.0 — the patch no longer applies.** patch-package fails on hunk 1 of `node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js`:

```
@@ -297,7 +297,19 @@
         let initialWatchTime = performance.now() + performance.timeOrigin;
-        wp.on('aggregated', async ()=>{
+        // chaarlie patch … serialize watchpack `aggregated` handling.
+        let aggregatedQueue = Promise.resolve();
+        const handleAggregated = async ()=>{
```

In 16.4.0, upstream added these lines between `initialWatchTime` and the handler:

- an `initialScanDeadline` block (two comment lines plus `const initialScanDeadline = initialWatchTime + 30000;`)
- `const isInitialScan = !hadInitialScan;` at the top of the handler

The handler is still `wp.on('aggregated', async ()=>{`, which means it is still unserialized, so the race the patch fixes is most likely still present. Rebasing the patch onto 16.4.0 is mechanical: same two hunks, new context. Whether it is still needed is a judgment call. Neither is needed for security, because 16.3.8 already clears every next advisory.

**Sentry 11 — privacy defaults would have to be re-decided.** Exact typecheck errors after `npm i @sentry/nextjs@11.6.0 @sentry/node@11.6.0`:

- `instrumentation.ts(14,5)`, `instrumentation-client.ts(26,5)`, `scripts/product-intake/codex-research-worker.ts(326,75)`: `'sendDefaultPii' does not exist`. The same option also appears in `src/lib/observability/product-intake.ts:68`, `payment-server-core.ts:16,88` and `scripts/price-audit/run.ts:313`.
- `next.config.ts(2,10)`: `withSentryConfig` is no longer exported from `@sentry/nextjs`. It moved to `@sentry/nextjs/config`. This also causes cascading implicit-any errors in `tests/paypal-csp`, `wistia-csp` and `waitlist-analytics-security` (.test.ts).

Why this is blocked rather than fixed:

- v11 removes `sendDefaultPii`. An unset `dataCollection` now collects everything: cookies, headers, HTTP bodies, query params, stack-frame locals, and genAI inputs/outputs, which would include chat content. Sentry's documented "keep v10 defaults" block is not stated to be equivalent.
- v11 also defaults to span streaming. In that mode `beforeSendTransaction` is a no-op, so our checkout-URL scrubber stops running unless `traceLifecycle: 'static'` is set.
- Migration needs, per Sentry init site (6):
  - an explicit `dataCollection` baseline
  - `traceLifecycle: 'static'`, or porting the scrubbers to `beforeSendSpan`
  - the import move in `next.config.ts`
  - a Sentry-dashboard check that scrubbing still works

  That needs your sign-off on the data-collection baseline.

**pglite 0.5 — local test timezone.** With 0.4+, the database session timezone follows the host (Europe/Zurich). 23 tests in 8 files fail on a CET machine:

- `billing-trial-payment-events`
- `bondbuilder-reviewed-promotion-postgres`
- `stripe-trial-continuation-reconcile`
- `billing-trial-paid-recovery-postgres`
- `billing-trial-access-postgres`
- `billing-trial-required-notices-postgres`
- `product-intake-research-jobs-postgres`
- `user-facts-save-v1-migration`

For example, the tests expect `2024-02-29 10:00:00` and get `2024-02-29 11:00:00+01`. All 117 tests in those files pass with `TZ=UTC`, and CI runs in UTC. The fix is to pin the test timezone, by adding `TZ=UTC` to the test scripts or setting `process.env.TZ = "UTC"` in `tests/server-only-register.cjs`. That changes the local test environment for everyone, so it is your call. pglite has no advisories, so there is no security cost to waiting.

## Remaining vulnerabilities (dev-only; prod audit is 0)

| Advisory | Severity | Package | Path | `overrides` safe? |
|---|---|---|---|---|
| GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w | high | sharp 0.34.5 (direct devDep) | root | No. 0.35 drops the `sharp` namespace type (#463). Needs a real code bump, not an override. |
| GHSA-vfj7-8cjw-p6xm (via micromatch/braces) | high | braces, micromatch, find-yarn-workspace-root | patch-package 8.0.1 → find-yarn-workspace-root → micromatch → braces | Probably. A `micromatch`/`braces` override to the latest of the same major is low risk. Audit's own "fix" is a downgrade to patch-package 6, which is wrong. Verify that `npm ci` still applies the Next patch. |
| (same chain) | high | fast-glob, @next/eslint-plugin-next, eslint-config-next | eslint-config-next 16.3.8 → @next/eslint-plugin-next → fast-glob → micromatch | Covered by the same micromatch override. Audit's suggested 14.2.35 downgrade is wrong. |
| GHSA-3jxr-9vmj-r5cp + 5 more | high | brace-expansion ≤1.1.20 | eslint / minimatch@3 chains | Yes. A same-major override (`brace-expansion` 1.x latest) is safe. `npm audit fix` reports it as fixable but left it. |

## What Nick should check in the browser (test mode, before shipping)

- **Stripe Elements (stripe-js 10 / endive):** offer page and premium sheet card checkout, Payment Element renders, a test card payment confirms, the 3DS test card challenge works, the return/verification flow unlocks. Watch the console for Stripe.js version warnings. Also check membership reactivation checkout.
- **PayPal buttons (react-paypal-js 10):** one-time button and subscription button render, the sandbox popup opens, approve and cancel both return correctly.
- **Supabase auth cookies (@supabase/ssr 0.12):** existing session survives the upgrade (no forced logout), login / magic link / logout, middleware session refresh on a protected route (`/routine`, `/scan`), and auth responses carry `Cache-Control: private, no-store`.
- **Next 16.3.8:** `npm run dev:worktree` deep links to dynamic routes (the patched route-table race), plus a quick click-through of the quiz → offer → plan flow.
- **Customer.io (0.5.11):** identify and track events still arrive after the cookie-consent opt-in.
- **Sentry:** unchanged (still v10.76.2); only init ordering with OTel 0.223. Trigger one test error and confirm it lands, scrubbed.


## Post-review addendum (2026-10-11)

- Codex whole-branch review verdict: ship with changes. The one finding (Stripe.js 10 loader concurrency, P1) was resolved by reverting commit 0167e92b (revert c2f94193). All other checks passed or were false positives (endive/dahlia mix alone not a defect; Supabase dropped cache-headers argument pre-existing; Langfuse has no OpenAI peer range; the 33 agent failures are the recorded baseline).
- Codex note on held-back packages: the deferred `sharp` 0.34 → 0.35 upgrade contains security fixes; sharp is dev/script-only here (`scripts/product-intake/review-app.ts`). Follow-up: bump sharp in its own PR (#463 showed 0.35 breaking something; re-check).
- Final tree re-verified by the orchestrating session after the revert: `npm audit --omit=dev` 0 vulnerabilities; `npm run ci:verify` + `npm run test:node` (see PR for the result line).
