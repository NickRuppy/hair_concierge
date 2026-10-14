import { test, expect } from "@playwright/test"
import { build } from "esbuild"
import { execFileSync } from "node:child_process"
import path from "node:path"

// Mount the real Chaarlie components. Only external SDKs/telemetry and support
// transport are replaced; no real provider or application API request can escape.
test.setTimeout(30_000)
let bundle: string
const reactivationFile = "src/components/reactivation/membership-reactivation-checkout.tsx"
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@stripe/stripe-js/pure": "export const loadStripe = async () => null",
    "@stripe/react-stripe-js": `import React,{useEffect} from 'react'; export function EmbeddedCheckoutProvider({options,children}) {useEffect(()=>{options.fetchClientSecret().catch(()=>{})},[]);return children} export function EmbeddedCheckout(){return <div data-testid="stripe-checkout">Sicherer Karten-Checkout</div>}`,
    "@paypal/react-paypal-js": `import React,{useEffect} from 'react'; export const FUNDING={PAYPAL:'paypal'};export const usePayPalScriptReducer=()=>[{}]; export function PayPalScriptProvider({children}){return children} export function PayPalButtons(p){useEffect(()=>{p.onInit?.()},[]);return <button onClick={()=>p.createSubscription({}, {subscription:{create:async()=>{window.__sdkCreates=(window.__sdkCreates||0)+1;return 'I_fixture'}}}).catch(()=>p.onError?.())}>PayPal</button>}`,
    "next/dynamic": `import React,{lazy,Suspense} from 'react';export default function dynamic(loader){const C=lazy(()=>loader().then(defaultExport=>({default:defaultExport})));return props=><Suspense><C {...props}/></Suspense>}`,
    "@/lib/analytics/track-app-event": "export const trackAppEvent=()=>{}",
    "@/lib/funnel/client":
      "let n=0;export const createFunnelEventId=()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;export const getCurrentFunnelContext=()=>null;export const bootstrapFunnelContext=async()=>null",
    "@/lib/observability/checkout": "export const addCheckoutBreadcrumb=()=>{}",
    "@/lib/observability/payment-client": "export const capturePaymentFailure=()=>{}",
    "@/components/providers/payment-runtime-provider":
      "export const usePaymentRuntime=()=>({stripeLive:false,paypalLive:false})",
    "@/components/quiz/offer-tracking-provider":
      "export const useOfferTrackingContext=()=>({isInternalTest:true})",
    "@/components/checkout/use-payment-support-report":
      "export const usePaymentSupportReport=()=>({state:{status:'idle'},report:()=>{window.__reports=(window.__reports||0)+1}})",
    "@/lib/funnel/flags":
      "export const isPaymentFeedbackV2Enabled=()=>true;export const isPaymentSupportUiEnabled=()=>true",
  }
  const output = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MembershipReactivationCheckout} from './${reactivationFile}';createRoot(document.getElementById('app')).render(<MembershipReactivationCheckout initialInterval="year" pricingCatalog="standard" returnDestination="/routine?view=week"/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: {
      "process.env": "{}",
      "process.env.NODE_ENV": '"test"',
      "process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": '"pk_test_fixture"',
      "process.env.NEXT_PUBLIC_PAYPAL_ENABLED": '"true"',
      "process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID": '"fixture"',
    },
    plugins: [
      {
        name: "external-boundaries",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (mocks[args.path]) return { path: args.path, namespace: "fixture" }
            if (args.path.endsWith("stripe-offer-elements-checkout"))
              return { path: "offer-elements", namespace: "fixture" }
          })
          build.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: mocks[args.path] ?? "export const StripeOfferElementsCheckout=()=>null",
            loader: "tsx",
            resolveDir: process.cwd(),
          }))
          // Red proof runs the exact current test against the pre-repair component.
          if (process.env.REACTIVATION_RECOVERY_BASELINE === "true") {
            build.onLoad({ filter: /membership-reactivation-checkout\.tsx$/ }, () => ({
              contents: execFileSync("git", ["show", `HEAD:${reactivationFile}`], {
                encoding: "utf8",
              }),
              loader: "tsx",
              resolveDir: path.dirname(path.resolve(reactivationFile)),
            }))
          }
        },
      },
    ],
  })
  bundle = output.outputFiles[0].text
})

async function mount(
  page: import("@playwright/test").Page,
  replies: Array<{ status: number; body: unknown } | "network">,
) {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = []
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith("/api/")) {
      requests.push({ path: url.pathname, body: route.request().postDataJSON() })
      const reply = replies.shift() ?? {
        status: 409,
        body: { recovery: { provider: "stripe", state: "pending" } },
      }
      if (reply === "network") return route.abort()
      return route.fulfill({ status: reply.status, json: reply.body })
    }
    if (url.hostname === "checkout.fixture")
      return route.fulfill({
        contentType: "text/html",
        body: '<html><body><div id="app"></div></body></html>',
      })
    return route.abort()
  })
  page.on("pageerror", (error) => console.error("fixture page error", error.message))
  await page.goto("http://checkout.fixture")
  await page.addScriptTag({ content: bundle })
  await page.getByRole("button", { name: /Mitgliedschaft reaktivieren/ }).click()
  return requests
}

