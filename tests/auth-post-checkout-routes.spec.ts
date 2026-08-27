import { createHash } from "node:crypto"
import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import {
  handleAuthConfirm,
  resolveAuthRedirectPath,
  sanitizeAuthRedirectPath,
  type AuthConfirmDeps,
} from "../src/app/auth/confirm/route"
import { buildPasswordRecoveryRedirect } from "../src/components/auth/auth-form"
import { buildAuthenticatedAppRedirectUrl } from "../src/lib/supabase/middleware"
import { handleSendMagicLink } from "../src/app/api/auth/send-magic-link/route"
import { handleSendSetupLink } from "../src/app/api/auth/send-setup-link/route"
import { handleSetCheckoutPassword } from "../src/app/api/auth/set-checkout-password/route"

function sessionHash(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex")
}

function checkoutSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_password",
    status: "complete",
    payment_status: "paid",
    customer: "cus_test_password",
    customer_details: { email: "stripe@example.com" },
    subscription: "sub_test_password",
    ...overrides,
  } as any
}

function stubSupabase(appMetadata: Record<string, unknown> = {}) {
  const calls: any[] = []

  return {
    calls,
    supabase: {
      auth: {
        admin: {
          async getUserById(userId: string) {
            calls.push(["getUserById", userId])
            return {
              data: {
                user: {
                  id: userId,
                  app_metadata: appMetadata,
                },
              },
              error: null,
            }
          },
          async updateUserById(userId: string, patch: Record<string, unknown>) {
            calls.push(["updateUserById", userId, patch])
            return { data: { user: { id: userId } }, error: null }
          },
        },
      },
      from(table: string) {
        return {
          select() {
            calls.push(["select", table])
            return Promise.resolve({
              data: [{ id: "tier-premium", slug: "premium" }],
              error: null,
            })
          },
        }
      },
    } as any,
  }
}

function stubDeps(overrides: Partial<Parameters<typeof handleSetCheckoutPassword>[1]> = {}) {
  const { calls, supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("cs_test_password"),
    provider: "email",
    roles: ["member"],
  })

  const deps: Parameters<typeof handleSetCheckoutPassword>[1] = {
    stripe: {} as any,
    supabase,
    checkRateLimit: async () => ({ allowed: true }),
    verifyCheckoutSessionForActivation: async () => checkoutSession(),
    ensureCheckoutAccount: async () => ({
      userId: "user-test",
      email: "stripe@example.com",
      canSetInitialPassword: true,
    }),
    claimCheckoutActivation: async () => true,
    releaseCheckoutActivationClaim: async () => {},
    ...overrides,
  }

  return { calls, deps }
}

test("auth confirm keeps only same-origin relative next paths", () => {
  expect(sanitizeAuthRedirectPath("/onboarding")).toBe("/onboarding")
  expect(sanitizeAuthRedirectPath("/chat?tab=routine")).toBe("/chat?tab=routine")
  expect(
    sanitizeAuthRedirectPath(
      "/routine?tab=morning&error=link_expired&code=secret&token_hash=token&type=magiclink",
    ),
  ).toBe("/routine?tab=morning")
  expect(sanitizeAuthRedirectPath("/auth/confirm?next=/routine")).toBe("/chat")
  expect(sanitizeAuthRedirectPath("//evil.example/onboarding")).toBe("/chat")
  expect(sanitizeAuthRedirectPath("/\\evil.example\\onboarding")).toBe("/chat")
  expect(sanitizeAuthRedirectPath("https://evil.example/onboarding")).toBe("/chat")
})

test("auth confirm resolves Supabase redirect_to without overriding ordinary login links", () => {
  const checkoutParams = new URLSearchParams({
    redirect_to: "https://hair.example/auth/confirm?next=/onboarding",
  })
  expect(resolveAuthRedirectPath(checkoutParams, "https://hair.example")).toBe("/onboarding")

  const regularLoginParams = new URLSearchParams({
    redirect_to: "https://hair.example/auth/confirm",
  })
  expect(resolveAuthRedirectPath(regularLoginParams, "https://hair.example")).toBe("/chat")

  const externalParams = new URLSearchParams({
    redirect_to: "https://evil.example/auth/confirm?next=/onboarding",
  })
  expect(resolveAuthRedirectPath(externalParams, "https://hair.example")).toBe("/chat")
})

test("auth confirm allows password recovery links to land on password setup", () => {
  const params = new URLSearchParams({
    redirect_to: "https://hair.example/auth/confirm?next=/auth/update-password",
  })

  expect(resolveAuthRedirectPath(params, "https://hair.example")).toBe("/auth/update-password")
})

