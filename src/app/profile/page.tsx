"use client"

import { useAuth } from "@/providers/auth-provider"
import { useToast } from "@/providers/toast-provider"
import { Header } from "@/components/layout/header"
import {
  HAIR_TEXTURE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HAIR_DENSITY_OPTIONS,
  WASH_FREQUENCY_OPTIONS,
  HEAT_STYLING_OPTIONS,
  STYLING_TOOL_OPTIONS,
  CONCERN_OPTIONS,
  CONCERN_LABELS,
  GOAL_OPTIONS,
  GOAL_LABELS,
  DESIRED_VOLUME_OPTIONS,
  DESIRED_VOLUME_LABELS,
  HAIR_DENSITY_LABELS,
  STYLING_TOOL_LABELS,
  CUTICLE_CONDITION_LABELS,
  PROTEIN_MOISTURE_LABELS,
  SCALP_TYPE_LABELS,
  SCALP_CONDITION_LABELS,
  CHEMICAL_TREATMENT_LABELS,
  POST_WASH_ACTION_OPTIONS,
  ROUTINE_PRODUCT_OPTIONS,
} from "@/lib/types"
import type { Goal, HairProfile, UserMemoryEntry } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useMemo, useState } from "react"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import {
  fehler,
  TOWEL_MATERIAL_OPTIONS,
  TOWEL_MATERIAL_LABELS,
  TOWEL_TECHNIQUE_OPTIONS,
  TOWEL_TECHNIQUE_LABELS,
  DRYING_METHOD_OPTIONS,
  DRYING_METHOD_LABELS,
  BRUSH_TYPE_OPTIONS,
  BRUSH_TYPE_LABELS,
  NIGHT_PROTECTION_OPTIONS,
  NIGHT_PROTECTION_LABELS,
} from "@/lib/vocabulary"
import { deriveOnboardingGoals } from "@/lib/onboarding/goal-flow"

type ProfileFieldDef = {
  key: string
  label: string
  helpText: string
  getValue: (hp: HairProfile | null) => string | null
}

const EDITABLE_GOAL_OPTIONS = GOAL_OPTIONS.filter((option) => option.value !== "volume")

