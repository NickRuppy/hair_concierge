# X3 - Heat activation ("needs heat to work"): facts

Read-only pass, 2026-10-09. DB: SELECT only. Web content treated as data.
Code root: `.worktrees/catalog-completeness-fill` (paths below relative to it).

## 1. Existing field `product_leave_in_specs.heat_activation_required`

Schema: `supabase/migrations/20260307152000_leave_in_specs_and_profile_fields.sql:91` (`boolean NOT NULL DEFAULT false`),
CHECK `product_leave_in_specs_heat_activation_requires_styling_role` (L131-134: true => `roles @> {styling_prep}`),
partial index L150-152.

Live: 68 rows, **0 true** (`select count(*) filter (where heat_activation_required)` = 0). 28 rows have `provides_heat_protection`.

| File | What it does with the field |
|---|---|
| `supabase/migrations/20260314234500_add_leave_in_eligibility_and_matcher.sql:37,54,81,189,251` (+ `20260314235000_secure_leave_in_eligibility.sql:13,31,58`) | `expand_leave_in_eligibility`: activation OR heat protection => `heat_protect` bucket; activation => styling_context forced to `{heat_style}` only (no air_dry / non_heat_style rows). |
| `src/lib/leave-in-research/production-adapter.ts:371` | Row type is the literal `heat_activation_required: false`. |
| same `:640,:653` | TS mirror of the SQL expander (`expandLeaveInEligibility`), same activation rules. |
| same `:1057` | Hard-codes `false`. `:1077,:1099` feed the expander. |
| same `:1118-1122` | Invariant: activation => every eligibility row is `heat_style`. `:1135` invariant: heat_protect bucket needs hp or activation. |
| same `:1198` | Rationale string: "AD-3: always false. The standard has no research source for heat activation, so the adapter never claims it." `:1299` summary prints it. |
| `src/lib/product-intake/category-validators.ts:102,557` | Intake schema requires the boolean (no constraint on value). |
| `src/lib/product-intake/catalog-enrichment/leave-in-research-calibration(.ts:107 / -v2-t20.ts:112)` | Pinned projected-column lists; SQL executor `20260929214731_..._v2_t20_executor.sql:113` lists it too. |
| `src/lib/leave-in/constants.ts:176`, `apps/product-intake-review/.../review-property-rows.ts:40`, `src/lib/catalog-authority/product-spec-relationships.ts:30` | Type / review-row column list / select string. |
| `src/lib/routines/personal-plan/application/catalog-facts.ts:9,44,51` + `src/lib/personal-plan/routine/application-adapter.ts:95` | Maps to application fact `heatActivationRequired` (provenance `catalog_spec`). **No consumer reads that fact** (grep `heatActivationRequired` in src: only producers). V2 contract has `facts.heat.activationRequired` (`contracts-v2.ts:196`) and live pre-heat rows carry `false`. |
| `src/lib/recommendation-engine/categories/leave-in.ts:472,511` + `selection.ts:482` | Chat engine: if user has no heat need and product needs activation => `leave_in_heat_activation_without_heat_mismatch`, in the hard-mismatch (fallback-ineligible) set. |
| `scripts/ingest-products.ts:438`, `scripts/backfill-leave-in-specs.ts:67`, `scripts/catalog-additions/prepare-2026-06-27-products.ts:329` | Legacy: name-substring heuristic ("heat activated"/"fohn"/"blow dry") in ingest; backfill + catalog-additions write false. |
| `docs/personal-plan/categories/leave-in/decision.md:266` | "The legacy `heat_activation_required` field ... [is] not Personal Plan fit or ranking axes. Any material activation ... instruction belongs to the exact verified product protocol." Conflicts with Nick's 2026-10-09 ruling (needs amending). Oil decision.md says "Do not store ... Heat-activation fields" for oil. |
| `docs/product-application-protocol-templates.md:889` | TPL-LEAVEIN-HEAT deviation rule: if `heat_activation_required = true`, copy must not imply it works without heat; flag. |

