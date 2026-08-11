# Personal Plan transition performance

## Contract

- Outcome: materially reduce Stage 2 answer transitions and Stage 3 individual decision transitions while preserving the five-stage journey, owner isolation, CAS, and authority checks.
- Secondary scope: retain the already-safe Routine/Anwendung read reductions and known-route continuity.
- Verification: production evidence, deterministic request/dependency-depth benchmarks, failure/recovery tests, rendered Stage 2/3 journeys, full Personal Plan tests, lint, typecheck, build, and final diff review.
- Stop: no outbox/local-first architecture, region change, production data write, deployment, merge, publication, feature-flag change, or worktree cleanup.

## Baseline evidence (2026-08-10)

- Live walkthrough observation: Stage 2/3 save-and-advance actions took roughly 5–12 seconds; Routine/Anwendung navigation or refresh took roughly 8–10 seconds before the page was stable.
- Stage 2 source chain before this slice:
  - A normal page stayed interactive on the old question while awaiting one `PATCH /api/personal-plan/stage-2`.
  - The final page awaited that PATCH and then serially awaited `POST /api/personal-plan/stage-2/complete`.
  - Each HTTP request repeated browser/network, authenticated-owner, journey-access, and fresh persistence-gateway setup. The final page therefore paid two complete server request cycles.
- Stage 3 source chain before this slice:
  - A common one-by-one product/gap decision was already one authoritative PATCH, not 13 requests for one click.
  - That PATCH serially authorized the owner/journey/rate limit, loaded the canonical draft and requirements, verified the current refined source, loaded owned-product facts, recommendation facts, and heat-carrier facts, then performed one CAS save.
  - The UI already switched synchronously to a truthful saving state and did not expose the next card until the authoritative response.
- Vercel showed 13 successful Stage 3 PATCH requests during the walkthrough window before completion. That count reflects the sequence of actions in the walkthrough; it must not be described as one grouped UI action.
- A distinct grouped “passende Produkte übernehmen” UI action previously sent one PATCH per clear fit. This is the only path to which the bounded grouped batching result applies.
- Browser resource timing from the same production investigation included `/routine?_rsc` at 2.70–2.96 s, Routine attention at 2.10–3.49 s, Routine sync at 2.96–4.23 s, and `/anwendung?_rsc` at 2.29 s.
- Supabase `pg_stat_statements` showed small database execution time relative to wall time: Stage 3 save RPC 15.75 ms mean/111.55 ms max, Stage 3 reads roughly 1–10 ms mean, and observed completion RPC 282.15 ms.
- Vercel executed in `iad1` while Supabase was in `eu-west-1`, so serial request/query boundaries paid cross-region latency even when SQL itself was fast.

## Chosen changes, in priority order

1. **Stage 2 final page: remove a full HTTP cycle.** The production browser gateway sends `completeAfterSave: true` on the final answer. One already-authorized server gateway saves the answer first, then completes using its cached draft and saved revision.
2. **Stage 2 immediate continuity without optimistic acknowledgement.** Submission immediately replaces the editable question with “Deine Antwort wird sicher gespeichert.” The next question becomes interactive only after the server confirms the durable page save.
3. **Stage 2/3 shared journey access.** Start the independent prepared-artifact and plan reads together. Preserve the prior missing-artifact recovery result even if the speculative plan read fails.
4. **Stage 3 individual decisions.** Start owned-product, recommendation, and heat-carrier fact sources together. Preserve one semantic intent, one authoritative re-evaluation, one CAS save, and one HTTP request per individual card.
5. **Stage 3 grouped clear fits.** Retain bounded server-authoritative batching (maximum 25 intents) only when the UI actually presents one grouped acceptance action.
6. **Routine/Anwendung secondary reductions.** Retain concurrent independent reads, accepted-Routine-only Anwendung loading, request-cached owner reuse, and authoritative navigation-attention reuse.
7. **Region placement.** No repository configuration change. A broad Vercel region move affects unrelated surfaces and must be a separate preview experiment.

## Durability and failure behavior

- A Stage 2 page is never described as saved and the next interactive question is never shown until the save response succeeds. There is no in-memory write queue or local outbox in this slice.
- On the combined final request, the server completes only after the answer save succeeds. If completion then fails and the response arrives, the error includes the canonical `savedSession`; the UI says the answer is saved and retries completion only.
- If the final response is lost after a server write, the UI does not acknowledge success. Retry/reload reconciles the canonical revision; the existing revision-conflict path loads the current server state and recognizes an already-complete session.
- Stage 3 individual decisions still wait for authoritative evaluation and CAS before exposing the next card. The saving screen is immediate, truthful, duplicate-submission safe, and now explicitly says the next open step follows.
- Stage 3 conflicts still return the canonical latest draft. Grouped batches are atomic per bounded batch; forged/duplicate subjects or disallowed actions fail before persistence.

