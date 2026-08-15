import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { AuthenticatedAppShell } from "../src/components/layout/authenticated-app-shell"
import { PersonalPlanNavigationView } from "../src/components/layout/personal-plan-navigation"
import {
  resolveAuthenticatedAppNavigationAccess,
  toAuthenticatedAppNavigationAccess,
} from "../src/lib/personal-plan/navigation-access"
import type { PersonalPlanJourneyAccess } from "../src/lib/personal-plan/journey-access"

function personalPlanAccess(
  stage4: boolean,
  stage5: boolean,
): Extract<PersonalPlanJourneyAccess, { kind: "personal_plan" }> {
  return {
    kind: "personal_plan",
    personalPlanId: "plan-1",
    frontier: stage5 ? "stage5" : stage4 ? "stage4" : "stage3",
    nextHref: stage5 ? "/anwendung" : stage4 ? "/routine" : "/plan-start",
    allowed: { stage1: true, stage2: true, stage3: true, stage4, stage5 },
  }
}

test("Personal Plan navigation exposes only reachable destinations in the signed order", () => {
  assert.deepEqual(toAuthenticatedAppNavigationAccess(personalPlanAccess(false, false)), {
    kind: "personal_plan",
    hasPendingRoutineProposal: false,
    items: [
      { key: "chat", href: "/chat", label: "Chat" },
      { key: "profile", href: "/profile", label: "Profil" },
    ],
  })
  assert.deepEqual(toAuthenticatedAppNavigationAccess(personalPlanAccess(true, false)), {
    kind: "personal_plan",
    hasPendingRoutineProposal: false,
    items: [
      { key: "chat", href: "/chat", label: "Chat" },
      { key: "routine", href: "/routine", label: "Routine" },
      { key: "profile", href: "/profile", label: "Profil" },
    ],
  })
  assert.deepEqual(toAuthenticatedAppNavigationAccess(personalPlanAccess(true, true)), {
    kind: "personal_plan",
    hasPendingRoutineProposal: false,
    items: [
      { key: "chat", href: "/chat", label: "Chat" },
      { key: "routine", href: "/routine", label: "Routine" },
      { key: "application", href: "/anwendung", label: "Anwendung" },
      { key: "profile", href: "/profile", label: "Profil" },
    ],
  })
})

test("Personal Plan navigation carries the already-authoritative routine-attention state", () => {
  const access = {
    ...personalPlanAccess(true, false),
    hasPendingRoutineProposal: true,
  } as PersonalPlanJourneyAccess
  const navigation = toAuthenticatedAppNavigationAccess(access)

  assert.equal(navigation.kind, "personal_plan")
  assert.equal(navigation.hasPendingRoutineProposal, true)
})

test("legacy, paid-pending, and navigation read failures keep exactly one legacy Header", async () => {
  assert.deepEqual(toAuthenticatedAppNavigationAccess({ kind: "legacy" }), { kind: "legacy" })
  assert.deepEqual(
    toAuthenticatedAppNavigationAccess({ kind: "paid_pending", recoveryHref: "/plan-bereit" }),
    { kind: "legacy" },
  )

  const navigation = await resolveAuthenticatedAppNavigationAccess({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => {
      throw new Error("database unavailable")
    },
  })
  const html = renderToStaticMarkup(
    createElement(AuthenticatedAppShell, {
      navigation,
      legacyHeader: createElement("header", { "data-legacy-header": true }, "Legacy"),
      personalPlanNavigation: createElement(
        "nav",
        { "data-personal-plan-navigation": true },
        "Personal Plan",
      ),
      children: createElement("main", null, "Nutzbarer Inhalt"),
    }),
  )

  assert.equal((html.match(/data-legacy-header/g) ?? []).length, 1)
  assert.doesNotMatch(html, /data-personal-plan-navigation/)
  assert.match(html, /Nutzbarer Inhalt/)
  assert.doesNotMatch(html, /personal-plan-shell-bottom-padding/)
})

