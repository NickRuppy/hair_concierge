# Scan-Ergebnis — Copy-Entwürfe zur Prüfung

> **Stand nach Nicks Entscheidung (10.09., später):** Abschnitte A und B sind **verworfen** („nicht überkomplizieren, Produktion ist fein“). Es bleibt nur Abschnitt C (Definitionen). Die Zeile unter dem Verdict wird aus der Tabelle erzeugt: `{Eigenschaft}: {Produktwert} statt {Ziel}`, bei Grün „Alles im Ziel.“ Der zweite Satz der Erklärkarte nutzt den bestehenden Kategorie-Satz aus `decision-presentation.ts`.

Stand 2026-09-10, Entwurf. Drei Schichten, die das gesperrte Design braucht und die Engine heute
nicht liefert. Alles Vorschlag, nichts freigegeben. Regeln: telegrammartig, du-Ansprache,
keine medizinischen Aussagen, keine Wirkversprechen, Häufigkeiten nur mit `[Kadenz prüfen]`
markiert, bis Evidenz sie trägt. Fachbegriffe stehen in der Tabelle; die Sätze erklären in
Alltagssprache.

Achsen und Stufen aus `src/lib/personal-plan/products/comparison-dimensions.ts`; Kriterien-
Ergebnisse aus `src/lib/personal-plan/products/authority/categories/*.ts` (pass / caution / fail,
Abstand in Stufen). Die heutigen Engine-Texte („Liegt eine Stufe neben dem Wunschprofil und
bleibt kompatibel.“) sind Prüfprotokoll und erreichen den Nutzer nicht.

## A. Konsequenz-Satz unter dem Verdict

Ein Satz pro Verdict. Bei „mit Einschränkung“ und „passt nicht“ nennt er die eine Eigenschaft,
die abweicht, und was das im Alltag heißt. Bei mehreren Abweichungen zählt die erste in
Engine-Reihenfolge; die Tabelle zeigt die übrigen.

### Passt (alle Zeilen grün), je Kategorie

| Kategorie | Satz |
| --- | --- |
| Shampoo | Bei jeder Wäsche. |
| Conditioner | Nach jeder Wäsche in die Längen. |
| Haarmaske | Einmal pro Woche in die Längen. `[Kadenz prüfen]` |
| Leave-in | Ins handtuchtrockene Haar, vor dem Föhnen. |
| Öl | Ein, zwei Tropfen in die Spitzen. |
| Trockenshampoo | Zwischen zwei Wäschen an den Ansatz. |
| Hitzeschutz | Vor jedem Föhnen oder Glätten. |
| Bondbuilder | Nach Anleitung des Herstellers, ergänzend zur Pflege. |
| Kopfhautpflege | Nach Anleitung des Herstellers auf die Kopfhaut. |
| Tiefenreinigung | Alle paar Wäschen statt des normalen Shampoos. `[Kadenz prüfen]` |

### Mit Einschränkung (eine Stufe daneben)

| Eigenschaft | Produkt über dem Ziel | Produkt unter dem Ziel |
| --- | --- | --- |
| Pflegegewicht | Reichhaltiger, als deine Längen brauchen. Seltener anwenden. `[Kadenz: „etwa alle zwei Wochen“ prüfen]` | Leichter, als deine Längen brauchen. Etwas mehr nehmen oder länger einwirken lassen. |
| Pflegerichtung (Feuchtigkeit statt ausgeglichen) | Setzt stärker auf Feuchtigkeit, als du brauchst. Passt, wenn deine Längen das vertragen. | — |
| Pflegerichtung (Protein statt ausgeglichen) | Setzt stärker auf Protein, als du brauchst. Nicht bei jeder Wäsche. | — |
| Repair-Pflege | Stärker auf Repair ausgelegt, als deine Längen brauchen. Passt, tut aber nicht mehr als nötig. | Weniger Repair, als deine Längen brauchen. Für zwischendurch, nicht als Hauptpflege. |
| Reinigung | Reinigt gründlicher, als deine Kopfhaut braucht. Nicht täglich. | Reinigt sanfter, als deine Kopfhaut braucht. Bei Bedarf zweimal einschäumen. |
| Hitzeschutz (Leave-in ohne Schutz, Ziel ja) | — | Schützt nicht vor Hitze. Vor dem Föhnen zusätzlich einen Hitzeschutz nehmen. |

### Passt nicht (zwei Stufen daneben oder Mengen-Achse ohne Treffer)

