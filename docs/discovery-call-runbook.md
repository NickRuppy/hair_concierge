# Discovery-Calls betreiben

Operator-Runbook für das Discovery-Call-Toolkit: 50–100 persönliche Beratungsgespräche, jedes mit
einer eingeladenen Teilnehmerin, ihrem Quiz, ihrer Produkt-Checkliste, dem Cockpit im Gespräch und
einem gedruckten Routine-Dokument danach.

Der Ablauf hat sechs Phasen: **Einladung → Intake überwachen → T-1-Vorbereitung → Call →
Nachbereitung/PDF → Teardown**. Jede Phase unten nennt die Befehle, die URLs und den Zustand, den du
danach sehen musst.

Entwurf und Entscheidungen: `docs/superpowers/specs/2026-09-22-discovery-call-toolkit-design.md`
und `plans/discovery-call-toolkit/plan.md`. Lokales QA: `docs/local-qa-access.md`.

## Voraussetzungen

1. **Migration ausgerollt.** `supabase/migrations/20260922120000_discovery_call_toolkit.sql` legt
   `discovery_enrollments`, `discovery_intakes`, `discovery_intake_items` und
   `discovery_call_decisions` an — alle vier service-only (RLS an, keine Rechte für `anon` und
   `authenticated`). Die Migration muss vor dem Anwendungscode laufen; wegen der abweichenden
   lokalen und entfernten Migrationshistorie nicht per pauschalem `supabase db push`, sondern als
   gezielter, geprüfter Schritt.
