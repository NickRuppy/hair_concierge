"use client"

import { useId, useMemo, useState } from "react"
import {
  PRODUCT_CATEGORY_DISPLAY_LABELS,
  SUPPORTED_PRODUCT_CATEGORY_KEYS,
} from "@/lib/product-identity"
import {
  ProductIntakeBrandProductFields,
  ProductIntakeImageFields,
  ProductIntakeMethodToggle,
} from "@/components/product-intake/product-intake-form-fields"
import {
  buildProductIntakeSubmissionPayload,
  canSubmitProductIntake,
  selectedProductIntakeBrandOptionForText,
  uploadProductIntakeImage,
  type ProductIntakeImageKind,
  type ProductIntakeMethod,
  type ProductIntakeResponseBody,
} from "@/lib/product-intake/client"
import { PRODUCT_FREQUENCY_OPTIONS, type ProductFrequency } from "@/lib/vocabulary"
import { useProductIntakeBrandOptions } from "@/hooks/use-product-intake-brand-options"
import type { ProductIntakeCategoryKey, ProductIntakeOffer } from "@/lib/types"

type ProductIntakeCardProps = {
  offer: ProductIntakeOffer
  conversationId: string
}

export function ProductIntakeCard({ offer, conversationId }: ProductIntakeCardProps) {
  const brandListId = useId()
  const [method, setMethod] = useState<ProductIntakeMethod>("photo")
  const [category, setCategory] = useState<ProductIntakeCategoryKey | "">(offer.category)
  const [frequency, setFrequency] = useState<ProductFrequency | "">("")
  const [brandText, setBrandText] = useState(offer.extracted_identity?.brand_text ?? "")
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [selectedProductLineId, setSelectedProductLineId] = useState<string | null>(null)
  const [productName, setProductName] = useState(offer.extracted_identity?.product_name_text ?? "")
  const [frontImagePath, setFrontImagePath] = useState<string | null>(null)
  const [barcodeImagePath, setBarcodeImagePath] = useState<string | null>(null)
  const [frontImageValidationStatus, setFrontImageValidationStatus] = useState<string | null>(null)
  const [frontImageValidationMetadata, setFrontImageValidationMetadata] = useState<
    Record<string, unknown>
  >({})
  const [barcodeImageValidationStatus, setBarcodeImageValidationStatus] = useState<string | null>(
    null,
  )
  const [barcodeImageValidationMetadata, setBarcodeImageValidationMetadata] = useState<
    Record<string, unknown>
  >({})
  const brandOptions = useProductIntakeBrandOptions(brandText)
  const [busy, setBusy] = useState<ProductIntakeImageKind | "submit" | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ready = useMemo(
    () =>
      canSubmitProductIntake({
        method,
        category,
        frequency,
        brandText,
        productName,
        frontImagePath,
      }),
    [brandText, category, frequency, frontImagePath, method, productName],
  )

  function handleBrandTextChange(value: string) {
    setBrandText(value)
    const selectedOption = selectedProductIntakeBrandOptionForText(brandOptions, value)
    setSelectedBrandId(selectedOption?.brand_id ?? null)
    setSelectedProductLineId(selectedOption?.product_line_id ?? null)
  }

  async function uploadImage(kind: ProductIntakeImageKind, file: File | undefined) {
    if (!file) return
    setBusy(kind)
    setError(null)
    setStatus(null)

    try {
      const upload = await uploadProductIntakeImage(kind, file)

      if (kind === "front") {
        setFrontImagePath(upload.path)
        setFrontImageValidationStatus(upload.validationStatus)
        setFrontImageValidationMetadata(upload.validationMetadata)
      } else {
        setBarcodeImagePath(upload.path)
        setBarcodeImageValidationStatus(upload.validationStatus)
        setBarcodeImageValidationMetadata(upload.validationMetadata)
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Bild konnte nicht hochgeladen werden.",
      )
    } finally {
      setBusy(null)
    }
  }

  async function submit(replaceExistingConfirmed = false): Promise<void> {
    if (!ready || busy) return
    setBusy("submit")
    setError(null)
    setStatus(null)

    if (!category || !frequency) {
      setBusy(null)
      return
    }

    const payload = buildProductIntakeSubmissionPayload({
      method,
      category,
      frequency,
      brandText,
      brandId: selectedBrandId,
      productLineId: selectedProductLineId,
      productName,
      frontImagePath,
      frontImageValidationStatus,
      frontImageValidationMetadata,
      barcodeImagePath,
      barcodeImageValidationStatus,
      barcodeImageValidationMetadata,
      sourceConversationId: conversationId,
      replaceExistingConfirmed,
    })

    try {
      const response = await fetch("/api/product-intake/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json().catch(() => ({}))) as ProductIntakeResponseBody

      if (response.status === 409 && body.code === "product_category_already_filled") {
        const confirmed = window.confirm(
          body.error ??
            "Du hast für diese Kategorie bereits ein Produkt hinterlegt. Möchtest du es ersetzen?",
        )
        if (confirmed) {
          await submit(true)
        }
        return
      }

      if (!response.ok) {
        throw new Error(body.error ?? "Produkt konnte nicht gespeichert werden.")
      }

      setStatus(
        body.status === "matched"
          ? "Produkt gespeichert. Du kannst dazu direkt weiterfragen."
          : "Danke, wir prüfen dein Produkt und melden uns hier im Chat.",
      )
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Produkt konnte nicht gespeichert werden.",
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="w-full min-w-0 rounded-xl border border-border bg-background p-3 shadow-sm">
      <p className="mb-3 text-sm leading-relaxed text-foreground">
        Danke für dein Produkt. Wir haben es noch nicht sicher in unserer Datenbank und prüfen es
        gerne konkret für dich.
      </p>
      <ProductIntakeMethodToggle value={method} onChange={setMethod} />

      <div className="space-y-3">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as ProductIntakeCategoryKey)}
          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
        >
          <option value="">Kategorie</option>
          {SUPPORTED_PRODUCT_CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {PRODUCT_CATEGORY_DISPLAY_LABELS[key]}
            </option>
          ))}
        </select>

        <select
          value={frequency}
          onChange={(event) => setFrequency(event.target.value as ProductFrequency)}
          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
        >
          <option value="">Häufigkeit</option>
          {PRODUCT_FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {method === "photo" ? (
          <ProductIntakeImageFields
            frontReady={Boolean(frontImagePath)}
            barcodeReady={Boolean(barcodeImagePath)}
            uploading={busy === "front" || busy === "barcode" ? busy : null}
            onUpload={uploadImage}
          />
        ) : null}

        <ProductIntakeBrandProductFields
          brandText={brandText}
          productName={productName}
          brandOptions={brandOptions}
          brandListId={brandListId}
          brandPlaceholder={method === "manual" ? "Marke" : "Marke optional"}
          productPlaceholder={method === "manual" ? "Produktname" : "Produktname optional"}
          onBrandTextChange={handleBrandTextChange}
          onProductNameChange={setProductName}
        />

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {status ? <p className="text-xs text-emerald-700">{status}</p> : null}

        <button
          type="button"
          onClick={() => submit()}
          disabled={!ready || busy !== null || Boolean(status)}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === "submit" ? "Speichern..." : "Produkt einreichen"}
        </button>
      </div>
    </div>
  )
}
