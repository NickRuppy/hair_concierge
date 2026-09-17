# Scan-Attempt-Log — Auswertung (`scan_resolve_events`, Telemetrie v2)

Jeder Barcode-Resolve-Versuch schreibt serverseitig eine Zeile. Die v2-Felder
trennen das Ergebnis des Identifier-Lookups (`lookup_outcome`) vom tatsächlich
für die Person abgeschlossenen Terminal-Ergebnis (`terminal_outcome`).
`completed_at` ist nur bei einer vollständig aufgebauten Antwort gesetzt;
`failure_stage` zeigt bei unvollständigen Antworten die begrenzte technische
Stufe. Die alte Spalte `outcome` wird seit dem 2026-09-04 nicht mehr
beschrieben und bleibt nur für Zeilen erhalten, die älter sind als dieses
Datum.
Ein exakter Katalogtreffer mit noch nicht belastbar bewertbarem Fit wird als
`verdict_unknown` abgeschlossen und zählt ausdrücklich nicht als `resolved`.

Nur Barcode-Versuche werden erfasst: der productId-Pfad (Such-Sheet/Merkliste)
loggt nichts. Rohereignisse sind service-role-only und werden nach 30 UTC-
Kalendertagen in die service-role-only Tagesaggregate überführt. Die Aggregate
enthalten weder `user_id`, `raw_value` noch `matched_product_id` und werden
nach 12 Monaten gelöscht.

## dm-Lookup-Messung

Die additive dm-Messung bewertet den Katalog-Resolve nicht neu. Bei einem
berechtigten echten Miss nach dem Open-Submission-Check stehen auf
`scan_resolve_events` zusätzlich `dm_lookup_outcome`,
`dm_lookup_duration_ms` und `dm_lookup_deadline_ms`. Alle anderen
Resolve-Zeilen behalten diese drei Felder auf `NULL`; `NULL` bedeutet also
„kein berechtigter dm-Lookup“, nicht „dm hat das Produkt nicht gefunden“.
`disabled` ist dagegen ein gemessener, berechtigter Lookup ohne Outbound-
Aufruf und bleibt als Outcome sichtbar.

`scan_submit_dm_lookup_events` misst jeden berechtigten submit-seitigen
Lookup. Sie enthält absichtlich nur Zeitstempel, Outcome, Dauer und Deadline:
keine Nutzer-ID, keinen Barcode/GTIN, keine Produkt- oder Submission-ID und
keinen dm-Payload. Beide Rohquellen sind nur für `service_role` zugänglich.

Vor dem Löschen überführt `private.run_scan_resolve_retention()` beide
Rohquellen in `scan_dm_lookup_daily_aggregates`, gruppiert nach UTC-Tag,
Route (`resolve`/`submit`), Outcome, verwendeter Deadline und Dauer-Bucket.
Die Buckets sind `0_249`, `250_499`, `500_999`, `1000_1499`,
`1500_1999`, `2000_2999`, `3000_4999` und `5000_plus` Millisekunden.
`not_called` bedeutet `duration_ms IS NULL`; sein Aggregate-Schlüssel
verwendet `deadline_ms = 0`, weil ein Primärschlüssel kein `NULL` als
idempotenten Bucket zulässt. `duration_sum_ms` ist dort nullfrei und daher
`0`. Die Funktion ersetzt beim Wiederholen den exakten Tagesbucket, bevor
sie Rohzeilen löscht; sie verdoppelt keine Counts.

```sql
select
  day,
  route,
  outcome,
  deadline_ms,
  latency_bucket,
  sum(event_count) as lookups,
  sum(duration_sum_ms) as duration_sum_ms
from public.scan_dm_lookup_daily_aggregates
group by 1, 2, 3, 4, 5
order by day desc, route, outcome, deadline_ms, latency_bucket;
```

Die 30-Tage-Rohdaten erlauben exakte p50/p95-Berechnungen aus
`duration_ms`. Die 12-Monats-Aggregate erlauben nur eine Bucket-Näherung,
nicht ein exaktes Perzentil. Für die dm-Hit-Quote ist der Nenner ausschließlich
ein abgeschlossener, echter Katalog-Miss mit nicht-null
`dm_lookup_outcome`; offene Submissions, Quarantäne, ungültige Eingaben und
Resolve-Zeilen ohne dm-Felder werden separat gezählt. Eine fehlende
dm-Messung auf einem berechtigten Miss ist ein Telemetriefehler, kein
`not_found`.

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

## Historische v1-Zeilen getrennt behandeln

```sql
select count(*) as legacy_terminal_unknown_events
from public.scan_resolve_events
where telemetry_version = 1
  and terminal_outcome = 'legacy_unknown';
```

Beim ursprünglichen Planungssnapshot waren das sechs historische Ereignisse;
bis zum Cutover können weitere reguläre v1-Ereignisse hinzukommen. Der
Live-Preflight prüft deshalb Anzahl und Altformat unmittelbar vor dem Apply.
Alle vorhandenen v1-Zeilen enthalten nur den alten Lookup-Status und werden
ausdrücklich weder als `resolved` noch als belastbare Hit/Miss-Quote
interpretiert.

## Freigabe- und Cutover-Reihenfolge

Die Scanner-Anwendung hat nach diesem Cutover keinen Lesefallback auf den alten
Identifier-Vertrag. Deshalb gilt für jede spätere, separat autorisierte
Produktionsfreigabe zwingend:

1. Unmittelbar vor dem Apply den Live-Preflight für Kollisionen, ungültige
   GTIN-Zeilen sowie Anzahl und Form aller historischen v1-Telemetriezeilen
   wiederholen. Diese Prüfung ist zugleich der Sizing-Check für das Backfill.
2. Die Migrationen `20260826093828`, `20260826142000`, `20260826142100` und
   `20260826142200` in genau dieser Reihenfolge anwenden und verifizieren.
3. Erst nachdem `canonical_gtin14`, die v2-Telemetriefelder, Writer-Guards,
   Retention-Job und der globale partielle Unique Index live nachgewiesen sind,
   darf die dazugehörige Anwendungsversion deployt werden.
4. Nach dem Deploy einen gültigen Treffer, einen unbekannten Barcode und einen
   ungültigen Barcode über den echten Resolve-Pfad prüfen und die gespeicherten
   Terminalzustände kontrollieren.

Ein Datenbankschema vor der alten Anwendung ist rollback-kompatibel; die neue
Anwendung vor den Migrationen ist es nicht und würde Barcode-Scans ausfallen
lassen. Die Migration klassifiziert alle bis dahin vorhandenen Altformat-Zeilen
als `legacy_unknown`; ihre Anzahl wird bewusst nicht eingefroren, weil die alte
Anwendung bis zum Cutover weitere reguläre v1-Zeilen schreiben kann.

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

`quarantined` gesondert beobachten: der Barcode zeigt auf ein Katalogprodukt,
das die Disposition-Quarantäne blockt — `matched_product_id` ist dann gesetzt
und benennt das aufzuräumende Produkt.

## Täglicher Operator-Loop (Public Launch)

Volles Verfahren in `docs/product-intake-research-ops.md` — hier nur die
tägliche Kurzfassung:

1. `npm run products:intake:queue -- --status pending_review --report`
2. Review/Approval pro `docs/product-intake-research-ops.md` (Review-Center
   oder `approve-package`).
3. `npm run products:intake:notify-pending` (Dry-Run), dann
   `npm run products:intake:notify-pending -- --apply --confirm`.

Die Pending-Screen-Zusage im Scan-Flow ist „Meist innerhalb von 24 Stunden –
wir melden uns im Chat" — daher der tägliche Lauf.
