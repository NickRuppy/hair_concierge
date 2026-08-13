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
    [--samples=30] [--output=/absolute/path/results.json] \\
    [--deployment-sha=<sha>] [--environment=preview] \\
    [--protection-bypass=<vercel-preview-secret>] \\
    [--executable-path=/absolute/path/to/chromium] \\
    [--max-internal-p95-ms=1500] [--max-meaningful-p95-ms=2000]

Safety: the sampler aborts every non-GET/HEAD/OPTIONS request. It reports expected Routine sync
and external telemetry separately, and fails on any other same-origin application write attempt.

The Anwendung deployment must set
PERSONAL_PLAN_APPLICATION_PERFORMANCE_MARKER_ENABLED=true. The marker contains only server-compute
duration and is omitted by default.

Create a disposable storage state by completing the shareable Personal Plan field-test
link through its free continuation CTA in a fresh browser context. Never use a customer session.
`)
  process.exit(0)
}

const baseUrl = readArgument("base-url")
const storageState = readArgument("storage-state")
const output = readArgument("output")
const samples = Number(readArgument("samples") ?? "30")
const deploymentSha = readArgument("deployment-sha") ?? null
const environment = readArgument("environment") ?? "unspecified"
const protectionBypass = readArgument("protection-bypass") ?? null
const executablePath = readArgument("executable-path") ?? null
const maxInternalP95Ms = Number(readArgument("max-internal-p95-ms") ?? "1500")
const maxMeaningfulP95Ms = Number(readArgument("max-meaningful-p95-ms") ?? "2000")

if (!baseUrl || !storageState) throw new Error("base-url_and_storage-state_are_required")
if (!Number.isInteger(samples) || samples <= 0 || samples > 30) throw new Error("invalid_samples")
if (!Number.isFinite(maxInternalP95Ms) || maxInternalP95Ms <= 0)
  throw new Error("invalid_max_internal_p95_ms")
if (!Number.isFinite(maxMeaningfulP95Ms) || maxMeaningfulP95Ms <= 0)
  throw new Error("invalid_max_meaningful_p95_ms")

const origin = new URL(baseUrl)
if (
  origin.protocol !== "https:" &&
  origin.hostname !== "127.0.0.1" &&
  origin.hostname !== "localhost"
) {
  throw new Error("https_or_localhost_required")
}

function round(value) {
  return Math.round(value * 100) / 100
}

function percentile(values, rank) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  return round(sorted[Math.max(0, Math.ceil(rank * sorted.length) - 1)])
}

const expectedTelemetryOrigins = new Set([
  "https://eu.i.posthog.com",
  "https://cdp-eu.customer.io",
])

function classifyBlockedWrite(method, url) {
  const target = new URL(url)
  if (expectedTelemetryOrigins.has(target.origin)) return "external_telemetry"
  if (
    target.origin === origin.origin &&
    method === "POST" &&
    target.pathname === "/api/personal-plan/routine/sync"
  ) {
    return "expected_routine_sync"
  }
  return "unexpected_application_write"
}

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath: resolve(executablePath) } : {}),
})
const blockedWrites = []
const results = []

for (const pathname of ["/routine", "/anwendung"]) {
  for (let sample = 1; sample <= samples; sample += 1) {
    const context = await browser.newContext({ storageState: resolve(storageState) })
    await context.route("**/*", async (route) => {
      const request = route.request()
      const method = request.method()
      if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        const requestOrigin = new URL(request.url()).origin
        return route.continue(
          protectionBypass && requestOrigin === origin.origin
            ? {
                headers: {
                  ...request.headers(),
                  "x-vercel-protection-bypass": protectionBypass,
                },
              }
            : undefined,
        )
      }
      blockedWrites.push({
        method,
        url: request.url(),
        classification: classifyBlockedWrite(method, request.url()),
      })
      return route.abort("blockedbyclient")
    })
    const page = await context.newPage()
    try {
      const startedAt = performance.now()
      const response = await page.goto(new URL(pathname, origin).toString(), {
        waitUntil: "domcontentloaded",
      })
      await page.locator("h1").first().waitFor({ state: "visible" })
      const meaningfulContentMs = performance.now() - startedAt
      await page.evaluate(() => document.fonts.ready)
      const elapsedMs = performance.now() - startedAt
      const finalUrl = page.url()
      if (new URL(finalUrl).pathname !== pathname) {
        throw new Error(`unexpected_redirect:${pathname}:${finalUrl}`)
      }

      const applicationComputeAttribute =
        pathname === "/anwendung"
          ? await page
              .locator('[data-personal-plan-application-root="true"]')
              .first()
              .getAttribute("data-personal-plan-application-compute-ms")
          : null
      const internalComputeMs =
        applicationComputeAttribute === null ? null : Number(applicationComputeAttribute)
      if (
        pathname === "/anwendung" &&
        (!Number.isFinite(internalComputeMs) || internalComputeMs < 0)
      ) {
        throw new Error("missing_application_internal_compute_marker")
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

      results.push({
        pathname,
        sample,
        status: response?.status() ?? null,
        elapsedMs: round(elapsedMs),
        meaningfulContentMs: round(meaningfulContentMs),
        internalComputeMs,
        browserTiming,
      })
    } finally {
      await context.close()
    }
  }
}

await browser.close()

const summary = Object.fromEntries(
  ["/routine", "/anwendung"].map((pathname) => {
    const matching = results.filter((result) => result.pathname === pathname)
    const internalSamples = matching
      .map((result) => result.internalComputeMs)
      .filter((value) => typeof value === "number")
    return [
      pathname,
      {
        samples: matching.length,
        meaningfulContent: {
          p50Ms: percentile(
            matching.map((result) => result.meaningfulContentMs),
            0.5,
          ),
          p95Ms: percentile(
            matching.map((result) => result.meaningfulContentMs),
            0.95,
          ),
        },
        internalCompute:
          internalSamples.length > 0
            ? {
                p50Ms: percentile(internalSamples, 0.5),
                p95Ms: percentile(internalSamples, 0.95),
              }
            : null,
      },
    ]
  }),
)

const applicationInternalP95Ms = summary["/anwendung"].internalCompute?.p95Ms ?? null
const applicationMeaningfulP95Ms = summary["/anwendung"].meaningfulContent.p95Ms
const unexpectedWrites = blockedWrites.filter(
  ({ classification }) => classification === "unexpected_application_write",
)
const violations = []
if (summary["/anwendung"].samples !== samples) violations.push("application_sample_count")
if (unexpectedWrites.length > 0) violations.push("unexpected_application_write_attempted")
if (applicationInternalP95Ms === null || applicationInternalP95Ms > maxInternalP95Ms)
  violations.push("application_internal_compute_p95")
if (applicationMeaningfulP95Ms === null || applicationMeaningfulP95Ms > maxMeaningfulP95Ms)
  violations.push("application_meaningful_content_p95")

const report = {
  capturedAt: new Date().toISOString(),
  baseUrl: origin.origin,
  deploymentSha,
  environment,
  mode: "read_only_writes_blocked",
  thresholds: { maxInternalP95Ms, maxMeaningfulP95Ms },
  summary,
  ok: violations.length === 0,
  violations,
  results,
  blockedWrites: blockedWrites.map(({ method, url, classification }) => ({
    method,
    pathname: new URL(url).pathname,
    classification,
  })),
}

const serialized = `${JSON.stringify(report, null, 2)}\n`
if (output) await writeFile(resolve(output), serialized, "utf8")
process.stdout.write(serialized)
if (violations.length > 0) throw new Error(`performance_slo_failed:${violations.join(",")}`)
