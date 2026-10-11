# Leave-In Research and Classification Standard v1.2 — overlay

Status: **logic locked — normative overlay on Standard v1.1**
Document version: `v1.2`
Engine version: `leave-in-inci-v1.2`
Base standard: `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md` (Standard v1.0, sha256 `7ae5e882d9cba3e3fccdea3623d056efe802ff3bc3adbe554112e471da551ace`, 421855 bytes) — **byte-identical, not edited**
Previous overlay: `docs/research/leave-in-inci/v1.1/leave-in-classification-overlay.v1.1.md` (Standard v1.1, T20, sha256 `9c1340357b4c0cf38933340f4592250d10f2cccc1429b0e4d46508d47eee032b`, 21091 bytes) — **byte-identical, not edited**
Ruling: **T21**, Nick, 2026-10-09 (rulings A1, A2, D-c, D-d, D-e; slice plan `plans/catalog-completeness-fill/s3-heat-activation.md` §1)
Scope: the identity field `heatActivation` only
Normative source: this Markdown file together with the v1.1 overlay and the base standard
Date: 2026-10-09

## 0. How to read this overlay

Standard v1.2 is **Standard v1.0 plus the v1.1 overlay plus this file**. v1.0 and the v1.1 overlay are frozen and their bytes are pinned; a policy change produces an overlay, never a silent rewrite (README, "Guidance synchronization"). Where this overlay speaks, it **adds** to the identity block that §7.13 (`application_stage`) defines. It replaces no v1.0 or v1.1 text.

**Added:** one identity field, `heatActivation`, captured at G1 next to `applicationStage` (§1.2), with its evidence rule (§1.3, HA-1…HA-9).

**Not changed:** every §7 dimension, every lean-profile field, every anchor, threshold, gate, evidence bar and German string of v1.0; the v1.1 `care_direction` rule (§9-O1–O7); §13.3 (the HEAT binary); §2.4.1 (the claim-authority ladder and T9's "HEAT is the only claim-led field"); §7.13 (`application_stage`). The research envelope keeps its version string `leave-in-research-envelope-v1.0`; only the research-method stamp moves and the identity block gains one required key.

## 1. T21 — heat activation (normative)

### 1.1 What the property is

"Needs heat to work" is a **usage requirement the manufacturer states**: the product only does its job when a named heat step follows application. It is not a benefit claim and not an efficacy grade. It is completely separate from heat protection (ruling D-e).

### 1.2 Field shape (research envelope, identity block)

```jsonc
"identity": {
  "applicationStage": ["towel_dry", "pre_heat"],
  "heatActivation": {
    "value": "required",                 // "required" | "not_required"  (no "unknown": AD-2)
    "route": "airflow_shaping",          // "airflow_shaping" | "direct_contact_heat" | "either_heat"; null iff not_required
    "statements": [                      // verbatim, C1/C2 only; ≥1 of each kind when required
      { "kind": "activation_statement",
        "quote": "Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray",
        "sourceTier": "C2", "sourceUrl": "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray",
        "retrievedAt": "2026-10-09" },
      { "kind": "heat_step_direction",
        "quote": "Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen.",
        "sourceTier": "C2", "sourceUrl": "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray",
        "retrievedAt": "2026-10-09" }
    ],
    "counterSignals": [                  // C3–C5 wording, corroboration only
      { "quote": "Jeden Abschnitt unter Hitze und Spannung föhnen, um den leistungsstarken Feuchtigkeitsschutz für spiegelglatte Haare zu aktivieren und die besten Ergebnisse zu erzielen.",
        "sourceTier": "C3", "sourceUrl": "https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate" }
    ]
  }
}
```

- `value` is `required` or `not_required`. There is no `unknown` member (AD-2). An unresolved capture is an identity conflict (HA-5), not a value.
- `route` is `null` exactly when `value` is `not_required`.
- `statements[]` carries verbatim manufacturer text only: `sourceTier` is `C1` or `C2`, with `sourceUrl` and `retrievedAt` (`YYYY-MM-DD`). A `not_required` capture normally has no statements.
- `counterSignals[]` carries C3–C5 wording (`quote`, `sourceTier`, `sourceUrl`). It never creates the value.

Production (`product_leave_in_specs`): the existing `heat_activation_required boolean NOT NULL DEFAULT false` stays; `heat_activation_route text NULL` is added with the three route values and the CHECK `(heat_activation_required) = (heat_activation_route IS NOT NULL)`. The route is what the routine and the plan guard need: „föhnen" is not „Glätteisen".

### 1.3 Evidence rule (directions-led, manufacturer-gated) — §7.13-HA

- **HA-1 Directions-led.** `heatActivation` is identity data transcribed from the product's own text, like `application_stage` (§7.13): never derived from the formula, the INCI, a polymer class or the product name alone; silence → `not_required`.
- **HA-2 Two prongs, both required for `required`:**
  (a) an **activation statement**: the manufacturer says heat activates or releases the product's effect („hitzeaktiviert", „durch Hitze aktiviert", „bei Hitzeaktivierung", „…, um zu aktivieren" with a heat step);
  (b) a **heat-step direction**: the directions name a heat tool step after application **without offering a non-heat finish** as an alternative. „Föhnen, stylen oder an der Luft trocknen lassen" (Urban Alchemy) offers one → `not_required`. A further use sentence that names no non-heat finish (HEAT&GLOW „Zwischen den Haarwäschen nutzen, um Frizz zu kontrollieren.") does not defeat (b): the pack's activation direction governs every use it lists (ruling D-c).
