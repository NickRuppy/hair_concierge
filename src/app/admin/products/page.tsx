"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/providers/toast-provider"
import type { Product } from "@/lib/types"
import { HAIR_THICKNESS_OPTIONS, CONCERN_OPTIONS } from "@/lib/types"
import { fehler } from "@/lib/vocabulary"
import {
  CONDITIONER_WEIGHTS,
  CONDITIONER_REPAIR_LEVELS,
  isConditionerCategory,
} from "@/lib/conditioner/constants"
import {
  LEAVE_IN_FORMATS,
  LEAVE_IN_WEIGHTS,
  LEAVE_IN_ROLES,
  LEAVE_IN_CARE_BENEFITS,
  LEAVE_IN_INGREDIENT_FLAGS,
  LEAVE_IN_APPLICATION_STAGES,
  isLeaveInCategory,
} from "@/lib/leave-in/constants"
import {
  MASK_FORMATS,
  MASK_WEIGHTS,
  MASK_CONCENTRATIONS,
  MASK_BENEFITS,
  MASK_INGREDIENT_FLAGS,
  isMaskCategory,
} from "@/lib/mask/constants"

interface LeaveInSpecForm {
  format: string
  weight: string
  roles: string[]
  provides_heat_protection: boolean
  heat_protection_max_c: string
  heat_activation_required: boolean
  care_benefits: string[]
  ingredient_flags: string[]
  application_stage: string[]
}

interface MaskSpecForm {
  format: string
  weight: string
  concentration: string
  benefits: string[]
  ingredient_flags: string[]
  leave_on_minutes: string
}

interface ConditionerSpecForm {
  weight: string
  repair_level: string
}

interface ProductForm {
  name: string
  brand: string
  description: string
  category: string
  affiliate_link: string
  image_url: string
  price_eur: string
  tags: string
  suitable_thicknesses: string[]
  suitable_concerns: string[]
  is_active: boolean
  sort_order: number
  conditioner_specs: ConditionerSpecForm | null
  leave_in_specs: LeaveInSpecForm | null
  mask_specs: MaskSpecForm | null
}

const emptyLeaveInSpecs: LeaveInSpecForm = {
  format: "spray",
  weight: "light",
  roles: [],
  provides_heat_protection: false,
  heat_protection_max_c: "",
  heat_activation_required: false,
  care_benefits: [],
  ingredient_flags: [],
  application_stage: ["towel_dry"],
}

const emptyMaskSpecs: MaskSpecForm = {
  format: "lotion",
  weight: "medium",
  concentration: "low",
  benefits: [],
  ingredient_flags: [],
  leave_on_minutes: "10",
}

