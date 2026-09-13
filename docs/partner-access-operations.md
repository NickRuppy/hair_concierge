# Partnerzugänge betreiben

Partnerzugänge sind persönliche, namens- und E-Mail-gebundene Creator-Zugänge. Sie laufen nicht ab, können aber jederzeit widerrufen und später reaktiviert werden. Widerruf löscht weder Konto noch Quiz- oder Plandaten und entfernt keine unabhängig bezahlte Berechtigung. Der Zugang entsteht bereits beim Claim (nicht erst bei Aktivierung) und hängt am angemeldeten Konto, nicht an Cookies oder Browser — ein Creator kann den Link in einer neuen Sitzung, einem anderen Browser oder nach Cookie-Verlust weiterverwenden, solange er sich mit dem eingeladenen Konto anmeldet.

## Admin-Ablauf

1. `/admin/partner-access` öffnen.
2. Einen Creator mit Name und E-Mail anlegen oder mehrere Zeilen im Format `Name, E-Mail` einfügen.
3. `Nachricht kopieren` für WhatsApp verwenden. Der Link bleibt gültig, bis er widerrufen oder bewusst rotiert wird.
4. Optional `Per E-Mail senden` verwenden. Ein Sendefehler ändert nichts am Link.
5. Bei Bedarf `Neuer Link`, `Widerrufen` oder `Reaktivieren` wählen.

Ein WhatsApp-Link darf von einer Vorschau geöffnet werden: erst `Los geht’s` reserviert und erstellt das Konto. Der Creator sieht vorab Name und vollständige E-Mail und kann die E-Mail mit Mailbox-Bestätigung korrigieren.

### Badge-Zustände

Der Admin zeigt pro Zeile genau einen der folgenden vier Zustände:

| Badge | Bedeutung |
| --- | --- |
| **Eingeladen** | Link erstellt, noch nicht geclaimt. |
| **Zugang aktiv · Quiz offen** | Claim abgeschlossen, der Partner-Zugriff (Grant) ist aktiv, das Quiz wurde noch nicht abgeschlossen. Der Creator kann die App bereits nutzen. |
| **Plan gestartet** | Aktiviert — der Creator hat das Quiz abgeschlossen und einen Plan gestartet; der Grant ist weiterhin aktiv. |
| **Widerrufen** | Entweder explizit widerrufen, oder geclaimt/aktiviert ohne aktiven Grant (z. B. nach einem älteren, noch nicht selbstheilenden Zustand). |

Bei alten "Konto erstellt"-Zeilen (geclaimt, nie aktiviert, nie widerrufen, ohne Grant) steht das Badge auf **Widerrufen**, bis entweder der Creator den Link erneut öffnet (Selbstheilung, siehe unten) oder im Admin **Reaktivieren** gedrückt wird — das legt für solche Zeilen jetzt den fehlenden Grant an und stellt den Zugang wieder her. **Reaktivieren** stellt dabei nur den Zugang wieder her; der noch offene Neustart passiert, sobald der Creator den Link das nächste Mal öffnet.

### Neustart: was ein Claim zurücksetzt

Beim ersten Claim einer Einladung setzt der Server das claimende Konto in denselben Zustand wie ein brandneues Partnerkonto zurück ("Neustart"), außer bei der bezahlten Ausnahme unten. Das läuft in derselben Datenbank-Transaktion wie der Claim — schlägt irgendein Schritt fehl, wird der gesamte Claim zurückgerollt, es bleibt kein halb-zurückgesetztes Konto.

**Wird zurückgesetzt:**
- Profil: Onboarding-Status, Onboarding-Schritt, "Willkommens-Popup gesehen"
- Haarprofil (`hair_profiles`): gelöscht
- Personal-Plan-Zeiger (`personal_plans`): auf die Einladung neu verankert, aktueller Bedarf/Routine/Vorschlag/Fingerprint-Zeiger auf leer
- Offene Verfeinerungs- und Produkt-Entwürfe: auf "veraltet" gesetzt (nicht gelöscht)
- Offene Routine-Vorschläge: auf "überholt" gesetzt
- UI-Lifecycle-Marken (z. B. gesehene Onboarding-Hinweise): gelöscht
- Aktive Tester-Einschreibungen (Personal-Plan- und Quiz-Testgruppen) samt ihrer manuellen Zugriffs-Grants: widerrufen
- Offene Quiz-Entwürfe (`personal_plan_quiz_drafts`) auf den Funnel-Sessions des Kontos: abgelaufen gesetzt
- Offene Ergebnis-Rückkehr-Links (`personal_plan_result_returns`) zu den Leads des Kontos: widerrufen
- Besessene Produkte (`user_products`, Status "owned"): archiviert

