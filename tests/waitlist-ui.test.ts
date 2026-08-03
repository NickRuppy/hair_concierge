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
  assert.match(form, /WAITLIST_SURVEY_TOKEN_STORAGE_KEY/)
  assert.doesNotMatch(form, /sessionStorage\.setItem\([^)]*email/)
  assert.match(survey, /opaqueToken, responseId/)
  assert.match(survey, /Umfrage überspringen/)
  assert.match(survey, /waitlist_survey_completed/)
  assert.match(survey, /if \(!response\.ok\) throw/)
  assert.match(survey, /save-error/)
  assert.match(survey, /Zuordnung erneut versuchen/)
  assert.match(survey, /setPendingResponseId\(responseId\)/)
  assert.match(layout, /WaitlistTrackingProvider/)
})

test("waitlist pages remain noindex and WhatsApp has an email fallback", () => {
  const entry = read("src/app/warteliste/page.tsx")
  const thanks = read("src/app/warteliste/danke/page.tsx")
  const shell = read("src/components/waitlist/waitlist-shell.tsx")

  assert.match(entry, /index: false, follow: false/)
  assert.match(thanks, /index: false, follow: false/)
  assert.match(thanks, /Per E-Mail\s+bekommst du alles ebenfalls/)
  assert.match(thanks, /LAUNCH_CLOSE_LABEL/)
  assert.match(thanks, /whatsapp-community-qr\.png/)
  assert.match(shell, /Impressum/)
  assert.match(shell, /Datenschutz/)
  assert.match(shell, /AGB/)
  assert.doesNotMatch(shell, /SiteFooter/)
})
