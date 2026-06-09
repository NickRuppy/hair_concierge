import assert from "node:assert/strict"
import test from "node:test"

import {
  compareProductFrequencies,
  isProductFrequencyAtLeast,
  normalizeProductFrequency,
  PRODUCT_FREQUENCIES,
  PRODUCT_FREQUENCY_LABELS,
  PRODUCT_FREQUENCY_METADATA,
  PRODUCT_FREQUENCY_OPTIONS,
} from "../src/lib/vocabulary"

test("product frequencies expose the canonical cadence stops in order", () => {
  assert.deepEqual(PRODUCT_FREQUENCIES, [
    "less_than_monthly",
    "monthly_1x",
    "biweekly_1x",
    "weekly_1x",
    "weekly_2x",
    "weekly_3_4x",
    "weekly_5_6x",
    "daily_1x",
  ])
})

test("product frequency labels stay German and user-facing", () => {
  assert.deepEqual(PRODUCT_FREQUENCY_LABELS, {
    less_than_monthly: "Seltener als 1x/Monat",
    monthly_1x: "Ca. 1x/Monat",
    biweekly_1x: "Ca. alle 2 Wochen",
    weekly_1x: "1x/Woche",
    weekly_2x: "2x/Woche",
    weekly_3_4x: "3-4x/Woche",
    weekly_5_6x: "5-6x/Woche",
    daily_1x: "Täglich",
  })
})

test("product frequency metadata exposes comparable weekly cadence estimates", () => {
  assert.deepEqual(PRODUCT_FREQUENCY_METADATA, {
    less_than_monthly: {
      value: "less_than_monthly",
      label: "Seltener als 1x/Monat",
      sortOrder: 0,
      minPerWeek: 0,
      maxPerWeek: 0.249,
      midpointPerWeek: 0.125,
      comparable: true,
    },
    monthly_1x: {
      value: "monthly_1x",
      label: "Ca. 1x/Monat",
      sortOrder: 1,
      minPerWeek: 0.25,
      maxPerWeek: 0.25,
      midpointPerWeek: 0.25,
      comparable: true,
    },
    biweekly_1x: {
      value: "biweekly_1x",
      label: "Ca. alle 2 Wochen",
      sortOrder: 2,
      minPerWeek: 0.5,
      maxPerWeek: 0.5,
      midpointPerWeek: 0.5,
      comparable: true,
    },
    weekly_1x: {
      value: "weekly_1x",
      label: "1x/Woche",
      sortOrder: 3,
      minPerWeek: 1,
      maxPerWeek: 1,
      midpointPerWeek: 1,
      comparable: true,
    },
    weekly_2x: {
      value: "weekly_2x",
      label: "2x/Woche",
      sortOrder: 4,
      minPerWeek: 2,
      maxPerWeek: 2,
      midpointPerWeek: 2,
      comparable: true,
    },
    weekly_3_4x: {
      value: "weekly_3_4x",
      label: "3-4x/Woche",
      sortOrder: 5,
      minPerWeek: 3,
      maxPerWeek: 4,
      midpointPerWeek: 3.5,
      comparable: true,
    },
    weekly_5_6x: {
      value: "weekly_5_6x",
      label: "5-6x/Woche",
      sortOrder: 6,
      minPerWeek: 5,
      maxPerWeek: 6,
      midpointPerWeek: 5.5,
      comparable: true,
    },
    daily_1x: {
      value: "daily_1x",
      label: "Täglich",
      sortOrder: 7,
      minPerWeek: 7,
      maxPerWeek: 7,
      midpointPerWeek: 7,
      comparable: true,
    },
  })
})

test("product frequency options mirror the canonical ordered labels", () => {
  assert.deepEqual(PRODUCT_FREQUENCY_OPTIONS, [
    { value: "less_than_monthly", label: "Seltener als 1x/Monat" },
    { value: "monthly_1x", label: "Ca. 1x/Monat" },
    { value: "biweekly_1x", label: "Ca. alle 2 Wochen" },
    { value: "weekly_1x", label: "1x/Woche" },
    { value: "weekly_2x", label: "2x/Woche" },
    { value: "weekly_3_4x", label: "3-4x/Woche" },
    { value: "weekly_5_6x", label: "5-6x/Woche" },
    { value: "daily_1x", label: "Täglich" },
  ])
})

test("product frequency normalization accepts legacy values during rollout", () => {
  assert.equal(normalizeProductFrequency("rarely"), "less_than_monthly")
  assert.equal(normalizeProductFrequency("1_2x"), "weekly_1x")
  assert.equal(normalizeProductFrequency("3_4x"), "weekly_3_4x")
  assert.equal(normalizeProductFrequency("5_6x"), "weekly_5_6x")
  assert.equal(normalizeProductFrequency("daily"), "daily_1x")
  assert.equal(normalizeProductFrequency("once_weekly"), "weekly_1x")
  assert.equal(normalizeProductFrequency("every_4_5_days"), "weekly_2x")
  assert.equal(normalizeProductFrequency("every_2_3_days"), "weekly_3_4x")
  assert.equal(normalizeProductFrequency("weekly_2x"), "weekly_2x")
  assert.equal(normalizeProductFrequency("not_real"), null)
})

test("product frequency comparison follows canonical sort order", () => {
  assert.equal(compareProductFrequencies("weekly_1x", "weekly_3_4x"), -1)
  assert.equal(compareProductFrequencies("weekly_3_4x", "weekly_3_4x"), 0)
  assert.equal(compareProductFrequencies("daily_1x", "weekly_5_6x"), 1)
  assert.equal(compareProductFrequencies(null, "weekly_1x"), null)
  assert.equal(compareProductFrequencies("weekly_1x", null), null)
  assert.equal(compareProductFrequencies(undefined, "weekly_1x"), null)
  assert.equal(compareProductFrequencies("weekly_1x", undefined), null)
})

test("product frequency threshold helper treats null comparisons as false", () => {
  assert.equal(isProductFrequencyAtLeast("weekly_3_4x", "weekly_2x"), true)
  assert.equal(isProductFrequencyAtLeast("weekly_1x", "weekly_2x"), false)
  assert.equal(isProductFrequencyAtLeast(null, "weekly_2x"), false)
  assert.equal(isProductFrequencyAtLeast(undefined, "weekly_2x"), false)
})
