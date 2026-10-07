"use client"

import { useRef, type Dispatch, type ReactNode, type SetStateAction } from "react"

import {
  CURRENT_PROBLEMS_TITLE,
  QUESTION_CONFIGS,
  getConcernOptions,
} from "@/components/personal-plan-quiz/quiz-data"
import { TEXTURE_OPTIONS } from "@/components/personal-plan-quiz/texture-question"
import { MAIN_PROBLEM_SHEET_TITLE } from "@/components/quiz/quiz-main-problem-sheet"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Textarea } from "@/components/ui/textarea"
import {
  PROBLEM_NOTE_MAX_LENGTH,
  haarCheckSaveBlock,
  pickMainProblem,
  selectNoScalpConcern,
  setProblemNote,
  showsMainProblemQuestion,
  toggleChemicalTreatment,
  toggleProblem,
  toggleProblemNote,
  toggleScalpConcern,
  type HaarCheckBlock,
  type HaarCheckDraft,
} from "@/lib/profile/haar-check-draft"
import { cn } from "@/lib/utils"

/** The quiz's own options and wording (clean-switch task 8) — one option source, no copies. */
function quizOptions(key: keyof typeof QUESTION_CONFIGS) {
  return (QUESTION_CONFIGS[key]?.options ?? []).map(({ value, label }) => ({ value, label }))
}

const HAAR_CHECK_TEXTURE_OPTIONS = TEXTURE_OPTIONS.map(({ value, label }) => ({ value, label }))
const HAAR_CHECK_THICKNESS_OPTIONS = quizOptions("thickness")
const HAAR_CHECK_DENSITY_OPTIONS = quizOptions("density")
const HAAR_CHECK_LENGTH_OPTIONS = quizOptions("hair_length")
const HAAR_CHECK_SURFACE_OPTIONS = quizOptions("hair_surface")
const HAAR_CHECK_ELASTICITY_OPTIONS = quizOptions("elastic_response")
const HAAR_CHECK_CHEMICAL_OPTIONS = quizOptions("chemical_treatments")
const HAAR_CHECK_SCALP_TYPE_OPTIONS = quizOptions("scalp_oiliness")
const HAAR_CHECK_SCALP_CONCERN_OPTIONS = quizOptions("scalp_concerns")

const CHEMICAL_TREATMENTS_TITLE = "Chemische Behandlungen"

/** Shown under the save button while saving is not possible yet; each names the field by its
 * visible title. */
const HAAR_CHECK_BLOCK_HINTS: Record<HaarCheckBlock, string> = {
  problems: `Wähle bei „${CURRENT_PROBLEMS_TITLE}“ mindestens eine Antwort aus oder beschreib dein Thema unter „Etwas anderes“.`,
  main_problem: `Wähle bei „${CURRENT_PROBLEMS_TITLE}“ noch aus, was dich am meisten stört.`,
  chemical_treatments: `Wähle bei „${CHEMICAL_TREATMENTS_TITLE}“ mindestens eine Antwort aus.`,
}

/** The editor field each block points to (keys as registered below). */
const HAAR_CHECK_BLOCK_FIELDS: Record<HaarCheckBlock, string> = {
  problems: "concerns",
  main_problem: "main_problem",
  chemical_treatments: "chemical_treatment",
}

const SAVE_HINT_ID = "haar-check-save-hint"

/** A toggle chip; inside a single-choice group it is a `radio` (the SegmentedControl pattern:
 * `role="radio"` + `aria-checked`, no arrow-key handling). */
