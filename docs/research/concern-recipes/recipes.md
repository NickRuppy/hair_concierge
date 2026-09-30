# Concern-Rezepte (intern, Beratungs-Cockpit)

Stand: 2026-09-25. Nur intern (Admin-Cockpit), nie nutzerseitig. Quelle der Wahrheit ist `recipes.json`; diese Datei wird daraus erzeugt und muss mit ihr übereinstimmen. Methode, Quellen, Scope-Grenze und Code-Mapping: `README.md`.

Evidenz-Labels: `strong` / `moderate` / `weak` / `unknown` (Definition in `README.md`). `weak` ist nie eine harte Regel, sondern eine Option für den Call.

## Übersicht

| Code | Label | Kern | Evidenz | Grenze |
| --- | --- | --- | --- | --- |
| `dry_lengths` | Trockene oder strohige Längen | conditioner, leave_in, shampoo | strong | ja |
| `frizz_flyaways` | Frizz oder viele abstehende Haare | conditioner, leave_in | moderate | ja |
| `low_shine` | Wenig Glanz | conditioner | moderate | – |
| `lost_shape` | Form verliert sich schnell (je nach Haarstruktur: Form und Halt / Wellen / Locken-Definition / Coil-Definition) | conditioner | moderate | – |
| `low_volume_or_weighed_down` | Platt oder beschwert (je nach Haarstruktur: flacher Ansatz / ungleichmäßiges Volumen) | shampoo, conditioner | moderate | ja |
| `hair_damage` | Mein Haar wirkt insgesamt strapaziert oder geschädigt | conditioner, leave_in | strong | ja |
| `hair_loss_or_thinning` | Haarausfall oder dünner werdendes Haar | kein Produktrezept | strong | ja |
| `breakage` | Mein Haar bricht in den Längen ab | conditioner, leave_in | strong | ja |
| `split_ends` | Meine Spitzen sind sichtbar gespalten oder ausgefranst | conditioner, leave_in | strong | – |
| `tangling` | Schnelles Verknoten | conditioner, leave_in | strong | ja |

## `dry_lengths` – Trockene oder strohige Längen

**Was sie meistens meint:** Die Längen fühlen sich rau, strohig oder spröde an und lassen sich schwer kämmen – gemeint sind die Längen, nicht die Kopfhaut.

**Evidenz gesamt:** `strong` · **Research-Basis (goal-concern-levers):** Concerns `dryness`; Goals `moisture`

### Primär – Produktkategorien

- **conditioner** (`strong`): Nach jeder Wäsche in Längen und Spitzen: glättet die Oberfläche, verbessert Gleitfähigkeit und Kämmbarkeit, weniger raues Gefühl.
- **leave_in** (`moderate`): Gibt zwischen den Wäschen Gleitfähigkeit und Schutz vor Reibung. Menge und Gewicht an die Haardicke anpassen: feines Haar = leichte Formel, sparsam, nur Längen.
- **shampoo** (`strong`): Mildes Shampoo gezielt auf die Kopfhaut; die Längen werden nur vom ausgespülten Schaum mitgereinigt. Waschrhythmus richtet sich nach der Kopfhaut, nicht nach den Längen.

### Primär – Hebel ohne Produkt

- Handtuch: ausdrücken statt rubbeln (`strong`)
- Hitze reduzieren: seltener, niedrigere Stufe, weniger Durchgänge (`strong`)
- Längen beim Waschen nicht schrubben, nur Kopfhaut massieren (`strong`)
- Belag-Check: wirken die Längen eher belegt/schwer als rau? Dann einmalig Tiefenreinigung statt mehr Pflege (`moderate`) → nur bei bestätigtem Signal: `deep_cleansing_shampoo`

### Bedingt (Profil-Modifikatoren)

| Kategorie | Wenn | Warum | Evidenz |
| --- | --- | --- | --- |
| mask | thickness=coarse | Grobes Haar verträgt reichhaltigere Pflege; Maske ersetzt an dem Waschtag den Conditioner. | `moderate` |
| mask | hair_texture=curly/coily | Locken und Coils brauchen erfahrungsgemäß mehr Gleitfähigkeit; Maske ersetzt an dem Waschtag den Conditioner. | `moderate` |
| mask | damaged=true UND thickness=normal/coarse | Chemisch/thermisch strapazierte Längen sind rauer und poröser; reichhaltigere Pflege glättet spürbar. Bei feinem Haar stattdessen beim leichten Leave-in bleiben. | `moderate` |
| oil | hair_texture=curly/coily | Wenige Tropfen in die Spitzen als Gleit- und Abschlussfilm, nicht als „Feuchtigkeit“. | `weak` |
| oil | thickness=coarse | Wenige Tropfen in die Spitzen als Gleit- und Abschlussfilm. | `weak` |
| heat_protectant | heat_styling=true | Reduziert messbaren Hitzeschaden, ersetzt aber nicht weniger Hitze. | `moderate` |
| bondbuilder | chemical_treatment=lightened/permed/chemically_straightened | Strohigkeit nach Blondierung/Dauerwelle/Glättung ist oft Strukturschaden; ein Bondbuilder kann unterstützen, ersetzt aber Conditioner und Leave-in nicht. | `weak` |

