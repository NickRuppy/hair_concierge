# Guardrails (Consult-Brief)

Verbindliche Regeln für jeden Text im Brief, auch für übernommene Formulierungshilfen. Nick übernimmt Sätze aus dem Brief wörtlich in den Call — jede Regel gilt deshalb so, als läse die Teilnehmerin mit. Jede Regel gilt sinngemäß: Die Beispiel-Listen zeigen die Grenze, sie sind nicht abschließend.

Ton: ehrliche, interessierte Fachberatung — wie eine vertraute Friseurin oder ein guter Hausarzt. Sagen, was gut belegt ist; sagen, was Erfahrungswert ist; sagen, was kaum untersucht ist. Ehrlichkeit heißt benennen und einordnen, nicht schweigen — und nicht versprechen.

## G1 — Wirkung ehrlich beschreiben

**Regel:** Beschreibe Pflegewirkung nur so, wie Pflege tatsächlich wirkt: Oberfläche glätten, geschmeidiger machen, Reibung und weiteren Bruch reduzieren, Glanz geben, schützen. Bereits geschädigtes Haar wird durch Pflege nicht wieder intakt; wirklich besser wird es nur über Schnitt und Rauswachsen.

**Warum:** Diese Sätze werden im Call laut ausgesprochen. Ein Reparatur- oder Heilversprechen ist kosmetikrechtlich irreführend und in Woche 4 eine gebrochene Zusage — genau das Gegenteil von Vertrauen.

**Nie — in keiner Beugung, auch nicht verneint, auch nicht sinngemäß umschrieben:**

- „repariert“, „heilt“, „Heilung“, „wie neu“, „wie früher“, „macht rückgängig“
- „regeneriert“, „baut das Haar wieder auf“, „stellt wieder her“
- „verschließt Spliss“, „versiegelt Spliss“, „Spliss weg“
- „verdickt das Haar“, „mehr Haare“, „stärkt die Wurzel“, „lässt Haare wachsen“
- „stoppt Haarausfall“, „gegen Haarausfall“ als Pflege-Aussage (ärztliche Wirkstoffe: siehe G1b)
- „Hitzeschutz schützt komplett“ oder sinngemäß vollständiger Schutz

Auch verneint bleiben diese Formulierungen draußen („heilt nicht“, „nicht wie neu“): formuliere positiv und ehrlich, was stattdessen gilt.

**Stattdessen:** „glättet die Oberfläche“, „macht geschmeidiger“, „schützt vor weiterem Bruch“, „fühlt sich weniger rau an“, „reduziert den Schaden“, „kann unterstützen“, „wird nicht wieder intakt — wächst raus oder wird geschnitten“.

**Absolute Aussagen:** kein „garantiert“, „100 %“, „auf jeden Fall“, „sicher weg“, „nie wieder“, „für immer“, „komplett frizzfrei“ — und keine absoluten Abwertungen („da hilft nichts“, „bringt gar nichts“, „keine Pflege kommt hinterher“). Stattdessen: „bringt wenig“, „kommt Pflege kaum hinterher“.

**Score:** Der Haar-Score ist eine Einschätzung, kein Versprechen. Score-Zahlen, Zielwerte und Deltas stehen ausschließlich im Feld `points`, nie im Text — auch nicht als „Ziel ist 8“. Im Text bleibt die Richtung qualitativ („da ist realistisch Luft nach oben“).

**Produktnamen:** Ein Name wie „Repair-Maske“ wird wörtlich zitiert, ohne eigene Wirkaussage im selben Satz. Der Brief macht sich den Namen nicht zu eigen.

## G1a — Keine Diagnose durch Schlussfolgerung

**Regel:** Der Brief stellt keine Diagnosen und schreibt der Kopfhaut keine Ursachen zu — kein „klingt nach …“, „typisch für …“, „ist bestimmt nur …“, „das ist sicher …“, „deine Schuppen kommen vom Shampoo“, „das ist ein Pilz“, „das sind Hormone“.

**Warum:** Eine Ferndiagnose aus Quiz-Daten ist unseriös und kann eine nötige ärztliche Abklärung verzögern.

**Stattdessen:** Muster benennen plus Prüfweg: „Feine, weiße Schuppen mit Spannen passen eher zu trockener Kopfhaut — das prüfen wir in 4 Wochen; wird es nicht ruhiger, ärztlich anschauen lassen.“

## G1b — Medizinisches benennen ja, empfehlen nie

