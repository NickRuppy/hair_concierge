"use client"

import { useAuth } from "@/providers/auth-provider"
import { useChat } from "@/hooks/use-chat"
import { useHairProfile } from "@/hooks/use-hair-profile"
import { generateSuggestedPrompts } from "@/lib/suggested-prompts"
import { ChatInput } from "./chat-input"
import { ChatMessage } from "./chat-message"
import { ChatLoadingIndicator } from "./chat-loading-indicator"
import { ProductDetailDrawer } from "./product-detail-drawer"
import { ConversationSidebar } from "./conversation-sidebar"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { Menu, Sparkles } from "lucide-react"
import type { Product } from "@/lib/types"

export function ChatContainer() {
  const { profile } = useAuth()
  const {
    messages,
    isStreaming,
    conversations,
    currentConversationId,
    sendMessage,
    loadConversation,
    loadConversations,
    deleteConversation,
    startNewConversation,
  } = useChat()

  const { hairProfile } = useHairProfile()
  const suggestedPrompts = useMemo(
    () => generateSuggestedPrompts(hairProfile),
    [hairProfile]
  )

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleProductClick = useCallback((product: Product) => {
    setDrawerProduct(product)
    setDrawerOpen(true)
  }, [])

  const firstName = profile?.full_name?.split(" ")[0] || null
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend"
  const greeting = firstName ? `${timeGreeting}, ${firstName}` : timeGreeting

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
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
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
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
              <h2 className="mb-2 text-2xl font-bold">{greeting}</h2>
              <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
                Frag mich alles rund ums Thema Haare — von Pflege-Tipps bis
                Produktempfehlungen!
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
              {messages.map((msg) => {
                // Don't render empty assistant placeholder — streaming indicator handles it
                if (msg.role === "assistant" && !msg.content) return null

                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    hairProfile={hairProfile}
                    onProductClick={handleProductClick}
                  />
                )
              })}

              {/* Streaming indicator */}
              {isStreaming &&
                messages[messages.length - 1]?.role === "assistant" &&
                !messages[messages.length - 1]?.content && (
                  <ChatLoadingIndicator />
                )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </div>

      {/* Product Detail Drawer */}
      <ProductDetailDrawer
        product={drawerProduct}
        hairProfile={hairProfile}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}
