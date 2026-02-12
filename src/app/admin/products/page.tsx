"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/providers/toast-provider"
import type { Product } from "@/lib/types"

const HAIR_TYPE_OPTIONS = ["glatt", "wellig", "lockig", "kraus"]

const CONCERN_OPTIONS = [
  "Haarausfall",
  "Schuppen",
  "Trockenheit",
  "Fettige Kopfhaut",
  "Haarschaeden",
  "Coloriert",
  "Spliss",
  "Frizz",
  "Duenner werdendes Haar",
]

interface ProductForm {
  name: string
  brand: string
  description: string
  category: string
  affiliate_link: string
  image_url: string
  price_eur: string
  tags: string
  suitable_hair_types: string[]
  suitable_concerns: string[]
  is_active: boolean
  sort_order: number
}

const emptyForm: ProductForm = {
  name: "",
  brand: "",
  description: "",
  category: "",
  affiliate_link: "",
  image_url: "",
  price_eur: "",
  tags: "",
  suitable_hair_types: [],
  suitable_concerns: [],
  is_active: true,
  sort_order: 0,
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const { toast } = useToast()

  async function loadProducts() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/products")
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler beim Laden")
      }
      const data = await res.json()
      setProducts(data.products)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden der Produkte"
      toast({ title: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function handleEdit(product: Product) {
    setEditingId(product.id)
    setForm({
      name: product.name,
      brand: product.brand || "",
      description: product.description || "",
      category: product.category || "",
      affiliate_link: product.affiliate_link || "",
      image_url: product.image_url || "",
      price_eur: product.price_eur != null ? String(product.price_eur) : "",
      tags: (product.tags || []).join(", "),
      suitable_hair_types: product.suitable_hair_types || [],
      suitable_concerns: product.suitable_concerns || [],
      is_active: product.is_active,
      sort_order: product.sort_order,
    })
    setShowForm(true)
  }

  function handleCancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function toggleChip(field: "suitable_hair_types" | "suitable_concerns", value: string) {
    setForm((prev) => {
      const current = prev[field]
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [field]: next }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ title: "Produktname ist erforderlich", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const tagsArray = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        affiliate_link: form.affiliate_link.trim() || null,
        image_url: form.image_url.trim() || null,
        price_eur: form.price_eur ? parseFloat(form.price_eur) : null,
        tags: tagsArray,
        suitable_hair_types: form.suitable_hair_types,
        suitable_concerns: form.suitable_concerns,
        is_active: form.is_active,
        sort_order: form.sort_order,
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/admin/products/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler beim Speichern")
      }

      toast({ title: editingId ? "Produkt aktualisiert" : "Produkt erstellt" })
      handleCancel()
      await loadProducts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Speichern"
      toast({ title: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Dieses Produkt wirklich löschen?")) return

    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler beim Löschen")
      }
      toast({ title: "Produkt gelöscht" })
      await loadProducts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Löschen"
      toast({ title: message, variant: "destructive" })
    }
  }

  function formatPrice(price: number | null): string {
    if (price == null) return "—"
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produkte</h1>
        {!showForm && (
          <button
            onClick={handleNew}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Neues Produkt
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border bg-card p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Produkt bearbeiten" : "Neues Produkt erstellen"}
          </h2>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Produktname"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Marke
                </label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Markenname"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Beschreibung
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Produktbeschreibung..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Kategorie
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="z.B. Shampoo, Conditioner"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Preis (EUR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price_eur}
                  onChange={(e) => setForm({ ...form, price_eur: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Sortierung
                </label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Affiliate-Link
                </label>
                <input
                  type="text"
                  value={form.affiliate_link}
                  onChange={(e) => setForm({ ...form, affiliate_link: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Bild-URL
                </label>
                <input
                  type="text"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Tags (kommagetrennt)
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="locken, feuchtigkeit, natuerlich"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Geeignete Haartypen
              </label>
              <div className="flex flex-wrap gap-2">
                {HAIR_TYPE_OPTIONS.map((type) => {
                  const selected = form.suitable_hair_types.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleChip("suitable_hair_types", type)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Geeignet bei Problemen
              </label>
              <div className="flex flex-wrap gap-2">
                {CONCERN_OPTIONS.map((concern) => {
                  const selected = form.suitable_concerns.includes(concern)
                  return (
                    <button
                      key={concern}
                      type="button"
                      onClick={() => toggleChip("suitable_concerns", concern)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {concern}
                    </button>
                  )
                })}
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
      ) : products.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">Noch keine Produkte vorhanden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Marke</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kategorie</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Preis</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aktiv</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {product.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {product.brand || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {product.category || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatPrice(product.price_eur)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.is_active
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {product.is_active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
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
