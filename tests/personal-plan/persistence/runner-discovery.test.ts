import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"

const packageManifest = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> }

function personalPlanRootTests() {
  return execFileSync("find", ["tests", "-type", "f", "-name", "personal-plan*.test.ts"], {
    encoding: "utf8",
  })
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean)
    .sort()
}

test("the Personal Plan runner discovers nested contracts and every reviewed root suite", () => {
  const runner = packageManifest.scripts["test:personal-plan"]

  assert.match(runner, /tests\/personal-plan\/\*\*\/\*.test\.ts/)
  assert.match(runner, /tests\/personal-plan-\*\.test\.ts/)

  const omitted = personalPlanRootTests().filter(
    (path) => !/^tests\/personal-plan-[^/]+\.test\.ts$/.test(path),
  )

  assert.deepEqual(
    omitted,
    [],
    "a Personal Plan root suite no longer matches the reviewed runner pattern",
  )
})