### Nicht zuerst / vermeiden

- Reichhaltige Maske oder Öl als ersten Schritt bei feinem Haar oder fettiger Kopfhaut
- Trockenheit als „Wassermangel“ erklären – gemeint ist Geschmeidigkeit, nicht Wasser
- Tiefenreinigung als Standard – trocknet raue Längen weiter aus
- Bondbuilder/Protein als Trockenheits-Lösung ohne chemische Vorbehandlung
- Pflege auf den Ansatz bei fettiger Kopfhaut

### Sicherheitsgrenze

Nur Längen. Trockene, spannende, juckende, schuppende oder gerötete Kopfhaut ist ein anderes Thema; hält das an oder ist es entzündlich, gehört es dermatologisch abgeklärt.

### Konflikte mit anderen Anliegen

`lost_shape`, `low_volume_or_weighed_down`

### Im Call klären

- Fühlen sich die Längen eher rau/strohig an oder eher belegt/schwer?
- Wie oft nutzt du Föhn, Glätteisen oder Lockenstab – und auf welcher Stufe?
- Ist die Kopfhaut auch trocken, oder nur die Längen?

### Talking Point

> So gehen wir es an: Deine Längen brauchen vor allem mehr Gleitfähigkeit und Schutz – Conditioner nach jeder Wäsche, dazu ein passendes Leave-in, und Shampoo nur auf die Kopfhaut. Ob du zusätzlich etwas Reichhaltigeres brauchst, richten wir nach deiner Haardicke, damit nichts beschwert.

## `frizz_flyaways` – Frizz oder viele abstehende Haare

**Was sie meistens meint:** Die Haare stehen ab, wirken puffig oder bilden einen „Heiligenschein“ – oft bei Luftfeuchtigkeit oder nach dem Trocknen; bei Wellen und Locken meist ein gestörtes Muster.

**Evidenz gesamt:** `moderate` · **Research-Basis (goal-concern-levers):** Concerns `frizz`; Goals `less_frizz`

### Primär – Produktkategorien

- **conditioner** (`strong`): Senkt Reibung und statische Aufladung, glättet die Oberfläche – der am besten belegte erste Schritt gegen Frizz.
- **leave_in** (`strong`): Reduziert Frizz, Flyaways und statische Aufladung zwischen den Wäschen. Gewicht an die Haardicke anpassen: feines Haar = leichte Sprühformel, grobes/lockiges Haar = cremiger.

### Primär – Hebel ohne Produkt

- Handtuch: ausdrücken statt rubbeln (Mikrofaser/T-Shirt) (`strong`)
- Wellen, Locken, Coils nicht trocken bürsten; im nassen Haar mit Pflege entwirren (`strong`)
- Produkte im nassen/feuchten Haar einarbeiten und beim Trocknen wenig anfassen (`moderate`)
- Hitze reduzieren; Föhn mit Abstand und in Bewegung (`strong`)
- Belag-Check: wirkt das Haar schwer/belegt und trotzdem frizzy? Dann einmalig Tiefenreinigung (`moderate`) → nur bei bestätigtem Signal: `deep_cleansing_shampoo`

### Bedingt (Profil-Modifikatoren)

| Kategorie | Wenn | Warum | Evidenz |
| --- | --- | --- | --- |
| mask | hair_texture=curly/coily | Mehr Gleitfähigkeit für Locken/Coils; Maske ersetzt an dem Waschtag den Conditioner. | `moderate` |
| mask | damaged=true UND thickness=normal/coarse | Geschädigte Längen reagieren stärker auf Feuchtigkeit und sind rauer; reichhaltigere Pflege glättet. | `moderate` |
| oil | thickness=coarse | Wenige Tropfen als glättender Abschluss auf den Längen. | `weak` |
| oil | hair_texture=curly/coily UND thickness=normal/coarse | Wenige Tropfen als Abschluss, nachdem Leave-in eingearbeitet ist; nicht statt Leave-in. | `weak` |
| heat_protectant | heat_styling=true | Hitze macht die Oberfläche rauer und feuchtigkeitsempfindlicher; Schutz unterstützt, weniger Hitze bleibt wichtiger. | `moderate` |

### Nicht zuerst / vermeiden

- Öl als Standardantwort auf Frizz
- Protein/Bondbuilder als generelle Frizz-Lösung ohne Schadenssignal (dann Rezept hair_damage)
- Trockenes Bürsten von Wellen/Locken/Coils
- Schwere Pflege bei feinem Haar – macht platt und trotzdem nicht frizzfrei
- Versprechen, dass ein Produkt Frizz bei Luftfeuchtigkeit komplett verhindert

### Sicherheitsgrenze

Sind die „abstehenden Haare“ kurze abgebrochene Stücke, gilt das Rezept breakage. Viele neue kurze Haare am Haaransatz nach einer Phase mit starkem Ausfall sind meist nachwachsendes Haar – kosmetisch unkritisch, aber wenn der Ausfall selbst Thema ist, gilt die Grenze von hair_loss_or_thinning.

### Konflikte mit anderen Anliegen

`lost_shape`, `low_volume_or_weighed_down`

### Im Call klären

- Wird es vor allem bei feuchtem Wetter schlimmer?
- Sind das eher kurze abgebrochene Haare oder die normalen Längen, die abstehen?
- Bürstest du deine Haare trocken, und wie trocknest du sie?

