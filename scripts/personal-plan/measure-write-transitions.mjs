import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { chromium } from "playwright"

function readArgument(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

if (process.argv.includes("--help")) {
  process.stdout.write(`Usage:
  node scripts/personal-plan/measure-write-transitions.mjs \\
    --base-url=https://example.test \\
    --storage-state=/absolute/path/dedicated-test-owner.json \\
    --output=/absolute/path/results.json \\
    --confirm-dedicated-write-test-owner

The script opens a visible browser and records Stage 2/3 request durations, Server-Timing,
and non-identifying personal_plan_transition_performance console events. It never clicks or
submits anything automatically. Close the opened browser after manually exercising the test-owner
journey. The confirmation flag is mandatory because manual actions will write canonical test data.
`)
  process.exit(0)
}

const baseUrl = readArgument("base-url")
const storageState = readArgument("storage-state")
const output = readArgument("output")
const confirmed = process.argv.includes("--confirm-dedicated-write-test-owner")

if (!baseUrl || !storageState || !output) {
  throw new Error("base-url_storage-state_and_output_are_required")
}
if (!confirmed) throw new Error("dedicated_write_test_owner_confirmation_required")

const origin = new URL(baseUrl)
if (
  origin.protocol !== "https:" &&
  origin.hostname !== "127.0.0.1" &&
  origin.hostname !== "localhost"
) {
  throw new Error("https_or_localhost_required")
}

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ storageState: resolve(storageState) })
const page = await context.newPage()
const requests = new Map()
const transitions = []
const consoleTimings = []

context.on("request", (request) => {
  const pathname = new URL(request.url()).pathname
  if (!pathname.startsWith("/api/personal-plan/stage-2") && pathname !== "/api/personal-plan/stage-3") {
    return
  }
  requests.set(request, { startedAt: performance.now(), method: request.method(), pathname })
})

context.on("response", async (response) => {
  const tracked = requests.get(response.request())
  if (!tracked) return
  requests.delete(response.request())
  const headers = await response.allHeaders()
  transitions.push({
    ...tracked,
    status: response.status(),
    durationMs: Math.round((performance.now() - tracked.startedAt) * 100) / 100,
    serverTiming: headers["server-timing"] ?? null,
  })
})

page.on("console", async (message) => {
  if (message.type() !== "info" || !message.text().includes("personal_plan_transition_performance")) {
    return
  }
  const values = await Promise.all(message.args().map((argument) => argument.jsonValue()))
  consoleTimings.push(values)
})

let interrupted = false
process.once("SIGINT", () => {
  interrupted = true
  void browser.close()
})

await page.goto(new URL("/plan-start", origin).toString(), { waitUntil: "domcontentloaded" })
process.stdout.write(
  "Measurement browser opened. Exercise Stage 2 and individual Stage 3 decisions with the dedicated test owner, then close the browser.\n",
)
await new Promise((resolveDisconnected) => browser.once("disconnected", resolveDisconnected))

const report = {
  capturedAt: new Date().toISOString(),
  baseUrl: origin.origin,
  mode: "manual_dedicated_write_test_owner",
  interrupted,
  transitions,
  consoleTimings,
}
await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`, "utf8")
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