History: field existed since the 2026-03 spec (`plans/archive/leave-in-recommendation-spec.md:91,236,245`: -20 score when activation required and user does not heat-style; optional fallback exclusion). Neqi Diamond Glass spray was `true` in the legacy hand-curated row. Adapter decision `plans/leave-in-inci/adapter-decisions.md:27` (AD-3, ruled 2026-09-14): "`heat_activation_required`: always `false` (no research source; DB CHECK satisfied since we never claim activation)". Apply package flipped Neqi true -> false (`plans/leave-in-apply/apply-package.md:104`, `apply-runbook.md:558`); live since 2026-09-29. Not a product decision about activation being wrong - it was "no research field exists, so never claim it". `docs/research/leave-in-inci` has zero hits for heat_activation/activation-as-field.
The blind-review notes of the gold set record Neqi's "heat-activated polymers" only as a counter-signal on the L9 heat route (`data/research/leave-in-inci/v1.0/corpus/gold-set/blind-v2/blind-review-notes.md`).

## 2. Stage-3 effect (`src/lib/personal-plan/products/authority/categories/leave-in.ts`)

- Evaluator never sees activation: `Stage3LeaveInFacts` is built in `products/authority/catalog-facts.ts:660-672` from `plan_roles`, `providesHeatProtection`, `application_stage`, `functional_benefits`... no activation, no `roles`, no `conditioner_relationship`.
- Role gating: `post_wash_leave_in` needs `plan_roles` to include it (L71) and a post-wash stage `towel_dry|damp|wet` (L105-119, `supportsPostWashApplication`). `pre_heat_application` needs `providesHeatProtection === true` (L98), `application_stage` to include `pre_heat` (L120; commit `23a83cfa` on codex/catalog-assessment-completeness deletes this check, not on main), and a `verified_complete` protocol (L66-67).
- The plan only requests `pre_heat_application` when the user has a `heat_protect` function (`src/lib/personal-plan/categories/leave-in.ts:274-277`), so a pre-heat-only product naturally lands only in the heat-styling routine.
- `conditionerReplacementEligible` (categories/leave-in.ts:291) is set on the target but **no evaluator reads it**; conditioner replacement in the Personal Plan is not decided via roles/relationship. `roles[]` (`replacement_conditioner` vs `extension_conditioner`) and `conditioner_relationship` (AD-3/AD-4: replacement_capable iff conditioning AND persistence moderate/high) are consumed by the chat engine (`recommendation-engine/selection.ts:1549,1594`, `categories/leave-in.ts:194,236,525`), the catalog audit reader (`catalog-authority/audit-reader.ts:251`), display labels (`chat/product-display-model.ts:534-538`: "Kann Conditioner ersetzen") and admin page.
- Neqi spray live today: roles `{replacement_conditioner, styling_prep}`, `conditioner_relationship=replacement_capable`, `plan_roles={post_wash_leave_in, pre_heat_application}`, stages `{towel_dry, pre_heat}`, hp=true.

What must change for "pre-heat only, never post-wash / replacement":
1. Adapter: when activation=true emit `plan_roles = [pre_heat_application]` only (schema `.min(1)` ok, `category-validators.ts:563`); Stage-3 then returns `leave_in.role` mismatch for post_wash (L71) with no evaluator change. Force `roles` without `replacement_conditioner` and `conditioner_relationship=booster_only` (override AD-3/AD-4) so the chat engine and badges stay consistent; `styling_prep` is already required by the CHECK.
2. Stage-3 facts: add `heatActivationRequired` to `Stage3LeaveInFacts` + catalog-facts row mapping + product fact fingerprint; defensive evaluator guard (activation && role=post_wash => mismatch with German reason) so DB drift cannot re-open the hole. Decide whether activation alone may satisfy `pre_heat_application` when `provides_heat_protection=false` (today it needs hp=true; all 3 strong candidates also carry an hp claim).
3. Eligibility: no change - expander already restricts activation to `heat_style`.
4. Chat engine: already hard-mismatches activation without a heat need; verify `heatFit` for moderate need.
5. Display/admin/legacy scripts: stop hard-coding false; remove the ingest name heuristic or route through research.
6. Docs to amend: leave-in `decision.md:266`, adapter doc AD-3 table, TPL-LEAVEIN-HEAT (activation rule becomes normative).

## 3. Guidance: shape of a bespoke product protocol

Table `product_application_protocols` (cols: product_id, category, role, application_stage, application_state, placement, contact_time_seconds, rinse_action, reapplication, instruction_modifiers, source_label/url/text, guidance_payload (V1), guidance_payload_v2; generated: application_family, category_key). A row is `verified_complete` iff the V1 payload parses and scope = this product + category (`docs/product-application-protocol-templates.md` 2.1).

