# Catalog publication/admission99 semantic ledger

99 exact AST registrations: 96 R, 3 conditional C, 0 D, 0 F. No removal credit; main proof pending. All original literal parameter rows remain. Full bodies and original assertions: ledger.json / frozen-tests.json. R on the existence-only callback is a bounded hold, explicitly not an independent-contract claim.

- **R** tests/expansion-apply-batch.test.ts:106 — the reviewed mask manifest parks only its excluded-identifier product
  Existing mask fixture admission keeper: total partition, exactly one exclusion, named identifier gap and no parked/emitted overlap. Receives C3; same five rows, supplement, builder and serialization.

- **R** tests/expansion-apply-batch.test.ts:121 — a deviation-flagged protocol parks the product for Nick's review (R4/F-06)
  Injected packaging deviation must park the exact target with deviation_requires_review; ordinary exclusion fixture never exercises this review veto.

- **R** tests/expansion-apply-batch.test.ts:149 — a product without a finalized own-bucket image is parked, not published (R5/T4b)
  External image URL must park all products with missing_finalized_image; own-bucket happy path cannot detect an image-boundary bypass.

- **R** tests/expansion-apply-batch.test.ts:165 — a product with no operator supplement is parked with a named gap
  Removed Garnier supplement must yield the exact sole missing_operator_supplement gap; distinct from malformed present image.

- **R** tests/expansion-apply-batch.test.ts:179 — evidence with no quote anywhere is parked — a source text is never invented
  Removing manifest/protocol/operator quote sources must park; catches fabricated evidence fallback, not merely schema acceptance.

- **R** tests/expansion-apply-batch.test.ts:203 — the manifest's own evidence source_text wins over every fallback
  Conflicting fallback text must lose to actual manifest source_text; precedence differs from the no-quote rejection.

- **R** tests/expansion-apply-batch.test.ts:234 — a manifest quote rescues a product the operator supplement would have parked
  Empty operator evidence override must be rescued by the original manifest quote; catches an overly strict supplement requirement.

- **R** tests/expansion-apply-batch.test.ts:257 — an existing-product update whose target is quarantined is parked (disposition guard)
  Explicit quarantined existing-product target must park; new-product identity checks do not execute this disposition path.

- **R** tests/expansion-apply-batch.test.ts:309 — a canonical GTIN already owned by another product parks the item
  Canonical identifier belongs to another product; ownership collision is independent of same-name identity.

- **R** tests/expansion-apply-batch.test.ts:334 — an active product with the same brand+name parks the item as an identity collision (F-09)
  Active same-brand/name record with no identifier collision must park; separate duplicate identity admission rule.

- **R** tests/expansion-apply-batch.test.ts:372 — an oil product's non-mask protocols stamp instead of parking (B1)
  Oil manifest non-mask protocols must publish all expected roles with no protocol_stamp_failed; category path and fixture differ from masks.

- **R** tests/expansion-apply-batch.test.ts:397 — a stray mask wait copy in the supplement cannot break a non-mask stamp (B1)
  Stray mask wait copy on oil supplement must not corrupt its non-mask stamp; keeper oil input has no stray field.

- **R** tests/expansion-apply-batch.test.ts:421 — a leave-in product's TPL-LEAVEIN-DAMP protocol stamps instead of parking (B1)
  Leave-in manifest damp protocol must publish Garnier with exact post_wash_leave_in role; separate category validator and manifest.

- **C C3** tests/expansion-apply-batch.test.ts:438 — the emitted batch never carries a recommendation flag (R3)
  C3: complete two-assertion union into existing identical maskManifest/supplementFor/buildExpansionApplyBatch keeper. No extra read/build/fixture call.

- **R** tests/expansion-apply-batch.test.ts:455 — the apply gate opens only when the switch is armed on the exact reviewed head
  Armed, clean, matching reviewed head must produce empty blockers; preserves positive gate independently from denials.

- **R** tests/expansion-apply-batch.test.ts:459 — --confirm alone cannot execute: the environment switch is independent
  Undefined/disabled execution flag with otherwise armed inputs must independently block; CLI confirm cannot substitute for arming.

