"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/providers/toast-provider"
import type { Product, ShampooBucketPair } from "@/lib/types"
import { HAIR_THICKNESS_OPTIONS } from "@/lib/types"
import { isBondbuilderCategory } from "@/lib/bondbuilder/constants"
import { fehler } from "@/lib/vocabulary"
import {
  CONDITIONER_WEIGHTS,
  CONDITIONER_REPAIR_LEVELS,
  isConditionerCategory,
} from "@/lib/conditioner/constants"
import { isDeepCleansingShampooCategory } from "@/lib/deep-cleansing-shampoo/constants"
import { isDryShampooCategory } from "@/lib/dry-shampoo/constants"
import {
  PRODUCT_BALANCE_TARGETS,
  PRODUCT_BALANCE_TARGET_LABELS,
  PRODUCT_BOND_APPLICATION_MODES,
  PRODUCT_BOND_APPLICATION_MODE_LABELS,
  PRODUCT_BOND_REPAIR_INTENSITIES,
  PRODUCT_BOND_REPAIR_INTENSITY_LABELS,
  PRODUCT_PEELING_TYPES,
  PRODUCT_PEELING_TYPE_LABELS,
  PRODUCT_SCALP_TYPE_FOCUSES,
  PRODUCT_SCALP_TYPE_FOCUS_LABELS,
} from "@/lib/product-specs/constants"
import { getAllowedProductConcernOptions } from "@/lib/product-specs/concern-taxonomy"
import {
  LEAVE_IN_WEIGHTS,
  LEAVE_IN_CONDITIONER_RELATIONSHIPS,
  LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS,
  LEAVE_IN_FIT_CARE_BENEFITS,
  LEAVE_IN_FIT_CARE_BENEFIT_LABELS,
  isLeaveInCategory,
} from "@/lib/leave-in/constants"
import { MASK_WEIGHTS, MASK_CONCENTRATIONS, isMaskCategory } from "@/lib/mask/constants"
import { OIL_SUBTYPE_OPTIONS, isOilCategory } from "@/lib/oil/constants"
import { isPeelingCategory } from "@/lib/peeling/constants"
import {
  SHAMPOO_BUCKET_LABELS,
  SHAMPOO_SOURCE_MANAGED_MESSAGE,
  isShampooCategory,
} from "@/lib/shampoo/constants"

interface LeaveInSpecForm {
  weight: string
  conditioner_relationship: string
  care_benefits: string[]
}

interface MaskSpecForm {
  weight: string
  concentration: string
  balance_direction: string
}

interface ConditionerSpecForm {
  weight: string
  repair_level: string
  balance_direction: string
}

interface BondbuilderSpecForm {
  bond_repair_intensity: string
  application_mode: string
}

interface DeepCleansingShampooSpecForm {
  scalp_type_focus: string
}

interface DryShampooSpecForm {
  scalp_type_focus: string
}

interface PeelingSpecForm {
  scalp_type_focus: string
  peeling_type: string
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
  shampoo_bucket_pairs: ShampooBucketPair[]
  is_active: boolean
  sort_order: number
  conditioner_specs: ConditionerSpecForm | null
  leave_in_specs: LeaveInSpecForm | null
  mask_specs: MaskSpecForm | null
  bondbuilder_specs: BondbuilderSpecForm | null
  deep_cleansing_shampoo_specs: DeepCleansingShampooSpecForm | null
  dry_shampoo_specs: DryShampooSpecForm | null
  peeling_specs: PeelingSpecForm | null
}

const emptyLeaveInSpecs: LeaveInSpecForm = {
  weight: "light",
  conditioner_relationship: "replacement_capable",
  care_benefits: [],
}

const emptyMaskSpecs: MaskSpecForm = {
  weight: "medium",
  concentration: "low",
  balance_direction: "",
}

const emptyConditionerSpecs: ConditionerSpecForm = {
  weight: "medium",
  repair_level: "medium",
  balance_direction: "",
}

const emptyBondbuilderSpecs: BondbuilderSpecForm = {
  bond_repair_intensity: "maintenance",
  application_mode: "pre_shampoo",
}

const emptyDeepCleansingShampooSpecs: DeepCleansingShampooSpecForm = {
  scalp_type_focus: "balanced",
}

const emptyDryShampooSpecs: DryShampooSpecForm = {
  scalp_type_focus: "balanced",
}