const emptyConditionerSpecs: ConditionerSpecForm = {
  weight: "medium",
  repair_level: "medium",
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
  suitable_thicknesses: [],
  suitable_concerns: [],
  is_active: true,
  sort_order: 0,
  conditioner_specs: null,
  leave_in_specs: null,
  mask_specs: null,
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
        throw new Error(data.error || fehler("Laden"))
      }
      const data = await res.json()
      setProducts(data.products)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : fehler("Laden", "der Produkte")
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
    setForm({ ...emptyForm })
    setShowForm(true)
  }

  function handleEdit(product: Product) {
    const leaveInSpecs = product.leave_in_specs
      ? {
          format: product.leave_in_specs.format,
          weight: product.leave_in_specs.weight,
          roles: product.leave_in_specs.roles || [],
          provides_heat_protection: product.leave_in_specs.provides_heat_protection,
          heat_protection_max_c:
            product.leave_in_specs.heat_protection_max_c != null
              ? String(product.leave_in_specs.heat_protection_max_c)
              : "",
          heat_activation_required: product.leave_in_specs.heat_activation_required,
          care_benefits: product.leave_in_specs.care_benefits || [],
          ingredient_flags: product.leave_in_specs.ingredient_flags || [],
          application_stage: product.leave_in_specs.application_stage || ["towel_dry"],
        }
      : isLeaveInCategory(product.category || "")
        ? { ...emptyLeaveInSpecs }
        : null

    const maskSpecs = product.mask_specs
      ? {
          format: product.mask_specs.format,
          weight: product.mask_specs.weight,
          concentration: product.mask_specs.concentration,
          benefits: product.mask_specs.benefits || [],
          ingredient_flags: product.mask_specs.ingredient_flags || [],
          leave_on_minutes: String(product.mask_specs.leave_on_minutes ?? 10),
        }
      : isMaskCategory(product.category || "")
        ? { ...emptyMaskSpecs }
        : null

    const conditionerSpecs = product.conditioner_specs
      ? {
          weight: product.conditioner_specs.weight,
          repair_level: product.conditioner_specs.repair_level,
        }
      : isConditionerCategory(product.category || "")
        ? { ...emptyConditionerSpecs }
        : null

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
      suitable_thicknesses: product.suitable_thicknesses || [],
      suitable_concerns: product.suitable_concerns || [],
      is_active: product.is_active,
      sort_order: product.sort_order,
      conditioner_specs: conditionerSpecs,
      leave_in_specs: leaveInSpecs,
      mask_specs: maskSpecs,
    })
    setShowForm(true)
  }

  function handleCancel() {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  function toggleChip(field: "suitable_thicknesses" | "suitable_concerns", value: string) {
    setForm((prev) => {
      const current = prev[field]
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [field]: next }
    })
  }

  function toggleLeaveInArrayField(
    field: "roles" | "care_benefits" | "ingredient_flags" | "application_stage",
    value: string
  ) {
    setForm((prev) => {
      if (!prev.leave_in_specs) return prev
      const current = prev.leave_in_specs[field]
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
      return {
        ...prev,
        leave_in_specs: {
          ...prev.leave_in_specs,
          [field]: next,
        },
      }
    })
  }

  function toggleMaskArrayField(
    field: "benefits" | "ingredient_flags",
    value: string
  ) {
    setForm((prev) => {
      if (!prev.mask_specs) return prev
      const current = prev.mask_specs[field]
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
      return {
        ...prev,
        mask_specs: {
          ...prev.mask_specs,
          [field]: next,
        },
      }
    })
  }

  function handleCategoryChange(value: string) {
    const conditioner = isConditionerCategory(value)
    const leaveIn = isLeaveInCategory(value)
    const mask = isMaskCategory(value)
    setForm((prev) => ({
      ...prev,
      category: value,
      conditioner_specs: conditioner ? prev.conditioner_specs ?? { ...emptyConditionerSpecs } : null,
      leave_in_specs: leaveIn ? prev.leave_in_specs ?? { ...emptyLeaveInSpecs } : null,
      mask_specs: mask ? prev.mask_specs ?? { ...emptyMaskSpecs } : null,
    }))
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

      const leaveInEnabled = isLeaveInCategory(form.category)
      const maskEnabled = isMaskCategory(form.category)
      const conditionerEnabled = isConditionerCategory(form.category)
      if (conditionerEnabled && !form.conditioner_specs) {
        toast({ title: "Conditioner-Spezifikation fehlt", variant: "destructive" })
        setSaving(false)
        return
      }
      if (leaveInEnabled && !form.leave_in_specs) {
        toast({ title: "Leave-in-Spezifikation fehlt", variant: "destructive" })
        setSaving(false)
        return
      }
      if (maskEnabled && !form.mask_specs) {
        toast({ title: "Masken-Spezifikation fehlt", variant: "destructive" })
        setSaving(false)
        return
      }

      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        affiliate_link: form.affiliate_link.trim() || null,
        image_url: form.image_url.trim() || null,
        price_eur: form.price_eur ? parseFloat(form.price_eur) : null,
        tags: tagsArray,
        suitable_thicknesses: form.suitable_thicknesses,
        suitable_concerns: form.suitable_concerns,
        is_active: form.is_active,
        sort_order: form.sort_order,
        conditioner_specs:
          conditionerEnabled && form.conditioner_specs
            ? {
                weight: form.conditioner_specs.weight,
                repair_level: form.conditioner_specs.repair_level,
              }
            : null,
        leave_in_specs:
          leaveInEnabled && form.leave_in_specs
            ? {
                format: form.leave_in_specs.format,
                weight: form.leave_in_specs.weight,
                roles: form.leave_in_specs.roles,
                provides_heat_protection: form.leave_in_specs.provides_heat_protection,
                heat_protection_max_c: form.leave_in_specs.heat_protection_max_c
                  ? parseInt(form.leave_in_specs.heat_protection_max_c, 10)
                  : null,
                heat_activation_required: form.leave_in_specs.heat_activation_required,
                care_benefits: form.leave_in_specs.care_benefits,
                ingredient_flags: form.leave_in_specs.ingredient_flags,
                application_stage: form.leave_in_specs.application_stage,
              }
            : null,
        mask_specs:
          maskEnabled && form.mask_specs
            ? {
                format: form.mask_specs.format,
                weight: form.mask_specs.weight,
                concentration: form.mask_specs.concentration,
                benefits: form.mask_specs.benefits,
                ingredient_flags: form.mask_specs.ingredient_flags,
                leave_on_minutes: form.mask_specs.leave_on_minutes
                  ? parseInt(form.mask_specs.leave_on_minutes, 10)
                  : 10,
              }
            : null,
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
        throw new Error(data.error || fehler("Speichern"))
      }

      toast({ title: editingId ? "Produkt aktualisiert" : "Produkt erstellt" })
      handleCancel()
      await loadProducts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : fehler("Speichern")
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
        throw new Error(data.error || fehler("Löschen"))
      }
      toast({ title: "Produkt gelöscht" })
      await loadProducts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : fehler("Löschen")
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
                  onChange={(e) => handleCategoryChange(e.target.value)}
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
                Geeignete Haardicke
              </label>
              <div className="flex flex-wrap gap-2">
                {HAIR_THICKNESS_OPTIONS.map(({ value, label }) => {
                  const selected = form.suitable_thicknesses.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleChip("suitable_thicknesses", value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {label}
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
                {CONCERN_OPTIONS.map(({ value, label }) => {
                  const selected = form.suitable_concerns.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleChip("suitable_concerns", value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {isConditionerCategory(form.category) && form.conditioner_specs && (
              <div className="rounded-lg border border-input/70 bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Conditioner-Spezifikation</h3>
                  <p className="text-xs text-muted-foreground">
                    Strukturierte Felder fuer deterministisches Conditioner-Reranking.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Gewicht
                    </label>
                    <select
                      value={form.conditioner_specs.weight}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          conditioner_specs: prev.conditioner_specs
                            ? { ...prev.conditioner_specs, weight: e.target.value }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CONDITIONER_WEIGHTS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Repair-Level
                    </label>
                    <select
                      value={form.conditioner_specs.repair_level}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          conditioner_specs: prev.conditioner_specs
                            ? { ...prev.conditioner_specs, repair_level: e.target.value }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CONDITIONER_REPAIR_LEVELS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {isLeaveInCategory(form.category) && form.leave_in_specs && (
              <div className="rounded-lg border border-input/70 bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Leave-in Spezifikation</h3>
                  <p className="text-xs text-muted-foreground">
                    Strukturierte Felder fuer deterministisches Leave-in-Reranking.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Format
                    </label>
                    <select
                      value={form.leave_in_specs.format}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          leave_in_specs: prev.leave_in_specs
                            ? { ...prev.leave_in_specs, format: e.target.value }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {LEAVE_IN_FORMATS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Gewicht
                    </label>
                    <select
                      value={form.leave_in_specs.weight}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          leave_in_specs: prev.leave_in_specs
                            ? { ...prev.leave_in_specs, weight: e.target.value }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {LEAVE_IN_WEIGHTS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Rollen
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LEAVE_IN_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleLeaveInArrayField("roles", role)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          form.leave_in_specs?.roles.includes(role)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="provides_heat_protection"
                      checked={form.leave_in_specs.provides_heat_protection}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          leave_in_specs: prev.leave_in_specs
                            ? {
                                ...prev.leave_in_specs,
                                provides_heat_protection: e.target.checked,
                                heat_protection_max_c: e.target.checked
                                  ? prev.leave_in_specs.heat_protection_max_c
                                  : "",
                              }
                            : null,
                        }))
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    <label htmlFor="provides_heat_protection" className="text-xs font-medium text-foreground">
                      Bietet Hitzeschutz
                    </label>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Hitzeschutz bis (C)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.leave_in_specs.heat_protection_max_c}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          leave_in_specs: prev.leave_in_specs
                            ? {
                                ...prev.leave_in_specs,
                                heat_protection_max_c: e.target.value,
                              }
                            : null,
                        }))
                      }
                      disabled={!form.leave_in_specs.provides_heat_protection}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="heat_activation_required"
                    checked={form.leave_in_specs.heat_activation_required}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        leave_in_specs: prev.leave_in_specs
                          ? {
                              ...prev.leave_in_specs,
                              heat_activation_required: e.target.checked,
                              roles: e.target.checked
                                ? prev.leave_in_specs.roles.includes("styling_prep")
                                  ? prev.leave_in_specs.roles
                                  : [...prev.leave_in_specs.roles, "styling_prep"]
                                : prev.leave_in_specs.roles,
                            }
                          : null,
                      }))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  <label htmlFor="heat_activation_required" className="text-xs font-medium text-foreground">
                    Hitzeaktivierung erforderlich
                  </label>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Care Benefits
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LEAVE_IN_CARE_BENEFITS.map((benefit) => (
                      <button
                        key={benefit}
                        type="button"
                        onClick={() => toggleLeaveInArrayField("care_benefits", benefit)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          form.leave_in_specs?.care_benefits.includes(benefit)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {benefit}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Ingredient Flags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LEAVE_IN_INGREDIENT_FLAGS.map((flag) => (
                      <button
                        key={flag}
                        type="button"
                        onClick={() => toggleLeaveInArrayField("ingredient_flags", flag)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          form.leave_in_specs?.ingredient_flags.includes(flag)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {flag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Anwendungsschritte
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LEAVE_IN_APPLICATION_STAGES.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => toggleLeaveInArrayField("application_stage", stage)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          form.leave_in_specs?.application_stage.includes(stage)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isMaskCategory(form.category) && form.mask_specs && (
              <div className="rounded-lg border border-input/70 bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Masken-Spezifikation</h3>
                  <p className="text-xs text-muted-foreground">
                    Strukturierte Felder fuer deterministisches Masken-Reranking.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Format
                    </label>
                    <select
                      value={form.mask_specs.format}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          mask_specs: prev.mask_specs
                            ? { ...prev.mask_specs, format: e.target.value }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {MASK_FORMATS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Gewicht
                    </label>
                    <select
                      value={form.mask_specs.weight}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          mask_specs: prev.mask_specs
                            ? { ...prev.mask_specs, weight: e.target.value }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {MASK_WEIGHTS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Konzentration
                    </label>
                    <select
                      value={form.mask_specs.concentration}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          mask_specs: prev.mask_specs
                            ? { ...prev.mask_specs, concentration: e.target.value }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {MASK_CONCENTRATIONS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Benefits
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MASK_BENEFITS.map((benefit) => (
                      <button
                        key={benefit}
                        type="button"
                        onClick={() => toggleMaskArrayField("benefits", benefit)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          form.mask_specs?.benefits.includes(benefit)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {benefit}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Ingredient Flags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MASK_INGREDIENT_FLAGS.map((flag) => (
                      <button
                        key={flag}
                        type="button"
                        onClick={() => toggleMaskArrayField("ingredient_flags", flag)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          form.mask_specs?.ingredient_flags.includes(flag)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {flag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Einwirkzeit (Minuten)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={form.mask_specs.leave_on_minutes}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        mask_specs: prev.mask_specs
                          ? { ...prev.mask_specs, leave_on_minutes: e.target.value }
                          : null,
                      }))
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}

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
                          ? "bg-green-900/30 text-green-400"
                          : "bg-red-900/30 text-red-400"
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
