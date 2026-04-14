import fs from "fs"
import path from "path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { LangfuseClient } from "@langfuse/client"

export interface ProductionTraceCandidate {
  langfuseTraceId: string
  createdAt: string
  feedbackScore: number | null
  conversationId: string | null
  userMessage: string
  assistantContent: string
  intent: string | null
  productCategory: string | null
  retrievalMode: string | null
  responseMode: string | null
  needsClarification: boolean | null
  promptVersion: number | null
  promptLabel: string | null
  promptIsFallback: boolean | null
}

export function loadLocalEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, "$1")
    }
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}. Add it to your environment or .env.local.`)
  }
  return value
}

export function getLangfuseClientOrThrow(): LangfuseClient {
  return new LangfuseClient({
    publicKey: requireEnv("LANGFUSE_PUBLIC_KEY"),
    secretKey: requireEnv("LANGFUSE_SECRET_KEY"),
    baseUrl: requireEnv("LANGFUSE_BASE_URL"),
  })
}

export function getSupabaseAdminClientOrThrow(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}

export function getPromptLabel(): string {
  return (
    process.env.LANGFUSE_PROMPT_LABEL ??
    (process.env.NODE_ENV === "production" ? "production" : "staging")
  )
}

export function parseArgs(argv: string[]): Map<string, string | true> {
  const parsed = new Map<string, string | true>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) continue

    const next = argv[index + 1]
    if (next && !next.startsWith("--")) {
      parsed.set(token, next)
      index += 1
    } else {
      parsed.set(token, true)
    }
  }

  return parsed
}

export function readStringArg(
  args: Map<string, string | true>,
  name: string,
  fallback?: string,
): string | undefined {
  const value = args.get(name)
  if (typeof value === "string") return value
  return fallback
}

export function readNumberArg(
  args: Map<string, string | true>,
  name: string,
  fallback: number,
): number {
  const value = args.get(name)
  if (typeof value !== "string") return fallback

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function hasFlag(args: Map<string, string | true>, name: string): boolean {
  return args.has(name)
}

export async function fetchProductionTraceCandidates(
  supabase: SupabaseClient,
  sinceDays: number,
  fetchLimit: number,
): Promise<ProductionTraceCandidate[]> {
  const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: traceRows, error: traceError } = await supabase
    .from("conversation_turn_traces")
    .select("assistant_message_id, langfuse_trace_id, created_at, trace")
    .gte("created_at", sinceIso)
    .not("langfuse_trace_id", "is", null)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(fetchLimit)

  if (traceError) {
    throw new Error(`Failed to load production traces: ${traceError.message}`)
  }

  const assistantMessageIds = (traceRows ?? [])
    .map((row) => row.assistant_message_id)
    .filter((value): value is string => typeof value === "string")

  const feedbackByMessageId = new Map<string, number | null>()
  if (assistantMessageIds.length > 0) {
    const { data: messageRows, error: messageError } = await supabase
      .from("messages")
      .select("id, user_feedback_score")
      .in("id", assistantMessageIds)

    if (messageError) {
      throw new Error(`Failed to load assistant feedback rows: ${messageError.message}`)
    }

    for (const row of messageRows ?? []) {
      feedbackByMessageId.set(row.id, row.user_feedback_score ?? null)
    }
  }

  return (traceRows ?? [])
    .map((row) => {
      const trace = row.trace as Record<string, any> | null
      if (!trace || typeof row.langfuse_trace_id !== "string") return null

      return {
        langfuseTraceId: row.langfuse_trace_id,
        createdAt: row.created_at,
        feedbackScore:
          typeof row.assistant_message_id === "string"
            ? (feedbackByMessageId.get(row.assistant_message_id) ?? null)
            : null,
        conversationId: trace.conversation_id ?? null,
        userMessage: trace.user_message ?? "",
        assistantContent: trace.response?.assistant_content ?? "",
        intent: trace.intent ?? null,
        productCategory: trace.product_category ?? null,
        retrievalMode: trace.router_decision?.retrieval_mode ?? null,
        responseMode:
          trace.router_decision?.response_mode ??
          (typeof trace.router_decision?.needs_clarification === "boolean"
            ? trace.router_decision.needs_clarification
              ? "clarify_only"
              : "answer_direct"
            : null),
        needsClarification:
          typeof trace.router_decision?.needs_clarification === "boolean"
            ? trace.router_decision.needs_clarification
            : trace.router_decision?.response_mode === "clarify_only"
              ? true
              : trace.router_decision?.response_mode
                ? false
                : null,
        promptVersion: trace.prompt_refs?.synthesis?.version ?? null,
        promptLabel: trace.prompt_refs?.synthesis?.label ?? null,
        promptIsFallback:
          typeof trace.prompt_refs?.synthesis?.is_fallback === "boolean"
            ? trace.prompt_refs.synthesis.is_fallback
            : null,
      }
    })
    .filter((value): value is ProductionTraceCandidate => Boolean(value))
}
