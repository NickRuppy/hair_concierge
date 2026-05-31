#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { classifyCiScope } from "./path-rules.mjs"

const ciBaseRef = process.env.CI_BASE_REF?.trim()
const githubBaseRef = process.env.GITHUB_BASE_REF?.trim()

const baseRef = ciBaseRef || (githubBaseRef ? `origin/${githubBaseRef}` : "origin/main")
const headRef = process.env.CI_HEAD_REF?.trim() || "HEAD"
const diffBase = baseRef

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim()
}

function changedFiles() {
  try {
    return git(["diff", "--name-only", `${diffBase}...${headRef}`])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return git(["diff", "--name-only", "HEAD~1...HEAD"])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  }
}

const files = changedFiles()
const outputs = classifyCiScope(files, {
  prTitle: process.env.PR_TITLE ?? "",
  prBody: process.env.PR_BODY ?? "",
})

for (const [key, value] of Object.entries(outputs)) {
  const line = `${key}=${value ? "true" : "false"}`
  console.log(line)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`)
}

if (files.length > 0) {
  console.log("")
  console.log("Changed files:")
  for (const file of files) console.log(`- ${file}`)
}
