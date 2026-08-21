# Scan-Hardening: GTIN-Kanonisierung, Scan-Attempt-Log, Decode-Feedback

**Worktree:** `.worktrees/scan-gtin-attempt-log` (`codex/scan-gtin-attempt-log`, base = origin/main `96f9e71c`)
**Status:** Evidence review CONFIRMED + Journey-Sign-off ERTEILT 2026-08-21 — **Variante A**,
Attempt-Log mit user_id, GTIN-14-Kanonisierung. Implementierung läuft (Task 1 TS-Seite grün).

**Nicks Flaschen-EAN (2026-08-21): `3574661799438`** — gültige EAN-13 (Checksumme ✓),
GS1-Präfix 357 = Frankreich (Johnson & Johnson Europa; OGX ist eine J&J-Marke). Die
EU-Verpackung trägt also eine komplett andere GTIN als die gespeicherte US-UPC
`022796976116` — kein Schreibweisen-Duplikat, sondern der Multi-Barcode-Fall. Als
zweite Barcode-Zeile am OGX-Produkt (`2ecd3c9d-90f6-45a3-a72c-daefed50be10`) in Prod
ergänzt; Re-Scan sollte damit sofort auflösen (13-stelliger Exact-Match, unabhängig
von der Kanonisierungs-Migration).

## Kontext (Root Cause, bewiesen 2026-08-21)

Nicks erster Feldtest-Scan (OGX Renewing + Argan Oil of Morocco Shampoo) landete auf
"Kennen wir nicht", obwohl das Produkt aktiv im Katalog ist **und** einen Barcode hat:

- DB speichert `022796976116` (12-stellige UPC-A, importiert von Retailer-Seite).
- Scanner fordert nur `ean_13`/`ean_8` an (`scanner.tsx` `DETECTOR_FORMATS`) → zxing liefert
  UPC-A-Barcodes als 13-stellige EAN-13 mit führender Null: `0022796976116`.
- Lookup (`identifier-lookup.ts`) macht Exact-Match auf `normalized_identifier_value`;
  die Normalisierung (lowercase + Whitespace-Strip) kennt keine UPC↔EAN↔GTIN-Äquivalenz.

Betroffen heute: 3 von 33 Barcode-Identifiern können nie matchen (OGX 12-stellig,
The Ordinary Multi-Peptide Serum `769915195910` 12-stellig, Pantene Moisture Boost
`08700216939140` 14-stellig). Die Fehlerklasse kehrt bei jedem WP10-Import von
US-Marken-UPCs wieder.

**Fachliche Grundlage:** UPC-A (GTIN-12), EAN-13 (GTIN-13), EAN-8 (GTIN-8) und GTIN-14
sind EIN Nummernsystem; sie nesten per Links-Null-Padding. Kanonische Form: digits-only,
zero-padded auf 14 (GTIN-14). Echte GTIN-14-Multipack-Codes haben eine Indikator-Ziffer
≠ 0 → Padding kollidiert nie mit ihnen.

**Architektur-Fakt:** `product_identifiers.normalized_identifier_value` ist eine
GENERATED-ALWAYS-STORED-Spalte über die SQL-Funktion
`product_intake_review_normalize_identifier_value(identifier_type, identifier_value)`
(Migration `20260617120000`). Die Kanonisierung gehört also in diese Funktion; die
TS-Seite muss sie nur für den Query-Wert spiegeln.

**Entscheidungen (Nick, 2026-08-21):**
- Scan-Attempt-Log MIT `user_id` (Stealth-Phase-Debugging; Retention-Regel vor Public Launch).
- Kanonisches Format: GTIN-14-Padding, eine Spalte, kein Dreifach-Speichern.
- **Ein Barcode = genau ein Produkt** (Identität ist eindeutig; ersetzt den Juni-Kontrakt
  "ein Identifier darf auf mehreren Kategorie-Nutzungs-Zeilen stehen"). "Verwendung"
  ist eine SEPARATE Ebene: nach der Identifikation wählbar, gehört zur User-Produkt-
  Beziehung, nicht zur Katalog-Identität. Multi-Use-Bewertung (z. B. Conditioner als
  Maske bewerten) = eigenes zukünftiges Feature (braucht Facts je Use-Kategorie);
  wird durch die Eindeutigkeit weder blockiert noch vorausgesetzt.
  → Follow-up-Paket (Kanonisierungs-Migration + Uniqueness + Writer-Updates gemäß
  Codex F1/F3, Schema-Kontrakt-Test product-identity-schema.test.ts anpassen) ist
  damit ENTSCHIEDEN und kann als eigener Branch geplant werden.

---

## Task 1 — GTIN-Kanonisierung (TDD, deterministische Logik)

**Ziel:** Ein gescannter Barcode matcht unabhängig davon, ob die Quelle ihn 8-, 12-, 13-
oder 14-stellig geschrieben hat.

