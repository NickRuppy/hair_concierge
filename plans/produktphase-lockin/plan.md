# Produktphase: Auswahl → Einkaufsliste + iOS-Vergleichstabellen — Plan Rev. 1

Datum: 2026-09-29 · Worktree `produktphase-lockin` (Base `66b03bcc` = origin/main, Slices 1–3 live) · Design-Evidenz: `plans/produktphase-lockin/evidence/produktphase-mockup-v2.html` (Artifact V2, von Nick freigegeben 2026-09-29: „looks fine for now, we can put this already online").

## Auftrag (Nick, 2026-09-29)

Phase 3 (Produkte) des Discovery-Cockpits bekommt das Interaktionsmuster aus dem Mockup:

1. **„Für den Plan festgehalten"** — eine kompilierte Sektion unter den Buckets: _Neu kaufen_ (mit Preisen und Summe), _Behalten_, _Weglassen_, _Bewusst ohne Produkt_, Zähler offener Schritte, „Liste kopieren". Sie speist sich live aus den bestehenden Entscheidungen (`discovery_call_decisions`); es gibt KEINE neue Entscheidungs-Mechanik — die Entscheid-Buttons pro Schritt existieren seit Slice 1.
2. **iOS-Tabellensprache für den Vergleich** — die Alternativen-Tabellen übernehmen das Scan-Sheet-Muster: getönte Zeilen (grün/amber/rot je Status), Status-Badges, ZIEL-Spalte in Plum, und NEU eine dritte Spalte „Bisheriges Produkt", wo im Schritt ein eigenes Produkt vorhanden ist (Bisheriges Produkt | Alternative | Ziel). Das eigene Produkt behält seine Zwei-Spalten-Tabelle (Produkt | Ziel).

**Nicht in diesem Slice:** Retailer-/Budget-Band-Labels („dm · Budget", „über ihrem Rahmen") — R19/Retailer-Entscheidung weiter offen, live bleibt der nackte `priceLabel`. Bondbuilder-Katalog-Lücke (Budget-Option) läuft in Nicks separater Recherche. Teilnehmer-Ansichten (iOS/PDF) unberührt — Cockpit only.

## Fakten für die Umsetzung

- Entscheidungen: Tabelle `discovery_call_decisions` (Slice 1), gelesen in `src/lib/discovery/cockpit.ts` (DECISIONS_TABLE, `decisionKey`); UI-Zustand in `src/components/discovery/cockpit/discovery-call-cockpit.tsx`.
- Preise: `priceLabel` pro Swap-Option/Empfehlung seit Slice 3 (`cockpit.ts` ~689/905, `parseDiscoveryPriceLabel` in `swap-sort.ts`). Fehlender Preis → Zeile ohne Preis, Summe zählt nur bekannte Preise und sagt das dazu („ab X €", wenn Preise fehlen).
- Buckets/Views: `src/lib/discovery/runsheet/buckets.ts`, Anzeige `runsheet-products.ts` + `comparison-table.tsx`.
- Batch-9-Falle: mehrere Intake-Produkte pro Schritt (`stepEntryCount` > 1, `entryKey` = decisionKey+intakeItemId) — die Ableitung aggregiert pro ENTSCHEIDUNGS-Einheit wie die bestehende Bucket-Logik, nicht pro decisionKey allein.
- Cockpit-Stimme: pronomenfreie Labels (Nick 2026-09-29, ersetzt die neutrale dritte Person aus R6) — kein „du", kein „sie"/„ihr"; wo ein Satz zwingend ein Subjekt braucht, sparsam „die Teilnehmerin". Coral nur CTA, Plum = Auswahl/ZIEL-Akzent.

## Tasks

**T1 — Ableitung `runsheetLockedIn` (pure, TDD)** _(Opus-Implementierer, Lane A)_. Neue pure Funktion in `src/lib/discovery/runsheet/` : aus Steps/Buckets + gespeicherten Entscheidungen → `{ buy: {label, categoryLabel, priceLabel|null}[], keep: …[], discard: …[], skip: {categoryLabel}[], totalLabel, missingPrices: boolean, openCount }`. Semantik: decision „swap" mit gewähltem Ziel → buy („Neu kaufen", Preis des gewählten Produkts); „keep" → keep („Behalten"); „drop" eines eigenen Produkts → discard („Weglassen"); „ohne Produkt" → skip („Bewusst ohne Produkt"); unentschieden → openCount. Deckt Multi-Produkt-Schritte, fehlende Preise, leere Zustände. Tests zuerst (Fixture-Stil der bestehenden runsheet-Tests).

**T2 — UI-Sektion + Wiring** _(Lane A, gleiche Person)_. Neue Cockpit-Komponente „Für den Plan festgehalten" (Gruppen Neu kaufen / Behalten / Weglassen / Bewusst ohne Produkt) nach dem Tauschen-oder-neu-Bucket in Phase 3 (`discovery-call-cockpit.tsx`), live aus dem Entscheidungs-Zustand (reagiert sofort auf Klicks, nicht erst nach Reload); „Liste kopieren" (clipboard + Fallback Selektion); leerer Zustand pro Gruppe „Noch nichts festgehalten."; Zähler „N Schritte noch nicht entschieden." / „Alle Schritte entschieden — bereit für Phase 4." Copy deutsch, pronomenfrei. Page-Tests erweitern (tests/discovery-runsheet-page.test.tsx-Muster).

**T3 — iOS-Vergleichstabellen** _(Opus-Implementierer, Lane B; disjunkt: NUR `comparison-table.tsx` + zugehörige Styles/Props + deren Tests, KEIN Edit an discovery-call-cockpit.tsx/page)_. Bestehende Vergleichstabelle auf das Scan-Sheet-Muster heben: getönte Zeilen nach Zeilen-Status, runde Status-Badges (✓/!/✕), ZIEL-Spaltenkopf in Plum; neue optionale Spalte „Bisheriges Produkt" (Werte + Status des eigenen Produkts pro Achse), gerendert wenn der Schritt ein eigenes Produkt mit Verdict-Dimensionen hat — Datenquelle sind die vorhandenen Dimension-Rows des eigenen Produkts (gleiche Achsen-Matching-Logik wie das Mockup: Achse für Achse, fehlende Achse → Zelle leer). Teilnehmer-Ansichten, die dieselbe Komponente nutzen könnten, prüfen: Cockpit-only stylen (Prop/Variante), nichts Teilnehmer-Sichtbares ändern.

**T4 — Evidenz + Doku** _(Main-Session, erledigt/klein)_: Mockup archiviert (dieser Ordner); PR-Body verweist auf Artifact + Evidenz.

## Verifikation & Abschluss

`npm run test:node` + `npm run ci:verify` grün; Browser-Beleg: Cockpit-Seite mit Entscheidungen durchklicken (Playwright-Page-Tests decken Logik; visueller Beleg via Screenshot im PR). Codex-Whole-Branch (ein Pass), /ship → Draft-PR, Merge = Nicks „merge it". Danach: Nicks Live-Finalisierung an Nomi, dann Rollout-Beobachtung an weiteren Profilen.
