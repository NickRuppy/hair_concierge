#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const args = process.argv.slice(2)

function readArg(name, fallback = null) {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const outputPath = readArg("--output", "clawpatch-summary.md")
const baseRef = readArg("--base", process.env.CI_BASE_REF ?? null)
const featuresDir = ".clawpatch/features"

const slices = [
  {
    name: "Quiz and lead capture",
    patterns: ["src/app/quiz", "src/components/quiz", "src/lib/quiz"],
  },
  {
    name: "Onboarding and profile shaping",
    patterns: [
      "src/app/onboarding",
      "src/components/onboarding",
      "src/lib/onboarding",
      "src/lib/profile",
      "src/hooks/use-hair-profile.ts",
    ],
  },
  {
    name: "Recommendation engine",
    patterns: ["src/lib/recommendation-engine", "src/lib/product-specs"],
  },
  {
    name: "Agentic chat and tools",
    patterns: ["src/app/api/chat", "src/lib/agent", "src/components/chat", "src/hooks/use-chat.ts"],
  },
  {
    name: "RAG and memory",
    patterns: ["src/lib/rag", "src/app/api/memory", "scripts/eval-retrieval.ts"],
  },
  {
    name: "Langfuse and eval loop",
    patterns: ["src/lib/langfuse", "src/lib/openai", "scripts/eval-chat", "scripts/langfuse"],
  },
  {
    name: "Stripe, auth, and access gates",
    patterns: ["src/app/api/stripe", "src/lib/stripe", "src/app/auth", "src/lib/auth", "src/proxy.ts"],
  },
  {
    name: "Supabase schema and policies",
    patterns: ["supabase/migrations", "src/lib/supabase"],
  },
  {
    name: "Admin and product operations",
    patterns: ["src/app/admin", "src/app/api/products"],
  },
  {
    name: "Public UI shell",
    patterns: ["src/app/page.tsx", "src/app/pricing", "src/components/ui", "src/app/layout.tsx", "src/providers"],
  },
  {
    name: "Review tooling and CI",
    patterns: [
      ".github",
      "scripts/ci",
      "docs/codex-review-map.md",
      "docs/clawpatch-code-review.md",
      "clawpatch.config.json",
      "AGENTS.md",
      "package.json",
      "package-lock.json",
    ],
  },
]

function shell(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim()
}

function changedFiles() {
  const files = new Set()
  try {
    if (baseRef) {
      for (const file of shell(["diff", "--name-only", `${baseRef}...HEAD`])
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)) {
        files.add(file)
      }
    }
  } catch {
  }
  for (const gitArgs of [
    ["diff", "--name-only"],
    ["diff", "--name-only", "--cached"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    try {
      for (const file of shell(gitArgs)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)) {
        files.add(file)
      }
    } catch {
    }
  }
  return [...files].sort()
}

function matchesPatterns(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern))
}

function countBy(items, keyFn) {
  const counts = new Map()
  for (const item of items) {
    const key = keyFn(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))
}

function featureMatchText(feature) {
  return [
    feature.title,
    feature.summary,
    ...(feature.entrypoints ?? []).flatMap((entrypoint) => [
      entrypoint.symbol,
      entrypoint.route,
      entrypoint.command,
    ]),
    ...(feature.ownedFiles ?? []).map((file) => file.path),
  ]
    .filter(Boolean)
    .join("\n")
}

function featureExample(feature) {
  return `\`${feature.featureId}\` ${feature.title}`
}

if (!existsSync(featuresDir)) {
  throw new Error(`Missing ${featuresDir}. Run npm run clawpatch:map first.`)
}

const features = readdirSync(featuresDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(featuresDir, file), "utf8")))

const changed = changedFiles()
const touchedSlices = slices
  .map((slice) => ({
    ...slice,
    changedFiles: changed.filter((file) => matchesPatterns(file, slice.patterns)),
  }))
  .filter((slice) => slice.changedFiles.length > 0)

const trustCounts = new Map()
for (const feature of features) {
  for (const boundary of feature.trustBoundaries ?? []) {
    trustCounts.set(boundary, (trustCounts.get(boundary) ?? 0) + 1)
  }
}

const lines = []
lines.push("# Clawpatch Feature Summary")
lines.push("")
lines.push(`Generated from \`npm run clawpatch:map\` for \`${shell(["rev-parse", "--abbrev-ref", "HEAD"])}\`.`)
lines.push("")
lines.push("## Totals")
lines.push("")
lines.push(`- Total features: ${features.length}`)
for (const [kind, count] of countBy(features, (feature) => feature.kind)) {
  lines.push(`- \`${kind}\`: ${count}`)
}
lines.push(`- Features with mapped tests: ${features.filter((feature) => (feature.tests ?? []).length > 0).length}`)
lines.push("")
lines.push("## Trust Boundaries")
lines.push("")
if (trustCounts.size === 0) {
  lines.push("- None mapped")
} else {
  for (const [boundary, count] of [...trustCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- \`${boundary}\`: ${count}`)
  }
}
lines.push("")
lines.push("## Touched Slices")
lines.push("")
if (changed.length === 0) {
  lines.push("- No changed files detected for the configured base ref.")
} else if (touchedSlices.length === 0) {
  lines.push("- Changed files did not match a configured review-map slice.")
} else {
  for (const slice of touchedSlices) {
    lines.push(`- ${slice.name}: ${slice.changedFiles.length} changed file(s)`)
  }
}
lines.push("")
lines.push("## Slice Inventory")
lines.push("")
lines.push("| Slice | Features | Shape | Mapped tests | Notable feature records |")
lines.push("| --- | ---: | --- | ---: | --- |")
for (const slice of slices) {
  const matches = features.filter((feature) => matchesPatterns(featureMatchText(feature), slice.patterns))
  const shape = countBy(matches, (feature) => feature.kind)
    .map(([kind, count]) => `${count} ${kind}`)
    .join(", ")
  const withTests = matches.filter((feature) => (feature.tests ?? []).length > 0).length
  const examples = matches.slice(0, 3).map(featureExample).join("; ")
  lines.push(`| ${slice.name} | ${matches.length} | ${shape || "none"} | ${withTests} | ${examples || "none"} |`)
}
lines.push("")
lines.push("## Notes")
lines.push("")
lines.push("- Clawpatch-generated test links are triage hints, not proof of adequate coverage.")
lines.push("- Keep generated `.clawpatch/` state out of git; upload artifacts from CI instead.")
lines.push("- Use `docs/codex-review-map.md` for repo-specific review risks and verification commands.")
lines.push("")

writeFileSync(outputPath, `${lines.join("\n")}\n`)
console.log(`Wrote ${outputPath}`)