test("authenticated auth cleanup cannot resurrect an expired-link screen through Back or Forward", async ({
  page,
}) => {
  const authRequests: string[] = []
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`)
    if (requestUrl.pathname === "/auth") {
      authRequests.push(requestUrl.toString())
      const cleanDestination = buildAuthenticatedAppRedirectUrl(requestUrl, "/chat")
      response.writeHead(307, { location: cleanDestination.toString() })
      response.end()
      return
    }

    response.writeHead(200, { "content-type": "text/html" })
    response.end(`<main data-path="${requestUrl.pathname}">${requestUrl.pathname}</main>`)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address !== "object") throw new Error("test server did not bind")
  const origin = `http://127.0.0.1:${address.port}`

  try {
    await page.goto(`${origin}/before`)
    await page.goto(
      `${origin}/auth?error=link_expired&code=consumed&token_hash=secret&type=magiclink`,
    )

    expect(page.url()).toBe(`${origin}/chat`)
    expect(await page.goBack()).not.toBeNull()
    expect(page.url()).toBe(`${origin}/before`)
    expect(await page.goForward()).not.toBeNull()
    expect(page.url()).toBe(`${origin}/chat`)
    expect(page.url()).not.toContain("link_expired")
    expect(page.url()).not.toContain("token_hash")
    expect(authRequests).toEqual([
      `${origin}/auth?error=link_expired&code=consumed&token_hash=secret&type=magiclink`,
    ])
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

function confirmDeps(options: {
  exchangeError?: unknown
  otpError?: unknown
  user?: { id: string; email?: string } | null
}) {
  const calls: unknown[][] = []
  const deps: AuthConfirmDeps = {
    async exchangeCodeForSession(code: string) {
      calls.push(["exchange", code])
      return { error: options.exchangeError ?? null }
    },
    async verifyOtp(params) {
      calls.push(["verifyOtp", params])
      return { error: options.otpError ?? null }
    },
    async getUser() {
      calls.push(["getUser"])
      return { data: { user: options.user ?? null } }
    },
    async linkQuizToProfile(userId: string, email?: string, leadId?: string) {
      calls.push(["linkQuizToProfile", userId, email, leadId])
    },
    redirect(url: string) {
      calls.push(["redirect", url])
      return new Response(null, { status: 307, headers: { location: url } })
    },
  }

  return { calls, deps }
}

async function handleConfirm(requestUrl: string, deps: ReturnType<typeof confirmDeps>["deps"]) {
  return handleAuthConfirm(new Request(requestUrl), deps)
}

test("authenticated consumed Personal Plan confirmation replays its sanitized destination", async () => {
  const { calls, deps } = confirmDeps({
    exchangeError: new Error("code already used"),
    user: { id: "user-1", email: "paid@example.com" },
  })

  const response = await handleConfirm(
    "https://hair.example/auth/confirm?code=used&next=%2Fplan-start%3Fresume%3D1",
    deps,
  )

  expect(response.headers.get("location")).toBe("https://hair.example/plan-start?resume=1")
  expect(calls).not.toContainEqual(["linkQuizToProfile", "user-1", "paid@example.com", undefined])
})

test("authenticated consumed plan-bereit confirmation preserves its safe query", async () => {
  const { deps } = confirmDeps({
    exchangeError: new Error("code already used"),
    user: { id: "user-1" },
  })

  const response = await handleConfirm(
    "https://hair.example/auth/confirm?code=used&next=%2Fplan-bereit%3Flead%3Dlead-1",
    deps,
  )

  expect(response.headers.get("location")).toBe("https://hair.example/plan-bereit?lead=lead-1")
})

test("signed-out expired confirmation retains only its sanitized next destination", async () => {
  const { deps } = confirmDeps({ exchangeError: new Error("expired"), user: null })

  const validResponse = await handleConfirm(
    "https://hair.example/auth/confirm?code=expired&next=%2Fplan-start%3Fresume%3D1",
    deps,
  )
  expect(validResponse.headers.get("location")).toBe(
    "https://hair.example/auth?error=link_expired&next=%2Fplan-start%3Fresume%3D1",
  )

  const response = await handleConfirm(
    "https://hair.example/auth/confirm?code=expired&next=https%3A%2F%2Fevil.example%2Fsteal",
    deps,
  )

  expect(response.headers.get("location")).toBe(
    "https://hair.example/auth?error=link_expired&next=%2Fchat",
  )
})

test("authenticated failed confirmation cannot replay an unallowlisted internal path", async () => {
  const { deps } = confirmDeps({
    exchangeError: new Error("expired"),
    user: { id: "user-1" },
  })

  const response = await handleConfirm(
    "https://hair.example/auth/confirm?code=expired&next=%2Fprofile%3Fsection%3Droutine",
    deps,
  )

  expect(response.headers.get("location")).toBe(
    "https://hair.example/auth?error=link_expired&next=%2Fprofile%3Fsection%3Droutine",
  )

  const prefixedResponse = await handleConfirm(
    "https://hair.example/auth/confirm?code=expired&next=%2Fplan-start%2Fpreview",
    deps,
  )
  expect(prefixedResponse.headers.get("location")).toBe(
    "https://hair.example/auth?error=link_expired&next=%2Fplan-start%2Fpreview",
  )
})

test("verified PKCE recovery reaches password setup even without a recovery type", async () => {
  const { calls, deps } = confirmDeps({ user: { id: "user-1", email: "user@example.com" } })

  const response = await handleConfirm(
    "https://hair.example/auth/confirm?code=recovery-code&next=%2Fauth%2Fupdate-password&lead=lead-1",
    deps,
  )

  expect(response.headers.get("location")).toBe("https://hair.example/auth/update-password")
  expect(calls).toContainEqual(["linkQuizToProfile", "user-1", "user@example.com", "lead-1"])
})

test("failed PKCE recovery stays on the forced recovery surface", async () => {
  const { deps } = confirmDeps({
    exchangeError: new Error("expired"),
    user: { id: "already-signed-in" },
  })

  const response = await handleConfirm(
    "https://hair.example/auth/confirm?code=expired&next=%2Fauth%2Fupdate-password",
    deps,
  )

  expect(response.headers.get("location")).toBe(
    "https://hair.example/auth?error=link_expired&force=login&next=%2Fauth%2Fupdate-password",
  )
})

test("verified and failed OTP recovery preserve password recovery semantics", async () => {
  const verified = confirmDeps({ user: { id: "user-1" } })
  const verifiedResponse = await handleConfirm(
    "https://hair.example/auth/confirm?token_hash=valid&type=recovery",
    verified.deps,
  )
  expect(verifiedResponse.headers.get("location")).toBe("https://hair.example/auth/update-password")
  expect(verified.calls).toContainEqual(["verifyOtp", { type: "recovery", token_hash: "valid" }])

  const failed = confirmDeps({ otpError: new Error("expired"), user: null })
  const failedResponse = await handleConfirm(
    "https://hair.example/auth/confirm?token_hash=expired&type=recovery",
    failed.deps,
  )
  expect(failedResponse.headers.get("location")).toBe(
    "https://hair.example/auth?error=link_expired&force=login&next=%2Fauth%2Fupdate-password",
  )
})

test("password-reset emails stamp the explicit PKCE recovery destination", () => {
  const redirect = new URL(buildPasswordRecoveryRedirect("https://hair.example"))
  const source = readFileSync("src/components/auth/auth-form.tsx", "utf8")

  expect(`${redirect.pathname}${redirect.search}`).toBe(
    "/auth/confirm?next=%2Fauth%2Fupdate-password",
  )
  expect(source).toMatch(
    /redirectTo:\s*buildPasswordRecoveryRedirect\(\s*window\.location\.origin,\s*buildNextDestination\(next, leadId \?\? null\),\s*\),/,
  )
})

test("rejects missing request body before rate limiting or Stripe work", async () => {
  const { calls, deps } = stubDeps()

  const response = await handleSetCheckoutPassword({}, deps)

  expect(response.status).toBe(400)
  expect(response.body.error).toContain("Session")
  expect(calls).toEqual([])
})

test("rejects weak passwords before changing anything", async () => {
  const { calls, deps } = stubDeps()

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "short" },
    deps,
  )

  expect(response.status).toBe(400)
  expect(response.body.error).toContain("mindestens 8")
  expect(calls).toEqual([])
})

test("returns 429 when the checkout session is rate limited", async () => {
  let rateLimitIdentifier: string | undefined
  const captured: any[] = []
  const { calls, deps } = stubDeps({
    checkRateLimit: async (identifier: string) => {
      rateLimitIdentifier = identifier
      return { allowed: false }
    },
    captureCheckoutException: (_error: unknown, details: Record<string, unknown>) => {
      captured.push(details)
    },
  } as any)

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough" },
    deps,
  )

  expect(response.status).toBe(429)
  expect(response.body.error).toContain("Zu viele")
  expect(rateLimitIdentifier).toBe("cs_test_password")
  expect(calls).toEqual([])
  expect(captured).toEqual([
    expect.objectContaining({
      provider: "stripe",
      stage: "checkout_password_activation",
      rateLimitSource: "app",
      reason: "set_checkout_password_rate_limited",
      status: 429,
    }),
  ])
})