**Bleibt erhalten:** Chat-Verläufe, Tracker-Einträge, Scans und Merkliste. Alte Plan-Versionen bleiben als Historie in der Datenbank stehen — nur die aktuellen Zeiger im Personal Plan werden auf leer gesetzt, nichts wird gelöscht.

Der Neustart läuft nur beim **ersten** Claim einer Einladung, der eine Neustart-Entscheidung mitbringt (`fresh_start_decided_at` wird einmalig gesetzt, `fresh_start_at` nur bei einem tatsächlichen Neustart). Ein erneutes Öffnen desselben Links danach setzt nichts zurück — auch dann nicht, wenn die erste Entscheidung "kein Neustart" lautete.

### Bezahlte Ausnahme (P1)

Ein Konto mit aktueller **unabhängiger** bezahlter Berechtigung (laufendes Abo, One-Time-Kauf oder Legacy-Profil-Zeitraum) wird beim Claim **nicht** zurückgesetzt — der Creator behält seinen bezahlten Plan, der Partnerzugang kommt nur als zusätzliche, unabhängige Berechtigung hinzu. Ein neu erstelltes Konto (Claim ohne bestehendes Konto) wird immer neu gestartet. Läuft die bezahlte Berechtigung später ab, hält der Partner-Grant die App weiterhin offen, aber es entsteht **kein** neuer Partner-Neustart — für einen frischen Partnerplan braucht es eine neue Einladung an dieselbe E-Mail (siehe Re-Test-Rezept). Umgekehrt gilt: Ein bereits neu gestarteter Partner, der später ein Abo kauft, behält den auf die Einladung verankerten Plan (Stage 1 meldet für die neue bezahlte Quelle `enrollment_mismatch`) — ob so ein Konto einen neuen bezahlten Plan bekommt, ist eine separate Betreiber-Entscheidung.

### Re-Test-Rezept: einen Creator von null neu testen

Ein bereits geclaimter (oder aktivierter) Zugang setzt sich bei erneutem Linkaufruf nicht mehr zurück. Um denselben Menschen noch einmal bei null starten zu lassen:

1. Im Admin **Widerrufen** für die bestehende Einladung.
2. Für dieselbe E-Mail-Adresse eine **neue** Einladung anlegen (Schritt 2 im Admin-Ablauf).
3. Den neuen Link an den Creator senden. Der Claim auf die neue Einladung läuft wieder als "erster Claim" und setzt das Konto vollständig zurück (vorbehaltlich der bezahlten Ausnahme oben).

`Reaktivieren` auf derselben Einladung reicht für einen echten Neustart nicht aus — es stellt nur den bestehenden Grant wieder her, ohne Quiz- oder Plandaten zurückzusetzen.

### Selbstheilung alter "Konto erstellt"-Zeilen

Vor diesem Feature wurde der Zugriffs-Grant erst bei Aktivierung erzeugt, nicht beim Claim. Eine Einladung, die bereits geclaimt, aber nie aktiviert wurde (z. B. Stefanies Zeile), hatte deshalb keinen Grant. Beim nächsten Öffnen ihres Links erkennt der Server das (geclaimt, nicht aktiviert, noch keine Neustart-Entscheidung getroffen) und heilt sich selbst: er legt einen fehlenden Grant nach und führt — sofern kein unabhängiger bezahlter Zugang vorliegt — denselben Neustart wie ein Erstclaim aus. Das gilt auch, wenn bereits ein Grant besteht (Claim im Rollout-Fenster oder nach **Reaktivieren**): dann bleibt der Grant, und nur der Neustart wird nachgeholt. Kein manueller Eingriff nötig.

### Verhalten nach Widerruf

Ein Widerruf entfernt den Partner-Grant, lässt aber Konto, Chat, Tracker, Scans, Merkliste und Planhistorie unangetastet. Danach läuft das Konto als gewöhnlicher Nutzer: das reguläre Quiz und das reguläre Angebot greifen wieder, unabhängig vom früheren Partnerstatus. Eine unabhängig bezahlte Berechtigung (Abo, One-Time-Kauf, Legacy-Profil-Zeitraum) bleibt vom Partner-Widerruf unberührt.

## CLI

`npm run partner-access -- list` liest den aktuellen Stand. Mutierende Befehle sind standardmäßig Dry-run:

```sh
npm run partner-access -- create --name="Lea Sommer" --email="lea@example.com"
npm run partner-access -- create --file=/absolute/path/creators.json
npm run partner-access -- revoke --invitation=<uuid>
```

