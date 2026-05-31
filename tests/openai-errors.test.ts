import assert from "node:assert/strict"
import test from "node:test"
import {
  DEFAULT_OPENAI_MAX_RETRIES,
  DEFAULT_OPENAI_REQUEST_TIMEOUT_MS,
  classifyOpenAIError,
  getOpenAIMaxRetries,
  getOpenAIRequestTimeoutMs,
} from "../src/lib/openai/errors"

test("OpenAI timeout and retry settings default conservatively for launch", () => {
  assert.equal(getOpenAIRequestTimeoutMs({}), DEFAULT_OPENAI_REQUEST_TIMEOUT_MS)
  assert.equal(getOpenAIMaxRetries({}), DEFAULT_OPENAI_MAX_RETRIES)
})

test("OpenAI timeout and retry settings clamp unsafe env values", () => {
  assert.equal(getOpenAIRequestTimeoutMs({ OPENAI_REQUEST_TIMEOUT_MS: "1000" }), 5_000)
  assert.equal(getOpenAIRequestTimeoutMs({ OPENAI_REQUEST_TIMEOUT_MS: "90000" }), 55_000)
  assert.equal(getOpenAIRequestTimeoutMs({ OPENAI_REQUEST_TIMEOUT_MS: "abc" }), 25_000)
  assert.equal(getOpenAIMaxRetries({ OPENAI_MAX_RETRIES: "-2" }), 0)
  assert.equal(getOpenAIMaxRetries({ OPENAI_MAX_RETRIES: "9" }), 2)
  assert.equal(getOpenAIMaxRetries({ OPENAI_MAX_RETRIES: "abc" }), 1)
})

test("OpenAI error classifier maps launch-critical provider failures", () => {
  assert.deepEqual(classifyOpenAIError({ name: "RateLimitError", status: 429 }), {
    kind: "rate_limited",
    status: 429,
    userMessage: "Gerade sind zu viele KI-Anfragen gleichzeitig. Bitte versuche es gleich nochmal.",
  })
  assert.deepEqual(classifyOpenAIError({ name: "APIConnectionTimeoutError" })?.kind, "timeout")
  assert.deepEqual(classifyOpenAIError({ name: "APIConnectionError" })?.kind, "connection")
  assert.deepEqual(classifyOpenAIError({ status: 503 })?.kind, "server")
  assert.equal(classifyOpenAIError(new Error("regular app error")), null)
})
