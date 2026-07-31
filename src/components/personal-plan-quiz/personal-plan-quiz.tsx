"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react"
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Brush,
  CalendarX,
  Camera,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  Coffee,
  Cylinder,
  Droplets,
  Equal,
  Feather,
  FlameKindling,
  Hand,
  Heart,
  HelpCircle,
  Layers,
  Leaf,
  ListOrdered,
  Loader2,
  LockKeyhole,
  MessagesSquare,
  MoveHorizontal,
  PackageSearch,
  PartyPopper,
  PenLine,
  Pipette,
  RefreshCw,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SplitSquareVertical,
  SunDim,
  Target,
  Users,
  Wallet,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { TreatmentPermedIcon, TreatmentStraightenedIcon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { createFunnelEventId, recordBrowserFunnelMilestone } from "@/lib/funnel/client"
import {
  PERSONAL_PLAN_LOADING_STAGES,
  PERSONAL_PLAN_QUIZ_SCREEN_IDS,
  appendPersonalPlanQuizHistory,
  clearPersonalPlanQuizDraft,
  derivePersonalPlanConflictPrompt,
  derivePersonalPlanProfileSummary,
  getPersonalPlanQuizAnswersKey,
  getNextPersonalPlanQuizScreen,
  getOptionIntensity,
  getPersonalPlanQuizSectionId,
  getPersonalPlanQuizTransitionDirection,
  loadPersonalPlanQuizDraft,
  savePersonalPlanQuizDraft,
  type OptionIntensity,
  type PersonalPlanQuizAnswers,
  type PersonalPlanQuizEphemeralState,
  type PersonalPlanQuizScreenId,
  type PersonalPlanQuizTransitionDirection,
} from "@/lib/personal-plan-quiz"
import {
  PORTRAIT_BODY_VIEW_BOX,
  PORTRAIT_SHARED_BODY_PATHS,
  resolveHairPortraitAsset,
} from "@/lib/quiz/hair-portrait-assets"
import type { PortraitConfig } from "@/lib/quiz/portrait-config"
import { cn } from "@/lib/utils"

import {
  DAILY_TIME_OPTIONS,
  EARLY_PROOF_TESTIMONIAL,
  PERSONAL_PLAN_ASSET_BASE,
  PREPARATION_TESTIMONIALS,
  QUESTION_CONFIGS,
  TEXTURE_COPY,
  TEXTURE_OPTIONS,
  getConcernOptions,
  getGoalOptions,
  getLengthOptions,
  getProfileSummaryImage,
  type QuizIconKey,
  type QuizOption,
  type QuizQuestionConfig,
} from "./quiz-data"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_PROVIDERS = ["gmail.com", "gmx.de", "web.de", "outlook.com", "icloud.com"]
const AUTO_ADVANCE_MS = 260
const PREPARED_PLAN_SESSION_KEY = "chaarlie:personal-plan-quiz-prepared:v1"
const SCREEN_EXIT_MS = 200

type PersonalPlanOutgoingLayer = {
  direction: PersonalPlanQuizTransitionDirection
  html: string
  id: number
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return reduced
}

function PersonalPlanScreenTransition({
  activeLayerRef,
  children,
  onOutgoingComplete,
  outgoing,
}: {
  activeLayerRef: RefObject<HTMLDivElement | null>
  children: ReactNode
  onOutgoingComplete: (id: number) => void
  outgoing: PersonalPlanOutgoingLayer | null
}) {
  useEffect(() => {
    if (!outgoing) return
    const timer = window.setTimeout(() => onOutgoingComplete(outgoing.id), SCREEN_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [onOutgoingComplete, outgoing])

  return (
    <div className="relative grid w-full" data-personal-plan-transition-root>
      <div
        ref={activeLayerRef}
        className={cn("col-start-1 row-start-1 w-full", outgoing && "personal-plan-screen-enter")}
        data-personal-plan-transition-direction={outgoing?.direction}
        data-personal-plan-transition-layer="active"
      >
        {children}
      </div>
      {outgoing ? (
        <div
          aria-hidden="true"
          className="personal-plan-screen-exit pointer-events-none absolute inset-x-0 top-0 w-full select-none"
          data-personal-plan-transition-direction={outgoing.direction}
          data-personal-plan-transition-layer="outgoing"
          dangerouslySetInnerHTML={{ __html: outgoing.html }}
          inert
        />
      ) : null}
    </div>
  )
}

type PreparedPlanClaim = {
  artifactId: string
  claimToken: string
  answersKey: string
  expiresAt: string
}

type PreparedPlanState =
  | { status: "idle" | "preparing"; claim: null; error: null }
  | { status: "ready"; claim: PreparedPlanClaim; error: null }
  | { status: "error"; claim: null; error: string }

const SECTION_LABELS: Array<{
  id: ReturnType<typeof getPersonalPlanQuizSectionId>
  label: string
}> = [
  { id: "hair_profile", label: "Profil" },
  { id: "goals_and_context", label: "Ziele" },
  { id: "analysis", label: "Analyse" },
  { id: "plan_direction", label: "Plan" },
  { id: "completion", label: "Ergebnis" },
]

const ICONS: Record<QuizIconKey, LucideIcon> = {
  comb: Brush,
  droplet: Droplets,
  layers: Layers,
  leaf: Leaf,
  shield: ShieldCheck,
  sparkles: Sparkles,
  waves: Waves,
  wind: Wind,
  feather: Feather,
  equal: Equal,
  cylinder: Cylinder,
  refresh: RefreshCw,
  move: MoveHorizontal,
  zap: Zap,
  activity: Activity,
  hand: Hand,
  pipette: Pipette,
  flame: FlameKindling,
  scale: Scale,
  "sun-dim": SunDim,
  permed: TreatmentPermedIcon,
  straightened: TreatmentStraightenedIcon,
  "circle-check": CircleCheck,
  heart: Heart,
  sliders: SlidersHorizontal,
  target: Target,
  coffee: Coffee,
  briefcase: Briefcase,
  users: Users,
  party: PartyPopper,
  camera: Camera,
  messages: MessagesSquare,
  "package-search": PackageSearch,
  "list-ordered": ListOrdered,
  split: SplitSquareVertical,
  clock: Clock,
  wallet: Wallet,
  "calendar-x": CalendarX,
  pen: PenLine,
}

const ADMISSION_OPTIONS = [
  { value: "often", label: "Oft" },
  { value: "sometimes", label: "Manchmal" },
  { value: "rather_not", label: "Eher nicht" },
] as const

const EMOTIONAL_OPTIONS = [
  { value: "very", label: "Sehr wichtig" },
  { value: "somewhat", label: "Etwas wichtig" },
  { value: "less", label: "Weniger wichtig" },
] as const

const PRACTICAL_COST_OPTIONS = [
  { value: "often", label: "Ja, schon öfter" },
  { value: "sometimes", label: "Ein paar Mal" },
  { value: "rather_not", label: "Eher nicht" },
] as const

const LOADING_COMMITMENTS = [
  {
    value: "understand",
    question: "Willst du zuerst verstehen, was dein Haar wirklich braucht?",
    button: "Ja, das will ich.",
  },
  {
    value: "personalize",
    question: "Sollen wir deine Ziele mit Kopfhaut, Längen und Alltag abstimmen?",
    button: "Ja, bitte abstimmen.",
  },
  {
    value: "implement",
    question: "Willst du einen Plan, den du im Alltag wirklich umsetzen kannst?",
    button: "Ja, zeig mir den Plan.",
  },
] as const

function getBrowserDraftStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getBrowserSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function getAnswersKey(answers: PersonalPlanQuizAnswers): string {
  return getPersonalPlanQuizAnswersKey(answers)
}

function loadPreparedPlanClaim(
  storage: Storage,
  answers: PersonalPlanQuizAnswers,
): PreparedPlanClaim | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(PREPARED_PLAN_SESSION_KEY) ?? "null")
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const claim = value as Record<string, unknown>
    if (
      typeof claim.artifactId !== "string" ||
      typeof claim.claimToken !== "string" ||
      typeof claim.answersKey !== "string" ||
      typeof claim.expiresAt !== "string" ||
      claim.answersKey !== getAnswersKey(answers) ||
      !Number.isFinite(Date.parse(claim.expiresAt)) ||
      Date.parse(claim.expiresAt) <= Date.now()
    ) {
      return null
    }
    return {
      artifactId: claim.artifactId,
      claimToken: claim.claimToken,
      answersKey: claim.answersKey,
      expiresAt: claim.expiresAt,
    }
  } catch {
    return null
  }
}

function savePreparedPlanClaim(storage: Storage, claim: PreparedPlanClaim): void {
  try {
    storage.setItem(PREPARED_PLAN_SESSION_KEY, JSON.stringify(claim))
  } catch {
    // The active React state remains sufficient for the current tab.
  }
}

function clearPreparedPlanClaim(storage: Storage): void {
  try {
    storage.removeItem(PREPARED_PLAN_SESSION_KEY)
  } catch {
    // Restricted storage must not block the quiz.
  }
}

