"use client"

import { Check, ImageUp, Keyboard, Loader2 } from "lucide-react"
import type { ProductIntakeImageKind, ProductIntakeMethod } from "@/lib/product-intake/client"
import type { ProductIntakeBrandOption } from "@/lib/product-intake/client"

export function ProductIntakeMethodToggle({
  value,
  onChange,
  className = "mb-3 grid grid-cols-2 gap-2",
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
                ? "border-secondary bg-secondary text-secondary-foreground"
                : "border-border bg-background text-foreground hover:border-[var(--brand-plum)]/40"
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
  labelClassName = "block rounded-lg border border-border bg-muted p-3 text-sm",
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
        labelClassName={labelClassName}
        inputClassName={inputClassName}
      />
      <ProductIntakeImageField
        label="Barcode"
        ready={barcodeReady}
        kind="barcode"
        onUpload={onUpload}
        labelClassName={labelClassName}
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
  return (
    <label className={labelClassName}>
      <span className="mb-2 flex items-center justify-between gap-3">
        {label}
        {ready ? <Check className="h-4 w-4 text-emerald-600" /> : null}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
          {ready ? "Foto ersetzen" : "Foto auswählen"}
        </span>
        <span>{ready ? "Bild hochgeladen" : "Noch kein Bild ausgewählt"}</span>
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(event) => onUpload(kind, event.target.files?.[0])}
        className={inputClassName}
      />
    </label>
  )
}

export function ProductIntakeBrandProductFields({
  brandText,
  productName,
  brandOptions,
  brandListId,
  brandPlaceholder,
  productPlaceholder,
  onBrandTextChange,
  onProductNameChange,
  wrapperClassName = "grid gap-2 sm:grid-cols-2",
  inputClassName = "w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
}: {
  brandText: string
  productName: string
  brandOptions: ProductIntakeBrandOption[]
  brandListId: string
  brandPlaceholder: string
  productPlaceholder: string
  onBrandTextChange: (value: string) => void
  onProductNameChange: (value: string) => void
  wrapperClassName?: string
  inputClassName?: string
}) {
  return (
    <>
      <div className={wrapperClassName}>
        <input
          type="text"
          value={brandText}
          onChange={(event) => onBrandTextChange(event.target.value)}
          placeholder={brandPlaceholder}
          list={brandListId}
          className={inputClassName}
        />
        <input
          type="text"
          value={productName}
          onChange={(event) => onProductNameChange(event.target.value)}
          placeholder={productPlaceholder}
          className={inputClassName}
        />
      </div>
      <datalist id={brandListId}>
        {brandOptions.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
    </>
  )
}
