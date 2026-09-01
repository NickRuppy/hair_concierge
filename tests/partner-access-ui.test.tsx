import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { PartnerInvitationCard } from "../src/app/partner/einladung/partner-invitation-client"

test("creator invitation keeps the approved concise identity and account-creation copy", () => {
  const html = renderToStaticMarkup(
    <PartnerInvitationCard
      email="lea@example.test"
      mode="ready"
      name="Lea"
      onChangeEmail={() => {}}
      onContinue={() => {}}
    />,
  )
  assert.match(html, /Hi Lea, dein Zugang ist bereit\./)
  assert.match(html, /lea@example\.test/)
  assert.match(html, /Nicht deine E-Mail\? Ändern/)
  assert.match(html, /Los geht’s/)
  assert.match(html, /Damit erstellst du dein Chaarlie Konto mit dieser E-Mail\./)
  assert.doesNotMatch(html, /Abo|Zahlung|lebenslang|Produkttest|kostenlos/i)
})

test("creator invitation greets a full-name account by first name", () => {
  const html = renderToStaticMarkup(
    <PartnerInvitationCard email="lea@example.test" mode="ready" name="Lea Sommer" />,
  )
  assert.match(html, /Hi Lea, dein Zugang ist bereit\./)
  assert.doesNotMatch(html, /Hi Lea Sommer/)
})

test("email correction stays inline and short", () => {
  const html = renderToStaticMarkup(
    <PartnerInvitationCard
      email="lea@example.test"
      mode="change_email"
      name="Lea"
      onCancel={() => {}}
      onSubmitEmail={() => {}}
    />,
  )
  assert.match(html, /E-Mail ändern/)
  assert.match(html, /Wir senden dir einen Bestätigungslink\./)
  assert.match(html, /Bestätigungslink senden/)
  assert.match(html, /Abbrechen/)
})
