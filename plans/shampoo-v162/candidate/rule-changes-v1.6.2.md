# Rule changes: v1.6.2 vs v1.6.1 (candidate)

Rows 1–115 live in `docs/research/shampoo-inci/v1.6/rule-changes.md`, rows 116–137 in `docs/research/shampoo-inci/v1.6.1/rule-changes.md`; both are unchanged. This ledger continues from row 138.

Baseline: `docs/research/shampoo-inci/v1.6.1/classification-standard.md` (locked v1.6.1, SHA-256 `8bd97d31…ea23d0a29`, byte-frozen and unchanged). Target: `plans/shampoo-v162/candidate/classification-standard.md`.

"Live value" means a `product_shampoo_specs` row or the projected `weight` that the projection could add, remove or change once Production Light is re-pinned. Nothing in this version changes a live value by itself.

Sources: **R18** = Nick's ruling of 2026-10-12 (`plans/shampoo-v16/rulings.md` R18, snapshot in `data/research/shampoo-inci/v1.6.2/rulings-ledger.md`); **main** = a precision reading decided by the main session inside R18 (stated below); **E** = editorial or consequential wording.

Expected movers come from a mechanical screen of the 73 Track A packets (sensitive-scalp claim unit + no prominent strong anionic): Sebamed Every-Day (G03). They are inputs to the pre-registration, not results.

| Row | Section | Change | Source | Can change a live value? |
|---|---|---|---|---|
| 138 | Version, preamble | Version v1.6.2 on base v1.6.1; v1.6.2 changes row; lock references re-pointed to the v1.6.2 pin test; adapter re-pin wording names v1.6.2. | E | No |
| 139 | 10 CSA, MB | New MB (mild base): `cleansingStrength` `low` or `moderate` and no prominent strong anionic of either C3 type (C3b applies; C3a emulsifier sulfates excluded). MB is a CSA route and an S-SENSITIVE route, never an S-DRY route. "A mild cleansing chassis" leaves the not-sufficient list; it counts only as MB. Counter-signal and `not_targeted` sentences name MB next to the listed route. | R18.2; definition via C3 strong anionics (not "sulfate" only) is a main-session precision call so harsh sulfonate chassis do not pass | Yes: a sensitive-claim product with a mild base gains `targeted` and the `sensitive`/`irritationen` rows (Track A: G03) |
| 140 | 13.3 E2b layer 2, 13.4 S-SENSITIVE | S-SENSITIVE formula gate = `targeted` and (prominent comfort route or MB); the research-only `sensitive` combination reads the same gate. S-DRY unchanged. | R18.2, R18.5 | Yes (row 139 cases); combination only research-only |
| 141 | 13.3 E4, 5 C2, 10 CSA | R16.4 closed-list batch resolved with no additions; six candidates rejected by name with the evidence path; a later addition needs a new version. | R18.3 | No |
| 142 | 13.3 E4 | `Polidocanol` (INCI `Laureth-9`, the same substance) on the comfort list. Lanes previously flagged `Laureth-9` as an unlisted candidate. | R18.3 | Possibly: a product whose only prominent comfort route is `Laureth-9` now passes; Track A: none (A40 and A51 already pass via `Urea`) |
| 143 | 10 evidence boundary, sources table | The lists and MB are plausibility filters without independent rinse-off soothing evidence; claims alone never pass; research never supports "soothes" in user copy. Sources table rows for the v1.6.2 ledger and evidence. | R18.1, R18.4 | No |
| 144 | 10 MB | Review fix before publication (Codex branch review, 2026-10-12): MB's strong-anionic exclusion reads surfactant prominence under C4, including its no-marker fallback (every listed surfactant counts when the formula declares neither a fragrance nor an E3 preservative marker). Without it, a fragrance-free, preservative-marker-free SLES/CAPB formula would have nothing prominent under E3 and could pass MB. Stricter, never looser (P0). No Track A product lacks both markers, so no tested or Track A value changes; the clause was not exercised by the test-round lanes. | Review fix (main session, inside R18.2) | No (Track A: none) |

Not in this version:

- S-DRY routes, C2 thresholds, any list addition.
- The R19 live-display rule (scalp concern decides the fit colour) — app PR / fit-verdict shampoo config, not a classification rule.
