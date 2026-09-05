import { expect, test, type Page } from "@playwright/test"

import {
  EAN_PRODUCT_A,
  EAN_PRODUCT_B,
  EAN_UNKNOWN,
  PENDING_SUBMISSION,
  PRODUCT_A_ID,
  resolvePayloadFor,
} from "./scan-flow.fixtures"

/**
 * End-to-end cover for the `/scan` client flow, driven through the dev-only
 * `/labs/scan` harness (`src/app/labs/scan/`): a fake camera (`canvas.captureStream`)
 * and a fake barcode detector stand in for `ScannerRuntime`, and every `/api/scan/*`
 * call is fulfilled by `page.route`.
 *
 * These are the findings the unit tests cannot reach, because they only exist once a
 * real frame loop, real timers and a real DOM run together: the 400ms decode-confirm
 * window (Variante A), the D6 re-arm that stops a still-in-frame bottle from re-opening
 * the sheet it just closed (F1), the active-scanning clock behind the 3s search fallback
 * (F2), the request-token guards on a dismissed submit (F4) and a late save (F5), and
 * the camera failure / retry / stall tiles (F8, F9).
 *
 * `insecure` is deliberately not covered here: supplying a `mediaSource` skips the
 * `navigator.mediaDevices` check but not `window.isSecureContext`, which is true on
 * localhost — so the harness cannot reach that tile. Its copy is pinned by
 * `tests/scan-flow-ui.test.tsx` instead.
 */

const LAB_PATH = "/labs/scan"

// Long enough to prove a negative without being so long that a legitimately-delayed
// transition (the 3s search fallback) would land inside the window.
const STABILITY_WINDOW_MS = 1_200
const STABILITY_POLL_MS = 60

type ScanApiController = {
  resolveBodies: Array<Record<string, unknown>>
  submitBodies: Array<Record<string, unknown>>
  saveBodies: Array<Record<string, unknown>>
  /** Set to a non-200 to drive the resolve error path. */
  resolveStatus: number
  resolveErrorCode: string
  /** Resolved by the test to let a held `/api/scan/submit` answer. */
  releaseSubmit: () => void
  /** Resolved by the test to let a held `/api/scan/save` answer. */
  releaseSave: () => void
  holdSubmit: boolean
  holdSave: boolean
}

/**
 * Every scan API the flow and its sheets can call. Nothing here is conditional on a
 * scenario: the tests steer it through the returned controller, so each route handler
 * stays a single, obvious mapping.
 */
async function installScanApi(page: Page): Promise<ScanApiController> {
  let releaseSubmit: () => void = () => {}
  let releaseSave: () => void = () => {}
  const submitGate = new Promise<void>((resolve) => {
    releaseSubmit = resolve
  })
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve
  })

  const controller: ScanApiController = {
    resolveBodies: [],
    submitBodies: [],
    saveBodies: [],
    resolveStatus: 200,
    resolveErrorCode: "temporarily_unavailable",
    releaseSubmit: () => releaseSubmit(),
    releaseSave: () => releaseSave(),
    holdSubmit: false,
    holdSave: false,
  }

  await page.route("**/api/scan/resolve", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>
    controller.resolveBodies.push(body)
    if (controller.resolveStatus !== 200) {
      return route.fulfill({
        status: controller.resolveStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: controller.resolveErrorCode }),
      })
    }
    const payload = resolvePayloadFor(body as never)
    if (!payload) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "product_not_found" }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    })
  })

  await page.route("**/api/scan/submit", async (route) => {
    controller.submitBodies.push(
      JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>,
    )
    if (controller.holdSubmit) await submitGate
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PENDING_SUBMISSION),
    })
  })

  await page.route("**/api/scan/save", async (route) => {
    controller.saveBodies.push(
      JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>,
    )
    if (controller.holdSave) await saveGate
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ savedState: { state: "merkliste", managedByScan: true } }),
    })
  })

  await page.route("**/api/scan/wishlist", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [] }),
    }),
  )

  await page.route("**/api/scan/search?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [], truncated: false }),
    }),
  )

  return controller
}

async function openLab(
  page: Page,
  boot: { holdCamera?: boolean; denyCamera?: string } = {},
): Promise<void> {
  await page.addInitScript(
    ({ holdCamera, denyCamera }) => {
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
      )
      if (holdCamera) window.__SCAN_LAB_HOLD_CAMERA = true
      if (denyCamera) window.__SCAN_LAB_DENY_CAMERA = denyCamera
    },
    { holdCamera: boot.holdCamera ?? false, denyCamera: boot.denyCamera ?? "" },
  )
  await page.goto(LAB_PATH)
  await page.waitForFunction(() => Boolean(window.__scanLab))
}

