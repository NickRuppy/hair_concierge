import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import ChatLoading from "../src/app/chat/loading"
import PlanBereitLoading from "../src/app/plan-bereit/loading"
import PlanStartLoading from "../src/app/plan-start/loading"
import ProfileLoading from "../src/app/profile/loading"
import TrackerLoading from "../src/app/tracker/loading"

const shells = [
  ["Planstart", PlanStartLoading, "plan-start-loading-shell", "plan-start"],
  ["Profil", ProfileLoading, "profile-loading-shell", "profile"],
  ["Chat", ChatLoading, "chat-loading-shell", "chat"],
  ["Tracker", TrackerLoading, "tracker-loading-shell", "tracker"],
] as const

// /plan-bereit deliberately left the neutral-shell family: its loading shell
// continues the post-payment opening frame that /welcome already painted
// (founder sign-off 02.09.2026), so the streaming gap shows identical pixels.
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
