import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

function read(path: string) {
  return readFileSync(path, "utf8")
}

test("personal-plan quiz entry is exact-true gated without changing other funnel packages", () => {
  const flags = read("src/lib/funnel/flags.ts")
  const landing = read("src/app/lp/[slug]/page.tsx")

  assert.match(flags, /process\.env\.PERSONAL_PLAN_QUIZ_V1_ENABLED === "true"/)
  assert.match(
    landing,
    /funnelPackage\.key === "meta_personal_plan_v1" && !isPersonalPlanQuizV1Enabled\(\)/,
  )
  assert.match(landing, /<LandingTracking \/>/)
})

test("personal-plan offer placeholder remains local and gated", () => {
  const offer = read("src/app/lp/[slug]/angebot/page.tsx")

  assert.match(offer, /metadata = PRIVATE_PAGE_METADATA/)
  assert.match(offer, /funnelPackage\?\.key !== "meta_personal_plan_v1"/)
  assert.match(offer, /!isPersonalPlanQuizV1Enabled\(\)/)
  assert.match(offer, /Diese Seite wird gerade vorbereitet/)
  assert.doesNotMatch(offer, /fetch\(|axios|supabase|\bcheckout\b|\/api\//i)
})

test("personal-plan quiz prepares the plan, saves V2 answers, and uses the canonical result route", () => {
  const landing = read("src/funnels/landing/personal-plan-quiz.tsx")
  const quiz = read("src/components/personal-plan-quiz/personal-plan-quiz.tsx")
  const api = read("src/app/api/quiz/personal-plan-lead/route.ts")

  assert.match(landing, /<PersonalPlanQuiz \/>/)
  assert.match(quiz, /fetch\("\/api\/quiz\/personal-plan-prepare"/)
  assert.match(quiz, /artifactId/)
  assert.match(quiz, /claimToken/)
  assert.match(quiz, /fetch\("\/api\/quiz\/personal-plan-lead"/)
  assert.match(quiz, /email: email\.trim\(\)/)
  assert.match(quiz, /marketingConsent/)
  assert.match(quiz, /funnelEventId: funnelEventIdRef\.current/)
  assert.match(quiz, /preparedPlan/)
  assert.match(quiz, /response\.status === 409/)
  assert.match(quiz, /setPreparedPlan\(\{ status: "idle", claim: null, error: null \}\)/)
  assert.match(quiz, /response\.json\(\)/)
  assert.match(quiz, /router\.push\(`\/result\/\$\{leadId\}\?entry=quiz_completion`\)/)
  assert.doesNotMatch(quiz, /router\.prefetch/)
  assert.match(quiz, /clearPersonalPlanQuizDraft/)
  assert.match(quiz, /Deine Auswertung konnte gerade nicht gespeichert werden/)
  assert.match(api, /isPersonalPlanQuizV1Enabled\(\)/)
  assert.match(api, /status: 404/)
})

test("personal-plan quiz uses approved consent and milestone ownership", () => {
  const quiz = read("src/components/personal-plan-quiz/personal-plan-quiz.tsx")

  assert.match(quiz, /recordBrowserFunnelMilestone\("quiz_started"\)/)
  assert.match(quiz, /quizStartedRef\.current = true/)
  assert.match(quiz, /Ja, weiter zu meiner Auswertung/)
  assert.match(quiz, /Nein, nur meine Auswertung schicken/)
  assert.doesNotMatch(quiz, /trackAppEvent\("quiz_started"/)
  assert.doesNotMatch(quiz, /quiz_lead_captured/)
})

test("personal-plan quiz tracks semantic screen views without answer payloads", () => {
  const quiz = read("src/components/personal-plan-quiz/personal-plan-quiz.tsx")

  assert.match(quiz, /trackAppEvent\("personal_plan_quiz_screen_viewed"/)
  assert.match(quiz, /quizVersion: "v2"/)
  assert.match(quiz, /screenId: screen/)
  assert.match(quiz, /sectionId: getPersonalPlanQuizSectionId\(screen\)/)
  assert.doesNotMatch(quiz, /personal_plan_quiz_screen_viewed[\s\S]{0,240}answers/)
  assert.doesNotMatch(quiz, /personal_plan_quiz_screen_viewed[\s\S]{0,240}email/)
})

test("personal-plan quiz UI reflects the approved visual journey constraints", () => {
  const quiz = read("src/components/personal-plan-quiz/personal-plan-quiz.tsx")
  const data = read("src/components/personal-plan-quiz/quiz-data.ts")

  assert.match(quiz, /SECTION_LABELS/)
  // R003: the section/checkpoint progress stays free of numbers. The preparation
  // LoadingScreen bar intentionally shows a live percentage (Nick, 2026-07-29).
  assert.doesNotMatch(quiz, /Schritt \d+ von|SECTION_LABELS[\s\S]{0,400}Math\.round/)
  assert.match(quiz, /Math\.round\(progress\)/)
  assert.match(quiz, /config\.multi \? \(/)
  assert.match(data, /Feuchtigkeit ohne Beschweren/)
  assert.match(data, /Weniger Haarbruch und bessere Längenretention/)
  assert.match(quiz, /Nichts davon/)
  assert.doesNotMatch(data, /value: "none", label: "Nichts davon"/)
  assert.match(quiz, /Persönliche Haaranalyse für deinen Haarpflegeplan/)
  assert.match(quiz, /Um dich wohlzufühlen mit gesundem und schönem Haar/)
  assert.match(quiz, /4\.000\+[\s\S]*Antworten aus unserer Haarpflege-Umfrage/)
  assert.match(data, /L\. · Chaarlie-Kundin/)
  assert.match(
    quiz,
    /Hast du schon Zeit oder Geld investiert, ohne verlässlich bessere Ergebnisse zu sehen\?/,
  )
  assert.match(quiz, /Wie wichtig ist es dir, dich mit deinem Haar wirklich wohlzufühlen\?/)
  assert.match(quiz, /Sehr wichtig/)
  assert.match(quiz, /rounded-b-none rounded-t-2xl/)
  assert.match(quiz, /window\.scrollTo\(0, 0\)/)
  assert.match(data, /visualLayout: "thumbnail"/)
  assert.match(data, /contextImage: `\$\{PERSONAL_PLAN_ASSET_BASE\}\/recognition-mirror\.webp`/)
  assert.doesNotMatch(quiz + data, /washCadence|heatExposure|heatProtection|weeklyTime/)
  assert.doesNotMatch(quiz + data, /ABKLÄRUNG|hasPersonalPlanSafetySignal|safetySignals/)
})

test("personal-plan provisional production assets exist under the public funnel path", () => {
  for (const asset of [
    "recognition-mirror.webp",
    "returning-concern.webp",
    "daily-commitment.webp",
    "causal-reframe.webp",
    "texture-straight.webp",
    "texture-wavy.webp",
    "texture-curly.webp",
    "texture-coily.webp",
    "thickness-fine.webp",
    "thickness-normal.webp",
    "thickness-coarse.webp",
  ]) {
    assert.equal(existsSync(`public/images/funnels/personal-plan-quiz/${asset}`), true, asset)
  }
})