- **R** tests/expansion-apply-batch.test.ts:469 — a well-formed but stale --reviewed-head is refused
  Mismatched well-formed reviewed head must block even when armed and clean; no other gate input exercises this comparison.

- **R** tests/expansion-apply-batch.test.ts:480 — a dirty worktree is refused even on the right head
  Dirty checkout with matching head and enabled switch must block; separate write-safety gate.

- **R** tests/expansion-apply-templates.test.ts:57 — all 11 templates produce a schema-valid, product-scoped V1 guidance payload
  Existing all-eleven default-slot schema/product-scope keeper; retains version/locale/scoping/evidence/empty-reserved fields and receives C1/C2 on the existing row/payload only.

- **C C1** tests/expansion-apply-templates.test.ts:101 — TPL-OIL-LEAVEON stamps only the reviewed wash-family day types
  C1: default oil leave-on payload and schema parse already occur inside all-eleven keeper. Preserve exact ordered four-day literal on that existing iteration.

- **C C2** tests/expansion-apply-templates.test.ts:113 — row role/category come from EXPANSION_TEMPLATE_META, not the payload's semantic role
  C2: same eleven default rows already exist in keeper. Preserve row-vs-meta role/category for each row plus both literal MASK vocabularies using existing MASK row.

- **R** tests/expansion-apply-templates.test.ts:128 — §2.4 column ↔ payload invariants hold for all 11 templates
  Column-to-payload consistency includes rinse exception, generated/source column omission, cadence/modifiers and heat reapplication; schema validity alone does not imply these bindings. No extra Object.keys/isHeat calls added to another keeper.

- **R** tests/expansion-apply-templates.test.ts:176 — stamped rows build a V2 pointer whose applicationFamily matches the template map
  V2 conversion reaches its own family/sourceRole/scope mapping, unlike V1 schema parse. Keep its existing full input loop.

- **R** tests/expansion-apply-templates.test.ts:202 — the ruled contact windows survive the V2 builder's German copy parsing (§2.5)
  German wait-copy parser output exact ranges and null precedence are not proven by family equality; preserves six concrete template windows and conditioner opt-in.

- **R** tests/expansion-apply-templates.test.ts:249 — TPL-MASK accepts a sourced range/maximum with contactTimeSeconds null
  Null numeric time with range/maximum copy uses two existing literal rows; exact-default mask input cannot reach either parsing branch.

- **R** tests/expansion-apply-templates.test.ts:274 — heat templates switch family/stage/state on the researched damp-or-dry fact (P9)
  Both damp-only and either-state heat builds plus V2 heat object and copy completeness; preserves explicit dry-use facts and array order.

- **R** tests/expansion-apply-templates.test.ts:322 — missing or invalid required per-product slots throw
  Negative required slots, evidence, UUID, cross-template fields, source type/date and exact-time copy validation; positive builds cannot prove throws.

- **R** tests/expansion-apply-templates.test.ts:438 — unknown template ids throw instead of silently stamping nothing
  Unknown template ID must throw before stamping; no known-template keeper reaches absent metadata/builders.

- **R** tests/admin-product-category-write-policy.test.ts:6 — admin product edits allow aliases of the same canonical category
  Same-category aliases preserve edits under canonical normalization; positive path differs from unresolved or cross-category values.

- **R** tests/admin-product-category-write-policy.test.ts:11 — admin product edits reject category changes and unresolved legacy values
  Cross-category and unresolved legacy category must require guarded repair; no alias-success assertion detects fail-open recategorization.

- **R** tests/admin-product-support-specs.test.ts:24 — product schema accepts bondbuilder support specs
  Complete bondbuilder payload survives category-specific schema with full output object; independent enum and field vocabulary.

- **R** tests/admin-product-support-specs.test.ts:42 — product schema accepts canonical leave-in fit specs
  Leave-in fit schema accepts canonical relationship/benefits; different category dispatch than mask or bondbuilder.

- **R** tests/admin-product-support-specs.test.ts:57 — product schema accepts engine-native mask specs
  Mask engine-native weights/concentration/flags output is preserved; does not share operative schema with other specs.

