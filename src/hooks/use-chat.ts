"use client"

import { useState, useCallback, useRef } from "react"
import type { Message, Conversation, Product } from "@/lib/types"

interface UseChatReturn {
  messages: Message[]
  isStreaming: boolean
  conversations: Conversation[]
  currentConversationId: string | null
  productRecommendations: Product[]
  sendMessage: (content: string, imageUrl?: string) => Promise<void>
  loadConversation: (id: string) => Promise<void>
  loadConversations: () => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  startNewConversation: () => void
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null)
  const [productRecommendations, setProductRecommendations] = useState<
    Product[]
  >([])
  const abortRef = useRef<AbortController | null>(null)

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/chat")
    if (res.ok) {
      const data = await res.json()
      setConversations(data.conversations || [])
    }
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/${id}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages || [])
      setCurrentConversationId(id)
      setProductRecommendations([])
    }
  }, [])

  const deleteConversation = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/chat/${id}`, { method: "DELETE" })
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (currentConversationId === id) {
          setMessages([])
          setCurrentConversationId(null)
        }
      }
    },
    [currentConversationId]
  )

  const startNewConversation = useCallback(() => {
    setMessages([])
    setCurrentConversationId(null)
    setProductRecommendations([])
  }, [])

  const sendMessage = useCallback(
    async (content: string, imageUrl?: string) => {
      if (isStreaming) return

      // Add user message optimistically
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: currentConversationId || "",
        role: "user",
        content,
        image_url: imageUrl || null,
        image_analysis: null,
        product_recommendations: null,
        rag_context: null,
        token_usage: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)
      setProductRecommendations([])

      // Create placeholder for assistant message
      const assistantMessage: Message = {
        id: `temp-assistant-${Date.now()}`,
        conversation_id: currentConversationId || "",
        role: "assistant",
        content: "",
        image_url: null,
        image_analysis: null,
        product_recommendations: null,
        rag_context: null,
        token_usage: null,
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
            image_url: imageUrl || undefined,
          }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          throw new Error("Fehler beim Senden")
        }

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

            try {
              const event = JSON.parse(jsonStr)

              switch (event.type) {
                case "conversation_id":
                  setCurrentConversationId(event.data)
                  break
                case "content_delta":
                  setMessages((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last && last.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: (last.content || "") + event.data,
                      }
                    }
                    return updated
                  })
                  break
                case "product_recommendations":
                  setProductRecommendations(event.data)
                  break
                case "done":
                  break
                case "error":
                  console.error("Stream error:", event.data)
                  break
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

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
                content:
                  "Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.",
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
    [currentConversationId, isStreaming, loadConversations]
  )

  return {
    messages,
    isStreaming,
    conversations,
    currentConversationId,
    productRecommendations,
    sendMessage,
    loadConversation,
    loadConversations,
    deleteConversation,
    startNewConversation,
  }
}
