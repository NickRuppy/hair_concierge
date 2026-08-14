import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { renderStage5InstructionReviewHtml } from "../scripts/product-intake/catalog-enrichment/stage5-v2-review"

const artifactPath =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json"

test("instruction review renders every family and exact workflow against the exact artifact", async () => {
  const artifactText = await readFile(artifactPath, "utf8")
  const artifact = JSON.parse(artifactText)
  const html = renderStage5InstructionReviewHtml(artifactText)

  assert.equal(html, renderStage5InstructionReviewHtml(artifactText))
  assert.match(html, /28 kanonische Familien/)
  assert.match(html, /4 produktspezifische Abläufe/)
  assert.match(html, /289 Produkt-Anwendungsfamilien/)
  assert.match(html, new RegExp(createHash("sha256").update(artifactText).digest("hex")))
  for (const template of artifact.family_templates) {
    assert.match(html, new RegExp(template.guidanceKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  for (const item of artifact.items.filter(
    (candidate: { exact_workflow_id: string | null }) => candidate.exact_workflow_id !== null,
  )) {
    assert.match(html, new RegExp(item.exact_workflow_id))
  }
  assert.doesNotMatch(html, /OLAPLEX No\.0/)
})

test("instruction review escapes catalog and instruction text", async () => {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"))
  artifact.items[0].product_name = '<script>alert("catalog")</script>'
  artifact.family_templates[0].steps[0].copyTemplateDe = '<img src=x onerror="boom">'

  const html = renderStage5InstructionReviewHtml(`${JSON.stringify(artifact)}\n`)

  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&lt;img src=x onerror=&quot;boom&quot;&gt;/)
})
