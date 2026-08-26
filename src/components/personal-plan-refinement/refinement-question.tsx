"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import {
  PersonalPlanJourneyHeader,
  usePersonalPlanTransitionLayer,
} from "@/components/personal-plan-journey"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { requiresStage2HeatProtection } from "@/lib/personal-plan/refinement/heat-events"
import { getStage2QuestionModule } from "@/lib/personal-plan/refinement/question-path"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type {
  HeatEventAnswer,
  PersonalPlanRefinementAnswersV1,
  ProductFrequency,
  Stage2HeatEventSource,
  Stage2Module,
  Stage2ProductCategory,
  Stage2QuestionId,
  TowelMaterial,
  TowelTechnique,
  WetWashFrequency,
} from "@/lib/personal-plan/refinement/types"
import { cn } from "@/lib/utils"

import {
  ADDITIONAL_HEAT_TOOL_OPTIONS,
  DRYING_ROUTE_OPTIONS,
  DRY_SHAMPOO_BRIDGE_OPTIONS,
  HEAT_PROTECTION_OPTIONS,
  NIGHT_PROTECTION_OPTIONS,
  OIL_PURPOSE_OPTIONS,
  REFINEMENT_CATEGORY_OPTIONS,
  REFINEMENT_TELEMETRY_EVENTS,
  ROOT_COLOR_OPTIONS,
  RefinementInlineNote,
  RefinementOptions,
  SCALP_IRRITATION_OPTIONS,
  TOWEL_MATERIAL_OPTIONS,
  TOWEL_TECHNIQUE_OPTIONS,
  WetWashFrequencyScale,
  WET_WASH_FREQUENCY_OPTIONS,
  mergeGroupedCategorySelection,
} from "./refinement-options"

export { REFINEMENT_CATEGORY_OPTIONS, REFINEMENT_TELEMETRY_EVENTS }

export type RefinementQuestionStatus =
  | "idle"
  | "saving"
  | "saved"
  | "save_failed"
  | "completion_failed"
  | "revision_conflict"
  /**
   * The saved answer is safe, but the server's Feinschliff state no longer
   * matches this client's (M-7). Retrying the handoff cannot fix it; the only
   * honest action is reloading the current state.
   */
  | "stale_refinement"

type RefinementQuestionProps = {
  session: Stage2RefinementSession
  questionId: Stage2QuestionId
  localAnswer: unknown
  onLocalAnswerChange: (answer: unknown, announcement?: string) => void
  status: RefinementQuestionStatus
  liveMessage?: string
  canGoBack: boolean
  onBack: () => void
  onSubmit: () => void
  onSecondaryExit: () => void
  showJourneyHeader?: boolean
  focusOnQuestionChange?: boolean
}

/** German section labels, keyed by module. Source of truth for the split lives in the path model. */
const STAGE2_MODULE_SECTION_LABELS = {
  products: "Was du heute benutzt",
  habits: "Wie du dein Haar behandelst",
} as const satisfies Record<Stage2Module, string>

const HEAT_SOURCE_TITLES = {
  ordinary_blow_dry: "gewöhnliches Föhnen",
  diffuser_airflow_shaping: "Diffusor oder formenden Luftstrom",
  dryer_brush: "die Föhnbürste",
  hot_air_styler: "den Hot-Air-Styler",
  straightener: "das Glätteisen",
  curling_or_wave_iron: "Lockenstab oder Welleneisen",
  thermal_rollers: "Thermo-Wickler",
} as const satisfies Record<Stage2HeatEventSource, string>

export function getAnswerForQuestion(
  answers: PersonalPlanRefinementAnswersV1,
  questionId: Stage2QuestionId,
): unknown {
  if (questionId.startsWith("heat:")) return answers.heatEvents?.[questionId]
  switch (questionId) {
    case "current_product_categories":
      return answers.currentProductCategories
    case "wet_wash_frequency":
      return answers.wetWashFrequency
    case "scalp_irritation_detail":
      return answers.scalpIrritationDetail
    case "dry_shampoo_bridge_preference":
      return answers.dryShampooBridgePreference
    case "dry_shampoo_visible_hair_color":
      return answers.dryShampooVisibleHairColor
    case "oil_purposes":
      return answers.oilPurposes
    case "towel_handling":
      return answers.towel
    case "drying_routes":
      return answers.dryingRoutes
    case "additional_heat_tools":
      return answers.additionalHeatTools
    case "night_protection":
      return answers.nightProtection
  }
}