- **HA-3 Authority (D-d): manufacturer only.** Both prongs must come from **C1** (current German pack) or **C2** (manufacturer's German-market page), including §2.4.1 rule 6 (house brand on its own retailer page). **T14's `C2_cross_market_verified` does not apply** ("German page or pack"). C3–C5 wording may only corroborate; retailer-only activation wording → `not_required`, recorded in `counterSignals`, routed to review with note `activation_authority_gap`.
- **HA-4 Route** is transcribed from prong (b)'s tool: Föhn/föhnen/Rundbürste → `airflow_shaping`; Glätteisen/Lockenstab → `direct_contact_heat`; both named as alternatives → `either_heat`.
- **HA-5 Ambiguity** (one prong only, unclear tool, conflicting C1/C2) → `identityStatus: provisional_identity_conflict`, G5 preserved, human review; the record does not project (AD-2).
- **HA-6 Separation (D-e).** `heatActivation` never sets or reads `provides_heat_protection` (§13.3 untouched); the HEAT claim never sets activation. A product may be activated without protection, protected without activation, both, or neither.
- **HA-7 Cross-check invariant.** `required` ⇒ `application_stage ∋ pre_heat` (prong (b) is by §7.13's own definition `pre_heat` evidence). A violation is a capture error → `needs_research`.
- **HA-8 Review routing.** Every `required` value routes to human review (new field, small n) with note `heat_activation_required`; `activation_authority_gap` and `provisional_identity_conflict` as above.
- **HA-9 Claim-authority bookkeeping.** v1.0 §2.4.1 lists HEAT as "the only claim-led field" (T9). Activation is **not** claim-led (no claim ladder, no evidence grade); it borrows only §2.4.1's C1/C2 source gate. **T9 is not reopened:** HEAT stays the only claim-led field this standard has, and activation is a directions field gated to manufacturer sources.

### 1.4 Production invariants (adapter AD-7, table CHECK, publication gate, plan guard)

When `heat_activation_required = true`:

| # | Invariant | Enforced in |
|---|---|---|
| I1 | `application_stage ∋ 'pre_heat'` | adapter (refuse), table CHECK |
| I2 | `plan_roles = {pre_heat_application}` exactly — no `post_wash_leave_in` | adapter, table CHECK, plan guard |
| I3 | `roles = {styling_prep}` — no `replacement_conditioner`, no `extension_conditioner` (AD-3/AD-4 overridden) | adapter, table CHECK |
| I4 | `product_leave_in_fit_specs.conditioner_relationship = 'booster_only'` | adapter, publication gate (cross-table) |
| I5 | `provides_heat_protection = true` for a **Leave-In** projection | adapter refuses otherwise (`needs_research`: heat-activated without a heat-protection claim has no Leave-In plan role → Styling program); gate rejects curated/recommended rows |
| I6 | `heat_activation_route IS NOT NULL` | table CHECK |
| I7 | eligibility rows are `heat_style` only | eligibility expander + adapter invariant |
| I8 | required protocol roles = `{pre_heat_protection}` only | adapter `requiredProtocolRoles`, Product Intake expansion manifest |

**Eligibility (D-e).** The `heat_protect` need bucket comes from `provides_heat_protection` only — activation never counts as protection. An activated product lives in the `heat_style` styling context only, and each of its care buckets emits that `heat_style` row so it stays findable for heat stylers. Non-activated products are unchanged.

**Activation is never heat coverage.** Plan heat-carrier coverage reads `provides_heat_protection` only. A heat-activated product without a heat-protection claim has no Leave-In plan role (I5); the Styling category owns such products.

## 2. Consequences on the corpus

Standard v1.2 reopens `heatActivation` on every in-category record (§16: a standard-version bump reopens the fields whose rules changed). The capture was transcribed from each record's frozen directions capture (`identity.directionsOfUse` and `directionsSource` in `data/research/leave-in-inci/v1.0/lab-fixture.json`); for slot 13 the activation statement was read on the manufacturer page on 2026-10-09. Nothing else was re-judged.

| Record | Frozen directions (source tier) | v1.2 `heatActivation` | Basis |
|---|---|---|---|
| 1 alverde Sprühkur Express 7in1 | dry or damp hair, no heat step (C3) | `not_required` | HA-1 silence |
| 2 ISANA Hyaluron & Panthenol | „wie gewohnt stylen" (C2-equivalent) | `not_required` | HA-1 silence; no heat tool named |
| 3 Cantu Repair Creme | overnight under a cap, no heat tool (C3) | `not_required` | HA-1 silence |
| 4 alverde 2-Phasen-Sprühkur | dry or damp hair, no heat step (C3) | `not_required` | HA-1 silence |
| 5 EVO Head Mistress | "Apply to towel-dried hair and blow-dry for improved manageability and softness. Apply after styling to control frizz and fly-aways." (US English manufacturer page) | `not_required` | **Checked explicitly.** HA-2(a) fails: "for improved manageability and softness" is a benefit of the blow-dry, not a statement that heat activates the product. HA-3 fails independently: the source is not a German pack or German-market page. `application_stage ∋ pre_heat` is unaffected (§7.13 reads any named heat tool as `pre_heat`). |
| 6 Curlsmith Hydrate & Plump | „Style your curls as usual" (C3-equivalent) | `not_required` | HA-1 silence |
| 8 Gliss Express-Repair | towel-dry or dry hair, no heat step (C2) | `not_required` | HA-1 silence |
| 9 Redken Extreme Anti-Snap | „wie gewohnt stylen" (C3) | `not_required` | HA-1 silence |
| 10 Olaplex No.6 | "style as desired" (C2-equivalent) | `not_required` | HA-1 silence |
| 11 Balea Leichtkämmspray | „wie gewohnt frisieren" (C3) | `not_required` | HA-1 silence |
| **13 Neqi Diamond Glass** | „Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen." (C2, neqi-hair.com) | **`required`, `airflow_shaping`** | HA-2(a) C2 „Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray"; HA-2(b) C2 heat-only blow-dry direction; HA-4 „föhnen" → `airflow_shaping`; dm.de C3 wording recorded as counter-signal only; routes to review (HA-8) |
| u1 Elvital Dream Length | dry or wet hair, no heat step (C3) | `not_required` | HA-1 silence |
| u4 Briogeo Avocado + Kiwi | "Style as normal" (C5) | `not_required` | HA-1 silence |
| u5 ISANA Argan | „wie gewohnt stylen" (C2 house brand) | `not_required` | HA-1 silence |
| u6 amika The Shield | "spray on damp or dry hair before heat styling" (C5, non-German page) | `not_required` | HA-2(a) fails (no activation statement; the product protects, it is not activated); HA-3 fails (C5) |

The four excluded records (Maria Nila, Kevin Murphy, u2, u3) emit no identity capture beyond G0 (§2.3.1) and no `heatActivation`.

**Production consequence: only gold slot 13 moves.** Neqi Diamond Glass Ultimate Styling Spray projects roles `{styling_prep}` (was `{replacement_conditioner, styling_prep}`), conditioner relationship `booster_only` (was `replacement_capable`), plan roles `{pre_heat_application}` (was `{post_wash_leave_in, pre_heat_application}`), `heat_activation_required true` with route `airflow_shaping`, eligibility 6 → 4 rows (`normal|coarse × heat_protect|moisture_anti_frizz × heat_style`), and required protocol roles `{pre_heat_protection}` only. Its profile values (T20 `balanced`, T15 in-category, the HEAT binary `true`) are unchanged. T15's boundary call stands: Neqi stays a Leave-In because it carries a heat-protection claim (I5). Every other record's projection is unchanged apart from the new `heat_activation_route: null` key.

## 3. Conformance

- **Evidence ceiling (G4):** untouched. Activation is transcribed text, not a formula reading; it states no dose, temperature or efficacy.
- **Formula-first (constraint 3):** kept. The formula never sets activation (HA-1), and „hitzeaktivierte Polymere" never moves a §7 dimension.
- **No `unknown` commits (AD-2):** kept. The field has no `unknown` member; an ambiguous capture is an identity conflict that does not project (HA-5).
- **§1.1 conservative-failure invariant.** Activation moves a product **out** of the post-wash slot and out of conditioner replacement: it can only make the product less widely recommended. No confidence step-down is needed. Every `required` still routes to a human (HA-8), and retailer-only activation wording fails toward `not_required` with an `activation_authority_gap` review note (HA-3).
- **Separation (D-e):** kept. §13.3 and the HEAT binary are untouched; activation never fills the heat-protection role.
- **Claim authority (T9):** kept (HA-9).

## 4. Executable form

`src/lib/heat-activation/contract.ts` holds the capture schema (`heatActivationCaptureSchema`: the HA-2/HA-3/HA-4 shape), `deriveHeatActivationRoute` (HA-4), `heatActivationRouteServes` and `applyHeatActivationToLeaveInProjection` (I1–I8). The production adapter (`src/lib/leave-in-research/production-adapter.ts`, decision AD-7 in `plans/leave-in-inci/adapter-decisions.md`) routes every projection through that helper and refuses v1.1-stamped envelopes, because a missing capture must not default to "not activated". The text above is normative; the code must follow it.

## 5. Reuse by other categories

HA-1…HA-9 are category-agnostic. The Styling category cites them by section and by this file's sha256 and stores its own activation field; it does not read Leave-In columns. I2–I5 are Leave-In specific and are not reused.

## 6. Calibration honesty

T21 was applied by one transcription lane: the eleven gold-set envelopes were re-stamped by `scripts/leave-in-research/build-v1.2-calibration.ts`, which reads each frozen directions capture, asserts the `not_required` reading where no activation statement exists, and checks that every projection except slot 13 is unchanged. Two independent sealed lanes have not run the field. With one positive record in the corpus, the rule is implemented, not yet calibrated; the next calibration round should include more heat-activated candidates.

## 7. Records outside the research corpus

A catalogued Leave-In that was never engine-researched (for example Pantene HEAT&GLOW, a legacy curated row) is not re-researched to receive the field. It takes `heatActivation` through a field-scoped amendment that applies the same HA-1…HA-9 rule and the same production invariants (§1.4) through the shared helper, and changes no other legacy value. Its other legacy fields stay outside this standard until a full Leave-In research run covers them.

## 8. Rule-change ledger — v1.2 block

The v1.0 ledger (`v1.0/rule-changes.md`) and the v1.1 block (v1.1 overlay §8) are frozen. The v1.2 block lives here.

### Heat activation becomes a directions-led identity field (T21, 2026-10-09)

**22. T21 — heat activation (A1, D-c, D-d, D-e; Nick, 2026-10-09).** What changed: the identity block gains `heatActivation` (`required | not_required`, a route, verbatim C1/C2 statements, C3–C5 counter-signals), governed by HA-1…HA-9. `required` needs both a manufacturer activation statement and a heat-only heat-step direction from a German pack or German-market manufacturer page; retailer wording only corroborates. Activation is a usage requirement, never a benefit claim, and is separate from heat protection. **Consequence:** one record moves — gold-set slot 13 (Neqi Diamond Glass Ultimate Styling Spray) is `required` / `airflow_shaping` and projects to the pre-heat slot only. The other fourteen in-category records are `not_required`. **T9 is not reopened** (HA-9). **Adapter:** AD-7 added the same day — activation overrides AD-3/AD-4 (roles `styling_prep`, `booster_only`, plan role `pre_heat_application` only, protocol role `pre_heat_protection` only) and refuses activation without a heat-protection claim (`plans/leave-in-inci/adapter-decisions.md`). That is an adapter decision, not a standard change. *Motivated by:* Nick's 2026-10-09 rulings that "needs heat to work" is a real property (A1), that the Neqi styling spray is never a conditioner replacement (A2), that HEAT&GLOW's between-wash use is covered by its activation direction (D-c), that activation evidence is manufacturer-only (D-d), and that activation and heat protection are separate properties (D-e). *Traces to:* `plans/catalog-completeness-fill/s3-heat-activation.md` §1.

**README index row:** `T21 | Heat activation is a directions-led identity field (v1.2 overlay, 2026-10-09) | required needs a C1/C2 activation statement and a heat-only heat-step direction; route from the named tool; never from formula or name; separate from heat protection; T9 not reopened. Moves Neqi Diamond Glass (slot 13) to the pre-heat slot only.`

## 9. Source anchors

- Base standard v1.0 §2.4.1 (claim authority, rule 6, T9, T14), §7.13 (`application_stage`), §13.3 (HEAT binary), §14, §16, §2.3.1.
- v1.1 overlay (T20), unchanged.
- Slice plan: `plans/catalog-completeness-fill/s3-heat-activation.md` §1.1–§1.4 (rule text), §2.1–§2.4 (artifacts and adapter).
- Frozen directions captures: `data/research/leave-in-inci/v1.0/lab-fixture.json` (`identity.directionsOfUse`, `identity.directionsSource`).
- Neqi manufacturer page (C2): https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray (directions captured 2026-09-03, activation statement and directions re-read 2026-10-09).
- Neqi dm.de listing (C3, counter-signal only): https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate.
- Neqi v1.1 envelope and adapter output it re-stamps: `plans/catalog-completeness-fill/research/r4-user-submitted-14/leave-in-v1.1/neqi-spray/`.
