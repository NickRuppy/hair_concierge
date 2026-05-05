import test from "node:test"
import assert from "node:assert/strict"
import { extractSupabaseHashSession, mapPasswordUpdateError } from "@/lib/auth/password-reset"

test("extracts Supabase recovery session tokens from URL hash", () => {
  assert.deepEqual(
    extractSupabaseHashSession(
      "#access_token=access-123&expires_in=3600&refresh_token=refresh-456&type=recovery",
    ),
    {
      access_token: "access-123",
      refresh_token: "refresh-456",
    },
  )
})

test("ignores incomplete URL hash sessions", () => {
  assert.equal(extractSupabaseHashSession("#access_token=access-123&type=recovery"), null)
  assert.equal(extractSupabaseHashSession(""), null)
})

test("maps expired or missing sessions to recovery-link guidance", () => {
  const mapped = mapPasswordUpdateError({
    message: "Auth session missing!",
    code: "session_not_found",
  })

  assert.match(mapped.message, /Passwort-Link/)
  assert.equal(mapped.actionHref, "/auth")
})

test("maps weak password errors to password guidance", () => {
  const mapped = mapPasswordUpdateError({ message: "Password should be stronger" })

  assert.equal(mapped.message, "Dieses Passwort ist zu schwach.")
  assert.match(mapped.guidance ?? "", /8 Zeichen/)
})
