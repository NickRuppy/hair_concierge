import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(filename)
    return entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) ? [filename] : []
  })
}

test("only the completeness gate and hand-edit detection import the frozen projection", () => {
  const projectionImport = /\b(?:from\s*|import\s*\(\s*)["'][^"']*legacy-profile-projection["']/
  const consumers = sourceFiles("src")
    .filter((filename) => projectionImport.test(readFileSync(filename, "utf8")))
    .sort()

  assert.deepEqual(consumers, [
    "src/app/plan-bereit/readiness.ts",
    "src/lib/user-facts/backfill/detect-hand-edits.ts",
  ])
})

test("account linking exports none of the frozen projection helpers", () => {
  const source = readFileSync("src/lib/quiz/link-to-profile.ts", "utf8")
  const helpers = [
    "buildProfileDataFromPersonalPlanCanonicalProfile",
    "buildProfileDataFromQuizAnswers",
    "buildProfilePrimaryConcern",
    "resolveProfileDensityFromQuizAnswers",
  ]
  const exportLists = [...source.matchAll(/\bexport\s+(?:type\s+)?\{([^}]+)\}/g)]
  const exportedHelpers = helpers.filter((name) => {
    const identifier = new RegExp(`\\b${name}\\b`)
    const declaration = new RegExp(
      `\\bexport\\s+(?:declare\\s+)?(?:async\\s+)?(?:function|const|let|var|class|type|interface|enum)\\s+${name}\\b`,
    )
    return declaration.test(source) || exportLists.some((match) => identifier.test(match[1]))
  })

  assert.deepEqual(
    exportedHelpers,
    [],
    "link-to-profile.ts must not export frozen legacy profile projection helpers",
  )
})