### Talking Point

> So gehen wir es an: Frizz hat meist mehrere Ursachen – wir glätten zuerst die Oberfläche mit Conditioner und einem passenden Leave-in und ändern ein, zwei Handgriffe beim Abtrocknen und Stylen. Wie reichhaltig das sein darf, richten wir nach deiner Haardicke, damit nichts beschwert.

## `low_shine` – Wenig Glanz

**Was sie meistens meint:** Die Längen wirken stumpf und matt und reflektieren kaum Licht.

**Evidenz gesamt:** `moderate` · **Research-Basis (goal-concern-levers):** Goals `shine`

### Primär – Produktkategorien

- **conditioner** (`moderate`): Glättet die Oberfläche und legt einen Film auf – glattere Oberfläche reflektiert Licht gleichmäßiger.

### Primär – Hebel ohne Produkt

- Schonend waschen: Shampoo auf die Kopfhaut, Längen nicht schrubben (`strong`)
- Reibung und Hitze reduzieren (Handtuch, Bürste, Glätteisen) (`strong`)
- Beim Föhnen von oben nach unten trocknen, zum Schluss kühl – richtet die Haare aus (`weak`)
- Gefärbtes Haar: unnötige Wäschen, Sonne und Hitze reduzieren – Glanzverlust ist oft verblassende Farbe (`strong`)
- Belag-Check: stumpf, schwer, wachsig? Dann einmalig Tiefenreinigung – nicht als Standard bei gefärbtem oder trockenem Haar (`moderate`) → nur bei bestätigtem Signal: `deep_cleansing_shampoo`

### Bedingt (Profil-Modifikatoren)

| Kategorie | Wenn | Warum | Evidenz |
| --- | --- | --- | --- |
| leave_in | thickness=fine | Leichter Glättungsfilm ohne das Gewicht von Öl. | `weak` |
| oil | thickness=normal/coarse | Ein, zwei Tropfen als Glanzfinish auf trockene Längen; Effekt ist ein Film, keine Reparatur. | `weak` |
| mask | damaged=true UND thickness=normal/coarse | Raue, strapazierte Längen streuen Licht; reichhaltigere Pflege glättet sichtbar. | `moderate` |
| heat_protectant | heat_styling=true | Hitze raut die Oberfläche auf und lässt Farbe verblassen; Schutz unterstützt, weniger Hitze bleibt wichtiger. | `moderate` |

### Nicht zuerst / vermeiden

- Schweres Öl oder Maske für alle – bei feinem Haar platt und fettig statt glänzend
- Versprechen, die Schuppenschicht wieder „wie neu“ zu machen
- Häufige Tiefenreinigung bei gefärbtem Haar (beschleunigt Verblassen und Trockenheit)
- Glanz ausschließlich auf Schaden zurückführen – Rückstände und Styling spielen oft mit

### Sicherheitsgrenze

Keine medizinische Grenze; rein kosmetisch.

### Konflikte mit anderen Anliegen

`low_volume_or_weighed_down`

### Im Call klären

- Wirken die Längen eher rau oder eher belegt/schwer?
- Ist dein Haar gefärbt, und ist der Glanz nach dem Färben erst gut und lässt dann nach?
- Wie stylst du – Föhn, Glätteisen, Lufttrocknen?

### Talking Point

> So gehen wir es an: Glanz entsteht, wenn die Oberfläche glatt ist und Licht gleichmäßig zurückwirft – wir glätten mit Conditioner, schonen die Längen beim Waschen und Föhnen und prüfen, ob Rückstände den Glanz schlucken.

### Domain Review offen

- Maps to research goal `shine`, not a concern in goal-concern-levers; the concern-level recipe is derived from the shine goal lever map.
- Should `colored` alone (without lightening) unlock anything for low_shine, e.g. a color-care shampoo? Our catalog has no separate color-care category; kept as a non-product lever.

## `lost_shape` – Form verliert sich schnell (je nach Haarstruktur: Form und Halt / Wellen / Locken-Definition / Coil-Definition)

**Was sie meistens meint:** Bei Wellen, Locken und Coils: Die Definition fällt schnell zusammen oder hängt aus. Bei glattem Haar: Die Frisur hält nicht und die Längen wirken schnell platt und kraftlos.

**Evidenz gesamt:** `moderate` · **Research-Basis (goal-concern-levers):** Goals `curl_definition`, `volume`

### Primär – Produktkategorien

- **conditioner** (`moderate`): Gleitfähigkeit ist die Grundlage für Definition bei Wellen/Locken; bei glattem Haar leicht und nur in Längen und Spitzen, damit nichts runterzieht.

### Primär – Hebel ohne Produkt

- Wellen/Locken/Coils: Produkte im nassen Haar abschnittsweise einarbeiten, dann bis zum Trocknen möglichst nicht anfassen (`weak`)
- Nicht trocken bürsten; entwirren nur nass mit Pflege (`moderate`)
- Lufttrocknen oder Diffusor auf niedriger Stufe statt heißem Föhnen mit viel Bewegung (`weak`)
- Halt kommt von Stylingprodukten (Gel, Mousse) – nicht in unserem Empfehlungskatalog, im Call nur als Hebel benennen (`moderate`)
- Glattes Haar: Ansatz sauber halten, Pflege vom Ansatz fern, beim Föhnen am Ansatz anheben; Schnitt kann viel ausmachen (`weak`)
- Belag-Check: hängen Locken aus, obwohl viel Pflege drauf ist? Dann einmalig Tiefenreinigung (`moderate`) → nur bei bestätigtem Signal: `deep_cleansing_shampoo`

