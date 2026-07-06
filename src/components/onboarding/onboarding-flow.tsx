"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { useToast } from "@/providers/toast-provider"
import { createClient } from "@/lib/supabase/client"
import { emptyProductDrilldown, useOnboardingStore } from "@/lib/onboarding/store"
import type { OnboardingEditScope, OnboardingStep } from "@/lib/onboarding/store"
import { shouldHydrateStoredHeatProtection } from "@/lib/onboarding/heat-protection-hydration"
import { buildProductUsagePayloads } from "@/lib/onboarding/product-usage-save"
import { normalizeBrushTypeValues } from "@/lib/profile/brush-type"
import {
  isUnselectedShampooFallbackItem,
  SHAMPOO_CATEGORY,
} from "@/lib/product-usage/shampoo-fallback"
import { useOnboardingProductIntakeController } from "@/hooks/use-onboarding-product-intake-controller"
import { OnboardingProgressBar } from "@/components/onboarding/onboarding-progress-bar"
import { ProductReplacementDialog } from "@/components/onboarding/product-replacement-dialog"
import {
  BRUSH_TYPE_ICONS,
  CATEGORY_SUBTITLES,
  DRYING_METHOD_ICONS,
  NIGHT_PROTECTION_ICONS,
  TOWEL_MATERIAL_ICONS,
  TOWEL_TECHNIQUE_ICONS,
} from "@/components/onboarding/onboarding-display-config"
import {
  getFinalContinueLabel,
  shouldReturnAfterScopeStep,
} from "@/components/onboarding/onboarding-flow-navigation"
import {
  BASIC_PRODUCT_OPTIONS,
  EXTRA_PRODUCT_OPTIONS,
  PRODUCT_CATEGORY_DRILLDOWN_TITLES,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/onboarding/product-options"
import { normalizeProductFrequency } from "@/lib/vocabulary"
import type { HeatStyling } from "@/lib/vocabulary"

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
  CelebrationPopup,
} from "@/components/onboarding/screens"

// Import option data for care habit screens
import {
  TOWEL_MATERIAL_OPTIONS,
  TOWEL_TECHNIQUE_OPTIONS,
  DRYING_METHOD_OPTIONS,
  BRUSH_TYPE_OPTIONS,
  NIGHT_PROTECTION_OPTIONS,
  normalizeNightProtectionValues,
  normalizeTowelTechniqueValue,
} from "@/lib/vocabulary/onboarding-care"
import type {
  TowelMaterial,
  TowelTechnique,
  DryingMethod,
  BrushType,
  NightProtection,
} from "@/lib/vocabulary/onboarding-care"
import type { IconName } from "@/components/ui/icon"

const SAVE_TIMEOUT_MS = 15_000
const SAVE_TIMEOUT_MESSAGE =
  "Speichern dauert zu lange. Bitte pruefe deine Verbindung und versuche es erneut."
const SAVE_ERROR_MESSAGE = "Fehler beim Speichern. Bitte versuche es erneut."
class SaveTimeoutError extends Error {
  constructor() {
    super(SAVE_TIMEOUT_MESSAGE)
    this.name = "SaveTimeoutError"
  }
}

type ProductReplacementConflict = {
  step: "product_drilldown"
}

/* ── Props ── */

interface OnboardingFlowProps {
  userId: string
  initialStep: string
  onboardingCompleted: boolean
  hairProfile: Record<string, unknown> | null
  productUsage: Array<Record<string, unknown>>
  returnTo?: string | null
  editScope?: OnboardingEditScope | null
  singleStepEdit?: boolean
  initialDrilldownCategory?: string | null
  productIntakeEnabled?: boolean
  allowCompletionFallback?: boolean
}

/* ── Component ── */

