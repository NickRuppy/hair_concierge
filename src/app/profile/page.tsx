"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ManageSubscriptionButton } from "@/components/profile/manage-subscription-button"
import { formatBillingDate, formatBillingMembershipStatus } from "@/lib/billing/display"
import { findVisibleBillingSubscriptionForUser } from "@/lib/billing/subscriptions"
import type { BillingSubscriptionRow } from "@/lib/billing/types"
import { PRODUCT_CATEGORY_LABELS, PRODUCT_CATEGORY_ORDER } from "@/lib/onboarding/product-options"
import type { OnboardingStep } from "@/lib/onboarding/store"
import {
  PROFILE_FIELD_CONFIG,
  PROFILE_SECTION_META,
  type ProfileEditTarget,
  type ProfileFieldConfig,
  type ProfileFieldValue,
  type ProfileJourneySectionKey,
} from "@/lib/profile/section-config"
import {
  getHairCheckEditHref,
  isHairCheckEditField,
  type HairCheckEditField,
} from "@/lib/profile/hair-check-edit-config"
import { createClient } from "@/lib/supabase/client"
import type { HairProfile, UserMemoryEntry } from "@/lib/types"
import { PRODUCT_FREQUENCY_LABELS, type ProductFrequency, fehler } from "@/lib/vocabulary"
import { cn } from "@/lib/utils"
import { useAuth } from "@/providers/auth-provider"
import { useToast } from "@/providers/toast-provider"

type MemoryApiResponse = {
  settings: { memory_enabled: boolean }
  entries: UserMemoryEntry[]
}

type UserProductUsageRow = {
  id: string
  category: string
  product_name: string | null
  frequency_range: ProductFrequency | null
}

type StructuredField = ProfileFieldConfig & { value: ProfileFieldValue }

type JourneyField = {
  key: string
  label: string
  value: ProfileFieldValue
  editTarget: ProfileEditTarget | null
}

type ProductDetailRow = {
  key: string
  category: string
  categoryLabel: string
  productName: string | null
  frequencyLabel: string | null
  isComplete: boolean
}

type SectionPreview = {
  title: string
  text: string
}

type ProfileSectionSummary = {
  key: ProfileJourneySectionKey
  title: string
  status: string
  isComplete: boolean
  preview?: SectionPreview
}

const SECTION_META_BY_KEY = Object.fromEntries(
  PROFILE_SECTION_META.map((meta) => [meta.key, meta]),
) as Record<ProfileJourneySectionKey, (typeof PROFILE_SECTION_META)[number]>

const PRODUCT_ORDER_INDEX = new Map(
  PRODUCT_CATEGORY_ORDER.map((category, index) => [category, index]),
)

function buildOnboardingHref(
  step: OnboardingStep,
  options?: { category?: string | null; singleStep?: boolean },
) {
  const params = new URLSearchParams({
    step,
    returnTo: "/profile",
  })

  if (options?.category) {
    params.set("category", options.category)
  }

  if (options?.singleStep) {
    params.set("editMode", "single-step")
  }

  return `/onboarding?${params.toString()}`
}

function formatNullableDate(value: string | null | undefined): string {
  return formatBillingDate(value)
}

function createProductRows(rows: UserProductUsageRow[]): ProductDetailRow[] {
  return [...rows]
    .sort((left, right) => {
      const leftIndex = PRODUCT_ORDER_INDEX.get(left.category) ?? Number.MAX_SAFE_INTEGER
      const rightIndex = PRODUCT_ORDER_INDEX.get(right.category) ?? Number.MAX_SAFE_INTEGER
      return leftIndex - rightIndex
    })
    .map((row) => {
      const productName = row.product_name?.trim() || null
      const frequencyLabel = row.frequency_range
        ? PRODUCT_FREQUENCY_LABELS[row.frequency_range]
        : null

      return {
        key: row.id,
        category: row.category,
        categoryLabel: PRODUCT_CATEGORY_LABELS[row.category] ?? row.category,
        productName,
        frequencyLabel,
        isComplete: Boolean(productName && frequencyLabel),
      }
    })
}

function getCompletionLabel(filled: number, total: number) {
  if (total === 0 || filled === 0) return "Offen"
  return `${filled}/${total} vollständig`
}

