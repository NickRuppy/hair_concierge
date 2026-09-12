# Scanner-first Funnel `/lp/scan` (Variante B „Regal-Moment“)

**Stand:** 2026-09-11 · Worktree `.worktrees/scanner-funnel` · Branch `codex/scanner-funnel` · Basis `origin/main` 469d41f5
**Status:** Plan Rev. 2 (nach Codex-Plan-Review 2026-09-12, 14 Findings eingearbeitet) — Decision Coverage **`confirmed`** 2026-09-12: Journey von Nick abgenommen, Nach-Kauf-Präzisierung (Zahlung → kurzer Bereitstellungsschritt mit Scanner-Copy → `/scan`) bestätigt. Undiscussed consequential assumptions affecting this handoff: none.
**Lieferweg:** Owner-PR aus diesem Worktree (kein Fork-PR — der Fork-Scope-Gate in `.github/workflows/ci.yml` lässt Quiz-, Proxy-, Billing-, Analytics- und Test-Dateien nicht zu).

## Ziel

Ein drittes, parallel laufendes Funnel-Paket, das den Produkt-Scanner statt des Plans in den Mittelpunkt stellt. Basis ist das heutige 10-Fragen-Legacy-Quiz (`/quiz`), Fragen und Reihenfolge unverändert. Neu sind: Landing, drei „Einfügungen“ im Quiz, die mit der jeweils letzten Antwort arbeiten, paketbedingte Copy in Lead-Erfassung, Bereit-Screen und Ladeseite, eine Scanner-Angebotsseite und die Landung im Scanner nach dem Kauf. Das organische Paket (`default_organic`) und das Meta-Paket (`meta_personal_plan_v1`) bleiben byte-identisch.

**Nicht-Ziele:** kein Preis-, Checkout- oder Entitlement-Change; kein A/B-Splitter; keine Änderung am 19-Fragen-Quiz; kein Scanner-Feature-Umbau; kein E-Mail-Flow-Umbau.

## Evidenz

- Klick-Prototyp (Rev. 10, drei Varianten, B gewählt): https://claude.ai/code/artifact/375926a2-ee49-4263-8360-4d104d83b53f — Quelle in `plans/scanner-funnel/evidence/prototype/` (Wegwerf-Artefakt, kein Produktionscode).
- Foto-Prompts + Generierungsnotizen: `plans/scanner-funnel/evidence/prompts/`. Foto-Originale (1024×1536 PNG) liegen außerhalb des Repos in Nicks Ablage; die web-tauglichen WebP-Versionen kommen mit T6 nach `public/images/funnels/scan/`.
- Gesperrtes Scan-Ergebnis-Design: `.worktrees/ios-scanner-plan/plans/ios-scanner/design-spec.md` (Tabelle, Farben, Copy der Ergebniszeilen).

## Decision-Coverage-Record

**Confirmed with Nick (2026-09-11)**

1. Basis = Legacy-Quiz (10 Fragen), nicht das 19-Fragen-Quiz; Fragen unverändert.
2. Drei Einfügungen: nach Dichte (Schritt 13), nach Kopfhaut (Schritt 6), nach Zielen (Schritt 12). Sie zählen nicht als Fragen („x/10“ bleibt).
3. Produktionsvariante = **B Regal-Moment** (Landing „200 Shampoos im Regal. Eins passt zu dir.“, Einfügungen Problem → Lösung → Zuhause, Angebot „Nie wieder raten vorm Regal.“ mit Vorher/Nachher direkt nach dem Hero).
4. Rollout = **neues, paralleles Funnel-Paket**; organisch und Meta bleiben; Meta-Kampagnen dürfen auf `/lp/scan` zeigen.
5. Gleiches Abo, gleiche Preise (14,99 / 34,99 / 99,99, Jahr empfohlen); Scanner ist Headline, Plan/Anwendung/Chat sind der „Was du bekommst“-Stack.
6. Abdeckungs-Claim: „die gängigen Produkte von dm und Rossmann“, keine Zahl; Unbekannt-Zeile „Ein Tipp genügt – wir prüfen es und melden uns im Chat“. Die Kachel „Über 1.000 Produkte analysiert & geprüft“ bleibt.
7. Hero der Angebotsseite = animierte Scan-zu-Ergebnis-Demo statt des Videos.
8. Fotos = KI-generierte Lifestyle-Bilder mit echtem Screen auf dem Handy; darüber die animierte Ergebnis-Karte (startet unsichtbar, 0,8 s Verzögerung, 1 s Slide-up). **Karte spiegelt das Produkt auf dem Screen** (Alverde Balance Shampoo Melisse / Balea Professional Repair Kur).
9. Ergebnis der Einfügungen = **antwortbezogene Beispieltabelle**, kein Engine-Aufruf, immer „Beispiel“-Label.
10. Nach dem Kauf = **Scanner zuerst** (`/scan`, Hinweis „Dein Plan wartet daneben“). **Präzisierung nach Review (zu bestätigen):** der Scanner urteilt erst, wenn `personal_plans` mit initialem Bedarfs-Snapshot existiert (`src/lib/scan/profile-context.ts`); die Landung ist deshalb „Bereitstellung → Scanner“: nach der Zahlung läuft die bestehende Plan-Bereitstellung (heute `/plan-bereit`), dann geht es statt nach `/plan-start` nach `/scan`. Nie eine leere Kamera.
11. Copy-Regeln: kein „Urteil“ in Nutzer-Copy (→ „Ergebnis“, „passt“); Telegrammstil; Copy des Prototyps Rev. 10 ist Referenz.

