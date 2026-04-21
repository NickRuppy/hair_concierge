import { expect, test } from "@playwright/test"
import { intervalFromPrice } from "../src/lib/stripe/intervals"

test("month + interval_count=1 → 'month'", () => {
  expect(intervalFromPrice({ interval: "month", interval_count: 1 })).toBe("month")
})

test("month + interval_count=3 → 'quarter'", () => {
  expect(intervalFromPrice({ interval: "month", interval_count: 3 })).toBe("quarter")
})

test("year + interval_count=1 → 'year'", () => {
  expect(intervalFromPrice({ interval: "year", interval_count: 1 })).toBe("year")
})

test("unknown combo throws", () => {
  expect(() => intervalFromPrice({ interval: "week", interval_count: 1 })).toThrow()
})