- **R** tests/admin-product-support-specs.test.ts:72 — product schema preserves purchase-link health fields without category specs
  Nullable purchase-link health fields survive without category specs; metadata output contract is independent from category rejection.

- **R** tests/admin-product-support-specs.test.ts:91 — product schema rejects missing and unmapped catalogue categories
  Missing and unmapped category are rejected; positive category fixtures cannot detect normalization fail-open.

- **R** tests/admin-product-support-specs.test.ts:101 — product schema requires deep-cleansing specs for deep-cleansing products
  Deep-cleansing category without its spec must reject; present-but-invalid specs use a different guard.

- **R** tests/admin-product-support-specs.test.ts:115 — product schema rejects incomplete deep-cleansing specs to preserve fit metadata
  Partial deep-cleansing spec must reject missing fit fields; preserves schema field completeness independent from absent object.

- **R** tests/admin-product-support-specs.test.ts:132 — product schema accepts complete deep-cleansing reset specs
  Complete deep-cleansing reset object must accept; catches over-restrictive validation left invisible by negative cases.

- **R** tests/admin-product-support-specs.test.ts:157 — product schema restricts dry shampoo to supported bridge spec fields
  Dry-shampoo canonical fields survive while unsupported shape is rejected; preserve both alternatives and output projection.

- **R** tests/admin-product-support-specs.test.ts:177 — product schema accepts peeling specs with canonical peeling type
  Peeling category requires canonical peeling type vocabulary; no other category reaches its schema.

- **R** tests/admin-product-support-specs.test.ts:191 — product schema rejects profile-only concerns on products
  Profile-only concerns rejected on product input; domain taxonomy boundary is distinct from valid-category tests.

- **R** tests/admin-product-support-specs.test.ts:207 — product schema allows tangling on leave-in but not on shampoo
  Tangling accepted for leave-in and rejected for shampoo; exact category-conditioned eligibility, not generic concern membership.

- **R** tests/admin-product-support-specs.test.ts:232 — product schema allows dryness on shampoo
  Dryness accepted on shampoo; prevents negative taxonomy tests from permitting over-broad rejection.

- **R** tests/catalog-authority-historical-repair-migration.test.ts:11 — historical repair migration exists
  Retained bounded hold: existence predicate is duplicated by all four SQL keepers. A separate artifact-absence consolidation could preserve its explicit diagnostic; not included in current content-mutant packet, no independent-contract claim or removal credit.

- **R** tests/catalog-authority-historical-repair-migration.test.ts:15 — Leave-in shared semantics are canonical and legacy parity fails closed
  Legacy weight/relationship conflict messages, generated canonical relationship and absence of destructive benefits/table rewrites; later convergence migration does not consume these source bytes.

- **R** tests/catalog-authority-historical-repair-migration.test.ts:31 — contextual eligibility foreign keys receive demonstrated supporting indexes
  Four demonstrated composite thickness index definitions; source receipt lookup patterns do not prove these exact migration definitions.

- **R** tests/catalog-authority-historical-repair-migration.test.ts:52 — constraint validation remains gated on clean reviewed repair receipts
  Historical repair must defer validation/NOT NULL until receipts; later closure intentionally validates, so combining across migration phases would lose ordering.

- **R** tests/catalog-authority-historical-repair-migration.test.ts:61 — new writes cannot create contradictory recommendation lifecycle state
  Recommendation requires active lifecycle as NOT VALID at expand; preserve exact boolean predicate and defer validation, separate from closure migration.

- **R** tests/catalog-authority-legacy-sync-retirement-migration.test.ts:21 — every destructive legacy-derivation trigger and function is retired
  Retire every named destructive legacy trigger/function while keeping transitional compatibility paths; migration source contract not interchangeable with runtime schema state.

- **R** tests/catalog-authority-legacy-sync-retirement-migration.test.ts:44 — the Neqi legacy projection sync is guarded and asserts canonical safety
  Guard Neqi product/category/three thicknesses and assert canonical oil row count; preserves bounded historical identity and safety checks.