**Inherited from evidence or contract**

- Scanner-Gate bleibt: aktives Abo + vorhandenes Haarprofil (`src/lib/personal-plan/navigation-access.ts`, Scan-Routen).
- Ergebnis-Copy „Passt zu deinem Haar / Passt mit Einschränkung / Passt nicht zu deinem Haar / … zu deiner Kopfhaut“ aus `src/lib/scan/verdict-labels.ts` und der Design-Spec.
- Pricing-Slot wird genau einmal gerendert (`funnel-variant-creator`-Vertrag); Checkout, Zahlungs-IDs, Tracking-Ziele bleiben ownerseitig.
- Lead-Erfassung inkl. Einwilligungs-Copy bleibt (`quiz-consent-sheet.tsx`).

**Implementation defaults (kein Produkt-Einfluss, bei Plan-Review ansprechbar)**

- Slug `/lp/scan`, Package-Key `scan_v1`, Channel `meta`, Landing-Variante `scan-regal`, Offer-Variante `scan-regal-v1`. (Nick: „kürzer“ — `scan` ist der kürzeste sinnvolle Slug; bei Widerspruch nur `packages.json` ändern.)
- Neue Schrittnummern 16/17/18 für die Einfügungen; Reihenfolge-Arrays werden Funktionen des Package-Keys.
- Fotos unter `public/images/funnels/scan/*.webp` (900 px breit, q84).
- Neues Event `quiz_insert_viewed { insertId, funnelPackageKey }`; Landing feuert wie heute `landing_viewed` via `LandingTracking`.
- Beispieltabelle als reine Funktion in `src/lib/quiz/scan-insert-examples.ts` (TDD).

**Open consequential assumptions affecting this handoff: none.**
Offen, aber nicht handoff-relevant: 19-Fragen-Quiz bekommt später ggf. dieselbe Behandlung (eigenes Paket); Metriken/Kill-Kriterien für das Paket (PostHog-Vergleich `landing_viewed → quiz_completed → purchase_completed` je Package reicht zum Start).

## Technische Landkarte (aus dem Code-Mapping, Stand main 469d41f5)