test("returns 503 when the rate-limit service is unavailable", async () => {
  const { deps } = stubDeps({
    checkRateLimit: async () => ({ allowed: false, error: "service_unavailable" }),
  })

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough" },
    deps,
  )

  expect(response.status).toBe(503)
  expect(response.body.error).toContain("Bitte versuche es")
})

test("returns 409 when the checkout account cannot set an initial password", async () => {
  const { deps } = stubDeps({
    ensureCheckoutAccount: async () => ({
      userId: "user-existing",
      email: "stripe@example.com",
      canSetInitialPassword: false,
    }),
  })

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough" },
    deps,
  )

  expect(response.status).toBe(409)
  expect(response.body.error).toBe(
    "Für diese E-Mail gibt es bereits ein Konto. Bitte melde dich an oder nutze den Login-Link.",
  )
})

test("merges app metadata, clears activation hash, and confirms email on success", async () => {
  const { calls, deps } = stubDeps()

  const response = await handleSetCheckoutPassword(
    {
      session_id: "cs_test_password",
      email: "attacker@example.com",
      password: "long-enough",
    },
    deps,
  )

  expect(response).toMatchObject({
    status: 200,
    body: { ok: true, email: "stripe@example.com" },
  })

  const updateCall = calls.find(([op]) => op === "updateUserById")
  expect(updateCall?.[1]).toBe("user-test")
  expect(updateCall?.[2]).toMatchObject({
    password: "long-enough",
    email_confirm: true,
    app_metadata: {
      provider: "email",
      roles: ["member"],
    },
  })
  expect(updateCall?.[2].app_metadata).toHaveProperty("password_initialized_at")
  expect(updateCall?.[2].app_metadata).toHaveProperty("checkout_activation_session_hash", null)
})

test("rejects password creation when the checkout activation was already claimed", async () => {
  const { calls, deps } = stubDeps({
    claimCheckoutActivation: async () => false,
  })

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough" },
    deps,
  )

  expect(response.status).toBe(409)
  expect(response.body.error).toContain("nicht mehr gültig")
  expect(calls.some(([op]) => op === "updateUserById")).toBe(false)
})

test("releases the checkout activation claim if password creation fails", async () => {
  let releasedSessionId: string | undefined
  const { deps } = stubDeps({
    releaseCheckoutActivationClaim: async (_supabase, sessionId) => {
      releasedSessionId = sessionId
    },
  })
  deps.supabase.auth.admin.updateUserById = async () => ({
    data: { user: null },
    error: { message: "update failed" } as any,
  })

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough" },
    deps,
  )

  expect(response.status).toBe(500)
  expect(releasedSessionId).toBe("cs_test_password")
})

test("rejects when the activation marker no longer matches immediately before update", async () => {
  const { calls, supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("cs_other"),
    provider: "email",
  })
  const { deps } = stubDeps({ supabase })

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough" },
    deps,
  )

  expect(response.status).toBe(409)
  expect(response.body.error).toContain("nicht mehr gültig")
  expect(calls.some(([op]) => op === "updateUserById")).toBe(false)
})

