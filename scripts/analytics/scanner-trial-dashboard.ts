import baseline from "./scanner-dashboard-baseline.json"

export const scannerDashboardId = 953895
export const scannerProjectId = 126788
export const trialObservationDays = 14
const secondDay = 86400
const dateFrom = "toFloat({filters.dateRange.from})"
const dateTo = "toFloat({filters.dateRange.to})"
const reportCutoff = "toFloat(now())"

export const trialLifecycleEvents = [
  "trial_started",
  "purchase_completed",
  "trial_cancellation_requested",
  "trial_cancellation_confirmed",
  "trial_cancellation_restored",
  "trial_cancellation_observed",
  "trial_first_payment_failed",
] as const

// Source normalization is separate so fixtures can execute the identical cohort
// SQL against synthetic facts without inserting test data into production.
export const trialSourceSql = `SELECT
  event, toString(properties.trial_enrollment_id) AS enrollment_id,
  ifNull(toString(properties.funnel_package_key),'') AS package_key,
  ifNull(toString(properties.funnel_session_id),'') AS session_id,
  ifNull(toString(properties.billing_provider),'unknown') AS provider,
  ifNull(toString(properties.event_key),'') AS event_key,
  ifNull(toString(properties.trial_analytics_version),'') AS version,
  toFloat(timestamp) AS at,
  toFloat(toDateTime(properties.trial_end_at)) AS trial_end,
  if(lower(ifNull(toString(properties.is_internal_test),'false')) IN ('true','1')
    OR ifNull(toString(properties.test_kind),'') IN ('field_test','partner'),1,0) AS is_test
FROM events
WHERE timestamp >= {filters.dateRange.from} AND timestamp <= now()
  AND event IN (${trialLifecycleEvents.map((event) => `'${event}'`).join(",")})
  AND notEmpty(ifNull(toString(properties.trial_enrollment_id),''))`

type QueryOptions = { sourceSql?: string; from?: string; to?: string; cutoff?: string }
export type TrialChart = "overview" | "cohorts" | "cancellations" | "recovery" | "providers"