function ScreenHeader({
  canGoBack,
  onBack,
  progress,
  screen,
  settledSectionIndices,
}: {
  canGoBack: boolean
  onBack: () => void
  progress: number
  screen: PersonalPlanQuizScreenId
  settledSectionIndices: ReadonlySet<number>
}) {
  const currentSection = getPersonalPlanQuizSectionId(screen)
  const currentSectionIndex = SECTION_LABELS.findIndex((section) => section.id === currentSection)
  const currentSectionLabel =
    SECTION_LABELS.find((section) => section.id === currentSection)?.label ?? "Profil"

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--brand-plum-light)] bg-[hsl(var(--background))]/95 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto grid max-w-[44rem] grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center">
        <button
          aria-label="Zurück"
          aria-hidden={!canGoBack}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--brand-plum-darkest)] shadow-sm ring-1 ring-black/5 transition hover:bg-[var(--brand-plum-ice)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] sm:h-11 sm:w-11",
            !canGoBack && "pointer-events-none opacity-0",
          )}
          disabled={!canGoBack}
          onClick={onBack}
          tabIndex={canGoBack ? 0 : -1}
          type="button"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="justify-self-center font-header text-xl font-medium text-[var(--brand-plum-darkest)]">
          chaarlie
        </span>
        <span className="w-full whitespace-nowrap text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-plum)]">
          {currentSectionLabel}
        </span>
      </div>
      <div className="mx-auto mt-2 max-w-[44rem]" aria-label="Fortschritt">
        <div className="relative h-2" data-layout="progress-track-with-dots">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--brand-plum-light)]">
            <div
              className="h-full rounded-full bg-[var(--brand-plum)] transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid grid-cols-5 gap-1"
            data-layout="progress-dot-overlay"
          >
            {SECTION_LABELS.map((section, index) => {
              const state =
                index < currentSectionIndex
                  ? "done"
                  : index === currentSectionIndex
                    ? "current"
                    : "todo"
              return (
                <span className="flex items-center justify-center" key={section.id}>
                  <span
                    data-personal-plan-section-settled={
                      settledSectionIndices.has(index) ? "true" : undefined
                    }
                    className={cn(
                      "h-2 w-2 rounded-full ring-2 ring-[hsl(var(--background))] transition-[background-color,box-shadow] duration-300 ease-out",
                      settledSectionIndices.has(index) && "personal-plan-section-settle",
                      state === "done" && "bg-[var(--brand-plum)]",
                      state === "current" &&
                        "bg-[var(--brand-plum)] shadow-[0_0_0_3px_rgba(var(--brand-plum-rgb),0.14)]",
                      state === "todo" && "bg-[var(--brand-plum-light)]",
                    )}
                  />
                </span>
              )
            })}
          </div>
        </div>
        <ol className="mt-1 grid grid-cols-5 gap-1">
          {SECTION_LABELS.map((section, index) => {
            const state =
              index < currentSectionIndex
                ? "done"
                : index === currentSectionIndex
                  ? "current"
                  : "todo"
            return (
              <li className="flex items-center justify-center" key={section.id}>
                <span
                  className={cn(
                    "text-[8px] font-semibold uppercase tracking-[0.04em] sm:text-[9px]",
                    state === "todo"
                      ? "text-[var(--text-caption)]"
                      : "text-[var(--brand-plum-darkest)]",
                  )}
                >
                  {section.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </header>
  )
}

/**
 * Builds a portrait config from personal-plan answers so the shared hair-portrait
 * asset resolver (and its neck/shoulder body outline) can be reused directly —
 * no path data is copied. Treatment is not modelled here, so the treated pattern
 * mirrors the natural texture (matching the quiz's texture+length illustrations).
 */
function personalPlanPortraitConfig(
  texture: PersonalPlanQuizAnswers["texture"],
  length: PersonalPlanQuizAnswers["hairLength"],
): PortraitConfig {
  if (!texture || !length) return { kind: "generic" }
  return {
    kind: "personalized",
    length,
    naturalRootPattern: texture,
    treatedLengthPattern: texture,
    density: "medium",
    treatmentState: "none",
  }
}

/**
 * Renders the canonical hair asset with the shared neck/shoulder outline behind it,
 * except for very-short portraits that already include their own body.
 */
function HairPortraitFigure({
  texture,
  length,
  className,
  padded,
}: {
  texture: PersonalPlanQuizAnswers["texture"]
  length: PersonalPlanQuizAnswers["hairLength"]
  className?: string
  padded?: boolean
}) {
  const asset = resolveHairPortraitAsset(personalPlanPortraitConfig(texture, length))

  return (
    <div className={cn("relative aspect-square w-full", padded && "p-2", className)}>
      {!asset.ownBody ? (
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          viewBox={PORTRAIT_BODY_VIEW_BOX}
        >
          {PORTRAIT_SHARED_BODY_PATHS.map((path) => (
            <path
              className="fill-none stroke-[#8f84a8] stroke-[7] [stroke-linecap:round] [stroke-linejoin:round]"
              d={path}
              key={path}
            />
          ))}
        </svg>
      ) : null}
      <Image
        alt=""
        className="relative block h-full w-full object-contain"
        height={720}
        src={asset.src}
        unoptimized
        width={720}
      />
    </div>
  )
}

/** Leading intensity indicator for icon-less scale/frequency answer rows. */
function IntensityPips({ intensity }: { intensity: OptionIntensity }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center gap-[2px] rounded-xl bg-[var(--brand-plum-ice)]"
    >
      {intensity.unknown ? (
        <HelpCircle className="h-5 w-5 text-[var(--brand-plum)]" />
      ) : (
        Array.from({ length: intensity.max }).map((_, index) => (
          <span
            className={cn(
              "h-[5px] w-[5px] rounded-full",
              index < intensity.pips ? "bg-[var(--brand-plum)]" : "bg-[var(--brand-plum)]/25",
            )}
            key={index}
          />
        ))
      )}
    </span>
  )
}

function OptionCard({
  option,
  selected,
  visualLayout,
  multi,
  priority,
  intensity,
  onClick,
}: {
  option: QuizOption
  selected: boolean
  visualLayout?: QuizQuestionConfig["visualLayout"]
  multi?: boolean
  priority?: boolean
  intensity?: OptionIntensity | null
  onClick: () => void
}) {
  const Icon = option.icon ? ICONS[option.icon] : null
  const showPips = !Icon && intensity != null
  const hasMedia = Boolean(option.image ?? option.portrait)

  // Thumbnail layout: a slim horizontal row with a square image on the left, so
  // three image cards + header fit one small viewport (used by the thickness step).
  if (visualLayout === "thumbnail" && option.image) {
    return (
      <button
        aria-pressed={selected}
        className={cn(
          "personal-plan-option-card group relative flex w-full items-stretch overflow-hidden rounded-2xl border bg-white text-left shadow-[0_12px_34px_-28px_rgba(var(--brand-plum-rgb),0.6)] transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]",
          selected
            ? "border-[var(--brand-plum)] ring-2 ring-[rgba(var(--brand-plum-rgb),0.2)]"
            : "border-[var(--brand-plum-light)] hover:-translate-y-0.5 hover:border-[var(--brand-plum)]",
        )}
        onClick={onClick}
        type="button"
      >
        <span className="relative aspect-square w-[7.5rem] shrink-0 self-stretch overflow-hidden bg-[var(--brand-plum-ice)]">
          <Image
            alt={option.imageAlt ?? ""}
            className="object-cover object-center transition duration-300 group-hover:scale-[1.03]"
            fill
            fetchPriority={priority ? "high" : "auto"}
            priority={priority}
            sizes="120px"
            src={option.image}
          />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
              {option.label}
            </span>
            {option.description ? (
              <span className="mt-0.5 block text-sm leading-5 text-[var(--text-sub)]">
                {option.description}
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              "personal-plan-option-check flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
              selected
                ? "border-[var(--brand-plum)] bg-[var(--brand-plum)] text-white"
                : "border-[var(--brand-plum-light)] bg-white text-transparent",
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        </span>
      </button>
    )
  }

  // Graded tint follows pip strength: deepest tint = strongest reading = most pips.
  const rampRatio =
    showPips && intensity.max > 1 ? Math.max(0, intensity.pips - 1) / (intensity.max - 1) : 0
  const rampAlpha = !selected && showPips ? 0.05 + rampRatio * 0.12 : null

  return (
    <button
      aria-pressed={selected}
      className={cn(
        "personal-plan-option-card group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-[0_12px_34px_-28px_rgba(var(--brand-plum-rgb),0.6)] transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]",
        hasMedia ? "min-h-0" : "px-4 py-4",
        selected
          ? "border-[var(--brand-plum)] ring-2 ring-[rgba(var(--brand-plum-rgb),0.2)]"
          : "border-[var(--brand-plum-light)] hover:-translate-y-0.5 hover:border-[var(--brand-plum)]",
      )}
      onClick={onClick}
      style={
        rampAlpha ? { backgroundColor: `rgba(var(--brand-plum-rgb), ${rampAlpha})` } : undefined
      }
      type="button"
    >
      {option.portrait ? (
        <div
          className={cn(
            "w-full shrink-0 bg-[var(--brand-plum-ice)]",
            visualLayout === "grid" && "h-36 sm:h-auto [@media(max-height:700px)]:h-28",
          )}
        >
          <HairPortraitFigure
            className={visualLayout === "grid" ? "h-full" : undefined}
            length={option.portrait.length}
            padded
            texture={option.portrait.texture}
          />
        </div>
      ) : option.image ? (
        <div
          className={cn(
            "relative w-full shrink-0 overflow-hidden bg-[var(--brand-plum-ice)]",
            visualLayout === "stacked"
              ? "h-28"
              : visualLayout === "grid"
                ? "h-36 sm:aspect-[4/3] sm:h-auto [@media(max-height:700px)]:h-28"
                : "aspect-square",
          )}
        >
          <Image
            alt={option.imageAlt ?? ""}
            className={cn(
              "transition duration-300 group-hover:scale-[1.02]",
              visualLayout === "stacked"
                ? "object-contain"
                : visualLayout === "grid"
                  ? "object-cover object-[center_38%]"
                  : "object-cover object-top",
            )}
            fill
            fetchPriority={priority ? "high" : "auto"}
            priority={priority}
            sizes={
              visualLayout === "grid"
                ? "(max-width: 640px) 45vw, 320px"
                : "(max-width: 640px) 90vw, 320px"
            }
            src={option.image}
          />
        </div>
      ) : null}
      <div
        className={cn(
          "flex w-full flex-1 gap-3",
          hasMedia ? "items-start p-4" : "items-center",
          visualLayout === "stacked" && "px-4 py-3",
          visualLayout === "grid" &&
            "h-11 flex-none items-end px-3 pb-2 pt-1 sm:h-auto sm:min-h-24 sm:items-start sm:p-4 [@media(max-height:700px)]:h-10 [@media(max-height:700px)]:min-h-0 [@media(max-height:700px)]:items-end [@media(max-height:700px)]:px-2.5 [@media(max-height:700px)]:pb-1.5 [@media(max-height:700px)]:pt-1",
        )}
      >
        {Icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
            <Icon className="h-5 w-5" />
          </span>
        ) : showPips ? (
          <IntensityPips intensity={intensity} />
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1",
            hasMedia && option.description && visualLayout !== "grid" && "min-h-[2.75rem]",
          )}
        >
          <span className="block text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
            {option.label}
          </span>
          {option.description ? (
            <span
              className={cn(
                "mt-1 text-sm leading-5 text-[var(--text-sub)]",
                visualLayout === "grid" ? "hidden sm:block" : "block",
              )}
            >
              {option.description}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "personal-plan-option-check mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border",
            multi ? "rounded-[6px]" : "rounded-full",
            selected
              ? "border-[var(--brand-plum)] bg-[var(--brand-plum)] text-white"
              : "border-[var(--brand-plum-light)] bg-white text-transparent",
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  )
}

function MobileBottomAction({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--brand-plum-light)] bg-[hsl(var(--background))]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_-24px_rgba(var(--brand-plum-rgb),0.45)] backdrop-blur [@media(min-width:640px)_and_(min-height:701px)]:static [@media(min-width:640px)_and_(min-height:701px)]:mt-7 [@media(min-width:640px)_and_(min-height:701px)]:border-0 [@media(min-width:640px)_and_(min-height:701px)]:bg-transparent [@media(min-width:640px)_and_(min-height:701px)]:p-0 [@media(min-width:640px)_and_(min-height:701px)]:shadow-none [@media(min-width:640px)_and_(min-height:701px)]:backdrop-blur-none",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[40rem]">{children}</div>
    </div>
  )
}

function QuestionScreen({
  config,
  selected,
  onSelect,
  onContinue,
  onEmpty,
  noneOption,
  canContinue,
  intro,
  transition,
  otherTextTriggerValue,
  otherTextValue,
  onOtherTextChange,
  otherTextPlaceholder,
}: {
  config: QuizQuestionConfig
  selected: readonly string[]
  onSelect: (value: string) => void
  onContinue: () => void
  onEmpty?: () => void
  /** Card-styled, mutually-exclusive "Nichts davon" shown above the Weiter CTA. */
  noneOption?: { label: string; description?: string }
  canContinue: boolean
  intro?: { title: string; body: string }
  transition?: string
  otherTextTriggerValue?: string
  otherTextValue?: string
  onOtherTextChange?: (value: string) => void
  otherTextPlaceholder?: string
}) {
  return (
    <section className="mx-auto w-full max-w-[40rem]">
      {intro ? (
        <div className="mb-8 text-center">
          <h1 className="text-balance font-header text-[1.625rem] font-medium leading-[1.12] text-[var(--brand-plum-darkest)] sm:text-[2.8rem] [@media(max-height:700px)]:text-[1.625rem]">
            {intro.title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[var(--text-sub)]">
            {intro.body}
          </p>
        </div>
      ) : null}
      {config.eyebrow ? (
        <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
          {config.eyebrow}
        </p>
      ) : null}
      {intro ? (
        <h2 className="text-balance text-center font-header text-[1.625rem] font-medium leading-[1.12] text-[var(--brand-plum-darkest)] sm:text-[2.1rem] [@media(max-height:700px)]:text-[1.625rem]">
          {config.title}
        </h2>
      ) : (
        <h1
          className={cn(
            "text-balance text-center font-header text-[1.625rem] font-medium leading-[1.12] text-[var(--brand-plum-darkest)] sm:text-[2.4rem] [@media(max-height:700px)]:text-[1.625rem]",
            config.eyebrow && "mt-2",
          )}
        >
          {config.title}
        </h1>
      )}
      {config.helper ? (
        <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-6 text-[var(--text-sub)]">
          {config.helper}
        </p>
      ) : null}
      {config.contextImage ? (
        <div className="relative mx-auto mt-5 h-36 w-full overflow-hidden rounded-[1.5rem] bg-[var(--brand-plum-ice)] shadow-[0_24px_70px_-45px_rgba(70,41,59,0.65)] sm:mt-6 sm:h-44 [@media(max-height:700px)]:h-28">
          <Image
            alt={config.contextImageAlt ?? ""}
            className="object-cover"
            fill
            priority
            sizes="(max-width: 640px) 92vw, 640px"
            src={config.contextImage}
            style={
              config.contextObjectPosition
                ? { objectPosition: config.contextObjectPosition }
                : undefined
            }
          />
        </div>
      ) : null}
      <div
        className={cn(
          "mt-5 grid gap-3 sm:mt-7",
          config.visualLayout === "grid" && "grid-cols-2 auto-rows-fr",
          config.visual && !config.visualLayout && "grid-cols-1 auto-rows-fr sm:grid-cols-2",
        )}
      >
        {config.options.map((option, optionIndex) => {
          const showOtherInput =
            otherTextTriggerValue !== undefined &&
            option.value === otherTextTriggerValue &&
            selected.includes(option.value) &&
            onOtherTextChange !== undefined
          return (
            <div key={option.value} className={showOtherInput ? "grid gap-2" : undefined}>
              <OptionCard
                intensity={getOptionIntensity(config.field, option.value)}
                multi={config.multi}
                onClick={() => onSelect(option.value)}
                option={option}
                priority={config.field === "texture" && optionIndex === 0}
                selected={selected.includes(option.value)}
                visualLayout={config.visualLayout}
              />
              {showOtherInput ? (
                <Input
                  autoFocus
                  className="h-12 rounded-[14px] border-[var(--brand-plum-light)] bg-white px-4 text-[15px]"
                  maxLength={280}
                  onChange={(event) => onOtherTextChange?.(event.target.value)}
                  placeholder={otherTextPlaceholder ?? "Magst du kurz sagen, was?"}
                  value={otherTextValue ?? ""}
                />
              ) : null}
            </div>
          )
        })}
        {noneOption && onEmpty ? (
          // Mutually exclusive shortcut: choosing it clears any concerns and
          // advances, so it never shows a lingering pre-selected state on entry.
          <OptionCard
            multi
            onClick={onEmpty}
            option={{
              value: "__none__",
              label: noneOption.label,
              description: noneOption.description,
            }}
            selected={false}
          />
        ) : null}
      </div>
      {transition && canContinue ? (
        <p className="mt-5 rounded-2xl bg-[var(--brand-plum-ice)] px-4 py-3 text-sm leading-6 text-[var(--brand-plum-dark)]">
          {transition}
        </p>
      ) : null}
      {config.multi ? (
        <MobileBottomAction>
          <Button
            className="h-12 w-full text-base"
            variant="cta"
            disabled={!canContinue}
            onClick={onContinue}
          >
            <span className="personal-plan-multi-count" key={selected.length}>
              {selected.length > 0 ? `${selected.length} ausgewählt · Weiter` : "Weiter"}
            </span>
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </MobileBottomAction>
      ) : null}
    </section>
  )
}

/**
 * Shared layout for screens that pair a headline + options/CTA with a contextual
 * photo. Mobile stacking order is always headline → banner → options; on ≥sm the
 * photo moves into a full-height side panel.
 */
function ContextPanelLayout({
  className,
  eyebrow,
  title,
  subtitle,
  image,
  imageAlt,
  imagePosition,
  imageVariant = "banner",
  children,
}: {
  className?: string
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  image: string
  imageAlt?: string
  /** Per-image object-position so the banner crop keeps the subject in frame. */
  imagePosition?: string
  /** Square portraits keep their native framing instead of adding banner side-fill. */
  imageVariant?: "banner" | "portrait"
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-[44rem] sm:grid sm:grid-cols-[1fr_17rem] sm:gap-6 [@media(max-height:700px)]:block",
        className,
      )}
    >
      <div className="text-center sm:col-start-1 sm:row-start-1 sm:text-left [@media(max-height:700px)]:text-center">
        {eyebrow ? (
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-balance font-header text-[1.625rem] font-medium leading-[1.12] text-[var(--brand-plum-darkest)] sm:mt-3 sm:text-[2.4rem] [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:text-[1.625rem]">
          {title}
        </h1>
        {subtitle}
      </div>
      <div
        className={cn(
          "relative mt-5 overflow-hidden rounded-[1.5rem] shadow-[0_24px_70px_-45px_rgba(70,41,59,0.65)] sm:col-start-2 sm:row-span-2 sm:mt-0 sm:h-full sm:min-h-full sm:self-stretch [@media(max-height:700px)]:mt-5 [@media(max-height:700px)]:min-h-0",
          imageVariant === "portrait"
            ? "mx-auto aspect-square h-auto w-full max-w-[17rem] bg-[var(--brand-plum-ice)] [@media(max-height:700px)]:max-w-[13rem]"
            : "h-36 bg-[var(--brand-plum-ice)] [@media(max-height:700px)]:h-28",
        )}
      >
        <Image
          alt={imageAlt ?? ""}
          className="object-cover"
          fill
          priority
          sizes="(max-width: 640px) 92vw, 272px"
          src={image}
          style={imagePosition ? { objectPosition: imagePosition } : undefined}
        />
      </div>
      <div className="mt-5 sm:col-start-1 sm:row-start-2 sm:mt-0 [@media(max-height:700px)]:mt-5">
        {children}
      </div>
    </section>
  )
}

function ProofScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <section className="mx-auto w-full max-w-[40rem] text-center">
      <h1 className="text-balance font-header text-[1.625rem] font-medium leading-[1.12] text-[var(--brand-plum-darkest)] sm:text-[2.4rem] [@media(max-height:700px)]:text-[1.625rem]">
        Deine Antworten werden zu einem echten Haarprofil.
      </h1>

      <div className="relative mx-auto mt-5 h-36 w-full overflow-hidden rounded-[1.5rem] bg-[var(--brand-plum-ice)] shadow-[0_24px_70px_-45px_rgba(70,41,59,0.65)] sm:mt-6 sm:h-56 [@media(max-height:700px)]:h-28">
        <Image
          alt="Drei lachende Frauen"
          className="object-cover"
          fill
          priority
          sizes="(max-width: 640px) 92vw, 640px"
          src={`${PERSONAL_PLAN_ASSET_BASE}/proof-community.webp`}
          style={{ objectPosition: "50% 32%" }}
        />
      </div>

      <div className="mt-5 flex flex-col items-center sm:mt-8">
        <span className="font-header text-[2.75rem] font-medium leading-none text-[var(--brand-plum)] sm:text-[4.25rem]">
          4.000+
        </span>
        <p className="mx-auto mt-3 max-w-md text-base leading-7 text-[var(--text-sub)]">
          Antworten aus unserer Haarpflege-Umfrage fließen in die Analyse ein.
        </p>
      </div>

      <blockquote className="mx-auto mt-5 max-w-md rounded-[1.5rem] border border-[var(--brand-plum-light)] bg-white p-4 text-center shadow-[0_24px_60px_-40px_rgba(70,41,59,0.55)] sm:mt-8 sm:rounded-[2rem] sm:p-6">
        <p className="text-base italic leading-7 text-[var(--brand-plum-darkest)] sm:text-lg sm:leading-8">
          {`„${EARLY_PROOF_TESTIMONIAL.quote}“`}
        </p>
        <footer className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-plum)]">
          {EARLY_PROOF_TESTIMONIAL.source}
        </footer>
      </blockquote>

      <MobileBottomAction>
        <Button className="h-12 w-full text-base" variant="cta" onClick={onContinue}>
          Weiter
        </Button>
      </MobileBottomAction>
    </section>
  )
}