test("does not trust client email when verifying or updating checkout activation", async () => {
  let verifiedSessionId: string | undefined
  let ensuredEmail: string | undefined
  const { deps } = stubDeps({
    verifyCheckoutSessionForActivation: async (sessionId) => {
      verifiedSessionId = sessionId
      return checkoutSession({ customer_details: { email: "stripe-owned@example.com" } })
    },
    ensureCheckoutAccount: async (session) => {
      ensuredEmail = session.customer_details?.email ?? undefined
      return {
        userId: "user-test",
        email: "stripe-owned@example.com",
        canSetInitialPassword: true,
      }
    },
  })

  const response = await handleSetCheckoutPassword(
    {
      session_id: "cs_test_password",
      email: "client@example.com",
      password: "long-enough",
    },
    deps,
  )

  expect(response.status).toBe(200)
  expect(response.body.email).toBe("stripe-owned@example.com")
  expect(verifiedSessionId).toBe("cs_test_password")
  expect(ensuredEmail).toBe("stripe-owned@example.com")
})

test("password activation uses the verified Stripe one-time account path", async () => {
  let oneTimeCalls = 0
  let subscriptionCalls = 0
  const { deps } = stubDeps({
    verifyCheckoutSessionForActivation: async () =>
      checkoutSession({ metadata: { product_kind: "personal_plan_once" } }),
    ensureCheckoutAccount: async () => {
      subscriptionCalls += 1
      throw new Error("subscription activation must not run")
    },
    ensureOneTimeCheckoutAccount: async () => {
      oneTimeCalls += 1
      return {
        userId: "user-once",
        email: "stripe@example.com",
        canSetInitialPassword: true,
        state: "active",
        paymentIntentId: "pi-once",
        purchaseId: "purchase-once",
      }
    },
  })

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough" },
    deps,
  )

  expect(response.status).toBe(200)
  expect(oneTimeCalls).toBe(1)
  expect(subscriptionCalls).toBe(0)
})

test("password activation accepts PayPal intent tokens and uses provider-owned email", async () => {
  let rateLimitIdentifier: string | undefined
  let ensuredToken: string | undefined
  const { calls, supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("paypal:I-password"),
    provider: "email",
  })
  const { deps } = stubDeps({
    supabase,
    checkRateLimit: async (identifier) => {
      rateLimitIdentifier = identifier
      return { allowed: true }
    },
    ensurePayPalCheckoutAccountForToken: async (token) => {
      ensuredToken = token
      return {
        status: "active",
        userId: "user-paypal",
        email: "paypal-owned@example.com",
        providerSubscriberEmail: "paypal-owned@example.com",
        canSetInitialPassword: true,
      }
    },
  })

  const response = await handleSetCheckoutPassword(
    {
      provider: "paypal",
      token: "I-password",
      email: "attacker@example.com",
      password: "long-enough",
    },
    deps,
  )

  expect(response).toMatchObject({
    status: 200,
    body: { ok: true, email: "paypal-owned@example.com" },
  })
  expect(rateLimitIdentifier).toBe("paypal:I-password")
  expect(ensuredToken).toBe("I-password")
  const updateCall = calls.find(([op]) => op === "updateUserById")
  expect(updateCall?.[1]).toBe("user-paypal")
  expect(updateCall?.[2].app_metadata).toHaveProperty("checkout_activation_session_hash", null)
})

test("password activation fallback links quiz metadata when fulfilling checkout", async () => {
  let linked: { userId: string; email: string | undefined; leadId: string | undefined } | undefined
  let forwardedLeadId: string | undefined
  const { deps } = stubDeps({
    verifyCheckoutSessionForActivation: async () =>
      checkoutSession({
        id: "cs_test_password",
        customer_details: { email: "stripe@example.com" },
        metadata: { lead_id: "lead-123" },
      }),
    ensureCheckoutAccount: async (session, options) => {
      forwardedLeadId = session.metadata?.lead_id
      await options.linkQuizToProfile?.(
        "user-test",
        "stripe@example.com",
        session.metadata?.lead_id,
      )
      return {
        userId: "user-test",
        email: "stripe@example.com",
        canSetInitialPassword: true,
      }
    },
    linkQuizToProfile: async (userId, email, leadId) => {
      linked = { userId, email, leadId }
    },
  })

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough" },
    deps,
  )

  expect(response.status).toBe(200)
  expect(forwardedLeadId).toBe("lead-123")
  expect(linked).toEqual({
    userId: "user-test",
    email: "stripe@example.com",
    leadId: "lead-123",
  })
})

test("password activation returns the server-resolved personal-plan transition", async () => {
  const { calls, supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("cs_test_password"),
    provider: "email",
  })
  supabase.from = (table: string) => {
    expect(table).toBe("leads")
    return {
      select() {
        return {
          eq() {
            return {
              async maybeSingle() {
                return { data: { quiz_kind: "personal_plan" }, error: null }
              },
            }
          },
        }
      },
    } as any
  }

  const { deps } = stubDeps({
    supabase,
    getPremiumTierId: async () => "tier-premium",
    ensureCheckoutAccount: async () => ({
      userId: "user-test",
      email: "stripe@example.com",
      canSetInitialPassword: true,
      leadId: "lead-v2",
    }),
  })

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough", next: "/onboarding" },
    deps,
  )

  expect(response).toMatchObject({
    status: 200,
    body: {
      ok: true,
      email: "stripe@example.com",
      next: "/plan-bereit?lead=lead-v2",
    },
  })
  expect(calls.some(([op]) => op === "updateUserById")).toBe(true)
})

