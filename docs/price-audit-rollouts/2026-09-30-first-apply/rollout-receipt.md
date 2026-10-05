# Price-audit server rollout receipt

30 September 2026. User explicitly approved Gate 2, first apply with GPT budget 100, timer activation, and cheapest-model verification.

## Result

The first apply and weekly timer rollout are complete. Sentry cron monitoring is blocked by the organization monitoring allowance. No accepted check-in is visible.

- Pinned release: 21e0e41fa996ec6a725c258ab3766971f0edb94d.
- Server: chaarlie-hetzner; release /opt/chaarlie/price-audit/releases/21e0e41f.
- First apply: npm run price-audit -- --apply --llm-budget 100.
- Run duration: 25 minutes 27 seconds. Exit code: 0.
- Executed as a transient systemd service with User/Group nick, 1 GiB memory limit, Nice 10 and three-hour timeout.
- 347 active candidates, 100 sequential GPT researches.
- 82 applied updates: 80 price refreshes (71 GPT, 9 Müller), plus 2 structured Müller status-only unavailable changes.
- 263 review-proposal outcomes; 265 review CSV rows including the two link-replacement requests.
- 2 HTTP recheck failures.
- Zero logged database write failures, zero guarded-write misses, zero database mismatches across all 82 applied rows.
- GPT rows contain no link-status updates; every applied GPT row preserves its observed old status.

## SQL verification

Query source: Supabase execute_sql on project pqdkhefxsxkyeqelqegq; active=true and lifecycle_status=active. Fresh means price_checked_at within 14 days.

| Count | Before | After |
|---|---:|---:|
| Active products | 347 | 347 |
| Fresh price timestamps | 0 | 80 |
| Recommended products | 238 | 238 |
| Fresh recommended products | 0 | 79 |

The database also contains exactly 80 price stamps since this apply run started, matching the 80 applied price rows. This is 23.1% of active products and 33.2% of recommended products.

## Weekly timer

- chaarlie-price-audit.timer: enabled, active, waiting.
- Next actual tick: Monday 5 October 2026 at 04:31:12 Europe/Berlin (02:31:12 UTC).
- Schedule: Mon 04:30 Europe/Berlin; Persistent=true; RandomizedDelaySec=10m.
- Service ExecStart: /usr/local/bin/npm run price-audit -- --apply --llm-budget 100.
- User=nick; Group=nick; UMask=0027; WorkingDirectory=/opt/chaarlie/price-audit/current.
- EnvironmentFile=/opt/chaarlie/price-audit/shared/worker.env; PATH includes /home/nick/.local/bin.
- MemoryMax=1G; Nice=10; TimeoutStartSec=3h.
- No extra run was triggered when the new timer was enabled.

## Model selection and compatibility

- Installed server CLI: codex 0.156.1.
- Default before and after: gpt-6-luna, model_reasoning_effort=low, web_search=live; no service_tier override.
- The server config was already explicitly pinned to these values, so no config edit was needed. Its content hash stayed unchanged.
- All 100 apply researches recorded gpt-6-luna with low effort in the session metadata.

The CLI/account-visible catalog listed the following models. This is model-discovery evidence; only Luna was exercised in this rollout, and compatibility was not tested by running every other tier.

| Listed model | Role in selection |
|---|---|
| gpt-6-astra | Listed alternative; not exercised |
| gpt-6-sol | Listed alternative; not exercised |
| gpt-6-luna | Selected cheap research tier |
| gpt-5.6-sol | Listed alternative; not exercised |
| gpt-5.6-terra | Listed alternative; not exercised |
| gpt-5.6-luna | Listed alternative; not exercised |
| gpt-5.5 | Listed alternative; not exercised |

