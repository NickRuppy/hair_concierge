import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAdminProductFilterQueryString,
  DEFAULT_ADMIN_PRODUCT_FILTERS,
  parseAdminProductFilters,
} from "../src/lib/admin/product-filters"

test("admin product filters parse ops filters while keeping empty defaults unfiltered", () => {
  assert.deepEqual(parseAdminProductFilters(new URLSearchParams()), {
    origin: null,
    recommendation: null,
    lifecycle: null,
    active: null,
  })

  assert.deepEqual(
    parseAdminProductFilters(
      new URLSearchParams({
        origin: "user_submitted",
        recommendation_status: "not_recommended",
        lifecycle_status: "active",
        active_status: "inactive",
      }),
    ),
    {
      origin: "user_submitted",
      recommendation: "not_recommended",
      lifecycle: "active",
      active: "inactive",
    },
  )
})

test("admin product filters preserve legacy boolean query aliases", () => {
  assert.deepEqual(
    parseAdminProductFilters(
      new URLSearchParams({
        is_chaarlie_recommended: "false",
        is_active: "true",
      }),
    ),
    {
      origin: null,
      recommendation: "not_recommended",
      lifecycle: null,
      active: "active",
    },
  )
})

test("admin product filter query string omits all-options and sends selected filters", () => {
  assert.equal(buildAdminProductFilterQueryString(DEFAULT_ADMIN_PRODUCT_FILTERS), "")

  const params = new URLSearchParams(
    buildAdminProductFilterQueryString({
      origin: "curated",
      recommendation_status: "recommended",
      lifecycle_status: "discontinued",
      active_status: "active",
    }),
  )

  assert.equal(params.get("origin"), "curated")
  assert.equal(params.get("recommendation_status"), "recommended")
  assert.equal(params.get("lifecycle_status"), "discontinued")
  assert.equal(params.get("active_status"), "active")
})
