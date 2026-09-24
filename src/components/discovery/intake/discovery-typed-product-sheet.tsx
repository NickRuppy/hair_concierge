"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"

/**
 * „Nicht gefunden? Namen eintippen" — the discovery checklist's own typed capture (plan
 * Rev. 2 P1-1). Unlike the scanner's research form it asks nothing about the category: the
 * name goes through the classifier, and „Was ist das?" (with „Weiß ich nicht") follows only
 * when the name says nothing.
 */

const TITLE = "Wie heißt das Produkt?"
const BRAND_LABEL = "Marke"
const NAME_LABEL = "Produktname"
const NAME_PLACEHOLDER = "wie auf der Packung"
const CONTINUE_LABEL = "Weiter"
const BRAND_MAX = 200
const NAME_MAX = 240

const FIELD =
  "w-full rounded-[14px] border border-[var(--brand-plum-light)] bg-white px-3.5 py-3 text-base text-[var(--brand-plum-darkest)] placeholder:text-[var(--text-caption)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"

export type DiscoveryTypedProduct = { brandText: string; productNameText: string }

export function DiscoveryTypedProductForm({
  busy,
  onSubmit,
}: {
  busy: boolean
  onSubmit: (product: DiscoveryTypedProduct) => void
}) {
  const [brandText, setBrandText] = useState("")
  const [productNameText, setProductNameText] = useState("")
  const brand = brandText.trim()
  const name = productNameText.trim()
  const ready = brand.length > 0 && name.length > 0

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready && !busy) onSubmit({ brandText: brand, productNameText: name })
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-[var(--text-sub)]">
          {BRAND_LABEL}
        </span>
        <input
          type="text"
          value={brandText}
          onChange={(event) => setBrandText(event.target.value)}
          maxLength={BRAND_MAX}
          autoFocus
          autoComplete="off"
          className={FIELD}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-[var(--text-sub)]">
          {NAME_LABEL}
        </span>
        <input
          type="text"
          value={productNameText}
          onChange={(event) => setProductNameText(event.target.value)}
          maxLength={NAME_MAX}
          placeholder={NAME_PLACEHOLDER}
          autoComplete="off"
          className={FIELD}
        />
      </label>
      <Button type="submit" variant="funnelCta" disabled={!ready || busy}>
        {CONTINUE_LABEL}
      </Button>
    </form>
  )
}

export function DiscoveryTypedProductSheet({
  open,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (product: DiscoveryTypedProduct) => void
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="max-h-[85vh]" contentClassName="px-5 pb-7 pt-1">
        <BottomSheetTitle className="mb-4 pr-10 font-header text-[22px] font-medium leading-tight text-[var(--brand-plum-darkest)]">
          {TITLE}
        </BottomSheetTitle>
        {/* Remounted per open, so every product starts with empty fields. */}
        {open ? <DiscoveryTypedProductForm busy={busy} onSubmit={onSubmit} /> : null}
      </BottomSheetContent>
    </BottomSheet>
  )
}
