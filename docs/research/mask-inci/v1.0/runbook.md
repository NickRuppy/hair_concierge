# Mask research runbook — locked Standard v1.0

This is the operational sequence for a **new** exact German/EU rinse-out mask.
It does not change the locked method or its historical artifacts. Read the
[classification standard](mask-classification-standard.md),
[evidence lexicon](02_evidence_lexicon.v0.1.md), category charter and
[production bridge](../../../product-intake-mask-production-adapter.md) first.
Those documents own every threshold, exclusion and projection rule. Do not use
calibration labels, prior catalog values or an adjacent category's rules as a
shortcut. Product Intake's canonical runbook owns images, commerce, protocols,
review and final publication.

## 1. Resolve and freeze the exact input

Resolve canonical brand, clean product name, line, exact pack/market, GTIN when
available, complete verbatim INCI, source IDs/URLs and capture dates. Use the
standard §2 source hierarchy and conflict treatment. Preserve conflicting
captures; unresolved identity/formula stays visible and cannot silently become
verified. Capture authoritative **verbatim directions**, including the sourced
mask contact time and rinse action. Directions determine G0; a jar, name or
formula does not establish the category. Never derive dwell or cadence from
INCI.

Run G0 under standard §§2.1–2.2. Preserve `in_category`,
`excluded_product_form` with charter reason, or `insufficient_information`.
Excluded forms and evidence stops do not acquire an invented profile. A
multi-use product covers only the qualifying rinse-out mask mode and names
uncovered modes. Formula-level exclusions remain mode-independent.

Keep exact raw-INCI SHA-256 and the normalized ordered formula fingerprint
specified by the production bridge. Bind the input to the Product Intake
submission ID; a frozen calibration product ID is not a new submission ID.

## 2. Classify formula first

Follow standard §11 in order. Prepare and hash a blind packet containing the
complete normalized INCI, product form and necessary G0 directions facts;
remove brand/name, marketing claims, prior labels and fit outcomes. Classify
§7 direct properties and the formula-owned §9 fields before unblinding. Keep
observations separate from inferences, preserve the §4 evidence records and
anti-double-counting. Apply tail-marker plausibility and boundary-position
rules from the standard, without rewriting them here.

Unblind only for the narrow uses explicitly listed in §11. Record every
blind-to-final change and its reason. Formula-only evidence stays ≤E2 and is
worded as potential; no concentration, finished-product efficacy or structural
repair is inferred. Contact time, heat, amount, placement and cadence stay
protocol facts, with zero comparison-property credit.

## 3. Retain complete research and emit the projection input

One `property_synthesis` artifact has two **sibling** keys:

- `mask_research_record`: the full durable research, using the existing Mask
  record vocabulary. Include `standardVersion`, `productId`, exact `identity`,
  all fifteen §7.1 `directProperties`, full-evidence `profile`, `tailMarker`,
  `aboveTailSegment`, `bondRoute`, `hinweise`, `blindToFinalChanges` and
  `reviewTriggers`. Retain balanced-reading tags, counter-signals, multi-use
  scope, uncertainty, assumptions and all other research-only traces.
- `mask_research_envelope`: the unchanged strict
  `mask-research-envelope-v1.0` projection schema. Only
  `version`, `researchMethod`, `identity`, `formula`, `profile` and optional
  `legacyComparison` belong inside this envelope. Use the existing frozen
  standard/lexicon pins; adding this runbook does not re-pin historical replay.

The complete record is **not** reconstructed from a catalog projection. Its
`productId` and envelope `identity.researchId` both equal the submission ID;
`standardVersion` is `mask-inci-v1.0`. Record identity
`brand/productName/gtinEan/rawInciSha256` match the corresponding envelope
identity/formula fields. All nine comparison values and `bondRoute` agree
between the complete record and envelope. Echo fields remain derived
annotations of their driving fields, not independent judgments.

Always emit `hinweise.fired`, even when empty. Preserve every §14 human-review
trigger. The worker checks carrier shape and identity/formula/value consistency;
that check does **not** establish factual truth or replace the detailed evidence
review. A complete artifact remains available for judge/human inspection.

## 4. Project, inspect, and stop

Use the deterministic local adapter as documented in the production bridge,
writing a **new** artifact directory. Never regenerate or overwrite a frozen
research run. G0 exclusion, insufficient evidence, stale method, integrity
failure and `unknown` projected properties remain explicit stopped outcomes.

The worker owns `product_mask_specs`, `product.suitable_thicknesses` and their
rationales. It records `mask_production_projection` plus warnings, omitted
research properties and required protocol roles beside the research. The
confirmed MAD-1 baseline adds cosmetic `detangling_slip` for moderate/high
conditioning; no repair/efficacy value is upgraded. Do not hand-author these
catalog values or model-written protocol rows.

Capture sourced protocol slots in `researched_payload.draft.protocol`;
TPL-MASK/P5 owns the deterministic protocol stamp. Missing sourced contact time
or required evidence stays actionable. Image preparation, commerce, brand
review and catalog readiness are independent gates.

`projection_ready` is only the property lane. It is not image approval, catalog
or global-recommendation readiness, product publication, user linking or a
notification. Final review and the exact guarded handoff remain with Nick.
The integrated worker code must be reviewed/deployed separately; this runbook
and local replay do not activate a production workload or retry any backlog.