test("the signed navigation marks the current destination and the shell owns its bottom clearance", () => {
  const navigation = toAuthenticatedAppNavigationAccess(personalPlanAccess(true, true))
  assert.equal(navigation.kind, "personal_plan")
  const navHtml = renderToStaticMarkup(
    createElement(PersonalPlanNavigationView, {
      items: navigation.items,
      pathname: "/anwendung/wash_day",
    }),
  )
  // Die Navigation existiert doppelt: Header-Links (md+) und Tab-Bar (mobil, md:hidden).
  assert.match(navHtml, /aria-label="Personal-Plan-Navigation"/)
  assert.match(navHtml, /aria-label="Personal-Plan-Navigation \(mobil\)"/)
  assert.equal((navHtml.match(/aria-current="page"/g) ?? []).length, 2)
  assert.match(navHtml, /aria-current="page"[^>]*href="\/anwendung"/)
  assert.equal((navHtml.match(/>Chat</g) ?? []).length, 2)
  assert.equal((navHtml.match(/>Routine</g) ?? []).length, 2)
  assert.equal((navHtml.match(/>Anwendung</g) ?? []).length, 2)
  assert.equal((navHtml.match(/>Profil</g) ?? []).length, 2)

  const shellHtml = renderToStaticMarkup(
    createElement(AuthenticatedAppShell, {
      navigation,
      legacyHeader: createElement("header", null, "Legacy"),
      personalPlanNavigation: createElement("nav", null, "Personal Plan"),
      children: createElement("main", null, "Inhalt"),
    }),
  )
  assert.match(shellHtml, /--personal-plan-shell-bottom-padding/)
  assert.match(shellHtml, /data-personal-plan-content="true"/)
  // Padding jetzt als responsive Klasse (mobil aktiv, ab md entfällt die Tab-Bar-Kompensation);
  // die Variable selbst bleibt konstant, weil application-state seine Höhe daraus ableitet.
  assert.match(shellHtml, /pb-\[var\(--personal-plan-shell-bottom-padding\)\] md:pb-0/)
  assert.doesNotMatch(shellHtml, /md:\[--personal-plan-shell-bottom-padding/)
  assert.doesNotMatch(shellHtml, /Legacy/)
})

test("the server shell owns Header presentation without changing the shared Header", () => {
  const header = readFileSync("src/components/layout/header.tsx", "utf8")
  assert.equal((header.match(/href="\/anwendung"/g) ?? []).length, 0)
  assert.match(header, /RoutineAttentionIndicator/)

  for (const layout of ["chat", "routine", "anwendung", "profile"]) {
    const source = readFileSync(`src/app/${layout}/layout.tsx`, "utf8")
    assert.match(source, /AuthenticatedAppShell/)
    assert.match(source, /loadAuthenticatedAppNavigationAccess/)
  }

  for (const file of [
    "src/app/chat/page.tsx",
    "src/app/chat/[conversationId]/page.tsx",
    "src/app/routine/page.tsx",
    "src/app/anwendung/page.tsx",
    "src/app/anwendung/loading.tsx",
    "src/app/profile/page.tsx",
    "src/components/routine/routine-page-client.tsx",
  ]) {
    const source = readFileSync(file, "utf8")
    assert.doesNotMatch(source, /<Header\b/)
    assert.doesNotMatch(source, /components\/layout\/header/)
  }
})

test("journey access is request-cached for shell and guarded page composition", () => {
  const navigationSource = readFileSync("src/lib/personal-plan/navigation-access.ts", "utf8")
  const routineSource = readFileSync("src/app/routine/page.tsx", "utf8")
  const applicationSource = readFileSync("src/app/anwendung/page.tsx", "utf8")
  assert.match(navigationSource, /cache\(/)
  assert.match(navigationSource, /loadCachedPersonalPlanJourneyAccessForUser/)
  assert.match(navigationSource, /loadCachedAuthenticatedAppUserId = cache/)
  assert.match(routineSource, /loadCachedPersonalPlanJourneyAccessForUser/)
  assert.match(routineSource, /getUserId: loadCachedAuthenticatedAppUserId/)
  assert.match(applicationSource, /loadCachedPersonalPlanJourneyAccessForUser/)
  assert.match(applicationSource, /getUserId: loadCachedAuthenticatedAppUserId/)
  assert.match(applicationSource, /journey\.activeRoutineVersionId/)
  assert.match(applicationSource, /loadPersonalPlanActiveRoutineVersion/)
})

test("regular Chat consumes Personal Plan clearance in the viewport once and keeps its own safe area", () => {
  const containerSource = readFileSync("src/components/chat/chat-container.tsx", "utf8")
  const inputSource = readFileSync("src/components/chat/chat-input.tsx", "utf8")

  assert.match(
    containerSource,
    /h-\[calc\(100dvh-3\.5rem-var\(--personal-plan-shell-bottom-padding,0px\)\)\]/,
  )
  assert.match(inputSource, /env\(safe-area-inset-bottom\)/)
  assert.doesNotMatch(inputSource, /personal-plan-shell-bottom-padding/)
})
