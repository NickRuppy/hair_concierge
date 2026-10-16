import "./helpers/dom"

import assert from "node:assert/strict"
import { after, afterEach, mock, test } from "node:test"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import React from "react"

import { QuizBrowserHistoryProvider } from "../src/components/quiz/quiz-browser-history"
import { QuizLeadCapture } from "../src/components/quiz/quiz-lead-capture"
import { DiscoveryIntakeChecklist } from "../src/components/discovery/intake/discovery-intake-checklist"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import { resetDiscoveryQuizContextPrefetchForTests } from "../src/lib/quiz/discovery-context-prefetch"
import { useQuizStore } from "../src/lib/quiz/store"
import { createClient } from "../src/lib/supabase/client"
import { AuthProvider } from "../src/providers/auth-provider"

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-handoff-fixture"
after(async () => createClient().auth.dispose())

// Unlike the older hook dispatcher tests, mount both the lead capture and its
// continuation child with real React effects/store subscriptions. Only auth,
// transport and navigation are fixtures; no customer or database is involved.
afterEach(async () => {
  cleanup()
  await createClient().auth.stopAutoRefresh()
  mock.restoreAll()
  useQuizStore.getState().reset()
  resetDiscoveryQuizContextPrefetchForTests()
})

function mountParticipant() {
  const supabase = createClient()
  mock.method(
    supabase.auth,
    "onAuthStateChange",
    (callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) => {
      callback("INITIAL_SESSION", {
        user: {
          id: "20000000-0000-4000-8000-000000000002",
          app_metadata: { discovery_enrollment_id: "30000000-0000-4000-8000-000000000003" },
        },
      } as never)
      return { data: { subscription: { unsubscribe() {} } } } as never
    },
  )
  mock.method(
    supabase,
    "from",
    () =>
      ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }) as never,
  )

  useQuizStore.setState({
    step: 9,
    leadCaptureMode: "discovery",
    leadCaptureSubStep: "consent",
    answers: {
      structure: "curly",
      thickness: "normal",
      density: "high",
      hair_length: "very_long",
      fingertest: "leicht_uneben",
      pulltest: "stretches_bounces",
      scalp_type: "ausgeglichen",
      has_scalp_issue: false,
      treatment: ["natur"],
      concerns: ["lost_shape"],
      goals: ["shape_definition"],
    },
    lead: { name: "Fixture", email: "fixture@example.test", marketingConsent: false },
    leadId: null,
    funnelPackageKey: null,
  })

  const requests: Array<Record<string, unknown>> = []
  const replies: Array<(response: Response) => void> = []
  mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) === "/api/beratung/quiz-context") {
      return Response.json({
        status: "participant",
        name: "Fixture",
        email: "fixture@example.test",
      })
    }
    assert.equal(String(url), "/api/quiz/lead", "no unrelated network request")
    requests.push(JSON.parse(String(init?.body)))
    return new Promise<Response>((resolve) => replies.push(resolve))
  })
  mock.method(window, "scrollTo", () => {})
  const pushes: string[] = []
  const router = {
    push: (href: string) => void pushes.push(href),
    prefetch() {},
    replace() {},
    refresh() {},
    back() {},
    forward() {},
  }
  const ui = (
    <AppRouterContext.Provider value={router as never}>
      <AuthProvider>
        <QuizBrowserHistoryProvider>
          <QuizLeadCapture />
        </QuizBrowserHistoryProvider>
      </AuthProvider>
    </AppRouterContext.Provider>
  )
  return { ...render(ui), ui, requests, replies, pushes }
}

test("a participant tap while the quiz is saving continues once with the returned lead", async () => {
  const flow = mountParticipant()
  await waitFor(() => assert.equal(flow.requests.length, 1))
  assert.equal(flow.requests[0].marketingConsent, false)
  assert.ok(screen.getByText("Profil fertig"))
  assert.ok(screen.getByText("Produkte offen"))
  assert.ok(screen.getByRole("heading", { name: "Als Nächstes: deine Produkte." }))
  fireEvent.click(screen.getByRole("button", { name: "Produkte ergänzen" }))
  assert.deepEqual(flow.pushes, [], "waits for the saved lead")
  await act(async () =>
    flow.replies[0](Response.json({ leadId: "handoff-lead", journey: "discovery" })),
  )
  await waitFor(() => assert.deepEqual(flow.pushes, ["/beratung/produkte?lead=handoff-lead"]))
  assert.equal(flow.requests.length, 1)
})

