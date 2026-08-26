# Scan-Attempt-Log — Auswertung (`scan_resolve_events`, Telemetrie v2)

Jeder Barcode-Resolve-Versuch schreibt serverseitig eine Zeile. Die v2-Felder
trennen das Ergebnis des Identifier-Lookups (`lookup_outcome`) vom tatsächlich
für die Person abgeschlossenen Terminal-Ergebnis (`terminal_outcome`).
`completed_at` ist nur bei einer vollständig aufgebauten Antwort gesetzt;
`failure_stage` zeigt bei unvollständigen Antworten die begrenzte technische
Stufe. Die alte Spalte `outcome` wird während der Dual-Write-Phase bewusst
weitergeschrieben und ist kein Ersatz für `terminal_outcome`.

Nur Barcode-Versuche werden erfasst: der productId-Pfad (Such-Sheet/Merkliste)
loggt nichts. Rohereignisse sind service-role-only und werden nach 30 UTC-
Kalendertagen in die service-role-only Tagesaggregate überführt. Die Aggregate
enthalten weder `user_id`, `raw_value` noch `matched_product_id` und werden
nach 12 Monaten gelöscht.

## V2: Backfill-Prioritäten aus aktuellen Rohereignissen

```sql
select
  canonical_value,
  count(*) as attempts,
  count(distinct user_id) as distinct_users,
  max(created_at) as last_attempt
from public.scan_resolve_events
where telemetry_version = 2
  and terminal_outcome = 'unknown_product'
group by canonical_value
order by attempts desc, distinct_users desc, last_attempt desc
limit 50;
```

Ein `lookup_outcome = 'miss'` zählt nur dann als Backfill-Signal, wenn das
Terminal-Ergebnis ebenfalls `unknown_product` ist. `quarantined` separat
beobachten: Der Barcode zeigt auf ein Katalogprodukt, dessen Disposition die
Antwort blockt.

## V2: Vollständigkeit und Fehlerschritte pro UTC-Tag

```sql
select
  (created_at at time zone 'UTC')::date as day,
  terminal_outcome,
  failure_stage,
  count(*) as attempts,
  count(*) filter (where completed_at is not null) as completed,
  count(*) filter (where completed_at is null) as incomplete
from public.scan_resolve_events
where telemetry_version = 2
group by 1, 2, 3
order by 1 desc, 2, 3;
```

## Langfristige, nicht-personenbezogene Tagesaggregate

```sql
select
  day,
  lookup_outcome,
  terminal_outcome,
  failure_stage,
  sum(attempt_count) as attempts,
  sum(completed_count) as completed,
  sum(incomplete_count) as incomplete,
  sum(distinct_user_count) as daily_distinct_users
from public.scan_resolve_daily_aggregates
group by 1, 2, 3, 4
order by 1 desc, 2, 3, 4;
```

`daily_distinct_users` darf über mehrere Tage nicht aufsummiert und als
eindeutige Personenzahl gelesen werden. Insbesondere lassen sich 7-Tage-
Fenster „distinct user × GTIN“ nicht aus summierten Tages-Distinct-Counts
rekonstruieren.

## Die sechs v1-Zeilen getrennt behandeln

```sql
select count(*) as legacy_terminal_unknown_events
from public.scan_resolve_events
where telemetry_version = 1
  and terminal_outcome = 'legacy_unknown';
```

Beim Migrationsstand sind das genau sechs historische Ereignisse. Sie enthalten
nur den alten Lookup-Status und werden ausdrücklich weder als `resolved` noch
als belastbare Hit/Miss-Quote interpretiert.

## Freigabe- und Cutover-Reihenfolge

Die Scanner-Anwendung hat nach diesem Cutover keinen Lesefallback auf den alten
Identifier-Vertrag. Deshalb gilt für jede spätere, separat autorisierte
Produktionsfreigabe zwingend:

1. Unmittelbar vor dem Apply den Live-Preflight für Kollisionen, ungültige
   GTIN-Zeilen und die erwarteten sechs v1-Telemetriezeilen wiederholen.
2. Die Migrationen `20260826093828`, `20260826093832`, `20260826093836` und
   `20260826093839` in genau dieser Reihenfolge anwenden und verifizieren.
3. Erst nachdem `canonical_gtin14`, die v2-Telemetriefelder, Writer-Guards,
   Retention-Job und der globale partielle Unique Index live nachgewiesen sind,
   darf die dazugehörige Anwendungsversion deployt werden.
4. Nach dem Deploy einen gültigen Treffer, einen unbekannten Barcode und einen
   ungültigen Barcode über den echten Resolve-Pfad prüfen und die gespeicherten
   Terminalzustände kontrollieren.

Ein Datenbankschema vor der alten Anwendung ist rollback-kompatibel; die neue
Anwendung vor den Migrationen ist es nicht und würde Barcode-Scans ausfallen
lassen. Ein abweichender Bestand historischer v1-Zeilen blockiert die erste
Migration absichtlich und muss vor einem Replay in einer anderen Umgebung
explizit beurteilt werden.

Ungültige checksum-behaftete Altwerte werden nicht kanonisch indiziert und
dürfen nicht stillschweigend korrigiert werden. Die operative Hold-Liste bleibt
bis zur belegten Einzelentscheidung sichtbar:

```sql
select id, product_id, identifier_type, identifier_value
from public.product_identifiers
where lower(identifier_type) in ('ean', 'gtin', 'barcode')
  and canonical_gtin14 is null
order by product_id, id;
```

## Feldtest-Debugging innerhalb des Rohdatenfensters

```sql
select
  created_at,
  raw_value,
  canonical_value,
  lookup_outcome,
  terminal_outcome,
  failure_stage,
  completed_at,
  matched_product_id
from public.scan_resolve_events
where user_id = '<auth-user-id>'
order by created_at desc
limit 50;
```