test("both providers show explicit sign-in with selected plan; sign-in has no purchase side effect", async ({
  page,
}) => {
  for (const provider of ["stripe", "paypal"]) {
    const requests = await mount(page, [
      { status: 401, body: { error: "reactivation_authentication_required" } },
    ])
    await page
      .getByRole("button", {
        name: provider === "stripe" ? "Karte & weitere" : "PayPal",
        exact: true,
      })
      .click()
    await expect(page.getByRole("heading", { name: "Bitte melde dich erneut an" })).toBeVisible()
    const href = await page
      .getByRole("link", { name: "Einloggen und fortfahren" })
      .getAttribute("href")
    const next = new URL(
      new URL(href!, "http://checkout.fixture").searchParams.get("next")!,
      "http://checkout.fixture",
    )
    expect(next.searchParams.get("interval")).toBe("year")
    expect(next.searchParams.get("next")).toBe("/routine?view=week")
    await expect(page.getByRole("button", { name: "Problem melden", exact: true })).toHaveCount(0)
    expect(requests).toHaveLength(1)
    expect(await page.evaluate(() => (window as any).__sdkCreates ?? 0)).toBe(0)
    expect(await page.evaluate(() => (window as any).__reports ?? 0)).toBe(0)
    await page.getByRole("link", { name: "Einloggen und fortfahren" }).click()
    expect(requests).toHaveLength(1)
    expect(await page.evaluate(() => (window as any).__sdkCreates ?? 0)).toBe(0)
  }
})

test("lost Stripe response keeps one attempt, resumes explicitly and never exposes PayPal", async ({
  page,
}) => {
  const requests = await mount(page, [
    "network",
    { status: 200, body: { client_secret: "cs_fixture_secret" } },
  ])
  await page.getByRole("button", { name: "Karte & weitere", exact: true }).click()
  await expect(page.getByRole("button", { name: "Bezahlvorgang fortsetzen" })).toBeVisible()
  await expect(page.getByRole("button", { name: "PayPal", exact: true })).toHaveCount(0)
  await expect(page.getByText("Es wurde nichts abgebucht.")).toHaveCount(0)
  await page.getByRole("button", { name: "Bezahlvorgang fortsetzen" }).dblclick()
  await expect(page.getByTestId("stripe-checkout")).toBeVisible()
  expect(requests).toHaveLength(2)
  expect(requests[1].body.checkoutAttemptId).toBe(requests[0].body.checkoutAttemptId)
  expect(requests[1].body.recoveryOnly).toBe(true)
})

test("server-owned PayPal conflict changes provider and plan; pending status never creates another subscription", async ({
  page,
}) => {
  const requests = await mount(page, [
    {
      status: 409,
      body: { recovery: { provider: "paypal", state: "pending", interval: "month" } },
    },
    { status: 200, body: { token: "existing-token", planId: "P-existing" } },
  ])
  await page.getByRole("button", { name: "Karte & weitere", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Zahlungsstatus noch offen" })).toBeVisible()
  await page.getByRole("button", { name: "Status prüfen", exact: true }).click()
  await expect(page.getByRole("button", { name: "Status prüfen", exact: true })).toBeVisible()
  expect(requests[1].path).toBe("/api/paypal/create-subscription-intent")
  expect(requests[1].body.interval).toBe("month")
  expect(await page.evaluate(() => (window as any).__sdkCreates ?? 0)).toBe(0)
  await expect(page.getByRole("button", { name: "Karte & weitere" })).toHaveCount(0)
  await page.getByRole("button", { name: "Problem melden", exact: true }).click()
  expect(await page.evaluate(() => (window as any).__reports)).toBe(1)
})

test("a server-confirmed no-start can return to method selection", async ({ page }) => {
  const requests = await mount(page, [
    { status: 503, body: { recovery: { provider: null, state: "not_started" } } },
  ])
  await page.getByRole("button", { name: "Karte & weitere", exact: true }).click()
  await expect(page.getByText("Für diesen Versuch wurde keine Zahlung gestartet.")).toBeVisible()
  await page.getByRole("button", { name: "Erneut versuchen", exact: true }).click()
  await expect(page.getByRole("button", { name: "PayPal", exact: true })).toBeVisible()
  expect(requests).toHaveLength(1)
  await page.getByRole("button", { name: "Karte & weitere", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Zahlungsstatus noch offen" })).toBeVisible()
  expect(requests).toHaveLength(2)
  expect(requests[1].body.checkoutAttemptId).not.toBe(requests[0].body.checkoutAttemptId)
})

test("existing provider completion goes straight to the verified welcome route on initial selection", async ({
  page,
}) => {
  for (const provider of ["stripe", "paypal"]) {
    const statusUrl =
      provider === "stripe"
        ? "/welcome?session_id=cs_owned"
        : "/welcome?provider=paypal&token=owned"
    const requests = await mount(page, [{ status: 200, body: { statusUrl } }])
    await page
      .getByRole("button", {
        name: provider === "stripe" ? "Karte & weitere" : "PayPal",
        exact: true,
      })
      .click()
    await expect(page).toHaveURL(`http://checkout.fixture${statusUrl}`)
    expect(requests).toHaveLength(1)
  }
})

test("an external status destination remains pending and cannot navigate or open another provider", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, [{ status: 200, body: { statusUrl: "https://evil.example/welcome" } }])
  await page.getByRole("button", { name: "Karte & weitere", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Zahlungsstatus noch offen" })).toBeVisible()
  await expect(page).toHaveURL("http://checkout.fixture/")
  await expect(page.getByRole("button", { name: "PayPal", exact: true })).toHaveCount(0)
})
