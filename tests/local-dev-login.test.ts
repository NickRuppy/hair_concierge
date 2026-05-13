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