test("a failed save can be retried and the successful retry continues to products", async () => {
  const flow = mountParticipant()
  await waitFor(() => assert.equal(flow.requests.length, 1))
  await act(async () => flow.replies[0](Response.json({ error: "unavailable" }, { status: 503 })))
  assert.ok(await screen.findByRole("alert"))
  fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }))
  await waitFor(() => assert.equal(flow.requests.length, 2))
  await act(async () =>
    flow.replies[1](Response.json({ leadId: "retry-lead", journey: "discovery" })),
  )
  fireEvent.click(screen.getByRole("button", { name: "Produkte ergänzen" }))
  await waitFor(() => assert.deepEqual(flow.pushes, ["/beratung/produkte?lead=retry-lead"]))
})

test("returning to the saved quiz ending keeps continuation usable without saving again", async () => {
  const flow = mountParticipant()
  await waitFor(() => assert.equal(flow.requests.length, 1))
  await act(async () =>
    flow.replies[0](Response.json({ leadId: "return-lead", journey: "discovery" })),
  )
  flow.unmount()
  render(flow.ui)
  fireEvent.click(await screen.findByRole("button", { name: "Produkte ergänzen" }))
  await waitFor(() => assert.deepEqual(flow.pushes, ["/beratung/produkte?lead=return-lead"]))
  assert.equal(flow.requests.length, 1, "the same saved answers are reused")
})

test("a returning draft with products can finish budget, routine, heat and final submission", async () => {
  const calls: Array<{ url: string; method: unknown; body: unknown }> = []
  mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    calls.push({ url: String(url), method: init?.method, body })
    if (String(url) === "/api/profile/shopping-preferences")
      return Response.json({ budget: body.budget, revision: 2 })
    if (String(url) === "/api/beratung/intake/heat-styling")
      return Response.json({ heatStyling: body })
    assert.equal(String(url), "/api/beratung/intake/submit")
    return Response.json({ submittedAt: "2026-10-16T16:00:00Z", confirmedNone: [] })
  })
  mock.method(window, "scrollTo", () => {})
  const items: DiscoveryIntakeItemView[] = ["shampoo", "conditioner", "oil"].map((category, i) => ({
    id: `fixture-product-${i}`,
    category: category as DiscoveryIntakeItemView["category"],
    source: "catalog_search",
    brandText: "Beispiel",
    productNameText: `Pflege ${i}`,
    barcodeIdentifier: null,
    productType: category as DiscoveryIntakeItemView["productType"],
    frequency: "weekly_3_4x",
  }))
  render(
    <DiscoveryIntakeChecklist
      initialItems={items}
      initialSubmitted={false}
      retailerSearchEnabled={false}
      budgetEnabled
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Weiter" }))
  fireEvent.click(await screen.findByRole("button", { name: "Keine feste Preisgrenze" }))
  fireEvent.click(screen.getByRole("button", { name: "Weiter" }))
  fireEvent.click(await screen.findByRole("button", { name: "Stimmt so" }))
  fireEvent.click(await screen.findByRole("button", { name: "Keiner dieser Wege" }))
  fireEvent.click(screen.getByRole("button", { name: "Weiter" }))
  fireEvent.click(await screen.findByRole("button", { name: "Keine weiteren Tools" }))
  fireEvent.click(screen.getByRole("button", { name: "Weiter" }))
  fireEvent.click(await screen.findByRole("button", { name: "Abschicken" }))
  assert.ok(await screen.findByRole("heading", { name: "Danke! Bis bald im Gespräch." }))
  assert.deepEqual(
    calls.map(({ url, method }) => [url, method]),
    [
      ["/api/profile/shopping-preferences", "POST"],
      ["/api/beratung/intake/heat-styling", "PUT"],
      ["/api/beratung/intake/submit", "POST"],
    ],
  )
  assert.deepEqual(calls[2].body, { confirmNoneForMissing: true })
})
