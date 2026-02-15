"use client"

import type { Conversation } from "@/lib/types"
import { MessageCircle, Plus, Trash2, X } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale"

interface ConversationSidebarProps {
  conversations: Conversation[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onClose?: () => void
  isMobile?: boolean
}

export function ConversationSidebar({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  isMobile,
}: ConversationSidebarProps) {
  return (
    <div className="flex h-full flex-col border-r bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-sm font-semibold text-sidebar-foreground">
          Unterhaltungen
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            title="Neue Unterhaltung"
          >
            <Plus className="h-4 w-4" />
          </button>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Noch keine Unterhaltungen
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
                  currentId === conv.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
                onClick={() => {
                  onSelect(conv.id)
                  if (isMobile && onClose) onClose()
                }}
              >
                <MessageCircle className="h-4 w-4 shrink-0 opacity-60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {conv.title || "Neue Unterhaltung"}
                  </p>
                  <p className="text-xs opacity-60">
                    {format(new Date(conv.updated_at), "dd. MMM", {
                      locale: de,
                    })}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(conv.id)
                  }}
                  className="shrink-0 rounded p-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive md:p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
