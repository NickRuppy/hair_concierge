# Adversarial audit — Bondbuilder, Leave-in, Oil

Date: 2026-10-09 · Branch `codex/engine-adversarial-audit` · Test file `tests/audit-bondbuilder-leavein-oil-rules.test.ts`

```
node --import ./tests/server-only-register.cjs --import tsx --test tests/audit-bondbuilder-leavein-oil-rules.test.ts
# tests 18 · pass 8 (verified) · fail 10 (contradictions, all failing at their intended assertion)
```

Scope: pure TypeScript production paths (Stage-1 category rules + portfolio pass, Stage-3 authority, catalog-facts loader through an in-memory PostgREST client, chat rerankers, research adapters/projections) fed with real frozen fixtures (`data/research/bondbuilder-inci/v1.0/recommendation-promotion-*`, `owner-consolidation-2026-10-02`, `data/research/leave-in-inci/v1.1/calibration-envelopes`). No database, network or `src/` edit.

## (a) Rule inventory

Status: **holds** (checked, a `verified` test or existing coverage), **contradicted** (red test), **untestable** (offline), **needs-ruling**.

### Bondbuilder

| ruleId | Rule | Citation | Status |
|---|---|---|---|
| bondbuilder.diameter.1 | Every in-scope Bondbuilder suits fine/normal/coarse; Stage-3 never gates on diameter or `suitable_thicknesses` | `recommendation-policy-2026-10-05.md` § Hair-diameter ruling — 2026-10-06 | holds (verified test) |
| bondbuilder.diameter.2 | Reviewed promotion writes the full three-diameter set | same § "Implementation" | holds (`bondbuilder-reviewed-promotion.ts:51,114,221`) |
| bondbuilder.diameter.3 | Research `fit` unknowns stay unchanged | same § | holds (P04–P08 fit all `null` in promotion packets) |
| bondbuilder.companion.1 | Required companions for other products still block | `recommendation-policy…` § Première partner correction — 2026-10-07 | holds (verified test, resealed profile) |
| bondbuilder.companion.2 | Première: matching shampoo `recommended`, no mandatory `requiredCompanionProductId`, layered shampooing remains | same § | holds (existing `bondbuilder-reviewed-promotion.test.ts`) |
| bondbuilder.trust.1 | Unfamiliar identity defaults to `low` / `owner_default`; technology match cannot raise it | `product-intake-bondbuilder-production-adapter.md` § Strict wire and integrity | holds (existing adapter tests) |
| bondbuilder.trust.2 | Owner-default stays non-recommended; unreviewed submissions never enter the candidate list | `recommendation-policy…` § Hair-diameter ruling, § Separate decisions | untestable offline (enforced in SQL publication guards; TS Stage-3 trusts `is_chaarlie_recommended`) |
| bondbuilder.trust.3 | Low-trust OGX/Aveda may be recommendation options without a trust upgrade | `recommendation-policy…` intro | holds (adapter has no low-trust exclusion; Stage-3/chat rank by trust per 2026-10-09 code-comment ruling) |
| bondbuilder.integrity.1 | Scalar family/trust/basis must agree with the profile | adapter doc § Full retention | holds (SQL CHECK `bondbuilder_research_contract_v1` + `readBondbuilderResearchProfile`) |
| bondbuilder.integrity.2 | Exact-owner reference registry digest = `db2bc098…` | `lock-2026-10-05.md` | holds (computed) |
| bondbuilder.readiness.1 | `property_projection_ready` ≠ protocol/catalog/recommendation readiness | adapter doc § Live boundary | holds (outcome flags hard-coded false) |
| bondbuilder.readiness.2 | Research-only availability: searchable/scannable, never in recommendation candidates | `internal-catalogue-admission.md` § Research-only catalogue availability | holds (existing `bondbuilder-catalogue-consumers.test.ts`) |
| bondbuilder.readiness.3 | Owned research-only / incomplete product keeps an unknown assessment ("Missing application remains unknown") | same § + policy § Hair-diameter ruling | **contradicted** (chat) |
| bondbuilder.cadence.1 | Label cadence only from source-stated, unbranched, selected-direction cadence | adapter doc § Full retention; `cadence-projection.ts` | holds (verified test, OGX) |
| bondbuilder.cadence.2 | No invented German-market frequency for OGX; UK-only cadence stays outside the DE direction set | `recommendation-policy…` § Reviewed application overlays — 2026-10-06 | **contradicted** (chat facts) |
| bondbuilder.protocol.1 | OGX = bedtime/overnight leave-in, no wash, no finite wait | same § | holds (verified test + existing projection test) |
| bondbuilder.protocol.2 | Critical facts fail closed; only ancillary `source_fact_unknown` holds are adjudicated | same § | holds (existing promotion test) |

