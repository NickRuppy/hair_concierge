# Leave-In ingredient research

Status: **logic locked (Standard v1.0) — research engine active for Product Intake preparation, not live matching logic**

This directory is the durable entry point for the Leave-In ingredient-classification work. It separates formula-derived product research from user fit, and both of those from catalog or production activation.

## Versioning note

The folder `v1.0/` is the **artifact root version** (the frozen research package). The classification standard inside it carries its own **semantic version**, currently **v1.0** (`leave-in-inci-v1.0`), promoted unchanged from the `v0.4` draft at the 2026-09-13 freeze. A semantic bump (classification meaning, thresholds, routes, derivation, eligibility) does not create a new artifact root; a genuinely new research run does.

## Start here

1. Read the [runbook](./v1.0/runbook.md) — frozen-packet capture, the sealed-lane protocol, the agreement diff, the Lab review flow, and the rule-change discipline.
2. Use the [classification standard](./v1.0/leave-in-classification-standard.md) for the seven-dimension research record and the lean matching profile.
3. The [reviewed source snapshot](./v1.0/leave-in-classification-standard.v1.0-rc1.md) is the exact text calibration round 4 was run against — byte-identical to the normative file minus its Version preamble and version stamps.
4. The [rule-change ledger](./v1.0/rule-changes.md) is the entry-by-entry history; the table below is its index.

## What is authoritative

| Layer | Canonical location | Purpose |
| --- | --- | --- |
| Current Leave-In method | `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md` (Standard v1.0) | Normative seven dimensions, lean profile, anchors, thresholds, evidence ceiling, gates. |
| Reviewed source snapshot | `v1.0/leave-in-classification-standard.v1.0-rc1.md` | The exact bytes round 4 reviewed; the lock's `review_source_snapshot`. |
| Research procedure | `v1.0/runbook.md` | Packet capture, sealed lanes, agreement diff, Lab flow, rule-change discipline. |
| Category boundary + market | `v1.0/00_category_charter.md` | G0 eligibility, Germany/EU market, medical boundary, parked assumptions. |
| Researcher prompt (operative) | `src/lib/product-intake/leave-in-research-prompt-contract.ts` (`leaveInResearchPromptContract`, consumed by `scripts/product-intake/codex-research-worker.ts`) | The current consuming guide under the frozen `leave-in-research-envelope-v1.0` standard; must stay synchronized with the standard. |
| Researcher prompt (archived) | `v1.0/product-research-prompt.v0.1.md` | **Superseded, history only.** Predates the trim/freeze to the 13-dimension v1.0 envelope; do not follow. |
| Rule-change ledger | `v1.0/rule-changes.md` | T1–T19, housekeeping rows 20/20a, and the v0.1→v0.4 defect passes. |
| Logic-lock receipt | `data/research/leave-in-inci/v1.0/v1.0-logic-lock-receipt.json` | Machine-readable lock of the v1.0 scope, dimensions, profile fields and separate gates. |
| Artifact manifest | `data/research/leave-in-inci/v1.0/artifact-manifest.json` | Hash-pinned inventory of the normative source, snapshot, runbook and corpus. |
| Calibration corpus | `data/research/leave-in-inci/v1.0/corpus/gold-set/`, `…/corpus/unseen-test/` | Frozen packets, reference keys v1–v4, blind lanes, round reports, unseen-product test. |
| Lab fixture + review state | `data/research/leave-in-inci/v1.0/lab-fixture.json`, `…/lab-review-state.json` | 19 products / 397 reviewable properties; 15 approved + 4 G0-confirmed exclusions. |
| Science authority (**SR §x**) | `plans/leave-in-inci/research/leave-on-science-review.md` | The evidence base every scientific claim traces to. |
| Handover (**HO §x**) | `plans/leave-in-inci/handover/` | Category development handover v1.0 and its candidate profile. |
| Adapter decisions | `plans/leave-in-inci/adapter-decisions.md` | AD-1 (shared `format` enum), AD-2 (no `unknown` commits) and context rulings. |
| Historical drafts | `v1.0/leave-in-classification-standard.v0.1.md` … `v0.4.md` | The frozen round-1/2/3 rule sets and the promoted draft. Provenance only. |

## The rulings the standard rests on

Nick's binding rulings, one line each. Full text and per-record consequences: `v1.0/rule-changes.md` and the standard's §21.3.