1. **TS:** `canonicalizeGtin(value: string): string | null` in
   `src/lib/product-identity/normalize.ts` (oder `src/lib/scan/`): digits-only prüfen,
   Länge ∈ {8, 12, 13, 14}, links auf 14 Nullen padden; sonst `null` → Fallback auf
   bisherige Normalisierung. Tests zuerst (OGX-Tripel als Fixture).
2. **Lookup:** `identifier-lookup.ts` nutzt für Barcode-Typen (`ean|gtin|barcode`) den
   kanonischen Wert als Query. `pending-submission.ts` (findOpenScanSubmission) und
   `product-matching.ts` (Intake-Dedup "nie eine bereits vergebene EAN neu zuweisen")
   auf denselben Vergleich umstellen.
3. **Query-Varianten statt Migrations-Abhängigkeit (nach Codex-Review umgebaut):**
   `gtinQueryVariants` fragt beim Lookup ALLE Schreibweisen ab (raw, kanonisch 14,
   plus 13/12/8 soweit führende Nullen es erlauben). Reads sind damit unabhängig vom
   Zustand der gespeicherten Daten — der OGX-Klasse-Miss ist mit dem App-Deploy
   behoben, ohne Migration.
4. **DB-Kanonisierungs-Migration + UNIQUE INDEX: ABGESPALTEN (Nick-Entscheidung
   offen).** Codex-Review 2026-08-21 fand 3 Blocker am ursprünglichen Migrationsplan:
   (a) Dedup-Preflight muss auf dem exakten künftigen Index-Key gruppieren
   (typ- und produktübergreifend), Cross-Produkt-Kollisionen fail-closed statt
   lowest-rank-Delete; (b) Rollout wäre nur one-way-kompatibel gewesen — durch die
   Query-Varianten (Punkt 3) entschärft; (c) globaler UNIQUE INDEX kollidiert mit
   bestehenden Writern (Approve/Link-RPCs ON-CONFLICT-Key, Heat/Scalp-Enrichment-
   Prefligths nur je Typ) und würde GTINs auch auf inaktiven Produkten reservieren.
   Zusätzlich (Codex F7): der ältere Product-Identity-Kontrakt (Plan 2026-06-10,
   product-identity-schema.test.ts) erlaubte BEWUSST einen Identifier auf mehreren
   Produktzeilen (Kategorie-Nutzungen) — DB-erzwungene Eindeutigkeit wäre eine
   Kontrakt-Umkehr und braucht eine explizite Produktentscheidung.
   → Empfehlung: dieser Branch shippt ohne die Kanonisierungs-Migration (Reads sind
   durch Punkt 3 abgedeckt); Migration + Uniqueness als eigenes Follow-up-Paket mit
   Writer-Updates, wenn Nick die Kontraktfrage entschieden hat. SQL-seitige
   Kanonisierung muss dann exakt die TS-Semantik spiegeln (Codex F6, gemeinsame
   Fixtures).

**Multi-Barcode pro Produkt (Nicks Frage, verifiziert):** bereits unterstützt — eine
Zeile pro Nummer, FK auf products; Unique-Constraint ist (product_id, identifier_type,
normalized_identifier_value), verhindert also nur exakte Duplikate, nicht mehrere
verschiedene Nummern. Beleg: "Kopfhautberuhigendes Intensiv-Tonikum" hat schon 2
Barcode-Zeilen. Nicks Flaschen-EAN (weicht von gespeicherter US-UPC ab!) wird als
zusätzliche Zeile am OGX-Produkt ergänzt, sobald er die Ziffern liefert.

## Task 2 — Scan-Attempt-Log (serverseitig)

**Ziel:** Jeder Resolve-Versuch hinterlässt eine Zeile — Miss-Häufigkeit = WP10-Backfill-Prioritätenliste.

1. **Migration:** Tabelle `scan_resolve_events`:
   `id uuid pk`, `user_id uuid not null`, `identifier_type text`, `raw_value text`,
   `canonical_value text`, `outcome text` (`hit | miss | pending_submission | quarantined | invalid`),
   `matched_product_id uuid null`, `created_at timestamptz default now()`.
   RLS: service-role-only (Vorbild `scan_wishlist`). Index auf (`canonical_value`),
   (`outcome`, `created_at`).
2. **Route:** Write in `src/app/api/scan/resolve/route.ts` — fail-open (Log-Fehler
   dürfen Resolve nie brechen). NUR Barcode-Versuche (identifier-Branch): der
   productId-Branch (Such-Sheet/Merkliste) loggt nichts — kein Barcode beteiligt,
   würde die Miss-Quote verfälschen (Codex F4). Unauthorized/Rate-Limit/Malformed
   enden vor dem Branch und sind bewusst außer Scope; `invalid` (Checksum) wird
   geloggt, `quarantined` bleibt vom `miss` unterscheidbar.
