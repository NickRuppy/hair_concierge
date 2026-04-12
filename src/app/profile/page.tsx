"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { useAuth } from "@/providers/auth-provider"
import { useToast } from "@/providers/toast-provider"
import { createClient } from "@/lib/supabase/client"
import {
  CONCERN_OPTIONS,
  DESIRED_VOLUME_OPTIONS,
  GOAL_OPTIONS,
  HEAT_STYLING_OPTIONS,
  POST_WASH_ACTION_OPTIONS,
  ROUTINE_PRODUCT_OPTIONS,
  STYLING_TOOL_OPTIONS,
  WASH_FREQUENCY_OPTIONS,
} from "@/lib/types"
import type { Goal, HairProfile, UserMemoryEntry } from "@/lib/types"
import {
  fehler,
  BRUSH_TYPE_OPTIONS,
  DRYING_METHOD_OPTIONS,
  NIGHT_PROTECTION_OPTIONS,
  TOWEL_MATERIAL_OPTIONS,
  TOWEL_TECHNIQUE_OPTIONS,
} from "@/lib/vocabulary"
import { deriveOnboardingGoals } from "@/lib/onboarding/goal-flow"
import {
  PROFILE_FIELD_CONFIG,
  PROFILE_JOURNEY_STEPS,
  PROFILE_SECTION_META,
  type ProfileFieldConfig,
  type ProfileFieldValue,
} from "@/lib/profile/section-config"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type MemoryApiResponse = {
  settings: { memory_enabled: boolean }
  entries: UserMemoryEntry[]
}

type ProfileFormData = {
  hair_texture: string
  thickness: string
  density: string
  concerns: string[]
  desired_volume: string
  wash_frequency: string
  heat_styling: string
  styling_tools: string[]
  towel_material: string
  towel_technique: string
  drying_method: string[]
  brush_type: string
  night_protection: string[]
  uses_heat_protection: boolean
  post_wash_actions: string[]
  current_routine_products: string[]
  products_used: string
  goals: string[]
  additional_notes: string
}

type StructuredField = ProfileFieldConfig & { value: ProfileFieldValue }

const EDITABLE_GOAL_OPTIONS = GOAL_OPTIONS.filter((option) => option.value !== "volume")

const HEAT_PROTECTION_OPTIONS = [
  { value: "yes", label: "Ja" },
  { value: "no", label: "Nein" },
]

const ROUTINE_DETAIL_FIELD_KEYS = new Set([
  "styling_tools",
  "towel_material",
  "towel_technique",
  "drying_method",
  "brush_type",
  "night_protection",
  "post_wash_actions",
  "current_routine_products",
  "products_used",
  "additional_notes",
])

function createFormData(profile: HairProfile | null): ProfileFormData {
  const storedGoals = profile?.goals ?? []

  return {
    hair_texture: profile?.hair_texture || "",
    thickness: profile?.thickness || "",
    density: profile?.density || "",
    concerns: profile?.concerns || [],
    desired_volume: profile?.desired_volume || (storedGoals.includes("volume") ? "more" : ""),
    wash_frequency: profile?.wash_frequency || "",
    heat_styling: profile?.heat_styling || "",
    styling_tools: profile?.styling_tools || [],
    towel_material: profile?.towel_material || "",
    towel_technique: profile?.towel_technique || "",
    drying_method: profile?.drying_method || [],
    brush_type: profile?.brush_type || "",
    night_protection: profile?.night_protection || [],
    uses_heat_protection: profile?.uses_heat_protection ?? false,
    post_wash_actions: profile?.post_wash_actions || [],
    current_routine_products: profile?.current_routine_products || [],
    products_used: profile?.products_used || "",
    goals: storedGoals.filter((goal) => goal !== "volume"),
    additional_notes: profile?.additional_notes || "",
  }
}

function toggleArrayItem(items: string[], item: string) {
  return items.includes(item) ? items.filter((entry) => entry !== item) : [...items, item]
}

