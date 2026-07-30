import { personalPlanOfferDashboard } from "./personal-plan-offer-dashboard"

const offerRevision = "personal_plan_v3"
const v2Revision = "personal_plan_v2"

function replaceRevision(value: string) {
  if (!value.includes(v2Revision)) {
    throw new Error(`Expected the frozen v2 dashboard declaration to contain ${v2Revision}.`)
  }
  return value.replaceAll(v2Revision, offerRevision)
}

function replaceRevisionIfPresent(value: string) {
  return value.replaceAll(v2Revision, offerRevision)
}

function replaceExact(value: string, before: string, after: string) {
  if (!value.includes(before)) {
    throw new Error("Frozen v2 O2 order drifted; refusing to derive the v3 declaration.")
  }
  return value.replace(before, after)
}

const v2Steps = `  SELECT 1 AS sort, '01 Einstieg' AS abschnitt, uniqIf(session_id, event = 'offer_viewed') AS sessions FROM journey_events
  UNION ALL SELECT 2, '02 Persönliche Diagnose', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_diagnosis') FROM journey_events
  UNION ALL SELECT 3, '03 Vollständiger Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_complete_plan') FROM journey_events
  UNION ALL SELECT 4, '04 So funktioniert der Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_method') FROM journey_events
  UNION ALL SELECT 5, '05 Vorher und nachher', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_before_after') FROM journey_events
  UNION ALL SELECT 6, '06 Preis & Mitgliedschaft', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'pricing') FROM journey_events
  UNION ALL SELECT 7, '07 Umfrage-Beleg', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_survey') FROM journey_events
  UNION ALL SELECT 8, '08 Erfahrungen', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'testimonials') FROM journey_events
  UNION ALL SELECT 9, '09 Garantie', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'guarantee') FROM journey_events
  UNION ALL SELECT 10, '10 FAQ', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'faq') FROM journey_events
  UNION ALL SELECT 11, '11 Finaler CTA', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'final_cta') FROM journey_events`

const v3Steps = `  SELECT 1 AS sort, '01 Einstieg' AS abschnitt, uniqIf(session_id, event = 'offer_viewed') AS sessions FROM journey_events
  UNION ALL SELECT 2, '02 Persönliche Diagnose', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_diagnosis') FROM journey_events
  UNION ALL SELECT 3, '03 Preis & Mitgliedschaft', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'pricing') FROM journey_events
  UNION ALL SELECT 4, '04 Vollständiger Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_complete_plan') FROM journey_events
  UNION ALL SELECT 5, '05 So funktioniert der Plan', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_method') FROM journey_events
  UNION ALL SELECT 6, '06 Vorher und nachher', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_before_after') FROM journey_events
  UNION ALL SELECT 7, '07 Umfrage-Beleg', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'personal_plan_survey') FROM journey_events
  UNION ALL SELECT 8, '08 Erfahrungen', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'testimonials') FROM journey_events
  UNION ALL SELECT 9, '09 Garantie', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'guarantee') FROM journey_events
  UNION ALL SELECT 10, '10 FAQ', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'faq') FROM journey_events
  UNION ALL SELECT 11, '11 Finaler CTA', uniqIf(session_id, event = 'offer_section_viewed' AND section_id = 'final_cta') FROM journey_events`

function revision3Insight<T extends { description: string; query: string }>(
  insight: T,
  transformQuery: (query: string) => string = (query) => query,
): T {
  return {
    ...insight,
    description: replaceRevisionIfPresent(insight.description),
    query: transformQuery(replaceRevision(insight.query)),
  }
}

export const personalPlanOfferV3Dashboard = {
  ...personalPlanOfferDashboard,
  offerRevision,
  insights: {
    o1: revision3Insight(personalPlanOfferDashboard.insights.o1),
    o2: revision3Insight(personalPlanOfferDashboard.insights.o2, (query) =>
      replaceExact(query, v2Steps, v3Steps),
    ),
    o3: revision3Insight(personalPlanOfferDashboard.insights.o3),
    o5: revision3Insight(personalPlanOfferDashboard.insights.o5),
    o6: revision3Insight(personalPlanOfferDashboard.insights.o6),
  },
} as const
