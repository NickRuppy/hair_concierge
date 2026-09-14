# Disagreement log — calibration round 1 (2026-09-03)

Lanes: reference key (`reference-key/`) vs sealed blind review (`blind/`). Field diff: `agreement-diff.md` — 363 fields, 86.2% agreement, 50 substantive disagreements. Both designed boundary cases (slots 7, 12) got identical G0 exclusions — the boundary rule generalizes.

Cause codes per the program taxonomy: identity/formula · mechanism · threshold · fit-derivation · policy · insufficient-evidence · exception.

## C1 — Slot 2 G0: excluded vs in_category · **identity/formula (evidence capture)** · RESOLVED
dm.de directions verified by orchestrator 2026-09-03: "Nach 9 Sekunden gründlich ausspülen" → **rinse-out, excluded_other_form. Reference key correct.** Blind lane + original identity lane missed the directions. Consequences: (a) gold-set slot 2 is empty → replacement proposal: Isana PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol (LGN emulsion, GTIN 4305615946733, T1 rossmann.de INCI, already captured) — Nick decision; (b) process rule: formula freeze must capture and verify directions-of-use, not just INCI (G1 addition).

## C2 — FORM taxonomy gaps: slots 1, 8, 13 (+3 profile echoes) · **threshold (standard defect)**
Slot 1: ref `two_phase` (architecture: oil #2, no emulsifier) vs blind `unknown` (required the shake direction it couldn't find). Slot 8: ref non-LGN `emulsion` vs blind `unknown` (no anchor row). Slot 13: ref `aqueous_solution` vs blind `microemulsion` (Trideceth-6/-12 + Polysilicone-29 read as solubiliser package). Fixes for v0.2: drop the cationic-required clause from the solution anchor; add a non-LGN emulsion row; two_phase decidable from architecture with shake-direction as corroboration; define the solution↔microemulsion threshold (solubiliser pair + real oil/silicone load ⇒ microemulsion). Then re-run.

## C3 — WT slot 8 moderate vs high (DOSE + weight_potential + 4 fit cells follow) · **threshold (known anchor gap)**
Both lanes independently flagged §7.5's missing row for "≥2 persistent non-volatile families, none rich-band". Gliss: volatile lead (Trisiloxane) + Dimethicone #3 + apricot oil + Phenyl Trimethicone + Dimethiconol, spray dose. Proposed anchor: `moderate` with a mandatory multi-family counter-signal note (spray dose moderates residue; FS-13 double-check stays). → Nick fork #3 (affects how often fine-hair caution fires).

## C4 — PERS slots 6, 8: permanent_cationic vs neutral_non_volatile · **mechanism/threshold**
Monomeric long-chain quats (Behentrimonium/Cetrimonium): permanently charged but small-molecule, surfactant-removable — unlike polymeric/silicone quats. Proposal (blind's reading, matches SR §I removability ordering): `permanent_cationic` = polymeric or silicone-functional quats only; monomeric quats stay `neutral_non_volatile`-class with a note. Ref's family-level reading over-promised persistence. Fix + re-run (also resolves both profile.persistence echoes).

## C5 — Heat claim on slot 3 (claim_only vs not_claimed → binary true vs false) · **policy + evidence rule**
Root cause: the standard never defines claim authority. Cantu: some pack/retailer copy mentions heat-damage protection; the authoritative German source found by the blind lane carries no claim. Blind ambiguity #9 (Maria Nila retailer copy inventing "heat protecting PVP") is the same defect. Proposed rule: a heat claim exists only if the manufacturer's German/EU page or the current German pack states it; retailer copy alone never creates a claim (it may corroborate). → Nick fork #2; slot 3's binary then follows from a fresh verification against that rule.

## C6 — Focus selection: slots 3, 9 primary; 6, 8, 10, 13 secondary · **fit-derivation rule ambiguity**
§10.2's rules contradict its anchors (blind ambiguities #5/#6; ref hard-call #5): detangling reachable by every capable emulsion or by none; smoothing-vs-repair ordering undefined (slot 9 mirror-flip: ref smoothing/[repair], blind repair/[smoothing] — same content, undefined order). Fix: primary = strongest route distinct from baseline conditioning, tie-broken by positioning; secondary only for routes with independent moderate+ support; repair outranks smoothing when a dedicated repair route (R2 candidate+ or protein actives in marketing position) exists. Technical fix + re-run.

## C7 — scalp_application_fit: 5 slots · **fit-derivation (undefined in standard)**
Ref invented a default; blind varied. Fix: default `unknown`; `avoid` only for heavy-occlusive/oil-led architectures or EXPO-flagged irritant load; positive values only with explicit scalp-directed directions + clean EXPO. Fix + re-run.

## C8 — texture_fit slot 4 conditional×4 vs unknown×4 · **fit-derivation (non-exhaustive table)**
§10.3 has no row for high-weight + moderate-slip. Complete the matrix with an explicit fallback (`unknown`). Fix + re-run.

## C9 — care_direction slots 8, 9 (unknown vs moisture/balanced), 11 (moisture vs unknown) · **threshold gap**
Anchors don't cover silicone-led architectures (8, 9 → stay `unknown`, per §9's constraint that care_direction is protein/moisture vocabulary) and don't define the minimal moisture threshold (11: Betaine + Panthenol, no emollient). Proposal: silicone-led → `unknown`; humectant-led with no protein route → `moisture` at low confidence (slot 11 → moisture). Fix + re-run.

## C10 — ROLE/usage_role: slots 1, 3, 10 · **identity/evidence capture + mapping looseness**
`refresh` (dry-hair use), `ends_only`, `heat_styling` assigned from differently-sourced directions. Rule: ROLE strictly from the claim-authority source's directions (same authority rule as C5); each role value requires an explicit direction sentence. Re-capture at re-run.

## Singles
- Slot 5 R2 candidate vs none_visible (**threshold**): is mid-list Hydrolyzed Quinoa in a silicone cream a "substantive film route"? Proposed: no — R2 candidate requires cationised protein/silane/silicone-quat route per §7.10; plain hydrolyzed protein in tail → none_visible + trace note. (Blind's reading.)
- Slot 5 SLIP high vs moderate (**threshold**): three-silicone stack, no cationic; anchor wording. Goes with C2/C6 re-run.
- Slot 1/4 scalp avoid vs unknown — covered by C7.

## Standard-defect register consolidated (both lanes + orchestrator review)
C2, C3, C4, C6–C9 above, plus from the lanes' notes: §7.5-microemulsion-clause vs G9 contradiction; HUM `formula_plausible` reachable without any claim (decide: claim NOT required, but humectant counter-signal mandatory — or align with HEAT's claim-led ladder); §10.2 repair row vs §7.10 candidate contradiction; §10.3 damage-fit row 3 gated on COND high (produces the Redken/Olaplex asymmetry — Nick fork #4); L9 tail-member rule (evidenced polymer in preservative-tail without claim ⇒ no state upgrade); "present as architecture" needs an operational marker (capped-preservative rank proposal from blind); excluded-product emission contract; lean-profile `unknown` enum members (adapter/OA-2 relevance); §18 R2 German copy says "Protein-Film" for silicone-quat routes; envelope v0.1→v1.0 promotion at lock.

## Verdict
Round-1 calibration worked: 86% field agreement, 100% agreement on designed boundary cases, and the disagreement mass sits on standard defects (fixable rules), not on erratic judgment. Phase 3 = apply rule fixes (v0.2), re-run both lanes on the affected fields, then Nick adjudication of the four forks + spot-review of evidence chains.
