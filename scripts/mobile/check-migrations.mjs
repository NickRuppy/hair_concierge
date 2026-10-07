import { readdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import assert from "node:assert/strict"

const files = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
const versions = files.map((file) => file.split("_")[0])
assert.equal(new Set(versions).size, versions.length, "Duplicate Supabase migration version")
const baseline = execFileSync(
  "git",
  [
    "ls-tree",
    "-r",
    "--name-only",
    "469d41f5e81f44702c94829c0ed312e732b01172",
    "supabase/migrations",
  ],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .map((path) => path.split("/").at(-1))
const latest = baseline.sort().at(-1)
const added = files.filter((file) => !baseline.includes(file))
assert.ok(added.length >= 2)
for (const file of added)
  assert.ok(file > latest, `Migration ${file} must follow refreshed base ${latest}`)
console.log(
  `PASS migration order: ${files.length} unique versions; ${added.length} additions follow baseline ${latest}`,
)
