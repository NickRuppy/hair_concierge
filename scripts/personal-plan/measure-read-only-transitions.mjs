import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { chromium } from "playwright"

function readArgument(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

if (process.argv.includes("--help")) {
  process.stdout.write(`Usage:
  node scripts/personal-plan/measure-read-only-transitions.mjs \\
    --base-url=https://example.test \\
    --storage-state=/absolute/path/auth.json \\
    [--samples=5] [--output=/absolute/path/results.json]

Safety: the sampler aborts every non-GET/HEAD/OPTIONS request. Routine sync is therefore
excluded deliberately; use Vercel timing logs for that POST after separately authorized testing.
`)
  process.exit(0)
}

const baseUrl = readArgument("base-url")
const storageState = readArgument("storage-state")
const output = readArgument("output")
const samples = Number(readArgument("samples") ?? "5")

if (!baseUrl || !storageState) throw new Error("base-url_and_storage-state_are_required")
if (!Number.isInteger(samples) || samples <= 0 || samples > 20) throw new Error("invalid_samples")

const origin = new URL(baseUrl)
if (
  origin.protocol !== "https:" &&
  origin.hostname !== "127.0.0.1" &&
  origin.hostname !== "localhost"
) {
  throw new Error("https_or_localhost_required")
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ storageState: resolve(storageState) })
const blockedWrites = []

await context.route("**/*", async (route) => {
  const method = route.request().method()
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return route.continue()
  blockedWrites.push({ method, url: route.request().url() })
  return route.abort("blockedbyclient")
})

const results = []
for (const pathname of ["/routine", "/anwendung"]) {
  for (let sample = 1; sample <= samples; sample += 1) {
    const page = await context.newPage()
    const startedAt = performance.now()
    const response = await page.goto(new URL(pathname, origin).toString(), {
      waitUntil: "domcontentloaded",
    })
    await page.evaluate(() => document.fonts.ready)
    const elapsedMs = performance.now() - startedAt
    const finalUrl = page.url()
    if (new URL(finalUrl).pathname !== pathname) {
      throw new Error(`unexpected_redirect:${pathname}:${finalUrl}`)
    }
    const browserTiming = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0]
      const resources = performance
        .getEntriesByType("resource")
        .filter((entry) => /personal-plan|routine|anwendung|_rsc/.test(entry.name))
        .map((entry) => {
          const resource = entry
          return {
            name: resource.name,
            durationMs: resource.duration,
            responseStartMs: resource.responseStart,
            serverTiming:
              "serverTiming" in resource
                ? resource.serverTiming.map((timing) => ({
                    name: timing.name,
                    durationMs: timing.duration,
                  }))
                : [],
          }
        })
      return navigation
        ? {
            responseStartMs: navigation.responseStart,
            responseEndMs: navigation.responseEnd,
            domContentLoadedMs: navigation.domContentLoadedEventEnd,
            resources,
          }
        : { resources }
    })
    results.push({ pathname, sample, status: response?.status() ?? null, elapsedMs, browserTiming })
    await page.close()
  }
}

await browser.close()

const report = {
  capturedAt: new Date().toISOString(),
  baseUrl: origin.origin,
  mode: "read_only_writes_blocked",
  results,
  blockedWrites: blockedWrites.map(({ method, url }) => ({
    method,
    pathname: new URL(url).pathname,
  })),
}

const serialized = `${JSON.stringify(report, null, 2)}\n`
if (output) await writeFile(resolve(output), serialized, "utf8")
process.stdout.write(serialized)
