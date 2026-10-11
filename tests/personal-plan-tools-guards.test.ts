import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"

/**
 * Hair Tools port, Task 12: grep guards for the rulings that are easiest to break by accident
 * (plan `plans/2026-10-09-hair-tools-port.md` §2 ruling 6, §9). Source scans, no runtime.
 *
 *   - Tool content is derived at READ time: no routine payload V2, nothing tool-shaped persisted
 *     on a routine / proposal / version row.
 *   - The engine's user-facing copy says Plan, never Idealplan.
 */

// Every test script runs from the repository root.
const ROOT = process.cwd()

function listFiles(dir: string, extensions: readonly string[]): string[] {
  const absolute = path.join(ROOT, dir)
  const found: string[] = []
  for (const entry of readdirSync(absolute)) {
    const full = path.join(absolute, entry)
    if (statSync(full).isDirectory()) found.push(...listFiles(path.join(dir, entry), extensions))
    else if (extensions.some((extension) => entry.endsWith(extension))) {
      found.push(path.relative(ROOT, full))
    }
  }
  return found
}

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
}

/** The routine payload producers and parsers: version 1 only (immutable rows stay untouched). */
const ROUTINE_PAYLOAD_FILES = [
  ...listFiles("src/lib/personal-plan/routine", [".ts"]),
  "src/lib/personal-plan/routine-candidate-compiler.ts",
  "src/lib/personal-plan/routine-proposal-stager.ts",
  "src/lib/personal-plan/refinement-recompute/routine-reactivation.ts",
]

test("no routine payload producer or parser knows a schemaVersion 2", () => {
  assert.ok(ROUTINE_PAYLOAD_FILES.length > 15, "the guard scans the routine files")
  const offenders = ROUTINE_PAYLOAD_FILES.filter((file) =>
    /schemaVersion\s*(?::|===|!==|=)\s*(?:z\.literal\()?2\b/.test(read(file)),
  )
  assert.deepEqual(offenders, [])
})

test("no tool content is persisted: the tool payload keys exist nowhere in src or the migrations", () => {
  const files = [
    ...listFiles("src", [".ts", ".tsx"]),
    ...listFiles("supabase/migrations", [".sql"]),
  ]
  // `toolGuidanceSchema` and the like are engine types; a persisted PAYLOAD key is the bare name.
  const forbidden =
    /\b(?:toolAssets|toolOccurrences|toolGuidance|tool_assets|tool_occurrences|tool_guidance)\b/
  const offenders = files.filter((file) => forbidden.test(read(file)))
  assert.deepEqual(offenders, [])
})

test("the tools engine never says Idealplan", () => {
  const files = [
    ...listFiles("src/lib/personal-plan/tools", [".ts"]),
    "src/components/personal-plan-start/tool-block.tsx",
    "src/components/personal-plan-refinement/tool-checkpoint.tsx",
    "src/components/personal-plan-refinement/tool-inventory.tsx",
    "src/app/labs/personal-plan-tools/page.tsx",
  ]
  assert.ok(files.length > 10)
  const offenders = files.filter((file) => /Idealplan/.test(read(file)))
  assert.deepEqual(offenders, [])
})
