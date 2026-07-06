"use client"

import {
  ArrowLeftRight,
  Check,
  Clock,
  Hourglass,
  MessageCircle,
  PencilLine,
  ShoppingCart,
  Trash2,
} from "lucide-react"
import Image from "next/image"

import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet"
import {
  buildDrawerProductProfileRows,
  buildProductApplicationSentence,
  buildProductMatchSummary,
  formatProductPrice,
  getProductShopCtaLabel,
  getPurchaseLinkHelperText,
  getValidAffiliateLink,
  shouldShowAffiliateDisclosure,
} from "@/components/chat/product-display-model"
import type { RoutineChatTriggerType } from "@/lib/routines/chat-triggers"
import type { RoutineUiCard } from "@/lib/routines/types"
import type { HairProfile, Product } from "@/lib/types"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"
import { cn } from "@/lib/utils"
import { RoutineFrequencyControl } from "./routine-frequency-control"

type RoutineDrawerProps = {
  card: RoutineUiCard | null
  hairProfile: HairProfile | null
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onFrequencyChange: (card: RoutineUiCard, frequency: ProductFrequency) => void
  onRemove: (card: RoutineUiCard) => void
  onChat: (card: RoutineUiCard, type: RoutineChatTriggerType) => void
}

function formatRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (minutes < 60) return `vor ${Math.max(1, minutes)} Minuten`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? "vor 1 Stunde" : `vor ${hours} Stunden`
  const days = Math.round(hours / 24)
  return days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`
}

/** Product names often repeat the brand ("Syoss ... Shampoo"): strip it for the header title. */
function stripBrandPrefix(name: string, brand: string | null | undefined): string {
  const prefix = brand?.trim()
  if (!prefix) return name
  const stripped = name.trim().toLocaleLowerCase("de").startsWith(prefix.toLocaleLowerCase("de"))
    ? name.trim().slice(prefix.length).trim()
    : name.trim()
  return stripped || name
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  )
}

function CategoryPill({ label, pending }: { label: string; pending?: boolean }) {
  return (
    <span
      className={cn(
        "mt-2 inline-flex items-center rounded-full px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em]",
        pending ? "bg-[rgba(138,123,106,0.18)] text-[#5a4f43]" : "bg-[#F2EEFA] text-[#6B50A0]",
      )}
    >
      {label}
    </span>
  )
}

function DrawerTile({ card }: { card: RoutineUiCard }) {
  const baseClassName =
    "flex h-[88px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-xl"

  if (card.kind === "pending") {
    return (
      <div
        className={baseClassName}
        style={{ background: "linear-gradient(155deg,#F5EBD2,#E6D4A8)" }}
      >
        <Hourglass className="h-8 w-8 text-[#8a6a30]" aria-hidden="true" />
      </div>
    )
  }

  const imageUrl = card.product?.image_url ?? null
  return (
    <div className={cn(baseClassName, "bg-[#F2EEFA]")}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={46}
          height={70}
          unoptimized
          className="h-[80%] w-[60%] object-contain"
        />
      ) : (
        <span aria-hidden="true" className="font-serif text-2xl font-medium text-[#6B50A0]/25">
          {card.categoryLabel.charAt(0)}
        </span>
      )}
    </div>
  )
}

function CtaStack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2.5 border-t border-border pt-4">{children}</div>
}

function RemoveCta({ busy, onClick }: { busy?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold text-[#C86850] transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      Aus Routine entfernen
    </button>
  )
}

function OutlinedCta({
  busy,
  onClick,
  icon,
  label,
}: {
  busy?: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-[#6B50A0] px-4 text-sm font-semibold text-[#6B50A0] transition-colors hover:bg-[#F2EEFA] disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  )
}

function PendingStatusSection({ card }: { card: RoutineUiCard }) {
  const submission = card.pendingSubmission
  const needsMoreInfo = card.usageRow?.match_status === "needs_more_info"
  const body =
    submission?.user_facing_next_step ??
    submission?.user_facing_resolution_reason ??
    "Du hast es uns gemeldet — wir checken Marke, Inhaltsstoffe und Eignung. Sobald wir fertig sind, taucht hier dein vollständiges Produkt mit Chaarlie-Einschätzung auf."
  const reason = needsMoreInfo ? (submission?.user_facing_resolution_reason ?? null) : null
  const missingFields = submission?.user_facing_missing_fields ?? []
  const submittedAgo = formatRelativeTime(submission?.created_at ?? card.usageRow?.created_at)

  return (
    <section className="space-y-2">
      <SectionLabel>Status</SectionLabel>
      <div className="rounded-xl border border-[rgba(232,188,100,0.35)] bg-[rgba(232,188,100,0.12)] px-4 py-3.5 text-[13px] leading-relaxed text-[var(--text-heading)]">
        <p className="font-semibold">Wir prüfen dein Produkt.</p>
        <p className="mt-1">{body}</p>
        {reason && reason !== body && <p className="mt-2">{reason}</p>}
        {missingFields.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-4">
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        )}
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {submittedAgo ? `Eingereicht ${submittedAgo} · ` : ""}meist innerhalb 24 h
        </p>
      </div>
    </section>
  )
}

export function RoutineDrawer({
  card,
  hairProfile,
  busy,
  onOpenChange,
  onFrequencyChange,
  onRemove,
  onChat,
}: RoutineDrawerProps) {
  const isPending = card?.kind === "pending"
  const isVerifiedProduct = Boolean(card && !isPending && card.product)
  const product = isVerifiedProduct ? (card?.product as Product) : null

  const matchSummary = product ? buildProductMatchSummary(product, hairProfile) : ""
  const applicationSentence = product ? buildProductApplicationSentence(product, hairProfile) : ""
  const profileRows = product ? buildDrawerProductProfileRows(product) : []
  const price = product ? formatProductPrice(product.price_eur, product.currency) : ""
  const affiliateHref = product ? getValidAffiliateLink(product.affiliate_link) : ""
  const shopLabel = product ? getProductShopCtaLabel(product) : ""
  const purchaseLinkHelperText = product ? getPurchaseLinkHelperText(product) : ""
  const showAffiliateDisclosure = product ? shouldShowAffiliateDisclosure(product) : false

  const brand = isPending ? (card?.usageRow?.brand_text ?? null) : (product?.brand ?? null)
  const title = card
    ? isPending
      ? (card.usageRow?.product_name ?? card.productName ?? card.categoryLabel)
      : product
        ? stripBrandPrefix(product.name, product.brand)
        : (card.productName ?? card.categoryLabel)
    : ""

  const editableUsage = Boolean(card?.usageRow?.id)
  const showSlider = Boolean(
    card && (card.frequencyTarget || card.currentFrequency || editableUsage),
  )
  const needsMoreInfo = card?.usageRow?.match_status === "needs_more_info"
  const chatCta: { type: RoutineChatTriggerType; label: string; icon: React.ReactNode } =
    card?.kind === "verified_swap"
      ? {
          type: "alternatives",
          label: "Alternativen ansehen",
          icon: <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />,
        }
      : {
          type: "discuss_product",
          label: "Im Chat besprechen",
          icon: <MessageCircle className="h-4 w-4" aria-hidden="true" />,
        }

  return (
    <BottomSheet open={Boolean(card)} onOpenChange={onOpenChange}>
      {card && (
        <BottomSheetContent className="max-h-[85vh]">
          <BottomSheetHeader className="gap-4 border-b border-border pb-4">
            <DrawerTile card={card} />
            <div className="min-w-0 flex-1">
              {brand && <p className="text-[11px] font-medium text-muted-foreground">{brand}</p>}
              <BottomSheetTitle className="font-serif text-lg font-medium leading-tight">
                {title}
              </BottomSheetTitle>
              <CategoryPill
                label={isPending ? `${card.categoryLabel} · In Prüfung` : card.categoryLabel}
                pending={isPending}
              />
            </div>
            {isVerifiedProduct && (
              /* mt-10 drops the badge below the sheet's absolute close button
                 so the two don't crowd each other at narrow widths. */
              <span className="mt-10 inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Drin
              </span>
            )}
          </BottomSheetHeader>

          <div className="space-y-5 pt-4">
            {isPending && <PendingStatusSection card={card} />}

            {!isPending && matchSummary && (
              <section className="space-y-2">
                <SectionLabel>Warum es passt</SectionLabel>
                <div className="rounded-lg bg-primary/10 px-4 py-3">
                  <p className="text-sm leading-6 text-foreground">{matchSummary}</p>
                </div>
              </section>
            )}

            {showSlider && (
              <section className="space-y-2">
                <SectionLabel>
                  {isPending ? "Frequenz (bleibt deine Wahl)" : "Frequenz"}
                </SectionLabel>
                <div className="rounded-xl border border-border bg-background px-3.5 py-3">
                  <RoutineFrequencyControl
                    card={card}
                    disabled={!editableUsage || busy}
                    showTarget={!isPending}
                    onChange={(frequency) => onFrequencyChange(card, frequency)}
                  />
                </div>
              </section>
            )}

            {!isPending && applicationSentence && (
              <section className="space-y-2">
                <SectionLabel>Anwendung</SectionLabel>
                <p className="text-sm leading-6 text-foreground">{applicationSentence}</p>
              </section>
            )}

            {!isPending && profileRows.length > 0 && (
              <section className="space-y-2">
                <SectionLabel>Produktprofil</SectionLabel>
                <div className="divide-y divide-border/70 rounded-lg border border-border/70">
                  {profileRows.map((row) => (
                    <div
                      key={`${row.label}-${row.value}`}
                      className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] sm:gap-4"
                    >
                      <span className="font-medium text-muted-foreground">{row.label}</span>
                      <span className="min-w-0 break-words text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <CtaStack>
              {!isPending && affiliateHref && (
                <a
                  href={affiliateHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#D4616A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#c2525c]"
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  {shopLabel}
                  {price ? ` · ${price}` : ""}
                </a>
              )}
              {!isPending && purchaseLinkHelperText && (
                <p className="text-xs leading-5 text-muted-foreground">{purchaseLinkHelperText}</p>
              )}

              {isPending ? (
                needsMoreInfo && (
                  <OutlinedCta
                    busy={busy}
                    onClick={() => onChat(card, "discuss_product")}
                    icon={<PencilLine className="h-4 w-4" aria-hidden="true" />}
                    label="Angaben ergänzen"
                  />
                )
              ) : (
                <OutlinedCta
                  busy={busy}
                  onClick={() => onChat(card, chatCta.type)}
                  icon={chatCta.icon}
                  label={chatCta.label}
                />
              )}

              {editableUsage && <RemoveCta busy={busy} onClick={() => onRemove(card)} />}

              {!isPending && showAffiliateDisclosure && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Anzeige: Der Kauflink kann ein Affiliate-Link sein.
                </p>
              )}
            </CtaStack>
          </div>
        </BottomSheetContent>
      )}
    </BottomSheet>
  )
}