- **R** tests/catalog-authority-legacy-sync-retirement-migration.test.ts:56 — deferred constraints are validated and category identity becomes a column contract
  Explicit deferred validations then NOT NULL promotion/drop old check; independent final-phase migration shape.

- **R** tests/catalog-authority-legacy-sync-retirement-migration.test.ts:74 — the schema contract matches the migration outcome
  TypeScript required validated schema inventory matches closure and excludes redundant not-null check; cross-language inventory drift is not checked by SQL alone.

- **R** tests/catalog-authority-lifecycle-repair.test.ts:38 — lifecycle repair preflight pins every approved source row
  Exact nineteen source UUIDs in both preflight and repair plus drift/target/relationship receipt fields; transaction guard test does not bind cohort identity.

- **R** tests/catalog-authority-lifecycle-repair.test.ts:49 — lifecycle repair is one guarded transaction with bounded table writes
  Serializable transaction, advisory lock, row count guards, commit, no DELETE/TRUNCATE and exact two-table write set; UUID presence does not prove write bounds.

- **R** tests/catalog-authority-product-spec-relationship-verification.test.ts:9 — relationship verification requires an explicit matching non-production project
  Explicit matching nonproduction project required, with missing/production/mismatch denials; relation-shape helper does not enforce target safety.

- **R** tests/catalog-authority-product-spec-relationship-verification.test.ts:43 — relationship verification requires representative rows with exact embed cardinality
  Representative rows required and exact singleton-object/array cardinalities checked, including negative shapes; target checks cannot detect PostgREST embed drift.

- **R** tests/catalog-authority-relationship-convergence-migration.test.ts:30 — relationship convergence validates every composite FK before removing its legacy FK
  Every fourteen-table composite validation precedes matching legacy FK removal; source order and complete inventory survive independently from current schema contract.

- **R** tests/catalog-authority-relationship-convergence-migration.test.ts:48 — schema receipt inspects the exact redundant relationship names
  Schema receipt explicitly inspects each forbidden legacy FK; migration drops do not prove the audit can report regression.

- **R** tests/catalog-authority-repair.test.ts:47 — an approved repair is bound to its reviewed content and current authority fingerprint
  Approved manifest binds reviewer content and live authority fingerprint; positive execution contract and exact returned manifest.

- **R** tests/catalog-authority-repair.test.ts:67 — review becomes stale when intended authority changes
  Changing intended authority invalidates approved content fingerprint; caller-read live state equality alone cannot detect stale review.

- **R** tests/catalog-authority-repair.test.ts:80 — duplicate products and missing current authority stop the whole slice
  Duplicate manifest identities and missing live authority each stop entire slice; preserve both no-partial-apply preconditions.

- **R** tests/catalog-authority-repair.test.ts:100 — draft or partially reviewed manifests cannot execute
  Draft or incomplete review metadata cannot execute; independent approval-state fail-closed checks.

- **R** tests/catalog-authority-repair.test.ts:118 — category-bounded slices reject entries from another repair lane
  Category slice rejects foreign lane entries; valid approved oil fixture does not cover wrong category.

- **R** tests/catalog-authority-repair.test.ts:132 — value fingerprints are stable across key insertion order
  Object insertion-order canonicalization equal hash; lifecycle validation does not compare reordered equal authority.

- **R** tests/catalog-authority-repair.test.ts:139 — unicode-equivalent but distinct keys produce distinct fingerprints in any order
  Unicode-equivalent but distinct key spellings retain distinct fingerprints in every insertion order; catches localeCompare key-collision ambiguity.

- **R** tests/catalog-authority-repair.test.ts:152 — fingerprinting rejects values JSON would silently coerce
  Undefined/nonfinite/non-JSON fingerprint input throws; preserves rejection rather than silent JSON coercion.

- **R** tests/catalog-authority-repair.test.ts:171 — manifest entries reject non-JSON intended authority values
  Manifest schema rejects non-JSON intended authority; direct hash helper rejection does not prove schema input boundary.

- **R** tests/catalog-authority-repair.test.ts:190 — explicit expected current authority is fingerprint-bound before approval can execute
  Explicit expected current authority object must agree with old fingerprint before execution; separate from live actual authority mismatch.