function ChoiceChip({
  active,
  onClick,
  children,
  radio = false,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  radio?: boolean
}) {
  return (
    <button
      type="button"
      {...(radio ? { role: "radio", "aria-checked": active } : { "aria-pressed": active })}
      onClick={onClick}
      className={cn(
        "min-h-[40px] max-w-full rounded-2xl border px-3 py-2 text-left text-sm leading-snug transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

function QuizEditorField({
  title,
  text,
  children,
  className,
}: {
  title: string
  text: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-card/80 p-4", className)}>
      <p className="text-sm font-semibold text-[var(--text-heading)]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

/**
 * The inline Haar-Check editor on the profile page (clean-switch task 8): every field on the
 * quiz's options and wording; the rules live in `src/lib/profile/haar-check-draft.ts`.
 * `registerField` hands the page each field's node under its profile field key, so tapping a
 * field card scrolls to and focuses the matching editor field.
 */
export function HaarCheckEditor({
  draft,
  initialDraft,
  onDraftChange,
  saving,
  onSave,
  onCancel,
  registerField,
  showPlanRecomputeNotice = false,
}: {
  draft: HaarCheckDraft
  initialDraft: HaarCheckDraft
  onDraftChange: Dispatch<SetStateAction<HaarCheckDraft>>
  saving: boolean
  onSave: () => void
  onCancel: () => void
  registerField: (key: string, node: HTMLDivElement | null) => void
  /** Plan users only: saving recomputes their Personal Plan, so say so above the buttons. */
  showPlanRecomputeNotice?: boolean
}) {
  const problemOptions = getConcernOptions(draft.texture)
  const saveBlock = haarCheckSaveBlock(draft, initialDraft)
  const fieldNodes = useRef<Record<string, HTMLDivElement | null>>({})
  const register = (key: string) => (node: HTMLDivElement | null) => {
    fieldNodes.current[key] = node
    registerField(key, node)
  }

  /** „Zur Frage“: bring the field that blocks saving into view and focus its first control. */
  function showBlockingField(block: HaarCheckBlock) {
    const node = fieldNodes.current[HAAR_CHECK_BLOCK_FIELDS[block]]
    if (!node) return
    node.scrollIntoView({ behavior: "smooth", block: "center" })
    node.querySelector<HTMLElement>("button, textarea, input")?.focus({ preventScroll: true })
  }

  return (
    <div className="rounded-2xl border border-primary/15 bg-muted/35 p-5">
      <div className="mb-5">
        <p className="text-sm font-semibold text-[var(--text-heading)]">
          Haar-Check direkt im Profil aktualisieren
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Passe die Antworten an, die sich geändert haben.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div ref={register("hair_texture")}>
          <QuizEditorField
            title="Haarstruktur"
            text="Welche Haarstruktur die meisten deiner Haare haben."
          >
            <SegmentedControl
              options={HAAR_CHECK_TEXTURE_OPTIONS}
              value={draft.texture ?? ""}
              onChange={(value) =>
                onDraftChange((current) => ({
                  ...current,
                  texture: value as HaarCheckDraft["texture"],
                }))
              }
            />
          </QuizEditorField>
        </div>

        <div ref={register("thickness")}>
          <QuizEditorField
            title="Haardicke"
            text="Wie sich ein einzelnes Haar bei dir meistens im Vergleich zu einem Nähfaden anfühlt."
          >
            <SegmentedControl
              options={HAAR_CHECK_THICKNESS_OPTIONS}
              value={draft.thickness ?? ""}
              onChange={(value) =>
                onDraftChange((current) => ({
                  ...current,
                  thickness: value as HaarCheckDraft["thickness"],
                }))
              }
            />
          </QuizEditorField>
        </div>

        <div ref={register("density")}>
          <QuizEditorField
            title="Haardichte"
            text="Wie viele Haare du insgesamt hast – nicht wie dick ein einzelnes Haar ist."
          >
            <SegmentedControl
              options={HAAR_CHECK_DENSITY_OPTIONS}
              value={draft.density ?? ""}
              onChange={(value) =>
                onDraftChange((current) => ({
                  ...current,
                  density: value as HaarCheckDraft["density"],
                }))
              }
            />
          </QuizEditorField>
        </div>

        <div ref={register("hair_length")}>
          <QuizEditorField
            title="Haarlänge"
            text="Wie lang deine Haare aktuell sind; bei Locken zählt die sanft gestreckte Länge."
          >
            <SegmentedControl
              options={HAAR_CHECK_LENGTH_OPTIONS}
              value={draft.hairLength ?? ""}
              onChange={(value) =>
                onDraftChange((current) => ({
                  ...current,
                  hairLength: value as HaarCheckDraft["hairLength"],
                }))
              }
            />
          </QuizEditorField>
        </div>

        <div ref={register("cuticle_condition")}>
          <QuizEditorField title="Oberfläche" text="Wie sich dein Haar im Finger-Test anfühlt.">
            <SegmentedControl
              options={HAAR_CHECK_SURFACE_OPTIONS}
              value={draft.hairSurface ?? ""}
              onChange={(value) =>
                onDraftChange((current) => ({
                  ...current,
                  hairSurface: value as HaarCheckDraft["hairSurface"],
                }))
              }
            />
          </QuizEditorField>
        </div>

        <div ref={register("protein_moisture_balance")}>
          <QuizEditorField title="Elastizität" text="Wie dein Haar im Zug-Test reagiert.">
            <div role="radiogroup" aria-label="Elastizität" className="flex flex-wrap gap-2">
              {HAAR_CHECK_ELASTICITY_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  radio
                  active={draft.elasticResponse === option.value}
                  onClick={() =>
                    onDraftChange((current) => ({
                      ...current,
                      elasticResponse: option.value as HaarCheckDraft["elasticResponse"],
                    }))
                  }
                >
                  {option.label}
                </ChoiceChip>
              ))}
            </div>
          </QuizEditorField>
        </div>

        <div ref={register("chemical_treatment")} className="xl:col-span-2">
          <QuizEditorField
            title={CHEMICAL_TREATMENTS_TITLE}
            text="Was in deinen Längen noch vorhanden ist; Pflege, Bondbuilder und normales Hitzestyling zählen hier nicht."
          >
            <div className="flex flex-wrap gap-2">
              {HAAR_CHECK_CHEMICAL_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  active={draft.chemicalTreatments.includes(
                    option.value as HaarCheckDraft["chemicalTreatments"][number],
                  )}
                  onClick={() =>
                    onDraftChange((current) =>
                      toggleChemicalTreatment(
                        current,
                        option.value as HaarCheckDraft["chemicalTreatments"][number],
                      ),
                    )
                  }
                >
                  {option.label}
                </ChoiceChip>
              ))}
            </div>
          </QuizEditorField>
        </div>

        <div ref={register("scalp_type")}>
          <QuizEditorField
            title="Kopfhauttyp"
            text="Wie sich deine Kopfhaut zwischen den Haarwäschen verhält."
          >
            <SegmentedControl
              options={HAAR_CHECK_SCALP_TYPE_OPTIONS}
              value={draft.scalpOiliness ?? ""}
              onChange={(value) =>
                onDraftChange((current) => ({
                  ...current,
                  scalpOiliness: value as HaarCheckDraft["scalpOiliness"],
                }))
              }
            />
          </QuizEditorField>
        </div>

        <div ref={register("scalp_condition")}>
          <QuizEditorField title="Kopfhaut-Beschwerden" text="Wähle alles aus, was du bemerkst.">
            <div className="flex flex-wrap gap-2">
              {HAAR_CHECK_SCALP_CONCERN_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  active={Boolean(
                    draft.scalpConcerns?.includes(
                      option.value as NonNullable<HaarCheckDraft["scalpConcerns"]>[number],
                    ),
                  )}
                  onClick={() =>
                    onDraftChange((current) =>
                      toggleScalpConcern(
                        current,
                        option.value as NonNullable<HaarCheckDraft["scalpConcerns"]>[number],
                      ),
                    )
                  }
                >
                  {option.label}
                </ChoiceChip>
              ))}
              <ChoiceChip
                active={draft.scalpConcerns?.length === 0}
                onClick={() => onDraftChange((current) => selectNoScalpConcern(current))}
              >
                Nichts davon
              </ChoiceChip>
            </div>
          </QuizEditorField>
        </div>

        <div ref={register("concerns")} className="xl:col-span-2">
          <QuizEditorField
            title={CURRENT_PROBLEMS_TITLE}
            text="Wähle alles aus, was du aktuell bemerkst."
          >
            <div className="flex flex-wrap gap-2">
              {problemOptions.map((option) => (
                <ChoiceChip
                  key={option.value}
                  active={draft.currentConcerns.includes(
                    option.value as HaarCheckDraft["currentConcerns"][number],
                  )}
                  onClick={() =>
                    onDraftChange((current) =>
                      toggleProblem(
                        current,
                        option.value as HaarCheckDraft["currentConcerns"][number],
                      ),
                    )
                  }
                >
                  {option.label}
                </ChoiceChip>
              ))}
              <ChoiceChip
                active={draft.noteOpen}
                onClick={() => onDraftChange((current) => toggleProblemNote(current))}
              >
                Etwas anderes
              </ChoiceChip>
            </div>

            {draft.noteOpen ? (
              <div className="mt-3 rounded-xl border border-border/80 bg-background/70 p-3">
                <label
                  htmlFor="haar-check-problem-note"
                  className="block text-sm font-medium text-foreground"
                >
                  Eigene Notiz
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Wenn dein Thema nicht in der Liste steht, beschreib es kurz selbst.
                </p>
                <Textarea
                  id="haar-check-problem-note"
                  value={draft.note}
                  onChange={(event) => {
                    const value = event.target.value
                    onDraftChange((current) => setProblemNote(current, value))
                  }}
                  maxLength={PROBLEM_NOTE_MAX_LENGTH}
                  rows={2}
                  placeholder="Zum Beispiel: stumpf nach dem Föhnen"
                  className="mt-2 resize-none text-base"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {draft.note.length}/{PROBLEM_NOTE_MAX_LENGTH}
                </p>
              </div>
            ) : null}

            {showsMainProblemQuestion(draft) ? (
              <div ref={register("main_problem")} className="mt-4 border-t border-border/70 pt-4">
                <p className="text-sm font-semibold text-[var(--text-heading)]">
                  {MAIN_PROBLEM_SHEET_TITLE}
                </p>
                <div
                  role="radiogroup"
                  aria-label={MAIN_PROBLEM_SHEET_TITLE}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {problemOptions
                    .filter((option) =>
                      draft.currentConcerns.includes(
                        option.value as HaarCheckDraft["currentConcerns"][number],
                      ),
                    )
                    .map((option) => (
                      <ChoiceChip
                        key={option.value}
                        radio
                        active={draft.primaryConcern === option.value}
                        onClick={() =>
                          onDraftChange((current) =>
                            pickMainProblem(
                              current,
                              option.value as HaarCheckDraft["currentConcerns"][number],
                            ),
                          )
                        }
                      >
                        {option.label}
                      </ChoiceChip>
                    ))}
                </div>
              </div>
            ) : null}
          </QuizEditorField>
        </div>
      </div>

      {showPlanRecomputeNotice ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Beim Speichern berechnen wir deinen Plan mit den neuen Angaben neu.
        </p>
      ) : null}
      <div className={cn(showPlanRecomputeNotice ? "mt-3" : "mt-6", "flex flex-wrap gap-2")}>
        <Button
          type="button"
          className="w-auto"
          onClick={onSave}
          disabled={saving || saveBlock !== null}
          aria-describedby={saveBlock ? SAVE_HINT_ID : undefined}
        >
          {saving ? "Speichern..." : "Haar-Check speichern"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-auto"
          onClick={onCancel}
          disabled={saving}
        >
          Abbrechen
        </Button>
      </div>
      {saveBlock ? (
        <p id={SAVE_HINT_ID} className="mt-2 text-sm text-muted-foreground">
          {HAAR_CHECK_BLOCK_HINTS[saveBlock]}{" "}
          <button
            type="button"
            onClick={() => showBlockingField(saveBlock)}
            className="font-medium text-primary underline underline-offset-2"
          >
            Zur Frage
          </button>
        </p>
      ) : null}
    </div>
  )
}
