import "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import React from "react"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"

import { Scanner } from "../src/components/scan/scanner"
import { ScanFlow } from "../src/components/scan/scan-flow"
import type { ScanAnalyticsPort } from "../src/lib/scan/scan-analytics"

afterEach(cleanup)

test("effect replay tracks scan_started once and tracks again for a new analytics port", async () => {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true })
  const events: string[] = []
  const analytics: ScanAnalyticsPort = { track: (event) => events.push(event) }
  const router = {
    bfcacheId: "scan-effect-test",
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch() {},
  }
  const scannerRuntime = { mediaSource: () => new Promise<MediaStream>(() => {}) }
  const flow = (port: ScanAnalyticsPort) => (
    <React.StrictMode>
      <AppRouterContext.Provider value={router}>
        <ScanFlow analytics={port} scannerRuntime={scannerRuntime} />
      </AppRouterContext.Provider>
    </React.StrictMode>
  )
  const view = render(flow(analytics))
  await waitFor(() => assert.equal(events.filter((event) => event === "scan_started").length, 1))

  const nextEvents: string[] = []
  view.rerender(flow({ track: (event) => nextEvents.push(event) }))
  await waitFor(() => assert.deepEqual(nextEvents, ["scan_started"]))
  assert.equal(events.filter((event) => event === "scan_started").length, 1)
})

test("effect replay preserves a camera denial until an explicit retry", async () => {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true })
  let acquisitions = 0
  const reasons: string[] = []
  const runtime = {
    mediaSource: async (): Promise<MediaStream> => {
      acquisitions += 1
      throw new DOMException("Camera denied", "NotAllowedError")
    },
  }
  const scanner = (key: number) => (
    <React.StrictMode>
      <Scanner
        key={key}
        active
        runtime={runtime}
        onDecoded={() => false}
        onUnavailable={(reason) => reasons.push(reason)}
        onTimeout={() => {}}
        onStalled={() => {}}
      />
    </React.StrictMode>
  )
  const view = render(scanner(0))
  await waitFor(() => assert.deepEqual(reasons, ["denied"]))
  assert.equal(acquisitions, 1)

  view.rerender(scanner(1))
  await waitFor(() => assert.deepEqual(reasons, ["denied", "denied"]))
  assert.equal(acquisitions, 2)
})
