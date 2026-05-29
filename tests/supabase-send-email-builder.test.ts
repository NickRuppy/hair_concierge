import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildCustomerIoEmails } from "../supabase/functions/send-email/message-builder"

describe("Supabase auth send-email hook builder", () => {
  it("maps password recovery emails to the Customer.io password_reset template", () => {
    const [email] = buildCustomerIoEmails(
      {
        user: {
          id: "user_123",
          email: "nick@example.com",
        },
        email_data: {
          email_action_type: "recovery",
          token: "123456",
          token_hash: "hashed-recovery-token",
          redirect_to: "https://chaarlie.de/account",
        },
      },
      { siteUrl: "https://chaarlie.de" },
    )

    assert.equal(email.transactional_message_id, "password_reset")
    assert.equal(email.to, "nick@example.com")
    assert.equal(email.message_data.email_action_type, "recovery")
    assert.match(email.message_data.action_url, /type=recovery/)
    assert.equal(email.message_data.reset_url, email.message_data.action_url)
    assert.match(email.message_data.action_url, /next=%2Fauth%2Fupdate-password/)
  })

  it("keeps magic links on the Customer.io magic_link template", () => {
    const [email] = buildCustomerIoEmails(
      {
        user: {
          id: "user_123",
          email: "nick@example.com",
        },
        email_data: {
          email_action_type: "magiclink",
          token: "123456",
          token_hash: "hashed-magic-token",
          redirect_to: "https://chaarlie.de/chat",
        },
      },
      { siteUrl: "https://chaarlie.de" },
    )

    assert.equal(email.transactional_message_id, "magic_link")
    assert.equal(email.message_data.email_action_type, "magiclink")
    assert.match(email.message_data.action_url, /type=magiclink/)
    assert.equal(email.message_data.magic_link_url, email.message_data.action_url)
  })
})
