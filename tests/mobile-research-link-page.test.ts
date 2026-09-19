import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { isValidElement, type ReactNode } from "react"
import MobileResearchLinkPage from "@/app/app/research/[submissionId]/page"

const submissionId = "33333333-3333-4333-8333-333333333333"

function links(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(links)
  if (!isValidElement<{ href?: string; children?: ReactNode }>(node)) return []
  const self = node.props.href ? [node.props.href] : []
  return [...self, ...links(node.props.children)]
}

test("research email landing page opens both current pilot and public iPhone apps", async () => {
  const page = await MobileResearchLinkPage({ params: Promise.resolve({ submissionId }) })
  const hrefs = links(page)
  const pilotScheme = "chaarlie-pilot"
  const releaseScheme = "chaarlie"
  assert.deepEqual(hrefs, [
    `${pilotScheme}://research/${submissionId}`,
    `${releaseScheme}://research/${submissionId}`,
  ])
  const pilotPlist = await readFile(
    new URL("../ios/Chaarlie/Resources/Info-HostedPilot.plist", import.meta.url),
    "utf8",
  )
  const releasePlist = await readFile(
    new URL("../ios/Chaarlie/Resources/Info-Release.plist", import.meta.url),
    "utf8",
  )
  assert.match(pilotPlist, /<string>chaarlie-pilot<\/string>/)
  assert.match(releasePlist, /<string>chaarlie<\/string>/)
})
