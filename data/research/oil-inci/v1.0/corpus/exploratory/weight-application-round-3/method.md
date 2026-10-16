# Oil weight application round 3 — frozen method v0.7

Read ONLY method.md, material-reference.json, role-lexicon.json, blind-packet.json and input-manifest.json in this directory. No browsing, repository/catalog/memory/identity/source-capture/complete-list audit/peer-output access, no following links, no dispatching another agent or reviewer. Generic material priors are intended inputs; recognizable INCI cannot guarantee ignorance of a brand, so note recognition without importing outside facts.

WEIGHT ONLY. These formulas apply rough priors and whole-formula reasoning; they do not validate measured hair feel, user fit, other direct properties or intake readiness. Pure-material agreement largely tests lookup consistency. Separate raw-material benchmarks from exact product formulas. No maker weightless/fine-hair/repair claims are provided.

Use the exact current material-reference matches and generic role evidence. Role-lexicon entries may have historical scope or unassessed functions; neither a role nor an INCI rank is concentration or a grade. Whole botanical oils do not inherit a generic medium floor. No standalone Calendula class. Modified castor derivative does not inherit rich castor. Unspecified sunflower Oil does not inherit Seed Oil; material-specific uncertainty may remain. Reviewed input display normalizations are already resolved and are scoped to these formulas, not new generic aliases.

Return all 10 IDs exactly once. Write ONLY your assigned lane records.json and notes.md; do not amend after main/peer outputs. Shape:
{run_id:"oil-weight-application-round-3", method_revision:"weight-v0.7", lane_id:"a"|"b", files_read:[...], records:[{neutral_id,input_kind,material_matches:[{rank,reference_id,prior,formula_role:"principal"|"secondary"|"auxiliary"|"unresolved",reason}],ingredient_roles:[{rank,canonical_name,role:"principal"|"secondary"|"auxiliary"|"unresolved",reason}],weight:{value:"light"|"medium"|"rich"|"unknown",estimate:true|false,confidence:"moderate"|"low",evidence:[...],counter_signal:[...],nearest_alternative:"light"|"medium"|"rich"|null,reason:...,unresolved:[...]},completion_status:"weight_only_complete"|"weight_only_blocked",issues:[...]}]}

Every substantive class has estimate:true; unknown has estimate:false, low confidence, specific unresolved gap and a nullable nearest alternative. Confidence cannot exceed decisive material/role evidence; two-lane agreement never upgrades it. Record every rank exactly once; match every exact admitted fixed oil/MCT, including secondary/auxiliary ones, without guesses. Explain the strongest lighter/richer competing interpretations and why the chosen class wins. A balanced unresolved carrier architecture stays unknown; medium is not a missing-data fallback. Do not invent grades/percentages/tail cutoffs or replace judgment with first-two/count-vote rules.

Notes attest exact files read, five input SHA256 hashes, complete IDs, any banned access/recognition and uncertainty. Use Python/stdlib only for permitted reads/writes/hashes. Stop after saving. You are not alone in the workspace; other lanes/main have disjoint scopes. Do not modify or revert their files.

# Current operative overlay

## Read a new formula

1. **Resolve identity.** Preserve complete raw INCI/ranks; match the exact canonical names or reviewed aliases. Only trim/collapse whitespace and case for lookup. Do not erase parentheses/form/plant-part terms, guess botanical synonyms or convert an extract/derivative into an oil. A source-backed label-display correction is a separate exact-product receipt. An unresolved decision-relevant material needs review.
2. **Record material priors.** For every admitted fixed oil/MCT, record rank, reference entry, prior, confidence and alternatives. This is ingredient evidence, not yet the product answer. MCT means exact `CAPRYLIC/CAPRIC TRIGLYCERIDE`; “fractionated coconut” or “MCT” alone cannot establish that identity. This processed emollient is not an intact plant oil for base inventory.
3. **Read carrier roles.** Use the v0.1 whole-formula ledger: principal, secondary, auxiliary or unresolved. Rank helps interpret the carrier backbone but is not concentration. No fixed first-two rule, count vote, percentage, 1% boundary or presumed trace tail.
4. **Single material plus auxiliaries.** If one identified oil/emollient is the entire carrier and everything else is a recognized auxiliary, use its admitted prior as the working product estimate, retaining its evidence ceiling, confidence and strongest alternative. Unknown grade alone need not force unknown. An unresolved ingredient that could change the backbone prevents this shortcut. This permits a pure castor estimate from the entire carrier; it does not create a rich floor for any castor-containing product.
5. **Blend or competing carrier.** Judge the principal oil mixture together with volatile/mobile emollients, residual films/gums/resins and structural lipids. Consistent principal priors can support a class. Opposing priors require an affirmative explanation of the overall carrier/film architecture; rank alone cannot establish majority or decide a balanced case. Do not average classes or assign medium because light and rich oils coexist. A secondary/auxiliary rich oil contributes a counter-signal without forcing rich. A light oil does not cancel a substantial film system.
6. **Challenge and return.** State why the best-supported class wins over both lighter and richer interpretations; retain any decisive uncertainty. `medium` requires positive intermediate evidence, never missing evidence. If interpretations remain balanced or decisive material identity/film behavior is missing, return `unknown` with a specific gap.

Every substantive weight remains `{value, estimate:true, confidence:moderate|low, evidence, counter_signal, nearest_alternative, reason, unresolved}`. Product confidence cannot exceed the decisive material/architecture evidence; two-lane agreement never upgrades it. New evidence or an exact verified grade can support a separately logged derivation. No hidden fit or efficacy conclusion follows.

## Boundaries to check

- A mobile carrier with a late rich botanical oil must still be judged from its full residual system; presence cannot decide the product.
- A substantial gum/resin system can dominate light botanical priors; volatile carrier does not erase the film.
- An all-oil blend with opposing priors does not reveal ratios and may remain unknown.
- A recognized modified oil uses its own exact material evidence; `PEG-40 HYDROGENATED CASTOR OIL` and `COCO-CAPRYLATE/CAPRATE` do not inherit castor/coconut priors.
- An unfamiliar fixed oil stays outside the reference until researched. `unknown` is available; “all plant oils medium” is not a fallback.
- Refined and crude avocado can share INCI but differ in sensory descriptions. Grade-specific evidence can alter an estimate; ordinary INCI cannot identify the grade.

