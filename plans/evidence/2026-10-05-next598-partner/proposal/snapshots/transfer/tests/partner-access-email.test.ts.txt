import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPartnerAccountReadyEmail,
  buildPartnerInvitationEmail,
} from "../src/lib/partner-access/email"

test("partner transactional payloads contain only the recipient-facing link and first name", () => {
  assert.deepEqual(
    buildPartnerInvitationEmail({
      name: "Lea",
      email: "lea@example.test",
      url: "https://chaarlie.de/partner/einladung#code=signed",
      transactionalMessageId: 101,
    }),
    {
      to: "lea@example.test",
      transactionalMessageId: 101,
      messageData: {
        first_name: "Lea",
        invitation_url: "https://chaarlie.de/partner/einladung#code=signed",
      },
    },
  )
  assert.deepEqual(
    buildPartnerAccountReadyEmail({
      name: "Lea",
      email: "lea@example.test",
      loginUrl: "https://chaarlie.de/auth",
      transactionalMessageId: 102,
    }),
    {
      to: "lea@example.test",
      transactionalMessageId: 102,
      messageData: { first_name: "Lea", login_url: "https://chaarlie.de/auth" },
    },
  )
})
