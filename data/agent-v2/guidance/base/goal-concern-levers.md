# Goal And Concern Levers

## Purpose
Use this package when the user asks from a goal or problem: mehr Glanz, mehr Volumen, Frizz, Trockenheit, Haarbruch, Spliss, Kopfhaut, Schuppen, Haarausfall, or a routine/product question driven by saved onboarding goals and concerns.

This package is a lever map. It tells the agent which practical level usually comes first, which levels are conditional, and which answers are weak first moves. Product truth stays in tools/catalog. Concrete routine changes stay in `build_or_fix_routine`. Medical-adjacent safety stays in `base.safety_boundaries.v1`.

## Global Rules
- Start with the lowest-risk lever that matches the profile: placement, amount, cadence, technique, conditioning, leave-in, reset, styling, or safety boundary.
- Separate scalp/roots from lengths/ends when that changes the answer.
- Separate `hair_texture` from `thickness`: texture is pattern, thickness is strand diameter.
- For fine, low-density, oily-root, volume-seeking, or coated hair, avoid heavy masks, oils, rich creams, and OWC as the first move.
- For curly/coily, thick/coarse, high-density, long, chemically treated, heat-styled, or very dry lengths, more Gleitfähigkeit/Entwirr-Hilfe, sectioning, leave-in, richer conditioning, and friction reduction can move earlier.
- Use missing-data questions only when they change the first lever or safety boundary.
- Do not turn weak evidence into a hard rule. Say `meist`, `oft`, `eher`, `wenn`, or `als erster Schritt` when the evidence is profile-dependent.
- Treat bond/protein/repair support as conditional structural-damage support only. It can be mentioned when bleach, chemical service, repeated high heat, strong breakage, brittle lengths, or mushy/gummy/over-elastic wet feel make structural damage plausible. It is not the default answer for healthy hair, ordinary shine/frizz/softness/dryness, shedding, hair loss, scalp concerns, or vague `repair` wording. Use category Bondbuilder guidance for concrete bond-repair relevance, product, lane, or protocol answers.

## Goal: Mehr Volumen / `volume`
### User Meaning
More visible body, especially at the roots; sometimes the user means true thinning, which is a different lane.
### Primary Levers
Clean scalp/roots, conditioner only in lengths/ends, lightweight leave-in if needed, small amounts, fully dried roots, and styling hold/root lift.
### Secondary Or Conditional Levers
Mousse, spray, dry shampoo as short-term oil absorber, haircut/layers, or drying technique when the user wants styling help.
### Weak First Levers
Heavy masks, oils, rich creams, scalp oils, OWC, supplements, or growth/thickening claims.
### Profile Modifiers
Fine or low-density hair needs the lightest smoothing possible. Oily scalp points to wash cadence/root cleansing. Long hair can hang flatter.
### Common Conflicts
Frizz, shine, moisture, and less volume may need smoothing that can reduce lift.
### Missing Data
Ask roots vs lengths, oily/coated roots, and whether the user means volume or thinning.
### Safety / Scope Boundary
If the issue is visible thinning, widening part, sudden loss, or density loss, use the hair-loss/thinning safety lane.
### German Answer Shape
`Für Volumen ist bei dir zuerst wichtig: Ansatz sauber halten, Pflege leicht und nur in die Längen, Styling eher über Trocknen/Halt statt über schwere Pflege.`
### Do Not
Do not imply products increase real density.

## Goal: Gesünderes Haar / `healthier_hair`
### User Meaning
Healthier-looking lengths, less damage, less roughness, less snapping.
### Primary Levers
Reduce new damage first: less heat, fewer chemical overlaps, less friction/tension, conditioner, leave-in/detangler, gentle handling.
### Secondary Or Conditional Levers
Trim damaged ends; heat protectant; possible bond/protein support only when chemical/heat damage signals exist.
### Weak First Levers
Oils/masks while the active damage source continues; claims that products heal dead lengths.
### Profile Modifiers
Bleach, high heat, curls/coils, long hair, tight styles, and rough brushing increase prevention priority.
### Common Conflicts
High-lift color, frequent heat styling, and length retention at all costs.
### Missing Data
Ask about bleach/color, heat, breakage pattern, and whether ends are split only if it changes the first lever.
### Safety / Scope Boundary
Hair shaft can look and feel better, but old structural damage does not biologically heal like skin.
### German Answer Shape
`Gesünder heißt hier vor allem: weniger neue Schäden, mehr Schutz beim Entwirren und realistische Pflege für die Längen.`
### Do Not
Do not promise full repair of severe damage.