| # | Ruling | What it decided |
| --- | --- | --- |
| T1 | SLIP folded into COND | `slip_combability_potential` stops being a property; the observation lives inside COND's evidence and may not move COND's value. |
| T2 | SFR descored | Not a scored dimension; becomes the typed `smoothing_route` trace input to the smoothing focus, which keeps the v0.3 two-observation test verbatim. |
| T3 | DOSE removed | No dimension, no derivation, no dosing caution string — general dosing advice already lives in the app's application-guidance layer. |
| T4 | `scalp_application_fit` removed | The repo separates cosmetic from medically adjacent scalp guidance; an exposure flag is not a tolerance prediction. |
| T5 | Six demoted flags → one `hinweise` record | SHN, CURL, R3, LAYER, buildup and transfer list only what fired; the record is emitted empty rather than absent. |
| T6 | `repair_support_level` added | `low \| medium \| high`, fixed rule, aligned with the conditioner engine's `repair_level`. Bond claims and marketing are `low`. |
| T7 | `manufacturer_hold_level` captured | A published hold level is C1/C2 claim data recorded verbatim; it never sets the HOLD 3-state and is never derived from formula. |
| T8 | Echo fields are annotations | Deterministic lean-profile projections of one dimension are shown on that dimension's row, not reviewed twice. |
| T9 | HUM removed completely | No dimension, field, ladder or claim adoption; the anti-frizz need is served by the smoothing focus. HEAT becomes the only claim-led field. |
| T10 | `product_form` = presentation form | Captured at identity (`spray \| milk \| lotion \| cream \| serum \| unknown`), never derived from the architecture class. |
| T11 | FORM demoted | The architecture taxonomy survives verbatim as the §3.1.2 reading convention, consumed inline by G0/WT/COND. Dimensions 9 → 8. |
| T12 | ROLE removed | `usage_role[]` is gone; its one informative bit becomes identity-level `application_stage[]`, transcribed not assessed. Dimensions 8 → 7. |
| T13 | Repair's marketing prong deleted; §10.2.1 permissive | Positioning never creates a focus; a single admissible COND-establishing set suffices for "beyond baseline". Four gold-set focus values move. |
| T14 | Cross-market claim exception | A non-German manufacturer page can create a claim at tier `C2_cross_market_verified` only with verified identity **and** German retailer corroboration. Cantu is the guarding counter-example. |
| T15 | Styling-boundary adjudication | A conditioning film with a supporting fixative is a leave-in (Neqi, in-category); a fixative system with thin conditioning behind it is styling (Maria Nila, excluded). |
| T16 | Tail-marker plausibility conditional | The rank prong may disqualify only where the marker sits after the COND/WT-establishing species; an implausible marker routes to review instead. |
| T17 | §1.1 invariant + seven audit items | "Every hard rule must fail toward review or toward the conservative value — never toward a recommendation", plus H1/H2/H3/H6/H8/H9 and the §14 trigger definitions. |
| T18 | Formula-set conflict precedence | Tier 1: three-source convergence (one GTIN-anchored German retailer) becomes the formula of record, with confidence stepped down and review routed. Tier 2: `unknown` + `formula_source_conflict`. Same-market only. |
| T19 | `balanced` gains a film-led reading | Directional neutrality is a co-equal reading of `balanced`; `unknown` is reserved for genuine evidence failure. Closes open gap §17.22. |
| 20 / 20a | Freeze-prep housekeeping (**not a ruling**) | Six convention fixes from the unseen test (vacuity test, E-level ladder, trigger vocabulary, three §18 strings, LAYER/SHN anchors, confidence bands) plus four round-4 residue fixes. No value moves; nothing here may be cited as a ruling. |

## Calibration status

| Round | Under | Result |
| --- | --- | --- |
| 1 | v0.1 | 363 fields, 86.2 % exact agreement, 50 disagreements |
| 2 | v0.2 | 398 fields, 93.0 %, 28 disagreements |
| 3 | v0.3 | 398 fields, 97.5 %, 10 disagreements |
| Unseen test | v0.4 | 6 previously unseen products, two sealed lanes; values agreed on five of six, the sixth a formula-source conflict that became T18 |
| 4 (freeze gate) | v0.4 (= v1.0) | **Zero value disagreements** on any scored dimension, profile field, focus, fit, `care_direction`, `repair_support_level`, heat binary or marker status — between both lanes and against the reference key, all 13 products. Residue: two packet evidence gaps, one text defect, three trace/naming items, all closed 2026-09-13. |

Agreement measures the repeatability of the rules, never the truth of a value.

## What the lock covers — and does not

The v1.0 logic lock covers the reusable seven-dimension classification logic and the lean matching profile it projects: vocabulary, anchors, thresholds, evidence ceilings, gates and the reasoning contract. It does **not** approve an individual product and does **not** authorize catalog, database, matching-policy or production use.

This package does **not**:

- write to Supabase or to any catalog field;
- change user recommendations or the production matcher;
- alter the live leave-in product schema on its own;
- authorize user-facing claims, or convert any repair/bond/heat claim into efficacy;
- establish exact ingredient concentrations or finished-product performance (formula-only conclusions stay at E2);
- diagnose a user or predict tolerance.

**There is no production adapter yet.** AD-1 (the `format` enum is shared, no mapping layer) and AD-2 (no `unknown` ever commits; an unresolved product stays `needs_research`) are ruled. Four decisions remain open and must be settled before an adapter is built:

1. **`roles[]` derivation** — `product_leave_in_specs.roles` has no research-side counterpart since T12 removed `usage_role[]`. What, if anything, derives it is undecided.
2. **`conditioner_relationship`** — `product_leave_in_fit_specs.conditioner_relationship` (`replacement_capable` / `booster_only`) has no dimension behind it in this standard.
3. **Eligibility emission** — how, and whether, a research record emits leave-in eligibility, given that an excluded product emits no lean profile at all (§2.3.1).
4. **`heat_protection_max_c` cutover** — the field is removed from the research model (charter ruling 6, OA-2), but is live in `src/lib/recommendation-engine/selection.ts` and in personal-plan catalog facts. Its removal is a scoped migration plus code-path change, surfaced to Nick before execution.

The §17 open evidence gaps stay open under v1.0 and are inherited by every record that touches them.

## Guidance synchronization

Every reusable classification or review-workflow change must update the normative standard **and** every consuming guide before the next leave-in batch (see the runbook's "Guidance synchronization" section), and bump the semantic `standard_version` when meaning changes. Historical runs are immutable; a policy change produces a new version or an overlay, never a silent rewrite. Local Lab approval accepts only the exact research artifact and version — it never implies Product Intake, catalog, Supabase, deployment, or production approval.