/** A camera stream has been handed to the flow (the loop may still be paused). */
async function waitForCamera(page: Page, atLeast = 1): Promise<void> {
  await page.waitForFunction((minimum) => (window.__scanLab?.streams ?? 0) >= minimum, atLeast, {
    timeout: 20_000,
  })
}

/** The camera is attached AND the detection loop has actually answered a frame. */
async function waitForScanningLoop(page: Page): Promise<void> {
  await waitForCamera(page)
  await page.waitForFunction(() => (window.__scanLab?.detections ?? 0) > 0, undefined, {
    timeout: 20_000,
  })
}

function flowRoot(page: Page) {
  return page.locator("[data-scan-flow]")
}

async function emit(page: Page, value: string, times = 2): Promise<void> {
  await page.evaluate(({ value: ean, times: count }) => window.__scanLab?.emit(ean, count), {
    value,
    times,
  })
}

async function emitNone(page: Page, times = 3): Promise<void> {
  await page.evaluate((count) => window.__scanLab?.emitNone(count), times)
}

async function labState(page: Page) {
  const state = await page.evaluate(() => window.__scanLab?.state ?? null)
  if (!state) throw new Error("scan lab: the flow root carries no debug state")
  return state
}

async function trackedEventNames(page: Page): Promise<string[]> {
  return page.evaluate(() => (window.__scanLab?.events ?? []).map((event) => event.name))
}

/**
 * Proves a negative without a blind sleep: polls `read` for `windowMs` and fails on the
 * FIRST sample that violates `check`, naming the sample.
 */
async function expectStable<T>(
  read: () => Promise<T>,
  check: (value: T) => boolean,
  windowMs = STABILITY_WINDOW_MS,
): Promise<void> {
  const deadline = Date.now() + windowMs
  do {
    const value = await read()
    if (!check(value)) {
      throw new Error(`unexpected change during the stability window: ${JSON.stringify(value)}`)
    }
    await new Promise((done) => setTimeout(done, STABILITY_POLL_MS))
  } while (Date.now() < deadline)
}

/**
 * The toast stack (`providers/toast-provider`), and only it: a bare `getByRole("alert")`
 * also matches Next's route announcer, and this spec COUNTS toasts to prove the F1 error
 * loop is closed. Destructive toasts are `alert`, ordinary ones `status`.
 */
function toasts(page: Page) {
  return page.locator(
    '[data-modal-layer-exempt] [role="alert"], [data-modal-layer-exempt] [role="status"]',
  )
}

/** The bottom sheet whose panel contains `text`, by its own ✕. */
function closeSheetContaining(page: Page, text: string) {
  return page
    .getByRole("dialog")
    .filter({ hasText: text })
    .getByRole("button", { name: "Schließen" })
    .first()
}

