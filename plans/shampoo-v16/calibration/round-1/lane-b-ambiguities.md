# Round 1 — lane B: ambiguities in the v1.6 candidate standard

Reported by the sealed lane B classifier (2026-10-09). Lane B's per-product records are in `lane-b/L01.json … L19.json`. Lane conventions it applied uniformly: `neighboringAlternative = none` when confidence is `high`, otherwise the adjacent value; S-ORDINARY target confidence `high` (plain) or `moderate` (via S-FAIL / S-HAIRLOSS).

1. C1 vs §3.2 — reset intent alone moves an identical SLES/betaine formula moderate → strong although claims may not assign cleansing (L10, L17).
2. C1 scope — how late an amphoteric still buffers is undefined (L17 vs L10); no anchor for ALS, olefin sulfonate, sulfosuccinate/glutamate, sulfate-free systems (L02, L04, L06, L15, L16, L19).
3. §4 — taurate/glucoside systems match both low and moderate anchors (L06, L15).
4. §1.1 / E5 `neighboringAlternative` — no criterion for `none`, yet it alone decides T4 and I3 flags (L02, L05, L16, L19).
5. C2 — whether an early oil can replace the early silicone; what "early" means relative to Parfum (L14, L13).
6. W1 — silent on extra late lipids (L05) and on the same stack over a mild sulfate-free base (L06).
7. §5 — "rich 2-in-1" undefined (L08).
8. §6 Hydrogenated Vegetable Oil row — persistence at an early position in an SLES base not graded (L09).
9. §7.1 — oily-scalp positioning fits both `clarifying` and `scalp_active` (L01, L02).
10. §7.1 "compatible architecture" — a clarifying focus with moderate cleansing leaves no clarifying signal in the projection (L16).
11. §7.2 — no precedence between "dominant claim" and "sensitive scalp + targeted" rows; thin line between mildness and sensitive positioning (L03, L15).
12. §7 — no focus rule when the dominant claim is out-of-scope hair loss (L04, L11).
13. §9 — no precedence when `occasional_reset`, `treatment` and `frequent` triggers all fire (L10, L13).
14. §9 / D2 — `occasional_reset` does not require strong cleansing but D2 does, so moderate + occasional_reset always yields D3 (L10).
15. §9 `treatment` — undefined for an active without dandruff positioning (L09, L11).
16. D1 — "primary pack claim" vs manufacturer-page-only wording (L02); deep-cleansing names with daily-use directions (L10, L17); no exclusion for care terms "Tiefenpflegend"/"Tiefenspülung" (L05).
17. D2 note — requires a catalog record id the lane cannot see (L02, L17).
18. E1 — range name inside the product name ("basis sensitiv", L03).
19. E2 — action/preventive phrasing naming the scalp (L10, L15); inflected lexicon forms (L07).
20. E4 — unlisted-route escape clause has no trigger condition but decides medically adjacent gates (L03, L15).
21. E3 — essential oils without declared Parfum (L01).
22. S-SECONDARY — symptom claims inside the dandruff statement mechanically add targets; toward-recommending in L13 (adds full oily row set), flag in L07.
23. S-FOCUS — ignores oily targets and the reverse case (focus `scalp_active`, target `ordinary`) (L13, L03).
24. 13.8 — confidence for an S-ORDINARY target undefined.
25. I3 — depends on a neighbor existing, so a sensitive product's gentle/regular mismatch goes unflagged (L14).
26. T4 "after T6" — a fine-thickness boundary flag is silently neutralised by the T6 floor (L18).
27. §2/§12 — "material conflict" undefined; L18 claims name ingredients absent from the INCI (→ needs_research); L16 manufacturer page disclaims regional INCI variation.
28. S-HAIRLOSS — required note has no code in 13.9 (L04, L11).
29. §3.2 / §7 — focus claims not graded by source tier when only retailer copy exists (L06, L08, L11, L12, L17).