**Regel:** Nahrungsergänzungsmittel (Biotin, Zink, Eisen …) und Arzneiwirkstoffe (Minoxidil, Kortison, medizinisches Ketoconazol …) werden nie empfohlen und nie dosiert. Faktisch benennen ist erlaubt, wenn es die Erwartung ehrlich macht — Existenz, grobes Wirkprinzip, Grenze — und derselbe Satz die Entscheidung ärztlich verortet.

**Warum:** Zur ehrlichen Beratung gehört der Satz, dass es gegen Haarausfall ärztliche Optionen gibt und Pflege keine ist. Auswahl, Eignung und Dosierung sind aber Arztsache — alles darüber hinaus wäre Therapieberatung ohne Befund.

**Erlaubt z. B.:** „Gegen Haarausfall gibt es ärztliche Wirkstoffe, die nur wirken, solange man sie anwendet — ob so etwas für sie passt, gehört in ärztliche Hand.“ / „Kosmetische Kopfhaut-Seren dazu sind kaum untersucht.“

**Nie:** „probier Minoxidil“, Dosierungen und Anwendungsschemata, Bezugsquellen, Wirkstoff-Nennung ohne ärztliche Verortung im selben Satz. Kosmetische Anti-Schuppen-Shampoos als Kategorie sind erlaubt; ihre Wirkstoffe werden nicht als Therapie beschrieben.

## G1c — Keine Inhaltsstoff-Mythen

**Regel:** Mythen werden nie verwendet oder bestätigt: „Silikone ersticken das Haar“, „Silikone sind schädlich“, „Sulfate sind giftig“, „chemiefrei“, „Detox“ für Haar oder Kopfhaut, der Porositäts-Schwimmtest als Diagnose.

**Warum:** Wer Mythen bedient, verspielt genau die fachliche Glaubwürdigkeit, auf der die Beratung steht.

**Stattdessen:** sachlich einordnen: „Silikone sind nicht schädlich — die Frage ist nur, ob dein Haar den Film gerade braucht.“

## G2 — Medizinische Grenze

**Regel:** Die Grenz-Zeile steht wörtlich als letzter Eintrag in `erwartungen` — der Generator hängt sie automatisch an; der übrige Text hat sie nie relativiert und relativiert sie nie (kein „wahrscheinlich harmlos“, „erst mal abwarten“, „probier vorher …“):

> Vermehrter Ausfall mit Wurzel, lichter werdendes Haar oder eine starke Kopfhautreaktion (anhaltendes Jucken, Rötung, Brennen, Schmerzen, nässende oder verkrustete Stellen) gehört ärztlich abgeklärt, dermatologisch oder hausärztlich.

**Bei Haarausfall oder lichter werdendem Haar:** kein Produkt, keine Kategorie und kein Pflegehebel als Antwort darauf. Pflege für die Längen darf laufen — dann mit genau diesem Satz: „Die Pflege betrifft nur die Längen; der Ausfall gehört ärztlich abgeklärt.“ Ehrliche Einordnung ärztlicher Optionen: siehe G1b.

**Trigger-Quelle:** Maßgeblich ist das Feld `boundaryTriggers` im Input. Klingt Freitext nach einem Trigger, ohne dass das Feld gesetzt ist, wird daraus eine `callFragen`-Frage, nie ein Befund.

**Trigger (führen zum ärztlichen Verweis statt kosmetischer Schritte):** kahle oder lichte Stellen, sichtbar breiterer Scheitel; plötzlicher oder büschelweiser Ausfall; Ausfall nach Geburt, Fieber, OP, starkem Gewichtsverlust oder Medikamentenwechsel; Schmerz, Brennen, anhaltendes Jucken, Rötung, Pusteln, nässende oder verkrustete Stellen; Schuppen, die trotz regelmäßigem Anti-Schuppen-Shampoo über Wochen bleiben; akute Reaktion nach Färben oder Blondieren (Schwellung, starkes Brennen, Blasen) — sofort ärztlich.

**Kopfhaut-Themen** bleiben kosmetisch nur, solange sie mild und unkompliziert sind; stufenweise kosmetische Schritte (erst mild, dann Anti-Schuppen-Shampoo) gelten nur ohne G2-Trigger.

## G3 — Ehrliche Erwartungen

**Regel:** Zeitfenster nie kürzer nennen als hier; `points`-Werte so wählen, dass Baseline plus Summe nie über 9 liegt — eine 10 wird nie in Aussicht gestellt. Haarausfall und Dichte bekommen kein Pflege-Zeitfenster (nur G2).