function AnalysisBridgeScreen({
  answers,
  onContinue,
}: {
  answers: PersonalPlanQuizAnswers
  onContinue: () => void
}) {
  const texture = TEXTURE_COPY[answers.texture ?? "wavy"]

  return (
    <ContextPanelLayout
      className="personal-plan-analysis-settle"
      eyebrow="Du bist hier genau richtig."
      image={`${PERSONAL_PLAN_ASSET_BASE}/texture-${answers.texture ?? "wavy"}.webp`}
      imageVariant="portrait"
      subtitle={
        <p className="mt-3 text-[15px] leading-6 text-[var(--text-sub)]">
          Die nächsten einfachen Beobachtungen zeigen, welche Pflege {texture.possessive} wirklich
          braucht – ohne Rätselraten und ohne dass du alles perfekt wissen musst.
        </p>
      }
      title="Jetzt machen wir dein Profil genauer."
    >
      <MobileBottomAction>
        <Button className="h-12 w-full text-base" onClick={onContinue} variant="cta">
          Haaranalyse fortsetzen
        </Button>
      </MobileBottomAction>
    </ContextPanelLayout>
  )
}

const MIDPOINT_TEXTURE_LABELS = {
  straight: "Glatt",
  wavy: "Wellig",
  curly: "Lockig",
  coily: "Kraus",
}
const MIDPOINT_THICKNESS_LABELS = { fine: "Fein", normal: "Mittel", coarse: "Dick" }
const MIDPOINT_DENSITY_LABELS = {
  low: "Wenig Haare",
  medium: "Mittlere Dichte",
  high: "Viele Haare",
}
const MIDPOINT_REVEAL_MS = 350
const MIDPOINT_CHECK_DELAY_MS = 500
const MIDPOINT_HOLD_MS = 2400

