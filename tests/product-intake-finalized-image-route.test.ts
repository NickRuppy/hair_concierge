import assert from "node:assert/strict"
import { test } from "node:test"

import { GET } from "../apps/product-intake-review/app/product-intake-finalized/[submissionId]/[filename]/route"
import { resolveFinalizedImagePath } from "../apps/product-intake-review/app/product-intake-finalized/[submissionId]/[filename]/image-path"

test("finalized image route resolves one safe submission asset below the configured root", () => {
  assert.equal(
    resolveFinalizedImagePath(
      "/opt/chaarlie/product-intake/shared/finalized-images",
      "04832d5d-f1fe-4108-a302-93081360e58e",
      "neqi-shampoo-repair-reveal-330-ml-a2fe7474d273.webp",
    ),
    "/opt/chaarlie/product-intake/shared/finalized-images/04832d5d-f1fe-4108-a302-93081360e58e/neqi-shampoo-repair-reveal-330-ml-a2fe7474d273.webp",
  )
})

test("finalized image route rejects traversal and unsupported file types", () => {
  assert.equal(resolveFinalizedImagePath("/safe", "../../etc", "passwd.webp"), null)
  assert.equal(
    resolveFinalizedImagePath("/safe", "04832d5d-f1fe-4108-a302-93081360e58e", "../secret.webp"),
    null,
  )
  assert.equal(
    resolveFinalizedImagePath("/safe", "04832d5d-f1fe-4108-a302-93081360e58e", "asset.svg"),
    null,
  )
})

test("finalized image route denies remote requests before reading persistent review assets", async () => {
  const previousRemoteOverride = process.env.PRODUCT_INTAKE_REVIEW_ALLOW_REMOTE
  delete process.env.PRODUCT_INTAKE_REVIEW_ALLOW_REMOTE

  try {
    const response = await GET(
      new Request(
        "https://review.example.test/product-intake-finalized/04832d5d-f1fe-4108-a302-93081360e58e/asset.webp",
      ),
      {
        params: Promise.resolve({
          submissionId: "04832d5d-f1fe-4108-a302-93081360e58e",
          filename: "asset.webp",
        }),
      },
    )

    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), {
      error:
        "Product intake review service routes are local-only. Set PRODUCT_INTAKE_REVIEW_ALLOW_REMOTE=1 only behind explicit internal protection.",
    })

    const localResponse = await GET(
      new Request(
        "http://127.0.0.1:3911/product-intake-finalized/04832d5d-f1fe-4108-a302-93081360e58e/asset.webp",
        { headers: { host: "127.0.0.1:3911" } },
      ),
      {
        params: Promise.resolve({
          submissionId: "04832d5d-f1fe-4108-a302-93081360e58e",
          filename: "asset.webp",
        }),
      },
    )
    assert.equal(localResponse.status, 404)
  } finally {
    if (previousRemoteOverride === undefined) {
      delete process.env.PRODUCT_INTAKE_REVIEW_ALLOW_REMOTE
    } else {
      process.env.PRODUCT_INTAKE_REVIEW_ALLOW_REMOTE = previousRemoteOverride
    }
  }
})
