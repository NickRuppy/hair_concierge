import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("read-only preview benchmark scopes the Vercel bypass to same-origin safe reads", async () => {
  const source = await readFile(
    new URL("../scripts/personal-plan/measure-read-only-transitions.mjs", import.meta.url),
    "utf8",
  )

  assert.match(source, /readArgument\("protection-bypass"\)/)
  assert.match(source, /readArgument\("executable-path"\)/)
  assert.match(source, /requestOrigin === origin\.origin/)
  assert.match(source, /x-vercel-protection-bypass/)
  assert.match(source, /\["GET", "HEAD", "OPTIONS"\]\.includes\(method\)/)
  assert.match(source, /unexpected_application_write/)
  assert.match(source, /expected_routine_sync/)
  assert.match(source, /external_telemetry/)
  assert.match(source, /https:\/\/eu\.i\.posthog\.com/)
  assert.match(source, /https:\/\/cdp-eu\.customer\.io/)
  assert.match(source, /data-personal-plan-application-root="true"[^\n]+\n\s*\.first\(\)/)
  assert.doesNotMatch(source, /if \(blockedWrites\.length > 0\)/)
  assert.doesNotMatch(source, /protectionBypass[,\s]*\n\s*environment/)
})
