import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { loadLocalEnvironment, stack } from "./local-stack.mjs"

async function main() {
  const environment = loadLocalEnvironment()
  const admin = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const base = "http://127.0.0.1:3218/api/mobile/v1"
  async function post(path: string, body: unknown, token?: string) {
    const response = await fetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
  }
  async function captured(email: string) {
    // Mailpit is private to this isolated local stack. Do not emit message bodies.
    for (let attempt = 0; attempt < 30; attempt++) {
      const index = await fetch("http://127.0.0.1:54324/api/v1/messages").then((r) => r.json())
      for (const item of index.messages ?? []) {
        if (!(item.To ?? []).some((to: { Address: string }) => to.Address === email)) continue
        const message = await fetch(`http://127.0.0.1:54324/api/v1/message/${item.ID}`).then((r) =>
          r.json(),
        )
        const html = decodeURIComponent(message.HTML as string)
        const code = /<strong>(\d{8})<\/strong>/.exec(html)?.[1]
        const attemptId = /attemptId=([a-f0-9-]{36})/.exec(html)?.[1]
        const tokenHash = /tokenHash=([a-zA-Z0-9_-]+)/.exec(html)?.[1]
        if (code && attemptId && tokenHash) return { code, attemptId, tokenHash }
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error("Expected isolated test email was not captured")
  }

  const accountsBefore = await admin.auth.admin.listUsers()
  assert.equal(accountsBefore.error, null)
  const unknown = await post("/auth/start", { email: "scanner-unknown@example.test" })
  assert.equal(unknown.status, 200)
  const accountsAfter = await admin.auth.admin.listUsers()
  assert.equal(accountsAfter.data.users.length, accountsBefore.data.users.length)
  assert.ok(!accountsAfter.data.users.some((user) => user.email === "scanner-unknown@example.test"))
  const expired = await admin
    .from("mobile_auth_attempts")
    .update({ expires_at: "2026-01-01T00:00:00Z" })
    .eq("id", unknown.body.attemptId)
  assert.equal(expired.error, null)
  assert.equal(
    (await post("/auth/verify", { attemptId: unknown.body.attemptId, code: "00000000" })).status,
    401,
  )

  const email = "scanner-free@example.test"
  const started = await post("/auth/start", { email })
  assert.equal(started.status, 200)
  const mail = await captured(email)
  assert.equal(mail.attemptId, started.body.attemptId)
  assert.equal(
    (await post("/auth/verify", { attemptId: mail.attemptId, code: "00000000" })).status,
    401,
  )
  const verified = await post("/auth/verify", { attemptId: mail.attemptId, code: mail.code })
  assert.equal(verified.status, 200)
  assert.equal(
    (await post("/auth/verify", { attemptId: mail.attemptId, tokenHash: mail.tokenHash })).status,
    401,
  )
  const refreshed = await post("/auth/refresh", { refreshToken: verified.body.refreshToken })
  assert.equal(refreshed.status, 200)
  assert.equal(refreshed.body.userId, verified.body.userId)
  const free = refreshed.body
  const bootstrap = await fetch(base + "/bootstrap", {
    headers: { Authorization: `Bearer ${free.accessToken}` },
  })
  assert.equal(bootstrap.status, 200)
  assert.equal((await bootstrap.json()).status, "ready")

  const next = await post("/auth/start", { email: "scanner-detailed@example.test" })
  assert.equal(next.status, 200)
  const secondMail = await captured("scanner-detailed@example.test")
  const second = await post("/auth/verify", {
    attemptId: secondMail.attemptId,
    tokenHash: secondMail.tokenHash,
  })
  assert.equal(second.status, 200)
  assert.notEqual(second.body.userId, free.userId)
  assert.equal(
    (await post("/auth/verify", { attemptId: secondMail.attemptId, code: secondMail.code })).status,
    401,
  )

  const incompleteStart = await post("/auth/start", { email: "scanner-incomplete@example.test" })
  assert.equal(incompleteStart.status, 200)
  const incompleteMail = await captured("scanner-incomplete@example.test")
  const incomplete = await post("/auth/verify", {
    attemptId: incompleteMail.attemptId,
    code: incompleteMail.code,
  })
  assert.equal(incomplete.status, 200)
  const unavailable = await fetch(base + "/bootstrap", {
    headers: { Authorization: `Bearer ${incomplete.body.accessToken}` },
  }).then((r) => r.json())
  assert.equal(unavailable.status, "profile_required")

  writeFileSync(
    resolve(stack, "integration-sessions.json"),
    JSON.stringify({ free, detailed: second.body, incomplete: incomplete.body }),
    { mode: 0o600 },
  )
  console.log(
    "PASS real local auth: no unknown signup, expired attempt, wrong code, code→link and link→code replay, real refresh, free admission, incomplete denial, distinct owners. Sessions retained only in ignored local mode-0600 fixture file.",
  )
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local auth integration failed")
  process.exitCode = 1
})