## Deterministic before/after benchmark

Run:

```bash
npm run bench:personal-plan-transitions -- --latency-ms=80 --iterations=3 --stage3-intents=13
```

The 2026-08-10 run simulated every remote boundary at a fixed 80 ms and measured median wall time:

- Stage 2 normal answer → next question: 648.72 ms → 567.98 ms; HTTP requests remain 1 → 1. The UI now provides a full saving transition immediately while retaining durable-before-next behavior.
- Stage 2 final answer → handoff: 1297.10 ms → 648.69 ms; HTTP requests 2 → 1.
- Stage 3 individual decision → next card: 1216.82 ms → 891.79 ms; HTTP requests remain 1 → 1. The delta comes from shorter dependency depth, not skipped authority or CAS work.
- Routine loader: modeled 320 ms prior path → 247.13 ms current measured median; four required database reads remain.
- Anwendung accepted-Routine loader: modeled 320 ms/four reads → 164.88 ms/two reads.
- Grouped 13-clear-fit action only: 13 HTTP mutations → one bounded request. This does not apply to 13 separate individual card actions.

Exact scheduler overhead varies. HTTP request counts, state transitions, concurrency start order, atomicity, and recovery behavior are asserted in tests.

## Production timing instrumentation

- Browser console event: `personal_plan_transition_performance`.
  - Stage 2 operations: `stage2_answer_save`, `stage2_final_save_complete`, `stage2_complete_retry`.
  - Stage 3 operations: `stage3_individual_decision`, `stage3_grouped_decisions`.
- Stage 2 server phases: route `auth`, `journey`, and `operation` in logs/`Server-Timing`; nested `stage2_final_answer_save` and `stage2_final_completion` timing events.
- Stage 3 server phases: route `auth`, `journey`, `rate_limit`, and `gateway` in logs/`Server-Timing`; nested canonical-draft, source-context, authority-facts, and CAS-save timing events, separately named for single and batch actions.
- Timing events contain operation, outcome, duration, and optional HTTP status only—no answer, product, category, owner, or draft identifiers.

## Production comparison checklist

1. Use the same field-test guest session, deployment SHA, browser engine, network conditions, and stage path as the baseline. Create it through the shareable field-test link and free continuation CTA. Never use a customer account.
2. Capture read-only Routine/Anwendung samples (all writes are blocked):

   ```bash
   node scripts/personal-plan/measure-read-only-transitions.mjs \
     --base-url=https://chaarlie.de \
     --storage-state=/absolute/path/auth.json \
     --samples=5 \
     --output=/absolute/path/personal-plan-read-after.json
   ```

3. Only after separate write-test authorization, capture Stage 2 and individual Stage 3 actions manually with the field-test guest:

   ```bash
   node scripts/personal-plan/measure-write-transitions.mjs \
     --base-url=https://chaarlie.de \
     --storage-state=/absolute/path/field-test-guest.json \
     --output=/absolute/path/personal-plan-write-after.json \
     --confirm-field-test-write-session
   ```

   The script opens a visible browser, records matching requests/`Server-Timing`/client timing events, and performs no clicks or submissions itself. Close the browser to write the report.

4. For Stage 2, record at least five normal answer transitions and the final answer separately. Confirm 1 PATCH per normal page and 1 PATCH total for final save+complete; test completion failure only in a controlled non-production environment.
5. For Stage 3, record at least five one-by-one decisions separately from one genuinely grouped clear-fit action. Confirm individual actions remain 1 PATCH each; never convert the total sequence count into a grouped-action claim.
6. Compare median/p95 browser totals, `Server-Timing` phases, Vercel nested timing events, response status, request count, cold/warm state, Vercel execution region, and Supabase region. Do not claim a production after result from the local simulation.

## Region experiment recommendation

No `vercel.json` change is included. If the new phase timing still shows cross-region wall time dominating, create a separate preview deployment pinned nearer Supabase, run the same scripts with a field-test guest session, and compare it with an otherwise identical preview. Personal Plan is not currently isolated into a deployable unit that permits a truthful route-only region setting without affecting other application functions.
