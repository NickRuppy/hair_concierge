# Fragen für Tom

<!-- Notizblock: offene Fragen + vorrecherchierte Optionen -->

---

## 1. Offene Fragen

2. **Naming / Branding der App:** Tom hat "The Beautiful People" als Marke und "The Beautiful Community". Wäre "The Beautiful Hair" als App-Name eine Option?

5. **Haarmenge (Haardichte) abfragen?** Im Skool-Kurs wird Haardichte z.B. bei der Conditioner-Entscheidung erwähnt. Für welche Produktkategorien spielt sie eine Rolle?

8. **Shampoo-Matrix: "Trocken" = auch trockene weiße Schuppen?** In der Shampoo-Tabelle gibt es die Spalte "Trocken" (trockene Kopfhaut). Sind damit auch trockene weiße Schüppchen (dry flakes) gemeint, oder ist das ein separater Zustand?

10. **Shampoo bei Schuppen: nur Anti-Schuppen oder Kombi?** Wenn jemand Schuppen hat, soll er/sie ausschließlich ein Anti-Schuppen-Shampoo verwenden (bis das Problem weg ist), oder zusätzlich ein normales Shampoo passend zum Kopfhauttyp im Wechsel nutzen?

### Offen — für Jonas klären

1. **Subscription-Tiers / Monetarisierung:** Wird es verschiedene Abo-Stufen geben (z.B. Free / Pro / Premium)? Welche Features gehören in welchen Tier (Routine-Tracking, Haarbilder-Analyse, individuelle Beratung buchen)? -> for now not

---

## 2. Optionen & Vorschläge

Vorrecherchiert anhand unserer Codebase und bestehenden Daten. Jede Frage hat 2–3 Optionen und einen Vorschlag.

---

### Frage 2: Naming / Branding

Keine technische Recherche nötig — reine Markenfrage für Tom.

| Option | Beschreibung |
|--------|-------------|
| **A: "The Beautiful Hair"** | Fügt sich in die bestehende "The Beautiful …"-Markenfamilie ein. Klar, einprägsam, direkt beim Thema. |
| **B: "Hair Concierge by The Beautiful People"** | Nutzt den bestehenden Markennamen als Absender, gibt der App aber einen eigenständigen Namen. |
| **C: Komplett eigenständiger Name** | Unabhängig von der "The Beautiful"-Marke. Mehr Freiheit, aber weniger Synergien. |

**Vorschlag:** Option A — einfach, konsistent, und sofort als Teil des Ökosystems erkennbar.

---

### Frage 5: Haarmenge (Haardichte) abfragen

**Aktueller Stand:** `density` (low/medium/high) existiert bereits als Feld! Es wird im Onboarding nach dem Quiz abgefragt (`OnboardingDensity`-Komponente) und ist in `hair_profiles.density` gespeichert. Es fließt bereits in die **Conditioner**- und **Leave-in**-Empfehlung ein.

| Option | Beschreibung | Auswirkung |
|--------|-------------|------------|
| **A: Bestätigen, dass Density reicht** | Wir haben es bereits — Tom nur fragen, ob es auch für Masken/Shampoo relevant ist. | Ggf. `density` auch in den Mask-Reranker einbauen (Weight-Fit pro Density). |
| **B: Density in den Quiz-Flow verschieben** | Statt im Post-Quiz-Onboarding direkt als Quiz-Frage integrieren, damit es prominenter ist. | UI-Änderung im Quiz, kein DB-Änderung. |
| **C: Density für alle Kategorien nutzen** | Density als Faktor in Shampoo, Mask, und ggf. auch Styling-Empfehlungen einbauen. | Erweiterung der Reranker für Shampoo und Mask. |

**Vorschlag:** Option A — bestätigen lassen, welche Kategorien Density brauchen. Feld existiert bereits, wir müssen es nur ggf. in weitere Pipelines einbauen.

---

### Frage 8: Shampoo-Matrix — "Trocken" = dry flakes?

**Aktueller Stand:** Wir haben `scalp_condition` mit den Werten `none`, `dandruff`, `dry_flakes`, `irritated`. Für Shampoo matchen wir `dry_flakes` separat von `dandruff`. Die Shampoo-Tabelle hat aber die Spalte "Trocken" (trockene Kopfhaut) — und es ist unklar, ob trockene weiße Schuppen (dry flakes) unter "Trocken" fallen oder eher unter "Schuppen".

| Option | Beschreibung | Auswirkung |
|--------|-------------|------------|
| **A: "Trocken" umfasst dry flakes** | Trockene Kopfhaut und trockene weiße Schüppchen sind dasselbe Problem (Feuchtigkeitsmangel der Kopfhaut). `dry_flakes` → Shampoo-Spalte "Trocken". | Einfachste Zuordnung. `dry_flakes` und `dry` Kopfhaut bekommen dieselben Shampoos. |
| **B: Dry flakes = eigene Kategorie** | Trockene Schüppchen sind ein Zwischenzustand zwischen "Trocken" und "Schuppen" und brauchen ggf. andere Wirkstoffe. | Neue Spalte in der Shampoo-Matrix nötig, oder eine Misch-Logik (Produkte aus beiden Spalten). |
| **C: Dry flakes → "Schuppen"-Spalte** | Auch wenn es keine fettigen Schuppen sind, behandelt man sie mit Anti-Schuppen-Shampoos. | `dry_flakes` wird wie `dandruff` gemappt. Könnte aber zu aggressiv sein für trockene Kopfhaut. |

**Vorschlag:** Option A — trockene Schüppchen sind meistens ein Symptom trockener Kopfhaut, nicht von Schuppen (Malassezia). Aber unbedingt von Tom bestätigen lassen, weil die Behandlung sich unterscheidet.

