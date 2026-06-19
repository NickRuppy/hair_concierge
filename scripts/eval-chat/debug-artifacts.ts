import fs from "node:fs"
import path from "node:path"

import type { AssertionResult, SSEResult } from "./types"

const MAX_STRING_LENGTH = 500
const MAX_ARRAY_ITEMS = 16
const MAX_OBJECT_KEYS = 24

export type EvalServerInfo =
  | {
      available: true
      base_url: string
      server_started_at: string | null
      git_sha: string | null
      git_branch: string | null
      git_dirty: boolean | null
      node_env?: string | null
      cwd?: string | null
    }
  | {
      available: false
      base_url: string
      status?: number
      error: string
    }

export interface EvalConversationTurnTraceRow {
  status: "completed" | "failed"
  trace: unknown
  langfuse_trace_id?: string | null
  langfuse_trace_url?: string | null
}

export interface FailedTurnDebugArtifact {
  artifact_version: 1
  created_at: string
  base_url: string
  scenario_id: string
  scenario_name: string
  turn_index: number
  message: string
  visible_reply: string
  assertion_failures: AssertionResult[]
  conversation_id: string | null
  assistant_message_id: string | null
  langfuse_trace_id: string | null
  langfuse_trace_url: string | null
  done_data: Record<string, unknown> | null
  products_count: number
  sources_count: number
  server: EvalServerInfo
  trace_available: boolean
  trace_error: string | null
  trace_status: "completed" | "failed" | null
  prompt: {
    source: "langfuse" | "fallback" | "unknown"
    name: string | null
    label: string | null
    version: string | number | null
  } | null
  router_decision: unknown
  decision_context: {
    category_decision: unknown
    matched_product_count: number | null
  } | null
  agent_v2: {
    failure_stage: unknown
    validation_errors: unknown[]
    validation_warnings: unknown[]
    repair_attempts: unknown[]
    blocked_tool_calls: unknown[]
    tool_calls: unknown[]
    loaded_guidance_package_ids: string[]
    bounded_repair_kind: unknown
  } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function compactValue(value: unknown, depth = 0): unknown {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH - 3)}...` : value
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => compactValue(item, depth + 1))
  }

  if (!isRecord(value)) return String(value)
  if (depth >= 3) return "[object]"

  const output: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
    output[key] = compactValue(nestedValue, depth + 1)
  }
  return output
}

function compactArray(value: unknown): unknown[] {
  return Array.isArray(value)
    ? value.slice(0, MAX_ARRAY_ITEMS).map((item) => compactValue(item))
    : []
}

function compactStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, MAX_ARRAY_ITEMS)
    .map((item) => (typeof item === "string" ? item : ""))
    .filter(Boolean)
}

function readPromptSummary(trace: Record<string, unknown>): FailedTurnDebugArtifact["prompt"] {
  const promptRefs = isRecord(trace.prompt_refs) ? trace.prompt_refs : null
  const synthesis = promptRefs && isRecord(promptRefs.synthesis) ? promptRefs.synthesis : null
  const prompt = isRecord(trace.prompt) ? trace.prompt : null
  const promptRef = synthesis ?? (prompt && isRecord(prompt.prompt_ref) ? prompt.prompt_ref : null)
  if (!promptRef) return null

  const isFallback = promptRef.is_fallback === true
  return {
    source: isFallback ? "fallback" : "langfuse",
    name: typeof promptRef.name === "string" ? promptRef.name : null,
    label: typeof promptRef.label === "string" ? promptRef.label : null,
    version:
      typeof promptRef.version === "string" || typeof promptRef.version === "number"
        ? promptRef.version
        : null,
  }
}

function summarizeAgentV2Trace(
  trace: Record<string, unknown>,
): FailedTurnDebugArtifact["agent_v2"] {
  const agentV2 = isRecord(trace.agent_v2_trace) ? trace.agent_v2_trace : null
  if (!agentV2) return null

  return {
    failure_stage: compactValue(agentV2.failure_stage),
    validation_errors: compactArray(agentV2.validation_errors),
    validation_warnings: compactArray(agentV2.validation_warnings),
    repair_attempts: compactArray(agentV2.repair_attempts),
    blocked_tool_calls: compactArray(agentV2.blocked_tool_calls),
    tool_calls: compactArray(agentV2.tool_calls),
    loaded_guidance_package_ids: compactStringArray(agentV2.loaded_guidance_package_ids),
    bounded_repair_kind: compactValue(agentV2.bounded_repair_kind),
  }
}

function readDecisionContext(
  trace: Record<string, unknown>,
): FailedTurnDebugArtifact["decision_context"] {
  const decisionContext = isRecord(trace.decision_context) ? trace.decision_context : null
  if (!decisionContext) return null

  return {
    category_decision: compactValue(decisionContext.category_decision),
    matched_product_count: Array.isArray(decisionContext.matched_products)
      ? decisionContext.matched_products.length
      : null,
  }
}

export function buildFailedTurnDebugArtifact(params: {
  baseUrl: string
  scenarioId: string
  scenarioName: string
  turnIndex: number
  message: string
  sseResult: SSEResult
  assertions: AssertionResult[]
  serverInfo: EvalServerInfo
  traceRow: EvalConversationTurnTraceRow | null
  traceError?: string | null
  now?: Date
}): FailedTurnDebugArtifact {
  const trace = isRecord(params.traceRow?.trace) ? params.traceRow.trace : null

  return {
    artifact_version: 1,
    created_at: (params.now ?? new Date()).toISOString(),
    base_url: params.baseUrl,
    scenario_id: params.scenarioId,
    scenario_name: params.scenarioName,
    turn_index: params.turnIndex,
    message: params.message,
    visible_reply: params.sseResult.content,
    assertion_failures: params.assertions.filter((assertion) => !assertion.passed),
    conversation_id: params.sseResult.conversation_id,
    assistant_message_id: params.sseResult.assistant_message_id,
    langfuse_trace_id: params.sseResult.langfuse_trace_id,
    langfuse_trace_url: params.sseResult.langfuse_trace_url,
    done_data: params.sseResult.done_data,
    products_count: params.sseResult.products.length,
    sources_count: params.sseResult.sources.length,
    server: params.serverInfo,
    trace_available: Boolean(trace),
    trace_error: params.traceError ?? null,
    trace_status: params.traceRow?.status ?? null,
    prompt: trace ? readPromptSummary(trace) : null,
    router_decision: trace ? compactValue(trace.router_decision) : null,
    decision_context: trace ? readDecisionContext(trace) : null,
    agent_v2: trace ? summarizeAgentV2Trace(trace) : null,
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

export function writeFailedTurnDebugArtifact(
  artifact: FailedTurnDebugArtifact,
  outputRoot = path.join(process.cwd(), "test-results", "chat-eval", "debug"),
): string {
  fs.mkdirSync(outputRoot, { recursive: true })
  const timestamp = artifact.created_at.replace(/[:.]/g, "-").slice(0, 19)
  const fileName = `${timestamp}-${slugify(artifact.scenario_id)}-turn-${artifact.turn_index}.json`
  const filePath = path.join(outputRoot, fileName)
  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2))
  return filePath
}

export async function fetchEvalServerInfo(baseUrl: string): Promise<EvalServerInfo> {
  const endpoint = `${baseUrl.replace(/\/+$/g, "")}/api/debug/build-info`
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    })
    if (!response.ok) {
      return {
        available: false,
        base_url: baseUrl,
        status: response.status,
        error: `debug endpoint returned HTTP ${response.status}`,
      }
    }
    const body = await response.json()
    if (!isRecord(body)) {
      return {
        available: false,
        base_url: baseUrl,
        error: "debug endpoint returned non-object JSON",
      }
    }
    return {
      available: true,
      base_url: baseUrl,
      server_started_at: typeof body.server_started_at === "string" ? body.server_started_at : null,
      git_sha: typeof body.git_sha === "string" ? body.git_sha : null,
      git_branch: typeof body.git_branch === "string" ? body.git_branch : null,
      git_dirty: typeof body.git_dirty === "boolean" ? body.git_dirty : null,
      node_env: typeof body.node_env === "string" ? body.node_env : null,
      cwd: typeof body.cwd === "string" ? body.cwd : null,
    }
  } catch (error) {
    return {
      available: false,
      base_url: baseUrl,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
