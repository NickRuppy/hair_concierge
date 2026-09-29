import "server-only"

import { DEFAULT_AGENT_V2_MODEL } from "@/lib/agent-v2/model-policy"

import type { DiscoveryCallSheetBriefSections } from "../call-sheet"
import {
  consultBriefJsonSchemaFormat,
  consultBriefSwapKeys,
  toConsultBriefSections,
  type ConsultBriefJsonSchemaFormat,
} from "./api-schema"
import { consultSourceHash } from "./hash"
import type { ConsultInput } from "./input"
import { CONSULT_BOUNDARY_LINE, lintConsultBrief, type ConsultLintFinding } from "./lint"
import {
  buildConsultBriefPrompt,
  consultBriefSectionsSchema,
  CONSULT_BRIEF_PROMPT_VERSION,
} from "./prompt"

/**
 * The consult brief generator (consult-agent T2, hardened in consult-brief-hardening T3):
 * prompt → LLM completion under a strict Structured Outputs schema → parse onto
 * `consult_brief.sections` → boundary line appended in code → guardrail lint. A lint failure
 * gets exactly one corrective second completion. Behind an interface: the completion is a
 * dependency, so tests never reach the API and the provider can change later.
 *
 * Nothing is written here. Every failure is a value (`{ error }`) without a brief — the route
 * (T3) then leaves the stored brief untouched.
 */

/** The strongest model the repo configures (agent-v2's default); `CONSULT_BRIEF_MODEL` overrides. */
export const CONSULT_BRIEF_DEFAULT_MODEL = DEFAULT_AGENT_V2_MODEL

/** The brief is one long reasoning call; the client's chat-sized default (25 s) is too short. */
export const CONSULT_BRIEF_TIMEOUT_MS = 55_000

export function consultBriefModel(env: Record<string, string | undefined> = process.env): string {
  return env.CONSULT_BRIEF_MODEL?.trim() || CONSULT_BRIEF_DEFAULT_MODEL
}

/** The retry's second turn: the rejected draft as the model wrote it, then the correction. */
export type ConsultBriefCorrection = {
  previousDraft: string
  instruction: string
}

export type ConsultBriefCompletion = (request: {
  system: string
  user: string
  model: string
  format: ConsultBriefJsonSchemaFormat
  correction?: ConsultBriefCorrection
}) => Promise<string>

export type ConsultBriefDependencies = {
  complete: ConsultBriefCompletion
  model: string
}

export type ConsultBriefErrorCode = "llm_failed" | "invalid_json" | "invalid_schema" | "lint_failed"

export type ConsultBriefResult =
  | { brief: DiscoveryCallSheetBriefSections; sourceHash: string }
  | { error: { code: ConsultBriefErrorCode; findings?: ConsultLintFinding[] } }

/**
 * The production completion: the repo's OpenAI lane through the Langfuse-observed client
 * (`getObservedOpenAI`, as the chat runtime uses it), Responses API with strict Structured
 * Outputs. Loaded lazily so importing this module never builds a client.
 */
export const openAIConsultBriefCompletion: ConsultBriefCompletion = async ({
  system,
  user,
  model,
  format,
  correction,
}) => {
  const { getObservedOpenAI } = await import("@/lib/openai/client")
  const response = await getObservedOpenAI({
    generationName: "discovery-consult-brief",
    generationMetadata: {
      feature: "discovery-consult-brief",
      prompt_version: CONSULT_BRIEF_PROMPT_VERSION,
      attempt: correction ? 2 : 1,
    },
  }).responses.create(
    {
      model,
      store: false,
      instructions: system,
      input: correction
        ? [
            { role: "user", content: user },
            { role: "assistant", content: correction.previousDraft },
            { role: "user", content: correction.instruction },
          ]
        : user,
      reasoning: { effort: "medium" },
      text: { format, verbosity: "low" },
    },
    { timeout: CONSULT_BRIEF_TIMEOUT_MS },
  )
  return response.output_text ?? ""
}

export const CONSULT_BRIEF_DEPENDENCIES: ConsultBriefDependencies = {
  complete: openAIConsultBriefCompletion,
  get model() {
    return consultBriefModel()
  },
}

type Attempt =
  | { raw: string; brief: DiscoveryCallSheetBriefSections; findings: ConsultLintFinding[] }
  | { error: { code: Exclude<ConsultBriefErrorCode, "lint_failed"> } }

/** Trim-equal to the boundary line: the model wrote it anyway, so the code does not double it. */
export function withBoundaryLine(erwartungen: string[]): string[] {
  const boundaryLine = CONSULT_BOUNDARY_LINE.trim()
  return [...erwartungen.filter((line) => line.trim() !== boundaryLine), CONSULT_BOUNDARY_LINE]
}

function correctionInstruction(findings: ConsultLintFinding[]): string {
  const lines = findings.map((finding) => {
    const excerpt = finding.excerpt ? ` „${finding.excerpt}"` : ""
    const detail = finding.detail ? ` (${finding.detail})` : ""
    return `- ${finding.guardrail} ${finding.rule} in ${finding.location}:${excerpt}${detail}`
  })
  return [
    "Der vorige Entwurf verletzt folgende Regeln:",
    ...lines,
    "",
    "Schreibe den vollständigen Brief korrigiert neu. Behalte, was regelkonform war, und formuliere nur die genannten Stellen um.",
  ].join("\n")
}

export async function generateConsultBrief(
  input: ConsultInput,
  deps: ConsultBriefDependencies = CONSULT_BRIEF_DEPENDENCIES,
): Promise<ConsultBriefResult> {
  const prompt = buildConsultBriefPrompt(input)
  const format = consultBriefJsonSchemaFormat(consultBriefSwapKeys(input))

  const attempt = async (correction?: ConsultBriefCorrection): Promise<Attempt> => {
    let raw: string
    try {
      raw = await deps.complete({
        ...prompt,
        model: deps.model,
        format,
        ...(correction ? { correction } : {}),
      })
    } catch (error) {
      console.error("[discovery] consult brief completion failed:", error)
      return { error: { code: "llm_failed" } }
    }

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return { error: { code: "invalid_json" } }
    }

    const parsed = consultBriefSectionsSchema.safeParse(toConsultBriefSections(json))
    if (!parsed.success) return { error: { code: "invalid_schema" } }
    const brief: DiscoveryCallSheetBriefSections = {
      ...parsed.data,
      erwartungen: withBoundaryLine(parsed.data.erwartungen),
    }
    return { raw, brief, findings: lintConsultBrief(brief, input) }
  }

  const first = await attempt()
  if ("error" in first) return first
  if (first.findings.length === 0)
    return { brief: first.brief, sourceHash: consultSourceHash(input) }

  const second = await attempt({
    previousDraft: first.raw,
    instruction: correctionInstruction(first.findings),
  })
  if ("error" in second) return second
  if (second.findings.length > 0) {
    return { error: { code: "lint_failed", findings: second.findings } }
  }
  return { brief: second.brief, sourceHash: consultSourceHash(input) }
}