## Goal: Weniger Frizz / `less_frizz`
### User Meaning
Less halo, puff, static, humidity reaction, or disrupted wave/curl shape.
### Primary Levers
Conditioner/leave-in, less towel rubbing, gentler detangling, wet/damp curl handling, and product weight matched to profile.
### Secondary Or Conditional Levers
Anti-humidity hold/film, reset if coated/heavy, richer care for thick/coarse/curly/coily/bleached/dry lengths.
### Weak First Levers
Default oiling, heavy masks, OWC, protein/bond repair without damage signals, or dry brushing curls smooth.
### Profile Modifiers
Fine/volume-seeking hair needs light smoothing. Curls need definition/hold. Damage raises conditioning/protection need.
### Common Conflicts
Volume, curl definition, oily scalp, and color protection.
### Missing Data
Ask whether frizz feels dry/rough, happens in humidity, follows brushing/towel rubbing, or coexists with coated heaviness.
### Safety / Scope Boundary
If the user describes snapping, shedding, scalp symptoms, or sudden loss, switch lanes.
### German Answer Shape
`Bei Frizz würde ich zuerst unterscheiden: trocken/rau, mechanisch aufgeraut, Wetter/Feuchtigkeit, Lockenmuster oder Produktbelag.`
### Do Not
Do not make oil the universal frizz answer.

## Goal: Farbschutz / `color_protection`
### User Meaning
Slower fading, less dullness, and less color-related roughness.
### Primary Levers
Avoid unnecessary washing, cleanse gently, protect from UV/sun and high heat, and reduce harsh/alkaline or clarifying overuse.
### Secondary Or Conditional Levers
Color-suitable shampoo, heat protectant, bond/repair support for bleach damage, reset only when buildup is clearly dulling the hair.
### Weak First Levers
One magic color shampoo, frequent clarifying, cold-water absolutes, or broad sulfate-free guarantees.
### Profile Modifiers
Semi-permanent color is wash-sensitive. Bleached/lightened hair is porosity/damage-sensitive. Oily scalp may still need enough cleansing.
### Common Conflicts
Oily scalp, dandruff, buildup reset, and volume.
### Missing Data
Ask dye type, bleach/lightening, wash frequency, heat, and whether dullness feels coated only if needed.
### Safety / Scope Boundary
Allergic reaction, scalp injury, sores, swelling, or severe breakage after color needs professional/medical support.
### German Answer Shape
`Farbschutz kommt weniger von einem einzelnen Produkt und mehr von: seltener unnötig waschen, sanft reinigen, Hitze/UV reduzieren und nicht zu oft klären.`
### Do Not
Do not imply fading can be fully prevented.

## Goal: Mehr Feuchtigkeit / `moisture`
### User Meaning
Usually softness, Gleitfähigkeit, less roughness, less brittle feel, and easier detangling.
### Primary Levers
Conditioner, leave-in if needed, scalp-focused gentle shampooing, less towel/heat friction, and correct placement.
### Secondary Or Conditional Levers
Masks/richer care for thick, coarse, curly/coily, long, bleached, damaged, or repeatedly dry lengths. Oils as seal/lubricant, not universal hydration.
### Weak First Levers
Heavy masks/oils for fine, oily-root, flat, or coated hair; literal water-loading language.
### Profile Modifiers
Fine hair needs small amounts and light textures. Curls/coils and damaged lengths often need more Gleitfähigkeit and sectioning.
### Common Conflicts
Volume, oily scalp, buildup, color protection.
### Missing Data
Ask dry lengths vs dry scalp, rough vs coated feel, and current conditioner/leave-in.
### Safety / Scope Boundary
Persistent scalp itch, burning, redness, flakes, or sores is not just length dryness.
### German Answer Shape
`Mit Feuchtigkeit meine ich hier eher Geschmeidigkeit: Conditioner, kleines Leave-in und sanfteres Waschen/Entwirren, nicht einfach immer schwerere Pflege.`
### Do Not
Do not say hair hydrates like living skin.

