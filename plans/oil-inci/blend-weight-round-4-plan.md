# Oil blend rules and exploratory application round 4

2026-10-03. Owner Codex; existing `codex/oil-inci` worktree. Status: executed; ten-case research trial completed, final verification/review receipt follows.

## Outcome, scope and authorized direction

Consolidate the four agreed oil-blend estimates into one simple qualitative trial policy, then apply it to six new oil products and four reused development comparisons with two independent formula-only lanes. Deliver a readable result, full source/uncertainty receipts and actual classification coverage/disagreement counts. This is weight-only research, not sensory validation, a deterministic runtime change, general engine readiness or publication.

Chosen direction: `04_blend-weight-policy-v0.1.md` adds affirmative botanical, ester/alkane, silicone-film and rich retained-system tie-breakers while keeping low confidence, exact identities, alternatives and genuine unknowns. v0.7's 65-material JSON is unchanged. The point is practical approximate classification; neither percentage disclosure nor forced agreement is an acceptance gate.

## Decision coverage — confirmed

Confirmed with Nick: OE14 authorizes estimates; OE25–OE28 settled the four source-scoped oil examples; OE29 chooses light for the separate amika spray without changing the sea-buckthorn material prior. Nick explicitly said **“okkk lets do it”** to the proposal “consolidating them into simple blend-classification rules, then testing those rules on new products.” This is OE30 authorization for drafting, reviewing and testing this provisional policy now. The authorization is already in this conversation; a stale pre-reply ledger is not a missing approval gate.

Inherited from contract: full exact ordered declarations before blinded interpretation, no merged variants, product truth separate from fit, frozen historical runs, no skin-feel decision, no material-name inheritance, two independent lanes and separate main judgment. Agreement is repeatability, not accuracy. Human adjudications are developmental anchors, not measured reference targets. Ordinary styling sprays are outside the oil cohort; amika is not included in round 4.

Implementation defaults: six source-scoped DE maker inputs or explicitly market-limited equivalents: Moroccanoil Original, Wella Oil Reflections Luminous Smoothing, current DE John Frieda Der Bändiger Extra Strong, khadi Strong Amla, Mielle original Rosemary Mint and NUXE Huile Prodigieuse original. Four replay cases use the unchanged round-3 W01/W04/W06/W09 captures. These are new to oil classification, not unknown to all prior market/source work or a sensory holdout. Garnier Wunderöl is held as a capture conflict (different current web declarations), replaced by John Frieda; no variant merging or preselected weight target. Rule JSON and exact generic roles freeze before classification. No worked real formulas or brand claims enter the blind method.

Open consequential assumptions affecting this research trial: none. Hard scientific adoption, future fit, all-market coverage, other properties, adapters and activation are outside this requested deliverable. Undiscussed consequential assumptions affecting this handoff: none. Coverage acknowledgement: the quoted current request. Internal revalidation: review/source/verification findings will be recorded below, preserving this authorization unless evidence introduces a genuinely new choice.

## Files and operator result

Policy: `docs/research/oil-inci/v1.0/04_blend-weight-policy-v0.1.md` and `data/research/oil-inci/v1.0/reference/blend-weight-policy-v0.1.json`; lookup remains `natural-oil-weight-v0.7.json`. Active README, charter, property guide and standard point to the trial overlay for weight only.

Policy JSON contract: `version`, `status`, `weight_values`, `mixture_confidence`, eight `{id,text}` rules B0–B7 and `precedence` encode the Markdown clauses verbatim. Public JSON also has `provenance` with document path/hash and OE30. The run's `policy.json` is byte-equivalent JSON content after removing only `provenance`; the verifier checks that relation and each Markdown rule/precedence, avoiding divergent instruction copies.

| ID | Exact source-scoped case | Cohort | Source status |
| --- | --- | --- | --- |
| Q01 | NUXE Huile Prodigieuse original | fresh | DE maker complete |
| Q02 | PRIMAVERA Calendulaöl bio | replay | round-3 W04 frozen |
| Q03 | Wella Oil Reflections Luminous Smoothing Oil | fresh | DE maker complete; DE size unverified |
| Q04 | Mielle Rosemary Mint original | fresh | US maker / matching DE offer; limited equivalence |
| Q05 | OLAPLEX DE Original N°7 | replay | round-3 W09 frozen |
| Q06 | John Frieda Der Bändiger Extra Strong | fresh | current DE maker complete |
| Q07 | NEQI Smooth Strength Rosemary | replay | round-3 W06 frozen |
| Q08 | khadi Strong Amla | fresh | DE maker complete |
| Q09 | Moroccanoil Behandlung Original MOT02 | fresh | DE maker; separate official EU MOT01 |
| Q10 | K18 Molecular Repair Hair Oil | replay | round-3 W01 frozen |

Minimum fresh-case floor is the planned six: all six source captures are now complete. No smaller substitute cohort will silently count as completion. Replays test consistency with the developmental policy only; fresh cases are the only transfer-to-new-formula signal and neither cohort measures sensory accuracy. NUXE hazelnut Seed Oil has no v0.7 weight prior; its source-backed oil identity remains an explicit material-coverage gap. Malformed Mielle tokens remain unresolved source literals rather than guessed botanical repairs.

