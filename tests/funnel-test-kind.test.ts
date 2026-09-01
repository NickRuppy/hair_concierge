import assert from "node:assert/strict"
import test from "node:test"

import {
  isCustomerIoJourneyEligible,
  isNonCommercialFunnelTestKind,
} from "../src/lib/funnel/journey-kind"

test("field tests and partner journeys are non-commercial while ordinary traffic remains eligible", () => {
  assert.equal(isNonCommercialFunnelTestKind("field_test"), true)
  assert.equal(isNonCommercialFunnelTestKind("partner"), true)
  assert.equal(isNonCommercialFunnelTestKind(null), false)
  assert.equal(isNonCommercialFunnelTestKind(undefined), false)
  assert.equal(isNonCommercialFunnelTestKind("something_else"), false)
})

test("Customer.io preserves field-test events while suppressing partner events", () => {
  assert.equal(isCustomerIoJourneyEligible("field_test"), true)
  assert.equal(isCustomerIoJourneyEligible("partner"), false)
  assert.equal(isCustomerIoJourneyEligible(null), true)
})
