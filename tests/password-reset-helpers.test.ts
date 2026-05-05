import test from "node:test"
import assert from "node:assert/strict"
import { getPasswordPolicyItems, validatePasswordDraft } from "@/lib/auth/password-policy"
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

test("maps same-password errors before generic weak-password wording", () => {
  const mapped = mapPasswordUpdateError({
    code: 422,
    error_code: "same_password",
    message: null,
    msg: "New password should be different from the old password.",
  })

  assert.equal(mapped.message, "Dieses Passwort ist bereits für dein Konto gesetzt.")
  assert.match(mapped.guidance ?? "", /anderes Passwort/)
  assert.equal(mapped.actionHref, "/auth")
})

test("password policy exposes visible checklist items for creation and reset", () => {
  assert.deepEqual(getPasswordPolicyItems("create"), [
    { id: "length", label: "Mindestens 8 Zeichen" },
    { id: "match", label: "Beide Passwörter stimmen überein" },
  ])

  assert.deepEqual(getPasswordPolicyItems("reset"), [
    { id: "length", label: "Mindestens 8 Zeichen" },
    { id: "match", label: "Beide Passwörter stimmen überein" },
    {
      id: "different",
      label: "Nicht dasselbe Passwort erneut verwenden",
    },
  ])
})

test("password draft validation only enforces visible local rules", () => {
  assert.deepEqual(validatePasswordDraft("1234567", "1234567"), {
    ok: false,
    message: "Passwort muss mindestens 8 Zeichen lang sein.",
  })

  assert.deepEqual(validatePasswordDraft("12345678", "87654321"), {
    ok: false,
    message: "Passwörter stimmen nicht überein.",
  })

  assert.deepEqual(validatePasswordDraft("12345678", "12345678"), { ok: true })
})