| Eigenschaft | Satz |
| --- | --- |
| Pflegegewicht, deutlich drüber | Deutlich reichhaltiger, als deine Längen brauchen. |
| Pflegegewicht, deutlich drunter | Deutlich leichter, als deine Längen brauchen. |
| Pflegerichtung (Feuchtigkeit ↔ Protein) | Setzt auf das Gegenteil von dem, was deine Längen brauchen. |
| Repair-Pflege, deutlich drunter | Zu wenig Repair für deine Längen. |
| Reinigung, deutlich drüber | Reinigt viel gründlicher, als deine Kopfhaut verträgt. |
| Reinigung, deutlich drunter | Reinigt zu sanft für deine Kopfhaut. |
| Kopfhaut (Ziel nicht abgedeckt) | Für {Ziel-Stufe} Kopfhaut nicht gedacht. Headline: „Passt nicht zu deiner Kopfhaut“. |
| Haardicke (Ziel nicht abgedeckt) | Nicht für {Ziel-Stufe}s Haar ausgelegt. |
| Verträglichkeit (bekannte Reaktion) | Du hast auf dieses Produkt schon einmal reagiert. |

Mengen-Stufen in Alltagssprache: fettig → „fettige“, ausgeglichen → „ausgeglichene“,
trocken → „trockene“, Schuppen → „Kopfhaut mit Schuppen“ (Satz umbauen: „Bei Schuppen nicht
gedacht.“), gereizt → „gereizte“; fein → „feines“, mittel → „mittleres“, dick → „dickes“.

## B. „Woher dein Ziel kommt“ (Erklärkarte, zweiter Satz)

Ein Satz je Kategorie und Achse, gefüllt aus Profil-Fakten. Platzhalter in {}. Wo der Grund
aus `decision.reasons` fehlt, greift der Fallback.

| Kategorie · Achse | Satz | Fallback |
| --- | --- | --- |
| Maske · Pflegegewicht | Dein Ziel „{Ziel}“ kommt aus deiner Haardicke ({Haardicke}) und dem Pflegebedarf deiner Längen. | Dein Ziel kommt aus deiner Haardicke und dem Pflegebedarf deiner Längen. |
| Maske · Pflegerichtung | Dein Ziel „{Ziel}“ folgt daraus, wie trocken und wie strapaziert deine Längen sind. | Dein Ziel folgt aus Trockenheit und Schäden deiner Längen. |
| Maske · Repair-Pflege | Dein Ziel „{Ziel}“ folgt aus {Hitze, Färben, Bruch: die zutreffenden}. | Dein Ziel folgt aus Hitze, Färben und Bruch in deinem Profil. |
| Conditioner · alle drei | wie Maske, mit „nach der Wäsche“ statt „Maske“ | wie Maske |
| Conditioner · Haardicke | Dein Ziel ist deine Haardicke: {Haardicke}. | Dein Ziel ist deine Haardicke aus dem Profil. |
| Shampoo · Reinigung | Dein Ziel „{Ziel}“ kommt aus deiner Kopfhaut ({Kopfhaut}) und davon, wie viele Produkte du nutzt. | Dein Ziel folgt aus deiner Kopfhaut und deiner Produktnutzung. |
| Shampoo · Kopfhaut | Dein Ziel „{Ziel}“ kommt aus deinen Angaben zum Nachfetten und zur Kopfhaut. | Dein Ziel kommt aus deinen Angaben zur Kopfhaut. |
| Shampoo · Haardicke | Dein Ziel ist deine Haardicke: {Haardicke}. | wie oben |
| Leave-in · Hitzeschutz | Dein Ziel „ja“ kommt daher, dass du mit Hitze stylst. / Dein Ziel „nein“: du stylst ohne Hitze. | Dein Ziel folgt daraus, ob du mit Hitze stylst. |
| Leave-in · Pflegegewicht | wie Maske | wie Maske |
| Leave-in · Repair-Pflege | wie Maske | wie Maske |
| Öl · Pflegegewicht | Dein Ziel „{Ziel}“ kommt aus deiner Haardicke und davon, wofür du das Öl einsetzt. | Dein Ziel kommt aus deiner Haardicke und dem Einsatz des Öls. |

Öl (Binär-Achsen, Rollen), Bondbuilder (Beziehung „eigenständig / nur ergänzend“) und
Kopfhautpflege brauchen ihre Achsenliste aus der Engine, bevor die Sätze stehen: offen.

## C. Definitionen (Erklärkarte, erster Satz) — FREIGEGEBEN 10.09. in der Fassung aus E1

Nick hat die Fachreview-Fassung gewählt (siehe E1); die Tabelle unten ist die frühere Fassung.

