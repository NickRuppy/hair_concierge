"use client"

import { useAuth } from "@/providers/auth-provider"
import { useToast } from "@/providers/toast-provider"
import { Header } from "@/components/layout/header"
import {
  HAIR_TYPE_OPTIONS,
  HAIR_TEXTURE_OPTIONS,
  WASH_FREQUENCY_OPTIONS,
  HEAT_STYLING_OPTIONS,
  STYLING_TOOL_OPTIONS,
  CONCERN_OPTIONS,
  GOAL_OPTIONS,
} from "@/lib/types"
import type { HairProfile } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

export default function ProfilePage() {
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()
  const [hairProfile, setHairProfile] = useState<HairProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [formData, setFormData] = useState({
    hair_type: "",
    hair_texture: "",
    concerns: [] as string[],
    wash_frequency: "",
    heat_styling: "",
    styling_tools: [] as string[],
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
          setFormData({
            hair_type: data.hair_type || "",
            hair_texture: data.hair_texture || "",
            concerns: data.concerns || [],
            wash_frequency: data.wash_frequency || "",
            heat_styling: data.heat_styling || "",
            styling_tools: data.styling_tools || [],
            products_used: data.products_used || "",
            goals: data.goals || [],
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
  }, [user])

  async function handleSave() {
    if (!user) return
    setSaving(true)

    try {
      // Convert empty strings to null so CHECK constraints don't reject them
      const payload = {
        user_id: user.id,
        hair_type: formData.hair_type || null,
        hair_texture: formData.hair_texture || null,
        concerns: formData.concerns,
        wash_frequency: formData.wash_frequency || null,
        heat_styling: formData.heat_styling || null,
        styling_tools: formData.styling_tools,
        products_used: formData.products_used || null,
        goals: formData.goals,
        additional_notes: formData.additional_notes || null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from("hair_profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single()

      if (error) {
        toast({ title: "Fehler beim Speichern", variant: "destructive" })
      } else {
        setHairProfile(data)
        setEditing(false)
        toast({ title: "Profil gespeichert!" })
      }
    } catch (err) {
      console.error("Error saving profile:", err)
      toast({ title: "Fehler beim Speichern", variant: "destructive" })
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
              onClick={() => setEditing(true)}
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
            <div className="space-y-6">
              {/* Hair Type */}
              <div>
                <label className="mb-2 block text-sm font-medium">Haartyp</label>
                <div className="flex flex-wrap gap-2">
                  {HAIR_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setFormData((f) => ({ ...f, hair_type: opt.value }))
                      }
                      className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                        formData.hair_type === opt.value
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

              {/* Concerns */}
              <div>
                <label className="mb-2 block text-sm font-medium">Probleme</label>
                <div className="flex flex-wrap gap-2">
                  {CONCERN_OPTIONS.map((concern) => (
                    <button
                      key={concern}
                      onClick={() =>
                        setFormData((f) => ({
                          ...f,
                          concerns: toggleArrayItem(f.concerns, concern),
                        }))
                      }
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        formData.concerns.includes(concern)
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      {concern}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wash Frequency */}
              <div>
                <label className="mb-2 block text-sm font-medium">Wasch-Häufigkeit</label>
                <select
                  value={formData.wash_frequency}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, wash_frequency: e.target.value }))
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Bitte wählen...</option>
                  {WASH_FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Heat Styling */}
              <div>
                <label className="mb-2 block text-sm font-medium">Hitze-Styling</label>
                <select
                  value={formData.heat_styling}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, heat_styling: e.target.value }))
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Bitte wählen...</option>
                  {HEAT_STYLING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Styling Tools */}
              <div>
                <label className="mb-2 block text-sm font-medium">Styling-Tools</label>
                <div className="flex flex-wrap gap-2">
                  {STYLING_TOOL_OPTIONS.map((tool) => (
                    <button
                      key={tool}
                      onClick={() =>
                        setFormData((f) => ({
                          ...f,
                          styling_tools: toggleArrayItem(f.styling_tools, tool),
                        }))
                      }
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        formData.styling_tools.includes(tool)
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      {tool}
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

              {/* Goals */}
              <div>
                <label className="mb-2 block text-sm font-medium">Ziele</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((goal) => (
                    <button
                      key={goal}
                      onClick={() =>
                        setFormData((f) => ({
                          ...f,
                          goals: toggleArrayItem(f.goals, goal),
                        }))
                      }
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        formData.goals.includes(goal)
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
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
          ) : (
            <div className="space-y-4">
              <ProfileField
                label="Haartyp"
                value={
                  HAIR_TYPE_OPTIONS.find(
                    (o) => o.value === hairProfile?.hair_type
                  )?.label
                }
              />
              <ProfileField
                label="Haarstruktur"
                value={
                  HAIR_TEXTURE_OPTIONS.find(
                    (o) => o.value === hairProfile?.hair_texture
                  )?.label
                }
              />
              <ProfileField
                label="Probleme"
                value={hairProfile?.concerns?.join(", ")}
              />
              <ProfileField
                label="Wasch-Häufigkeit"
                value={
                  WASH_FREQUENCY_OPTIONS.find(
                    (o) => o.value === hairProfile?.wash_frequency
                  )?.label
                }
              />
              <ProfileField
                label="Hitze-Styling"
                value={
                  HEAT_STYLING_OPTIONS.find(
                    (o) => o.value === hairProfile?.heat_styling
                  )?.label
                }
              />
              <ProfileField
                label="Styling-Tools"
                value={hairProfile?.styling_tools?.join(", ")}
              />
              <ProfileField
                label="Verwendete Produkte"
                value={hairProfile?.products_used}
              />
              <ProfileField
                label="Ziele"
                value={hairProfile?.goals?.join(", ")}
              />
              {hairProfile?.additional_notes && (
                <ProfileField
                  label="Zusätzliche Hinweise"
                  value={hairProfile.additional_notes}
                />
              )}
            </div>
          )}
        </section>

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

function ProfileField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  )
}