- **R** tests/catalog-authority-schema-foundations-migration.test.ts:47 — migration creates normalized service-only eligibility relations
  Normalized eligibility tables, RLS, public/anon/auth denial, service CRUD, natural keys and value checks; no PGlite keeper installs this migration.

- **R** tests/catalog-authority-schema-foundations-migration.test.ts:61 — migration backfills eligibility idempotently from legacy arrays and category-valid tuples
  Idempotent legacy-array plus category-matched contextual backfill; preserves conflict targets and category filters independent from table definition.

- **R** tests/catalog-authority-schema-foundations-migration.test.ts:83 — migration establishes the product spine keys in expand-before-validate order
  Spine uniqueness and expand-before-validate nullable identity ordering; later closure has deliberately different requirements.

- **R** tests/catalog-authority-schema-foundations-migration.test.ts:96 — every category fact table carries constant identity and an unvalidated composite FK
  Thirteen category facts require literal category column/check, composite NOT VALID FK and index; repeated literal table rows are original domain inventory.

- **R** tests/catalog-authority-schema-foundations-migration.test.ts:129 — the schema receipt inspects supporting indexes and both eligibility FK layers
  Schema receipt must inspect pg_index and both supporting object patterns; definition creation alone does not prove audit observability.

- **R** tests/catalog-authority-schema-foundations-migration.test.ts:135 — exact protocols assert their indexed category against product identity
  Protocol generated category alias and composite FK must bind exact protocol to product; protocol differs from constant category tables.

- **R** tests/catalog-authority-schema-foundations-migration.test.ts:145 — contextual thickness rows reference normalized eligibility without validating historical debt
  Four contextual thickness FKs must be deferrable/deferred and remain NOT VALID in expand; separate authority relation and deletion behavior.

- **R** tests/catalog-authority-schema-foundations-migration.test.ts:162 — expand-phase compatibility keeps existing product and contextual writers valid
  Insert category fallback, dual ordered sync triggers, contextual maintenance/pruning and revoked helper privileges; historical migration compatibility remains replay contract, no retirement-by-age inference.

- **R** tests/catalog-apply-executor-hardening-postgres.test.ts:185 — the migration's inventory is every reviewer-gated apply executor not already hardened
  Dynamic inventory of reviewer-gated apply executors equals thirteen unique parsed harden calls and historical production hash keys; per-body mutation tests cannot detect omitted executor.

- **R** tests/catalog-apply-executor-hardening-postgres.test.ts:201 — the rebuilt pre-hardening definitions are exactly production's
  Every rebuilt pre-hardening prosrc matches recorded production md5 (scan-expansion comment normalization explicit); mutation roundtrip only proves relative equality, not correct starting bytes.

- **R** tests/catalog-apply-executor-hardening-postgres.test.ts:215 — the whole migration applies, and each body changes only by its listed edits
  Actual hardening migration parses/applies to reconstructed definitions, inverse listed edits yield byte-exact originals and existing service grant persists; independent from final lock/guard predicates.

- **R** tests/catalog-apply-executor-hardening-postgres.test.ts:243 — every patched executor takes the shared lock first and has no NULL-unsafe argument guard
  All patched bodies take shared lock first/once ahead of writes and own lock, no unsafe NULL reviewer/fingerprint guards; edit roundtrip could preserve an incorrect listed patch. check_function_bodies=off means definition proof only, not executor behavior/concurrency.

- **R** tests/product-identifier-global-ownership-migration.test.ts:25 — GTIN expand migration adds checksum canonicalization and keeps invalid legacy rows outside canonical ownership
  Expand SQL generated canonical GTIN/checksum/invalid-row hold contracts; narrow in-memory runtime fixture does not prove every source index/immutability clause.

- **R** tests/product-identifier-global-ownership-migration.test.ts:40 — GTIN writer migration preflights inactive canonical owners before approval or link-existing transitions
  Writer source preflights canonical owners including inactive, applies scanned IDs before delegate and protects net-content update; stub delegate is not full product approval proof.