export function isLocalAnswerComplete(questionId: Stage2QuestionId, answer: unknown): boolean {
  if (questionId.startsWith("heat:")) {
    const source = questionId.slice("heat:".length) as Stage2HeatEventSource
    const heatAnswer = answer as HeatEventAnswer | undefined
    if (!heatAnswer?.frequency) return false
    return requiresStage2HeatProtection(source) ? Boolean(heatAnswer.protectionConsistency) : true
  }
  if (Array.isArray(answer)) return questionId === "oil_purposes" ? answer.length > 0 : true
  if (questionId === "towel_handling") {
    const towel = answer as { material?: TowelMaterial; technique?: TowelTechnique } | undefined
    if (!towel?.material) return false
    return towel.material === "no_towel" ? true : Boolean(towel.technique)
  }
  return answer !== undefined && answer !== null && answer !== ""
}

export function RefinementQuestion({
  session,
  questionId,
  localAnswer,
  onLocalAnswerChange,
  status,
  liveMessage,
  canGoBack,
  onBack,
  onSubmit,
  onSecondaryExit,
  showJourneyHeader = true,
  focusOnQuestionChange = true,
}: RefinementQuestionProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const answer = localAnswer ?? getAnswerForQuestion(session.answers, questionId)
  const complete = isLocalAnswerComplete(questionId, answer)

  useEffect(() => {
    if (!focusOnQuestionChange) return
    window.scrollTo({ top: 0, behavior: "auto" })
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [focusOnQuestionChange, questionId])

  const question = renderQuestionBody({
    session,
    questionId,
    answer,
    onLocalAnswerChange,
  })

  return (
    <div
      className={cn(
        "personal-plan-cookie-clearance bg-[var(--background)] text-[var(--text-body)]",
        showJourneyHeader ? "min-h-dvh" : "min-h-[calc(100dvh-71px)]",
      )}
    >
      {showJourneyHeader ? (
        <PersonalPlanJourneyHeader
          currentStage={2}
          saveStatus={journeySaveStatus(status)}
          onBack={canGoBack ? onBack : onSecondaryExit}
          showStageProgress={false}
        />
      ) : null}
      <main className="mx-auto flex min-h-[calc(100dvh-71px)] w-full max-w-[720px] min-w-0 flex-col">
        <section className="mx-auto w-full max-w-[600px] flex-1 px-5 pb-32 pt-6 md:pb-8 md:pt-9">
          {question.trigger ? (
            <p className="mb-3 inline-flex rounded-full bg-[var(--brand-plum-ice)] px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-[var(--brand-plum)]">
              {question.trigger}
            </p>
          ) : null}
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
            {question.sectionLabel}
          </p>
          <div className="flex items-start gap-2">
            <h2
              ref={headingRef}
              tabIndex={-1}
              data-personal-plan-transition-focus
              className="m-0 flex-1 font-serif text-[28px] font-medium leading-tight tracking-normal text-[var(--brand-plum-darkest,#2a1845)] outline-none"
            >
              {question.title}
            </h2>
            {question.info ? (
              <InfoTip
                title={question.info.title}
                body={question.info.body}
                buttonClassName="h-8 w-8"
              />
            ) : null}
          </div>
          {question.lead ? (
            <p className="mt-2 text-sm leading-6 text-[var(--text-sub,#6a6560)]">{question.lead}</p>
          ) : null}
          <div className="mt-5">{question.body}</div>
          {question.note}
          {status === "save_failed" ||
          status === "completion_failed" ||
          status === "revision_conflict" ||
          status === "stale_refinement" ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-[rgba(163,67,75,0.25)] bg-[#fff1f2] p-4 text-sm leading-6 text-[#765b5e]"
            >
              <p className="font-bold text-[#a3434b]">
                {status === "revision_conflict"
                  ? "Wir haben neuere gespeicherte Antworten gefunden."
                  : status === "stale_refinement"
                    ? "Dein Feinschliff-Stand hat sich geändert."
                    : status === "completion_failed"
                      ? "Deine Antwort ist gespeichert. Die Übergabe hat gerade nicht geklappt."
                      : "Speichern hat gerade nicht geklappt."}
              </p>
              <p className="mt-1">
                {status === "revision_conflict"
                  ? "Der Stand wurde neu geladen. Du machst ohne Überschreiben bei der nächsten offenen Frage weiter."
                  : status === "stale_refinement"
                    ? "Deine Antwort ist gespeichert. Lade neu, dann machst du auf dem aktuellen Stand weiter."
                    : status === "completion_failed"
                      ? "Du musst diese Antwort nicht noch einmal speichern. Versuche nur die Übergabe erneut."
                      : "Deine Auswahl bleibt auf dieser Seite sichtbar. Versuche das Speichern noch einmal."}
              </p>
            </div>
          ) : null}
          <div aria-live="polite" className="sr-only">
            {liveMessage ?? saveStatusText(status)}
          </div>
          <ActionDock
            disabled={(!complete && status !== "stale_refinement") || status === "saving"}
            isRetry={
              status === "save_failed" ||
              status === "completion_failed" ||
              status === "stale_refinement"
            }
            onSubmit={onSubmit}
            retryLabel={
              status === "stale_refinement"
                ? "Feinschliff neu laden"
                : status === "completion_failed"
                  ? "Übergabe erneut versuchen"
                  : "Erneut versuchen"
            }
            saving={status === "saving"}
          />
        </section>
      </main>
    </div>
  )
}

function renderQuestionBody({
  session,
  questionId,
  answer,
  onLocalAnswerChange,
}: {
  session: Stage2RefinementSession
  questionId: Stage2QuestionId
  answer: unknown
  onLocalAnswerChange: (answer: unknown, announcement?: string) => void
}): {
  title: string
  lead?: string
  sectionLabel: (typeof STAGE2_MODULE_SECTION_LABELS)[Stage2Module]
  trigger?: string
  info?: { title: string; body: string }
  body: ReactNode
  note?: ReactNode
} {
  const sectionLabel = STAGE2_MODULE_SECTION_LABELS[getStage2QuestionModule(questionId)]

  if (questionId.startsWith("heat:")) {
    const source = questionId.slice("heat:".length) as Stage2HeatEventSource
    const heatAnswer = (answer ?? {}) as HeatEventAnswer
    return {
      sectionLabel,
      title: `Wie oft nutzt du ${HEAT_SOURCE_TITLES[source]}?`,
      lead: requiresStage2HeatProtection(source)
        ? "Gib deinen üblichen Rhythmus an und ob du dabei Hitzeschutz verwendest."
        : "Gib deinen üblichen Rhythmus an.",
      body: (
        <div className="grid gap-6">
          <div>
            <h3 className="mb-2 text-sm font-bold text-[var(--brand-plum-darkest,#2a1845)]">
              Wie häufig?
            </h3>
            <RefinementOptions
              options={WET_WASH_FREQUENCY_OPTIONS.filter(
                (option): option is (typeof WET_WASH_FREQUENCY_OPTIONS)[number] =>
                  option.value !== "does_not_wash",
              )}
              value={heatAnswer.frequency}
              onChange={(frequency) =>
                onLocalAnswerChange({
                  ...heatAnswer,
                  frequency: frequency as ProductFrequency,
                })
              }
            />
          </div>
          {requiresStage2HeatProtection(source) ? (
            <div>
              <h3 className="mb-2 text-sm font-bold text-[var(--brand-plum-darkest,#2a1845)]">
                Wie konsequent nutzt du dabei Hitzeschutz?
              </h3>
              <RefinementOptions
                options={HEAT_PROTECTION_OPTIONS}
                value={heatAnswer.protectionConsistency}
                onChange={(protectionConsistency) =>
                  onLocalAnswerChange({
                    ...heatAnswer,
                    protectionConsistency,
                  })
                }
              />
            </div>
          ) : null}
        </div>
      ),
    }
  }

  switch (questionId) {
    case "current_product_categories": {
      const selected = Array.isArray(answer) ? (answer as Stage2ProductCategory[]) : undefined
      const relevant = new Set(session.triggerContext.relevantCategories)
      const relevantOptions = REFINEMENT_CATEGORY_OPTIONS.filter((option) =>
        relevant.has(option.value),
      )
      const remainingOptions = REFINEMENT_CATEGORY_OPTIONS.filter(
        (option) => !relevant.has(option.value),
      )
      const selectedValues = selected ?? []
      const selectedRelevantValues = selected?.filter((value) => relevant.has(value))
      const selectedRemainingValues = selected?.filter((value) => !relevant.has(value))
      const mergeCategoryGroup = (
        groupOptions: readonly { value: Stage2ProductCategory }[],
        nextGroupSelection: readonly Stage2ProductCategory[],
      ) =>
        mergeGroupedCategorySelection({
          currentSelection: selectedValues,
          groupValues: groupOptions.map((option) => option.value),
          nextGroupSelection,
        })
      return {
        sectionLabel,
        title: "Welche Produkte nutzt du?",
        lead: "Alle unterstützten Kategorien: zuerst für deinen Plan, danach alle weiteren.",
        body: (
          <div className="grid gap-5">
            {relevantOptions.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-plum)]">
                  Für deinen Plan
                </p>
                <RefinementOptions
                  options={relevantOptions}
                  value={selectedRelevantValues}
                  multi
                  onChange={(next) =>
                    onLocalAnswerChange(
                      mergeCategoryGroup(relevantOptions, next as Stage2ProductCategory[]),
                    )
                  }
                />
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted,#736f69)]">
                Weitere Kategorien
              </p>
              <RefinementOptions
                options={remainingOptions}
                value={
                  selectedValues.length > 0 && selectedRemainingValues?.length === 0
                    ? undefined
                    : selectedRemainingValues
                }
                multi
                allowNone
                noneLabel="Keine weiteren"
                noneDescription="Du nutzt keine weiteren Kategorien."
                noneAriaLabel="Keine weiteren; ersetzt die Auswahl unter Weitere Kategorien"
                onNoneChange={() =>
                  onLocalAnswerChange(
                    mergeCategoryGroup(remainingOptions, []),
                    "Auswahl unter Weitere Kategorien aufgehoben.",
                  )
                }
                onChange={(next) =>
                  onLocalAnswerChange(
                    mergeCategoryGroup(remainingOptions, next as Stage2ProductCategory[]),
                  )
                }
              />
            </div>
          </div>
        ),
      }
    }
    case "wet_wash_frequency":
      return {
        sectionLabel,
        title: "Wie oft wäschst du deine Haare nass?",
        lead: "Es geht um deinen allgemeinen Rhythmus, nicht um ein konkretes Shampoo.",
        body: (
          <WetWashFrequencyScale
            value={answer as WetWashFrequency | undefined}
            onChange={(frequency) => onLocalAnswerChange(frequency)}
          />
        ),
      }
    case "scalp_irritation_detail":
      return {
        sectionLabel,
        title: "Wie fühlt sich deine Kopfhaut aktuell an?",
        lead: "Wähle, was heute am besten passt.",
        body: (
          <RefinementOptions
            options={SCALP_IRRITATION_OPTIONS}
            value={answer as string | undefined}
            onChange={onLocalAnswerChange}
          />
        ),
        note:
          answer === "burning_painful_or_inflamed" ? (
            <RefinementInlineNote>
              Bei brennender, schmerzhafter oder entzündeter Kopfhaut gilt: kosmetische
              Kopfhaut-Empfehlungen pausieren. Eine ärztliche oder dermatologische Einschätzung kann
              sinnvoll sein; Chaarlie stellt keine Diagnose und verschreibt nichts.
            </RefinementInlineNote>
          ) : null,
      }
    case "dry_shampoo_bridge_preference":
      return {
        sectionLabel,
        title: "Möchtest du Trockenshampoo zwischen Nasswäschen nutzen?",
        lead: "Ein konkretes Produkt wählen wir erst im nächsten Schritt aus.",
        body: (
          <RefinementOptions
            options={DRY_SHAMPOO_BRIDGE_OPTIONS}
            value={answer as string | undefined}
            onChange={onLocalAnswerChange}
          />
        ),
      }
    case "dry_shampoo_visible_hair_color":
      return {
        sectionLabel,
        title: "Welche sichtbare Ansatzfarbe hast du?",
        lead: "Es geht um sichtbaren Ansatz und mögliche Rückstände, nicht um chemische Haarfarbe.",
        body: (
          <RefinementOptions
            options={ROOT_COLOR_OPTIONS}
            value={answer as string | undefined}
            onChange={onLocalAnswerChange}
          />
        ),
      }
    case "oil_purposes":
      return {
        sectionLabel,
        title: "Wofür nutzt du Öl?",
        lead: "Mehrfachauswahl. Ein Öl kann später mehrere Aufgaben übernehmen.",
        body: (
          <RefinementOptions
            options={OIL_PURPOSE_OPTIONS}
            value={(answer ?? []) as string[]}
            multi
            onChange={onLocalAnswerChange}
          />
        ),
      }
    case "towel_handling": {
      const towel = (answer ?? {}) as { material?: TowelMaterial; technique?: TowelTechnique }
      return {
        sectionLabel,
        title: "Wie trocknest du dein Haar direkt nach der Wäsche an?",
        body: (
          <div className="grid gap-6">
            <div>
              <h3 className="mb-2 text-sm font-bold text-[var(--brand-plum-darkest,#2a1845)]">
                Welches Material nutzt du meistens?
              </h3>
              <RefinementOptions
                options={TOWEL_MATERIAL_OPTIONS}
                value={towel.material}
                onChange={(material) =>
                  onLocalAnswerChange(
                    material === "no_towel" ? { material } : { ...towel, material },
                  )
                }
              />
            </div>
            {towel.material && towel.material !== "no_towel" ? (
              <div>
                <h3 className="mb-2 text-sm font-bold text-[var(--brand-plum-darkest,#2a1845)]">
                  Wie gehst du damit meistens um?
                </h3>
                <RefinementOptions
                  options={TOWEL_TECHNIQUE_OPTIONS}
                  value={towel.technique}
                  onChange={(technique) => onLocalAnswerChange({ ...towel, technique })}
                />
              </div>
            ) : null}
          </div>
        ),
      }
    }
    case "drying_routes":
      return {
        sectionLabel,
        title: "Wie trocknet dein Haar meistens weiter?",
        lead: "Mehrere Wege dürfen parallel vorkommen.",
        body: (
          <RefinementOptions
            options={DRYING_ROUTE_OPTIONS}
            value={answer as string[] | undefined}
            multi
            allowNone
            noneDescription="Keiner dieser Wege trifft gerade zu."
            onChange={onLocalAnswerChange}
          />
        ),
      }
    case "additional_heat_tools":
      return {
        sectionLabel,
        trigger: "Zusätzliche Tools",
        title: "Welche weiteren Hitze-Tools nutzt du?",
        lead: "Wähle nur zusätzliche Geräte neben Föhn oder Diffusor.",
        body: (
          <RefinementOptions
            options={ADDITIONAL_HEAT_TOOL_OPTIONS}
            value={answer as string[] | undefined}
            multi
            allowNone
            layout="grid"
            noneDescription="Ich nutze keine weiteren Hitze-Tools."
            onChange={onLocalAnswerChange}
          />
        ),
      }
    case "night_protection":
      return {
        sectionLabel,
        trigger: "Nachtschutz",
        title: "Was schützt dein Haar nachts meistens?",
        lead: "Wähle alles aus, was meistens zu deiner Nacht gehört.",
        body: (
          <RefinementOptions
            options={NIGHT_PROTECTION_OPTIONS}
            value={answer as string[] | undefined}
            multi
            allowNone
            noneDescription="Ich nutze meistens keinen dieser Nachtschutz-Schritte."
            onChange={onLocalAnswerChange}
          />
        ),
      }
  }
  throw new Error(`Unknown Stage 2 refinement question: ${questionId}`)
}