const PROFILE_FIELDS: ProfileFieldDef[] = [
  {
    key: "hair_texture",
    label: "Haartyp",
    helpText: "Grundlage für alle Empfehlungen",
    getValue: (hp) =>
      HAIR_TEXTURE_OPTIONS.find((o) => o.value === hp?.hair_texture)?.label ?? null,
  },
  {
    key: "thickness",
    label: "Haarstruktur",
    helpText: "Bestimmt die richtige Produktwahl",
    getValue: (hp) =>
      HAIR_THICKNESS_OPTIONS.find((o) => o.value === hp?.thickness)?.label ??
      null,
  },
  {
    key: "density",
    label: "Haardichte",
    helpText: "Hilft bei Gewicht und Reichhaltigkeit von Pflegeprodukten",
    getValue: (hp) =>
      hp?.density ? HAIR_DENSITY_LABELS[hp.density] ?? hp.density : null,
  },
  {
    key: "concerns",
    label: "Probleme",
    helpText: "Hilft uns, gezielt Lösungen zu finden",
    getValue: (hp) =>
      hp?.concerns?.length ? hp.concerns.map((c) => CONCERN_LABELS[c] ?? c).join(", ") : null,
  },
  {
    key: "desired_volume",
    label: "Gewuenschtes Volumen",
    helpText: "Steuert, ob TomBot eher Ruhe oder mehr Fuelle priorisiert",
    getValue: (hp) => {
      const fallbackVolume = hp?.desired_volume ?? (hp?.goals?.includes("volume") ? "more" : null)
      return fallbackVolume ? DESIRED_VOLUME_LABELS[fallbackVolume] ?? fallbackVolume : null
    },
  },
  {
    key: "wash_frequency",
    label: "Wasch-Häufigkeit",
    helpText: "Für eine passende Pflegeroutine",
    getValue: (hp) =>
      WASH_FREQUENCY_OPTIONS.find((o) => o.value === hp?.wash_frequency)
        ?.label ?? null,
  },
  {
    key: "heat_styling",
    label: "Hitze-Styling",
    helpText: "Beeinflusst den Pflegebedarf",
    getValue: (hp) =>
      HEAT_STYLING_OPTIONS.find((o) => o.value === hp?.heat_styling)?.label ??
      null,
  },
  {
    key: "styling_tools",
    label: "Styling-Tools",
    helpText: "Für passende Styling-Tipps",
    getValue: (hp) =>
      hp?.styling_tools?.length ? hp.styling_tools.map((t) => STYLING_TOOL_LABELS[t] ?? t).join(", ") : null,
  },
  {
    key: "towel_material",
    label: "Handtuch",
    helpText: "Welches Material nutzt du zum Trocknen",
    getValue: (hp) => hp?.towel_material ? TOWEL_MATERIAL_LABELS[hp.towel_material] ?? hp.towel_material : null,
  },
  {
    key: "towel_technique",
    label: "Trocknungstechnik",
    helpText: "Wie du dein Haar nach dem Waschen trocknest",
    getValue: (hp) => hp?.towel_technique ? TOWEL_TECHNIQUE_LABELS[hp.towel_technique] ?? hp.towel_technique : null,
  },
  {
    key: "drying_method",
    label: "Trocknungsmethode",
    helpText: "Lufttrocknen, Föhnen oder beides",
    getValue: (hp) => hp?.drying_method?.length ? hp.drying_method.map((d) => DRYING_METHOD_LABELS[d] ?? d).join(", ") : null,
  },
  {
    key: "brush_type",
    label: "Bürste",
    helpText: "Welche Bürste du regelmässig nutzt",
    getValue: (hp) => hp?.brush_type ? BRUSH_TYPE_LABELS[hp.brush_type] ?? hp.brush_type : null,
  },
  {
    key: "night_protection",
    label: "Nachtschutz",
    helpText: "Wie du dein Haar nachts schützt",
    getValue: (hp) => hp?.night_protection?.length ? hp.night_protection.map((n) => NIGHT_PROTECTION_LABELS[n] ?? n).join(", ") : null,
  },
  {
    key: "uses_heat_protection",
    label: "Hitzeschutz",
    helpText: "Ob du Hitzeschutz verwendest",
    getValue: (hp) => hp?.uses_heat_protection != null ? (hp.uses_heat_protection ? "Ja" : "Nein") : null,
  },
  {
    key: "post_wash_actions",
    label: "Nach dem Waschen",
    helpText: "Steuert Leave-in- und Styling-Empfehlungen",
    getValue: (hp) =>
      hp?.post_wash_actions?.length
        ? hp.post_wash_actions
            .map((item) => POST_WASH_ACTION_OPTIONS.find((o) => o.value === item)?.label ?? item)
            .join(", ")
        : null,
  },
  {
    key: "current_routine_products",
    label: "Produkte in Routine",
    helpText: "Hilft bei sinnvoller Ergänzung statt Verdopplung",
    getValue: (hp) =>
      hp?.current_routine_products?.length
        ? hp.current_routine_products
            .map((item) => ROUTINE_PRODUCT_OPTIONS.find((o) => o.value === item)?.label ?? item)
            .join(", ")
        : null,
  },
  {
    key: "products_used",
    label: "Verwendete Produkte",
    helpText: "Vermeidet doppelte Empfehlungen",
    getValue: (hp) => hp?.products_used || null,
  },
  {
    key: "goals",
    label: "Ziele",
    helpText: "Richtet unsere Empfehlungen aus",
    getValue: (hp) => {
      const displayGoals = hp?.goals?.filter((goal) => goal !== "volume") ?? []
      return displayGoals.length
        ? displayGoals.map((g) => GOAL_LABELS[g] ?? g).join(", ")
        : null
    },
  },
]