- **R** tests/product-identifier-global-ownership-migration.test.ts:51 — GTIN writer migration retires legacy Heat and Scalp executor replay
  Retired Heat/Scalp executors revoked also from service_role; PGlite ownership test does not query those exact privileges.

- **R** tests/product-identifier-global-ownership-migration.test.ts:63 — GTIN invariant migration blocks duplicate valid ownership before creating the partial unique index
  Crossproduct/same-product duplicate cleanup checks precede partial unique owner index and temporary lookup drop; runtime successful fresh fixture cannot exercise dirty migration preflight.

- **R** tests/product-identifier-global-ownership-migration.test.ts:75 — GTIN migrations execute and enforce canonical ownership in Postgres
  Actual three migrations execute against explicit fake base delegates and enforce checksum, dedup, net-content null clearing, invalid scan denial and crossproduct uniqueness. SQL substrings cannot replace these effects; not remote PostgreSQL/full schema proof.

- **R** tests/audit-product-metadata-script.test.ts:22 — checkStoredLinkBuyability returns unavailable for missing or unusable links
  Null/malformed links classified unavailable without manufacturing fetch result; preserve unusable input branch.

- **R** tests/audit-product-metadata-script.test.ts:33 — checkStoredLinkBuyability classifies known retailer content
  Known retailer HTML reaches actual hostname classifier; fake fetch supplies text/status only, expected classification remains real owner.

- **R** tests/audit-product-metadata-script.test.ts:48 — checkStoredLinkBuyability lets unavailable dm text win over cart markup
  dm unavailable phrase wins over cart markup; mixed evidence precedence absent from ordinary available HTML.

- **R** tests/audit-product-metadata-script.test.ts:63 — checkStoredLinkBuyability lets unavailable Mueller text win over cart markup
  Mueller unavailable phrase wins over cart markup; distinct hostname and pattern branch.

- **R** tests/audit-product-metadata-script.test.ts:78 — checkStoredLinkBuyability lets generic unavailable Rossmann text win over cart markup
  Rossmann generic unavailable phrase wins over cart markup; different retailer predicate, cannot infer parity from dm.

- **R** tests/audit-product-metadata-script.test.ts:93 — checkStoredLinkBuyability returns manual-review null for inconclusive fetch results
  Non-OK, inconclusive or throwing fetch returns manual-review null; unavailable link and confident content statuses do not imply this fallback.

- **R** tests/product-metadata-health.test.ts:30 — hasSuspiciousNameMarker flags catalog footnote markers
  Footnote marker positive and ordinary-name negative; actual audit fixture does not cover full helper alternatives.

- **R** tests/product-metadata-health.test.ts:35 — numericPrice handles number, comma decimal, and empty values
  Numeric numbers/comma strings/empty input normalization; downstream known null-price fixture is not equivalent.

- **R** tests/product-metadata-health.test.ts:41 — auditProductMetadata reports known metadata issues
  Actual audit combines name/URL/image/price/stale metadata findings; helper tests do not prove collector output.

- **R** tests/product-metadata-health.test.ts:58 — hasStalePrice flags watched price deltas above the expected maximum
  Watched price upper bound distinguishes stale/nonstale exact numbers; unrelated missing-price finding does not reach comparison.

- **R** tests/product-metadata-ingest-identity.test.ts:19 — resolveProductIdentity fails closed when explicit id is missing
  Explicit ID missing must reject without fallback; explicit authority selection differs from alias or no authority.

- **R** tests/product-metadata-ingest-identity.test.ts:33 — resolveProductIdentity fails closed when alias points to a missing row
  Alias-selected ID missing must reject without name fallback; alias branch is separately consumed.

- **R** tests/product-metadata-ingest-identity.test.ts:52 — resolveProductIdentity falls back to name/category when no explicit id or alias exists
  No explicit ID/alias permits name/category lookup and resolution source; denials cannot prove fallback works.

- **R** tests/product-metadata-ingest-identity.test.ts:68 — mergeCommercialFields preserves existing commercial fields unless force overwrite is set
  Existing commercial fields preserved unless force=true, with missing values filled; preserves both overwrite states and exact null/value output.
