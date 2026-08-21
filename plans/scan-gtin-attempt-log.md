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
3. **Migration:** `product_intake_review_normalize_identifier_value` erweitern —
   für `identifier_type IN ('ean','gtin','barcode')` und digits-only-Wert mit Länge
   8/12/13/14 → lpad auf 14. Danach Recompute erzwingen (Drop/Re-Add der generated
   column + beide Indexe, exakt nach Vorbild `20260617120000`) inkl. erneuter
   Duplicate-Rank-Bereinigung (Kanonisierung kann bisher verschiedene Werte kollabieren).
4. **Verifikation:** SQL-Probe nach Apply — die 3 betroffenen Produkte matchen auf ihre
   EAN-13-Formen; `022796976116`-Scan-Simulation via resolve-Route gegen Prod-Schema
   im Test-Setup.
5. **Härtung (Audit-Fund 2026-08-21):** Cross-Produkt-Eindeutigkeit für Barcode-Typen
   ist heute NICHT DB-erzwungen (nur Soft-Handling: lowest-id-wins im Lookup + Intake-
   Dedup-Regel). Aktuell 0 Kollisionen. Nach der Kanonisierungs-Dedup: partieller
   UNIQUE INDEX auf (normalized_identifier_value) WHERE identifier_type IN
   ('ean','gtin','barcode') — macht die bestehende App-Regel "nie eine vergebene EAN
   neu zuweisen" hart. Vorher prüfen: Intake-Approve/Link-RPCs (ON CONFLICT-Pfade)
   müssen bei Verletzung sauber fehlschlagen, nicht crashen.

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
   dürfen Resolve nie brechen), ein Insert pro Request, auch für `invalid` (Checksum-Fail).
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

## Offene Punkte vor Implementierung

1. Nicks Variantenwahl (A/B/C) + Journey-Sign-off. [User-Facing Gate]
2. Ziffern unter dem Barcode auf Nicks OGX-Flasche (Bestätigung `0022796976116`).
3. Retention-Regel für `scan_resolve_events` vor Public Launch (nur notieren).