function SourceBadge({ label }: { label: StructuredField["sourceLabel"] }) {
  return (
    <Badge
      variant="outline"
      className="border-primary/15 bg-muted/60 px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase"
    >
      {label}
    </Badge>
  )
}

function JourneyStepCard({
  label,
  status,
  summary,
  active,
}: {
  label: string
  status: string
  summary: string
  active: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        active ? "border-primary/20 bg-primary/[0.06]" : "border-border bg-card/70",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text-heading)]">{label}</p>
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
            active ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {status}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{summary}</p>
    </div>
  )
}

function ProfileFieldCard({
  field,
  children,
  onClick,
  actionLabel,
}: {
  field: StructuredField
  children?: React.ReactNode
  onClick?: () => void
  actionLabel?: string
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
        "rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm transition-colors",
        interactive
          ? "cursor-pointer hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          : "",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-heading)]">{field.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{field.helpText}</p>
        </div>
        <SourceBadge label={field.sourceLabel} />
      </div>

      {children ?? <ProfileFieldValue value={field.value} displayMode={field.displayMode} />}

      {interactive && actionLabel ? (
        <div className="mt-4 flex items-center justify-between gap-2 text-xs font-medium text-primary">
          <span>{actionLabel}</span>
          <span aria-hidden="true">→</span>
        </div>
      ) : null}
    </div>
  )
}

function ProfileFieldValue({
  value,
  displayMode,
}: {
  value: ProfileFieldValue
  displayMode: StructuredField["displayMode"]
}) {
  if (value == null) {
    return <p className="text-sm text-muted-foreground">Noch offen</p>
  }

  if (displayMode === "badges") {
    const items = Array.isArray(value) ? value : [value]

    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge
            key={item}
            variant="outline"
            className="border-primary/20 bg-primary/[0.04] px-3 py-1 text-xs text-foreground"
          >
            {item}
          </Badge>
        ))}
      </div>
    )
  }

  return <p className="text-sm leading-relaxed text-foreground">{value}</p>
}