### Leave-in

| ruleId | Rule | Citation | Status |
|---|---|---|---|
| leavein.t20.1 | Only DH/DL species set `moisture`; glycols/esters/volatiles/cationics never do | overlay v1.1 §9-O1/O2 | holds (existing + verified tests) |
| leavein.t20.2 | Leading persistent film ⇒ `balanced` (`film_leads_moisture_leg`) | §9-O3 | holds |
| leavein.t20.3 | No directional species: film ⇒ `film_led_neutral`; readable non-directional ⇒ `conditioning_only_neutral`; nothing readable ⇒ `unknown` | §9-O4 | holds (verified test for the volatile-only edge) |
| leavein.t20.4 | O6 confidence: marker plausible, margin ≥ 2, no glycol above film; else `low` + triggers | §9-O6 | holds (verified test) |
| leavein.t20.5 | Reading (a) uses the O1 leg; R2 beside only non-directional species ⇒ `protein` | §9-O7 | holds (verified test) |
| leavein.t20.6 | Mandatory counter-signal lists "every demoted species" | §9-O6 last paragraph | needs-ruling (NR-L1) |
| leavein.review.1 | A low-confidence O3/O4 `balanced` routes to review | §9-O6, §5 (§1.1 T17) | **contradicted** (adapter relies on researcher-declared `uncertainFields`) |
| leavein.ceiling.1 | `care_direction` is E2 with confidence ceiling `moderate` | v1.0 standard §9 table, §4; overlay §9-O5 | **contradicted** (adapter accepts `high`) |
| leavein.pins.1 | Adapter accepts only v1.1-stamped envelopes (overlay hash `9c13…`, base `7ae5…`) | adapter-decisions AD-3a revision; overlay header | holds (hashes recomputed); doc drift NR-L2 |
| leavein.ad2.1 | No `unknown` reaches the catalog | AD-2 | holds (adapter step 6) |
| leavein.ad3.1 | roles / styling_prep derivation | AD-3 | holds (code review) |
| leavein.ad3a.1 | `moisture_softness` ⇔ `care_direction = moisture` | AD-3a revision 2026-09-29 | holds (verified test) |
| leavein.ad4.1 | `replacement_capable` iff conditioning & persistence ∈ {moderate, high} | AD-4 | holds |
| leavein.ad5.1 | Only `recommended` thicknesses enter matcher; empty ⇒ needs_research | AD-5 | holds |
| leavein.stage3.1 | Stage-3 required functions read `functional_benefits`; balanced vs moisture target = caution | overlay §5; AD-3a revision | holds (code review of `authority/categories/leave-in.ts`, `axis-fit.ts`) |
| leavein.care_direction.chat.1 | Product care direction shown/used for fit is the stored research `care_direction` (T20 purpose: film-led products not presented as dryness care) | overlay §8 row 21 motivation; AD-3a revision | **contradicted** (chat) — see also NR-L4 |

### Oil

