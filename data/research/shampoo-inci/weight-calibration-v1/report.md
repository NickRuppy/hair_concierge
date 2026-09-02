# Shampoo weight-potential calibration — same ten formulas

Research-only provisional output. No approved products or live data changed.

## Result

Independent label agreement: **10/10** (previously 9/10). Agreement with the deterministic evaluator: A **10/10**, B **10/10**. These are repeatability results, not measured accuracy.

Changed labels: 2/10. Label disagreements: 0; route-extraction differences: 0; window differences: 1. Frozen historical files verified: 193.

- Cutoff-check difference: alverde NATURKOSMETIK Shampoo Nutri Care. The original rater annotation is preserved; see the adjudication for the interpretation.
- Researcher ingredient caveat: GARNIER FRUCTIS Shampoo Kraft & Glanz. The evaluator's rule-confidence label does not override these researcher caveats.

[Adjudication and remaining limits](adjudication.md).

| Product | Previous first label | New rule | Raters A / B | Rule / product confidence |
| --- | --- | --- | --- | --- |
| Balea Professional Shampoo Oil Repair Intensiv | high | high | high / high | high / moderate |
| alverde NATURKOSMETIK Shampoo Nutri Care | moderate | moderate | moderate / moderate | high / moderate |
| ISANA PROFESSIONAL Plex Shampoo | high | moderate | moderate / moderate | high / moderate |
| Herbal Essences Shampoo Fiji | moderate | moderate | moderate / moderate | high / moderate |
| GARNIER FRUCTIS Shampoo Kraft & Glanz | moderate | moderate | moderate / moderate | high / moderate |
| Schwarzkopf GLISS Scalp Balance Sanftes Shampoo | moderate | moderate | moderate / moderate | high / moderate |
| NIVEA Shampoo Classic Care | high | high | high / high | high / moderate |
| NIVEA MEN Anti Schuppen Shampoo | moderate | moderate | moderate / moderate | high / moderate |
| GUHL Langzeit Volumen Kräftigendes Shampoo | moderate | moderate | moderate / moderate | high / moderate |
| Jean&Len Shampoo Repair Dattel & Vanille | high | moderate | moderate / moderate | high / low |

## Meaning and limits

High rule confidence means consistent application of this heuristic, not proven real-world weight. Product confidence remains moderate or low. Route thresholds and position windows are operational proxies.

- Shared source packet and model lineage; not independent source discovery or empirical accuracy.
- Same known ten-product cohort; paired calibration rather than a new holdout.
- No desired agreement or product-confidence target; preserve disagreement without tuning.
- INCI-only product confidence is capped at moderate; high rule confidence is not measured accuracy.
- No automatic approval, production data update, live fit change or empirical weight test.
- Original v2 labels used claims; new raters are formula-only. Comparison is not a controlled estimate of the rule effect.

All seven other properties, including cleansing strength, are unchanged. A cohort without low-weight or silicone examples cannot validate those boundaries; see the JSON route/distribution data.

## Product reasoning

### Balea Professional Shampoo Oil Repair Intensiv

Vorläufig high: cationic_polymer substantive (guar hydroxypropyltrimonium chloride); lipid_refatting substantive (argania spinosa kernel oil, orbignya oleifera seed oil, sclerocarya birrea seed oil); protein_film weak (hydrolyzed keratin); Regelkonfidenz high.