function getProductCompletionLabel(rows: ProductDetailRow[], onboardingCompleted: boolean) {
  if (rows.length === 0) {
    return onboardingCompleted ? "Noch leer" : "Offen"
  }

  const completeCount = rows.filter((row) => row.isComplete).length
  return `${completeCount}/${rows.length} vollständig`
}

function getOpenItemsTitle(count: number, singular: string, plural: string) {
  const label = count === 1 ? singular : plural
  return `Noch ${count} ${label} offen`
}

function SectionStatusBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="border-primary/15 bg-primary/[0.05] px-3 py-1 text-xs font-medium text-primary"
    >
      {label}
    </Badge>
  )
}

function SectionHeader({
  title,
  description,
  status,
  controls,
  isOpen = true,
  preview,
  size = "lg",
}: {
  title: string
  description: string
  status: string
  controls?: ReactNode
  isOpen?: boolean
  preview?: SectionPreview
  size?: "lg" | "sm"
}) {
  const titleClass =
    size === "sm"
      ? "font-[family-name:var(--font-display)] text-xl font-medium leading-tight text-[var(--text-heading)]"
      : "font-[family-name:var(--font-display)] text-2xl font-medium leading-tight text-[var(--text-heading)]"

  return (
    <div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className={titleClass}>{title}</h2>
            <SectionStatusBadge label={status} />
          </div>
          <CardDescription className="mt-2 max-w-2xl text-sm">{description}</CardDescription>
        </div>
        {controls ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}
      </div>

      {!isOpen && preview ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/35 p-4">
          <p className="text-sm font-semibold text-[var(--text-heading)]">{preview.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{preview.text}</p>
        </div>
      ) : null}
    </div>
  )
}

function SectionGridSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border/70 bg-card/70 p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-3 w-48" />
          <Skeleton className="mt-5 h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

function ProfileFieldCard({
  field,
  children,
  onClick,
  className,
  tone = "default",
}: {
  field: JourneyField
  children?: ReactNode
  onClick?: () => void
  className?: string
  tone?: "default" | "attention"
}) {
  const interactive = Boolean(onClick)

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        "rounded-[22px] border border-primary/10 bg-[hsl(var(--background))]/70 p-5 transition-colors",
        interactive
          ? "cursor-pointer hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          : "",
        tone === "attention" ? "border-[var(--brand-coral)]/35 bg-[var(--brand-coral-light)]" : "",
        className,
      )}
    >
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {field.label}
      </p>
      {children ?? <ProfileFieldValue value={field.value} />}
    </div>
  )
}

function ProfileFieldValue({
  value,
  emptyLabel = "Noch offen",
}: {
  value: ProfileFieldValue
  emptyLabel?: string
}) {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return (
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="outline"
          className="rounded-full border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground"
        >
          {emptyLabel}
        </Badge>
      </div>
    )
  }

  const items = Array.isArray(value) ? value : [value]

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={item}
          variant="outline"
          className="rounded-full border-primary/20 bg-background px-3 py-1 text-xs font-semibold text-[var(--text-heading)]"
        >
          {item}
        </Badge>
      ))}
    </div>
  )
}