### Bedingt (Profil-Modifikatoren)

| Kategorie | Wenn | Warum | Evidenz |
| --- | --- | --- | --- |
| leave_in | hair_texture=wavy/curly/coily | Im nassen Haar eingearbeitet hilft es, Strähnen zu Gruppen zu formen, und reduziert Frizz. Bei feinen Wellen leichte Formel, sonst hängen sie aus. Nächste Kategorie zu Curl-Cremes. | `moderate` |
| dry_shampoo | hair_texture=straight/wavy UND scalp_type=oily | Wenn die Form am zweiten Tag wegen fettigem Ansatz zusammenfällt: sparsam am Ansatz zwischen den Wäschen, ersetzt aber das Waschen nicht. | `weak` |
| heat_protectant | heat_styling=true | Hitzeschaden kann das Lockenmuster dauerhaft lockern; Schutz unterstützt, weniger Hitze bleibt wichtiger. | `moderate` |

### Nicht zuerst / vermeiden

- „Mehr Feuchtigkeit“ als Standardantwort – zu viel oder zu schwere Pflege lässt Wellen/Locken aushängen
- Schwere Öle oder Masken bei feinen Wellen
- Trockenes Bürsten zum „Formen“
- Tiefenreinigung als Standard bei trockenem, gefärbtem oder gereiztem Haar
- Versprechen, dass Produkte die Lockenstruktur dauerhaft verändern

### Sicherheitsgrenze

Keine medizinische Grenze; rein kosmetisch.

### Konflikte mit anderen Anliegen

`dry_lengths`, `frizz_flyaways`, `low_volume_or_weighed_down`, `hair_damage`

### Im Call klären

- Wann fällt die Form zusammen – direkt nach dem Trocknen oder erst am nächsten Tag?
- Wie viel und welche Pflege benutzt du gerade – eher viel und reichhaltig oder eher wenig?
- Bürstest oder kämmst du die Haare, wenn sie trocken sind?

### Talking Point

> So gehen wir es an: Form hält am besten, wenn nichts dein Haar beschwert und du sie im nassen oder feuchten Haar festlegst – leichte Pflege in den Längen, ein sauberer Ansatz, und beim Trocknen möglichst wenig anfassen. Welche Schritte genau, richten wir nach deiner Haarstruktur.

### Domain Review offen

- Maps to research goal `curl_definition` (quiz goal `shape_definition`), not a concern in goal-concern-levers; for straight hair the label means style hold/body, which is closer to research goal `volume`.
- The best-supported product lever (hold: gel/mousse/styling cream, `moderate`) is outside our recommendable categories (styling_* keys exist in CanonicalProductCategoryKey but are not recommended). The recipe falls back to leave_in; decide whether the call may name gel/mousse generically.
- Straight-hair variant ("Form und Halt") has only practice-level evidence (weak).

## `low_volume_or_weighed_down` – Platt oder beschwert (je nach Haarstruktur: flacher Ansatz / ungleichmäßiges Volumen)

**Was sie meistens meint:** Glatt/wellig: Der Ansatz liegt flach oder die Längen wirken schnell schwer und platt. Lockig/Coils: Volumen verteilt sich ungleichmäßig, z. B. oben flach und unten breit.

**Evidenz gesamt:** `moderate` · **Research-Basis (goal-concern-levers):** Goals `volume`

### Primär – Produktkategorien

- **shampoo** (`moderate`): Gezielt auf die Kopfhaut; Talg und Rückstände am Ansatz lassen ihn flach wirken. Bei fettiger Kopfhaut ist häufigeres Waschen in Ordnung.
- **conditioner** (`moderate`): Leichte Formel, kleine Menge, nur Längen und Spitzen – nie an den Ansatz.

### Primär – Hebel ohne Produkt

- Gewicht rausnehmen: weniger Produkt, nichts am Ansatz, schwere Schritte weglassen (`moderate`)
- Ansatz vollständig trocknen und dabei gegen die Fallrichtung anheben (`weak`)
- Schnitt/Stufen: lange, schwere Längen hängen flacher (`weak`)
- Belag-Check: schwer, belegt, schnell platt trotz Waschen? Dann einmalig Tiefenreinigung (`moderate`) → nur bei bestätigtem Signal: `deep_cleansing_shampoo`

### Bedingt (Profil-Modifikatoren)

| Kategorie | Wenn | Warum | Evidenz |
| --- | --- | --- | --- |
| dry_shampoo | scalp_type=oily | Sparsam am Ansatz zwischen zwei Wäschen, bindet Talg und gibt kurzfristig Stand. Ersetzt das Waschen nicht; nach ein, zwei Anwendungen wieder richtig waschen. | `weak` |
| leave_in | hair_texture=curly/coily | Bei Locken/Coils geht es eher um gleichmäßige Form als um reines Anheben: leichtes Leave-in im nassen Haar für gleichmäßige Lockengruppen, nicht am Ansatz. | `weak` |
| heat_protectant | heat_styling=true | Wenn Volumen über Föhnen/Rundbürste entsteht, als Schutz – nicht als Volumenprodukt. | `moderate` |

