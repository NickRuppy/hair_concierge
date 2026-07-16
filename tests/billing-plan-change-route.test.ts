import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import test from "node:test"

test("billing plan-change route behavior under React Server conditions", () => {
  const suite = fileURLToPath(
    new URL("./billing-plan-change-route.react-server.ts", import.meta.url),
  )
  const { NODE_TEST_CONTEXT: _nodeTestContext, ...env } = process.env
  const result = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "--test", suite],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
      timeout: 30_000,
    },
  )

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  assert.ifError(result.error)
  assert.equal(result.signal, null)
  assert.equal(result.status, 0)
  assert.match(result.stdout, /# tests 6/)
  assert.match(result.stdout, /# pass 6/)
})