V1 (steps are product-scoped, free German copy, no interpolation):
```
{schemaVersion:1, protocolVersion:1, locale:"de",
 guidanceKey:"product-leave-in-<id>-pre-heat",
 scope:{kind:"product",category:"leave_in",productId:"<id>"},
 role:"heat_protection", applicationFamily:"pre_heat_damp", compatibleDayTypes:["styling_day"],
 exactGuidanceRequired:true,
 sequence:{anchor:"damp_leave_on",before:["heat_tool"],after:[],conflictsWith:[]},
 requirements:{requiredCatalogFacts:[],requiredProfileFacts:[],requiredProtocolFacts:[]},
 protocolFacts:{applicationArea:"lengths_ends",rinse:"leave_in",contactTimeSeconds:null,
   conditionerRelationship:"not_applicable",reapplication:"each_separate_heat_event",
   amount:{kind:"qualitative",copyDe:"Gleichmäßig sprühen."},cautions:[]},
 steps:[{stepKey:"apply-pre-heat",action:"apply_product",copyTemplateDe:"..."},
        {stepKey:"tool-pre-heat",action:"tool",copyTemplateDe:"..."}],
 evidence:[{sourceUrl,sourceType:"manufacturer",checkedAt:"YYYY-MM-DD"}]}
```
Live example Redken Extreme Anti-Snap (`2b7db7e3`): apply copy "Vor dem Hitzestyling gleichmäßig ins handtuchtrockene Haar sprühen, in Längen und Spitzen verteilen und durchkämmen – nur Strähnen mit Produkt sind geschützt."; tool copy "Danach wie gewohnt mit Wärme stylen. Glätteisen oder Lockenstab nur auf komplett trockenem Haar verwenden. Vor jedem weiteren Hitzestyling erneut auftragen."

V2 (`src/lib/routines/personal-plan/application/contracts-v2.ts`, `productApplicationPointerV2Schema`): a pointer {schemaVersion:2, contractKind:"product_pointer", scope, sourceRole, role, applicationFamily, facts{applicationState, applicationArea, rinse, contactTime, amount, heat{supportedStates, **activationRequired**, maximumClaimedTemperatureC, reapplication}, conditionerPolicy}, workflowId, exactSteps, cautionCodes, evidence}. **Ordinary pointers (`workflowId=null`) cannot own visible steps** (superRefine L274): the visible Personal Plan copy is the shared family template - for leave-in pre-heat one sentence "Gleichmäßig auf handtuchtrockenem Haar verteilen. Erst danach föhnen oder stylen." (`shared-templates-v2.ts:71-78,485-499`). V2 already models `heat.activationRequired` but nothing consumes it.
Bespoke visible steps exist only via a reviewed `workflowId` (`EXACT_APPLICATION_WORKFLOW_IDS_V2`, `contracts.ts:99-105`: swiss_o_par_tea_tree_two_pass, epres_bond_repair, k18_leave_in_molecular_repair, olaplex_no3plus_complete_repair, bondbuilder_verified_product), each mapped in `EXACT_WORKFLOW_FAMILIES` (`contracts-v2.ts:72`) and `EXACT_WORKFLOW_RUNTIME` (`compiler-v2.ts:60`); steps are `exactSteps[{stepKey, action in apply_product|wait|rinse|dry|tool|section, copyDe}]`, evidence min 1. Live bondbuilder rows show the shape (e.g. Aveda: apply/section/wait/rinse...). Nothing in V2 supports a leave-in pre-heat exact workflow yet: a heat-activated product needs a new workflowId (e.g. `heat_activated_styling_verified_product`, families `pre_heat_damp`/`pre_heat_dry`, anchor `damp_leave_on`) or the shared pre-heat template must read `facts.heat.activationRequired` to add section / "unter Spannung föhnen" copy. Decision for Nick.
Neqi source directions (manufacturer, DE): "Das Haar in Abschnitte unterteilen." / "Das Spray großzügig und gleichmäßig auf das handtuchtrockene (nicht nasse) Haar sprühen." / "Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen." -> steps section, apply_product, tool. The shared templates would omit the section and tension steps; the r4 findings already flagged this as an open point.
Post-wash template TPL-LEAVEIN-DAMP would no longer be generated for such products (only pre-heat row).

## 4. Standard change process

