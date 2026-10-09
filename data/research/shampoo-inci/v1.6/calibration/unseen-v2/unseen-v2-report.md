# Unseen check v2 — v1.6 candidate (2026-10-10)

Standard: v1.6 candidate at `0d3bbe56` (R11/R12 + round-2 clarifications). Six fresh Track B products never seen by any lane or used to tune a rule (`selection.md`, `blind-mapping.json`). Two fresh sealed Opus lanes. Records: `lane-a/`, `lane-b/`; script output: `compare-output.txt`.

## Result: 92/96 = 95.8% lane agreement

| Product | Field | Lane A | Lane B | Effect |
| --- | --- | --- | --- | --- |
| ISANA Oil Repair Marulaöl | focusPrimary | moisture | general | none (focus not live) |
| Garnier Wahre Schätze Kokosmilch & Macadamia | weightPotential / weight / fit.fine | moderate / moderate / acceptable | low / light / ideal | lane B more recommending |

Proposed adjudication (P0, W3): the Kokosmilch weight is a genuine low/moderate boundary (two liquid oils directly after Parfum + late Polyquaternium-10); resolve to `moderate` → fine `acceptable` (amber).

Both lanes independently set Aussie Bouncy Curls to `needs_research`: retailer claims name jojoba, coconut and macadamia oils that are absent from the frozen INCI (ID-3 material conflict) — re-verify the formula source before any use.

Both lanes read the H&S Apple Fresh itch/oil wording as bundled with the dandruff claim (E2a/E2b) and recorded `dandruff_bundled_comfort_wording` (combination formula gate failed) — R12 behaves as intended.

Remaining boundary readings (no projection effect): W-RICH vs strict C2 (Violet Crush conditioning), toning cadence vs D1 reset limit (Violet Crush), nonspecific vs moisture_supported (ISANA Oil Repair).
