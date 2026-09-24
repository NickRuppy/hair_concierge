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

1. **Migrationen ausgerollt.** `supabase/migrations/20260922120000_discovery_call_toolkit.sql` legt
   `discovery_enrollments`, `discovery_intakes`, `discovery_intake_items` und
   `discovery_call_decisions` an — alle vier service-only (RLS an, keine Rechte für `anon` und
   `authenticated`). Für die flache Checkliste (Batch 5) kommen zwei dazu, in dieser Reihenfolge:
   `20260924120000_discovery_intake_usage_product_type.sql` (`category` = Nutzung, jetzt nullable;
   neu `product_type` und `usage_role`; RPC `discovery_intake_submit_confirming_none`) und
   `20260924140000_discovery_admin_item_usage.sql` (RPC `discovery_admin_set_intake_item_usage` für
   die Nutzungs-Korrektur im Cockpit). Beide sind rückwärtskompatibel. Migrationen laufen vor dem
   Anwendungscode; wegen der abweichenden lokalen und entfernten Migrationshistorie nicht per
   pauschalem `supabase db push`, sondern als gezielter, geprüfter Schritt.
2. **Umgebungsvariablen gesetzt** (siehe [Konfiguration](#konfiguration)):
   `DISCOVERY_CALL_TOOLKIT_ENABLED=true` und `DISCOVERY_ENROLLMENT_SIGNING_SECRET`.
3. **Der Kill-Switch ist der Schalter für alles.** Ohne `DISCOVERY_CALL_TOOLKIT_ENABLED=true`
   antworten alle Seiten — Einladung, Checkliste, Cockpit — mit `404`; nur die beiden Claim-APIs
   (`resolve`, `claim`) antworten mit `410`. Der Nav-Eintrag „Beratungen" im Admin bleibt trotzdem
   sichtbar — die Seite dahinter ist dann nur nicht da.

## 1. Einladung

**Im Admin (Standardweg):** `/admin/beratung` → „Neue Einladung": Name (Pflicht), E-Mail
(optional) → „Einladung erstellen" zeigt den Link mit „Link kopieren". Die Nachricht dazu schreibst
du selbst. Pro Zeile: **„Link kopieren"** (der aktuelle Link, jedes Mal aus ID + `token_version`
abgeleitet — nichts wird gespeichert), **„Link erneuern"** (= `rotate`, mit Rückfrage; alte Links
sterben, der neue steht direkt darunter zum Kopieren) und **„Widerrufen"** (= `revoke`, mit
Rückfrage). Widerrufene Zeilen bleiben mit Status „widerrufen" stehen, ohne Link-Knöpfe. Die Route
(`/api/admin/beratung/invites`) ist admin-gegatet und nutzt dieselben Service-Funktionen wie die CLI;
der Produktions-Schreib-Gate der CLI gilt für sie nicht.

**E-Mail optional:** Ohne E-Mail zeigt die Einladungsseite ein leeres E-Mail-Feld, sonst ist es
vorausgefüllt — editierbar ist es immer. Die mit „Los geht's" abgeschickte Adresse wird an die
Einladung gebunden und ist die Konto-Adresse (neu → Konto, existiert → Magic-Link, zahlend →
abgelehnt). Solange die Einladung nicht eingelöst ist, darf ein neuer Versuch mit anderer Adresse
umbinden (Tippfehler); danach nicht mehr. Die Liste zeigt bis dahin „noch offen" als E-Mail.
Eine Bestätigung der Adresse gibt es bewusst nicht (Discovery-Zugang gibt nichts Bezahltes frei).

**CLI (Alternative):**

