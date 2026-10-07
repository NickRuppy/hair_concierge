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

  // These are the four reviewed Discovery dependency sets, not a newest-file rule.
  // Resolve identities from the files already collected above so the check observes
  // deployment ordering rather than only comparing hardcoded timestamp literals.
  const discoveryMigrationNames = [
    "discovery_call_toolkit.sql",
    "discovery_enrollment_optional_email.sql",
    "discovery_intake_usage_product_type.sql",
    "discovery_admin_item_usage.sql",
    "discovery_intake_frequency_heat_styling.sql",
    "discovery_admin_item_usage_styling.sql",
    "discovery_call_decisions_per_item.sql",
    "discovery_call_sheets.sql",
  ] as const
  const discoveryVersions = discoveryMigrationNames.map((name) => {
    const files = migrationFiles.filter((file) => file.replace(/^\d+_/, "") === name)
    assert.equal(files.length, 1, `expected one reviewed Discovery migration: ${name}`)
    const version = files[0].match(/^(\d+)_/)?.[1]
    assert.ok(version)
    return version
  })
  // Preserve the four original OWN numeric-version cardinality constraints too.
  for (const own of ["20260925120000", "20260925150000", "20260927120000", "20260928120000"]) {
    assert.equal(filesByVersion.get(own)?.length, 1, `expected reviewed Discovery version: ${own}`)
  }
  for (const ownIndex of [4, 5, 6, 7]) {
    for (let predecessorIndex = 0; predecessorIndex < ownIndex; predecessorIndex += 1) {
      assert.ok(
        discoveryVersions[predecessorIndex] < discoveryVersions[ownIndex],
        `${discoveryMigrationNames[ownIndex]} must sort after ${discoveryMigrationNames[predecessorIndex]}`,
      )
    }
  }
})
