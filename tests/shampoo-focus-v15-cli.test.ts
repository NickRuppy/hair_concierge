import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

const script = "scripts/shampoo-research/validate-focus-v15.ts"
const pilotRoot = join(process.cwd(), "plans/scan-db-expansion/research/shampoo-v14/pilot")

function run(...args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

test("CLI validates one product directory and a pilot-manifest dataset without mutation", () => {
  const single = run("--product-dir", join(pilotRoot, "elvital-hydra-hyaluronic"), "--json")
  assert.equal(single.status, 0, single.stderr)
  assert.equal(JSON.parse(single.stdout).ok, true)

  const dataset = run("--root", pilotRoot)
  assert.equal(dataset.status, 0, dataset.stderr)
  assert.match(dataset.stdout, /^PASS focus-v15 dataset:/)
})

test("CLI returns deterministic FAIL JSON for a malformed overlay", () => {
  const directory = mkdtempSync(join(tmpdir(), "shampoo-focus-v15-cli-"))
  try {
    cpSync(pilotRoot, directory, { recursive: true })
    const overlayPath = join(directory, "isana-sensitiv", "focus-v15.json")
    const overlay = JSON.parse(readFileSync(overlayPath, "utf8"))
    overlay.claimRole = "claims_only"
    writeFileSync(overlayPath, JSON.stringify(overlay), "utf8")
    const result = run("--root", directory, "--json")
    assert.equal(result.status, 1)
    const parsed = JSON.parse(result.stdout)
    assert.equal(parsed.ok, false)
    assert.deepEqual(Object.keys(parsed).sort(), ["errors", "ok", "scope"])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
