import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAgentV2ProductToolMessage,
  isReferentialProductFollowup,
} from "../src/lib/agent-v2/compare/product-tool-context"
import { inferOilPurposeFromMessage } from "../src/lib/oil/purpose"

test("direct product messages are passed through unchanged", () => {
  const latestMessage = "Welches Öl passt für Glanz und Frizz?"

  assert.equal(
    buildAgentV2ProductToolMessage({
      latestMessage,
      recentMessages: [
        { role: "user", content: "Ich suche etwas für die Längen." },
        { role: "assistant", content: "Dann schauen wir auf Finish-Produkte." },
      ],
    }),
    latestMessage,
  )
})

test("direct asks with a named object stay unchanged even with referential wording", () => {
  const latestMessage = "Welches Tiefenreinigungsshampoo passt dann?"

  assert.equal(
    buildAgentV2ProductToolMessage({
      latestMessage,
      recentMessages: [
        { role: "user", content: "Ich habe vorher nach Öl für Glanz gefragt." },
        { role: "assistant", content: "Dann schauen wir auf Finish-Produkte." },
      ],
    }),
    latestMessage,
  )
})

test("referential product follow-ups include recent user context and latest message", () => {
  const message = buildAgentV2ProductToolMessage({
    latestMessage: "Welches Produkt passt dann?",
    recentMessages: [
      { role: "user", content: "Ich will mehr Glanz und weniger Frizz in den Spitzen." },
      { role: "assistant", content: "Ein Finish-Produkt könnte passen." },
      { role: "user", content: "Meine Haare sind fein und werden schnell platt." },
    ],
  })

  assert.match(message, /mehr Glanz und weniger Frizz/i)
  assert.match(message, /fein und werden schnell platt/i)
  assert.match(message, /Welches Produkt passt dann\?/i)
})

test("referential group follow-ups include recent user context", () => {
  for (const latestMessage of ["Welche von denen passt?", "Welche der beiden passt?"]) {
    const message = buildAgentV2ProductToolMessage({
      latestMessage,
      recentMessages: [
        { role: "user", content: "Ich schwanke zwischen Öl und Leave-in gegen Frizz." },
        { role: "assistant", content: "Beide können je nach Ziel passen." },
      ],
    })

    assert.match(message, /Ich schwanke zwischen Öl und Leave-in gegen Frizz/i)
    assert.match(message, new RegExp(latestMessage.replace("?", "\\?"), "i"))
  }
})

test("assistant text is excluded from deterministic product inference context", () => {
  const message = buildAgentV2ProductToolMessage({
    latestMessage: "Welches davon passt dazu?",
    recentMessages: [
      { role: "user", content: "Ich suche etwas Pflegeleichtes." },
      { role: "assistant", content: "Nimm ein Stylingöl für Glanz und Frizz." },
    ],
  })

  assert.match(message, /Ich suche etwas Pflegeleichtes/i)
  assert.doesNotMatch(message, /Stylingöl/i)
  assert.doesNotMatch(message, /Glanz und Frizz/i)
})

test("German referential product follow-ups are recognized", () => {
  for (const message of [
    "Welches Produkt passt dann?",
    "Was passt dazu?",
    "Welche davon würdest du nehmen?",
    "Und dafür ein Produkt?",
    "Welches davon ist am besten?",
  ]) {
    assert.equal(isReferentialProductFollowup(message), true, message)
  }
})

test("oil finish follow-up resolves purpose from prior user context", () => {
  const message = buildAgentV2ProductToolMessage({
    latestMessage: "Welches Produkt passt dann?",
    recentMessages: [
      {
        role: "user",
        content: "Ich suche etwas als Finish gegen Frizz und für Glanz in den Spitzen.",
      },
      {
        role: "assistant",
        content: "Dann wäre ein Stylingöl als Finish naheliegend.",
      },
    ],
  })

  assert.equal(inferOilPurposeFromMessage(message), "styling_finish")
})
