import "server-only"

import { DEFAULT_AGENT_V2_MODEL } from "@/lib/agent-v2/model-policy"

import type { DiscoveryCallSheetBriefSections } from "../call-sheet"
import { consultSourceHash } from "./hash"
import type { ConsultInput } from "./input"
import { lintConsultBrief, type ConsultLintFinding } from "./lint"
import {
  buildConsultBriefPrompt,
  consultBriefSectionsSchema,
  CONSULT_BRIEF_PROMPT_VERSION,
} from "./prompt"

/**
 * The consult brief generator (consult-agent T2): prompt → one LLM completion → strict parse
 * onto `consult_brief.sections` → guardrail lint. Behind an interface: the completion is a
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

export type ConsultBriefCompletion = (request: {
  system: string
  user: string
  model: string
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
 * (`getObservedOpenAI`, as the chat runtime uses it), Responses API with JSON output. Loaded
 * lazily so importing this module never builds a client.
 */
export const openAIConsultBriefCompletion: ConsultBriefCompletion = async ({
  system,
  user,
  model,
}) => {
  const { getObservedOpenAI } = await import("@/lib/openai/client")
  const response = await getObservedOpenAI({
    generationName: "discovery-consult-brief",
    generationMetadata: {
      feature: "discovery-consult-brief",
      prompt_version: CONSULT_BRIEF_PROMPT_VERSION,
    },
  }).responses.create(
    {
      model,
      store: false,
      instructions: system,
      input: user,
      text: { format: { type: "json_object" } },
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

export async function generateConsultBrief(
  input: ConsultInput,
  deps: ConsultBriefDependencies = CONSULT_BRIEF_DEPENDENCIES,
): Promise<ConsultBriefResult> {
  const prompt = buildConsultBriefPrompt(input)

  let raw: string
  try {
    raw = await deps.complete({ ...prompt, model: deps.model })
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

  const parsed = consultBriefSectionsSchema.safeParse(json)
  if (!parsed.success) return { error: { code: "invalid_schema" } }
  const brief: DiscoveryCallSheetBriefSections = parsed.data

  const findings = lintConsultBrief(brief, input)
  if (findings.length > 0) return { error: { code: "lint_failed", findings } }

  return { brief, sourceHash: consultSourceHash(input) }
}
