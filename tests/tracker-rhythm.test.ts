import assert from "node:assert/strict"
import test from "node:test"
import { JSDOM } from "jsdom"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { RhythmBand, WeekStrip } from "../src/components/tracker/tracker-widgets"

import { buildRhythmSummary } from "../src/lib/tracking/rhythm"
import type { TrackerLogDay } from "../src/lib/tracking/types"

function wash(loggedOn: string, confirmed = true): TrackerLogDay {
  return { loggedOn, dayType: "wash", products: [], confirmed }
}

const weekly34 = {
  minFrequency: "weekly_3_4x",
  maxFrequency: "weekly_3_4x",
  preferredFrequency: "weekly_3_4x",
} as const

test("weekly rhythm uses the ISO week across year boundaries and shows target bands", () => {
  const rhythm = buildRhythmSummary(
    [wash("2025-12-29"), wash("2025-12-31")],
    weekly34,
    "2026-01-01",
  )
  assert.equal(rhythm.periodStart, "2025-12-29")
  assert.equal(rhythm.targetLabel, "3-4x/Woche")
  assert.equal(rhythm.status, "below")
  assert.equal(rhythm.encouragement, "Noch eine Wäsche bis zu deinem empfohlenen Rhythmus.")
})

test("rhythm pluralizes below-target encouragement and caps preferred-target progress", () => {
  const rhythm = buildRhythmSummary([], weekly34, "2026-07-08")
  assert.equal(rhythm.encouragement, "Noch 3 Wäschen bis zu deinem empfohlenen Rhythmus.")
  const above = buildRhythmSummary(
    [
      wash("2026-07-06"),
      wash("2026-07-07"),
      wash("2026-07-08"),
      wash("2026-07-09"),
      wash("2026-07-10"),
    ],
    weekly34,
    "2026-07-10",
  )
  assert.equal(above.status, "above")
  assert.equal(above.progress, 1)
  assert.equal(above.encouragement, "Du hast diese Woche häufiger gewaschen als empfohlen.")
})

test("biweekly and monthly periods use the fixed Monday 1970-01-05 anchor", () => {
  const biweekly = buildRhythmSummary(
    [],
    { minFrequency: "biweekly_1x", maxFrequency: "biweekly_1x", preferredFrequency: "biweekly_1x" },
    "2026-01-05",
  )
  const monthly = buildRhythmSummary(
    [],
    { minFrequency: "monthly_1x", maxFrequency: "monthly_1x", preferredFrequency: "monthly_1x" },
    "2026-01-05",
  )
  assert.deepEqual([biweekly.periodStart, biweekly.periodWeeks], ["2026-01-05", 2])
  assert.deepEqual([monthly.periodStart, monthly.periodWeeks], ["2025-12-22", 4])
})

test("only completed eligible weekly periods form a consecutive rhythm", () => {
  const rhythm = buildRhythmSummary(
    [wash("2026-06-22"), wash("2026-06-29"), wash("2026-07-06")],
    { minFrequency: "weekly_1x", maxFrequency: "weekly_1x", preferredFrequency: "weekly_1x" },
    "2026-07-08",
  )
  assert.equal(rhythm.completedWeeklyStreak, 2)
})

test("custom and unconfirmed drafts do not affect current rhythm", () => {
  const rhythm = buildRhythmSummary(
    [
      wash("2026-07-06"),
      { loggedOn: "2026-07-07", dayType: "custom", customActivityName: "Sauna", products: [] },
      wash("2026-07-08", false),
    ],
    { minFrequency: "weekly_2x", maxFrequency: "weekly_2x", preferredFrequency: "weekly_2x" },
    "2026-07-08",
  )
  assert.equal(rhythm.washes, 1)
  assert.equal(rhythm.status, "below")
})

test("no target and less-than-monthly targets stay neutral", () => {
  const summary = buildRhythmSummary([], null, "2026-07-08")
  assert.equal(summary.kind, "no_target")
  assert.match(
    renderToStaticMarkup(createElement(RhythmBand, { summary })),
    /Dein persönlicher Rhythmus/,
  )
  const rare = buildRhythmSummary(
    [],
    {
      minFrequency: "less_than_monthly",
      maxFrequency: "less_than_monthly",
      preferredFrequency: "less_than_monthly",
    },
    "2026-07-08",
  )
  assert.equal(rare.kind, "less_than_monthly")
  assert.equal(rare.encouragement, "Dein empfohlener Rhythmus ist seltener als monatlich.")
})

test("tracker renders the in-range headline from confirmed washes", () => {
  const summary = buildRhythmSummary(
    [wash("2026-07-06"), wash("2026-07-07"), wash("2026-07-08")],
    weekly34,
    "2026-07-08",
  )
  const html = renderToStaticMarkup(createElement(RhythmBand, { summary }))
  assert.match(html, /Du bist in deinem Rhythmus/)
  assert.match(html, /Im Zielbereich/)
})

test("tracker day strip labels activities and keeps future days disabled", () => {
  const html = renderToStaticMarkup(
    createElement(WeekStrip, {
      days: [
        { date: "2026-07-06", dayType: "wash", isToday: false, isFuture: false, isEditable: true },
        {
          date: "2026-07-07",
          dayType: "custom",
          customActivityName: "Sauna",
          isToday: false,
          isFuture: false,
          isEditable: true,
        },
        { date: "2026-07-08", dayType: "none", isToday: true, isFuture: false, isEditable: true },
        { date: "2026-07-09", dayType: null, isToday: false, isFuture: true, isEditable: false },
      ],
      selectedDate: "2026-07-06",
      onSelect: () => {},
    }),
  )
  const document = new JSDOM(html).window.document
  assert.equal(
    document.querySelector('[role="tablist"]')?.getAttribute("aria-label"),
    "Letzte acht Tage",
  )
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
  assert.equal(
    tabs
      .find((tab) => tab.getAttribute("aria-label") === "Montag, 6. Juli, Haare gewaschen")
      ?.getAttribute("aria-selected"),
    "true",
  )
  assert.ok(
    tabs.some(
      (tab) => tab.getAttribute("aria-label") === "Dienstag, 7. Juli, eigene Aktivität: Sauna",
    ),
  )
  assert.ok(
    tabs
      .find((tab) => tab.getAttribute("aria-label") === "Donnerstag, 9. Juli, kein Eintrag")
      ?.hasAttribute("disabled"),
  )
})
