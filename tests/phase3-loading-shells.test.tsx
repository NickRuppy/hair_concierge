import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import AnwendungLoading from "../src/app/anwendung/loading"
import ChatLoading from "../src/app/chat/loading"
import RoutineLoading from "../src/app/routine/loading"
import PlanBereitLoading from "../src/app/plan-bereit/loading"
import PlanStartLoading from "../src/app/plan-start/loading"
import ProfileLoading from "../src/app/profile/loading"
import TrackerLoading from "../src/app/tracker/loading"

const shells = [
  ["Profil", ProfileLoading, "profile-loading-shell", "profile"],
  ["Chat", ChatLoading, "chat-loading-shell", "chat"],
  ["Tracker", TrackerLoading, "tracker-loading-shell", "tracker"],
  // Routine and Anwendung joined the neutral static dialect with Follow-up B
  // (founder sign-off 02.09.2026): one skeleton language app-wide, animated
  // loading reserved for the journey opening frames.
  ["Routine", RoutineLoading, "routine-loading-shell", "routine"],
  ["Anwendung", AnwendungLoading, "anwendung-loading-shell", "anwendung"],
] as const

// /plan-bereit and /plan-start deliberately left the neutral-shell family:
// their loading shells continue the opening choreography (founder sign-offs
// 02.09.2026), so the streaming gaps show the same pixels as the frames
// around them instead of an unrelated skeleton.
test("Plan-bereit lädt als Opening-Frame statt als neutrale Schale", () => {
  const html = renderToStaticMarkup(<PlanBereitLoading />)

  assert.match(html, /aria-label="Plan bereit wird geladen"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /data-loading-shell="plan-bereit-loading-shell"/)
  assert.match(html, /role="status"/)
  assert.match(html, /data-plan-opening="loading"/)
  assert.match(html, /Dein Plan wird geöffnet\./)
  assert.match(html, /Zahlung bestätigt/)
  // Still inert: the shell may not carry a working link or button.
  assert.doesNotMatch(html, /<a\b|<button\b|href=/)
})

test("Plan-start lädt als geteilte Opening-Schale statt als neutrale Schale", () => {
  const html = renderToStaticMarkup(<PlanStartLoading />)

  assert.match(html, /aria-label="Planstart wird geladen"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /data-loading-shell="plan-start-loading-shell"/)
  assert.match(html, /role="status"/)
  assert.match(html, /plan-opening-arc/)
  assert.match(html, /Dein Plan wird geöffnet\./)
  assert.match(html, /Dein persönlicher Plan/)
  // One loading layout: no determinate bar, and still no link or button.
  assert.doesNotMatch(html, /role="progressbar"/)
  assert.doesNotMatch(html, /<a\b|<button\b|href=/)
})

test("Phase-3-Routen zeigen neutrale, statische Ladeschalen", () => {
  for (const [name, LoadingShell, marker, route] of shells) {
    const html = renderToStaticMarkup(<LoadingShell />)
    const source = readFileSync(`src/app/${route}/loading.tsx`, "utf8")

    assert.match(html, new RegExp(`aria-label="${name} wird geladen"`))
    assert.match(html, /aria-live="polite"/)
    assert.match(html, new RegExp(`data-loading-shell="${marker}"`))
    assert.match(html, /role="status"/)
    assert.doesNotMatch(html, /<a\b|<button\b|href=|animate-/)
    assert.doesNotMatch(source, /animate-|Sparkles|PersonalPlanJourneyHeader/)
  }
})
