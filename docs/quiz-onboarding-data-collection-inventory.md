# Quiz And Onboarding Data Collection Inventory

Checked against the current UI code plus the live Supabase schema on March 23, 2026.

Scope notes:
- Quiz lead-capture fields (`name`, `email`, `marketingConsent`) are excluded.
- For `hair_profiles`, scalar columns are generally nullable and array columns can be `[]`; the tables below focus on the values this current flow writes.

## A. Quiz Flow

| Question | Options shown to user | Storage in DB | Possible stored values |
|---|---|---|---|
| `WAS IST DEINE NATUERLICHE HAARTEXTUR?` | `Glatt` (`straight`), `Wellig` (`wavy`), `Lockig` (`curly`), `Kraus` (`coily`) | Raw: `public.leads.quiz_answers` key `structure`<br>Final: `public.hair_profiles.hair_texture` | Raw: `straight`, `wavy`, `curly`, `coily`<br>Final: `straight`, `wavy`, `curly`, `coily` |
| `WIE DICK SIND DEINE EINZELNEN HAARE?` | `Fein` (`fine`), `Mittel` (`normal`), `Dick` (`coarse`) | Raw: `public.leads.quiz_answers` key `thickness`<br>Final: `public.hair_profiles.thickness` | Raw: `fine`, `normal`, `coarse`<br>Final: `fine`, `normal`, `coarse` |
| `DER OBERFLAECHENTEST` | `Glatt wie Glas` (`glatt`), `Leicht uneben` (`leicht_uneben`), `Richtig rau und huckelig` (`rau`) | Raw: `public.leads.quiz_answers` key `fingertest`<br>Final: `public.hair_profiles.cuticle_condition` | Raw: `glatt`, `leicht_uneben`, `rau`<br>Final from mapping: `smooth`, `slightly_rough`, `rough` |
| `DER ZUGTEST` | `Dehnt sich und geht zurueck` (`stretches_bounces`), `Dehnt sich, bleibt ausgeleiert` (`stretches_stays`), `Reisst sofort` (`snaps`) | Raw: `public.leads.quiz_answers` key `pulltest`<br>Final: `public.hair_profiles.protein_moisture_balance` | Raw: `stretches_bounces`, `stretches_stays`, `snaps`<br>Final: `stretches_bounces`, `stretches_stays`, `snaps` |
| `WIE IST DEIN KOPFHAUTTYP?` | `Fettig` (`fettig`), `Ausgeglichen` (`ausgeglichen`), `Trocken` (`trocken`) | Raw: `public.leads.quiz_answers` key `scalp_type`<br>Final: `public.hair_profiles.scalp_type` | Raw: `fettig`, `ausgeglichen`, `trocken`<br>Final from mapping: `oily`, `balanced`, `dry` |
| `HAST DU KOPFHAUTBESCHWERDEN?` | `NEIN`, `JA` | Raw: no standalone key; `NEIN` immediately writes `public.leads.quiz_answers` key `scalp_condition = "keine"`; `JA` only opens the follow-up question<br>Final: no standalone column; `NEIN` later maps to `public.hair_profiles.scalp_condition = "none"` | UI-only gate.<br>Stored effect: `NEIN` => raw `keine`, final `none`; `JA` has no final value until the next question is answered |
| `WELCHE BESCHWERDEN HAST DU?` | `Schuppen` (`schuppen`), `Trockene Schuppen` (`trockene_schuppen`), `Gereizte Kopfhaut` (`gereizt`) | Raw: `public.leads.quiz_answers` key `scalp_condition`<br>Final: `public.hair_profiles.scalp_condition` | Raw from this follow-up: `schuppen`, `trockene_schuppen`, `gereizt`<br>Final from mapping: `dandruff`, `dry_flakes`, `irritated` |
| `SIND DEINE HAARE CHEMISCH BEHANDELT?` | Multi-select: `Naturhaar` (`natur`), `Gefaerbt / Getoent` (`gefaerbt`), `Blondiert / Aufgehellt` (`blondiert`) | Raw: `public.leads.quiz_answers` key `treatment` (`jsonb` array)<br>Final: `public.hair_profiles.chemical_treatment` (`text[]`) | Raw members: `natur`, `gefaerbt`, `blondiert`; current flow allows `["natur"]`, `["gefaerbt"]`, `["blondiert"]`, `["gefaerbt","blondiert"]`<br>Final members after mapping: `natural`, `colored`, `bleached` with the same combo rule |

## B. Onboarding Flow

Current code path is `density -> mechanical stress -> routine -> goals`.

