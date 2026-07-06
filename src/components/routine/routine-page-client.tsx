"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle, RefreshCw } from "lucide-react"

import { Header } from "@/components/layout/header"
import { ProductDetailDrawer } from "@/components/chat/product-detail-drawer"
import { Button } from "@/components/ui/button"
import { launchRoutineChatTrigger, type RoutineChatTriggerType } from "@/lib/routines/chat-triggers"
import type { RoutineUiCard, RoutineUiShape } from "@/lib/routines/types"
import type { HairProfile, Product } from "@/lib/types"
import { RoutineCard } from "./routine-card"

type RoutineApiBody =
  | { routine?: RoutineUiShape | { routine?: RoutineUiShape }; cards?: RoutineUiCard[] }
  | RoutineUiShape

type LoadState = "loading" | "ready" | "error"

const EMPTY_ROUTINE: RoutineUiShape = { hairProfile: null, cards: [] }

function extractRoutine(body: RoutineApiBody): RoutineUiShape {
  if ("cards" in body && Array.isArray(body.cards)) {
    return {
      hairProfile:
        "hairProfile" in body ? ((body.hairProfile ?? null) as HairProfile | null) : null,
      cards: body.cards,
    }
  }
  const routine = "routine" in body ? body.routine : null
  if (routine && "cards" in routine && Array.isArray(routine.cards)) {
    return {
      hairProfile: "hairProfile" in routine ? (routine.hairProfile ?? null) : null,
      cards: routine.cards,
    }
  }
  if (routine && "routine" in routine && routine.routine?.cards) return routine.routine
  return EMPTY_ROUTINE
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    return typeof body.error === "string" ? body.error : fallback
  } catch {
    return fallback
  }
}

