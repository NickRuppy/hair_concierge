"use client"

import { useState, useCallback, useRef } from "react"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import type { Message, Conversation } from "@/lib/types"

export type ProductSelectionParams = {
  conversationId: string
  assistantMessageId: string
  clarificationId: string
  selectedProductId: string
}

type ChatStreamEvent = {
  type: string
  data?: unknown
}

export function hasExistingProductSelectionMessage(
  messages: readonly Message[],
  params: ProductSelectionParams,
): boolean {
  return messages.some((message) => {
    const selection = message.rag_context?.product_lookup_selection
    return (
      message.role === "assistant" &&
      selection?.source === "product_lookup_clarification" &&
      selection.clarification_id === params.clarificationId &&
      selection.source_assistant_message_id === params.assistantMessageId
    )
  })
}

interface UseChatReturn {
  messages: Message[]
  isStreaming: boolean
  conversations: Conversation[]
  currentConversationId: string | null
  sendMessage: (content: string) => Promise<void>
  selectProductCandidate: (params: ProductSelectionParams) => Promise<void>
  submitFeedback: (messageId: string, score: -1 | 1) => Promise<void>
  loadConversation: (id: string) => Promise<void>
  loadConversations: () => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  startNewConversation: () => void
}

function redirectToAuthIfNeeded(response: Response): boolean {
  if (!response.redirected) return false

  const url = new URL(response.url)
  if (url.pathname !== "/auth") return false

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    window.location.assign("/api/dev/login?next=/chat")
    return true
  }

  window.location.assign(response.url)
  return true
}

