import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/ops/catalog-repairs/2026-08-11-ogx-renewing-merge",
)
const canonicalId = "2ecd3c9d-90f6-45a3-a72c-daefed50be10"
const duplicateId = "f41badc9-16e3-41c1-ab6c-23541fffade0"

test("OGX repair package is privacy-safe and blocked until fresh preflight capture", async () => {
  const before = JSON.parse(await readFile(path.join(directory, "before.json"), "utf8"))
  const [preflight, merge, rollback, readme] = await Promise.all(
    ["preflight.sql", "merge.sql", "rollback.sql", "README.md"].map((file) =>
      readFile(path.join(directory, file), "utf8"),
    ),
  )

  assert.equal(before.canonicalProduct.id, canonicalId)
  assert.equal(before.duplicateProduct.id, duplicateId)
  assert.equal(before.captureStatus, "revalidate_before_apply")
  assert.equal(before.snapshotFingerprint, null)
  assert.deepEqual(before.duplicateIdentifiers, [])
  assert.deepEqual(before.duplicateShampooSpecs, [])
  assert.equal(before.privacy.containsUserIds, false)
  assert.equal(before.privacy.containsRawUserText, false)
  assert.match(preflight, /privacy_safe_before_image/)
  assert.match(preflight, /sha256\(convert_to\(up\.id::text/)
  assert.match(preflight, /WITH RECURSIVE walk/)
  assert.match(preflight, /approvedSubmissionLinks/)
  assert.match(merge, /BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE/)
  assert.match(merge, /pg_advisory_xact_lock/)
  assert.match(merge, /requires a freshly reviewed before\.json capture/)
  assert.match(merge, /full privacy-safe before-image drifted/)
  assert.match(merge, /draftProductIdPaths/)
  assert.match(merge, /allDuplicateUuidStringPaths/)
  assert.match(merge, /approvedSubmissionLinks/)
  assert.match(merge, /outside products\[\*\]\.identity\.productId/)
  assert.match(merge, /direct owner-link set drifted/)
  assert.match(merge, /v_submission_links/)
  assert.match(merge, /source-revision or outbox delta failed/)
  assert.match(merge, /UPDATE public\.user_products SET catalog_product_id = v_canonical/)
  assert.match(merge, /jsonb_set\(patched\.payload/)
  assert.match(merge, /INSERT INTO public\.product_relationships/)
  assert.match(rollback, /no executable rollback/)
  assert.match(rollback, /fresh compensating recovery plan/)
  assert.match(readme, /no database change has been made/)
})
