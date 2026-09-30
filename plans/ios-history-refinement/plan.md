# iOS Scan & Verlauf – Refinement-Plan

Status: **implementierungsbereit**. Stand: 2026-09-19. Basis ist der auf `main` veröffentlichte Stand `81e32e8b` (PR #586). Diese Planung autorisiert keine Migration, kein Deployment und keinen App-Release.

## Outcome und gewählte Richtung

Der bestehende iPhone-Flow wird in drei zusammenhängenden Punkten verfeinert:

1. Die Bestätigung nach einer Research-Einreichung wird zu einem kompakten, inhaltsgetriebenen Sheet ohne große Leerfläche.
2. Ein unbekannter iPhone-Barcode nutzt denselben serverseitigen dm-Enrichment-Vertrag wie der produktive Web-Scanner: exakter GTIN-Treffer, fail-open Timeout, Identitätsvorschau, Ein-Tap-Bestätigung der vorgeschlagenen Kategorie und erneute serverseitige Anreicherung beim Submit.
3. `mobile_scan_history` erhält `is_favorite`; Verlaufseinträge können über ein Herz favorisiert und über `Alle` / `Favoriten` gefiltert werden. „Verlauf leeren“ entfernt nur nicht favorisierte Einträge.

Die [gerenderte Refinement-Evidenz](evidence/refinement-review.html) konkretisiert die drei bestätigten Zustände. Sie übernimmt die bestehende Chaarlie-Typografie, Farben und Kartenfamilie; sie ist Layoutautorität für Hierarchie und Dichte, nicht pixelgenaues natives Rendering.

## Scope und Non-Goals

Enthalten sind additive mobile API-Verträge, Wiederverwendung des vorhandenen dm-Resolvers, Persistenz des bestehenden `retailer_enrichment`-Nachweises, eine additive History-Migration, SwiftUI-Verlauf/Favoriten sowie die Research-Sheet-Zustände und ihre Tests.

Nicht enthalten sind eine allgemeine Merkliste, Web-Favoriten-UI, Ordner/Notizen, Sortierung nach Favorisierungszeit, neue Retailer-Quellen, automatische Katalogfreigabe, Änderung der Product-Intake-Grenzen, Änderung des dm-Flags/Timeouts, Rückfüllung alter History-Einträge, neue Produktkategorien, Änderung der eigentlichen Assessment-Darstellung oder Produktionsaktivierung. `scan_wishlist` bleibt unverändert und semantisch getrennt. Ein dm-Treffer bleibt Research-Evidenz und wird weder Katalogwahrheit noch finales Produktbild.

## Entscheidungslage

Decision coverage: **confirmed**.

- **Confirmed with Nick:** Das bestätigte Research-Sheet wird kompakt und optisch zentriert; dm soll im iPhone-Flow exakt den bereits produktiven Web-Vertrag wiederverwenden; ein exakter Treffer zeigt Produktidentität und bestätigt die vorgeschlagene Kategorie wie im Web mit einem Tap, mit „Andere Produktart“ als Weg zum bestehenden Grid. Favorit ist ein Boolean des kontogebundenen History-Eintrags, nicht eine neue Merkliste. Favoriten bleiben beim Leeren des übrigen Verlaufs erhalten. Nick bestätigte diese Richtung am 2026-09-19 mit „Yeah I think that should be good for now. I agree with that. Sounds good.“
- **Inherited from evidence or contract:** Der Server bleibt Autorität; Swift spricht dm nie direkt an. `resolveRetailerEnrichment` verlangt exakte kanonisierte GTIN-Gleichheit, ist per `SCAN_RETAILER_ENRICHMENT_ENABLED` kontrolliert und bei Miss/Timeout/Fehler fail-open. Beim Submit wird die Anreicherung erneut serverseitig geladen und nur als `retailer_enrichment` in `product_submissions.intake_history` gespeichert. Product Intake prüft Identität, Kategorie und Bild unabhängig; Publikation bleibt explizit freigabepflichtig. `/api/mobile/v1` bleibt abwärtskompatibel für installierte Clients. Die bereits produktiv angewandte History-Migration wird nicht editiert.
- **Implementation defaults:** Die mobile `submission_required`-Antwort erhält ein optionales, rückwärtskompatibles `identified`-Objekt mit `productName`, `brand`, `imageUrl` und `suggestedCategory`; DAN, Retailer-URL, INCI und Beschreibung werden nicht an iOS ausgeliefert. `imageUrl` ist `null` oder eine absolute URL auf dem aktuellen Chaarlie-Origin mit Pfad `/_next/image`, dem bereits validierten dm-Quellbild als `url` sowie festem `w=256&q=75`; das Zod-Feld ist `z.string().url().nullable()`. Damit benutzt Native dieselbe bestehende Next-Allowlist/Optimierung wie Web und kontaktiert `products.dm-static.com` niemals direkt; es entsteht kein neuer offener Proxy-Endpunkt. Favorite-Schreibvorgänge laufen owner-geprüft über die mobile Serverroute/service-role-Grenze, nicht über offene Client-Updates. `is_favorite` ist `NOT NULL DEFAULT false`; ein partieller Index unterstützt den Favoritenfilter. Favorisieren verändert `last_seen_at` nicht. Alle History-Mergepfade erhalten den logischen OR-Wert vorhandener Favoriten. Die iOS-Herz-Aktion ist optimistisch mit Rollback/Fehlerhinweis, eigener 44-pt-Touchfläche und statischem Filled/Outline-Zustand.
- **Open consequential assumptions:** none.
- **Undiscussed consequential assumptions affecting this handoff:** none.

Coverage acknowledgement: Nicks Screenshot `IMG_7458.PNG` und sein Auftrag, das unausgewogene Sheet zu restylen, die produktive dm-Suche auch mobil zu nutzen und Favoriten im Verlauf anzubieten; anschließend seine explizite Zustimmung zu kompakter Bestätigung, exakter dm-Wiederverwendung und Boolean-in-History mit geschützten Favoriten.

Internal revalidation: Gegen `origin/main`/`main` `81e32e8b`, `ScanResultPresentation.swift`, `ChaarlieApp.swift`, `HistoryView.swift`, `HistoryContract.swift`, `history-service.ts`, `scan-service.ts`, `scan-submit-service.ts`, die produktive Web-Resolve-/Submit-Route, `resolveRetailerEnrichment` und Migration `20260919130450_mobile_scan_history.sql` geprüft. Der Screenshot-Barcode `8700216328609` wurde über denselben Resolver als exakter dm-Treffer für „Shampoo Derma x Pro Hydra Pflege, 250 ml“ von head&shoulders mit Vorschlag `shampoo` verifiziert.

## Designed user journey

### A. Unbekannter Barcode mit exaktem dm-Treffer

1. Eine angemeldete Nutzerin scannt einen gültigen Barcode, der im Chaarlie-Katalog fehlt.
2. Der mobile Resolver ruft nach dem Katalog-Miss denselben serverseitigen dm-Resolver wie der Web-Flow auf. iOS bleibt währenddessen im vorhandenen Ladezustand; der 1,5-Sekunden-Vertrag bleibt unverändert.
3. Bei exaktem Treffer zeigt das Sheet ein first-party-proxied Thumbnail, Produktname und Marke. Für einen gültigen Kategorie-Vorschlag lautet die Frage beispielsweise „Ist das ein Shampoo?“
4. `Als Shampoo einreichen` sendet die Kategorie mit einem Tap. `Andere Produktart` öffnet das bestehende unterstützte Kategorie-Grid. Keine Auswahl wird ohne Tap eingereicht.
5. Der Submit-Endpunkt wiederholt den dm-Lookup. Ein Treffer wird als provenance-tagged `retailer_enrichment` an den bestehenden Intake-Submit übergeben. Miss/Timeout/Fehler blockieren die user-bestätigte Einreichung nicht.
6. Nach erfolgreichem Submit wechselt dasselbe Sheet in die kompakte Bestätigung: `In Prüfung`, `Wir melden uns, sobald das Ergebnis da ist.`, `Verlauf öffnen`.

Ein bereits offener Research-Auftrag bleibt vorrangig: Während `checkResearchStatus()` lädt, ist kein dm-Ein-Tap-CTA aktiv; bei `researchPending` erscheint direkt die Bestätigung. Die dm-Vorschau darf keinen zweiten Submit anbieten, nur weil Resolve vorher `submission_required` geliefert hat.

### B. dm-Miss, Timeout oder ungültiger Vorschlag

Der aktuelle manuelle Unknown-Flow bleibt erhalten: kein Retailer-Fehlertext, keine falsche Identitätsbehauptung, Kategorie-Grid und bestehendes Retry-Verhalten. Ein nicht unterstützter/fehlender Kategorienvorschlag führt ebenfalls zum Grid. Telemetrie bleibt frei von Barcode-/Kontodaten.

### C. Favoriten im Verlauf

1. Im Verlauf hat jede Zeile eine separate Herz-Aktion; die restliche Zeile öffnet weiterhin das Produkt bzw. den Barcode-Flow.
2. Das Herz funktioniert auch für `Noch nicht im Katalog` und `In Prüfung`, weil der History-Eintrag die stabile account-owned Identität ist. Outline bedeutet nicht favorisiert, Filled bedeutet favorisiert.
3. `Alle` zeigt die normale Chronologie; `Favoriten` lädt serverseitig nur favorisierte Einträge mit derselben Cursor-Reihenfolge. Der leere Filter zeigt `Noch keine Favoriten` statt des globalen History-Empty-State.
4. Bei Netzwerkfehler wird der optimistische Toggle zurückgerollt und ein knapper Retry-Hinweis gezeigt; das Öffnen der Zeile bleibt nutzbar.
5. `Verlauf leeren` bestätigt: `Nicht favorisierte Einträge werden entfernt. Favoriten und eingereichte Produkte bleiben erhalten.` Der Server löscht nur nicht favorisierte History-Zeilen; Research-Aufträge bleiben wie bisher unabhängig erhalten.

## Zieloberflächen

- iOS Sheet/State: `ios/Chaarlie/App/ChaarlieApp.swift`, `ios/Chaarlie/Assessment/ScanResultPresentation.swift`, `ios/Chaarlie/App/AppModel.swift`, `ios/Chaarlie/QA/DesignReviewFixture.swift`.
- iOS Verträge/Client: `ios/Chaarlie/Networking/ScanContract.swift`, `HistoryContract.swift`, `MobileClient.swift`.
- iOS Verlauf: `ios/Chaarlie/History/HistoryView.swift` und bestehende Shared Components/Theme.
- Mobile Resolve/Submit: `src/lib/mobile/scan-contracts.ts`, `scan-service.ts`, `scan-submit-service.ts`, `src/lib/mobile/retailer-image.ts` (kleiner URL-Builder), `src/app/api/mobile/v1/scan/{resolve,submit}/route.ts`.
- dm-Autorität: unverändert `src/lib/scan/enrichment/resolve-enrichment.ts`, `flag.ts`, `types.ts`; Web-Verhalten in `src/app/api/scan/{resolve,submit}/route.ts` dient als Paritätsoracle.
- History Backend: neue additive Migration unter `supabase/migrations/`, `src/lib/mobile/history-service.ts`, GET/DELETE in `src/app/api/mobile/v1/scan/history/route.ts` und PATCH in `src/app/api/mobile/v1/scan/history/[entryId]/route.ts`.
- Tests: bestehende Mobile-/History-/Migration-/Postgres-Tests, dm-Enrichment-Tests sowie native Unit-/UI-Tests und Design-Review-Fixtures.

## Geordnete Umsetzung

### 1. Mobile dm-Parität als additive API-Erweiterung

`resolveMobileScan` erhält eine injizierbare Abhängigkeit auf den bestehenden `resolveRetailerEnrichment`. Die heutige `findProduct`-Grenze wird zuerst diskriminiert in `hit`, echter Identifier-`miss`, `quarantined` und nicht nutzbarer Katalogtreffer; dm läuft ausschließlich beim echten Miss, wie in der Web-Route, niemals bei Produkt-ID-Suchen, Quarantäne oder inaktivem Katalogtreffer. `submission_required` trägt optional die sichere `identified`-Vorschau. Ein kleiner Builder erzeugt aus `request.url` und einem bereits durch `validateDmImageUrl` akzeptierten Quellbild die absolute `/_next/image?url=…&w=256&q=75`-URL; die Route liefert nur diese URL oder `null`. Der Submit-Service führt nach Open-Submission-/Katalog-Race-Prüfung denselben Lookup mit `route: "submit"` erneut aus und übergibt `enrichment` an `submitScanProductIntake`. Abhängigkeiten erlauben deterministische Hit/Miss/Timeout/Mismatch-Tests.

**Consumes:** gültiger EAN/GTIN, bestehender Resolver/Flag/Timeout, bestehende mobile `submission_required`-Antwort.
**Produces:** optionales `identified` mit identischer Web-Semantik; unveränderte Fallback-Antwort; provenance-tagged Submit.
**Fertig wenn:** Altantworten ohne `identified` weiter decodieren; exakter Treffer, Mismatch, Miss, Timeout, deaktiviertes Flag, ungültiger Kategorie-Vorschlag und Submit-Race sind getestet; der Resolver wird nicht für Produkt-ID-Suchen, Quarantäne oder Katalogtreffer aufgerufen; Proxy-Tests belegen aktuellen Origin, festen Width/Quality-Vertrag, URL-Encoding und `null` bei fehlendem/abgelehntem dm-Bild.

### 2. Favorite-Persistenz und klare Löschsemantik

Über `supabase migration new mobile_scan_history_favorites` entsteht eine additive Migration: `is_favorite boolean NOT NULL DEFAULT false`, partieller owner/recent-Index für Favoriten, owner-geprüfte `mobile_scan_history_set_favorite`-Funktion sowie `CREATE OR REPLACE` der vorhandenen Touch-/Clear-Funktionen. `mobile_scan_history_clear` behält dabei exakt seine bestehende Signatur `RETURNS void`; nur das DELETE-Prädikat wird `is_favorite=false`, sodass weder Drop/Recreate noch ein verlorenes `GRANT EXECUTE` nötig ist. Die Deduplikation übernimmt `existing.is_favorite OR merged.is_favorite` explizit sowohl vor dem Delete der provisorischen Produktzeile (heute Zeilen 61–63) als auch vor dem Multirow-Delete im product-only-Zweig (heute Zeilen 71–73). Tabellen-/Funktionsrechte bleiben service-only für Writes und owner-only für Reads. Die vorhandene Produktionsmigration wird nicht verändert.

`history-service.ts` liest und schreibt `isFavorite` und unterstützt `favoritesOnly` mit serverseitiger Pagination. `GET /api/mobile/v1/scan/history?favorites=1` liefert ausschließlich Favoriten; `PATCH /api/mobile/v1/scan/history/{entryId}` akzeptiert exakt `{ "isFavorite": boolean }` und antwortet mit `{ contractVersion: 1, entryId, isFavorite }`; `DELETE` behält `{ contractVersion: 1, cleared: true }`. Fremde oder verschwundene History-IDs werden nicht als Erfolg maskiert. Favorite- und Clear-Mutationen verwenden denselben owner-basierten Advisory Lock wie Touch/Merge, damit ein konkurrierender Toggle nicht unbemerkt gelöscht wird.

**Consumes:** `mobile_scan_history.id`, owner-ID aus Bearer-Auth, bestehender advisory-lock-/merge-Vertrag.
**Produces:** stabiler Favorite-Zustand pro History-Zeile, inklusive Unknown/Pending; Clear schützt Favoriten.
**Fertig wenn:** Migration-/RLS-Vertragstests und disposable-PostgreSQL-Tests beweisen owner isolation, idempotente Toggles, paralleles Touch/Toggle/Clear, OR-Erhalt in allen Mergepfaden, Filterpagination und Account-Delete-Cascade.

### 3. Native History-Interaktion

`HistoryEntry` erhält `isFavorite`, beim Decoding alter/Fixture-Antworten über `decodeIfPresent(... ) ?? false`; `MobileClient`/`AppModel` laden den ausgewählten Filter und toggeln optimistisch mit per-row Busy-Zustand, Rollback und knapper Fehlermeldung. `HistoryView` bekommt den kompakten `Alle`/`Favoriten`-Picker. Die heutige ganze Zeile wird so aufgeteilt, dass Produktöffnen und Herz zwei gültige, nicht verschachtelte Buttons mit je mindestens 44 pt sind. Filled/Outline, Farbe und Accessibility-Label bilden den Zustand statisch ab; häufiges Toggling erhält höchstens die bestehende kurze State-Transition und respektiert Reduce Motion. Die Löschbestätigung nennt den Favorite-Erhalt.

**Consumes:** `isFavorite`, Favorite-Mutation, `favoritesOnly`-History-Antwort.
**Produces:** zugängliches Herz und sinnvoll nutzbarer Favoritenfilter ohne neue Merkliste.
**Fertig wenn:** Unit-Tests decken Decode alter/neuer Antworten, Filterwechsel, optimistischen Erfolg/Fehler und Clear ab; UI-Tests decken unabhängiges Öffnen/Toggling, Unknown/Pending, leere Favoriten, Dynamic Type und VoiceOver-Namen ab.

### 4. dm-Vorschau und kompaktes Research-Sheet

Die Swift-Scanverträge decodieren `identified` optional. `ResearchSheet` trennt drei Darstellungen: dm-Bestätigung, manuelles Grid und kompakte Success-State-View. Die dm-Darstellung folgt der produktiven Web-Hierarchie: Vorschau, `Produkt erkannt`, konkrete Kategoriefrage, primärer Ein-Tap-CTA, sekundär `Andere Produktart`. `.presentationSizing(.fitted)` bleibt die native Basis, reicht nach dem Zustandswechsel auf dem getesteten iPhone-Simulator jedoch nicht allein aus: dm-Vorschau und Erfolgsansicht verwenden deshalb eine gemessene Height-Detent einschließlich eines möglichen Save-Retry-Hinweises, während das manuelle Kategorie-Grid groß bleibt. Ein `ViewThatFits`/Scroll-Fallback hält kompakte Zustände bei größter Dynamic Type erreichbar, ohne bei normaler Schrift künstliche Leerhöhe. Bestehende Busy/Error/Haptik- und Reduce-Motion-Verträge bleiben erhalten.

**Consumes:** optionales `identified`, bestehende Kategorie-/Submit-States und Chaarlie-Theme.
**Produces:** die drei in der Evidenz gezeigten Zustände ohne parallele Flow-Logik.
**Fertig wenn:** Fixtures und UI-Tests zeigen Treffer, Andere-Produktart, Miss-Fallback, Submit-Fehler, kompakte Bestätigung, größte Schrift, Reduce Motion und VoiceOver; auf einem realen Kamerabild ist der Sheet-Abschluss optisch geprüft.

### 5. Integrierte Verifikation und Review

Fokussierte Node-Tests umfassen `scan-dm-enrichment`, mobile Resolve/Submit, History-Service, Route-Admission, Migration und echte PostgreSQL-Interleavings. Danach laufen Typecheck, Lint/Prettier, `git diff --check`, relevante Xcode Unit-/UI-Tests und schließlich die vollständigen Repository-/iOS-Gates nach `ready-check`. Manueller iPhone-Smoke: Screenshot-Barcode `8700216328609`, dm-Vorschau, andere Kategorie, erfolgreicher Submit, kompakte Bestätigung, Favorite-Toggle, Filter, Clear mit Favorite-Erhalt, Flugmodus/Retry, größte Schrift, Reduce Motion und VoiceOver; Haptik nur auf Gerät bewerten.

Vor Push folgt `request-code-review` einschließlich read-only Claude-Whole-Branch-Review. Migration/Deployment/Flag-/Provider-/App-Release bleiben eigene `ship-it`-/Produktionsentscheidungen. Keine Änderung aktiviert dm neu oder erweitert die ungeklärten kommerziellen Nutzungsrechte.

## Counterpart-Review-Ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | Claude: nativer Bildproxy war unbestimmt; `imageUrl` verlangt absolute URL | accepted | Bestehendes `/_next/image` mit absoluter Origin-URL, validiertem dm-Input und festem `w/q` spezifiziert | Gegen `next.config.ts`, `validateDmImageUrl` und Mobile-Zod-Verträge geprüft |
| C2 | defect | Claude: `CREATE OR REPLACE` darf `RETURNS void` nicht in Count ändern | accepted | Clear behält `RETURNS void` und unveränderte API-Antwort | Gegen angewandte Migration und Grants geprüft |
| C3 | defect | Claude: Mobile `findProduct` faltet Miss und Quarantäne zusammen | accepted | Discriminated Lookup; dm nur bei echtem Identifier-Miss | Gegen Web-Oracle Zeilen 368–407 und Mobile-Seam geprüft |
| C4 | defect | Claude: zwei History-DELETE-Mergepfade müssen Favorite-OR sichern | accepted | Beide heutigen Delete-Stellen als Test-/Migrationsanker benannt | Gegen Migration Zeilen 61–73 geprüft |
| C5 | defect | Claude: offener Research-Status muss dm-CTA vor zweitem Submit sperren | accepted | Pending-Gate in Journey und UI-Aufgabe explizit gemacht | Gegen `checkResearchStatus()`/`researchPending` geprüft |
| C6 | defect | Claude: alte History-Antwort ohne Boolean muss decodierbar bleiben | accepted | Swift `decodeIfPresent ?? false` festgelegt | Gegen additive Mobile-Vertragsregel geprüft |
| C7 | runtime correction | Claude vermutete, content-fitted brauche zwingend Custom-Detent; der erste Simulatorlauf zeigte trotz `.presentationSizing(.fitted)` 279 pt Leerraum unter dem Success-CTA | accepted after runtime evidence | `.presentationSizing(.fitted)` bleibt Basis; kompakte dm-/Success-Zustände erhalten eine gemessene Height-Detent inklusive Save-Retry-Hinweis, das manuelle Grid bleibt groß | Normale und größte Dynamic Type, Save-Retry sowie Grid-Wechsel per Geometrie-/UI-Test und Screenshot geprüft |

Der Reviewer konnte Produktionsmigration und Live-dm-Probe ohne seine eigenen Credentials nicht bestätigen; diese Aussagen stammen aus der vorherigen read-only Liveprüfung dieses Tasks und werden vor jeder Produktionsaktion erneut geprüft. Keine Review-Feststellung öffnet eine neue Produktentscheidung. Decision coverage bleibt **confirmed**.

## Planungsevidenz und Handoff

- **Evidenz:** [Refinement-Review](evidence/refinement-review.html), abgeleitet aus Nicks realem iPhone-Screenshot und der bestätigten Journey. Frage: Wie werden Success-Dichte, dm-Ein-Tap-Parität und Favorites sichtbar, ohne neue Designfamilie? Ergebnis: die drei dargestellten Zustände. Evidence review status: **approved direction** durch Nicks Zustimmung; natives Rendering bleibt Implementierungsprüfung.
- **User-journey sign-off:** confirmed; die Zustimmung deckt kompakte Bestätigung, produktive dm-Parität und History-Boolean/Favorite-Erhalt ab.
- **Artifact disposition:** Plan und HTML-Evidenz `commit`; Claude-Review und temporäre Simulatorbilder `discard`, sofern kein neuer dauerhafter Befund entsteht.
- **Residual risks:** dm-Verfügbarkeit/Terms ändern sich unabhängig von iOS; die absolute `/_next/image`-URL muss auf realem Gerät bestätigt werden; die gemessene Sheet-Höhe ist auf dem aktuellen Simulator einschließlich Accessibility-Schrift geprüft, braucht aber noch den vorgesehenen iOS-18-/Realgerät-Smoke mit Kamerabild, VoiceOver und System-Reduce-Motion.
- **Implementation status:** umgesetzt; Backend-Favoriten einschließlich echter PostgreSQL-Interleavings, mobile dm-Parität und die nativen Normal-/Accessibility-Zustände sind grün. Veröffentlichung, Produktionsmigration und App-Release bleiben separat.
