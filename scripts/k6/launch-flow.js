import http from "k6/http"
import { check, group, sleep } from "k6"

const baseUrl = (__ENV.K6_BASE_URL || "https://chaarlie.de").replace(/\/$/, "")
const profile = __ENV.K6_PROFILE || "smoke"
const writeMode = __ENV.K6_WRITE_MODE === "1"
const chatMode = __ENV.K6_CHAT_MODE === "1"
const sessionCookie = __ENV.K6_SESSION_COOKIE || ""
const thinkTimeMinSeconds = Number(__ENV.K6_THINK_TIME_MIN || 2)
const thinkTimeMaxSeconds = Number(__ENV.K6_THINK_TIME_MAX || 6)
const runId = __ENV.K6_RUN_ID || `local-${Date.now()}`

const launchTestHeaders = {
  "x-chaarlie-load-test": "launch-readiness",
  "x-chaarlie-load-run": runId,
}

const mobileHeaders = {
  headers: {
    ...launchTestHeaders,
    "user-agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
}

const jsonHeaders = {
  headers: {
    ...launchTestHeaders,
    "content-type": "application/json",
    accept: "application/json",
    ...(sessionCookie ? { cookie: sessionCookie } : {}),
  },
}

const authPageHeaders = sessionCookie
  ? { headers: { ...mobileHeaders.headers, cookie: sessionCookie } }
  : mobileHeaders

const profiles = {
  smoke: {
    executor: "constant-vus",
    vus: 1,
    duration: "1m",
  },
  average: {
    executor: "ramping-vus",
    stages: [
      { duration: "1m", target: 5 },
      { duration: "5m", target: 15 },
      { duration: "1m", target: 0 },
    ],
  },
  spike: {
    executor: "ramping-vus",
    stages: [
      { duration: "30s", target: 5 },
      { duration: "30s", target: 50 },
      { duration: "2m", target: 50 },
      { duration: "30s", target: 0 },
    ],
  },
  safety: {
    executor: "ramping-vus",
    stages: [
      { duration: "1m", target: 25 },
      { duration: "3m", target: 75 },
      { duration: "2m", target: 100 },
      { duration: "1m", target: 0 },
    ],
  },
  soak: {
    executor: "constant-vus",
    vus: Number(__ENV.K6_SOAK_VUS || 15),
    duration: __ENV.K6_SOAK_DURATION || "30m",
  },
}

export const options = {
  scenarios: {
    launch_flow: profiles[profile] || profiles.smoke,
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<3000"],
    checks: ["rate>0.95"],
  },
}

function url(path) {
  return `${baseUrl}${path}`
}

function isOk(response) {
  return response.status >= 200 && response.status < 400
}

function isHtml(response) {
  return String(response.headers["Content-Type"] || "").includes("text/html")
}

function isNotEdgeMitigated(response) {
  return response.headers["X-Vercel-Mitigated"] !== "deny"
}

function think() {
  const min = Math.max(0, thinkTimeMinSeconds)
  const max = Math.max(min, thinkTimeMaxSeconds)
  sleep(min + Math.random() * (max - min))
}

function uniqueEmail() {
  return `k6-${Date.now()}-${__VU}-${__ITER}@chaarlie-load.test`
}

function quizAnswers() {
  return {
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    cuticle_condition: "slightly_rough",
    protein_moisture_balance: "stretches_bounces",
    chemical_treatment: ["none"],
    scalp_type: "normal",
    scalp_condition: null,
    concerns: ["dryness"],
    goals: ["shine"],
  }
}

export default function () {
  group("public mobile pages", () => {
    const landing = http.get(url("/"), mobileHeaders)
    check(landing, {
      "landing responds": isOk,
      "landing has html": isHtml,
      "landing not edge-mitigated": isNotEdgeMitigated,
    })

    think()

    const quiz = http.get(url("/quiz"), mobileHeaders)
    check(quiz, {
      "quiz responds": isOk,
      "quiz has html": isHtml,
      "quiz not edge-mitigated": isNotEdgeMitigated,
    })

    think()

    const auth = http.get(url("/auth"), mobileHeaders)
    check(auth, {
      "auth responds": isOk,
      "auth has html": isHtml,
      "auth not edge-mitigated": isNotEdgeMitigated,
    })

    think()

    const pricing = http.get(url("/pricing"), mobileHeaders)
    check(pricing, {
      "pricing responds": isOk,
      "pricing not edge-mitigated": isNotEdgeMitigated,
    })
  })

  if (writeMode) {
    group("quiz lead write path", () => {
      const body = {
        name: "K6",
        email: uniqueEmail(),
        marketingConsent: false,
        quizAnswers: quizAnswers(),
      }
      const lead = http.post(url("/api/quiz/lead"), JSON.stringify(body), jsonHeaders)
      check(lead, {
        "lead write accepted": (res) => res.status === 200,
        "lead id returned": (res) => Boolean(res.json("leadId")),
        "lead not edge-mitigated": isNotEdgeMitigated,
      })

    })
  }

  if (sessionCookie) {
    group("authenticated app pages", () => {
      const chat = http.get(url("/chat"), authPageHeaders)
      check(chat, {
        "chat page responds with session": isOk,
        "chat page not edge-mitigated": isNotEdgeMitigated,
      })

      if (chatMode) {
        const reply = http.post(
          url("/api/chat"),
          JSON.stringify({ message: "Was ist heute eine einfache Haarpflege-Routine?" }),
          jsonHeaders,
        )
        check(reply, {
          "chat api starts stream": (res) => res.status === 200,
          "chat api is event stream": (res) =>
            String(res.headers["Content-Type"] || "").includes("text/event-stream"),
          "chat api not edge-mitigated": isNotEdgeMitigated,
        })
      }
    })
  }

  think()
}
