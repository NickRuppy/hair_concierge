# Stage 3: Coverage-basiertes Ranking für „Beste verfügbare Option"

**Branch:** `codex/stage3-coverage-ranking`
**Status:** In Implementierung — Evidenz-Review (Vorher/Nachher-Mockup) und Journey-Sign-off von Nick bestätigt 2026-08-17
**Datum:** 2026-08-17

## Problem

Im Stage-3-Flow („Wähle dein Leave-in", uncovered role) wird als „Beste verfügbare Option"
ein Produkt gezeigt, das nur 1 von 3 Zieldimensionen trifft, während „Alternative 1"
2 von 3 trifft (Beleg: Screenshot Leave-in, Pantene Bonding Leave-In vs. Cantu
Leave-In Repair Cream, 2026-08-17).

**Ursache (zwei Ebenen):**

1. **Authority-Auswahl** (`authority/categories/leave-in.ts:208`): bei uncovered role wird
   die Empfehlung als „erster `ideal`-Kandidat, sonst **erster `supportive`-Kandidat** in
   Katalogreihenfolge" gewählt. `supportive` ist binär (≥1 caution, kein fail) — Kandidaten
   mit 1/3 und 2/3 Treffern sind auf dieser Ebene ununterscheidbar; Katalog-`sort_order`/Preis
   entscheidet (`product-matching/matcher.ts:92`).
2. **Anzeige-Sortierung** (`fit-comparison.ts:324`): im Uncovered-Zweig wird
   `recommendationOrder` (Authority-Pick zuerst) **vor** `coverageOrder` (`targetMatchCount`)
   angewendet — der Katalogreihenfolge-Pick wird als „Beste verfügbare Option" festgenagelt,
   obwohl die Vergleichstabelle selbst die bessere Abdeckung der Alternative berechnet.
   Ironie: im Covered-Zweig sortiert Coverage bereits zuerst.

## Entschiedene Regel (Nick, 2026-08-17)

Unter empfehlbaren Kandidaten wird gerankt nach:

1. **Verdict**: `ideal` vor `supportive`
2. **UI-Coverage**: meiste In-Target-Dimensionen — exakt die Zahlen, die die
   Vergleichstabelle rendert (`targetMatchCount` aus `candidateTargetCoverage`;
   für Compact-Kategorien die `pass`-Anzahl aus `compactCriterionSchema`)
3. **Wenigste Cautions**
4. **Katalogreihenfolge** (`catalogSortOrder`), dann Preis/Name als stabiler Tiebreak

**Invariante:** Die #1-Karte zeigt nie weniger grüne Häkchen als eine Alternative.
Ein gemeinsamer Comparator wird von **beiden** Ebenen benutzt (Authority-Auswahl und
Anzeige-Sortierung) — Übereinstimmung per Konstruktion, nicht per Konvention.
Der Uncovered-Zweig der Anzeige-Sortierung verliert das Recommendation-Pinning
zugunsten desselben Comparators. Gilt für Covered- und Uncovered-Zweig.

### Per-Kategorie-Entscheidungen

| Kategorie | Änderung |
| --- | --- |
| Leave-in | first-supportive-Auswahl → gemeinsamer Comparator |
| Conditioner | identisch (gleiches Pattern, `conditioner.ts:165`) |
| Öl | first-passing-Auswahl (`candidateForRole`) → Comparator über alle eligiblen Kandidaten; Hard Gates (Rollen-Support, Thickness, Protokoll, exaktes Gewicht bei Leave-on + adjacent-Fallback) bleiben unverändert |
| Maske | Caution-Count-Sort → Comparator; **Optional-only-Restriktion aufgehoben**: auch required Slots bekommen supportive Fallback (`mask.ts:261`) |
| Shampoo | **Neu: supportive Fallback** (Scalp-Route passt, Reinigungsintensität eine Stufe daneben, `shampoo.ts:195`), Coverage-gerankt — **außer `shampoo_dandruff`: bleibt ideal-only** (medizinisch angrenzend, konservativ) |
| Bondbuilder | Bleibt ideal-only — `add_on`-Produkte erfüllen die Rolle nicht eigenständig; kein Fallback |
| Deep-Cleansing | Bleibt ideal-only — kein supportive-Gradient vorhanden; nichts erfinden |
| Dry Shampoo, Scalp Care, Heat Protectant | **Unberührt** — binäre Kriterien, dokumentiert bewusste Designs (stable-first-entered; Heat-Protectant verweigert bei Gleichstand) |

## Implementierung

### Task 1 — Gemeinsamer Comparator (TDD)

Neues Modul `src/lib/personal-plan/products/candidate-ranking.ts`:

```ts
export type RankableCandidate = {
  verdict: "ideal" | "supportive"
  targetMatchCount: number   // in-target dimensions, wie die Tabelle sie rendert
  cautionCount: number       // criteria mit result === "caution"
  catalogSortOrder: number | null | undefined
  priceEur?: number | null
  productId: string
}
export function compareRankableCandidates(left, right): number
```

Tests zuerst (`candidate-ranking.test.ts`): Verdict-Dominanz, Coverage-Dominanz bei
gleichem Verdict (der Screenshot-Fall: 1/3 vs. 2/3 supportive → 2/3 gewinnt),
Caution-Tiebreak, Katalog-Tiebreak, Stabilität (productId als letzter Tiebreak).

### Task 2 — `fit-comparison.ts` auf den Comparator umstellen (TDD)

- `selectedComparisonCandidateAssessments`: beide Zweige (covered + uncovered) sortieren
  über `compareRankableCandidates`. `recommendationOrder`-Pinning im Uncovered-Zweig
  entfällt. `cautionCount` aus `criteria` ableiten und in `CandidateAssessment` aufnehmen.
- Regressionstest: Fixture mit zwei supportive Leave-in-Kandidaten (1/3 Coverage mit
  niedrigerem `catalogSortOrder` vs. 2/3 Coverage) → 2/3 wird `alternatives[0]`.
- Bestehende Tests der Datei lokalisieren und grün halten.

### Task 3 — Authority-Auswahl pro Kategorie (TDD, je Kategorie ein Commit)

Für jede Kategorie: Kandidaten bewerten, Coverage via `candidateTargetCoverage`-Logik
bestimmen (Export/Wiederverwendung aus `fit-comparison.ts` statt Duplikat — Zirkularität
prüfen; ggf. Coverage-Berechnung mit ins neue Modul ziehen), mit Comparator ranken:

- **3a Leave-in** (`leave-in.ts`): `find(ideal) ?? find(supportive)` → `sort(comparator)[0]`.
- **3b Conditioner** (`conditioner.ts`): identisch.
- **3c Öl** (`oil.ts`): `candidateForRole` liefert alle Gate-Passer, dann Comparator.
- **3d Maske** (`mask.ts`): eigenen Sort durch Comparator ersetzen;
  `needTier === "optional"`-Bedingung für supportive entfernen.
- **3e Shampoo** (`shampoo.ts`): `.find(ideal)` → Ranking über ideal+supportive;
  Guard: `input.role === "shampoo_dandruff"` → weiterhin nur ideal.
  Empfehlungstext für supportive existiert bereits (`shampoo.selection.verified_supportive_intensity`).

Testfälle je Kategorie: bisheriges Verhalten bei eindeutigem ideal unverändert;
Coverage-Inversion behoben; Shampoo-Dandruff-Guard; Mask-required-Fallback.

### Task 4 — Verifikation

1. `npm run ci:verify`
2. Flow manuell fahren (Dev-Server im Worktree, `npm run dev:worktree`): Leave-in-Fall
   aus dem Screenshot reproduzieren → Cantu (2/3) muss „Beste verfügbare Option" sein,
   Pantene (1/3) Alternative. Stichprobe Conditioner + Shampoo (supportive Fallback sichtbar
   mit „passt teilweise"-Label).
3. `npm run test:chat` falls Dev-Server läuft (Session-Konvention).

## User-Facing-Gates (offen)

- **Evidenz:** Oberfläche/Copy/Layout unverändert — es ändert sich nur, *welches Produkt*
  auf welcher Karte landet, plus neue Fälle, in denen Shampoo/Maske überhaupt eine Karte
  zeigen (bestehendes „passt teilweise"-Pattern). Als Evidenz: Vorher/Nachher-Screenshot
  des Leave-in-Falls (Nicks Screenshot als „Vorher", Dev-Screenshot als „Nachher").
- **Journey:** Kurz-Walkthrough: Einstieg uncovered Leave-in-Slot → Karten in neuer
  Reihenfolge → Tabelle konsistent mit #1-Karte → Auswahl/Fortfahren unverändert.
- Beide Gates vor `executing-plans` von Nick bestätigen lassen.

## Koordination mit `codex/conditioner-comparison-thickness`

Parallele Session „Category table consistency and redundant dimensions" (Plan:
`plans/conditioner-comparison-thickness.md` in deren Worktree) entfernt die
Conditioner-Gate-Zeile „Zielprofil-Eignung", fügt „Geeignete Haardicke" als 4.
Conditioner-Dimension hinzu, hebt das Zeilen-Cap auf 4 und formuliert die
`conditioner.role`-Mismatch-Copy um.

**Abgrenzung:** Jene Branch besitzt Dimensionen/Zeilen/Copy; diese Branch besitzt
Kandidaten-Ranking. Keine Widersprüche in den Verdicts (deren Edge Case betrifft
`mismatch`-Produkte, die hier nie gerankt werden).

**Merge-Reihenfolge:** `conditioner-comparison-thickness` landet zuerst (fast fertig);
diese Branch rebased danach. Konsequenzen hier:

- Conditioner-Coverage zählt dann 4 Dimensionen inkl. Haardicke (Set-Overlap) — gewollt.
- Conditioner-Tests gegen die Post-Merge-Form schreiben (4 Dimensionen, keine Gate-Zeile).
- **Härtung (Task 1/2):** Coverage wird aus exakt dem gerenderten Slice
  (`dimensions.slice(0, cap)`) berechnet, nicht aus der ungeschnittenen Liste — damit
  künftige Dimensions-Ergänzungen die Invariante („#1-Karte nie weniger Häkchen") nicht
  stillschweigend brechen können. Cap-Konstante teilen statt duplizieren.
- Rebase-Hotspots: `fit-comparison.ts` (`evidenceRowsFromDimensions`,
  `conditionerDimensions`), `conditioner.ts`, `stage3-fit-comparison.test.ts`,
  `personal-plan-product-fit-comparison.test.tsx`.

## Koordination mit Stage-1-Preview-Session (`Category images not preloading after payment`)

Dritte parallele Session fixt leere Stage-1-Beispielbilder (Produktion: Plan `55cf47cf`,
4 supportive / 0 ideal Shampoos). Nick-Entscheidungen (2026-08-17):

- **Eine Regel überall:** Previews zeigen nie Produkte, die die Empfehlungslogik nicht
  empfehlen würde. Deren „Pass 2" (preview-lokaler supportive-as-owned Fallback) entfällt —
  Restwert wäre genau Add-on-Bondbuilder und supportive Anti-Schuppen-Shampoos, beides
  hier ausgeschlossen. Bondbuilder-/Dandruff-Previews bleiben leer ohne ideal.
- **Merge-Reihenfolge:** (1) `conditioner-comparison-thickness` → (2) diese Branch →
  (3) Preview-Branch (nur Pass-1-Gate-Relaxierung + Löschung `stage1ExampleVerdictAllowed`).
  Deren relaxiertes Pass-1-Gate publiziert dann die supportive Adapter-Empfehlungen dieser
  Branch — fixt den Produktionsfall ohne Pass 2.
- **Abgrenzung:** Diese Branch besitzt Adapter + fit-comparison-Ranking; Preview-Branch
  besitzt `product-previews.ts` + `authorities.ts`-Helper. Keine Dateiüberschneidung.

## Nicht-Ziele

- Keine Änderung an Dry Shampoo, Scalp Care, Heat Protectant, Deep-Cleansing, Bondbuilder-Auswahl.
- Keine neuen Gewichtungen einzelner Achsen (bewusst gegen „weighted score" entschieden).
- Keine Änderung an Matcher-SQL/Eligibility (`matcher.ts` bleibt unverändert).
- Kein UI-/Copy-Redesign der Vergleichskarten.
