import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8")
}

test("CODEOWNERS keeps production approval with Nick", () => {
  assert.match(source(".github/CODEOWNERS"), /^\* @NickRuppy$/m)
})

test("draft PR template makes fork limitations and funnel proof explicit", () => {
  const template = source(".github/PULL_REQUEST_TEMPLATE/funnel.md")
  assert.match(template, /Package key:/)
  assert.match(template, /Vercel preview authorized/)
  assert.match(template, /fork PRs do not receive production secrets/)
  assert.match(template, /Final production approval and merge remain with @NickRuppy/)
})

test("CI keeps fork scope bounded without privileged pull_request_target", () => {
  const ci = source(".github/workflows/ci.yml")
  const security = source(".github/workflows/security.yml")
  const clawpatch = source(".github/workflows/clawpatch.yml")
  assert.match(ci, /funnel-contributor-scope:/)
  assert.match(ci, /git diff --name-status --no-renames "\$BASE_SHA\.\.\.\$HEAD_SHA"/)
  assert.match(ci, /existing variants are owner-controlled/)
  assert.match(ci, /src\/funnels\/packages\.json/)
  assert.match(ci, /public\/images\/funnels\/\*\|docs\/funnel-briefs\/\*/)
  assert.match(
    ci,
    /immutableFields = \["key", "slug", "channel", "landingVariant", "offerVariant"\]/,
  )
  assert.match(ci, /run: npm run funnel:check/)
  assert.doesNotMatch(`${ci}\n${security}\n${clawpatch}`, /pull_request_target/)
})
