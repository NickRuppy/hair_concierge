# next494 preservation preflight — corrected guidance scope

## Verdict

**No guidance blocker for the current next494 five-candidate batch.** This correction assesses only the actual guidance candidate in `plans/evidence/2026-10-04-next494-guidance-{candidates,manifest,controls}.json`: one declaration in `tests/agent-guidance.spec.ts`, **32 → 31**. The prior four Tracker conclusions are not reopened here. No repository file, runner, or mutation was used by this review.

## Actual guidance C1 — assertion union preserved

- **Donor:** `tests/agent-guidance.spec.ts:676-694`, `current-turn separated hair-loss wording can load safety overlay`.
- **Keeper:** `tests/agent-guidance.spec.ts:696-719`, `current-turn separated hair-loss wording loads safety overlay without model focus`.
- **Donor assertions:** guardrail ID is loaded; `avoid` contains diagnosis/regrowth/hair-loss language.
- **Keeper assertions:** the identical two observations, now with diagnostic messages at lines 713 and 717. Its input removes `profileFocus: ["hair_loss_or_thinning_guardrail", ...]`, while retaining the separated current-turn hair-loss wording and equivalent normal/dryness profile. It is the stronger detector proof: it cannot succeed through model focus.

`loadAdvisorGuidance` resolves IDs at `src/lib/agent/tools/load-advisor-guidance.ts:196-206`; `resolveAdvisorGuidanceIds` inserts current-turn safety IDs before compatible focus IDs at lines 228-241 and de-duplicates them. `deriveCurrentTurnSafetyOverlayIds` adds this exact overlay when `hasHairLossOrThinningSignal(message)` is true at lines 355-369. Therefore the donor focus can only contribute an already-present ID for its asserted outcome. The loaded Markdown is projected through the same `loadGuidance`/normalization path, and the keeper retains the donor's parsed-avoidance observation.

## Completed sensitivity evidence

The current test file is the manifest transfer snapshot (`cf3a8bda…`), and `load-advisor-guidance.ts` matches its pinned hash (`48afec6c…`). Main's completed receipt `/tmp/test-audit-next494-guidance-mutations-new/receipt.json` records both one-test faults, each before/fault/restored as `1/0`, `0/1`, `1/0` and restores the exact source hash:

1. `C1-current-turn-hair-loss-detector-false` fails `ERR_ASSERTION` at `tests/agent-guidance.spec.ts:713` with the intended message: “current-turn separated hair-loss wording must select the safety overlay without model focus”.
2. `C2-parsed-avoidance-receipt-empty` fails `ERR_ASSERTION` at line 717 with the intended message: “selected hair-loss guardrail must retain its parsed avoidance receipt”.

Those controls establish both retained observations on the actual owner. The candidate manifest pins the cut snapshot as 31 declarations and the source/data/CI command guards; no extra callback or input was added.

## Correction and artifact misrouting

The withdrawn blocker came from a generic `/tmp/test-audit-*guidance*` lookup selecting `/tmp/test-audit-guidance-c1-edit-plan.json`. That stale, separate artifact targets `tests/agent-v2-guidance-compiler.spec.ts` and `tests/agent-v2-responses-runtime.spec.ts`; it is not named by the next494 guidance candidate or manifest and has a different 180→179 scope. Its compiler-path concern remains a separate historical finding, but it must not be reported as a next494 loss or gate the current 32→31 cut.

## Limits

This confirms only the current next494 guidance transfer/cut. It does not generalize to Agent V2 compiled-guidance tests, unrelated overlay detectors, or the Tracker candidates. The receipt proves the named faults and exact restoration; it does not substitute for main's final staged diff/hash guard and focused validation after applying the cut.
