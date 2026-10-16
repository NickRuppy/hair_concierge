---
name: handover-oil-engine-phase1
description: "HANDOFF (2026-09-30): Oil engine Phase 1 — property set RULED by Nick, exploration facts, market research, open decisions + next steps; supersedes the process parts of handover-oil-engine-creation"
metadata:
  node_type: memory
  type: project
  originSessionId: d638a92e-8441-4270-a05e-63777b87b3a7
  modified: 2026-09-30T17:20:20.356Z
---

# HANDOFF — Oil research engine, after Phase 1 (property set ruled)

Paste into a fresh session in `/Users/nick/AI_work/hair_conscierge`. Read first: [[handover-oil-engine-creation]] (original mission, opening evidence, settled constraints, traps — all still valid), [[project-leave-in-research-engine]] (the reference arc), then this file. Program memory: [[project-oil-engine-program]].

## Where we are

Session of 2026-09-29/30 (Opus). Architectural path via brainstorming: exploration done, property set RULED by Nick. **Nothing written to the repo yet — no worktree, no branch, no charter file.** Next agent starts with `npm run worktree:new -- oil-inci` (verify base == fetched origin/main tip, see [[feedback-verify-worktree-base]]).

## Nick's rulings (2026-09-30) — do not re-litigate

- **OE1 Goal**: classify oils from the ingredient list (+ pack/directions) into the properties our application needs; calibrate on a set; iterate; then every future oil goes through the engine at intake.
- **OE2 Existing catalog oils = orientation / calibration start**, not primarily a correction target. (Softens the original handoff's "replace inconsistent weights" success criterion — corrections can still follow, but aren't the point.)
- **OE3 Rich research, not production-only**: research properties even if production doesn't read them yet, so they can be surfaced later. Properties must work as comparison criteria — "use oil A rather than oil B because X".
- **OE4 "Main strengths" (shine/frizz/slip focus) DROPPED** as a per-product property. Reason: every oil smooths the surface; differences are degree and come from the base. Instead the standard carries ONE effect description per base type, products inherit it (Nick reviews 4 descriptions once, not per product). Market research confirmed (same-base products differ in wording only; Moroccanoil Original/Light and Schwarzkopf Oil Ultime Rose/Argan differ only in weight). Revisit only if calibration finds two oils identical on paper but clearly different in behaviour.
- **OE5 Repair claim DROPPED** — Nick: oils don't repair. Oils protect/lubricate (and coconut reduces protein loss); bond claims in oils are unverifiable.
- **OE6 Protein/moisture direction DROPPED** — oils add neither; nearly all would be "balanced".
- **OE7 Scalp application = explicit fourth supported use** (research-side; production keeps 3 roles until a separate ruling). Record positioning only — never a growth/efficacy claim (medically adjacent boundary).
- **OE8 Scalp-active botanicals flag ADDED** (menthol, camphor, peppermint, eucalyptus, rosemary oil, tea tree) — Nick: "they can really trigger something on the scalp". Watch-out for sensitive scalp, not a benefit.
- **OE9 Porosity fit NOT added** (user profile has no porosity field — only consult knowledge-sources mention it; evidence thin). **Multi-use (face/body/hair) tag NOT added.**
- **Penetration understood as mostly coconut-led products** — Nick confirmed the reading.

## The ruled property set

| Group | Property | Draft values (NOT yet ruled — propose in charter) | Evidence basis |
|---|---|---|---|
| What it is | **Base** | pure_plant_oil / plant_oil_blend / silicone_serum / volatile_dry_oil (isododecane/isoalkane/ester carrier) / hybrid / water_based | top 3–5 INCI; high |
| | **Named-oil share** | leading / supporting / trace (vs tail marker) for the advertised hero oil | INCI rank only, never % |
| | **Weight** | light / medium / rich (DB enum) | needs the most careful rules; handoff findings 1,2,5 are the test cases |
| | **Dispenser** | dropper / pump / spray / pour | pack fact, captured not inferred; fixes the "drops for pump products" copy issue |
| What it does | **Penetrates or coats** | proven (coconut-led) / some_evidence (olive, avocado, argan-led — weak, never user-facing as fact) / surface (silicones, mineral oil, jojoba, most others) | Rele & Mohile 2003, Keis 2005 etc. — **UNVERIFIED from memory; run a science pass (hair-care-expert agent) before it becomes a rule**. Applies only when the penetrating oil LEADS (OGX Coconut Miracle = silicone-led → surface). |
| | **Heat protection** | boolean, claim-led (existing AD-6 doctrine, no degrees) | existing rule R-E + leave-in C1/C2 claim authority |
| How to use | **Supported uses** | pre_wash_fibre_treatment / leave_on_fibre_conditioning / dry_finish (DB roles) + scalp_application (research-only) | directions + base |
| Watch-outs | **Build-up** | washes_out / can_build_up (maybe 3 states) | silicone types (non-volatile dimethicone/dimethiconol/amodimethicone vs volatile), mineral oil |
| | **Ingredient flags** | silicones, mineral_oil, drying_alcohol, fragrance (incl. allergens), scalp_active_botanicals, [toning_pigment — see open item] | presence only |
| Derived | **Fits** | hair thickness, curl pattern, damage level — derived from the above, not independently researched (leave-in T8 "echo row" precedent) | |