### Nicht zuerst / vermeiden

- Masken und Öle bei feinem Haar oder fettigem Ansatz
- Reichhaltiges Leave-in bei feinem Haar
- Pflege oder Öl am Ansatz
- „Volumenshampoo macht das Haar dicker“ – es reinigt, verändert aber nicht die Dichte
- Trockenshampoo als Ersatz fürs Waschen
- Wachstums- oder Verdichtungsversprechen

### Sicherheitsgrenze

Wenn „platt“ eigentlich heißt, dass das Haar weniger dicht wird, der Scheitel breiter wirkt oder mehr Kopfhaut durchscheint, gilt die Grenze von hair_loss_or_thinning – nicht dieses Rezept.

### Konflikte mit anderen Anliegen

`dry_lengths`, `frizz_flyaways`, `low_shine`, `lost_shape`, `hair_damage`, `hair_loss_or_thinning`, `breakage`, `split_ends`, `tangling`

### Im Call klären

- Ist dein Haar direkt nach dem Waschen platt oder erst nach ein, zwei Tagen?
- Hast du das Gefühl, dass dein Haar weniger dicht geworden ist – oder ist es eher schwer und flach?
- Was benutzt du nach dem Waschen, und wie viel davon?

### Talking Point

> So gehen wir es an: Wir nehmen Gewicht raus – Shampoo gezielt an den Ansatz, Pflege nur in Längen und Spitzen und in kleinen Mengen, und wir prüfen, ob sich Rückstände angesammelt haben. Volumen holen wir über Reinigung und Styling, nicht über noch mehr Pflege.

### Domain Review offen

- Maps to research goal `volume` (quiz goal `volume_balance`), not a concern in goal-concern-levers.
- For curly/coily the quiz label means uneven shape/volume distribution, which is largely cut and styling; evidence for a product recipe there is weak. Confirm the call should lead with cut/styling for curly/coily.

## `hair_damage` – Mein Haar wirkt insgesamt strapaziert oder geschädigt

**Was sie meistens meint:** Sammelbegriff: Längen fühlen sich rau, stumpf, porös oder „anders“ an, oft nach Blondieren, Färben oder viel Hitze – manchmal mit Bruch, Spliss oder Knoten.

**Evidenz gesamt:** `strong` · **Research-Basis (goal-concern-levers):** Concerns `hair_damage`; Goals `healthier_hair`, `strengthen`

### Primär – Produktkategorien

- **conditioner** (`strong`): Senkt Reibung und Kämmkraft, macht strapazierte Längen geschmeidiger und reduziert Bruch beim Kämmen.
- **leave_in** (`strong`): Gleitfähigkeit und Schutz zwischen den Wäschen; feines Haar: leichte Formel, sparsam.

### Primär – Hebel ohne Produkt

- Schadensquelle zuerst reduzieren: weniger Hitze, niedrigere Stufe, weniger Durchgänge (`strong`)
- Chemische Behandlungen strecken, nicht überlappend blondieren/färben/glätten (`strong`)
- Sanft entwirren: abschnittsweise, von den Spitzen nach oben, breiter Kamm oder Finger (`strong`)
- Strukturell kaputte Spitzen schneiden lassen (`moderate`)
- Einordnung: Haar ist nicht lebendig und heilt nicht – Pflege verbessert Gefühl und Optik und bremst neuen Schaden (`strong`)

### Bedingt (Profil-Modifikatoren)

| Kategorie | Wenn | Warum | Evidenz |
| --- | --- | --- | --- |
| bondbuilder | chemical_treatment=lightened/permed/chemically_straightened | Für chemisch geschädigtes Haar gibt es Hinweise auf mehr Festigkeit und weniger Bruch (vor allem Labor-/In-vitro-Daten); als Unterstützung, nicht als Reparatur. | `moderate` |
| mask | thickness=normal/coarse | Reichhaltigere Pflege glättet raue Längen; Maske ersetzt an dem Waschtag den Conditioner. Bei feinem Haar beim leichten Leave-in bleiben. | `moderate` |
| mask | hair_texture=curly/coily | Locken/Coils brauchen mehr Gleitfähigkeit; Maske ersetzt an dem Waschtag den Conditioner. | `moderate` |
| heat_protectant | heat_styling=true | Reduziert messbaren Hitzeschaden; steht aber hinter „weniger Hitze“. | `moderate` |
| oil | thickness=coarse | Wenige Tropfen in die Spitzen als Gleitfilm; keine Strukturreparatur. | `weak` |

### Nicht zuerst / vermeiden

- Öle und Masken, während Blondierung, viel Hitze oder grobes Entwirren unverändert weiterlaufen
- „Reparieren“, „heilen“, „wie neu“
- Nahrungsergänzungsmittel gegen Längenschäden
- „Mehr Protein“ als Pauschalantwort – kann strapaziertes Haar steif und rau machen
- Reichhaltige Maske bei feinem Haar als erster Schritt
- Tiefenreinigung als Standard

