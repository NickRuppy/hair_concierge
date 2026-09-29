# T20 re-derivation notes — `care_direction` under Standard v1.1

**Records:** `t20-care-direction-records.json` (same directory)
**Standard:** `leave-in-inci-v1.1` = v1.0 (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md`, frozen) + overlay (`docs/research/leave-in-inci/v1.1/leave-in-classification-overlay.v1.1.md`)
**Ruling:** T20, Nick, 2026-09-29
**Date:** 2026-09-29

## Scope

T20 changes one rule, so only `care_direction` reopens (§16). Every other field of every base record, and every Lab approval on those fields, stands. The frozen packets, reference keys, lane records and the u1/u5 re-derivations under `data/research/leave-in-inci/v1.0/corpus/` are not edited. These records **override** `care_direction` only, the same way `rederived/u1-record.json` overrides the u1 lane records. Each record keeps the v1.0 reading verbatim under `superseded_reading`.

## Method

1. Evidence is the frozen packets only. No web research and no re-capture.
2. For each of the 15 in-category records, every species above the §3.1.1 tail marker that bears on §9 is classified into the overlay's classes. On a vacuous or `none_visible` marker, the ordinal read is used. The species that bear on §9 are: directional species (DH/DL), persistent films, glycols, and every species v1.0 counted as an L1/L3/L4 leg. Anything else above the tail is class `other`, which cannot move the value.
3. Each classified species is checked against the frozen INCI at its rank (`tests/leave-in-care-direction-t20.test.ts`).
4. §9-O3–O7 are applied mechanically (`src/lib/leave-in-research/care-direction-t20.ts`). The same test re-runs the rule on every record, so value, row, film-lead margin and O6 confidence are reproduced exactly, not transcribed by hand.
5. Confidence on O5 `moisture` rows and on the protein anchor is carried from the base record (T20 leaves those rules unchanged). A standing step-down stays on top of O6; u1 keeps its T18 tier-1 step-down.

## Result

Four records move `moisture` → `balanced`:

- **Gliss (8)** — `low`, review `moisture_leg_subordinate`. Adjacent-rank film lead: Dimethicone r3 vs apricot kernel oil r4.
- **Olaplex No.6 (10)** — `moderate`, no review. No directional species above r14; the esters, volatiles and propanediol are the film's carriers.
- **Neqi (13)** — `low`, review `glycol_only_leg`. The read rests on demoting Dipropylene/Pentylene Glycol r2/r6, which outrank Polysilicone-29 r7. This supersedes T19's call.
- **Elvital u1** — `low`: O6 `moderate`, then the T18 step-down. Review under `moisture_leg_subordinate` and `formula_or_identity_conflict`. Not live.

The other 11 hold, EVO / Redken / ISANA Hyaluron anchors included. alverde 7in1 stays `moisture` on its formula: sunflower oil r2 and glycerin r4, no film. Nick accepted this on 2026-09-29 with no per-product exception.

## Honest limits

- One lane re-derived these, and code checked every step. They have not been run by two independent sealed lanes; that belongs in the next calibration round.
- The O3 read on Gliss depends on one rank. Above 1 % the order is binding, but the concentration gap can be tiny, which is why the record is `low` with review.
- The v1.0 Lab fixture (`data/research/leave-in-inci/v1.0/lab-fixture.json`) is frozen and still shows the v1.0 `care_direction`. Showing v1.1 values in the Lab is a separate follow-up.
