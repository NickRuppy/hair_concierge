"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/providers/toast-provider"

interface ConversationRow {
  id: string
  user_id: string
  title: string | null
  message_count: number
  created_at: string
  updated_at: string
  user_name: string | null
  user_email: string
  last_message_preview: string | null
}

export default function AdminConversationsPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetch("/api/admin/conversations")
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Fehler beim Laden")
        }
        const data = await res.json()
        setConversations(data.conversations)
        setTotal(data.total)
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Fehler beim Laden der Chats"
        toast({ title: message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chats</h1>
        <span className="text-sm text-muted-foreground">
          {!loading && `${total} Konversationen insgesamt`}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">Noch keine Chats vorhanden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Nutzer
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Letzte Nachricht
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Nachrichten
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Erstellt
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Letzte Aktivitaet
                </th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conv) => (
                <tr
                  key={conv.id}
                  onClick={() => router.push(`/admin/conversations/${conv.id}`)}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {conv.user_name || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {conv.user_email}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {conv.last_message_preview || (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {conv.message_count}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(conv.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(conv.updated_at).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