| Thema | Befund | Konsequenz |
| --- | --- | --- |
| Attribution | `src/proxy.ts:250-261` erlaubt genau zwei Zweige: `default_organic` (aktiv, ohne Slug) und `meta_personal_plan_v1` (`placeholder` + Flag). Dasselbe Prädikat entscheidet in `shouldStartNewFunnelSession` (`:282`) über Cookie-Weiterverwendung. | Beide Zweige unverändert lassen und einen **dritten Zweig** ergänzen: `scan_v1` attributierbar bei `status: active` oder bei `placeholder` + Flag `SCAN_FUNNEL_ENABLED` (Meta-Muster; lokales Testen ohne Aktivierung). Tests: bestehende Cookie-Weiterverwendung, Meta Flag an/aus, scan an/aus (T1). |
| Quiz-Kompatibilität | Routen-Quizzes (`delivery.kind: route`) akzeptieren jede Landing, die nicht einem eingebetteten Quiz vorbehalten ist (`src/funnels/quizzes/registry.ts:95`); Generator und Checker prüfen dieselbe Regel (`tests/funnel-packages.test.ts:80`). | **Kein** Eintrag in `registry.json` nötig; der Generator legt Landing/Offer-Stubs und Registries an. |
| Placeholder-Sichtbarkeit | `/lp/[slug]` blockt nur `archived`; `placeholder` ist öffentlich erreichbar (`src/app/lp/[slug]/page.tsx:48`). | Release-Gate = Flag `SCAN_FUNNEL_ENABLED` (Attribution) + Statuswechsel `placeholder → active` (T11). Ohne Flag zeigt `/lp/scan` 404 wie Meta ohne Flag (gleiche Prüfung in der Route ergänzen). |
| Quiz-Store | Zustand-Store ist ein Modul-Singleton; `page.tsx:106` behält In-Memory-Fortschritt; Client-Bootstrap cached Promise + Kontext (`src/lib/funnel/client.ts:10`). Zweiter Konsument: `src/app/test/quiz/session/layout.tsx` (Feldtest) rendert dieselbe Shell; Moderator-Einstieg resettet den Singleton (`moderator-account-entry.tsx:46`). | Provider-scoped Initialisierung vor dem ersten Kind-Render, definierte Präzedenz Cookie > Bootstrap, kein Singleton-Mutieren beim Server-Render; Feldtest-Layout und Moderator-Reset mitziehen (T2). |
| Draft-Persistenz | Kein Persist-Middleware; eigener localStorage-Draft mit einem Key ohne Paket-Identität (`src/lib/quiz/draft.ts:4,13`, `store.ts:65`); Schritte 16–18 fallen heute durch die Draft-Validierung; `restoreDraft` wendet `initialState` neu an (`store.ts:93`). | Draft bekommt Version + Package-Key; inkompatible Schritte werden vor dem History-Seeding normalisiert; Paket bleibt über Restore/Reset erhalten (T3). Tests: scanner→organic, organic→scanner, Reload auf jeder Einfügung. |
| Package → Lead → Offer | Package-Key/Offer-Variante liegen in `funnel_sessions` (nicht auf `leads`), gelesen über `resolveFunnelContextForLead`; `/result/[leadId]` nutzt für Nicht-organische Pakete `resolveLegacyResultOfferVariant` → gespeicherte Offer-Variante. | Keine Migration nötig; Offer-Variante kommt automatisch (T7). |
| Package im Quiz-Client | `getCurrentFunnelContext()` (`src/lib/funnel/client.ts`) ist erst nach dem Fetch von `/api/funnel/session` gefüllt; `src/app/quiz/layout.tsx` liest nichts serverseitig. | Package-Key serverseitig aus dem Cookie lesen und an den Store geben (T2), Client-Bootstrap nur als Fallback. Erste Render muss die richtige Reihenfolge kennen. |
| Schritt-Arrays | Keine fünf austauschbaren Arrays: `types.ts` ist die Union, `QUIZ_QUESTION_STEPS` die Nummerierung (bleibt), `STEP_ORDER` (Store) und `QUIZ_MOTION_ORDER` (Shell) sind Schrittfolgen, `browser-history.ts` expandiert die Lead-Erfassung in drei Einträge und filtert Partner-Screens. Weitere Konsumenten: History-Provider (`quiz-browser-history.tsx:36`), Draft-/Migrations-Restore-Positionen (`page.tsx:92,115`), Progress-Transition (`quiz-shell.tsx:37`), `migration-prefill-init.ts:91`, `brand-panel-content.ts:25`, `STEP_NAMES` + Switch (`page.tsx:33,184`). | Eine Quelle `getQuizScreenOrder(packageKey)`, daraus **explizite Projektionen** (Store-Folge, Motion-Folge, History-Folge inkl. Lead-Substeps und Partner-Filter) (T3). Default-Projektionen per Snapshot byte-identisch; Rückwärts-Transitions und Progress beim Verlassen einer Einfügung testen. |
| Copy-Stellen | `quiz-info-strip.tsx:23`, `quiz-lead-capture.tsx:331`, `quiz-analysis.tsx:11-16,111,141`. | Paketbedingte Copy-Map (T5). |
| Nach dem Kauf | `getCheckoutFirstTimeDestination` (`checkout-success-redirect.ts:83-97`) verzweigt nach Reaktivierung, `quizKind`, Personal-Plan-Legacy/Readiness und `legacyQuizFuturePurchaseEligible`; Legacy-Käufe landen auf `/plan-bereit?lead=…` oder `/onboarding`. Ziel-Union + Validator (`:3,21,99`) kennen `/scan` nicht. Passwort- und Magic-Link-Aktivierung lösen das Ziel separat auf (`api/auth/set-checkout-password/route.ts:141`, `api/auth/send-magic-link/route.ts:133`). Profil-Verknüpfung schluckt Fehler (`link-to-profile.ts:210,270`, `stripe/checkout-activation.ts:818`, `paypal/checkout-activation.ts:494`). | **Scanner braucht mehr als ein Haarprofil:** `personal_plans` + initialer/verfeinerter Bedarfs-Snapshot, sonst `profile_missing` (`src/lib/scan/profile-context.ts:39,66`, `api/scan/resolve/route.ts:377`); Onboarding-Bypass für `/scan` gilt für Personal-Plan-Berechtigte (`src/lib/auth/intake-state.ts:94`). Deshalb: Landung = bestehende Bereitstellung (`/plan-bereit`) → `/scan` statt `/plan-start` (T8), Package-Identität aus vertrauenswürdiger Session/Kauf-Evidenz, alle Aktivierungspfade + Validator + Reaktivierungs-Vorrang abgedeckt. T0 beweist die Kette für einen echten Neukunden. |
| Tests, die die Sequenz pinnen | `tests/quiz-motivation-copy.test.ts`, `tests/legacy-quiz-browser-history.test.ts`, `tests/quiz-onboarding-e2e.spec.ts`, `tests/legacy-quiz-motion.spec.ts`, `tests/legacy-quiz-mobile-action.spec.ts`, `tests/legacy-quiz-ui.test.ts`, `tests/quiz-result-routing.e2e.spec.ts`. | Bestehende Tests müssen grün bleiben (Default-Paket); neue Tests für `scan_v1` (T10). |
| Generator | `scripts/funnels/new-package.mjs` scaffoldet Landing/Offer-Stubs, hängt an `packages.json` an, regeneriert beide `registry.generated.ts`; `npm run funnel:check` in CI. | T1 nutzt den Generator. |

