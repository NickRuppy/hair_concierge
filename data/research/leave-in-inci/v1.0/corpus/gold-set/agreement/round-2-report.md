# Calibration round 2 — report (2026-09-04)

Standard v0.2 · packet with directions (R11) · both lanes fresh, round-1 outputs sealed off.

## Headline
- **Agreement 93.0%** (370/398 fields), up from 86.2% in round 1; disagreements 50 → 28.
- 6 slots now agree completely (1, 3, 4, 8, 11, 12); both exclusions that both lanes can decide agree (Kevin Murphy).
- **Regression clean**: all 60 v1→v2 reference-key changes trace to intended v0.2 rules (R12 claim-authority heat flips on Cantu/EVO; R13 weight downgrades on the two-phase alverdes; R14 lifting Redken's damaged-hair tier; C4/C6/C10/§7.10 tightenings). No untraced drift.
- Verified working as designed: R11 rinse test, multi-family WT row (fired 5×, stable), monomeric-quat PERS rule, plain-hydrolysate R2 rule, L9 tail rule, §2.3.1 exclusion contract, G14 trace containment.

## Remaining 28 disagreements — six clusters → v0.3 fixes
1. **Slot 2 Isana (6 fields):** projection conflict-tag (§10.1) applied by one lane only — define the trigger's evidence tier (C1/C2 intended-finish statement) and the downgrade becomes deterministic.
2. **Focus selection (slots 5, 6, 9; 7 fields):** §10.2 "baseline conditioning" undefined (A5) + step 2 defeats step 3 so repair-over-smoothing never applies (A6) + SFR anchor/G3 contradiction (A4). Fix the step order so the rank rule actually binds; Redken then projects repair-primary.
3. **Slot 7 Maria Nila g0 (1):** trap-3 vs excluded_styling_first precedence (A14) — rule: when the styling-first test fires cleanly on C1/C2 evidence → excluded; provisional only for evidence conflicts.
4. **Slot 9 Redken repair cluster (R2/care_direction/HUM/damage fits):** §3.1.1 tail-marker prongs give opposite answers (A3) — pick the strict-rank prong BUT add the missing row for a qualifying substantive route below the marker (route to review instead of silently `none_visible`); align HUM with the claim-led ladder (formula-plausibility without a claim goes to the trace, state stays `not_claimed`).
5. **Slot 10 Olaplex heat (4):** claim-capture gap, not a logic defect — claims must be frozen in the packet at C1/C2 like INCI and directions (extend G1/R12; new packet field).
6. **Slot 13 Neqi (5):** L5 must enumerate Polysilicone-29 and VP/Methacrylamide/Vinyl Imidazole Copolymer families (A13) + microemulsion-threshold edge + trap-3 (same fix as cluster 3).

## Overshoots to correct in v0.3
- §10.3.1 scalp rule: `aromatic_or_allergen_exposure` alone fires `avoid` on 9/12 (A9) — restrict `avoid` to occlusive/oil-led architecture or scalp-relevant irritant load; fragrance flags alone → `unknown`.
- Store-brand claim tier: dm=alverde/Balea, Rossmann=Isana — add explicit house-brand-page-is-C2 clause (A1); resolve the §2.4.1 C2-"EU" vs rule-3 contradiction (A2).
- Small: §4 confidence vocabulary never defined (A25); R3 needs a `none` member (A16); §18 missing strings (A15); DOSE two-phase trigger vs "follows WT" (A11); §7.5 clause-1 vs high-anchor (A12); §7.1 solution row vs its own fatty-alcohol note (A13-ref); curl_definition negative gate (A7); heat_styling focus unreachable for heat-claiming products whose directions name no tool (A8 — decide: claim + pre_heat stage suffices); packet `1,2-Hexanediol` normalization split; C-tier stamps in packet.

## Product-visible outcomes to show Nick at review (current key state)
- Heat binaries under R12: **true** = Gliss, Redken, Neqi (+ Olaplex pending claim freeze); **false** = everything else incl. Cantu and EVO (retailer-copy claims died).
- Olaplex `highly_damaged` moved recommended → conditional (bond flag no longer upgrades; conditioning path judges it).
- Redken `highly_damaged` moved conditional → recommended (R14 row 3b) — pending cluster-4 tail fix for its full repair identity.
- Both two-phase alverdes: weight high → moderate, fine-hair caution → conditional (R13).
- Balea Leichtkämmspray: the one clean `recommended` for fine hair; focus now `detangling`.

## Next: v0.3 polish + claim-freeze packet pass → targeted re-run (slots 2, 5, 6, 7, 9, 10, 13) → Nick product-level review → unseen-product test → freeze v1.0.
