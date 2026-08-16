import assert from "node:assert/strict"
import test from "node:test"

import {
  deriveOilReviewGroup,
  groupedReviewCounts,
} from "@/lib/personal-plan/products/oil-review-group"
import type { Stage3DecisionSubject } from "@/lib/personal-plan/products/contracts"

function key(subject: Stage3DecisionSubject): string {
  return subject.decisionKey
}

const oil1: Stage3DecisionSubject = {
  decisionKey: "oil-1",
  category: "oil",
  role: "pre_wash_fibre_treatment",
  capturedProductId: "p1",
  subjectKind: "captured_product",
}
const oil2: Stage3DecisionSubject = {
  decisionKey: "oil-2",
  category: "oil",
  role: "leave_on_fibre_conditioning",
  capturedProductId: "p2",
  subjectKind: "captured_product",
}
const oil3: Stage3DecisionSubject = {
  decisionKey: "oil-3",
  category: "oil",
  role: "dry_finish",
  capturedProductId: "p3",
  subjectKind: "captured_product",
}

const subjects3Oil: Stage3DecisionSubject[] = [oil1, oil2, oil3]
const allPending = new Set(subjects3Oil.map(key))
const uniformProps = new Map<string, string | null>(
  subjects3Oil.map((subject) => [subject.decisionKey, "product-x"]),
)

test("three pending oil subjects group under the first as anchor", () => {
  const group = deriveOilReviewGroup(subjects3Oil, allPending, key(subjects3Oil[0]), uniformProps)
  assert.equal(group?.members.length, 3)
  assert.equal(group?.uniformProposition, true)
  assert.equal(group?.anchor.decisionKey, "oil-1")
})

test("a decided oil subject is excluded from the group", () => {
  const pending = new Set(["oil-1", "oil-3"])
  const group = deriveOilReviewGroup(subjects3Oil, pending, "oil-1", uniformProps)
  assert.equal(group?.members.length, 2)
  assert.deepEqual(
    group?.members.map((m) => m.decisionKey),
    ["oil-1", "oil-3"],
  )
})

test("non-oil anchor returns null", () => {
  const shampoo: Stage3DecisionSubject = {
    decisionKey: "shampoo-1",
    category: "shampoo",
    role: "shampoo_everyday",
    capturedProductId: "s1",
    subjectKind: "captured_product",
  }
  const subjects = [shampoo, ...subjects3Oil]
  const pending = new Set([shampoo.decisionKey, ...allPending])
  const group = deriveOilReviewGroup(subjects, pending, shampoo.decisionKey, uniformProps)
  assert.equal(group, null)
})

test("single pending oil subject returns null (keeps classic screen)", () => {
  const pending = new Set(["oil-1"])
  const group = deriveOilReviewGroup(subjects3Oil, pending, "oil-1", uniformProps)
  assert.equal(group, null)
})

test("diverging propositions set uniformProposition false", () => {
  const divergingProps = new Map<string, string | null>([
    ["oil-1", "product-a"],
    ["oil-2", "product-b"],
    ["oil-3", "product-a"],
  ])
  const group = deriveOilReviewGroup(subjects3Oil, allPending, "oil-1", divergingProps)
  assert.equal(group?.uniformProposition, false)
})

test("inventory dispositions never group", () => {
  const oilInventory: Stage3DecisionSubject = {
    decisionKey: "oil-inv-1",
    category: "oil",
    role: "pre_wash_fibre_treatment",
    capturedProductId: "p9",
    subjectKind: "inventory_disposition",
  }

  // Anchor itself is an inventory disposition -> null regardless of pending members.
  const anchorIsDisposition = deriveOilReviewGroup(
    [oilInventory, oil1, oil2],
    new Set([oilInventory.decisionKey, oil1.decisionKey, oil2.decisionKey]),
    oilInventory.decisionKey,
    uniformProps,
  )
  assert.equal(anchorIsDisposition, null)

  // A valid group excludes disposition subjects from its members even when pending.
  const subjects = [oil1, oil2, oilInventory]
  const pending = new Set([oil1.decisionKey, oil2.decisionKey, oilInventory.decisionKey])
  const group = deriveOilReviewGroup(subjects, pending, oil1.decisionKey, uniformProps)
  assert.equal(group?.members.length, 2)
  assert.deepEqual(
    group?.members.map((m) => m.decisionKey),
    ["oil-1", "oil-2"],
  )
})

test("grouped counts collapse the group to one step", () => {
  const shampoo: Stage3DecisionSubject = {
    decisionKey: "shampoo-1",
    category: "shampoo",
    role: "shampoo_everyday",
    capturedProductId: "s1",
    subjectKind: "captured_product",
  }
  const conditioner: Stage3DecisionSubject = {
    decisionKey: "cond-1",
    category: "conditioner",
    role: "conditioner_rinse_out",
    capturedProductId: "c1",
    subjectKind: "captured_product",
  }
  const mask: Stage3DecisionSubject = {
    decisionKey: "mask-1",
    category: "mask",
    role: "intensive_conditioning_mask",
    capturedProductId: "m1",
    subjectKind: "captured_product",
  }
  const subjects = [shampoo, conditioner, oil1, oil2, oil3, mask]
  const groupKeys = new Set(["oil-1", "oil-2", "oil-3"])

  const { position, total } = groupedReviewCounts(subjects, "oil-1", groupKeys)
  assert.equal(position, 3)
  assert.equal(total, 4)
})

test("a follow-up (ungrouped) oil subject counts as its own step", () => {
  const shampoo: Stage3DecisionSubject = {
    decisionKey: "shampoo-1",
    category: "shampoo",
    role: "shampoo_everyday",
    capturedProductId: "s1",
    subjectKind: "captured_product",
  }
  const conditioner: Stage3DecisionSubject = {
    decisionKey: "cond-1",
    category: "conditioner",
    role: "conditioner_rinse_out",
    capturedProductId: "c1",
    subjectKind: "captured_product",
  }
  const oil4: Stage3DecisionSubject = {
    decisionKey: "oil-4",
    category: "oil",
    role: "dry_finish",
    capturedProductId: "p4",
    subjectKind: "captured_product",
  }
  const mask: Stage3DecisionSubject = {
    decisionKey: "mask-1",
    category: "mask",
    role: "intensive_conditioning_mask",
    capturedProductId: "m1",
    subjectKind: "captured_product",
  }
  const subjects = [shampoo, conditioner, oil1, oil2, oil3, oil4, mask]
  // oil4 left the group (e.g. a follow-up decision after a deselection) so it is
  // absent from groupKeys and must count as its own step.
  const groupKeys = new Set(["oil-1", "oil-2", "oil-3"])

  const { position, total } = groupedReviewCounts(subjects, "oil-4", groupKeys)
  assert.equal(total, 5)
  assert.equal(position, 4)
})
