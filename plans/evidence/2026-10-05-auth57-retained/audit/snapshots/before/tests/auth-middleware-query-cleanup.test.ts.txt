import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { buildAuthenticatedIntakeRedirectUrl } from "../src/lib/supabase/middleware"

function redirectUrl(source: string, destination: string) {
  const request = new NextRequest(source)
  return buildAuthenticatedIntakeRedirectUrl(request.nextUrl, request.nextUrl.pathname, destination)
}

test("authenticated /auth to /quiz clears the entire source query", () => {
  const url = redirectUrl(
    "https://chaarlie.de/auth?error=link_expired&next=%2Fplan-start&lead=lead-1",
    "/quiz",
  )

  assert.equal(url.toString(), "https://chaarlie.de/quiz")
})

test("authenticated /auth to /onboarding re-adds only lead", () => {
  const url = redirectUrl(
    "https://chaarlie.de/auth?error=link_expired&next=%2Fplan-start&lead=lead-1&from=quiz",
    "/onboarding",
  )

  assert.equal(url.toString(), "https://chaarlie.de/onboarding?lead=lead-1")
})

test("authenticated /auth to /chat clears the entire source query", () => {
  const url = redirectUrl(
    "https://chaarlie.de/auth?error=link_expired&next=%2Fplan-start&lead=lead-1",
    "/chat",
  )

  assert.equal(url.toString(), "https://chaarlie.de/chat")
})

test("non-auth quiz redirects keep their existing query handling", () => {
  const onboardingUrl = redirectUrl(
    "https://chaarlie.de/quiz?mode=retake&returnTo=%2Fprofile&lead=lead-1",
    "/onboarding",
  )
  assert.equal(
    onboardingUrl.toString(),
    "https://chaarlie.de/onboarding?mode=retake&returnTo=%2Fprofile&lead=lead-1",
  )

  const chatUrl = redirectUrl(
    "https://chaarlie.de/quiz?mode=retake&returnTo=%2Fprofile&lead=lead-1",
    "/chat",
  )
  assert.equal(chatUrl.toString(), "https://chaarlie.de/chat?mode=retake&returnTo=%2Fprofile")
})
