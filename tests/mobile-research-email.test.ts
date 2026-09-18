import assert from "node:assert/strict"
import test from "node:test"
import { buildMobileResearchEmail, mobileResearchResultURL } from "@/lib/mobile/research-email"
import { renderCustomerIoTriggerTemplate } from "./helpers/customerio-liquid"

const submissionId = "33333333-3333-4333-8333-333333333333"

test("research email links to the neutral iPhone-first page, not web scanner results", () => {
  const payload = buildMobileResearchEmail({
    email: "user@example.com",
    submissionId,
    messageId: "native-research-test",
  })
  assert.equal(payload.to, "user@example.com")
  assert.equal(payload.transactionalMessageId, "native-research-test")
  assert.equal(payload.messageData.result_url, `https://chaarlie.de/app/research/${submissionId}`)
  assert.equal(payload.inlineContent?.tracked, false)
  assert.equal(payload.inlineContent?.autoCreate, false)
  assert.match(payload.inlineContent?.htmlBody ?? "", /trigger\.result_url \| htmlencode/)
  assert.doesNotMatch(JSON.stringify(payload), /\/result\//)
  assert.doesNotMatch(JSON.stringify(payload), /verdict|hair_profile|product_name/)
  const html = renderCustomerIoTriggerTemplate(
    payload.inlineContent?.htmlBody ?? "",
    payload.messageData,
  )
  const plain = renderCustomerIoTriggerTemplate(
    payload.inlineContent?.textBody ?? "",
    payload.messageData,
  )
  assert.match(html, new RegExp(`href="https://chaarlie\\.de/app/research/${submissionId}"`))
  assert.match(html, /In der App öffnen|Einschätzung öffnen/)
  assert.match(plain, /Am Computer\? Öffne diese E-Mail auf deinem iPhone\./)
  assert.match(plain, new RegExp(`https://chaarlie\\.de/app/research/${submissionId}`))
})

test("research link requires an opaque UUID and a trusted HTTPS origin", () => {
  assert.equal(
    mobileResearchResultURL(submissionId, "https://chaarlie.de"),
    `https://chaarlie.de/app/research/${submissionId}`,
  )
  assert.throws(() => mobileResearchResultURL("../profile", "https://chaarlie.de"))
  assert.throws(() => mobileResearchResultURL(submissionId, "http://chaarlie.de"))
  assert.throws(() => mobileResearchResultURL(submissionId, "https://evil.example/path"))
})
