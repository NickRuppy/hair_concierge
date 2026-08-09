import assert from "node:assert/strict"
import test from "node:test"

import nextConfig from "../next.config"

test("CSP report policy allows only the observed Wistia player origins", async () => {
  const headers = await nextConfig.headers?.()
  const csp = headers
    ?.flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy-Report-Only")?.value

  assert.ok(csp, "expected Content-Security-Policy-Report-Only header")
  const directive = (name: string) => csp.split("; ").find((part) => part.startsWith(name)) ?? ""

  assert.match(directive("script-src"), /https:\/\/fast\.wistia\.com/)
  assert.match(directive("script-src"), /https:\/\/fast\.wistia\.net/)

  assert.match(directive("img-src"), /https:\/\/fast\.wistia\.com/)
  assert.match(directive("img-src"), /https:\/\/fast\.wistia\.net/)

  assert.match(directive("font-src"), /https:\/\/fast\.wistia\.net/)

  for (const origin of [
    "https://fast.wistia.com",
    "https://fast.wistia.net",
    "https://embed-cloudfront.wistia.com",
    "https://embed-ssl.wistia.com",
    "https://distillery.wistia.com",
    "https://pipedream.wistia.com",
  ]) {
    assert.ok(directive("connect-src").includes(origin), `connect-src should include ${origin}`)
  }

  assert.match(directive("media-src"), /https:\/\/embed-cloudfront\.wistia\.com/)
  assert.match(directive("media-src"), /https:\/\/embed-ssl\.wistia\.com/)
  assert.doesNotMatch(csp, /https:\/\/\*\.wistia\.(?:com|net)/)
})
