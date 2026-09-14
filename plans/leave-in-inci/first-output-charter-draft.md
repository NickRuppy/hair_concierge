# Leave-In Category — First Output (A–I) for Review

Status: **complete draft for Nick's review** (handover "FIRST OUTPUT" gate — nothing frozen, no product classified yet).
Inputs: handover v1.0 (`handover/`), leave-on science review (`research/leave-on-science-review.md`, 714 lines, sourced), conditioner engine reuse map (PR #512 analysis), catalog extract (`research/catalog-extract-observations.md`).

## Decision-coverage record (2026-09-03)

**Confirmed with Nick:**
1. Endpoint = conditioner parity (standard + calibration + Lab + envelope + production adapter), staged over multiple PRs.
2. Calibration = blind-reviewer lane + Nick adjudication.
3. Gold set = best archetype coverage regardless of catalog presence.
4. Category-boundary conflicts with live DB flagged in research only; DB categories unchanged pending a separate decision.

**Inherited from evidence or contract:** handover boundary/chain/evidence model/archetypes/lean profile; repo vocabulary (`hair_texture` = pattern, `thickness` = diameter); conservative-under-mixed-evidence; cosmetic vs medically-adjacent separation; conditioner engine plumbing reuse (evidence object, review state, fingerprints, fail-closed adapter pattern).

**Confirmed with Nick at charter review (2026-09-03):**
5. Ontology: 13 dimensions adopted (merges WET+DRY, PERS+WASH, R1→COND; SHN, CURL, R3, LAYER demoted to flags/derived).
6. Heat protection: **binary** `provides_heat_protection` in the product model; `heat_protection_max_c` to be REMOVED from the DB (recommendation-policy ruling: claims are usually kept; research verifies the claim against the evidenced-ingredient knowledge and routes to review when a claim looks formula-unsupported). NOTE: max_c is live in `src/lib/recommendation-engine/selection.ts:1669` (≥220°C heat-fit bonus + German copy) and personal-plan catalog facts — removal is a scoped follow-up (migration + code paths) at adapter/cutover time, surfaced to Nick before execution. The richer 4-state evidence detail may live in the research trace only; the production projection is binary.
7. Vocabulary: `usage_role` reinstated for leave-in (E1 directions read; conditioner's drop does not transfer); `care_direction` (protein/moisture/balanced) KEPT as a dedicated evidence-backed axis, same as conditioner.
8. Gold-set pool approved — selection proceeds: verify exact identities/formulas, pick strongest representative per archetype, source the two external picks (two-phase, sensitive-positioned), present the final 12 with GTINs before classification.

**Adopted as implementation default (no objection raised):** regulatory re-review trigger 2027-06-06 (EU 2024/1328 D4/D5/D6 leave-on limit) — rules key on function ("volatile carrier"), never on cyclosiloxane presence.

**Open consequential assumptions (parked to later phases, listed for acknowledgment):**
- OA-1: DB `format` enum vs profile enum (`two_phase` missing, `serum` boundary) — Phase-5 adapter/migration decision.
- OA-2: Projection of 4-state heat evidence onto existing boolean + `max_c` fields — Phase-5 adapter decision.
- OA-3: Blind-reviewer identity (Codex vs clean Claude) — decide at Phase-2 start.

---

## A. Category charter and exclusions

Adopts handover §4 working definition and boundary table unchanged. Boundary rule: classify by **function + directions + formula architecture**, never name. Ambiguous → provisional or boundary stress case.

Catalog impact (ruling #4): ~10 current "Leave-in" SKUs are boundary-suspect (serum/oil_replacement rows); research records will flag them; water-based serums may remain in-category after formula verification (see catalog extract).

## B. Leave-in subtype/architecture map (science review Block A)

Five INCI-separable architectures — the FORM taxonomy:

| Architecture | INCI markers | Trap |
| --- | --- | --- |
| Aqueous/hydroalcoholic solution (spray/mist) | no LGN pair, solubiliser-type emulsifiers only | can still carry heavy non-volatile package |
| Emulsion milk/lotion/cream | cationic surfactant + fatty alcohol (lamellar gel network pair) | thin-lotion vs milk boundary is rheological — carries no decision weight |
| Microemulsion | clear + real oil/silicone load + several PEG-esters/solubilisers | "clear = light" is false |
| Two-phase spray | oil/silicone phase with **no emulsifier**, "vor Gebrauch schütteln" | least dose-predictable form |
| Anhydrous serum/oil | no leading Aqua | **out of category** → oil/serum |

Core law of the category: `residue load ≈ dose × non-volatile fraction × (1 − removal)`. FORM is a high-confidence architecture label and a **low-confidence weight proxy** — "spray ⇏ light" becomes a hard gate.

## C. User jobs, trade-offs and recommendation failures

Adopts handover §6 (eight jobs with trade-offs and canonical failures; user variables mapped to app vocabulary). Unchanged from previous draft.

## D. Core scientific research questions and test methods (science review Blocks B–J)

Answered in the science review; the standard inherits: leave-on cationic behavior (retention problem, not deposition problem; dose-error margin collapses), silicone dry-down/persistence mechanics, emollient spreading-value ordering, humectants as softness-not-frizz route, fixative polymer chemistry + HHCR/DHCR/DVS methods, strict heat evidence base (Zhou 2011; McMullen & Jachowicz 1998), bond-claim independent-evidence gap, persistence/buildup mechanism ordering with no quantitative support.

E-level mapping: E0 claims · E1 verified INCI/directions observation · E2 mechanism inference **for leave-on exposure** (rinse-out/pre-wash/salon evidence enters only here) · E3 exact product tested as leave-on with declared dose, damp/dry, drying method, ambient RH · E4 human-use/blinded sensory · E5 replicated. The E3 metadata requirement is leave-on-specific.

## E. Performance-route dictionary

Handover §9's ten outcomes survive, with science-review corrections: humectants removed as an anti-frizz route (they are a counter-signal for humidity resistance); heat route restricted to the evidenced polymer list; curl definition explicitly decomposed into hold route + conditioning + weight (no independent formula route); 16 additional false signals appended to the handover's 11 (full list in science review §L — includes the amodimethicone-selectivity rinse-off argument, persistence-high/buildup-low double-counting, `max_c`-as-strength, dew-point folklore, clear-product-is-light, bottle-rheology-as-performance).

## F. Direct product properties (proposal P-1: 13 dimensions)

| Kept | Notes |
| --- | --- |
| FORM | 5-architecture label; never sets weight |
| COND | more formula-readable than rinse-out (no deposition-efficiency variable) |
| SLIP (=WET+DRY) | one M1 mechanism; bias qualifier wet/both/dry |
| SFR (narrowed) | ambient smoothing/alignment only; humidity half moves to HUM |
| **WT (anchor dimension)** | binding constraint in most user jobs; residual uncertainty is dose |
| PERS (=PERS+WASH) | ordinal mechanism class only, never durations/wash counts; separate non-quantitative buildup caution flag |
| HOLD | coarse 3-state (`none / incidental_film / meaningful_hold_route`); styling-boundary signal |
| HEAT | 4-state evidence field, strict gate (P-2) |
| HUM | 4-state evidence flag; humectant presence = counter-signal |
| R2 | substantive-film route required; supplier-evidence caveat; panthenol = fibre-mechanics signal only |
| DOSE | category-defining; decide store-vs-derive from WT+FORM+spreading class |
| EXPO | exposure statements only, never tolerance predictions; conditioner G6 gate verbatim |
| ROLE | E1 directions read; deliberate divergence from conditioner (which dropped usage_role) |

Demoted to flags/derived: SHN (qualifier on smoothing route), CURL (derived focus from HOLD+COND+WT), R3 (`claim_only / chemistry_candidate / product_tested / unknown` + review flag), LAYER (caution string only, no score). R1 folds into COND.

## G. Lean user-fit outputs

Handover §11 profile shape retained on the conditioner EvidentValue evidence object, with two vocabulary changes (P-3): no `care_direction`; `usage_role[]` present. Envelope: five-part conditioner shape (`version, researchMethod, identity, formula, profile`), leave-in vocabulary, fail-closed validation, `leave-in-research-envelope-v1.0`. Fit fields (`hair_thickness_fit`, `damage_fit`, `texture_fit`, `scalp_application_fit`) are derived-user-fit decisions carrying `derived_from` — never set directly from an ingredient.

Confidence ceilings adopted from science review §K (notably: heat/humidity/layering/sensitive-scalp low-or-unknown from formula alone; PERS lowered to low–moderate; WT may rise to moderately-high when FORM + non-volatile architecture both resolve).

## H. Calibration and stress-test archetypes

12 archetypes per handover §13. Candidate pool (exact identity + GTIN + current formula verification happens at selection; per ruling #3 archetype quality beats catalog presence):

1. Ultra-light detangling spray — It's a 10 Lite / Isana Feuchtigkeits
2. Mainstream milk/lotion — Garnier Hair Food Aloe / Balea Aqua Hyaluron
3. Rich cream dry/damaged — Cantu Repair Cream / Being Major Moisture
4. Two-phase spray — **external pick** (German drugstore two-phase, to be identified with exact GTIN)
5. Silicone-rich smoother — Color WOW Money Mist / EVO Head Mistress
6. Silicone-free cationic/polymeric — Curlsmith Hydrate & Plump (INCI verify)
7. Curl cream with hold polymer — Paul Mitchell Full Circle / Garnier Fructis Locken (INCI verify)
8. Heat-protective primer — Gliss Sprüh-Conditioner / Wella Ultimate Repair
9. Protein/surface-repair — HASK Keratin 5-in-1 / Redken Extreme Anti-Snap
10. Bond-repair claim — Olaplex No.5 / Bali Curls Bonding N°3
11. Sensitive/fragrance-free-positioned — **external pick** (to be identified)
12. Boundary/source-conflict — Kevin Murphy Young Again (serum/oil_replacement) or Neqi Diamond Glass (styling boundary)

Adversarial set (3–5): lightweight-branded product with persistent film formers; heat claim on generic silicone/protein only (pool: 14+ catalog SKUs with legacy heat booleans); hold-driven "curl cream"; 10-in-1 with shared mechanisms; GTIN/formula-conflict case.

Blind lane (ruling #2): clean reviewer gets formulas + directions without the key; 7-cause disagreement coding; Nick adjudicates; systematic disagreement → rules; full re-run after material rule changes.

## I. Open questions, low-confidence fields and specialist boundaries

12 named evidence gaps (science review §M) stay open in v1.0 — headline: no consumer dose data per form; no finished-product leave-in accumulation study (circulating percentages untraceable — banned from the standard); no formula→curl-definition or formula→humidity mapping; fine-hair residue thresholds are product judgment calls, to be labelled as such; sensitive-scalp tolerance not INCI-derivable. Regulatory: re-review trigger 2027-06-06 (P-4). Bond/heat/humidity claims default conservative per §12 ceilings.