const emptyPeelingSpecs: PeelingSpecForm = {
  scalp_type_focus: "balanced",
  peeling_type: "acid_serum",
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
  shampoo_bucket_pairs: [],
  is_active: true,
  sort_order: 0,
  conditioner_specs: null,
  leave_in_specs: null,
  mask_specs: null,
  bondbuilder_specs: null,
  deep_cleansing_shampoo_specs: null,
  dry_shampoo_specs: null,
  peeling_specs: null,
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const { toast } = useToast()
  const editingProduct = editingId
    ? (products.find((product) => product.id === editingId) ?? null)
    : null
  const isSourceManagedShampoo = isShampooCategory(form.category)
  const isExistingSourceManagedShampoo = isShampooCategory(editingProduct?.category)
  const oilCategorySelected = isOilCategory(form.category)
  const concernOptions = oilCategorySelected
    ? OIL_SUBTYPE_OPTIONS
    : getAllowedProductConcernOptions(form.category)

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
          weight: product.leave_in_specs.weight,
          conditioner_relationship: product.leave_in_specs.conditioner_relationship,
          care_benefits: product.leave_in_specs.care_benefits || [],
        }
      : isLeaveInCategory(product.category || "")
        ? { ...emptyLeaveInSpecs }
        : null

    const maskSpecs = product.mask_specs
      ? {
          weight: product.mask_specs.weight,
          concentration: product.mask_specs.concentration,
          balance_direction: product.mask_specs.balance_direction ?? "",
        }
      : isMaskCategory(product.category || "")
        ? { ...emptyMaskSpecs }
        : null

    const conditionerSpecs = product.conditioner_specs
      ? {
          weight: product.conditioner_specs.weight,
          repair_level: product.conditioner_specs.repair_level,
          balance_direction: product.conditioner_specs.balance_direction ?? "",
        }
      : isConditionerCategory(product.category || "")
        ? { ...emptyConditionerSpecs }
        : null

    const bondbuilderSpecs = product.bondbuilder_specs
      ? {
          bond_repair_intensity: product.bondbuilder_specs.bond_repair_intensity,
          application_mode: product.bondbuilder_specs.application_mode,
        }
      : isBondbuilderCategory(product.category || "")
        ? { ...emptyBondbuilderSpecs }
        : null

    const deepCleansingShampooSpecs = product.deep_cleansing_shampoo_specs
      ? {
          scalp_type_focus: product.deep_cleansing_shampoo_specs.scalp_type_focus,
        }
      : isDeepCleansingShampooCategory(product.category || "")
        ? { ...emptyDeepCleansingShampooSpecs }
        : null

    const dryShampooSpecs = product.dry_shampoo_specs
      ? {
          scalp_type_focus: product.dry_shampoo_specs.scalp_type_focus,
        }
      : isDryShampooCategory(product.category || "")
        ? { ...emptyDryShampooSpecs }
        : null

    const peelingSpecs = product.peeling_specs
      ? {
          scalp_type_focus: product.peeling_specs.scalp_type_focus,
          peeling_type: product.peeling_specs.peeling_type,
        }
      : isPeelingCategory(product.category || "")
        ? { ...emptyPeelingSpecs }
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
      shampoo_bucket_pairs: product.shampoo_bucket_pairs || [],
      is_active: product.is_active,
      sort_order: product.sort_order,
      conditioner_specs: conditionerSpecs,
      leave_in_specs: leaveInSpecs,
      mask_specs: maskSpecs,
      bondbuilder_specs: bondbuilderSpecs,
      deep_cleansing_shampoo_specs: deepCleansingShampooSpecs,
      dry_shampoo_specs: dryShampooSpecs,
      peeling_specs: peelingSpecs,
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

  function toggleLeaveInCareBenefit(value: string) {
    setForm((prev) => {
      if (!prev.leave_in_specs) return prev
      const current = prev.leave_in_specs.care_benefits
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
      return {
        ...prev,
        leave_in_specs: {
          ...prev.leave_in_specs,
          care_benefits: next,
        },
      }
    })
  }

  function handleCategoryChange(value: string) {
    const conditioner = isConditionerCategory(value)
    const leaveIn = isLeaveInCategory(value)
    const mask = isMaskCategory(value)
    const bondbuilder = isBondbuilderCategory(value)
    const deepCleansingShampoo = isDeepCleansingShampooCategory(value)
    const dryShampoo = isDryShampooCategory(value)
    const peeling = isPeelingCategory(value)
    const oil = isOilCategory(value)
    const allowedConcernValues: Set<string> = new Set(
      (oil ? OIL_SUBTYPE_OPTIONS : getAllowedProductConcernOptions(value)).map(
        (option) => option.value,
      ),
    )
    setForm((prev) => ({
      ...prev,
      category: value,
      suitable_concerns: prev.suitable_concerns.filter((concern) =>
        allowedConcernValues.has(concern),
      ),
      conditioner_specs: conditioner
        ? (prev.conditioner_specs ?? { ...emptyConditionerSpecs })
        : null,
      leave_in_specs: leaveIn ? (prev.leave_in_specs ?? { ...emptyLeaveInSpecs }) : null,
      mask_specs: mask ? (prev.mask_specs ?? { ...emptyMaskSpecs }) : null,
      bondbuilder_specs: bondbuilder
        ? (prev.bondbuilder_specs ?? { ...emptyBondbuilderSpecs })
        : null,
      deep_cleansing_shampoo_specs: deepCleansingShampoo
        ? (prev.deep_cleansing_shampoo_specs ?? { ...emptyDeepCleansingShampooSpecs })
        : null,
      dry_shampoo_specs: dryShampoo
        ? (prev.dry_shampoo_specs ?? { ...emptyDryShampooSpecs })
        : null,
      peeling_specs: peeling ? (prev.peeling_specs ?? { ...emptyPeelingSpecs }) : null,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ title: "Produktname ist erforderlich", variant: "destructive" })
      return
    }

    if (isSourceManagedShampoo) {
      toast({ title: SHAMPOO_SOURCE_MANAGED_MESSAGE, variant: "destructive" })
      return
    }

    if (oilCategorySelected) {
      if (form.suitable_thicknesses.length === 0) {
        toast({
          title: "Mindestens eine Haardicke ist fuer Oele erforderlich",
          variant: "destructive",
        })
        return
      }
      if (form.suitable_concerns.length === 0) {
        toast({
          title: "Mindestens ein Oel-Typ ist fuer Oele erforderlich",
          variant: "destructive",
        })
        return
      }
    }

    setSaving(true)
    try {
      const tagsArray = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      const conditionerEnabled = isConditionerCategory(form.category)
      const leaveInEnabled = isLeaveInCategory(form.category)
      const maskEnabled = isMaskCategory(form.category)
      const bondbuilderEnabled = isBondbuilderCategory(form.category)
      const deepCleansingShampooEnabled = isDeepCleansingShampooCategory(form.category)
      const dryShampooEnabled = isDryShampooCategory(form.category)
      const peelingEnabled = isPeelingCategory(form.category)
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
      if (bondbuilderEnabled && !form.bondbuilder_specs) {
        toast({ title: "Bondbuilder-Spezifikation fehlt", variant: "destructive" })
        setSaving(false)
        return
      }
      if (deepCleansingShampooEnabled && !form.deep_cleansing_shampoo_specs) {
        toast({ title: "Tiefenreinigungs-Spezifikation fehlt", variant: "destructive" })
        setSaving(false)
        return
      }
      if (dryShampooEnabled && !form.dry_shampoo_specs) {
        toast({ title: "Trockenshampoo-Spezifikation fehlt", variant: "destructive" })
        setSaving(false)
        return
      }
      if (peelingEnabled && !form.peeling_specs) {
        toast({ title: "Peeling-Spezifikation fehlt", variant: "destructive" })
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
                balance_direction: form.conditioner_specs.balance_direction || null,
              }
            : null,
        leave_in_specs:
          leaveInEnabled && form.leave_in_specs
            ? {
                weight: form.leave_in_specs.weight,
                conditioner_relationship: form.leave_in_specs.conditioner_relationship,
                care_benefits: form.leave_in_specs.care_benefits,
              }
            : null,
        mask_specs:
          maskEnabled && form.mask_specs
            ? {
                weight: form.mask_specs.weight,
                concentration: form.mask_specs.concentration,
                balance_direction: form.mask_specs.balance_direction || null,
              }
            : null,
        bondbuilder_specs:
          bondbuilderEnabled && form.bondbuilder_specs
            ? {
                bond_repair_intensity: form.bondbuilder_specs.bond_repair_intensity,
                application_mode: form.bondbuilder_specs.application_mode,
              }
            : null,
        deep_cleansing_shampoo_specs:
          deepCleansingShampooEnabled && form.deep_cleansing_shampoo_specs
            ? {
                scalp_type_focus: form.deep_cleansing_shampoo_specs.scalp_type_focus,
              }
            : null,
        dry_shampoo_specs:
          dryShampooEnabled && form.dry_shampoo_specs
            ? {
                scalp_type_focus: form.dry_shampoo_specs.scalp_type_focus,
              }
            : null,
        peeling_specs:
          peelingEnabled && form.peeling_specs
            ? {
                scalp_type_focus: form.peeling_specs.scalp_type_focus,
                peeling_type: form.peeling_specs.peeling_type,
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
    const product = products.find((entry) => entry.id === id)
    if (product && isShampooCategory(product.category)) {
      toast({ title: SHAMPOO_SOURCE_MANAGED_MESSAGE, variant: "destructive" })
      return
    }

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

  function formatShampooPair(pair: ShampooBucketPair): string {
    const thicknessLabel =
      HAIR_THICKNESS_OPTIONS.find((option) => option.value === pair.thickness)?.label ??
      pair.thickness
    const bucketLabel = SHAMPOO_BUCKET_LABELS[pair.shampoo_bucket] ?? pair.shampoo_bucket
    return `${thicknessLabel}: ${bucketLabel}`
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
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Produkt bearbeiten" : "Neues Produkt erstellen"}
          </h2>

          {isSourceManagedShampoo && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Shampoo ist quellenverwaltet
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {SHAMPOO_SOURCE_MANAGED_MESSAGE} Bitte Quelldaten aktualisieren und den Ingest
                erneut laufen lassen.
              </p>
              {form.shampoo_bucket_pairs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.shampoo_bucket_pairs.map((pair) => (
                    <span
                      key={`${pair.thickness}-${pair.shampoo_bucket}`}
                      className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {formatShampooPair(pair)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <fieldset
            disabled={isExistingSourceManagedShampoo}
            className="space-y-4 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Produktname"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Marke</label>
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
              <label className="mb-1 block text-sm font-medium text-foreground">Beschreibung</label>
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
                <label className="mb-1 block text-sm font-medium text-foreground">Kategorie</label>
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
                <label className="mb-1 block text-sm font-medium text-foreground">Sortierung</label>
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
                <label className="mb-1 block text-sm font-medium text-foreground">Bild-URL</label>
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

            {!isSourceManagedShampoo && (
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {oilCategorySelected ? "Geeignete Haardicke *" : "Geeignete Haardicke"}
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
            )}

            {!isSourceManagedShampoo && (
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {oilCategorySelected ? "Geeigneter Oel-Typ *" : "Geeignet bei Problemen"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {concernOptions.map(({ value, label }) => {
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
            )}

            {isConditionerCategory(form.category) && form.conditioner_specs && (
              <div className="rounded-lg border border-input/70 bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Conditioner-Spezifikation
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Strukturierte Felder fuer deterministisches Conditioner-Reranking.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
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

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Balance-Richtung
                    </label>
                    <select
                      value={form.conditioner_specs.balance_direction}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          conditioner_specs: prev.conditioner_specs
                            ? {
                                ...prev.conditioner_specs,
                                balance_direction: e.target.value,
                              }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Noch nicht gepflegt</option>
                      {PRODUCT_BALANCE_TARGETS.map((value) => (
                        <option key={value} value={value}>
                          {PRODUCT_BALANCE_TARGET_LABELS[value]}
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
                    Kanonische Felder fuer das neue Leave-in-Fit der Recommendation Engine.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Conditioner-Beziehung
                    </label>
                    <select
                      value={form.leave_in_specs.conditioner_relationship}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          leave_in_specs: prev.leave_in_specs
                            ? {
                                ...prev.leave_in_specs,
                                conditioner_relationship: e.target.value,
                              }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {LEAVE_IN_CONDITIONER_RELATIONSHIPS.map((value) => (
                        <option key={value} value={value}>
                          {LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    Care-Benefits
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LEAVE_IN_FIT_CARE_BENEFITS.map((benefit) => (
                      <button
                        key={benefit}
                        type="button"
                        onClick={() => toggleLeaveInCareBenefit(benefit)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          form.leave_in_specs?.care_benefits.includes(benefit)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {LEAVE_IN_FIT_CARE_BENEFIT_LABELS[benefit]}
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
                    Nur die Felder, die die neue Recommendation Engine wirklich verwendet.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
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

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Balance-Richtung
                    </label>
                    <select
                      value={form.mask_specs.balance_direction}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          mask_specs: prev.mask_specs
                            ? {
                                ...prev.mask_specs,
                                balance_direction: e.target.value,
                              }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Noch nicht gepflegt</option>
                      {PRODUCT_BALANCE_TARGETS.map((value) => (
                        <option key={value} value={value}>
                          {PRODUCT_BALANCE_TARGET_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {isBondbuilderCategory(form.category) && form.bondbuilder_specs && (
              <div className="rounded-lg border border-input/70 bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Bondbuilder-Spezifikation
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Strukturierte Felder fuer Bondbuilder-Fit und spaeteres Engine-Ranking.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Repair-Intensitaet
                    </label>
                    <select
                      value={form.bondbuilder_specs.bond_repair_intensity}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          bondbuilder_specs: prev.bondbuilder_specs
                            ? {
                                ...prev.bondbuilder_specs,
                                bond_repair_intensity: e.target.value,
                              }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {PRODUCT_BOND_REPAIR_INTENSITIES.map((value) => (
                        <option key={value} value={value}>
                          {PRODUCT_BOND_REPAIR_INTENSITY_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Anwendungsmodus
                    </label>
                    <select
                      value={form.bondbuilder_specs.application_mode}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          bondbuilder_specs: prev.bondbuilder_specs
                            ? {
                                ...prev.bondbuilder_specs,
                                application_mode: e.target.value,
                              }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {PRODUCT_BOND_APPLICATION_MODES.map((value) => (
                        <option key={value} value={value}>
                          {PRODUCT_BOND_APPLICATION_MODE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {isDeepCleansingShampooCategory(form.category) && form.deep_cleansing_shampoo_specs && (
              <div className="rounded-lg border border-input/70 bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Tiefenreinigungs-Spezifikation
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Der fokussierte Kopfhaut-Typ fuer die Reset-/Clarifying-Route.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Kopfhaut-Fokus
                  </label>
                  <select
                    value={form.deep_cleansing_shampoo_specs.scalp_type_focus}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        deep_cleansing_shampoo_specs: prev.deep_cleansing_shampoo_specs
                          ? {
                              ...prev.deep_cleansing_shampoo_specs,
                              scalp_type_focus: e.target.value,
                            }
                          : null,
                      }))
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {PRODUCT_SCALP_TYPE_FOCUSES.map((value) => (
                      <option key={value} value={value}>
                        {PRODUCT_SCALP_TYPE_FOCUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {isDryShampooCategory(form.category) && form.dry_shampoo_specs && (
              <div className="rounded-lg border border-input/70 bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Trockenshampoo-Spezifikation
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Der passende Kopfhaut-Fokus fuer Between-Wash-Bridge-Produkte.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Kopfhaut-Fokus
                  </label>
                  <select
                    value={form.dry_shampoo_specs.scalp_type_focus}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        dry_shampoo_specs: prev.dry_shampoo_specs
                          ? {
                              ...prev.dry_shampoo_specs,
                              scalp_type_focus: e.target.value,
                            }
                          : null,
                      }))
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {PRODUCT_SCALP_TYPE_FOCUSES.filter((value) => value !== "dry").map((value) => (
                      <option key={value} value={value}>
                        {PRODUCT_SCALP_TYPE_FOCUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {isPeelingCategory(form.category) && form.peeling_specs && (
              <div className="rounded-lg border border-input/70 bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Peeling-Spezifikation</h3>
                  <p className="text-xs text-muted-foreground">
                    Strukturierte Felder fuer skalp-sensitives Peeling-Fit.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Kopfhaut-Fokus
                    </label>
                    <select
                      value={form.peeling_specs.scalp_type_focus}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          peeling_specs: prev.peeling_specs
                            ? {
                                ...prev.peeling_specs,
                                scalp_type_focus: e.target.value,
                              }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {PRODUCT_SCALP_TYPE_FOCUSES.map((value) => (
                        <option key={value} value={value}>
                          {PRODUCT_SCALP_TYPE_FOCUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Peeling-Typ
                    </label>
                    <select
                      value={form.peeling_specs.peeling_type}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          peeling_specs: prev.peeling_specs
                            ? {
                                ...prev.peeling_specs,
                                peeling_type: e.target.value,
                              }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {PRODUCT_PEELING_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {PRODUCT_PEELING_TYPE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>
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
          </fieldset>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving || isSourceManagedShampoo}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSourceManagedShampoo
                ? "Nur ueber Quelldaten"
                : saving
                  ? "Speichern..."
                  : editingId
                    ? "Aktualisieren"
                    : "Erstellen"}
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
                <tr
                  key={product.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{product.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{product.brand || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{product.category || "—"}</div>
                    {isShampooCategory(product.category) && (
                      <div className="mt-1 text-xs text-amber-600">Quellenverwaltet</div>
                    )}
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
                        {isShampooCategory(product.category) ? "Ansehen" : "Bearbeiten"}
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={isShampooCategory(product.category)}
                        title={
                          isShampooCategory(product.category)
                            ? SHAMPOO_SOURCE_MANAGED_MESSAGE
                            : undefined
                        }
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-900/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
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