## Goal: Gesunde Kopfhaut / `healthy_scalp`
### User Meaning
Comfortable, balanced scalp without excess oil, flakes, itching, or irritation.
### Primary Levers
Match wash cadence to oil/dirt, shampoo the scalp, condition lengths only, avoid harsh scrubbing and root-heavy products.
### Secondary Or Conditional Levers
Mild flakes: scalp-focused anti-dandruff shampoo category used according to label; reduce irritating actives.
### Weak First Levers
Scalp oils, scrubs, detoxes, many actives, or heavy leave-ins at roots.
### Profile Modifiers
Oily scalp needs enough cleansing. Curly/dry hair needs length protection. Sensitive scalp needs minimal irritation.
### Common Conflicts
Color protection, dry lengths, volume, dandruff.
### Missing Data
Ask duration, severity, pain/burning/redness, flakes, sudden shedding only if safety boundary is unclear.
### Safety / Scope Boundary
Pain, burning, redness, swelling, sores, pus, persistent flakes, sudden shedding, patchy loss, or visible thinning needs medical evaluation.
### German Answer Shape
`Für eine gesunde Kopfhaut ist zuerst die Balance wichtig: genug Reinigung am Ansatz, aber keine aggressive Kopfhaut-Routine.`
### Do Not
Do not diagnose scalp disease.

## Goal: Mehr Glanz / `shine`
### User Meaning
More reflective, smoother-looking hair.
### Primary Levers
Smooth the surface with conditioner, light leave-in/finish, reduced friction, and gentle cleansing.
### Secondary Or Conditional Levers
Reset if dullness is coated/waxy/heavy; styling alignment or light serum for finish.
### Weak First Levers
Heavy oil/mask for everyone; repair-to-virgin-hair claims.
### Profile Modifiers
Fine/volume-seeking hair needs very light finish. Damage, color, heat, and buildup can reduce shine for different reasons.
### Common Conflicts
Volume, oily scalp, buildup, color protection.
### Missing Data
Ask whether hair feels dry/rough or coated/heavy.
### Safety / Scope Boundary
Products smooth, coat, and protect; they do not fully reverse severe cuticle damage.
### German Answer Shape
`Glanz kommt meist über eine glattere Oberfläche: passende Spülung, kleines Leave-in oder Finish, und weniger Reibung.`
### Do Not
Do not make shine equal to lots of Pflege.

## Goal: Locken-Definition / `curl_definition`
### User Meaning
Better clumping, shape, hold, and less disrupted curl/wave pattern.
### Primary Levers
Gleitfähigkeit/conditioning, product on wet/damp hair, even sectioning, appropriate hold, minimal touching while drying.
### Secondary Or Conditional Levers
Clarify if buildup suppresses curl; diffuse/air-dry with low friction; adjust hold vs moisture.
### Weak First Levers
Dry brushing, heavy oils/butters for fine waves, strong clarifying by default.
### Profile Modifiers
Fine waves need light hold. Curly/coily/thick/high-density hair may need more Gleitfähigkeit, sectioning, and hold.
### Common Conflicts
Volume, moisture overload, low maintenance, frizz.
### Missing Data
Ask wave/curl pattern, thickness, current styling product, dry brushing, and buildup signs.
### Safety / Scope Boundary
Do not treat natural curl pattern as damage.
### German Answer Shape
`Definition entsteht meistens aus Gleitfähigkeit + Technik + Halt: nass/feucht einarbeiten, nicht trocken ausbürsten, dann möglichst wenig stören.`
### Do Not
Do not make "more moisture" the only curl-definition answer.

