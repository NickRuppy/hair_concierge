import http from "k6/http"
import { check } from "k6"

const PRODUCTION_SMOKE_ACK = "human-volume-read-only"
const rawBaseUrl = __ENV.K6_BASE_URL

if (!rawBaseUrl) throw new Error("K6_BASE_URL is required")
if (__ENV.K6_PRODUCTION_SMOKE_ACK !== PRODUCTION_SMOKE_ACK) {
  throw new Error(`K6_PRODUCTION_SMOKE_ACK must equal ${PRODUCTION_SMOKE_ACK}`)
}

const baseUrl = rawBaseUrl.replace(/\/$/, "")
const routes = [
  { path: "/lp/haarplan", expectedStatuses: [200] },
  { path: "/quiz", expectedStatuses: [200] },
  { path: "/pricing", expectedStatuses: [200] },
  { path: "/auth", expectedStatuses: [200, 302, 307, 308] },
]

export const options = {
  scenarios: {
    human_volume_read_only: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
  },
}

export default function () {
  for (const { path, expectedStatuses } of routes) {
    const response = http.get(`${baseUrl}${path}`, {
      headers: { "user-agent": "ChaarlieLaunchProductionSmoke/1.0" },
      tags: { endpoint: path },
    })
    check(response, {
      [`${path} returns an expected status`]: (result) => expectedStatuses.includes(result.status),
      [`${path} is not edge-mitigated`]: (result) =>
        result.headers["X-Vercel-Mitigated"] !== "deny",
    })
  }
}
