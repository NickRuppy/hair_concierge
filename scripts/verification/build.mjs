#!/usr/bin/env node

import { spawnSync } from "node:child_process"

// Hosted Node deployments retain their original build toolchain. The Python
// supervisor is a local resource control, not a new deployment prerequisite.
const hosted = process.env.VERCEL === "1"
const args = ["build", ...process.argv.slice(2)]
const result = spawnSync(
  hosted ? "next" : "python3",
  hosted ? args : ["scripts/verification/run.py", "--", "next", ...args],
  { stdio: "inherit", env: process.env },
)

if (result.error) {
  console.error(result.error.message)
}
process.exit(result.status ?? 1)
