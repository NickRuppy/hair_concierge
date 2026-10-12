# Shampoo classification v1.6.2

Status: **LOCKED v1.6.2 (2026-10-12, Nick's decision after the test round: "yes to both"). Active research method. Not production-active.**

| Field | Value |
| --- | --- |
| Policy ID | `shampoo-classification-v1.6.2` |
| Analysis model version | `shampoo-inci-v1.6.2` |
| Lock receipt | [`data/research/shampoo-inci/v1.6.2/v1.6.2-logic-lock-receipt.json`](../../../../data/research/shampoo-inci/v1.6.2/v1.6.2-logic-lock-receipt.json) |
| Artifact manifest | [`data/research/shampoo-inci/v1.6.2/artifact-manifest.json`](../../../../data/research/shampoo-inci/v1.6.2/artifact-manifest.json) (bytes + SHA-256 of every locked file) |
| CI pin check | `tests/shampoo-research-v1-6-2-lock.test.ts` (runs in `npm run test:node`) |
| Base | [v1.6.1](../v1.6.1/README.md), locked 2026-10-12, byte-frozen and unchanged; still guarded by `tests/shampoo-research-v1-6-1-lock.test.ts` (and v1.6 by `tests/shampoo-research-v1-6-lock.test.ts`) |

## Files

| File | Purpose |
| --- | --- |
| [`classification-standard.md`](./classification-standard.md) | The normative locked standard: the full v1.6.1 text plus the v1.6.2 changes (marked "(v1.6.2)"). Self-contained. |
| [`rule-changes.md`](./rule-changes.md) | Rows 138–143, every change from v1.6.1, with its source and whether it could change a live value. Rows 1–137 stay in the v1.6 and v1.6.1 ledgers. |
| [`runbook.md`](./runbook.md) | How to research a new German shampoo under v1.6.2: the v1.6.1 procedure with version and path references updated. |

## Authority

- The standard in this directory is the only normative v1.6.2 text. It is byte-frozen; a rule change is a new version with its own test round and lock receipt.
- v1.6.1 and v1.6 are not edited.
- Locking approves the research method only. Product Intake reconciliation, catalog or Supabase writes, recommendation changes and user-facing copy each need their own approval (standard Section 16).
- The shipped Production Light adapter (`src/lib/shampoo/production-light-adapter.ts`) is still pinned to v1.4. Re-pinning it to v1.6.2 is a separate, reviewed change.
- The candidate and the plan (`plans/shampoo-v162/`) show how the standard got here; they are not normative. The receipt pins a snapshot of the rulings and copies of the evidence and the test round.

## What changed vs v1.6.1 (ruling R18)

- **Mild-base route (MB).** A sensitive-scalp claim now passes the formula check when the formula has a listed comfort ingredient before the perfume **or** a mild surfactant base: no strong anionic surfactant (alkyl sulfates, alkyl ether sulfates, olefin/alkylbenzene sulfonates) before the perfume and cleansing strength low or moderate. Claims alone still never pass. Dry scalp is unchanged.
- **Closed-list batch decided.** No ingredient is added to any list; six candidates are rejected for lack of rinse-off evidence.
- **Laureth-9 = Polidocanol.** The listed comfort ingredient is now also recognised under its INCI name.
- **Evidence boundary.** The lists and MB are plausibility filters, not proof of soothing; research never supports "soothes" in user copy.

## Test-round evidence

Under [`data/research/shampoo-inci/v1.6.2/test-round/`](../../../../data/research/shampoo-inci/v1.6.2/test-round/): two sealed Opus lanes, two-stage kit, 9 Track A products, expected outcomes pre-registered before any lane ran. 150/153 = 98.0% agreement. The one registered move (Sebamed Every-Day to `sensitive` via MB) happened in both lanes; every control held. Two departures, neither touching a v1.6.2 rule, were adjudicated by Nick (run log).

## Open after lock

1. Track A re-check: all 73 live shampoos plus three corrected packets on v1.6.2 (rollout worktree), then Nick's review of the changes only.
2. Production Light re-pin to v1.6.2 and the app weight / three-tier PR (with the R19 live-display rule: scalp concern decides the fit colour).
