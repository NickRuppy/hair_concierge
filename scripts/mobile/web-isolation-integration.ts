import assert from "node:assert/strict"
import { createServerClient } from "@supabase/ssr"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { loadLocalEnvironment, stack } from "./local-stack.mjs"

async function main() {
  const environment = loadLocalEnvironment()
  const sessions = JSON.parse(readFileSync(resolve(stack, "integration-sessions.json"), "utf8"))
  const origin = "http://127.0.0.1:3218"
  for (const [kind, expected] of [
    ["free", 403],
    ["detailed", 200],
  ] as const) {
    const saved = sessions[kind]
    const cookies = new Map<string, string>()
    const client = createServerClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
          setAll: (values) => {
            for (const { name, value } of values) cookies.set(name, value)
          },
        },
      },
    )
    const installed = await client.auth.setSession({
      access_token: saved.accessToken,
      refresh_token: saved.refreshToken,
    })
    assert.ok(!installed.error, "Local web cookie session failed")
    const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ")
    const response = await fetch(origin + "/api/profile?platform=ios", {
      headers: { cookie },
      redirect: "manual",
    })
    assert.equal(
      response.status,
      expected,
      `${kind} web access must retain existing billing authority`,
    )
    const webScan = await fetch(origin + "/api/scan/resolve?platform=ios", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "10000000-0000-4000-8000-000000000001" }),
      redirect: "manual",
    })
    assert.equal(webScan.status, expected, `${kind} composed web scanner access`)
    if (kind === "detailed") {
      const webResult = await webScan.json()
      assert.equal(webResult.kind, "in_catalog", "Shared web context must produce a verdict")
      assert.equal(webResult.product.productId, "10000000-0000-4000-8000-000000000001")
      assert.ok(
        !JSON.stringify(webResult).includes('"mobileDimensions"'),
        "Native dimensions stay server-only",
      )
      assert.ok(
        !JSON.stringify(webResult).includes('"mobileAuthority"'),
        "Native authority stays server-only",
      )
    }
  }
  const headers = {
    Authorization: `Bearer ${sessions.free.accessToken}`,
    "Content-Type": "application/json",
  }
  const forged = await fetch(origin + "/api/mobile/v1/scan/resolve", {
    method: "POST",
    headers,
    body: JSON.stringify({
      productId: "10000000-0000-4000-8000-000000000001",
      userId: sessions.detailed.userId,
    }),
  })
  assert.equal(forged.status, 400, "Client must not select the owner")
  const barcode = await fetch(origin + "/api/mobile/v1/scan/resolve", {
    method: "POST",
    headers,
    body: JSON.stringify({ identifier: { type: "ean", value: "4006381333931" } }),
  })
  assert.equal(barcode.status, 200, "Real barcode route")
  const result = await barcode.json()
  assert.equal(result.kind, "assessment")
  assert.equal(result.product.id, "10000000-0000-4000-8000-000000000001", "Barcode exact identity")
  console.log(
    "PASS actual web cookies: free denied, paid admitted for Profile and composed scanner with freemium off; native metadata absent from web wire; platform hint cannot bypass; native owner injection denied and EAN resolves exact product.",
  )
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Web isolation failed")
  process.exitCode = 1
})
