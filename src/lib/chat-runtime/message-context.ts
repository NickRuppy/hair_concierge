import type { MessageContext } from "@/lib/types"

type PersistedMessageContext = MessageContext & {
  sources?: unknown[]
}

export type PersistedMessageContextColumns = {
  message_context: PersistedMessageContext | null
  rag_context: PersistedMessageContext | null
}

export function readPersistedMessageContext(
  row: PersistedMessageContextColumns,
): MessageContext | null {
  const persistedContext = row.message_context ?? row.rag_context
  if (!persistedContext) return null

  const context = { ...persistedContext }
  delete context.sources
  return context
}

export function buildMessageContextWriteColumns(context: MessageContext | null): {
  message_context: MessageContext | null
  rag_context: MessageContext | null
} {
  return {
    message_context: context,
    rag_context: context,
  }
}

export function normalizeMessageContextRow<T extends PersistedMessageContextColumns>(
  row: T,
): Omit<T, "rag_context" | "message_context"> & { message_context: MessageContext | null } {
  const rest = { ...row }
  Reflect.deleteProperty(rest, "rag_context")
  Reflect.deleteProperty(rest, "message_context")

  const normalized = {
    ...rest,
    message_context: readPersistedMessageContext(row),
  }

  if (
    [row.message_context?.sources, row.rag_context?.sources].some(
      (sources) => Array.isArray(sources) && sources.length > 0,
    ) &&
    "content" in normalized &&
    typeof normalized.content === "string"
  ) {
    normalized.content = normalized.content.replace(/[ \t]*\[\d+\]/g, "")
  }

  return normalized
}

export function normalizeMessageContextRows<T extends PersistedMessageContextColumns>(
  rows: T[],
): Array<Omit<T, "rag_context" | "message_context"> & { message_context: MessageContext | null }> {
  return rows.map(normalizeMessageContextRow)
}
