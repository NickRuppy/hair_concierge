"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { useToast } from "@/providers/toast-provider"
import { createClient } from "@/lib/supabase/client"
import { useOnboardingStore } from "@/lib/onboarding/store"
import type { OnboardingStep } from "@/lib/onboarding/store"
import { OnboardingProgressBar } from "@/components/onboarding/onboarding-progress-bar"
import { mergeAnsweredFields } from "@/lib/onboarding/answered-fields"
import {
  mapShampooFrequency,
  mapHeatFrequency,
  deriveMechanicalStressFactors,
  derivePostWashActions,
  mapProductChecklistToRoutineProducts,
  reconcileDiffusor,
} from "@/lib/onboarding/backward-compat"
import { deriveOnboardingGoals } from "@/lib/onboarding/goal-flow"
import type { ProductFrequency } from "@/lib/vocabulary"
import type { HairTexture, DesiredVolume } from "@/lib/vocabulary"
import type { Goal } from "@/lib/vocabulary"

// Import all screens
import {
  WelcomeScreen,
  ProductChecklistScreen,
  ProductDrilldownScreen,
  HeatToolsScreen,
  HeatFrequencyScreen,
  HeatProtectionScreen,
  InterstitialScreen,
  SingleSelectScreen,
  MultiSelectScreen,
  GoalsScreen,
  CelebrationPopup,
} from "@/components/onboarding/screens"

// Import option data for care habit screens
import {
  TOWEL_MATERIAL_OPTIONS,
  TOWEL_TECHNIQUE_OPTIONS,
  DRYING_METHOD_OPTIONS,
  BRUSH_TYPE_OPTIONS,
  NIGHT_PROTECTION_OPTIONS,
} from "@/lib/vocabulary/onboarding-care"
import type {
  TowelMaterial,
  TowelTechnique,
  DryingMethod,
  BrushType,
  NightProtection,
} from "@/lib/vocabulary/onboarding-care"

import type { IconName } from "@/components/ui/icon"

/* ── Product checklist options ── */

const BASIC_PRODUCT_OPTIONS: { value: string; label: string; icon: IconName }[] = [
  { value: "shampoo", label: "Shampoo", icon: "product-shampoo" },
  { value: "conditioner", label: "Conditioner", icon: "product-conditioner" },
  { value: "leave_in", label: "Leave-in", icon: "product-leave-in" },
  { value: "oil", label: "\u00D6l", icon: "product-oil" },
  { value: "mask", label: "Maske", icon: "product-mask" },
]

const EXTRA_PRODUCT_OPTIONS: { value: string; label: string; icon: IconName }[] = [
  { value: "peeling", label: "Peeling (Serum/Scrub)", icon: "product-peeling" },
  { value: "dry_shampoo", label: "Trockenshampoo", icon: "product-dry-shampoo" },
  { value: "bondbuilder", label: "Bondbuilder", icon: "product-bond-builder" },
  {
    value: "deep_cleansing_shampoo",
    label: "Tiefenreinigungsshampoo",
    icon: "product-deep-cleansing",
  },
]

/* ── Care habit icon maps ── */

const TOWEL_MATERIAL_ICONS: Record<string, IconName> = {
  frottee: "towel-frottee",
  mikrofaser: "towel-mikrofaser",
  tshirt: "towel-tshirt",
  turban_mikrofaser: "towel-turban",
}

const TOWEL_TECHNIQUE_ICONS: Record<string, IconName> = {
  rubbeln: "technique-rubbeln",
  tupfen: "technique-tupfen",
}

const DRYING_METHOD_ICONS: Record<string, IconName> = {
  air_dry: "drying-air",
  blow_dry: "drying-blow",
  blow_dry_diffuser: "drying-diffuser",
}

const BRUSH_TYPE_ICONS: Record<string, IconName> = {
  wide_tooth_comb: "brush-wide-tooth",
  detangling: "brush-detangling",
  paddle: "brush-paddle",
  round: "brush-round",
  boar_bristle: "brush-boar-bristle",
  fingers: "brush-fingers",
  none_regular: "brush-none",
}