## Goal: Weniger Spliss / `less_split_ends`
### User Meaning
Fewer split/frayed ends and less recurrence.
### Primary Levers
Trim/dust existing splits, reduce heat/chemical/friction stress, condition and detangle gently.
### Secondary Or Conditional Levers
Temporary smoothing/sealing for appearance; end-focused leave-in.
### Weak First Levers
Permanent split-end repair claims; only adding oil.
### Profile Modifiers
Long, bleached, heat-styled, tangled, or rough ends move trimming/prevention earlier.
### Common Conflicts
Length retention and avoiding haircuts.
### Missing Data
Ask whether ends are visibly forked/white-dotted/rough even after conditioner.
### Safety / Scope Boundary
Existing split ends are only truly removed by cutting.
### German Answer Shape
`Wenn die Spitzen wirklich gespalten sind, kann Pflege sie optisch glätten, aber nicht dauerhaft reparieren; Schneiden entfernt Spliss.`
### Do Not
Do not tell the user a product permanently fuses split ends.

## Goal: Weniger Volumen / `less_volume`
### User Meaning
Less puffiness, bulk, or uncontrolled shape.
### Primary Levers
Conditioning/smoothing, leave-in, controlled drying, and less curl disruption.
### Secondary Or Conditional Levers
Anti-humidity hold, smoothing styling, richer care for coarse/curly/high-density hair; professional chemical smoothing only as a risk-aware route.
### Weak First Levers
Aggressive heat, scalp oils, casual relaxer/keratin advice.
### Profile Modifiers
Coarse/curly/high-density hair may tolerate richer smoothing. Fine/oily roots need off-root placement.
### Common Conflicts
Volume, healthy scalp, curl definition.
### Missing Data
Ask whether the issue is puff/frizz, density, root volume, or curl pattern.
### Safety / Scope Boundary
Chemical services change structure and can damage or irritate; they are not a casual first step.
### German Answer Shape
`Für weniger Volumen würde ich zuerst Puff/Frizz beruhigen: mehr Glätte in den Längen, kontrollierter trocknen, aber nichts Schweres an den Ansatz.`
### Do Not
Do not recommend chemical smoothing as default.

## Goal: Haare stärken / `strengthen`
### User Meaning
Less snapping and better resistance during brushing/styling.
### Primary Levers
Reduce the weakening source, improve Gleitfähigkeit/Entwirr-Hilfe, condition, detangle gently, and lower heat/chemical stress.
### Secondary Or Conditional Levers
Possible bond/protein/repair support when bleach, chemical service, high heat, strong breakage, brittle lengths, or mushy/gummy wet feel suggests structural damage.
### Weak First Levers
Follicle/growth claims, all breakage equals missing protein, product-only fix.
### Profile Modifiers
Bleach, heat, tight styles, curls/coils, long hair, and rough brushing raise priority.
### Common Conflicts
Frequent color/lightening, heat smoothing, length retention.
### Missing Data
Ask snapped short pieces vs shedding, bleach/heat/chemical history, and wet mushy/gummy feel if relevant.
### Safety / Scope Boundary
Topical care supports the hair fiber; it does not make living follicles stronger.
### German Answer Shape
`Stärken heißt hier vor allem: weniger Brechen beim Bürsten/Stylen, nicht schneller wachsen oder die Haarwurzel verändern.`
### Do Not
Do not promise structural reversal.

## Goal: Anti-Haarbruch / `anti_breakage`
### User Meaning
Fewer short snapped pieces and less breakage during handling.
### Primary Levers
Distinguish breakage from shedding, add Gleitfähigkeit/Entwirr-Hilfe, section hair, use low tension, lower heat/chemical stress.
### Secondary Or Conditional Levers
Trim worst ends, possible bond/protein support for chemical/heat damage signals, night friction support when relevant.
### Weak First Levers
Treating shedding as breakage; adding a product while rough handling/heat/bleach continues.
### Profile Modifiers
Curls/coils, long hair, bleach, heat, tight styles, towel rubbing, and rough brushing.
### Common Conflicts
High heat styling, tight styles, length retention.
### Missing Data
Ask if hairs are short snapped pieces or full-length hairs with root bulbs.
### Safety / Scope Boundary
Full-length shedding, thinning, patchy loss, or sudden heavy hair fall needs medical-adjacent guidance.
### German Answer Shape
`Wenn es kurze abgebrochene Stücke sind, geht es um Haarbruch: bessere Kämmbarkeit, weniger Zug, weniger Hitze/Chemie und sanfter entwirren.`
### Do Not
Do not call true shedding Haarbruch.

