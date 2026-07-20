"use client"

import { Info, LockKeyhole, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  resolveGuidedStoryRoutineCopy,
  type GuidedStoryRoutineProductCopy,
} from "@/lib/quiz/guided-story-routine-copy"
import type { QuizGuidedStoryPreview } from "@/lib/quiz/guided-story-preview"
import type { OfferPreviewProductCard } from "@/lib/quiz/offer-preview-types"

interface GuidedStoryRoutineProps {
  preview: QuizGuidedStoryPreview
  onContinue: () => void
  onStart: () => void
}

type ActivePopover =
  | { type: "product"; key: string }
  | { type: "locked"; key: "further-care" | "tools" }
  | null

function cadenceLabel(product: OfferPreviewProductCard) {
  return product.cadence.qualifier
    ? `${product.cadence.label} · ${product.cadence.qualifier}`
    : product.cadence.label
}

function ProductCard({
  active,
  copy,
  onClose,
  onOpen,
  product,
  setTriggerRef,
}: {
  active: boolean
  copy: GuidedStoryRoutineProductCopy
  onClose: () => void
  onOpen: () => void
  product: OfferPreviewProductCard
  setTriggerRef: (node: HTMLButtonElement | null) => void
}) {
  const popoverId = `guided-story-product-popover-${product.key}`

  return (
    <div className="relative" data-testid="guided-story-product-card">
      <button
        ref={setTriggerRef}
        type="button"
        aria-controls={active ? popoverId : undefined}
        aria-expanded={active}
        aria-haspopup="dialog"
        className="flex min-h-[132px] w-full min-w-0 gap-4 overflow-hidden rounded-[16px] border border-border bg-white p-4 text-left shadow-[0_8px_30px_-26px_rgba(var(--brand-plum-rgb),0.5)] transition-colors hover:border-[var(--brand-plum-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
        onClick={onOpen}
      >
        <span className="grid h-[100px] w-[82px] shrink-0 place-items-center overflow-hidden rounded-[12px] bg-[var(--brand-plum-ice)] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- catalog images are hosted in the project's Supabase bucket. */}
          <img
            alt={product.name}
            className="h-full w-full object-contain"
            loading="lazy"
            src={product.imageUrl}
          />
        </span>
        <span className="min-w-0 flex-1 py-0.5">
          <span className="block font-mono text-[8px] font-semibold uppercase tracking-[0.09em] text-[var(--brand-plum)]">
            {copy.categoryLabel}
          </span>
          <span className="mt-1.5 block text-[12px] font-semibold leading-snug text-[var(--brand-plum)]">
            {copy.sectionTitle}
          </span>
          <span className="mt-1 block text-[15px] font-bold leading-snug text-[var(--brand-plum-darkest)]">
            {product.name}
          </span>
          <span className="mt-1.5 block text-[11.5px] leading-relaxed text-muted-foreground">
            {product.note}
          </span>
          <span className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand-plum)]">
            {cadenceLabel(product)}
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
          </span>
        </span>
      </button>

      {active ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={`${copy.categoryLabel}: Warum dieses Beispiel passt`}
          className="absolute left-0 top-[calc(100%+8px)] z-20 w-[min(22rem,calc(100vw-2rem))] rounded-[14px] border border-[var(--brand-plum-light)] bg-white p-4 text-[13px] leading-relaxed text-[var(--brand-plum-darkest)] shadow-[0_18px_52px_-28px_rgba(var(--brand-plum-rgb),0.65)]"
          data-guided-story-popover
        >
          <button
            type="button"
            aria-label="Hinweis schließen"
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-[var(--brand-plum)] hover:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <p className="pr-7">{copy.popover}</p>
        </div>
      ) : null}
    </div>
  )
}

