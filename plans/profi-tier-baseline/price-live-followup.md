# Live pricing follow-up

The existing price updater is already online. Nick reaffirmed the last-known-price rule; no separate activation or age expiry is needed. This follow-up is commerce-only, not launch approval for the budget/Profi feature.

Read-only live checks:

- `chaarlie-price-audit.timer`: enabled, active/waiting. Next scheduled trigger `2026-10-05 02:36:37 UTC` (04:36 Berlin; schedule includes jitter).
- Existing service command: `npm run price-audit -- --apply --llm-budget 100`. Its loader targets all active lifecycle-active catalog rows, recommended products first. No new audit was launched.
- `chaarlie-product-intake-worker.service`: active/running, PID 1485; no worker/server changes.
- Production aggregate at `2026-10-03T19:37:12.229513+00:00`: 347 active products, 222 recommendation-enabled, 347 stored prices, 324 price checks within seven days, 23 older/undated checks, nine unavailable link statuses. The age bins are descriptive, not an expiry rule.
- Deployed stale-price display policy was verified in the preceding inspection at production source `192a61ee`; no new deployment is required for that existing rule. The price/updater feature is distinct from the unimplemented budget/tier feature.

## Exact status-only batch, applied

Nick approved the exact four-row preview. Fresh primary-offer checks confirmed the retained prices/packages; Rossmann's enabled purchase button was verified in Chrome. All four changed from `purchase_link_status=unavailable` to `available` at `2026-10-04T08:19:07.015852+00:00`, with a fresh link-check timestamp. The inspected normal trigger updated `updated_at`; all other product fields, identifiers and eight checked category/protocol/eligibility relations remained unchanged. Taft remains non-recommended.

| Existing product                   | Retained package / price | Primary evidence                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| got2b Liquid to Dry                | 150 ml / €3.95           | [dm](https://www.dm.de/p/d/2476987/got2b-trockenshampoo-liquid-to-dry): exact GTIN 4015100815788, deliverable.                                                                                                       |
| Allgäuer Ölmühle Bio Traubenkernöl | 100 ml / €7.99           | [Müller](https://www.mueller.de/p/allgaeuer-oelmuehle-bio-traubenkernoel-223549/): exact stored page/package, home delivery and cart. Retain the existing GTIN; the rendered page does not independently display it. |
| BioGourmet Distelöl                | 250 ml / €6.29           | [Greenist](https://www.greenist.de/biogourmet-bio-disteloel-250ml.html): exact EAN 4039057414863, ready for shipping.                                                                                                |
| taft Hydra Protect / Aloe Boost    | 150 ml / €3.99           | [Rossmann](https://www.rossmann.de/de/pflege-und-duft-taft-hitzeschutz-spray-aloe-boost/p/4015100893403): registered GTIN URL, selected 150 ml offer and dated delivery.                                             |

[Approved proposal and preserved expected-before state](./proposed-status-fixes.json); [applied receipt and independent readback](./availability-corrections-receipt.json). The first rollback dry-run refused before any UPDATE because two unrelated products changed concurrently. After refreshing only the comparison snapshot, the rollback test passed with no retained mutation; the guarded four-row apply and independent readback passed. No unrelated update was reverted or included.

## Remaining holds

The separate pricing task's Oct-3 receipt historically accounts for 27 canonical held rows: 18 lacked a verified acceptable exact purchasable offer; nine required identity/formula/version decisions. It paused 16 recommendation flags; two rows were already non-recommended. That action preserved prices, statuses, active lifecycle, identifiers and owned-product use. This task has not restored or changed any of them. During the present apply, unrelated concurrent updates were observed for Herbal Essences Aloe Vera Conditioner and got2b Schutzengel; recheck live state before treating the historical holds list as the current queue.

Source receipt: `/Users/nick/AI_work/hair_conscierge/.worktrees/price-audit-rollout-receipt/docs/price-audit-rollouts/2026-10-03-hold-buckets/README.md` and `remaining-decisions.json`. Read-only reuse; the other task's files are untouched. Its receipt is not blanket authority for new formula/identity writes.

Nine identity/formula cases: Balea Oil Repair conditioner, got2b Schutzengel, Balea 2-Phasen heat spray, Langhaarmädchen Beautiful Curls, Alverde Glanz conditioner, Schaebens Argan mask, Langhaarmädchen Lovely Long, Herbal Aloe conditioner and Innersense Harmonic Oil. Strong same-article evidence is not proof of unchanged chemistry; a different current variant must not silently inherit old category facts or identifiers.

Three bounded read-only explorers reused today's evidence and checked deltas. All 13 additional older-price non-recommended rows remain held: exact offers were unavailable/store-only or identity was unproven. No replacement or size was guessed. The old exact [Schaebens 20 ml page](https://www.dm.de/p/d/1688048/schaebens-haarmaske-arganoel) displays €1.45 but is not deliverable; this does not justify stamping a buyable current price or merging the distinct 14 ml version.

Do not equate the 27 canonical holds with the separate 27 age/status-flagged rows. They overlap in 23 rows; their union contains 31. The four extra rows are the status-only proposal above. Recent price timestamps therefore cannot serve as the remaining-resolution queue by themselves.

The only production writes in this follow-up were the four explicitly approved availability corrections above, plus their normal `updated_at` trigger. No server/worker change, audit/probe run, SKU publication, image/formula/identifier change, push, merge or deployment occurred. Artifact disposition: retain the preflight, rollback/apply SQL and final receipt with the task plan for later authorized publication; historical receipts unchanged. Counterpart review of the complete budget feature remains an existing future gate, not supplied by these operational checks.