| Question | Options shown to user | Storage in DB | Possible stored values |
|---|---|---|---|
| `Wie dicht ist dein {adjective} Haar?` | `Wenig Haare` (`low`), `Mittlere Dichte` (`medium`), `Viele Haare` (`high`) | Raw: none; writes direct<br>Final: `public.hair_profiles.density` | `low`, `medium`, `high` |
| `Wie beanspruchst du dein Haar mechanisch?` | Multi-select: `Enge Frisuren (Zoepfe, Dutts, Extensions)` (`tight_hairstyles`), `Haeufiges oder grobes Buersten` (`rough_brushing`), `Handtuch-Rubbeln statt Tupfen` (`towel_rubbing`) | Raw: none; writes direct<br>Final: `public.hair_profiles.mechanical_stress_factors` (`text[]`) | `[]` or any subset of `tight_hairstyles`, `rough_brushing`, `towel_rubbing` |
| `Wie oft waeschst du deine Haare?` | `Täglich` (`daily`), `Alle 2-3 Tage` (`every_2_3_days`), `1x pro Woche` (`once_weekly`), `Seltener` (`rarely`) | Raw: none; writes direct<br>Final: `public.hair_profiles.wash_frequency` | Current flow writes `daily`, `every_2_3_days`, `once_weekly`, `rarely` |
| `Welche Produkte nutzt du aktuell?` | Multi-select: `Shampoo`, `Conditioner`, `Leave-in`, `Oel`, `Maske`, `Hitzeschutz`, `Serum`, `Scrub` | Raw: none; writes direct<br>Final: `public.hair_profiles.current_routine_products` (`text[]`) | `[]` or any subset of `shampoo`, `conditioner`, `leave_in`, `oil`, `mask`, `heat_protectant`, `serum`, `scrub` |
| `Wie oft nutzt du Hitzetools?` | `Täglich` (`daily`), `Mehrmals pro Woche` (`several_weekly`), `1x pro Woche` (`once_weekly`), `Selten` (`rarely`), `Nie` (`never`) | Raw: none; writes direct<br>Final: `public.hair_profiles.heat_styling` | Current flow writes `daily`, `several_weekly`, `once_weekly`, `rarely`, `never` |
| `Was machst du nach dem Waschen?` | Multi-select: `Lufttrocknen` (`air_dry`), `Nur Foehnen` (`blow_dry_only`), `Hitzetools (z.B. Glaetteisen)` (`heat_tool_styling`), `Styling ohne Hitze` (`non_heat_styling`) | Raw: none; writes direct<br>Final: `public.hair_profiles.post_wash_actions` (`text[]`) | `[]` or any subset of `air_dry`, `blow_dry_only`, `heat_tool_styling`, `non_heat_styling` |
| `Wie detailliert soll deine Routine sein?` | `Minimal` (`minimal`), `Ausgewogen` (`balanced`), `Detailliert` (`advanced`) | Raw: none; writes direct<br>Final: `public.hair_profiles.routine_preference` | `minimal`, `balanced`, `advanced` |
| `Wie viel Volumen willst du?` | `Weniger` (`less`), `Ausgewogen` (`balanced`), `Mehr` (`more`) | Raw: none; writes direct<br>Final: `public.hair_profiles.desired_volume` | `less`, `balanced`, `more` |
| `Was ist dir ausserdem wichtig?` | Texture-dependent multi-select.<br>`straight`: `Weniger schnell nachfetten` (`healthy_scalp`), `Anti-Frizz & Geschmeidigkeit` (`less_frizz`), `Mehr Glanz` (`shine`), `Weniger Spliss` (`less_split_ends`), `Mehr Volumen` (`volume`)<br>`wavy`: `Wellen-Definition` (`curl_definition`), `Leichte Feuchtigkeit` (`moisture`), `Mehr Glanz` (`shine`), `Weniger Frizz` (`less_frizz`), `Weniger Spliss` (`less_split_ends`)<br>`curly`: `Locken-Clumping` (`curl_definition`), `Intensive Feuchtigkeit` (`moisture`), `Mehr Glanz` (`shine`), `Weniger Spliss` (`less_split_ends`), `Weniger Frizz` (`less_frizz`)<br>`coily`: `Feuchtigkeit versiegeln` (`moisture`), `Kopfhaut beruhigen` (`healthy_scalp`), `Gesuenderes Haar` (`healthier_hair`), `Weniger Spliss` (`less_split_ends`) | Raw: none; writes direct<br>Final: `public.hair_profiles.goals` (`text[]`) | `[]` or any subset of the texture-specific keys above; additionally `volume` is auto-added whenever `desired_volume = 'more'` |

## Caveats

- Current code and the live DB were more reliable than the tests here. `tests/onboarding-goal-flow.test.ts` still expects a smaller straight-hair goal set than the current UI in `src/lib/vocabulary/onboarding-goals.ts`. `tests/quiz-onboarding-e2e.spec.ts` also reflects an older onboarding path.
- The live DB does not currently enforce all final scalar enums on `hair_profiles`. For `cuticle_condition`, `protein_moisture_balance`, `scalp_type`, `scalp_condition`, `wash_frequency`, `heat_styling`, `chemical_treatment`, and `goals`, the values above come from the current UI and mapping code, not from hard DB checks.
- Quiz answers have a two-step lifecycle: they are first captured in `public.leads.quiz_answers`, then mapped into `public.hair_profiles` by `src/lib/quiz/link-to-profile.ts`.
- Saving the final onboarding goals screen also flips `public.profiles.onboarding_completed = true`, but that flag is a side effect, not a user-selected property.
- The broader goal enum still includes values like `color_protection`, but the current onboarding UI does not collect that value.
