#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync } from "node:fs"

const stateDir = ".clawpatch"
const templatePath = "clawpatch.config.json"
const stateConfigPath = `${stateDir}/config.json`
const projectPath = `${stateDir}/project.json`

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" })
}

if (!existsSync(templatePath)) {
  throw new Error(`Missing ${templatePath}`)
}

if (!existsSync(projectPath)) {
  run("clawpatch", ["init"])
}

mkdirSync(stateDir, { recursive: true })
copyFileSync(templatePath, stateConfigPath)
console.log(`Prepared Clawpatch state at ${stateDir}`)
