# Slot 11 — Balea Leichtkämmspray Pure Styling (200 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Sensitive/fragrance-free fibre leave-in
- `gtin`: 4067796148855 · `market`: DE · `identity_status`: `verified`
- `rawInciSha256`: `9de11a3f4c3972170c2f06aa27e93e9c5c7345b1f3a75342d8388d6c99b43c2e`
- `formulaFingerprintSha256`: `eb6380538aa46481031c813e124efd0fed156b6c3fc5e5c0f4a372c958c685f8`
- `review_routing`: **routed to human review** — (a) a **„Kopfhautpflege" (scalp-care) claim** against directions that say nothing about placement (§14: root or scalp application); (b) a **fragrance-free implication** („Ohne Parfüm" badge) (§14); (c) the `detangling` focus anchor is unreachable for a product whose entire purpose is detangling — a rule-ambiguity item.

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S11-dir` | T2 (dm.de, dm-Art. 3042625 / GTIN 4067796148855 confirmed on page) | „Auf **nasses Haar** aufsprühen, kurz einwirken lassen, kämmen und wie gewohnt frisieren. **Produkt muss nicht wieder ausgespült werden.**" |
| `S11-claim` | T2 (same page) | „**Kopfhautpflege durch prebiotisches Inulin**"; „Natürlicher Glanz & verbesserte Kämmbarkeit"; „**Kein Verkleben oder Beschweren**"; „Prebiotisches Inulin unterstützt die Pflege der Kopfhaut". **No heat-protection claim** (explicitly checked and absent, unlike Balea's separate Hitzeschutzspray SKUs). No anti-frizz/humidity claim. No hold claim. |

Packet note: the pack carries an „Ohne Parfüm" badge.

---

## G0 — `in_category`

confidence **high** · **E1 (directions)** · scope `directions`

- `AQUA` #1; „muss nicht wieder ausgespült werden" is explicit; detangling/conditioning is the declared primary function.
- threshold_reasoning: the name contains „Pure **Styling**", and G0 forbids classifying by name — the HOLD anchor is run instead and returns `none` (no fixative-class polymer exists at any position), so `excluded_styling_first` fails on its first limb. `excluded_anhydrous` and `excluded_other_form` fail. **This is a clean name-trap demonstration in the opposite direction from slot 13.**

## 1. FORM — `aqueous_or_hydroalcoholic_solution`

confidence **high** · E2 · scope `formula`

- formula_observations: `AQUA` #1; `BETAINE` #2; `PROPYLENE GLYCOL` #3; `CETRIMONIUM CHLORIDE` #4 (short-chain quat). **Precise absence pattern: no fatty alcohol of any chain length, no emulsifier, no solubiliser, no oil, no silicone, no polymer.** An eleven-ingredient list with nothing to emulsify.
- threshold_reasoning: this is the anchor almost verbatim — "Water + glycol early; … short-chain quat; **no long-chain fatty alcohol**; no emulsifier". `emulsion` fails (no LGN pair, nothing to emulsify). `microemulsion` fails (no oil/silicone load, no PEG-esters). `two_phase` fails (no oil phase, no shake direction).
- G9: never sets WT — though here FORM and WT happen to agree, the WT value below is derived from the non-volatile architecture independently.
- `presentation_form` (metadata): Spray.
- review_status: `approved`

## 2. COND — `low`

confidence **moderately_high** · E2 · scope `formula`

- formula_observations: `CETRIMONIUM CHLORIDE` #4 is the sole conditioning species. Absence pattern: **no persistent non-volatile above the tail of any kind** — no silicone, no oil, no ester, no fatty alcohol, no cationic polymer. `INULIN` #5 and `PANTHENOL` #6 are water-soluble.
- threshold_reasoning: the `low` anchor is met literally — "Only a short-chain quat, or a water/glycol solution with no persistent non-volatile above the tail". Both halves apply. `moderate` requires one *coherent conditioning route* — either a cationic-**polymer** film route or a persistent silicone/emollient package; a monomeric quat in a solvent solution is neither.
- limitations: G4; R1 folded in. The E0 claim „verbesserte Kämmbarkeit" is the product's job description, not evidence of a route.

## 3. SLIP — `moderate`, bias `wet_biased`

confidence **moderate** · E2 · scope `formula`

- formula_observation: `CETRIMONIUM CHLORIDE` #4 — one M1 route present as architecture (a cationic species well above the tail).
- threshold_reasoning: `low` fails on its own wording — the anchor requires "no persistent lubricant **and** no cationic species above the tail", and a cationic species is present at #4. `high` requires two or more independent M1 contributors; only one exists. → `moderate`.
- Bias `wet_biased`: the anchor is "a volatile- or water-dominant architecture with **no persistent film**" — met exactly, and this is the only unambiguous bias call in the gold set. Directions corroborate (applied to wet hair and combed through) but the value rests on architecture.
- limitations: FS-22 — an instrumental combing improvement is not a consumer-perceptible benefit; SR §M.5.

## 4. SFR — `low` · SHN qualifier `absent`

confidence **moderate** · E2 · scope `formula`

- Absence pattern: no persistent film of any kind; the water phase plus humectants (`BETAINE` #2, `PROPYLENE GLYCOL` #3, `INULIN` #5, `PANTHENOL` #6) is all that remains after the quat.
- threshold_reasoning: the `low` anchor is met verbatim. `moderate` would need an alignment route — a medium/dry-feel emollient package or a film former; neither exists.
- SHN `absent` — the E0 „natürlicher Glanz" claim does not set it (§8.1; "shiny product appearance is not shine").

## 5. WT — `low`

confidence **moderate** · E2 · scope `formula`

- formula_observations: an aqueous solution whose carrier evaporates; **no persistent non-volatile family above the tail; no LGN pair; no rich-band lipid; no silicone.** The only non-volatile residue candidate is a monomeric quat at #4.
- threshold_reasoning: `moderate` requires exactly one persistent non-volatile family *as architecture* — a water-soluble short-chain quat is not a persistent non-volatile family in the sense the anchor uses (light/medium emollient, light silicone, or cationic-polymer film). `high` fails on all limbs. The anchor's "volatile carrier dominant" limb is read here as water-as-carrier, which is the only reading available for an alcohol-free aqueous spray — recorded as a minor anchor-wording gap.
- counter_signals: none material. The E0 claim „Kein Verkleben oder Beschweren" corroborates and does not set the value (§10.2 rule 4).
- limitations: §17.11 — even a `low` value inherits the unmeasured dose term; FS-1 explicitly rejected as a *reason* (water-first is not why this is light — the absence of any persistent non-volatile is).
- review_status: `approved`

## 6. PERS — `volatile_or_water_soluble`

confidence **moderate** · E2 · scope `formula`

- formula_observations: every functional species is water-soluble — `BETAINE` #2, `PROPYLENE GLYCOL` #3, `CETRIMONIUM CHLORIDE` #4 (a water-soluble cationic surfactant), `INULIN` #5, `PANTHENOL` #6, `1,2-HEXANEDIOL`/`CAPRYLYL GLYCOL` #8/#9.
- threshold_reasoning: `neutral_non_volatile` requires a dimethicone/ester/oil deposit — none exists. `ph_dependent_cationic` and `permanent_cationic` fail (no amodimethicone, no silicone quat, no polyquaternium, no cationised protein). `volatile_or_water_soluble` is the exact anchor: "volatiles and humectants only".
- attached buildup caution: **not emitted** — and this is a positive, evidenced absence, not an oversight. G3 rule 4 is satisfied in the safe direction: a low persistence class and no buildup caution are consistent.
- limitations: G11 still applies — no "washes out in one shampoo" statement, no wash count, no clarification schedule.

## 7. HOLD — `none`

confidence **high** · E1/E2 · scope `formula`

- Precise absence pattern: **no polymer of any class** in the eleven-ingredient list — no PVP, no VP/VA, no acrylates, no polyurethane, and not even a rheology polymer. The word „Styling" in the product name is E0 and is explicitly disregarded (G0/§7.7).

## 8. HEAT — `not_claimed` · `provides_heat_protection = false`

confidence **moderately_high** · E0/E1 · scope `product` + `formula`

- Claim observation: **no heat-protection claim**, actively checked on the exact-GTIN retailer page and confirmed absent (`S11-claim`).
- Formula observation: no member of the closed L9 list.
- A formula never manufactures a claim, and there is no formula signal here in any case (§13.3).

## 9. HUM — `not_claimed`

confidence **moderately_high** · E1/E2 · scope `formula` + `product`

- No humidity or anti-frizz claim. Mandatory counter-signal: `BETAINE` #2, `PROPYLENE GLYCOL` #3, `INULIN` #5, `PANTHENOL` #6 constitute a **dominant** humectant architecture — this is the purest humectant-counter-signal case in the gold set.
- `formula_plausible` fails on both limbs: no hydrophobic continuous film route, and a dominant humectant architecture. Never encode a dew-point threshold (FS-16); FS-6 and FS-15 both apply.

## 10. R2 — `none_visible`

confidence **moderately_high** · E2 · scope `formula`

- Precise absence pattern: no protein, peptide, silane, silicone quat or cationic polymer. `PANTHENOL` #6 is expressly excluded by the panthenol rule — it is an L6 **fibre-mechanics** signal (Marsh et al. 2026: imaging evidence of cortical penetration and higher break stress, from a single industry-affiliated group in a model system, not a leave-in finished-product result), which justifies "low-confidence mechanistic support for fibre mechanics" and nothing above it, and is **not** a surface-film signal (FS-24).

## 11. DOSE — `low` (derived)

confidence **moderate** · `derived_from: [WT=low, FORM=aqueous_or_hydroalcoholic_solution, L3 spreading class = none present]`

- The `low` rule requires **both** WT `low` **and** an aqueous solution with a volatile-dominant carrier — both met (water as the carrier; no lipid load at all). `moderate`/`high` fail on every limb. No dosing caution is emitted.
- limitations: §17.1 — the absence of consumer dose figures is inherited even by a `low` value.

## 12. EXPO — `no_listed_fragrance_signal`

confidence **moderate** · E1 · scope `formula`

- Precise absence pattern: **no `PARFUM`/`FRAGRANCE`/`AROMA` entry, none of the 26 EU-labelled fragrance allergens, and no aromatic essential oil** anywhere in the eleven-ingredient list.
- notes: no `Alcohol`/`Alcohol Denat.` either — `1,2-HEXANEDIOL` #8 and `CAPRYLYL GLYCOL` #9 are glycols, not solvent ethanol. No alcohol exposure note.
- **Hard prohibition, stated in the record because the pack invites the error:** "no listed fragrance signal" is **not** fragrance-free, **not** allergy-safe and **not** hypoallergenic. Labelling thresholds and incomplete formulas prevent those claims, and the EU technical document to Reg. 655/2013 addresses "free from" and "hypoallergenic" specifically. The pack's „Ohne Parfüm" badge is the manufacturer's claim, not our conclusion. **Sensitive-scalp tolerance is not derivable from an INCI list** (SR §M.12). §14 routes any fragrance-free or hypoallergenic implication to human review — done.
- G6 applies.

## 13. ROLE — `["post_wash"]`

confidence **moderately_high** · **E1 (directions)** · scope `directions`

- „Auf nasses Haar aufsprühen, kurz einwirken lassen, kämmen und wie gewohnt frisieren. Produkt muss nicht wieder ausgespült werden." → wet-hair application after washing, left on, combed through → `post_wash`.
- `refresh` rejected — no dry-hair use is described. `heat_styling` and `curl_styling` rejected — „wie gewohnt frisieren" names no heat tool and no curl technique; ROLE is never guessed from formula or from the word „Styling" in the product name. `ends_only` rejected — no placement statement at all.

## Demoted flags

- `smoothing_shine_qualifier`: `absent`.
- `curl_definition_focus`: **not set** — HOLD `none`, COND `low`, WT `low`.
- `R3`: `unknown`. LAYER caution: **not emitted**. Buildup caution: **not emitted**. Transfer caution: **not emitted**.

## care_direction — `moisture`

confidence **low** · E2 · scope `formula`

- L1 (`CETRIMONIUM CHLORIDE` #4) plus L4 (`BETAINE` #2, `PROPYLENE GLYCOL` #3, `INULIN` #5, `PANTHENOL` #6) is the material direction; there is no protein/peptide/silane route at all, so `protein` is unavailable and `balanced` has nothing to balance.
- Confidence held **low**: §9's `moisture` anchor describes "a coherent conditioning + humectant + emollient architecture (L1/L3/L4)", and the **L3 emollient limb is entirely missing** here. This is the borderline case for the anchor's wording — whether L1+L4 without L3 is "coherent" is a rule question, recorded rather than resolved.
- Constraints honoured: panthenol alone did not set `protein`; a humectant *name* did not set `moisture` — the L1+L4 architecture did.

## Lean matching profile

```jsonc
{
  "product_form": "aqueous_solution",
  "conditioning_level": "low",
  "weight_potential": "low",
  "persistence": "low",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "volume_lightness", "secondary": [] },
  "usage_role": ["post_wash"],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "recommended", "medium": "recommended", "coarse": "conditional" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "conditional", "highly_damaged": "caution" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "conditional", "coily": "caution" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": ["focus.primary", "care_direction"]
}
```

**Focus derivation — the notable failure.** `volume_lightness` = WT `low` **and** no persistent film route — both met, and it is set on the route, never on the spray form (G9, FS-2). But the product's actual declared purpose is detangling („Leichtkämmspray"; „verbesserte Kämmbarkeit"), and **`detangling` fails**: its anchor requires SLIP `high` with a `wet_biased`/`both` bias, and a light detangling spray by construction has exactly one M1 route, which caps SLIP at `moderate`. **The `detangling` anchor may be structurally unreachable for the product class it describes** — flagged as a rule-ambiguity item and the reason `focus.primary` is marked uncertain. `smoothing`, `curl_definition`, `heat_styling`, `repair` and `shine` all fail cleanly.

**Fit chains.**
- `hair_thickness_fit` ← `[weight_potential=low, product_form=aqueous_solution]`: formula (no persistent non-volatile above the tail) → product property (minimal residue load) → fit. Coarse = `conditional` reflects low conditioning delivery, not a weight problem.
- `damage_fit` ← `[conditioning_level=low, repair_surface_film=none_visible, bond_flag=none, product_evidence=none]` → row 1 of §10.3.
- `texture_fit` ← `[weight_potential=low, slip=moderate, hold_route_state=none]` → row 1 ("low weight, light dry-down").
- `scalp_application_fit` ← **`unknown`**, and deliberately so. The directions say nothing about placement, which is the standard's stated default. The E0 claim „Kopfhautpflege durch prebiotisches Inulin" is a **marketing statement about an ingredient**, and §7.12 is explicit that root/scalp suitability requires application directions and exposure context, **never an ingredient read** — so the claim cannot lift this to `conditional` or `suitable_if_evidenced`. The favourable EXPO profile (no listed fragrance, no alcohol) likewise cannot, because exposure flags never predict tolerance. Routed to review under §14 (root or scalp application). G6 applies.

## German copy emitted (§18)

- WT `low`: „Bleibt leicht im Haar und beschwert kaum."
- EXPO `no_listed_fragrance_signal`: „Keine deklarierten Duftstoffe in der Liste. Das heißt nicht parfümfrei oder hypoallergen."
- `scalp_application_fit = unknown`: „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe."
- G6 boundary (emitted because the product carries a scalp-care claim): „Bei Juckreiz, Rötung, Schuppung oder Haarausfall bitte ärztlich abklären lassen – das ist keine kosmetische Frage."
- Uncertain fields: „Dazu haben wir keine belastbare Information."
