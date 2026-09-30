# Recurring Price-Audit Lane

Date: 2026-09-30 · Rev. 4 (Rev. 2 = counterpart review; Rev. 3 = display-rule ruling; Rev. 4 = in-run GPT fallback) · Branch: `claude/vigilant-chandrasekhar-fffb22`

> Rev. 2: counterpart review (internal reviewer pass substituting for the Codex
> lane, which is down pending a CLI upgrade — one lane, per the fallback rule)
> produced the findings ledger at the end. Accepted defects are folded into the
> sections below; two items need Nick (open decisions O1/O2).

## Outcome and source context

Product prices vanish from every Stage-3/cockpit surface once `products.price_checked_at` is older than 7 days (`isStage3PriceFresh`, `src/lib/personal-plan/products/fit-comparison.ts:260`), and nothing recurring refreshes that column — it is only written at catalog intake/seed time. Production state (queried 2026-09-30): **0 of 347 active products fresh**, newest check 2026-09-04, 220 rows >90 days old. Stage-3 fit comparison and the discovery cockpit have shown no prices since ~2026-09-11.

Source context:

- `docs/hai-124-product-metadata-overview.md` — names the recurring audit as the robust fix and locks several semantics (see Inherited decisions).
- `scripts/audit-product-metadata.ts` — existing read-only one-shot audit with per-host buyability content classification and review-proposal CSVs; the lane extends this, it does not replace intake paths.
- `src/lib/scan/enrichment/dm-mcp-client.ts` — hardened dm MCP client (`mcp.dm.de`, `getProductDetails(gtins)`).
- `docs/product-intake-research-ops.md` — the Hetzner worker this lane will be scheduled on.

Outcome: a weekly, honest price re-check runs on the Hetzner server for all active catalog products (recommendation-surfaced first), auto-writing `price_eur` + `price_checked_at` + `purchase_link_status` only for identity-confirmed retailer observations, routing everything else into a review-proposal artifact. Rev. 3: instead of widening the Stage-3 freshness window, the hide-when-stale display gate is removed entirely — the stored price always shows and the audit keeps it honest (Confirmed decision 4).

## Chosen direction

Host adapters + review fallback (Nick, 2026-09-30). A batched runner selects stale active products, asks a per-host adapter for a live observation (current price, buyability, identity evidence), and a pure decision module classifies each observation as `auto_write`, `review_proposal`, or `recheck_failed`. Only adapters that have passed a recorded live probe from the Hetzner server are enabled for auto-writes; every other host stays in the review lane. The run is scheduled weekly via systemd timer on the existing Hetzner worker with a Sentry cron monitor as dead-man switch.

