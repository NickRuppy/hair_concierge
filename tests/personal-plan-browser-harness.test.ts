import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const harnesses = [
  "scripts/test-personal-plan-stage4-browser.sh",
  "scripts/test-personal-plan-stage5-browser.sh",
  "scripts/test-personal-plan-stage1-5-browser.sh",
]

test("Personal Plan browser harnesses own and terminate their complete Next process groups", () => {
  for (const relativePath of harnesses) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8")

    assert.match(source, /os\.setsid\(\)[\s\S]*os\.execvp/, relativePath)
    assert.match(source, /kill -0 -- "-\$server_pid"/, relativePath)
    assert.match(source, /kill -TERM -- "-\$server_pid"/, relativePath)
    assert.match(source, /kill -KILL -- "-\$server_pid"/, relativePath)
    assert.match(source, /trap cleanup EXIT INT TERM/, relativePath)
    assert.doesNotMatch(source, /\bpkill\b|\bkillall\b/, relativePath)
  }
})
