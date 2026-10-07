# Mask engine — Phase 1 decision-coverage record (charter)

Phase status: **ruled — Phase 1 checkpoint complete 2026-09-04**
Charter of record: `docs/research/mask-inci/v1.0/00_category_charter.md`

```text
Decision coverage: confirmed (for Phase 1 / category charter only)
Confirmed with Nick (2026-09-04):
  - F1 Multi-use: mode-scoped include — classify only the stated rinse-out mask mode;
    envelope carries multi_use flag + uncovered modes; conditioner-mode-only 2in1s stay
    in the Conditioner engine (no product gets two engine profiles)
  - F2 Express Kuren (7s/30s/1min): included; dwell is P5 protocol metadata, not a boundary test
  - F3 Bond-claim masks: included with claim-gated bond route (R7 pattern); catalog-bondbuilder
    specialist products stay excluded
  - F4 Gloss/lamination rinse-out treatments: included as shine-focused masks, claims claim-gated
  - Coverage target: ≥80% of German drugstore (dm/Rossmann/Müller) rinse-out mask shelf
    classifiable without boundary exclusion; calibration anchored in the 50-product catalog
    archetype space
Inherited from evidence or contract:
  - Market DE/EU; research unit = exact market product + pack/formula version (conditioner charter pattern)
  - Shared engine invariants incl. blind lane + independent reviewer (docs/research/README.md;
    leave-in kickoff rulings precedent)
  - Medical boundary G6-equivalent
  - Projection targets fixed: product_mask_specs + suitable_thicknesses +
    intensive_conditioning_mask / TPL-MASK (kickoff handover)
  - Role-incapable forms excluded: leave-on-only, pre-shampoo-only, color-depositing,
    scalp/medicated, salon chemistry (cannot take the TPL-MASK role the projection requires)
Implementation defaults:
  - Artifact layout docs/research/mask-inci/v1.0/ + data/research/mask-inci/v1.0/
  - English reviewer evidence text; ledger format mirrors the conditioner disagreement log
Open consequential assumptions: none for Phase 1.
  Parked out of scope (explicitly acknowledged by Nick 2026-09-04): cross-category multi-row
  architecture; affected work parked with it: scan GTIN disambiguation, routine double-slot
  semantics, sibling-row intake
Undiscussed consequential assumptions affecting this handoff: none
Coverage acknowledgement: Nick ruled F1–F4 + coverage target + parked item on 2026-09-04;
  covers the Phase 1 charter checkpoint only. Phases 2–6 each require their own rulings.
```

## F1 adjudication trail (kept because it refined the rule)

Nick first raised (a) whether multi-use products need engine coverage at all and (b) a
per-category-row catalog architecture. Evidence: 8 live multi-use masks are
`is_chaarlie_recommended = true`, so exclusion would leave recommended products without
formula-first backing. The multi-row idea was assessed as sound catalog architecture but
independent of the research charter (caveats: GTIN disambiguation in scan, asymmetric engine
availability, routine double-slot semantics) and parked as its own later decision.
Mode-scoped classification is forward-compatible with it.

## Next phase

Phase 2 — property set: candidate research properties vs. the fixed projection targets;
deterministic vs. judgment vs. claim-gated per template §5; `concentration` needs its own
definition (no conditioner counterpart); whether the research profile keeps a focus hierarchy
(mask production fields are flat). Ends at a Nick checkpoint before Phase 3.