## Aufgaben

### Task 0: Spike: Scanner-Bereitschaft nach Legacy-Kauf (1 Tag, read-only + lokaler Test-Mode-Checkout).

Für einen **echten Neukunden ohne bestehenden Bedarfs-Snapshot** die Kette beweisen: Kauf (Karte und PayPal, Test-Mode laut `docs/local-qa-access.md` §3) → Aktivierung → Profil-Verknüpfung → `/plan-bereit`-Bereitstellung → `personal_plans` mit initialem Snapshot → Middleware-Zulassung `/scan` → `POST /api/scan/resolve` liefert ein Ergebnis (kein `profile_missing`). Festhalten, welche Schritte heute automatisch laufen und wo `legacyQuizFuturePurchaseEligible` greift. Ergebnis legt die konkrete Form von T8 fest. Läuft die Bereitstellung für Legacy-Leads nicht automatisch: Stopp, Rücksprache (Ruling 10).

### Task 1: Paket + Attribution.

`npm run funnel:new -- --key scan_v1 --slug scan --landing scan-regal --quiz legacy-quiz-v1 --offer scan-regal-v1 --channel meta` (legt Stubs + Registries an; kein `registry.json`-Eintrag nötig). In `src/proxy.ts` einen dritten Zweig in `isAttributableFunnelPackage`: `scan_v1` bei `active`, oder bei `placeholder` + `SCAN_FUNNEL_ENABLED`; bestehende Zweige unverändert. Route `/lp/[slug]` blockt `scan_v1` ohne Flag mit 404 (Meta-Muster). Status bleibt `placeholder` bis T11. Tests: Paket-Validierung, Attribution für `/lp/scan` (Flag an/aus), Cookie-Weiterverwendung für organisch und Meta unverändert.

### Task 2: Package-Kontext ins Quiz.

`src/app/quiz/layout.tsx` **und** `src/app/test/quiz/session/layout.tsx` lesen das Funnel-Cookie (`resolveFunnelCookieContext`) und initialisieren den Store über einen Provider, bevor Kinder rendern; Präzedenz Cookie > Client-Bootstrap; bei Client-Navigation mit anderem Paket wird die Reihenfolge neu abgeleitet und der Schritt normalisiert; kein Mutieren des Singletons im Server-Render; Moderator-Reset (`moderator-fresh-start.ts`) behält das Paket. Tests: Init mit/ohne Cookie, Feldtest-Layout, Moderator-Fresh-Start unverändert.

