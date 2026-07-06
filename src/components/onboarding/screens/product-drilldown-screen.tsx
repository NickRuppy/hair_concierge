"use client"

import { useId, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import {
  ProductIntakeBrandProductFields,
  ProductIntakeImageFields,
  ProductIntakeMethodToggle,
} from "@/components/product-intake/product-intake-form-fields"
import { DiscreteSlider } from "@/components/ui/slider"
import { PRODUCT_FREQUENCY_OPTIONS } from "@/lib/vocabulary"
import type { ProductFrequency } from "@/lib/vocabulary"
import {
  canSubmitProductIntake,
  selectedProductIntakeBrandOptionForText,
  type ProductIntakeImageKind,
} from "@/lib/product-intake/client"
import { useProductIntakeBrandOptions } from "@/hooks/use-product-intake-brand-options"
import type { OnboardingProductIntakeMethod } from "@/lib/onboarding/store"

const PRODUCT_FREQUENCY_SLIDER_STOPS = PRODUCT_FREQUENCY_OPTIONS.map((option) => ({
  ...option,
  shortLabel: option.label
    .replace("Seltener als 1x/Monat", "<1x/M")
    .replace("Ca. 1x/Monat", "1x/M")
    .replace("Ca. alle 2 Wochen", "2W")
    .replace("1x/Woche", "1x/W")
    .replace("2x/Woche", "2x/W")
    .replace("3-4x/Woche", "3-4x/W")
    .replace("5-6x/Woche", "5-6x/W")
    .replace("Täglich", "tgl."),
}))
import { InfoTip } from "@/components/ui/info-tip"
import { INFO_TIPS, type InfoTipId } from "@/lib/help/info-tips"

interface ProductDrilldownScreenProps {
  category: string
  categoryLabel: string
  categoryTitle?: string
  infoTipId?: InfoTipId
  subtitle?: string
  intakeMethod: OnboardingProductIntakeMethod | null
  productName: string
  brandText: string
  frequency: ProductFrequency | null
  frontImagePath: string | null
  committedFrontImagePath: string | null
  existingUsageId: string | null
  barcodeImagePath: string | null
  isSupportedIntakeCategory: boolean
  productIntakeEnabled: boolean
  isSaving?: boolean
  onIntakeMethodChange: (method: OnboardingProductIntakeMethod) => void
  onBrandTextChange: (value: {
    brandText: string
    brandId: string | null
    productLineId: string | null
  }) => void
  onProductNameChange: (name: string) => void
  onFrequencyChange: (freq: ProductFrequency) => void
  onUploadImage: (kind: ProductIntakeImageKind, file: File) => Promise<void>
  onContinue: () => void
  onBack: () => void
  continueLabel?: string
}

function hasRequiredFields(params: {
  intakeMethod: OnboardingProductIntakeMethod | null
  brandText: string
  productName: string
  frequency: ProductFrequency | null
  frontImagePath: string | null
  committedFrontImagePath: string | null
  existingUsageId: string | null
  isSupportedIntakeCategory: boolean
}) {
  if (!params.frequency) return false
  if (!params.isSupportedIntakeCategory) return params.productName.trim().length > 0
  return canSubmitProductIntake({
    method: params.intakeMethod,
    category: params.isSupportedIntakeCategory ? "supported" : null,
    frequency: params.frequency,
    brandText: params.brandText,
    productName: params.productName,
    frontImagePath: params.frontImagePath,
    committedFrontImagePath: params.committedFrontImagePath,
    existingUsageId: params.existingUsageId,
  })
}

export function ProductDrilldownScreen({
  category,
  categoryLabel,
  categoryTitle,
  infoTipId,
  subtitle,
  intakeMethod,
  productName,
  brandText,
  frequency,
  frontImagePath,
  committedFrontImagePath,
  existingUsageId,
  barcodeImagePath,
  isSupportedIntakeCategory,
  productIntakeEnabled,
  isSaving = false,
  onIntakeMethodChange,
  onBrandTextChange,
  onProductNameChange,
  onFrequencyChange,
  onUploadImage,
  onContinue,
  onBack,
  continueLabel = "Weiter",
}: ProductDrilldownScreenProps) {
  const brandListId = useId()
  const [uploading, setUploading] = useState<ProductIntakeImageKind | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const shouldUseProductIntake = productIntakeEnabled && isSupportedIntakeCategory
  const selectedMethod = shouldUseProductIntake ? intakeMethod : "manual"
  const brandOptions = useProductIntakeBrandOptions(brandText, shouldUseProductIntake)

  const canContinue = useMemo(
    () =>
      hasRequiredFields({
        intakeMethod: selectedMethod,
        brandText,
        productName,
        frequency,
        frontImagePath,
        committedFrontImagePath,
        existingUsageId,
        isSupportedIntakeCategory: shouldUseProductIntake,
      }),
    [
      brandText,
      committedFrontImagePath,
      existingUsageId,
      frequency,
      frontImagePath,
      productName,
      selectedMethod,
      shouldUseProductIntake,
    ],
  )

  async function handleUpload(kind: ProductIntakeImageKind, file: File | undefined) {
    if (!file) return
    setUploading(kind)
    setUploadError(null)

    try {
      await onUploadImage(kind, file)
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.",
      )
    } finally {
      setUploading(null)
    }
  }

  function handleBrandTextChange(value: string) {
    const selectedOption = selectedProductIntakeBrandOptionForText(brandOptions, value)
    onBrandTextChange({
      brandText: value,
      brandId: selectedOption?.brand_id ?? null,
      productLineId: selectedOption?.product_line_id ?? null,
    })
  }
  const tip = infoTipId ? INFO_TIPS[infoTipId] : null

  return (
    <div>
      <button
        onClick={onBack}
        aria-label="Zurück"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="animate-fade-in-up mb-2 flex items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 font-header text-3xl leading-tight text-foreground">
          {categoryTitle ?? `Dein ${categoryLabel}`}
        </h1>
        {tip && (
          <div className="mt-1 flex shrink-0 justify-end">
            <InfoTip
              title={tip.title}
              body={tip.body}
              label={`Info zu ${categoryLabel}`}
              buttonClassName="h-7 w-7"
            />
          </div>
        )}
      </div>

      <p
        className="animate-fade-in-up text-sm text-[var(--text-sub)] mb-6"
        style={{ animationDelay: "50ms" }}
      >
        {subtitle ?? "Welches Produkt nutzt du und wie oft?"}
      </p>

      {shouldUseProductIntake ? (
        <ProductIntakeMethodToggle
          value={selectedMethod}
          onChange={onIntakeMethodChange}
          className="animate-fade-in-up mb-5 grid grid-cols-2 gap-2"
          buttonClassName="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
        />
      ) : null}

      {selectedMethod === "photo" && shouldUseProductIntake ? (
        <div className="animate-fade-in-up space-y-3 mb-6" style={{ animationDelay: "120ms" }}>
          <ProductIntakeImageFields
            frontReady={Boolean(frontImagePath || committedFrontImagePath)}
            barcodeReady={Boolean(barcodeImagePath)}
            uploading={uploading}
            uploadError={uploadError}
            onUpload={handleUpload}
            labelClassName="block rounded-xl border border-border bg-muted p-4 text-sm font-medium text-foreground"
            statusClassName="flex items-center gap-2 text-sm text-[var(--text-sub)]"
            errorClassName="text-sm text-destructive"
          />

          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium text-foreground">
              Optionale Zusatzinfos{" "}
              <span className="font-normal text-muted-foreground">
                helfen uns, dein Produkt schneller zu erkennen.
              </span>
            </p>
            <ProductIntakeBrandProductFields
              brandText={brandText}
              productName={productName}
              brandOptions={brandOptions}
              brandListId={brandListId}
              brandLabel="Marke"
              productLabel="Produktname"
              brandPlaceholder="Marke (optional)"
              productPlaceholder="Produktname (optional)"
              onBrandTextChange={handleBrandTextChange}
              onProductNameChange={onProductNameChange}
              wrapperClassName="space-y-3"
              labelTextClassName="sr-only"
              inputClassName="w-full rounded-xl border border-border bg-muted px-4 py-3 text-base text-foreground placeholder:text-[var(--text-caption)] focus:border-[var(--brand-plum)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-plum)]/30 transition-colors"
            />
          </div>
        </div>
      ) : null}

      {selectedMethod === "manual" || !isSupportedIntakeCategory ? (
        <div className="animate-fade-in-up space-y-3 mb-6" style={{ animationDelay: "120ms" }}>
          {shouldUseProductIntake ? (
            <ProductIntakeBrandProductFields
              brandText={brandText}
              productName={productName}
              brandOptions={brandOptions}
              brandListId={brandListId}
              brandLabel="Marke"
              productLabel="Produktname"
              brandPlaceholder="z.B. Garnier"
              productPlaceholder="z.B. Fructis Hair Food Aloe Vera"
              onBrandTextChange={handleBrandTextChange}
              onProductNameChange={onProductNameChange}
              wrapperClassName="space-y-3"
              inputClassName="w-full rounded-xl border border-border bg-muted px-4 py-3 text-base text-foreground placeholder:text-[var(--text-caption)] focus:border-[var(--brand-plum)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-plum)]/30 transition-colors"
            />
          ) : (
            <input
              type="text"
              value={productName}
              onChange={(event) => onProductNameChange(event.target.value)}
              placeholder="z.B. Produktname oder Marke"
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-base text-foreground placeholder:text-[var(--text-caption)] focus:border-[var(--brand-plum)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-plum)]/30 transition-colors"
            />
          )}
        </div>
      ) : null}

      <div className="animate-fade-in-up mb-8" style={{ animationDelay: "160ms" }}>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-[var(--text-sub)]">Wie oft?</p>
          <p className="text-sm text-muted-foreground">
            {frequency
              ? PRODUCT_FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label
              : "Bitte auswählen"}
          </p>
        </div>
        <DiscreteSlider
          stops={PRODUCT_FREQUENCY_SLIDER_STOPS}
          value={frequency ?? undefined}
          onValueChange={(value) => onFrequencyChange(value as ProductFrequency)}
          aria-label="Nutzungshäufigkeit"
        />
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "220ms" }}>
        <button
          onClick={onContinue}
          disabled={!canContinue || isSaving || uploading !== null}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Speichern..." : continueLabel}
        </button>
      </div>

      <input type="hidden" name="product-category" value={category} />
    </div>
  )
}