function LockedTeaser({
  active,
  align,
  label,
  onClose,
  onOpen,
  onStart,
  popover,
  ctaLabel,
  setTriggerRef,
}: {
  active: boolean
  align: "left" | "right"
  label: string
  onClose: () => void
  onOpen: () => void
  onStart: () => void
  popover: string
  ctaLabel: string
  setTriggerRef: (node: HTMLButtonElement | null) => void
}) {
  const popoverId = `guided-story-locked-popover-${label.toLowerCase().replace(/\s+/g, "-")}`

  return (
    <div className="relative min-w-0" data-testid="guided-story-locked-teaser">
      <button
        ref={setTriggerRef}
        type="button"
        aria-controls={active ? popoverId : undefined}
        aria-expanded={active}
        aria-haspopup="dialog"
        className="flex min-h-[96px] w-full min-w-0 flex-col justify-between rounded-[16px] border border-[var(--brand-plum-light)] bg-white p-3.5 text-left transition-colors hover:border-[var(--brand-plum)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
        onClick={onOpen}
      >
        <span className="grid size-8 place-items-center self-end rounded-full bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
          <LockKeyhole className="size-3.5" aria-hidden="true" />
        </span>
        <span className="mt-3 break-words text-[12px] font-semibold leading-snug text-[var(--brand-plum-darkest)] [overflow-wrap:anywhere]">
          {label}
        </span>
      </button>

      {active ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={`${label}: gesperrter Routineteil`}
          className={cn(
            "absolute top-[calc(100%+8px)] z-20 w-[min(21rem,calc(100vw-2rem))] rounded-[14px] border border-[var(--brand-plum-light)] bg-white p-4 text-[13px] leading-relaxed text-[var(--brand-plum-darkest)] shadow-[0_18px_52px_-28px_rgba(var(--brand-plum-rgb),0.65)]",
            align === "right" ? "right-0" : "left-0",
          )}
          data-guided-story-popover
        >
          <button
            type="button"
            aria-label="Hinweis schließen"
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-[var(--brand-plum)] hover:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <p className="pr-7">{popover}</p>
          <Button
            className="mt-3"
            data-offer-cta="locked_plan"
            data-offer-destination="pricing"
            data-offer-source-section="locked_routine"
            type="button"
            onClick={onStart}
          >
            {ctaLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function GuidedStoryRoutine({ preview, onContinue, onStart }: GuidedStoryRoutineProps) {
  const copy = resolveGuidedStoryRoutineCopy(preview)
  const [activePopover, setActivePopover] = useState<ActivePopover>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const lastTriggerKey = useRef<string | null>(null)

  const foundationProducts = preview.products.filter((product) => !product.suggested)
  const targetedProduct = preview.products.find((product) => product.suggested)
  const copyByProduct = new Map(copy.products.map((productCopy) => [productCopy.key, productCopy]))

  function closePopover({ restoreFocus = true }: { restoreFocus?: boolean } = {}) {
    setActivePopover(null)
    if (restoreFocus && lastTriggerKey.current) {
      triggerRefs.current[lastTriggerKey.current]?.focus()
    }
  }

  function openProduct(productKey: string) {
    lastTriggerKey.current = `product:${productKey}`
    setActivePopover({ type: "product", key: productKey })
  }

  function openLocked(teaserKey: "further-care" | "tools") {
    lastTriggerKey.current = `locked:${teaserKey}`
    setActivePopover({ type: "locked", key: teaserKey })
  }

  useEffect(() => {
    if (!activePopover) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePopover()
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      const activeTrigger = lastTriggerKey.current
        ? triggerRefs.current[lastTriggerKey.current]
        : null
      if (
        target instanceof Node &&
        (activeTrigger?.contains(target) ||
          (target instanceof Element && Boolean(target.closest("[data-guided-story-popover]"))))
      ) {
        return
      }
      closePopover({ restoreFocus: false })
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("pointerdown", handlePointerDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [activePopover])

  return (
    <section
      ref={containerRef}
      id="unlock-plan"
      className="scroll-mt-5 border-t border-border py-9"
      data-offer-section="mini_routine"
    >
      <h2
        id="guided-story-chapter-2-heading"
        tabIndex={-1}
        className="font-header text-[30px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)] outline-none"
      >
        {copy.continuation}
      </h2>
      <h3 className="mt-5 text-[15px] font-bold leading-snug text-[var(--brand-plum-darkest)]">
        {copy.basisTitle}
      </h3>
      <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">{copy.basisIntro}</p>

      <div className="mt-5 space-y-3">
        {foundationProducts.map((product) => {
          const productCopy = copyByProduct.get(product.key)
          if (!productCopy) return null
          return (
            <ProductCard
              key={product.key}
              active={activePopover?.type === "product" && activePopover.key === product.key}
              copy={productCopy}
              product={product}
              onClose={closePopover}
              onOpen={() => openProduct(product.key)}
              setTriggerRef={(node) => {
                triggerRefs.current[`product:${product.key}`] = node
              }}
            />
          )
        })}
      </div>

      {targetedProduct ? (
        <div className="mt-6">
          <h3 className="text-[15px] font-bold leading-snug text-[var(--brand-plum-darkest)]">
            {copy.targetedTitle}
          </h3>
          <div className="mt-3">
            <ProductCard
              active={
                activePopover?.type === "product" && activePopover.key === targetedProduct.key
              }
              copy={copyByProduct.get(targetedProduct.key)!}
              product={targetedProduct}
              onClose={closePopover}
              onOpen={() => openProduct(targetedProduct.key)}
              setTriggerRef={(node) => {
                triggerRefs.current[`product:${targetedProduct.key}`] = node
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2.5" data-offer-section="locked_routine">
        {copy.lockedTeasers.map((teaser, index) => (
          <LockedTeaser
            key={teaser.key}
            active={activePopover?.type === "locked" && activePopover.key === teaser.key}
            align={index === 0 ? "left" : "right"}
            label={teaser.label}
            popover={copy.lockedPopover}
            ctaLabel={copy.lockedCtaLabel}
            onClose={closePopover}
            onOpen={() => openLocked(teaser.key)}
            onStart={() => {
              closePopover({ restoreFocus: false })
              onStart()
            }}
            setTriggerRef={(node) => {
              triggerRefs.current[`locked:${teaser.key}`] = node
            }}
          />
        ))}
      </div>

      <div className="mt-7 rounded-[16px] border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)]/55 p-4">
        <p className="text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
          {copy.handoff}
        </p>
        <Button
          className="mt-3"
          data-offer-cta="routine_continue"
          data-offer-destination="guided-story-support"
          data-offer-source-section="mini_routine"
          type="button"
          onClick={() => {
            closePopover({ restoreFocus: false })
            onContinue()
          }}
        >
          {copy.handoffCtaLabel}
        </Button>
      </div>
    </section>
  )
}
