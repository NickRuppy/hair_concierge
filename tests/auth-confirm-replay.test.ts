import assert from "node:assert/strict"
import {
  isModeratorReturnPath,
  normalizeModeratorReturnPath,
} from "../src/lib/auth/moderator-return"
import test from "node:test"
import {
  createAuthConfirmGetHandler,
  type AuthConfirmRouteDeps,
} from "../src/app/auth/confirm/route"
import { buildPasswordRecoveryRedirect } from "../src/components/auth/auth-form"

test("moderator return paths reject absolute, protocol-relative and ambiguous URLs", () => {
  const path = "/test/haarplan/konto?campaign=10000000-0000-4000-8000-000000000001"
  assert.equal(isModeratorReturnPath(path), true)
  assert.equal(normalizeModeratorReturnPath(path), path)
  for (const value of [
    `https://moderator-return.invalid${path}`,
    `//moderator-return.invalid${path}`,
    path.slice(1),
    `${path}#anything`,
    `${path}&campaign=20000000-0000-4000-8000-000000000002`,
    "javascript:alert(1)",
  ]) {
    assert.equal(isModeratorReturnPath(value), false, value)
    assert.equal(normalizeModeratorReturnPath(value), null, value)
  }
})

type StubOptions = {
  exchangeError?: unknown
  otpError?: unknown
  user?: { id: string; email: string } | null
  journeyHref?: "/plan-start" | "/routine" | "/anwendung" | null
  journeyError?: unknown
}

function stubHandler(options: StubOptions = {}) {
  const calls: Array<[string, ...unknown[]]> = []
  const user =
    options.user === undefined ? { id: "user-1", email: "lea@example.com" } : options.user

  const deps: AuthConfirmRouteDeps = {
    async createClient() {
      return {
        auth: {
          async exchangeCodeForSession(code) {
            calls.push(["exchange", code])
            return { error: options.exchangeError ?? null }
          },
          async verifyOtp(input) {
            calls.push(["verifyOtp", input])
            return { error: options.otpError ?? null }
          },
          async getUser() {
            calls.push(["getUser"])
            return { data: { user } }
          },
        },
      }
    },
    async linkQuizToProfile(userId, email, leadId) {
      calls.push(["linkQuiz", userId, email, leadId])
    },
    async loadJourneyAccess(userId) {
      calls.push(["loadJourney", userId])
      if (options.journeyError) throw options.journeyError
      if (!options.journeyHref) return { kind: "legacy" }
      return {
        kind: "personal_plan",
        personalPlanId: "plan-1",
        frontier:
          options.journeyHref === "/anwendung"
            ? "stage5"
            : options.journeyHref === "/routine"
              ? "stage4"
              : "stage1",
        nextHref: options.journeyHref,
        allowed: {
          stage1: true,
          stage2: true,
          stage3: true,
          stage4: options.journeyHref !== "/plan-start",
          stage5: options.journeyHref === "/anwendung",
        },
      }
    },
  }

  return { calls, handler: createAuthConfirmGetHandler(deps) }
}

function location(response: Response) {
  return response.headers.get("location")
}

test("fresh PKCE confirmation keeps verification and quiz linking exactly once", async () => {
  const { calls, handler } = stubHandler()

  const response = await handler(
    new Request(
      "https://chaarlie.de/auth/confirm?code=fresh-code&lead=lead-1&next=%2Froutine%3Ftab%3Dmorning",
    ),
  )

  assert.equal(location(response), "https://chaarlie.de/routine?tab=morning")
  assert.deepEqual(calls, [
    ["exchange", "fresh-code"],
    ["getUser"],
    ["linkQuiz", "user-1", "lea@example.com", "lead-1"],
  ])
})

test("fresh OTP recovery still opens password setup after linking", async () => {
  const { calls, handler } = stubHandler()

  const response = await handler(
    new Request(
      "https://chaarlie.de/auth/confirm?token_hash=fresh-token&type=recovery&lead=lead-1",
    ),
  )

  assert.equal(location(response), "https://chaarlie.de/auth/update-password")
  assert.deepEqual(calls, [
    ["verifyOtp", { token_hash: "fresh-token", type: "recovery" }],
    ["getUser"],
    ["linkQuiz", "user-1", "lea@example.com", "lead-1"],
  ])
})

