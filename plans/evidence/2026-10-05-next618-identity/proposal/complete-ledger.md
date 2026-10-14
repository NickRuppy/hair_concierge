# Canonical product identity31 — complete current ledger

Pinned root: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`; branch `codex/test-audit-pruning`.

**29 R / 1 held F / 1 conditional C / 0 D.** All five files fully read: normalization8, resolution9, schema9, title2, correction3. Proposed conditional cut31→30; no applied credit. All runtime execution and repository mutation remain main-owned.

This is a fresh complete second-layer pass, not a reclassification from filename counts. The prior orphan `detectBrandAliasConflicts` removal is already present and receives no new credit. The historical normalization snapshot/GTIN cohorts remain out of scope.

## Per-declaration decisions

### R — canonical category constants include supported and known unsupported keys

`tests/product-identity-normalize.test.ts:16` · callback SHA `8c6c4308e487858a9ce3d36eeb685f2c71c5f90fc12b284aba81eede0b1807fc`

Exact supported-key order, known unsupported hairspray and German labels are the public category/schema vocabulary, consumed by productIntakeCategorySchema and Discovery category registries. Dropping scalp_care/heat_protectant or exposing the wrong label fails these independent literals; category alias tests do not pin supported membership/order.

Owner evidence: `src/lib/product-identity/index.ts:6–96; src/lib/product-intake/schemas.ts:22`.

### R — normalizeCategoryKey maps production labels, canonical keys, and simple oil aliases

`tests/product-identity-normalize.test.ts:39` · callback SHA `74fd331b916d361c02b071267bc79de983e73d1335dcab3604cb33d5f056c27e`

Each existing alias/canonical-key input drives the real map, including German/English and oil spellings and unknown→null. Removing only the Scalp Care or Oele alias can leave all direct vocabulary constants and unrelated intake fixtures green. No same-input composed keeper covers this full union.

Owner evidence: `src/lib/product-identity/index.ts:51–105`.

### R — normalizeText folds accents, punctuation, case, and spacing

`tests/product-identity-normalize.test.ts:66` · callback SHA `b8ed8d473a998b61f481f8ae989a473a9cd84468677bfc3768f530f7657410fd`

Actual normalizeText wrapper must fold the two exact punctuation/diacritic/number cases to fixed text. Returning raw text or dropping Nº normalization fails; the standalone normalizeIdentityText fixtures do not exercise this wrapper with these inputs. No new case is warranted just to retire it.

Owner evidence: `src/lib/product-identity/normalize.ts:1–26; scripts/product-identity/validate-normalization.ts:79–81,549–551`.

### R — normalizeIdentityText is stable for case, whitespace, punctuation, and safe diacritics

`tests/product-identity-normalize.test.ts:71` · callback SHA `5011d4a1e73e0076d8068fc88fd2bd9bdebfdf28f19d5fcc686cf6d87073f3e7`

Four exact strings independently require case/spacing/hyphen/slash folding and º/° number handling while retaining word order. Removing the degree-symbol No rewrite fails the N°5 input even though plain No and apostrophe cases pass. Identity matching and prompt preparation use this shared normalizer.

Owner evidence: `src/lib/product-identity/normalize.ts:1–21; src/lib/product-identity/brand-resolution.ts:187–203`.

### R — normalizeIdentityText matches L'Oreal variants without broad unsafe rewrites

`tests/product-identity-normalize.test.ts:81` · callback SHA `b34b89e572b633b7a3b902660444bfd1d1fb1cf3bb2c36027dd7f2568fdab6b5`

Straight, curly and modifier-letter apostrophes plus bare Loreal must coalesce to loreal. The resolver punctuation keeper exercises only straight apostrophe, and its token regex differs from the direct normalizer for U+02BC; treating all raw variants as equivalent coverage would lose that branch.

Owner evidence: `src/lib/product-identity/normalize.ts:10–17; src/lib/product-identity/brand-resolution.ts:187–191`.

### R — normalizeIdentifier returns stable snake-case identifiers

`tests/product-identity-normalize.test.ts:88` · callback SHA `433e96b44137a770c957ee347fcadc98d1099eea504a8dcdfb8a16cbe567776d`

Stable underscore encoding and both null/undefined→empty are independently observed at normalizeIdentifier. Dropping null handling or retaining spaces fails; category normalization short-circuits falsy inputs and cannot protect this direct nullable contract.

Owner evidence: `src/lib/product-identity/normalize.ts:28–31; src/lib/product-identity/index.ts:91–104`.

### R — tokenizeProductName returns normalized searchable product-name tokens

`tests/product-identity-normalize.test.ts:96` · callback SHA `7d30b9ab0e7da16affeab1168dba301e2c4c52a909e2d3b13f88c519d5594bc2`

Exact normalized token arrays preserve search words/order and prevent empty-token leakage for hyphenated Garnier, apostrophe Loreal and numbered Olaplex. Returning one normalized string or dropping the numeric token fails independently of scalar-normalization equality tests. Matcher ranking uses these arrays.

Owner evidence: `src/lib/product-identity/normalize.ts:38–43; src/lib/product-intake/product-matching.ts:tokenizeProductName call sites`.

### R — cleanProductDisplayName removes exact brand and product line prefixes conservatively

`tests/product-identity-normalize.test.ts:108` · callback SHA `debc7c37b4914b7c1ded8545eb022786bc27f75477fb2a2b157d808a126bf7ad`

Five full display-cleaning cases retain two successive exact-prefix removal, unmatched line preservation, middle-word nonremoval, no Olaplexx partial-token strip and accented brand equivalence. No single existing lookup keeper reproduces all of this union. Changing prefix equality to startsWith would strip Olaplexx.

Owner evidence: `src/lib/product-identity/index.ts:114–179; src/lib/product-intake/product-lookup.ts:539–542`.

### R — resolveBrandFromText returns an exact brand and product line prefix match

`tests/product-identity-resolution.test.ts:24` · callback SHA `487cbe942d18c60b005ac5f1b13ae5dbf9a6ef84c9fb12a3b4626359ec167433`

Legacy array/nested line aliases must resolve Nr.5 to no_5 with high confidence, exact matchedText boundary and canonical_brand_with_line_inference. Losing nested productLines or extending matchedText over product name fails; Phase0 relational fixtures do not cover this input adapter.

Owner evidence: `src/lib/product-identity/brand-resolution.ts:277–299,460–489`.

### R — resolveBrandFromText returns an exact brand match without over-matching inside words

`tests/product-identity-resolution.test.ts:35` · callback SHA `fd8ab458d84aecc6dfdfe0788a74ccf594a36c30c4ad027596376aaa46bbf718`

Canonical keeper C1: real alias K 18 resolves, while token SK18 cannot overmatch. Existing match/brand/raw assertions stay; proposed two extra assertions own the common unresolved receipt. An includes-based prefix regression still fails the negative.

Owner evidence: `src/lib/product-identity/brand-resolution.ts:208–246,377–387,389–454`.

### R — resolveBrandFromText resolves Phase 0 aliases before canonical brand names

`tests/product-identity-resolution.test.ts:48` · callback SHA `3f78b2f953b0ee8ad45d9cca98a5be37fe41de012df62ae37dbffce5d5bd02a7`

Relational Phase0 catalog covers canonical Pantene+line, canonical Garnier+line and line-only Fructis alias. Removing alias-first resolution or relational brand_id linkage changes brand/line/reason on one of the actual existing calls. Other corrected aliases do not preserve all these reason assertions.

Owner evidence: `src/lib/product-identity/brand-resolution.ts:301–308,328–342,396–419,446–489`.

### C — unknown brand returns unresolved raw text with no confidence

`tests/product-identity-resolution.test.ts:97` · callback SHA `355895870d4f6ac90c06f210033ba697942ac160d4e7f8f8d3198acf8f4c06dd`

C1: ordinary unrelated unknown reaches the same none(rawText) receipt as keeper SK18 after both prefix searches miss. Transfer confidence=none and reason=unresolved to existing nonMatch; match and exact raw echo are already asserted there. Raw literals/catalog shapes differ and are explicitly qualified in layer plan.

Owner evidence: `src/lib/product-identity/brand-resolution.ts:377–387,446–450`.

### R — conflicting aliases are reported and excluded from usable alias resolution

`tests/product-identity-resolution.test.ts:112` · callback SHA `7a5ad4e9696df95d10f8451232edd975fe7c5dfd520400d0ae35eebed6ecb182`

Two different brands claim Shared: preserve the concrete conflict list and exclusion from usable resolution. Removing conflicts filtering can wrongly choose a brand; a generic unknown with no conflicting rows cannot catch this.

Owner evidence: `src/lib/product-identity/brand-resolution.ts:344–371`.

### R — resolver uses Phase 0 normalized brand and line fields for punctuation variants

`tests/product-identity-resolution.test.ts:145` · callback SHA `90fe7fcabbc8122807a97e0decef49a9c4ca22aeb8a716c56d7cf4b0ffe553ae`

Canonical DB normalized fields plus straight-apostrophe/diacritics must select the same exact brand/line and preserve each raw matchedText boundary. Ignoring normalized_name fallback or token offset miscalculation escapes other alias-only inputs.

Owner evidence: `src/lib/product-identity/brand-resolution.ts:107–116,167–173,187–226,465–489`.

### R — alias collisions with canonical brand names are reported and excluded

`tests/product-identity-resolution.test.ts:181` · callback SHA `8aed896e1cf4bb208a5c7eb21898f487682fa1dd501e656e810db6f2474ae715`

Alias Fructis collides with a real canonical Fructis brand: conflict reported, line alias excluded, canonical brand wins with null line and canonical_brand_exact. Dropping canonical names from conflict target map passes the alias-versus-alias test but fails here.

Owner evidence: `src/lib/product-identity/brand-resolution.ts:346–350,367–371,481–489`.

### R — line-specific aliases with missing product lines are excluded

`tests/product-identity-resolution.test.ts:217` · callback SHA `49b880c67811a5aa0c2a956e78c7c21e03293e215c3fdd075a45c3f874bba361`

A line-specific alias referencing missing line must be excluded, not downgraded into brand-only alias. Pins aliases.length=0 and actual unresolved result. Removing the missing-line continue makes Elvital resolve wrongly; generic unknown does not exercise dangling identity data.

Owner evidence: `src/lib/product-identity/brand-resolution.ts:332–334`.

### R — resolver handles corrected Phase A catalog aliases

`tests/product-identity-resolution.test.ts:244` · callback SHA `aa15e96f406812499fe82cf61bfc2d3d5aa101e7119456313017d2ca696f5351`

Seven explicit corrected aliases preserve reviewed canonical targets: HairFood→Fructis, Wahre→line, Glisskur→brand/no-line, Monday→brand, Elvital, MetalDX, BaleaAqua→Professional. These are documented PhaseA operator decisions; no generic alias fixture protects all old-language compatibility mappings.

Owner evidence: `src/lib/product-identity/brand-resolution.ts:396–448; plans/2026-06-18-product-identity-canonical-correction.md:Canonical Decisions/Task2`.

### R — product identity migration creates the phase 0 identity tables

`tests/product-identity-schema.test.ts:20` · callback SHA `b6d4d96d8cad177c24293423b171643aab158ba1a0a4a902ab266351fd6c8fbc`

Five physical tables must be created and have RLS enabled in this additive migration. Missing one enable statement is not covered by current TS matching or the later product-visibility migration. Static syntax guard, not a claim RLS was executed.

Owner evidence: `supabase/migrations/20260612120000_product_identity_normalization.sql:8–74,342–346`.

### R — product identity migration exposes only public-safe identity tables to public clients

`tests/product-identity-schema.test.ts:33` · callback SHA `41621040685126f3988a805990f6cf3b66812bd4eb71eda24858dd1d8e869ca8`

Phase0 grants/policies expose only brands/categories, forbid writes on those and premature public lines/aliases/identifiers. Later Phase5 intentionally opens product_lines; that later contract cannot replace the historical additive migration guard. Removing the old test would lose migration-stage separation.

Owner evidence: `supabase/migrations/20260612120000_product_identity_normalization.sql:348–379; successor 20260706120000:12,57–62`.

### R — product identity migration keeps non-recommended products out of public product reads

`tests/product-identity-schema.test.ts:64` · callback SHA `bcf212eee60c8177aea3884d48a884a30355bdf776f12f491f2ceec238949da9`

Exact authenticated recommended-only policy in Phase0 protects replay compatibility before Phase5. Current lifecycle test reads a different migration and adds owned-product exception; it does not execute or inspect this migration. Weakening this USING while leaving successor intact is an escaped intermediate schema fault.

Owner evidence: `supabase/migrations/20260612120000_product_identity_normalization.sql:351–361`.

### R — product identity migration keeps semantic product matching aligned with catalog visibility

`tests/product-identity-schema.test.ts:72` · callback SHA `a5c7bf70fb642cea8f8c88c7d0f551fa962039fd11e4890006319231f9b9c4b7`

match_products function replacement independently adds active/recommended/lifecycle filters to semantic retrieval. A correct table RLS policy does not protect SECURITY DEFINER matcher execution; omitting recommendation filter fails the literal contract.

Owner evidence: `supabase/migrations/20260612120000_product_identity_normalization.sql:203–316`.

### R — product identity migration extends products without contracting legacy fields

`tests/product-identity-schema.test.ts:81` · callback SHA `13e6538f833e57940035131a6fc1037c7fc7a86193a7a91948a08d81786cb3db`

Nullable additive identity keys, origin default/backfill/check and FK constraints must preserve legacy brand/category. Dropping old columns or forcing brand_id NOT NULL breaks historical compatibility even when modern DTO tests succeed. This whole positive/negative union stays.

Owner evidence: `supabase/migrations/20260612120000_product_identity_normalization.sql:107–157`.

### R — product identity migration keeps product lines and identifiers compatible

`tests/product-identity-schema.test.ts:106` · callback SHA `605f39014516365f59cbf177d081eab835a152799f3500c83fc372112c670ff2`

Composite line/brand FK and partial null delete semantics coexist with identifiers per product, not global uniqueness. A globally unique barcode index would reject ambiguous evidence; scalar GTIN tests do not exercise SQL indexes or FK contract.

Owner evidence: `supabase/migrations/20260612120000_product_identity_normalization.sql:27–53,149–179`.

### R — product identity migration stores script-normalized identity values

`tests/product-identity-schema.test.ts:119` · callback SHA `7c9bad695f9c8f8e76e972c7efe7c2bfa823052be4cae74d94d0b5bab4bf9406`

Brand/alias normalized columns stay ordinary script-normalized stored values, not generated rewrites; canonical and raw alias fields stay paired. Changing these to generated normalization would invalidate reviewed script authority independently of normalizer output tests.

Owner evidence: `supabase/migrations/20260612120000_product_identity_normalization.sql:19–45`.

### F — product identity migration seeds all phase 0 product categories

`tests/product-identity-schema.test.ts:129` · callback SHA `3371f01ca674c61f8ce1e70a1d70f28ddf7e28aa3598f4cd99a0ec8237ce4890`

Held F1: seed-membership contract is meaningful, but /'shampoo'/ scans all lowercased SQL and can match the display label after the tuple key is corrupted. No repair or deletion credit. Exact static counterexample and limits in held-findings.json.

Owner evidence: `tests/product-identity-schema.test.ts:129–150; migration tuple ('shampoo', 'Shampoo', true, true, 10)`.

### R — product identity migration stays inside the phase 0 boundary

`tests/product-identity-schema.test.ts:152` · callback SHA `858205caa0269e24beebad80c1f34d22d5037c212ab2f8a9c0978ce3d8a1e2e9`

Migration phase boundary forbids submissions/usage/spec-table alterations. Later migration tests cannot protect accidental expansion of this historical file; introducing a spec RLS ALTER or intake table here fails. Retain cheapest independent file-level boundary guard.

Owner evidence: `supabase/migrations/20260612120000_product_identity_normalization.sql; docs/product-identity-normalization.md:Phase0 Non-Goals`.

### R — product identity title composes brand, line and name without visible duplication

`tests/product-identity-title.test.ts:6` · callback SHA `f28515ce89185fae7e08314d25dad834a27eef7594657de5e67fe77be6e1c32c`

Neqi and Syoss literals have existing actual consumers, but the third branch brand=Garnier Wahre Schätze with line=Wahre Schätze exercises existing.includes(candidate), not replacement of prior shorter parts. Product-card/line helpers use a different formatter. A duplicate line emitted by composeProductIdentityTitle could escape those keepers. Whole declaration stays; no relocating one input to get credit.

Owner evidence: `src/lib/product-identity/display-title.ts:9–24; tests/mobile-scan-search-identity.test.ts:7; tests/discovery-product-line-title.test.tsx:35`.

### R — product identity title ignores blank identity parts

`tests/product-identity-title.test.ts:33` · callback SHA `4ed7cb5db9a7c4389c4a582fe5e9f26872364796b5bb6caca92e2078d0ec7d00`

Blank-space brand + null line must be omitted while preserving Repair Shampoo. Existing scanResultTitle(null-brand) has a result.name fallback that can hide an empty formatter return; missing/null versus whitespace also exercises trim. No fully equivalent stronger keeper established.

Owner evidence: `src/lib/product-identity/display-title.ts:9–12; src/components/scan/scan-search-sheet.tsx:111–123`.

### R — canonical correction apply guard requires the production project confirmation

`tests/product-identity-correction.test.ts:10` · callback SHA `57c074a89a7439593faa0955cbf4f2d7c7b792c9ef0d9ecda8058714cd14c2db`

Actual registered correction operator refuses wrong confirmation and wrong exact hostname while dry-run skips apply guard. Generic apply-normalization uses a separate weaker includes guard; it cannot replace this exact correction safety test. No claims of positive DB apply or all guards tested.

Owner evidence: `scripts/product-identity/correct-canonical-identities.ts:230–247,862–869; package.json:87`.

### R — canonical correction product patch never writes live product names or legacy fields

`tests/product-identity-correction.test.ts:40` · callback SHA `fc2859cdd4e9033c6b82efda6cc001b136e9e482355e62d965658f930bfd64df`

Actual updateProducts consumes exactly two FK columns from buildProductPatch; whole deep equality and legacy key negatives prohibit names/brand/category mutation. Returning live-name cleanup here violates explicit PhaseA constraint. No fake query runtime keeper exists for this union.

Owner evidence: `scripts/product-identity/correct-canonical-identities.ts:249–257,698–728`.

### R — canonical correction alias upsert rows only include database columns

`tests/product-identity-correction.test.ts:55` · callback SHA `2759695dc620e99abfd60574716733dd5fd3a9fc159ffe18debf806f034572aa`

Actual retargetBrandAliases maps through brandAliasWriteRow before upsert; only five DB columns survive, excluding explanatory target_brand_name/target_product_line_name. Spreading the richer payload breaks DB writes despite correct display summary. Preserve pure projection contract at this registered operator boundary.

Owner evidence: `scripts/product-identity/correct-canonical-identities.ts:669–690`.

## Read and execution limits

See `manifest.json` readset for exact whole-versus-sliced reading, source/test/dependency hashes. Target fixtures are literal and execute pure production helpers; no candidate relies on a mock supplying the asserted outcome. Candidate dependencies are only the actual normalizer and Node/ECMAScript collections/string operations. Correction tests import a module with Supabase/dotenv dependencies, but the tested functions do not construct a client or load env; `isDirectExecution()` alone starts the operator. No SDK transport proof is claimed or needed for the one pure C.

All prospective15 phase test files and four valid TS fault variants parsed using the TypeScript parser only. No compiler, tests, owner imports, native/PW/SQL/provider calls, env reads, external reviewer or repository writes. Real failure sensitivity remains unexecuted.

CI routes every target through `package.json:test:node` wildcard and `.github/workflows/ci.yml:quality-node` npm run test:node. The proposed keepers use the same file/native lane. Full native command is in `commands.json`; no direct correction CLI (even dry-run) is needed or authorized.

History: b4fb21f4 introduced normalization/resolution/schema/correction in Product Intake consolidation; source and tests document additive Phase0 and explicitly gated PhaseA correction. 4f9938dd introduced the identity-title helper and exact mobile-search keeper. Subsequent 12619247 integrated broader category support; a4171b0b/457c64be changed GTIN siblings, not this C. Read current bytes over history. No live owner/source cleanup is supported.