function MidpointProfileScreen({
  answers,
  onContinue,
}: {
  answers: PersonalPlanQuizAnswers
  onContinue: () => void
}) {
  const rows = useMemo(() => {
    const items: Array<{ label: string; value: string }> = []
    if (answers.texture)
      items.push({ label: "Struktur", value: MIDPOINT_TEXTURE_LABELS[answers.texture] })
    if (answers.thickness)
      items.push({ label: "Dicke", value: MIDPOINT_THICKNESS_LABELS[answers.thickness] })
    if (answers.density)
      items.push({ label: "Dichte", value: MIDPOINT_DENSITY_LABELS[answers.density] })
    return items
  }, [answers.density, answers.texture, answers.thickness])

  const [revealed, setRevealed] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timers: number[] = []
    rows.forEach((_, index) => {
      timers.push(window.setTimeout(() => setRevealed(index + 1), MIDPOINT_REVEAL_MS * (index + 1)))
    })
    const readyAt = MIDPOINT_REVEAL_MS * rows.length + MIDPOINT_CHECK_DELAY_MS
    timers.push(window.setTimeout(() => setReady(true), readyAt))
    timers.push(window.setTimeout(onContinue, readyAt + MIDPOINT_HOLD_MS))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [onContinue, rows])

  return (
    <section
      className="mx-auto flex w-full max-w-[30rem] flex-col items-center text-center"
      data-layout="midpoint-fit"
    >
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
        Deine Analyse
      </p>
      <h1 className="mt-1.5 text-balance font-header text-[1.75rem] font-medium leading-[1.12] text-[var(--brand-plum-darkest)] sm:text-[2.25rem] [@media(max-height:700px)]:text-[1.625rem]">
        Dein Profil nimmt Form an.
      </h1>
      <p className="mt-2 max-w-sm text-[15px] leading-6 text-[var(--text-sub)] [@media(max-height:700px)]:text-sm [@media(max-height:700px)]:leading-5">
        Wir verbinden deine Angaben Schritt für Schritt zu einem klareren Bild.
      </p>

      {/* Standard quiz card language (rounded-[2rem] plum-ice) so the portrait
          feels composed within the same visual system as every other screen. */}
      <div className="mt-4 w-full max-w-[12rem] rounded-[1.5rem] border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] p-3 shadow-[0_24px_70px_-45px_rgba(70,41,59,0.65)] [@media(max-height:700px)]:max-w-[9rem] [@media(max-height:700px)]:p-2">
        <div className="relative mx-auto w-full">
          <HairPortraitFigure length={answers.hairLength} texture={answers.texture} />
          <span
            className={cn(
              "absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#47744e] text-white shadow-lg transition-all duration-500",
              ready ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          >
            <Check className="h-4 w-4" />
          </span>
        </div>
      </div>

      <dl className="mt-4 w-full max-w-sm space-y-2 [@media(max-height:700px)]:mt-3">
        {rows.map((row, index) => (
          <div
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border border-[var(--brand-plum-light)] bg-white px-4 py-2.5 text-left shadow-[0_18px_44px_-38px_rgba(70,41,59,0.6)] transition-all duration-500 ease-out [@media(max-height:700px)]:py-2",
              revealed > index ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
            key={row.label}
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-caption)]">
              {row.label}
            </dt>
            <dd className="text-base font-semibold text-[var(--brand-plum-darkest)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Per-admission-screen banner photo. Every consecutive pair of admission beats
// (recurrence → optional conflict → practical-cost → emotional-relevance) uses a
// different file, so no image repeats across adjacent screens on any path.
const ADMISSION_DEFAULT_IMAGE = { file: "examining-ends.webp", position: "50% 35%" }
const ADMISSION_IMAGES: Partial<
  Record<PersonalPlanQuizScreenId, { file: string; position: string }>
> = {
  admission_recurrence: ADMISSION_DEFAULT_IMAGE,
  admission_conflict: { file: "returning-concern.webp", position: "50% 26%" },
  admission_practical_cost: { file: "invested-products.webp", position: "50% 30%" },
  admission_emotional_relevance: { file: "feelgood-hair.webp", position: "50% 34%" },
}

function AdmissionScreen({
  screen,
  answers,
  ephemeral,
  onSelect,
}: {
  screen: PersonalPlanQuizScreenId
  answers: PersonalPlanQuizAnswers
  ephemeral: PersonalPlanQuizEphemeralState
  onSelect: (value: string) => void
}) {
  const conflictPrompt = derivePersonalPlanConflictPrompt(answers)
  const firstConcernLabel = getConcernOptions(answers.texture)
    .filter((option) => answers.currentConcerns?.includes(option.value as never))
    .map((option) => option.midSentenceLabel ?? option.label)[0]
  const content =
    screen === "admission_recurrence"
      ? {
          title: "Kommt das immer wieder?",
          subtitle: firstConcernLabel
            ? `${capitalizeFirst(firstConcernLabel)} beschäftigt dich wiederholt.`
            : "Deine aktuellen Haarthemen kehren wieder.",
          selected: ephemeral.admissionRecurrence,
          options: ADMISSION_OPTIONS,
        }
      : screen === "admission_conflict" && conflictPrompt
        ? {
            title: "Trifft dieses Pflege-Dilemma auf dich zu?",
            subtitle: conflictPrompt.question,
            selected: ephemeral.admissionConflict,
            options: conflictPrompt.options,
          }
        : screen === "admission_practical_cost"
          ? {
              title: "Hat dich Haarpflege schon Zeit oder Geld gekostet?",
              subtitle: undefined,
              selected: ephemeral.admissionPracticalCost,
              options: PRACTICAL_COST_OPTIONS,
            }
          : {
              title: "Wie wichtig ist dir dein Haargefühl?",
              subtitle: undefined,
              selected: ephemeral.admissionEmotionalRelevance,
              options: EMOTIONAL_OPTIONS,
            }

  // Each admission beat gets a distinct photo so no two consecutively shown
  // screens repeat an image, whether or not the conflict beat is skipped:
  // recurrence → (conflict) → practical-cost → emotional-relevance.
  const admissionImage = ADMISSION_IMAGES[screen] ?? ADMISSION_DEFAULT_IMAGE

  return (
    <ContextPanelLayout
      image={`${PERSONAL_PLAN_ASSET_BASE}/${admissionImage.file}`}
      imagePosition={admissionImage.position}
      subtitle={
        content.subtitle ? (
          <p className="mt-3 text-[15px] leading-6 text-[var(--text-sub)]">{content.subtitle}</p>
        ) : undefined
      }
      title={content.title}
    >
      <div className="grid gap-3">
        {content.options.map((option) => (
          <OptionCard
            intensity={getOptionIntensity("admission", option.value)}
            key={option.value}
            onClick={() => onSelect(option.value)}
            option={option}
            selected={content.selected === option.value}
          />
        ))}
      </div>
    </ContextPanelLayout>
  )
}

function ReframeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <section
      className="mx-auto flex w-full max-w-[44rem] flex-col gap-4 sm:grid sm:grid-cols-[1fr_17rem] sm:items-center sm:gap-x-6 sm:gap-y-5 [@media(max-height:700px)]:flex"
      data-layout="reframe-copy-image-closing"
    >
      <div className="order-2 relative mx-auto h-40 w-full overflow-hidden rounded-[1.5rem] bg-[var(--brand-plum-ice)] shadow-[0_24px_70px_-45px_rgba(70,41,59,0.65)] sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mx-0 sm:h-auto sm:min-h-[24rem] sm:max-w-none sm:rounded-[2rem] [@media(max-height:700px)]:h-32 [@media(max-height:700px)]:min-h-0">
        <Image
          alt=""
          className="object-cover"
          fill
          priority
          sizes="(max-width: 640px) 90vw, 272px"
          src={`${PERSONAL_PLAN_ASSET_BASE}/causal-reframe.webp`}
          style={{ objectPosition: "50% 8%" }}
        />
      </div>
      <div className="order-1 text-center sm:col-start-1 sm:row-start-1 sm:text-left [@media(max-height:700px)]:text-center">
        <h1 className="text-balance font-header text-[1.625rem] font-medium leading-[1.12] text-[var(--brand-plum-darkest)] sm:text-[2.8rem] [@media(max-height:700px)]:text-[1.625rem]">
          Dein Haar braucht nur{" "}
          <span className="text-[var(--brand-plum)]">den richtigen Plan.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-6 text-[var(--text-sub)] sm:mt-5 sm:text-base sm:leading-7">
          Passen Produkte, Reihenfolge und Anwendung nicht zusammen, wirkt Pflege schnell zufällig.
          Dein Plan verbindet diese Punkte.
        </p>
      </div>
      <p className="order-3 text-center text-base font-semibold text-[var(--brand-plum-darkest)] sm:col-start-1 sm:row-start-2 sm:text-left sm:text-lg [@media(max-height:700px)]:text-center">
        Mit dem richtigen Plan wird es einfach.
      </p>
      <MobileBottomAction className="order-4 sm:col-start-1">
        <Button className="h-12 w-full text-base" onClick={onContinue} variant="cta">
          Weiter
        </Button>
      </MobileBottomAction>
    </section>
  )
}

function ProfileSummaryScreen({
  answers,
  onContinue,
}: {
  answers: PersonalPlanQuizAnswers
  onContinue: () => void
}) {
  const rows = derivePersonalPlanProfileSummary(answers)
  const profileImage = getProfileSummaryImage(answers.texture, answers.hairLength)

  return (
    <section className="mx-auto w-full max-w-[40rem]">
      <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-plum)]">
        Viel Potenzial
      </p>
      <h1 className="mt-2 text-balance text-center font-header text-[1.625rem] font-medium leading-[1.12] text-[var(--brand-plum-darkest)] sm:mt-3 sm:text-[2.4rem] [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:text-[1.625rem]">
        Dein Haarprofil ist bereit für einen persönlichen Plan.
      </h1>

      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--brand-plum-light)] bg-white shadow-[0_28px_80px_-48px_rgba(70,41,59,0.7)] sm:mt-8 sm:rounded-[2rem]">
        {/* Header band: what this is + a confident, badge-led verdict. */}
        <div className="flex items-center justify-between gap-2.5 border-b border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-plum)] sm:text-[10px] sm:tracking-[0.14em]">
              Deine Ausgangslage
            </p>
            <p className="mt-0.5 font-header text-base font-medium leading-tight text-[var(--brand-plum-darkest)] sm:mt-1 sm:text-lg">
              Persönliches Haarprofil
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#dff1e2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#2f6b3c] ring-1 ring-[#b7d9bd] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs sm:tracking-[0.08em]">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Viel Potenzial
          </span>
        </div>

        {/* Body: the personalised photo leads into four compact profile metrics. */}
        <div
          className="grid gap-2 p-2.5 sm:gap-4 sm:p-5 [@media(max-height:700px)]:gap-1.5 [@media(max-height:700px)]:p-2"
          data-layout="profile-summary-2x2"
        >
          <div
            className="relative aspect-[2/1] w-full overflow-hidden rounded-[1rem] bg-[var(--brand-plum-ice)] sm:rounded-[1.25rem] [@media(max-height:700px)]:h-[5.5rem] [@media(max-height:700px)]:aspect-auto [@media(max-height:500px)]:h-14"
            data-layout="profile-summary-image"
          >
            <Image
              alt="Persönliche Darstellung deines Haarprofils"
              className="object-cover object-center"
              fill
              sizes="(max-width: 640px) calc(100vw - 3.5rem), 600px"
              src={profileImage}
            />
          </div>
          <dl className="grid grid-cols-2 gap-1.5 sm:gap-3">
            {rows.map((row, index) => (
              <div
                className="personal-plan-profile-row min-w-0 rounded-lg border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] px-2 py-2 sm:rounded-xl sm:px-3 sm:py-2.5 [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:py-1.5"
                key={row.label}
                style={{ "--personal-plan-row-index": index } as CSSProperties}
              >
                <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-caption)] sm:text-[10px] sm:tracking-[0.14em]">
                  {row.label}
                </dt>
                <dd className="mt-0.5 text-xs font-semibold leading-4 text-[var(--brand-plum-darkest)] sm:mt-1 sm:text-sm sm:leading-5">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] leading-4 text-[var(--text-caption)] sm:text-xs sm:leading-5">
        Der Plan unterstützt kosmetische Haarpflege. Starke, plötzliche oder anhaltende Beschwerden
        sollten medizinisch oder dermatologisch eingeordnet werden.
      </p>
      <MobileBottomAction>
        <Button className="h-12 w-full text-base" variant="cta" onClick={onContinue}>
          Meinen Plan vorbereiten
        </Button>
      </MobileBottomAction>
    </section>
  )
}