### Task 3: Schritt-Maschinerie + Draft.

`QuizStep` um `16 | 17 | 18` erweitern (`scan_insert_problem`, `scan_insert_solution`, `scan_insert_home`); `getQuizScreenOrder(packageKey)` in `src/lib/quiz/screen-order.ts` als einzige Quelle mit expliziten Projektionen: Store-Folge (`STEP_ORDER`), Motion-Folge (`QUIZ_MOTION_ORDER`), History-Folge (Lead-Substeps expandiert, Partner-Filter, Kopfhaut-Substeps erhalten); `QUIZ_QUESTION_STEPS` unverändert; `page.tsx`-Switch, `STEP_NAMES`, Progress-Transition, Migrations-Restore und `brand-panel-content` auf die Projektionen umstellen. Draft: Version + Package-Key im Draft; inkompatible Schritte vor History-Seeding normalisieren; `restoreDraft` behält das Paket. Fortschritt auf Einfügungen: Balken auf Stand der letzten Frage, Zähler leer, Eyebrow-Copy je Einfügung. Tests (TDD): Projektionen je Paket; Default-Projektionen byte-identisch (Snapshot); `goNext/goBack` über Einfügungen inkl. Rückwärts-Transition und Progress; Browser-History-Positionen; Draft-Fälle scanner→organic, organic→scanner, Reload auf jeder Einfügung (Erweiterung `tests/quiz-draft.test.ts`).

### Task 4: Einfügungen.

`src/components/quiz/scan-inserts/`: `ScanInsertProblem` (nach 13: „Vorm Regal raten alle.“ · 63 % · „Dein Anfang der Lösung: {Struktur} Haar, {Dicke}.“), `ScanInsertSolution` (nach 6: „Nicht mehr raten. Scannen.“ · „Du hast „{Kopfhaut}“ angegeben. Jedes Shampoo, das nicht dazu passt, erkennt der Scanner in Sekunden – bevor es im Korb landet.“), `ScanInsertHome` (nach 12: „Dein Bad ist das erste Regal.“ · „Scann, was da steht. Was passt, bleibt. Was nicht passt, fliegt raus. Was fehlt, kommt in deinen Plan.“). Gemeinsam: `ScanInsertPhoto` (Foto + `ScanExampleCard`, Animation `cardup` 1 s / 0,8 s Delay, `prefers-reduced-motion` → sofort sichtbar, „Beispiel“-Tag auf der Karte, CTA „Weiter“). Beispieltabelle `src/lib/quiz/scan-insert-examples.ts` (rein, TDD): Einfügung 1 → OGX Argan Oil of Morocco Shampoo mit Haardicke-Zeile aus `thickness` (Produkt „dick“: fein → passt nicht, mittel → mit Einschränkung, dick → passt; Ruling nach Task-4-Review, weil das Foto der Einfügung 1 keinen Screen zeigt); Einfügung 2 → Alverde Balance mit Kopfhaut-Zeile aus `scalp_type`, `has_scalp_issue`, `scalp_condition` (Singular; `quiz-scalp-question.tsx` löscht die Felder beim Typwechsel getrennt — Fixtures: kein Problem, jede Beschwerde, geänderte Antwort); Einfügung 3 → Balea Repair Kur mit Pflegegewicht aus `thickness`. Werte einwortig, Zeilenstatus ok/warn/bad wie Design-Spec. Event `quiz_insert_viewed`.

### Task 5: Paketbedingte Copy.

`src/lib/quiz/funnel-copy.ts` mit Map je Package-Key; Default = heutige Strings unverändert; `scan_v1`: Info-Strip „10 schnelle Fragen zur Basis, dann urteilt der Scanner über deine Produkte.“ → **Achtung Ruling 11: „urteilt“ ersetzen → „dann prüft der Scanner deine Produkte.“**; Lead-Headline „Dein Haarprofil ist fertig.“; Bereit-Screen „{Name}, bereit für deinen ersten Scan?“ / „Ja, zeig mir meinen Scanner“; Ladeseite „Wir richten deinen Scanner ein.“ mit Stufen „Haarprofil wird ausgewertet“ · „Passende Kriterien für Shampoo, Spülung, Kur & Co.“ · „Dein Plan wird vorbereitet“. Tests: Copy-Map-Auflösung, Default unverändert.