### Sicherheitsgrenze

Kommt zum strapazierten Haar vermehrter Ausfall mit Wurzel, lichter werdendes Haar oder Kopfhautbeschwerden hinzu, gilt die Grenze von hair_loss_or_thinning. Brennen, Wunden oder starke Reaktion der Kopfhaut nach Färben/Blondieren → ärztlich abklären lassen.

### Konflikte mit anderen Anliegen

`lost_shape`, `low_volume_or_weighed_down`

### Im Call klären

- Was glaubst du, woher der Schaden kommt – Blondieren, Färben, Hitze, Kämmen?
- Wie oft blondierst oder färbst du, und wann war die letzte Behandlung?
- Brechen Haare ab, oder fühlen sie sich vor allem rau und stumpf an?

### Talking Point

> So gehen wir es an: Geschädigte Längen kann man nicht heilen, aber wir können sie deutlich geschmeidiger machen und vor allem verhindern, dass neuer Schaden dazukommt – weniger Hitze und Belastung, konsequent Conditioner und Leave-in, und bei blondiertem Haar gezielt ein Bondbuilder. Was wirklich kaputt ist, nehmen wir beim nächsten Schnitt mit.

### Domain Review offen

- Should `colored` (permanent color without lightening) count as `damaged`? Currently only lightened/permed/chemically_straightened unlock bondbuilder.

## `hair_loss_or_thinning` – Haarausfall oder dünner werdendes Haar

**Was sie meistens meint:** „Mir fallen mehr Haare auf als sonst oder mein Haar wirkt weniger dicht.“ Kann Ausfall mit Wurzel, abnehmende Dichte, breiteren Scheitel – oder eigentlich Haarbruch meinen.

**Evidenz gesamt:** `strong` · **Research-Basis (goal-concern-levers):** Concerns `hair_loss`, `thinning`

### Primär – Produktkategorien

- Keine. Dieses Anliegen bekommt bewusst kein Produktrezept.

### Primär – Hebel ohne Produkt

- Erst trennen: ganze Haare mit kleinem hellem Knötchen an der Wurzel = Ausfall; kurze Stücke ohne Wurzel = Bruch (→ Rezept breakage) (`strong`)
- Ausfall oder lichter werdendes Haar: ärztliche Abklärung empfehlen, bevorzugt Hautärztin/Hautarzt (`strong`)
- Erst nach dieser Einordnung und nicht als Behandlung: straffe Frisuren und Zug meiden, sanft entwirren (`moderate`)

### Bedingt (Profil-Modifikatoren)

- Keine.

### Nicht zuerst / vermeiden

- Jede Produktempfehlung als Antwort auf Ausfall oder Ausdünnung – kein Rezept
- Shampoos, Seren oder scalp_care-Produkte „gegen Haarausfall“ oder „für Wachstum“
- Nahrungsergänzungsmittel, Kopfhautöle, Massagen oder Peelings als Lösung
- Worte wie stoppen, nachwachsen, Wachstum anregen, Follikel stärken
- Eine Ursache benennen oder vermuten (Hormone, Stress, Eisenmangel, Genetik)
- Beschwichtigen („das ist bestimmt normal“) oder Medikamente absetzen lassen

### Sicherheitsgrenze

Nur Grenze, kein Produktrezept. Ausfall und Ausdünnung haben viele Ursachen und gehören ärztlich abgeklärt. Deutliche Warnzeichen für eine zeitnahe Abklärung: plötzlicher oder büschelweiser Ausfall, kahle oder lichte Stellen, sichtbar breiterer Scheitel/lichter Oberkopf, Schmerz, Brennen, Jucken, Rötung, Schuppung oder Pusteln an der Kopfhaut, Ausfall nach Geburt, Fieber, OP, starkem Gewichtsverlust oder Medikamentenwechsel, oder wenn es sie belastet. Bei gleichzeitigem Haarbruch darf das Rezept breakage für die Längen laufen – ausdrücklich ohne Anspruch, den Ausfall zu behandeln.

### Konflikte mit anderen Anliegen

`low_volume_or_weighed_down`, `breakage`

### Im Call klären

- Sind es eher ganze Haare mit Wurzel oder kurze abgebrochene Stücke?
- Kam das plötzlich oder schleichend – und seit wann?
- Warst du damit schon bei einer Ärztin oder einem Arzt?

### Talking Point

> Dass dir mehr Haare ausfallen oder dein Haar lichter wirkt, nehmen wir ernst – dafür kann es viele Gründe geben, und die sollte eine Hautärztin oder ein Hautarzt abklären. Was wir mit dir angehen können, ist die Pflege deiner Längen, damit nicht zusätzlich etwas abbricht – das ersetzt aber keine Abklärung.

### Domain Review offen

- Confirm the call may ask the Wurzel-vs-Stück question at all, or whether the founder should only acknowledge and refer.
- Legal/compliance check of the talking point wording (HWG/EU cosmetic claims) before it is used verbatim.

## `breakage` – Mein Haar bricht in den Längen ab

**Was sie meistens meint:** Einzelne Haare reißen oberhalb der Spitzen ab – kurze abgebrochene Stücke, ungleich lange Haare, oft beim Kämmen, nach Hitze oder Blondierung.

