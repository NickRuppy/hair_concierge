import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

const execFileAsync = promisify(execFile)

export const KEYCHAIN_SERVICE_NAME = "com.chaarlie.payment-monitor.trigger-secret"
export const REQUEST_TIMEOUT_MS = 50_000
export const PRODUCTION_MONITOR_ENDPOINT = "https://chaarlie.de/api/billing/payment-monitor"

const MONITOR_PROVIDERS = new Set(["stripe", "paypal", "unknown"])
const MONITOR_FAILURE_REASONS = new Set([
  "provider_error",
  "local_lookup_error",
  "incomplete_pagination",
  "candidate_cap",
  "deadline_exhausted",
  "missing_identity",
  "invalid_candidate",
])
const MONITOR_ERROR_FAMILIES = new Set(["provider_unavailable", "timeout", "unknown"])

class MonitorTriggerError extends Error {
  constructor(category, status, failures = []) {
    super(category)
    this.category = category
    this.status = status
    this.failures = failures
  }
}

function validStatus(status) {
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined
}

function logResult(logger, category, status, failures = []) {
  const statusPart = validStatus(status) ? ` status=${status}` : ""
  const failurePart = failures.length
    ? ` failures=${failures
        .map((failure) => `${failure.provider}:${failure.reason}:${failure.errorFamily}`)
        .join(",")}`
    : ""
  logger(`${new Date().toISOString()} ${category}${statusPart}${failurePart}`)
}

export function parseEndpoint(argv) {
  if (argv.length !== 2 || argv[0] !== "--endpoint") return undefined

  try {
    const endpoint = new URL(argv[1])
    if (
      endpoint.toString() !== PRODUCTION_MONITOR_ENDPOINT ||
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      return undefined
    return endpoint.toString()
  } catch {
    return undefined
  }
}

async function readKeychainSecret(serviceName) {
  const { stdout } = await execFileAsync("/usr/bin/security", [
    "find-generic-password",
    "-s",
    serviceName,
    "-w",
  ])
  const secret = stdout.trim()
  if (!secret) throw new Error("Keychain secret is empty")
  return secret
}

export async function runPaymentMonitor({
  endpoint,
  getKeychainSecret = readKeychainSecret,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  let parsedEndpoint
  try {
    parsedEndpoint = new URL(endpoint)
  } catch {
    throw new MonitorTriggerError("configuration_failure")
  }
  if (
    parsedEndpoint.toString() !== PRODUCTION_MONITOR_ENDPOINT ||
    parsedEndpoint.protocol !== "https:" ||
    parsedEndpoint.username ||
    parsedEndpoint.password ||
    parsedEndpoint.search ||
    parsedEndpoint.hash
  ) {
    throw new MonitorTriggerError("configuration_failure")
  }

  let secret
  try {
    secret = await getKeychainSecret(KEYCHAIN_SERVICE_NAME)
    if (typeof secret !== "string" || !secret.trim()) throw new Error("Keychain secret is empty")
  } catch {
    throw new MonitorTriggerError("keychain_failure")
  }

  let response
  try {
    response = await fetchImpl(parsedEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new MonitorTriggerError("network_failure")
  }

  if (!response.ok) {
    const failures = await readMonitorFailures(response)
    throw new MonitorTriggerError("http_failure", validStatus(response.status), failures)
  }
  return { status: validStatus(response.status) ?? 200 }
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const logger = dependencies.logger ?? console.info
  const endpoint = parseEndpoint(argv)
  if (!endpoint) {
    logResult(logger, "configuration_failure")
    return 1
  }

  try {
    const { status } = await runPaymentMonitor({ endpoint, ...dependencies })
    logResult(logger, "success", status)
    return 0
  } catch (error) {
    const category = error instanceof MonitorTriggerError ? error.category : "network_failure"
    const status = error instanceof MonitorTriggerError ? error.status : undefined
    const failures = error instanceof MonitorTriggerError ? error.failures : []
    logResult(logger, category, status, failures)
    return 1
  }
}

async function readMonitorFailures(response) {
  try {
    const body = await response.json()
    const failures = body?.paymentIntegrity?.failures
    if (!Array.isArray(failures)) return []

    return failures.slice(0, 20).flatMap((failure) => {
      if (!failure || typeof failure !== "object") return []
      const { provider, reason, errorFamily } = failure
      if (
        !MONITOR_PROVIDERS.has(provider) ||
        !MONITOR_FAILURE_REASONS.has(reason) ||
        !MONITOR_ERROR_FAMILIES.has(errorFamily)
      )
        return []
      return [{ provider, reason, errorFamily }]
    })
  } catch {
    return []
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((exitCode) => {
    process.exitCode = exitCode
  })
}