export function RoutinePageClient() {
  const router = useRouter()
  const [routine, setRoutine] = useState<RoutineUiShape>(EMPTY_ROUTINE)
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [drawerCardId, setDrawerCardId] = useState<string | null>(null)
  const cards = routine.cards
  const drawerCard = useMemo(
    () => cards.find((card) => card.id === drawerCardId) ?? null,
    [cards, drawerCardId],
  )

  const summary = useMemo(() => {
    const active = cards.filter((card) => card.kind !== "suggestion").length
    const pending = cards.filter((card) => card.kind === "pending").length
    const suggestions = cards.filter((card) => card.kind === "suggestion").length
    return { active, pending, suggestions }
  }, [cards])

  const loadRoutine = useCallback(async () => {
    setLoadState("loading")
    setError(null)
    try {
      const response = await fetch("/api/routine", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(await readError(response, "Routine konnte nicht geladen werden."))
      }
      const body = (await response.json()) as RoutineApiBody
      setRoutine(extractRoutine(body))
      setLoadState("ready")
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Routine konnte nicht geladen werden.",
      )
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    void loadRoutine()
  }, [loadRoutine])

  const dismissSuggestion = useCallback(
    async (card: RoutineUiCard) => {
      const previousRoutine = routine
      setBusyKey(`dismiss:${card.id}`)
      setError(null)
      setRoutine((current) => ({
        ...current,
        cards: current.cards.filter((candidate) => candidate.id !== card.id),
      }))

      try {
        const response = await fetch(`/api/routine/suggestions/${card.category}/dismiss`, {
          method: "POST",
        })

        if (!response.ok) {
          throw new Error(await readError(response, "Vorschlag konnte nicht ausgeblendet werden."))
        }
      } catch (dismissError) {
        setRoutine(previousRoutine)
        setError(
          dismissError instanceof Error
            ? dismissError.message
            : "Vorschlag konnte nicht ausgeblendet werden.",
        )
      } finally {
        setBusyKey(null)
      }
    },
    [routine],
  )

  const startChat = useCallback(
    async (card: RoutineUiCard, type: RoutineChatTriggerType) => {
      setBusyKey(`chat:${card.id}:${type}`)
      setError(null)
      try {
        await launchRoutineChatTrigger(
          {
            type,
            cardId: card.id,
            usageId: card.usageRow?.id ?? null,
            productId: card.product?.id ?? null,
            category: card.category,
            categoryLabel: card.categoryLabel,
            productName: card.productName,
          },
          { navigate: router.push },
        )
      } catch (chatError) {
        setError(
          chatError instanceof Error ? chatError.message : "Chat konnte nicht gestartet werden.",
        )
        setBusyKey(null)
      }
    },
    [router],
  )

  const handleCardTap = useCallback(
    (card: RoutineUiCard) => {
      if (card.kind === "suggestion") {
        void startChat(card, "onboard_category")
        return
      }
      setDrawerCardId(card.id)
    },
    [startChat],
  )

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-5 sm:px-6">
          <section className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Routine
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--text-heading)] sm:text-3xl">
                Deine aktuelle Haarpflege
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Prüfe deine gespeicherten Produkte, passe Nutzungsfrequenzen an und kläre offene
                Kategorien direkt im Chat.
              </p>
            </div>
            <div className="grid min-w-[260px] grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border border-border px-3 py-2">
                <p className="text-lg font-semibold text-[var(--text-heading)]">{summary.active}</p>
                <p className="text-muted-foreground">Produkte</p>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <p className="text-lg font-semibold text-[var(--text-heading)]">
                  {summary.pending}
                </p>
                <p className="text-muted-foreground">Prüfung</p>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <p className="text-lg font-semibold text-[var(--text-heading)]">
                  {summary.suggestions}
                </p>
                <p className="text-muted-foreground">Vorschläge</p>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loadState === "loading" && <RoutinePageSkeleton />}

          {loadState === "error" && (
            <section className="rounded-md border border-border p-6">
              <p className="text-sm text-muted-foreground">
                Die Routine ist gerade nicht verfügbar.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-auto"
                onClick={() => void loadRoutine()}
              >
                <RefreshCw className="h-4 w-4" />
                Erneut laden
              </Button>
            </section>
          )}

          {loadState === "ready" && cards.length === 0 && (
            <section className="rounded-md border border-border p-6">
              <h2 className="text-base font-semibold text-[var(--text-heading)]">
                Noch keine Routine gespeichert
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Sobald Produkte aus deinem Profil oder Chat erkannt wurden, erscheint hier deine
                stabile Routine-Übersicht.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-auto"
                onClick={() => router.push("/chat")}
              >
                <MessageCircle className="h-4 w-4" />
                Im Chat starten
              </Button>
            </section>
          )}

          {loadState === "ready" && cards.length > 0 && (
            <section className="flex flex-col gap-2.5">
              {cards.map((card) => (
                <RoutineCard
                  key={card.id}
                  card={card}
                  busy={Boolean(busyKey)}
                  onTap={handleCardTap}
                  onDismissSuggestion={(targetCard) => void dismissSuggestion(targetCard)}
                />
              ))}
            </section>
          )}
        </div>
      </main>
      <ProductDetailDrawer
        product={(drawerCard?.product ?? null) as Product | null}
        hairProfile={routine.hairProfile}
        open={Boolean(drawerCard?.product)}
        onOpenChange={(open) => {
          if (!open) setDrawerCardId(null)
        }}
        routineAction={
          drawerCard?.product
            ? {
                category: drawerCard.category,
                productId: drawerCard.product.id,
                alreadyInRoutine: Boolean(
                  drawerCard.usageRow?.product_id === drawerCard.product.id,
                ),
                onChanged: loadRoutine,
              }
            : undefined
        }
      />
    </>
  )
}

function RoutinePageSkeleton() {
  return (
    <section className="flex flex-col gap-2.5">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className="grid grid-cols-[88px_1fr] items-center gap-3.5 rounded-[20px] border border-border bg-card p-3.5"
        >
          <div className="h-[100px] w-[88px] animate-pulse rounded-[14px] bg-primary/10" />
          <div className="min-w-0">
            <div className="h-3 w-24 animate-pulse rounded-md bg-primary/10" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded-md bg-primary/10" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded-md bg-primary/10" />
          </div>
        </div>
      ))}
    </section>
  )
}
