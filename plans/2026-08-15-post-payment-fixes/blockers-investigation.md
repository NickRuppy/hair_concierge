# Root-Cause-Investigation — Post-Payment-Blocker + Profil-Sync

Stand 2026-08-15. Read-only-Analyse (Code, git, Vercel-Logs, lokale Pipeline-Repro). Alle zentralen Zitate im Hauptsession-Review gegen den Code verifiziert. Nichts implementiert.

---

## Blocker 1: /anwendung dauerhaft „nicht verfügbar" + /chat-Redirect-Falle

### Root Cause
Der Screen ist der **generische catch-all** des Stage-5-Resolvers: jede Exception in `src/app/anwendung/page.tsx:85–175` wird zu `{ state: "unavailable" }` (`page.tsx:176–183`). Vercel-Logs bestätigen: `application_page_resolve → outcome: 'unavailable'` bei jedem Versuch (11:41–11:44 UTC), während dieselbe Pipeline am 14.08. noch `ready` lieferte — es scheitert an den **Katalogdaten der gewählten Produkte**, nicht global.

Die Pipeline wurde lokal mit der rekonstruierten Field-Test-Routine ausgeführt. Ergebnis: übersprungene Maske, doppeltes Öl, „Mit Einschränkung"-Conditioner und Gast-Account sind alle **unschuldig** (kompilieren zu `ready`). Es gibt genau **zwei Wurfstellen**, die den Screen erzeugen:

