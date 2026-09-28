# Guardrails (Consult-Brief)

Harte Regeln für den Consult-Brief-Generator. Sie gelten für Prompt und deterministischen Lint (`src/lib/discovery/consult-brief/lint.ts`) und gehen jedem Wissensbasis-Eintrag vor. Bei Konflikt gewinnt diese Datei.

Grundlage: `docs/research/concern-recipes/README.md` (Scope-Grenze, Wording) und `recipes.md` (Grenze `hair_loss_or_thinning`), EU-Claims-Verordnung 655/2013 (wahrheitsgemäß, belegbar, redlich).

## G1 — Verbotene Formulierungen

Gilt für jeden Text im Brief, auch für Formulierungshilfen.

**Heil- und Reparaturversprechen für Haarschäden.** Nicht verwenden, in keiner Beugung:

- „repariert", „reparieren", „Reparatur" (als Wirkung am Haar)
- „heilt", „heilen", „Heilung"
- „wie neu", „wie früher", „macht rückgängig", „rückgängig machen"
- „regeneriert", „baut das Haar wieder auf", „stellt wieder her"
- „lässt Haare wachsen", „stoppt Haarausfall", „gegen Haarausfall"

**Weitere verbotene Wirkphrasen:**

- „verschließt Spliss", „versiegelt Spliss", „Spliss weg"
- „verdickt das Haar", „mehr Haare", „stärkt die Wurzel"
- „Hitzeschutz schützt komplett" oder sinngemäß vollständiger Schutz. Erlaubt: „Hitzeschutz reduziert den Schaden".

**Absolute Negativ-Aussagen.** Nicht: „keine Pflege kommt hinterher", „da hilft nichts", „bringt gar nichts". Erlaubt: „kommt Pflege kaum hinterher", „bringt wenig".

Auch verneint vermeiden („nicht wie neu", „heilt nicht"): der Lint prüft Phrasen, nicht Satzlogik. Stattdessen positiv und ehrlich formulieren („wird nicht wieder intakt", „wächst raus oder wird geschnitten").

Erlaubt stattdessen: „glättet die Oberfläche", „macht geschmeidiger", „schützt vor weiterem Bruch", „fühlt sich weniger rau an", „kann unterstützen".

