# Slack-Wachstumsbenachrichtigungen

Der private Slack-Kanal ist `#growth` (`C0C24GFBUGL`) im Workspace `T0BK66ADN4X`. Die App **Chaarlie Events** (`A0C1WM80HMK`) wurde dort mit dem Scope `incoming-webhook` installiert. Drei ausdrücklich als fiktiv markierte Testnachrichten für Trial-Start, Konvertierung und Neukauf wurden am 15.09.2026 über den echten Webhook gesendet und im Kanal bestätigt. Das [App-Manifest](../plans/slack-growth-app-manifest.json) dokumentiert die vorgesehene Minimalkonfiguration.

Der Backend-Code ist lokal geprüft; automatische Produktionszustellungen sind noch nicht aktiviert. Die Webhook-Verbindung allein aktiviert sie nicht.

Die Benachrichtigungen enthalten Name und E-Mail-Adresse. Der Incoming-Webhook gehört ausschließlich als serverseitiges Secret in `SLACK_GROWTH_WEBHOOK_URL`; er darf weder in Tickets noch in Logs, Tests oder Client-Code erscheinen.

## Aktivierung

Die Migration legt den Datenbankschalter zunächst deaktiviert an. Nach getrennt genehmigter Migration, Deployment und Aktivierung wird er mit der autorisierten Datenbankfunktion eingeschaltet:

```sql
select configure_slack_growth_notifications(true);
```

Für jede Aktivierung und spätere Wiederaufnahme gilt derselbe in der Datenbank gespeicherte Zeitpunkt als Nachholgrenze. Dadurch werden nur Ereignisse ab diesem Zeitpunkt ergänzt. Pausieren erfolgt mit `configure_slack_growth_notifications(false)`.

Die Produktion braucht zusätzlich `SLACK_GROWTH_ENABLED=true`, `VERCEL_ENV=production` und den Webhook als Secret. Der Cron läuft jede Minute, holt fehlende zulässige Zustellungen nach und sendet höchstens fünf Slack-Nachrichten pro Lauf.

Keine echten Zahlungen nur zum Testen auslösen. Die Slack-Konfiguration, Migration, das Deployment und die Aktivierung sind getrennte, ausdrücklich zu genehmigende Produktionsschritte.