function DailyTimeScreen({
  selected,
  onSelect,
}: {
  selected?: PersonalPlanQuizEphemeralState["dailyTime"]
  onSelect: (value: NonNullable<PersonalPlanQuizEphemeralState["dailyTime"]>) => void
}) {
  return (
    <ContextPanelLayout
      eyebrow="Dein Alltag"
      image={`${PERSONAL_PLAN_ASSET_BASE}/daily-commitment.webp`}
      imagePosition="50% 20%"
      title="Wie viel Zeit möchtest du täglich einplanen?"
    >
      <div className="grid gap-3">
        {DAILY_TIME_OPTIONS.map((option) => (
          <OptionCard
            intensity={getOptionIntensity("dailyTime", option.value)}
            key={option.value}
            onClick={() =>
              onSelect(option.value as NonNullable<PersonalPlanQuizEphemeralState["dailyTime"]>)
            }
            option={option}
            selected={selected === option.value}
          />
        ))}
      </div>
    </ContextPanelLayout>
  )
}

const LOADING_RUN_MS = 3200

function CommitmentOverlay({
  stageIndex,
  onConfirm,
}: {
  stageIndex: number
  onConfirm: () => void
}) {
  const commitment = LOADING_COMMITMENTS[stageIndex]

  useEffect(() => {
    document.getElementById("ppq-commit-button")?.focus()
  }, [])

  return (
    // No backdrop dim, and the popover sits in the upper half so the progress
    // card and the current-stage testimonial stay visible beneath it. The page
    // behind is made non-interactive via `inert`, so only the card captures
    // pointer events.
    <div
      aria-labelledby="ppq-commit-title"
      aria-modal="true"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-5"
      role="dialog"
    >
      <div
        className="animate-scale-in pointer-events-auto w-full max-w-md rounded-[2rem] border border-[var(--brand-plum-light)] bg-white p-6 text-center shadow-[0_50px_130px_-24px_rgba(28,14,22,0.55)]"
        onKeyDown={(event) => {
          // Single-action modal: keep focus trapped on the confirm button.
          if (event.key === "Tab") event.preventDefault()
        }}
      >
        <p
          className="font-header text-xl font-medium leading-7 text-[var(--brand-plum-darkest)]"
          id="ppq-commit-title"
        >
          {commitment.question}
        </p>
        <Button
          className="mt-5 h-12 w-full text-base"
          id="ppq-commit-button"
          onClick={onConfirm}
          variant="cta"
        >
          {commitment.button}
        </Button>
      </div>
    </div>
  )
}

type LoadingPhase = "running" | "commit" | "done"

