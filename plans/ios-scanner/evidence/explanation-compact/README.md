# Kompakte Erklärungskarten — zwei Entwürfe

2026-09-12. Entwurf, keine Produktionsänderung. Nick bestätigt die zentrierte Position und wünscht weniger Text und mehr visuelle Aussage. Diese begrenzte Runde entscheidet nur die Hierarchie und Kürzung innerhalb der Karte.

Vorschau: `http://127.0.0.1:8774/explanation-compact/`. Start vom Worktree: `python3 -m http.server 8774 --bind 127.0.0.1 --directory plans/ios-scanner/evidence`. Die Seite funktioniert auch als lokale `index.html` mit relativen Assets. Sie wurde sichtbar in Chrome geöffnet; zusätzlich ist sie im In-App-Browser verfügbar. Der Server bleibt zur Durchsicht an.

## Entscheidung und Empfehlung

**A – Begriff zuerst:** vollständige kurze Definition, danach direkt beschriftete Stufen. Alle möglichen Werte bleiben sichtbar; keine separate Farblegende oder abschließende Wiederholung. [Gerenderte Karte](after-a.png).

**B – Vergleich zuerst, Empfehlung:** große getrennte Werte für Produkt und Ziel, danach vorhandener Zeilenstatus und kurze Definition. Produkt/Ziel sind ohne Entschlüsseln einer Farblegende lesbar. Unbeteiligte Stufen entfallen; die Karte erklärt nicht mehr den gesamten Wertebereich. B ist bei Repair-Pflege ungefähr so hoch wie die aktuelle Karte, gewichtet die Aussage aber wesentlich deutlicher; A ist kompakter. [Gerenderte Karte](after-b.png).

Beide behalten die Definition. Die vorgeschlagene stärkere Verkürzung von Repair-Pflege zu „Unterstützung für strapazierte Längen“ wurde nicht übernommen: Der bestehende Satz erklärt die Ausrichtung der Formel und behauptet keine zusätzliche Wirkung.

## Exakte vorgeschlagene Copy

| Fall | Definition in A und B | Vergleich A | Vergleich B |
|---|---|---|---|
| Repair-Pflege, ordinaler Unterschied | „Wie stark eine Formel auf strapazierte Längen ausgelegt ist.“ (unverändert) | niedrig / **Produkt: mittel** / **Dein Ziel: hoch** | Produkt **mittel** · Dein Ziel **hoch** · **Mit Einschränkung** |
| Haardicke, Produkt deckt alle Kategorien | „Für welche Haardicke die Formel ausgelegt ist.“ | **Produkt geeignet für**: fein / mittel / dick; fein zusätzlich **Dein Haar** | **Produkt für: jede Haardicke** · **Dein Haar: fein** · **Deckt deine Haardicke ab** |
| Pflegegewicht, Übereinstimmung | „Wie reichhaltig die Formel ist. Reichhaltige Pflege kann feines Haar beschweren.“ | **Produkt · Dein Ziel: leicht** / mittel / reichhaltig | Produkt **leicht** · Dein Ziel **leicht** · **Passt** |

Alle drei Beispiele entsprechen der unveränderten synthetischen lokalen Hintergrundtabelle. Der allgemeine Produktstatus „Passt mit Einschränkung“ wird weiterhin durch Repair-Pflege begründet, auch wenn Haardicke oder Pflegegewicht einzeln passen. Keine Ableitung des Zeilenstatus aus dem Gesamturteil.

## Was tatsächlich entfällt

- Bloße Wiederholungen: „WAS BEDEUTET“, separate Produkt/Ziel-Legende und abschließender Satz „Dein Ziel: … · Produkt: …“, soweit diese Werte schon direkt beschriftet sind. Semantische Accessibility-Namen dürfen bei späterer Umsetzung trotzdem dieselben vollständigen Informationen tragen.
- Kategorie-Kontext: „Deine Längen brauchen nach der Wäsche eine verlässliche Basispflege.“ entfällt aus diesen Eigenschaftskarten. Das ist keine Eigenschaftsdefinition. Es entfernt allerdings einen Kontextsatz; bei anderen Kategorien kann `categoryFit` personalisierte Bedeutung tragen. Deshalb keine ungeprüfte pauschale Löschung aus allen Oberflächen oder dem API-Vertrag. Diese Runde schlägt die Entfernung aus den gezeigten Conditioner-Karten vor.
- Haardicke: „: fein, mittel oder dick“ entfällt aus dem Definitionssatz. A nennt diese Kategorien in den Chips; B fasst sie als „jede Haardicke“ zusammen. Kein Rang oder Abstand wird grafisch behauptet.
- Pflegegewicht: „Leicht legt wenig auf, reichhaltig legt mehr auf“ entfällt. Das ist eine echte zusätzliche Abstufungserklärung, nicht nur ein doppeltes Label. Die Beschwerungs-Möglichkeit für feines Haar bleibt explizit. Nick muss diese konkrete Kürzung vor Umsetzung wählen oder ablehnen.
- Nur B: Unbeteiligte Stufen entfallen aus der Karte. Für teilweise geeignete Haardicken muss B später alle tatsächlich unterstützten `productStopIds` benennen, nicht den teilweise auf die Zielüberschneidung reduzierten `productValue`. „Jede“ ist nur bei vollständig belegter Eignungsmenge zulässig. Bei unbekannten/fehlenden Werten dürfen weder „passt“ noch „deckt ab“ erfunden werden.

