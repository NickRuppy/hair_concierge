import type { LangfusePromptReference } from "@/lib/types"
import type { LangfuseConfig as LangfuseOpenAIConfig } from "@langfuse/openai"
import {
  AGENT_FINAL_RENDER_PROMPT,
  AGENT_ROUTE_CLASSIFIER_PROMPT,
  AGENTIC_CONTEXTUAL_COMPOSER_PROMPT,
  AGENTIC_TOOL_LOOP_PROMPT,
} from "@/lib/agent/orchestrator/prompt"
import {
  INTENT_CLASSIFICATION_PROMPT,
  MEMORY_EXTRACTION_JSON_PROMPT,
  SYSTEM_PROMPT,
  TITLE_GENERATION_PROMPT,
} from "@/lib/rag/prompts"
import { getLangfuseClient, getLangfusePromptLabel } from "./client"

const DEFAULT_CACHE_TTL_SECONDS = 60
const DEFAULT_FETCH_TIMEOUT_MS = 3000

export const LANGFUSE_PROMPTS = {
  chatSystem: {
    name: "chaarlie-chat-system",
    fallback: SYSTEM_PROMPT,
  },
  intentClassifier: {
    name: "chaarlie-intent-classifier",
    fallback: INTENT_CLASSIFICATION_PROMPT,
  },
  titleGenerator: {
    name: "chaarlie-title-generator",
    fallback: TITLE_GENERATION_PROMPT,
  },
  memoryExtraction: {
    name: "chaarlie-memory-extraction",
    fallback: MEMORY_EXTRACTION_JSON_PROMPT,
  },
  agentRouteClassifier: {
    name: "chaarlie-agent-route-classifier",
    fallback: AGENT_ROUTE_CLASSIFIER_PROMPT,
  },
  agenticToolLoop: {
    name: "chaarlie-agentic-tool-loop",
    fallback: AGENTIC_TOOL_LOOP_PROMPT,
  },
  agenticContextualComposer: {
    name: "chaarlie-agentic-contextual-composer",
    fallback: AGENTIC_CONTEXTUAL_COMPOSER_PROMPT,
  },
  agentFinalRender: {
    name: "chaarlie-agent-final-render",
    fallback: AGENT_FINAL_RENDER_PROMPT,
  },
} as const

export type PromptDefinition = (typeof LANGFUSE_PROMPTS)[keyof typeof LANGFUSE_PROMPTS]

export interface ManagedTextPrompt {
  text: string
  ref: LangfusePromptReference
}

export interface ManagedTextPromptTemplate {
  template: string
  ref: LangfusePromptReference
}

export function buildLangfusePromptConfig(
  ref: LangfusePromptReference,
): LangfuseOpenAIConfig["langfusePrompt"] | undefined {
  if (ref.version === null) return undefined

  return {
    name: ref.name,
    version: ref.version,
    isFallback: ref.is_fallback,
  }
}

function compileFallbackTextPrompt(
  template: string,
  variables: Record<string, string | undefined> = {},
): string {
  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_match, variableName: string) => {
    return variables[variableName] ?? ""
  })
}

function buildFallbackReference(name: string, label: string): LangfusePromptReference {
  return {
    name,
    version: null,
    label,
    is_fallback: true,
  }
}

export async function getManagedTextPrompt(
  prompt: PromptDefinition,
  variables: Record<string, string | undefined> = {},
): Promise<ManagedTextPrompt> {
  const managedPrompt = await getManagedTextPromptTemplate(prompt)

  return {
    text: compileFallbackTextPrompt(managedPrompt.template, variables),
    ref: managedPrompt.ref,
  }
}

export async function getManagedTextPromptTemplate(
  prompt: PromptDefinition,
): Promise<ManagedTextPromptTemplate> {
  const label = getLangfusePromptLabel()
  const langfuse = getLangfuseClient()

  if (!langfuse) {
    return {
      template: prompt.fallback,
      ref: buildFallbackReference(prompt.name, label),
    }
  }

  try {
    const managedPrompt = await langfuse.prompt.get(prompt.name, {
      type: "text",
      label,
      cacheTtlSeconds: DEFAULT_CACHE_TTL_SECONDS,
      fetchTimeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
      maxRetries: 1,
    })

    return {
      template: managedPrompt.prompt,
      ref: {
        name: managedPrompt.promptResponse.name,
        version: managedPrompt.promptResponse.version,
        label,
        is_fallback: managedPrompt.isFallback,
      },
    }
  } catch (error) {
    console.warn(`Langfuse prompt fetch failed for ${prompt.name}; using fallback.`, error)
    return {
      template: prompt.fallback,
      ref: buildFallbackReference(prompt.name, label),
    }
  }
}
