"use client"

import { useChat } from "@/hooks/use-chat"
import { useHairProfile } from "@/hooks/use-hair-profile"
import { generateSuggestedPrompts } from "@/lib/suggested-prompts"
import { ChatInput } from "./chat-input"
import { ChatMessage } from "./chat-message"
import { ProductCard } from "./product-card"
import { ConversationSidebar } from "./conversation-sidebar"
import { useEffect, useMemo, useRef, useState } from "react"
import { Menu, Sparkles } from "lucide-react"

export function ChatContainer() {
  const {
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
  } = useChat()

  const { hairProfile } = useHairProfile()
  const suggestedPrompts = useMemo(() => generateSuggestedPrompts(hairProfile), [hairProfile])

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden w-72 shrink-0 md:block">
        <ConversationSidebar
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={loadConversation}
          onNew={startNewConversation}
          onDelete={deleteConversation}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-72">
            <ConversationSidebar
              conversations={conversations}
              currentId={currentConversationId}
              onSelect={loadConversation}
              onNew={startNewConversation}
              onDelete={deleteConversation}
              onClose={() => setSidebarOpen(false)}
              isMobile
            />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex items-center gap-2 border-b p-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium">
            {currentConversationId ? "Chat" : "Neuer Chat"}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center px-4">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="mb-2 text-xl font-bold">
                Hey, meine Lieben! 💇
              </h2>
              <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
                Ich bin Tom, euer Haar-Experte. Fragt mich alles rund
                ums Thema Haare — von Pflege-Tipps bis Produktempfehlungen!
              </p>
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="rounded-xl border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4 p-4">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {/* Product recommendations */}
              {productRecommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Produktempfehlungen
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {productRecommendations.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              )}

              {/* Streaming indicator */}
              {isStreaming &&
                messages[messages.length - 1]?.role === "assistant" &&
                !messages[messages.length - 1]?.content && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      HC
                    </div>
                    <div className="rounded-2xl bg-muted px-4 py-2.5">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </div>
    </div>
  )
}
