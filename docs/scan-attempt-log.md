# Scan-Attempt-Log — Auswertung (`scan_resolve_events`)

Jeder Barcode-Resolve-Versuch schreibt eine Zeile (service-role-only, fail-open;
siehe Migration `20260821120000_scan_resolve_events.sql` und
`src/lib/scan/resolve-event-log.ts`). Nur Barcode-Versuche: der productId-Pfad
(Such-Sheet/Merkliste) loggt nichts. `user_id` wird gespeichert (Stealth-Phase-
Entscheidung 2026-08-21); vor Public Launch Retention-Regel festlegen.

## Miss-Ranking = WP10-Backfill-Prioritätenliste

```sql
select
  canonical_value,
  count(*)                  as attempts,
  count(distinct user_id)   as distinct_users,
  max(created_at)           as last_attempt
from scan_resolve_events
where outcome = 'miss'
group by canonical_value
order by attempts desc, distinct_users desc
limit 50;
```

## Weitere Rezepte

Hit/Miss-Quote pro Tag:

```sql
select date_trunc('day', created_at) as day, outcome, count(*)
from scan_resolve_events
group by 1, 2
order by 1 desc, 2;
```

Versuche eines Testers nachvollziehen (Feldtest-Debugging):

```sql
select created_at, raw_value, canonical_value, outcome, matched_product_id
from scan_resolve_events
where user_id = '<auth-user-id>'
order by created_at desc
limit 50;
```

`quarantined` gesondert beobachten: der Barcode zeigt auf ein Katalogprodukt,
das die Disposition-Quarantäne blockt — `matched_product_id` ist dann gesetzt
und benennt das aufzuräumende Produkt.