test("send magic link derives email from checkout activation and consumes matching password marker", async () => {
  const calls: any[] = []
  const supabase = {
    auth: {
      async signInWithOtp(args: Record<string, unknown>) {
        calls.push(["signInWithOtp", args])
        return { data: {}, error: null }
      },
      admin: {
        async getUserById(userId: string) {
          calls.push(["getUserById", userId])
          return {
            data: {
              user: {
                id: userId,
                app_metadata: {
                  checkout_activation_session_hash: sessionHash("cs_magic"),
                  provider: "email",
                },
              },
            },
            error: null,
          }
        },
        async updateUserById(userId: string, patch: Record<string, unknown>) {
          calls.push(["updateUserById", userId, patch])
          return { data: { user: { id: userId } }, error: null }
        },
      },
    },
    from(table: string) {
      return {
        select() {
          calls.push(["select", table])
          return Promise.resolve({
            data: [{ id: "tier-premium", slug: "premium" }],
            error: null,
          })
        },
      }
    },
  } as any
  let rateLimitIdentifier: string | undefined

  const response = await handleSendMagicLink(
    { session_id: "cs_magic", email: "attacker@example.com" },
    {
      stripe: {} as any,
      supabase,
      siteUrl: "https://hair.example",
      now: () => new Date("2026-05-04T12:00:00.000Z"),
      checkRateLimit: async (identifier) => {
        rateLimitIdentifier = identifier
        return { allowed: true }
      },
      verifyCheckoutSessionForActivation: async (sessionId) =>
        checkoutSession({
          id: sessionId,
          customer_details: { email: "stripe-owned@example.com" },
        }),
      ensureCheckoutAccount: async () => ({
        userId: "user-magic",
        email: "stripe-owned@example.com",
        canSetInitialPassword: true,
      }),
      claimCheckoutActivation: async () => true,
      releaseCheckoutActivationClaim: async () => {},
    },
  )

  expect(response).toMatchObject({
    status: 200,
    body: { ok: true, email: "stripe-owned@example.com" },
  })
  expect(rateLimitIdentifier).toBe("cs_magic")

  const otpCall = calls.find(([op]) => op === "signInWithOtp")
  expect(otpCall?.[1]).toMatchObject({
    email: "stripe-owned@example.com",
    options: {
      emailRedirectTo: "https://hair.example/auth/confirm?next=%2Fonboarding",
      shouldCreateUser: false,
    },
  })

  const updateCall = calls.find(([op]) => op === "updateUserById")
  expect(updateCall?.[1]).toBe("user-magic")
  expect(updateCall?.[2].app_metadata).toMatchObject({
    provider: "email",
    activation_method: "passwordless",
    checkout_activation_session_hash: null,
    passwordless_login_sent_at: "2026-05-04T12:00:00.000Z",
  })
})

test("magic-link activation uses the verified Stripe one-time account path", async () => {
  const otpCalls: any[] = []
  const { supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("cs_once_magic"),
    provider: "email",
  })
  supabase.auth.signInWithOtp = async (args: Record<string, unknown>) => {
    otpCalls.push(args)
    return { data: {}, error: null }
  }
  let oneTimeCalls = 0
  let subscriptionCalls = 0

  const response = await handleSendMagicLink(
    { session_id: "cs_once_magic" },
    {
      stripe: {} as any,
      supabase,
      siteUrl: "https://hair.example",
      checkRateLimit: async () => ({ allowed: true }),
      verifyCheckoutSessionForActivation: async () =>
        checkoutSession({ id: "cs_once_magic", metadata: { product_kind: "personal_plan_once" } }),
      ensureCheckoutAccount: async () => {
        subscriptionCalls += 1
        throw new Error("subscription activation must not run")
      },
      ensureOneTimeCheckoutAccount: async () => {
        oneTimeCalls += 1
        return {
          userId: "user-once",
          email: "once@example.com",
          canSetInitialPassword: true,
          state: "active",
          paymentIntentId: "pi-once",
          purchaseId: "purchase-once",
        }
      },
      claimCheckoutActivation: async () => true,
      releaseCheckoutActivationClaim: async () => {},
    },
  )

  expect(response.status).toBe(200)
  expect(oneTimeCalls).toBe(1)
  expect(subscriptionCalls).toBe(0)
  expect(otpCalls[0]).toMatchObject({ email: "once@example.com" })
})

test("Stripe one-time password setup refuses paid-pending activation without setting credentials", async () => {
  const { calls, deps } = stubDeps({
    verifyCheckoutSessionForActivation: async () =>
      checkoutSession({
        id: "cs_test_password",
        metadata: { product_kind: "personal_plan_once" },
      }),
    ensureOneTimeCheckoutAccount: async () => ({
      userId: "user-once",
      email: "once@example.com",
      canSetInitialPassword: true,
      state: "paid_pending",
      paymentIntentId: "pi-once",
      purchaseId: "purchase-once",
    }),
  })

  const response = await handleSetCheckoutPassword(
    { session_id: "cs_test_password", password: "long-enough" },
    deps,
  )

  expect(response).toMatchObject({
    status: 409,
    body: { code: "activation_pending" },
  })
  expect(calls.some(([operation]) => operation === "updateUserById")).toBe(false)
})

