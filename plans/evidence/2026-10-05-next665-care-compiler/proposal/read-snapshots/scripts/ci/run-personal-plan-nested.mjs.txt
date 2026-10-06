#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { join, relative } from "node:path"

const repositoryRoot = process.cwd()
const testRoot = join(repositoryRoot, "tests/personal-plan")

function testFilesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) return testFilesIn(absolutePath)
    if (!entry.isFile() || !/\.test\.tsx?$/.test(entry.name)) return []
    return [relative(repositoryRoot, absolutePath)]
  })
}

const testFiles = testFilesIn(testRoot).sort()

if (testFiles.length === 0) {
  console.error("No nested Personal Plan Node tests found.")
  process.exit(1)
}

console.log(`Running ${testFiles.length} nested Personal Plan test files.`)

const result = spawnSync(
  process.execPath,
  ["--import", "./tests/server-only-register.cjs", "--import", "tsx", "--test", ...testFiles],
  { cwd: repositoryRoot, env: process.env, stdio: "inherit" },
)

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
