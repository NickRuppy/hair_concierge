# Slack-Wachstumsbenachrichtigungen

Der private Kanal ist `#growth` (`C0C24GFBUGL`) im Workspace Chaarlie (`T0BK66ADN4X`), mit der App **Chaarlie Events** (`A0C1WM80HMK`). Name und E-Mail kommen aus dem Chaarlie-Profil. Nachrichten unterscheiden verifizierten Trial-Start, erste bezahlte Trial-Konvertierung und direkten Neukauf. Verlängerungen und bekannte interne Tests sind ausgeschlossen.

## Zustellung über Supabase

1. Die bestehende Zahlungsprüfung speichert ein kanonisches Billing-Ereignis in `billing_analytics_outbox`.
2. Ein Datenbanktrigger ergänzt dessen Slack-Zustellung in `billing_analytics_deliveries`.
3. Ein asynchroner Supabase-Datenbankwebhook ruft nach dem Commit die Edge Function `slack-growth` mit der Zustellungs-ID auf.
4. Die Function übernimmt die Zustellung atomisch, liest Ereignis und Profil, formatiert die Nachricht und sendet sie an den Slack-Incoming-Webhook. Eine eindeutige Übernahme-ID schützt die Statusquittung vor veralteten Workern.

Vercel führt keine Slack-Zustellung und keinen Slack-Cron aus. Die bestehende Entgegennahme und Prüfung von Stripe-/PayPal-Zahlungsereignissen bleibt Teil des Chaarlie-Backends.

Ein Supabase-Datenbankjob prüft jede Minute auf nachzuholende oder fehlgeschlagene Zustellungen. Ohne wartende Arbeit ruft er keine Edge Function auf. Übernommene Zustellungen sind auf fünf Versuche begrenzt; Slack-Rate-Limits werden berücksichtigt. Schlägt die Authentifizierung vor der Übernahme fehl, wird wartende Arbeit weiter minütlich angestoßen; für eine Reparatur kann `private.slack_growth_edge_config.enabled` deaktiviert werden. Ein verlorener Erfolgsbeleg kann selten eine doppelte Nachricht verursachen.

Die autoritative Trial-Payload entsteht mit `jsonb_build_object` aus einem PostgreSQL-`timestamptz`; `trial_authorized_at` verwendet damit ISO-8601 mit `T` und Zeitzone. Der Nachrichtenformatter behält diese bisherige Prüfung bei.

## Zustand und Betrieb

```sql
select public.read_slack_growth_notification_state();
select enabled from private.slack_growth_edge_config;
```

Beide Schalter müssen aktiv sein. `configure_slack_growth_notifications(false)` pausiert die Zustellung. Bei Wiederaufnahme mit `true` bleibt der ursprüngliche `enabled_at`-Zeitpunkt erhalten; die Umstellung darf ihn nicht zurücksetzen. Ereignisse davor werden nicht nachgeholt.

Die Edge Function benötigt die serverseitigen Secrets `SLACK_GROWTH_WEBHOOK_URL` und `SLACK_GROWTH_DISPATCH_TOKEN` sowie die von Supabase bereitgestellten Projekt-Credentials. Der identische Dispatch-Token liegt im Supabase Vault unter `slack_growth_dispatch_token`. Nur die interne Datenbank-Webhook-Verbindung verwendet ihn. JWT-Gateway-Prüfung ist für diese Function deaktiviert; ihr Handler prüft stattdessen den dedizierten Token vor jedem Datenbankzugriff.

Keine Secrets in Tickets, Logs, Client-Code oder Beispielen ausgeben. Keine echten Zahlungen nur zum Testen auslösen. Produktionsänderungen benötigen die dafür geltende Benutzerautorisierung.

Drei fiktive Nachrichten wurden bei der ursprünglichen Einrichtung am15.09.2026 im Kanal geprüft. Das [App-Manifest](../plans/slack-growth-app-manifest.json) und die [Nachrichtenvorschau](../plans/slack-growth-preview.html) dokumentieren die unveränderte Darstellung. Slack-Popups hängen zusätzlich von den persönlichen Benachrichtigungseinstellungen ab.
