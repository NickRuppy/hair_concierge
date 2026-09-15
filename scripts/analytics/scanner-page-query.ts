/** Scanner display cohorts. A durable journey may display the page more than once. */
export type ScannerPageChart = "funnel" | "offer" | "traffic" | "health" | "cohort"
export type ScannerPageQueryOptions = {
  sourceSql?: string
  from?: string
  to?: string
  cutoff?: string
}

export const scannerPageSourceSql = `SELECT event,
ifNull(toString(properties.funnel_session_id),'') AS sid,
ifNull(toString(properties.funnel_package_key),'') AS package_key,
if(event='scanner_quiz_viewed',coalesce(toFloat(toDateTime(nullIf(toString(properties.viewed_at),''))),toFloat(timestamp)),toFloat(timestamp)) AS at,
ifNull(toString(properties.scanner_tracking_version),'') AS page_version,
ifNull(toString(properties.trial_analytics_version),'') AS trial_version,
ifNull(toString(properties.utm_source),'') AS utm_source,
ifNull(toString(properties.utm_medium),'') AS utm_medium,
ifNull(toString(properties.utm_campaign),'') AS utm_campaign,
if(lower(ifNull(toString(properties.is_internal_test),'false')) IN ('true','1')
 OR ifNull(toString(properties.test_kind),'') IN ('field_test','partner'),1,0) AS is_test
FROM events WHERE timestamp>={filters.dateRange.from} AND timestamp<=now()
AND properties.funnel_package_key='scan_v1'`

