# Produktphase: Auswahl → Einkaufsliste + iOS-Vergleichstabellen — Plan Rev. 1

Datum: 2026-09-29 · Worktree `produktphase-lockin` (Base `66b03bcc` = origin/main, Slices 1–3 live) · Design-Evidenz: `plans/produktphase-lockin/evidence/produktphase-mockup-v2.html` (Artifact V2, von Nick freigegeben 2026-09-29: „looks fine for now, we can put this already online").

## Auftrag (Nick, 2026-09-29)

Phase 3 (Produkte) des Discovery-Cockpits bekommt das Interaktionsmuster aus dem Mockup:

1. **„Für ihren Plan festgehalten"** — eine kompilierte Sektion unter den Buckets: *Kauft sie neu* (mit Preisen und Summe), *Behält sie*, *Bewusst ohne Produkt*, Zähler offener Schritte, „Liste kopieren". Sie speist sich live aus den bestehenden Entscheidungen (`discovery_call_decisions`); es gibt KEINE neue Entscheidungs-Mechanik — die Entscheid-Buttons pro Schritt existieren seit Slice 1.
2. **iOS-Tabellensprache für den Vergleich** — die Alternativen-Tabellen übernehmen das Scan-Sheet-Muster: getönte Zeilen (grün/amber/rot je Status), Status-Badges, ZIEL-Spalte in Plum, und NEU eine dritte Spalte „Ihr Produkt", wo sie im Schritt ein Produkt besitzt (Ihr Produkt | Alternative | Ziel). Ihr eigenes Produkt behält seine Zwei-Spalten-Tabelle (Produkt | Ziel).

**Nicht in diesem Slice:** Retailer-/Budget-Band-Labels („dm · Budget", „über ihrem Rahmen") — R19/Retailer-Entscheidung weiter offen, live bleibt der nackte `priceLabel`. Bondbuilder-Katalog-Lücke (Budget-Option) läuft in Nicks separater Recherche. Teilnehmer-Ansichten (iOS/PDF) unberührt — Cockpit only.

## Fakten für die Umsetzung

- Entscheidungen: Tabelle `discovery_call_decisions` (Slice 1), gelesen in `src/lib/discovery/cockpit.ts` (DECISIONS_TABLE, `decisionKey`); UI-Zustand in `src/components/discovery/cockpit/discovery-call-cockpit.tsx`.
- Preise: `priceLabel` pro Swap-Option/Empfehlung seit Slice 3 (`cockpit.ts` ~689/905, `parseDiscoveryPriceLabel` in `swap-sort.ts`). Fehlender Preis → Zeile ohne Preis, Summe zählt nur bekannte Preise und sagt das dazu („ab X €", wenn Preise fehlen).
- Buckets/Views: `src/lib/discovery/runsheet/buckets.ts`, Anzeige `runsheet-products.ts` + `comparison-table.tsx`.
- Batch-9-Falle: mehrere Intake-Produkte pro Schritt (`stepEntryCount` > 1, `entryKey` = decisionKey+intakeItemId) — die Ableitung aggregiert pro ENTSCHEIDUNGS-Einheit wie die bestehende Bucket-Logik, nicht pro decisionKey allein.
- Cockpit-Stimme: neutrale dritte Person (R6); Coral nur CTA, Plum = Auswahl/ZIEL-Akzent.

## Tasks

**T1 — Ableitung `runsheetLockedIn` (pure, TDD)** *(Opus-Implementierer, Lane A)*. Neue pure Funktion in `src/lib/discovery/runsheet/` : aus Steps/Buckets + gespeicherten Entscheidungen → `{ buy: {label, categoryLabel, priceLabel|null}[], keep: …[], skip: {categoryLabel}[], totalLabel, missingPrices: boolean, openCount }`. Semantik: decision „swap" mit gewähltem Ziel → buy (Preis des gewählten Produkts); „keep" → keep; „drop"/„ohne Produkt" → skip; unentschieden → openCount. Deckt Multi-Produkt-Schritte, fehlende Preise, leere Zustände. Tests zuerst (Fixture-Stil der bestehenden runsheet-Tests).

**T2 — UI-Sektion + Wiring** *(Lane A, gleiche Person)*. Neue Cockpit-Komponente „Für ihren Plan festgehalten" nach dem Tauschen-oder-neu-Bucket in Phase 3 (`discovery-call-cockpit.tsx`), live aus dem Entscheidungs-Zustand (reagiert sofort auf Klicks, nicht erst nach Reload); „Liste kopieren" (clipboard + Fallback Selektion); leerer Zustand pro Gruppe „Noch nichts festgehalten."; Zähler „N Schritte noch nicht entschieden." / „Alle Schritte entschieden — bereit für Phase 4." Kopie/Copy deutsch, dritte Person. Page-Tests erweitern (tests/discovery-runsheet-page.test.tsx-Muster).

**T3 — iOS-Vergleichstabellen** *(Opus-Implementierer, Lane B; disjunkt: NUR `comparison-table.tsx` + zugehörige Styles/Props + deren Tests, KEIN Edit an discovery-call-cockpit.tsx/page)*. Bestehende Vergleichstabelle auf das Scan-Sheet-Muster heben: getönte Zeilen nach Zeilen-Status, runde Status-Badges (✓/!/✕), ZIEL-Spaltenkopf in Plum; neue optionale Spalte „Ihr Produkt" (Werte + Status ihres Produkts pro Achse), gerendert wenn der Schritt ein eigenes Produkt mit Verdict-Dimensionen hat — Datenquelle sind die vorhandenen Dimension-Rows des eigenen Produkts (gleiche Achsen-Matching-Logik wie das Mockup: Achse für Achse, fehlende Achse → Zelle leer). Teilnehmer-Ansichten, die dieselbe Komponente nutzen könnten, prüfen: Cockpit-only stylen (Prop/Variante), nichts Teilnehmer-Sichtbares ändern.

**T4 — Evidenz + Doku** *(Main-Session, erledigt/klein)*: Mockup archiviert (dieser Ordner); PR-Body verweist auf Artifact + Evidenz.

## Verifikation & Abschluss

`npm run test:node` + `npm run ci:verify` grün; Browser-Beleg: Cockpit-Seite mit Entscheidungen durchklicken (Playwright-Page-Tests decken Logik; visueller Beleg via Screenshot im PR). Codex-Whole-Branch (ein Pass), /ship → Draft-PR, Merge = Nicks „merge it". Danach: Nicks Live-Finalisierung an Nomi, dann Rollout-Beobachtung an weiteren Profilen.
