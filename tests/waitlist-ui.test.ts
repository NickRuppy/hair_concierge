import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("historic waitlist survey preserves recovery and completion tracking", () => {
  const survey = read("src/components/waitlist/waitlist-survey.tsx")
  const layout = read("src/app/warteliste/layout.tsx")

  assert.match(survey, /opaqueToken \? \{ opaqueToken \} : \{\}\), responseId/)
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
  assert.match(thanks, /WaitlistProgress label="Letzter Schritt" percent=\{97\}/)
  assert.match(thanks, /Bestätige jetzt deinen Platz in der WhatsApp-Gruppe/)
  assert.match(thanks, /Dein Platz ist noch nicht bestätigt/)
  assert.match(thanks, /Wer die Öffnung\s+verpasst, muss wieder warten/)
  assert.doesNotMatch(thanks, /Optional/)
  assert.doesNotMatch(thanks, />\s*Geschafft\s*</)
  assert.doesNotMatch(thanks, />\s*Du bist drin\.\s*</)
  assert.doesNotMatch(thanks, /Per E-Mail bekommst du es auch/)
  assert.doesNotMatch(thanks, /Gründungspreis/)
  assert.match(thanks, /whatsapp-community-qr\.png/)
  assert.match(progress, /role="progressbar"/)
  assert.match(whatsappCta, /<svg/)
  assert.match(whatsappCta, /waitlist_whatsapp_clicked/)
  assert.match(shell, /Impressum/)
  assert.match(shell, /Datenschutz/)
  assert.match(shell, /AGB/)
  assert.doesNotMatch(shell, /SiteFooter/)
})

test("waitlist entry retires new registration without changing historic survey recovery routes", () => {
  const entry = read("src/app/warteliste/page.tsx")
  const legacyEntry = read("src/app/warteliste/b/page.tsx")
  const surveyPage = read("src/app/warteliste/umfrage/page.tsx")
  const thanks = read("src/app/warteliste/danke/page.tsx")

  assert.match(entry, /Die Anmeldung zur Warteliste ist geschlossen\./)
  assert.doesNotMatch(entry, /<WaitlistForm/)
  assert.match(legacyEntry, /WaitlistPage/)
  assert.match(surveyPage, /WaitlistSurvey/)
  assert.match(thanks, /WaitlistProgress/)
})
