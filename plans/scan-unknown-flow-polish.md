# Scan-Polish: Kennen-wir-nicht Redesign, Marken-Vorschläge, X-Fix

**Worktree:** `.worktrees/scan-unknown-flow-polish` (`codex/scan-unknown-flow-polish`, base `a4171b0b`).
**Evidence review + Journey-Sign-off:** CONFIRMED 2026-08-21 ("sounds good") — Mockup
https://claude.ai/code/artifact/6dec1aef-6d3d-4056-9e6c-a9470ec44d17 (Variante A, Copy final
nach 2 Feedback-Runden: warm + 2-Zeilen-Kopf).

## Task 1 — X-Button-Fix (Ergebnis-Sheet)

`ProductHeader` (scan-result-card.tsx) läuft unter den sheet-eigenen Schließen-Button
(`absolute right-3 top-2`, 40px). Fix: rechter Freiraum am Header (`pr-9`).
Slide-down-Dismiss: bereits funktional verifiziert (bottom-sheet.tsx: handle_drag >80px
→ requestDismissal → onOpenChange(false) → onClose) — keine Änderung nötig.

## Task 2 — Kennen-wir-nicht Redesign (Variante A, finale Copy)

`scan-unknown-flow.tsx` Schritt 1:
- Kopf = exakt 2 Zeilen: Headline "Oh, das kennen wir noch nicht!" (shared constant in
  verdict-labels.ts, auch für sheetTitle in scan-flow.tsx) + "Was für ein Produkt ist
  es? Wir nehmen es gern auf." Eyebrow, Erklärtext und Barcode-Zeile oben entfallen.
- Kategorie-Karten: nur Name, 17px bold; `need`-Subtext entfällt.
- Expander: gestrichelte Karte "Weitere Produktarten" + Chevron statt Textlink.
- Barcode als Mini-Zeile (xs, zentriert, tabular-nums) unter den Karten.
- ~24h-Zusage NUR in der Bestätigung (PendingBody hat sie bereits — keine Änderung).

Schritt 2 Copy: "Magst du uns noch die Marke verraten?" / "Alles optional — der Barcode
reicht uns meistens schon."

## Task 3 — Marken-Vorschläge aus der Datenbank

- Lib (TDD): `src/lib/scan/brand-suggestions.ts` — `suggestScanBrands(client, query)`:
  lädt `brands` (id, canonical_name; limit 200, Katalog ~50), filtert in Node über
  normalisierte Namen, Ranking Prefix vor Substring, max 6.
- Route: `GET /api/scan/brands?q=` — Muster von `/api/scan/search` (auth, SCAN_RATE_LIMIT,
  zod min 2 / max 120, deps-Injection, Route-Tests).
- UI Schritt 2: ab 2 Zeichen debounced (200ms) Vorschlags-Chips unter dem Markenfeld,
  Tap übernimmt; freier Text bleibt immer möglich; stale Responses verworfen.

## Nicht-Ziele

Intake-Queue-Ops (separater Block), EAN-/Sortiments-Ausbau (geparkt), weitere
Ergebnis-Sheet-Umbauten.
