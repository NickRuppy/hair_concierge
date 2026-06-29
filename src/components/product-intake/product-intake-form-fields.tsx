"use client"

import { Check, ImageUp, Keyboard, Loader2 } from "lucide-react"
import type { ProductIntakeImageKind, ProductIntakeMethod } from "@/lib/product-intake/client"
import type { ProductIntakeBrandOption } from "@/lib/product-intake/client"
import { cn } from "@/lib/utils"

export function ProductIntakeMethodToggle({
  value,
  onChange,
  className = "mb-3 grid grid-cols-2 gap-1.5 rounded-xl bg-muted/70 p-1",
  buttonClassName = "flex min-h-[44px] items-center justify-center gap-2 rounded-lg border px-2 text-sm font-medium transition-colors",
}: {
  value: ProductIntakeMethod | null
  onChange: (method: ProductIntakeMethod) => void
  className?: string
  buttonClassName?: string
}) {
  return (
    <div className={className}>
      {[
        { value: "photo" as const, label: "Foto hochladen", icon: ImageUp },
        { value: "manual" as const, label: "Daten eingeben", icon: Keyboard },
      ].map((option) => {
        const Icon = option.icon
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`${buttonClassName} ${
              active
                ? "border-background bg-background text-foreground shadow-sm"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ProductIntakeImageFields({
  frontReady,
  barcodeReady,
  uploading,
  uploadError,
  onUpload,
  labelClassName = "block rounded-xl border border-border/80 bg-background px-3 py-3 text-sm text-foreground transition-colors",
  frontLabelClassName,
  barcodeLabelClassName,
  inputClassName = "sr-only",
  statusClassName = "flex items-center gap-2 text-xs text-muted-foreground",
  errorClassName = "text-xs text-destructive",
}: {
  frontReady: boolean
  barcodeReady: boolean
  uploading: ProductIntakeImageKind | null
  uploadError?: string | null
  onUpload: (kind: ProductIntakeImageKind, file: File | undefined) => void
  labelClassName?: string
  frontLabelClassName?: string
  barcodeLabelClassName?: string
  inputClassName?: string
  statusClassName?: string
  errorClassName?: string
}) {
  return (
    <div className="space-y-2">
      <ProductIntakeImageField
        label="Vorderseite"
        ready={frontReady}
        kind="front"
        onUpload={onUpload}
        labelClassName={frontLabelClassName ?? labelClassName}
        inputClassName={inputClassName}
      />
      <ProductIntakeImageField
        label="Barcode"
        ready={barcodeReady}
        kind="barcode"
        onUpload={onUpload}
        labelClassName={barcodeLabelClassName ?? labelClassName}
        inputClassName={inputClassName}
      />

      {uploading ? (
        <div className={statusClassName}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Bild wird hochgeladen
        </div>
      ) : null}
      {uploadError ? <p className={errorClassName}>{uploadError}</p> : null}
    </div>
  )
}

function ProductIntakeImageField({
  label,
  ready,
  kind,
  onUpload,
  labelClassName,
  inputClassName,
}: {
  label: string
  ready: boolean
  kind: ProductIntakeImageKind
  onUpload: (kind: ProductIntakeImageKind, file: File | undefined) => void
  labelClassName: string
  inputClassName: string
}) {
  const inputIsHidden = inputClassName.split(/\s+/).includes("sr-only")

  return (
    <label className={cn(labelClassName, inputIsHidden && "cursor-pointer")}>
      <span className="flex items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block font-medium">{label}</span>
          <span
            className={cn(
              "mt-1 flex items-center gap-1.5 text-xs",
              ready ? "text-emerald-700" : "text-muted-foreground",
            )}
          >
            {ready ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
            {ready ? "Bild hinzugefügt" : "Bild hochladen"}
          </span>
        </span>
        {inputIsHidden ? (
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/90"
            aria-hidden="true"
          >
            <ImageUp className="h-5 w-5" />
          </span>
        ) : null}
      </span>

      <input
        aria-label={`${label} ${ready ? "ersetzen" : "hochladen"}`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(event) => onUpload(kind, event.target.files?.[0])}
        className={cn(!inputIsHidden && "mt-3", inputClassName)}
      />
    </label>
  )
}

export function ProductIntakeBrandProductFields({
  brandText,
  productName,
  brandOptions,
  brandListId,
  brandLabel = "Marke",
  productLabel = "Produktname",
  brandPlaceholder,
  productPlaceholder,
  onBrandTextChange,
  onProductNameChange,
  wrapperClassName = "grid gap-2 sm:grid-cols-2",
  inputClassName = "w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-[var(--brand-plum)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-plum)]/25",
  labelClassName = "space-y-1.5",
  labelTextClassName = "block text-xs font-medium text-muted-foreground",
  brandInputClassName,
  productInputClassName,
}: {
  brandText: string
  productName: string
  brandOptions: ProductIntakeBrandOption[]
  brandListId: string
  brandLabel?: string
  productLabel?: string
  brandPlaceholder: string
  productPlaceholder: string
  onBrandTextChange: (value: string) => void
  onProductNameChange: (value: string) => void
  wrapperClassName?: string
  inputClassName?: string
  labelClassName?: string
  labelTextClassName?: string
  brandInputClassName?: string
  productInputClassName?: string
}) {
  return (
    <>
      <div className={wrapperClassName}>
        <label className={labelClassName}>
          <span className={labelTextClassName}>{brandLabel}</span>
          <input
            type="text"
            value={brandText}
            onChange={(event) => onBrandTextChange(event.target.value)}
            placeholder={brandPlaceholder}
            list={brandListId}
            className={brandInputClassName ?? inputClassName}
          />
        </label>
        <label className={labelClassName}>
          <span className={labelTextClassName}>{productLabel}</span>
          <input
            type="text"
            value={productName}
            onChange={(event) => onProductNameChange(event.target.value)}
            placeholder={productPlaceholder}
            className={productInputClassName ?? inputClassName}
          />
        </label>
      </div>
      <datalist id={brandListId}>
        {brandOptions.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
    </>
  )
}