| ruleId | Rule | Citation | Status |
|---|---|---|---|
| oil.roles.1 | Dry-finish / pre-wash / damp truth tables and precedence | `docs/personal-plan/categories/oil/decision.md` § Role inclusion | holds (code review of `categories/oil.ts`; material vulnerability reconstruction is equivalent) |
| oil.portfolio.1 | Damp Oil demoted only if a Basis Leave-in **requires** `smooth_anti_frizz`; otherwise stays Basis | § leave_on_fibre_conditioning, "Portfolio arbitration" steps 3–4 | **contradicted** |
| oil.portfolio.2 | Coily + frizz keeps both Basis layers | same, step 5 | holds (existing portfolio test) |
| oil.weight.1 | Normal thickness: ideal `light` **and** `medium` | § Leave-on weight and effective dosage | **contradicted** |
| oil.weight.2 | Coarse thickness: ideal `medium` **and** `rich` | same | **contradicted** |
| oil.weight.3 | Owned adjacent/high-risk weight ⇒ `passt mit Einschränkung`, never a hard rejection | same, dosage rules | holds (owned path returns supportive) |
| oil.pre_wash.1 | Pre-wash ignores leave-on weight | § Field semantics; § Role-specific application | holds (verified test) |
| oil.fit.1 | Unverified role/thickness/protocol ⇒ `noch in Prüfung` | § Layered product fit item 1 | holds |
| oil.fit.2 | Verified array excluding the assigned role ⇒ `wechseln empfohlen` | § Field semantics; § Layered product fit item 2 | **contradicted** |
| oil.thickness.1 | Shared `suitableThicknesses` is the strict diameter gate; Personal Plan reads only the new authority | § Field semantics; § Legacy migration treatment step 2 | **contradicted** |
| oil.thickness.2 | Empty `suitableThicknesses` must act as neither unknown nor wildcard | § Field semantics | needs-ruling (NR-O2) |
| oil.heat.1 | Heat protection only from verified `providesHeatProtection`, never inferred | § Safety, response, and claim boundaries | holds (code review) |
| oil.chat.1 | Scalp-treatment requests ⇒ guidance only | `docs/oil-recommendation-data-path.md` § Guardrails | holds (`targetProfile: null`) |
| oil.chat.2 | Overload risk ⇒ guidance only, no product cards | same | needs-ruling (NR-O1) |
| oil.daytype.O1–O5 | Oil day-type rulings | `docs/product-application-protocol-templates.md` § Oil day-type rulings | untestable here (compiler-v2 needs family templates; covered by postgres migration test) |

Counts: Bondbuilder 17 rules (14 holds, 2 contradicted, 1 untestable; NR-B1 is a doc-drift ruling request) · Leave-in 16 (12 holds, 3 contradicted, 1 needs-ruling) · Oil 15 (7 holds, 5 contradicted, 2 needs-ruling, 1 untestable group).

## (b) Contradictions

### C1 · oil.portfolio.1 · P0 · confidence high
Curly, normal, healthy hair with frizz who blow-dries weekly loses her damp-Oil Basis step because Leave-in became Basis for heat care, although that Leave-in only *supports* anti-frizz.
- Expected: damp Oil `frizz_direct` stays `basis` (no Basis target requires `smooth_anti_frizz`).
- Observed: `optional`.
- Code: `src/lib/personal-plan/portfolio.ts:33-46` (`arbitrateDampSmoothing` checks only `leaveIn.needTier === "basis"`).

### C2 · oil.fit.2 · P1 · confidence high
A user's pure pre-wash oil assigned to her dry-finish role is shown as "noch in Prüfung" instead of "wechseln empfohlen".
- Expected: known mismatch for the role.
- Observed: unknown with `missingFacts: ["application_protocol", "oil.weight"]` — a product that genuinely lacks a role never has that role's protocol, so the mismatch branch is unreachable.
- Code: `src/lib/personal-plan/products/authority/categories/oil.ts:160-184` (unknown checks run before `roleSupport === false`). The existing Stage-3 test passes only because its fixture carries a verified protocol for the unsupported role.

