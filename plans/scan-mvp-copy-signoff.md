# Produkt-Scan — Copy-Sign-off für Nick (Stand 2026-08-20)

Neue deutsche UI-Texte, die nicht 1:1 aus der abgenommenen Spec stammen. Bitte prüfen/anpassen — alles Einzeiler-Änderungen.

## Aus Task 8 (Result-UI)


1. `"Gut zu wissen"` card body: **"Ändert sich dein Haar oder deine Routine, prüfen wir das für dich neu."** The spec asks for the card ("conditions under which this changes") but the payload carries no such string.
2. Reason-block labels the spec doesn't name: supportive → "Warum das nur eingeschränkt passt", unknown → "Warum wir uns nicht sicher sind", deferred → "Warum das noch offen ist". (ideal / mismatch / not_needed use the spec's exact wording.)
3. Removal toasts: "Aus deiner Routine entfernt" / "Von der Merkliste entfernt". Error toasts: "Dieses Produkt kann gerade nicht gespeichert werden." (from the brief), "Das hat gerade nicht geklappt. Versuch es noch einmal.", plus one line per resolve error code (profile_missing, rate_limited, …).
4. Dimension axis with an unconfirmed product value renders "Keine Angabe" on the right instead of a bare label.
5. Pending screen body: "Meist innerhalb von 24 Stunden. Du bekommst eine Nachricht im Chat, sobald wir es eingeordnet haben." (spec elides after "im Chat…").
6. Empty/error states: search error "Die Suche ist gerade nicht erreichbar.", Merkliste error "Deine Merkliste lässt sich gerade nicht laden." + "Erneut versuchen", camera-unavailable notices per reason.
7. Control and status strings added in fix round 1's completeness pass: `"Merkliste öffnen"` (aria-label on the bookmark trigger, `scan-wishlist-sheet.tsx:26`), `"Wird eingereicht"` (submit button while pending, `scan-unknown-flow.tsx:145`), `"<Produktname>: Bild nicht verfügbar"` (aria-label on the thumbnail fallback, `scan-product-thumb.tsx:37`), `"Produkt wird geprüft"` (sr-only dialog name while resolving, `scan-flow.tsx:300`).
8. **Deviation from the spec's phrasing:** "Das übernimmt bei dir" renders as a section header above the covering-product cards, not as the spec's inline `"Das übernimmt bei dir: …"` sentence. Reason: it then matches the "Passende Alternativen" header directly above it in the same slot, which is the anatomy parity §2.5 is really about, and it keeps job/detail readable per entry instead of collapsing them into one run-on line. Trivial to restore the colon phrasing if Nick prefers it.


## Aus Task 1 (Verdict-Engine, src/lib/scan/verdict-labels.ts)

- 15 Begründungssätze für "Brauchst du nicht"-Ergebnisse (SCAN_NOT_NEEDED_REASON_COPY) — keine bestehende deutsche Quelle für diese Reason-IDs.
- 8 Job-Labels für "Das übernimmt bei dir" (SCAN_COVERAGE_JOB_LABELS).
- Verdict-Labels: Passt / Passt mit Einschränkung / Passt nicht / Unklar (+ Titel-Varianten).
- Deferred: "Das klären wir noch" / "Für <Kategorie> steht deine Einschätzung noch aus" — Hinweis Review: bei scalp_care liest sich "Für Kopfhautprodukt …" holprig (fehlender Artikel).

## Aus Task 5 (API)

- 409-Fall "product_not_saveable" (nicht-kuratiertes/quarantäniertes Produkt speichern): aktuell generischer Toast — ggf. freundlichere Erklärung gewünscht.

## Aus Task 7 (Scanner-Hints, src/lib/scan/guidance.ts)

- "Barcode in den Rahmen halten" / "Etwas näher ran" / "Weniger kippen" / "Mehr Licht hilft" (aus Prototyp übernommen).
