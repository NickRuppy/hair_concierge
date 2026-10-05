# Second price-audit apply and reviewed outliers

Nick requested committing the first rollout checks, another batch, and preparing a cheaper olive-oil replacement. First receipt/probe commit: `09c439ed`, branch `codex/price-audit-rollout-receipt`, base `21e0e41f` (origin/main). No push, PR, merge or application deployment is authorized by this commit-only request.

The second supervised apply used the unchanged pinned server runner and `--apply --llm-budget 100`, started 2026-09-30T19:45:30.900Z and ended 20:10:22.994Z. Exit 0, 100 gpt-6-luna/low researches, 347 candidates. Of 57 proposed writes, 55 price stamps applied (46 GPT and 9 Müller); two unchanged-status proposals were skipped as `noop_unchanged_status`. No database write failures or mismatches. All 55 applied rows were verified against live DB price/stamp/status values. Intake stayed active at PID 71084, timer enabled and active, pinned release unchanged.

Freshness: 80 -> 126 active fresh products, 79 -> 125 recommended fresh products. The increase is 46 distinct newly verified products; nine Müller products were re-stamped. SQL uses is_active=true and lifecycle_status=active and a 14-day price stamp. There are 371 total catalog rows, including 24 outside active audit scope, and 347 active / 238 recommended rows.

## Individually reviewed corrections

Nick accepted genuine >30% differences after the first report. Independent current dm PDP checks confirmed the exact nedura 500 ml (4262490410776) at EUR 17.95 and Pantene Hydra Glow mask 300 ml (8700216173261) at EUR 6.45. `20261001063551_reviewed_price_audit_outliers.sql` was applied surgically via Supabase apply_migration to project pqdkhefxsxkyeqelqegq; the local filename matches the resulting live migration version. Both expected old prices/stamps were re-read before application. Both new prices and evidence stamps were verified after; links, status and status timestamps stayed unchanged. Freshness after these corrections is 128 active / 127 recommended.

PGlite checks: exact two corrections, preservation of status and status timestamps, idempotent replay, and atomic rollback on concurrent price, date or link drift all passed. Claude Opus 4.8 / high read-only counterpart review found no blocking defects; its concern about live preconditions was resolved by fresh SQL reads and guarded atomic application. Reviewer output is archived outside Git in the operator export directory. No source/runtime code changed; first commit hook typecheck passed. The default 30% guard remains unchanged.

## Exceptions and limits

Six >30% proposals were blocked by the second automatic run: the four known cases plus Cantu Shampoo Locken Pflege (4.99 -> observed 6.95) and Moroccanoil All In One Leave In Conditioner (28.80 -> observed 16.00, explicitly 50 ml mini). The latter size is an identity risk, not an approved bargain. Only nedura and Pantene were subsequently manually corrected; other proposals remain unchanged.

K18's EUR 49.99 answer came from the Douglas 50 ml listing versus EUR 75 UVP. The search index supports that historical price, but an independent live browser returns 404. The cheap research model repeated the indexed claim on the second run; it was blocked again and is not verified as currently purchasable. Olive oil's current 750 ml PDP has GTIN 4066447918687; the stored link encodes 4066447423761, so this is not accepted as a confirmed same-identity price correction.

The 100-research cap is attempts, not successful updates or disjoint new rows: unresolved rows consume repeated attempts. Recommended products sort ahead of all others even when already fresh. Consequently this existing weekly budget/order cannot promise 14-day freshness for the whole catalog. Improving coverage requires either unlocking verified deterministic adapters, a changed budget/cadence, or a reviewed prioritization change; no such policy change was made.

Sentry monitor remains blocked by PAYG allowance; billing unchanged. This run does not prove every GPT observation: independent spot-checks and all-row database verification address different risks.

## Artifacts

- [Run summary](summary.json)
- [Applied/proposed updates](auto-writes.csv)
- [Review proposals](review-proposals.csv)
- [Database verification](second-apply-verification.json)
- [100 research answers](second-apply-research-evidence.json)

## Independent second-run price samples

The Sante 250 ml dm PDP independently matches EUR 3.95 and GTIN 4055297220262; Sebamed brand PDP matches EUR 5.95, 200 ml and EAN 4103040048448. Curlsmith own PDP shows EUR 21, but its text does not expose size, so size confirmation is limited. The attempted Maria Nila Flaconi revisit could not be fetched; do not count it as verified. Full details: [spot-check](quality-spot-check.json). These checks do not prove all researched claims.
