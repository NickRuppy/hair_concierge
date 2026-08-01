import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const trackerRouteFiles = [
  "src/app/api/tracker/route.ts",
  "src/app/api/tracker/dismiss-nudge/route.ts",
  "src/app/api/tracker/log/route.ts",
]

test("every production tracker route wires the canonical one-time access resolver", () => {
  for (const file of trackerRouteFiles) {
    const source = readFileSync(file, "utf8")
    assert.match(
      source,
      /import \{ resolveOneTimeAccessStateForUser \} from "@\/lib\/billing\/purchases"/,
    )
    assert.match(source, /resolveOneTimeAccessState: \(client, \{ userId \}\) =>/)
    assert.match(source, /resolveOneTimeAccessStateForUser\([\s\S]*client[\s\S]*userId/)
  }
})