export function buildTrialChartQuery(chart: TrialChart, options: QueryOptions = {}) {
  const {
    sourceSql = trialSourceSql,
    from = dateFrom,
    to = dateTo,
    cutoff = reportCutoff,
  } = options
  const header = `WITH normalized AS (${sourceSql}),
  facts AS (SELECT enrollment_id,
    minIf(at,event='trial_started' AND version='1') AS started_at,
    maxIf(trial_end,event='trial_started' AND version='1') AS ends_at,
    argMinIf(provider,at,event='trial_started' AND version='1') AS provider,
    argMinIf(package_key,at,event='trial_started' AND version='1') AS package_key,
    argMinIf(session_id,at,event='trial_started' AND version='1') AS session_id,
    minIf(at,event='purchase_completed') AS paid_at,
    minIf(at,event='trial_first_payment_failed') AS failed_at,
    minIf(at,event='trial_cancellation_requested') AS requested_at,
    minIf(at,event='trial_cancellation_observed') AS observed_at,
    minIf(at,event='trial_cancellation_confirmed') AS confirmed_at,
    countIf(event='trial_cancellation_restored') AS restores,
    argMaxIf(event,tuple(at,event_key),event IN ('trial_cancellation_requested','trial_cancellation_observed','trial_cancellation_restored')) AS last_cancel_action,
    max(is_test) AS is_test
  FROM normalized WHERE at >= ${from} AND at <= ${cutoff} GROUP BY enrollment_id),
  cohort AS (SELECT *,
    if(paid_at>=started_at AND paid_at>0,1,0) AS paid,
    if(requested_at>=started_at AND requested_at<ends_at AND requested_at>0 AND (paid_at=0 OR requested_at<paid_at),1,0) AS requested_in_trial,
    if(${cutoff} >= started_at + ${trialObservationDays * secondDay},1,0) AS mature,
    if(paid_at>=started_at AND paid_at<=started_at+${trialObservationDays * secondDay} AND paid_at>0,1,0) AS paid_within_window
  FROM facts WHERE started_at>0 AND started_at>=${from} AND started_at<=${to}
    AND started_at<=${cutoff} AND ends_at>started_at
    AND package_key='scan_v1' AND notEmpty(session_id) AND is_test=0)`

  const queries: Record<TrialChart, string> = {
    overview: `SELECT * FROM (SELECT '01 Trial aktiviert' AS status,count() AS trials FROM cohort HAVING count()>0
UNION ALL SELECT '02 Erstmals bezahlt',countIf(paid=1) FROM cohort HAVING count()>0
UNION ALL SELECT '03 Trial läuft noch',countIf(paid=0 AND ends_at>${cutoff}) FROM cohort HAVING count()>0
UNION ALL SELECT '04 Trial beendet, bisher unbezahlt',countIf(paid=0 AND ends_at<=${cutoff}) FROM cohort HAVING count()>0
) ORDER BY status`,
    cohorts: `SELECT toDate(toDateTime(started_at)) AS trial_start,
count() AS trials, countIf(paid=1) AS bisher_bezahlt,
countIf(mature=1) AS trials_mit_14_tagen_beobachtung,
countIf(mature=1 AND paid_within_window=1) AS bezahlt_innerhalb_14_tagen,
round(100.0*bezahlt_innerhalb_14_tagen/nullIf(trials_mit_14_tagen_beobachtung,0),2) AS bezahlquote_14_tage_prozent,
round(sumIf((paid_at-started_at)/${secondDay},paid=1)/nullIf(countIf(paid=1),0),2) AS tage_bis_erster_zahlung_mittelwert
FROM cohort GROUP BY trial_start ORDER BY trial_start LIMIT 100`,
    cancellations: `SELECT toInt(floor((requested_at-started_at)/${secondDay})+1) AS trial_tag,
count() AS trials_mit_kuendigungswunsch,
countIf(paid=1) AS spaeter_bezahlt,
countIf(restores>0) AS mit_wiederherstellung
FROM cohort WHERE requested_in_trial=1
GROUP BY trial_tag ORDER BY trial_tag`,
    recovery: `SELECT * FROM (SELECT '01 Erste Abbuchung fehlgeschlagen' AS verlauf,countIf(failed_at>0) AS trials FROM cohort HAVING count()>0
UNION ALL SELECT '02 Nach Fehler erstmals bezahlt',countIf(failed_at>0 AND paid=1 AND paid_at>=failed_at) FROM cohort HAVING count()>0
UNION ALL SELECT '03 Nach Fehler bisher unbezahlt',countIf(failed_at>0 AND paid=0) FROM cohort HAVING count()>0
UNION ALL SELECT '04 Im Trial selbst gekündigt',countIf(requested_in_trial=1) FROM cohort HAVING count()>0
UNION ALL SELECT '05 Anbieter-Kündigung beobachtet',countIf(observed_at>0) FROM cohort HAVING count()>0
UNION ALL SELECT '06 Kündigung beim Anbieter bestätigt',countIf(confirmed_at>0) FROM cohort HAVING count()>0
UNION ALL SELECT '07 Kündigung wiederhergestellt',countIf(restores>0) FROM cohort HAVING count()>0
UNION ALL SELECT '08 Aktueller Kündigungswunsch, bisher unbezahlt',countIf(paid=0 AND last_cancel_action IN ('trial_cancellation_requested','trial_cancellation_observed')) FROM cohort HAVING count()>0
) ORDER BY verlauf`,
    providers: `SELECT provider AS zahlungsanbieter,count() AS trials,countIf(paid=1) AS bisher_bezahlt,
countIf(requested_in_trial=1) AS im_trial_gekuendigt,
countIf(failed_at>0) AS erste_abbuchung_fehlgeschlagen,
countIf(mature=1) AS trials_mit_14_tagen_beobachtung,
round(100.0*countIf(mature=1 AND paid_within_window=1)/nullIf(countIf(mature=1),0),2) AS bezahlquote_14_tage_prozent
FROM cohort GROUP BY zahlungsanbieter ORDER BY zahlungsanbieter`,
  }
  return `${header}\n${queries[chart]}`
}

export type ScannerInsightSpec = {
  key: string
  id?: number
  name: string
  description: string
  query: string
  display: "ActionsBar" | "ActionsTable"
  x?: string
  y?: string
}

