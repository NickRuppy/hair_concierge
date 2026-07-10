import assert from "node:assert/strict"
import test from "node:test"

import {
  buildMessageContextWriteColumns,
  normalizeMessageContextRow,
  readPersistedMessageContext,
} from "@/lib/chat-runtime/message-context"
import type { MessageContext } from "@/lib/types"

const legacyContext: MessageContext = {
  response_mode: "answer_direct",
}

const currentContext: MessageContext = {
  response_mode: "recommend_and_refine",
}

test("readPersistedMessageContext prefers message_context over the legacy column", () => {
  assert.deepEqual(
    readPersistedMessageContext({
      message_context: currentContext,
      rag_context: legacyContext,
    }),
    currentContext,
  )
})

test("readPersistedMessageContext falls back to legacy rag_context", () => {
  assert.deepEqual(
    readPersistedMessageContext({ message_context: null, rag_context: legacyContext }),
    legacyContext,
  )
  assert.equal(readPersistedMessageContext({ message_context: null, rag_context: null }), null)
})

test("legacy fallback strips source payloads and their rendered markers", () => {
  const normalized = normalizeMessageContextRow({
    id: "message-legacy",
    content: "Shampoo ist fuer die Kopfhaut [1], nicht fuer die Laengen [2].",
    message_context: null,
    rag_context: {
      response_mode: "answer_direct",
      sources: [{ index: 1 }, { index: 2 }],
    },
  })

  assert.equal(normalized.content, "Shampoo ist fuer die Kopfhaut, nicht fuer die Laengen.")
  assert.deepEqual(normalized.message_context, { response_mode: "answer_direct" })
  assert.equal("sources" in (normalized.message_context ?? {}), false)
})

test("normalization keeps stripping markers after the source-free compatibility backfill", () => {
  const legacyContextWithSources = {
    response_mode: "answer_direct" as const,
    sources: [{ index: 1 }],
  }
  const normalized = normalizeMessageContextRow({
    content: "Historische Antwort [1].",
    message_context: { response_mode: "answer_direct" },
    rag_context: legacyContextWithSources,
  })

  assert.equal(normalized.content, "Historische Antwort.")
  assert.deepEqual(normalized.message_context, { response_mode: "answer_direct" })
})

test("normalization preserves bracketed numbers when no legacy sources exist", () => {
  const normalized = normalizeMessageContextRow({
    content: "Nutze an Schritt [1] nur wenig Produkt.",
    message_context: currentContext,
    rag_context: null,
  })

  assert.equal(normalized.content, "Nutze an Schritt [1] nur wenig Produkt.")
})

test("normalizeMessageContextRow exposes only the canonical client field", () => {
  const normalized = normalizeMessageContextRow({
    id: "message-1",
    message_context: null,
    rag_context: legacyContext,
  })

  assert.deepEqual(normalized, {
    id: "message-1",
    message_context: legacyContext,
  })
  assert.equal("rag_context" in normalized, false)
})

test("buildMessageContextWriteColumns dual-writes the exact same object", () => {
  const columns = buildMessageContextWriteColumns(currentContext)

  assert.equal(columns.message_context, currentContext)
  assert.equal(columns.rag_context, currentContext)
  assert.deepEqual(buildMessageContextWriteColumns(null), {
    message_context: null,
    rag_context: null,
  })
})
