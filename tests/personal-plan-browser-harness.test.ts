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

test("persisted Stage 1-5 harness bounds readiness and retains failure evidence", () => {
  const relativePath = "scripts/test-personal-plan-stage1-5-browser.sh"
  const source = readFileSync(join(process.cwd(), relativePath), "utf8")

  assert.match(source, /npm run build/, "builds after the local environment is exported")
  assert.match(source, /test_project_id="hc_personal_plan_stage1_5_browser_\$\$"/)
  assert.match(source, /port_seed=/)
  assert.match(source, /PLAYWRIGHT_BASE_URL="http:\/\/127\.0\.0\.1:\$app_port"/)
  assert.match(source, /npm run start -- --hostname 127\.0\.0\.1 --port "\$app_port"/)
  assert.match(source, /curl[\s\S]*--connect-timeout[\s\S]*--max-time/, relativePath)
  assert.match(source, /readiness_deadline/, relativePath)
  assert.match(source, /PERSONAL_PLAN_PLAYWRIGHT_DIAGNOSTICS=1/, relativePath)
  assert.match(
    source,
    /PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL=true/,
    "exercises initial Routine activation without a proposal confirmation",
  )
  assert.match(source, /test-results\/personal-plan-stage1-5\/server\.log/, relativePath)
})

test("Playwright diagnostics are scoped to the persisted journey", () => {
  const source = readFileSync(join(process.cwd(), "playwright.config.ts"), "utf8")

  assert.match(source, /process\.env\.PERSONAL_PLAN_PLAYWRIGHT_DIAGNOSTICS === "1"/)
  assert.match(source, /workers: personalPlanDiagnostics \? 1 : undefined/)
  assert.match(source, /trace: personalPlanDiagnostics \? "retain-on-failure" : "on-first-retry"/)
  assert.match(source, /screenshot: personalPlanDiagnostics \? "only-on-failure" : "off"/)
})
