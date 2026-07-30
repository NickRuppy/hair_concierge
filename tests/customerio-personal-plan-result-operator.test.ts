import assert from "node:assert/strict"
import test from "node:test"

import {
  CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG,
  assertPersonalPlanMessage,
  assertPersonalPlanTemplate,
  parsePersonalPlanEmailOptions,
} from "../scripts/customerio-personal-plan-result-email"

test("personal-plan Customer.io operator is pinned to the new inactive copy", () => {
  const config = CUSTOMERIO_PERSONAL_PLAN_RESULT_EMAIL_CONFIG
  assert.deepEqual(
    parsePersonalPlanEmailOptions([
      "--environment-id",
      "219516",
      "--message-id",
      "9",
      "--template-id",
      "76",
    ]),
    { environmentId: 219516, messageId: 9, templateId: 76, apply: false },
  )
  assert.equal(config.sourceMessageId, 8)
  assert.equal(config.sourceTemplateId, 41)
  assert.notEqual(config.messageId, 7)
  assert.notEqual(config.templateId, 40)
  assert.throws(
    () =>
      parsePersonalPlanEmailOptions([
        "--environment-id",
        "219516",
        "--message-id",
        "7",
        "--template-id",
        "40",
      ]),
    /219516\/9\/76/,
  )
})

test("operator requires inactive unsent email settings and exact pairing", () => {
  const message = {
    id: 9,
    name: "[Copy] [Copy] quiz_result_artifact",
    state: "draft" as const,
    template_id: 76,
    type: "email",
    link_tracking: true,
    send_to_unsubscribed: true,
    hide_message_body: false,
    has_sent_message: false,
  }
  assert.doesNotThrow(() => assertPersonalPlanMessage(message))
  assert.throws(() => assertPersonalPlanMessage({ ...message, state: "active" }), /settings check/)
  assert.throws(
    () => assertPersonalPlanMessage({ ...message, link_tracking: false }),
    /settings check/,
  )
  assert.doesNotThrow(() =>
    assertPersonalPlanTemplate({
      id: 76,
      transactional_message_id: 9,
      layout_id: 1,
      name: "[Copy] [Copy] quiz_result_artifact",
    }),
  )
})