1. **Katalog-Identitätsprüfung** — `src/lib/personal-plan/routine/application-adapter.ts:214–223`: wirft `accepted_routine_product_unavailable`, wenn ein gewähltes Produkt fehlt, `is_active=false` / `lifecycle_status≠'active'` ist **oder sein `category_key` nicht dem Routine-Slot entspricht** (Kandidat: K18 „…Hair Mask" im Bondbuilder-Slot).
2. **`imageUrl`-Zod-Kontrakt (Hauptverdächtiger)** — `src/lib/routines/personal-plan/application/contracts.ts:126` (`z.string().url()`), geparst in `compiler.ts:813`, gefüttert mit rohem `product.image_url` (`application-adapter.ts:257`). Ein leerer String oder relativer Pfad in einer Katalogzeile → ZodError → ganze Seite tot. /routine ist immun, weil es sanitisiert (`load-view.ts:86–88`).

### Regressionen
- `f0505bd6` (#387, 13.08.): führte `image_url` in den Stage-5-SELECT **und** den strikten `.url()`-Kontrakt ein — erste `unavailable`-Events erscheinen auf dem unmittelbar folgenden Deployment (11 Events ab 13.08. 16:38Z).
- `12619247` (#344, 10.08.): führte den seitenfatalen `accepted_routine_product_unavailable`-Throw ein.
- Heutige Commits (#415–#420) sind nicht beteiligt.

### 2-Minuten-Bestätigung
Sentry-Issue `personal_plan_application_unavailable`, Tag `personal_plan.failure_reason`: `schema_contract` = imageUrl/Zod-Pfad, `unknown` = Identitätsprüfung, `database` = Supabase-Fehler. (Die Originalfehlermeldung wird bewusst nicht weitergegeben — `personal-plan-application.ts:69–70` — deshalb war ein Code-Audit nötig.) Alternativ die SQL-Query im Agent-Output: alle Routine-Produkt-IDs gegen `products.image_url ~ '^https?://'`, `category_key` und `lifecycle_status` prüfen.

### Fix-Vorschlag
1. **Bild darf nie die Seite töten:** `application-adapter.ts:257` → `imageUrl` wie in `load-view.ts:86–88` normalisieren; zusätzlich `contracts.ts:126` → `.catch(null)`.
2. **Pro-Produkt degradieren statt seitenfatal werfen:** `application-adapter.ts:214–223` → Item in `unresolvedRoutineItems` schieben (rendert bereits als „Noch kein Produkt gewählt") + `reportFailure` mit `product_id`; fail-closed nur, wenn **kein** Item übrig bleibt.
3. **Diagnostizierbarkeit:** stabilen `personal_plan.failure_code`-Tag + `product_id` an Sentry hängen (`personal-plan-application.ts:70`).
4. **„Erneut laden" ehrlich machen:** `application-state.tsx:88–100` — Ausweg „Zur Routine" ergänzen (wie die anderen drei States); Copy „…sobald die Anleitung wieder erreichbar ist" streichen, solange deterministische Defekte möglich sind.

### /chat-Redirect (Chat aktivieren)
Middleware-Gate, kein Chat-Code beteiligt: `src/lib/supabase/middleware.ts:397–407` → `frontier-routing.ts:50`:
```ts
if (pathname === "/auth" || isRoute(pathname, "/chat")) return frontier.nextHref
```
Mit aktiver Routine ist `frontier = "stage5"` → `nextHref = "/anwendung"`: **jeder** Personal-Plan-Nutzer mit aktiver Routine wird unbedingt von /chat nach /anwendung gebounct (307 in den Logs), während die Nav den Chat-Tab trotzdem zeigt (`navigation-access.ts:35`). Eingeführt durch `ae720e5c` (#376, 12.08.). `/api/chat` ist nicht betroffen — das Chat-Backend läuft.

**Minimale Entkopplung (3 Guard-Edits):**
1. `frontier-routing.ts:50` — `/chat`-Klausel entfernen (und optional aus `isFrontierControlledRoute`, Zeile 65).
2. `intake-state.ts:78–90` — Personal-Plan-Bypass auf `/chat` ausweiten, sonst greift das zweite Gate (`:58–68`) und schickt zu /onboarding.
3. `middleware.ts:434–437` — `personalPlanRoutineAccess`-Preload auch für `/chat` laden, sonst schlägt der Bypass fail-closed fehl.

Tests: `tests/personal-plan-frontier-routing.test.ts:79,89` anpassen.

---

## Blocker 2: Falscher „Nicht gespeichert"-Screen nach letztem „Dieses Produkt einplanen"

### Root Cause
**Fixer 12-Sekunden-Client-Timer über dem finalen Batch-Save — kein Speicherfehler.**
- Produkte 1–7 speichern nur lokal (`rememberLocalReviewChoice`, `stage3-products-flow.tsx:2446–2460`, localStorage, Badge „Auswahl gemerkt").
- Der letzte Klick löst `submitReviewedDecisions` aus (`:2567–2695`): **alle 8 Entscheidungen als ein Batch**, umwickelt von `withStage3FinalizationTimeout` mit `finalizationTimeoutMs = 12_000` (`:249`, Helper `:3429–3444`). Der Timer **bricht den Request nicht ab** — der Server committet normal, der Client rejected.
- Der Timeout-Catch (`:2666–2669`, analog `:2830–2833` in `completeFlow`) geht als **einzige** Fehlerklasse NICHT durch die Auto-Recovery (`handlePendingRecoveryError`, `:1839–1882`), sondern direkt in `pendingRecoveryMode = "manual"` → Dead-End-Screen, ohne Log/Analytics (daher die saubere Konsole).
- **Badge-Bug obendrauf:** `Stage3Shell` verwirft `saveState.label` und rendert `SAVE_COPY[status]` (`index.tsx:91–95` → `journey-header.tsx:10–16`); `"manual"` mappt auf `"error"` → „Nicht gespeichert" statt des vorgesehenen „Speicherstatus wird geprüft" (Zeile 737–738 ist toter Code).
- Der Retry-Button ruft `recoverPendingIntent` → Draft-Reload → `"satisfied"` → `completeFlow` — deshalb genügte im Audit ein Klick.

### Warum nur beim letzten Produkt
Strukturell: 1–7 machen null Serverarbeit; der letzte Klick trägt ~8 volle Authority-Evaluationen in einem Request (`production-persistence-gateway.ts:1048–1105`, Kandidaten-Cache-Key = category+role → 8 uncachte Loads) plus `gateway.complete`, jeweils unter demselben 12s-Budget. Zusätzlich: beide API-Routen deklarieren kein `maxDuration`.

### Regression
`c983d88e` — „Remove repeated loading screens from Personal Plan products" (#398), **gemerged 14.08., einen Tag vor dem Audit**. Führte Batch-Save, Timer und Manual-Dead-End gleichzeitig ein.

### Fix-Vorschlag
1. Timeout-Catches (`:2666–2669`, `:2830–2833`): statt `"manual"` → `"checking"` + kurzer Backoff (1,5–3s) + automatisch `recoverPendingIntent`; `"manual"` nur, wenn auch der Reconcile scheitert. (Idempotent dank `classifyStage3DesiredState → "satisfied"`-Kurzschluss und `MAX_RESENDS = 1`.)
2. Budget skalieren (`base + perDecision × n` oder ~30s) und `export const maxDuration` in `/api/personal-plan/stage-3/route.ts` + `.../complete/route.ts`.
3. PostHog-Event für den Timeout-Ausgang (heute unsichtbar).
4. Badge fixen: `saveState.label` durchreichen oder eigenen `"checking"`-Status im Journey-Header.
5. Optional Serverkosten senken: `resolveAuthorityDecisions` auf Fingerprint-Check statt Voll-Re-Derivation pro Subjekt.
6. Test `tests/personal-plan-stage3-flow.test.tsx:4077–4145` asserted heute das Dead-End-Verhalten → auf neues Orakel umschreiben.

---

## Profil-Sync: /profile zeigt Feinschliff- und Produktangaben nicht

### Root Cause
**/profile liest die Legacy-Stores, der Wizard schreibt in die Personal-Plan-Stores — es gibt keinerlei Sync.**

| Profil-Sektion | liest aus | Wizard schreibt in |
|---|---|---|
| Alltag (Handtuch, Trocknung, Nachtschutz…) | `hair_profiles`-Spalten (`profile/page.tsx:531–535`, `section-config.ts:260–330`) | `personal_plan_refinement_drafts` → `personal_plan_need_versions` (`stage2-refinement-supabase.ts:55–134`) |
| Styling (Hitzetools, Frequenz) | `hair_profiles.styling_tools`, `.heat_styling` | dito (`additionalHeatTools`) |
| Produkte-Grid | `user_product_usage` (`page.tsx:658–666`) | Stage-3-Routen (nie `user_product_usage`) |
| „Nicht verwendete Produkte" (funktioniert!) | `/api/personal-plan/portfolio-presentation` | Personal-Plan-Store — die einzige Sektion an der richtigen Quelle |

„Hitzeschutz: Nein" ist gefüllt, weil es aus dem Legacy-/onboarding stammt — Zufall zweier Datenpfade, kein Sync. „Nichts davon"-Antworten werden korrekt als `[]` mit completed-Status gespeichert (`question-path.ts:197–211`) — das „Noch offen" ist ein reines Read-Path-Artefakt.

### Fix-Empfehlung: Read-Path, kein Backfill
Backfill würde sofort wieder driften (beide Systeme schreiben weiter unabhängig). Stattdessen /profile auf die Personal-Plan-Quelle umstellen (Muster existiert schon bei `portfolioPresentation`, `page.tsx:560–584`), Fallback auf Legacy für Nutzer ohne Personal Plan:
- `profile/page.tsx:516–558` (hair-profile-Load) und `:643–684` (product-usage-Load)
- `section-config.ts:225–330` — `getValue` braucht zusätzlich die `PersonalPlanRefinementAnswersV1`-Shape (kann „beantwortet: keins" ausdrücken)
- `editTarget: {kind:"onboarding"}` in den Sektionen muss dann auf die Feinschliff-Edit-Flows zeigen, nicht auf /onboarding.

### „1 aktives Produkt"
`routine-page.tsx:102–104` zählt nur `executable && included`; `executable` = `product.kind === "owned"` (`editor.ts:51`) → zählt nur schon besessene Produkte. Copy-Vorschlag siehe styling-fixes.md #8.

---

## Empfohlene Reihenfolge
1. **Hotfix A (Anwendung):** imageUrl-Normalisierung + `.catch(null)` + Identitäts-Throw → Degradierung. Entsperrt Stufe 5 für alle betroffenen Nutzer. Danach Sentry-Tag prüfen, welcher Fall es konkret war.
2. **Hotfix B (Chat):** 3 Guard-Edits — entsperrt Chat unabhängig von A.
3. **Hotfix C (Stage-3-Timeout):** Auto-Reconcile + Badge-Fix.
4. **Profil-Read-Path** als eigener Branch (größerer, aber unkritischer Umbau).

Repro-Harness (außerhalb des Repos): `scratchpad/repro.ts` der Session — führt die echte Stage-5-Pipeline mit der Field-Test-Routine aus.
