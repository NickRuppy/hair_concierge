import assert from "node:assert/strict"
import test from "node:test"

import { projectApplicationCadenceByDay } from "../src/lib/routines/personal-plan/application/cadence-projector"
import type {
  ApplicationDayTypeKey,
  NormalizedRoutineItem,
  SemanticRole,
} from "../src/lib/routines/personal-plan/application/contracts"

const DAY_KEYS: ApplicationDayTypeKey[] = [
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
  "refresh_day",
  "between_wash_care_day",
  "styling_day",
  "rest_day",
]

function item(
  role: SemanticRole,
  effectiveCadenceDe: string,
  overrides: Partial<NormalizedRoutineItem> = {},
): NormalizedRoutineItem {
  return {
    itemId: `item:${role}`,
    productId: "10000000-0000-4000-8000-000000000001",
    productName: role,
    category: "shampoo",
    role,
    inclusion: "included",
    availability: "owned",
    executable: true,
    catalogFacts: {},
    effectiveCadenceDe,
    ...overrides,
  }
}

test("projects each canonical Stage 5 day from frozen Routine cadence or its approved static trigger", () => {
  const cadenceByDay = projectApplicationCadenceByDay({
    routineItems: [
      item("cleanse", "Alle zwei Tage", { routineOrder: 70 }),
      item("intensive_care", "Alle zwei Wochen", { routineOrder: 60 }),
      item("bond_repair", "Alle drei Haarwäschen", { routineOrder: 50 }),
      item("reset_cleanse", "Einmal monatlich", { routineOrder: 40 }),
      item("refresh", "Nach Bedarf", { routineOrder: 30 }),
      item("leave_in", "Nach jeder Haarwäsche", { routineOrder: 20 }),
      item("heat_protection", "Vor jeder Hitze-Anwendung", { routineOrder: 10 }),
    ],
    compiledDayKeys: DAY_KEYS,
  })

  assert.deepEqual(cadenceByDay, {
    wash_day: "Alle zwei Tage",
    intensive_care_day: "Alle zwei Wochen",
    bond_repair_day: "Alle drei Haarwäschen",
    clarifying_wash_day: "Einmal monatlich",
    refresh_day: "Nach Bedarf",
    between_wash_care_day: "Bei Bedarf",
    styling_day: "Beim Stylen",
    rest_day: "Immer möglich",
  })
})

test("uses routine order then item id deterministically and never lets supporting roles override a defining role", () => {
  const cadenceByDay = projectApplicationCadenceByDay({
    routineItems: [
      item("condition", "Supporting cadence", { itemId: "a-support", routineOrder: 0 }),
      item("cleanse", "Second cleanse", { itemId: "z-cleanse", routineOrder: 3 }),
      item("cleanse", "First cleanse", { itemId: "b-cleanse", routineOrder: 3 }),
      item("leave_in", "Supporting leave-in", { itemId: "a-leave-in", routineOrder: 0 }),
      item("refresh", "Later refresh", { itemId: "z-refresh", routineOrder: 9 }),
      item("refresh", "First refresh", { itemId: "a-refresh", routineOrder: 9 }),
    ],
    compiledDayKeys: ["wash_day", "refresh_day", "between_wash_care_day"],
  })

  assert.deepEqual(cadenceByDay, {
    wash_day: "First cleanse",
    refresh_day: "First refresh",
    between_wash_care_day: "Bei Bedarf",
  })
})

test("does not project unavailable or failed compiled days", () => {
  assert.deepEqual(
    projectApplicationCadenceByDay({
      routineItems: [item("cleanse", "Alle zwei Tage")],
      compiledDayKeys: ["rest_day"],
    }),
    { rest_day: "Immer möglich" },
  )
})

test("keeps a compiled refresh day event-driven when no defining refresh item is present", () => {
  assert.deepEqual(
    projectApplicationCadenceByDay({
      routineItems: [item("leave_in", "Nach jeder Haarwäsche")],
      compiledDayKeys: ["refresh_day"],
    }),
    { refresh_day: "Bei Bedarf" },
  )
})

test("does not present cadence from planned non-executable products as confirmed", () => {
  assert.deepEqual(
    projectApplicationCadenceByDay({
      routineItems: [
        item("cleanse", "Zweimal pro Woche", {
          availability: "planned",
          executable: false,
        }),
        item("refresh", "Dreimal pro Woche", {
          availability: "planned",
          executable: false,
        }),
      ],
      compiledDayKeys: ["wash_day", "refresh_day", "between_wash_care_day"],
    }),
    {
      refresh_day: "Bei Bedarf",
      between_wash_care_day: "Bei Bedarf",
    },
  )
})
