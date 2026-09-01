# Partnerzugänge betreiben

Partnerzugänge sind persönliche, namens- und E-Mail-gebundene Creator-Zugänge. Sie laufen nicht ab, können aber jederzeit widerrufen und später reaktiviert werden. Widerruf löscht weder Konto noch Quiz- oder Plandaten und entfernt keine unabhängig bezahlte Berechtigung.

## Admin-Ablauf

1. `/admin/partner-access` öffnen.
2. Einen Creator mit Name und E-Mail anlegen oder mehrere Zeilen im Format `Name, E-Mail` einfügen.
3. `Nachricht kopieren` für WhatsApp verwenden. Der Link bleibt gültig, bis er widerrufen oder bewusst rotiert wird.
4. Optional `Per E-Mail senden` verwenden. Ein Sendefehler ändert nichts am Link.
5. Bei Bedarf `Neuer Link`, `Widerrufen` oder `Reaktivieren` wählen.

Ein WhatsApp-Link darf von einer Vorschau geöffnet werden: erst `Los geht’s` reserviert und erstellt das Konto. Der Creator sieht vorab Name und vollständige E-Mail und kann die E-Mail mit Mailbox-Bestätigung korrigieren.

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