2. **Umgebungsvariablen gesetzt** (siehe [Konfiguration](#konfiguration)):
   `DISCOVERY_CALL_TOOLKIT_ENABLED=true` und `DISCOVERY_ENROLLMENT_SIGNING_SECRET`.
3. **Der Kill-Switch ist der Schalter für alles.** Ohne `DISCOVERY_CALL_TOOLKIT_ENABLED=true`
   antworten alle Seiten — Einladung, Checkliste, Cockpit — mit `404`; nur die beiden Claim-APIs
   (`resolve`, `claim`) antworten mit `410`. Der Nav-Eintrag „Beratungen" im Admin bleibt trotzdem
   sichtbar — die Seite dahinter ist dann nur nicht da.

## 1. Einladung

Einladungen entstehen ausschließlich über die CLI. Es gibt keine Admin-Oberfläche zum Anlegen.

```sh
npm run discovery -- list
npm run discovery -- create --name="Lea Sommer" --email="lea@example.com"
```

Jede Schreibform (`create`, `revoke`, `rotate`, `reconcile`) ist ohne `--apply` **Dry-run** und
schreibt nichts. Eine echte Produktionsmutation braucht alle vier Bedingungen gleichzeitig:

```sh
ALLOW_DISCOVERY_PRODUCTION_WRITE=1 npm run discovery -- create \
  --name="Lea Sommer" --email="lea@example.com" \
  --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

- Die Optionen brauchen die `=`-Form (`--name="…"`), nicht `--name "…"`.
- Der Gate prüft zusätzlich, dass die `NEXT_PUBLIC_SUPABASE_URL` aus der `.env.local` des Checkouts,
  in dem du den Befehl startest, wirklich auf `pqdkhefxsxkyeqelqegq` zeigt. Für einen Produktions-
  schreibvorgang muss dieser Checkout also Produktions-Credentials tragen
  (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Fehlt eine der vier Bedingungen,
  bricht der Befehl mit `Writes require ALLOW_DISCOVERY_PRODUCTION_WRITE=1, …` ab.
- Der Befehl druckt die fertige WhatsApp-Nachricht inklusive Link:
  `https://chaarlie.de/beratung/einladung#code=…`. Der Code steht im URL-**Fragment** — er landet
  damit in keinem Server-Log, keinem Referer-Header und keiner Analytics-Query. Die Basis-URL kommt
  aus `NEXT_PUBLIC_SITE_URL` (Vorgabe `https://chaarlie.de`).
- `npm run discovery -- list` zeigt für jede Einladung Name, E-Mail, Status
  (`invited` / `claimed` / `revoked`), `tokenVersion`, Link und Nachricht.

### Link erneuern und widerrufen

```sh
ALLOW_DISCOVERY_PRODUCTION_WRITE=1 npm run discovery -- rotate --enrollment=<uuid> --apply --confirm-project=pqdkhefxsxkyeqelqegq
ALLOW_DISCOVERY_PRODUCTION_WRITE=1 npm run discovery -- revoke --enrollment=<uuid> --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

- **`rotate`** erhöht `token_version`. Jeder ältere Link ist damit sofort tot, die Einladung selbst
  bleibt bestehen. Für „Link im falschen Chat gelandet".
- **`revoke`** setzt `revoked_at` **und** entfernt den `app_metadata`-Stempel des eingelösten Kontos.
  Beides ist nötig: der Middleware-Gate liest nur das JWT, ein `revoked_at` allein ließe eine
  Teilnehmerin bis zum nächsten Token-Refresh im Gate stehen. Nach dem Widerruf läuft das Konto als
  gewöhnlicher Nutzer weiter; Quiz-, Profil- und Scan-Daten bleiben unangetastet.
  Der Befehl ist für eingelöste Einladungen **wiederholbar**: bricht der zweite Schritt ab (der
  Stempel bleibt stehen, obwohl `revoked_at` schon gesetzt ist), räumt ein erneuter Lauf genau
  diesen Rest auf und meldet den **ursprünglichen** Zeitstempel — er widerruft also nicht ein
  zweites Mal. Nach einem Fehler einfach noch einmal ausführen.

Eine widerrufene Einladung blockiert dieselbe E-Mail nicht: die Eindeutigkeits-Indizes sind partiell
(`WHERE revoked_at IS NULL`), du kannst also jederzeit neu einladen.

### Absagen, mit denen du rechnen musst

| Fall                                                                      | Antwort                                                                                                   | Was zu tun ist                                                                                                                                     |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konto mit laufendem bezahltem Zugang                                      | `403`, Code `existing_paid_access`, deutsche Copy („Dieses Konto hat bereits vollen Zugang zu Chaarlie…") | Nicht einladen. Ein Discovery-Stempel würde ein zahlendes Mitglied hinter den Teilnehmer-Gate ziehen. Persönlich klären.                           |
| Konto mit fremdem `access_kind` (Partner, Field-Test)                     | `403`, Code `existing_access_kind`                                                                        | Den alten Zugang bewusst auflösen, bevor diese Person eingeladen wird. Der Claim überschreibt fremde Zugangsarten nie — das wäre nicht rückholbar. |
| Link widerrufen oder rotiert                                              | `410`, „Diese Einladung ist nicht verfügbar."                                                             | Aktuellen Link aus `npm run discovery -- list` schicken.                                                                                           |
| Konto existiert schon (ohne bezahlten Zugang, ohne fremden `access_kind`) | `202` + Magic-Link                                                                                        | Kein Fehler: die Teilnehmerin bestätigt per Mail und wird über `/beratung/weiter` in denselben Claim zurückgeführt.                                |

### Was die Teilnehmerin durchläuft

`/beratung/einladung` (Begrüßung mit Namen) → „Los geht's" → Konto + Anmeldung → **`/quiz`**
(das reguläre Legacy-Quiz, Inhalt unverändert, Name und E-Mail auf die Einladung festgenagelt) →
`/beratung/produkte` (Produkt-Checkliste, zehn Kategorien) → „Absenden".

Unterschiede zum normalen Quiz-Ende: Die Teilnehmerin sieht **keine Marketing-Einwilligung** — der
Lead wird beim Erreichen des Schritts automatisch mit `marketing_consent=false` gespeichert (schlägt
das fehl, bleibt ein „Erneut versuchen" stehen). Danach kommt „Geschafft — dein Haarprofil steht." mit
„Weiter zu deinen Produkten" statt des Analyse-Teasers. In der Checkliste beantwortet „Mehr benutze ich
nicht" (erscheint, sobald eine Kategorie beantwortet ist) alle noch offenen Kategorien mit „benutze ich
nicht" — abgeschickt wird trotzdem erst mit „Absenden".

Das Legacy-`/quiz` ist harte Voraussetzung: nur daraus entsteht die Quelle, aus der das Cockpit die
Idealroutine rechnet. Der Einladungs-Flow führt von selbst dorthin — **schick einer Teilnehmerin
niemals einen `/lp/*`-Link**, der Funnel-Quiz erzeugt keine brauchbare Quelle für dieses Werkzeug.

## 2. Intake überwachen

`/admin/beratung` listet jede Einladung mit dem Stand ihrer Checkliste:

| Spalte      | Bedeutung                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Zugang      | `eingeladen` (Link raus) · `eingelöst` (Konto angelegt) · `widerrufen`                                                      |
| Checkliste  | `nicht begonnen` (keine Intake-Zeile) · `offen` (Entwurf, `state='draft'`) · Zeitstempel (abgeschickt, `state='submitted'`) |
| Finalisiert | leer, bis du im Cockpit „Finalisieren" gedrückt hast                                                                        |

**Gesprächsreif ist eine Teilnehmerin erst, wenn in „Checkliste" ein Zeitstempel steht.** Der
Zustand `submitted` ist Voraussetzung für „Finalisieren" — ohne ihn antwortet der Endpunkt `409`.
Solange die Checkliste offen ist, kannst du das Cockpit zwar öffnen und lesen, aber nicht abschließen.

## 3. T-1: Vorbereitung am Tag vor dem Call

### 3a. Unbekannte Produkte durch die Recherche schicken

Produkte, die die Teilnehmerin scannt oder eintippt und die der Katalog nicht kennt, landen als
`product_submissions`-Zeile (Quelle `name_research`, `dm_search` oder ein `barcode_unknown`-Scan).
Im Cockpit erscheinen sie unter „Nicht in der Idealroutine" als **„Noch in Recherche"** und bekommen
kein Urteil und keinen Routine-Schritt.

Die offenen Einträge einer Teilnehmerin listet der Dry-run des Abgleichs — mit Kategorie, den Worten
der Teilnehmerin, der Submission und deren Status:

```sh
npm run discovery -- reconcile --enrollment=<uuid>
```

Die Recherche selbst läuft über die bestehende Produkt-Intake-Strecke — **`docs/product-intake-research-ops.md`
ist dafür die Quelle der Wahrheit** (Queue → Review → geführte Freigabe, u. a.
`npm run products:intake:research-queue`, `npm run products:intake:review-app`,
`npm run products:intake:approve-package`). Dieses Runbook wiederholt diese Regeln nicht.

### 3b. Ergebnis in den Intake zurückschreiben

**Nichts gleicht sich von selbst ab.** `discovery_intake_items.product_id` wird nur beim Erfassen
gesetzt. Auch nachdem die Recherche das Produkt veröffentlicht und
`product_submissions.approved_product_id` gefüllt hat, bleibt die Intake-Zeile ohne `product_id` —
und damit ohne Urteil und ohne Schritt. Der Abgleich ist ein bewusster Handgriff vor dem Call:

```sh
npm run discovery -- reconcile --enrollment=<uuid>
npm run discovery -- reconcile --email="lea@example.com"
npm run discovery -- reconcile --all
```

Genau ein Bereich pro Aufruf; zwei davon gleichzeitig lehnt der Befehl ab. Ohne `--apply` ist er ein
**Dry-run**: er liest, rechnet und druckt genau den Plan, den `--apply` dann ausführt. Geschrieben
wird nur unter demselben vierfachen Gate wie bei `create` / `revoke` / `rotate`:

```sh
ALLOW_DISCOVERY_PRODUCTION_WRITE=1 npm run discovery -- reconcile --all \
  --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

Jeder offene Eintrag bekommt im Ergebnis genau eines von fünf Urteilen:

| `outcome`                 | Bedeutung                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reconciled`              | Die Submission ist auf ein Produkt freigegeben, das die Scan-Prüfung besteht; die Zeile trägt jetzt dessen `product_id` (im Dry-run: würde sie tragen).                                                                                                                                                                                                                |
| `research_pending`        | Noch kein freigegebenes Produkt — die Recherche läuft weiter.                                                                                                                                                                                                                                                                                                          |
| `submission_not_approved` | Eine `approved_product_id` steht zwar auf der Submission, ihr `status` ist aber weder `approved` noch `matched_existing` — das Review ist zurück auf `needs_more_info` gegangen oder hat abgelehnt, ohne die alte ID zu löschen. Die ID ist damit kein Urteil mehr und wird nicht geschrieben. Im Review klären.                                                       |
| `approved_but_ineligible` | Freigegeben, aber das Produkt ist deaktiviert oder aus dem Personal-Plan-Suchraum genommen. Bewusst **nicht** geschrieben: dieselbe Prüfung hätte es schon beim Erfassen abgelehnt. Erst im Katalog klären. Die Prüfung läuft bei `--apply` direkt vor jedem einzelnen Schreibvorgang noch einmal — ein langer Sweep darf nicht gegen einen veralteten Plan schreiben. |
| `already_assigned`        | Die Zeile hat zwischen Plan und Schreibvorgang selbst eine `product_id` bekommen. Die Antwort der Teilnehmerin bleibt stehen; dieser Lauf hat nichts geschrieben.                                                                                                                                                                                                      |

Das Feld `productId` im Ergebnis ist immer das, was **dieser Lauf** geschrieben hat (im Dry-run:
geschrieben hätte) — nie der aktuelle Wert der Zeile. Außer bei `reconciled` steht dort `null`; was
eine `already_assigned`-Zeile jetzt wirklich trägt, sagt nur das Cockpit.

Was der Befehl **nicht** anfasst:

- Zeilen, die schon eine `product_id` tragen — das ist die Antwort der Teilnehmerin, nicht unsere.
- Zeilen mit `source='barcode_unknown'` **ohne** Submission. Die tragen nur den Barcode und lesen
  sich im Cockpit als „Gescanntes Produkt · &lt;Barcode&gt;". Es gibt für sie keine Submission, aus
  der sich etwas zurückschreiben ließe — der Befehl sieht sie deshalb gar nicht erst. Dafür bleibt es
  bei Handarbeit, und die braucht zwei Schritte (Supabase-SQL, Service-Rolle).

  Erst die betroffenen Zeilen samt Barcode heraussuchen:

  ```sql
  select i.id, i.category, i.barcode_identifier
  from public.discovery_intake_items i
  join public.discovery_intakes t on t.id = i.intake_id
  where t.enrollment_id = '<enrollment-id>'
    and i.source <> 'none'
    and i.product_id is null
    and i.product_submission_id is null;
  ```

  Dann die passende `products.id` heraussuchen und eintragen, sonst bleibt das Produkt ohne Urteil:

  ```sql
  update public.discovery_intake_items
  set product_id = '<product-id>'
  where id = '<item-id>' and product_id is null;
  ```

Die Reichweite der Bereiche unterscheidet sich absichtlich:

- **`--enrollment` / `--email`** nehmen genau diese eine Teilnehmerin, auch wenn ihr Call schon
  finalisiert ist. Steht im Ergebnis ein `finalizedAt`, danach im Cockpit **neu finalisieren** —
  sonst zeigt das PDF weiter den Stand von vorher.
- **`--all`** ist enger: widerrufene Einladungen und finalisierte Calls bleiben außen vor, und
  Teilnehmerinnen ohne offene Einträge tauchen gar nicht erst auf.

Nach dem Abgleich das Cockpit neu laden — es rechnet bei jedem Aufruf frisch.

### 3c. Preflight: sind die Quellfakten vollständig?

Oben im Cockpit steht ein gelber Banner **„Intake unvollständig"**, wenn das Quiz der Teilnehmerin
nicht genug hergibt. Er kommt aus derselben Klassifikation, mit der `/plan-bereit` entscheidet, ob
ein Profil überhaupt einen Plan tragen kann (`classifyPlanBereitSourceFacts`):

- **„Diese Antworten fehlen für einen vollständigen Plan:"** + Liste der offenen Fragen — die
  Idealroutine wird dünn. Vor dem Call klären.
- **„Zu diesem Konto ist kein Quiz-Lead gebunden."** — das Quiz ist nicht angekommen. Ohne das gibt
  es nichts zu besprechen.
- **„Die Quiz-Antworten sind nicht lesbar."** — falsche Quelle (kein `legacy`/`personal_plan`-Lead).

Kein Banner heißt: Quelle in Ordnung. Statt des Cockpits können auch zwei Hinweise stehen —
„Für dieses Konto gibt es noch kein nutzbares Haarprofil. Quiz prüfen." (keine lesbare Quelle) oder
„Der Plan lässt sich gerade nicht lesen. Später noch einmal öffnen." (vorübergehender Fehler).

## 4. Der Call

`/admin/beratung/<enrollmentId>` ist der einzige Bildschirm, den du im Gespräch brauchst.

1. **Idealroutine** — der obere Block, zum Vorlesen gebaut: Schritt, Kategorie, was passiert, wie oft.
2. **Pro Schritt**: das Produkt der Teilnehmerin mit dem Urteil des Scanners und den Alternativen,
   dazu genau eine Entscheidung — **behalten** oder **tauschen**.
   - Die wählbaren Tauschziele sind die Alternativen, die die Engine zu ihrem Produkt ohnehin
     anzeigt. Gibt es keine, steht als einzige Option die Empfehlung des Idealplans. Einen freien
     Katalog-Picker gibt es bewusst nicht; der Endpunkt nimmt nichts an, was nicht angeboten wurde
     (`400 swap_not_offered`).
3. **„Nicht in der Idealroutine"** — eingeklappt darunter: Kategorien mit „benutze ich nicht",
   Produkte ohne Schritt im Idealplan und alles, was noch in Recherche ist. Kein Handlungsbedarf,
   aber ansprechbar.
4. **„Finalisieren"** am Ende. Das ist der Abschluss, nicht der Versand.

Entscheidungen lassen sich während und nach dem Gespräch beliebig ändern — solange nicht finalisiert
ist. Nach dem Finalisieren werden Entscheidungs-Schreibvorgänge abgelehnt (`409`, Code `finalized`);
zum Nachbessern erst **„Finalisierung aufheben"**, ändern, neu finalisieren. Das ist jederzeit
erlaubt, weil der Versand ohnehin von Hand passiert.

## 5. Nachbereitung: PDF und Versand

„Finalisieren" speichert den Zeitpunkt **und** den `sourceHash` der zusammengesetzten Routine. Erst
danach gibt der Knopf **„PDF öffnen"** den Weg auf `/admin/beratung/<enrollmentId>/pdf` frei; ohne
Finalisierung leitet die Seite ins Cockpit zurück.

1. Dokument prüfen. Unentschiedene Schritte stehen als „Noch offen – Empfehlung folgt".
2. Steht oben der rote Banner **„Stand hat sich geändert"**, sind Haarprofil oder Katalog seit dem
   Finalisieren gewandert. Das Dokument zeigt dann den _aktuellen_ Stand, nicht den finalisierten —
   im Cockpit prüfen und neu finalisieren, bevor du es verschickst. Der Banner erscheint nur am
   Bildschirm, nie im Druck.
3. Über den Browser als PDF drucken (A4). Die Admin-Navigation ist im Druck ausgeblendet.
4. Den Versand machst du selbst — WhatsApp oder E-Mail. Es gibt keine Versand-Automatik und keine
   Customer.io-Strecke für dieses Werkzeug.

### Optionaler Zugang als Dankeschön

Wenn du einer Teilnehmerin nach dem Gespräch freien Zugang schenken willst, läuft das über den
bestehenden Mechanismus: ein `manual_access_grants`-Eintrag mit `reason = 'friend'`. Das ist
**ausdrücklich eine Handlung nach dem Call** — Grants sind nie Teil der Vorbereitung und nie
Voraussetzung dafür, dass jemand Checkliste oder Quiz nutzen kann.

## 6. Teardown nach dem Programm

1. Jede Einladung widerrufen (`revoke`, siehe Phase 1) — das entfernt zugleich den Stempel und
   entlässt die Konten in den normalen Nutzerpfad.
2. `DISCOVERY_CALL_TOOLKIT_ENABLED` auf `false` setzen (oder die Variable entfernen).

Reihenfolge beachten: erst widerrufen, dann abschalten. Andersherum bleiben die Stempel auf den
Konten stehen, und du brauchst den Flag wieder an, um sie über die CLI loszuwerden.

## Kill-Switch aus: was Teilnehmerinnen dann sehen

Ist `DISCOVERY_CALL_TOOLKIT_ENABLED` nicht `true`, ist der Middleware-Gate **inert** — er greift
weder ein noch leitet er um:

- `POST /api/beratung/resolve` und `POST /api/beratung/claim` → `410`.
- `/beratung/einladung`, `/beratung/produkte` und das Cockpit → `404` (die Seiten rufen
  `notFound()`; die Teilnehmerin sieht also die normale 404-Seite, keinen Hinweis auf das Programm).
- Ein bereits eingelöstes Konto trägt weiter seinen Stempel, hat aber kein Abo. Es folgt deshalb
  dem gewöhnlichen Paywall-Pfad und landet auf **`/reactivate`**. Das ist dokumentiert und
  akzeptiert, keine Schleife — aber es ist auch keine Erklärung für die Teilnehmerin. Wer den Flag
  mitten im Programm abschaltet, strandet die Eingeladenen dort.

## Konfiguration

Dieses Repository führt bewusst keine getrackte `.env.example` (siehe `docs/local-qa-access.md`);
Umgebungsvariablen werden im Dokument der jeweiligen Funktion beschrieben. Für das Discovery-Call-
Toolkit sind es drei:

- **`DISCOVERY_CALL_TOOLKIT_ENABLED`** — Kill-Switch für das gesamte Werkzeug. Nur der exakte Wert
  `true` schaltet ein; Vorgabe ist aus. Wird bei jedem Aufruf frisch aus `process.env` gelesen
  (Edge-tauglich, kein Modul-Cache) — in der Produktion greift eine Änderung also, sobald die
  Plattform die neue Umgebung ausliefert (auf Vercel: Redeploy). Lokal: nach Änderungen in
  `.env.local` den Dev-Server neu starten.
- **`DISCOVERY_ENROLLMENT_SIGNING_SECRET`** — mindestens 32 Zeichen (wird erzwungen; kürzer führt zu
  `503`). Aus ihm wird der Einladungs-Code als reproduzierbarer HMAC über
  (`enrollment_id`, `token_version`) gebildet. **Nicht rotieren, solange ausgegebene Links weiter
  funktionieren sollen** — jede Rotation tötet alle bestehenden Links auf einmal. Für einen einzelnen
  Link gibt es `discovery -- rotate`.
- **`ALLOW_DISCOVERY_PRODUCTION_WRITE`** — reiner CLI-Gate, nur `1` zählt. Gehört **nicht** in die
  Serverumgebung, sondern wird dem einzelnen Befehl vorangestellt. Ohne ihn (oder ohne `--apply`,
  `--confirm-project=pqdkhefxsxkyeqelqegq` und die passende Supabase-URL) schreibt die CLI nichts.

Die CLI braucht zusätzlich `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` in der
`.env.local` des Checkouts, aus dem sie läuft, und benutzt `NEXT_PUBLIC_SITE_URL` für die Links.

## Datenhinweise

Zwei Stellen, an denen Discovery-Teilnehmerinnen in Zahlen auftauchen, die nicht ihnen gelten:

- **Rohe Lead-Zahlen enthalten Discovery-Teilnehmerinnen.** Das Quiz einer Teilnehmerin schreibt
  eine gewöhnliche `leads`-Zeile; sie ist kein Funnel-Lead und darf nicht als Kampagnen-Ergebnis
  gelesen werden. Beim Auswerten über den Intake ausschließen:

  ```sql
  select count(*)
  from public.leads l
  where l.created_at >= '<von>'
    and not exists (
      select 1 from public.discovery_intakes d where d.user_id = l.user_id
    );
  ```

  Die Verknüpfung greift, sobald die Teilnehmerin die Checkliste geöffnet hat — dort wird der Lead
  an ihr Konto gebunden (`leads.user_id`).

- **`scan_retailer_search` und `scan_retailer_result_opened` feuern auch aus der Checkliste.** Die
  Produkt-Erfassung verwendet dasselbe Such-Sheet wie der Produkt-Scan, samt seiner PostHog-Events.
  Wer die dm-Lane des Scanners misst, sieht die Checklisten-Nutzung mit darin.

## Fehlerbilder

- **„Der Link funktioniert nicht"** — zwei verschiedene Bilder, und sie sagen Verschiedenes:
  - **Die Seite meldet „nicht gefunden" (`404`)** — der Flag ist aus. Die Einladungsseite ruft dann
    `notFound()`; am Link selbst ist nichts kaputt.
  - **Die Seite lädt, meldet aber „Diese Einladung ist nicht verfügbar." (`410` aus
    `POST /api/beratung/resolve`)** — widerrufen oder rotiert. Erst
    `npm run discovery -- list` lesen, dann den aktuellen Link schicken.
- **„Dieses Konto kann diese Einladung nicht nutzen." (`403`) beim Testen** — der Browser ist noch
  mit einer früheren Test-Teilnehmerin angemeldet. Der Claim bindet eine Einladung nur an das Konto
  mit genau ihrer E-Mail; eine fremde Sitzung wird abgewiesen, nie umgebogen. Neue Einladungen
  deshalb in einem privaten Fenster öffnen oder vorher abmelden. Bei echten Teilnehmerinnen auf
  einem geteilten Gerät gilt dasselbe.
- **Teilnehmerin landet immer wieder auf der Checkliste** — so gewollt: der Gate lässt nur
  `/beratung`, `/api/beratung`, `/quiz`, `/api/quiz` und `/api/scan` durch und schickt alles andere
  auf `/beratung/produkte`. Das Ziel ist selbst freigegeben, die Umleitung endet also dort.
- **Teilnehmerin landet auf `/reactivate`** — der Flag ist aus (siehe oben) oder die Einladung ist
  widerrufen. Beides erklärt sich der Teilnehmerin nicht von selbst.
- **Checkliste schickt zurück ins Quiz** — Diagnostik oder Lead-Bindung fehlen. Die Seite prüft
  beides gegen die Datenbank und protokolliert die Lücke (`[discovery] quiz projection incomplete`).
  Die Teilnehmerin muss das Quiz wirklich abschließen.
- **`reconcile` meldet `reconciled`, im Cockpit ändert sich nichts** — das war ein Dry-run. Ohne
  `--apply` samt Gate bleibt der Plan ein Plan; `mode` und `writes` im Ergebnis sagen, was galt.
- **„Diese Teilnehmerin hat die Checkliste noch nicht geöffnet."** — es gibt keine Intake-Zeile.
  Nichts zu reparieren, nur nachzufassen.
- **„Finalisieren" ist ausgegraut** — die Checkliste ist noch nicht abgeschickt (`state='draft'`).
- **Entscheidung lässt sich nicht speichern (`409`)** — der Call ist finalisiert. Erst die
  Finalisierung aufheben.
- **PDF öffnet das Cockpit statt des Dokuments** — nicht finalisiert, oder die Quelle ist gerade
  nicht lesbar.
