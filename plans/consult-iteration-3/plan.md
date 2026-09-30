# Consult-Iteration 3 — Nicks zweite Prod-Testrunde (2026-09-29, nach #630)

Feedback-Punkte 1–9; 3 (Maßnahmen) und 9 (Feedback/Abschluss) sind gut → unverändert.

## Antworten statt Änderungen (1, 4, 6)

- (1) „Problem kurz erklärt" leer = gespeicherter v3-Brief hat das Feld noch nicht; der
  Stale-Hinweis stand korrekt daneben. „Neu generieren" füllt es. Kein Bug.
- (4) „Für den Call" = zwei Spickzettel: FRAGEN (was Nick fragen muss, weil die Antwort den
  Plan ändert) + ERWARTUNGEN (ehrliche Sätze zum Laut-Vorlesen fürs Erwartungsmanagement).
  UI bekommt Zweck-Unterzeilen (T1), damit das ohne Erklärung lesbar ist.
- (6) „Gescanntes Produkt · GTIN — noch in Recherche" = SIE hat den Barcode im Intake
  gescannt; das Produkt ist (noch) nicht im Katalog → Recherche-Lane. Kommt nicht aus dem
  dm-Katalog.

## T1 — Problem-Block „Consultant-Slide" (concern-recipe.tsx + Für-den-Call-Unterzeilen)

Nicks Ansage: Management-Consultant-Klarheit — EIN klarer Block, sofort erzählbar.
Rezept-Karte radikal verdichten: Kernbotschaft („So sagst du es") + max. 3 Anfangs-Punkte
+ „Nicht damit anfangen" als kompakte Chips/Kurzliste; alles andere (Fürs Profil,
Ohne-Produkt-Details, Evidenz-Vermerke, Grenze) hinter Fold-ups. Inhalt bleibt 1:1
deterministisch aus dem Rezept — NUR Präsentation/Hierarchie ändert sich, nichts wird
umformuliert erfunden. „Für den Call"-Listen bekommen je eine Zweck-Unterzeile.

## T2 — Idealroutine als Tabelle (runsheet-routine.tsx)

Pro Tages-Karte (Waschtag / Tage ohne Wäsche) eine echte Tabelle statt Fließtext-Liste:
Spalten Schritt (Kategorie), Produkt, Wann/Wie oft, Zweck. Zeilentrennung sichtbar
(„wo ein Produkt endet"). Frequenz-Chips und Warum-Zeile bleiben.

## T3 — Phase 3 kürzen + Komplexität wirkt sichtbar (discovery-call-cockpit.tsx)

- Add-Steps („Neu dazu") verlieren den irrelevanten linken „Bisheriges Produkt: Kein
  Produkt angegeben"-Block → einspaltige, kompakte Entscheidungs-Karte.
- „Super essenziell" gewählt → OPTIONALE Neu-Schritte kollabieren zu einer kompakten
  Zeile/Gruppe („n optionale Schritte ausgeblendet — aufklappen"); „Normal" zeigt alles.
  Reines Display, keine Engine-Änderung (Routine-Varianten bleiben Slice 4).

## T4 — Alternativen: Fotos + Preise (cockpit.ts, Optionen-UI; Preis-Pipeline klären)

- Produktfotos als Thumbnails an Swap-/Empfehlungs-Optionen (Bilddaten aus den bereits
  geladenen Katalog-Präsentations-Rows; keine neuen Loads erfinden, konservativ: kein Bild
  → kein Platzhalter-Loch).
- Preise — BEFUND (Explorer): Es gibt KEINE Preis-Refresh-Pipeline. `price_checked_at`
  wird nur beim Katalog-Intake/Seed geschrieben; alles älter als 7 Tage
  (`STAGE3_COMMERCE_MAX_AGE_MS`) verliert still seinen Preis. Ein bloßes
  `price_checked_at = now()` würde alte Preise als frisch stempeln — abgelehnt. Docs
  (hai-124) nennen den wiederkehrenden Preis-Audit als gewollt-aber-ungebaut. →
  Produktentscheidung an Nick: Preis-Audit-Lane bauen (eigener Slice) oder 7-Tage-Fenster
  lockern. In dieser Runde: nur Fotos.

## Ausführung

Agent A (Opus): T1. Agent B (Opus): T2. Explorer (read-only): T4-Preismechanik +
Options-Bilddaten. Hauptsession: T3 + T4-Wiring + Integration, Tests, Codex-Review, /ship;
Merge erst auf Nicks Go für DIESEN PR.