GPT-6 Luna has the lowest Standard credit rates among those listed models: 2.5 uncached input, 0.25 cached input and 12.5 output credits per million tokens. GPT-5.6 Luna is higher at 5/0.5/30. See [official pricing](https://learn.chatgpt.com/docs/pricing#token-rates).
Observed token totals for all 100 researches: 5,071,894 input, 4,221,952 cached input, 23,340 output. Token-equivalent estimate at published Standard rates: 3.472 credits. This is not an invoice or a measurement of included subscription allowance used.

## Intake worker independence

- Worker remained active, PID 71084, start time 29 September 2026 12:50:07 UTC.
- Worker environment and deployed source hashes stayed unchanged.
- Deployed codexResearchExecArgs passes -m runtimeConfig.model and -c model_reasoning_effort explicitly.
- Production intake research remains gpt-6-luna/low; challenger gpt-6-luna/medium; judge gpt-6-sol/medium.
- No intake files, units, routing or process were changed.

## Independent quality spot-check

Three answers from this apply were checked against independently opened live pages. All three eligible PDPs showed matching product and price; all three rows subsequently appeared as applied=true in the CSV. This sample does not validate every one of the 100 researches.

| Product / direct evidence | GPT price | Independently observed price | Outcome |
|---|---:|---:|---|
| [got2b Trockenshampoo Extra Volumen, 200 ml](https://www.rossmann.de/de/pflege-und-duft-got2b-trockenshampoo-trocken-waesche-extra-volumen/p/4015100800227) | €3.99 | €3.99 | Match |
| [Gliss Ultimate Repair Express-Repair-Spülung, 200 ml](https://www.rossmann.de/de/pflege-und-duft-gliss-ultimate-repair-express-repair-spuelung/p/4015100813494) | €4.99 | €4.99 | Match |
| [OLAPLEX No.3PLUS Complete Repair Treatment](https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment) | €34.00 | €34.00 | Match |

## Blocked Sentry monitor

Monitor: price-audit-weekly, ID 629c0113-7402-45ba-87b4-4300fc5a620b, organization haircare-fw.
The monitor already existed but was disabled. Read-only API verification after the run still shows disabled with an empty check-in list. Two enable attempts were rejected with HTTP 400; no billing settings were changed.

Exact API response:

```json
{
  "status": [
    "You don't have enough pay-as-you-go available to create a new seat"
  ]
}
```

To finish the dead-man monitoring requirement, increase the Sentry monitor/pay-as-you-go allowance or provide an available monitor seat, then activate this existing monitor. The timer and completed price updates are already live; missed-run alerting is currently unavailable.

## Other anomalies, verbatim

- Recheck reason: http_error (2).

- price delta 44% (12.49 -> 17.95 EUR) exceeds 30% (1).
- price delta 85% (3.75 -> 6.95 EUR) exceeds 30% (1).
- price delta 62% (3.99 -> 6.45 EUR) exceeds 30% (1).
- price delta 33% (75 -> 49.99 EUR) exceeds 30% (1).

These deltas were blocked. Sixteen GPT unavailable claims were routed to manual review without changing link status. Seven researches returned found=false; remaining rejected claims also stayed in review.

Unrelated systemd validation warnings from existing OS units:

```
/usr/lib/systemd/system/xfs_scrub_all.service:26: Support for option CPUAccounting= has been removed and it is ignored
/usr/lib/systemd/system/system-xfs_scrub.slice:15: Support for option CPUAccounting= has been removed and it is ignored
```

## Evidence

- [Original apply summary](summary.json)
- [Every applied old-to-new update](auto-writes.csv)
- [Review-proposal CSV](review-proposals.csv)
- [Applied-row database verification](first-apply-verification.json)
- [SQL baseline](sql-before.json) and [SQL after](sql-after.json)
- [All 100 GPT answers and evidence URLs](apply-research-evidence.json)
- [Quality spot-check](quality-spot-check.json)
- [Model token usage](model-usage.json)
- [Routing hashes unchanged](routing-unchanged.json)
- [Timer list](timer-list.txt), [timer state](timer-state.txt), [service state](service-state.txt)
- [Sentry monitor final state](sentry-final-state.json)

## Scope and remaining follow-ups

The local root checkout remains clean on main. The rollout initially made no repository changes. This follow-up commit archives sanitized receipts, applied/review CSVs and probe evidence; database writes are already live and are not performed by committing these files. The server source is still the pinned release.
Only Müller has reviewed deterministic adapter authority. dm, Rossmann and Douglas remain disabled at the adapter layer; GPT price-only fallback covered some of their products.

Separate follow-ups remain unchanged: dm legacy-GTIN/link cleanup and re-probe; repo unit/runbook corrections; probe gitignore exception; optional Claude ssh-deny settings publication. No memory updates were made.

## Follow-up identity review (30 September 2026)

The four >30% differences remain unchanged by this archive commit. Live dm pages independently confirm nedura 500 ml at EUR 17.95 (GTIN 4262490410776) and Pantene Hydra Glow mask 300 ml at EUR 6.45 (GTIN 8700216173261). The olive-oil page is 750 ml with GTIN 4066447918687, whereas the stored link encodes 4066447423761: product identity must be reconciled before substituting its price or link. The K18 answer reported Douglas 50 ml at EUR 49.99 versus EUR 75 UVP. Search-index evidence supports that historical listing, but an independent live browser revisit returns a Douglas 404, so EUR 49.99 is not independently confirmed as currently purchasable. Neither row is silently accepted as a verified current price.

All active products are considered. GPT budget 100 limits researched fallbacks, not candidate coverage or successful writes. Recommendation-surfaced products precede others, then oldest check first; unresolved rows can consume budget again. This does not guarantee all 347 prices remain fresh with a weekly budget of 100.