### Task 6: Landing `scan-regal`.

`src/funnels/landing/scan-regal.tsx`: Pill „Drogerie-Regal“, H1 „200 Shampoos im Regal. Eins passt zu dir.“, Lede „Chaarlie zeigt dir per Scan, welches. Dafür braucht es dein Haarprofil – 10 Fragen, 2 Minuten.“, Foto `frau-regal-aha` mit Ergebnis-Karte, Zitat-Kachel (Umfrage), „So funktioniert’s“ (Haarprofil · Scannen · Ergebnis), „Im Chaarlie-Abo“-Stack, CTA „Haarprofil erstellen“ → `/quiz`, Fußnote „10 Fragen · 2 Minuten · danach ist dein Scanner startklar“. Kein Tracking-Mount in der Variante (Vertrag). Bilder nach `public/images/funnels/scan/` (`frau-regal-aha.webp`, `regal-hand-phone.webp`, `regal-scan-flasche.webp`, `bad-ablage.webp`). Mobile + Desktop.

### Task 7: Angebot `scan-regal-v1`.

`src/funnels/offers/scan-regal-v1.tsx`, Reihenfolge B: Hero (Eyebrow „Dein Haarprofil ist fertig“, H1 „Nie wieder raten vorm Regal.“, Profilzeile, `ScanHeroDemo` = Kamera-Frame → „✓ Barcode erkannt“ → Mini-Ergebnis, Loop 7,5 s, reduced-motion = Endzustand) → Vorher/Nachher → „Darauf achtet der Scanner bei dir“ (Kriterien-Chips aus den 10 Antworten) → Produkt-Tour (echte Screenshots: Scanner, Plan, Anwendung, Chat — **vom Standard-Testaccount mit vollständigem Profil aufnehmen**, keine Dev-Login-Platzhalter) → Pricing (`pricingSlot` genau einmal, H2 „Scanner und Plan freischalten.“) → Abdeckung → Highlights → Methode (4 Kacheln inkl. „Über 1.000 Produkte“) → Umfrage → Stimmen → Garantie → FAQ (5, scanner-bezogen) → Final-CTA. Sticky Header „Angebot ansehen“. Alle `data-offer-section`-Attribute für das bestehende Section-Tracking.

### Task 8: Nach dem Kauf → Bereitstellung → Scanner.

**T0-Ergebnis (2026-09-12):** Der Bedarfs-Snapshot entsteht heute erst beim Rendern von `/plan-start` (`plan-start/page.tsx` → Stage1 `loadOrCreate`); der Auto-Poll auf `/plan-bereit` (`readiness.ts` `linkExactPlanBereitSourceToProfile`) verknüpft nur `hair_profiles` + `leads.user_id`. Deshalb für `scan_v1`: Stage1 `loadOrCreate` im Legacy-Zweig von `linkExactPlanBereitSourceToProfile` ausführen (Snapshot entsteht während des bestehenden Polls), dann Ready-CTA/Redirect nach `/scan` mit Scanner-Copy. Produktions-Voraussetzung: `PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED=true` **und** gültiger `PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF` — vor Aktivierung prüfen (T11). **Fund aus Task 10 (2026-09-12):** Das Intake-Gate (`src/lib/supabase/middleware.ts` `hasActivePersonalPlanRoutineEntitlement`, `src/lib/auth/intake-state.ts`) ließ nur Einmalkauf-, Feldtest-/Partner- und Moderator-Zugänge an `/scan` vorbei; ein **Abo-Käufer** ohne altes Onboarding wurde nach `/onboarding` umgeleitet. Ruling: `/scan` umgeht das Legacy-Onboarding für jeden aktiven bezahlten Zugang (Abo oder Einmalkauf); `/routine`, `/anwendung`, `/chat` unverändert; die Profil-Voraussetzung bleibt das Gate der Scan-Seite selbst. Der Journey-Test beweist den Pfad ohne `onboarding_completed`-Seed. **Präzisierung nach Task-8-Review (2026-09-12):** Die Aktivierung verknüpft das Profil bereits, daher erreicht ein Käufer den Link-POST oft gar nicht — „bereit“ für `scan_v1` bedeutet deshalb „Bedarfs-Snapshot existiert“, und ein idempotenter Helper provisioniert auf jedem Pfad, der „bereit“ liefern kann (Link-POST, Status-GET, Server-Seite); Fehler → bestehender `transient_error` mit provisionierendem Retry. Das `funnelPackageKey`-Threading im Checkout-Resolver entfällt (wirkungslos, kostet einen DB-Read pro Aktivierung); die Paket-Auflösung lebt nur auf der Plan-bereit-Seite. — Ursprünglicher Plantext (überholt): `getCheckoutFirstTimeDestination` bekommt `funnelPackageKey` (aus `resolveFunnelContextForLead`, nie aus dem Client); Ziel-Union + `isCheckoutFirstTimeDestination` um das neue Ziel erweitern; für `scan_v1` bleibt der Weg `/plan-bereit?lead=…` (Bereitstellung), und die Bereitstellungsseite leitet für dieses Paket nach `/scan?welcome=scan` statt `/plan-start`; Reaktivierung (`membership_reactivation`) behält Vorrang; Passwort- und Magic-Link-Aktivierung nutzen denselben Resolver. `/scan` zeigt einmalig „Dein Scanner ist startklar. Dein Plan wartet daneben.“ (dismissable, Session). Tests: Resolver-Matrix (alle bestehenden Ziele unverändert, neue Zeile für `scan_v1`), Validator, beide Aktivierungsrouten, Bestandskunden-Kauf, Reaktivierungs-Vorrang.

