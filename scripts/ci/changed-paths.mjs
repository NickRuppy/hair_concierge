#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"

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

const chatPrefixes = [
  "src/lib/agent/",
  "src/lib/langfuse/",
  "src/lib/openai/",
  "src/lib/recommendation-engine/",
  "src/lib/rag/",
  "src/lib/routines/",
  "src/app/api/chat/",
  "scripts/eval-chat/",
]

const chatExact = ["docs/langfuse-quality-loop.md"]

const retrievalPrefixes = [
  "src/lib/rag/retrieval/",
  "src/lib/rag/retriever.ts",
  "src/lib/rag/product-list-chunks.ts",
  "src/lib/rag/retrieval-telemetry.ts",
  "scripts/ingest-",
  "scripts/eval-retrieval.ts",
  "supabase/migrations/",
]

const retrievalExact = ["tests/fixtures/retrieval-gold-set.json"]

const securityPrefixes = [".github/workflows/", "supabase/migrations/"]
const securityExact = ["package.json", "package-lock.json", ".github/dependabot.yml"]

function matches(file, prefixes, exact) {
  return exact.includes(file) || prefixes.some((prefix) => file.startsWith(prefix))
}

const outputs = {
  chat_eval: files.some((file) => matches(file, chatPrefixes, chatExact)),
  retrieval_eval: files.some((file) => matches(file, retrievalPrefixes, retrievalExact)),
  security_scan: files.some((file) => matches(file, securityPrefixes, securityExact)),
}

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