Ausnahme: Produktnamen und Kategorie-Bezeichnungen, wie sie in Verdicts stehen (z. B. ein Produkt mit „Repair" im Namen), dürfen zitiert werden. Der Brief macht sich die Aussage nicht zu eigen.

**Garantie-Charakter.** Nicht verwenden: „garantiert", „auf jeden Fall", „100 %", „sicher weg", „nie wieder", „komplett frizzfrei", „für immer".

**Score als Zusage.** Der Haar-Score ist eine Einschätzung, kein Versprechen. Verboten sind Zielwerte als Zusage („du kommst auf 8", „dein Score steigt auf …") und Score-Deltas als Versprechen („+2 Punkte", „zwei Punkte mehr"). Erlaubt: „Ziel ist …", „realistisch ist eher …".

## G1a — Keine Diagnose durch Schlussfolgerung

- Nicht: „klingt nach …", „typisch für …", „ist bestimmt nur …", „das ist sicher …".
- Keine kausalen Zuschreibungen an der Kopfhaut („deine Schuppen kommen vom Shampoo", „das ist ein Pilz", „das sind Hormone").
- Erlaubt: „passt eher zu …" plus Check („… das prüfen wir in 4 Wochen", „… wenn nicht, ärztlich anschauen lassen").

## G1b — Keine Nahrungsergänzung, keine Arzneiwirkstoffe

- Keine Empfehlung von Nahrungsergänzungsmitteln (z. B. Biotin, Zink, Eisen) und keine Dosierungen.
- Keine Arzneiwirkstoffe oder medizinischen Anwendungen (z. B. Minoxidil, Kortison, medizinisches Ketoconazol) und keine Dosierungen.
- Kosmetische Anti-Schuppen-Shampoos als Kategorie sind erlaubt; Wirkstoffe werden nicht als Therapie beschrieben.

## G1c — Keine Inhaltsstoff-Mythen

Nicht verwenden oder bestätigen:

- „Silikone ersticken das Haar", „Silikone sind schädlich"
- „Sulfate sind giftig"
- „chemiefrei", „ohne Chemie"
- „Detox" für Haar oder Kopfhaut
- Porositäts-Schwimmtest (Haar im Wasserglas) als Diagnose

Sagt die Teilnehmerin so etwas, wird es sachlich eingeordnet, nicht bestätigt.

## G2 — Medizinische Grenz-Zeile (Pflicht)

Jeder Brief enthält die Grenz-Zeile, sinngemäß:

> Vermehrter Ausfall mit Wurzel, lichter werdendes Haar oder eine starke Kopfhautreaktion (anhaltendes Jucken, Rötung, Brennen, Schmerzen, nässende oder verkrustete Stellen) gehört ärztlich abgeklärt, dermatologisch oder hausärztlich.

Regeln:

- Die Zeile steht immer im Brief, auch wenn das Profil nichts davon nahelegt.
- Sie wird nie relativiert: kein „wahrscheinlich harmlos", kein „erst mal abwarten", kein „probier vorher …".
- Kein Produkt, keine Kategorie und kein Pflegehebel wird als Antwort auf Haarausfall oder lichter werdendes Haar angeboten. Pflege für die Längen darf laufen, mit dem ausdrücklichen Satz, dass sie den Ausfall nicht behandelt.
- Kopfhaut-Themen bleiben kosmetisch nur, solange sie mild und unkompliziert sind. Hält es an oder ist es entzündlich: Grenz-Zeile.
- Keine Diagnosen (siehe G1a). Erlaubt: „das sollte man ärztlich anschauen lassen".

**Trigger für ärztliche Abklärung** (nach `concern-recipes/recipes.md`, Grenze `hair_loss_or_thinning`). Nennt die Teilnehmerin eins davon, verweist der Brief ärztlich statt kosmetisch:

- kahle oder lichte Stellen, sichtbar breiterer Scheitel, lichter Oberkopf
- plötzlicher oder büschelweiser Ausfall
- Ausfall nach Geburt, Fieber, OP, starkem Gewichtsverlust oder Medikamentenwechsel
- Schmerz, Brennen, anhaltendes Jucken, Rötung, Pusteln, nässende oder verkrustete Stellen an der Kopfhaut
- Schuppen, die trotz regelmäßig genutztem Anti-Schuppen-Shampoo über Wochen bleiben
- akute Reaktion nach Färben oder Blondieren (Schwellung, starkes Brennen, Blasen): **sofort** ärztlich

## G3 — Erwartungs-Grenzen

- **Ziel-Score nie 10.** Das höchste genannte Ziel ist 9, in der Regel realistischer darunter.
- **Strukturell kaputte Längen** (gespalten, gebrochen, durch Blondierung oder Hitze stark geschädigt) werden durch Pflege nicht wieder intakt. Sie fühlen sich besser an und brechen weniger weiter. Wirklich besser werden sie nur über Schnitt und Rauswachsen.
- **Haarausfall und Dichte bekommen kein Pflege-Zeitfenster.** Dafür gilt nur G2.
- **Ehrliche Zeitfenster**, nie kürzer formulieren:

| Wirkbereich                                       | Zeitfenster               | Anmerkung                                                                                   |
| ------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- |
| Kämmbarkeit, weniger Kämmbruch, Geschmeidigkeit   | 2–4 Wochen                | Kämmbarkeit oft ab der ersten Wäsche spürbar; 2–4 Wochen = stabil weniger Bruch beim Kämmen |
| Kopfhaut (Fettigkeit, Spannen, trockene Schuppen) | 2–4 Wochen                | Re-Check nach etwa 4 Wochen; ohne Besserung nächster Schritt bzw. Grenz-Zeile               |
| Glanz                                             | mit der Oberflächenpflege | hält nur, solange gepflegt wird; kein Dauereffekt                                           |
| Geschädigte Längen insgesamt                      | Monate                    | nur über Schnitt und Rauswachsen; Haar wächst grob 1 cm pro Monat                           |

## G4 — Verdicts und Produkte

- Der Brief widerspricht keinem Verdict. Ein Produkt mit „passt nicht" wird nie als „behalten" empfohlen. Soll es aus einem nachvollziehbaren Grund bleiben (z. B. aufbrauchen), nennt der Brief den Verdict ausdrücklich dazu.
- Umgekehrt rät der Brief nicht pauschal von einem Produkt mit „passt" ab. Ein Wissensbasis-Eintrag darf Menge, Platzierung oder Rhythmus ansprechen, aber keinen Verdict kippen.
- Der Brief nennt nur Produkte, die in Verdicts, Swaps oder Buckets der Teilnehmerin vorkommen. Keine erfundenen Produkte, keine Marken aus dem Allgemeinwissen.
- Swap-Rankings und Routine-Gerüst kommen aus den Engines. Der Brief erklärt sie, er sortiert sie nicht um.

## G5 — Unsicherheit bleibt intern

- `evidence` aus der Wissensbasis und Engine-Confidence steuern nur, wie vorsichtig formuliert wird.
- Formulierungshilfen enthalten keine Prozentwerte, keine Evidenzgrade („moderate Evidenz", „Studienlage schwach"), keine Confidence-Angaben.
- Wo die Evidenz dünn ist, wird vorsichtig formuliert („kann helfen", „einen Versuch wert", „schauen wir uns an"), nicht mit Zahlen belegt.

## G6 — Sprache

- Deutsch, Du-Form, Beratungssprache, telegram-knapp.
- Keine archaischen Imperative („Wisse …", „Bedenke …").
- Kosmetische und medizinisch-angrenzende Aussagen stehen nie im selben Satz.