| Eigenschaft | Definition |
| --- | --- |
| Pflegegewicht | Wie reichhaltig eine Formel ist. Leicht beschwert nicht, reichhaltig pflegt intensiver, kann feines Haar aber beschweren. |
| Pflegerichtung | Ob eine Formel eher auf Feuchtigkeit oder auf Protein setzt. Ausgeglichen liefert beides. |
| Repair-Pflege | Wie stark eine Formel auf strapazierte Längen ausgelegt ist. |
| Haardicke | Für welche Haardicke die Formel ausgelegt ist: fein, mittel oder dick. |
| Reinigung | Wie gründlich ein Shampoo reinigt. Sanft für empfindliche Kopfhaut, klärend gegen Rückstände. |
| Kopfhaut | Für welche Kopfhaut-Zustände die Formel gedacht ist: fettig, ausgeglichen, trocken, Schuppen oder gereizt. |
| Hitzeschutz | Ob die Formel als Hitzeschutz für Föhn und Glätteisen ausgelegt ist. |
| Verträglichkeit | Ob du auf dieses Produkt schon einmal reagiert hast. |

## D. Zu prüfen

1. Alle `[Kadenz prüfen]`-Stellen: entweder belegen oder den Satz vor der Häufigkeit enden lassen.
2. Fachliche Prüfung der Konsequenz-Sätze (hair-care-expert): keine Aussage, die über die
   Evidenz hinausgeht; Kopfhaut-Sätze bleiben kosmetisch, nicht medizinisch.
3. Öl, Bondbuilder, Kopfhautpflege, Trockenshampoo, Tiefenreinigung: Achsen und Ergebnisse
   aus der Engine ziehen und ergänzen.
4. Ton mit `plans/scan-mvp-copy-signoff.md` abgleichen (bestehende Verdict-Zeilen bleiben).


## E. Fachliche Prüfung (hair-care-expert, 10.09.) — was nach der Vereinfachung noch zählt

Die Prüfung galt allen drei Schichten; A und B sind verworfen, also bleiben nur die Punkte zu
den Definitionen und zwei Vorbehalte. Alles Vorschlag, Nick entscheidet.

### E1. Definitionen, geprüfte Fassung (Vorschlag neben der bisherigen)

| Eigenschaft | Bisher | Geprüfter Vorschlag | Grund |
| --- | --- | --- | --- |
| Pflegegewicht | … reichhaltig pflegt intensiver, kann feines Haar aber beschweren. | Wie reichhaltig eine Formel ist. Leicht legt wenig auf, reichhaltig legt mehr auf und kann feines Haar beschweren. | „pflegt intensiver“ ist ein Wirkversprechen; Gewicht ist eine Auflage-Eigenschaft. |
| Pflegerichtung | … Ausgeglichen liefert beides. | Ob eine Formel eher auf feuchtigkeitsbindende Stoffe oder auf Protein setzt. Ausgeglichen enthält beides. | „liefert“ = Wirkung; „enthält“ = Rezeptur. |
| Reinigung | … Sanft für empfindliche Kopfhaut, klärend gegen Rückstände. | Wie gründlich ein Shampoo reinigt. Sanft wäscht weniger stark ab, klärend entfernt mehr Rückstände. | „für empfindliche Kopfhaut“ ist eine Nutzenaussage zur Haut. |
| Kopfhaut | … fettig, ausgeglichen, trocken, Schuppen oder gereizt. | Für welche Kopfhaut die Formel ausgewiesen ist: fettig, ausgeglichen, trocken, mit Schuppen, mit trockenen Schuppen oder gereizt. | Engine hat sechs Stufen (`dry_flakes` fehlte); „Zustände“ ist Krankheitssprache. |
| Verträglichkeit | Ob du auf dieses Produkt schon einmal reagiert hast. | Deine eigene Angabe, ob du auf dieses Produkt schon einmal reagiert hast. | Macht klar: Selbstauskunft, kein Test. |
| Repair-Pflege, Haardicke, Hitzeschutz | unverändert | unverändert | Als Vorbild bewertet. |

### E2. Zwei Vorbehalte für Nick — entschieden: beide abgelehnt (kein Caveat auf dem Sheet, Headline bleibt)

1. **Hinweis bei Kopfhaut-Ziel Schuppen / trockene Schuppen / gereizt.** Das Sheet gibt dort ein
   Urteil ohne Abgrenzung. Vorschlag, eine Zeile unter der Tabelle, nur bei diesen drei Zielen,
   im Wortlaut, den die App im Quiz schon nutzt: „Chaarlie ordnet kosmetisch ein. Bleiben
   Schuppen, Rötung oder Juckreiz bestehen, ist eine dermatologische Abklärung der nächste
   Schritt.“ (Quelle im Repo: `src/lib/quiz/guided-story-copy.ts:24`.)
2. **Headline „Passt nicht zu deiner Kopfhaut“.** Der Prüfer schlägt „… zu deinem Kopfhaut-Ziel“
   vor, weil die Aussage über die Person geht. Das ist ein Vorschlag gegen ein bestehendes
   Ruling; unverändert gelassen, bis Nick entscheidet.

Verworfen mit A/B: alle Kadenz-Urteile, „brauchen/verträgt“-Formulierungen, Hitzeschutz-Satz.