**Per-base effect descriptions (O4) — draft wording to put to Nick:**
- silicone serum: silky slip, glossy shine, humidity-resistant film
- plant oil / blend: softness and suppleness, natural sheen, less slip
- volatile "dry oil": near-invisible finish, little residue
- water-based: light conditioning, closer to a leave-in spray than an oil

Water-based members (4 products: Neqi Opulent, Pantene Miracles 7in1, OGX Bond Protein Oil Mist, L'Oréal Midnight Serum) stay in category (earlier Nick ruling); `base = water_based` is how the engine models them honestly.

## Open decisions (bring to Nick one at a time, plain language, real product example + counts — see [[feedback-plain-examples-before-decisions]], [[feedback-answer-counterquestions-then-reask]])

1. **Toning pigment flag** — Nick asked "what is this?" (answered in session: violet/blue dye in "anti-brass" oils for blonde hair, e.g. Moroccanoil Treatment Purple; colourant readable from INCI, very rare, probably zero in our catalog). **Recommendation: drop it.** Needs Nick's final word.
2. **Thickness eligibility derivation** — the biggest un-ruled fork. If thickness is a broad hard gate and weight grades (decision.md + KM precedent "all three"), a formula-first engine makes almost every oil eligible for all three thicknesses; today 40 curated oils each carry exactly ONE thickness from the old Haartyp sheet. Options: all-three-unless-evidence / derived from weight / keep curated.
3. **Supported-uses rule** — deterministic mapping from directions + base to roles (e.g. pure plant oil → pre-wash; silicone serum → leave-on + dry finish).
4. **Legacy fields** — does the engine also fill `oil_subtype` (natuerliches-oel/styling-oel/trocken-oel) and `oil_purpose` for the legacy chat path, which ignores weight/role/heat? (Weleda rich-on-fine "leak" exists ONLY in the chat path; Personal Plan already excludes rich for fine.)
5. **Calibration cohort** — proposal: ~15 gold (incl. 4 water-based, KM Young Again, the identical-formula Pantene trio, the Balea/Isana isoalkane family, a coconut pure oil, Weleda Rosmarin, Neqi Rosemary) + ~6 unseen; example-disjoint from the standard's worked examples (mask lesson).
6. **Retailer page access** — dm.de / rossmann.de / douglas.de returned empty/403 to web fetch in the market-research agent. Nick: "another agent will take this over" — investigate options (built-in browser pane, Claude in Chrome with Nick's session, the dm MCP noted in [[project-price-audit-lane]] (no prices, but maybe product/INCI data), Rossmann bot wall also noted there). Needed for German-pack INCI capture (C1/C3 sources).
7. **Code/doc mismatch (flag, not engine scope)** — `categories/oil.ts` uses ONE target weight ±1 step; `decision.md` L397-413 has two-value ideal sets (normal: light+medium). Matching policy, product truth ≠ user fit — surface to Nick separately.

## Next steps (in order)

1. Worktree `oil-inci`, branch `codex/oil-inci`; branch-gate.
2. Write charter `docs/research/oil-inci/v1.0/00_category_charter.md` (template: `docs/research/category-classification-engine-template.md`, 12 sections) + property set `01_property-set-v0.md` from the rulings above; decision record `plans/oil-inci/phase1-decision-coverage.md`. Pull open decisions 1–5 into the charter interview.
3. Science pass (hair-care-expert agent, explicit model) on: penetration evidence per oil, weight anchors per base, build-up by silicone type, scalp-active botanical irritation evidence. Guard: no untraceable percentages.
4. Evidence lexicon v0.1 (oil families, silicone volatility, isoalkanes/esters, allergens, botanicals) + cohort proposal → Nick checkpoint.
5. Standard v0.1 → blind packets → two sealed lanes + reference key → rounds until zero disagreement → freeze v1.0 (lock receipt, artifact manifest, CI pin test) → Research Lab (copy `/labs/leave-in-research`) → production adapter + intake bridge (copy leave-in: `src/lib/leave-in-research/production-adapter.ts`, `src/lib/product-intake/leave-in-research-adapter.ts`, prompt contract) → optional gated apply.

## Exploration facts (main 960c064b, 2026-09-29)

- **52 active oils** (53 rows, 1 discontinued): 40 leave-on/finish, 12 pre-wash-only pure oils. Source: `plans/kevin-murphy-oil-migration/oil-thickness-comparison.md` (on main via #627).
- **`product_oil_specs`**: `weight` (light|medium|rich), `role_support` text[] ⊆ {pre_wash_fibre_treatment, leave_on_fibre_conditioning, dry_finish}, `provides_heat_protection` bool, `category_key`='oil'. Nothing else. Created `20260808065528`, extended `20260811213000`, heat simplified `20260903083832`.
- **`product_oil_eligibility`** (legacy): thickness × `oil_subtype` (natuerliches-oel|styling-oel|trocken-oel), `oil_purpose` (pre_wash_oiling|styling_finish|light_finish), `ingredient_flags` ⊆ {silicones,polymers,oils,proteins,humectants} — flags written, **read by nothing**.
- **Thickness stored 3×**: legacy eligibility table (Personal Plan gate reads this — `catalog-facts.ts` ~L1237), `product_thickness_eligibility`, `products.suitable_thicknesses` (UI dimension reads this).
- **Two recommenders**: Personal Plan (`src/lib/personal-plan/products/authority/categories/oil.ts`, reads role/weight/heat/thickness) vs legacy chat/routine (`selectOilProductsWithEngine`, `src/lib/recommendation-engine/selection.ts:2256`, reads subtype/purpose/thickness only).
- **Intake**: `category-validators.ts` `oilSpecsSchema` ~L611; worker `oilApprovalContract()` in `scripts/product-intake/codex-research-worker.ts` ~L1737. **No oil research adapter exists.** `src/lib/oil/` = constants.ts + purpose.ts only.
- decision.md documents `formulaFamily` (pure_oil|oil_blend|oil_serum) and `functionalBenefits` — never built.
- Protocol templates TPL-OIL-DRYFINISH/LEAVEON/PREWASH in `docs/product-application-protocol-templates.md`; spray dosing rule X6 parked.
- **Engines** (for copying): leave-in = full reference (standard v1.0 frozen + v1.1 T20 overlay, Lab, adapter, intake bridge, executors); conditioner v1.6; shampoo Production Light v1; mask in worktree `mask-inci` (draft v0.3, unmerged). No shared engine code — per-engine copies. Confidence enum inconsistency (leave-in prose has `moderately_high`, envelopes use low/moderate/high). `docs/research/README.md` leave-in row stale (says v1.0; is v1.1).

## Market research summary (sonnet agent, ~38 products, 2026-09-30)

Directions (overlapping counts): shine ~28, anti-frizz ~14, repair/bond/split-ends ~14, heat ~13, natural/vegan/silicone-free ~11, pre-wash/overnight ~10, weightless/fine ~7, scalp/growth 6, porosity/hair-type variants 5 brands, colour/UV ~6, curl 3, blonde/toning 3, multi-use 3, scent ~3. Verdict: no gap justifying main-strength/repair/direction. Notable INCI: Olaplex No.7 = dimethicone/isohexadecane/isoparaffin; K18 oil = esters/squalane/avocado/C13-15 alkane; Living Proof Vanishing Oil = isoalkane, silicone-free; Neqi/Mielle rosemary oils contain menthol/camphor/peppermint. Caveat: German retailer pages blocked → drugstore data from search snippets; not a shelf census.

## Environment notes

- Supabase MCP (`execute_sql`) was **rejected in this session** ("connector can't be used with the current credential") — live DB not read; counts come from the 2026-09-29 comparison file. Re-check access before relying on live state.
- Pending dependencies: KM Young Again migration `20260929120000` prepared/unapplied (PR #627 merged); expansion protocol repair draft PR #629 (see [[project-expansion-protocol-binding-repair]]).
- Nick's working style for this program: rulings as an interview, ONE decision per message, plain language, real product examples, recommendation first; he answers by voice-dictated paste. Subagents always get an explicit model ([[feedback-fable-orchestrates-research-on-cheaper]]).
