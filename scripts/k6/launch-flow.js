import http from "k6/http"
import { check } from "k6"
import { Rate } from "k6/metrics"

const ISOLATED_TARGET_ACK = "read-only-nonproduction-confirmed"
const PRODUCTION_HOSTS = new Set(["chaarlie.de", "www.chaarlie.de"])
const rawBaseUrl = __ENV.K6_BASE_URL
const profile = __ENV.K6_PROFILE || "smoke"

if (!rawBaseUrl) throw new Error("K6_BASE_URL is required")
if (__ENV.K6_ISOLATED_TARGET_ACK !== ISOLATED_TARGET_ACK) {
  throw new Error(`K6_ISOLATED_TARGET_ACK must equal ${ISOLATED_TARGET_ACK}`)
}

const baseUrlMatch = rawBaseUrl.match(/^https:\/\/([^/:?#]+)(?::\d+)?(?:[/?#]|$)/i)
if (!baseUrlMatch) throw new Error("K6_BASE_URL must be an absolute HTTPS URL")
const targetHostname = baseUrlMatch[1].toLowerCase()
if (targetHostname.includes("@") || targetHostname.endsWith(".")) {
  throw new Error("K6_BASE_URL must use a canonical hostname without userinfo or a trailing dot")
}
if (PRODUCTION_HOSTS.has(targetHostname) || targetHostname.endsWith(".chaarlie.de")) {
  throw new Error("The non-production load harness refuses production aliases")
}

const baseUrl = rawBaseUrl.replace(/\/$/, "")
const criticalFailure = new Rate("critical_failure")
const historicalLandingRate = 152

const profileDefinitions = {
  smoke: { multiplier: 1, timeUnit: "1m", duration: "1m", smoke: true },
  average: {
    multiplier: 1,
    timeUnit: "1h",
    duration: __ENV.K6_AVERAGE_DURATION || "15m",
  },
  spike: { multiplier: 2, timeUnit: "1h", duration: __ENV.K6_SPIKE_DURATION || "5m" },
  safety: { multiplier: 5, timeUnit: "1h", duration: __ENV.K6_SAFETY_DURATION || "5m" },
  soak: { multiplier: 2, timeUnit: "1h", duration: __ENV.K6_SOAK_DURATION || "30m" },
}

const selectedProfile = profileDefinitions[profile]
if (!selectedProfile) throw new Error(`Unsupported K6_PROFILE: ${profile}`)

const rate = selectedProfile.smoke
  ? 1
  : Math.ceil(historicalLandingRate * selectedProfile.multiplier)

export const options = {
  scenarios: {
    landing_read: {
      executor: "constant-arrival-rate",
      exec: "landingRead",
      rate,
      timeUnit: selectedProfile.timeUnit,
      duration: selectedProfile.duration,
      preAllocatedVUs: Math.max(2, Math.ceil(rate / 30)),
      maxVUs: Math.max(10, Math.ceil(rate / 5)),
    },
  },
  thresholds: {
    checks: [{ threshold: "rate==1", abortOnFail: true, delayAbortEval: "1m" }],
    critical_failure: [{ threshold: "rate==0", abortOnFail: true, delayAbortEval: "1m" }],
    http_req_failed: [{ threshold: "rate==0", abortOnFail: true, delayAbortEval: "1m" }],
    "http_req_duration{endpoint:landing_read}": ["p(95)<3000", "p(99)<5000"],
  },
}

const mobileUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"

export function landingRead() {
  const response = http.get(`${baseUrl}/lp/haarplan`, {
    headers: {
      "user-agent": mobileUserAgent,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    tags: { endpoint: "landing_read", profile },
  })
  const passed = check(response, {
    "landing status is 200": (result) => result.status === 200,
    "landing is not edge-mitigated": (result) => result.headers["X-Vercel-Mitigated"] !== "deny",
  })
  criticalFailure.add(!passed)
}
