/**
 * Consult brief eval lane (consult-agent T5) — on demand, real API, never part of CI.
 *
 * Runs the consult brief generator end to end against the three golden profiles
 * (`tests/fixtures/consult-brief/golden-profiles.ts`) with the production completion
 * (Responses API, JSON mode, 55 s budget) and checks every answer: schema, guardrail lint,
 * boundary line, lever shape, no product outside the input, German. Writes one readable
 * Markdown brief per profile plus the raw answers to `test-results/consult-brief-eval/<run>/`.
 *
 * Usage:
 *   npm run test:consult-brief
 *   npm run test:consult-brief -- --profile nomi
 *   npm run test:consult-brief -- --record nomi   # on PASS, (re)writes the CI fixture
 *
 * Needs OPENAI_API_KEY (read from .env.local like the chat eval). One call per profile; the
 * only retry is the OpenAI client's own (`maxRetries: 1`).
 */

import fs from "node:fs"
import path from "node:path"

// ── Load .env.local (same pattern as scripts/eval-chat/run.ts) ───────────
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, "$1")
    }
  }
}

import {
  CONSULT_BRIEF_TIMEOUT_MS,
  consultBriefModel,
  generateConsultBrief,
  openAIConsultBriefCompletion,
} from "../../src/lib/discovery/consult-brief/generate"
import { CONSULT_BRIEF_PROMPT_VERSION } from "../../src/lib/discovery/consult-brief/prompt"
import {
  CONSULT_GOLDEN_PROFILES,
  consultGoldenSource,
  type ConsultGoldenProfileId,
} from "../../tests/fixtures/consult-brief/golden-profiles"
import { consultBriefMarkdown, evaluateConsultBriefAnswer, type ConsultEvalFinding } from "./checks"

export const RECORDED_FIXTURE_DIR = path.join("tests", "fixtures", "consult-brief")

function parseArgs() {
  const args = process.argv.slice(2)
  let profile: string | null = null
  let record: string | null = null
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--profile") profile = args[++index] ?? null
    else if (args[index] === "--record") record = args[++index] ?? null
  }
  return { profile, record }
}

type ProfileRun = {
  id: ConsultGoldenProfileId
  status: "PASS" | "FAIL"
  latencyMs: number
  overBudget: boolean
  generator: string
  jsonShape: string
  findings: ConsultEvalFinding[]
  markdownPath: string | null
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY fehlt (Umgebung oder .env.local) — Lane kann nicht laufen.")
    process.exit(2)
  }
  const { profile: only, record } = parseArgs()
  const profiles = CONSULT_GOLDEN_PROFILES.filter((entry) => !only || entry.id === only)
  if (profiles.length === 0) {
    console.error(`Unbekanntes Profil: ${only}`)
    process.exit(2)
  }

  const model = consultBriefModel()
  const runId = new Date().toISOString().replace(/[:.]/g, "-")
  const outDir = path.join(process.cwd(), "test-results", "consult-brief-eval", runId)
  fs.mkdirSync(outDir, { recursive: true })
  console.log(`Consult-Brief-Eval · Modell ${model} · Prompt ${CONSULT_BRIEF_PROMPT_VERSION}`)
  console.log(`Ausgabe: ${outDir}\n`)

  const runs: ProfileRun[] = []
  for (const profile of profiles) {
    const { input, sourceHash } = consultGoldenSource(profile)
    // A holder, not two `let`s: TS does not see assignments made inside the closure.
    const captured: { raw: string | null; error: string | null } = { raw: null, error: null }
    const started = Date.now()
    const result = await generateConsultBrief(input, {
      model,
      complete: async (request) => {
        try {
          captured.raw = await openAIConsultBriefCompletion(request)
          return captured.raw
        } catch (error) {
          captured.error =
            error instanceof Error ? `${error.name}: ${error.message}` : String(error)
          throw error
        }
      },
    })
    const latencyMs = Date.now() - started
    const { raw, error: completionError } = captured

    const generator =
      "error" in result
        ? `error:${result.error.code}${completionError ? ` (${completionError})` : ""}`
        : "brief"
    const evaluation =
      raw === null
        ? { brief: null, findings: [], jsonShape: "no_answer" }
        : evaluateConsultBriefAnswer(raw, input)
    const findings: ConsultEvalFinding[] = [...evaluation.findings]
    if (raw === null) findings.push({ check: "json", detail: `keine Antwort: ${generator}` })
    const overBudget = latencyMs > CONSULT_BRIEF_TIMEOUT_MS
    const status = "brief" in result && findings.length === 0 ? "PASS" : "FAIL"

    fs.writeFileSync(
      path.join(outDir, `${profile.id}.raw.json`),
      JSON.stringify({ model, latencyMs, generator, sourceHash, raw }, null, 2),
    )
    fs.writeFileSync(path.join(outDir, `${profile.id}.input.json`), JSON.stringify(input, null, 2))

    let markdownPath: string | null = null
    if (evaluation.brief) {
      markdownPath = path.join(outDir, `${profile.id}.md`)
      fs.writeFileSync(
        markdownPath,
        [
          `# Consult-Brief · ${profile.id} · ${status}`,
          "",
          `> ${profile.summary}`,
          "",
          `Modell \`${model}\` · ${(latencyMs / 1000).toFixed(1)} s · Baseline ${input.baselineScore ?? "—"} · Wissen: ${input.knowledge.map((entry) => entry.id).join(", ") || "—"}`,
          "",
          ...(findings.length > 0
            ? ["**Findings:**", "", ...findings.map((f) => `- \`${f.check}\` ${f.detail}`), ""]
            : []),
          consultBriefMarkdown(evaluation.brief, input),
        ].join("\n"),
      )
    }

    if (record === profile.id) {
      if (status === "PASS" && raw !== null) {
        const fixturePath = path.join(
          process.cwd(),
          RECORDED_FIXTURE_DIR,
          `recorded-${profile.id}.json`,
        )
        fs.writeFileSync(
          fixturePath,
          `${JSON.stringify(
            {
              profile: profile.id,
              model,
              promptVersion: CONSULT_BRIEF_PROMPT_VERSION,
              recordedAt: new Date().toISOString(),
              latencyMs,
              sourceHash,
              raw,
            },
            null,
            2,
          )}\n`,
        )
        console.log(`  Fixture aufgezeichnet: ${fixturePath}`)
      } else {
        console.log(`  Nicht aufgezeichnet: ${profile.id} ist ${status}`)
      }
    }

    runs.push({
      id: profile.id,
      status,
      latencyMs,
      overBudget,
      generator,
      jsonShape: evaluation.jsonShape,
      findings,
      markdownPath,
    })
    console.log(
      `${status}  ${profile.id}  ${(latencyMs / 1000).toFixed(1)} s${overBudget ? " (ÜBER 55-s-BUDGET)" : ""}  generator=${generator}  json=${evaluation.jsonShape}`,
    )
    for (const finding of findings) console.log(`      - [${finding.check}] ${finding.detail}`)
  }

  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify({ model, promptVersion: CONSULT_BRIEF_PROMPT_VERSION, runs }, null, 2),
  )
  const failed = runs.filter((run) => run.status === "FAIL").length
  console.log(`\n${runs.length - failed}/${runs.length} PASS · ${outDir}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