export function readChatStreamErrorMessage(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const message = (data as { message?: unknown; error?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
    const error = (data as { error?: unknown }).error
    if (typeof error === "string" && error.trim()) return error
  }

  return "Das Produkt konnte nicht ausgewählt werden. Bitte versuche es erneut."
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat")
      if (redirectToAuthIfNeeded(res)) return

      if (!res.ok) {
        console.error("Fehler beim Laden der Unterhaltungen:", res.status, res.statusText)
        return
      }

      const contentType = res.headers.get("content-type") ?? ""
      if (!contentType.includes("application/json")) {
        console.error("Fehler beim Laden der Unterhaltungen: unerwartete Antwort")
        return
      }

      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error("Fehler beim Laden der Unterhaltungen:", error)
    }
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/${id}`)
      if (!res.ok) {
        console.error("Fehler beim Laden der Unterhaltung:", res.status, res.statusText)
        return
      }

      const data = await res.json()
      setMessages(data.messages || [])
      setCurrentConversationId(id)
    } catch (error) {
      console.error("Fehler beim Laden der Unterhaltung:", error)
    }
  }, [])

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/chat/${id}`, { method: "DELETE" })
        if (!res.ok) {
          console.error("Fehler beim Loeschen der Unterhaltung:", res.status, res.statusText)
          return
        }

        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (currentConversationId === id) {
          setMessages([])
          setCurrentConversationId(null)
        }
      } catch (error) {
        console.error("Fehler beim Loeschen der Unterhaltung:", error)
      }
    },
    [currentConversationId],
  )

  const startNewConversation = useCallback(() => {
    setMessages([])
    setCurrentConversationId(null)
  }, [])

  const applyChatStreamEvent = useCallback((event: ChatStreamEvent, throwOnError = false) => {
    switch (event.type) {
      case "conversation_id":
        setCurrentConversationId(String(event.data))
        setMessages((prev) =>
          prev.map((message) =>
            message.conversation_id ? message : { ...message, conversation_id: String(event.data) },
          ),
        )
        break
      case "content_delta":
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: (last.content || "") + String(event.data ?? ""),
            }
          }
          return updated
        })
        break
      case "langfuse_trace":
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            const data = event.data as { trace_id?: string | null } | null | undefined
            updated[updated.length - 1] = {
              ...last,
              langfuse_trace_id: data?.trace_id ?? null,
            }
          }
          return updated
        })
        break
      case "product_recommendations":
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              product_recommendations: event.data as Message["product_recommendations"],
            }
          }
          return updated
        })
        break
      case "product_intake_offer":
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              rag_context: {
                ...(last.rag_context ?? { sources: [], category_decision: null }),
                product_intake_offer: event.data as NonNullable<
                  Message["rag_context"]
                >["product_intake_offer"],
              },
            }
          }
          return updated
        })
        break
      case "product_lookup_clarification":
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              rag_context: {
                ...(last.rag_context ?? { sources: [], category_decision: null }),
                product_lookup_clarification: event.data as NonNullable<
                  Message["rag_context"]
                >["product_lookup_clarification"],
              },
            }
          }
          return updated
        })
        break
      case "product_lookup_selection":
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              rag_context: {
                ...(last.rag_context ?? { sources: [], category_decision: null }),
                product_lookup_selection: event.data as NonNullable<
                  Message["rag_context"]
                >["product_lookup_selection"],
              },
            }
          }
          return updated
        })
        break
      case "assistant_message":
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            const data = event.data as
              | {
                  id?: string | null
                  langfuse_trace_id?: string | null
                  langfuse_trace_url?: string | null
                }
              | null
              | undefined
            updated[updated.length - 1] = {
              ...last,
              id: data?.id ?? last.id,
              langfuse_trace_id: data?.langfuse_trace_id ?? last.langfuse_trace_id,
              langfuse_trace_url: data?.langfuse_trace_url ?? last.langfuse_trace_url,
            }
          }
          return updated
        })
        break
      case "sources":
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              rag_context: {
                ...(last.rag_context ?? { category_decision: null }),
                sources: event.data as NonNullable<Message["rag_context"]>["sources"],
              },
            }
          }
          return updated
        })
        break
      case "done":
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            const data = event.data as
              | {
                  category_decision?: NonNullable<Message["rag_context"]>["category_decision"]
                }
              | null
              | undefined
            updated[updated.length - 1] = {
              ...last,
              rag_context: {
                sources: last.rag_context?.sources ?? [],
                category_decision: data?.category_decision ?? null,
                product_intake_offer: last.rag_context?.product_intake_offer ?? null,
                product_lookup_clarification:
                  last.rag_context?.product_lookup_clarification ?? null,
                product_lookup_selection: last.rag_context?.product_lookup_selection ?? null,
              },
            }
          }
          return updated
        })
        break
      case "error": {
        const message = readChatStreamErrorMessage(event.data)
        console.error("Stream error:", event.data)
        if (throwOnError) {
          throw new Error(message)
        }
        break
      }
    }
  }, [])

  const readChatEventStream = useCallback(
    async (res: Response, options?: { throwOnError?: boolean }) => {
      const reader = res.body?.getReader()
      if (!reader) throw new Error("Kein Stream")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const jsonStr = line.slice(6)

          let event: ChatStreamEvent
          try {
            event = JSON.parse(jsonStr) as ChatStreamEvent
          } catch {
            // Skip malformed JSON
            continue
          }

          try {
            applyChatStreamEvent(event, options?.throwOnError ?? false)
          } catch (error) {
            if (error instanceof Error && options?.throwOnError) {
              throw error
            }
          }
        }
      }
    },
    [applyChatStreamEvent],
  )

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return

      // Track first chat message (before optimistic update changes state)
      const isFirstMessage = messages.length === 0

      // Add user message optimistically
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: currentConversationId || "",
        role: "user",
        content,
        product_recommendations: null,
        rag_context: null,
        token_usage: null,
        langfuse_trace_id: null,
        langfuse_trace_url: null,
        user_feedback_score: null,
        user_feedback_at: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)

      if (isFirstMessage) {
        trackAppEvent("first_chat_message", {})
      }

      // Create placeholder for assistant message
      const assistantMessage: Message = {
        id: `temp-assistant-${Date.now()}`,
        conversation_id: currentConversationId || "",
        role: "assistant",
        content: "",
        product_recommendations: null,
        rag_context: null,
        token_usage: null,
        langfuse_trace_id: null,
        langfuse_trace_url: null,
        user_feedback_score: null,
        user_feedback_at: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        abortRef.current = new AbortController()

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            conversation_id: currentConversationId || undefined,
          }),
          signal: abortRef.current.signal,
        })

        if (redirectToAuthIfNeeded(res)) {
          throw new Error("Sitzung abgelaufen")
        }

        if (!res.ok) {
          throw new Error("Fehler beim Senden")
        }

        const contentType = res.headers.get("content-type") ?? ""
        if (!contentType.includes("text/event-stream")) {
          throw new Error("Unerwartete Chat-Antwort")
        }

        await readChatEventStream(res)

        // Refresh conversations list
        loadConversations()
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          // Update assistant message with error
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === "assistant" && !last.content) {
              updated[updated.length - 1] = {
                ...last,
                content: "Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.",
              }
            }
            return updated
          })
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [currentConversationId, isStreaming, loadConversations, messages.length, readChatEventStream],
  )

  const selectProductCandidate = useCallback(
    async ({
      conversationId,
      assistantMessageId,
      clarificationId,
      selectedProductId,
    }: ProductSelectionParams) => {
      if (isStreaming) {
        throw new Error("Bitte warte, bis die aktuelle Antwort fertig ist.")
      }
      if (!conversationId || !assistantMessageId || !clarificationId || !selectedProductId) {
        throw new Error("Das Produkt konnte nicht eindeutig ausgewählt werden.")
      }

      if (
        hasExistingProductSelectionMessage(messages, {
          conversationId,
          assistantMessageId,
          clarificationId,
          selectedProductId,
        })
      ) {
        return
      }

      const assistantPlaceholderId = `temp-assistant-selection-${Date.now()}`
      const assistantMessage: Message = {
        id: assistantPlaceholderId,
        conversation_id: conversationId,
        role: "assistant",
        content: "",
        product_recommendations: null,
        rag_context: null,
        token_usage: null,
        langfuse_trace_id: null,
        langfuse_trace_url: null,
        user_feedback_score: null,
        user_feedback_at: null,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      setIsStreaming(true)

      try {
        abortRef.current = new AbortController()

        const res = await fetch("/api/chat/product-selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            assistant_message_id: assistantMessageId,
            clarification_id: clarificationId,
            selected_product_id: selectedProductId,
          }),
          signal: abortRef.current.signal,
        })

        if (redirectToAuthIfNeeded(res)) {
          throw new Error("Sitzung abgelaufen")
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? "Produkt konnte nicht ausgewählt werden.")
        }

        const contentType = res.headers.get("content-type") ?? ""
        if (!contentType.includes("text/event-stream")) {
          throw new Error("Unerwartete Chat-Antwort")
        }

        await readChatEventStream(res, { throwOnError: true })
        loadConversations()
      } catch (error) {
        setMessages((prev) =>
          prev.filter(
            (message) => !(message.id === assistantPlaceholderId && message.role === "assistant"),
          ),
        )
        if ((error as Error).name !== "AbortError") {
          throw error instanceof Error
            ? error
            : new Error("Produkt konnte nicht ausgewählt werden.")
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [isStreaming, loadConversations, messages, readChatEventStream],
  )

  const submitFeedback = useCallback(
    async (messageId: string, score: -1 | 1) => {
      const previous = messages

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                user_feedback_score: score,
                user_feedback_at: new Date().toISOString(),
              }
            : message,
        ),
      )

      try {
        const res = await fetch("/api/chat/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_id: messageId,
            score,
          }),
        })

        if (!res.ok) {
          throw new Error("Feedback konnte nicht gespeichert werden")
        }

        const data = await res.json()
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  user_feedback_score: data.score,
                  user_feedback_at: data.feedback_at ?? message.user_feedback_at,
                }
              : message,
          ),
        )
      } catch (error) {
        console.error("Fehler beim Speichern des Chat-Feedbacks:", error)
        setMessages(previous)
      }
    },
    [messages],
  )

  return {
    messages,
    isStreaming,
    conversations,
    currentConversationId,
    sendMessage,
    selectProductCandidate,
    submitFeedback,
    loadConversation,
    loadConversations,
    deleteConversation,
    startNewConversation,
  }
}