## Concern: Haarausfall / `hair_loss`
### First Split
Hair loss is medical-adjacent before it is a product/routine problem.
### Likely Levers
Empathetic boundary; recommend GP/dermatologist for visible thinning, widening part, clumps, sudden, severe, patchy, persistent, or symptomatic loss.
### Secondary Or Conditional Levers
Gentle handling, less traction, and visual fullness only as support after the boundary.
### Weak First Levers
Anti-hair-loss shampoo, growth serum, supplements, scalp oil, or exfoliant as primary fix.
### Profile Modifiers
Postpartum, illness, stress, medications, hormones, scalp pain/itch/redness/flakes, visible thinning, clumps, and patchy loss raise medical priority.
### Common Conflicts
Product recommendations and volume goals.
### Missing Data
Ask duration, sudden vs gradual, patchy vs diffuse, pain/burning/redness, recent illness/postpartum/medication only if needed.
### Safety / Scope Boundary
Do not product-shop first when the user describes visible thinning, widening part, clumps, sudden/persistent shedding, patchy loss, distressing loss, scalp symptoms, postpartum/illness/medication context, or possible follicle-driven loss. No shampoo should be framed as regrowth treatment.
### German Answer Shape
`Bei Haarausfall würde ich nicht zuerst ein Produkt wechseln. Das sollte, besonders wenn es plötzlich, stark oder mit Kopfhaut-Symptomen ist, ärztlich/dermatologisch abgeklärt werden.`
### Do Not
Do not recommend regrowth products unless a separate medically safe path exists.

## Concern: Schuppen / `dandruff`
### First Split
Mild flakes without red flags vs persistent, severe, inflamed, painful, or hair-loss-associated scalp symptoms.
### Likely Levers
Mild: scalp-focused wash and anti-dandruff shampoo category used according to label.
### Secondary Or Conditional Levers
Protect lengths during scalp-focused washing, especially for curls, color, bleach, relaxing, or dry lengths. Adjust cadence to hair texture/color/dryness; dermatologist if persistent, severe, or not improving with correct use.
### Weak First Levers
Scalp oils, scrubs, detoxes, actives stacking, or diagnosis from chat.
### Profile Modifiers
Curly, color-treated, bleached, relaxed, or dry hair may need careful length protection with medicated shampoos.
### Common Conflicts
Dryness, color protection, sensitive scalp.
### Missing Data
Ask severity, duration, redness/pain/swelling/sores, and hair loss if boundary is unclear.
### Safety / Scope Boundary
Persistent/severe flakes, redness, swelling, pain, sores, weeping areas, pus, hair loss, or symptoms that do not improve with correct use need dermatologist input.
### German Answer Shape
`Bei milden Schuppen kann ein Anti-Schuppen-Shampoo sinnvoll sein: auf die Kopfhaut, nach Anleitung, Längen schützen. Wenn es stark ist, nicht besser wird, schmerzt, entzündet wirkt oder Haarausfall dazukommt, bitte dermatologisch abklären.`
### Do Not
Do not diagnose seborrhoic dermatitis, psoriasis, eczema, fungus, or allergy.

## Concern: Trockenheit / `dryness`
### First Split
Dry scalp vs dry lengths vs coated/buildup feel.
### Likely Levers
Conditioner, leave-in, gentle scalp-focused cleansing, less towel rubbing and heat.
### Secondary Or Conditional Levers
Mask/richer care for thick/curly/coarse/bleached/long hair; reset if coated/heavy.
### Weak First Levers
Heavy oil/mask for fine/oily/flat hair; assuming dryness always means too little water.
### Profile Modifiers
Fine hair needs light dosing. Curly/coily/damaged hair often needs more Gleitfähigkeit and richer conditioning.
### Common Conflicts
Volume, oily scalp, buildup.
### Missing Data
Ask scalp vs lengths and rough/dry vs coated/heavy.
### Safety / Scope Boundary
Scalp itch, burning, redness, flakes, sores, or sudden shedding leaves the simple dryness lane.
### German Answer Shape
`Trockenheit heißt zuerst: Ist die Kopfhaut trocken oder sind die Längen rau? Für die Längen helfen meist Conditioner, kleines Leave-in und weniger Reibung.`
### Do Not
Do not overload fine hair by default.

