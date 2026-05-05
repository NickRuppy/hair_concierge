import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("auth provider does not await Supabase work inside onAuthStateChange", () => {
  const source = readFileSync("src/providers/auth-provider.tsx", "utf-8")

  assert.doesNotMatch(
    source,
    /onAuthStateChange\s*\(\s*async\b/,
    "Supabase warns async auth callbacks can deadlock updateUser()",
  )
  assert.match(
    source,
    /setTimeout\s*\(\s*\(\)\s*=>/,
    "defer profile fetching until after the auth callback releases Supabase's lock",
  )
})
