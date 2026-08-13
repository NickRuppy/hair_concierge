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
  ["Plan bereit", PlanBereitLoading, "plan-bereit-loading-shell", "plan-bereit"],
  ["Profil", ProfileLoading, "profile-loading-shell", "profile"],
  ["Chat", ChatLoading, "chat-loading-shell", "chat"],
  ["Tracker", TrackerLoading, "tracker-loading-shell", "tracker"],
] as const

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