test("Stripe one-time magic link refuses paid-pending activation before OTP send", async () => {
  const otpCalls: any[] = []
  const { supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("cs_once_pending_magic"),
    provider: "email",
  })
  supabase.auth.signInWithOtp = async (args: Record<string, unknown>) => {
    otpCalls.push(args)
    return { data: {}, error: null }
  }

  const response = await handleSendMagicLink(
    { session_id: "cs_once_pending_magic" },
    {
      stripe: {} as any,
      supabase,
      siteUrl: "https://hair.example",
      checkRateLimit: async () => ({ allowed: true }),
      verifyCheckoutSessionForActivation: async () =>
        checkoutSession({
          id: "cs_once_pending_magic",
          metadata: { product_kind: "personal_plan_once" },
        }),
      ensureCheckoutAccount: async () => {
        throw new Error("subscription activation must not run")
      },
      ensureOneTimeCheckoutAccount: async () => ({
        userId: "user-once",
        email: "once@example.com",
        canSetInitialPassword: true,
        state: "paid_pending",
        paymentIntentId: "pi-once",
        purchaseId: "purchase-once",
      }),
      claimCheckoutActivation: async () => true,
      releaseCheckoutActivationClaim: async () => {},
    },
  )

  expect(response).toMatchObject({
    status: 409,
    body: { code: "activation_pending" },
  })
  expect(otpCalls).toEqual([])
})

test("PayPal one-time auth recovery uses the canonical order activation, not subscriptions", async () => {
  const { supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("paypal:I-once"),
    provider: "email",
  })
  const { deps } = stubDeps({
    supabase,
    ensurePayPalCheckoutAccountForToken: async () => {
      throw new Error("subscription activation must not run")
    },
    recoverPayPalOrderActivation: async () => ({
      status: "active",
      intent: {} as any,
      account: {
        status: "active",
        userId: "user-paypal-once",
        email: "paypal-once@example.com",
        providerSubscriberEmail: null,
        canSetInitialPassword: true,
      },
    }),
  })

  const response = await handleSetCheckoutPassword(
    { provider: "paypal", purchase: "one_time", token: "I-once", password: "long-enough" },
    deps,
  )

  expect(response).toMatchObject({
    status: 200,
    body: { ok: true, email: "paypal-once@example.com" },
  })
})

test("PayPal one-time password setup refuses paid-pending activation", async () => {
  const { supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("paypal:I-once-pending"),
    provider: "email",
  })
  const { deps } = stubDeps({
    supabase,
    recoverPayPalOrderActivation: async () => ({
      status: "paid_pending",
      intent: {} as any,
      account: {
        status: "active",
        userId: "user-paypal-once",
        email: "paypal-once@example.com",
        providerSubscriberEmail: null,
        canSetInitialPassword: true,
      },
    }),
  })

  const response = await handleSetCheckoutPassword(
    {
      provider: "paypal",
      purchase: "one_time",
      token: "I-once-pending",
      password: "long-enough",
    },
    deps,
  )

  expect(response).toMatchObject({
    status: 409,
    body: { code: "activation_pending" },
  })
})

test("PayPal one-time magic-link recovery uses the canonical order activation", async () => {
  const otpCalls: any[] = []
  const { supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("paypal:I-once-magic"),
    provider: "email",
  })
  supabase.auth.signInWithOtp = async (args: Record<string, unknown>) => {
    otpCalls.push(args)
    return { data: {}, error: null }
  }

  const response = await handleSendMagicLink(
    { provider: "paypal", purchase: "one_time", token: "I-once-magic" },
    {
      stripe: {} as any,
      supabase,
      siteUrl: "https://hair.example",
      checkRateLimit: async () => ({ allowed: true }),
      verifyCheckoutSessionForActivation: async () => {
        throw new Error("Stripe verification must not run")
      },
      ensureCheckoutAccount: async () => {
        throw new Error("subscription activation must not run")
      },
      recoverPayPalOrderActivation: async () => ({
        status: "active",
        intent: {} as any,
        account: {
          status: "active",
          userId: "user-paypal-once",
          email: "paypal-once@example.com",
          providerSubscriberEmail: null,
          canSetInitialPassword: true,
        },
      }),
      claimCheckoutActivation: async () => true,
      releaseCheckoutActivationClaim: async () => {},
    },
  )

  expect(response.status).toBe(200)
  expect(otpCalls[0]).toMatchObject({ email: "paypal-once@example.com" })
})

test("magic-link activation derives the personal-plan destination server-side", async () => {
  const otpCalls: any[] = []
  const { supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("cs_magic_v2"),
    provider: "email",
  })
  supabase.auth.signInWithOtp = async (args: Record<string, unknown>) => {
    otpCalls.push(args)
    return { data: {}, error: null }
  }
  supabase.from = (table: string) => {
    expect(table).toBe("leads")
    return {
      select() {
        return {
          eq() {
            return {
              async maybeSingle() {
                return { data: { quiz_kind: "personal_plan" }, error: null }
              },
            }
          },
        }
      },
    } as any
  }

  const response = await handleSendMagicLink(
    { session_id: "cs_magic_v2", next: "/onboarding" },
    {
      stripe: {} as any,
      supabase,
      siteUrl: "https://hair.example",
      checkRateLimit: async () => ({ allowed: true }),
      getPremiumTierId: async () => "tier-premium",
      verifyCheckoutSessionForActivation: async () =>
        checkoutSession({
          id: "cs_magic_v2",
          customer_details: { email: "v2@example.com" },
        }),
      ensureCheckoutAccount: async () => ({
        userId: "user-v2",
        email: "v2@example.com",
        canSetInitialPassword: true,
        leadId: "lead-v2",
      }),
      claimCheckoutActivation: async () => true,
      releaseCheckoutActivationClaim: async () => {},
    },
  )

  expect(response).toMatchObject({
    status: 200,
    body: { ok: true, next: "/plan-bereit?lead=lead-v2" },
  })
  expect(otpCalls[0]).toMatchObject({
    options: {
      emailRedirectTo: "https://hair.example/auth/confirm?next=%2Fplan-bereit%3Flead%3Dlead-v2",
    },
  })
})

