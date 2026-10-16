# Natural-oil reference coverage extension

2026-10-02. Owner: Codex. Worktree `.worktrees/oil-inci`, branch `codex/oil-inci`. Status: completed locally; coverage and verification receipt linked below.

## Outcome and scope

Complete the natural-base reference against the finite formula evidence available in local category research and stored catalog fact evidence, and add a bounded reserve of commonly used cosmetic fixed oils. Create a new local v0.3 reference rather than modifying the v0.2 reference mirrored in the sealed exploratory run. Each observed identity is either matched to an exact sourced entry, retained with an explicit `unknown` prior, or documented as an excluded extract/essential oil/modified material/unspecified blend. An evidence gap cannot silently become medium. Completeness means the audited material universe is accounted for; it does not mean every possible botanical oil or every catalog formula has been verified.

No production adapter, runtime code, database write, fit policy, customer-facing behavior, new product calibration, commit, push or publication is in scope. The full-formula overlay keeps its v0.2 semantics: ingredient presence never directly determines finished-product weight.

## Decision coverage — confirmed

- **Confirmed with Nick:** original request for usable rough natural-base weights; OE14 permits clearly marked estimates. Current request: “Okay and are all natural oils covered that are potentially relevant for us as base oils in all the products we're going through? want to make sure that this is refrence is completed”. This authorizes auditing and filling relevant omissions in the research reference.
- **Inherited from evidence or contract:** exact species and plant-part/form identities; source provenance; immutable prior runs; low/moderate confidence; `light | medium | rich | unknown`; no density/penetration/marketing-claim shortcut and no unseen hair validation claim.
- **Implementation defaults:** inventory local raw-formula fields and read-only catalog source evidence, use primary supplier/specification evidence for missing materials, add common fixed oils in two bounded evidence lanes, then create v0.3 and a coverage receipt. Keep all 25 v0.2 priors unchanged; corrections and new identities remain separately visible. Distinct variants receive separate entries, including unknown when exact sensory evidence is absent. Reserve evidence may not hide observed omissions.
- **Open consequential assumptions:** none for this reference extension. Catalog-wide coverage is an evidentiary limit to report, not an approval or a reason to imply missing formulas were checked.

**Coverage acknowledgement:** the quoted request covers the local extension and its scope. **Internal revalidation:** 2026-10-02 after Claude review; the user requested all potentially relevant natural base oils for newly submitted products, so the bounded common-material research extension remains within that request. This is a reference lookup extension, with separate observed/reserve counts and no runtime/fit/activation behavior. A reviewer preference to limit research solely to already captured formulas does not require renewed approval. Undiscussed consequential assumptions affecting this handoff: none.

Exact extension scope: the nine missing declarations and five variants in the local inventory; plus separately sourced corn germ, sesame, rice bran, Campestris and Napus rapeseed, flax, evening primrose, borage, camelina, blackcurrant, meadowfoam, three rosehip species (Canina/Rubiginosa/Moschata), Edulis passionfruit, prickly pear, Inophyllum tamanu, Brazil nut, kukui, sacha inchi, plum, raspberry, coffee, cranberry, Sinensis camellia and seed-only sea buckthorn. Some overlap with observed gaps; deduplicate by exact INCI rather than counting grades as new identities. Ordinary/high-oleic sunflower observations remain advisory evidence for the existing entry and do not alter its v0.2 prior. Canola is admitted as its own sourced declaration with unknown weight; no Napus alias. Oat has an independently sourced material identity despite the unidentified calibration product. Any main departure from worker advisory priors is named in the completion receipt.

## Target map and operator outcome

- Evidence and inventory: `plans/oil-inci/research/natural-oil-coverage-*-2026-10-02.{json,md}`. Local inventory and catalog snapshot are inputs; worker source ledgers are advisory evidence.
- New authoritative local reference: `data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.3.json`, preserving the old file.
- New guide: `docs/research/oil-inci/v1.0/03_weight-reference-v0.3.md`; route current README/charter/property/standard guidance to it while retaining historical links and frozen methods.
- Coverage receipt, validator and review reconciliation: `plans/oil-inci/`.

The researcher preserves raw INCI, matches exact names, reads sourced material estimates and uncertainties, then assesses the full carrier architecture. Unresolved exact variants are visible rather than dropped or force-aliased. No surface, copy, timing or customer feedback changes; no UI walkthrough or prototype is required.

## Ordered deliverables and checks

1. **Inventory and missing-material evidence.** Consume current v0.2 and local/catalog formula records. Produce finite counts, observed missing exact identities, variant boundaries, primary-source observations and suggested estimates. Completion: each observed missing fixed-oil identity has a documented source or explicit evidence gap; counts distinguish copies, distinct formulas, products and all-catalog totals.
2. **Versioned reference and routes.** Consume inventory and verified ledgers. Produce v0.3 with source-backed identities, rough priors/unknowns, confidence, nearest alternatives and limits; preserve every v0.2 entry. New guide names actual coverage and does not expand formula semantics. Completion: all observed relevant declarations accounted for, ambiguous species/parts and modified materials cannot inherit an intact-oil prior by substring.
3. **Verification and receipt.** Produce and run `python3 plans/oil-inci/verify-natural-oil-coverage.py`: JSON structure, unique exact aliases, evidence-ID referential integrity, estimate/unknown invariants, observed-name accounting and old-entry preservation. Run existing `python3 plans/oil-inci/verify-natural-weight-artifacts.py` to confirm frozen runs and v0.2 remain intact, plus `git diff --check` and local-link/new-file whitespace checks. Evidence-sensitive manual review separates commercial skin proxies from hair results. Completion: exact coverage denominator, supported/unknown counts and remaining catalog limitations linked in a readable handoff.

## Review and stop

Use the local Claude lane for one read-only, terminal plan review before integration; verify its findings locally. No new dual-lane product run is warranted because this extends the material dictionary without changing the formula method. All durable task artifacts have `commit` disposition for later authorized publication; transient full review output has `discard` disposition after a concise verified receipt. Stop after the requested audited extension and verification are complete. State the recommended next step without silently starting an unapproved production or fit change.

## Final revalidation

Completed 64-material reference/guide and synchronized consuming routes. All 14 identified missing-identity/variant groups accounted for (13 reference identities, one identity blocker); all 17 distinct literal declaration spellings handled (12 generic exact matches, four source-scoped receipts, one blocker). Eight admitted materials retain explicit unknown weight. Previous 25 entries and sealed runs unchanged. Main's three advisory departures and the 26 additional common entries are disclosed. Current evidence covers 85 catalog products, including 19/54 oils; no whole-catalog claim. Verification and recommended next step: [completion receipt](research/natural-oil-coverage-completion-2026-10-02.md). Existing authorization suffices; undiscussed consequential assumptions for this local handoff: none. Durable artifacts retained locally; transient review/primary-download files discarded after checks. No database write, runtime change, commit, push or activation.