const cohortDescription =
  "Datumsfilter = Start-Kohorte; Folgeereignisse bis jetzt, auch nach dem Filter-Ende. Ohne passende Aktivierung bleibt die Kachel leer; neue Ereignisse erscheinen automatisch. Nur v1-Telemetrie mit eindeutiger Enrollment-ID und Scanner-Zuordnung; markierte Tests ausgeschlossen."
export const scannerTrialInsights: ScannerInsightSpec[] = [
  {
    key: "trial-overview",
    name: "11 · Trial — Aktivierung und erster bezahlter Zeitraum",
    description: `${cohortDescription} Aktivierung bedeutet Zahlungsverifikation bei 0 € Umsatz. Die drei Folgezustände teilen die Aktivierungen auf; beendet/unbezahlt kann später noch konvertieren.`,
    query: buildTrialChartQuery("overview"),
    display: "ActionsBar",
    x: "status",
    y: "trials",
  },
  {
    key: "trial-cohorts",
    name: "12 · Trial — Bezahlquote nach Start-Kohorte",
    description: `${cohortDescription} Quote: erste Zahlung innerhalb 14×24 Stunden / Trials mit mindestens 14×24 Stunden Beobachtung. 14 Tage sind ein Vergleichsfenster, keine Inkasso- oder Zugangsfrist. Leere Nenner bleiben leer.`,
    query: buildTrialChartQuery("cohorts"),
    display: "ActionsTable",
  },
  {
    key: "trial-cancellations",
    name: "13 · Trial — An welchem Tag wurde gekündigt?",
    description: `${cohortDescription} Erste kundenseitig eingereichte Kündigung pro Trial, innerhalb seiner ursprünglichen Laufzeit. Tag 1 = 0–24h; Tag 3 = 48–72h. Anbieter-Beobachtungen stehen separat, da ihr Zeitpunkt nicht den Kundenwunsch belegt.`,
    query: buildTrialChartQuery("cancellations"),
    display: "ActionsBar",
    x: "trial_tag",
    y: "trials_mit_kuendigungswunsch",
  },
  {
    key: "trial-recovery",
    name: "14 · Trial — Kündigungen, Zahlungsfehler und Rückkehr",
    description: `${cohortDescription} Historische Fakten überschneiden sich: Kündigung, Wiederherstellung und Bezahlung können denselben Trial betreffen. Nicht zu einer Gesamtsumme addieren. Bestätigung ist nicht Zugangsschluss.`,
    query: buildTrialChartQuery("recovery"),
    display: "ActionsBar",
    x: "verlauf",
    y: "trials",
  },
  {
    key: "trial-providers",
    name: "15 · Trial — Stripe und PayPal",
    description: `${cohortDescription} Zahlungsanbieter bei Aktivierung. Bezahlquote ausschließlich mit gleichen 14 Tagen Nachbeobachtung; spätere Anbieterwechsel verändern die ursprüngliche Gruppe nicht.`,
    query: buildTrialChartQuery("providers"),
    display: "ActionsTable",
  },
  {
    key: "offer-content",
    name: "16 · Offer — Beispiel, Video, Produkttour und Kontakt",
    description:
      "Scanner-Angebote im gewählten Zeitraum. Eindeutige Offer-Ansichten plus Rohereignisse, nach Inhalt/Aktion/Platzierung. Karten-Sichtbarkeit (25%, 750ms) ist kein Klick und kein Beweis des Lesens.",
    query: `SELECT event AS ereignis,
concat(ifNull(toString(properties.content_type),''),' · ',ifNull(toString(properties.content_id),''),' · ',ifNull(toString(properties.action),''),' · ',ifNull(toString(properties.placement),'')) AS inhalt,
uniqExact(toString(properties.offer_view_id)) AS offer_views,count() AS events
FROM events WHERE timestamp>={filters.dateRange.from} AND timestamp<={filters.dateRange.to}
AND properties.funnel_package_key='scan_v1'
AND notEmpty(ifNull(toString(properties.offer_view_id),''))
AND lower(ifNull(toString(properties.is_internal_test),'false')) NOT IN ('true','1')
AND ifNull(toString(properties.test_kind),'') NOT IN ('field_test','partner')
AND event IN ('offer_content_interacted','offer_content_viewed')
GROUP BY ereignis,inhalt ORDER BY offer_views DESC LIMIT 40`,
    display: "ActionsBar",
    x: "inhalt",
    y: "offer_views",
  },
]