test("send magic link accepts PayPal intent tokens and consumes the provider marker", async () => {
  const calls: any[] = []
  let rateLimitIdentifier: string | undefined
  const { supabase } = stubSupabase({
    checkout_activation_session_hash: sessionHash("paypal:I-magic"),
    provider: "email",
  })
  supabase.auth.signInWithOtp = async (args: Record<string, unknown>) => {
    calls.push(["signInWithOtp", args])
    return { data: {}, error: null }
  }
  const originalUpdateUserById = supabase.auth.admin.updateUserById
  supabase.auth.admin.updateUserById = async (userId: string, patch: Record<string, unknown>) => {
    calls.push(["updateUserById", userId, patch])
    return originalUpdateUserById(userId, patch)
  }

  const response = await handleSendMagicLink(
    {
      provider: "paypal",
      token: "I-magic",
      email: "attacker@example.com",
    },
    {
      stripe: {} as any,
      supabase,
      siteUrl: "https://hair.example",
      now: () => new Date("2026-05-04T12:00:00.000Z"),
      checkRateLimit: async (identifier) => {
        rateLimitIdentifier = identifier
        return { allowed: true }
      },
      verifyCheckoutSessionForActivation: async () => checkoutSession(),
      ensureCheckoutAccount: async () => ({
        userId: "unused",
        email: "unused@example.com",
        canSetInitialPassword: true,
      }),
      ensurePayPalCheckoutAccountForToken: async () => ({
        status: "active",
        userId: "user-paypal",
        email: "paypal-owned@example.com",
        providerSubscriberEmail: "paypal-owned@example.com",
        canSetInitialPassword: true,
      }),
      claimCheckoutActivation: async () => true,
      releaseCheckoutActivationClaim: async () => {},
    },
  )

  expect(response).toMatchObject({
    status: 200,
    body: { ok: true, email: "paypal-owned@example.com" },
  })
  expect(rateLimitIdentifier).toBe("paypal:I-magic")
  const otpCall = calls.find(([op]) => op === "signInWithOtp")
  expect(otpCall?.[1]).toMatchObject({ email: "paypal-owned@example.com" })
  const updateCall = calls.find(([op]) => op === "updateUserById")
  expect(updateCall?.[2].app_metadata).toMatchObject({
    activation_method: "passwordless",
    checkout_activation_session_hash: null,
    passwordless_login_sent_at: "2026-05-04T12:00:00.000Z",
  })
})

test("send magic link stays successful if activation marker cleanup fails after OTP send", async () => {
  const { deps } = stubDeps()
  const captured: any[] = []
  deps.supabase.auth.signInWithOtp = async () => ({
    data: { user: null, session: null },
    error: null,
  })
  deps.supabase.auth.admin.getUserById = async () => ({
    data: { user: null },
    error: { message: "user lookup failed" } as any,
  })

  const response = await handleSendMagicLink({ session_id: "cs_magic" }, {
    stripe: deps.stripe,
    supabase: deps.supabase,
    siteUrl: "https://hair.example",
    checkRateLimit: deps.checkRateLimit,
    verifyCheckoutSessionForActivation: deps.verifyCheckoutSessionForActivation,
    ensureCheckoutAccount: deps.ensureCheckoutAccount,
    claimCheckoutActivation: async () => true,
    releaseCheckoutActivationClaim: async () => {},
    captureCheckoutException: (_error: unknown, details: Record<string, unknown>) => {
      captured.push(details)
    },
  } as any)

  expect(response.status).toBe(200)
  expect(captured).toEqual([
    expect.objectContaining({
      provider: "stripe",
      stage: "checkout_magic_link_activation",
      reason: "activation_marker_cleanup_failed_after_otp",
      status: 200,
    }),
  ])
})

test("magic-link activation fallback links quiz metadata when fulfilling checkout", async () => {
  const { deps } = stubDeps()
  let linked: { userId: string; email: string | undefined; leadId: string | undefined } | undefined
  const response = await handleSendMagicLink(
    { session_id: "cs_magic" },
    {
      stripe: deps.stripe,
      supabase: {
        ...deps.supabase,
        auth: {
          ...deps.supabase.auth,
          signInWithOtp: async () => ({ data: {}, error: null }),
        },
      } as any,
      siteUrl: "https://hair.example",
      checkRateLimit: deps.checkRateLimit,
      verifyCheckoutSessionForActivation: async () =>
        checkoutSession({
          id: "cs_magic",
          metadata: { lead_id: "lead-magic" },
        }),
      ensureCheckoutAccount: async (session, options) => {
        await options.linkQuizToProfile?.(
          "user-test",
          "stripe@example.com",
          session.metadata?.lead_id,
        )
        return {
          userId: "user-test",
          email: "stripe@example.com",
          canSetInitialPassword: true,
        }
      },
      linkQuizToProfile: async (userId, email, leadId) => {
        linked = { userId, email, leadId }
      },
      claimCheckoutActivation: async () => true,
      releaseCheckoutActivationClaim: async () => {},
    },
  )

  expect(response.status).toBe(200)
  expect(linked).toEqual({
    userId: "user-test",
    email: "stripe@example.com",
    leadId: "lead-magic",
  })
})

test("send magic link rejects when the checkout activation was already claimed", async () => {
  const { deps } = stubDeps()
  const response = await handleSendMagicLink(
    { session_id: "cs_magic" },
    {
      stripe: deps.stripe,
      supabase: deps.supabase,
      siteUrl: "https://hair.example",
      checkRateLimit: deps.checkRateLimit,
      verifyCheckoutSessionForActivation: deps.verifyCheckoutSessionForActivation,
      ensureCheckoutAccount: deps.ensureCheckoutAccount,
      claimCheckoutActivation: async () => false,
      releaseCheckoutActivationClaim: async () => {},
    },
  )

  expect(response.status).toBe(409)
  expect(response.body.error).toContain("nicht mehr gültig")
})

