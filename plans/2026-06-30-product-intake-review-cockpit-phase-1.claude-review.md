I have enough grounding. Here is the verdict report.

---

**Verdict:** Approve with revisions — the plan is well-shaped and its factual claims about the codebase are almost entirely accurate, but four execution details (root `tsconfig` glob, RLS posture, claim-RPC primitive, enqueue-vs-unique-index collision) will bite a subagent if not pinned down first.

## Lean shape

- **Irreducible goal:** Make product-intake work *visible and durable* — a `product_intake_research_jobs` table + claim/enqueue/update RPCs, a separate internal Next app that reads the queue, and a Codex-worker skeleton that claims/updates jobs without doing real research. Customer app untouched.
- **Cut / narrow / defer:**
  - **Two queue endpoints** (`app/api/queue/route.ts` *and* `app/api/jobs/queue/route.ts`, plan lines 279–280) is one-more-route drift. Phase 1 needs one queue read. Collapse unless they return genuinely different shapes (the plan never says they do).
  - **Worker-status / heartbeat stub** (lines 324–332) — the plan already says "do not overbuild." Good; keep it to a single "last refresh" timestamp, no new storage.
  - The **3 reserved statuses** (`waiting_for_rework`, `publish_preflight`, `publishing`, lines 204–207) are baked into the CHECK + partial-unique-index now but unused in Phase 1. I'd *keep* this exception: a later `ALTER … CHECK` migration is costly, so encoding the full enum now is the cheaper path (same reasoning the plan uses to keep them *off* `product_submissions`). Worth an explicit one-line justification in the plan so it doesn't read as speculative.
- **Hard tradeoff the plan avoids:** The internal app's API routes will hold the **service-role key with no auth gate** ("local no-login," line 136). That's fine for local Phase 1, but the Phase-1 plan's Non-Goals/Stop-lines never restate "do not deploy this app publicly in Phase 1." The parent strategy covers it; this plan should too.

## Prior art

- **Background-job claim** → canonical is `UPDATE … WHERE id IN (SELECT id … FOR UPDATE SKIP LOCKED LIMIT n) RETURNING`. The plan describes "an update-with-returning pattern that prevents two workers claiming the same job" (line 270) but **never names `FOR UPDATE SKIP LOCKED`** — and there's no precedent in the repo (`grep` for `SKIP LOCKED` across `supabase/migrations/` = 0 hits; existing RPCs use plain `FOR UPDATE`, e.g. lifecycle migration line 23). For a concurrency-2 queue this is the load-bearing invariant. Name it.
- **One-open-job-per-submission partial unique index** → matches an existing proven shape: `idx_product_submissions_one_open_per_usage` (`20260612130000_product_intake_submissions.sql:312-315`). The plan's index (lines 227–239) mirrors it correctly. ✓
- **At-least-once + visibility timeout** (stale-lock reclaim via `next_run_at`/`locked_at`, 10-min TTL, max-attempt → `blocked`) → matches the canonical at-least-once+idempotent background-job pattern. ✓

## Blockers (will fail or regress as written)

1. **Root `tsconfig` glob will pull the new app/package into root typecheck, build, and lint.** Root `tsconfig.json:25-33` is `include: ["**/*.ts","**/*.tsx",…]`, `exclude: ["node_modules","scripts","supabase/functions"]`. Adding `apps/product-intake-review/**` and `packages/product-intake-core/**` means `npm run typecheck` (`tsc --noEmit`) and `next build` (via `ci:verify`) compile those files under the **root** app's compiler options + `@/*→./src/*` paths, and `eslint .` (`package.json:11`) lints them too. The plan flags this only as a vague Risk (line 497) and the Task Checklist (lines 362–369) never prescribes the fix. **Fix:** add `"apps"` and `"packages"` to root `tsconfig.json` `exclude`, and confirm/scope `eslint .` before declaring "root scripts still work."

2. **`enqueue` RPC will throw on the partial unique index when a non-terminal job already exists.** The index covers `failed`, `blocked`, `waiting_for_review` (lines 229–238), all non-terminal. So `product_intake_enqueue_research_job` (line 260) doing a plain `INSERT` violates the unique constraint whenever the submission already has a failed/blocked/awaiting job — exactly the state the manual "Queue research"/"Retry job" buttons (lines 280–281, 350) hit. **Fix:** specify enqueue as re-queue/upsert of the existing open row (or `ON CONFLICT … DO UPDATE`), and make `/api/jobs/[jobId]/retry` operate on the existing row id, not insert a new job.

