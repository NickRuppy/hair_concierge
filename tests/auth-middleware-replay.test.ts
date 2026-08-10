import assert from "node:assert/strict"
import test from "node:test"
import { buildAuthenticatedAppRedirectUrl } from "../src/lib/supabase/middleware"

test("authenticated auth routing strips auth-only error and token query material", () => {
  const redirected = buildAuthenticatedAppRedirectUrl(
    new URL(
      "https://chaarlie.de/auth?error=link_expired&reason=session_expired&code=secret&token=raw&token_hash=hashed&type=magiclink&next=%2Froutine&campaign=welcome",
    ),
    "/chat",
  )

  assert.equal(redirected.toString(), "https://chaarlie.de/chat?next=%2Froutine&campaign=welcome")
})

test("authenticated auth routing keeps the allowed onboarding lead while removing auth-only query material", () => {
  const redirected = buildAuthenticatedAppRedirectUrl(
    new URL("https://chaarlie.de/auth?error=link_expired&lead=lead-1&code=secret"),
    "/onboarding",
  )

  assert.equal(redirected.toString(), "https://chaarlie.de/onboarding?lead=lead-1")
})

test("non-auth app routing does not silently strip ordinary route query parameters", () => {
  const redirected = buildAuthenticatedAppRedirectUrl(
    new URL("https://chaarlie.de/routine?reason=attention&next=%2Fanwendung"),
    "/quiz",
  )

  assert.equal(redirected.toString(), "https://chaarlie.de/quiz?reason=attention&next=%2Fanwendung")
})