- Routes: cationic_polymer: substantive (guar hydroxypropyltrimonium chloride, #17); lipid_refatting: substantive (argania spinosa kernel oil, #5; orbignya oleifera seed oil, #6; sclerocarya birrea seed oil, #7); protein_film: weak (hydrolyzed keratin, #18).
- Windows 8/10/12: high / high / high.
- Formula identity: moderate; evaluator recognition gaps: none.
- Researcher caveats: none.
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Zwei substanzielle Routen sind vorhanden: kationisches Polymer und prominente Payload-Öle mit Polymerunterstützung. Das späte Keratin bleibt nur eine schwache Zusatzroute.
- Rater B: Zwei substantielle Routentypen: frühe Payload-Öle plus erkannter Guar-Quat; zusätzlich nur schwaches Keratin. Das Ergebnis bleibt über die Fenster 8/10/12 stabil.

### alverde NATURKOSMETIK Shampoo Nutri Care

Vorläufig moderate: lipid_refatting weak (ascorbyl palmitate, glyceryl oleate, hydrogenated palm glycerides citrate, lecithin); protein_film weak (hydrolyzed wheat protein); Regelkonfidenz high.

- Routes: lipid_refatting: weak (ascorbyl palmitate, #10; glyceryl oleate, #14; hydrogenated palm glycerides citrate, #17; lecithin, #18); protein_film: weak (hydrolyzed wheat protein, #8).
- Windows 8/10/12: moderate / moderate / moderate.
- Formula identity: moderate; evaluator recognition gaps: none.
- Researcher caveats: none.
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Bei Fenster 10 ergeben Protein und schwache Refatter zwei unterschiedliche schwache Routen, daher moderate. Bei Fenster 8 fällt der Refatter an Position 10 heraus, wodurch nur eine schwache Route bleibt.
- Rater B: Keine substantielle Route, aber zwei verschiedene schwache Routentypen: Protein und schwache Refatter. Deshalb moderate; Fensteränderungen verschieben keine Payload-Bedingung.

### ISANA PROFESSIONAL Plex Shampoo

Vorläufig moderate: cationic_polymer substantive (hydroxypropyl oxidized starch pg-trimonium chloride, hydroxypropyl guar hydroxypropyltrimonium chloride); lipid_refatting weak (ascorbyl palmitate, glyceryl oleate, hydrogenated palm glycerides citrate, lecithin); protein_film weak (oryza sativa seed protein, hydrolyzed wheat protein, hydrolyzed soy protein); Regelkonfidenz high.

- Routes: cationic_polymer: substantive (hydroxypropyl oxidized starch pg-trimonium chloride, #16; hydroxypropyl guar hydroxypropyltrimonium chloride, #17); lipid_refatting: weak (ascorbyl palmitate, #9; glyceryl oleate, #14; hydrogenated palm glycerides citrate, #23; lecithin, #24); protein_film: weak (oryza sativa seed protein, #6; hydrolyzed wheat protein, #18; hydrolyzed soy protein, #20).
- Windows 8/10/12: moderate / moderate / moderate.
- Formula identity: moderate; evaluator recognition gaps: none.
- Researcher caveats: none.
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Die kationische Polymerroute ist die einzige substanzielle Route. Protein und schwache Refatter ändern die Einstufung nicht auf high, weil keine zweite substanzielle Route vorliegt.
- Rater B: Genau eine substantielle Route durch erkannte kationische Polymere. Protein und Refatter bleiben schwach; mehrere Polymere zählen nicht als mehrere Routenvoten.

### Herbal Essences Shampoo Fiji

Vorläufig moderate: cationic_polymer substantive (polyquaternium-10); Regelkonfidenz high.

- Routes: cationic_polymer: substantive (polyquaternium-10, #11).
- Windows 8/10/12: moderate / moderate / moderate.
- Formula identity: moderate; evaluator recognition gaps: none.
- Researcher caveats: none.
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Genau eine substanzielle Route ist vorhanden: Polyquaternium-10. Weitere erkannte schwache Gewichtsroute ist nicht vorhanden.
- Rater B: Genau eine substantielle Route durch Polyquaternium-10; keine zweite substantive Route und weniger als zwei schwache Routentypen.

### GARNIER FRUCTIS Shampoo Kraft & Glanz

Vorläufig moderate: cationic_polymer substantive (guar hydroxypropyltrimonium chloride); lipid_refatting weak (octyldodecanol); protein_film weak (hydroxypropyltrimonium lemon protein); Regelkonfidenz high.

- Routes: cationic_polymer: substantive (guar hydroxypropyltrimonium chloride, #6); lipid_refatting: weak (octyldodecanol, #25); protein_film: weak (hydroxypropyltrimonium lemon protein, #10).
- Windows 8/10/12: moderate / moderate / moderate.
- Formula identity: moderate; evaluator recognition gaps: none.
- Researcher caveats: carbomer: Unlisted polymer; als möglicher Recognition-Gap sichtbar gehalten, aber nicht als bekannte Route gezählt.; carbomer: Unlistedes Polymer; keine anerkannte Route in dieser Policy, aber als Polymer/Filmhinweis reviewpflichtig statt still ausgeschlossen..
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Die Polymerroute macht die Formel moderate. Das kationische Protein ist nur Protein, nicht Polymer; Octyldodecanol liegt zu spät für eine substanzielle Lipidroute. Carbomer bleibt als unaufgelöster Polymer-Hinweis sichtbar.
- Rater B: Provisorisch moderate: eine substantielle kationische Polymerroute, dazu schwaches kationisches Protein und spätes Octyldodecanol. Carbomer bleibt als ungelöste potenziell gewichtrelevante Polymerlücke sichtbar.

### Schwarzkopf GLISS Scalp Balance Sanftes Shampoo

Vorläufig moderate: cationic_polymer substantive (hydroxypropyl guar hydroxypropyltrimonium chloride); lipid_refatting weak (glyceryl oleate, peg-7 glyceryl cocoate, hydrogenated castor oil); Regelkonfidenz high.

- Routes: cationic_polymer: substantive (hydroxypropyl guar hydroxypropyltrimonium chloride, #13); lipid_refatting: weak (glyceryl oleate, #11; peg-7 glyceryl cocoate, #12; hydrogenated castor oil, #16).
- Windows 8/10/12: moderate / moderate / moderate.
- Formula identity: high; evaluator recognition gaps: none.
- Researcher caveats: none.
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Genau eine substanzielle Route ist vorhanden: das kationische Polymer. Die Refatter erscheinen erst außerhalb des Fensters 10 oder sind schwache Refatter, daher keine zweite substanzielle Route.
- Rater B: Genau eine substantielle Route durch den Guar-Quat. Die Refatter sind entweder ausdrücklich schwach oder außerhalb der getesteten Payload-Fenster, daher keine zweite substantielle Route.

### NIVEA Shampoo Classic Care

Vorläufig high: cationic_polymer substantive (guar hydroxypropyltrimonium chloride); lipid_refatting substantive (gossypium hirsutum seed oil, dicaprylyl ether, glyceryl oleate, hydrogenated castor oil); Regelkonfidenz high.

- Routes: cationic_polymer: substantive (guar hydroxypropyltrimonium chloride, #7); lipid_refatting: substantive (gossypium hirsutum seed oil, #6; dicaprylyl ether, #9; glyceryl oleate, #10; hydrogenated castor oil, #12).
- Windows 8/10/12: high / high / high.
- Formula identity: moderate; evaluator recognition gaps: none.
- Researcher caveats: none.
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Kationisches Polymer plus prominenter Lipid-Payload ergeben zwei substanzielle Routen. Mehrere Lipidstoffe bleiben eine Route, reichen hier aber zusammen mit dem Polymer für high.
- Rater B: Zwei substantielle Routentypen: frühes Payload-Öl im Zusammenspiel mit erkanntem Guar-Quat. Weitere Lipidstoffe erhöhen nicht die Routenzahl.

### NIVEA MEN Anti Schuppen Shampoo

Vorläufig moderate: cationic_polymer substantive (guar hydroxypropyltrimonium chloride); lipid_refatting weak (glyceryl oleate, dicaprylyl ether, hydrogenated castor oil); Regelkonfidenz high.

- Routes: cationic_polymer: substantive (guar hydroxypropyltrimonium chloride, #14); lipid_refatting: weak (glyceryl oleate, #16; dicaprylyl ether, #17; hydrogenated castor oil, #18).
- Windows 8/10/12: moderate / moderate / moderate.
- Formula identity: moderate; evaluator recognition gaps: none.
- Researcher caveats: none.
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Das kationische Polymer liefert genau eine substanzielle Route. Die Lipidstoffe erscheinen zu spät, deshalb entsteht keine zweite substanzielle Route.
- Rater B: Eine substantielle kationische Polymerroute. Die Lipidroute bleibt schwach, weil kein Payload-Öl/Fettalkohol/Emollient im Fenster 8/10/12 liegt.

### GUHL Langzeit Volumen Kräftigendes Shampoo

Vorläufig moderate: cationic_polymer substantive (hydroxypropyl guar hydroxypropyltrimonium chloride); lipid_refatting weak (glyceryl oleate); Regelkonfidenz high.

- Routes: cationic_polymer: substantive (hydroxypropyl guar hydroxypropyltrimonium chloride, #7); lipid_refatting: weak (glyceryl oleate, #8).
- Windows 8/10/12: moderate / moderate / moderate.
- Formula identity: moderate; evaluator recognition gaps: none.
- Researcher caveats: none.
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Die Polymerroute ist substantiell. Glyceryl Oleate bleibt als schwacher Refatter eine zweite, aber nicht substanzielle Route; dadurch bleibt die Formel moderate.
- Rater B: Genau eine substantielle Route durch Hydroxypropyl Guar Hydroxypropyltrimonium Chloride. Glyceryl Oleate bleibt ein schwacher Refatter und begründet keine zweite substantielle Route.

### Jean&Len Shampoo Repair Dattel & Vanille

Vorläufig moderate: cationic_polymer substantive (guar hydroxypropyltrimonium chloride); lipid_refatting weak (peg-18 glyceryl oleate/cocoate, hydrogenated castor oil, prunus armeniaca kernel oil, glyceryl oleate); Regelkonfidenz high.

- Routes: cationic_polymer: substantive (guar hydroxypropyltrimonium chloride, #15); lipid_refatting: weak (peg-18 glyceryl oleate/cocoate, #6; hydrogenated castor oil, #16; prunus armeniaca kernel oil, #19; glyceryl oleate, #21).
- Windows 8/10/12: moderate / moderate / moderate.
- Formula identity: low; evaluator recognition gaps: none.
- Researcher caveats: none.
- Complete route extraction matches: A/B true, A/engine true, B/engine true.
- Rater A: Genau eine substanzielle Route ist vorhanden: das kationische Polymer. Die Lipidroute bleibt schwach, weil nur ein schwacher Refatter früh liegt und die Payload-Öle außerhalb des prominenten Fensters stehen.
- Rater B: Genau eine substantielle Route durch Guar-Quat. Frühes PEG-18 Glyceryl Oleate/Cocoate bleibt als schwacher Refatter schwach; die Payload-Öle liegen erst nach Fenster 12.