Eine ausdrücklich autorisierte Produktionsmutation benötigt zusätzlich `--apply`, `--confirm-project=pqdkhefxsxkyeqelqegq`, die passende Supabase-URL und `ALLOW_PARTNER_ACCESS_PRODUCTION_WRITE=1`. Direkte SQL-Schreibvorgänge sind nicht der normale Operatorpfad.

Widerrufe immer über `revoke_partner_access` beziehungsweise die Admin-Oberfläche oder CLI. Eine direkte Änderung an `manual_access_grants` ist kein vollständiger Partner-Widerruf.

## Rollout

Die Migration `20260901120000_partner_access.sql` muss vor dem Anwendungscode ausgerollt werden. Wegen der abweichenden lokalen und entfernten Migrationshistorie darf sie nicht mit einem pauschalen `supabase db push` ausgerollt werden; dafür ist ein separat geprüfter, gezielter Migrationsschritt erforderlich.

Ebenso muss die Migration `20260913120000_partner_access_fresh_start.sql` vor dem zugehörigen Anwendungscode ausgerollt werden. Der RPC-Parameter `p_fresh_start` von `complete_partner_access_claim` hat keinen Vorgabewert `false`, sondern `NULL` — der RPC wertet einen fehlenden Parameter als "noch keine Entscheidung". Ein Claim im Rollout-Fenster (alter Anwendungscode, der den Parameter nicht kennt) schaltet den Zugang also sofort frei, setzt aber nichts zurück; der Neustart wird beim nächsten Linkaufruf des Creators nachgeholt, sobald der neue Code die Entscheidung mitliefert. Kein Konto wird dadurch ungewollt zurückgesetzt, und keine Einladung bleibt dauerhaft ohne Neustart hängen.

## Konfiguration

- `PARTNER_ACCESS_INVITATION_SIGNING_SECRET`: mindestens 32 zufällige Zeichen; nicht rotieren, solange bestehende Links weiter funktionieren sollen.
- `CUSTOMERIO_PARTNER_INVITATION_TRANSACTIONAL_MESSAGE_ID`: optionaler Einladungsversand; Variablen `first_name`, `invitation_url`.
- `CUSTOMERIO_PARTNER_EMAIL_CHANGE_TRANSACTIONAL_MESSAGE_ID`: E-Mail-Korrektur; Variablen `first_name`, `confirmation_url`.
- `CUSTOMERIO_PARTNER_ACCOUNT_READY_TRANSACTIONAL_MESSAGE_ID`: optionale Konto-bereit-Mail; Variablen `first_name`, `login_url`.

Customer.io `sent` bedeutet nur, dass die API die Sendung mit einem gültigen Receipt angenommen hat. Es ist kein Zustellnachweis. Partner-Funnel bleiben in PostHog mit `test_kind=partner` sichtbar, werden aber nicht an Meta oder kommerzielle Customer.io-Automationen gesendet und erzeugen keine Billing-Ressourcen.

## Fehlerbilder

- `Einladung nicht verfügbar`: Link wurde widerrufen/rotiert oder die Signatur passt nicht. Im Admin aktuellen Link kopieren.
- Bestehendes Konto: einmalige Anmeldung über den Link im Postfach ist beabsichtigt; danach läuft der normale Flow weiter.
- E-Mail-Versand fehlgeschlagen: den persönlichen Link direkt senden; keine Einladung neu anlegen.
- Nach Widerruf weiterhin Zugriff: zuerst auf unabhängige bezahlte Berechtigung prüfen. Der Partner-Widerruf darf diese nicht entfernen.
- Reaktivierung kollidiert mit neuer Einladung: Pro E-Mail und Konto kann nur ein aktueller Partnerzugang bestehen. Den neueren Zugang behalten oder widerrufen, bevor der alte reaktiviert wird.
- "Creator sagt, im neuen Browser/Handy ist der Partner-Modus weg": Der Partner-Modus hängt am angemeldeten Konto, nicht mehr an Cookies oder Browser. Sicherstellen, dass der Creator mit dem eingeladenen Konto angemeldet ist (Login über den Link genügt) — dann funktionieren Partner-Modus, Lead-Speicherung und Angebots-Aktivierung in jedem Browser. Noch nicht gespeicherte Quiz-Antworten (vor der Lead-Erfassung) bleiben im Browser, in dem sie eingegeben wurden — dort weitermachen oder das Quiz im neuen Browser neu beginnen.
- Widerrufene Einladung, Creator will das reguläre Quiz nutzen: funktioniert. Nach Widerruf läuft das Konto als gewöhnlicher Nutzer und bekommt das reguläre Quiz und Angebot, nicht mehr die Partner-Variante — kein Blocker.
