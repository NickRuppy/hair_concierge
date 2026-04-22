import assert from "node:assert/strict"
import test from "node:test"

import {
  getDefaultOpenProfileSections,
  getProfileOverviewSummary,
} from "../src/lib/profile/profile-overview"

test("opens incomplete and recent profile sections in journey order", () => {
  const sections = [
    { key: "quiz", title: "Haar-Check", isComplete: true },
    { key: "products", title: "Produkte", isComplete: false },
    { key: "styling", title: "Styling", isComplete: true },
    { key: "routine", title: "Alltag", isComplete: false },
    { key: "goals", title: "Ziele", isComplete: true },
  ] as const

  const openSections = getDefaultOpenProfileSections(sections, ["goals", "products"])

  assert.deepEqual(openSections, ["products", "routine", "goals"])
})

test("keeps the first section open when everything is complete and nothing was touched recently", () => {
  const sections = [
    { key: "quiz", title: "Haar-Check", isComplete: true },
    { key: "products", title: "Produkte", isComplete: true },
    { key: "styling", title: "Styling", isComplete: true },
  ] as const

  const openSections = getDefaultOpenProfileSections(sections)

  assert.deepEqual(openSections, ["quiz"])
})

test("summarizes progress and points to the next incomplete section", () => {
  const summary = getProfileOverviewSummary([
    { key: "quiz", title: "Haar-Check", isComplete: true },
    { key: "products", title: "Produkte", isComplete: false },
    { key: "styling", title: "Styling", isComplete: true },
    { key: "routine", title: "Alltag", isComplete: false },
  ])

  assert.equal(summary.completeCount, 2)
  assert.equal(summary.totalCount, 4)
  assert.equal(summary.allComplete, false)
  assert.deepEqual(summary.nextSection, {
    key: "products",
    title: "Produkte",
    isComplete: false,
  })
})
