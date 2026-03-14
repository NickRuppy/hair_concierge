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
  ROUTINE_PREFERENCE_OPTIONS,
  ROUTINE_PRODUCT_OPTIONS,
} from "@/lib/types"
import type { Goal, HairProfile } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useMemo, useState } from "react"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { fehler } from "@/lib/vocabulary"
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
    key: "routine_preference",
    label: "Routine-Detailgrad",
    helpText: "Wie kompakt oder detailliert dein Plan sein soll",
    getValue: (hp) =>
      ROUTINE_PREFERENCE_OPTIONS.find((o) => o.value === hp?.routine_preference)?.label ?? null,
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
  post_wash_actions: "routine",
  routine_preference: "routine",
  current_routine_products: "routine",
  products_used: "routine",
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
    post_wash_actions: [] as string[],
    routine_preference: "",
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
            post_wash_actions: data.post_wash_actions || [],
            routine_preference: data.routine_preference || "",
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
        post_wash_actions: formData.post_wash_actions,
        routine_preference: formData.routine_preference || null,
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
                        Routine-Detailgrad
                      </label>
                      <SegmentedControl
                        options={ROUTINE_PREFERENCE_OPTIONS}
                        value={formData.routine_preference}
                        onChange={(v) =>
                          setFormData((f) => ({ ...f, routine_preference: v }))
                        }
                      />
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