### Task 9: Analytics.

`quiz_insert_viewed { insert_id, funnel_package_key }` in `AppEventMap`, expliziter Eintrag in `eventRoutes` (`src/lib/analytics/routes.ts`, nur PostHog) und im PostHog-Mapper (snake_case wie `funnel_package_key`); Einfügungen feuern zusätzlich **kein** `quiz_step_viewed` (das geht auch an Customer.io) — Entscheidung im Plan festgehalten. Notiz in `docs/` für den Package-Vergleich (`landing_viewed`, `quiz_started`, `quiz_completed`, `offer_viewed`, `purchase_completed` je `funnel_package_key`).

### Task 10: Tests + Verifikation.

Unit: T2–T5, T8, T9. Playwright: `tests/scan-funnel-journey.spec.ts` (`/lp/scan` mit Flag → Quiz mit drei Einfügungen → Lead → Angebot `scan-regal-v1` → Test-Mode-Kauf Karte **und** PayPal → Bereitstellung → `/scan` → echtes Scan-Ergebnis via `/api/scan/resolve`, Fixture = Neukunde ohne Bedarfs-Snapshot). Test in die CI-Browser-Kommandos (`package.json` `test:e2e*`) **und** die Mobile-WebKit-Allowlist (`playwright.config.ts:37`) eintragen. Bestehende Legacy-Suiten unverändert grün. `npm run funnel:check`, `npm run test:node`, `npm run ci:verify`, `npm run test:chat` (Regression). Manuell auf dem Worktree-Dev-Server (`dev:worktree`) komplett durchklicken, mobil 375 px, inkl. Back-Navigation und Reload auf jeder Einfügung.

### Task 11: Doku + Aktivierung.

`docs/funnel-briefs/scan-regal.md` (Paket, Hypothese, KPI, Bilder-Herkunft, Prompts-Verweis); **Harte Gates vor Aktivierung (aus Task-7-Review):** (1) Produkt-Tour-Bilder `public/images/funnels/scan/tour-{scanner,plan,anwendung,chat}.png` durch Aufnahmen vom Standard-Testaccount mit vollständigem Profil ersetzen (aktuell Prototyp-/Dev-Seed-Captures mit Platzhaltern wie „Local Dev Conditioner“); (2) Fine-Print des Pricing-Slots im echten `/result`-Kontext prüfen (Labs zeigt „Einmalzahlung · Kein Abo“, FAQ sagt „im Abo enthalten“) und ggf. Slot-CTA-Copy „Plan sichern“ für dieses Paket entscheiden (Owner-Komponente). Route-Gate in `/lp/[slug]` statusbewusst machen (`active` ⇒ kein Flag nötig, wie die Attribution); Produktions-Env prüfen: `PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED=true`, gültiger `PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF`, `SCAN_FUNNEL_ENABLED` (falls Gate nicht statusbewusst); Paketstatus `placeholder → active` als eigener Commit nach Nicks GO; Meta-Kampagnen-URL `/lp/scan`.

**Reihenfolge:** T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11. T4/T5/T6/T7 sind nach T3 parallelisierbar (disjunkte Dateien).

