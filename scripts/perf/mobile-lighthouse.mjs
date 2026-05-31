#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const baseUrl = (process.env.LH_BASE_URL || "https://chaarlie.de").replace(/\/$/, "")
const paths = (process.env.LH_PATHS || "/,/quiz,/pricing,/auth")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
const outputDir = process.env.LH_OUTPUT_DIR || "tmp/lighthouse"
const dryRun = process.env.LH_DRY_RUN === "1"
const failOnThreshold = process.env.LH_FAIL_ON_THRESHOLD !== "0"
const lighthousePackage = process.env.LH_LIGHTHOUSE_PACKAGE || "lighthouse@12.8.2"

const thresholds = {
  lcpMs: Number(process.env.LH_LCP_MS || 2500),
  cls: Number(process.env.LH_CLS || 0.1),
  tbtMs: Number(process.env.LH_TBT_MS || 300),
}

function slugForPath(value) {
  if (value === "/") return "home"
  return value.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "page"
}

function pageUrl(pagePath) {
  return `${baseUrl}${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`
}

function run(command, args) {
  if (dryRun) {
    console.log([command, ...args].join(" "))
    return
  }

  const result = spawnSync(command, args, { stdio: "inherit", encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`)
  }
}

function readMetric(reportPath, auditId) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"))
  return Number(report.audits?.[auditId]?.numericValue ?? Number.NaN)
}

function evaluate(reportPath, targetUrl) {
  const lcp = readMetric(reportPath, "largest-contentful-paint")
  const cls = readMetric(reportPath, "cumulative-layout-shift")
  const tbt = readMetric(reportPath, "total-blocking-time")
  const failures = []

  if (!Number.isFinite(lcp) || lcp > thresholds.lcpMs) failures.push(`LCP ${Math.round(lcp)}ms`)
  if (!Number.isFinite(cls) || cls > thresholds.cls) failures.push(`CLS ${cls.toFixed(3)}`)
  if (!Number.isFinite(tbt) || tbt > thresholds.tbtMs) failures.push(`TBT ${Math.round(tbt)}ms`)

  const summary = `${targetUrl}: LCP ${Math.round(lcp)}ms, CLS ${cls.toFixed(3)}, TBT ${Math.round(tbt)}ms`
  if (failures.length > 0) {
    console.error(`FAIL ${summary} (${failures.join(", ")})`)
    return false
  }

  console.log(`PASS ${summary}`)
  return true
}

function lighthouseArgs(targetUrl, outputBase) {
  return [
    "--yes",
    lighthousePackage,
    targetUrl,
    "--only-categories=performance",
    "--form-factor=mobile",
    "--screenEmulation.mobile=true",
    "--throttling-method=simulate",
    "--output=json",
    "--output=html",
    `--output-path=${outputBase}`,
    "--quiet",
    "--chrome-flags=--headless=new --no-sandbox",
  ]
}

function main() {
  mkdirSync(outputDir, { recursive: true })

  const npx = execFileSync("command", ["-v", "npx"], {
    encoding: "utf8",
    shell: true,
  }).trim()

  const results = []
  for (const pagePath of paths) {
    const targetUrl = pageUrl(pagePath)
    const outputBase = path.join(outputDir, `${slugForPath(pagePath)}.report`)
    run(npx, lighthouseArgs(targetUrl, outputBase))

    if (!dryRun) {
      results.push(evaluate(`${outputBase}.report.json`, targetUrl))
    }
  }

  if (!dryRun && failOnThreshold && results.some((passed) => !passed)) {
    process.exit(1)
  }
}

main()
