# Sealed lane brief — Shampoo Track A re-check on locked v1.6.2 (runbook step 4)

You are one part of a **sealed classification lane** (`lane-a` or `lane-b`). Two lanes classify the
same products independently; agreement between them is the quality check. Your assigned lane and
blind ids are in your task message.

Root: the kit path given in your task message (below: `<kit>`). Use absolute paths only (Bash cwd silently resets).

## What you may read — and nothing else

1. `<kit>/<lane>/classification-standard.md` — the scrubbed copy of the locked standard
   `shampoo-classification-v1.6.2`. It is your only rulebook. Read it fully before classifying.
2. `<kit>/<lane>/formula/<id>.json` for your ids (stage A: INCI, fingerprint, completeness, source
   tier, identity confidence, pack size).
3. Only after the orchestrator tells you the reveal is released: `<kit>/<lane>/reveal/<id>.json`
   for your ids (stage B: product name, brand, verbatim claims and directions with source grades).
4. This brief and `/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/record-skeleton.json`
   (field names of a final record; values are placeholders).

Do **not** read: the other lane, `<kit>/held/`, `<kit>/blind-mapping.json`, the packets folder, any
other file in the repo, earlier calibration records, the catalog or the database. **No web of any
kind** (no WebSearch/WebFetch/browser). The packets are the complete evidence; if evidence is
missing, say so in `uncertainties` — never guess and never look it up.

## Phase 1 — blind formula pass (now)

For each of your ids, from the formula packet only, write
`<kit>/<lane>/out/formula-pass/<id>.json`:

- `blindId` (= the packet id), `inciFingerprintSha256` (copied from the stage-A packet);
- `directProperties` with the provisional eight properties of the standard (Sections 3.1, 4–12) —
  at minimum `cleansingStrength`, `conditioningLevel`, `weightPotential`, each with non-empty
  `value`, `confidence` and a conclusion-first `rationale` citing rule IDs and **normalized**
  one-based positions (ID-2); claim-dependent properties are provisional (formula-only) and say so;
- `formulaFacts` (surfactant classes, conditioning/weight routes, actives, with normalized
  positions) and `unresolvedMaterialIngredients`.

Write each file when that product is done. Then stop and report "phase 1 done" with the list of
files. Do not open any reveal file — they are not released yet.

## Phase 2 — reconciliation after release (when the orchestrator messages you)

Read your reveal packets. Apply Section 3.2 (post-unblind reconciliation) and the claim rules
(CL-SRC, E1–E4, the scalp-claim lexicon, D1 positioning, usage rules). Record every
blind-to-final change with its evidence. Then write the final record
`<kit>/<lane>/out/<id>.json` per the runbook step 4 contract and the skeleton:
the eight direct properties (value, confidence, conclusion-first rationale, formula facts with
normalized positions, counter-signal, `neighboringAlternative` per N-ALT); focus record and
decision trace (7.4, F-TRACE); full weight record (6.8); the projection block (Section 13: three
thickness fits after T6, `weight`, primary and secondary scalp target, observed intensity,
`explicitResetPositioning`, `deepCleanserListing` with `deepCleanserRecord: needs_record` where a
deep-cleanser record applies, review flags, informational notes, `researchCombinationTargets`);
`selfCheck` (6.11) and `uncertainties` (every reading you had to choose, with the alternative).

Never edit a formula-pass record after the release — it is hash-pinned; changes belong in the final
record's reconciliation notes. Uncertain → the cautious value (P0), never toward recommending.

## Hand-back (text only, each phase)

Phase 1: list of formula-pass files written. Phase 2: one line per id (final `weight`, primary scalp
target, fits fine/normal/coarse, review flags), then a **seal confirmation**: every file you read and
in which phase, that you used no web, and any incident (anything seen that could have contaminated
you).

## Round-2 seal rules (lessons from round 1)

- Never list, read or write the session scratchpad (`/private/tmp/...`). Put working/helper files only in `<kit>/<lane>/out/_work/`.
- Open files only by exact path for your own ids. No globs, `ls` or summary loops over shared folders (`formula/`, `out/formula-pass/`, `out/`).
- If the Write tool times out, write with a shell heredoc into your own `out/` paths only.


## Re-check notes

- Do NOT read anything in the repository other than the files listed above: no earlier Track A records (`data/research/`), no plans, no rulings, no other kit (`tmp/tracka-run1`, other `kit-W*`) — those would bias you.
- Classify every product fully under the candidate text, exactly as in a normal run; record the W-line fields (6.8) for every product, and in the comfort property state the CSA route used (listed route or MB) or the reason none applies.