### C3 · oil.weight.1 / oil.weight.2 · P1 · confidence high
A normal-thickness user's light damp oil (or a coarse user's medium oil) is labelled "Formelgewicht nur angrenzend / passt mit Einschränkung" although the doc lists both weights as ideal; new recommendations also prefer one ideal weight over the other.
- Expected: `ideal`. Observed: `supportive`.
- Code: `src/lib/personal-plan/categories/oil.ts:70-75` (single `leaveOnWeight`), `src/lib/personal-plan/products/authority/categories/oil.ts:67-79,211`. (Already noted in memory as a known divergence; never pinned.)

### C4 · oil.thickness.1 · P1 · confidence medium
An oil whose shared `suitable_thicknesses` is `["fine"]` but which still has a stale legacy eligibility row for coarse is treated as diameter-eligible for a coarse user; conversely a new canonical oil with no legacy rows is "noch in Prüfung".
- Expected: `targetThicknessEligible === false`. Observed: `true`.
- Code: `src/lib/personal-plan/products/authority/catalog-facts.ts:693,1253-1261`; `commonUnknownFacts` only checks the shared array for emptiness. Medium confidence: the legacy sync trigger normally keeps both in step, so the divergence needs a stale row or a canonical-only write.

### C5 · leavein.care_direction.chat.1 · P1 · confidence medium
In chat, Olaplex N°.6 (T20 `balanced`, film-led) is shown as "Balance: Feuchtigkeit" / "weil es Feuchtigkeitspflege mitbringt" and gets an exact balance match for moisture-target users.
- Expected: `product_balance_direction = "balanced"` (stored `care_direction`).
- Observed: `"moisture"`, re-derived from `care_benefits ∋ anti_frizz`.
- Code: `src/lib/recommendation-engine/selection.ts:1690-1704,1796`; `src/lib/recommendation-engine/categories/leave-in.ts:268-280,453`. `ProductLeaveInSpecs` has no `care_direction` field at all. Confidence medium only because the Leave-in README says the research engine is "not live matching logic" (NR-L4).

### C6 · bondbuilder.cadence.2 · P1 · confidence high
A German user asking chat about OGX Sealing Serum gets "1–2× pro Woche" fed to the model, sourced only from the UK manufacturer page.
- Expected: no chat cadence (the label projection correctly returns `null`).
- Observed: `{status: "source_stated", maintenance: times_per_week 1–2}`.
- Code: `src/lib/bondbuilder/research-facts.ts:25,43-49` (no source-selection / market filter).

### C7 · bondbuilder.readiness.3 · P1 · confidence high
A user who owns a research-only Bondbuilder (no protocol, no usage protocol, not recommended — e.g. an owner-default submission or an unpromoted reviewed row) sees it in chat as "Passt zum aktuellen Bondbuilding-Bedarf."
- Expected: no ideal-fit rationale (Stage-3 says `unknown`).
- Observed: ideal reason because any spec row counts as ideal.
- Code: `src/lib/recommendation-engine/selection.ts:1146-1152` (owned scope via `hasVerifiedSpecs: specsByProductId.has`) and `:1246-1252` (`evaluateBondbuilderRankingFit`).

### C8 · leavein.review.1 · P2 · confidence medium
A Gliss-type thin film-lead read (`balanced`, `low`) projects silently if the researcher forgot `care_direction` in `uncertainFields`.
- Expected: needs_research or a review warning naming care_direction. Observed: projection_ready, only an AD-5 warning.
- Code: `src/lib/leave-in-research/production-adapter.ts:1240-1251` (review warnings derive only from declared `uncertainFields`).