**Evidenz gesamt:** `strong` · **Research-Basis (goal-concern-levers):** Concerns `breakage`; Goals `anti_breakage`

### Primär – Produktkategorien

- **conditioner** (`strong`): Conditioner senkt in Kämmstudien den Bruch messbar, besonders bei blondiertem Haar.
- **leave_in** (`strong`): Gleitfähigkeit beim Entwirren und Stylen; weniger Kraft beim Kämmen = weniger Bruch.

### Primär – Hebel ohne Produkt

- Bruch von Ausfall trennen: kurze Stücke ohne Wurzel = Bruch; ganze Haare mit Wurzel → hair_loss_or_thinning (`strong`)
- Entwirren: abschnittsweise, von den Spitzen nach oben, breiter Kamm oder Finger; Locken/Coils nur nass mit Pflege (`strong`)
- Hitze reduzieren: seltener, niedriger, weniger Durchgänge; Glätteisen nur auf trockenes Haar (`strong`)
- Chemische Behandlungen strecken, nicht überlappend blondieren (`strong`)
- Lockere Frisuren, keine straffen Gummis; Handtuch ausdrücken statt rubbeln (`strong`)
- Reibung nachts reduzieren (lockerer Zopf, glatter Bezug) (`moderate`)
- Die am stärksten geschädigten Spitzen schneiden (`moderate`)

### Bedingt (Profil-Modifikatoren)

| Kategorie | Wenn | Warum | Evidenz |
| --- | --- | --- | --- |
| bondbuilder | chemical_treatment=lightened/permed/chemically_straightened | Hinweise auf weniger Bruch und mehr Festigkeit bei chemisch geschädigtem Haar (überwiegend Labor-/In-vitro-Daten); Unterstützung, keine Umkehr. | `moderate` |
| heat_protectant | heat_styling=true | Reduziert Hitzeschaden und Bruch in Tests; steht hinter „weniger Hitze“. | `moderate` |
| mask | damaged=true UND thickness=normal/coarse | Mehr Gleitfähigkeit für raue, strapazierte Längen; Maske ersetzt an dem Waschtag den Conditioner. | `moderate` |
| mask | hair_texture=curly/coily | Locken/Coils brechen vor allem beim Entwirren; mehr Gleitfähigkeit hilft. | `moderate` |
| oil | hair_texture=curly/coily | Etwas Öl auf schwierige Stellen als zusätzliche Gleitfähigkeit beim Entwirren. | `weak` |

### Nicht zuerst / vermeiden

- Ausfall als Bruch behandeln
- „Dir fehlt Protein“ als Pauschalerklärung
- Öl oder Maske als alleinige Lösung, während Hitze/Blondierung/Zug weiterlaufen
- Fester oder häufiger bürsten
- Straffe Zöpfe, Dutts oder Extensions ohne Hinweis auf Zug

### Sicherheitsgrenze

Ganze Haare mit Wurzel, lichter werdendes Haar, kahle Stellen oder plötzlich viel Ausfall → Grenze von hair_loss_or_thinning. Kommt beides vor, darf dieses Rezept für die Längen laufen, ohne den Ausfall zu behandeln. Plötzlicher starker Bruch direkt nach einer chemischen Behandlung mit brennender oder wunder Kopfhaut → ärztlich abklären.

### Konflikte mit anderen Anliegen

`low_volume_or_weighed_down`, `hair_loss_or_thinning`

### Im Call klären

- Sind es kurze abgebrochene Stücke oder ganze Haare mit Wurzel?
- Wann bricht es – beim Kämmen, beim Glätten, beim Zopfmachen?
- Sind deine Längen blondiert, dauergewellt oder chemisch geglättet?

### Talking Point

> So gehen wir es an: Haarbruch entsteht fast immer durch Belastung – beim Kämmen, durch Hitze oder durch chemische Behandlungen. Wir sorgen mit Conditioner und Leave-in für Gleitfähigkeit, ändern, wie du entwirrst und stylst, und nehmen Belastung raus; wenn deine Längen blondiert sind, kann ein Bondbuilder zusätzlich unterstützen.

## `split_ends` – Meine Spitzen sind sichtbar gespalten oder ausgefranst

**Was sie meistens meint:** Die Enden einzelner Haare teilen sich oder fransen aus; die Spitzen wirken dünn, rau oder verheddern sich.

**Evidenz gesamt:** `strong` · **Research-Basis (goal-concern-levers):** Concerns `split_ends`; Goals `less_split_ends`

### Primär – Produktkategorien

- **conditioner** (`strong`): Senkt Reibung und beugt neuem Spliss vor; bestehender Spliss wird nur optisch geglättet.
- **leave_in** (`moderate`): Hält die Spitzen geschmeidig, damit sie weniger hängen bleiben und weiter aufspleißen; glättet die Optik bis zur nächsten Wäsche.

### Primär – Hebel ohne Produkt

- Bestehenden Spliss schneiden lassen – die einzige echte Lösung (`strong`)
- Wer Länge behalten will: regelmäßig nur wenige Millimeter schneiden (`moderate`)
- Hitze, chemische Belastung und Reibung reduzieren (`strong`)
- Sanft entwirren, von den Spitzen nach oben (`strong`)

