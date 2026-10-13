import assert from "node:assert/strict"
import test from "node:test"
import { isLocalDevLoginHost, normalizeLocalDevNext } from "../src/lib/dev/local-login"

test("local dev login next defaults to chat for unsafe destinations", () => {
  assert.equal(normalizeLocalDevNext(null), "/chat")
  assert.equal(normalizeLocalDevNext("https://example.com"), "/chat")
  assert.equal(normalizeLocalDevNext("//example.com"), "/chat")
  assert.equal(normalizeLocalDevNext("/\\example"), "/chat")
})

test("local dev login next preserves safe app-relative destinations", () => {
  assert.equal(normalizeLocalDevNext("/chat"), "/chat")
  assert.equal(normalizeLocalDevNext("/chat?debug=1"), "/chat?debug=1")
})

test("local dev login is only allowed on localhost hosts", () => {
  assert.equal(isLocalDevLoginHost("localhost"), true)
  assert.equal(isLocalDevLoginHost("127.0.0.1"), true)
  assert.equal(isLocalDevLoginHost("::1"), true)
  assert.equal(isLocalDevLoginHost("example.com"), false)
})

test("local dev gate accepts loopback authorities with optional ports", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3217", "::1", "[::1]", "[::1]:3000"]) {
    assert.equal(isLocalDevLoginHost(host), true, host)
  }
  for (const host of [
    "localhost.evil.test",
    "localhost@evil.test",
    "127.0.0.2",
    "[::1]:oops",
    "localhost:3000,evil.test",
  ]) {
    assert.equal(isLocalDevLoginHost(host), false, host)
  }
})

test("local dev gate rejects remote socket and forwarded clients despite a spoofed local Host", () => {
  for (const remoteAddress of ["192.168.1.23", "203.0.113.7", "2001:db8::1"]) {
    assert.equal(
      isLocalDevLoginHost("localhost", {
        headers: new Headers(),
        socket: { remoteAddress },
      }),
      false,
      remoteAddress,
    )
  }
  for (const headers of Array.of<Record<string, string>>(
    { "x-forwarded-for": "203.0.113.7" },
    { "x-forwarded-for": "127.0.0.1, 203.0.113.7" },
    { "x-forwarded-host": "evil.test" },
    { "x-real-ip": "192.168.1.23" },
    { forwarded: "for=203.0.113.7;host=localhost:3000;proto=http" },
    { forwarded: 'for="[2001:db8::1]:1234"' },
    { forwarded: "for=unknown" },
  )) {
    assert.equal(
      isLocalDevLoginHost("localhost", { headers: new Headers(headers) }),
      false,
      JSON.stringify(headers),
    )
  }
  assert.equal(
    isLocalDevLoginHost("localhost", {
      headers: new Headers({
        "x-forwarded-for": "::ffff:127.0.0.1",
        forwarded: 'for="[::1]:1234";host=localhost:3000',
      }),
      socket: { remoteAddress: "::ffff:127.0.0.1" },
    }),
    true,
  )
})

test("dev login rejects a remote Host even when Next's URL is localhost", async () => {
  const env = process.env as Record<string, string | undefined>
  const keys = ["NODE_ENV", "LOCAL_DEV_LOGIN_ENABLED", "NEXT_PUBLIC_SUPABASE_URL"]
  const previous = keys.map((key) => env[key])
  try {
    env.NODE_ENV = "development"
    env.LOCAL_DEV_LOGIN_ENABLED = "1"
    delete env.NEXT_PUBLIC_SUPABASE_URL
    const { NextRequest } = await import("next/server")
    const { GET } = await import("../src/app/api/dev/login/route")
    for (const headers of Array.of<Record<string, string>>(
      { host: "192.168.1.23:3000" },
      { host: "localhost:3000", "x-forwarded-for": "203.0.113.7" },
      {},
    )) {
      const response = await GET(
        new NextRequest("http://localhost:3000/api/dev/login", { headers }),
      )
      assert.equal(response.status, 404)
      assert.equal(response.headers.get("set-cookie"), null)
    }
  } finally {
    keys.forEach((key, i) =>
      previous[i] === undefined ? delete env[key] : (env[key] = previous[i]),
    )
  }
})
