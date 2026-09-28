# Guardrails (Consult-Brief)

Harte Regeln für den Consult-Brief-Generator. Sie gelten für Prompt und deterministischen Lint (`src/lib/discovery/consult-brief/lint.ts`) und gehen jedem Wissensbasis-Eintrag vor. Bei Konflikt gewinnt diese Datei.

Grundlage: `docs/research/concern-recipes/README.md` (Scope-Grenze, Wording), EU-Claims-Verordnung 655/2013 (wahrheitsgemäß, belegbar, redlich).

## G1 — Verbotene Formulierungen

Gilt für jeden Text im Brief, auch für Formulierungshilfen.

**Heil- und Reparaturversprechen für Haarschäden.** Nicht verwenden, in keiner Beugung:

- „repariert", „reparieren", „Reparatur" (als Wirkung am Haar)
- „heilt", „heilen", „Heilung"
- „wie neu", „wie früher", „macht rückgängig", „rückgängig machen"
- „regeneriert", „baut das Haar wieder auf", „stellt wieder her"
- „lässt Haare wachsen", „stoppt Haarausfall", „gegen Haarausfall"

Auch verneint vermeiden („nicht wie neu", „heilt nicht"): der Lint prüft Phrasen, nicht Satzlogik. Stattdessen positiv und ehrlich formulieren („wird nicht wieder intakt", „wächst raus oder wird geschnitten").

Erlaubt stattdessen: „glättet die Oberfläche", „macht geschmeidiger", „schützt vor weiterem Bruch", „fühlt sich weniger rau an", „kann unterstützen".

Ausnahme: Produktnamen und Kategorie-Bezeichnungen, wie sie in Verdicts stehen (z. B. ein Produkt mit „Repair" im Namen), dürfen zitiert werden. Der Brief macht sich die Aussage nicht zu eigen.

**Garantie-Charakter.** Nicht verwenden: „garantiert", „auf jeden Fall", „100 %", „sicher weg", „nie wieder", „komplett frizzfrei", „für immer".

**Score als Zusage.** Der Haar-Score ist eine Einschätzung, kein Versprechen. Nicht: „du kommst auf 8", „dein Score steigt auf …". Erlaubt: „Ziel ist …", „realistisch ist eher …".

## G2 — Medizinische Grenz-Zeile (Pflicht)

Jeder Brief enthält die Grenz-Zeile, sinngemäß:

> Vermehrter Ausfall mit Wurzel, lichter werdendes Haar oder eine starke Kopfhautreaktion (anhaltendes Jucken, Rötung, Brennen, Schmerzen, nässende oder verkrustete Stellen) gehört ärztlich abgeklärt, dermatologisch oder hausärztlich.

Regeln:

- Die Zeile steht immer im Brief, auch wenn das Profil nichts davon nahelegt.
- Sie wird nie relativiert: kein „wahrscheinlich harmlos", kein „erst mal abwarten", kein „probier vorher …".
- Kein Produkt, keine Kategorie und kein Pflegehebel wird als Antwort auf Haarausfall oder lichter werdendes Haar angeboten. Pflege für die Längen darf laufen, mit dem ausdrücklichen Satz, dass sie den Ausfall nicht behandelt.
- Kopfhaut-Themen bleiben kosmetisch nur, solange sie mild und unkompliziert sind. Hält es an oder ist es entzündlich: Grenz-Zeile.
- Keine Diagnosen. Nicht „du hast seborrhoisches Ekzem" oder „das ist ein Pilz". Erlaubt: „das sollte man ärztlich anschauen lassen".

## G3 — Erwartungs-Grenzen

- **Ziel-Score nie 10.** Das höchste genannte Ziel ist 9, in der Regel realistischer darunter.
- **Strukturell kaputte Längen** (gespalten, gebrochen, durch Blondierung oder Hitze stark geschädigt) werden durch Pflege nicht wieder intakt. Sie fühlen sich besser an und brechen weniger weiter. Wirklich besser werden sie nur über Schnitt und Rauswachsen.
- **Ehrliche Zeitfenster**, nie kürzer formulieren:

| Wirkbereich                                       | Zeitfenster               | Anmerkung                                                         |
| ------------------------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| Kämmbarkeit, weniger Kämmbruch, Geschmeidigkeit   | 2–4 Wochen                | ab der ersten Wäsche spürbar, stabil nach einigen Wäschen         |
| Kopfhaut (Fettigkeit, Spannen, trockene Schuppen) | 2–4 Wochen                | Re-Check nach 4–6 Wochen; ohne Besserung Grenz-Zeile              |
| Glanz                                             | mit der Oberflächenpflege | hält nur, solange gepflegt wird; kein Dauereffekt                 |
| Geschädigte Längen insgesamt                      | Monate                    | nur über Schnitt und Rauswachsen; Haar wächst grob 1 cm pro Monat |

## G4 — Verdicts und Produkte

- Der Brief widerspricht keinem Verdict. Ein Produkt mit „passt nicht" wird nie als „behalten" empfohlen. Soll es aus einem nachvollziehbaren Grund bleiben (z. B. aufbrauchen), nennt der Brief den Verdict ausdrücklich dazu.
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