### Bedingt (Profil-Modifikatoren)

| Kategorie | Wenn | Warum | Evidenz |
| --- | --- | --- | --- |
| oil | thickness=normal/coarse | Ein, zwei Tropfen in die Spitzen glätten die Optik vorübergehend; keine Reparatur. | `weak` |
| heat_protectant | heat_styling=true | Hitze ist ein Haupttreiber für neuen Spliss; Schutz unterstützt, weniger Hitze bleibt wichtiger. | `moderate` |
| bondbuilder | chemical_treatment=lightened/permed/chemically_straightened | Kann chemisch geschwächtes Haar widerstandsfähiger machen und so neuem Spliss vorbeugen; verklebt keinen bestehenden Spliss. | `weak` |

### Nicht zuerst / vermeiden

- „Repariert“ oder „versiegelt Spliss dauerhaft“
- Nur Öl als Antwort
- Schneiden aus Angst um die Länge immer weiter aufschieben – Spliss wandert nach oben und verursacht Bruch und Knoten
- Feste Schnitt-Intervalle als Regel vorgeben

### Sicherheitsgrenze

Keine medizinische Grenze; rein kosmetisch.

### Konflikte mit anderen Anliegen

`low_volume_or_weighed_down`

### Im Call klären

- Wann warst du zuletzt beim Schneiden?
- Ist dir die Länge gerade besonders wichtig?
- Wie oft nutzt du Hitze, und sind die Spitzen blondiert?

### Talking Point

> So gehen wir es an: Ehrlich gesagt – was schon gespalten ist, bekommt man nur mit der Schere weg; Pflege kann es nur optisch glätten. Deshalb einmal die Spitzen schneiden lassen und ab dann mit Conditioner, Leave-in und weniger Hitze dafür sorgen, dass neuer Spliss langsamer entsteht.

## `tangling` – Schnelles Verknoten

**Was sie meistens meint:** Die Haare verknoten oder verfilzen schnell, Kämmen ziept und dauert lange.

**Evidenz gesamt:** `strong` · **Research-Basis (goal-concern-levers):** Concerns `tangling`

### Primär – Produktkategorien

- **conditioner** (`strong`): Gleitfähigkeit ist der wichtigste Hebel gegen Knoten; senkt die Kämmkraft.
- **leave_in** (`strong`): Wirkt als Entwirrhilfe zwischen den Wäschen; feines Haar: leichte Sprühformel.

### Primär – Hebel ohne Produkt

- In Abschnitten entwirren, von den Spitzen nach oben, breiter Kamm oder Finger (`strong`)
- Locken/Coils nur nass mit Pflege entwirren; glattes Haar kann angetrocknet mit breitem Kamm entwirrt werden (`strong`)
- Handtuch ausdrücken statt rubbeln; nachts lockerer Zopf oder glatter Bezug (`moderate`)
- Spitzen, die immer wieder hängen bleiben, schneiden lassen (`moderate`)
- Belag-Check: fühlt sich das Haar belegt/klebrig an? Dann einmalig Tiefenreinigung (`moderate`) → nur bei bestätigtem Signal: `deep_cleansing_shampoo`

### Bedingt (Profil-Modifikatoren)

| Kategorie | Wenn | Warum | Evidenz |
| --- | --- | --- | --- |
| mask | hair_texture=curly/coily | Mehr Gleitfähigkeit für Locken/Coils; Maske ersetzt an dem Waschtag den Conditioner. | `moderate` |
| mask | damaged=true UND thickness=normal/coarse | Raue, strapazierte Längen haken stärker ineinander; reichhaltigere Pflege glättet. | `moderate` |
| oil | hair_texture=curly/coily | Etwas Öl auf besonders schwierige Stellen als zusätzliche Gleitfähigkeit. | `weak` |
| oil | thickness=coarse | Etwas Öl in die Spitzen als zusätzliche Gleitfähigkeit. | `weak` |

### Nicht zuerst / vermeiden

- Fester oder öfter bürsten
- Trockenes Bürsten von Locken/Coils
- Reparaturbehandlung vor Gleitfähigkeit und Technik
- Knoten automatisch als Trockenheit deuten – Länge, Struktur, Spliss und Rückstände spielen mit
- Schwere Pflege bei feinem Haar

### Sicherheitsgrenze

Bleiben beim Entwirren viele ganze Haare mit Wurzel in der Bürste, ist das Thema eher Ausfall → Grenze von hair_loss_or_thinning. Stark verfilzte Stellen nicht mit Gewalt lösen – das gehört zur Friseurin.

### Konflikte mit anderen Anliegen

`low_volume_or_weighed_down`

### Im Call klären

- Wann verknotet es am meisten – nach dem Waschen, über Nacht, im Alltag?
- Womit und in welchem Zustand entwirrst du – nass, trocken, Bürste, Kamm?
- Bleiben die Knoten vor allem in den Spitzen hängen?

### Talking Point

> So gehen wir es an: Knoten sind vor allem eine Frage von Gleitfähigkeit und Technik – Conditioner und Leave-in sorgen für Gleitfähigkeit, und du entwirrst in Abschnitten von den Spitzen nach oben, mit breitem Kamm oder den Fingern. Das bringt meistens schon am meisten.