function LoadingScreen({
  ephemeral,
  onEphemeral,
  onContinue,
  onRetryPreparation,
  preparation,
}: {
  ephemeral: PersonalPlanQuizEphemeralState
  onEphemeral: (state: PersonalPlanQuizEphemeralState) => void
  onContinue: () => void
  onRetryPreparation: () => void
  preparation: PreparedPlanState
}) {
  const initialCommitments = Math.min(3, ephemeral.microcommitments?.length ?? 0)
  const [stageIndex, setStageIndex] = useState(Math.min(2, initialCommitments))
  const [phase, setPhase] = useState<LoadingPhase>(initialCommitments >= 3 ? "done" : "running")
  const [progress, setProgress] = useState(() =>
    initialCommitments >= 3
      ? 100
      : initialCommitments === 0
        ? 0
        : PERSONAL_PLAN_LOADING_STAGES[initialCommitments - 1].endProgress,
  )
  const completedCount = phase === "done" ? PERSONAL_PLAN_LOADING_STAGES.length : stageIndex
  const lastStageIndex = PERSONAL_PLAN_LOADING_STAGES.length - 1
  // Latest progress kept in a ref so the completion tween can read its start
  // point without re-subscribing every animation frame.
  const progressRef = useRef(progress)
  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  // Each running stage visibly counts up to its boundary, then pauses so the
  // commitment popover can slide in. The final stage stops just short of 100 so
  // confirming the third commitment is what completes the bar.
  useEffect(() => {
    if (phase !== "running") return
    const start = stageIndex === 0 ? 0 : PERSONAL_PLAN_LOADING_STAGES[stageIndex - 1].endProgress
    const target =
      stageIndex >= lastStageIndex ? 94 : PERSONAL_PLAN_LOADING_STAGES[stageIndex].endProgress
    const startTime = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / LOADING_RUN_MS)
      // Linear fill so the bar advances at a steady rate with no per-segment
      // deceleration or visible jump when a stage boundary is reached.
      setProgress(start + (target - start) * t)
      if (t < 1) {
        raf = window.requestAnimationFrame(tick)
      } else {
        setPhase("commit")
      }
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [lastStageIndex, phase, stageIndex])

  // Completion: smoothly finish the bar to 100% once the last commitment is in.
  useEffect(() => {
    if (phase !== "done") return
    const start = progressRef.current
    if (start >= 100) return
    const startTime = performance.now()
    const duration = 700
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      setProgress(start + (100 - start) * t)
      if (t < 1) raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [phase])

  useEffect(() => {
    trackAppEvent("personal_plan_quiz_screen_viewed", {
      quizVersion: "v2",
      screenId: `plan_loading_${PERSONAL_PLAN_LOADING_STAGES[Math.min(stageIndex, 2)].id}`,
      sectionId: getPersonalPlanQuizSectionId("plan_loading"),
    })
  }, [stageIndex])

  function confirmCommitment() {
    const nextCommitments = [...(ephemeral.microcommitments ?? [])]
    nextCommitments[stageIndex] = LOADING_COMMITMENTS[stageIndex].value
    onEphemeral({
      ...ephemeral,
      microcommitments: nextCommitments as PersonalPlanQuizEphemeralState["microcommitments"],
    })
    if (stageIndex < 2) {
      setStageIndex((current) => current + 1)
      setPhase("running")
    } else {
      setPhase("done")
    }
  }

  return (
    <>
      <section className="mx-auto w-full max-w-[40rem]" inert={phase === "commit" || undefined}>
        <h1 className="text-center font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
          Wir bereiten deinen persönlichen Haarpflegeplan vor.
        </h1>
        <div className="mt-7 rounded-[2rem] border border-[var(--brand-plum-light)] bg-white p-5 shadow-[0_24px_70px_-45px_rgba(70,41,59,0.65)]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--brand-plum)]">
              {phase === "done"
                ? "Deine Auswertung ist bereit"
                : PERSONAL_PLAN_LOADING_STAGES[stageIndex].label}
            </p>
            {/* Live percentage for the preparation bar only — the quiz's section
                progress stays number-free per the journey decision. */}
            <span className="font-mono text-xs font-bold tabular-nums text-[var(--brand-plum)]">
              {Math.round(progress)} %
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--brand-plum-light)]">
            {/* Solid fill: the previous plum→plum-light gradient faded into the
                track color, making the moving edge invisible. */}
            <div
              className="h-full rounded-full bg-[var(--brand-plum)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className="mt-6 space-y-3">
            {PERSONAL_PLAN_LOADING_STAGES.map((item, index) => (
              <li className="flex items-center gap-3" key={item.id}>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold",
                    index < completedCount
                      ? "border-[#77a47f] bg-[#e7f3e9] text-[#47744e]"
                      : index === completedCount
                        ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]"
                        : "border-[var(--brand-plum-light)] text-[var(--text-caption)]",
                  )}
                >
                  {index < completedCount ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    index <= completedCount
                      ? "font-semibold text-[var(--brand-plum-darkest)]"
                      : "text-[var(--text-caption)]",
                  )}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {phase === "done" ? (
          preparation.status === "ready" ? (
            <div className="mt-5 rounded-[2rem] border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] p-5 text-center">
              <CircleCheck className="mx-auto h-9 w-9 text-[var(--brand-plum)]" />
              <p className="mt-3 text-xl font-semibold text-[var(--brand-plum-darkest)]">
                Deine persönliche Auswertung ist bereit.
              </p>
              <Button className="mt-5 h-12 w-full text-base" onClick={onContinue} variant="cta">
                Weiter
              </Button>
            </div>
          ) : preparation.status === "error" ? (
            <div className="mt-5 rounded-[2rem] border border-[#e2b8b2] bg-[#fff5f3] p-5 text-center">
              <p className="text-lg font-semibold text-[var(--brand-plum-darkest)]">
                Dein Plan konnte gerade nicht fertig vorbereitet werden.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">
                Deine Antworten sind sicher gespeichert. Bitte versuche die Vorbereitung noch
                einmal.
              </p>
              <Button
                className="mt-5 h-12 w-full text-base"
                onClick={onRetryPreparation}
                variant="cta"
              >
                Vorbereitung erneut versuchen
              </Button>
            </div>
          ) : (
            <div
              aria-live="polite"
              className="mt-5 rounded-[2rem] border border-[var(--brand-plum-light)] bg-white p-5 text-center"
            >
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--brand-plum)]" />
              <p className="mt-3 text-lg font-semibold text-[var(--brand-plum-darkest)]">
                Dein Plan wird fertig vorbereitet.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">
                Wir gleichen deine Angaben noch einmal sicher miteinander ab.
              </p>
            </div>
          )
        ) : null}

        <blockquote className="mt-5 rounded-2xl border border-[var(--brand-plum-light)] bg-white/70 px-5 py-4 text-center">
          <p className="text-sm italic leading-6 text-[var(--text-sub)]">
            „{PREPARATION_TESTIMONIALS[Math.min(stageIndex, 2)].quote}“
          </p>
          <footer className="mt-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-plum)]">
            {PREPARATION_TESTIMONIALS[Math.min(stageIndex, 2)].source}
          </footer>
        </blockquote>
      </section>
      {phase === "commit" ? (
        <CommitmentOverlay onConfirm={confirmCommitment} stageIndex={stageIndex} />
      ) : null}
    </>
  )
}

function getEmailSuggestions(email: string) {
  const value = email.trim().toLowerCase()
  if (!value) return []
  const [localPart, typedDomain = ""] = value.split("@")
  if (!localPart) return []
  const matches = EMAIL_PROVIDERS.filter((provider) =>
    typedDomain ? provider.startsWith(typedDomain) : true,
  )
  return matches
    .map((provider) => `${localPart}@${provider}`)
    .filter((suggestion) => suggestion !== value)
    .slice(0, 4)
}

