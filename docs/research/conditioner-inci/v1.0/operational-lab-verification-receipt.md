# Conditioner Research Lab operational verification receipt

> Historical v1.4 operational receipt. The current v1.6 logic lock, Damage Fit recalibration, review-state migration, reading-copy QA, and fresh verification are recorded in `verification-receipt.md`.

Date: 2026-08-26
Branch: `codex/conditioner-inci-research-plan`
Base: `f5ed63193a697a4a9fc44fad8af2bcd2bcc4f391` (five commits behind current `origin/main`)
Scope: local 12-product Conditioner pilot review loop only
Canonical content fingerprint: `70cf6809faf160fc1053317f3175508bfb84fc86bb6c099b2fbe30110d626805` across 61 task-owned paths. The manifest includes the four referenced local review artifacts that are ignored by global file patterns, and excludes this receipt plus the transient `outputs/` and `tmp/` scratch copies.

## Verified behavior

- The queue shows all 12 pilot products. Each of the 11 eligible rinse-out products exposes all seven comparative profile fields; the leave-in product stays at G0 with no invented Conditioner profile.
- Every eligible property now exposes its exact evidence basis, named formula or source signals, derivation, evidence limits, and a separate `Why this exact classification?` comparison in English. Formula signals retain the exact INCI spelling and position; direction fields say explicitly that they are not INCI-derived; matching-fit fields expose their upstream formula signals and policy derivation.
- The threshold comparison explains why the selected value clears its boundary and why the nearest lower, higher, or categorical alternative does not. This extends the Shampoo Lab orientation of supporting and limiting signals with an explicit adjacent-value comparison for Conditioner research.
- The compact overview displays that threshold comparison directly instead of substituting a generic rationale. Aqua Hyaluron's moderate conditioning row names its one coherent base and absent additional deposition route; Balea Med's high row names the extra cationic-polymer and emollient routes that make moderate insufficient.
- Every allowed primary-focus specialist now has an explicit threshold branch. Regression coverage prevents future `shine` or `detangling` primaries from silently falling through to `general`; unknown values fail closed to rework.
- The Conditioner review journey now follows the Shampoo Lab's overview-first interaction model: five work-lane filters reduce the visible queue, the selected product opens with its title, remaining-field count, and whole-product action, a compact seven-field table precedes the long evidence, and full ingredient reasoning remains available below.
- A missing rationale can no longer degrade silently to a generic explanation in the UI; it appears as a rework defect instead.
- Nick can approve one property, request targeted rework with a mandatory comment, approve all seven fields plus the local analysis, or confirm the G0 product-form exclusion.
- Whole-product approval is blocked while any property has open rework. The worker handoff remains open until that exact property is approved after rework.
- Decisions persist against exact formula, profile, field-evidence, and semantic-standard fingerprints. Threshold reasoning is part of the field-evidence fingerprint, so a material explanation change reopens that property while unchanged field approvals may remain.
- Review state and worker rework handoffs are written atomically per file and rolled back together on an application-level failure. Tests cover both a newly created state file and restoration of prior saved decisions.
- Durable Conditioner research fixtures are available for a clean checkout and CI. Runtime `lab-review-state.json` and `rework-queue.json` remain ignored local operator state.
- The UI and API are development-only and expose no Product Intake, catalog, Supabase, deployment, or production action.

## Verification evidence

- Test-first red proof: the initial focused suite failed for the missing review-state module and missing full-product controls; the cross-file failure test separately failed before rollback was added.
- Evidence regression proof: the focused suite first failed against the previous generic rationale and missing `Formelsignale` UI. A second red pass proved that `thresholdReasoning` and its UI block did not yet exist. Adversarial assertions now prevent NEQI's moderate-weight fallback from leaking into high-weight products, prevent Hair Food's smoothing headline from claiming a stronger measurement than its higher wet-slip signal, and protect the German singular form.
- Focused final suite: 25 passed, 0 failed.
- Focused Conditioner source lint: 0 errors and 0 warnings.
- `npm run ci:verify`: typecheck passed, repository lint passed with five pre-existing warnings outside this task, and the production build completed with both Conditioner Lab routes.
- Browser exercise in an isolated local Chromium session: the lane navigator showed five priority, six standard, and one G0 product; switching lanes loaded Hair Food and the G0 product without changing review state. The selected eligible product displayed one compact seven-row overview before all seven detailed evidence sections with `Formula signals`, `Derivation`, `Why this exact classification?`, and `Evidence ceiling`. The final post-review pass selected Aqua Hyaluron and Balea Med from the live Lab and observed their distinct moderate-versus-high conditioning explanations in the overview with no console errors. Desktop and 390 px layouts had no horizontal page overflow.
- Save/navigation race exercise: the review POST was intercepted locally and held in flight without reaching the application. All lane and card navigation controls were disabled during the save, an empty lane cleared the unrelated product panel, the injected failure remained recoverable, and no review-state file was written.
- Read-only API audit: all 11 eligible products returned seven fields, giving 77 property explanations with at least two threshold-comparison lines and zero retained fields missing their required evidence basis; exact directions remain separately visible as protocol metadata and the G0 leave-in remained unprofiled.
- The clean user server was rechecked with 12 queue entries, seven fields in the selected eligible product, and the review counters rendered correctly.

## Review and stop boundary

The whole task received findings-first normal and structural review plus independent read-only counterpart review. Earlier passes fixed the open-rework approval guard and three threshold-reasoning defects. The Shampoo-navigation follow-up fixed an in-flight save/navigation race, stale detail in empty lanes, single-select accessibility semantics, and mobile toast width. The final counterpart pass found no live defect in the locked pilot and identified one latent specialist-focus fallthrough; the supported finding was fixed with explicit `shine` and `detangling` branches and a fail-closed default, then the affected tests, full Conditioner suite, repository gate, and live browser comparison were rerun. No accepted research value or review persistence semantics changed during this UI pass.

No commit, push, PR, Stage B research, catalog write, database write, deployment, or activation was performed. The duplicate files under `outputs/` and `tmp/` remain transient and must be deliberately discarded or archived before any future publication step. The four referenced `.docx`/PNG review artifacts are intentionally retained locally for now; because global ignore patterns omit them, they require an explicit artifact-disposition decision before any future ship step.