test.describe("/scan client flow (fake camera + fake detector)", () => {
  test("F-none: a decode holds the green confirm for 400ms, then opens the result sheet", async ({
    page,
  }) => {
    const api = await installScanApi(page)
    await openLab(page)
    await waitForScanningLoop(page)

    // Started before the emit so the poll is already running when the 400ms window opens.
    const confirmSeen = page.waitForFunction(
      () => document.body.textContent?.includes("✓ Barcode erkannt") ?? false,
      undefined,
      { polling: "raf", timeout: 10_000 },
    )
    await emit(page, EAN_PRODUCT_A)
    await confirmSeen

    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "result")
    await expect(page.getByText("Lab Shampoo Alpha")).toBeVisible()
    // Twice on purpose: the sheet's sr-only dialog title and the verdict banner.
    await expect(page.getByText("Passt zu deinem Haar")).toHaveCount(2)

    // The confirm window, measured rather than raced: the flow pads a fast response out
    // to the full 400ms before it repaints over the viewfinder.
    const window400 = await page.evaluate(() => {
      const lab = window.__scanLab!
      const decoded = lab.events.find((event) => event.name === "scan_decoded")
      const result = lab.transitions.find((transition) => transition.step === "result")
      return decoded && result ? result.t - decoded.t : null
    })
    expect(window400).not.toBeNull()
    expect(window400!).toBeGreaterThanOrEqual(400)

    expect(api.resolveBodies).toHaveLength(1)
    expect(await trackedEventNames(page)).toEqual([
      "scan_started",
      "scan_decoded",
      "scan_result_shown",
    ])
  })

  test("F1/D6: the same barcode still in frame does not re-open the sheet until it leaves", async ({
    page,
  }) => {
    const api = await installScanApi(page)
    await openLab(page)
    await waitForScanningLoop(page)

    await emit(page, EAN_PRODUCT_A)
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "result")

    await closeSheetContaining(page, "Lab Shampoo Alpha").click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "scanning")
    await expect(flowRoot(page)).toHaveAttribute("data-scan-epoch", "1")

    // The bottle never moved: keep feeding the very same code.
    await emit(page, EAN_PRODUCT_A, 6)
    await expectStable(
      async () => ({ step: (await labState(page)).step, calls: api.resolveBodies.length }),
      (sample) => sample.step === "scanning" && sample.calls === 1,
      1_500,
    )

    // It leaves the frame (three empty detections) and comes back — now it may fire again.
    await emitNone(page, 4)
    await emit(page, EAN_PRODUCT_A)
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "result")
    expect(api.resolveBodies).toHaveLength(2)
  })

  test("F2: time spent in the Merkliste never counts towards the 3s search fallback", async ({
    page,
  }) => {
    await installScanApi(page)
    // The camera is held so the Merkliste is open BEFORE a single frame is scanned —
    // otherwise the assertion would race the very budget it is about to test.
    await openLab(page, { holdCamera: true })

    await page.getByRole("button", { name: "Merkliste öffnen" }).click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-auxiliary", "wishlist")

    // Only the stream: the detection loop is (correctly) paused behind the open sheet, so
    // it will not answer a single frame until the Merkliste closes.
    await page.evaluate(() => window.__scanLab?.startCamera())
    await waitForCamera(page)

    // Well past the 3s budget — but every one of those milliseconds is paused time.
    await expectStable(
      async () => (await labState(page)).auxiliary,
      (auxiliary) => auxiliary === "wishlist",
      3_500,
    )

    await closeSheetContaining(page, "Noch nichts gemerkt").click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-auxiliary", "none")

    // The clock starts here, not at page load.
    await expectStable(
      async () => (await labState(page)).auxiliary,
      (auxiliary) => auxiliary === "none",
      2_000,
    )
    await expect(flowRoot(page)).toHaveAttribute("data-scan-auxiliary", "search", {
      timeout: 8_000,
    })
    expect(await trackedEventNames(page)).toContain("scan_fallback_search_used")
  })

  test("F3: a decode that arrives while the search sheet is open resolves once it closes", async ({
    page,
  }) => {
    const api = await installScanApi(page)
    await openLab(page)
    await waitForScanningLoop(page)

    await page.getByRole("button", { name: "Produkt suchen" }).click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-auxiliary", "search")

    await emit(page, EAN_PRODUCT_A, 6)
    await expectStable(
      async () => ({ step: (await labState(page)).step, calls: api.resolveBodies.length }),
      (sample) => sample.step === "scanning" && sample.calls === 0,
    )

    await closeSheetContaining(page, "Ohne Scan finden").click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "result")
    await expect(page.getByText("Lab Shampoo Alpha")).toBeVisible()
    expect(api.resolveBodies).toHaveLength(1)
  })

  test("F4: dismissing the unknown sheet before the submit lands re-opens nothing", async ({
    page,
  }) => {
    const api = await installScanApi(page)
    api.holdSubmit = true
    await openLab(page)
    await waitForScanningLoop(page)

    await emit(page, EAN_UNKNOWN)
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "unknown")
    await expect(page.getByText(`Barcode ${EAN_UNKNOWN}`)).toBeVisible()

    await page.getByRole("button", { name: "Shampoo", exact: true }).click()
    await expect.poll(() => api.submitBodies.length).toBe(1)

    await closeSheetContaining(page, `Barcode ${EAN_UNKNOWN}`).click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "scanning")

    api.releaseSubmit()
    await expectStable(
      async () => (await labState(page)).step,
      (step) => step === "scanning",
    )
    // The row exists server-side whether or not the user is still looking at the sheet,
    // so the event fires exactly once — only the pending STEP is suppressed.
    const names = await trackedEventNames(page)
    expect(names.filter((name) => name === "scan_submission_created")).toHaveLength(1)
  })

  test("F5: a save that lands after the next product is shown leaves that product untouched", async ({
    page,
  }) => {
    const api = await installScanApi(page)
    api.holdSave = true
    await openLab(page)
    await waitForScanningLoop(page)

    await emit(page, EAN_PRODUCT_A)
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "result")

    await page.getByRole("button", { name: "Speichern", exact: true }).click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-save-open", "true")
    await page.getByRole("button", { name: /Auf die Merkliste/ }).click()
    await expect.poll(() => api.saveBodies.length).toBe(1)
    expect(api.saveBodies[0]).toMatchObject({ productId: PRODUCT_A_ID, kind: "merkliste" })

    await closeSheetContaining(page, "Wohin speichern?").click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-save-open", "false")
    await closeSheetContaining(page, "Lab Shampoo Alpha").click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "scanning")

    await emit(page, EAN_PRODUCT_B)
    await expect(page.getByText("Lab Shampoo Beta")).toBeVisible()

    // The save is answered server-side (the request is already recorded above), but the
    // user dismissed the sheet while it was in flight: the completion belongs to a
    // product nobody is looking at any more, so not one of its side effects may land —
    // no toast, no "Gemerkt" on B, no state change.
    api.releaseSave()
    await expectStable(
      async () => ({
        toastCount: await toasts(page).count(),
        leaked: await page.evaluate(
          () =>
            document.querySelector("[data-scan-flow]")?.textContent?.includes("Gemerkt") ?? true,
        ),
      }),
      (sample) => sample.toastCount === 0 && sample.leaked === false,
    )
    await expect(page.getByRole("button", { name: "Speichern", exact: true })).toBeVisible()
    await expect(page.getByText("Lab Shampoo Beta")).toBeVisible()
  })

  test("F9: a denied camera offers a retry that really re-acquires the stream", async ({
    page,
  }) => {
    const api = await installScanApi(page)
    await openLab(page, { denyCamera: "NotAllowedError" })

    await expect(flowRoot(page)).toHaveAttribute("data-scan-camera", "unavailable")
    await expect(flowRoot(page)).toHaveAttribute("data-scan-camera-reason", "denied")
    await expect(
      page.getByText("Ohne Kamerazugriff findest du dein Produkt hier über die Suche."),
    ).toBeVisible()
    // The FIRST failure pops the fallback the user actually needs.
    await expect(flowRoot(page)).toHaveAttribute("data-scan-auxiliary", "search")

    await closeSheetContaining(page, "Ohne Scan finden").click()
    await page.getByRole("button", { name: "Kamera erneut versuchen" }).click()

    await expect(flowRoot(page)).toHaveAttribute("data-scan-camera", "live")
    await waitForScanningLoop(page)
    await emit(page, EAN_PRODUCT_A)
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "result")
    expect(api.resolveBodies).toHaveLength(1)

    const names = await trackedEventNames(page)
    expect(names.filter((name) => name === "scan_fallback_search_used")).toHaveLength(1)
  })

  test("F8: a dead stream that cannot be re-acquired shows the restart tile", async ({ page }) => {
    await installScanApi(page)
    await openLab(page)
    await waitForScanningLoop(page)

    await page.evaluate(() => {
      // The re-acquire fails too, so the loop has nothing left to fall back on.
      window.__scanLab?.denyCamera("NotReadableError")
      window.__scanLab?.stall()
    })

    await expect(flowRoot(page)).toHaveAttribute("data-scan-camera", "stalled")
    await expect(page.getByText("Das Kamerabild ist abgebrochen.")).toBeVisible()
    // A stall is not a "we never had a camera": it opens nothing and tracks nothing.
    await expect(flowRoot(page)).toHaveAttribute("data-scan-auxiliary", "none")
    expect(await trackedEventNames(page)).not.toContain("scan_fallback_search_used")

    await page.getByRole("button", { name: "Kamera neu starten" }).click()
    await expect(flowRoot(page)).toHaveAttribute("data-scan-camera", "live")
    await waitForScanningLoop(page)
    await emit(page, EAN_PRODUCT_A)
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "result")
  })

  test("F8: a dead stream that re-acquires recovers silently and keeps scanning", async ({
    page,
  }) => {
    await installScanApi(page)
    await openLab(page)
    await waitForScanningLoop(page)

    const before = await page.evaluate(() => window.__scanLab!.streams)
    await page.evaluate(() => window.__scanLab?.stall())
    await page.waitForFunction((baseline) => (window.__scanLab?.streams ?? 0) > baseline, before, {
      timeout: 10_000,
    })

    await expectStable(
      async () => await labState(page),
      (state) => state.camera === "live" && state.auxiliary === "none" && state.step === "scanning",
    )
    await emit(page, EAN_PRODUCT_A)
    await expect(flowRoot(page)).toHaveAttribute("data-scan-step", "result")
  })

  test("F1: a failing resolve toasts once and does not loop on the barcode still in frame", async ({
    page,
  }) => {
    const api = await installScanApi(page)
    api.resolveStatus = 503
    await openLab(page)
    await waitForScanningLoop(page)

    await emit(page, EAN_PRODUCT_A, 6)
    await expect(toasts(page)).toHaveText(["Hat nicht geklappt – versuch's nochmal."])

    await expectStable(
      async () => ({
        step: (await labState(page)).step,
        calls: api.resolveBodies.length,
        alerts: await toasts(page).count(),
      }),
      (sample) => sample.step === "scanning" && sample.calls === 1 && sample.alerts === 1,
      2_500,
    )
  })
})
