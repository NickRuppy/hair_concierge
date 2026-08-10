#!/usr/bin/env node

if (process.argv.length <= 2) {
  console.error("At least one name=result pair is required.")
  process.exit(1)
}

let invalid = false
const allowedSkippedJobs = new Set()
const resultArguments = []

for (const argument of process.argv.slice(2)) {
  if (argument.startsWith("--allow-skipped=")) {
    const name = argument.slice("--allow-skipped=".length)
    if (!name) {
      console.error("Malformed --allow-skipped option.")
      invalid = true
    } else {
      allowedSkippedJobs.add(name)
    }
    continue
  }

  resultArguments.push(argument)
}

if (resultArguments.length === 0) {
  console.error("At least one name=result pair is required.")
  invalid = true
}

for (const argument of resultArguments) {
  const separator = argument.indexOf("=")
  const name = separator === -1 ? "" : argument.slice(0, separator)
  const result = separator === -1 ? "" : argument.slice(separator + 1)

  if (!name || !result) {
    console.error(`Malformed job result: ${argument || "<empty>"}`)
    invalid = true
    continue
  }

  const line = `${name}: ${result}`
  if (result === "success" || (result === "skipped" && allowedSkippedJobs.has(name))) {
    console.log(line)
  } else {
    console.error(line)
    invalid = true
  }
}

if (invalid) process.exit(1)
