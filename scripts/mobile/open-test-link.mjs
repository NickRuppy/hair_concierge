import { spawnSync } from "node:child_process"
import { loadLocalEnvironment } from "./local-stack.mjs"

// Only local captured synthetic mail; no URL, code, token or mail body is emitted.
loadLocalEnvironment()
const device = process.argv[2]
const kind = process.argv[3] || "detailed"
const cold = process.argv[4] !== "warm"
if (!/^[0-9A-F-]{36}$/i.test(device || "") || !["free", "detailed"].includes(kind))
  throw new Error("Pass the verified simulator UUID and free|detailed fixture")
const email = `scanner-${kind}@example.test`
const previousMail = await fetch("http://127.0.0.1:55324/api/v1/messages").then((r) => r.json())
const previousIds = new Set((previousMail.messages || []).map((item) => item.ID))
const started = await fetch("http://127.0.0.1:3224/api/mobile/v1/auth/start", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
})
if (started.status !== 200) throw new Error("Local auth start failed")
const { attemptId } = await started.json()
let url
for (let count = 0; count < 30 && !url; count++) {
  const index = await fetch("http://127.0.0.1:55324/api/v1/messages").then((r) => r.json())
  for (const item of index.messages || []) {
    if (previousIds.has(item.ID) || !item.To?.some((to) => to.Address === email)) continue
    const message = await fetch(`http://127.0.0.1:55324/api/v1/message/${item.ID}`).then((r) =>
      r.json(),
    )
    const candidate = /href="([^"]+)"/.exec(message.HTML || "")?.[1]?.replaceAll("&amp;", "&")
    if (!candidate) continue
    if (!URL.canParse(candidate)) continue
    const parsed = new URL(candidate)
    const fields = new URLSearchParams(parsed.hash.slice(1))
    const callback = fields.get("callback")
    if (
      parsed.protocol !== "chaarlie-local:" ||
      parsed.host !== "auth" ||
      !callback ||
      !fields.get("tokenHash")
    )
      continue
    if (!URL.canParse(callback)) continue
    const nested = new URL(callback)
    if (
      nested.protocol === "chaarlie-local:" &&
      nested.host === "auth" &&
      new URLSearchParams(nested.hash.slice(1)).get("attemptId") === attemptId
    ) {
      url = candidate
      break
    }
  }
  if (!url) await new Promise((resolve) => setTimeout(resolve, 200))
}
if (!url) throw new Error("Expected local test link not captured")
const options = { stdio: "ignore" }
if (cold)
  spawnSync("/usr/bin/xcrun", ["simctl", "terminate", device, "de.chaarlie.scanner.local"], options)
const opened = spawnSync("/usr/bin/xcrun", ["simctl", "openurl", device, url], options)
if (opened.status !== 0) throw new Error("Simulator did not accept the local callback")
console.log(
  `Dispatched ${cold ? "cold" : "warm"} synthetic ${kind} login link; verify native state in Simulator. Credentials suppressed.`,
)
