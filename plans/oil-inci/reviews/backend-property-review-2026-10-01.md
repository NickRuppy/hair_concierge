# Fresh backend/database property review — 2026-10-01

Requested by Nick after property/value sign-off. Fresh internal `judgment_worker` reviewer (`oil_property_backend_review`), read-only, instructed to adopt a world-class backend/database engineering perspective and not dispatch another reviewer. This is a focused property/record-design review, not the later counterpart implementation-plan review.

## Verdict

Structurally sound for exploratory preparation. No approved property/value changes required. Actual classification awaits the scientific anchors and evidence/run contract. Not ready for production schema implementation.

## Findings and local disposition

| Finding | Classification | Main-session verification | Disposition |
| --- | --- | --- | --- |
| Missing/negative/unknown/empty serialization must be explicit | Technical contract detail | Property document permits six unknown assessments, strict protection booleans and empty role/hero arrays; omitted keys would add competing meanings | Accepted: completed records require all properties/flags; null/omission never default to negative; reviewed empty and unreviewed inputs remain distinct |
| Application instructions need separate coherent scenarios | Technical contract detail | Directions attributes include site, stage, dose, timing and rinse; one flattened row could combine incompatible permissions | Accepted: repeated scenarios per supported role, unique supported-use set, fit linked to role/scenario |
| Package/claim identity and dated evidence need freezing | Existing prerequisite | Category template input authority already distinguishes exact identities/sizes/markets; dispenser is package-specific | Accepted: freeze market/variant/package, INCI, source excerpts and rule/lexicon revisions |
| Enum checks alone do not enforce evidence semantics | Technical validation requirement | Approved UV is an AND rule; true flags, absent hero oil and conditional fit have evidence constraints | Accepted: four UV combinations and incomplete-packet guard; conditional validation of matches/mechanisms/conditions |
| Current production schema is not the research record | Production implementation blocker | `src/lib/product-intake/category-validators.ts:611` requires known weight and one of three fibre roles; `src/lib/oil/constants.ts:3` uses silicones/polymers/oils/proteins/humectants rather than the approved five booleans | Accepted: separate research artifacts; later explicit projection with visible non-projectable results |

No new product dimensions, protection states, schema framework or production table changes accepted. Thickness and legacy subtype/purpose mappings remain unresolved product decisions.

## Verification limits and artifact disposition

Main session inspected the property contract, current oil validator/constants and sampled the existing Conditioner test's packet/hash conventions. No tests or migrations executed; no live database operation. Science, source capture and calibration remain pending. This durable concise receipt is retained with the task; no transient reviewer transcript was written to the repository.