export function scannerInsightQuery(spec: ScannerInsightSpec) {
  return {
    kind: "DataVisualizationNode",
    source: {
      kind: "HogQLQuery",
      query: spec.query,
      filters: {
        dateRange: { date_from: "-7d", explicitDate: false, excludeIncompletePeriods: false },
      },
    },
    display: spec.display,
    ...(spec.x && spec.y
      ? {
          chartSettings: {
            xAxis: { column: spec.x },
            yAxis: [{ column: spec.y }],
            showLegend: false,
            showNullsAsZero: false,
          },
        }
      : {}),
  }
}

export const scannerBaselineInsights: ScannerInsightSpec[] = baseline.insights.map((spec) => ({
  ...spec,
  id: Number(spec.id),
  display: spec.display as ScannerInsightSpec["display"],
}))

export const scannerInsights: ScannerInsightSpec[] = [
  ...scannerBaselineInsights.map((spec) => {
    if (spec.key === "offer")
      return {
        ...spec,
        description:
          "Offer-Kohorte im Datumsbereich; spätere Meilensteine bis jetzt. Eindeutige Funnel-Sessions, keine strikt geordnete Folge. Trial/Kauf nur mit neuer v1-Telemetrie; ältere Trial-Historie ist unvollständig. Aktivierung ist Zahlungsverifikation, kein Umsatz.",
        query: spec.query
          .replace(
            "AND timestamp <= {filters.dateRange.to} AND timestamp>=offers.opened GROUP BY event",
            "AND timestamp <= now() AND timestamp>=offers.opened AND (event NOT IN ('trial_started','purchase_completed') OR toString(properties.trial_analytics_version)='1') GROUP BY event",
          )
          .replace(
            "'05 Trial aktiviert — Attribution fehlt',NULL",
            "'05 Trial v1 aktiviert',(SELECT sessions FROM counts WHERE event='trial_started')",
          )
          .replace(
            "'06 Kauf — Attribution unvollständig',NULL",
            "'06 Trial v1 erstmals bezahlt',if((SELECT sessions FROM counts WHERE event='trial_started')>0,coalesce((SELECT sessions FROM counts WHERE event='purchase_completed'),0),NULL)",
          ),
      }
    if (spec.key === "cta")
      return {
        ...spec,
        description:
          "Scan-Angebote nach Revision, CTA und Ziel. Klickende Offer-Ansichten plus rohe Klickzahl; keine CTR ohne passende Exposition. Ab der Trial-Analytics-Veröffentlichung enthält pricing_primary auch den Trial-Weiter-Button; ältere Daten sind unvollständig.",
      }
    if (spec.key === "health")
      return {
        ...spec,
        name: "07 · Tracking-Qualität — Historie und Trial-Zuordnung",
        description:
          "Projektweite fehlende Trial-Zuordnung darf nicht dem Scanner zugerechnet werden. Alte Trial-Ereignisse ohne v1 gehören nicht in die neuen Lifecycle-Kohorten. Empfang bei PostHog beweist keinen Empfang bei Meta; CAPI separat prüfen.",
        query: spec.query.replace(
          ") SELECT pruefung,anzahl FROM metrics",
          "\nUNION ALL SELECT 'Projektweit: Trial-Aktivierungen ohne v1-Telemetrie',count() FROM events WHERE timestamp >= {filters.dateRange.from} AND timestamp <= {filters.dateRange.to} AND event='trial_started' AND ifNull(toString(properties.trial_analytics_version),'')!='1'\n) SELECT pruefung,anzahl FROM metrics",
        ),
      }
    return spec
  }),
  ...scannerTrialInsights,
]

export const scannerDashboardDescription =
  "Scanner-Akquisition und Trial-Lebenszyklus. Akquisitions-/Offer-Kacheln: gewählter Ereigniszeitraum. Trial-Kacheln: Aktivierungs-Kohorte im Zeitraum, Folgen bis jetzt (UTC). StartTrial = bestätigte Zahlungsverifikation, 0 €; Purchase = erster bezahlter Zeitraum. 14-Tage-Bezahlquote nur für gleich lang beobachtete Trials. Historische Aktivierungen ohne v1-Telemetrie bleiben außerhalb der Trial-Kohorten; siehe Qualitätskachel. Meta-Empfang separat verifizieren."