const NIGHT_PROTECTION_ICONS: Record<string, IconName> = {
  silk_satin_pillow: "night-silk-pillow",
  silk_satin_bonnet: "night-silk-bonnet",
  loose_braid: "night-loose-braid",
  loose_bun: "night-loose-bun",
  pineapple: "night-pineapple",
}

/* ── Label map for drilldown categories ── */

const CATEGORY_LABELS: Record<string, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  oil: "Öl",
  mask: "Maske",
  peeling: "Peeling",
  dry_shampoo: "Trockenshampoo",
  bondbuilder: "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigungsshampoo",
}

/* ── Custom subtitle overrides for drilldown screens ── */

const CATEGORY_SUBTITLES: Record<string, string> = {
  peeling: "Nutzt du ein Serum oder Scrub fuer deine Kopfhaut? Welches Produkt und wie oft?",
}

/* ── Props ── */

interface OnboardingFlowProps {
  userId: string
  initialStep: string
  hairProfile: Record<string, unknown> | null
  productUsage: Array<Record<string, unknown>>
}

/* ── Component ── */

export function OnboardingFlow({
  userId,
  initialStep,
  hairProfile,
  productUsage,
}: OnboardingFlowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const store = useOnboardingStore()
  const [hydrated, setHydrated] = useState(false)
  const initRef = useRef(false)
  const savingRef = useRef(false)

  // ── Initialization: hydrate store from server data ──

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    // Reset store to clear any stale state from previous sessions
    store.reset()

    // Set starting step
    const step = (initialStep as OnboardingStep) ?? "welcome"
    store.setStep(step)

    // Resume scenario: populate store from existing hair profile
    if (hairProfile) {
      if (Array.isArray(hairProfile.styling_tools) && hairProfile.styling_tools.length > 0) {
        store.setSelectedHeatTools(hairProfile.styling_tools as string[])
      }
      if (hairProfile.towel_material) {
        store.setTowelMaterial(hairProfile.towel_material as TowelMaterial)
      }
      if (hairProfile.towel_technique) {
        store.setTowelTechnique(hairProfile.towel_technique as TowelTechnique)
      }
      if (Array.isArray(hairProfile.drying_method)) {
        store.setDryingMethod(hairProfile.drying_method as DryingMethod[])
      }
      if (hairProfile.brush_type) {
        store.setBrushType(hairProfile.brush_type as BrushType)
      }
      if (Array.isArray(hairProfile.night_protection)) {
        store.setNightProtection(hairProfile.night_protection as NightProtection[])
      }
      if (hairProfile.uses_heat_protection != null) {
        store.setUsesHeatProtection(hairProfile.uses_heat_protection as boolean)
      }
      if (Array.isArray(hairProfile.goals)) {
        store.setSelectedGoals(hairProfile.goals as string[])
      }
      if (hairProfile.desired_volume) {
        store.setDesiredVolume(hairProfile.desired_volume as DesiredVolume)
      }
    }

    // Resume scenario: populate product selections from user_product_usage rows
    if (productUsage.length > 0) {
      const basicValues = BASIC_PRODUCT_OPTIONS.map((o) => o.value)
      const extraValues = EXTRA_PRODUCT_OPTIONS.map((o) => o.value)
      const basics: string[] = []
      const extras: string[] = []

      for (const row of productUsage) {
        const cat = row.category as string
        if (basicValues.includes(cat)) basics.push(cat)
        else if (extraValues.includes(cat)) extras.push(cat)

        if (row.product_name || row.frequency_range) {
          store.setProductDrilldown(cat, {
            productName: (row.product_name as string) ?? "",
            frequency: (row.frequency_range as ProductFrequency) ?? null,
          })
        }
      }

      if (basics.length > 0) store.setSelectedBasicProducts(basics)
      if (extras.length > 0) store.setSelectedExtraProducts(extras)
    }

    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Save step to profiles.onboarding_step ──

  const saveOnboardingStep = useCallback(
    async (step: OnboardingStep) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_step: step })
        .eq("id", userId)
      if (error) throw error
    },
    [userId],
  )

  // ── Per-step save helpers ──

  const saveProductUsage = useCallback(
    async (categories: string[]) => {
      const supabase = createClient()
      const drilldowns = useOnboardingStore.getState().productDrilldowns

      // Get existing rows
      const { data: existing } = await supabase
        .from("user_product_usage")
        .select("id, category")
        .eq("user_id", userId)

      const existingMap = new Map(
        (existing ?? []).map((r: Record<string, unknown>) => [
          r.category as string,
          r.id as string,
        ]),
      )

      // Upsert selected categories
      for (const cat of categories) {
        const drilldown = drilldowns[cat]
        const payload = {
          user_id: userId,
          category: cat,
          product_name: drilldown?.productName ?? null,
          frequency_range: drilldown?.frequency ?? null,
        }

        if (existingMap.has(cat)) {
          await supabase.from("user_product_usage").update(payload).eq("id", existingMap.get(cat))
        } else {
          await supabase.from("user_product_usage").insert(payload)
        }
      }

      // Delete deselected categories
      const toDelete = (existing ?? [])
        .filter((r: Record<string, unknown>) => !categories.includes(r.category as string))
        .map((r: Record<string, unknown>) => r.id as string)

      if (toDelete.length > 0) {
        await supabase.from("user_product_usage").delete().in("id", toDelete)
      }
    },
    [userId],
  )

  const saveHairProfile = useCallback(
    async (fields: Record<string, unknown>) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("hair_profiles")
        .upsert({ user_id: userId, ...fields }, { onConflict: "user_id" })
      if (error) throw error
    },
    [userId],
  )

  // ── Step completion handler ──

  const handleStepComplete = useCallback(
    async (completedStep: OnboardingStep) => {
      if (savingRef.current) return
      savingRef.current = true

      // Safety net: auto-reset after 10s in case a save hangs
      const safetyTimeout = setTimeout(() => {
        savingRef.current = false
      }, 10000)

      try {
        const state = useOnboardingStore.getState()
        const supabase = createClient()

        switch (completedStep) {
          case "welcome":
            // No data to save, just advance
            break

          case "products_basics":
          case "products_extras": {
            const allProducts = [...state.selectedBasicProducts, ...state.selectedExtraProducts]
            await saveProductUsage(allProducts)
            break
          }

          case "product_drilldown": {
            const categories = state.drilldownCategories()
            const currentCat = categories[state.currentDrilldownIndex]
            if (!currentCat) break

            const drilldown = state.productDrilldowns[currentCat]
            if (!drilldown) break

            // Update the specific product usage row
            await supabase
              .from("user_product_usage")
              .update({
                product_name: drilldown.productName,
                frequency_range: drilldown.frequency,
              })
              .eq("user_id", userId)
              .eq("category", currentCat)

            // If shampoo, also update wash_frequency
            if (currentCat === "shampoo" && drilldown.frequency) {
              await saveHairProfile({
                wash_frequency: mapShampooFrequency(drilldown.frequency),
              })
            }
            break
          }

          case "heat_tools": {
            await saveHairProfile({
              styling_tools: state.selectedHeatTools,
            })
            // If no heat tools, clear heat-related fields
            if (state.selectedHeatTools.length === 0) {
              await saveHairProfile({
                heat_styling: "never",
                uses_heat_protection: false,
              })
            }
            break
          }

          case "heat_frequency": {
            if (state.heatFrequency) {
              await saveHairProfile({
                heat_styling: mapHeatFrequency(state.heatFrequency),
              })
            }
            break
          }

          case "heat_protection": {
            await saveHairProfile({
              uses_heat_protection: state.usesHeatProtection,
            })
            break
          }

          case "interstitial":
            // No data to save
            break

          case "towel_material": {
            await saveHairProfile({
              towel_material: state.towelMaterial,
            })
            break
          }

          case "towel_technique": {
            await saveHairProfile({
              towel_technique: state.towelTechnique,
            })
            break
          }

          case "drying_method": {
            const postWashActions = derivePostWashActions(
              state.dryingMethod,
              state.selectedHeatTools.length > 0,
            )
            const reconciledTools = reconcileDiffusor(state.selectedHeatTools, state.dryingMethod)
            await saveHairProfile({
              drying_method: state.dryingMethod,
              post_wash_actions: postWashActions,
              styling_tools: reconciledTools,
            })
            break
          }

          case "brush_type": {
            await saveHairProfile({
              brush_type: state.brushType,
            })
            break
          }

          case "night_protection": {
            const stressFactors = deriveMechanicalStressFactors(
              state.towelTechnique,
              state.brushType,
              state.nightProtection,
            )
            const answeredFields = await mergeAnsweredFields(supabase, userId, [
              "towel_material",
              "towel_technique",
              "drying_method",
              "brush_type",
              "night_protection",
              "styling_tools",
              "uses_heat_protection",
            ])
            await saveHairProfile({
              night_protection: state.nightProtection,
              mechanical_stress_factors: stressFactors,
              answered_fields: answeredFields,
            })
            break
          }

          case "goals": {
            const derivedGoals = deriveOnboardingGoals(
              state.selectedGoals as Goal[],
              state.desiredVolume,
            )
            const routineProducts = mapProductChecklistToRoutineProducts(
              state.allSelectedProducts(),
            )
            await saveHairProfile({
              goals: derivedGoals,
              desired_volume: state.desiredVolume,
              current_routine_products: routineProducts,
            })
            await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId)
            posthog.capture("onboarding_completed", { userId })
            break
          }

          case "celebration": {
            await supabase
              .from("profiles")
              .update({ has_seen_completion_popup: true })
              .eq("id", userId)
            router.push("/chat")
            return // Don't advance step
          }
        }

        // Advance the store
        state.goNext()

        // Save the new step (after goNext)
        const nextStep = useOnboardingStore.getState().currentStep
        await saveOnboardingStep(nextStep)
      } catch (err) {
        console.error("Failed to save onboarding step:", err)
        toast({ title: "Fehler beim Speichern. Bitte versuche es erneut.", variant: "destructive" })
      } finally {
        clearTimeout(safetyTimeout)
        savingRef.current = false
      }
    },
    [userId, router, toast, saveProductUsage, saveHairProfile, saveOnboardingStep],
  )

  // ── Toggle helpers ──

  const toggleBasicProduct = useCallback((value: string) => {
    const { selectedBasicProducts, setSelectedBasicProducts } = useOnboardingStore.getState()
    if (selectedBasicProducts.includes(value)) {
      setSelectedBasicProducts(selectedBasicProducts.filter((v) => v !== value))
    } else {
      setSelectedBasicProducts([...selectedBasicProducts, value])
    }
  }, [])

  const toggleExtraProduct = useCallback((value: string) => {
    const { selectedExtraProducts, setSelectedExtraProducts } = useOnboardingStore.getState()
    if (selectedExtraProducts.includes(value)) {
      setSelectedExtraProducts(selectedExtraProducts.filter((v) => v !== value))
    } else {
      setSelectedExtraProducts([...selectedExtraProducts, value])
    }
  }, [])

  const toggleHeatTool = useCallback((tool: string) => {
    const { selectedHeatTools, setSelectedHeatTools } = useOnboardingStore.getState()
    if (selectedHeatTools.includes(tool)) {
      setSelectedHeatTools(selectedHeatTools.filter((t) => t !== tool))
    } else {
      setSelectedHeatTools([...selectedHeatTools, tool])
    }
  }, [])

  const toggleGoal = useCallback((goal: string) => {
    const { selectedGoals, setSelectedGoals } = useOnboardingStore.getState()
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter((g) => g !== goal))
    } else {
      setSelectedGoals([...selectedGoals, goal])
    }
  }, [])

  const toggleNightProtection = useCallback((value: string) => {
    const { nightProtection, setNightProtection } = useOnboardingStore.getState()
    if (nightProtection.includes(value as NightProtection)) {
      setNightProtection(nightProtection.filter((v) => v !== value))
    } else {
      setNightProtection([...nightProtection, value as NightProtection])
    }
  }, [])

  const toggleDryingMethod = useCallback((value: string) => {
    const { dryingMethod, setDryingMethod } = useOnboardingStore.getState()
    if (dryingMethod.includes(value as DryingMethod)) {
      setDryingMethod(dryingMethod.filter((v) => v !== value))
    } else {
      setDryingMethod([...dryingMethod, value as DryingMethod])
    }
  }, [])

  // ── Don't render until hydrated ──

  if (!hydrated) {
    return null
  }

  // ── Add icons to options ──

  const fallbackIcon: IconName = "help"

  const towelMaterialWithIcon = TOWEL_MATERIAL_OPTIONS.map((o) => ({
    ...o,
    icon: TOWEL_MATERIAL_ICONS[o.value] ?? fallbackIcon,
  }))

  const towelTechniqueWithIcon = TOWEL_TECHNIQUE_OPTIONS.map((o) => ({
    ...o,
    icon: TOWEL_TECHNIQUE_ICONS[o.value] ?? fallbackIcon,
  }))

  const dryingMethodWithIcon = DRYING_METHOD_OPTIONS.map((o) => ({
    ...o,
    icon: DRYING_METHOD_ICONS[o.value] ?? fallbackIcon,
  }))

  const brushTypeWithIcon = BRUSH_TYPE_OPTIONS.map((o) => ({
    ...o,
    icon: BRUSH_TYPE_ICONS[o.value] ?? fallbackIcon,
  }))

  const nightProtectionWithIcon = NIGHT_PROTECTION_OPTIONS.filter(
    (o) => o.value !== "tight_hairstyles",
  ).map((o) => ({
    ...o,
    icon: NIGHT_PROTECTION_ICONS[o.value] ?? fallbackIcon,
  }))

  // ── Drilldown helpers ──

  const drilldownCategories = store.drilldownCategories()
  const currentCategory = drilldownCategories[store.currentDrilldownIndex]
  const currentDrilldown = currentCategory
    ? (store.productDrilldowns[currentCategory] ?? { productName: "", frequency: null })
    : { productName: "", frequency: null }

  // ── Screen rendering ──

  function renderScreen() {
    switch (store.currentStep) {
      case "welcome":
        return <WelcomeScreen onContinue={() => handleStepComplete("welcome")} />

      case "products_basics":
        return (
          <ProductChecklistScreen
            title="Deine Basis-Produkte"
            subtitle="Welche Produkte nutzt du regelmaessig?"
            options={BASIC_PRODUCT_OPTIONS}
            selected={store.selectedBasicProducts}
            onToggle={toggleBasicProduct}
            onContinue={() => handleStepComplete("products_basics")}
            onBack={() => store.goBack()}
          />
        )

      case "products_extras":
        return (
          <ProductChecklistScreen
            title="Weitere Produkte"
            subtitle="Nutzt du auch etwas davon?"
            options={EXTRA_PRODUCT_OPTIONS}
            selected={store.selectedExtraProducts}
            onToggle={toggleExtraProduct}
            onContinue={() => handleStepComplete("products_extras")}
            onBack={() => store.goBack()}
            noneLabel="Nichts davon"
            onNone={() => {
              store.setSelectedExtraProducts([])
              handleStepComplete("products_extras")
            }}
          />
        )

      case "product_drilldown":
        return currentCategory ? (
          <ProductDrilldownScreen
            category={currentCategory}
            categoryLabel={CATEGORY_LABELS[currentCategory] ?? currentCategory}
            subtitle={CATEGORY_SUBTITLES[currentCategory]}
            productName={currentDrilldown.productName}
            frequency={currentDrilldown.frequency}
            onProductNameChange={(name) =>
              store.setProductDrilldown(currentCategory, {
                ...currentDrilldown,
                productName: name,
              })
            }
            onFrequencyChange={(freq) =>
              store.setProductDrilldown(currentCategory, {
                ...currentDrilldown,
                frequency: freq,
              })
            }
            onContinue={() => handleStepComplete("product_drilldown")}
            onBack={() => store.goBack()}
          />
        ) : null

      case "heat_tools":
        return (
          <HeatToolsScreen
            selected={store.selectedHeatTools}
            onToggle={toggleHeatTool}
            onContinue={() => handleStepComplete("heat_tools")}
            onBack={() => store.goBack()}
            onNone={() => {
              store.setSelectedHeatTools([])
              handleStepComplete("heat_tools")
            }}
          />
        )

      case "heat_frequency":
        return (
          <HeatFrequencyScreen
            selected={store.heatFrequency}
            onSelect={(freq) => {
              store.setHeatFrequency(freq)
              handleStepComplete("heat_frequency")
            }}
            onBack={() => store.goBack()}
          />
        )

      case "heat_protection":
        return (
          <HeatProtectionScreen
            selected={store.usesHeatProtection}
            onSelect={(val) => {
              store.setUsesHeatProtection(val)
              handleStepComplete("heat_protection")
            }}
            onBack={() => store.goBack()}
          />
        )

      case "interstitial":
        return (
          <InterstitialScreen
            onContinue={() => handleStepComplete("interstitial")}
            onBack={() => store.goBack()}
          />
        )

      case "towel_material":
        return (
          <SingleSelectScreen
            title="Womit trocknest du dein Haar?"
            options={towelMaterialWithIcon}
            selected={store.towelMaterial}
            onSelect={(val) => {
              store.setTowelMaterial(val as TowelMaterial)
              handleStepComplete("towel_material")
            }}
            onBack={() => store.goBack()}
          />
        )

      case "towel_technique":
        return (
          <SingleSelectScreen
            title="Wie trocknest du?"
            subtitle="Rubbeln oder sanft tupfen?"
            options={towelTechniqueWithIcon}
            selected={store.towelTechnique}
            onSelect={(val) => {
              store.setTowelTechnique(val as TowelTechnique)
              handleStepComplete("towel_technique")
            }}
            onBack={() => store.goBack()}
          />
        )

      case "drying_method":
        return (
          <MultiSelectScreen
            title="Wie trocknest du dein Haar?"
            subtitle="Mehrfachauswahl moeglich."
            options={dryingMethodWithIcon}
            selected={store.dryingMethod}
            onToggle={toggleDryingMethod}
            onContinue={() => handleStepComplete("drying_method")}
            onBack={() => store.goBack()}
          />
        )

      case "brush_type":
        return (
          <SingleSelectScreen
            title="Welche Buerste nutzt du?"
            options={brushTypeWithIcon}
            selected={store.brushType}
            onSelect={(val) => {
              store.setBrushType(val as BrushType)
              handleStepComplete("brush_type")
            }}
            onBack={() => store.goBack()}
          />
        )

      case "night_protection":
        return (
          <MultiSelectScreen
            title="Wie schuetzt du dein Haar nachts?"
            subtitle="Mehrfachauswahl moeglich."
            options={nightProtectionWithIcon}
            selected={store.nightProtection}
            onToggle={toggleNightProtection}
            onContinue={() => handleStepComplete("night_protection")}
            onBack={() => store.goBack()}
            noneLabel="Nichts davon"
            onNone={() => {
              store.setNightProtection([])
              handleStepComplete("night_protection")
            }}
          />
        )

      case "goals":
        return (
          <GoalsScreen
            hairTexture={(hairProfile?.hair_texture as HairTexture) ?? null}
            selectedGoals={store.selectedGoals}
            desiredVolume={store.desiredVolume}
            onGoalToggle={toggleGoal}
            onVolumeChange={(vol) => store.setDesiredVolume(vol)}
            onContinue={() => handleStepComplete("goals")}
            onBack={() => store.goBack()}
          />
        )

      case "celebration":
        return <CelebrationPopup onDismiss={() => handleStepComplete("celebration")} />

      default:
        return null
    }
  }

  return (
    <div>
      {store.currentStep !== "welcome" && store.currentStep !== "celebration" && (
        <div className="mb-6">
          <OnboardingProgressBar currentStep={store.currentStep} />
        </div>
      )}
      {renderScreen()}
    </div>
  )
}
