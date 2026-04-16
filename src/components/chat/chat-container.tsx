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
import { format, isToday, isYesterday } from "date-fns"
import { de } from "date-fns/locale"
import { Menu } from "lucide-react"
import { CombIcon } from "@/components/ui/comb-icon"
import { Icon } from "@/components/ui/icon"
import type { Product } from "@/lib/types"

export function ChatContainer() {
  const { profile } = useAuth()
  const {
    messages,
    isStreaming,
    conversations,
    currentConversationId,
    sendMessage,
    submitFeedback,
    loadConversation,
    loadConversations,
    deleteConversation,
    startNewConversation,
  } = useChat()

  const { hairProfile } = useHairProfile()
  const suggestedPrompts = useMemo(() => generateSuggestedPrompts(hairProfile), [hairProfile])

  const [sidebarState, setSidebarState] = useState<"closed" | "open" | "closing">("closed")
  const sidebarPanelRef = useRef<HTMLDivElement>(null)
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Track IDs of messages appended during this session (not from history loads).
  // Uses the "update state during render" pattern recommended by React for
  // derived state that depends on previous values.
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(() => new Set())
  const [prevMessageCount, setPrevMessageCount] = useState(0)
  const [prevConversationId, setPrevConversationId] = useState(currentConversationId)

  // Reset when conversation changes (update-during-render pattern)
  if (prevConversationId !== currentConversationId) {
    setNewMessageIds(new Set())
    setPrevMessageCount(0)
    setPrevConversationId(currentConversationId)
  }

  // Detect newly appended messages (update-during-render pattern)
  const currentCount = messages.length
  if (currentCount > prevMessageCount && prevMessageCount > 0) {
    const next = new Set(newMessageIds)
    for (let i = prevMessageCount; i < currentCount; i++) {
      next.add(messages[i].id)
    }
    setNewMessageIds(next)
    setPrevMessageCount(currentCount)
  } else if (currentCount !== prevMessageCount) {
    setPrevMessageCount(currentCount)
  }

  const hasNewMessages = currentCount > 0 && newMessageIds.size > 0

  // Clear newMessageIds after animation completes so streaming deltas don't get smooth-scroll
  useEffect(() => {
    if (newMessageIds.size > 0) {
      const timer = setTimeout(() => {
        setNewMessageIds(new Set())
      }, 400) // match fadeInUpFast duration (300ms) + buffer
      return () => clearTimeout(timer)
    }
  }, [newMessageIds])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Scroll behavior: smooth for appended messages, instant for history loads
  useEffect(() => {
    if (hasNewMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    } else if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" })
    }
  }, [messages, hasNewMessages])

  const triggerRef = useRef<HTMLElement | null>(null)

  const openSidebar = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement
    setSidebarState("open")
  }, [])
  const closeSidebar = useCallback(() => setSidebarState("closing"), [])

  // Focus trap + Escape for mobile sidebar
  useEffect(() => {
    if (sidebarState !== "open") return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSidebar()
        return
      }

      if (e.key !== "Tab") return
      const panel = sidebarPanelRef.current
      if (!panel) return

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [sidebarState, closeSidebar])

  // Move focus into sidebar on open, restore to trigger on close
  useEffect(() => {
    if (sidebarState === "open" && sidebarPanelRef.current) {
      const first = sidebarPanelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    }
    if (sidebarState === "closed" && triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [sidebarState])

  const handleProductClick = useCallback((product: Product) => {
    setDrawerProduct(product)
    setDrawerOpen(true)
  }, [])

  const firstName = profile?.full_name?.split(" ")[0] || null
  const hour = new Date().getHours()
  let timeGreeting = "Guten Abend"
  if (hour < 12) timeGreeting = "Guten Morgen"
  else if (hour < 18) timeGreeting = "Guten Tag"
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
      {sidebarState !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Unterhaltungen"
        >
          <div
            className={`absolute inset-0 bg-black/50 ${
              sidebarState === "closing"
                ? "animate-[backdropFadeOut_0.25s_ease_both]"
                : "animate-[backdropFadeIn_0.25s_ease_both]"
            }`}
            onClick={closeSidebar}
          />
          <div
            ref={sidebarPanelRef}
            className={`relative w-72 ${
              sidebarState === "closing" ? "animate-slide-out-left" : "animate-slide-in-left"
            }`}
            onAnimationEnd={() => {
              if (sidebarState === "closing") setSidebarState("closed")
            }}
          >
            <ConversationSidebar
              conversations={conversations}
              currentId={currentConversationId}
              onSelect={loadConversation}
              onNew={startNewConversation}
              onDelete={deleteConversation}
              onClose={closeSidebar}
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
            onClick={openSidebar}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
            aria-label="Unterhaltungen öffnen"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="type-body-sm font-medium">
            {currentConversationId ? "Chat" : "Neuer Chat"}
          </span>
        </div>

        {/* Messages */}
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
          {/* Atmospheric layers */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
              backgroundSize: "256px 256px",
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[120%] -translate-x-1/2"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(var(--brand-plum-rgb), 0.03), transparent 70%)",
            }}
          />

          {isEmpty ? (
            <div className="relative z-[1] flex h-full flex-col items-center justify-center px-4">
              <div className="animate-scale-in mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <CombIcon className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="animate-fade-in-up mb-2 type-h2" style={{ animationDelay: "150ms" }}>
                {greeting}
              </h2>
              <p
                className="animate-fade-in-up mb-8 max-w-md text-center type-body-sm text-muted-foreground"
                style={{ animationDelay: "250ms" }}
              >
                Frag mich nach deiner Routine, passenden Produkten oder dem nächsten sinnvollen
                Schritt für dein Haarprofil.
              </p>
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={prompt.text}
                    onClick={() => sendMessage(prompt.text)}
                    className="animate-fade-in-up flex items-start gap-2.5 rounded-xl border px-4 py-3 text-left type-body-sm transition-all duration-200 hover:border-primary/40 hover:bg-accent hover:shadow-sm hover:-translate-y-0.5"
                    style={{ animationDelay: `${350 + index * 80}ms` }}
                  >
                    {prompt.icon && (
                      <Icon name={prompt.icon} size={18} className="shrink-0 text-primary" />
                    )}
                    {prompt.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative z-[1] mx-auto max-w-3xl space-y-4 p-4">
              {messages.map((msg, idx) => {
                // Don't render empty assistant placeholder — streaming indicator handles it
                if (msg.role === "assistant" && !msg.content) return null

                // Date separator: show when date changes from previous message
                let dateSeparator: React.ReactNode = null
                if (msg.created_at) {
                  const msgDate = new Date(msg.created_at)
                  const prevMsg = idx > 0 ? messages[idx - 1] : null
                  const prevDate = prevMsg?.created_at ? new Date(prevMsg.created_at) : null
                  const dateChanged =
                    !prevDate || msgDate.toDateString() !== prevDate.toDateString()
                  if (dateChanged) {
                    let label = format(msgDate, "dd. MMM", { locale: de })
                    if (isToday(msgDate)) label = "Heute"
                    else if (isYesterday(msgDate)) label = "Gestern"
                    dateSeparator = (
                      <div className="flex items-center gap-3 py-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="type-caption text-muted-foreground">{label}</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )
                  }
                }

                return (
                  <div key={msg.id}>
                    {dateSeparator}
                    <ChatMessage
                      message={msg}
                      hairProfile={hairProfile}
                      onProductClick={handleProductClick}
                      onFeedback={submitFeedback}
                      isNew={newMessageIds.has(msg.id)}
                    />
                  </div>
                )
              })}

              {/* Streaming indicator */}
              {isStreaming &&
                messages[messages.length - 1]?.role === "assistant" &&
                !messages[messages.length - 1]?.content && <ChatLoadingIndicator />}

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