test("send magic link reports app rate limits to checkout Sentry context", async () => {
  const { deps } = stubDeps()
  const captured: any[] = []
  const response = await handleSendMagicLink({ session_id: "cs_magic" }, {
    stripe: deps.stripe,
    supabase: deps.supabase,
    siteUrl: "https://hair.example",
    checkRateLimit: async () => ({ allowed: false }),
    verifyCheckoutSessionForActivation: deps.verifyCheckoutSessionForActivation,
    ensureCheckoutAccount: deps.ensureCheckoutAccount,
    claimCheckoutActivation: async () => true,
    releaseCheckoutActivationClaim: async () => {},
    captureCheckoutException: (_error: unknown, details: Record<string, unknown>) => {
      captured.push(details)
    },
  } as any)

  expect(response.status).toBe(429)
  expect(captured).toEqual([
    expect.objectContaining({
      provider: "stripe",
      stage: "checkout_magic_link_activation",
      rateLimitSource: "app",
      reason: "send_auth_link_rate_limited",
      status: 429,
    }),
  ])
})

test("send magic link releases the checkout activation claim if email sending fails", async () => {
  const { deps } = stubDeps()
  let releasedSessionId: string | undefined
  deps.supabase.auth.signInWithOtp = async () => ({
    data: { user: null, session: null },
    error: { message: "email failed" } as any,
  })

  const response = await handleSendMagicLink(
    { session_id: "cs_magic" },
    {
      stripe: deps.stripe,
      supabase: deps.supabase,
      siteUrl: "https://hair.example",
      checkRateLimit: deps.checkRateLimit,
      verifyCheckoutSessionForActivation: deps.verifyCheckoutSessionForActivation,
      ensureCheckoutAccount: deps.ensureCheckoutAccount,
      claimCheckoutActivation: async () => true,
      releaseCheckoutActivationClaim: async (_supabase, sessionId) => {
        releasedSessionId = sessionId
      },
    },
  )

  expect(response.status).toBe(500)
  expect(releasedSessionId).toBe("cs_magic")
})

test("send magic link reports Supabase Auth email-send rate limits to checkout Sentry context", async () => {
  const { deps } = stubDeps()
  const captured: any[] = []
  deps.supabase.auth.signInWithOtp = async () => ({
    data: { user: null, session: null },
    error: {
      message: "Email rate limit exceeded",
      error_code: "over_email_send_rate_limit",
      status: 429,
    } as any,
  })

  const response = await handleSendMagicLink({ session_id: "cs_magic" }, {
    stripe: deps.stripe,
    supabase: deps.supabase,
    siteUrl: "https://hair.example",
    checkRateLimit: deps.checkRateLimit,
    verifyCheckoutSessionForActivation: deps.verifyCheckoutSessionForActivation,
    ensureCheckoutAccount: deps.ensureCheckoutAccount,
    claimCheckoutActivation: async () => true,
    releaseCheckoutActivationClaim: async () => {},
    captureCheckoutException: (_error: unknown, details: Record<string, unknown>) => {
      captured.push(details)
    },
  } as any)

  expect(response.status).toBe(500)
  expect(captured).toEqual([
    expect.objectContaining({
      provider: "stripe",
      stage: "checkout_magic_link_activation",
      rateLimitSource: "supabase_auth",
      reason: "supabase_auth_email_rate_limit",
      status: 429,
    }),
  ])
})

test("send magic link requires only session_id and reports non-leaky German errors", async () => {
  const { deps } = stubDeps()
  const response = await handleSendMagicLink(
    {},
    {
      stripe: deps.stripe,
      supabase: deps.supabase,
      siteUrl: "https://hair.example",
      checkRateLimit: deps.checkRateLimit,
      verifyCheckoutSessionForActivation: deps.verifyCheckoutSessionForActivation,
      ensureCheckoutAccount: deps.ensureCheckoutAccount,
    },
  )

  expect(response.status).toBe(400)
  expect(response.body.error).toBe("Bitte öffne den Aktivierungslink erneut.")
})

test("deprecated setup link route returns 410 without side effects", async () => {
  const response = await handleSendSetupLink()

  expect(response).toEqual({
    status: 410,
    body: {
      error: "Dieser Link wird nicht mehr verwendet. Bitte kehre zur Kontoaktivierung zurück.",
    },
  })
})

test("welcome activation UI renders both equal checkout choices with a read-only email", async () => {
  const source = readFileSync("src/app/welcome/welcome-client.tsx", "utf-8")

  expect(source).toContain("Zahlung erfolgreich")
  expect(source).toContain("Konto aktivieren")
  expect(source).toContain("readOnly")
  expect(source).toContain("Mit Passwort fortfahren")
  expect(source).toContain(
    "Erstelle ein Passwort und melde dich künftig direkt mit deiner E-Mail an.",
  )
  expect(source).toContain("Passwort wiederholen")
  expect(source).toContain("Passwort erstellen")
  expect(source).toContain("Ohne Passwort fortfahren")
  expect(source).toContain(
    "Wir senden dir einen sicheren Login-Link. Du klickst ihn im Postfach an und bist direkt angemeldet.",
  )
  expect(source).toContain("Login-Link senden")
  expect(source).not.toContain("send-setup-link")
  expect(source).not.toContain("zuruecksetzen")
})

test("magic link template keeps Supabase redirect target instead of hardcoding onboarding", async () => {
  const source = readFileSync("supabase/templates/magic-link.html", "utf-8")

  expect(source).toContain("redirect_to={{ .RedirectTo }}")
  expect(source).not.toContain("next=/onboarding")
})
