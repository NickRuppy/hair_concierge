import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  GUIDED_STORY_CHAT_REVEAL_DELAY_MS,
  GuidedStoryChatDemo,
} from "../src/components/quiz/guided-story-chat-demo"
import { GUIDED_STORY_CHAT_EXCHANGES } from "../src/lib/quiz/guided-story-chat"

test("renders the selected question immediately as a non-interactive product demonstration", () => {
  const exchange = GUIDED_STORY_CHAT_EXCHANGES[0]!
  const html = renderToStaticMarkup(<GuidedStoryChatDemo exchange={exchange} />)

  assert.match(html, new RegExp(exchange.question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(html, /Vorab berechnete Chat-Demonstration/)
  assert.match(html, /kennt dein Profil und deine Routine/)
  assert.match(html, /data-guided-story-chat-typing/)
  assert.doesNotMatch(html, /<button|<input|<textarea/)
})

test("reveals once automatically and immediately for reduced motion without any live chat request", () => {
  const source = readFileSync(
    new URL("../src/components/quiz/guided-story-chat-demo.tsx", import.meta.url),
    "utf8",
  )

  assert.equal(GUIDED_STORY_CHAT_REVEAL_DELAY_MS, 1100)
  assert.match(source, /prefers-reduced-motion: reduce/)
  assert.match(source, /setAnswerVisible\(true\)/)
  assert.match(source, /window\.setTimeout/)
  assert.match(source, /guided-story-chat-answer-in_300ms/)
  assert.match(source, /guided-story-typing_0\.9s/)
  assert.doesNotMatch(source, /setInterval|fetch\(|useChat|agent-v2|AgentV2/)
})
