"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/providers/toast-provider"
import type { DailyQuote } from "@/lib/types"
import { fehler } from "@/lib/vocabulary"

interface QuoteForm {
  quote_text: string
  author: string
  display_date: string
  is_active: boolean
}

const emptyForm: QuoteForm = {
  quote_text: "",
  author: "",
  display_date: "",
  is_active: true,
}

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<DailyQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<QuoteForm>(emptyForm)
  const { toast } = useToast()

  async function loadQuotes() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/quotes")
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || fehler("Laden"))
      }
      const data = await res.json()
      setQuotes(data.quotes)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : fehler("Laden", "der Zitate")
      toast({ title: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function handleEdit(quote: DailyQuote) {
    setEditingId(quote.id)
    setForm({
      quote_text: quote.quote_text,
      author: quote.author || "",
      display_date: quote.display_date || "",
      is_active: quote.is_active,
    })
    setShowForm(true)
  }

  function handleCancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.quote_text.trim()) {
      toast({ title: "Zitat-Text ist erforderlich", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        quote_text: form.quote_text.trim(),
        author: form.author.trim() || null,
        display_date: form.display_date || null,
        is_active: form.is_active,
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/admin/quotes/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/admin/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || fehler("Speichern"))
      }

      toast({ title: editingId ? "Zitat aktualisiert" : "Zitat erstellt" })
      handleCancel()
      await loadQuotes()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : fehler("Speichern")
      toast({ title: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Dieses Zitat wirklich löschen?")) return

    try {
      const res = await fetch(`/api/admin/quotes/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || fehler("Löschen"))
      }
      toast({ title: "Zitat gelöscht" })
      await loadQuotes()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : fehler("Löschen")
      toast({ title: message, variant: "destructive" })
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zitate</h1>
        {!showForm && (
          <button
            onClick={handleNew}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Neues Zitat
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border bg-card p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Zitat bearbeiten" : "Neues Zitat erstellen"}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Zitat-Text *
              </label>
              <textarea
                value={form.quote_text}
                onChange={(e) => setForm({ ...form, quote_text: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Das Zitat eingeben..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Autor
                </label>
                <input
                  type="text"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Name des Autors"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Anzeigedatum
                </label>
                <input
                  type="date"
                  value={form.display_date}
                  onChange={(e) => setForm({ ...form, display_date: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-foreground">
                Aktiv
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Speichern..." : editingId ? "Aktualisieren" : "Erstellen"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">Noch keine Zitate vorhanden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Zitat</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Autor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Datum</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aktiv</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-foreground">
                    {quote.quote_text.length > 50
                      ? quote.quote_text.slice(0, 50) + "..."
                      : quote.quote_text}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {quote.author || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {quote.display_date
                      ? new Date(quote.display_date).toLocaleDateString("de-DE")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        quote.is_active
                          ? "bg-green-900/30 text-green-400"
                          : "bg-red-900/30 text-red-400"
                      }`}
                    >
                      {quote.is_active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(quote)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDelete(quote.id)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        Löschen
                      </button>
                    </div>
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