function InlinePromptCard({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
      <p className="text-sm font-semibold text-[var(--text-heading)]">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])
  const userId = user?.id ?? null

  const [hairProfile, setHairProfile] = useState<HairProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [productUsage, setProductUsage] = useState<UserProductUsageRow[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [openSections, setOpenSections] = useState<ProfileJourneySectionKey[]>(["memory"])
  const [memoryEntries, setMemoryEntries] = useState<UserMemoryEntry[]>([])
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [memoryLoading, setMemoryLoading] = useState(true)
  const [memorySaving, setMemorySaving] = useState(false)
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [memoryDraft, setMemoryDraft] = useState("")
  const [billingSubscription, setBillingSubscription] = useState<BillingSubscriptionRow | null>(
    null,
  )

  useEffect(() => {
    let active = true

    async function loadHairProfile() {
      if (!userId) {
        if (active) {
          setHairProfile(null)
          setProfileLoading(false)
        }
        return
      }

      setProfileLoading(true)

      try {
        const { data, error } = await supabase
          .from("hair_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle()

        if (error) throw error
        if (!active) return

        setHairProfile(data ?? null)
      } catch (error) {
        console.error("Error loading hair profile:", error)
        if (active) {
          setHairProfile(null)
        }
      } finally {
        if (active) {
          setProfileLoading(false)
        }
      }
    }

    loadHairProfile()

    return () => {
      active = false
    }
  }, [supabase, userId])

  useEffect(() => {
    let active = true

    async function loadBillingSubscription() {
      if (!userId) {
        if (active) setBillingSubscription(null)
        return
      }

      try {
        const row = await findVisibleBillingSubscriptionForUser(supabase, userId)
        if (active) setBillingSubscription(row)
      } catch (error) {
        console.error("Error loading billing subscription:", error)
        if (active) setBillingSubscription(null)
      }
    }

    loadBillingSubscription()

    return () => {
      active = false
    }
  }, [supabase, userId])

  useEffect(() => {
    let active = true

    async function loadProductUsage() {
      if (!userId) {
        if (active) {
          setProductUsage([])
          setProductsLoading(false)
        }
        return
      }

      setProductsLoading(true)

      try {
        const { data, error } = await supabase
          .from("user_product_usage")
          .select("id, category, product_name, frequency_range")
          .eq("user_id", userId)

        if (error) throw error
        if (!active) return

        setProductUsage((data as UserProductUsageRow[] | null) ?? [])
      } catch (error) {
        console.error("Error loading product usage:", error)
        if (active) {
          setProductUsage([])
        }
      } finally {
        if (active) {
          setProductsLoading(false)
        }
      }
    }

    loadProductUsage()

    return () => {
      active = false
    }
  }, [supabase, userId])

  useEffect(() => {
    let active = true

    async function loadMemory() {
      if (!userId) {
        if (active) {
          setMemoryEntries([])
          setMemoryLoading(false)
        }
        return
      }

      setMemoryLoading(true)

      try {
        const response = await fetch("/api/memory")
        if (!response.ok) throw new Error("Memory konnte nicht geladen werden")

        const data = (await response.json()) as MemoryApiResponse
        if (!active) return

        setMemoryEnabled(data.settings.memory_enabled)
        setMemoryEntries(data.entries ?? [])
      } catch (error) {
        console.error("Error loading memory:", error)
      } finally {
        if (active) {
          setMemoryLoading(false)
        }
      }
    }

    loadMemory()

    return () => {
      active = false
    }
  }, [userId])

  const structuredFields = useMemo<StructuredField[]>(
    () =>
      PROFILE_FIELD_CONFIG.map((field) => ({
        ...field,
        value: field.getValue(hairProfile),
      })),
    [hairProfile],
  )

  const quizFields = structuredFields.filter((field) => field.sectionKey === "quiz")
  const stylingFields = structuredFields.filter((field) => field.sectionKey === "styling")
  const routineFields = structuredFields.filter((field) => field.sectionKey === "routine")
  const goalsFields = structuredFields.filter((field) => field.sectionKey === "goals")
  const goalsField = goalsFields[0] ?? null
  const productRows = useMemo(() => createProductRows(productUsage), [productUsage])

  const quizFilled = quizFields.filter((field) => field.value !== null)
  const stylingFilled = stylingFields.filter((field) => field.value !== null)
  const routineFilled = routineFields.filter((field) => field.value !== null)
  const goalsFilled = goalsFields.filter((field) => field.value !== null)
  const selectedProductCategories = productRows.map((row) => row.categoryLabel)
  const incompleteProductRows = productRows.filter((row) => !row.isComplete)

  const quizStatus = profileLoading
    ? "Wird geladen"
    : getCompletionLabel(quizFilled.length, quizFields.length)
  const productsStatus = productsLoading
    ? "Wird geladen"
    : getProductCompletionLabel(productRows, Boolean(profile?.onboarding_completed))
  const stylingStatus = profileLoading
    ? "Wird geladen"
    : getCompletionLabel(stylingFilled.length, stylingFields.length)
  const routineStatus = profileLoading
    ? "Wird geladen"
    : getCompletionLabel(routineFilled.length, routineFields.length)
  const goalsStatus = profileLoading
    ? "Wird geladen"
    : getCompletionLabel(goalsFilled.length, goalsFields.length)
  const memoryStatus = memoryLoading ? "Wird geladen" : memoryEnabled ? "Aktiv" : "Pausiert"

  const memoryEntryLabel = memoryEntries.length === 1 ? "Erinnerung" : "Erinnerungen"
  const memorySectionSummary: ProfileSectionSummary = {
    key: "memory",
    title: SECTION_META_BY_KEY.memory.title,
    status: memoryStatus,
    isComplete: true,
    preview: memoryLoading
      ? {
          title: "Erinnerungen werden geladen",
          text: "Gleich siehst du, welche langfristigen Hinweise derzeit gespeichert sind.",
        }
      : !memoryEnabled
        ? {
            title: "Erinnerungen pausiert",
            text: "Aktiviere die Erinnerungen wieder, wenn langfristige Hinweise aus dem Chat gespeichert werden sollen.",
          }
        : memoryEntries.length === 0
          ? {
              title: "Noch keine gespeicherten Erinnerungen",
              text: "Wenn du im Chat konkrete Haarpflege-Infos gibst, können sie hier als langfristiger Kontext auftauchen.",
            }
          : {
              title: `${memoryEntries.length} ${memoryEntryLabel} gespeichert`,
              text: "Hier kannst du prüfen, bearbeiten oder löschen, was ich aus unseren Gesprächen behalten darf.",
            },
  }

  useEffect(() => {
    if (!editingMemoryId) return

    setOpenSections((current) => (current.includes("memory") ? current : [...current, "memory"]))
  }, [editingMemoryId])

  function ensureSectionOpen(sectionKey: ProfileJourneySectionKey) {
    setOpenSections((current) =>
      current.includes(sectionKey) ? current : [...current, sectionKey],
    )
  }

  function toggleSection(sectionKey: ProfileJourneySectionKey) {
    setOpenSections((current) => {
      if (current.includes(sectionKey)) {
        return current.filter((key) => key !== sectionKey)
      }

      return [...current, sectionKey]
    })
  }

  function goToSectionStep(_sectionKey: ProfileJourneySectionKey, href: string) {
    router.push(href)
  }

  function resolveQuizEditField(fieldKey: string | undefined): HairCheckEditField | null {
    const candidate =
      fieldKey === "scalp_type" || fieldKey === "scalp_condition" ? "scalp" : fieldKey
    return isHairCheckEditField(candidate) ? candidate : null
  }

  function openTarget(
    sectionKey: ProfileJourneySectionKey,
    target: ProfileEditTarget | null,
    fieldKey?: string,
  ) {
    if (!target) return

    if (target.kind === "quiz") {
      const editField = resolveQuizEditField(fieldKey)
      if (editField) {
        goToSectionStep("quiz", getHairCheckEditHref(editField))
      }
      return
    }

    if (target.kind === "profile-edit-goals") {
      goToSectionStep("goals", "/profile/edit/goals")
      return
    }

    goToSectionStep(sectionKey, buildOnboardingHref(target.step, { singleStep: true }))
  }

  async function handleMemoryToggle(checked: boolean) {
    ensureSectionOpen("memory")
    setMemoryEnabled(checked)
    setMemorySaving(true)

    try {
      const response = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory_enabled: checked }),
      })

      if (!response.ok) throw new Error("Memory setting failed")
      toast({ title: checked ? "Erinnerungen aktiviert" : "Erinnerungen pausiert" })
    } catch (error) {
      console.error("Error saving memory setting:", error)
      setMemoryEnabled(!checked)
      toast({ title: fehler("Speichern"), variant: "destructive" })
    } finally {
      setMemorySaving(false)
    }
  }

  function startEditingMemory(entry: UserMemoryEntry) {
    ensureSectionOpen("memory")
    setEditingMemoryId(entry.id)
    setMemoryDraft(entry.content)
  }

  async function handleSaveMemory(memoryId: string) {
    const content = memoryDraft.trim()
    if (!content) return

    setMemorySaving(true)

    try {
      const response = await fetch(`/api/memory/${memoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) throw new Error("Memory update failed")

      const data = (await response.json()) as { memory: UserMemoryEntry }
      setMemoryEntries((entries) =>
        entries.map((entry) => (entry.id === memoryId ? data.memory : entry)),
      )
      setEditingMemoryId(null)
      setMemoryDraft("")
      toast({ title: "Erinnerung gespeichert" })
    } catch (error) {
      console.error("Error saving memory:", error)
      toast({ title: fehler("Speichern"), variant: "destructive" })
    } finally {
      setMemorySaving(false)
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    setMemorySaving(true)

    try {
      const response = await fetch(`/api/memory/${memoryId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Memory delete failed")

      setMemoryEntries((entries) => entries.filter((entry) => entry.id !== memoryId))
      if (editingMemoryId === memoryId) {
        setEditingMemoryId(null)
        setMemoryDraft("")
      }

      toast({ title: "Erinnerung gelöscht" })
    } catch (error) {
      console.error("Error deleting memory:", error)
      toast({ title: fehler("Löschen"), variant: "destructive" })
    } finally {
      setMemorySaving(false)
    }
  }

  const isMemoryOpen = openSections.includes("memory")

  if (authLoading) {
    return (
      <>
        <Header />
        <div className="profile-page">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="profile-page">
        <main className="mx-auto max-w-5xl px-4 py-8">
          <div className="mb-10">
            <p className="type-overline text-primary">Profilübersicht</p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium leading-[0.96] tracking-tight text-[var(--text-heading)] sm:text-5xl">
              Mein Profil
            </h1>
          </div>

          <div className="space-y-6">
            <Card
              id="profile-section-quiz"
              className="scroll-mt-24 overflow-hidden border-primary/20 transition-colors"
            >
              <CardHeader className="pb-4">
                <SectionHeader
                  title={SECTION_META_BY_KEY.quiz.title}
                  description="Deine Antworten aus dem Haar-Check. Tippe eine Karte an, um die passende Frage erneut im Bearbeitungsmodus zu öffnen."
                  status={quizStatus}
                  isOpen
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {profileLoading ? (
                  <SectionGridSkeleton count={6} className="md:grid-cols-2 xl:grid-cols-3" />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {quizFields.map((field) => {
                      const isMissing = field.value == null
                      return (
                        <ProfileFieldCard
                          key={field.key}
                          field={field}
                          onClick={() => openTarget("quiz", field.editTarget, field.key)}
                          tone={isMissing ? "attention" : "default"}
                          className={isMissing ? "md:col-span-2 xl:col-span-3" : undefined}
                        >
                          {isMissing ? (
                            <ProfileFieldValue
                              value={null}
                              emptyLabel="Noch offen — tippen zum Ergänzen"
                            />
                          ) : undefined}
                        </ProfileFieldCard>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              id="profile-section-products"
              className="scroll-mt-24 overflow-hidden border-primary/20 transition-colors"
            >
              <CardHeader className="pb-4">
                <SectionHeader
                  title={SECTION_META_BY_KEY.products.title}
                  description="Welche Produktkategorien du aktuell nutzt und welche Produktdetails im Onboarding festgehalten wurden."
                  status={productsStatus}
                  isOpen
                  controls={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-auto"
                        onClick={() =>
                          goToSectionStep("products", buildOnboardingHref("products_basics"))
                        }
                      >
                        Produkte bearbeiten
                      </Button>
                    </>
                  }
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {productsLoading ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/80 bg-card/80 p-4">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="mt-2 h-3 w-56" />
                      <div className="mt-4 flex flex-wrap gap-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <Skeleton key={index} className="h-8 w-24 rounded-full" />
                        ))}
                      </div>
                    </div>
                    <SectionGridSkeleton count={3} className="md:grid-cols-3" />
                  </div>
                ) : productRows.length > 0 ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-heading)]">
                          Ausgewählte Kategorien
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Damit ist auf einen Blick sichtbar, welche Produkttypen du überhaupt im
                          Alltag nutzt.
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedProductCategories.map((category) => (
                          <Badge
                            key={category}
                            variant="outline"
                            className="border-primary/20 bg-primary/[0.04] px-3 py-1 text-xs text-foreground"
                          >
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="hidden overflow-hidden rounded-xl border border-border/80 md:block">
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] gap-4 bg-muted/35 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        <span>Kategorie</span>
                        <span>Produkt</span>
                        <span>Häufigkeit</span>
                      </div>

                      {productRows.map((row) => (
                        <button
                          key={row.key}
                          type="button"
                          onClick={() =>
                            goToSectionStep(
                              "products",
                              buildOnboardingHref("product_drilldown", {
                                category: row.category,
                                singleStep: true,
                              }),
                            )
                          }
                          className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] gap-4 border-t border-border/70 px-4 py-4 text-left transition-colors hover:bg-primary/[0.04]"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-heading)]">
                              {row.categoryLabel}
                            </p>
                            {!row.isComplete ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Details fehlen noch
                              </p>
                            ) : null}
                          </div>
                          <p
                            className={cn(
                              "text-sm",
                              row.productName ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {row.productName ?? "Noch offen"}
                          </p>
                          <p
                            className={cn(
                              "text-sm",
                              row.frequencyLabel ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {row.frequencyLabel ?? "Noch offen"}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-3 md:hidden">
                      {productRows.map((row) => (
                        <button
                          key={row.key}
                          type="button"
                          onClick={() =>
                            goToSectionStep(
                              "products",
                              buildOnboardingHref("product_drilldown", {
                                category: row.category,
                                singleStep: true,
                              }),
                            )
                          }
                          className="rounded-xl border border-border/80 bg-card/80 p-4 text-left shadow-sm transition-colors hover:bg-primary/[0.04]"
                        >
                          <p className="text-sm font-semibold text-[var(--text-heading)]">
                            {row.categoryLabel}
                          </p>
                          <div className="mt-3 space-y-2 text-sm">
                            <p>
                              <span className="text-muted-foreground">Produkt:</span>{" "}
                              <span
                                className={
                                  row.productName ? "text-foreground" : "text-muted-foreground"
                                }
                              >
                                {row.productName ?? "Noch offen"}
                              </span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">Häufigkeit:</span>{" "}
                              <span
                                className={
                                  row.frequencyLabel ? "text-foreground" : "text-muted-foreground"
                                }
                              >
                                {row.frequencyLabel ?? "Noch offen"}
                              </span>
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <InlinePromptCard
                    title={
                      profile?.onboarding_completed
                        ? "Noch keine Produkte ausgewählt"
                        : "Noch keine Produktangaben vorhanden"
                    }
                    text={
                      profile?.onboarding_completed
                        ? "Im aktuellen Onboarding-Stand wurden noch keine Produktkategorien gespeichert."
                        : "Sobald du den Produktteil im Onboarding durchläufst, erscheint hier eine klare Übersicht nach Kategorie, Produkt und Häufigkeit."
                    }
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        className="w-auto"
                        onClick={() =>
                          goToSectionStep("products", buildOnboardingHref("products_basics"))
                        }
                      >
                        Produktteil öffnen
                      </Button>
                    }
                  />
                )}

                {!productsLoading && incompleteProductRows.length > 0 ? (
                  <InlinePromptCard
                    title={getOpenItemsTitle(
                      incompleteProductRows.length,
                      "Produktdetail",
                      "Produktdetails",
                    )}
                    text="Öffne den Produktteil, um die fehlenden Angaben zu ergänzen."
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        className="w-auto"
                        onClick={() =>
                          goToSectionStep(
                            "products",
                            buildOnboardingHref("product_drilldown", {
                              category: incompleteProductRows[0]?.category ?? null,
                            }),
                          )
                        }
                      >
                        Details ergänzen
                      </Button>
                    }
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card
              id="profile-section-styling"
              className="scroll-mt-24 overflow-hidden border-primary/20 transition-colors"
            >
              <CardHeader className="pb-4">
                <SectionHeader
                  title={SECTION_META_BY_KEY.styling.title}
                  description={SECTION_META_BY_KEY.styling.description}
                  status={stylingStatus}
                  isOpen
                  controls={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-auto"
                        onClick={() =>
                          goToSectionStep("styling", buildOnboardingHref("heat_tools"))
                        }
                      >
                        Styling bearbeiten
                      </Button>
                    </>
                  }
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {profileLoading ? (
                  <SectionGridSkeleton count={3} className="md:grid-cols-2 xl:grid-cols-3" />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {stylingFields.map((field) => {
                      const isMissing = field.value == null
                      return (
                        <ProfileFieldCard
                          key={field.key}
                          field={field}
                          onClick={() => openTarget("styling", field.editTarget)}
                          tone={isMissing ? "attention" : "default"}
                          className={isMissing ? "md:col-span-2 xl:col-span-3" : undefined}
                        >
                          {isMissing ? (
                            <ProfileFieldValue
                              value={null}
                              emptyLabel="Noch offen — tippen zum Ergänzen"
                            />
                          ) : undefined}
                        </ProfileFieldCard>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              id="profile-section-routine"
              className="scroll-mt-24 overflow-hidden border-primary/20 transition-colors"
            >
              <CardHeader className="pb-4">
                <SectionHeader
                  title={SECTION_META_BY_KEY.routine.title}
                  description={SECTION_META_BY_KEY.routine.description}
                  status={routineStatus}
                  isOpen
                  controls={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-auto"
                        onClick={() =>
                          goToSectionStep("routine", buildOnboardingHref("towel_material"))
                        }
                      >
                        Alltag bearbeiten
                      </Button>
                    </>
                  }
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {profileLoading ? (
                  <SectionGridSkeleton count={5} className="md:grid-cols-2 xl:grid-cols-3" />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {routineFields.map((field) => {
                      const isMissing = field.value == null
                      return (
                        <ProfileFieldCard
                          key={field.key}
                          field={field}
                          onClick={() => openTarget("routine", field.editTarget)}
                          tone={isMissing ? "attention" : "default"}
                          className={isMissing ? "md:col-span-2 xl:col-span-3" : undefined}
                        >
                          {isMissing ? (
                            <ProfileFieldValue
                              value={null}
                              emptyLabel="Noch offen — tippen zum Ergänzen"
                            />
                          ) : undefined}
                        </ProfileFieldCard>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              id="profile-section-goals"
              className="scroll-mt-24 overflow-hidden border-primary/20 transition-colors"
            >
              <CardHeader className="pb-4">
                <SectionHeader
                  title={SECTION_META_BY_KEY.goals.title}
                  description={SECTION_META_BY_KEY.goals.description}
                  status={goalsStatus}
                  isOpen
                  controls={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-auto"
                        onClick={() => goToSectionStep("goals", "/profile/edit/goals")}
                      >
                        Ziele bearbeiten
                      </Button>
                    </>
                  }
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {profileLoading ? (
                  <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3 w-56" />
                    <div className="mt-5 flex flex-wrap gap-2">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} className="h-8 w-28 rounded-full" />
                      ))}
                    </div>
                  </div>
                ) : goalsField ? (
                  <button
                    type="button"
                    onClick={() => openTarget("goals", goalsField.editTarget)}
                    className="flex w-full flex-wrap gap-2 rounded-[22px] border border-primary/10 bg-[hsl(var(--background))]/70 p-5 text-left transition-colors hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`${goalsField.label} bearbeiten`}
                  >
                    {Array.isArray(goalsField.value) && goalsField.value.length > 0 ? (
                      goalsField.value.map((goal) => (
                        <Badge
                          key={goal}
                          variant="outline"
                          className="rounded-full border-primary/20 bg-background px-4 py-1.5 text-sm font-semibold text-[var(--text-heading)]"
                        >
                          {goal}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Noch keine Ziele gewählt
                      </span>
                    )}
                  </button>
                ) : null}
              </CardContent>
            </Card>

            <div className="mt-12 border-t border-border/60 pt-8">
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-medium leading-none text-[var(--text-heading)]">
                Einstellungen
              </h2>
            </div>

            <Card
              id="profile-section-memory"
              className="mt-4 overflow-hidden border-border/60 bg-card/60"
            >
              <CardHeader className="pb-4">
                <SectionHeader
                  title={SECTION_META_BY_KEY.memory.title}
                  description={SECTION_META_BY_KEY.memory.description}
                  status={memoryStatus}
                  isOpen={isMemoryOpen}
                  preview={memorySectionSummary.preview}
                  controls={
                    <>
                      <Switch
                        checked={memoryEnabled}
                        disabled={memoryLoading || memorySaving}
                        onCheckedChange={handleMemoryToggle}
                        aria-label="Erinnerungen aktivieren"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-auto px-3 text-primary hover:bg-primary/[0.06]"
                        onClick={() => toggleSection("memory")}
                        aria-expanded={isMemoryOpen}
                        aria-controls="profile-section-panel-memory"
                        aria-label={
                          isMemoryOpen ? "Erinnerungen zuklappen" : "Erinnerungen aufklappen"
                        }
                      >
                        <span>{isMemoryOpen ? "Weniger" : "Mehr"}</span>
                        <ChevronDown
                          className={cn("transition-transform", isMemoryOpen ? "rotate-180" : "")}
                        />
                      </Button>
                    </>
                  }
                  size="sm"
                />
              </CardHeader>
              {isMemoryOpen ? (
                <CardContent id="profile-section-panel-memory">
                  {memoryLoading ? (
                    <p className="text-sm text-muted-foreground">Erinnerungen werden geladen...</p>
                  ) : memoryEntries.length === 0 ? (
                    <InlinePromptCard
                      title="Noch keine gespeicherten Erinnerungen"
                      text="Wenn du im Chat konkrete Haarpflege-Infos gibst, können sie hier als langfristiger Kontext auftauchen."
                    />
                  ) : (
                    <div className="divide-y">
                      {memoryEntries.map((entry) => (
                        <div key={entry.id} className="py-4 first:pt-0 last:pb-0">
                          {editingMemoryId === entry.id ? (
                            <div className="space-y-3">
                              <Textarea
                                value={memoryDraft}
                                onChange={(event) => setMemoryDraft(event.target.value)}
                                rows={3}
                                maxLength={500}
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  className="w-auto"
                                  onClick={() => handleSaveMemory(entry.id)}
                                  disabled={memorySaving || !memoryDraft.trim()}
                                >
                                  Speichern
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-auto"
                                  onClick={() => {
                                    setEditingMemoryId(null)
                                    setMemoryDraft("")
                                  }}
                                >
                                  Abbrechen
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm text-foreground">{entry.content}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Aktualisiert am{" "}
                                  {new Date(entry.updated_at).toLocaleDateString("de-DE")}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditingMemory(entry)}
                                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  Bearbeiten
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMemory(entry.id)}
                                  disabled={memorySaving}
                                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                                >
                                  Löschen
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              ) : null}
            </Card>

            {(profile?.stripe_customer_id || billingSubscription) && (
              <section className="mt-4 rounded-2xl border border-border/60 bg-card/60 p-6">
                <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-medium text-[var(--text-heading)]">
                  Mitgliedschaft
                </h2>
                <p className="mb-1 text-sm text-muted-foreground">
                  Status:{" "}
                  <strong className="text-foreground">
                    {formatBillingMembershipStatus(
                      billingSubscription,
                      profile?.subscription_status,
                    )}
                  </strong>
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Nächste Abrechnung / Laufzeitende:{" "}
                  <strong className="text-foreground">
                    {formatNullableDate(
                      billingSubscription?.current_period_end ?? profile?.current_period_end,
                    )}
                  </strong>
                </p>
                <ManageSubscriptionButton
                  provider={billingSubscription?.provider ?? "stripe"}
                  currentPeriodEnd={
                    billingSubscription?.current_period_end ?? profile?.current_period_end
                  }
                  cancelAtPeriodEnd={billingSubscription?.cancel_at_period_end ?? false}
                />
              </section>
            )}

            <Card className="mt-4 border-border/60 bg-card/60">
              <CardHeader className="pb-3">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-[var(--text-heading)]">
                  Account
                </h2>
                <CardDescription className="mt-1 text-sm">
                  Dein Zugang bleibt bewusst sekundär, damit das Profil weiterhin mit deiner
                  Haarreise startet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt="Avatar" />
                    <AvatarFallback>
                      {(profile?.full_name || profile?.email || "HC").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-heading)]">
                      {profile?.full_name || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  )
}
