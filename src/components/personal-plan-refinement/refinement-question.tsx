"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { InfoTip } from "@/components/ui/info-tip"
import { requiresStage2HeatProtection } from "@/lib/personal-plan/refinement/heat-events"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type {
  HeatEventAnswer,
  PersonalPlanRefinementAnswersV1,
  ProductFrequency,
  Stage2HeatEventSource,
  Stage2ProductCategory,
  Stage2QuestionId,
  TowelMaterial,
  TowelTechnique,
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
}

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
}: RefinementQuestionProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const answer = localAnswer ?? getAnswerForQuestion(session.answers, questionId)
  const complete = isLocalAnswerComplete(questionId, answer)

  useEffect(() => {
    headingRef.current?.focus()
  }, [questionId])

  const question = renderQuestionBody({
    session,
    questionId,
    answer,
    onLocalAnswerChange,
  })

  return (
    <div className="min-h-dvh bg-[var(--background-soft,#fdfbf9)] text-[var(--text-main,#3a3835)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1180px]">
        <aside className="sticky top-0 hidden h-dvh w-1/2 self-start items-center justify-center overflow-hidden bg-[var(--brand-plum-darkest,#21182b)] px-12 text-center text-white lg:flex">
          <div className="max-w-sm">
            <p className="font-serif text-5xl leading-none tracking-normal">Chaarlie</p>
            <div className="mx-auto my-6 h-0.5 w-12 rounded-full bg-white/35" />
            <p className="text-base leading-7 text-white/70">
              Dein Bedarfsplan steht. Jetzt wird die Routine präziser.
            </p>
            <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white/75">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-coral,#d4616a)]" />
              Stage 2
            </p>
          </div>
        </aside>
        <main className="flex min-h-dvh w-full min-w-0 flex-col bg-[var(--background,#fdfbf9)] lg:w-1/2">
          <header className="sticky top-0 z-20 grid min-h-[60px] grid-cols-[44px_minmax(0,1fr)_auto] items-center border-b border-[rgba(231,224,217,0.9)] bg-[rgba(253,251,249,0.96)] px-4 backdrop-blur">
            <button
              type="button"
              onClick={onBack}
              disabled={!canGoBack}
              aria-label="Zurück"
              className={cn(
                "grid h-11 w-11 place-items-center rounded-xl text-[var(--text-sub,#6a6560)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)]",
                canGoBack ? "hover:bg-[var(--brand-plum-ice)]" : "invisible",
              )}
            >
              <span aria-hidden="true">←</span>
            </button>
            <div className="min-w-0 text-center">
              <strong className="block truncate font-serif text-lg font-medium text-[var(--brand-plum-darkest,#2a1845)]">
                Chaarlie
              </strong>
              <span className="block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[var(--text-muted,#736f69)]">
                Verfeinerung
              </span>
            </div>
            <SaveChip status={status} />
          </header>

          <section className="mx-auto w-full max-w-[540px] flex-1 px-5 pb-32 pt-5 md:pb-8">
            <SectionProgress questionId={questionId} />
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
              <p className="mt-2 text-sm leading-6 text-[var(--text-sub,#6a6560)]">
                {question.lead}
              </p>
            ) : null}
            <div className="mt-5">{question.body}</div>
            {question.note}
            {status === "save_failed" ||
            status === "completion_failed" ||
            status === "revision_conflict" ? (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-[rgba(163,67,75,0.25)] bg-[#fff1f2] p-4 text-sm leading-6 text-[#765b5e]"
              >
                <p className="font-bold text-[#a3434b]">
                  {status === "revision_conflict"
                    ? "Wir haben neuere gespeicherte Antworten gefunden."
                    : status === "completion_failed"
                      ? "Deine Antwort ist gespeichert. Die Übergabe hat gerade nicht geklappt."
                      : "Speichern hat gerade nicht geklappt."}
                </p>
                <p className="mt-1">
                  {status === "revision_conflict"
                    ? "Der Stand wurde neu geladen. Du machst ohne Überschreiben bei der nächsten offenen Frage weiter."
                    : status === "completion_failed"
                      ? "Du musst diese Antwort nicht noch einmal speichern. Versuche nur die Übergabe erneut."
                      : "Deine Auswahl bleibt lokal sichtbar. Versuche es noch einmal, damit diese Seite wirklich gespeichert ist."}
                </p>
              </div>
            ) : null}
            <div aria-live="polite" className="sr-only">
              {liveMessage ?? saveStatusText(status)}
            </div>
            <ActionDock
              disabled={!complete || status === "saving"}
              isRetry={status === "save_failed" || status === "completion_failed"}
              onSecondaryExit={onSecondaryExit}
              onSubmit={onSubmit}
              retryLabel={
                status === "completion_failed" ? "Übergabe erneut versuchen" : "Erneut versuchen"
              }
              saving={status === "saving"}
            />
          </section>
        </main>
      </div>
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
  sectionLabel: "Was du heute benutzt" | "Wie du dein Haar behandelst"
  trigger?: string
  info?: { title: string; body: string }
  body: ReactNode
  note?: ReactNode
} {
  if (questionId.startsWith("heat:")) {
    const source = questionId.slice("heat:".length) as Stage2HeatEventSource
    const heatAnswer = (answer ?? {}) as HeatEventAnswer
    return {
      sectionLabel: "Wie du dein Haar behandelst",
      trigger: "Hitzeereignis",
      title: `Wie oft nutzt du ${HEAT_SOURCE_TITLES[source]}?`,
      lead: "Häufigkeit und Hitzeschutz gehören hier zu genau diesem Ereignis.",
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
      note: (
        <RefinementInlineNote>
          Gewöhnlicher Luftstrom fragt nur die Häufigkeit ab. Formender Luftstrom und direkte Hitze
          brauchen zusätzlich die Hitzeschutz-Konsistenz.
        </RefinementInlineNote>
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
        sectionLabel: "Was du heute benutzt",
        title: "Welche Produktarten benutzt du aktuell?",
        lead: "Wähle nur Kategorien, die gerade wirklich in deiner Routine vorkommen. Das sagt noch nicht, ob sie gut passen.",
        body: (
          <div className="grid gap-5">
            {relevantOptions.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-plum)]">
                  Für deinen Bedarfsplan relevant
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
                Weitere unterstützte Kategorien
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
                noneDescription="Ich nutze aktuell keine der genannten Produktarten."
                onNoneChange={() => onLocalAnswerChange([], "Andere Auswahl wurde gelöscht.")}
                onChange={(next) =>
                  onLocalAnswerChange(
                    mergeCategoryGroup(remainingOptions, next as Stage2ProductCategory[]),
                  )
                }
              />
            </div>
          </div>
        ),
        note: (
          <RefinementInlineNote>
            Die Reihenfolge kann relevante Kategorien zuerst zeigen. Vorausgewählt wird dadurch
            nichts.
          </RefinementInlineNote>
        ),
      }
    }
    case "wet_wash_frequency":
      return {
        sectionLabel: "Was du heute benutzt",
        title: "Wie oft wäschst du deine Haare nass?",
        lead: "Es geht um deinen allgemeinen Rhythmus, nicht um ein konkretes Shampoo.",
        body: (
          <RefinementOptions
            options={WET_WASH_FREQUENCY_OPTIONS}
            value={answer as string | undefined}
            onChange={onLocalAnswerChange}
          />
        ),
        note: (
          <RefinementInlineNote>
            Diese eine Rhythmusfrage verändert Shampoo-Rhythmus, Trockenshampoo-Brücke,
            Maskenplanung und Tiefenreinigung.
          </RefinementInlineNote>
        ),
      }
    case "scalp_irritation_detail":
      return {
        sectionLabel: "Was du heute benutzt",
        trigger: "Weil empfindliche / gereizte Kopfhaut relevant ist",
        title: "Wie fühlt sich deine Kopfhaut aktuell an?",
        lead: "Diese Grenze hält kosmetische Pflege von medizinisch abklärbaren Beschwerden getrennt.",
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
        sectionLabel: "Was du heute benutzt",
        trigger: "Weil Kopfhaut und Waschrhythmus eine Brücke nahelegen",
        title: "Möchtest du Trockenshampoo zwischen Nasswäschen nutzen?",
        lead: "Das ist nur eine Brücken-Entscheidung. Konkrete Produkte kommen später.",
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
        sectionLabel: "Was du heute benutzt",
        trigger: "Weil Trockenshampoo Teil deines Wegs ist",
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
        sectionLabel: "Was du heute benutzt",
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
        sectionLabel: "Wie du dein Haar behandelst",
        title: "Wie trocknest du dein Haar direkt nach der Wäsche an?",
        lead: "Material und Technik bleiben auf einer Seite, weil sie zusammengehören.",
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
        sectionLabel: "Wie du dein Haar behandelst",
        title: "Wie trocknet dein Haar meistens weiter?",
        lead: "Mehrere Wege dürfen parallel vorkommen.",
        body: (
          <RefinementOptions
            options={DRYING_ROUTE_OPTIONS}
            value={(answer ?? []) as string[]}
            multi
            allowNone
            noneDescription="Keiner dieser Wege trifft gerade zu."
            onChange={onLocalAnswerChange}
          />
        ),
        note: (
          <RefinementInlineNote>
            Föhn und Diffusor gehören zu den Trocknungswegen. Sie werden auf der nächsten Seite
            nicht noch einmal als zusätzliche Hitze-Tools abgefragt.
          </RefinementInlineNote>
        ),
      }
    case "additional_heat_tools":
      return {
        sectionLabel: "Wie du dein Haar behandelst",
        trigger: "Zusätzliche Tools",
        title: "Welche weiteren Hitze-Tools nutzt du?",
        lead: "Föhn und Diffusor sind bereits erfasst. Wähle hier nur weitere Tools.",
        body: (
          <RefinementOptions
            options={ADDITIONAL_HEAT_TOOL_OPTIONS}
            value={(answer ?? []) as string[]}
            multi
            allowNone
            noneDescription="Ich nutze keine weiteren Hitze-Tools."
            onChange={onLocalAnswerChange}
          />
        ),
      }
    case "night_protection":
      return {
        sectionLabel: "Wie du dein Haar behandelst",
        trigger: "Nachtschutz",
        title: "Was schützt dein Haar nachts meistens?",
        lead: "Wähle alles aus, was meistens zu deiner Nacht gehört.",
        body: (
          <RefinementOptions
            options={NIGHT_PROTECTION_OPTIONS}
            value={(answer ?? []) as string[]}
            multi
            allowNone
            noneDescription="Ich nutze meistens keinen dieser Nachtschutz-Schritte."
            onChange={onLocalAnswerChange}
          />
        ),
        note: (
          <RefinementInlineNote>
            Nachtverhalten kann mechanische Reibung und Zug beeinflussen, unabhängig davon, welche
            Produkte oder Tools du nutzt.
          </RefinementInlineNote>
        ),
      }
  }
  throw new Error(`Unknown Stage 2 refinement question: ${questionId}`)
}

