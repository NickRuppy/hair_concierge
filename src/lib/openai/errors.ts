export const DEFAULT_OPENAI_REQUEST_TIMEOUT_MS = 25_000
export const DEFAULT_OPENAI_MAX_RETRIES = 1

type EnvLike = Record<string, string | undefined>

export type OpenAIFailureKind = "rate_limited" | "timeout" | "connection" | "server"

export type OpenAIFailure = {
  kind: OpenAIFailureKind
  status: 429 | 503
  userMessage: string
}

function readIntegerEnv(
  env: EnvLike,
  name: string,
  fallback: number,
  options: { min: number; max: number },
) {
  const raw = env[name]
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return fallback

  return Math.max(options.min, Math.min(options.max, parsed))
}

export function getOpenAIRequestTimeoutMs(env: EnvLike = process.env) {
  return readIntegerEnv(env, "OPENAI_REQUEST_TIMEOUT_MS", DEFAULT_OPENAI_REQUEST_TIMEOUT_MS, {
    min: 5_000,
    max: 55_000,
  })
}

export function getOpenAIMaxRetries(env: EnvLike = process.env) {
  return readIntegerEnv(env, "OPENAI_MAX_RETRIES", DEFAULT_OPENAI_MAX_RETRIES, {
    min: 0,
    max: 2,
  })
}

function readErrorRecord(error: unknown): Record<string, unknown> | null {
  return error && typeof error === "object" ? (error as Record<string, unknown>) : null
}

function readErrorName(error: unknown): string {
  const record = readErrorRecord(error)
  if (typeof record?.name === "string") return record.name
  return error instanceof Error ? error.name : ""
}

function readErrorMessage(error: unknown): string {
  const record = readErrorRecord(error)
  if (typeof record?.message === "string") return record.message
  return error instanceof Error ? error.message : ""
}

function readErrorStatus(error: unknown): number | null {
  const record = readErrorRecord(error)
  return typeof record?.status === "number" ? record.status : null
}

export function classifyOpenAIError(error: unknown): OpenAIFailure | null {
  const status = readErrorStatus(error)
  const name = readErrorName(error)
  const message = readErrorMessage(error).toLowerCase()

  if (status === 429 || name === "RateLimitError") {
    return {
      kind: "rate_limited",
      status: 429,
      userMessage:
        "Gerade sind zu viele KI-Anfragen gleichzeitig. Bitte versuche es gleich nochmal.",
    }
  }

  if (
    name === "APIConnectionTimeoutError" ||
    name === "TimeoutError" ||
    name === "AbortError" ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return {
      kind: "timeout",
      status: 503,
      userMessage: "Chaarlie braucht gerade zu lange. Bitte versuche es gleich nochmal.",
    }
  }

  if (name === "APIConnectionError") {
    return {
      kind: "connection",
      status: 503,
      userMessage: "Die KI-Verbindung ist gerade instabil. Bitte versuche es gleich nochmal.",
    }
  }

  if (typeof status === "number" && status >= 500) {
    return {
      kind: "server",
      status: 503,
      userMessage: "Der KI-Dienst ist gerade nicht stabil. Bitte versuche es gleich nochmal.",
    }
  }

  return null
}
