"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/providers/toast-provider"
import { fehler } from "@/lib/vocabulary"
import { ArrowLeft } from "lucide-react"

interface MessageRow {
  id: string
  role: "user" | "assistant" | "system"
  content: string | null
  image_url: string | null
  created_at: string
}

interface ConversationDetail {
  conversation: {
    id: string
    title: string | null
    message_count: number
    created_at: string
    updated_at: string
  }
  messages: MessageRow[]
  user: {
    id: string
    full_name: string | null
    email: string
  } | null
}

export default function AdminConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(`/api/admin/conversations/${id}`)
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error || fehler("Laden"))
        }
        setData(await res.json())
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : fehler("Laden", "der Konversation")
        toast({ title: message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-muted-foreground">Konversation nicht gefunden.</p>
      </div>
    )
  }

  const { conversation, messages, user: chatUser } = data

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/conversations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurueck zu Chats
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {conversation.title || "Konversation"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {chatUser?.full_name || "Unbekannt"} ({chatUser?.email}) &middot;{" "}
              {messages.length} Nachrichten &middot;{" "}
              {new Date(conversation.created_at).toLocaleDateString("de-DE")}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4 rounded-xl border bg-card p-4">
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Keine Nachrichten vorhanden.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.role === "assistant"
                      ? "bg-muted"
                      : "bg-muted/50 text-xs italic"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium opacity-70">
                    {msg.role === "user" ? "Nutzer" : msg.role === "assistant" ? "TomBot" : "System"}
                  </span>
                  <span className="text-xs opacity-50">
                    {new Date(msg.created_at).toLocaleTimeString("de-DE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {msg.image_url && (
                  <div className="mb-2">
                    <span className="text-xs opacity-60">[Bild angehaengt]</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content || "—"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