test("moderator confirmation preserves the non-secret campaign return and never relinks legacy quiz data", async () => {
  const { calls, handler } = stubHandler()
  const moderatorNext = "/test/haarplan/konto?campaign=10000000-0000-4000-8000-000000000001"
  const url = new URL("https://chaarlie.de/auth/confirm?code=fresh-code&lead=legacy-lead")
  url.searchParams.set("next", moderatorNext)

  const response = await handler(new Request(url))

  assert.equal(location(response), `https://chaarlie.de${moderatorNext}`)
  assert.deepEqual(calls, [["exchange", "fresh-code"], ["getUser"]])
})

test("moderator password recovery returns to the invitation without relinking legacy quiz data", async () => {
  const { calls, handler } = stubHandler()
  const moderatorNext = "/test/haarplan/konto?campaign=10000000-0000-4000-8000-000000000001"
  const url = new URL("https://chaarlie.de/auth/confirm?token_hash=fresh-token&type=recovery")
  url.searchParams.set("next", moderatorNext)

  const response = await handler(new Request(url))

  assert.equal(
    location(response),
    `https://chaarlie.de/auth/update-password?next=${encodeURIComponent(moderatorNext)}`,
  )
  assert.deepEqual(calls, [
    ["verifyOtp", { token_hash: "fresh-token", type: "recovery" }],
    ["getUser"],
  ])
})

test("the password recovery redirect preserves moderator context through confirmation", async () => {
  const { calls, handler } = stubHandler()
  const moderatorNext = "/test/haarplan/konto?campaign=10000000-0000-4000-8000-000000000001"
  const recoveryRedirect = new URL(
    buildPasswordRecoveryRedirect("https://chaarlie.de", moderatorNext),
  )
  recoveryRedirect.searchParams.set("token_hash", "fresh-token")
  recoveryRedirect.searchParams.set("type", "recovery")
  recoveryRedirect.searchParams.set("lead", "legacy-lead")

  const response = await handler(new Request(recoveryRedirect))

  assert.equal(
    location(response),
    `https://chaarlie.de/auth/update-password?next=${encodeURIComponent(moderatorNext)}`,
  )
  assert.deepEqual(calls, [
    ["verifyOtp", { token_hash: "fresh-token", type: "recovery" }],
    ["getUser"],
  ])
})

test("consumed confirmation with a session keeps an unrelated destination on auth recovery without replaying side effects", async () => {
  const { calls, handler } = stubHandler({ exchangeError: new Error("otp_expired") })

  const response = await handler(
    new Request(
      "https://chaarlie.de/auth/confirm?code=consumed&next=%2Froutine%3Ftab%3Dmorning%26error%3Dlink_expired%26token_hash%3Dsecret",
    ),
  )

  assert.equal(
    location(response),
    "https://chaarlie.de/auth?error=link_expired&next=%2Froutine%3Ftab%3Dmorning",
  )
  assert.deepEqual(calls, [["exchange", "consumed"], ["getUser"]])
})

test("consumed confirmation without next resumes the canonical Personal Plan frontier", async () => {
  for (const journeyHref of ["/plan-start", "/routine", "/anwendung"] as const) {
    const { calls, handler } = stubHandler({
      exchangeError: new Error("otp_expired"),
      journeyHref,
    })

    const response = await handler(new Request("https://chaarlie.de/auth/confirm?code=consumed"))

    assert.equal(location(response), `https://chaarlie.de${journeyHref}`)
    assert.deepEqual(calls, [["exchange", "consumed"], ["getUser"], ["loadJourney", "user-1"]])
  }
})

test("unsafe replay destinations are rejected in favor of the owner-scoped frontier", async () => {
  const unsafe = [
    "https://evil.example/routine",
    "//evil.example/routine",
    "/\\evil.example\\routine",
    "/auth/confirm?next=/routine",
  ]

  for (const next of unsafe) {
    const { calls, handler } = stubHandler({
      exchangeError: new Error("otp_expired"),
      journeyHref: "/routine",
    })
    const url = new URL("https://chaarlie.de/auth/confirm")
    url.searchParams.set("code", "consumed")
    url.searchParams.set("next", next)

    const response = await handler(new Request(url))

    assert.equal(location(response), "https://chaarlie.de/routine")
    assert.equal(
      calls.some(([name]) => name === "linkQuiz"),
      false,
    )
    assert.equal(
      calls.some(([name]) => name === "loadJourney"),
      true,
    )
  }
})

