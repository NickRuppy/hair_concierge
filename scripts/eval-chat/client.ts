/**
 * Chat Evaluation Harness — Auth + SSE Client
 *
 * Handles test user creation, Supabase cookie auth, and SSE stream parsing.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { SSEResult, HairProfileOverrides } from "./types"

const PROJECT_REF = "pqdkhefxsxkyeqelqegq"
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`
const BASE64_PREFIX = "base64-"
const MAX_CHUNK_SIZE = 3180

// ── Base64URL encoding (matches @supabase/ssr) ───────────────────────────

const TO_BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("")

function stringToBase64URL(str: string): string {
  const base64: string[] = []
  let queue = 0
  let queuedBits = 0

  const emitter = (byte: number) => {
    queue = (queue << 8) | byte
    queuedBits += 8
    while (queuedBits >= 6) {
      const pos = (queue >> (queuedBits - 6)) & 63
      base64.push(TO_BASE64URL[pos])
      queuedBits -= 6
    }
  }

  for (let i = 0; i < str.length; i++) {
    let codepoint = str.charCodeAt(i)
    if (codepoint > 0xd7ff && codepoint <= 0xdbff) {
      const highSurrogate = ((codepoint - 0xd800) * 0x400) & 0xffff
      const lowSurrogate = (str.charCodeAt(i + 1) - 0xdc00) & 0xffff
      codepoint = (lowSurrogate | highSurrogate) + 0x10000
      i += 1
    }
    if (codepoint <= 0x7f) {
      emitter(codepoint)
    } else if (codepoint <= 0x7ff) {
      emitter(0xc0 | (codepoint >> 6))
      emitter(0x80 | (codepoint & 0x3f))
    } else if (codepoint <= 0xffff) {
      emitter(0xe0 | (codepoint >> 12))
      emitter(0x80 | ((codepoint >> 6) & 0x3f))
      emitter(0x80 | (codepoint & 0x3f))
    }
  }

  if (queuedBits > 0) {
    queue = queue << (6 - queuedBits)
    base64.push(TO_BASE64URL[(queue >> 0) & 63])
  }

  return base64.join("")
}

// ── Cookie construction (matches @supabase/ssr chunker) ──────────────────

function buildAuthCookies(sessionJSON: string): string {
  const encoded = BASE64_PREFIX + stringToBase64URL(sessionJSON)
  const urlEncoded = encodeURIComponent(encoded)

  if (urlEncoded.length <= MAX_CHUNK_SIZE) {
    return `${COOKIE_NAME}=${encodeURIComponent(encoded)}`
  }

  // Chunk it
  const chunks: string[] = []
  let remaining = urlEncoded
  while (remaining.length > 0) {
    let head = remaining.slice(0, MAX_CHUNK_SIZE)
    const lastEsc = head.lastIndexOf("%")
    if (lastEsc > MAX_CHUNK_SIZE - 3) {
      head = head.slice(0, lastEsc)
    }
    // Decode back to get the cookie value
    chunks.push(decodeURIComponent(head))
    remaining = remaining.slice(head.length)
  }

  return chunks.map((value, i) => `${COOKIE_NAME}.${i}=${encodeURIComponent(value)}`).join("; ")
}

// ── Test user management ─────────────────────────────────────────────────

export interface TestSession {
  cookie: string
  userId: string
  admin: SupabaseClient
  cleanup: () => Promise<void>
}

export async function createTestSession(
  supabaseUrl: string,
  serviceRoleKey: string,
  anonKey: string,
): Promise<TestSession> {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = `eval-chat-${Date.now()}@test.hairconscierge.dev`
  const password = "eval-test-password-2026"

  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Eval Test User" },
  })

  if (createErr || !userData.user) {
    throw new Error(`Failed to create test user: ${createErr?.message}`)
  }

  const userId = userData.user.id

  // Ensure profile exists with onboarding_completed (middleware requires it)
  await admin.from("profiles").upsert({
    id: userId,
    full_name: "Eval Test User",
    onboarding_completed: true,
  })

  // Sign in to get session tokens
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
    email,
    password,
  })

  if (signInErr || !signInData.session) {
    throw new Error(`Failed to sign in test user: ${signInErr?.message}`)
  }

  const sessionJSON = JSON.stringify(signInData.session)
  const cookie = buildAuthCookies(sessionJSON)

  const cleanup = async () => {
    const { data: conversations } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
    const ids = (conversations ?? []).map((c: { id: string }) => c.id)
    if (ids.length > 0) {
      await admin.from("messages").delete().in("conversation_id", ids)
    }
    await admin.from("conversations").delete().eq("user_id", userId)
    await admin.from("user_memory_entries").delete().eq("user_id", userId)
    await admin.from("hair_profiles").delete().eq("user_id", userId)
    await admin.from("profiles").delete().eq("id", userId)
    await admin.auth.admin.deleteUser(userId)
  }

  return { cookie, userId, admin, cleanup }
}

export async function upsertHairProfile(
  admin: SupabaseClient,
  userId: string,
  overrides: HairProfileOverrides,
): Promise<void> {
  // Delete existing then insert fresh
  await admin.from("hair_profiles").delete().eq("user_id", userId)
  const { onboarding_completed: _, ...profileFields } = overrides
  await admin.from("hair_profiles").insert({
    user_id: userId,
    ...profileFields,
  })
}

export async function clearConversations(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: conversations } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
  const ids = (conversations ?? []).map((c: { id: string }) => c.id)
  if (ids.length > 0) {
    await admin.from("messages").delete().in("conversation_id", ids)
    await admin.from("conversations").delete().in("id", ids)
  }
  await admin.from("user_memory_entries").delete().eq("user_id", userId)
}

// ── SSE stream parsing ──────────────────────────────────────────────────

export async function sendMessage(
  baseUrl: string,
  cookie: string,
  message: string,
  conversationId?: string,
): Promise<SSEResult> {
  const start = Date.now()

  const body: Record<string, string> = { message }
  if (conversationId) body.conversation_id = conversationId

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    redirect: "manual",
  })

  // Check for non-SSE responses (auth redirect, JSON error, etc.)
  const contentType = response.headers.get("content-type") ?? ""
  if (response.status !== 200 || !contentType.includes("text/event-stream")) {
    const text = await response.text().catch(() => "(empty body)")
    return {
      conversation_id: null,
      assistant_message_id: null,
      langfuse_trace_id: null,
      langfuse_trace_url: null,
      content: "",
      done_data: null,
      sources: [],
      products: [],
      error: `HTTP ${response.status} (${contentType}): ${text.slice(0, 500)}`,
      latency_ms: Date.now() - start,
    }
  }

  // Parse SSE stream
  const result: SSEResult = {
    conversation_id: null,
    assistant_message_id: null,
    langfuse_trace_id: null,
    langfuse_trace_url: null,
    content: "",
    done_data: null,
    sources: [],
    products: [],
    error: null,
    latency_ms: 0,
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split("\n\n")
    buffer = frames.pop() || ""

    for (const frame of frames) {
      if (!frame.startsWith("data: ")) continue
      try {
        const event = JSON.parse(frame.slice(6))
        switch (event.type) {
          case "conversation_id":
            result.conversation_id = event.data
            break
          case "langfuse_trace":
            result.langfuse_trace_id = event.data?.trace_id ?? null
            break
          case "content_delta":
            result.content += event.data
            break
          case "product_recommendations":
            result.products = event.data
            break
          case "sources":
            result.sources = event.data
            break
          case "assistant_message":
            result.assistant_message_id = event.data?.id ?? null
            result.langfuse_trace_id = event.data?.langfuse_trace_id ?? result.langfuse_trace_id
            result.langfuse_trace_url = event.data?.langfuse_trace_url ?? null
            break
          case "done":
            result.done_data = event.data
            break
          case "error":
            result.error = event.data?.message ?? "Unknown SSE error"
            break
        }
      } catch {
        // Skip malformed frames
      }
    }
  }

  // Flush remaining buffer
  if (buffer.startsWith("data: ")) {
    try {
      const event = JSON.parse(buffer.slice(6))
      if (event.type === "done") result.done_data = event.data
      if (event.type === "error") result.error = event.data?.message ?? "Unknown SSE error"
    } catch {
      // ignore
    }
  }

  result.latency_ms = Date.now() - start
  return result
}

// ── DB verification helpers ─────────────────────────────────────────────

export async function fetchLatestAssistantMessage(
  admin: SupabaseClient,
  conversationId: string,
): Promise<{
  id: string
  content: string | null
  product_recommendations: unknown[] | null
  rag_context: { sources?: unknown[]; category_decision?: unknown } | null
  langfuse_trace_id: string | null
  langfuse_trace_url: string | null
  user_feedback_score: number | null
} | null> {
  const { data } = await admin
    .from("messages")
    .select(
      "id, content, product_recommendations, rag_context, langfuse_trace_id, langfuse_trace_url, user_feedback_score",
    )
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