## Herkunft und Grenzen

Aktueller Renderer: `ios/Chaarlie/Assessment/AssessmentSheet.swift:241-296`; Zeilenvergleich: `:176-204`. Tatsächliche Definitionen und Mengenwerte: `src/lib/mobile/result-presentation.ts:17-64`. Kategorie-Kontext stammt aus `fitNarrative.fit`, pro Zeile weitergereicht in `src/lib/mobile/scan-service.ts:163`; lokaler Conditioner-Satz aus `src/lib/personal-plan/decision-presentation.ts:149`. Mengenachse: `src/lib/personal-plan/products/comparison-dimensions.ts:227`; Repair-Stufen: `:476`; vorhandene Repair-Bewertung aus `authority/categories/axis-fit.ts:18`. Ein begrenzter read-only Semantik-Audit prüfte diese Pfade; die Hauptsession verantwortet Copy und Entwürfe.

[Vorher](before.png): byteidentische Kopie der tatsächlichen lokalen App-Aufnahme `../../implementation-evidence/info-position-connected.png`. `result-background.png` ist ein frischer, unveränderter Simulator-Screenshot nach Schließen der Karte. Keine personenbezogenen Daten. Fonts aus `../fonts/`, Farben und Größen aus `ios/Chaarlie/App/Theme.swift`. Karten: 20px Radius, 16px Seitenrand, vorhandene sichere Zentrierung, 32% Abdunklung. Normale Definition13px und Stufen12px entsprechen dem aktuellen Renderer; keine Schrift wurde zum Kürzen verkleinert. Der normale Review zeigt einen zentralen Bildschirmausschnitt; die vollständige402×874-Geometrie darunter bleibt bestehen.

[Repair-Vergleich](repair-comparison.png), [Haardicke-Vergleich](thickness-comparison.png), [große Schrift A](large-a.png), [große Schrift B](large-b.png). Beide Hierarchien und Fälle wurden gerendert und visuell geprüft. Große Schrift stapelt die Vergleichselemente, statt Text zu kürzen; die Karte bleibt begrenzt und die Schließen-Taste außerhalb des Scrollers. Die Browserprobe nutzt25px Definition,34px Titel und gestapelte Werte. Dies ist kein nativer Dynamic-Type-/VoiceOver-Nachweis. Die bereits geprüfte native Positionierung/Fade/Reduce-Motion-Implementierung bleibt unverändert; diese statischen Vorschläge ersetzen keine erneute native Prüfung nach späterer Umsetzung.

## Abdeckung / nächster Handoff

Status: **pending für Umsetzung**, Entwurfsauftrag abgeschlossen.

- Bestätigt mit Nick: weniger Text/mehr Signal; freigegebene zentrierte Position, stationäres Ergebnisblatt, Übergänge und Größenverhalten bleiben; Ergebnis-Tabelle unverändert.
- Aus Vertrag übernommen: bestehende Werte, Mengen-/Ordnungssemantik, zeilenbezogene Bewertungsautorität und aktuelle Typografie/Farben.
- Implementierungsdefaults dieses Belegs: lokale HTML/CSS/JS-Vorschau, synthetische Werte, Umschalter nur zur Durchsicht, keine API-Aufrufe/Persistenz oder Installation.
- Offene folgenreiche Auswahl vor Umsetzung: A/B; Weglassen des Kategorie-Kontexts in den gezeigten Karten; explizite Pflegegewicht-Kürzung; B ohne unbeteiligte Stufen und mit direkt benanntem Eignungsstatus. Weitere Kategorie-Copy ist nicht mit diesen Beispielen pauschal freigegeben.
- Undiscussed consequential assumptions affecting this handoff: none. Alle offenen Punkte sind oben genannt; keine Implementierungsfreigabe wird unterstellt.

Nach Nicks Auswahl: gewählte Copy und sichtbaren Info-Öffnen/Lesen/Schließen-Ablauf kurz bestätigen, dann über den bestehenden Implementierungsworkflow umsetzen. Diese Runde enthält keinen neuen vollständigen Implementierungsplan und keine erneute Gesamt-/Backend-/Claude-Prüfung. Alle Artefakte hier als Entwurfsevidenz behalten; HTML-Umschalter nicht in Produktion übernehmen. Der bisherige159-Dateien-Prüffingerprint gilt dem vorigen Implementierungsstand; diese zusätzlichen Entwurfsdateien erweitern nur das Planungspaket.