export function buildScannerPageQuery(
  chart: ScannerPageChart,
  options: ScannerPageQueryOptions = {},
) {
  const {
    sourceSql = scannerPageSourceSql,
    from = "toFloat({filters.dateRange.from})",
    to = "toFloat({filters.dateRange.to})",
    cutoff = "toFloat(now())",
  } = options
  const page = `event='scanner_quiz_viewed' AND page_version='1' AND at<=${to}`
  const legacy = `event='quiz_started' AND at<=${to}`
  const header = `WITH normalized AS (${sourceSql}),
  sessions AS (SELECT sid,
    groupArrayIf(at,${page}) AS page_times,
    groupArrayIf(at,${legacy}) AS legacy_times,
    groupArrayIf(at,event='quiz_lead_captured') AS lead_times,
    groupArrayIf(at,event='offer_viewed') AS offer_times,
    groupArrayIf(at,event='pricing_viewed') AS pricing_times,
    groupArrayIf(at,event='offer_checkout_opened') AS checkout_times,
    groupArrayIf(at,event='checkout_started') AS provider_times,
    groupArrayIf(at,event='trial_started' AND trial_version='1') AS trial_times,
    groupArrayIf(at,event='purchase_completed' AND trial_version='1') AS paid_times,
    argMinIf(utm_source,at,${page}) AS page_source,
    argMinIf(utm_medium,at,${page}) AS page_medium,
    argMinIf(utm_campaign,at,${page}) AS page_campaign,
    argMinIf(utm_source,at,${legacy}) AS legacy_source,
    argMinIf(utm_medium,at,${legacy}) AS legacy_medium,
    argMinIf(utm_campaign,at,${legacy}) AS legacy_campaign,
    max(is_test) AS tests
  FROM normalized WHERE at>=${from} AND at<=${cutoff} AND package_key='scan_v1' AND notEmpty(sid) GROUP BY sid),
  cohort AS (SELECT *,arrayMin(arrayConcat(page_times,legacy_times)) AS page_at,
    if(length(page_times)>0,'Seitenereignis v1','Legacy quiz_started') AS messbasis,
    if(length(page_times)>0,page_source,legacy_source) AS source,
    if(length(page_times)>0,page_medium,legacy_medium) AS medium,
    if(length(page_times)>0,page_campaign,legacy_campaign) AS campaign
  FROM sessions WHERE tests=0 AND length(page_times)+length(legacy_times)>0),
  leads AS (SELECT *,arrayMin(arrayFilter(t->t>=page_at,lead_times)) AS lead_at,
    arrayMin(arrayFilter(t->t>=page_at,offer_times)) AS any_offer_at FROM cohort),
  offers AS (SELECT *,arrayMin(arrayFilter(t->lead_at>0 AND t>=lead_at,offer_times)) AS offer_at FROM leads),
  checkouts AS (SELECT *,arrayMin(arrayFilter(t->offer_at>0 AND t>=offer_at,checkout_times)) AS checkout_at FROM offers),
  ordered AS (SELECT *,arrayMin(arrayFilter(t->checkout_at>0 AND t>=checkout_at,provider_times)) AS provider_at FROM checkouts),
  offer_followup AS (SELECT *,
    arrayMin(arrayFilter(t->any_offer_at>0 AND t>=any_offer_at,pricing_times)) AS pricing_at,
    arrayMin(arrayFilter(t->any_offer_at>0 AND t>=any_offer_at,checkout_times)) AS offer_checkout_at,
    arrayMin(arrayFilter(t->any_offer_at>0 AND t>=any_offer_at,provider_times)) AS offer_provider_at,
    arrayMin(arrayFilter(t->any_offer_at>0 AND t>=any_offer_at,trial_times)) AS trial_at,
    arrayMin(arrayFilter(t->any_offer_at>0 AND t>=any_offer_at,paid_times)) AS paid_at
  FROM ordered)`
  const queries: Record<ScannerPageChart, string> = {
    funnel: `SELECT stufe,sessions FROM (
 SELECT '01 Scannerquiz angezeigt / Legacy-Start' AS stufe,count() AS sessions FROM ordered
 UNION ALL SELECT '02 Lead gespeichert',countIf(lead_at>0) FROM ordered
 UNION ALL SELECT '03 Offer geöffnet',countIf(offer_at>0) FROM ordered
 UNION ALL SELECT '04 Checkout geöffnet',countIf(checkout_at>0) FROM ordered
 UNION ALL SELECT '05 Anbieter initialisiert',countIf(provider_at>0) FROM ordered
) ORDER BY stufe`,
    offer: `WITH counts AS (SELECT countIf(any_offer_at>0) AS offers,countIf(pricing_at>0) AS pricing,
 countIf(offer_checkout_at>0) AS checkouts,countIf(offer_provider_at>0) AS providers,
 countIf(trial_at>0) AS trials,countIf(paid_at>0) AS paid FROM offer_followup)
 SELECT stufe,sessions FROM (
 SELECT '01 Offer geöffnet' AS stufe,offers AS sessions FROM counts
 UNION ALL SELECT '02 Pricing gesehen',pricing FROM counts
 UNION ALL SELECT '03 Checkout geöffnet',checkouts FROM counts
 UNION ALL SELECT '04 Anbieter initialisiert',providers FROM counts
 UNION ALL SELECT '05 Trial v1 aktiviert',nullIf(trials,0) FROM counts
 UNION ALL SELECT '06 Trial v1 erstmals bezahlt',if(trials>0,paid,NULL) FROM counts
) ORDER BY stufe`,
    traffic: `SELECT coalesce(nullIf(source,''),'(unbekannt)') AS quelle,
 coalesce(nullIf(medium,''),'(unbekannt)') AS medium,
 coalesce(nullIf(campaign,''),'(unbekannt)') AS kampagne,messbasis,count() AS sessions
 FROM cohort GROUP BY quelle,medium,kampagne,messbasis ORDER BY sessions DESC,quelle,medium,kampagne,messbasis LIMIT 30`,
    health: `SELECT pruefung,anzahl FROM (
 SELECT 'Scanner: Quiz-Kohorte (eindeutige Journeys)' AS pruefung,count() AS anzahl FROM cohort
 UNION ALL SELECT 'Scanner: davon nur Legacy quiz_started',countIf(length(page_times)=0) FROM cohort
 UNION ALL SELECT 'Scanner: früherer Legacy-Start vor neuem Seitenereignis',countIf(length(page_times)>0 AND length(legacy_times)>0 AND arrayMin(legacy_times)<arrayMin(page_times)) FROM cohort
 UNION ALL SELECT 'Scanner: Offer ohne Quiz-Seitenereignis/Legacy-Start im Fenster',countIf(length(arrayFilter(t->t<=${to},offer_times))>0 AND length(page_times)+length(legacy_times)=0) FROM sessions WHERE tests=0
 UNION ALL SELECT 'Scanner: Anbieterstart ohne Quiz-Seitenereignis/Legacy-Start im Fenster',countIf(length(arrayFilter(t->t<=${to},provider_times))>0 AND length(page_times)+length(legacy_times)=0) FROM sessions WHERE tests=0
 UNION ALL SELECT 'Scanner: Offer nach Quiz, aber ohne vorherigen Lead-Capture',countIf(any_offer_at>0 AND (lead_at=0 OR lead_at>any_offer_at)) FROM ordered
 UNION ALL SELECT 'Scanner: Anbieterstart nach Quiz ohne vollständige Vorstufen',countIf(length(arrayFilter(t->t>=page_at,provider_times))>0 AND provider_at=0) FROM ordered
) ORDER BY pruefung`,
    cohort: `SELECT sid,page_at,messbasis FROM cohort ORDER BY sid`,
  }
  // The offer aggregate is another named CTE; use a single WITH clause in HogQL.
  return chart === "offer"
    ? `${header},\n${queries[chart].replace(/^WITH /, "")}`
    : `${header}\n${queries[chart]}`
}