function EmailCapture({
  answers,
  onPreparedPlanRejected,
  onSaved,
  preparedPlan,
}: {
  answers: PersonalPlanQuizAnswers
  onPreparedPlanRejected: () => void
  onSaved: (leadId: string) => void
  preparedPlan: PreparedPlanClaim
}) {
  const [email, setEmail] = useState("")
  const [step, setStep] = useState<"email" | "consent">("email")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [pendingConsent, setPendingConsent] = useState<boolean | null>(null)
  const funnelEventIdRef = useRef<string | null>(null)
  const suggestions = getEmailSuggestions(email)

  function continueToConsent() {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.")
      return
    }
    setError("")
    setStep("consent")
    window.scrollTo(0, 0)
  }

  async function submit(marketingConsent: boolean) {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setStep("email")
      setError("Bitte gib eine gültige E-Mail-Adresse ein.")
      return
    }
    setSaving(true)
    setPendingConsent(marketingConsent)
    setError("")
    funnelEventIdRef.current = funnelEventIdRef.current ?? createFunnelEventId()
    try {
      const response = await fetch("/api/quiz/personal-plan-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          marketingConsent,
          funnelEventId: funnelEventIdRef.current,
          answers,
          preparedPlan: {
            artifactId: preparedPlan.artifactId,
            claimToken: preparedPlan.claimToken,
          },
        }),
      })
      if (!response.ok) {
        if (response.status === 409) {
          onPreparedPlanRejected()
          return
        }
        throw new Error(`Save failed with ${response.status}`)
      }
      const payload: unknown = await response.json()
      const leadId =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).leadId
          : null
      if (typeof leadId !== "string" || !leadId) {
        throw new Error("Save succeeded without a lead id")
      }
      trackAppEvent("quiz_lead_captured", {
        leadId,
        marketingConsent,
        funnelEventId: funnelEventIdRef.current,
      })
      onSaved(leadId)
    } catch {
      setError(
        "Deine Auswertung konnte gerade nicht gespeichert werden. Bitte versuche es noch einmal.",
      )
    } finally {
      setSaving(false)
      setPendingConsent(null)
    }
  }

  return (
    <section className="mx-auto w-full max-w-[40rem]">
      <div className="rounded-full bg-[var(--brand-plum-ice)] px-4 py-2 text-center text-sm font-semibold text-[var(--brand-plum)]">
        Deine persönliche Auswertung ist bereit.
      </div>
      {step === "email" ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            continueToConsent()
          }}
        >
          <h1 className="mt-6 text-balance text-center font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
            Wohin dürfen wir deine persönliche Auswertung senden?
          </h1>
          <p className="mt-3 text-center leading-7 text-[var(--text-sub)]">
            So kannst du dein Ergebnis jetzt ansehen und später wieder öffnen.
          </p>
          <div className="mt-8">
            <label
              className="text-sm font-semibold text-[var(--brand-plum-darkest)]"
              htmlFor="personal-plan-email"
            >
              E-Mail-Adresse
            </label>
            <Input
              aria-invalid={Boolean(error)}
              autoComplete="email"
              className={cn(
                "mt-2 h-13 border-[var(--brand-plum-light)] bg-white px-4 text-base",
                suggestions.length ? "rounded-b-none rounded-t-2xl" : "rounded-2xl",
              )}
              id="personal-plan-email"
              enterKeyHint="go"
              onChange={(event) => {
                setEmail(event.target.value)
                setError("")
              }}
              placeholder="du@beispiel.de"
              type="email"
              value={email}
            />
            {suggestions.length ? (
              <div className="-mt-px overflow-hidden rounded-b-2xl border border-[var(--brand-plum-light)] bg-white">
                {suggestions.map((suggestion) => (
                  <button
                    className="block w-full border-t border-[var(--brand-plum-light)] px-4 py-2.5 text-left text-sm font-semibold text-[var(--brand-plum-darkest)] first:border-t-0 hover:bg-[var(--brand-plum-ice)]"
                    key={suggestion}
                    onClick={() => {
                      setEmail(suggestion)
                      setError("")
                    }}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {error ? <p className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}
          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-[var(--text-sub)]">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            Deine Auswertung senden wir dir unabhängig von der optionalen Zustimmung.
          </p>
          <Button className="mt-7 h-12 w-full text-base" type="submit" variant="cta">
            Weiter zu meiner Auswertung
          </Button>
        </form>
      ) : (
        <>
          <h1 className="mt-6 text-balance text-center font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
            Dürfen wir dir Haarpflege-Tipps schicken?
          </h1>
          <p className="mt-3 text-center leading-7 text-[var(--text-sub)]">
            Deine Auswertung bekommst du in jedem Fall. Mit Ja erlaubst du zusätzliche Tipps,
            Produkt-News und Angebote per E-Mail.
          </p>
          {error ? <p className="mt-5 text-sm font-semibold text-destructive">{error}</p> : null}
          <div className="mt-7 grid gap-3">
            <Button
              className="h-12 text-base"
              disabled={saving}
              onClick={() => submit(true)}
              variant="cta"
            >
              {saving && pendingConsent === true ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert…
                </>
              ) : (
                "Ja, weiter zu meiner Auswertung"
              )}
            </Button>
            <Button
              className="h-12 rounded-[14px] border-[var(--brand-plum-light)] bg-white text-base text-[var(--brand-plum-darkest)] hover:bg-[var(--brand-plum-ice)]"
              disabled={saving}
              onClick={() => submit(false)}
              variant="outline"
            >
              {saving && pendingConsent === false ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert…
                </>
              ) : (
                "Nein, nur meine Auswertung schicken"
              )}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

function selectedValues(config: QuizQuestionConfig, answers: PersonalPlanQuizAnswers) {
  const raw = answers[config.field]
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === "string") return [raw]
  if (typeof raw === "boolean") return [String(raw)]
  return []
}

function withSingleAnswer(
  answers: PersonalPlanQuizAnswers,
  field: keyof PersonalPlanQuizAnswers,
  value: string,
): PersonalPlanQuizAnswers {
  return { ...answers, [field]: value } as PersonalPlanQuizAnswers
}

export function PersonalPlanQuiz() {
  const router = useRouter()
  const [screen, setScreen] = useState<PersonalPlanQuizScreenId>("texture")
  const [history, setHistory] = useState<PersonalPlanQuizScreenId[]>([])
  const [answers, setAnswers] = useState<PersonalPlanQuizAnswers>({})
  const [ephemeral, setEphemeral] = useState<PersonalPlanQuizEphemeralState>({})
  const [draftReady, setDraftReady] = useState(false)
  const [preparedPlan, setPreparedPlan] = useState<PreparedPlanState>({
    status: "idle",
    claim: null,
    error: null,
  })
  const [outgoingLayer, setOutgoingLayer] = useState<PersonalPlanOutgoingLayer | null>(null)
  const [settledSectionIndices, setSettledSectionIndices] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  const prefersReducedMotion = usePrefersReducedMotion()
  const outgoingLayerIdRef = useRef(0)
  const transitionActiveLayerRef = useRef<HTMLDivElement | null>(null)
  const settledSectionIndicesRef = useRef(new Set<number>())
  const autoAdvanceTimer = useRef<number | null>(null)
  const quizStartedRef = useRef(false)
  const quizCompletedRef = useRef(false)
  const preparationRequestRef = useRef<{ answersKey: string; promise: Promise<void> } | null>(null)
  const latestAnswersKeyRef = useRef(getAnswersKey(answers))

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storage = getBrowserDraftStorage()
      const draft = storage ? loadPersonalPlanQuizDraft(storage) : null
      if (draft) {
        setScreen(draft.screen)
        setHistory(draft.history)
        setAnswers(draft.answers)
        const sessionStorage = getBrowserSessionStorage()
        const claim = sessionStorage ? loadPreparedPlanClaim(sessionStorage, draft.answers) : null
        if (claim) {
          setPreparedPlan({ status: "ready", claim, error: null })
        }
        // Seed one browser history entry per restorable step so the system
        // back gesture maps onto the in-app back navigation after a reload.
        for (let index = 0; index < draft.history.length; index += 1) {
          window.history.pushState({ ppq: index }, "")
        }
      }
      setDraftReady(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  // Keep the latest in-app back handler reachable from the popstate listener.
  const goBackRef = useRef<() => void>(() => {})
  useEffect(() => {
    const onPopState = () => goBackRef.current()
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (!draftReady) return
    const storage = getBrowserDraftStorage()
    if (storage) savePersonalPlanQuizDraft({ screen, history, answers }, storage)
  }, [answers, draftReady, history, screen])

  const answersKey = useMemo(() => getAnswersKey(answers), [answers])
  useEffect(() => {
    latestAnswersKeyRef.current = answersKey
    setPreparedPlan((current) => {
      if (current.status !== "ready" || current.claim.answersKey === answersKey) return current
      const storage = getBrowserSessionStorage()
      if (storage) clearPreparedPlanClaim(storage)
      return { status: "idle", claim: null, error: null }
    })
  }, [answersKey])

  const preparePersonalPlan = useCallback(
    (force = false) => {
      const requestKey = getAnswersKey(answers)
      if (
        !force &&
        preparedPlan.status === "ready" &&
        preparedPlan.claim.answersKey === requestKey
      ) {
        return Promise.resolve()
      }
      if (preparationRequestRef.current?.answersKey === requestKey) {
        return preparationRequestRef.current.promise
      }

      setPreparedPlan({ status: "preparing", claim: null, error: null })
      const promise = (async () => {
        let lastError: unknown = null
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const response = await fetch("/api/quiz/personal-plan-prepare", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ answers }),
            })
            if (!response.ok) {
              throw new Error(`Preparation failed with ${response.status}`)
            }
            const payload: unknown = await response.json()
            const artifactId =
              payload && typeof payload === "object" && !Array.isArray(payload)
                ? (payload as Record<string, unknown>).artifactId
                : null
            const claimToken =
              payload && typeof payload === "object" && !Array.isArray(payload)
                ? (payload as Record<string, unknown>).claimToken
                : null
            const expiresAt =
              payload && typeof payload === "object" && !Array.isArray(payload)
                ? (payload as Record<string, unknown>).expiresAt
                : null
            const status =
              payload && typeof payload === "object" && !Array.isArray(payload)
                ? (payload as Record<string, unknown>).status
                : null
            if (
              typeof artifactId !== "string" ||
              typeof claimToken !== "string" ||
              typeof expiresAt !== "string" ||
              status !== "ready"
            ) {
              throw new Error("Preparation response is incomplete")
            }
            if (latestAnswersKeyRef.current !== requestKey) return
            const claim = { artifactId, claimToken, answersKey: requestKey, expiresAt }
            const storage = getBrowserSessionStorage()
            if (storage) savePreparedPlanClaim(storage, claim)
            setPreparedPlan({ status: "ready", claim, error: null })
            return
          } catch (error) {
            lastError = error
          }
        }
        if (latestAnswersKeyRef.current !== requestKey) return
        setPreparedPlan({
          status: "error",
          claim: null,
          error:
            lastError instanceof Error ? lastError.message : "Die Vorbereitung ist fehlgeschlagen.",
        })
      })().finally(() => {
        if (preparationRequestRef.current?.answersKey === requestKey) {
          preparationRequestRef.current = null
        }
      })

      preparationRequestRef.current = { answersKey: requestKey, promise }
      return promise
    },
    [answers, preparedPlan],
  )

  useEffect(() => {
    if (
      !draftReady ||
      (screen !== "plan_loading" && screen !== "email_capture") ||
      preparedPlan.status !== "idle"
    ) {
      return
    }
    void preparePersonalPlan()
  }, [draftReady, preparePersonalPlan, preparedPlan.status, screen])

  useEffect(() => {
    if (!draftReady) return
    trackAppEvent("personal_plan_quiz_screen_viewed", {
      quizVersion: "v2",
      screenId: screen,
      sectionId: getPersonalPlanQuizSectionId(screen),
    })
  }, [draftReady, screen])

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) window.clearTimeout(autoAdvanceTimer.current)
    }
  }, [])

  const progress = useMemo(() => {
    const index = PERSONAL_PLAN_QUIZ_SCREEN_IDS.indexOf(screen)
    return Math.max(4, ((index + 1) / PERSONAL_PLAN_QUIZ_SCREEN_IDS.length) * 100)
  }, [screen])

  const completeOutgoingLayer = useCallback((id: number) => {
    setOutgoingLayer((current) => (current?.id === id ? null : current))
  }, [])

  function beginScreenTransition(action: "advance" | "return") {
    const direction = getPersonalPlanQuizTransitionDirection(action)
    const activeLayer = transitionActiveLayerRef.current
    if (!prefersReducedMotion && activeLayer) {
      const snapshot = activeLayer.cloneNode(true) as HTMLDivElement
      // The visual snapshot has no React lifecycle or event handlers. Remove all
      // identity/relationship attributes before it overlaps the live screen.
      snapshot
        .querySelectorAll<HTMLElement>("[id]")
        .forEach((element) => element.removeAttribute("id"))
      snapshot
        .querySelectorAll<HTMLElement>(
          "[for], [name], [aria-labelledby], [aria-describedby], [autofocus]",
        )
        .forEach((element) => {
          element.removeAttribute("for")
          element.removeAttribute("name")
          element.removeAttribute("aria-labelledby")
          element.removeAttribute("aria-describedby")
          element.removeAttribute("autofocus")
        })
      outgoingLayerIdRef.current += 1
      setOutgoingLayer({
        direction,
        html: snapshot.innerHTML,
        id: outgoingLayerIdRef.current,
      })
    } else {
      setOutgoingLayer(null)
    }
    return direction
  }

  function settleCompletedSection(next: PersonalPlanQuizScreenId) {
    const currentSection = getPersonalPlanQuizSectionId(screen)
    const nextSection = getPersonalPlanQuizSectionId(next)
    const currentIndex = SECTION_LABELS.findIndex((section) => section.id === currentSection)
    const nextIndex = SECTION_LABELS.findIndex((section) => section.id === nextSection)
    if (nextIndex <= currentIndex || settledSectionIndicesRef.current.has(currentIndex)) return
    settledSectionIndicesRef.current.add(currentIndex)
    setSettledSectionIndices(new Set(settledSectionIndicesRef.current))
  }

  function goNext(answerSnapshot = answers) {
    const next = getNextPersonalPlanQuizScreen(screen, answerSnapshot)
    if (!next) return
    beginScreenTransition("advance")
    settleCompletedSection(next)
    setHistory((current) => appendPersonalPlanQuizHistory(current, screen))
    setScreen(next)
    // Add a browser history entry so the system back button steps back in-app
    // instead of leaving the funnel.
    window.history.pushState({ ppq: next }, "")
    window.scrollTo(0, 0)
  }

  function completeQuizAndContinue() {
    if (!quizCompletedRef.current) {
      quizCompletedRef.current = true
      trackAppEvent("quiz_completed", {
        hairLength: answers.hairLength,
        hairTexture: answers.texture,
        scalpCondition: answers.scalpConcerns?.join(",") || null,
        scalpType: answers.scalpOiliness,
        thickness: answers.thickness,
      })
    }
    goNext()
  }

  function scheduleNext(answerSnapshot = answers) {
    if (autoAdvanceTimer.current) window.clearTimeout(autoAdvanceTimer.current)
    autoAdvanceTimer.current = window.setTimeout(() => goNext(answerSnapshot), AUTO_ADVANCE_MS)
  }

  function goBack() {
    const previous = history.at(-1)
    if (!previous) return
    if (autoAdvanceTimer.current) window.clearTimeout(autoAdvanceTimer.current)
    beginScreenTransition("return")
    setHistory((current) => current.slice(0, -1))
    setScreen(previous)
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    goBackRef.current = goBack
  })

  // The in-app back button drives the browser history so the two stay in sync;
  // the popstate listener then performs the actual in-app back navigation.
  function handleHeaderBack() {
    if (history.length === 0) return
    window.history.back()
  }

  function selectSingle(config: QuizQuestionConfig, value: string) {
    if (config.field === "texture" && !quizStartedRef.current) {
      quizStartedRef.current = true
      const funnelEventId = createFunnelEventId()
      const funnel = recordBrowserFunnelMilestone("quiz_started", undefined, funnelEventId)
      trackAppEvent("quiz_started", {
        stepName: "personal_plan_texture",
        stepNumber: 1,
        funnelEventId,
        funnelPackageKey: funnel.funnelPackageKey,
        funnelSessionId: funnel.funnelSessionId,
      })
    }
    const next = withSingleAnswer(answers, config.field, value)
    setAnswers(next)
    scheduleNext(next)
  }

  function selectMulti(config: QuizQuestionConfig, value: string) {
    const current = (answers[config.field] as readonly string[] | undefined) ?? []
    let next: string[]
    if (value === config.exclusiveValue) {
      next = [value]
    } else {
      const withoutExclusive = current.filter((item) => item !== config.exclusiveValue)
      next = withoutExclusive.includes(value)
        ? withoutExclusive.filter((item) => item !== value)
        : [...withoutExclusive, value]
    }
    setAnswers((existing) => {
      const updated = { ...existing, [config.field]: next } as PersonalPlanQuizAnswers
      // Drop the free-text detail when "Etwas anderes" is no longer selected.
      if (config.field === "blockers" && !next.includes("other")) {
        delete updated.blockersOtherText
      }
      return updated
    })
  }

  function renderQuestion(
    config: QuizQuestionConfig,
    transition?: string,
    options?: {
      intro?: { title: string; body: string }
      onEmpty?: () => void
      noneOption?: { label: string; description?: string }
      otherText?: {
        triggerValue: string
        value?: string
        placeholder?: string
        onChange: (value: string) => void
      }
    },
  ) {
    const selected = selectedValues(config, answers)
    const canContinue = selected.length > 0

    return (
      <QuestionScreen
        canContinue={canContinue}
        config={config}
        intro={options?.intro}
        onEmpty={options?.onEmpty}
        noneOption={options?.noneOption}
        onContinue={() => goNext()}
        onOtherTextChange={options?.otherText?.onChange}
        onSelect={(value) =>
          config.multi ? selectMulti(config, value) : selectSingle(config, value)
        }
        otherTextPlaceholder={options?.otherText?.placeholder}
        otherTextTriggerValue={options?.otherText?.triggerValue}
        otherTextValue={options?.otherText?.value}
        selected={selected}
        transition={transition}
      />
    )
  }

  function selectAdmission(
    field: keyof Pick<
      PersonalPlanQuizEphemeralState,
      | "admissionRecurrence"
      | "admissionConflict"
      | "admissionPracticalCost"
      | "admissionEmotionalRelevance"
    >,
    value: string,
  ) {
    setEphemeral((current) => ({ ...current, [field]: value }))
    scheduleNext(answers)
  }

  function renderScreen() {
    if (screen === "texture") {
      return renderQuestion({
        field: "texture",
        title: "Welche Haarstruktur hast du?",
        helper: "Wähle das Bild, das deinem natürlichen Haar am nächsten kommt.",
        options: TEXTURE_OPTIONS,
        visual: true,
        visualLayout: "grid",
      })
    }
    if (screen === "early_proof") return <ProofScreen onContinue={() => goNext()} />
    if (screen === "goals") {
      return renderQuestion(
        {
          field: "goals",
          title: `Was wünschst du dir für ${TEXTURE_COPY[answers.texture ?? "wavy"].possessive}?`,
          helper:
            "Wähle alles aus, was dir wichtig ist. Du musst dich nicht auf ein Ziel begrenzen.",
          options: getGoalOptions(answers.texture),
          multi: true,
          visual: true,
        },
        "Wir nutzen deine Ziele gleich, um die nächsten Beobachtungen genauer einzuordnen.",
      )
    }
    if (screen === "current_problems") {
      return renderQuestion(
        {
          field: "currentConcerns",
          title: "Was beschäftigt dich gerade?",
          helper: "Wähle alles aus, was immer wieder eine Rolle spielt.",
          options: getConcernOptions(answers.texture),
          multi: true,
          visual: true,
        },
        undefined,
        {
          noneOption: {
            label: "Nichts davon",
            description: "Aktuell beschäftigt mich nichts davon.",
          },
          onEmpty: () => {
            const next = { ...answers, currentConcerns: [] }
            setAnswers(next)
            goNext(next)
          },
        },
      )
    }
    if (screen === "analysis_bridge") {
      return <AnalysisBridgeScreen answers={answers} onContinue={() => goNext()} />
    }
    if (screen === "midpoint_profile") {
      return <MidpointProfileScreen answers={answers} onContinue={() => goNext()} />
    }
    if (screen === "hair_length") {
      const base = QUESTION_CONFIGS.hair_length
      if (!base) return null
      return renderQuestion({
        ...base,
        options: getLengthOptions(answers.texture),
        visual: true,
        visualLayout: "grid",
      })
    }
    if (screen === "scalp_concerns") {
      const config = QUESTION_CONFIGS.scalp_concerns
      if (!config) return null
      return renderQuestion(config, undefined, {
        noneOption: {
          label: "Nichts davon",
          description: "Meine Kopfhaut macht mir gerade keine Probleme.",
        },
        onEmpty: () => {
          const next = { ...answers, scalpConcerns: [] }
          setAnswers(next)
          goNext(next)
        },
      })
    }
    if (screen === "admission_recurrence") {
      return (
        <AdmissionScreen
          answers={answers}
          ephemeral={ephemeral}
          onSelect={(value) => selectAdmission("admissionRecurrence", value)}
          screen={screen}
        />
      )
    }
    if (screen === "admission_conflict") {
      return (
        <AdmissionScreen
          answers={answers}
          ephemeral={ephemeral}
          onSelect={(value) => selectAdmission("admissionConflict", value)}
          screen={screen}
        />
      )
    }
    if (screen === "admission_practical_cost") {
      return (
        <AdmissionScreen
          answers={answers}
          ephemeral={ephemeral}
          onSelect={(value) => selectAdmission("admissionPracticalCost", value)}
          screen={screen}
        />
      )
    }
    if (screen === "admission_emotional_relevance") {
      return (
        <AdmissionScreen
          answers={answers}
          ephemeral={ephemeral}
          onSelect={(value) => selectAdmission("admissionEmotionalRelevance", value)}
          screen={screen}
        />
      )
    }
    if (screen === "positive_reframe") return <ReframeScreen onContinue={() => goNext()} />
    if (screen === "profile_summary") {
      return <ProfileSummaryScreen answers={answers} onContinue={() => goNext()} />
    }
    if (screen === "daily_time") {
      return (
        <DailyTimeScreen
          onSelect={(value) => {
            setEphemeral((current) => ({ ...current, dailyTime: value }))
            scheduleNext(answers)
          }}
          selected={ephemeral.dailyTime}
        />
      )
    }
    if (screen === "plan_loading") {
      return (
        <LoadingScreen
          ephemeral={ephemeral}
          onContinue={completeQuizAndContinue}
          onEphemeral={setEphemeral}
          onRetryPreparation={() => void preparePersonalPlan(true)}
          preparation={preparedPlan}
        />
      )
    }
    if (screen === "email_capture") {
      if (preparedPlan.status !== "ready") {
        return (
          <section className="mx-auto w-full max-w-[40rem] text-center">
            {preparedPlan.status === "error" ? (
              <>
                <h1 className="font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
                  Wir müssen deinen Plan noch einmal vorbereiten.
                </h1>
                <p className="mt-3 leading-7 text-[var(--text-sub)]">
                  Deine Quiz-Antworten sind weiterhin da.
                </p>
                <Button
                  className="mt-7 h-12 w-full text-base"
                  onClick={() => void preparePersonalPlan(true)}
                  variant="cta"
                >
                  Vorbereitung erneut versuchen
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto h-9 w-9 animate-spin text-[var(--brand-plum)]" />
                <h1 className="mt-5 font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
                  Dein Plan wird wiederhergestellt.
                </h1>
                <p className="mt-3 leading-7 text-[var(--text-sub)]">
                  Gleich kannst du deine Auswertung öffnen.
                </p>
              </>
            )}
          </section>
        )
      }
      return (
        <EmailCapture
          answers={answers}
          preparedPlan={preparedPlan.claim}
          onPreparedPlanRejected={() => {
            const sessionStorage = getBrowserSessionStorage()
            if (sessionStorage) clearPreparedPlanClaim(sessionStorage)
            setPreparedPlan({ status: "idle", claim: null, error: null })
          }}
          onSaved={(leadId) => {
            const storage = getBrowserDraftStorage()
            if (storage) clearPersonalPlanQuizDraft(storage)
            const sessionStorage = getBrowserSessionStorage()
            if (sessionStorage) clearPreparedPlanClaim(sessionStorage)
            router.push(`/result/${leadId}/reveal`)
          }}
        />
      )
    }

    if (screen === "blockers") {
      const config = QUESTION_CONFIGS.blockers
      if (!config) return null
      return renderQuestion(config, undefined, {
        otherText: {
          triggerValue: "other",
          value: answers.blockersOtherText,
          placeholder: "Magst du kurz sagen, was?",
          onChange: (value) =>
            setAnswers((existing) => {
              const trimmed = value.slice(0, 280)
              const updated = { ...existing }
              if (trimmed) updated.blockersOtherText = trimmed
              else delete updated.blockersOtherText
              return updated
            }),
        },
      })
    }

    const config = QUESTION_CONFIGS[screen]
    if (config) return renderQuestion(config)
    return null
  }

  return (
    <div
      className="min-h-screen bg-[hsl(var(--background))]"
      data-personal-plan-client-ready={draftReady ? "true" : "false"}
    >
      <ScreenHeader
        canGoBack={history.length > 0}
        onBack={handleHeaderBack}
        progress={progress}
        screen={screen}
        settledSectionIndices={settledSectionIndices}
      />
      <main className="flex min-h-[calc(100dvh-84px)] scroll-pb-[calc(7rem+env(safe-area-inset-bottom))] items-start px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 sm:items-center sm:px-6 sm:py-12 [@media(max-height:700px)]:items-start [@media(max-height:700px)]:pb-[calc(6rem+env(safe-area-inset-bottom))] [@media(max-height:700px)]:pt-4">
        <PersonalPlanScreenTransition
          activeLayerRef={transitionActiveLayerRef}
          onOutgoingComplete={completeOutgoingLayer}
          outgoing={outgoingLayer}
        >
          {renderScreen()}
        </PersonalPlanScreenTransition>
      </main>
    </div>
  )
}