function saveStatusText(status: RefinementQuestionStatus): string {
  if (status === "saving") return "speichert"
  if (status === "save_failed") return "nicht gespeichert"
  if (status === "completion_failed") return "Übergabe offen"
  if (status === "stale_refinement") return "Stand veraltet"
  if (status === "revision_conflict") return "neu geladen"
  if (status === "saved") return "gespeichert"
  return ""
}

export function journeySaveStatus(status: RefinementQuestionStatus) {
  if (status === "saving") return "saving" as const
  if (status === "saved") return "saved" as const
  if (status === "save_failed" || status === "completion_failed" || status === "stale_refinement")
    return "error" as const
  return "idle" as const
}

function ActionDock({
  disabled,
  isRetry,
  retryLabel,
  saving,
  onSubmit,
}: {
  disabled: boolean
  isRetry: boolean
  retryLabel: string
  saving: boolean
  onSubmit: () => void
}) {
  const transitionLayer = usePersonalPlanTransitionLayer()
  const [dockTarget, setDockTarget] = useState<HTMLElement | null>(null)
  const [mobile, setMobile] = useState(false)
  const previousOffsetRef = useRef<{ priority: string; value: string } | null>(null)

  useEffect(() => {
    if (transitionLayer === "outgoing") return
    const query = window.matchMedia("(max-width: 767px)")
    const update = (event: MediaQueryListEvent) => setMobile(event.matches)
    const frame = window.requestAnimationFrame(() => {
      setDockTarget(document.body)
      setMobile(query.matches)
    })
    query.addEventListener("change", update)
    return () => {
      window.cancelAnimationFrame(frame)
      query.removeEventListener("change", update)
    }
  }, [transitionLayer])

  useEffect(() => {
    if (transitionLayer === "outgoing" || !dockTarget || !mobile) return

    const rootStyle = document.documentElement.style
    previousOffsetRef.current = {
      priority: rootStyle.getPropertyPriority("--landing-sticky-cta-offset"),
      value: rootStyle.getPropertyValue("--landing-sticky-cta-offset"),
    }
    let frame = 0
    let ownedOffset = ""
    const updateOffset = () => {
      const dock = dockTarget.querySelector<HTMLElement>("[data-stage2-mobile-dock=portal]")
      if (!dock) return
      ownedOffset = `${Math.ceil(dock.getBoundingClientRect().height)}px`
      rootStyle.setProperty("--landing-sticky-cta-offset", ownedOffset)
    }
    frame = window.requestAnimationFrame(updateOffset)
    window.addEventListener("resize", updateOffset)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", updateOffset)
      const previous = previousOffsetRef.current
      previousOffsetRef.current = null
      if (rootStyle.getPropertyValue("--landing-sticky-cta-offset") !== ownedOffset) return
      if (previous?.value) {
        rootStyle.setProperty("--landing-sticky-cta-offset", previous.value, previous.priority)
      } else {
        rootStyle.removeProperty("--landing-sticky-cta-offset")
      }
    }
  }, [dockTarget, mobile, transitionLayer])

  if (transitionLayer === "outgoing") return null

  const dock = (
    <div
      className={cn(
        "z-40 flex gap-2 border-t border-[rgba(231,224,217,0.9)] bg-[rgba(253,251,249,0.97)] p-3 backdrop-blur md:static md:mt-7 md:border-t md:px-0 md:pb-0",
        mobile
          ? "fixed bottom-0 left-0 right-0 px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))]"
          : "sticky bottom-0 -mx-5",
      )}
      data-stage2-mobile-dock={mobile ? "portal" : undefined}
    >
      <Button
        type="button"
        disabled={disabled}
        onClick={onSubmit}
        variant="funnelCta"
        className="flex-1"
      >
        {saving ? "Speichert ..." : isRetry ? retryLabel : "Weiter"}
      </Button>
    </div>
  )

  if (dockTarget && mobile) return createPortal(dock, dockTarget)
  return dock
}

export function getQuestionFamily(questionId: Stage2QuestionId) {
  if (questionId === "current_product_categories") return "product_categories"
  if (questionId === "wet_wash_frequency") return "wash_rhythm"
  if (questionId === "oil_purposes") return "oil_role"
  if (questionId === "towel_handling") return "towel_handling"
  if (
    questionId === "drying_routes" ||
    questionId === "additional_heat_tools" ||
    questionId.startsWith("heat:")
  )
    return "heat_behavior"
  if (questionId === "night_protection") return "night_behavior"
  return "conditional_context"
}

/** Telemetry section, derived from the path model's module mapping (single source of truth). */
export function getQuestionSection(questionId: Stage2QuestionId) {
  return getStage2QuestionModule(questionId) === "habits" ? "hair_handling" : "current_products"
}