Probe evidence so far (2026-09-30, from Nick's Mac; dm price source corrected in review, F1):

- dm MCP `getProductDetails` returns identity/content fields but **no price** ("NOT FOR: prices, availability" per `tests/fixtures/dm-mcp/tools-list.json`). dm MCP **`searchProducts`** is the price/availability source: its rows carry `gtin, dan, title, price ("6,95 €"), sellout, onlineOnly, purchasable` (fixture `tests/fixtures/dm-mcp/search-ogx-argan-oil-shampoo.json`); the client already exposes it. No undocumented dm HTTP API is used.
- dm PDP (`dm.de/p/d/...`) is a client-rendered shell — no server-side JSON-LD → PDP scraping is not the dm price path.
- Rossmann PDP redirects generic fetches to `rossmann.de/wartung/index.html` (bot/maintenance wall) for both a browser UA and the honest audit UA → Rossmann auto-write is possible only if the server-side probe passes; otherwise Rossmann rows go to the review lane.

## Scope and non-goals

In scope:

- New `src/lib/price-audit/` (pure logic, TDD) + `scripts/price-audit/run.ts` runner + npm script.
- Host adapters: dm (GTIN-identity via existing MCP client + price via probed dm API), generic JSON-LD adapter for Rossmann/Müller/Douglas (enabled per host only after a passing probe), buyability classification reused/extracted from `scripts/audit-product-metadata.ts`.
- Remove the hide-when-stale display gate: `isStage3PriceFresh` and its window are deleted from `fit-comparison.ts` and the cockpit; the Stage-3-family price label keeps only the `purchase_link_status === "available"` condition (Rev. 3).
- Systemd timer + runbook doc + Sentry cron monitor.
- First supervised run (dry-run → Nick reviews summary → apply).

Non-goals (unchanged behavior):

- No automatic affiliate-link replacement — link replacements remain review proposals (HAI-124).
- No presentation-code changes to scan header / routine drawer / Stage-1 previews (`presentCatalogCommerce` shows stale prices with a date today and keeps doing so). Data effects are expected and accepted: scan verdict *alternatives* share the Stage-3 price label via `buildStage3FitComparison` (F11), so the Rev. 3 always-show rule brings their prices back too; audit writes bump `products.updated_at`, which the routine drawer shows as its freshness date (F9 — mitigated by skipping no-op status writes).
- No long-tail host automation (20 hosts with 1–11 products each stay in the review lane).
- No catalog expansion; no overlap with the parked `scan-dm-enrichment` program (this lane only re-checks products already in the catalog).
- Never `scripts/ingest-products.ts`; intake/seed write paths untouched.
- No schema migration (columns `price_eur`, `price_checked_at`, `purchase_link_status`, `purchase_link_checked_at` already exist).

## Target map

- `src/lib/personal-plan/products/fit-comparison.ts` — hide-when-stale gate removed (Rev. 3); `src/lib/discovery/cockpit.ts` — same.
- `src/lib/price-audit/contracts.ts` — observation/decision types.
- `src/lib/price-audit/decide.ts` — pure write-policy decision (see below).
- `src/lib/price-audit/select.ts` — pure prioritization/ordering of candidate rows.
- `src/lib/price-audit/adapters/dm.ts`, `adapters/json-ld.ts`, `adapters/index.ts` (host → adapter registry with per-host `enabledForAutoWrite` gate backed by probe evidence files).
- `src/lib/product-metadata/buyability.ts` — extraction of `classifyKnownRetailerContent`/`checkStoredLinkBuyability` out of `scripts/audit-product-metadata.ts` (script keeps working, imports the shared module).
- `scripts/price-audit/run.ts` — runner (batching, per-host rate limit, DB writes, artifacts, exit codes) + `package.json` script `price-audit` using the `tests/server-only-register.cjs` shim (dm client imports `server-only`).
- `scripts/price-audit/probe.ts` — per-host live probe producing the evidence files under `data/price-audit/probes/`.
- `docs/price-audit.md` — runbook: what the lane does, cadence, server setup (systemd unit + timer), Sentry monitor, how to process review proposals.
- Tests under `tests/` per repo conventions (node test runner with server-only shim).

## Decision coverage

Status: **confirmed**

Confirmed with Nick (2026-09-30, this session):

1. Fetch lane: host adapters for top hosts + review-proposal fallback for long tail and mismatches.
2. Write policy: auto-write `price_eur`/`price_checked_at`/`purchase_link_status` when identity-confirmed; anomalies and all link replacements go to review proposals.
3. Runner: the existing Hetzner server ("We have a hetzner server on which we could run this quite well no?"), weekly cadence.
4. **Display rule (supersedes the earlier 14-day-window choice and settles O2):** the stored price always shows; staleness never blanks it ("I would rather have an old price … rather than unavailable for a lot of products"). `isStage3PriceFresh` and its window are removed; Stage-3-family surfaces keep the `purchase_link_status === "available"` condition, the cockpit card keeps its status-free label (accepted divergence). The audit exists to keep the always-shown price honest.
5. **O1 settled: dm auto-writes enabled at rollout** — Nick accepts the current dm MCP usage; the probe + reviewed-by sign-off remain the gate.
6. **GPT fallback in the same run (2026-09-30, Rev. 4):** anything the deterministic adapters cannot confirm escalates immediately to Codex CLI research within the weekly run (not a separate monthly lane — "why should I do an extra task for it?"). Write policy chosen by Nick: **price + stamp only** — GPT results auto-write `price_eur` + `price_checked_at` under the same anomaly guards and a url-gate evidence check; link-status claims go to review; `purchase_link_status` is never written from an LLM answer. Implemented in `src/lib/price-audit/adapters/llm.ts` + runner escalation (budget-capped, sequential).

Inherited from evidence or contract (HAI-124 aligned decisions + repo):

- Binary `purchase_link_status` (`available`/`unavailable`); `available` = online-buyable at the stored link at audit time.
- Stored-link unavailability never touches `lifecycle_status`.
- Link replacements only via reviewed proposal, never auto-write.
- Allowed retailers per `url-gate.ts`; deny aggregators.
- Default consumer size / no discount-code prices as canonical `price_eur`.
- Honest stamping: `price_checked_at` is written only when the price was actually confirmed at the retailer in this run (task premise; HAI-124 audit-honesty).

Implementation defaults (non-consequential):

- Anomaly thresholds: price delta >30% vs stored, price ≤ 0, or price > 500 € → review proposal instead of auto-write.
- Per-host politeness: concurrency 1 per host, ≥2 s delay between requests, honest UA (`ChaarlieProductMetadataAudit/1.0`), 15 s timeout — matching the existing audit script.
- Priority order: `is_chaarlie_recommended` (the Stage-3/cockpit recommendable set) first, then remaining active products, each oldest-`price_checked_at` first.
- Systemd unit/timer names, artifact directory layout, Sentry monitor slug.
- Bot walls: when a host answers with a block/maintenance page, the run records `recheck_failed` for those rows and does not write anything; no evasion (no header spoofing beyond the honest UA, no CAPTCHA handling).

Open consequential assumptions: none — O1 (dm terms) and O2 (cockpit status gate) were both settled by Nick on 2026-09-30 (see Confirmed items 4 and 5).

Parked out of scope with Nick's implied scope: long-tail host automation; changes to scan-header/routine price presentation.

Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: task brief (recurring price-audit lane, prioritize recommendation-surfaced products, honest handling, coordinate external-fetch scope) + Nick's three explicit answers on 2026-09-30.

Internal revalidation: probes of 2026-09-30 (dm MCP field list, dm PDP shell, Rossmann bot wall) folded into the chosen direction; no approved choice changed.

## Designed user journey

Non-user-facing operator lane. No surface, copy, layout, timing, or user-visible feedback changes — the only user-visible effect is that existing price labels on Stage-3 fit comparison and discovery cockpit reappear (same components, same copy) immediately (Rev. 3 always-show rule) and the audit keeps the shown values current. Operator journey: weekly timer runs the audit → Sentry monitor records the check-in → run artifacts (summary + review-proposal CSV) land on the server → Nick processes review proposals occasionally via the existing reviewed-CSV/id-based-update path. No mockups required (internal work; recorded per plan-format rule).

## Ordered tasks

> Rev. 2 note: where a task's prose below conflicts with the findings ledger,
> the ledger wins. The implemented contracts in `src/lib/price-audit/` are the
> source of truth for exact types (F8): `PriceAuditWrite` has optional
> `priceEur`/`priceCheckedAt` (status-only writes), confirmed observations
> carry `buyableSource: "structured" | "text"`, and dm uses MCP
> `searchProducts` (price/`purchasable`/`sellout`) with a stored-link DAN/GTIN
> tie instead of `getProductDetails` + an HTTP price API (F1/F2).

### T1 — Remove the hide-when-stale display gate (TDD; Rev. 3 — originally “widen to 14 days”)

Consumes: `fit-comparison.ts` + `cockpit.ts` freshness gates. Produces (Rev. 3): `isStage3PriceFresh` and `STAGE3_COMMERCE_MAX_AGE_MS` removed; Stage-3 `priceLabel` keeps only the price-present + `purchase_link_status === "available"` conditions; the cockpit card passes its commerce label through.

- Test-first: stage3 fit-comparison and discovery-runsheet tests assert a stale/missing/unparsable check date never blanks the price and a missing price stays null.
- Completion: tests green; `grep` shows no remaining `isStage3PriceFresh` reference.

### T2 — Price-audit pure core: contracts, selection, decision (TDD)

Produces (exact interfaces for later tasks):

```ts
// contracts.ts
type PriceAuditCandidate = { id: string; name: string; brand: string | null; affiliateLink: string | null; priceEur: number | null; priceCheckedAt: string | null; purchaseLinkStatus: "available" | "unavailable" | null; isChaarlieRecommended: boolean; canonicalGtin14s: string[] }
type RetailerObservation =
  | { kind: "confirmed"; identity: "gtin_match" | "exact_stored_pdp"; priceEur: number; buyable: boolean; evidenceUrl: string; observedName: string | null }
  | { kind: "mismatch"; reason: "gtin_mismatch" | "name_mismatch" | "redirected" | "no_price_found"; evidenceUrl: string | null; observedName: string | null; observedPriceEur: number | null }
  | { kind: "failed"; reason: "http_error" | "timeout" | "bot_wall" | "adapter_unavailable" }
type AuditDecision =
  | { action: "auto_write"; write: { priceEur: number; priceCheckedAt: string; purchaseLinkStatus: "available" | "unavailable"; purchaseLinkCheckedAt: string } }
  | { action: "review_proposal"; reason: string }
  | { action: "recheck_failed"; reason: string }
```

- `select.ts`: order candidates (recommendable first, oldest check first), filter to active+`lifecycle_status='active'`.
- `decide.ts`: pure `decide(candidate, observation, now)` implementing the write policy: `confirmed` + sane price (>0, ≤500, delta ≤30% or no stored price) → `auto_write` (buyable→`available`, confirmed-but-not-buyable→ writes `purchase_link_status='unavailable'` + `purchase_link_checked_at`, but **no** `price_checked_at`/`price_eur` unless the price itself was read); `mismatch`/anomaly → `review_proposal`; `failed` → `recheck_failed` (no write, no stamp).
- Test-first with fixture observations covering every branch, including the honesty rule: a run must never stamp `price_checked_at` without a confirmed price read.
- Completion: unit tests green under the repo node runner.

### T3 — Extract shared buyability classification

Consumes: `classifyKnownRetailerContent`, `checkStoredLinkBuyability`, `UNAVAILABLE_PHRASES` in `scripts/audit-product-metadata.ts`. Produces: `src/lib/product-metadata/buyability.ts` exporting them unchanged; the script imports from there.

- Completion: existing audit script still type-checks and runs (`--help`-level smoke), new module has direct unit tests over fixture HTML snippets.

### T4 — Host adapters behind probe gates

Consumes: T2 contracts, T3 classifier, `dm-mcp-client.ts`, `url-gate.ts`. Produces: `adapters/dm.ts`, `adapters/json-ld.ts`, `adapters/index.ts`.

- dm adapter: GTIN identity via MCP `getProductDetails` (gtin match ⇒ identity `gtin_match`), price via the dm price endpoint confirmed by T5's probe; if the probe finds no reliable price source, the dm adapter reports `mismatch: no_price_found` and dm rows land in the review lane (do not fake it via MCP-only data).
- JSON-LD adapter (rossmann/mueller/douglas): fetch stored PDP with honest UA, parse `application/ld+json` Product (offers.price, offers.availability, gtin13); identity = JSON-LD gtin matches a stored `canonical_gtin14` (else `exact_stored_pdp` only when final URL equals stored URL AND observed name passes a brand+name similarity guard — otherwise `name_mismatch`). Detect bot/maintenance redirects (host or path change e.g. `/wartung/`) → `failed: bot_wall`.
- Registry: `adapterFor(host)`; each host has `enabledForAutoWrite` read from `data/price-audit/probes/<host>.json` (written by T5). Missing/failed probe ⇒ adapter may observe but `decide` downgrades `auto_write` → `review_proposal`.
- Test-first: fixture JSON-LD documents, TOON/MCP row fixtures, bot-wall fixture; no live network in tests.
- Completion: unit tests green; adapters never write — they only observe.

### T5 — Probe script + recorded probe evidence (run on Hetzner)

Produces: `scripts/price-audit/probe.ts` — for a host, fetch 5 known catalog PDPs (and for dm, resolve the price endpoint), print observed vs stored price/name/gtin, and write `data/price-audit/probes/<host>.json` (`{ host, probedAt, samples: [...], enabledForAutoWrite }`) only when all samples confirm identity and price extraction.

- Run from the Hetzner server during rollout for `dm.de`, `rossmann.de`, `mueller.de`, `douglas.de`. Committed probe files are the auto-write authorization evidence.
- Completion: script runs against fixtures locally (dry mode); live probe execution is part of T7 rollout, results committed.

### T6 — Runner script, npm wiring, artifacts

Consumes: T2–T4. Produces: `scripts/price-audit/run.ts` + `package.json` `"price-audit": "node --import ./tests/server-only-register.cjs --import tsx scripts/price-audit/run.ts"`.

- Behavior: load candidates (paged, service-role env like the existing audit script), select order, per-host queue (concurrency 1/host, ≥2 s spacing), observe → decide → apply. **Dry-run by default**; `--apply` performs the DB writes (id-based updates only). `--limit N` and `--host <host>` for supervised runs.
- Artifacts to `tmp/price-audit/<run-date>/`: `summary.json` (counts per action/reason/host, run duration), `review-proposals.csv` (HAI-124-style columns), `auto-writes.csv` (what was written, old→new). Exit non-zero when the run itself failed systemically (>50% `recheck_failed` or selector/DB error) so the timer surfaces failure.
- Sentry cron check-in (monitor slug `price-audit-weekly`) around the run when `SENTRY_DSN` is present; absent DSN must not break local runs.
- Completion: dry-run against production data completes locally, writes artifacts, performs zero writes; unit-testable pieces (per-host queue, summary assembly) covered.

### T7 — Server scheduling, runbook, supervised first run

Consumes: T5, T6. Produces: `docs/price-audit.md` runbook + systemd unit/timer files under `deploy/price-audit/` (or the server-config location `docs/product-intake-research-ops.md` prescribes — match the existing worker's convention), weekly schedule off-peak (e.g. Mon 04:30 Europe/Berlin), non-overlapping with intake image jobs.

- Rollout order (production actions, each gated by ship/merge authorization): (1) run probes on the server, commit probe files; (2) supervised dry-run full catalog, Nick reviews `summary.json` + proposals; (3) first `--apply` run; (4) enable timer + Sentry monitor.
- Completion criterion for the code PR: runbook + unit files reviewed and committed; live activation recorded in the PR or follow-up as operational evidence.

## Verification

Automated: new unit tests (T1–T6 pieces) via `npm run test:node` and `npm run test:personal-plan` (the flat `tests/price-audit-*.test.ts` files are in the `test:node` glob; `ci:verify` runs typecheck/lint/build only — F23); typecheck on the final tree.

Manual/live:

- Dry-run against production DB: artifact counts plausible, zero writes (verify `price_checked_at` max unchanged via SQL).
- After first `--apply` run: SQL spot-check — fresh rows count > 0, stamped rows all have adapter-confirmed evidence in `auto-writes.csv`; no row has `price_checked_at` newer than its run without a confirmed price.
- Surface check: discovery cockpit and a Stage-3 fit comparison show `x,xx €` labels again for refreshed products (dev against prod-refreshed data or prod after deploy); scan sheet unchanged.
- Timer: `systemctl list-timers` shows next run; Sentry monitor shows the check-in.

## Review and handoff

- Branch/worktree: this session worktree (`claude/vigilant-chandrasekhar-fffb22`); plan committed with the PR.
- Review gates: plan self-review done; Codex whole-branch review before push (lean rule: one review for the batch); no stacked reviewers.
- Rollout risks: retailer bot walls (mitigated: probe gates + review fallback + `recheck_failed` never writes), dm price endpoint uncertainty (mitigated: dm auto-write only after a passing probe), cron death leaving prices stale (mitigated: Sentry monitor + exit codes; blanking is no longer possible under the always-show rule).
- Artifact disposition: plan `commit`; probe evidence files `commit`; run artifacts `discard` from the repo — on the server they live under `PRICE_AUDIT_OUT_DIR` (shared path, ≥90-day retention, F15); scratch probes from planning `discard`.
- Stop point: `/ship` publishes; server activation (probes, first apply run, timer) is a separate production authorization at merge/deploy time. dm auto-write enablement additionally waits on O1 (dm terms).

## Counterpart review — findings ledger (Rev. 2)

One internal reviewer pass (Codex lane down, fallback rule). Dispositions:

| ID | Type | Decision | Where it landed |
| --- | --- | --- | --- |
| F1 dm price source is MCP `searchProducts` | defect | accepted | `adapters/dm.ts` rework; plan Chosen direction |
| F2 dm identity must tie to the stored link (DAN/GTIN in URL) | defect | accepted | `storedLinkMatches` + `stored_link_mismatch` reason; appLink never written |
| F3 shared GTINs ambiguous → fail closed | defect | accepted | `fetchUnambiguousGtins` in runner (type filter + >1-product drop) |
| F4 JSON-LD underspec (AggregateOffer, availability map, gtin padding, redirects) | defect | accepted | `json-ld.ts`: `ambiguous_offer`, InStoreOnly→unavailable, pad <12 digits, bot-wall paths |
| F5 auto-`unavailable` needs structured evidence + replacement proposal | defect | accepted | `buyableSource` in contracts/decide; runner emits `link_unavailable_needs_replacement` rows |
| F6 concurrency guard on updates | defect | accepted | guarded `.eq(id, affiliate_link, price_checked_at)` + `.select` row-count check |
| F7 string `price_eur` bypasses delta guard | defect | accepted | `numberOrNull` coercion in loader |
| F8 plan T2 contract stale/contradictory | defect | accepted | Rev. 2 note; not-buyable never stamps a price, even if shown |
| F9 `updated_at` bump fakes drawer freshness | tradeoff | accepted | no-op status writes skipped; residual documented (runbook, non-goals) |
| F10 cockpit ignores `purchase_link_status` | scope/product | settled by Nick (Rev. 3) | divergence accepted; display rule now “always show” |
| F11 scan alternatives affected | defect | accepted | non-goals corrected; runbook |
| F12 stale 7-day comment in cockpit | defect | accepted | comment updated |
| F13 unsafe T3 smoke criterion | defect | accepted | completion = typecheck + re-pointed existing tests (done); never run the script as smoke |
| F14 Sentry env var/init/flush | defect | accepted | `@sentry/node` init with `NEXT_PUBLIC_SENTRY_DSN`, monitor config on `in_progress`, flush before exit |
| F15 artifacts lost in `tmp/` on release switch | defect | accepted | `PRICE_AUDIT_OUT_DIR`, retention in runbook |
| F16 systemic-failure exit would fire weekly | defect | accepted | unprobed hosts not fetched (`host_not_enabled`, zero network); failure ratio over fetched rows only |
| F17 probe gate self-authorizing/never expires | tradeoff | accepted | `reviewedBy` required, 60-day expiry; per-run circuit breaker rejected as over-engineering (anomalies already go to review row-by-row) |
| F18 dm terms unsettled | scope/product | settled by Nick (Rev. 3) | dm auto-writes enabled at rollout; probe + reviewed-by remain the gate |
| F19 HAI-124 text contradicts approved auto-write | scope/product | accepted (records Nick's decision) | HAI-124 amendment 2026-09-30 |
| F20 no proposal-apply path; acceptance line | defect | accepted | runbook: reviewed id-based migration path, dry-run acceptance review, `known-price-checks.json` note |
| F21 no slack after one missed run | tradeoff | accepted | timer `Persistent=true`; run-start stamps kept |
| F22 Hetzner assumptions (units, env, devDeps, memory) | tradeoff | accepted | `deploy/price-audit/` units, `EnvironmentFile`, `MemoryMax`/`Nice`, devDeps note; worker-live check stays a rollout step |
| F23 test globs/ci:verify claim wrong | defect | accepted | flat tests; Verification corrected |
| F24 enrichment replay guards will trip | tradeoff | accepted | runbook note |

Decision-coverage revalidation: the three Nick-approved choices are unchanged; F10/F18 entered as open consequential assumptions O1/O2 gating only their named rollout steps.