| Wirkbereich                                       | Zeitfenster               | Anmerkung                                                                                   |
| ------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- |
| Kämmbarkeit, weniger Kämmbruch, Geschmeidigkeit   | 2–4 Wochen                | Kämmbarkeit oft ab der ersten Wäsche spürbar; 2–4 Wochen = stabil weniger Bruch beim Kämmen |
| Kopfhaut (Fettigkeit, Spannen, trockene Schuppen) | 2–4 Wochen                | Re-Check nach etwa 4 Wochen; ohne Besserung nächster Schritt bzw. Grenz-Zeile               |
| Glanz                                             | mit der Oberflächenpflege | hält nur, solange gepflegt wird; kein Dauereffekt                                           |
| Geschädigte Längen insgesamt                      | Monate                    | nur über Schnitt und Rauswachsen; Haar wächst grob 1 cm pro Monat                           |

**Warum:** Zu früh versprochene Wirkung ist die häufigste Quelle für Enttäuschung beim Re-Score.

## G4 — Verdicts und Produkte sind Fakten

**Regel:** Der Brief widerspricht keinem Verdict und erfindet keine Produkte.

- Ein Produkt mit „passt nicht“ wird nie gelobt und nie als „behalten“ empfohlen; bleibt es aus gutem Grund (z. B. aufbrauchen), steht „passt nicht“ im selben Satz.
- Von einem Produkt mit „passt“ wird nicht abgeraten; ein Wissensbasis-Eintrag darf Menge, Platzierung und Rhythmus ansprechen, nie den Verdict kippen.
- Genannt werden nur Produkte aus dem Input (`name`, `swapTarget`, `swapOptions`), exakt so geschrieben. Fehlt ein passendes Produkt, wird die Kategorie ohne Marke genannt oder eine `callFragen`-Frage daraus — nie ein Produkt aus dem Allgemeinwissen.
- Swap-Reihenfolge und Routine kommen aus den Engines: erklären, nie umsortieren.

**Warum:** Die Engines sind die geprüfte Faktenbasis; ein Brief, der ihnen widerspricht oder Produkte erfindet, macht das Cockpit unglaubwürdig.

## G5 — Unsicherheit ehrlich, aber ohne Zahlen

**Regel:** Evidenz wird in Alltagssprache eingeordnet — „gut untersucht“, „eher Erfahrungswert aus der Beratung“, „dazu gibt es kaum Forschung“ — nie mit Prozentwerten, Zahlen-Scores, Fachvokabeln wie „moderate Evidenz“ oder „Studienlage schwach“ und nie mit Confidence-Angaben. Das interne `evidence`-Feld steuert die Wortwahl und erscheint nie selbst im Text.

**Warum:** Die ehrliche Einordnung macht die Beratung glaubwürdig (das darf sie sagen); Zahlen und Evidenz-Jargon suggerieren eine Präzision, die es hier nicht gibt.

**Stattdessen bei dünner Lage:** „kann helfen“, „einen Versuch wert“, „ist kaum untersucht — wenn, dann als Versuch mit klarem Check-Termin“.

## G6 — Sprache

- Deutsch, Beratungssprache, telegram-knapp, keine archaischen Imperative („Wisse …“, „Bedenke …“).
- Brief-Felder (`diagnose`, `hebel`, `swapReasons`, `zielLuecken`, `erwartungen`): neutral in der dritten Person über die Teilnehmerin. Du-Form nur in `callFragen` und in den `## Im Call`-Formulierungshilfen der Wissensbasis.
- Kosmetische und medizinisch-angrenzende Aussagen stehen nie im selben Satz.

## Falsch → Richtig

- „Die Maske repariert die Längen.“ → „Die Maske glättet die Oberfläche; die Längen brechen weniger weiter. Was kaputt ist, wächst raus oder wird geschnitten.“
- „Pflege hilft nicht gegen Haarausfall.“ → „Die Pflege betrifft nur die Längen; der Ausfall gehört ärztlich abgeklärt.“
- „Das klingt nach einem Pilz.“ → „Das passt eher zu einer gereizten Kopfhaut — hält es an, ärztlich anschauen lassen.“
- „Nimm Biotin, das stärkt die Wurzel.“ → „Nahrungsergänzung gehört in die ärztliche Abklärung, nicht in den Pflegeplan.“
- „Mit dem Plan kommst du auf 8 von 10.“ → „Realistisch ist spürbar mehr Geschmeidigkeit in 2–4 Wochen; wie weit der Score mitgeht, zeigt der Re-Score.“
- „Hitzeschutz schützt dein Haar komplett.“ → „Hitzeschutz reduziert den Schaden — weniger Hitze bleibt der größere Hebel.“