### C9 · leavein.ceiling.1 · P2 · confidence medium
A care direction stamped `high` confidence passes the fail-closed envelope parse although §9 caps it at `moderate`. No production field changes (confidence never leaves the trace), so this is a validation gap.
- Code: `src/lib/leave-in-research/production-adapter.ts:267` (`evidenceSchema` accepts any of low/moderate/high).

## (c) Needs ruling

- **NR-B1 — stale Bondbuilder doc statements vs later rulings.** `docs/product-intake-bondbuilder-production-adapter.md` (2026-10-06 paragraph) and policy § Reviewed application overlays still say "Première remains dependent on an actual catalog shampoo binding"; the 2026-10-07 correction says it does not. Likewise `internal-catalogue-admission.md` / `catalogue-source-followup-2026-10-05.md` say "OGX/Aveda remain low/non-recommended" while the 2026-10-05 policy approves them as options. Code follows the later rulings. Reading A: later dated ruling supersedes (only the doc text is stale). Reading B: the 2026-10-06 adapter-doc paragraph is current for Première. Example: P08 promotion resolves without a bound Bain shampoo.
- **NR-L1 — which species count as "demoted".** `deriveLeaveInCareDirectionT20` lists only cationics, dry-feel esters and glycols as demoted. v1.0 §5 L3 lists Isododecane / Isohexadecane / C13-15 Alkane in the dry-feel band (a v1.0 leg) while the overlay classes them as volatile carriers; fatty alcohols are ambiguous ("consumed by the L1 lamellar pair"). Reading A: volatile hydrocarbons and fatty alcohols above the tail must appear in the mandatory demoted-species counter-signal. Reading B: they were never v1.0 legs. Example: a silicone serum with Isododecane r2.
- **NR-L2 — Leave-in adapter doc pins v1.0.** `docs/product-intake-leave-in-production-adapter.md` lists `policySha256 7ae5…` / `leave-in-classification-v1.0` (its example envelope would be refused); code pins the v1.1 overlay `9c13…`. README still says "There is no production adapter yet". Code matches the T20 ruling; the doc needs a decision whether to update.
- **NR-L3 — confidence vocabulary.** Standard §4 permits `low/moderate/moderately_high/high`; the envelope permits `low/moderate/high` and calibration envelopes down-map `moderately_high` → `moderate`. The adapter doc example uses `high` for careDirection (conflicts with C9).
- **NR-L4 — is the chat Leave-in reranker bound by T20?** README: research engine "not live matching logic"; T20 ledger motivation is precisely the recommendation outcome. Decide whether C5 is a defect or accepted legacy behavior.
- **NR-O1 — overload risk.** `oil-recommendation-data-path.md` § Guardrails: overload risk ⇒ guidance only, no product cards. Code keeps "caveated" product selection (`selection.ts:2383-2392`, decision reason code `oil_overload_suppress_products`) and an existing test pins it. Example: fine hair, oily scalp, owns an Oil, asks for a styling oil → products returned.
- **NR-O2 — empty `suitableThicknesses` on an active Oil.** Doc: invalid, "must not act as either unknown or wildcard"; code treats it as unknown (`commonUnknownFacts`). What should the evaluator return — unknown, mismatch, or a data-integrity error?

## (d) Untestable gaps

- SQL-only guards (owner-default non-recommendation, recommendation-transition guard, three-diameter publication check, research-only activation RPC): no local Postgres (`psql`/`pg_isready` absent); existing `*-postgres.test.ts` files cover them when a DB is present.
- Chat `matchProducts` thickness filtering for Bondbuilder candidates (RPC `match_products`): whether owned research-only rows with empty suitability are dropped before rerank cannot be observed offline.
- Oil day-type rulings O1–O5 (compiler-v2 with live family templates) and the Oil revision-conflict loop (UI/session flow).
- Water-based "oil" members and OE1–OE9: the Oil research engine does not exist yet; no code path to audit.
- Leave-in T20 classification correctness for unseen INCI (the function takes a researcher's species classification; no INCI classifier exists).