export function OnboardingFlow({
  userId,
  initialStep,
  onboardingCompleted,
  hairProfile,
  productUsage,
  returnTo = null,
  editScope = null,
  singleStepEdit = false,
  initialDrilldownCategory = null,
  productIntakeEnabled = false,
  allowCompletionFallback = false,
}: OnboardingFlowProps) {
  const { toast } = useToast()
  const store = useOnboardingStore()
  const productIntake = useOnboardingProductIntakeController(productIntakeEnabled)
  const [hydrated, setHydrated] = useState(false)
  const [savingStep, setSavingStep] = useState<OnboardingStep | null>(null)
  const [productReplacementConflict, setProductReplacementConflict] =
    useState<ProductReplacementConflict | null>(null)
  const initRef = useRef(false)
  const savingStepsRef = useRef<Set<OnboardingStep>>(new Set())
  const stepSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      clearTimeout(stepSaveTimerRef.current)
    }
  }, [])

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
      if (hairProfile.heat_styling) {
        store.setHeatFrequency(hairProfile.heat_styling as HeatStyling)
      }
      if (hairProfile.towel_material) {
        store.setTowelMaterial(hairProfile.towel_material as TowelMaterial)
      }
      if (typeof hairProfile.towel_technique === "string") {
        store.setTowelTechnique(normalizeTowelTechniqueValue(hairProfile.towel_technique))
      }
      if (typeof hairProfile.drying_method === "string") {
        store.setDryingMethod(hairProfile.drying_method as DryingMethod)
      } else if (Array.isArray(hairProfile.drying_method) && hairProfile.drying_method.length > 0) {
        store.setDryingMethod(hairProfile.drying_method[0] as DryingMethod)
      }
      const storedBrushTypes = normalizeBrushTypeValues(hairProfile.brush_type)
      if (storedBrushTypes) {
        store.setBrushType(storedBrushTypes)
      }
      if (Array.isArray(hairProfile.night_protection)) {
        store.setNightProtection(normalizeNightProtectionValues(hairProfile.night_protection) ?? [])
      }
      if (
        shouldHydrateStoredHeatProtection({
          storedValue:
            typeof hairProfile.uses_heat_protection === "boolean"
              ? hairProfile.uses_heat_protection
              : null,
          initialStep: step,
          onboardingCompleted,
          editScope,
          singleStepEdit,
        })
      ) {
        store.setUsesHeatProtection(hairProfile.uses_heat_protection as boolean)
      }
    }

    // Resume scenario: populate product selections from user_product_usage rows
    const basicValues = BASIC_PRODUCT_OPTIONS.map((o) => o.value)
    const extraValues = EXTRA_PRODUCT_OPTIONS.map((o) => o.value)
    const basics: string[] = []
    const extras: string[] = []

    if (productUsage.length > 0) {
      for (const row of productUsage) {
        const cat = row.category as string
        const productName = typeof row.product_name === "string" ? row.product_name : null
        const frequency = normalizeProductFrequency((row.frequency_range as string | null) ?? null)

        if (
          isUnselectedShampooFallbackItem({
            category: cat,
            product_name: productName,
            frequency_range: frequency,
          })
        ) {
          continue
        }

        if (basicValues.includes(cat)) basics.push(cat)
        else if (extraValues.includes(cat)) extras.push(cat)

        if (row.product_name || row.frequency_range) {
          store.setProductDrilldown(
            cat,
            productIntake.drilldownFromUsageRow(row, productName ?? "", frequency),
          )
        }
      }
    }

    if (step === "product_drilldown" && initialDrilldownCategory) {
      if (
        basicValues.includes(initialDrilldownCategory) &&
        !basics.includes(initialDrilldownCategory)
      ) {
        basics.push(initialDrilldownCategory)
      } else if (
        extraValues.includes(initialDrilldownCategory) &&
        !extras.includes(initialDrilldownCategory)
      ) {
        extras.push(initialDrilldownCategory)
      }
    }

    if (basics.length > 0) store.setSelectedBasicProducts(basics)
    if (extras.length > 0) store.setSelectedExtraProducts(extras)

    if (step === "product_drilldown" && initialDrilldownCategory) {
      const orderedCategories = [...basics, ...extras]
      const targetIndex = orderedCategories.indexOf(initialDrilldownCategory)
      if (targetIndex >= 0) {
        store.setCurrentDrilldownIndex(targetIndex)
      }
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
    async (categories: string[], signal?: AbortSignal) => {
      const supabase = createClient()
      const drilldowns = useOnboardingStore.getState().productDrilldowns

      // Get existing rows
      const existingQuery = supabase
        .from("user_product_usage")
        .select("id, category")
        .eq("user_id", userId)
      const { data: existing, error: existingError } = await withAbortSignal(existingQuery, signal)

      if (existingError) throw existingError

      const existingMap = new Map(
        (existing ?? []).map((r: Record<string, unknown>) => [
          r.category as string,
          r.id as string,
        ]),
      )

      const payloads = buildProductUsagePayloads({
        selectedCategories: categories,
        drilldowns,
      })

      // Upsert selected categories plus the canonical shampoo fallback row.
      for (const usagePayload of payloads) {
        const payload = {
          user_id: userId,
          ...usagePayload,
        }

        if (existingMap.has(usagePayload.category)) {
          const updateQuery = supabase
            .from("user_product_usage")
            .update(payload)
            .eq("id", existingMap.get(usagePayload.category))
          const { error: updateError } = await withAbortSignal(updateQuery, signal)
          if (updateError) throw updateError
        } else {
          const insertQuery = supabase.from("user_product_usage").insert(payload)
          const { error: insertError } = await withAbortSignal(insertQuery, signal)
          if (insertError) throw insertError
        }
      }

      const directDeleteIds = await productIntake.cancelDeselectedCategories(
        existing ?? [],
        categories,
        signal,
      )

      if (directDeleteIds.length > 0) {
        const deleteQuery = supabase.from("user_product_usage").delete().in("id", directDeleteIds)
        const { error: deleteError } = await withAbortSignal(deleteQuery, signal)
        if (deleteError) throw deleteError
      }
    },
    [productIntake, userId],
  )

  const saveHairProfile = useCallback(
    async (fields: Record<string, unknown>, signal?: AbortSignal) => {
      const supabase = createClient()
      const payload = { user_id: userId, ...fields }
      const upsertQuery = supabase.from("hair_profiles").upsert(payload, { onConflict: "user_id" })
      const { error } = await withAbortSignal(upsertQuery, signal)

      if (error && error.code === "22P02" && typeof fields.drying_method === "string") {
        const retryQuery = supabase
          .from("hair_profiles")
          .upsert({ ...payload, drying_method: [fields.drying_method] }, { onConflict: "user_id" })
        const { error: retryError } = await withAbortSignal(retryQuery, signal)

        if (!retryError) return
        throw retryError
      }

      if (error) throw error
    },
    [userId],
  )

  // ── Step completion handler ──

  const handleStepComplete = useCallback(
    async (completedStep: OnboardingStep, options: { replaceExistingConfirmed?: boolean } = {}) => {
      if (savingStepsRef.current.has(completedStep)) return
      savingStepsRef.current.add(completedStep)
      setSavingStep(completedStep)

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
            await withSaveTimeout((signal) => saveProductUsage(allProducts, signal))
            break
          }

          case "product_drilldown": {
            const categories = state.drilldownCategories()
            const currentCat = categories[state.currentDrilldownIndex]
            if (!currentCat) break

            const drilldown = state.productDrilldowns[currentCat]
            if (!drilldown) break

            if (!productIntakeEnabled || !productIntake.isSupportedCategory(currentCat)) {
              const { error: productUsageError } = await supabase
                .from("user_product_usage")
                .update({
                  product_name: drilldown.productName,
                  frequency_range: drilldown.frequency,
                })
                .eq("user_id", userId)
                .eq("category", currentCat)

              if (productUsageError) throw productUsageError
              break
            }

            const productIntakeResult = await withSaveTimeout((signal) =>
              productIntake.submitDrilldown(
                currentCat,
                drilldown,
                options.replaceExistingConfirmed,
                signal,
              ),
            )
            if (!productIntakeResult) break
            if (productIntakeResult.status === "replace_conflict") {
              setProductReplacementConflict({ step: "product_drilldown" })
              return
            }
            if (productIntakeResult.usageId) {
              useOnboardingStore.getState().setProductDrilldown(currentCat, {
                existingUsageId: productIntakeResult.usageId,
                frontImagePath: null,
                committedFrontImagePath: productIntakeResult.frontImagePath,
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
                heat_styling: state.heatFrequency,
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
              ...(state.towelMaterial === "no_towel" ? { towel_technique: null } : {}),
            })
            break
          }

          case "towel_technique": {
            await saveHairProfile({
              towel_technique: normalizeTowelTechniqueValue(state.towelTechnique),
            })
            break
          }

          case "drying_method": {
            await saveHairProfile({
              drying_method: state.dryingMethod,
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
            await withSaveTimeout(async (signal) => {
              await saveHairProfile(
                {
                  night_protection: normalizeNightProtectionValues(state.nightProtection) ?? [],
                },
                signal,
              )

              const completionQuery = supabase
                .from("profiles")
                .update({ onboarding_completed: true, onboarding_step: "celebration" })
                .eq("id", userId)
              const { error: onboardingCompletedError } = await withAbortSignal(
                completionQuery,
                signal,
              )

              if (onboardingCompletedError) throw onboardingCompletedError
            })

            if (!returnTo) {
              trackAppEvent("onboarding_completed", { userId })
            }
            break
          }

          case "celebration": {
            const { error: completionPopupError } = await supabase
              .from("profiles")
              .update({
                has_seen_completion_popup: true,
                ...(allowCompletionFallback
                  ? {
                      onboarding_completed: true,
                      onboarding_step: "celebration",
                    }
                  : {}),
              })
              .eq("id", userId)

            if (completionPopupError) throw completionPopupError
            if (returnTo) {
              window.location.assign(returnTo)
              return
            }
            window.location.assign("/chat")
            return // Don't advance step
          }
        }

        if (returnTo && singleStepEdit) {
          window.location.assign(returnTo)
          return
        }

        if (returnTo && shouldReturnAfterScopeStep(completedStep, state, editScope)) {
          window.location.assign(returnTo)
          return
        }

        // Advance the store
        state.goNext()

        // Persist step progress in background (non-blocking).
        // Debounce so rapid step transitions only write the latest step,
        // preventing an older in-flight request from overwriting a newer one.
        clearTimeout(stepSaveTimerRef.current)
        const nextStep = useOnboardingStore.getState().currentStep
        stepSaveTimerRef.current = setTimeout(() => {
          saveOnboardingStep(nextStep).catch((err) => {
            console.error("Failed to persist onboarding step:", err)
          })
        }, 50)
      } catch (err) {
        console.error("Failed to save onboarding step:", err)
        toast({ title: userFacingSaveError(err), variant: "destructive" })
      } finally {
        savingStepsRef.current.delete(completedStep)
        setSavingStep(null)
      }
    },
    [
      userId,
      toast,
      saveProductUsage,
      saveHairProfile,
      saveOnboardingStep,
      productIntake,
      productIntakeEnabled,
      returnTo,
      editScope,
      singleStepEdit,
      allowCompletionFallback,
    ],
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

  const toggleNightProtection = useCallback((value: string) => {
    const { nightProtection, setNightProtection } = useOnboardingStore.getState()
    if (nightProtection.includes(value as NightProtection)) {
      setNightProtection(nightProtection.filter((v) => v !== value))
    } else {
      setNightProtection([...nightProtection, value as NightProtection])
    }
  }, [])

  const toggleBrushType = useCallback((value: string) => {
    const { brushType, setBrushType } = useOnboardingStore.getState()
    const selectedBrushTypes = brushType ?? []
    if (selectedBrushTypes.includes(value as BrushType)) {
      setBrushType(selectedBrushTypes.filter((v) => v !== value))
    } else {
      setBrushType([...selectedBrushTypes, value as BrushType])
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

  const nightProtectionWithIcon = NIGHT_PROTECTION_OPTIONS.map((o) => ({
    ...o,
    icon: NIGHT_PROTECTION_ICONS[o.value] ?? fallbackIcon,
    infoTipId:
      o.value === "silk_satin_bonnet"
        ? ("routine.bonnet" as const)
        : o.value === "pineapple"
          ? ("routine.pineapple" as const)
          : undefined,
  }))

  // ── Drilldown helpers ──

  const drilldownCategories = store.drilldownCategories()
  const currentCategory = drilldownCategories[store.currentDrilldownIndex]
  const currentDrilldown = currentCategory
    ? (store.productDrilldowns[currentCategory] ?? emptyProductDrilldown())
    : emptyProductDrilldown()
  const backTarget = singleStepEdit && returnTo ? returnTo : null

  function handleBack() {
    if (backTarget) {
      window.location.assign(backTarget)
      return
    }
    store.goBack()
  }

  // ── Screen rendering ──

  function renderScreen() {
    switch (store.currentStep) {
      case "welcome":
        return <WelcomeScreen onContinue={() => handleStepComplete("welcome")} />

      case "products_basics":
        return (
          <ProductChecklistScreen
            title="Deine Basis-Produkte"
            subtitle="Was kommt aktuell in deiner Basis-Routine vor?"
            options={BASIC_PRODUCT_OPTIONS}
            selected={store.selectedBasicProducts}
            onToggle={toggleBasicProduct}
            onContinue={() => handleStepComplete("products_basics")}
            onBack={handleBack}
            isSaving={savingStep === "products_basics"}
          />
        )

      case "products_extras":
        return (
          <ProductChecklistScreen
            title="Weitere Produkte"
            subtitle="Was nutzt du außerdem regelmäßig?"
            options={EXTRA_PRODUCT_OPTIONS}
            selected={store.selectedExtraProducts}
            onToggle={toggleExtraProduct}
            onContinue={() => handleStepComplete("products_extras")}
            onBack={handleBack}
            noneLabel="Nichts davon"
            onNone={() => {
              store.setSelectedExtraProducts([])
              handleStepComplete("products_extras")
            }}
            isSaving={savingStep === "products_extras"}
          />
        )

      case "product_drilldown":
        return currentCategory ? (
          <ProductDrilldownScreen
            category={currentCategory}
            categoryLabel={PRODUCT_CATEGORY_LABELS[currentCategory] ?? currentCategory}
            categoryTitle={PRODUCT_CATEGORY_DRILLDOWN_TITLES[currentCategory]}
            infoTipId={
              [...BASIC_PRODUCT_OPTIONS, ...EXTRA_PRODUCT_OPTIONS].find(
                (option) => option.value === currentCategory,
              )?.infoTipId
            }
            subtitle={CATEGORY_SUBTITLES[currentCategory]}
            intakeMethod={currentDrilldown.intakeMethod}
            productName={currentDrilldown.productName}
            brandText={currentDrilldown.brandText}
            frequency={currentDrilldown.frequency}
            frontImagePath={currentDrilldown.frontImagePath}
            committedFrontImagePath={currentDrilldown.committedFrontImagePath}
            existingUsageId={currentDrilldown.existingUsageId}
            barcodeImagePath={currentDrilldown.barcodeImagePath}
            isSupportedIntakeCategory={productIntake.isSupportedCategory(currentCategory)}
            productIntakeEnabled={productIntakeEnabled}
            isSaving={savingStep === "product_drilldown"}
            onIntakeMethodChange={(method) =>
              store.setProductDrilldown(currentCategory, {
                ...currentDrilldown,
                intakeMethod: method,
              })
            }
            onBrandTextChange={({ brandText, brandId, productLineId }) =>
              store.setProductDrilldown(currentCategory, {
                ...currentDrilldown,
                brandText,
                brandId,
                productLineId,
              })
            }
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
            onUploadImage={async (kind, file) => {
              const uploadPatch = await productIntake.uploadImagePatch(kind, file)
              store.setProductDrilldown(currentCategory, {
                ...useOnboardingStore.getState().productDrilldowns[currentCategory],
                ...uploadPatch,
              })
            }}
            onContinue={() => handleStepComplete("product_drilldown")}
            onBack={handleBack}
            continueLabel={getFinalContinueLabel(
              "product_drilldown",
              store,
              editScope,
              singleStepEdit,
              returnTo,
            )}
          />
        ) : null

      case "heat_tools":
        return (
          <HeatToolsScreen
            selected={store.selectedHeatTools}
            onToggle={toggleHeatTool}
            onContinue={() => handleStepComplete("heat_tools")}
            onBack={handleBack}
            onNone={() => {
              store.setSelectedHeatTools([])
              handleStepComplete("heat_tools")
            }}
            isSaving={savingStep === "heat_tools"}
            noneLabel={
              editScope === "styling" || singleStepEdit
                ? "Keine Hitzetools speichern"
                : "Nichts davon"
            }
            continueLabel={getFinalContinueLabel(
              "heat_tools",
              store,
              editScope,
              singleStepEdit,
              returnTo,
            )}
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
            onBack={handleBack}
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
            onBack={handleBack}
          />
        )

      case "interstitial":
        return (
          <InterstitialScreen
            onContinue={() => handleStepComplete("interstitial")}
            onBack={handleBack}
          />
        )

      case "towel_material":
        return (
          <SingleSelectScreen
            title="Womit trocknest du dein Haar?"
            subtitle="Dein Handtuch beeinflusst Frizz und Haarbruch mehr als du denkst."
            options={towelMaterialWithIcon}
            selected={store.towelMaterial}
            onSelect={(val) => {
              const towelMaterial = val as TowelMaterial
              store.setTowelMaterial(towelMaterial)
              if (towelMaterial === "no_towel") {
                store.setTowelTechnique(null)
              }
              handleStepComplete("towel_material")
            }}
            onBack={handleBack}
          />
        )

      case "towel_technique":
        return (
          <SingleSelectScreen
            title="Wie gehst du mit dem Handtuch meistens vor?"
            subtitle="Rubbeln oder sanft ausdrücken?"
            titleInfoTipId="routine.towel_technique"
            titleInfoLabel="Info zu sanftem Trocknen"
            options={towelTechniqueWithIcon}
            selected={store.towelTechnique}
            onSelect={(val) => {
              store.setTowelTechnique(val as TowelTechnique)
              handleStepComplete("towel_technique")
            }}
            onBack={handleBack}
          />
        )

      case "drying_method":
        return (
          <SingleSelectScreen
            title="Wie trocknest du dein Haar hauptsächlich?"
            subtitle="Hitze ist der größte Stressfaktor — wir passen deinen Plan daran an."
            titleInfoTipId="routine.diffuser"
            titleInfoLabel="Info zu Diffusor"
            options={dryingMethodWithIcon}
            selected={store.dryingMethod}
            onSelect={(val) => {
              store.setDryingMethod(val as DryingMethod)
              handleStepComplete("drying_method")
            }}
            onBack={handleBack}
          />
        )

      case "brush_type":
        return (
          <MultiSelectScreen
            title="Welche Bürsten oder Kämme nutzt du?"
            subtitle="Mehrfachauswahl möglich. Wähle alles aus, was du regelmäßig nutzt."
            options={brushTypeWithIcon}
            selected={store.brushType ?? []}
            onToggle={toggleBrushType}
            onContinue={() => handleStepComplete("brush_type")}
            onBack={handleBack}
            continueLabel={getFinalContinueLabel(
              "brush_type",
              store,
              editScope,
              singleStepEdit,
              returnTo,
            )}
            noneLabel={
              editScope === "routine" || singleStepEdit
                ? "Keine regelmäßige Bürste speichern"
                : "Nichts davon"
            }
            onNone={() => {
              store.setBrushType([])
              handleStepComplete("brush_type")
            }}
            isSaving={savingStep === "brush_type"}
          />
        )

      case "night_protection":
        return (
          <MultiSelectScreen
            title="Wie schützt du dein Haar nachts?"
            subtitle="Mehrfachauswahl möglich. Wähle alles aus, was du nachts nutzt."
            options={nightProtectionWithIcon}
            selected={store.nightProtection}
            onToggle={toggleNightProtection}
            onContinue={() => handleStepComplete("night_protection")}
            onBack={handleBack}
            noneLabel={
              editScope === "routine" || singleStepEdit
                ? "Ohne Nachtschutz speichern"
                : "Nichts davon"
            }
            onNone={() => {
              store.setNightProtection([])
              handleStepComplete("night_protection")
            }}
            isSaving={savingStep === "night_protection"}
            continueLabel={getFinalContinueLabel(
              "night_protection",
              store,
              editScope,
              singleStepEdit,
              returnTo,
            )}
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
          <OnboardingProgressBar
            currentStep={store.currentStep}
            currentDrilldownIndex={store.currentDrilldownIndex}
            drilldownCount={store.drilldownCategories().length}
            selectedHeatTools={store.selectedHeatTools}
            towelMaterial={store.towelMaterial}
          />
        </div>
      )}
      {renderScreen()}
      {productReplacementConflict ? (
        <ProductReplacementDialog
          disabled={savingStep !== null}
          onCancel={() => setProductReplacementConflict(null)}
          onConfirm={() => {
            const conflict = productReplacementConflict
            setProductReplacementConflict(null)
            void handleStepComplete(conflict.step, { replaceExistingConfirmed: true })
          }}
        />
      ) : null}
    </div>
  )
}

function withAbortSignal<T>(query: T, signal?: AbortSignal): T {
  if (!signal) return query
  return (query as { abortSignal: (signal: AbortSignal) => T }).abortSignal(signal)
}

function withSaveTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined

  return Promise.race([
    operation(controller.signal),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort()
        reject(new SaveTimeoutError())
      }, SAVE_TIMEOUT_MS)
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout)
  })
}

function userFacingSaveError(err: unknown): string {
  return err instanceof SaveTimeoutError ? SAVE_TIMEOUT_MESSAGE : SAVE_ERROR_MESSAGE
}