function InlinePromptCard({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: React.ReactNode
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
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [hairProfile, setHairProfile] = useState<HairProfile | null>(null)
  const [formData, setFormData] = useState<ProfileFormData>(() => createFormData(null))
  const [editing, setEditing] = useState(false)
  const [routineDetailsOpen, setRoutineDetailsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [memoryEntries, setMemoryEntries] = useState<UserMemoryEntry[]>([])
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [memoryLoading, setMemoryLoading] = useState(true)
  const [memorySaving, setMemorySaving] = useState(false)
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [memoryDraft, setMemoryDraft] = useState("")

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const { data } = await supabase
          .from("hair_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle()

        setHairProfile(data ?? null)
        setFormData(createFormData(data ?? null))
      } catch (error) {
        console.error("Error loading profile:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    async function loadMemory() {
      if (!user) {
        setMemoryLoading(false)
        return
      }

      setMemoryLoading(true)

      try {
        const response = await fetch("/api/memory")
        if (!response.ok) throw new Error("Memory konnte nicht geladen werden")

        const data = (await response.json()) as MemoryApiResponse
        setMemoryEnabled(data.settings.memory_enabled)
        setMemoryEntries(data.entries ?? [])
      } catch (error) {
        console.error("Error loading memory:", error)
      } finally {
        setMemoryLoading(false)
      }
    }

    loadMemory()
  }, [user])

  const structuredFields = useMemo<StructuredField[]>(
    () =>
      PROFILE_FIELD_CONFIG.map((field) => ({
        ...field,
        value: field.getValue(hairProfile),
      })),
    [hairProfile],
  )

  const fieldsBySection = useMemo(() => {
    return {
      baseline: structuredFields.filter((field) => field.sectionKey === "baseline"),
      goals: structuredFields.filter((field) => field.sectionKey === "goals"),
      routine: structuredFields.filter((field) => field.sectionKey === "routine"),
    }
  }, [structuredFields])

  const baselineFields = fieldsBySection.baseline
  const goalFields = fieldsBySection.goals
  const routineFields = fieldsBySection.routine
  const routineSimpleFields = routineFields.filter((field) => field.editMode === "inline")
  const routineDetailFields = routineFields.filter((field) =>
    ROUTINE_DETAIL_FIELD_KEYS.has(field.key),
  )

  const baselineFilled = baselineFields.filter((field) => field.value !== null)
  const goalFilled = goalFields.filter((field) => field.value !== null)
  const routineFilled = routineFields.filter((field) => field.value !== null)

  const baselineMissing = baselineFields.filter((field) => field.value === null)
  const goalMissing = goalFields.filter((field) => field.value === null)
  const routineMissing = routineFields.filter((field) => field.value === null)

  const baselineSparse = baselineFilled.length < 3
  const overallStepCount = PROFILE_JOURNEY_STEPS.length
  const activeStepCount = [
    baselineFilled.length > 0,
    goalFilled.length > 0,
    routineFilled.length > 0,
    memoryEnabled,
  ].filter(Boolean).length
  const overallPercent = (activeStepCount / overallStepCount) * 100

  const readinessCopy =
    activeStepCount >= 3
      ? "Dein Profil ist schon belastbar genug für deutlich präzisere Empfehlungen."
      : activeStepCount === 2
        ? "Die Basis steht. Mit noch etwas mehr Kontext werden Empfehlungen spürbar schärfer."
        : "Mit ein paar gezielten Angaben kann Hair Concierge deutlich kohärenter beraten."

  async function handleSave() {
    if (!user) return

    setSaving(true)

    try {
      const desiredVolume = formData.desired_volume
        ? (formData.desired_volume as NonNullable<HairProfile["desired_volume"]>)
        : null
      const derivedGoals = deriveOnboardingGoals(formData.goals as Goal[], desiredVolume)

      const payload = {
        user_id: user.id,
        hair_texture: formData.hair_texture || null,
        thickness: formData.thickness || null,
        density: formData.density || null,
        concerns: formData.concerns,
        desired_volume: desiredVolume,
        wash_frequency: formData.wash_frequency || null,
        heat_styling: formData.heat_styling || null,
        styling_tools: formData.styling_tools,
        towel_material: formData.towel_material || null,
        towel_technique: formData.towel_technique || null,
        drying_method: formData.drying_method,
        brush_type: formData.brush_type || null,
        night_protection: formData.night_protection,
        uses_heat_protection: formData.uses_heat_protection,
        post_wash_actions: formData.post_wash_actions,
        current_routine_products: formData.current_routine_products,
        products_used: formData.products_used || null,
        goals: derivedGoals,
        additional_notes: formData.additional_notes || null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from("hair_profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single()

      if (error) {
        toast({ title: fehler("Speichern"), variant: "destructive" })
        return
      }

      setHairProfile(data)
      setFormData(createFormData(data))
      setEditing(false)
      setRoutineDetailsOpen(false)
      toast({ title: "Profil gespeichert!" })
    } catch (error) {
      console.error("Error saving profile:", error)
      toast({ title: fehler("Speichern"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEditing() {
    setFormData(createFormData(hairProfile))
    setEditing(false)
    setRoutineDetailsOpen(false)
  }

  async function handleMemoryToggle(checked: boolean) {
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

  function openFieldFlow(field: StructuredField) {
    setEditing(true)
    setRoutineDetailsOpen(
      field.sectionKey === "routine" && ROUTINE_DETAIL_FIELD_KEYS.has(field.key),
    )
  }

  function getFieldActionLabel(field: StructuredField) {
    if (field.sectionKey === "baseline") {
      return "Zur Aktualisierung öffnen"
    }

    if (field.sectionKey === "routine" && ROUTINE_DETAIL_FIELD_KEYS.has(field.key)) {
      return "Routine-Details öffnen"
    }

    return "Zum Bearbeiten öffnen"
  }

  function renderInlineEditor(field: StructuredField) {
    switch (field.key) {
      case "desired_volume":
        return (
          <SegmentedControl
            options={DESIRED_VOLUME_OPTIONS}
            value={formData.desired_volume}
            onChange={(value) => setFormData((current) => ({ ...current, desired_volume: value }))}
          />
        )
      case "concerns":
        return (
          <div className="flex flex-wrap gap-2">
            {CONCERN_OPTIONS.map((option) => {
              const active = formData.concerns.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setFormData((current) => ({
                      ...current,
                      concerns: toggleArrayItem(current.concerns, option.value),
                    }))
                  }
                  className={cn(
                    "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        )
      case "goals":
        return (
          <div className="flex flex-wrap gap-2">
            {EDITABLE_GOAL_OPTIONS.map((option) => {
              const active = formData.goals.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setFormData((current) => ({
                      ...current,
                      goals: toggleArrayItem(current.goals, option.value),
                    }))
                  }
                  className={cn(
                    "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        )
      case "wash_frequency":
        return (
          <SegmentedControl
            options={WASH_FREQUENCY_OPTIONS}
            value={formData.wash_frequency}
            onChange={(value) => setFormData((current) => ({ ...current, wash_frequency: value }))}
          />
        )
      case "heat_styling":
        return (
          <SegmentedControl
            options={HEAT_STYLING_OPTIONS}
            value={formData.heat_styling}
            onChange={(value) => setFormData((current) => ({ ...current, heat_styling: value }))}
          />
        )
      case "uses_heat_protection":
        return (
          <SegmentedControl
            options={HEAT_PROTECTION_OPTIONS}
            value={formData.uses_heat_protection ? "yes" : "no"}
            onChange={(value) =>
              setFormData((current) => ({
                ...current,
                uses_heat_protection: value === "yes",
              }))
            }
          />
        )
      default:
        return <ProfileFieldValue value={field.value} displayMode={field.displayMode} />
    }
  }

  function renderRoutineDetailsEditor() {
    return (
      <div className="rounded-2xl border border-primary/15 bg-muted/40 p-5">
        <div className="mb-5">
          <p className="text-sm font-semibold text-[var(--text-heading)]">
            Routine-Details im Fokus
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hier ergänzt du die tieferen Alltags-Signale, die nicht bei jedem Profil sofort nötig
            sind.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--text-heading)]">
                Styling &amp; Schutz
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Welche Tools du nutzt und wie du dein Haar tagsüber oder nachts schützt.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-sm font-medium">Styling-Tools</p>
                <div className="flex flex-wrap gap-2">
                  {STYLING_TOOL_OPTIONS.map((option) => {
                    const active = formData.styling_tools.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({
                            ...current,
                            styling_tools: toggleArrayItem(current.styling_tools, option.value),
                          }))
                        }
                        className={cn(
                          "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-card",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Bürste</p>
                <div className="flex flex-wrap gap-2">
                  {BRUSH_TYPE_OPTIONS.map((option) => {
                    const active = formData.brush_type === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({ ...current, brush_type: option.value }))
                        }
                        className={cn(
                          "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-card",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Nachtschutz</p>
                <div className="flex flex-wrap gap-2">
                  {NIGHT_PROTECTION_OPTIONS.map((option) => {
                    const active = formData.night_protection.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({
                            ...current,
                            night_protection: toggleArrayItem(
                              current.night_protection,
                              option.value,
                            ),
                          }))
                        }
                        className={cn(
                          "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-card",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--text-heading)]">Trocknen</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Material, Technik und Nach-dem-Waschen-Muster liefern oft die fehlenden Frizz- und
                Schutzsignale.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-sm font-medium">Handtuch</p>
                <div className="flex flex-wrap gap-2">
                  {TOWEL_MATERIAL_OPTIONS.map((option) => {
                    const active = formData.towel_material === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({ ...current, towel_material: option.value }))
                        }
                        className={cn(
                          "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-card",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Trocknungstechnik</p>
                <div className="flex flex-wrap gap-2">
                  {TOWEL_TECHNIQUE_OPTIONS.map((option) => {
                    const active = formData.towel_technique === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({ ...current, towel_technique: option.value }))
                        }
                        className={cn(
                          "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-card",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Trocknungsmethode</p>
                <div className="flex flex-wrap gap-2">
                  {DRYING_METHOD_OPTIONS.map((option) => {
                    const active = formData.drying_method.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({
                            ...current,
                            drying_method: toggleArrayItem(current.drying_method, option.value),
                          }))
                        }
                        className={cn(
                          "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-card",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Nach dem Waschen</p>
                <div className="flex flex-wrap gap-2">
                  {POST_WASH_ACTION_OPTIONS.map((option) => {
                    const active = formData.post_wash_actions.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({
                            ...current,
                            post_wash_actions: toggleArrayItem(
                              current.post_wash_actions,
                              option.value,
                            ),
                          }))
                        }
                        className={cn(
                          "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-card",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--text-heading)]">
                Produkte &amp; Notizen
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Was bereits genutzt wird und welche Freitext-Hinweise wichtig bleiben sollen.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-sm font-medium">Produkte in Routine</p>
                <div className="flex flex-wrap gap-2">
                  {ROUTINE_PRODUCT_OPTIONS.map((option) => {
                    const active = formData.current_routine_products.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({
                            ...current,
                            current_routine_products: toggleArrayItem(
                              current.current_routine_products,
                              option.value,
                            ),
                          }))
                        }
                        className={cn(
                          "min-h-[40px] rounded-full border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-card",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Verwendete Produkte</p>
                <Textarea
                  value={formData.products_used}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, products_used: event.target.value }))
                  }
                  rows={3}
                  placeholder="z. B. Olaplex No. 3, Moroccanoil, Balea ..."
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Zusätzliche Hinweise</p>
                <Textarea
                  value={formData.additional_notes}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      additional_notes: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Gibt es noch etwas, das Hair Concierge im Alltag berücksichtigen soll?"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (authLoading) {
    return (
      <>
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {editing ? (
          <div className="sticky top-16 z-30 mb-6">
            <div className="rounded-2xl border border-primary/20 bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-heading)]">
                    Du bearbeitest dein Profil
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Änderungen werden erst übernommen, wenn du speicherst.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-auto"
                    onClick={handleCancelEditing}
                  >
                    Abbrechen
                  </Button>
                  <Button type="button" className="w-auto" onClick={handleSave} disabled={saving}>
                    {saving ? "Speichere..." : "Speichern"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="type-overline text-primary">Profilübersicht</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-heading)]">
              Mein Profil
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Hier siehst du denselben roten Faden wie im Quiz und Onboarding: Ausgangslage, Ziele,
              Alltag und das, was Hair Concierge mit der Zeit dazulernt.
            </p>
          </div>

          {!editing && !loading ? (
            <Button type="button" onClick={() => setEditing(true)} className="w-auto">
              Bearbeiten
            </Button>
          ) : null}
        </div>

        {loading ? (
          <>
            <Card className="mb-6 border-primary/10">
              <CardHeader className="pb-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="mt-2 h-4 w-80" />
              </CardHeader>
              <CardContent>
                <Skeleton className="mb-4 h-2 w-full rounded-full" />
                <div className="grid gap-3 md:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-4">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="mt-2 h-4 w-64" />
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <Skeleton key={j} className="h-16 rounded-xl" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            <Card className="mb-6 border-primary/10">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <CardTitle className="text-xl text-[var(--text-heading)]">
                      So baut sich dein Profil auf
                    </CardTitle>
                    <CardDescription className="mt-2 max-w-2xl text-sm">
                      {readinessCopy}
                    </CardDescription>
                  </div>
                  <Badge className="w-fit px-3 py-1 text-xs">
                    {activeStepCount} von {overallStepCount} Bausteinen aktiv
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${overallPercent}%` }}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <JourneyStepCard
                    label="Haar-Check"
                    status={baselineFilled.length === 0 ? "Offen" : "Aktiv"}
                    summary={
                      baselineFilled.length === 0
                        ? "Noch keine Basisdaten vorhanden."
                        : `${baselineFilled.length}/${baselineFields.length} Signale vorhanden`
                    }
                    active={baselineFilled.length > 0}
                  />
                  <JourneyStepCard
                    label="Ziele"
                    status={goalFilled.length === 0 ? "Offen" : "Aktiv"}
                    summary={
                      goalFilled.length === 0
                        ? "Noch keine Prioritäten gesetzt."
                        : `${goalFilled.length}/${goalFields.length} Signale vorhanden`
                    }
                    active={goalFilled.length > 0}
                  />
                  <JourneyStepCard
                    label="Alltag"
                    status={routineFilled.length === 0 ? "Offen" : "Aktiv"}
                    summary={
                      routineFilled.length === 0
                        ? "Noch keine Routinedaten vorhanden."
                        : `${routineFilled.length}/${routineFields.length} Signale vorhanden`
                    }
                    active={routineFilled.length > 0}
                  />
                  <JourneyStepCard
                    label="Merkt sich"
                    status={memoryEnabled ? "Aktiv" : "Pausiert"}
                    summary={
                      memoryEnabled
                        ? memoryEntries.length > 0
                          ? `${memoryEntries.length} gespeicherte Erinnerungen`
                          : "Bereit, neue Chat-Erinnerungen zu speichern"
                        : "Chat-Erinnerungen sind aktuell ausgeschaltet"
                    }
                    active={memoryEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle className="text-xl text-[var(--text-heading)]">
                        {PROFILE_SECTION_META[0].title}
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm">
                        {PROFILE_SECTION_META[0].description}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-auto"
                      onClick={() => router.push("/quiz")}
                    >
                      Haar-Check aktualisieren
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {baselineFilled.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {baselineFilled.map((field) => (
                        <ProfileFieldCard
                          key={field.key}
                          field={field}
                          onClick={!editing ? () => openFieldFlow(field) : undefined}
                          actionLabel={!editing ? getFieldActionLabel(field) : undefined}
                        />
                      ))}
                    </div>
                  ) : null}

                  {(baselineSparse || editing) && (
                    <InlinePromptCard
                      title="Ausgangslage wird über den Haar-Check gepflegt"
                      text={
                        baselineSparse
                          ? "Damit Diagnose- und Strukturdaten konsistent bleiben, startest du diese Basis nicht direkt hier, sondern über den Haar-Check."
                          : "Diese Felder bleiben absichtlich read-only im Profil. Für Änderungen führst du den Haar-Check erneut durch."
                      }
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          className="w-auto"
                          onClick={() => router.push("/quiz")}
                        >
                          Haar-Check starten
                        </Button>
                      }
                    />
                  )}

                  {!editing && baselineMissing.length > 0 && !baselineSparse ? (
                    <InlinePromptCard
                      title="Ein Teil der Basis fehlt noch"
                      text={`Noch offen: ${baselineMissing.map((field) => field.label).join(", ")}`}
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          className="w-auto"
                          onClick={() => router.push("/quiz")}
                        >
                          Basis ergänzen
                        </Button>
                      }
                    />
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl text-[var(--text-heading)]">
                    {PROFILE_SECTION_META[1].title}
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm">
                    {PROFILE_SECTION_META[1].description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editing ? (
                    <div className="grid gap-4 xl:grid-cols-3">
                      {goalFields.map((field) => (
                        <ProfileFieldCard key={field.key} field={field}>
                          {renderInlineEditor(field)}
                        </ProfileFieldCard>
                      ))}
                    </div>
                  ) : goalFilled.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {goalFilled.map((field) => (
                        <ProfileFieldCard
                          key={field.key}
                          field={field}
                          onClick={() => openFieldFlow(field)}
                          actionLabel={getFieldActionLabel(field)}
                        />
                      ))}
                    </div>
                  ) : (
                    <InlinePromptCard
                      title="Noch keine Ziele gesetzt"
                      text="Wähle mindestens dein gewünschtes Volumen oder ein relevantes Ziel, damit der erste Plan klarer priorisieren kann."
                    />
                  )}

                  {!editing && goalMissing.length > 0 ? (
                    <InlinePromptCard
                      title="Ziele schärfen"
                      text={`Noch offen: ${goalMissing.map((field) => field.label).join(", ")}`}
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          className="w-auto"
                          onClick={() => setEditing(true)}
                        >
                          Ziele bearbeiten
                        </Button>
                      }
                    />
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle className="text-xl text-[var(--text-heading)]">
                        {PROFILE_SECTION_META[2].title}
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm">
                        {PROFILE_SECTION_META[2].description}
                      </CardDescription>
                    </div>
                    {editing ? (
                      <Button
                        type="button"
                        variant={routineDetailsOpen ? "default" : "outline"}
                        className="w-auto"
                        onClick={() => setRoutineDetailsOpen((current) => !current)}
                      >
                        {routineDetailsOpen
                          ? "Routine-Details ausblenden"
                          : "Routine-Details bearbeiten"}
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editing ? (
                    <div className="grid gap-4 xl:grid-cols-3">
                      {routineSimpleFields.map((field) => (
                        <ProfileFieldCard key={field.key} field={field}>
                          {renderInlineEditor(field)}
                        </ProfileFieldCard>
                      ))}
                    </div>
                  ) : null}

                  {routineFilled.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {(editing
                        ? routineDetailFields.filter((field) => field.value !== null)
                        : routineFilled
                      ).map((field) => (
                        <ProfileFieldCard
                          key={field.key}
                          field={field}
                          onClick={!editing ? () => openFieldFlow(field) : undefined}
                          actionLabel={!editing ? getFieldActionLabel(field) : undefined}
                        />
                      ))}
                    </div>
                  ) : null}

                  {editing && routineDetailsOpen ? renderRoutineDetailsEditor() : null}

                  {!editing && routineFilled.length === 0 ? (
                    <InlinePromptCard
                      title="Alltags-Signale fehlen noch"
                      text="Waschhäufigkeit, Hitzemuster und Routinedetails machen Empfehlungen deutlich realistischer."
                    />
                  ) : null}

                  {!editing && routineMissing.length > 0 ? (
                    <InlinePromptCard
                      title="Alltag weiter schärfen"
                      text={`Noch offen: ${routineMissing
                        .map((field) => field.label)
                        .slice(0, 6)
                        .join(
                          ", ",
                        )}${routineMissing.length > 6 ? ` und ${routineMissing.length - 6} weitere` : ""}`}
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          className="w-auto"
                          onClick={() => setEditing(true)}
                        >
                          Alltag bearbeiten
                        </Button>
                      }
                    />
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl text-[var(--text-heading)]">
                    {PROFILE_SECTION_META[3].title}
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm">
                    {PROFILE_SECTION_META[3].description}
                  </CardDescription>
                </div>
                <Switch
                  checked={memoryEnabled}
                  disabled={memoryLoading || memorySaving}
                  onCheckedChange={handleMemoryToggle}
                  aria-label="Erinnerungen aktivieren"
                />
              </div>
            </CardHeader>
            <CardContent>
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
          </Card>

          <Card className="bg-muted/35">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[var(--text-heading)]">Account</CardTitle>
              <CardDescription className="mt-1 text-sm">
                Dein Zugang bleibt bewusst sekundär, damit das Profil mit deiner Haarreise startet.
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

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Abmelden
          </button>
        </div>
      </main>
    </>
  )
}
