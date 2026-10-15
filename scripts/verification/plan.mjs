#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { recommendLocalChecks } from "./local-checks.mjs"

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

function nulPaths(buffer, status = false) {
  const fields = buffer.toString("utf8").split("\0").filter(Boolean)
  return status ? fields.filter((_, index) => index % 2 === 1) : fields
}

function quote(argv) {
  return argv
    .map((part) =>
      /^[A-Za-z0-9_@%+=:,./-]+$/.test(part) ? part : "'" + part.replaceAll("'", "'\\''") + "'",
    )
    .join(" ")
}

function parse(argv) {
  let base = "origin/main"
  let baseSet = false
  let json = false
  let files = null
  let collectingFiles = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--json") json = true
    else if (arg === "--base") {
      base = argv[++index]
      baseSet = true
      if (!base) throw new Error("--base requires a commit reference")
    } else if (arg === "--files") {
      if (collectingFiles) throw new Error("--files may be supplied once")
      collectingFiles = true
      files = []
    } else if (collectingFiles) files.push(arg)
    else throw new Error("Usage: plan.mjs [--base REF] [--json] | --files <paths...> [--json]")
  }
  if (files) {
    if (baseSet || !files.length)
      throw new Error("--files needs paths and cannot be combined with --base")
    return { json, files, scope: { mode: "explicit", files } }
  }
  return { json, files: null, scope: { mode: "git", base } }
}

function changedFromGit(root, base) {
  const commit = git(root, ["rev-parse", "--verify", "--end-of-options", base + "^{commit}"])
    .toString("utf8")
    .trim()
  const lists = [
    nulPaths(git(root, ["diff", "--name-status", "-z", "--no-renames", commit + "...HEAD"]), true),
    nulPaths(git(root, ["diff", "--cached", "--name-status", "-z", "--no-renames"]), true),
    nulPaths(git(root, ["diff", "--name-status", "-z", "--no-renames"]), true),
    nulPaths(git(root, ["ls-files", "--others", "--exclude-standard", "-z"])),
  ]
  return [...new Set(lists.flat())].sort()
}

function repositoryRoot(required) {
  try {
    return git(process.cwd(), ["rev-parse", "--show-toplevel"]).toString("utf8").trim()
  } catch (error) {
    if (required) throw error
    return process.cwd()
  }
}

function main() {
  const options = parse(process.argv.slice(2))
  const root = repositoryRoot(options.files === null)
  const files = options.files ?? changedFromGit(root, options.scope.base)
  const initial = recommendLocalChecks(files)
  const availableTests = new Set(initial.nodeTests.filter((test) => existsSync(join(root, test))))
  const recommendation = recommendLocalChecks(files, { availableTests })
  const output = { scope: { ...options.scope, files }, ...recommendation }
  if (options.json) console.log(JSON.stringify(output, null, 2))
  else {
    console.log("Status: " + recommendation.status)
    console.log("Scope: " + files.length + " path(s)")
    for (const command of recommendation.commands) console.log(quote(command))
    if (recommendation.unmappedPaths.length)
      console.log("Owner review: " + recommendation.unmappedPaths.join(", "))
    for (const note of recommendation.notes) console.log(note)
  }
}

try {
  main()
} catch (error) {
  console.error("verification plan: " + (error instanceof Error ? error.message : String(error)))
  process.exit(2)
}
