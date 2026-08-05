import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("waitlist UI preserves the standalone conversion and privacy boundaries", () => {
  const form = read("src/components/waitlist/waitlist-form.tsx")
  const survey = read("src/components/waitlist/waitlist-survey.tsx")
  const layout = read("src/app/warteliste/layout.tsx")

  assert.match(form, /marketingConsent: true/)
  assert.match(form, /attribution: readWaitlistAttribution\(\)/)
  assert.match(form, /const metaEventId = crypto\.randomUUID\(\)/)
  assert.match(form, /if \(body\.duplicate === false\)/)
  assert.match(form, /trackMetaWaitlistLeadCaptured\(metaEventId\)/)
  assert.match(form, /WAITLIST_SURVEY_TOKEN_STORAGE_KEY/)
  assert.doesNotMatch(form, /sessionStorage\.setItem\([^)]*email/)
  assert.match(survey, /opaqueToken, responseId/)
  assert.doesNotMatch(survey, /Umfrage überspringen/)
  assert.match(survey, /waitlist_survey_completed/)
  assert.match(survey, /if \(!response\.ok\) throw/)
  assert.match(survey, /save-error/)
  assert.match(survey, /Zuordnung erneut versuchen/)
  assert.match(survey, /Bei technischem Problem weiter/)
  assert.match(survey, /setPendingResponseId\(responseId\)/)
  assert.match(survey, /metaCompletionTracked/)
  assert.match(survey, /trackMetaWaitlistSurveyCompleted\(crypto\.randomUUID\(\)\)/)
  assert.match(layout, /WaitlistTrackingProvider/)
})

test("waitlist pages use the agreed final-step framing and preserve recovery", () => {
  const entry = read("src/app/warteliste/page.tsx")
  const surveyPage = read("src/app/warteliste/umfrage/page.tsx")
  const thanks = read("src/app/warteliste/danke/page.tsx")
  const progress = read("src/components/waitlist/waitlist-progress.tsx")
  const whatsappCta = read("src/components/waitlist/whatsapp-cta.tsx")
  const shell = read("src/components/waitlist/waitlist-shell.tsx")

  assert.match(entry, /index: false, follow: false/)
  assert.match(surveyPage, /WaitlistProgress percent=\{67\} label="Fast geschafft"/)
  assert.match(surveyPage, /Dein Platz ist fast gesichert/)
  assert.match(surveyPage, /Dauert weniger als 60 Sekunden/)
  assert.match(surveyPage, /href="\/warteliste\/danke"/)
  assert.match(thanks, /index: false, follow: false/)
  assert.match(thanks, /WaitlistProgress label="Letzter Schritt" percent=\{95\}/)
  assert.match(thanks, /Tritt der WhatsApp-Community bei/)
  assert.doesNotMatch(thanks, /Optional/)
  assert.doesNotMatch(thanks, />\s*Geschafft\s*</)
  assert.doesNotMatch(thanks, />\s*Du bist drin\.\s*</)
  assert.match(thanks, /Per E-Mail bekommst du es auch, nur später/)
  assert.match(thanks, /LAUNCH_CLOSE_LABEL/)
  assert.match(thanks, /whatsapp-community-qr\.png/)
  assert.match(progress, /role="progressbar"/)
  assert.match(whatsappCta, /<svg/)
  assert.match(whatsappCta, /waitlist_whatsapp_clicked/)
  assert.match(shell, /Impressum/)
  assert.match(shell, /Datenschutz/)
  assert.match(shell, /AGB/)
  assert.doesNotMatch(shell, /SiteFooter/)
})

test("quiz-gate signup tracks exactly one Lead only for a new token-bearing waitlist signup", () => {
  const modal = read("src/components/waitlist/quiz-gate-modal.tsx")

  assert.match(modal, /fetch\("\/api\/waitlist"/)
  assert.match(modal, /attribution: readWaitlistAttribution\(\)/)
  assert.match(modal, /const metaEventId = crypto\.randomUUID\(\)/)
  assert.match(
    modal,
    /if \(body\.duplicate === false\) trackMetaQuizGateLeadCaptured\(metaEventId\)/,
  )
  assert.match(
    modal,
    /if \(body\.duplicate !== false \|\| body\.surveyAlreadyCompleted \|\| !body\.surveyToken\) \{\s*return router\.push\("\/warteliste\/danke"\)/,
  )
  assert.match(
    modal,
    /sessionStorage\.setItem\(WAITLIST_SURVEY_TOKEN_STORAGE_KEY, body\.surveyToken\)/,
  )
  assert.match(modal, /router\.push\("\/warteliste\/umfrage"\)/)
  assert.doesNotMatch(modal, /trackMetaWaitlistLeadCaptured/)
})