Precedent: T20 (care_direction), 2026-09-29, PR #626 (`841040cf`, 54 files). Standard v1.0 stays byte-frozen (sha256 pinned); a policy change = overlay `docs/research/leave-in-inci/v1.1/leave-in-classification-overlay.v1.1.md` ("Standard v1.1 = v1.0 + this file", names base by sha256, scope line, ledger block "8. Rule-change ledger", "9. Source anchors"), README index row, `data/research/leave-in-inci/v1.1/{artifact-manifest.json,v1.1-logic-lock-receipt.json,calibration-envelopes,calibration-expected-projections.json,lab-fixture.json}`, adapter policySha256 pin + `research_model_version: leave-in-inci-v1.1` refusal of stale envelopes (`production-adapter.ts`), `plans/leave-in-inci/adapter-decisions.md` (AD revisions; adapter version v1 kept per AD-6 precedent), a new apply lane (`leave-in-research-calibration-v2-t20*.ts`, scripts, SQL executor migration, preflight/apply runbook), tests (`leave-in-research-v1-1-lock`, adapter, calibration, executor-postgres, package.json script lines). A v1.2 would do the same: overlay + manifest/lock receipt + adapter change (AD-3 revision, remove literal `false`) + expected projections + tests + new executor generation for the changed field set + README/runbook "Guidance synchronization" (`README.md:106`).

Closest rules:
- Claim-led (§2.4.1): "A marketing claim exists for classification purposes if and only if the manufacturer's German/EU product page or the current German pack states it. Retailer copy ... never creates a claim." Fields governed: HEAT only ("HEAT is now the only claim-led field this standard has", T9).
- T9 precedent against a second claim-led field (§7.9): "An unverifiable manufacturer claim is not a comparison axis" and "leaves HEAT as the sole claim-led field this standard has to defend".
- Directions-led (§7.13, `application_stage`): "identity data, transcribed the way a GTIN or pack format is ... with no additional claim-authority gate"; "A stage without its verbatim direction sentence ... is invalid and must be dropped"; "Silence leaves `application_stage` empty - never guessed from the formula"; ambiguity => review as identity conflict. `pre_heat` = "A named heat tool, or a direction positioning the application before heat styling".
- Assessment: heat activation as stated by Nick ("manufacturer says heat-activated; directions = ... blow-dry under tension") is a **directions field** (usage requirement), modelled like `application_stage` (new identity field `heat_activation` + verbatim direction sentence, source from G1 hierarchy, never derived from formula, never sets `provides_heat_protection`). Using the claim-led ladder would reopen what T9 closed. Open point for Nick: whether the G1 hierarchy (retailer allowed) or C1/C2-only applies; Pantene HEAT&GLOW is the case where it matters (activation text is on the pack photo + dm only).
- Needs a cross-check invariant: activation => `application_stage` contains `pre_heat` (directions name the heat step) and CHECK needs `styling_prep` in roles.

## 5. Candidates

Verified live: no `description`/`short_description`/`tom_take` in `products` contains aktivier/activat/hitzeaktiv/wärmeaktiv (regex query returned 0 rows); descriptions are mostly generic synthesized text (Neqi spray has no description). So evidence must come from sources. Tiers = standard's C-tiers (C1 pack, C2 manufacturer DE page, C3 exact-GTIN retailer).

