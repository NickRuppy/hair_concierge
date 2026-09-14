# Slot 2 — Balea PROFESSIONAL Magical Water Aqua Hyaluron (200 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Mainstream milk/lotion
- `gtin`: 4067796166644 · `market`: DE · `identity_status`: `verified`
- `rawInciSha256`: `0e1c3d1ca1c67a16dfc121a4155bf28536b06cac844773207e42e035b2adb873`
- `formulaFingerprintSha256`: `f8d4f7b2f10e2d0ebae7acb8043df81654f12d016c2072d9f226b46c20f4729f`
- **G0 verdict: `excluded_other_form` → `routed_out_of_scope` (rinse-out conditioner).**
- `review_routing`: **routed to human review** — G0 exclusion of a frozen gold-set slot; the gold set's "mainstream milk/lotion" archetype is currently filled by a product that is not a leave-in.

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S2-dir` | T2 (dm.de, dm-Art. 3050151, GTIN 4067796166644 confirmed on page) | Verwendungshinweise, verbatim: „Nach der Haarwäsche sanft in die nassen Haarlängen auftragen und kurz einmassieren, bis die Formulierung vollständig aufgenommen ist. **Nach 9 Sekunden gründlich ausspülen.** Bei sehr trockenem oder pflegebedürftigem Haar kann zusätzlich eine Spülung oder eine Haarkur verwendet werden." |
| `S2-claim` | T2 (same page) | „Expresspflege in nur 9 Sekunden"; „Feuchtigkeitsboost mit Hyaluron & Aloe Vera"; „Verbessert Kämmbarkeit & verleiht Glanz". No heat, anti-frizz, bond or hold claim. |

## G0 — product-form gate

**`excluded_other_form`** · decision_type `metadata` · confidence **high** · **E1 (directions)** · scope `directions`

- formula_observations: `ALCOHOL DENAT.` #1, `AQUA` #2, `MYRISTYL ALCOHOL` #3, `BEHENTRIMONIUM CHLORIDE` #6, `CETRIMONIUM CHLORIDE` #7 — an aqueous/hydroalcoholic cationic system that would otherwise pass the architecture limb of `in_category`.
- directions_observation: „Nach 9 Sekunden gründlich ausspülen" (`S2-dir`) — the contact ends in a rinse.
- product_inference: this is a rinse-out express conditioner, not a product intentionally left on the fibre.
- threshold_reasoning: §2.3 `in_category` requires "directions say the product stays on the hair". The authoritative directions say the opposite, explicitly and unambiguously, on the manufacturer-equivalent retail page for the exact GTIN. §2.2 excludes "rinse-out conditioners". `provisional_boundary` is not available: nothing here is genuinely ambiguous — the packet's own note ("packaged as '9-Sekunden Magical Water', not a classic milk bottle") flagged a positioning tension that the directions now resolve against inclusion. G0 forbids classification by name; "Magical Water" is a marketing word, not an exposure regime.
- limitations: **G8 (exposure-regime firewall)** — any evidence generated on this product belongs to the rinse-out regime and may enter a leave-in record only at E2, as mechanism, never as product evidence.
- review_status: `provisional` (the exclusion itself is not in doubt; the review item is what to do with the gold-set slot).

## Classification

Per §2.3, **excluded products do not classify.** All thirteen dimensions and the lean matching profile are `not_applicable — out_of_category`. The record is retained as a boundary stress case per §16, not deleted.

## Non-normative shadow read (for blind-lane comparison only — NOT part of the reference key)

Recorded so the blind reviewer's dimensional answers remain comparable if they reach a different G0 verdict. **These values are void; they carry no confidence and must not be projected.**

| Dim | Shadow value | One-line basis |
|---|---|---|
| FORM | `aqueous_or_hydroalcoholic_solution` | `ALCOHOL DENAT.` #1 makes a lamellar gel network implausible despite the `MYRISTYL ALCOHOL` #3 + `BEHENTRIMONIUM CHLORIDE` #6 pair — the fatty-alcohol/quat pattern here is a trap, not an LGN |
| COND | `moderate` | one coherent L1 cationic route; no LGN pair above the tail, no second route |
| SLIP | `moderate`, bias `unknown` | one M1 route |
| SFR | `moderate` | one alignment route (cationic deposit); no persistent film |
| WT | `moderate` | one persistent non-volatile family (quat + fatty alcohol); no rich lipid, no silicone |
| PERS | `neutral_non_volatile` | monomeric quats only — see the anchor-gap note below |
| HOLD | `none` | no L5 member |
| HEAT | `not_claimed` | no claim, no L9 member |
| HUM | `not_claimed` | humectant counter-signal (`PROPYLENE GLYCOL` #4, `GLYCERIN` #5); no hydrophobic film |
| R2 | `none_visible` | `HYDROLYZED HYALURONIC ACID` #9 is an anionic polysaccharide, not a substantive protein film |
| DOSE | `moderate` | from shadow WT |
| EXPO | `fragrance_declared` | `PARFUM` #10; no individually declared allergens; alcohol note — `ALCOHOL DENAT.` at #1 is the largest alcohol exposure in the gold set |
| ROLE | `unknown` | rinse-out; the leave-in role vocabulary does not apply |
| care_direction | `moisture` | L1 + L4, no protein route |

**Anchor gap surfaced by this slot (applies set-wide).** The PERS class list names `Silicone Quaternium-16/-22`, high-charge-density polyquaterniums and cationised proteins under `permanent_cationic`, and amodimethicone/amidoamines under `ph_dependent_cationic`. It gives **no class for a monomeric long-chain quat** (Behentrimonium/Cetrimonium Chloride, Behentrimonium Methosulfate), which is permanently charged but small and surfactant-removable. This lane's stated rule — applied consistently across slots 2, 3, 5, 10 and 11 — is: *a monomeric quat alone does not reach `permanent_cationic`; it is recorded as `neutral_non_volatile` with the charge-substantivity mechanism noted.* This is a lane decision, not a standard rule, and needs adjudication.