## Concern: Fettige Kopfhaut / `oily_scalp`
### First Split
Root/scalp oil vs coated lengths.
### Likely Levers
Wash cadence that matches oiliness, shampoo on scalp, conditioner/leave-in away from roots.
### Secondary Or Conditional Levers
Anti-dandruff category if oily flakes/itch coexist; dry shampoo only short term and not as a replacement for wet scalp cleansing.
### Weak First Levers
Scalp training as evidence-based, oils at roots, repeated dry-shampoo layering, or dry shampoo replacing washing.
### Profile Modifiers
Fine/straight hair often shows oil faster; curly/dry lengths still need protection.
### Common Conflicts
Color protection, dry lengths, volume.
### Missing Data
Ask how fast roots get oily, flakes/itch, and whether lengths are dry.
### Safety / Scope Boundary
Pain, inflammation, persistent itch/flakes, sores, or hair loss need safety boundary.
### German Answer Shape
`Bei fettiger Kopfhaut ist der Ansatz die Baustelle: genug reinigen, Shampoo auf die Kopfhaut, Pflege nicht an den Ansatz.`
### Do Not
Do not tell users to wash less to train oil production.

## Concern: Haarschäden / `hair_damage`
### First Split
Cosmetic shaft damage vs scalp/hair-loss issue.
### Likely Levers
Stop active damage source, condition, leave-in/detangle, lower heat and chemical stress.
### Secondary Or Conditional Levers
Trim ends; possible bond/protein support only with chemical/heat damage signals.
### Weak First Levers
Supplements, oils/masks while heat/bleach/tension continues.
### Profile Modifiers
Bleach, permanent color, heat, curls/coils, long hair, and rough brushing increase risk.
### Common Conflicts
Color changes, heat styling, length retention.
### Missing Data
Ask chemical/heat history, roughness, snapping, split ends, and tangling only if needed.
### Safety / Scope Boundary
Severe breakage with shedding, scalp symptoms, or sudden loss needs boundary/professional care.
### German Answer Shape
`Bei Haarschäden kommt zuerst: Was verursacht neue Schäden? Danach Pflege zum Glätten, Entwirren und Schützen.`
### Do Not
Do not present masks/oils as structural repair.

## Concern: Spliss / `split_ends`
### First Split
Existing split ends vs prevention of new split ends.
### Likely Levers
Trim/dust visible splits, reduce friction/heat/chemical stress, condition and detangle gently.
### Secondary Or Conditional Levers
Temporary smoothing/sealing for appearance.
### Weak First Levers
Permanent repair claims or only adding oil.
### Profile Modifiers
Long, bleached, heat-styled, tangly hair.
### Common Conflicts
Keeping every centimeter of length.
### Missing Data
Ask whether ends are visibly split, white-dotted, rough, or catching.
### Safety / Scope Boundary
Existing splits are removed by cutting.
### German Answer Shape
`Spliss kann Pflege optisch ruhiger machen, aber wenn das Haar gespalten ist, entfernt nur Schneiden den Spliss wirklich.`
### Do Not
Do not imply a product permanently repairs splits.

## Concern: Haarbruch / `breakage`
### First Split
Short snapped pieces vs full-length shedding/hair loss.
### Likely Levers
Gleitfähigkeit/Entwirr-Hilfe, sectioning, low tension, lower heat/chemical stress, trim worst ends.
### Secondary Or Conditional Levers
Possible bond/protein support for chemical/heat damage; night friction support when relevant.
### Weak First Levers
Treating shedding as breakage or adding products without changing handling.
### Profile Modifiers
Curls/coils, long hair, bleach, heat, tight styles, rough towel/brush.
### Common Conflicts
High heat, tight styles, length retention.
### Missing Data
Ask whether hairs are short broken pieces or full-length shed hairs.
### Safety / Scope Boundary
Shedding, thinning, patches, sudden hair fall, or scalp symptoms need the safety lane.
### German Answer Shape
`Haarbruch sind eher kurze abgebrochene Stücke. Dann hilft zuerst weniger Zug und Reibung plus genug Gleitfähigkeit beim Entwirren.`
### Do Not
Do not confuse Haarbruch with Haarausfall.