```sh
npm run discovery -- list
npm run discovery -- create --name="Lea Sommer" [--email="lea@example.com"]
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

| Fall                                                                      | Antwort                                                                                                                        | Was zu tun ist                                                                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konto mit laufendem bezahltem Zugang                                      | `403`, Code `existing_paid_access`, deutsche Copy („Dieses Konto hat bereits vollen Zugang zu Chaarlie…")                      | Nicht einladen. Ein Discovery-Stempel würde ein zahlendes Mitglied hinter den Teilnehmer-Gate ziehen. Persönlich klären.                           |
| Konto mit fremdem `access_kind` (Partner, Field-Test)                     | `403`, Code `existing_access_kind`                                                                                             | Den alten Zugang bewusst auflösen, bevor diese Person eingeladen wird. Der Claim überschreibt fremde Zugangsarten nie — das wäre nicht rückholbar. |
| Link widerrufen oder rotiert                                              | `410`, „Diese Einladung ist nicht verfügbar."                                                                                  | Aktuellen Link aus `npm run discovery -- list` schicken.                                                                                           |
| Konto existiert schon (ohne bezahlten Zugang, ohne fremden `access_kind`) | `202` + Magic-Link                                                                                                             | Kein Fehler: die Teilnehmerin bestätigt per Mail und wird über `/beratung/weiter` in denselben Claim zurückgeführt.                                |
| Getippte E-Mail gehört schon zu einer anderen aktiven Einladung           | `409`, Code `email_unavailable` („Mit dieser E-Mail-Adresse geht es gerade nicht. Nimm eine andere oder melde dich bei Nick.") | Die andere Einladung prüfen (Doppelung?) und ggf. widerrufen. Die Copy verrät bewusst nicht, dass es eine Einladung zu der Adresse gibt.           |
| Eingelöste Einladung, andere E-Mail getippt                               | `409` („Diese Einladung ist schon mit einer anderen E-Mail-Adresse verbunden.")                                                | So gewollt: nach dem Einlösen bleibt die Adresse fest. Bei echtem Irrtum widerrufen und neu einladen.                                              |

### Was die Teilnehmerin durchläuft

`/beratung/einladung` (Begrüßung mit Namen) → „Los geht's" → Konto + Anmeldung → **`/quiz`**
(das reguläre Legacy-Quiz, Inhalt unverändert, Name und E-Mail auf die Einladung festgenagelt) →
`/beratung/produkte` („Deine Produkte": eine flache Liste, keine Kategorie-Kacheln) → „Fertig" →
„Passt das so?" → „Stimmt so – abschicken".

Unterschiede zum normalen Quiz-Ende: Die Teilnehmerin sieht **keine Marketing-Einwilligung** — der
Lead wird beim Erreichen des Schritts automatisch mit `marketing_consent=false` gespeichert (schlägt
das fehl, bleibt ein „Erneut versuchen" stehen). Danach kommt „Geschafft — dein Haarprofil steht." mit
„Weiter zu deinen Produkten" statt des Analyse-Teasers.

**Die Checkliste (flache Liste, Batch 5).** Sie trägt Produkt für Produkt ein — suchen, scannen
oder „Nicht gefunden? Namen eintippen". Das System ordnet jedes Produkt selbst ein und fragt nur,
wenn es nötig ist. Zwei Antworten stehen dabei getrennt:

- **Produkttyp** — was das Produkt _ist_. Bei einem Katalogprodukt kommt er aus dem Katalog, sonst
  aus dem Namen. Aus ihm wird die Recherche-Submission angelegt, nie aus der Nutzung.
- **Nutzung** — _wie sie es benutzt_ (die Kategorie der Zeile, beim Öl samt Rolle). Nur sie
  entscheidet, an welchem Routine-Schritt das Produkt im Cockpit steht.

Gefragt wird nach der Nutzung, die erkannte Antwort ist vorausgewählt (ein Tipp zum Bestätigen):
Öl → „Wann benutzt du das Öl?" (vor der Haarwäsche · nach der Wäsche ins feuchte Haar · als Finish
ins trockene Haar · auf die Kopfhaut); Conditioner/Maske/Leave-in → „Wie benutzt du das?";
Shampoo/Tiefenreinigung → „Wie oft benutzt du das?". Hitzeschutz, Trockenshampoo, Bondbuilder und
Kopfhautpflege fragen nichts. Lässt sich ein Produkt nicht einordnen, kommt „Was ist das?" mit den
Kategorien **und „Weiß ich nicht"** — dann wird es ohne Produkttyp, ohne Nutzung und ohne Recherche
gespeichert und steht im Cockpit als **„Kategorie offen"** (siehe 3d).

„Fertig" führt auf „Passt das so?": ihre Produkte nach Kategorie, darunter „Nichts eingetragen für:
…". **„Stimmt so – abschicken"** speichert in _einem_ Aufruf für jede Kategorie ohne Produkt ein
ausdrückliches „benutzt sie nicht" und schickt die Liste ab — das Cockpit zeigt dort deshalb
„benutzt sie nicht", nicht „Nicht angegeben". „Nicht angegeben — im Call fragen." gibt es nur noch
bei Checklisten aus dem alten Kachel-Modell (vor Batch 5), die ohne diese Bestätigung abgeschickt
wurden. Nach dem Absenden ändert sie nichts mehr; Korrekturen macht nur das Cockpit (siehe 3d).

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
`product_submissions`-Zeile (Quelle `name_research`, `dm_search` oder ein `barcode_unknown`-Scan);
ein DB-Trigger reiht dafür automatisch einen Recherche-Job ein. **Die Recherche selbst läuft nur
lokal:** `npm run products:intake:review-center` starten — der Watch-Modus holt eingereihte Jobs ab,
freigegeben wird in der lokalen Review-App. Ohne laufendes Review-Center bleibt alles in
„In Recherche – wartet". Regeln und Freigabe: **`docs/product-intake-research-ops.md` ist dafür die
Quelle der Wahrheit**; dieses Runbook wiederholt sie nicht.

Den Stand siehst du oben im Cockpit unter **„Eingetragene Produkte"** — jedes erfasste Produkt mit
Bild, Name, Nutzung und Status:

| Status                                                 | Bedeutung                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Im Katalog                                             | Beim Erfassen erkannt.                                                                                                                                                                                                                                                                                                            |
| Freigegeben                                            | Recherche freigegeben, Produkt nutzbar — das Cockpit verwendet es automatisch (siehe 3b).                                                                                                                                                                                                                                         |
| Freigegeben – im Katalog gesperrt                      | Freigegeben, aber deaktiviert/quarantänisiert. Wird nicht verwendet; im Katalog klären.                                                                                                                                                                                                                                           |
| In Recherche – wartet / läuft                          | Job eingereiht bzw. läuft im lokalen Review-Center.                                                                                                                                                                                                                                                                               |
| In Recherche – wartet auf Freigabe                     | Ergebnis liegt in der Review-App.                                                                                                                                                                                                                                                                                                 |
| In Recherche – Nacharbeit / wird veröffentlicht        | Job in Nacharbeit bzw. in der Veröffentlichung.                                                                                                                                                                                                                                                                                   |
| Rückfrage                                              | Review hat `needs_more_info` gesetzt.                                                                                                                                                                                                                                                                                             |
| Recherche fehlgeschlagen / blockiert                   | Letzter Job `failed` / `blocked`.                                                                                                                                                                                                                                                                                                 |
| Recherche ausgeschöpft – im Review-Center neu anstoßen | Job hat alle Versuche verbraucht (`attempt_count >= max_attempts`) — auch ein „laufender" Job im letzten Versuch, dessen Worker seit über 10 Minuten nichts gemeldet hat. Ein Worker nimmt ihn nie wieder; im Cockpit gibt es deshalb keinen Knopf. In der Review-App „Änderungen neu recherchieren" (setzt die Versuche zurück). |
| Recherche nicht gestartet                              | Offene Submission ohne laufenden Job.                                                                                                                                                                                                                                                                                             |
| Nur Barcode – keine Recherche / Keine Recherche        | Keine Submission vorhanden.                                                                                                                                                                                                                                                                                                       |
| Zu wenig Angaben für eine Recherche                    | Weder gültiger Barcode noch Marke **und** Name — nichts, womit eine Recherche starten kann.                                                                                                                                                                                                                                       |
| Produkttyp offen                                       | „Weiß ich nicht": niemand weiß, was das Produkt ist. Erst im Cockpit den Produkttyp festlegen (3d), dann „Recherche starten".                                                                                                                                                                                                     |
| Abgelehnt / Zurückgezogen                              | Submission `rejected` / `cancelled_by_user`. Nichts zu starten.                                                                                                                                                                                                                                                                   |

**„Recherche starten"** steht an jedem Produkt, bei dem es etwas zu tun gibt
(`POST /api/admin/beratung/<enrollmentId>/research`, admin-gegatet wie die Einladungen):

- offene Submission ohne laufenden Job (auch nach „Rückfrage") → Job einreihen
  (`product_intake_enqueue_research_job`);
- letzter Job fehlgeschlagen oder blockiert, mit verbleibenden Versuchen → genau diesen Job erneut einreihen
  (`product_intake_retry_research_job`);
- noch keine Submission → eine anlegen, genau wie die Checkliste es tut (Scan-Strecke, als die
  Teilnehmerin, **Produkttyp** der Zeile — bei alten Kachel-Zeilen ohne Produkttyp deren Kategorie —,
  Barcode bzw. Marke + Name); der Trigger reiht den Job ein.
  Findet diese Strecke das Produkt schon im Katalog, bekommt die Zeile direkt dessen `product_id`.

Der Knopf reiht nur ein — er startet keinen Worker. Nach dem Klick steht der neue Status da; hat
sich dabei das Produkt oder die Submission der Zeile geändert, lädt das ganze Cockpit neu (Name,
Urteil, Routine und Entscheidungen kommen dann frisch vom Server). Ein Doppelklick oder ein zweiter
Tab legt keine zweite Submission an: die Scan-Strecke liefert dieselbe offene Submission zurück,
und die Zeile wird nur beschrieben, solange sie weder Produkt noch Submission trägt.

### 3b. Freigegebene Recherche im Cockpit

**Das Cockpit gleicht beim Laden selbst ab — nur lesend.** Ist die Submission einer Zeile ohne
`product_id` auf `approved`/`matched_existing` mit `approved_product_id` gesetzt und besteht dieses
Produkt dieselbe Scan-Prüfung wie beim Erfassen, behandelt das Cockpit es als Produkt der Zeile:
Urteil, Routine-Schritt, Namen und PDF. In die Datenbank geschrieben wird dabei nichts. Ein
`reconcile` vor dem Call ist damit **nicht mehr nötig**.

Zwei Folgen für den Fingerabdruck:

- Wird Recherche **nach** dem Finalisieren freigegeben, ändert sich die Routine — das PDF zeigt dann
  zu Recht „Stand hat sich geändert". Im Cockpit prüfen und neu finalisieren.
- Ist der Recherche-Stand gerade nicht lesbar, steht oben „Der Recherche-Stand ist gerade nicht
  lesbar …", nichts wird verknüpft, und Finalisieren sowie PDF sind gesperrt (wie bei unlesbaren
  Produktnamen) — kein falscher Drift, kein halb gelesener Fingerabdruck. Seite später neu laden.

Wer die Verknüpfung trotzdem dauerhaft in die Zeile schreiben will (z. B. für Auswertungen), nimmt
weiter den Abgleich:

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

CLI und Cockpit entscheiden mit derselben Regel (`resolveDiscoveryResearchProduct`), was als
freigegeben gilt. Jeder offene Eintrag bekommt im Ergebnis genau eines von fünf Urteilen:

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
- Zeilen **ohne** Submission (z. B. ein `barcode_unknown`-Scan ohne Submission). Für sie gibt es
  nichts zurückzuschreiben. Statt Handarbeit in SQL: im Cockpit **„Recherche starten"** — das legt
  die Submission an, und nach der Freigabe verknüpft das Cockpit das Produkt von selbst.

Die Reichweite der Bereiche unterscheidet sich absichtlich:

- **`--enrollment` / `--email`** nehmen genau diese eine Teilnehmerin, auch wenn ihr Call schon
  finalisiert ist. Steht im Ergebnis ein `finalizedAt`, danach im Cockpit **neu finalisieren** —
  sonst zeigt das PDF weiter den Stand von vorher.
- **`--all`** ist enger: widerrufene Einladungen und finalisierte Calls bleiben außen vor, und
  Teilnehmerinnen ohne offene Einträge tauchen gar nicht erst auf.

Das Cockpit rechnet bei jedem Aufruf frisch — nach einer Freigabe oder einem Abgleich einfach neu
laden.

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

### 3d. Kategorie offen und Nutzung korrigieren

Unter „Eingetragene Produkte" nennt jede Zeile ihre **Nutzung** („Maske", „Öl · Als Finish ins
trockene Haar"). Weicht sie vom Produkttyp ab, stehen beide da: **„Benutzt als Maske · Produkt:
Conditioner"**.

- **„Kategorie offen"** (rot) — Nutzung unbekannt („Weiß ich nicht"). Die Zeile hat die Auswahl
  direkt offen: **„Produkttyp"** (nur wenn niemand weiß, was es ist — ein bekannter Typ aus Katalog,
  Name oder ihrer Antwort wird nie überschrieben) und **„Benutzt als"**, vorausgewählt wie ihre
  eigene Frage es täte (änderbar) → „Speichern". Mit dem Produkttyp startet das Cockpit direkt nach
  dem Speichern die Recherche (derselbe Weg wie „Recherche starten", aus dem Produkttyp). Klappt das
  nicht oder gibt es nichts zu starten (z. B. weder gültiger Barcode noch Marke + Name), bleibt die
  Speicherung trotzdem stehen, und die Liste zeigt den Status wie sonst — ggf. mit „Recherche
  starten".
- **„Kategorie ändern"** — an jeder anderen Zeile, sobald die Checkliste abgeschickt ist: „Benutzt
  als" wählen → „Speichern". Die Auswahl kennt alle Kategorien, beim Öl die drei Zeitpunkte, bei der
  Kopfhautpflege zusätzlich „Auf die Kopfhaut" (Öl).

Beides geht über `PATCH /api/admin/beratung/<enrollmentId>/items/<itemId>` (gegatet wie „Recherche
starten": gleiche Herkunft → Kill-Switch → Admin → Einladung/Zeile) und ist **ein**
Datenbank-Aufruf (`discovery_admin_set_intake_item_usage`):

- Nutzung (und ggf. Produkttyp) setzen;
- ein „benutzt sie nicht" in der Ziel-Kategorie löschen;
- bleibt die alte Kategorie ohne Produkt, dort ein „benutzt sie nicht" eintragen — ihr „Stimmt so –
  abschicken" hat die ganze Liste bestätigt, die alte Kategorie ist also ehrlich leer;
- Entscheidungen löschen, die an diesem Produkt hingen, und die Entscheidungen jedes Schritts, dessen
  Produkt sich durch die Verschiebung ändert (auch ein verdrängtes). Diese Schritte neu entscheiden.

Abgelehnt wird: solange finalisiert (`409 finalized` — „Erst Finalisierung aufheben"), solange die
Checkliste ein Entwurf ist (`409 not_submitted`), ein Produkttyp für ein Produkt mit bekanntem Typ
(`409 type_known`), eine Nutzung ohne Produkttyp bei „Kategorie offen" (`400
product_type_required`) und eine unpassende Kombination aus Kategorie und Rolle (`400
invalid_usage`).

**Urteil bei abweichender Nutzung.** Ist die Nutzung eine, die ihre eigene Frage für diesen
Produkttyp anbietet (Conditioner als Maske oder Leave-in, Shampoo als Tiefenreinigung, Öl auf der
Kopfhaut), bewertet das Cockpit das Produkt als das, was es _ist_, und zeigt über dem Urteil
„Benutzt als … · Produkt: …". Jede andere Abweichung — und jede alte Kachel-Zeile — bleibt „Der
Katalog führt das Produkt in einer anderen Kategorie."

**Bindung.** Ein Produkt mit Öl-Rolle (bzw. Kopfhaut-Öl) steht genau am Schritt dieser Rolle —
gibt es den im Idealplan nicht, steht es unter „kein Schritt im Idealplan". Alles andere wird wie
bisher der Reihe nach auf die Schritte seiner Kategorie verteilt.

## 4. Der Call

`/admin/beratung/<enrollmentId>` ist der einzige Bildschirm, den du im Gespräch brauchst.

1. **Eingetragene Produkte** — ganz oben: alles, was sie erfasst hat, mit Bild, Name, Nutzung und
   Recherche-Status (siehe 3a), samt „Recherche starten", „Kategorie offen" und „Kategorie ändern"
   (siehe 3d).
2. **Idealroutine** — zum Vorlesen gebaut: Schritt, Kategorie, was passiert, wie oft.
3. **Pro Schritt**: oben die Erklärung in den Worten des Idealplans — „Warum dieser Schritt",
   „Produkttyp", „Worauf es ankommt", „Warum das zu ihrem Haar passt", „Wie oft · wann". Darunter
   das Produkt der Teilnehmerin mit dem Urteil des Scanners und den Alternativen, dazu genau eine
   Entscheidung — **behalten** oder **tauschen**. Ihr Produkt und jede Alternative tragen die
   Vergleichstabelle der iOS-Ergebniskarte (Batch 6): pro Eigenschaft eine Zeile mit Statusscheibe
   (✓ passt, ! mit Einschränkung, ✕ passt nicht, – nicht einschätzbar), dem Wert des Produkts in
   der Statusfarbe und ihrem Ziel in Plum („PRODUKT · DEIN ZIEL"); die Alternativen in der kompakten
   Variante. Sie ersetzt die Schieberegler des Scanners — so siehst du, **wo** eine Alternative
   besser passt. Tabelle und Erklärung stehen nur im Cockpit, nicht im PDF, und gehen nicht in den
   Fingerabdruck ein. Der Web-Scanner selbst bleibt unverändert.
   - Die wählbaren Tauschziele sind die Alternativen, die die Engine zu ihrem Produkt ohnehin
     anzeigt. Gibt es keine, steht als einzige Option die Empfehlung des Idealplans. Einen freien
     Katalog-Picker gibt es bewusst nicht; der Endpunkt nimmt nichts an, was nicht angeboten wurde
     (`400 swap_not_offered`).
4. **„Nicht in der Idealroutine"** — eingeklappt darunter: zuerst rot „Kategorie offen: … — oben
   festlegen, dann finalisieren.", dann Kategorien mit „benutzt sie nicht", Produkte ohne Schritt im
   Idealplan und alles, was noch in Recherche ist. „Kategorie offen" und „Noch in Recherche"
   sperren das Finalisieren (siehe 5.), der Rest ist nur ansprechbar.
5. **„Finalisieren"** am Ende. Das ist der Abschluss, nicht der Versand. Der Knopf bleibt gesperrt,
   und daneben steht rot, worauf er wartet — der Endpunkt prüft jede Sperre selbst noch einmal:
   - ein Produkt ist „Kategorie offen" → „Erst Kategorie festlegen — n Produkte mit offener
     Kategorie." (`409 category_open`);
   - ein erfasstes Produkt ist noch keinem Katalogprodukt zugeordnet (Recherche wartet, läuft,
     nicht gestartet, fehlgeschlagen …) → „Erst Recherche abschließen — n Produkte noch in
     Recherche." (`409 research_open`, Batch 6). Grund: jedes recherchierte Produkt trägt seine
     geprüfte Anwendung, das finalisierte PDF hat so immer eine vollständige Anleitung;
   - ein gedrucktes Produkt hat keine vollständige geprüfte Anwendung → „Anwendung fehlt für …"
     (`409 application_missing`, Batch 6). Das ist eine Datenlücke im Katalog (kein Anwendungs-
     Protokoll, Rolle ohne Protokoll, Katalogprodukt nicht mehr aktiv/empfohlen): im
     Produkt-Intake ergänzen, nicht im Cockpit überbrücken — es wird keine Anleitung erfunden.
     Geprüft wird pro gedrucktem Produkt **und Rolle**: dasselbe Öl in zwei Rollen braucht für
     beide eine Anleitung. Benutzt sie ein Produkt anders, als es ist, aber innerhalb seiner
     Familie (Conditioner als Maske, Öl auf der Kopfhaut), druckt das PDF die eigene geprüfte
     Anleitung des Produkts (seine Katalogkategorie; Rolle: die Idealplan-Rolle dieser Kategorie,
     für die ein Protokoll existiert, sonst die erste geprüfte Rolle der Kategorie) mit
     „· als Haarmaske benutzt" — das sperrt nicht (Nick, 24.09.2026). Jede andere Abweichung
     bleibt eine Lücke.
     So ist jedes Produkt verstanden, bevor sie ein Ergebnis bekommt. Ist die Anwendung gerade nicht
     lesbar, steht oben ein Hinweis, und Finalisieren/PDF warten (`503 unavailable`).

Entscheidungen lassen sich während und nach dem Gespräch beliebig ändern — solange nicht finalisiert
ist. Nach dem Finalisieren werden Entscheidungs-Schreibvorgänge abgelehnt (`409`, Code `finalized`);
zum Nachbessern erst **„Finalisierung aufheben"**, ändern, neu finalisieren. Das ist jederzeit
erlaubt, weil der Versand ohnehin von Hand passiert.

## 5. Nachbereitung: PDF und Versand

„Finalisieren" speichert den Zeitpunkt **und** den `sourceHash` der zusammengesetzten Routine. Erst
danach gibt der Knopf **„PDF öffnen"** den Weg auf `/admin/beratung/<enrollmentId>/pdf` frei; ohne
Finalisierung leitet die Seite ins Cockpit zurück.

1. Dokument prüfen. Unentschiedene Schritte stehen als „Noch offen – Empfehlung folgt". Benutzt sie
   ein Produkt anders, als es ist, steht kurz dahinter „· als Haarmaske benutzt" (am Schritt, im
   Regal und in den Listen). Dieser Zusatz ist Teil des Fingerabdrucks; alte Kachel-Dokumente haben
   ihn nie und bleiben unverändert.
   Neben jedem Produkt steht sein Katalogbild (Batch 6) — in der Routine, im Regal und in den
   Listen; ohne Bild eine leere Kachel.
   **„So wendest du es an"** (Batch 6) beginnt auf einer eigenen Seite: dieselbe Anleitung wie
   `/anwendung` in der App, nach Tagen (Waschtag, Auffrischtag, Pflege zwischendurch …), pro
   Produkt Bild, Name, Zweck, die geprüften Schritte in Reihenfolge und ggf. ein Hinweis. Sie kommt
   aus der Recherche (Produkt-Protokolle + Familien-Vorlagen) über den Produktions-Compiler — für
   die gedruckten Produkte (behalten, getauscht, neu), mit dem Rhythmus des jeweiligen Schritts.
   Bilder und Anleitung sind Teil des Fingerabdrucks.
2. Steht oben der rote Banner **„Stand hat sich geändert"**, sind Haarprofil oder Katalog seit dem
   Finalisieren gewandert. Das Dokument zeigt dann den _aktuellen_ Stand, nicht den finalisierten —
   im Cockpit prüfen und neu finalisieren, bevor du es verschickst. Der Banner erscheint nur am
   Bildschirm, nie im Druck.
   Produktnamen stehen als Marke + Linie + Name da (wie in der Routine); diese gedruckten Namen
   sind Teil des Fingerabdrucks. Seit der Umstellung (Sept. 2026) zeigen vorher finalisierte
   Dokumente den Banner einmal — im Cockpit neu finalisieren. Dasselbe gilt seit Batch 6 für
   Dokumente, deren Produkte Bilder haben oder die eine Anwendung drucken: einmal neu finalisieren.
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
- **„Dieses Konto kann diese Einladung nicht nutzen." (`403`, Code `signed_in_other_account`) beim
  Testen** — der Browser ist noch
  mit einer früheren Test-Teilnehmerin angemeldet. Der Claim bindet eine Einladung nur an das Konto
  mit genau ihrer E-Mail; eine fremde Sitzung wird abgewiesen, nie umgebogen. Neue Einladungen
  deshalb in einem privaten Fenster öffnen oder vorher abmelden. Bei echten Teilnehmerinnen auf
  einem geteilten Gerät gilt dasselbe; die Einladungsseite nennt ihnen genau diesen Ausweg.
- **Teilnehmerin landet immer wieder auf der Checkliste** — so gewollt: der Gate lässt nur
  `/beratung`, `/api/beratung`, `/quiz`, `/api/quiz` und `/api/scan` durch und schickt alles andere
  auf `/beratung/produkte`. Das Ziel ist selbst freigegeben, die Umleitung endet also dort.
- **Teilnehmerin landet auf `/reactivate`** — der Flag ist aus (siehe oben) oder die Einladung ist
  widerrufen. Beides erklärt sich der Teilnehmerin nicht von selbst.
- **Checkliste schickt zurück ins Quiz** — Diagnostik oder Lead-Bindung fehlen. Die Seite prüft
  beides gegen die Datenbank und protokolliert die Lücke (`[discovery] quiz projection incomplete`).
  Die Teilnehmerin muss das Quiz wirklich abschließen.
- **Produkt bleibt auf „In Recherche – wartet"** — das lokale Review-Center läuft nicht
  (`npm run products:intake:review-center`). Der Knopf im Cockpit reiht nur ein.
- **„Recherche starten" antwortet mit dem alten Status** — es gab nichts zu starten (Job läuft schon,
  Review offen, zu wenig Angaben). Der angezeigte Status ist der aktuelle.
- **„Der Recherche-Stand ist gerade nicht lesbar"** — vorübergehender Lesefehler bei Submissions,
  Jobs oder der Scan-Prüfung. Freigegebene Produkte fehlen dann in der Routine; Finalisieren und PDF
  sind gesperrt. Neu laden.
- **`reconcile` meldet `reconciled`, in der Tabelle ändert sich nichts** — das war ein Dry-run. Ohne
  `--apply` samt Gate bleibt der Plan ein Plan; `mode` und `writes` im Ergebnis sagen, was galt.
  (Im Cockpit ist das Produkt trotzdem schon verknüpft — das liest die Freigabe direkt.)
- **„Diese Teilnehmerin hat die Checkliste noch nicht geöffnet."** — es gibt keine Intake-Zeile.
  Nichts zu reparieren, nur nachzufassen.
- **„Finalisieren" ist ausgegraut** — die Checkliste ist noch nicht abgeschickt (`state='draft'`),
  ein Produkt steht auf „Kategorie offen" (daneben „Erst Kategorie festlegen"; siehe 3d), ein
  Produkt ist noch in Recherche („Erst Recherche abschließen") oder einem gedruckten Produkt fehlt
  die geprüfte Anwendung („Anwendung fehlt für …"; siehe 4.5).
- **„Kategorie ändern" ist ausgegraut / „Erst Finalisierung aufheben."** — der Call ist finalisiert.
  Aufheben, korrigieren, betroffene Schritte neu entscheiden, neu finalisieren.
- **Entscheidung lässt sich nicht speichern (`409`)** — der Call ist finalisiert. Erst die
  Finalisierung aufheben.
- **PDF öffnet das Cockpit statt des Dokuments** — nicht finalisiert, die Quelle (Marken,
  Anwendung) ist gerade nicht lesbar, oder der aktuelle Stand würde nicht finalisiert werden
  (Kategorie offen, wieder in Recherche, Anwendung fehlt). Der Drift-Banner gilt nur für
  vollständige, aber geänderte Inhalte.