---

### Frage 10: Schuppen — nur Anti-Schuppen-Shampoo oder Kombi?

**Aktueller Stand:** Unser Shampoo-Matching empfiehlt aktuell **ein** Shampoo basierend auf scalp_condition. Bei `dandruff` oder `dry_flakes` werden Anti-Schuppen-Shampoos empfohlen. Es gibt keine Logik für eine Zwei-Shampoo-Empfehlung (Behandlung + reguläre Pflege).

| Option | Beschreibung | Auswirkung |
|--------|-------------|------------|
| **A: Nur Anti-Schuppen bis Problem gelöst** | Nutzer bekommt ausschließlich ein Anti-Schuppen-Shampoo. Sobald Schuppen weg → normales Shampoo für den Kopfhauttyp. | Keine Änderung nötig. Ggf. Hinweis im Chat: "Wenn die Schuppen weg sind, wechsle zu …" |
| **B: Zwei Shampoos empfehlen (Rotation)** | Anti-Schuppen-Shampoo 2–3x/Woche + normales Shampoo für den Kopfhauttyp an den anderen Waschtagen. | Empfehlungs-Pipeline muss zwei Shampoos ausgeben (Behandlung + Basis). Mittlerer Aufwand. |
| **C: Anti-Schuppen als Kur, dann absetzen** | Anti-Schuppen-Shampoo für X Wochen als Kur, danach komplett auf normales Shampoo umsteigen. Kein paralleler Einsatz. | Zeitliche Komponente in der Empfehlung. Könnte im Chat als Routine-Hinweis formuliert werden. |

**Vorschlag:** Option B ist bei Dermatologen üblich (Rotation schont die Kopfhaut), aber das muss Tom bestätigen. Falls zu komplex → Option A mit Chat-Hinweis als Zwischenlösung.

---

## 3. Beantwortet

### Frage 1: Masken-Matrix — "Nix"-Spalte ✅

**Toms Antwort:** "Nix"-Masken sind für allgemeine Pflege-Benefits: bessere Kämmbarkeit, Schutz gegen Stress, mehr Glanz. Nicht an einen spezifischen Mangel gebunden — eher präventive/allgemeine Wellness-Masken.

**Entscheidung:** Option B (Präventiv bei Belastung), erweitert: "Nix"-Masken empfehlen für Nutzer ohne Protein-/Feuchtigkeitsmangel, die trotzdem eine Maske wollen oder Belastungssignale zeigen. Concern-Code `performance` bleibt passend.

---

### Frage 3: Masken-Abstufung nach Belastungsfaktoren ✅

**Toms Antwort:** Mehr Belastungsfaktoren → reichhaltigere/fetthaltigere Masken. Hitze-Styling ist weniger belastend als Protein-/Feuchtigkeitsmangel. Die drei Faktoren (Hitze, Protein/Feuchtigkeitsmangel, chemische Behandlung) bilden ein "Dreieck" — sie interagieren miteinander und lassen sich nicht isoliert bewerten. Gutes Profiling ist der Schlüssel, damit man ein breites Array an Masken anbieten kann statt immer dieselbe.

**Entscheidung:** Bestätigt Option A (Konzentration variieren) als Basis, aber mit Nuancierung:
- `need_strength` 1 → leichte Masken (low concentration)
- `need_strength` 2 → mittlere Masken (medium concentration)
- `need_strength` 3 → reichhaltige/fetthaltige Masken (high concentration)
- Hitze-Styling allein ist weniger schwerwiegend als Protein-/Feuchtigkeitsmangel → ggf. Gewichtung anpassen
- Langfristig: besseres Profiling ermöglicht Variation im Masken-Array statt immer dieselbe Empfehlung

---

### Frage 4: Reihenfolge der Produkte innerhalb einer Zelle ✅

**Toms Antwort:** Nach Preis sortieren — günstigstes Produkt zuerst, teuerstes zuletzt.

**Entscheidung:** Weder Option A noch B — neuer Ansatz: Produkte nach `price` aufsteigend sortieren (cheapest first). `sort_order` aus der Tabelle wird durch Preis-Ranking ersetzt als primärer Sortier-Faktor im Reranker.

**TODO:** Preis-Feld (`price`) muss in der Produkttabelle gepflegt sein. Reranker-Tie-Breaking auf `price ASC` umstellen.

---

### Frage 6: Peelings/Seren Produktempfehlungen ✅

**Toms Antwort:** Noch keine Produktliste vorhanden, kommt bald.

**Entscheidung:** Option B (nur im Chat als Wissensantwort) bis Tom die Produkttabelle liefert. Dann auf Option A (eigene Pipeline) umsteigen.

---

### Frage 7: Mechanische Belastung im Onboarding ✅

**Toms Antwort:** Ja, soll abgefragt werden.

**Entscheidung:** Option B — mechanische Belastung als eigene Frage im Onboarding-Flow aufnehmen. Neues Profilfeld nötig (z.B. `mechanical_stress`: `low/medium/high`), oder konkrete Szenarien abfragen (häufiges Bürsten, enge Zöpfe, Handtuchrubbeln).

**TODO:** Onboarding-UI + Profilfeld + Migration planen.

---

### Frage 9: "Curl"-Produkte auch für nicht-lockiges Haar ✅

**Toms Antwort:** "Curl" im Produktnamen bedeutet nicht, dass es nur für lockiges Haar ist. `hair_texture` kann bei Conditioner- und Leave-in-Empfehlungen ignoriert werden.

**Entscheidung:** Option A (Curl-Produkte sind universell). Kein `hair_texture`-Filter im Conditioner- und Leave-in-Matcher nötig. Produkte bleiben im Pool für alle Haartypen.