function SectionProgress({ questionId }: { questionId: Stage2QuestionId }) {
  const isHandling =
    questionId === "towel_handling" ||
    questionId === "drying_routes" ||
    questionId === "additional_heat_tools" ||
    questionId === "night_protection" ||
    questionId.startsWith("heat:")
  return (
    <div className="mb-5">
      <div className="relative grid grid-cols-2 gap-4 pt-3">
        <span className="absolute left-0 right-0 top-1 h-1 rounded-full bg-[var(--border,#e7e0d9)]" />
        <span
          className={cn(
            "absolute left-0 top-1 h-1 rounded-full bg-[var(--brand-plum)] transition-all",
            isHandling ? "w-full" : "w-1/3",
          )}
        />
        <span
          className={cn(
            "relative text-[10px] font-bold",
            isHandling ? "text-[var(--brand-plum)]" : "text-[var(--brand-plum)]",
          )}
        >
          Was du heute benutzt
        </span>
        <span
          className={cn(
            "relative text-right text-[10px] font-bold",
            isHandling ? "text-[var(--brand-plum)]" : "text-[var(--text-muted,#736f69)]",
          )}
        >
          Wie du dein Haar behandelst
        </span>
      </div>
    </div>
  )
}

function SaveChip({ status }: { status: RefinementQuestionStatus }) {
  return (
    <div
      className={cn(
        "inline-flex min-w-[84px] items-center justify-end gap-1.5 text-[10px] font-bold",
        status === "save_failed" || status === "completion_failed" || status === "revision_conflict"
          ? "text-[#a3434b]"
          : status === "saving"
            ? "text-[var(--brand-plum)]"
            : "text-[#4f8058]",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {saveStatusText(status)}
    </div>
  )
}

function saveStatusText(status: RefinementQuestionStatus): string {
  if (status === "saving") return "speichert"
  if (status === "save_failed") return "nicht gespeichert"
  if (status === "completion_failed") return "Übergabe offen"
  if (status === "revision_conflict") return "neu geladen"
  if (status === "saved") return "gespeichert"
  return "bereit"
}

function ActionDock({
  disabled,
  isRetry,
  retryLabel,
  saving,
  onSecondaryExit,
  onSubmit,
}: {
  disabled: boolean
  isRetry: boolean
  retryLabel: string
  saving: boolean
  onSecondaryExit: () => void
  onSubmit: () => void
}) {
  const [dockTarget, setDockTarget] = useState<HTMLElement | null>(null)
  const [mobile, setMobile] = useState(false)
  const previousOffsetRef = useRef<{ priority: string; value: string } | null>(null)

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (!dockTarget || !mobile) return

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
  }, [dockTarget, mobile])

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
      <button
        type="button"
        onClick={onSecondaryExit}
        className="min-h-[52px] rounded-xl px-3 text-sm font-bold text-[var(--brand-plum)] transition hover:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)]"
      >
        Zum Bedarfsplan
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onSubmit}
        className="min-h-[52px] flex-1 rounded-xl bg-[var(--brand-coral,#d4616a)] px-4 text-sm font-bold text-white shadow-[0_10px_25px_rgba(212,97,106,0.18)] transition hover:bg-[var(--brand-coral-dark,#c0555d)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-plum-rgb),0.35)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {saving ? "Speichert ..." : isRetry ? retryLabel : "Weiter"}
      </button>
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

export function getQuestionSection(questionId: Stage2QuestionId) {
  return questionId === "towel_handling" ||
    questionId === "drying_routes" ||
    questionId === "additional_heat_tools" ||
    questionId === "night_protection" ||
    questionId.startsWith("heat:")
    ? "hair_handling"
    : "current_products"
}