## Designed User Journey (Sign-off-Grundlage)

**Einstieg:** Meta-Anzeige oder Link → `/lp/scan` (Cookie `scan_v1` gesetzt). Landing B: Headline, Foto mit Ergebnis-Karte (Slide-up nach 0,8 s), Zitat, drei Schritte, Abo-Stack, CTA „Haarprofil erstellen“.

**Quiz (10 Fragen, unverändert) mit drei Einfügungen:**
1. Frage 1–3 (Struktur, Dicke, Dichte) mit Info-Strip auf Frage 1.
2. Einfügung 1 „Das Problem“: Foto Frau mit Flasche, 63 %-Zahl, Karte „Beispiel“ mit Haardicke-Zeile aus der Dicke-Antwort. „Weiter“.
3. Frage 4–7 (Länge, Oberfläche, Zugtest, Chemisch), Frage 8 Kopfhaut (Typ, Beschwerden).
4. Einfügung 2 „Die Lösung“: Foto Regal-Scan, Karte spiegelt Alverde Balance mit Kopfhaut-Zeile aus der Kopfhaut-Antwort. „Weiter“.
5. Frage 9 (Was beschäftigt dich), Frage 10 (Ziele).
6. Einfügung 3 „Und zu Hause“: Foto Bad, Karte Balea Repair Kur „Passt zu deinem Haar“. „Weiter“.

**Ergebnis:** Lead-Erfassung (Vorname → E-Mail → Tipps-Einwilligung) unter „Dein Haarprofil ist fertig.“ → Bereit-Screen „{Name}, bereit für deinen ersten Scan?“ → Ladeseite „Wir richten deinen Scanner ein.“ → `/result/[leadId]` mit `scan-regal-v1`.

**Angebot:** Hero mit Scan-Demo → Vorher/Nachher → Kriterien → Produkt-Tour → Preise (Jahr empfohlen) → Abdeckung → Highlights → Methode → Umfrage → Stimmen → Garantie → FAQ → Final-CTA. Zahlung wie heute (Karte/PayPal).

**Nach dem Kauf:** `/welcome` → Bereitstellung (heutige „Plan bereit“-Seite, für dieses Paket mit Scanner-Copy „Wir richten deinen Scanner ein“) → `/scan` mit einmaligem Hinweis „Dein Scanner ist startklar. Dein Plan wartet daneben.“ Erster Scan liefert ein echtes Ergebnis, Plan über die Navigation erreichbar.

**Varianten:** Kopfhaut-Antwort „Schuppen“ → Karte in Einfügung 2 grün („Passt“) mit passender Zeile; dicke Haare → Einfügung 1 zeigt Haardicke grün. Zurück-Navigation über Einfügungen funktioniert wie zwischen Fragen (Browser-Back inklusive).
**Fehler/Recovery:** Ohne Funnel-Cookie (Direktaufruf `/quiz`) läuft das Default-Quiz ohne Einfügungen; reduzierte Bewegung → Karten ohne Animation; Zahlung fehlgeschlagen → bestehender Payment-Support-Pfad; `/scan` ohne Profil (T0-Ergebnis) → bestehende Gate-Seite, nie eine leere Kamera.
**Abschluss:** Erster Scan mit Ergebnis-Sheet; Plan in der Navigation.

## Risiken

- Erste Render-Reihenfolge im Quiz hängt am serverseitig gelesenen Cookie (T2); ohne Cookie fällt der Nutzer ins Default-Quiz — akzeptiert, aber im Journey-Test abgesichert.
- Profil-Verfügbarkeit nach Legacy-Kauf (T0) kann Ruling 10 verschieben.
- Beispiel-Karte muss zum Foto passen (Ruling 8): Produkte/Zeilen in `scan-insert-examples.ts` sind hart an die vier Fotos gebunden; neue Fotos ⇒ Tabelle mitziehen.
- Screenshot-Beschaffung für die Produkt-Tour braucht den Standard-Testaccount mit vollständigem Profil (Regel aus dem Freemium-Prototyp).

## Verifikation vor Review

`npm run ci:verify` · `npm run test:node` · `npm run funnel:check` · Playwright-Journey `scan-funnel-journey` · bestehende Legacy-Suiten · manueller Durchlauf 375 px inkl. Back-Navigation über Einfügungen · Codex Whole-Branch-Review (read-only) vor dem Push.
