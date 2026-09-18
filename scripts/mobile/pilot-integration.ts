/** Real isolated Auth/PostgREST pilot proof. No deployment, production target, or external mail. */
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { loadLocalEnvironment } from "./local-stack.mjs"
import { POST as start } from "../../src/app/api/mobile/v1/auth/start/route"
import { POST as verify } from "../../src/app/api/mobile/v1/auth/verify/route"
import { POST as refresh } from "../../src/app/api/mobile/v1/auth/refresh/route"
import { POST as logout } from "../../src/app/api/mobile/v1/auth/logout/route"
import { GET as bootstrap } from "../../src/app/api/mobile/v1/bootstrap/route"
import {
  readPilotConfig,
  openCredential,
} from "../../supabase/functions/_shared/mobile-credentials"
import { buildPilotAwareEmails } from "../../supabase/functions/send-email/pilot-message-builder"
const email = "scanner-free@example.test"
function req(path: string, body?: unknown, token?: string) {
  return new Request(`http://127.0.0.1:3224/api/mobile/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
async function main() {
  const environment = loadLocalEnvironment()
  assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:55321")
  Object.assign(process.env, environment)
  const admin = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const provider = () =>
    createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  const users = await admin.auth.admin.listUsers()
  assert.equal(users.error, null)
  const owner = users.data.users.find((u) => u.email === email)
  assert.ok(owner)
  Object.assign(process.env, {
    MOBILE_AUTH_MODE: "pilot",
    MOBILE_PILOT_ENABLED: "true",
    MOBILE_PILOT_AUDIENCE: "https://chaarlie.de/api/mobile/v1",
    MOBILE_PILOT_ENVIRONMENT: "isolated-proof",
    MOBILE_PILOT_EXPIRES_AT: new Date(Date.now() + 3600_000).toISOString(),
    MOBILE_PILOT_ACCOUNTS: JSON.stringify([{ email, userId: owner.id }]),
    MOBILE_PILOT_ACTIVE_KEY_ID: "synthetic",
    MOBILE_PILOT_KEYS: JSON.stringify({ synthetic: randomBytes(32).toString("base64url") }),
    MOBILE_AUTH_CALLBACK_URL: "chaarlie-pilot://auth",
  })
  const config = readPilotConfig(process.env)
  const originalFetch = globalThis.fetch
  const paths: string[] = []
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    )
    assert.ok(
      url.hostname === "127.0.0.1" && ["55321", "55324"].includes(url.port),
      "Only owned loopback providers allowed",
    )
    paths.push(url.pathname)
    return originalFetch(input, init)
  }
  try {
    const denied = await start(req("auth/start", { email: "scanner-detailed@example.test" }))
    assert.equal(denied.status, 401)
    assert.deepEqual(paths, [])
    const started = await start(req("auth/start", { email }))
    assert.equal(started.status, 200)
    const attemptId = (await started.json()).attemptId
    // Local Mailpit transports a real Auth code. The hosted send-email hook itself is not deployed here.
    let code = "",
      rawHash = ""
    for (let i = 0; i < 30 && !code; i++) {
      const index = await fetch("http://127.0.0.1:55324/api/v1/messages").then((r) => r.json())
      for (const item of index.messages ?? []) {
        if (!(item.To ?? []).some((to: { Address: string }) => to.Address === email)) continue
        const message = await fetch(`http://127.0.0.1:55324/api/v1/message/${item.ID}`).then((r) =>
          r.json(),
        )
        const html = decodeURIComponent(message.HTML as string)
        if (!html.includes(attemptId)) continue
        code = /<strong>(\d{8})<\/strong>/.exec(html)?.[1] ?? ""
        rawHash = /tokenHash=([a-zA-Z0-9_-]+)/.exec(html)?.[1] ?? ""
      }
      if (!code) await new Promise((r) => setTimeout(r, 200))
    }
    assert.ok(code && rawHash, "Real local code/link captured")
    assert.equal((await verify(req("auth/verify", { attemptId, code: "00000000" }))).status, 401)
    const verified = await verify(req("auth/verify", { attemptId, code }))
    assert.equal(verified.status, 200)
    const first = await verified.json()
    assert.equal((await bootstrap(req("bootstrap", undefined, first.accessToken))).status, 200)
    assert.equal((await verify(req("auth/verify", { attemptId, code }))).status, 401)
    const firstRefresh = await refresh(req("auth/refresh", { refreshToken: first.refreshToken }))
    assert.equal(firstRefresh.status, 200)
    const child = await firstRefresh.json()
    // Reuse the immediate parent to model a successful provider rotation with a lost HTTP response.
    const recovered = await refresh(req("auth/refresh", { refreshToken: first.refreshToken }))
    assert.equal(recovered.status, 200)
    const recoveredBody = await recovered.json()
    assert.equal(
      (await openCredential(config, recoveredBody.refreshToken, "refresh")).credential,
      (await openCredential(config, child.refreshToken, "refresh")).credential,
    )
    assert.equal(
      (await openCredential(config, recoveredBody.accessToken, "access")).sessionId,
      (await openCredential(config, first.accessToken, "access")).sessionId,
    )
    // Independent same-account web session: mobile rejects its raw JWT and cannot sign it out.
    const webLink = await admin.auth.admin.generateLink({ type: "magiclink", email })
    assert.equal(webLink.error, null)
    const web = await provider().auth.verifyOtp({
      token_hash: webLink.data.properties.hashed_token,
      type: "email",
    })
    assert.equal(web.error, null)
    assert.ok(web.data.session)
    paths.length = 0
    assert.equal((await logout(req("auth/logout", {}, web.data.session.access_token))).status, 401)
    assert.deepEqual(paths, [])
    assert.equal((await logout(req("auth/logout", {}, recoveredBody.accessToken))).status, 200)
    assert.equal(
      (await refresh(req("auth/refresh", { refreshToken: recoveredBody.refreshToken }))).status,
      401,
    )
    assert.equal(
      (await provider().auth.refreshSession({ refresh_token: web.data.session.refresh_token }))
        .error,
      null,
    )
    // Real provider hash through the local hook adapter, with strict attempt binding before consumption.
    const another = await admin.rpc("mobile_start_auth_attempt", { p_email: email })
    assert.equal(another.error, null)
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email })
    assert.equal(link.error, null)
    const messages = await buildPilotAwareEmails(
      {
        user: { id: owner.id, email },
        email_data: {
          email_action_type: "magiclink",
          token_hash: link.data.properties.hashed_token,
          token: link.data.properties.email_otp,
          redirect_to: `chaarlie-pilot://auth#attemptId=${another.data}`,
        },
      },
      { siteUrl: "https://chaarlie.de" },
      process.env,
    )
    const proof = new URLSearchParams(
      new URL(messages[0].message_data.confirmation_url).hash.slice(1),
    ).get("tokenHash")!
    paths.length = 0
    assert.equal(
      (
        await verify(
          req("auth/verify", {
            attemptId: another.data,
            tokenHash: link.data.properties.hashed_token,
          }),
        )
      ).status,
      401,
    )
    assert.deepEqual(paths, [])
    const linkRace = await Promise.all([
      verify(req("auth/verify", { attemptId: another.data, tokenHash: proof })),
      verify(req("auth/verify", { attemptId: another.data, tokenHash: proof })),
    ])
    assert.deepEqual(linkRace.map((response) => response.status).sort(), [200, 401])
    const linked = linkRace.find((response) => response.status === 200)!
    assert.equal(
      (await verify(req("auth/verify", { attemptId: another.data, tokenHash: proof }))).status,
      401,
    )
    const linkedSession = await linked.json()
    assert.equal((await logout(req("auth/logout", {}, linkedSession.accessToken))).status, 200)
    console.log(
      "PASS real isolated pilot: OTP code and signed link, concurrent verification single winner and one-use replay, account gate, profile admission, provider refresh rotation/immediate-parent recovery, raw web-token denial, same-session logout and independent web-session survival. No credentials emitted. Hook adapter invoked locally; no deployed hook/template proof claimed.",
    )
  } finally {
    globalThis.fetch = originalFetch
  }
}
main().catch((error: unknown) => {
  console.error(
    "FAIL isolated pilot proof",
    error instanceof Error
      ? error.stack
          ?.split("\n")
          .filter((line) => line.trim().startsWith("at "))
          .slice(0, 3)
      : "unknown",
  )
  process.exitCode = 1
})
