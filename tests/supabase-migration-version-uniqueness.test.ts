import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

test("Supabase migration versions are globally unique", () => {
  const migrationFiles = readdirSync(join(process.cwd(), "supabase/migrations")).filter((name) =>
    name.endsWith(".sql"),
  )
  const filesByVersion = new Map<string, string[]>()

  for (const file of migrationFiles) {
    const version = file.match(/^(\d+)_/)?.[1]
    assert.ok(version, `migration filename must start with a numeric version: ${file}`)
    filesByVersion.set(version, [...(filesByVersion.get(version) ?? []), file])
  }

  const duplicates = [...filesByVersion.entries()].filter(([, files]) => files.length > 1)
  assert.deepEqual(
    duplicates,
    [],
    `duplicate Supabase migration versions: ${JSON.stringify(duplicates)}`,
  )
})