3. **RLS section offers a non-conforming option.** Lines 252–256 say "start with RLS disabled only if this matches project migration conventions." It does **not**: every intake table has RLS *enabled* with a `service_role` ALL policy + `REVOKE ALL … FROM anon, authenticated` (`20260612130000_product_intake_submissions.sql:549-562`; live DB confirms `product_submissions`/`product_image_assets`/`user_product_usage` all `relrowsecurity=true`). A new RLS-disabled public table also trips a Supabase security advisor. **Fix:** prescribe — enable RLS + `service_role` ALL policy (admin SELECT/UPDATE optional since the app uses the service-role key). Delete the "disabled" branch.

## High-confidence issues (correctness, not preference)

- **RPC security boilerplate is under-specified.** Every existing intake RPC is `SECURITY DEFINER` + `SET search_path TO 'public'` + `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO service_role` (lifecycle migration lines 12–13, 295–306; review-workflow migration lines 862–883). The plan's RPC task (lines 258–270, 372–377) lists none of these. With a service-role caller the RPCs *can* be plain, but the plan should state which convention to follow so the implementer doesn't guess.
- **`updated_at` trigger is settled, not conditional.** Task 2 line 377: "Add updated-at trigger *if project convention supports it*." It does — `update_updated_at_column()` is already wired on `product_submissions` (`20260612130000_product_intake_submissions.sql:542-547`). Reasoning models read "if … supports it" as read-only confirmation and skip the work. Make it imperative: "Add `set_updated_at_product_intake_research_jobs` trigger using `public.update_updated_at_column()`."
- **Worker skeleton has no typecheck coverage and should reuse the script-side client.** `scripts/` is excluded from root `tsconfig` (line 33), and `products:intake:review-cockpit:typecheck` only covers the app — so `scripts/product-intake/codex-research-worker.ts` is typechecked by *no* listed verification command (lines 460–465); tests are the only guard. Also: it's a script, so it should use `createSupabaseClientFromEnv` (`scripts/product-intake/cli.ts:82`), **not** `src/lib/supabase/admin.ts:3` (`createAdminClient`). The plan names neither.

## Smaller / nice-to-haves

- **New test import path.** Existing tests use `node:test` + **relative** imports (`tests/product-intake-lookup.test.ts:1-8`, `import … from "../src/lib/…"`), and the verify command `npx tsx --test` (line 464) matches that runner. ✓ But `tests/product-intake-research-jobs.test.ts` importing `@chaarlie/product-intake-core` needs the workspace symlink + a package `exports`/`main`/`types` entry pointing at TS that `tsx` can load — the File Map lists `packages/product-intake-core/src/index.ts` (line 435) but not the package.json `exports`. Specify it, or import via relative path.
- **New app Tailwind/PostCSS unspecified.** Root uses `postcss.config.mjs` + Tailwind v4 (no JS tailwind config; `tailwind.config.*` doesn't exist). The File Map gives the app a `globals.css` (line 428) but no `postcss.config`. Decide: plain utilitarian CSS (simplest, fits "no decorative UI") vs. Tailwind (needs `@tailwindcss/postcss` + the app's own postcss config). State which.
- **`vercel.json`, `@/*` path, status list, `researched_payload`, `idx_product_submissions_status_created_at`, single-app `chaarlie` package** — all plan claims verified accurate against `package.json:2`, `tsconfig.json:21-23`, the live DB constraint/index, and `20260612130000_product_intake_submissions.sql:213`. Source Context section is trustworthy. ✓

## Bottom line

Fix the four Blocker/correctness items before handing this to a subagent: (1) exclude `apps`/`packages` from root `tsconfig` (and scope eslint), (2) define `enqueue` as re-queue-not-insert against the partial unique index, (3) prescribe RLS-enabled + service-role policy and delete the "disabled" branch, (4) name `FOR UPDATE SKIP LOCKED` in the claim RPC. Then tighten the soft spots — RPC `SECURITY DEFINER`/grant boilerplate, the imperative `updated_at` trigger, the worker's client helper, and the new test's import path. The shape, scope-carving, and DB grounding are sound; this is a tighten-the-contract pass, not a re-shape.

Want me to spec the leaner counter-proposal (single queue endpoint + the four blocker fixes written as drop-in plan edits) so you can compare side-by-side?
