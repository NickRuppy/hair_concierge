# Slot 7 — Maria Nila Curlicue Cream (100 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Curl cream with hold polymer
- `gtin`: **none found** (documented G1 identity gap) · `market`: DE · `identity_status`: `verified`
- `rawInciSha256`: `a7c9ce328a33307500fafcdcf6f8d29371633627cfb4072f444516e45aac3f27`
- `formulaFingerprintSha256`: `f7c3be7bc73e173951cf965513602bba22b5271e4141fc156df44a363658db3a`
- **G0 verdict: `excluded_styling_first` → `routed_out_of_scope` (styling category).**
- `review_routing`: **routed to human review** — (a) G0 styling-boundary exclusion; (b) `HOLD = meaningful_hold_route` (§14); (c) absent exact-market identifier.

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S7-dir` | T1 (marianila.com) | „Apply to damp hair just at the ends for a textured look or apply throughout the lengths for a more controlled look. To avoid flyaways and allow curls to find their natural wave, use the product from root to top." |
| `S7-pos` | T1 (marianila.com) | Product page title: **„Curl Defining Styling Cream"**; manufacturer's own hold rating: **„Hold 3/5"**; filed under the brand's hair-cream/styling category, **not** under conditioners; the words "leave-in" and "conditioner" do not appear on the page. |
| `S7-claim` | T1 + T2 (flaconi.de) | „Enhances and defines curls"; „Prevents frizz and split ends"; „Use in damp hair to protect your hair against humidity"; „adding definition and hold to the curls". T2 attribute tag: „Wirkung: Anti-Frizz". No heat-protection claim. |
| `S7-ing` | T3 (INCI reference) | `QUATERNIUM-95` identified as a **quaternary ammonium compound that is not a silicone quat and not a polyquaternium**. Ingredient-family identification only. |

---

## G0 — `excluded_styling_first`

confidence **moderate** · E1 (positioning/directions) + E2 (architecture) · scope `formula` + `directions` · decision_type `metadata`

- **Limb 1 — a fixative-class polymer route.** `PVP` at **#4** of 17, i.e. a genuine L5 member high above the tail, in a film-forming context (with `CARBOMER` #10 and `TRIETHANOLAMINE` #14 as the neutralised rheology system).
- **Limb 2 — thin or absent conditioning architecture behind it.** Precise absence pattern: **no cationic surfactant, no cationic polymer, no silicone of any kind, no oil, no butter, no ester, no wax.** The entire conditioning candidate set is `CETYL ALCOHOL` #5 — a fatty alcohol with **no quat partner**, so no LGN pair forms and it functions as an opacifier/consistency factor — plus `QUATERNIUM-95` #11, a monomeric-type quat in the sub-1 % region, plus glycols. That is thin.
- **Limb 3 — directions/positioning lead on durable hold or texture.** The manufacturer titles it a *Curl Defining Styling Cream*, assigns it **Hold 3/5**, and files it under styling (`S7-pos`). The directions are styling directions ("for a textured look", "for a more controlled look").
- threshold_reasoning: §2.2 includes "curl creams **when conditioning/definition is central and hold remains secondary**". Here hold is not secondary — the manufacturer grades it, and the fixative sits at #4 while the conditioning candidates sit at #5 and #11 with nothing behind them. `in_category` therefore fails. `provisional_boundary` was considered and rejected: the three limbs of `excluded_styling_first` are each met by direct observation, so this is not "genuinely ambiguous" — it is the SR §F.2 case the standard names explicitly ("a curl cream whose definition comes from a fixative plus a low conditioning load is a styling product wearing a conditioning label").
- **The name was not used.** G0 forbids it; "Cream" and "Curlicue" carry no weight. What excludes is the HOLD anchor plus the thin conditioning architecture.
- counter_signals: the product is applied to damp hair and left on, which is leave-in-like behaviour; and `S7-claim` uses care language ("prevents split ends"). Neither changes the architecture read, and both are E0/positioning.
- limitations: no German-language verbatim Anwendung text could be captured (flaconi.de's accordion did not render); the English T1 text is the manufacturer's own and is treated as authoritative.
- review_status: `specialist_review_required`

## Classification

Per §2.3, **excluded products do not classify.** All thirteen dimensions and the lean matching profile are `not_applicable — out_of_category`. Retained as a boundary stress case per §16.

Two values are nonetheless recorded normatively because they are the *reason* for the exclusion and must travel with it:

### HOLD — `meaningful_hold_route`

confidence **moderate** · E2 · scope `formula`

- `PVP` #4 in a film-forming context with thin conditioning architecture behind it → the exact anchor, and the trigger for the G0 styling review above.
- `CARBOMER` #10 is excluded from consideration by the **L5 rheology exclusion** (FS-25); it plausibly serves bottle viscosity and is not counted as a hold route.
- Hold **level** is deliberately not emitted: polymer level and plasticiser load are invisible, so no 0–4 grade and no low/moderate/high hold score is permitted (§7.7). The manufacturer's own "Hold 3/5" is **E0** and is recorded as a claim, never adopted as a value.
- SR §F.1 context: PVP is hygroscopic and loses film stiffness as RH rises — confidence is high that the fixative families differ, low that this product delivers a particular hold level.

### HUM — `claim_only`

confidence **moderate** · E1/E2 · scope `product` + `formula`

- A humidity claim exists („protect your hair against humidity"; T2 tag „Anti-Frizz"), and **no qualifying route** does: `formula_plausible` requires a hydrophobic continuous film with a plausible water-uptake-reduction mechanism, and PVP is the mechanistically *opposite* polymer — hygroscopic, softening with RH. `PROPYLENE GLYCOL` #2, `GLYCERIN` #3, `BUTYLENE GLYCOL` #9 and `PROPANEDIOL` #12 are a dominant humectant architecture, which lowers this state and can never raise it (SR §E.1, FS-15, FS-6).
- This is the standard's stated default for a claiming product, and it is worth flagging as the cleanest *counter-signal* case in the gold set.

## Non-normative shadow read (for blind-lane comparison only — NOT part of the reference key)

**These values are void.**

| Dim | Shadow value | One-line basis |
|---|---|---|
| FORM | `aqueous_or_hydroalcoholic_solution` | water + glycols lead; `POLYSORBATE 20` #8 is solubiliser-type; no LGN pair; carbomer-thickened, so a "cream" by rheology only |
| COND | `low` | no persistent lubricant package, no cationic above the tail; `CETYL ALCOHOL` #5 without a quat partner is not a conditioning route |
| SLIP | `low`, bias `unknown` | no persistent lubricant, no cationic species above the tail |
| SFR | `low` | no persistent film; water phase and humectants only |
| WT | `moderate` | one persistent non-volatile family — the PVP fixative film plus cetyl alcohol. WT counts "stiffen" as well as "grease"; this product's weight is stiffness, not oiliness |
| PERS | `neutral_non_volatile` | `CETYL ALCOHOL` #5 as architecture; the PVP film is largely water-redissolvable, which pulls toward `volatile_or_water_soluble` |
| HEAT | `not_claimed` | no heat claim; plain PVP is **not** an L9 member |
| R2 | `none_visible` | no protein, silane, silicone quat or cationic polymer |
| DOSE | `moderate` | from shadow WT |
| EXPO | `fragrance_declared` | `PARFUM` #17; no individually declared allergens; no solvent alcohol |
| ROLE | `["post_wash", "curl_styling"]` | damp hair; "for a textured look"/"more controlled look" |
| care_direction | `unknown` | no protein route; and `moisture` needs a *coherent* L1/L3/L4 architecture — humectants alone, with no emollient and negligible L1, is not one |
| Focus | `curl_definition` | HOLD-led, which is exactly why the record leaves the category |

## German copy that would be emitted if this record were retained in-category (§18)

- HOLD `meaningful_hold_route`: „Bringt Halt über ein Styling-Polymer – das ist etwas anderes als Pflege."
- HUM `claim_only`: „Anti-Frizz ist ausgelobt. Aus der INCI-Liste lässt sich das Verhalten bei hoher Luftfeuchtigkeit nicht ableiten."
- HUM humectant counter-signal: „Enthält Feuchthaltestoffe – die machen das Haar weicher, sprechen aber nicht für Frizz-Schutz bei feuchtem Wetter."
