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

test("personal-plan quiz prepares the plan, saves V2 answers, and enters the result reveal", () => {
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
  assert.match(quiz, /router\.push\(`\/result\/\$\{leadId\}\/reveal`\)/)
  assert.doesNotMatch(quiz, /router\.prefetch/)
  assert.match(quiz, /clearPersonalPlanQuizDraft/)
  assert.match(quiz, /Deine Auswertung konnte gerade nicht gespeichert werden/)
  assert.match(api, /isPersonalPlanQuizV1Enabled\(\)/)
  assert.match(api, /status: 404/)
})

test("personal-plan result reveal owns future pacing but not offer-view tracking", () => {
  const page = read("src/app/result/[leadId]/reveal/page.tsx")
  const reveal = read("src/app/result/[leadId]/reveal/personal-plan-result-reveal.tsx")

  assert.match(page, /robots:[\s\S]*index: false,[\s\S]*follow: false/)
  assert.match(page, /export const dynamic = "force-dynamic"/)
  assert.match(page, /\.from\("leads"\)/)
  assert.match(page, /\.eq\("quiz_kind", "personal_plan"\)/)
  assert.match(page, /if \(error \|\| !data\) notFound\(\)/)
  assert.match(page, /\.from\("personal_plan_prepared_artifacts"\)/)
  assert.match(page, /\.eq\("status", "attached"\)/)
  assert.match(page, /if \(artifactError \|\| !artifact\)/)
  assert.match(reveal, /buildPersonalPlanResultRevealMessages/)
  assert.match(reveal, /schedulePersonalPlanResultReveal/)
  assert.match(reveal, /claimPersonalPlanResultRevealCompletion/)
  assert.match(reveal, /Überspringen/)
  assert.match(reveal, /Deine Auswertung wird geöffnet/)
  assert.match(reveal, /trackAppEvent\("personal_plan_result_reveal_step_viewed"/)
  assert.match(reveal, /trackAppEvent\(\s*"personal_plan_result_reveal_completed"/)
  assert.match(reveal, /openResult\("timer", messages\.length\)/)
  assert.match(reveal, /openResult\("skip_button", storyIndex \+ 1\)/)
  assert.match(reveal, /router\.replace\(resultPath\)/)
  assert.doesNotMatch(page + reveal, /offer_viewed/)
})

test("personal-plan quiz uses approved consent and milestone ownership", () => {
  const quiz = read("src/components/personal-plan-quiz/personal-plan-quiz.tsx")

  assert.match(quiz, /recordBrowserFunnelMilestone\(\s*"quiz_started"/)
  assert.match(quiz, /quizStartedRef\.current = true/)
  assert.match(quiz, /Ja, weiter zu meiner Auswertung/)
  assert.match(quiz, /Nein, nur meine Auswertung schicken/)
  assert.match(quiz, /trackAppEvent\("quiz_started"/)
  assert.match(quiz, /stepName: "personal_plan_texture"/)
  assert.match(quiz, /trackAppEvent\("quiz_completed"/)
  assert.match(quiz, /trackAppEvent\("quiz_lead_captured"/)
  assert.match(quiz, /funnelEventId: funnelEventIdRef\.current/)
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
  assert.match(quiz, /SECTION_LABELS\.map/)
  assert.match(quiz, /currentSectionIndex/)
  assert.match(quiz, /data-layout="progress-track-with-dots"/)
  assert.match(quiz, /data-layout="progress-dot-overlay"/)
  assert.match(quiz, /absolute inset-0 grid grid-cols-5/)
  // R003: the section/checkpoint progress stays free of numbers. The preparation
  // LoadingScreen bar intentionally shows a live percentage (Nick, 2026-07-29).
  assert.doesNotMatch(quiz, /Schritt \d+ von|SECTION_LABELS[\s\S]{0,400}Math\.round/)
  assert.match(quiz, /Math\.round\(progress\)/)
  assert.match(quiz, /config\.multi \? \(/)
  assert.match(data, /Feuchtigkeit ohne Beschweren/)
  assert.match(data, /Weniger Haarbruch und bessere Längenretention/)
  assert.match(quiz, /Nichts davon/)
  assert.doesNotMatch(data, /value: "none", label: "Nichts davon"/)
  assert.match(quiz, /Welche Haarstruktur hast du\?/)
  assert.doesNotMatch(quiz, /Persönliche Haaranalyse für deinen Haarpflegeplan/)
  assert.doesNotMatch(quiz, /Um dich wohlzufühlen mit gesundem und schönem Haar/)
  assert.match(quiz, /4\.000\+[\s\S]*Antworten aus unserer Haarpflege-Umfrage/)
  assert.match(data, /L\. · Chaarlie-Kundin/)
  assert.match(quiz, /Hat dich Haarpflege schon Zeit oder Geld gekostet\?/)
  assert.match(quiz, /Wie wichtig ist dir dein Haargefühl\?/)
  assert.match(quiz, /Sehr wichtig/)
  assert.match(quiz, /rounded-b-none rounded-t-2xl/)
  assert.match(quiz, /window\.scrollTo\(0, 0\)/)
  assert.doesNotMatch(quiz, /bg-\[#edf8ef\]|bg-\[#e7f3e9\] px-4 py-2/)
  assert.match(data, /visualLayout: "thumbnail"/)
  assert.match(quiz, /visualLayout: "grid"/)
  assert.match(quiz, /grid-cols-2 auto-rows-fr/)
  assert.match(quiz, /config\.options\.map\(\(option, optionIndex\) =>/)
  assert.match(quiz, /priority=\{config\.field === "texture" && optionIndex === 0\}/)
  assert.match(quiz, /fetchPriority=\{priority \? "high" : "auto"\}/)
  assert.match(quiz, /\? "\(max-width: 640px\) 45vw, 320px"/)
  assert.match(quiz, /ausgewählt · Weiter/)
  assert.match(quiz, /min-h-\[calc\(100dvh-84px\)\]/)
  assert.match(quiz, /max-height:700px/)
  assert.match(quiz, /const MIDPOINT_REVEAL_MS = 350/)
  assert.match(quiz, /const MIDPOINT_CHECK_DELAY_MS = 500/)
  assert.match(quiz, /const MIDPOINT_HOLD_MS = 2400/)
  assert.match(quiz, /sm:min-h-24 sm:items-start/)
  assert.match(quiz, /imageVariant="portrait"/)
  assert.doesNotMatch(quiz, /imageFit|bg-\[#d4b69c\]/)
  assert.match(quiz, /data-layout="midpoint-fit"/)
  assert.match(quiz, /data-layout="reframe-copy-image-closing"/)
  assert.match(quiz, /data-layout="profile-summary-2x2"/)
  assert.match(quiz, /data-layout="profile-summary-image"/)
  assert.match(quiz, /getProfileSummaryImage\(answers\.texture, answers\.hairLength\)/)
  assert.match(quiz, /aspect-\[2\/1\]/)
  assert.match(quiz, /grid grid-cols-2 gap-1\.5/)
  assert.match(quiz, /objectPosition: "50% 8%"/)
  assert.match(data, /contextImage: `\$\{PERSONAL_PLAN_ASSET_BASE\}\/recognition-mirror\.webp`/)
  assert.match(data, /an einem einzelnen ausgefallenen Haar/)
  assert.doesNotMatch(data, /value: "unknown", label: "Ich bin mir nicht sicher"/)
  assert.doesNotMatch(quiz + data, /washCadence|heatExposure|heatProtection|weeklyTime/)
  assert.doesNotMatch(quiz + data, /ABKLÄRUNG|hasPersonalPlanSafetySignal|safetySignals/)
})

test("personal-plan email capture supports one semantic keyboard and CTA submit path", () => {
  const quiz = read("src/components/personal-plan-quiz/personal-plan-quiz.tsx")

  assert.match(quiz, /<form[\s\S]{0,160}noValidate/)
  assert.match(quiz, /onSubmit=\{\(event\) => \{[\s\S]{0,160}event\.preventDefault\(\)/)
  assert.match(quiz, /onSubmit=\{\(event\) => \{[\s\S]{0,220}continueToConsent\(\)/)
  assert.match(quiz, /enterKeyHint="go"/)
  assert.match(quiz, /type="submit"[\s\S]{0,120}>[\s\S]{0,80}Weiter zu meiner Auswertung/)
  assert.doesNotMatch(quiz, /onClick=\{continueToConsent\}/)
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

test("personal-plan profile summary has a complete texture and length image matrix", () => {
  const textures = ["straight", "wavy", "curly", "coily"]
  const lengths = ["very-short", "short", "medium", "long", "very-long"]

  for (const texture of textures) {
    for (const length of lengths) {
      const asset = `public/images/funnels/personal-plan-quiz/profile-summary/${texture}-${length}.webp`
      assert.equal(existsSync(asset), true, asset)
    }
  }
})
