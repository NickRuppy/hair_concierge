# Shampoo v1.6.2 test round: pre-registration (2026-10-12)

Recorded before any sealed lane runs. The test checks that only these values move. Machine-readable twin: `pre-registration.json`.

- **Standard:** `plans/shampoo-v162/candidate/classification-standard.md` (rule-change rows 138–143).
- **Packets:** the 9 Track A freeze packets in `test/packets/` (copied byte-identical from `codex/shampoo-v16-rollout`, fingerprints unchanged).
- **Baseline:** the Track A run-1 lane records (v1.6), extracted to `baseline-v1.6.json`. None of the 9 products is touched by a v1.6.1 rule (mechanical screen of the 73 Track A packets for S1 selenium, S2 lipid weight calls, S3 oily-hair wording, S4 surfactants): every value except the moves below must equal a v1.6 lane value.
- **Scoring:** `review_thickness_boundary` is not scored (it varied by lane in v1.6).

## Expected moves

| Slot | Product (revealed only in phase 2) | Expected |
|---|---|---|
| G03 | Sebamed Every-Day | **MOVE.** `scalpComfortTarget` not_targeted → **targeted** (SC1 manufacturer claim + CSA via MB: Decyl Glucoside @2, Disodium Laureth Sulfosuccinate @3, Sodium Lauryl Sulfoacetate @4; no prominent strong anionic; `cleansingStrength` low). Primary target ordinary → **sensitive**; rows fine/normal/coarse × `irritationen` × `gentle`; `review_specialist_gate_failed` gone; `focusPrimary` general → `scalp_active` (7.2). Unchanged: weight light, fits ideal/ideal/acceptable, intensity gentle, usage frequent. |
| A40 | Salthouse Anti Juckreiz | SAME values; the `unlisted_route_candidate:Laureth-9` note disappears (`Laureth-9` @3 = listed Polidocanol). |

## Expected SAME (controls)

| Slot | Why it must not move |
|---|---|
| A43 | Sodium Coco-Sulfate @2 is a prominent strong anionic → no MB; no listed comfort route → ordinary + `review_specialist_gate_failed`. |
| A24 | SLES @2 → no MB; Panthenol/Niacinamide after Parfum @6 → ordinary + `review_specialist_gate_failed`. |
| A21 | SLES @2 → no MB; Allantoin/Bisabolol after Parfum @7 → ordinary + `review_specialist_gate_failed`. |
| A05 | Passes via listed Panthenol/Niacinamide; Sodium Coco-Sulfate prominent → no MB. |
| A03 | Passes via listed Allantoin/Bisabolol/Panthenol; SLES → no MB. |
| G01, A06 | Dandruff path; `sensitive` combination via listed routes; SLES → no MB. |

Pass: only the registered moves happen, no unexplained movement, lane agreement at or above the v1.6 bars (≥ 95 %).
