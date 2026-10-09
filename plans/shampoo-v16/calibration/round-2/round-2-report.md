# Round 2 report — v1.6 candidate calibration (2026-10-09)

Standard: v1.6 candidate at commit `ebe435c9` (full v1.4 weight method integrated; round-1 ambiguities closed), lane copy without worked examples or product names. Two fresh sealed Opus lanes, 13 gold products only, fresh blind ids (`../round-2-mapping.json`). Records: `lane-a/`, `lane-b/`. Script output: `compare-output.txt`.

## Lane vs lane: 202/208 = 97.1%

| Product | Field | Lane A | Lane B | Projection effect |
| --- | --- | --- | --- | --- |
| G01 Guhl Anti Schuppen | conditioningLevel | moderate | low | none |
| G02 H&S DERMAXPRO Beruhigende Pflege | conditioningLevel | moderate | high | coarse acceptable vs ideal (B more recommending) |
| G12 Balea Ultimate Volume | conditioningLevel | moderate | low | none |
| G13 Lavera Basis Sensitiv | scalpComfortTarget / focusSecondary | targeted / scalp_active | not_targeted / – | none (S-FAIL either way) |

One disagreement errs toward recommending: G02 coarse fit (root: C2 "humectants" element undefined).

## Weight: three-way

Both lanes agree on weight for all 13 products. Against Nick's 2026-08-26 approvals the lanes match all 11 products that have an approval. They differ from the v1.4 final re-check on G01 (approved low, re-check moderate, lanes low), G09 Syoss Intense Curls (moderate / high / moderate) and G12 Balea Ultimate Volume (low / moderate / low) — the re-check whose own report flagged a systematic upward shift.

## Consensus readings both lanes flagged as uncertain

- G01 Guhl Anti Schuppen (E2a): "Deine juckende Kopfhaut wird beruhigt und das Spannungsgefühl reduziert." read sentence-by-sentence creates a sensitive secondary target (+ dry dropped with flag). In context it reads as a dandruff symptom. Toward recommending (adds irritated-scalp rows).
- G13 Lavera (C3/C5): Sodium Cetearyl Sulfate (emulsifier grade) counted as a reinforcing alkyl sulfate → cleansing strong. No intensity change.
- Remaining clarifications: C2 humectant element, W-RICH vs "limited reset", W1 set without amodimethicone, N-ALT for set-valued focusSecondary, film-former status of Acrylates Copolymer, E1 English-language manufacturer source, 13.8 mixed S-ORDINARY ways, F7 non-scalp "sensitiv" in name.
