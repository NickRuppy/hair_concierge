import OpenAI from "openai"
import { LangfuseClient } from "@langfuse/client"
import { observeOpenAI, type LangfuseConfig as LangfuseOpenAIConfig } from "@langfuse/openai"
import { LangfuseSpanProcessor } from "@langfuse/otel"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { maskLangfuseExport } from "./masking"

let openAIInstance: OpenAI | null = null
let langfuseInstance: LangfuseClient | null | undefined

declare global {
  var __hairConciergeLangfuseSdk: NodeSDK | undefined
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name} – set it in your .env.local file.`)
  }
  return value
}

export function getRawOpenAI(): OpenAI {
  if (!openAIInstance) {
    openAIInstance = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") })
  }

  return openAIInstance
}

export function isLangfuseConfigured(): boolean {
  return Boolean(
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_SECRET_KEY &&
    process.env.LANGFUSE_BASE_URL,
  )
}

export function getLangfuseClient(): LangfuseClient | null {
  if (langfuseInstance !== undefined) {
    return langfuseInstance
  }

  if (!isLangfuseConfigured()) {
    langfuseInstance = null
    return langfuseInstance
  }

  langfuseInstance = new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
  })

  return langfuseInstance
}

export function getLangfusePromptLabel(): string {
  return (
    process.env.LANGFUSE_PROMPT_LABEL ??
    (process.env.NODE_ENV === "production" ? "production" : "staging")
  )
}

export function getLangfuseEnvironment(): string {
  return (
    process.env.LANGFUSE_TRACING_ENVIRONMENT ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  )
}

export function getLangfuseRelease(): string {
  return (
    process.env.LANGFUSE_RELEASE ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    "local"
  )
}

export function ensureLangfuseTracing(): NodeSDK | null {
  if (!isLangfuseConfigured()) {
    return null
  }

  if (globalThis.__hairConciergeLangfuseSdk) {
    return globalThis.__hairConciergeLangfuseSdk
  }

  const sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL,
        environment: getLangfuseEnvironment(),
        release: getLangfuseRelease(),
        exportMode: "immediate",
        mask: maskLangfuseExport,
      }),
    ],
  })

  sdk.start()
  globalThis.__hairConciergeLangfuseSdk = sdk

  return sdk
}

export function isValidLangfuseTraceId(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{32}$/i.test(value) && !/^0{32}$/i.test(value))
}

export function resolveLangfuseTraceId(params: {
  traceId?: string | null
  otelSpan?: { spanContext: () => { traceId: string } } | null
}): string | null {
  const candidates = [params.traceId, params.otelSpan?.spanContext().traceId]

  for (const candidate of candidates) {
    if (isValidLangfuseTraceId(candidate)) {
      return candidate
    }
  }

  return null
}

export function getObservedOpenAI(config?: LangfuseOpenAIConfig): OpenAI {
  return observeOpenAI(getRawOpenAI(), config)
}

export async function flushLangfuseClient(): Promise<void> {
  const langfuse = getLangfuseClient()
  if (!langfuse) return

  await langfuse.flush()
}
