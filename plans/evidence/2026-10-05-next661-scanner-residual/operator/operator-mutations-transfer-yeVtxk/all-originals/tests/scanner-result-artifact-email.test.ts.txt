import assert from "node:assert/strict"
import test from "node:test"

import {
  SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV,
  buildScannerResultArtifactEmailPayload,
} from "../src/lib/customerio/scanner-result-artifact"

function restoreMessageIdEnv(previous: string | undefined) {
  if (previous === undefined) delete process.env[SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  else process.env[SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV] = previous
}

test("builds the dedicated scanner transactional payload without organic focus or caller package", () => {
  const previous = process.env[SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  process.env[SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV] = "18"

  try {
    const payload = buildScannerResultArtifactEmailPayload({
      leadId: "lead/with spaces",
      email: "lea@example.com",
      siteUrl: "https://chaarlie.de",
    })

    assert.equal(payload.to, "lea@example.com")
    assert.equal(payload.transactionalMessageId, 18)
    assert.deepEqual(payload.messageData, {
      lead_id: "lead/with spaces",
      result_url: "https://chaarlie.de/result/lead%2Fwith%20spaces?entry=result_email",
    })
  } finally {
    restoreMessageIdEnv(previous)
  }
})

test("requires an explicit scanner message id instead of falling back to the organic template", () => {
  const previous = process.env[SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  delete process.env[SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV]

  try {
    assert.throws(
      () =>
        buildScannerResultArtifactEmailPayload({
          leadId: "lead-1",
          email: "lea@example.com",
          siteUrl: "https://chaarlie.de",
        }),
      /CUSTOMERIO_SCANNER_RESULT_TRANSACTIONAL_MESSAGE_ID/,
    )
  } finally {
    restoreMessageIdEnv(previous)
  }
})
