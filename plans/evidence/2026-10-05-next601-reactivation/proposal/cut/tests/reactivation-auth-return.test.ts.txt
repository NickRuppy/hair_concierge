import assert from "node:assert/strict"
import test from "node:test"
import * as destinations from "../src/lib/reactivation/return-destination"

// A session-expiry redirect must retain the selected plan, without accepting a
// nested arbitrary navigation target or account/attempt identity from the URL.
test("reauthentication preserves each plan and an allowlisted member destination", () => {
  const build = (destinations as Record<string, unknown>).buildReactivationSignInUrl as (
    interval: string | undefined,
    destination: string | undefined,
  ) => string
  assert.equal(typeof build, "function")
  for (const interval of ["month", "quarter", "year"]) {
    const auth = new URL(build(interval, "/routine?view=week"), "https://chaarlie.de")
    assert.equal(auth.pathname, "/auth")
    assert.equal(auth.searchParams.get("reason"), "session_expired")
    const next = new URL(auth.searchParams.get("next")!, auth.origin)
    assert.equal(next.pathname, "/reactivate")
    assert.equal(next.searchParams.get("interval"), interval)
    assert.equal(next.searchParams.get("next"), "/routine?view=week")
    assert.deepEqual([...next.searchParams.keys()], ["interval", "next"])
  }
})

test("reauthentication validates interval and rejects external or recursive destinations", () => {
  const build = (destinations as Record<string, unknown>).buildReactivationSignInUrl as (
    interval: string | undefined,
    destination: string | undefined,
  ) => string
  assert.equal(typeof build, "function")
  for (const destination of [
    "https://evil.example",
    "//evil.example",
    "/chat?next=https://evil.example",
    "/chat?%72edirect_to=/profile",
    "/reactivate",
    "/%2Fchat",
    "/chat\\evil",
    "/chat%0a",
  ]) {
    const auth = new URL(build("invalid", destination), "https://chaarlie.de")
    const next = new URL(auth.searchParams.get("next")!, auth.origin)
    assert.equal(next.searchParams.get("interval"), "quarter")
    assert.equal(next.searchParams.get("next"), "/chat", destination)
  }
})

test("only our welcome verifier is accepted as a status destination", () => {
  const read = destinations.readReactivationStatusDestination
  assert.equal(
    read("/welcome?provider=paypal&token=owned", "https://chaarlie.de"),
    "/welcome?provider=paypal&token=owned",
  )
  for (const value of [
    "https://evil.example/welcome",
    "//evil.example/welcome",
    "/auth?next=/welcome",
    "/welcome#redirect",
    "\\\\evil.example/welcome",
    null,
  ]) {
    assert.equal(read(value, "https://chaarlie.de"), null)
  }
})

test("the real server page retains the plan for signed-out users and redirects current access before rendering checkout", async () => {
  const { readFileSync } = await import("node:fs")
  const { runInNewContext } = await import("node:vm")
  const ts = await import("typescript")
  const source = readFileSync(new URL("../src/app/reactivate/page.tsx", import.meta.url), "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  let user: { id: string; email: string } | null = null
  const redirects: string[] = []
  const owners: unknown[] = []
  const exports: { default?: (input: unknown) => Promise<unknown> } = {}
  const redirectSignal = new Error("redirect")
  runInNewContext(compiled, {
    exports,
    console,
    require(id: string) {
      if (id === "next/navigation")
        return {
          redirect: (href: string) => {
            redirects.push(href)
            throw redirectSignal
          },
        }
      if (id === "@/lib/reactivation/return-destination") return destinations
      if (id === "@/lib/supabase/server")
        return {
          createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
        }
      if (id === "@/lib/billing/subscriptions")
        return {
          hasCurrentAppAccess: async (_client: unknown, owner: unknown) => {
            owners.push(owner)
            return true
          },
        }
      return {}
    },
  })
  await assert.rejects(
    exports.default!({ searchParams: Promise.resolve({ interval: "year", next: "/routine" }) }),
    (error) => error === redirectSignal,
  )
  const auth = new URL(redirects[0], "https://chaarlie.de")
  const destination = new URL(auth.searchParams.get("next")!, auth.origin)
  assert.equal(destination.searchParams.get("interval"), "year")
  assert.equal(destination.searchParams.get("next"), "/routine")
  assert.deepEqual(owners, [])

  user = { id: "newly-signed-in-account", email: "canonical@example.test" }
  await assert.rejects(
    exports.default!({ searchParams: Promise.resolve({ interval: "year", next: "/routine" }) }),
    (error) => error === redirectSignal,
  )
  assert.equal(redirects[1], "/routine")
  assert.equal(
    JSON.stringify(owners),
    JSON.stringify([{ userId: "newly-signed-in-account", email: "canonical@example.test" }]),
  )
})