test("unrelated same-origin destinations retain auth recovery while a foreign redirect falls back to the frontier", async () => {
  const sameOriginNext = stubHandler({ exchangeError: new Error("otp_expired") })
  const sameOriginNextUrl = new URL("https://chaarlie.de/auth/confirm")
  sameOriginNextUrl.searchParams.set("code", "consumed")
  sameOriginNextUrl.searchParams.set("next", "https://chaarlie.de/routine?tab=morning")
  const sameOriginNextResponse = await sameOriginNext.handler(new Request(sameOriginNextUrl))
  assert.equal(
    location(sameOriginNextResponse),
    "https://chaarlie.de/auth?error=link_expired&next=%2Froutine%3Ftab%3Dmorning",
  )
  assert.equal(
    sameOriginNext.calls.some(([name]) => name === "loadJourney"),
    false,
  )

  const sameOrigin = stubHandler({ exchangeError: new Error("otp_expired") })
  const sameOriginResponse = await sameOrigin.handler(
    new Request(
      "https://chaarlie.de/auth/confirm?code=consumed&redirect_to=https%3A%2F%2Fchaarlie.de%2Froutine%3Ftab%3Devening",
    ),
  )
  assert.equal(
    location(sameOriginResponse),
    "https://chaarlie.de/auth?error=link_expired&next=%2Froutine%3Ftab%3Devening",
  )
  assert.equal(
    sameOrigin.calls.some(([name]) => name === "loadJourney"),
    false,
  )

  const foreign = stubHandler({
    exchangeError: new Error("otp_expired"),
    journeyHref: "/plan-start",
  })
  const foreignResponse = await foreign.handler(
    new Request(
      "https://chaarlie.de/auth/confirm?code=consumed&redirect_to=https%3A%2F%2Fevil.example%2Froutine",
    ),
  )
  assert.equal(location(foreignResponse), "https://chaarlie.de/plan-start")
})

test("consumed recovery link with a session remains password recovery and does not load or link", async () => {
  const { calls, handler } = stubHandler({ otpError: new Error("otp_expired") })

  const response = await handler(
    new Request(
      "https://chaarlie.de/auth/confirm?token_hash=consumed&type=recovery&next=%2Froutine",
    ),
  )

  assert.equal(
    location(response),
    "https://chaarlie.de/auth?error=link_expired&force=login&next=%2Fauth%2Fupdate-password",
  )
  assert.deepEqual(calls, [
    ["verifyOtp", { token_hash: "consumed", type: "recovery" }],
    ["getUser"],
  ])
})

test("signed-out invalid links retain expired-link recovery", async () => {
  const { calls, handler } = stubHandler({
    exchangeError: new Error("otp_expired"),
    user: null,
    journeyHref: "/routine",
  })

  const response = await handler(
    new Request("https://chaarlie.de/auth/confirm?code=consumed&next=%2Froutine"),
  )

  assert.equal(location(response), "https://chaarlie.de/auth?error=link_expired&next=%2Froutine")
  assert.deepEqual(calls, [["exchange", "consumed"], ["getUser"]])
})

test("authenticated replay falls back to auth recovery when no Personal Plan frontier can be loaded", async (context) => {
  context.mock.method(console, "warn", () => {})
  for (const options of [
    { exchangeError: new Error("otp_expired"), journeyHref: null },
    { exchangeError: new Error("otp_expired"), journeyError: new Error("db unavailable") },
  ]) {
    const { calls, handler } = stubHandler(options)
    const response = await handler(new Request("https://chaarlie.de/auth/confirm?code=consumed"))

    assert.equal(location(response), "https://chaarlie.de/auth?error=link_expired&next=%2Fchat")
    assert.equal(
      calls.some(([name]) => name === "linkQuiz"),
      false,
    )
  }
})