## Concern: Frizz / `frizz`
### First Split
Humidity, dryness/roughness, mechanical disturbance, curl pattern, damage, or product mismatch.
### Likely Levers
Conditioner/leave-in, less friction, wet/damp curl handling, product weight matched to profile.
### Secondary Or Conditional Levers
Hold/anti-humidity styling, reset if coated, richer care for supported profiles.
### Weak First Levers
Default oil/mask/protein/OWC or dry brushing curls.
### Profile Modifiers
Fine/volume hair needs light smoothing; curls need definition/hold; damage needs protection.
### Common Conflicts
Volume and curl definition.
### Missing Data
Ask dry/rough vs coated/heavy, humidity trigger, brushing/towel routine, and texture.
### Safety / Scope Boundary
If the issue is snapped hairs or shedding, switch to breakage/hair-loss boundary.
### German Answer Shape
`Frizz löst man nicht immer mit mehr Pflege. Erst schauen: Reibung, Trockenheit, Wetter, Lockenmuster oder Belag?`
### Do Not
Do not default to heavy oil.

## Concern: Verknotungen / `tangling`
### First Split
Gleitfähigkeit/technique problem vs damage/split-end problem.
### Likely Levers
Conditioner, leave-in/detangler, damp detangling, sections, ends-up wide-tooth/finger combing.
### Secondary Or Conditional Levers
Trim catching ends, reduce towel/sleep friction, reset if coated.
### Weak First Levers
Brush harder/more; repair treatment before Gleitfähigkeit and technique.
### Profile Modifiers
Curly/coily, long, high-density, damaged hair needs more Gleitfähigkeit and sectioning.
### Common Conflicts
Speed/low maintenance and volume.
### Missing Data
Ask when tangles happen, wet vs dry brushing, length, damage/split ends, and product residue.
### Safety / Scope Boundary
Painful resistance, severe breakage, shedding, thinning, patchy loss, or scalp symptoms need the safety boundary.
### German Answer Shape
`Bei Knoten ist der erste Hebel Gleitfähigkeit und Technik: genug Conditioner/Leave-in, in Sektionen, unten anfangen und ohne Ziehen hocharbeiten.`
### Do Not
Do not tell the user to force through knots.

## Concern: Dünner werdendes Haar / `thinning`
### First Split
Density/part/crown/recession concern before cosmetic volume concern.
### Likely Levers
Medical boundary for sudden, patchy, painful, itchy, scaly, or distressing thinning.
### Secondary Or Conditional Levers
Lightweight cleansing, visual volume styling, avoid traction and heavy root products after boundary.
### Weak First Levers
Thickening shampoo as treatment, growth promises, supplements.
### Profile Modifiers
Age, hormones, medications, postpartum, stress, scalp symptoms raise medical priority.
### Common Conflicts
Product recommendation and volume goals.
### Missing Data
Ask sudden vs gradual, patchy vs diffuse, scalp symptoms, duration, and recent triggers only if it changes the boundary.
### Safety / Scope Boundary
Diagnosis-dependent; do not claim a routine can stop thinning or regrow hair.
### German Answer Shape
`Wenn das Haar wirklich dünner wird, ist das mehr als ein Volumen-Thema. Das sollte je nach Verlauf ärztlich/dermatologisch abgeklärt werden.`
### Do Not
Do not sell cosmetic volume as treatment.

## Missing Required Data
Ask one material question only if the first lever or safety boundary changes. Prefer answering with a sensible default and offering a focused follow-up.

## German Answer Shape
1. Name the likely lane: Ansatz, Längen, Technik, Styling, Aufbau/Belag, Schaden, oder Sicherheit.
2. Give the first practical lever.
3. Add one profile modifier.
4. Mention the weak first move only when it prevents a likely mistake.
5. Offer product or routine help only if tool-grounded and relevant.

## Do Not
- Do not recommend concrete products without `select_products`.
- Do not return a changed routine without `build_or_fix_routine`.
- Do not diagnose medical conditions.
- Do not claim products regrow hair, stop thinning, cure dandruff, or permanently repair split ends.
- Do not over-promote heavy techniques for fine, flat, oily-root, or volume-seeking profiles.