const FIELD_TO_SECTION: Record<string, string> = {
  hair_texture: "haartyp",
  thickness: "haartyp",
  density: "haartyp",
  concerns: "probleme",
  desired_volume: "probleme",
  goals: "probleme",
  wash_frequency: "routine",
  heat_styling: "routine",
  styling_tools: "routine",
  towel_material: "routine",
  towel_technique: "routine",
  drying_method: "routine",
  brush_type: "routine",
  night_protection: "routine",
  uses_heat_protection: "routine",
  post_wash_actions: "routine",
  current_routine_products: "routine",
  products_used: "routine",
}

type MemoryApiResponse = {
  settings: { memory_enabled: boolean }
  entries: UserMemoryEntry[]
}

export default function ProfilePage() {
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()
  const [hairProfile, setHairProfile] = useState<HairProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [editSection, setEditSection] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [memoryEntries, setMemoryEntries] = useState<UserMemoryEntry[]>([])
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [memoryLoading, setMemoryLoading] = useState(true)
  const [memorySaving, setMemorySaving] = useState(false)
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [memoryDraft, setMemoryDraft] = useState("")

  // Edit form state
  const [formData, setFormData] = useState({
    hair_texture: "",
    thickness: "",
    density: "",
    concerns: [] as string[],
    desired_volume: "",
    wash_frequency: "",
    heat_styling: "",
    styling_tools: [] as string[],
    towel_material: "",
    towel_technique: "",
    drying_method: [] as string[],
    brush_type: "",
    night_protection: [] as string[],
    uses_heat_protection: false,
    post_wash_actions: [] as string[],
    current_routine_products: [] as string[],
    products_used: "",
    goals: [] as string[],
    additional_notes: "",
  })

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
        if (data) {
          setHairProfile(data)
          const storedGoals = data.goals || []
          setFormData({
            hair_texture: data.hair_texture || "",
            thickness: data.thickness || "",
            density: data.density || "",
            concerns: data.concerns || [],
            desired_volume: data.desired_volume || (storedGoals.includes("volume") ? "more" : ""),
            wash_frequency: data.wash_frequency || "",
            heat_styling: data.heat_styling || "",
            styling_tools: data.styling_tools || [],
            towel_material: data.towel_material || "",
            towel_technique: data.towel_technique || "",
            drying_method: data.drying_method || [],
            brush_type: data.brush_type || "",
            night_protection: data.night_protection || [],
            uses_heat_protection: data.uses_heat_protection ?? false,
            post_wash_actions: data.post_wash_actions || [],
            current_routine_products: data.current_routine_products || [],
            products_used: data.products_used || "",
            goals: storedGoals.filter((goal: string) => goal !== "volume"),
            additional_notes: data.additional_notes || "",
          })
        }
      } catch (err) {
        console.error("Error loading profile:", err)
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
        const res = await fetch("/api/memory")
        if (!res.ok) throw new Error("Memory konnte nicht geladen werden")
        const data = (await res.json()) as MemoryApiResponse
        setMemoryEnabled(data.settings.memory_enabled)
        setMemoryEntries(data.entries ?? [])
      } catch (err) {
        console.error("Error loading memory:", err)
      } finally {
        setMemoryLoading(false)
      }
    }

    loadMemory()
  }, [user])

  // Pre-compute field values for read-mode display
  const fieldValues = useMemo(
    () =>
      PROFILE_FIELDS.map((f) => ({
        ...f,
        value: f.getValue(hairProfile),
      })),
    [hairProfile]
  )
  const filledFields = fieldValues.filter((f) => f.value !== null)
  const emptyFields = fieldValues.filter((f) => f.value === null)

  // Check if any diagnostic data exists
  const hasDiagnostics =
    !!hairProfile?.cuticle_condition ||
    !!hairProfile?.protein_moisture_balance ||
    !!hairProfile?.scalp_type ||
    !!hairProfile?.scalp_condition ||
    (hairProfile?.chemical_treatment?.length ?? 0) > 0

  async function handleSave() {
    if (!user) return
    setSaving(true)

    try {
      const desiredVolume = formData.desired_volume
        ? (formData.desired_volume as NonNullable<HairProfile["desired_volume"]>)
        : null
      const derivedGoals = deriveOnboardingGoals(
        formData.goals as Goal[],
        desiredVolume
      )

      // Convert empty strings to null so CHECK constraints don't reject them
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
      } else {
        setHairProfile(data)
        setEditing(false)
        toast({ title: "Profil gespeichert!" })
      }
    } catch (err) {
      console.error("Error saving profile:", err)
      toast({ title: fehler("Speichern"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function toggleArrayItem(arr: string[], item: string) {
    return arr.includes(item)
      ? arr.filter((i) => i !== item)
      : [...arr, item]
  }

  async function handleMemoryToggle(checked: boolean) {
    setMemoryEnabled(checked)
    setMemorySaving(true)

    try {
      const res = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory_enabled: checked }),
      })

      if (!res.ok) throw new Error("Memory setting failed")
      toast({ title: checked ? "Erinnerungen aktiviert" : "Erinnerungen pausiert" })
    } catch (err) {
      console.error("Error saving memory setting:", err)
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
      const res = await fetch(`/api/memory/${memoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) throw new Error("Memory update failed")
      const data = (await res.json()) as { memory: UserMemoryEntry }
      setMemoryEntries((entries) =>
        entries.map((entry) => entry.id === memoryId ? data.memory : entry)
      )
      setEditingMemoryId(null)
      setMemoryDraft("")
      toast({ title: "Erinnerung gespeichert" })
    } catch (err) {
      console.error("Error saving memory:", err)
      toast({ title: fehler("Speichern"), variant: "destructive" })
    } finally {
      setMemorySaving(false)
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    setMemorySaving(true)
    try {
      const res = await fetch(`/api/memory/${memoryId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Memory delete failed")
      setMemoryEntries((entries) => entries.filter((entry) => entry.id !== memoryId))
      if (editingMemoryId === memoryId) {
        setEditingMemoryId(null)
        setMemoryDraft("")
      }
      toast({ title: "Erinnerung gelöscht" })
    } catch (err) {
      console.error("Error deleting memory:", err)
      toast({ title: fehler("Löschen"), variant: "destructive" })
    } finally {
      setMemorySaving(false)
    }
  }

  if (authLoading || loading) {
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
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mein Profil</h1>
          {!editing ? (
            <button
              onClick={() => { setEditSection(null); setEditing(true) }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Bearbeiten
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Speichere..." : "Speichern"}
              </button>
            </div>
          )}
        </div>

        {/* Account Info */}
        <section className="mb-6 rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Account</h2>
          <div className="flex items-center gap-4">
            {profile?.avatar_url && (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="h-12 w-12 rounded-full"
              />
            )}
            <div>
              <p className="font-medium">{profile?.full_name || "—"}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
        </section>

        {/* Hair Profile */}
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Haar-Profil</h2>

          {editing ? (
            <Accordion
              type="multiple"
              defaultValue={editSection ? [editSection] : ["haartyp", "probleme", "routine"]}
            >
              {/* Section 1: Haartyp */}
              <AccordionItem value="haartyp">
                <AccordionTrigger>Haartyp</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6">
                    {/* Hair Type */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Haartyp</label>
                      <div className="flex flex-wrap gap-2">
                        {HAIR_TEXTURE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setFormData((f) => ({ ...f, hair_texture: opt.value }))
                            }
                            className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                              formData.hair_texture === opt.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hair Texture */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Haarstruktur</label>
                      <div className="flex flex-wrap gap-2">
                        {HAIR_THICKNESS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setFormData((f) => ({ ...f, thickness: opt.value }))
                            }
                            className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                              formData.thickness === opt.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Haardichte</label>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Wie viele Haare du pro Flaeche hast, nicht wie dick ein einzelnes Haar ist.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {HAIR_DENSITY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setFormData((f) => ({ ...f, density: opt.value }))
                            }
                            className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                              formData.density === opt.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section 2: Probleme & Ziele */}
              <AccordionItem value="probleme">
                <AccordionTrigger>Probleme &amp; Ziele</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6">
                    {/* Concerns */}
                    <div>
                      <label className="mb-1 block text-sm font-medium">Probleme</label>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Wähle alle zutreffenden Probleme aus
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {CONCERN_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setFormData((f) => ({
                                ...f,
                                concerns: toggleArrayItem(f.concerns, opt.value),
                              }))
                            }
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                              formData.concerns.includes(opt.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Gewuenschtes Volumen</label>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Soll TomBot eher auf weniger, ausgeglichenes oder mehr Volumen optimieren?
                      </p>
                      <SegmentedControl
                        options={DESIRED_VOLUME_OPTIONS}
                        value={formData.desired_volume}
                        onChange={(v) =>
                          setFormData((f) => ({ ...f, desired_volume: v }))
                        }
                      />
                    </div>

                    {/* Goals */}
                    <div>
                      <label className="mb-1 block text-sm font-medium">Weitere Ziele</label>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Waehle die zusaetzlichen Ziele, die neben dem Volumen wichtig sind.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {EDITABLE_GOAL_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setFormData((f) => ({
                                ...f,
                                goals: toggleArrayItem(f.goals, opt.value),
                              }))
                            }
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                              formData.goals.includes(opt.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section 3: Pflege-Routine */}
              <AccordionItem value="routine">
                <AccordionTrigger>Pflege-Routine</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6">
                    {/* Wash Frequency */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Wasch-Häufigkeit</label>
                      <SegmentedControl
                        options={WASH_FREQUENCY_OPTIONS}
                        value={formData.wash_frequency}
                        onChange={(v) =>
                          setFormData((f) => ({ ...f, wash_frequency: v }))
                        }
                      />
                    </div>

                    {/* Heat Styling */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Hitze-Styling</label>
                      <SegmentedControl
                        options={HEAT_STYLING_OPTIONS}
                        value={formData.heat_styling}
                        onChange={(v) =>
                          setFormData((f) => ({ ...f, heat_styling: v }))
                        }
                      />
                    </div>

                    {/* Styling Tools */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Styling-Tools</label>
                      <div className="flex flex-wrap gap-2">
                        {STYLING_TOOL_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setFormData((f) => ({
                                ...f,
                                styling_tools: toggleArrayItem(f.styling_tools, opt.value),
                              }))
                            }
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                              formData.styling_tools.includes(opt.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Towel Material */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Handtuch</label>
                      <div className="flex flex-wrap gap-2">
                        {TOWEL_MATERIAL_OPTIONS.map((opt) => (
                          <button key={opt.value} onClick={() => setFormData((f) => ({ ...f, towel_material: opt.value }))}
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${formData.towel_material === opt.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Towel Technique */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Trocknungstechnik</label>
                      <div className="flex flex-wrap gap-2">
                        {TOWEL_TECHNIQUE_OPTIONS.map((opt) => (
                          <button key={opt.value} onClick={() => setFormData((f) => ({ ...f, towel_technique: opt.value }))}
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${formData.towel_technique === opt.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Drying Method */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Trocknungsmethode</label>
                      <div className="flex flex-wrap gap-2">
                        {DRYING_METHOD_OPTIONS.map((opt) => (
                          <button key={opt.value} onClick={() => setFormData((f) => ({ ...f, drying_method: toggleArrayItem(f.drying_method, opt.value) }))}
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${formData.drying_method.includes(opt.value) ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Brush Type */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Bürste</label>
                      <div className="flex flex-wrap gap-2">
                        {BRUSH_TYPE_OPTIONS.map((opt) => (
                          <button key={opt.value} onClick={() => setFormData((f) => ({ ...f, brush_type: opt.value }))}
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${formData.brush_type === opt.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Night Protection */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Nachtschutz</label>
                      <div className="flex flex-wrap gap-2">
                        {NIGHT_PROTECTION_OPTIONS.map((opt) => (
                          <button key={opt.value} onClick={() => setFormData((f) => ({ ...f, night_protection: toggleArrayItem(f.night_protection, opt.value) }))}
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${formData.night_protection.includes(opt.value) ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Uses Heat Protection */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">Hitzeschutz</label>
                      <div className="flex gap-2">
                        <button onClick={() => setFormData((f) => ({ ...f, uses_heat_protection: true }))}
                          className={`rounded-lg border px-4 py-2 text-sm transition-colors ${formData.uses_heat_protection ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                          Ja
                        </button>
                        <button onClick={() => setFormData((f) => ({ ...f, uses_heat_protection: false }))}
                          className={`rounded-lg border px-4 py-2 text-sm transition-colors ${!formData.uses_heat_protection ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                          Nein
                        </button>
                      </div>
                    </div>

                    {/* Nach dem Waschen */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Nach dem Waschen
                      </label>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Waehle alle Aktionen, die auf dich zutreffen.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {POST_WASH_ACTION_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() =>
                              setFormData((f) => ({
                                ...f,
                                post_wash_actions: toggleArrayItem(
                                  f.post_wash_actions,
                                  option.value
                                ),
                              }))
                            }
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                              formData.post_wash_actions.includes(option.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Welche Produkte sind Teil deiner Routine?
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ROUTINE_PRODUCT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() =>
                              setFormData((f) => ({
                                ...f,
                                current_routine_products: toggleArrayItem(
                                  f.current_routine_products,
                                  option.value
                                ),
                              }))
                            }
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                              formData.current_routine_products.includes(option.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Products Used */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Aktuell verwendete Produkte
                      </label>
                      <textarea
                        value={formData.products_used}
                        onChange={(e) =>
                          setFormData((f) => ({ ...f, products_used: e.target.value }))
                        }
                        placeholder="z.B. Olaplex No. 3, Moroccanoil..."
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        rows={3}
                      />
                    </div>

                    {/* Additional Notes */}
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Zusätzliche Hinweise
                      </label>
                      <textarea
                        value={formData.additional_notes || ""}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            additional_notes: e.target.value,
                          }))
                        }
                        placeholder="Gibt es noch etwas, das wir wissen sollten?"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        rows={3}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            <div className="space-y-6">
              {/* Progress bar */}
              <div>
                <p className="mb-1.5 text-sm text-muted-foreground">
                  {filledFields.length} von {PROFILE_FIELDS.length} Angaben
                </p>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={filledFields.length}
                  aria-valuemin={0}
                  aria-valuemax={PROFILE_FIELDS.length}
                  aria-label={`${filledFields.length} von ${PROFILE_FIELDS.length} Angaben ausgefüllt`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${(filledFields.length / PROFILE_FIELDS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Filled fields as tags */}
              {filledFields.length > 0 ? (
                <div>
                  <h3 className="mb-3 text-sm font-semibold">
                    Dein Haar-Profil
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {filledFields.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => {
                          setEditSection(FIELD_TO_SECTION[f.key] ?? null)
                          setEditing(true)
                        }}
                        className="cursor-pointer rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm transition-colors hover:bg-primary/20"
                      >
                        <span className="font-medium">{f.label}:</span>{" "}
                        {f.value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch keine Angaben vorhanden. Klicke auf
                  &ldquo;Bearbeiten&rdquo; oder starte das Quiz, um dein
                  Profil zu erstellen.
                </p>
              )}

              {/* Additional notes (outside progress tracking) */}
              {hairProfile?.additional_notes && (
                <div className="rounded-lg border bg-muted/50 px-4 py-3">
                  <p className="mb-1 text-sm font-medium">Zusätzliche Hinweise</p>
                  <p className="text-sm text-muted-foreground">
                    {hairProfile.additional_notes}
                  </p>
                </div>
              )}

              {/* Empty fields as actionable cards */}
              {emptyFields.length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold">
                    Profil vervollständigen
                  </h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Je mehr wir wissen, desto besser unsere Empfehlungen
                  </p>
                  <div className="space-y-2">
                    {emptyFields.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => { setEditSection(null); setEditing(true) }}
                        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-left transition-colors hover:bg-accent"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                          +
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{f.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.helpText}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Was TomBot sich merkt</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Diese Haarpflege-Erinnerungen helfen bei Antworten und Produktempfehlungen.
              </p>
            </div>
            <Switch
              checked={memoryEnabled}
              disabled={memoryLoading || memorySaving}
              onCheckedChange={handleMemoryToggle}
              aria-label="Erinnerungen aktivieren"
            />
          </div>

          {memoryLoading ? (
            <p className="text-sm text-muted-foreground">Erinnerungen werden geladen...</p>
          ) : memoryEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine gespeicherten Erinnerungen. Wenn du TomBot im Chat konkrete
              Haarpflege-Infos gibst, kann er sie hier ablegen.
            </p>
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
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveMemory(entry.id)}
                          disabled={memorySaving || !memoryDraft.trim()}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          Speichern
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMemoryId(null)
                            setMemoryDraft("")
                          }}
                          className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm">{entry.content}</p>
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
        </section>

        {/* Diagnose section — read-only, shown in both modes */}
        {hasDiagnostics && (
          <section className="mt-6 rounded-xl border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Diagnose</h2>
            <div className="space-y-3">
              {hairProfile?.cuticle_condition && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Schuppenschicht</span>
                  <Badge variant="outline">
                    {CUTICLE_CONDITION_LABELS[hairProfile.cuticle_condition] ??
                      hairProfile.cuticle_condition}
                  </Badge>
                </div>
              )}
              {hairProfile?.protein_moisture_balance && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Protein / Feuchtigkeit</span>
                  <Badge variant="outline">
                    {PROTEIN_MOISTURE_LABELS[hairProfile.protein_moisture_balance] ??
                      hairProfile.protein_moisture_balance}
                  </Badge>
                </div>
              )}
              {hairProfile?.scalp_type && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Kopfhauttyp</span>
                  <Badge variant="outline">
                    {SCALP_TYPE_LABELS[hairProfile.scalp_type] ??
                      hairProfile.scalp_type}
                  </Badge>
                </div>
              )}
              {hairProfile?.scalp_condition && hairProfile.scalp_condition !== "none" && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Kopfhautbeschwerden</span>
                  <Badge variant="outline">
                    {SCALP_CONDITION_LABELS[hairProfile.scalp_condition as keyof typeof SCALP_CONDITION_LABELS] ??
                      hairProfile.scalp_condition}
                  </Badge>
                </div>
              )}
              {hairProfile?.chemical_treatment &&
                hairProfile.chemical_treatment.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Behandlung</span>
                    <div className="flex flex-wrap gap-1.5">
                      {hairProfile.chemical_treatment.map((t) => (
                        <Badge key={t} variant="outline">
                          {CHEMICAL_TREATMENT_LABELS[t] ?? t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Mach das Quiz erneut, um deine Diagnose zu aktualisieren.
            </p>
          </section>
        )}

        {/* Sign out button */}
        <div className="mt-8 text-center">
          <button
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