3. **Auswertung:** SQL-Rezept in `docs/` (Top-Misses nach Häufigkeit + distinct users);
   kein Admin-UI in diesem Schnitt.
4. **Tests:** Route-Tests erweitern (npm-Shim-Runner) — Outcome-Mapping je Pfad, fail-open.

## Task 3 — Decode-Feedback UI (VARIANTE A gewählt, 2026-08-21)

**Ziel:** Der Moment "Barcode erkannt" wird sichtbar; heute nur 200ms-Weißblitz → Sheet-Skeleton.

- Mockup: https://claude.ai/code/artifact/d433b369-b7da-41d4-883d-84e168422df9
  - A "Stiller Haken" (Empfehlung): Ecken grün + Pill "✓ Barcode erkannt" (~400ms), Sheet-Zeile "Produkt wird geprüft …".
  - B "Haken mit Nummer": wie A, Pill + Sheet zeigen die dekodierte EAN.
  - C "Status-Stepper": zweistufiges Overlay im Sucher, Sheet erst nach Prüfung.
- Add-on (variantenunabhängig, empfohlen): gescannte EAN immer im
  "Kennen wir nicht"-Sheet anzeigen → Tester-Reports einem Barcode zuordenbar.
- Randbedingung: iOS Safari hat keine Vibration API — rein visuell.
- Implementierung nach Sign-off: `scanner.tsx` (Decode-State statt Blitz),
  `scan-flow.tsx`/ResolvingBody (Prüf-Copy), neue Strings in `verdict-labels.ts`/Guidance.

## User Journey (SIGN-OFF ERTEILT 2026-08-21 — "The journey sounds excellent")

Entry: /scan, Kamera aktiv. 1) Nutzer richtet Barcode aus → Hint-Pill wie heute.
2) Stabiler Decode → [Varianten-Feedback], Attempt-Log-Insert beim Resolve-Call.
3a) Hit → Verdict-Sheet wie heute. 3b) Miss → "Kennen wir nicht"-Sheet inkl. EAN-Anzeige
(Add-on) → optional Warteliste (Submission speichert EAN wie bisher).
Error/Recovery: Resolve-Fehler / Rate-Limit unverändert; Log-Insert fail-open.

## Nicht-Ziele

- Kein Admin-Dashboard für Scan-Events (SQL-Rezept genügt).
- Kein EAN-Backfill der ~226 Produkte ohne Barcode (bleibt WP10).
- Keine Änderung der PostHog-Event-Grenzen (keine EANs in PostHog — Ruling bleibt).
- Keine Katalog-Hygiene (z. B. OGX-Duplikat mit Doppelname) in diesem Schnitt.

## Follow-up-Pakete (beide von Nick bestätigt, 2026-08-21)

**A — Barcode-Eindeutigkeit hart machen (eigener Branch, entschieden):**
DB-Kanonisierung der gespeicherten Barcode-Werte (SQL spiegelt exakt die
TS-Semantik von `canonicalizeGtin`, gemeinsame Fixtures — Codex F6) + partieller
UNIQUE INDEX über die Barcode-Typen. Voraussetzungen aus dem Codex-Review:
Preflight auf dem exakten Index-Key (typ-/produktübergreifend), Cross-Produkt-
Kollisionen fail-closed adjudizieren, Approve/Link-RPC-ON-CONFLICT-Pfade +
Heat/Scalp-Enrichment-Prefligths auf den neuen Key umstellen, Entscheidung
inaktive-Produkte-reservieren-GTINs treffen, Schema-Kontrakt-Test
(product-identity-schema.test.ts:106) auf den neuen Kontrakt umschreiben.

**B — "Verwendung" als eigene Ebene (geparkt bis zum ersten realen Fall):**
Architektur: Identität (Katalog) / Bewertung (Stage-3 je Kategorie+Rolle) /
Beziehung (user_products + Routine-Platzierung). Reihenfolge bei Bedarf:
(1) kuratiertes Katalogfeld für Sekundär-Verwendungen, (2) Klärungsfrage erst
bei der Routine-Platzierung (nie im Scan, nicht beim Merkliste-Save),
(3) Bewertung gegen Use-Kategorie im Authority-Engine (braucht Facts je
Use-Kategorie). Single-Use-Kategorien: Auto-Zuordnung (heutiges Verhalten).
Trigger: erstes Multi-Use-Produkt in Attempt-Log/Intake-Daten.

## Offene Punkte vor Implementierung

1. Nicks Variantenwahl (A/B/C) + Journey-Sign-off. [User-Facing Gate]
2. Ziffern unter dem Barcode auf Nicks OGX-Flasche (Bestätigung `0022796976116`).
3. Retention-Regel für `scan_resolve_events` vor Public Launch (nur notieren).
