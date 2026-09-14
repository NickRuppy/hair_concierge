import { test, expect, type Page } from "@playwright/test"
import { build } from "esbuild"
import { readFile, mkdir } from "node:fs/promises"
import postcss from "postcss"
import tailwind from "@tailwindcss/postcss"
import type { TrialMembershipState } from "../src/lib/billing/trial-membership"

test.setTimeout(30_000)
let bundle: string
let styles: string
const state: TrialMembershipState = {
  kind: "trial_membership",
  enrollmentId: "22222222-2222-4222-8222-222222222222",
  phase: "trial",
  interval: "year",
  originalTrialEndAt: "2026-09-20T10:30:00.000Z",
  paidThroughAt: null,
  firstPaymentSucceededAt: null,
  cancelAtPeriodEnd: false,
  canCancelTrial: true,
  firstAmountMinor: 6999,
  renewalAmountMinor: 9999,
  currency: "EUR",
}
const receipt = {
  declaration: {
    declarationId: "33333333-3333-4333-8333-333333333333",
    submittedAt: "2026-09-16T12:00:00.000Z",
    effectiveEndAt: "2026-09-20T10:30:00.000Z",
  },
  providerStatus: "pending",
}

test.beforeAll(async () => {
  styles = (
    await postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), {
      from: "src/app/globals.css",
    })
  ).css
  const result = await build({
    stdin: {
      contents: `import React from 'react';import{createRoot}from'react-dom/client';import{TrialMembership}from'./src/components/profile/trial-membership';import{TrialMembershipRecovery}from'./src/components/reactivation/trial-membership-recovery';createRoot(document.getElementById('app')).render(<section className="mx-auto mt-4 max-w-xl rounded-2xl border border-border/60 bg-card/60 p-6">{window.fixtureRecovery?<TrialMembershipRecovery initialState={window.fixtureState}/>:<TrialMembership state={window.fixtureState}/>}</section>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins:
      process.env.TRIAL_MEMBERSHIP_RECEIPT_RED === "true"
        ? [
            {
              name: "receipt-regression",
              setup(build) {
                build.onLoad(
                  { filter: /components\/profile\/trial-membership\.tsx$/ },
                  async (args) => ({
                    contents: (await readFile(args.path, "utf8")).replace(
                      "if (response.ok && isReceipt(body))",
                      'if (response.ok && isReceipt(body) && body.providerStatus === "confirmed")',
                    ),
                    loader: "tsx",
                    resolveDir: process.cwd() + "/src/components/profile",
                  }),
                )
              },
            },
          ]
        : [],
  })
  bundle = result.outputFiles[0].text
})

async function mount(
  page: Page,
  replies: Array<"network" | { status: number; body: unknown }>,
  overrides: Partial<TrialMembershipState> = {},
  recovery = false,
) {
  const posts: unknown[] = []
  const paths: string[] = []
  await page.clock.install({ time: new Date("2026-09-16T12:00:00Z") })
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    paths.push(url.pathname)
    const current = { ...state, ...overrides }
    if (url.pathname === "/api/billing/trial-management") {
      return route.fulfill({
        json: {
          enrollmentId: current.enrollmentId,
          revision: 0,
          interval: current.interval,
          originalTrialEndAt: current.originalTrialEndAt,
          cancelAtPeriodEnd: current.cancelAtPeriodEnd,
          canManage: current.phase === "trial",
          pendingOperation: null,
          offers: {
            month: {
              interval: "month",
              currency: "EUR",
              firstAmountMinor: 999,
              renewalAmountMinor: 999,
            },
            year: {
              interval: "year",
              currency: "EUR",
              firstAmountMinor: 6999,
              renewalAmountMinor: 9999,
            },
          },
        },
      })
    }
    if (url.pathname === "/api/billing/trial-paid-recovery") {
      return route.fulfill({
        json: {
          enrollmentId: current.enrollmentId,
          revision: 0,
          originalTrialEndAt: current.originalTrialEndAt,
          paidThroughAt: current.paidThroughAt,
          cancelAtPeriodEnd: current.cancelAtPeriodEnd,
          kind: null,
          pendingOperation: null,
          offer: {
            interval: current.interval,
            currency: "EUR",
            firstAmountMinor: current.firstAmountMinor,
            renewalAmountMinor: current.renewalAmountMinor,
          },
        },
      })
    }
    if (url.pathname === "/api/billing/trial-cancellation") {
      if (route.request().method() === "GET") {
        expect(url.searchParams.get("enrollmentId")).toBe(state.enrollmentId)
        return route.fulfill({ json: { capability: "signed-stable-capability" } })
      }
      posts.push(route.request().postDataJSON())
      const reply = replies.shift()
      if (reply === "network") return route.abort()
      return route.fulfill({ status: reply?.status ?? 200, json: reply?.body ?? receipt })
    }
    if (url.pathname === "/api/billing/membership") {
      const reply = replies.shift()
      if (reply === "network") return route.abort()
      return route.fulfill({
        status: reply?.status ?? 503,
        json: reply?.body ?? { state: { kind: "uncertain" } },
      })
    }
    if (url.hostname === "membership.fixture" && url.pathname === "/")
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div></body></html>',
      })
    return route.abort()
  })
  await page.goto("http://membership.fixture")
  await page.evaluate(
    (value) => {
      Object.assign(window, { fixtureState: value.state, fixtureRecovery: value.recovery })
    },
    { state: { ...state, ...overrides }, recovery },
  )
  await page.addStyleTag({ content: styles })
  await page.addScriptTag({ content: bundle })
  return { posts, paths }
}

async function confirm(page: Page) {
  await page.getByRole("button", { name: "Testabo kündigen", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("20.09.2026, 12:30 MESZ")
  await page.getByRole("button", { name: "Jetzt kündigen", exact: true }).click()
}

test("saved cancellation with a provider timeout shows receipt, never asks to cancel again, and downloads the original deadline", async ({
  page,
}) => {
  const calls = await mount(page, [])
  await expect(page.getByText("69,99", { exact: false })).toBeVisible()
  await expect(page.getByText("Ab dem zweiten Jahr", { exact: false })).toContainText("99,99")
  await expect(page.getByRole("button", { name: "Plan ändern", exact: true })).toBeVisible()
  await confirm(page)
  await expect(
    page.getByRole("heading", { name: "Deine Kündigung ist eingegangen." }),
  ).toBeFocused()
  await expect(page.getByRole("region", { name: "Eingangsbestätigung" })).toContainText(
    "Du musst nicht erneut kündigen",
  )
  await expect(page.getByRole("region", { name: "Eingangsbestätigung" })).not.toContainText(
    "wurde gesendet",
  )
  await expect(page.getByRole("button", { name: "Testabo kündigen" })).toHaveCount(0)
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Bestätigung speichern" }).click()
  const download = await downloading
  const text = await readFile((await download.path())!, "utf8")
  expect(text).toContain("Eingang (UTC): 2026-09-16T12:00:00.000Z")
  expect(text).toContain("Zugang bis (UTC): 2026-09-20T10:30:00.000Z")
  expect(calls.posts).toEqual([
    { enrollmentId: state.enrollmentId, capability: "signed-stable-capability" },
  ])
  expect(
    calls.paths.some(
      (path) => path.includes("portal-session") || path.includes("cancel-subscription"),
    ),
  ).toBe(false)
})

test("lost response retries the same capability after expiry, without claiming cancellation failed", async ({
  page,
}) => {
  const calls = await mount(page, ["network", { status: 401, body: { error: "unauthenticated" } }])
  await confirm(page)
  await expect(page.getByRole("alert")).toContainText("konnte gerade nicht bestätigt werden")
  await expect(page.getByRole("alert")).not.toContainText("konnte nicht gespeichert werden")
  await page.clock.fastForward(4 * 24 * 60 * 60 * 1000)
  await page.getByRole("button", { name: "Eingang erneut prüfen" }).click()
  await expect(page.getByRole("alert")).not.toContainText("konnte nicht gespeichert werden")
  await page.getByRole("button", { name: "Eingang erneut prüfen" }).click()
  await expect(
    page.getByRole("heading", { name: "Deine Kündigung ist eingegangen." }),
  ).toBeVisible()
  expect(calls.posts).toHaveLength(3)
  expect(calls.posts[1]).toEqual(calls.posts[0])
  expect(calls.paths.filter((path) => path === "/api/billing/trial-cancellation")).toHaveLength(4)
})

test("failed durable save preserves the confirmation and allows retry", async ({ page }) => {
  await mount(page, [{ status: 409, body: { error: "cancellation_unavailable" } }])
  await confirm(page)
  await expect(page.getByRole("alert")).toContainText("konnte nicht gespeichert werden")
  await expect(page.getByRole("region", { name: "Eingangsbestätigung" })).toHaveCount(0)
  await page.getByRole("button", { name: "Jetzt kündigen", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Deine Kündigung ist eingegangen." }),
  ).toBeVisible()
})

test("monthly accepted terms do not inherit annual renewal copy", async ({ page }) => {
  await mount(page, [], { interval: "month", firstAmountMinor: 999, renewalAmountMinor: 999 })
  await expect(page.getByText("9,99", { exact: false })).toContainText("pro Monat")
  await expect(page.getByText("Ab dem zweiten Jahr", { exact: false })).toHaveCount(0)
})

test("an already canceled trial cannot enter legacy management or claim email delivery", async ({
  page,
}) => {
  await mount(page, [], { cancelAtPeriodEnd: true, canCancelTrial: false })
  await expect(page.getByText("Deine Kündigung ist eingegangen.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Testabo kündigen", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Abo fortsetzen", exact: true })).toBeVisible()
  await expect(page.locator("body")).not.toContainText("wurde gesendet")
})

test("approved membership styling fits mobile and desktop through confirmation and receipt", async ({
  page,
}) => {
  await mount(page, [])
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByRole("heading", { name: "Mitgliedschaft", exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (process.env.TRIAL_MEMBERSHIP_SCREENSHOT_DIR) {
      await mkdir(process.env.TRIAL_MEMBERSHIP_SCREENSHOT_DIR, { recursive: true })
      await page.screenshot({
        path: `${process.env.TRIAL_MEMBERSHIP_SCREENSHOT_DIR}/membership-${width}.png`,
        fullPage: true,
      })
    }
  }
  await page.setViewportSize({ width: 360, height: 800 })
  await page.getByRole("button", { name: "Testabo kündigen", exact: true }).click()
  const box = await page.getByRole("dialog").boundingBox()
  expect(box?.width).toBeLessThanOrEqual(360)
  if (process.env.TRIAL_MEMBERSHIP_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.TRIAL_MEMBERSHIP_SCREENSHOT_DIR}/confirmation-360.png`,
    })
  await page.getByRole("button", { name: "Jetzt kündigen", exact: true }).click()
  await expect(page.getByRole("region", { name: "Eingangsbestätigung" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (process.env.TRIAL_MEMBERSHIP_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.TRIAL_MEMBERSHIP_SCREENSHOT_DIR}/receipt-360.png`,
    })
})

test("locked trial management exposes status and required declaration links without private preview or legacy checkout", async ({
  page,
}) => {
  const calls = await mount(
    page,
    [{ status: 503, body: { state: { kind: "uncertain" } } }],
    { phase: "locked", canCancelTrial: false },
    true,
  )
  await expect(page.getByRole("button", { name: "Status erneut prüfen" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Vertrag kündigen", exact: true })).toHaveAttribute(
    "href",
    "/kuendigen",
  )
  await expect(page.getByRole("link", { name: "Widerruf erklären" })).toHaveAttribute(
    "href",
    "/widerruf/erklaeren",
  )
  await expect(page.getByRole("link", { name: "Hilfe erhalten" })).toHaveAttribute(
    "href",
    "/kontakt",
  )
  await expect(
    page.getByRole("button", { name: /reaktivieren|zur Zahlung|PayPal|Jetzt kündigen/i }),
  ).toHaveCount(0)
  await expect(page.locator("body")).not.toContainText("Deine bisherige Routine")
  await page.getByRole("button", { name: "Status erneut prüfen" }).click()
  await expect(page.getByRole("alert")).toContainText("konnte gerade nicht bestätigt werden")
  await expect(page.getByRole("button", { name: /reaktivieren|zur Zahlung|PayPal/i })).toHaveCount(
    0,
  )
  expect(calls.paths.filter((path) => path.startsWith("/api/")).sort()).toEqual([
    "/api/billing/membership",
    "/api/billing/trial-paid-recovery",
  ])
})
