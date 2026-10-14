import assert from "node:assert/strict"
import test from "node:test"

import {
  assertProductSpecProjectionShape,
  readRelationshipVerificationTarget,
} from "../scripts/catalog-authority/verify-product-spec-relationships"

test("relationship verification requires an explicit matching non-production project", () => {
  assert.throws(() => readRelationshipVerificationTarget({}), /credentials_missing/)
  assert.throws(
    () =>
      readRelationshipVerificationTarget({
        CATALOG_RELATIONSHIP_VERIFY_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
        CATALOG_RELATIONSHIP_VERIFY_SERVICE_ROLE_KEY: "secret",
        CATALOG_RELATIONSHIP_VERIFY_PROJECT_REF: "pqdkhefxsxkyeqelqegq",
      }),
    /production_forbidden/,
  )
  assert.throws(
    () =>
      readRelationshipVerificationTarget({
        CATALOG_RELATIONSHIP_VERIFY_SUPABASE_URL: "https://different.supabase.co",
        CATALOG_RELATIONSHIP_VERIFY_SERVICE_ROLE_KEY: "secret",
        CATALOG_RELATIONSHIP_VERIFY_PROJECT_REF: "branch-ref",
      }),
    /project_mismatch/,
  )
  assert.deepEqual(
    readRelationshipVerificationTarget({
      CATALOG_RELATIONSHIP_VERIFY_SUPABASE_URL: "https://branch-ref.supabase.co",
      CATALOG_RELATIONSHIP_VERIFY_SERVICE_ROLE_KEY: "secret",
      CATALOG_RELATIONSHIP_VERIFY_PROJECT_REF: "branch-ref",
    }),
    {
      url: "https://branch-ref.supabase.co",
      serviceRoleKey: "secret",
      projectRef: "branch-ref",
    },
  )
})

test("relationship verification requires representative rows with exact embed cardinality", () => {
  assert.throws(() => assertProductSpecProjectionShape([], ["singleton"]), /projection_empty/)
  assert.throws(
    () => assertProductSpecProjectionShape([{ id: "product", singleton: [] }], ["singleton"]),
    /shape_invalid/,
  )
  assert.throws(
    () =>
      assertProductSpecProjectionShape([{ id: "product", contextual: null }], [], ["contextual"]),
    /shape_invalid/,
  )
  assert.deepEqual(
    assertProductSpecProjectionShape(
      [{ id: "product", singleton: null, contextual: [{ value: "known" }] }],
      ["singleton"],
      ["contextual"],
    ),
    [{ id: "product", singleton: null, contextual: [{ value: "known" }] }],
  )
})