New run directory: `data/research/oil-inci/v1.0/corpus/exploratory/blend-weight-round-4/`. It contains raw source/conflict capture, source-scoped display receipts, identity map, blind ranked packet, frozen material/policy/role inputs and hashes, historical baseline, independent lane records/notes, root working records, comparison, CSV/readable results and output seals/verification. New verifier: `plans/oil-inci/verify-blend-weight-round-4.py`.

Operator submits exact formula; functions/material priors inform a qualitative carrier and retained-film interpretation. Output is a rough weight, positive and competing arguments, confidence, rule IDs and explicit gaps. No UI/copy/timing/runtime changes, so mockup and separate user-journey sign-off are not applicable.

## Work and acceptance

1. Complete the drafted policy's companion JSON and run one read-only terminal Claude plan review; retain reconciled findings only. Verification: affirmative rules allow estimates without fabricated amounts, preserve exact-name/grade limits and distinguish policy preference from scientific evidence. Accepted technical defects change the plan/policy; reviewer tradeoffs do not override Nick's choices.
2. Source/lexicon preflight. Bounded read-only capture delegates own disjoint source questions; root owns all writes. Complete maker/local capture with alternatives held separately, exact display normalization (footnotes/codes/translation labels only), derivative/plant-part boundaries and source-backed generic roles. Verify all six new cases are complete or visibly blocked. Do not silently replace a blocked ingredient with a guessed alias. Fresh classification identities/formulas checked against prior oil rounds; exact duplicate formulas must be disclosed or treated as replay.
3. Freeze ten cases plus identical neutral inputs: `method.md`, `material-reference.json`, `policy.json`, `role-lexicon.json`, `blind-packet.json`, `input-manifest.json`. Policy copy strips real-product provenance/answers. No claims/directions/identity links in classifier access. Freeze hashes and verify before dispatch. Two fresh judgment workers independently write disjoint lane directories, no browsing/catalog/memory/peer/source-capture access or reviewer dispatch. Root writes its own interpretation before opening lane outputs.
4. Compare and adjudicate. Report fresh six and replay four denominators separately, substantive classification coverage, raw and known-only agreement, disagreements and rule/gap patterns. Replay agreement with human choices is developmental consistency only. Preserve every independent answer even if root disagrees. Changes discovered through the round become a new revision, never in-place policy tuning or silent replay labels.
5. Verify and deliver. Artifact verifier checks source/raw-canonical alignment, scoped display receipts, every rank/role and exact material match, rule IDs, low-confidence mixture shape, exact allowed read scopes/hashes, ten IDs/cohorts, all historical bytes, independent/main records and comparison denominators. Add focused negative controls for false material inheritance, inflated confidence, undeclared scope and missing gap; no tests that merely mirror classifications. No runtime suite/DB checks are needed. Report source conflicts and missing evidence explicitly.

## Verification, review and stop

Run `python3 plans/oil-inci/verify-blend-weight-round-4.py --inputs-only`, then full verification; previous round-3 and natural-weight verifiers; `git diff --check`. The verifier's critical contract failures receive negative-control checks. `test-audit` applies to verifier authoring. Final review reads all new artifacts; counterpart plan findings are reconciled once rather than repeated for every worker result. Whole-branch counterpart before push is not triggered because publication is not requested.

Stop when versioned trial rules, ten-case completed or honestly blocked comparison, remaining gaps and recommended next step are delivered. No commit/push/PR/merge/runtime/catalog/database/deploy/cleanup. Durable local research docs and run artifacts: retain for an eventual authorized commit; full temporary Claude output: discard after findings are reconciled.

## Review and completion revalidation

Claude Opus 4.8/high returned Approve with revisions. Accepted: exact policy JSON/Markdown relationship, task-1 wording, case table/artifact manifest and explicit fresh-versus-replay interpretation. Fresh-floor concern resolved from concrete source evidence: all planned six are complete and remain required; no additional user decision is needed for a hypothetical smaller cohort. Policy complexity is within this authorized trial, with eventual intake adoption still pending. Review receipt: `reviews/blend-round-4-plan-review-2026-10-03.md`. Decision coverage remains confirmed. Final run verification/completion follows below.

Trial result: six new formulas and four replays completed. Both independent lanes classified 10/10 at low confidence and agreed on 10/10 classes; main initial interpretation differed on Q03/Wella and Q10/K18. Post-lane reconciliation prefers light for Wella with medium alternative, preserving the sealed initial medium; K18 retains OE28 light against the lanes' medium. These tensions identify a B4/B5 boundary for the next revision, rather than triggering in-place policy changes or claiming accuracy. NUXE hazelnut is a new material-coverage omission; 45 unassessed literal/functions remain individually visible. Named Calendula material-reference metadata and signature recognition limit cognitive blinding; this is formula-focused independent application, not a clean blind holdout.

All eight negative controls and full round-4 artifact verification pass; 80 historical files are unchanged. The normal correctness review found display-transform, named-gap and replay-identity guard omissions; all were repaired without changing the frozen method, policy, input packet, material priors or independent outputs. Final delta review and canonical fingerprint are retained in `reviews/blend-round-4-completion-2026-10-03.md`. Decision coverage remains confirmed for OE30: the authorized local trial is complete, while future policy adoption, broader calibration/fit/adapter and activation remain pending. No new user decision was needed for this result.
