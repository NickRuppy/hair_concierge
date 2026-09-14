# Leave-In v0.1 category charter

Status: **pre-calibration working draft — nothing frozen, no product classified**
Document version: `v0.1-draft`
Engine version: `leave-in-inci-v0.1`
Market: Germany/EU
Capture date: 2026-09-03
Normative standard: `leave-in-classification-standard.v0.1.md` (this charter is the condensed front page, not a substitute)

Condensed from `plans/leave-in-inci/first-output-charter-draft.md` (the reviewed charter carrying Nick's confirmed rulings 1–8), the Leave-In Category Development Handover v1.0, and the leave-on science review.

---

## Category definition

A leave-in is a cosmetic hair product intentionally left on the fibre after application, whose primary or co-primary function is conditioning, detangling, smoothing, curl support, heat-styling support or related fibre management. It may be used on damp or dry hair and may be a spray, mist, milk, lotion, cream, microemulsion or two-phase system.

The research unit is the **exact market product, pack and formula version** — never a brand line or marketing name.

## Boundary rule

**Classify by function + authoritative directions + formula architecture. Never by name.**

- Conditioning/detangling primary and the product stays on the hair → include.
- Durable hold or texture primary → route to styling.
- Anhydrous oil/silicone → route to oil/serum.
- Genuinely ambiguous → `provisional_boundary`; complete the record and keep it as a boundary stress case.

### Included

Water-based or emulsion-based leave-in sprays, mists, milks, lotions and creams · single-phase and two-phase products when conditioning/detangling is primary or co-primary · multi-benefit "10-in-1" products that are fundamentally leave-in conditioners or primers · curl creams when conditioning/definition is central and hold remains secondary · blow-dry primers and heat-protective leave-ins when conditioning is meaningful.

### Excluded

Pure oils and anhydrous silicone serums (→ oil/serum) · styling-first gels, mousses, hairsprays, waxes, clays and strong-hold creams · rinse-out conditioners, masks, co-washes and cleansing conditioners · scalp serums, growth tonics, medicated and anti-dandruff treatments · color-depositing leave-ins and salon chemical-processing treatments.

### Catalog impact (ruling 4)

About ten current "Leave-in" SKUs are boundary-suspect (serum / oil_replacement rows). Research records **flag** them; the live DB categories stay unchanged pending a separate decision. Water-based products called "serum" may remain in-category once the formula is verified — the word is marketing, not architecture.

## The five architectures (FORM)

| Architecture | INCI-visible marker | Trap |
|---|---|---|
| Aqueous / hydroalcoholic solution | No LGN pair; solubiliser-type emulsifiers only | Can still carry a heavy non-volatile package |
| Emulsion (milk / lotion / cream) | Cationic surfactant **plus** long-chain fatty alcohol — the lamellar gel network pair | Thin-lotion vs milk is rheological and carries no decision weight |
| Microemulsion | Clear, with a real oil/silicone load; several PEG-esters/solubilisers; no LGN pair | "Clear = light" is false |
| Two-phase spray | Oil/silicone phase with **no emulsifier**; "vor Gebrauch gut schütteln" | Least dose-predictable form |
| Anhydrous serum / oil | No leading Aqua | **Out of category** |

**Category law:** `residue load ≈ dose × non-volatile fraction × (1 − removal)`. FORM is a high-confidence architecture label and a **low-confidence weight proxy**. "Spray ⇏ light" is a hard gate (G9), not a note.

## Ontology at a glance (ruling 5)

**13 scored dimensions:** FORM · COND (absorbs R1) · SLIP (WET+DRY merged) · SFR (narrowed to ambient smoothing; "frizz" removed) · **WT (anchor dimension)** · PERS (PERS+WASH merged, ordinal mechanism class only) · HOLD (3-state) · HEAT · HUM · R2 · DOSE (derived) · EXPO · ROLE.

**Demoted:** SHN → qualifier on the smoothing route · CURL → derived focus · R3 → flag · LAYER → caution string only · plus a non-quantitative buildup caution. R1 folds into COND.

**Vocabulary rulings (7):** `usage_role` is reinstated for leave-in (E1 directions read; the conditioner's drop does not transfer). `care_direction` (protein/moisture/balanced) is **kept** as a dedicated evidence-backed axis, overriding the science review's recommendation to drop it — with the constraint that it may not drive weight, persistence, hold or heat matching.

**Heat (ruling 6):** production carries a **binary** `provides_heat_protection`, claim-led with a formula sanity-check against the closed evidenced-polymer list. `heat_protection_max_c` is **removed from the model**; its removal from live code and catalog facts is a scoped Phase-5 follow-up surfaced to Nick before execution. The four-state evidence detail lives in the research trace only. Never grade efficacy.

## Evidence boundary

- E0 claim · E1 verified INCI/directions observation · E2 mechanism inference **for leave-on exposure** · E3 exact product tested **as a leave-on** · E4 human-use/blinded sensory · E5 replicated.
- **Formula-only evidence stops at E2.** Claim-only is E0.
- **Leave-on E3 metadata requirement:** dose (g/g), damp vs dry, drying method and ambient RH. Missing any one downgrades the record to E2.
- **Evidence firewall:** rinse-out, shampoo, pre-wash-oil and in-salon evidence enters **only at E2, as mechanism** — never as product evidence.
- EU Article 19 permits bounded rank observations only; the sub-1 % tail is unordered and the boundary is invisible. No percentages, pH, molecular weight, droplet size, viscosity grade or deposited amount from a consumer list.
- Bottle rheology, cream thickness, ingredient presence, reviewer agreement and existing catalog labels are not performance tests.

## Identity gate

Before classification: product UUID, exact brand/name, market, pack size, a reliable identifier or a documented gap, dated exact-market formula source, raw INCI plus normalized fingerprint, **authoritative application directions**, product-form status, and any preserved source conflicts. A missing catalog barcode is a research gap, not authority to write one. Missing directions make `usage_role` `unknown` — never an INCI guess.

## Gates

G0 boundary/product form · G1 identity and formula · G2 evidence chain · G3 anti-double-counting · G4 evidence cap · G5 conflict preservation · G6 medical · G7 review freshness · **G8 exposure-regime firewall** · **G9 form is not weight** · **G10 heat strictness** · **G11 no quantitative persistence** · **G12 regulatory durability**.

## Decisions this authority supports

Formula architecture · leave-on conditioning and slip potential · ambient smoothing/alignment · weight and residue potential (the anchor) · persistence as a mechanism class plus a buildup caution · hold route state and the styling boundary · heat and humidity as evidence states · substantive-film repair route · derived dose sensitivity · exposure flags and application protocol · usage role from directions · care direction · broad thickness/damage/texture fit priors carrying `derived_from`.

## Decisions this authority does not support

Diagnosing a user · inferring an ingredient deficiency · predicting allergy or tolerance · treating scalp disease or hair loss · converting a marketing repair/bond/heat/humidity claim into efficacy · any duration, wash count or applications-to-buildup figure · a numeric layering-compatibility score · a graded hold level · a heat-protection strength or temperature.

## Regulatory watch

**Commission Regulation (EU) 2024/1328** extends the D4/D5/D6 0.1 % w/w limit to **leave-on** cosmetics from **6 June 2027** (rinse-off from 6 June 2026). German/EU leave-ins still legally contain Cyclopentasiloxane/Cyclohexasiloxane today, but reformulation to linear volatiles and isododecane completes within this standard's first year.

**`regulatory_re_review_trigger: 2027-06-06`** — adopted as an implementation default, no objection raised at charter review. Rules key on **function** ("volatile carrier present") with the INCI family enumerated, never on a specific cyclosiloxane.

## Open evidence gaps (must stay open)

Consumer dose per form · leave-in accumulation over realistic use cycles (circulating percentages are untraceable and **banned**) · transfer to skin/collar/pillow · layering and pilling · whether wet and dry slip separate from formula · curl definition from formula · humidity response from formula · whether any German-market leave-in holds E3+ heat evidence · two-phase dose variability · what replaces D5/D6 after June 2027 · fine-hair residue thresholds (a **product judgment call**, labelled as one) · sensitive-scalp tolerance from INCI.

## Parked consequential assumptions

- **OA-1** DB `format` enum vs profile architecture enum (`two_phase` missing, `serum` boundary) — Phase-5 adapter/migration decision.
- **OA-2** Projection of the four-state heat evidence onto existing production fields, and the `heat_protection_max_c` removal migration — Phase-5 adapter decision.
- **OA-3** Blind-reviewer identity (Codex vs a clean Claude session) — decided at Phase-2 start.

## Calibration status

**None run.** The 12 archetypes are selected for best archetype coverage regardless of catalog presence (ruling 3); the final 12 with GTINs go to Nick before any classification (ruling 8). A blind reviewer receives the standard and locked formula/directions packets but not the key; disagreements are coded by cause and Nick adjudicates (ruling 2). Systematic disagreement becomes a rule; product-specific uncertainty stays uncertainty.

## Stop condition

This charter and its standard produce **research artifacts only**. No catalog value, recommendation, Product Intake rule, Supabase row, user-facing copy or production matcher changes on their authority.
