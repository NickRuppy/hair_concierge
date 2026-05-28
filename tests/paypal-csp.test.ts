import assert from "node:assert/strict"
import test from "node:test"
import nextConfig from "../next.config"

test("CSP allows PayPal SDK, API, and button frames", async () => {
  const headers = await nextConfig.headers?.()
  const csp = headers
    ?.flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy-Report-Only")?.value

  assert.ok(csp, "expected Content-Security-Policy-Report-Only header")
  assert.match(csp, /script-src[^;]*https:\/\/www\.paypal\.com/)
  assert.match(csp, /script-src[^;]*https:\/\/www\.paypalobjects\.com/)
  assert.match(csp, /connect-src[^;]*https:\/\/www\.paypal\.com/)
  assert.match(csp, /connect-src[^;]*https:\/\/www\.sandbox\.paypal\.com/)
  assert.match(csp, /connect-src[^;]*https:\/\/api-m\.paypal\.com/)
  assert.match(csp, /connect-src[^;]*https:\/\/api-m\.sandbox\.paypal\.com/)
  assert.match(csp, /frame-src[^;]*https:\/\/www\.paypal\.com/)
  assert.match(csp, /frame-src[^;]*https:\/\/www\.sandbox\.paypal\.com/)
})
