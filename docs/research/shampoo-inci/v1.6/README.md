# Shampoo classification v1.6

Status: **LOCKED v1.6 (2026-10-10, ruling R14), amended by ruling R17 before publication. Active research method. Not production-active.**

| Field | Value |
| --- | --- |
| Policy ID | `shampoo-classification-v1.6` |
| Analysis model version | `shampoo-inci-v1.6` |
| Lock receipt | [`data/research/shampoo-inci/v1.6/v1.6-logic-lock-receipt.json`](../../../../data/research/shampoo-inci/v1.6/v1.6-logic-lock-receipt.json) |
| Artifact manifest | [`data/research/shampoo-inci/v1.6/artifact-manifest.json`](../../../../data/research/shampoo-inci/v1.6/artifact-manifest.json) (bytes + SHA-256 of every locked file) |
| CI pin check | `tests/shampoo-research-v1-6-lock.test.ts` (runs in `npm run test:node`) |
| Predecessor | [v1.4](../v1.4/README.md), parked and frozen; still guarded by `npm run research:shampoo:validate-parked-v14` |

## Files

| File | Purpose |
| --- | --- |
| [`classification-standard.md`](./classification-standard.md) | The normative locked standard: eight direct properties plus the production projection block (Section 13), with stable rule IDs. |
| [`rule-changes.md`](./rule-changes.md) | Every rule change from v1.4, rows 1–115, each with its source (ruling, weight method, or the calibration ambiguity it closes) and whether it could change a live value. |
| [`runbook.md`](./runbook.md) | How to research a new German shampoo under v1.6: formula freeze, sealed two-lane validation, adjudication, stop boundary. |

## Authority

- The standard in this directory is the only normative v1.6 text. It is byte-frozen; a rule change is a new version with its own calibration and lock receipt. The exceptions, ruling R17 and a text-only review fix that changes no rule (rule-changes row 115), were applied in place before the package was first published, with every pin refreshed.
- Locking approves the research method only. Product Intake reconciliation, catalog or Supabase writes, recommendation changes and user-facing copy each need their own approval (standard Section 16).
- The shipped Production Light adapter (`src/lib/shampoo/production-light-adapter.ts`) is still pinned to v1.4. Re-pinning it to v1.6 is a separate, reviewed change.
- The candidate working record (`plans/shampoo-v16/v1.6-candidate/`) and the living rulings ledger (`plans/shampoo-v16/rulings.md`) show how the standard got here. They are not normative; the receipt pins a snapshot of the ledger at R17 (`data/research/shampoo-inci/v1.6/rulings-ledger.md`).

## What changed vs v1.4 at a glance

- **One self-contained standard.** v1.4, the v1.4-draft final weight method (now Section 6 in full) and the operational amendment are merged; the Focus v1.5 overlay is absorbed (`moisture` added, `gentle` retired as a focus).
- **Production projection (Section 13), new.** Written rules for the three-tier thickness fit (green / amber / not shown), the projected live `weight` (1:1 from `weightPotential`), scalp targets with positioning and formula gates, cleansing intensity, the deep-cleanser dual listing, review flags and informational notes. Every uncertain rule fails toward the cautious value or to Nick's review (P0).
- **Scalp-concern floor (R4).** Thickness and weight can only make a dandruff, sensitive, dry or oily product amber, never hide it. The scalp match itself stays exact.
- **Anti-dandruff is the path, defined by the claim (R12, R15, R16.1, R17).** A product with a dandruff claim and a recognized anti-dandruff active is always on the dandruff path: dandruff is its primary target whatever else its name names, and it projects no secondary target (sensitive, dry or oily), wherever the claim sits. A formula that also suits an irritated, dry or oily scalp is kept as research-only `researchCombinationTargets` for a later profile feature. An active without a dandruff claim is a regular shampoo with only an informational note.
- **Cleansing intensity (R16.2, R16.3).** Only explicit deep cleansers (D1) with a strong formula record `clarifying`; a strong oily-scalp shampoo records `regular` (green for oily scalp). A "Tiefenreinigung" name on an ordinary formula keeps only its regular entry and gets an informational note, not a review flag.
- **No-gap apply gate (R5).** Every catalog apply must leave each of the 15 thickness × scalp cells with at least one recommendable shampoo; the exception register (X1, Monday Volume) is the only bridge.
- **Repeatability conventions.** Surfactant classes (C1–C6), the C2 conditioning elements, claim-source grading (CL-SRC), claim units (E2a/E2b), closed ingredient lists (E4, C2 humectants, CSA; kept closed by R16.4) and the neighbor rule (N-ALT) close the ambiguities two sealed lanes reported.

## Calibration evidence

All under [`data/research/shampoo-inci/v1.6/calibration/`](../../../../data/research/shampoo-inci/v1.6/calibration/) (copied from `plans/shampoo-v16/calibration/` at lock so the pins do not depend on `plans/`).

| Run | Products | Lane agreement | Report |
| --- | --- | --- | --- |
| Round 1 | 19 (13 gold + 6 unseen) | 296/304 = 97.4% | `round-1/round-1-report.md` |
| Round 2 | 13 gold | 202/208 = 97.1% | `round-2/round-2-report.md` |
| Unseen check v2 | 6 fresh Track B products | 92/96 = 95.8% | `unseen-v2/unseen-v2-report.md` |

Two sealed Opus lanes per run, frozen packets under blind ids, no web. The lane kits were single packets (product name, brand and claims delivered with the INCI; lanes self-reported working formula-first) without completeness or source-tier evidence; new runs use the two-stage kit (runbook step 3), and the receipt lists this as a known limit. Counting `researchCombinationTargets` as Section 14 requires leaves rounds 1 and 2 unchanged and makes the unseen check 98/102 = 96.1% (`calibration/research-combination-addendum.md`). Adjudication (R14): Garnier Wahre Schätze Kokosmilch & Macadamia weight `moderate` (genuine low/moderate boundary, resolved conservatively per P0/W3); Aussie Bouncy Curls stays `needs_research` until its formula source is re-verified. Rulings R15 and R16 were applied after the unseen check without a further calibration round (R13), and R17 after the lock, before the package was first published; the lock receipt records both as known limits.

## Open after lock

Both concern how the live app shows a result, not how a product is classified. They belong to the later app PR (new `weight` column + shampoo authority rule, R2) and must be settled before it ships. Details and examples: `plans/shampoo-v16/v1.6-candidate/open-questions.md`, questions 1 and 2.

1. **How the live rule turns `weight` into green or amber.** Recommendation in the standard (T7): row existence = eligibility; green when `weight` is ideal for the thickness (fine: light; normal: light or moderate; coarse: heavy), otherwise amber; no conditioner-style shift.
2. **Monday Volume for thick hair + oily scalp (X1).** Green under the T7 recommendation; amber would need a one-product rule in the app.

Also still to come, outside this package: the batch decision on closed-list additions after the Track A/B research (R16.4), the dandruff + irritated/dry/oily profile feature that would read `researchCombinationTargets` (R12 follow-up), and N1 confirmation that the irritated-, dry- and oily-scalp cells stay filled before any apply.
