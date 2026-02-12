"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { hairProfileStep3Schema } from "@/lib/validators"
import {
  WASH_FREQUENCY_OPTIONS,
  HEAT_STYLING_OPTIONS,
  STYLING_TOOL_OPTIONS,
  type WashFrequency,
  type HeatStyling,
} from "@/lib/types"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DiscreteSlider, type SliderStop } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"

const WASH_SHORT_LABELS: Record<string, string> = {
  alle_2_tage: "Alle 2 T.",
  "2_mal_woche": "2x/Wo.",
  "1_mal_woche": "1x/Wo.",
}

const HEAT_SHORT_LABELS: Record<string, string> = {
  mehrmals_woche: "Mehrmals/Wo.",
  "1_mal_woche": "1x/Wo.",
}

const WASH_FREQUENCY_STOPS: SliderStop[] = WASH_FREQUENCY_OPTIONS.map((opt) => ({
  ...opt,
  shortLabel: WASH_SHORT_LABELS[opt.value],
}))

const HEAT_STYLING_STOPS: SliderStop[] = HEAT_STYLING_OPTIONS.map((opt) => ({
  ...opt,
  shortLabel: HEAT_SHORT_LABELS[opt.value],
}))

export default function OnboardingStep3() {
  const router = useRouter()
  const { user, loading: authLoading, refreshProfile } = useAuth()
  const supabase = createClient()

  const [washFrequency, setWashFrequency] = useState<WashFrequency | "">("")
  const [heatStyling, setHeatStyling] = useState<HeatStyling | "">("")
  const [stylingTools, setStylingTools] = useState<string[]>([])
  const [productsUsed, setProductsUsed] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // Load existing data on mount
  useEffect(() => {
    if (authLoading || !user) return

    const loadExistingData = async () => {
      const { data } = await supabase
        .from("hair_profiles")
        .select("wash_frequency, heat_styling, styling_tools, products_used")
        .eq("user_id", user.id)
        .maybeSingle()

      if (data) {
        if (data.wash_frequency) setWashFrequency(data.wash_frequency as WashFrequency)
        if (data.heat_styling) setHeatStyling(data.heat_styling as HeatStyling)
        if (data.styling_tools && Array.isArray(data.styling_tools)) {
          setStylingTools(data.styling_tools)
        }
        if (data.products_used) setProductsUsed(data.products_used)
      }
      setLoadingData(false)
    }

    loadExistingData()
  }, [user, authLoading, supabase])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  const toggleStylingTool = (tool: string) => {
    setStylingTools((prev) =>
      prev.includes(tool)
        ? prev.filter((t) => t !== tool)
        : [...prev, tool]
    )
  }

  const handleNext = async () => {
    setError(null)

    const result = hairProfileStep3Schema.safeParse({
      wash_frequency: washFrequency,
      heat_styling: heatStyling,
      styling_tools: stylingTools,
      products_used: productsUsed,
    })

    if (!result.success) {
      const firstIssue = result.error.issues[0]
      setError(firstIssue?.message || "Bitte fuelle alle Pflichtfelder aus.")
      return
    }

    setSaving(true)

    try {
      const { error: upsertError } = await supabase
        .from("hair_profiles")
        .upsert(
          {
            user_id: user!.id,
            wash_frequency: result.data.wash_frequency,
            heat_styling: result.data.heat_styling,
            styling_tools: result.data.styling_tools,
            products_used: result.data.products_used || null,
          },
          { onConflict: "user_id" }
        )

      if (upsertError) throw upsertError

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarding_step: 4 })
        .eq("id", user!.id)

      if (profileError) throw profileError

      await refreshProfile()
      router.push("/onboarding/step-4")
    } catch (err) {
      console.error("Error saving step 3:", err)
      setError("Fehler beim Speichern. Bitte versuche es erneut.")
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    router.push("/onboarding/step-2")
  }

  if (authLoading || loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ProgressBar currentStep={3} />

      <div>
        <h2 className="text-xl font-bold text-foreground">
          Schritt 3: Deine Haarpflege-Routine
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Erzaehl uns mehr ueber deine aktuelle Haarpflege.
        </p>
      </div>

      {/* Wash Frequency */}
      <div className="space-y-2">
        <Label>Wie oft waeschst du deine Haare?</Label>
        <DiscreteSlider
          stops={WASH_FREQUENCY_STOPS}
          value={washFrequency || undefined}
          onValueChange={(val) => setWashFrequency(val as WashFrequency)}
          aria-label="Wie oft wäschst du deine Haare?"
        />
      </div>

      {/* Heat Styling */}
      <div className="space-y-2">
        <Label>Wie oft verwendest du Hitze-Styling?</Label>
        <DiscreteSlider
          stops={HEAT_STYLING_STOPS}
          value={heatStyling || undefined}
          onValueChange={(val) => setHeatStyling(val as HeatStyling)}
          aria-label="Wie oft verwendest du Hitze-Styling?"
        />
      </div>

      {/* Styling Tools */}
      <div className="space-y-3">
        <Label>Welche Styling-Tools verwendest du?</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STYLING_TOOL_OPTIONS.map((tool) => (
            <label
              key={tool}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={stylingTools.includes(tool)}
                onCheckedChange={() => toggleStylingTool(tool)}
              />
              <span className="text-sm text-foreground">{tool}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Products Used */}
      <div className="space-y-2">
        <Label htmlFor="products-used">
          Welche Produkte verwendest du aktuell? (optional)
        </Label>
        <Textarea
          id="products-used"
          placeholder="z.B. Shampoo von Marke X, Conditioner von Marke Y..."
          value={productsUsed}
          onChange={(e) => setProductsUsed(e.target.value)}
          rows={3}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} size="lg">
          Zurueck
        </Button>
        <Button onClick={handleNext} disabled={saving} size="lg">
          {saving ? "Speichern..." : "Weiter"}
        </Button>
      </div>
    </div>
  )
}