| Product | Activation wording (verbatim) | Source / tier | Verdict |
|---|---|---|---|
| Neqi Diamond Glass Ultimate Styling Spray `42a2fe20` | "Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray schaffen maximale Geschmeidigkeit ..." ; directions "Das Spray großzügig und gleichmäßig auf das handtuchtrockene (nicht nasse) Haar sprühen." / "Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen." | https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray (WebFetch 2026-10-09), C2 manufacturer DE. Corroboration C3: dm.de 3080142 via dm MCP (r4 evidence): "Jeden Abschnitt unter Hitze und Spannung föhnen, um den leistungsstarken Feuchtigkeitsschutz zu aktivieren"; "Formel mit hitzeaktivierten Polymeren" | **YES** |
| Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW `e781ca9e` | Pack (front/back, via dm packshot): "Hitzeaktivierte Formel für extra Pflege"; "Unsere Pro-V Formel bringt bei Hitzeaktivierung noch mehr feuchtigkeitsspendende Nährstoffe ins Haar und versiegelt es."; directions "1-2 Pumpstöße auf das gereinigte Haar auftragen. / Föhnen, um zu aktivieren. / Zwischen den Haarwäschen nutzen, um Frizz zu kontrollieren." | r1 findings (`plans/catalog-completeness-fill/research/r1-leave-in-heat/findings.md:208-218`): C1 pack photo hosted at products.dm-static.com + dm.de/p/d/3088304 (C3 "Leave-In-Creme mit hitzeaktivierter Pflege"). dm.de is a JS shell (WebFetch returns only the logo; plain fetch blocked) - r1 read it in the in-app browser. No pantene.de manufacturer page found via search; P&G presseportal 503. | **YES, with caveat**: second dry-hair use between washes ("Zwischen den Haarwäschen") means it is not heat-only; and source tier is pack-photo/retailer |
| Garnier Fructis Sleek & Stay Heat-Activated Serum `c574ee6f` (category Öle, oil spec role `leave_on_fibre_conditioning`) | "Dabei wird das Leave-in-Haarserum durch Hitze aktiviert, wobei sich die enthaltenen Alpha-Silane ..."; "Da das Serum durch Hitze aktiviert wird, bietet es dem Haar einen wasserresistenten Hitzeschutz"; Anwendung step 3 "Nun das Haar sorgfältig föhnen und anschließend, wenn gewünscht, ein Glätteisen verwenden" (WebFetch cut sentences). US page: "Air-drying will not activate the serum." | https://www.garnier.de/haarpflege/haarpflege-marken/fructis/keratin-sleek/serum (fetched OK 2026-10-09), C2 manufacturer DE. DB protocol source_text: "Einen Pumpstoß in feuchte Längen und Spitzen geben, nicht ausspülen und anschließend föhnen oder glätten." Currently has only a post-wash `post_wash_damp_conditioning` protocol. | **YES** (new find; sits in the Oil category - the activation property needs a home outside leave-in specs, or the product needs reclassifying) |
| Urban Alchemy Repair & Revive `45f4fe15` | none; directions "Föhnen, stylen oder an der Luft trocknen lassen." | r1: https://urban-alchemy.com/products/repair-revive-leave-in-spray-150-ml (C2). Own fetch of a guessed URL: 404. | **NO** (heat optional) |
| Gliss Ultimate Repair Sprüh-Conditioner `5dc2fae3` | none; "in das handtuchtrockene oder trockene Haar sprühen" | r1: schwarzkopf.de ultimate-repair-express-repair-spuelung (C2) | **NO** |
| Olaplex No.6 `4e99706a` | none; "Einen Pumpstoß auf das saubere, feuchte Haar auftragen. Durchkämmen und wie gewünscht stylen." | r1: olaplex.de/products/olaplex-no-6-bond-smoother (C2) | **NO** |
| Redken Extreme Anti-Snap `2b7db7e3` | none; "Ins handtuchtrockenen Haar geben. Nicht ausspülen. Wie gewohnt stylen." | r1: redken.eu/de-de .../extreme-anti-snap (C2) | **NO** |
| Alcina Hyaluron 2.0 `9b664b11` | none; "Anti-Heat-Factor verhindert Hitzeschäden bis zu 230°C" is protection, not activation | r1: alcina.com/de-de ... (C2) | **NO** |
| Neqi Build Boost Balm / Moisture Mystery | none (heat-protection claim only; "Wie gewohnt stylen") | r1 (C2) | **NO** |
| Pantene Bonding Leave-In `35a372b6` | none; "Als Hitzeschutz für nasses Haar" | r1 (haircode.io) | **NO** |
| Others scanned (name/description regex over all 65 active leave-ins, 53 oils, 7 heat protectants) | nothing else matching | DB | no further hits |

Market-scan hint (WebSearch, retailer/Amazon copy only, not in catalog, supporting at best): Dualsenses Bond Pro Serum Spray, Pureology Smooth Gloss Silkmorphose Spray, Kenra Thermal Styling Spray 19, Eufora Retain Heat Activated, H2 Thermal Heat Activated, GHD Rehab - "heat-activated" is a recurring marketing label for styling-category growth; the search summary itself notes the term is mostly marketing.

Notes/blockers: dm.de plain fetch returns only the page shell (JS app); dm MCP (`mcp.dm.de`) and the in-app browser worked for earlier passes. rossmann.de bot-walled. Garnier US page language is English (supporting only).
