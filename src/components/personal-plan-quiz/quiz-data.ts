import type {
  PersonalPlanQuizAnswers,
  PersonalPlanQuizConcern,
  PersonalPlanQuizGoal,
  PersonalPlanQuizScreenId,
} from "@/lib/personal-plan-quiz"

export type QuizIconKey =
  | "comb"
  | "droplet"
  | "layers"
  | "leaf"
  | "shield"
  | "sparkles"
  | "waves"
  | "wind"
  // Factual diagnostic icons (reused from the legacy quiz's semantic mapping)
  | "feather"
  | "equal"
  | "cylinder"
  | "refresh"
  | "move"
  | "zap"
  | "activity"
  | "hand"
  | "pipette"
  | "flame"
  | "scale"
  | "sun-dim"
  | "permed"
  | "straightened"
  // Semantic icons for categorical routine/context questions (no ranking implied).
  | "circle-check"
  | "heart"
  | "sliders"
  | "target"
  | "coffee"
  | "briefcase"
  | "users"
  | "party"
  | "camera"
  | "messages"
  | "package-search"
  | "list-ordered"
  | "split"
  | "clock"
  | "wallet"
  | "calendar-x"
  | "pen"

export type QuizOption = {
  value: string
  label: string
  description?: string
  image?: string
  /** Short German alt text for the option image (choice photos only). */
  imageAlt?: string
  /**
   * Renders a composed hair-portrait illustration (hair + shared body outline)
   * instead of a flat photo. Used by the length question so every card shows a
   * consistent figure.
   */
  portrait?: {
    texture: NonNullable<PersonalPlanQuizAnswers["texture"]>
    length: NonNullable<PersonalPlanQuizAnswers["hairLength"]>
  }
  icon?: QuizIconKey
  /**
   * Grammatical lower-cased noun phrase used when the label is interpolated
   * mid-sentence (e.g. the recurrence question). Avoids blanket toLowerCase
   * mangling German nouns.
   */
  midSentenceLabel?: string
}

export type QuizQuestionConfig = {
  field: keyof PersonalPlanQuizAnswers
  title: string
  helper?: string
  /** Small mono eyebrow shown above the headline (e.g. "KOPFHAUT"). */
  eyebrow?: string
  contextImage?: string
  contextImageAlt?: string
  /** Per-image object-position so the banner crop keeps the subject in frame. */
  contextObjectPosition?: string
  options: QuizOption[]
  multi?: boolean
  exclusiveValue?: string
  visual?: boolean
  visualLayout?: "grid" | "stacked" | "thumbnail"
  /**
   * Marks icon-less scale/likert questions that receive the Noom-style graded
   * colour-intensity ramp instead of diagnostic icons.
   */
  scale?: boolean
}

export const PERSONAL_PLAN_ASSET_BASE = "/images/funnels/personal-plan-quiz"
const PROFILE_SUMMARY_IMAGE_BASE = `${PERSONAL_PLAN_ASSET_BASE}/profile-summary`

const LENGTH_IMAGE_SLUGS: Record<NonNullable<PersonalPlanQuizAnswers["hairLength"]>, string> = {
  very_short: "very-short",
  short: "short",
  medium: "medium",
  long: "long",
  very_long: "very-long",
}

/**
 * Returns the approved profile-summary photo for a texture + length pair. The
 * fallback is only defensive: both answers are collected before this screen.
 */
export function getProfileSummaryImage(
  texture: PersonalPlanQuizAnswers["texture"],
  length: PersonalPlanQuizAnswers["hairLength"],
): string {
  const resolvedTexture = texture ?? "wavy"
  const resolvedLength = length ?? "medium"
  return `${PROFILE_SUMMARY_IMAGE_BASE}/${resolvedTexture}-${LENGTH_IMAGE_SLUGS[resolvedLength]}.webp`
}

const LENGTH_LABELS: Array<{
  value: NonNullable<PersonalPlanQuizAnswers["hairLength"]>
  label: string
  description: string
}> = [
  { value: "very_short", label: "Sehr kurz", description: "Über den Ohren" },
  { value: "short", label: "Kurz", description: "Bis zum Kinn oder Kiefer" },
  { value: "medium", label: "Mittellang", description: "Bis zu den Schultern" },
  { value: "long", label: "Lang", description: "Bis zur Brust" },
  { value: "very_long", label: "Sehr lang", description: "Bis zur Taille oder länger" },
]

/**
 * Personalised length options: each card shows the user's selected texture at the
 * respective length from the hair-portrait library.
 */
export function getLengthOptions(texture: PersonalPlanQuizAnswers["texture"]): QuizOption[] {
  const resolved = texture ?? "wavy"
  return LENGTH_LABELS.map(({ value, label, description }) => ({
    value,
    label,
    description,
    portrait: { texture: resolved, length: value },
    imageAlt: `${label}es Haar`,
  }))
}

export const TEXTURE_OPTIONS: QuizOption[] = [
  {
    value: "straight",
    label: "Glatt",
    description: "Die meisten Strähnen fallen eher gerade.",
    image: `${PERSONAL_PLAN_ASSET_BASE}/texture-straight.webp`,
    imageAlt: "Glattes Haar",
  },
  {
    value: "wavy",
    label: "Wellig",
    description: "Dein Haar bildet sichtbare S-Formen.",
    image: `${PERSONAL_PLAN_ASSET_BASE}/texture-wavy.webp`,
    imageAlt: "Welliges Haar",
  },
  {
    value: "curly",
    label: "Lockig",
    description: "Dein Haar bildet klare Locken oder Spiralen.",
    image: `${PERSONAL_PLAN_ASSET_BASE}/texture-curly.webp`,
    imageAlt: "Lockiges Haar",
  },
  {
    value: "coily",
    label: "Kraus",
    description: "Dein Haar bildet sehr enge Locken, Coils oder Z-Formen.",
    image: `${PERSONAL_PLAN_ASSET_BASE}/texture-coily.webp`,
    imageAlt: "Krauses Haar",
  },
]

export const TEXTURE_COPY: Record<
  NonNullable<PersonalPlanQuizAnswers["texture"]>,
  { adjective: string; dative: string; noun: string; possessive: string }
> = {
  straight: {
    adjective: "glattes",
    dative: "deinem glatten Haar",
    noun: "glattes Haar",
    possessive: "dein glattes Haar",
  },
  wavy: {
    adjective: "welliges",
    dative: "deinen Wellen",
    noun: "welliges Haar",
    possessive: "deine Wellen",
  },
  curly: {
    adjective: "lockiges",
    dative: "deinen Locken",
    noun: "lockiges Haar",
    possessive: "deine Locken",
  },
  coily: {
    adjective: "krauses",
    dative: "deinen Coils",
    noun: "krauses Haar",
    possessive: "deine Coils",
  },
}

const GOAL_LABELS: Record<
  NonNullable<PersonalPlanQuizAnswers["texture"]>,
  Record<PersonalPlanQuizGoal, string>
> = {
  straight: {
    moisture: "Feuchtigkeit ohne Beschweren",
    frizz_surface: "Mehr Geschmeidigkeit, weniger abstehende Haare",
    shine: "Mehr Glanz",
    strength_ends: "Weniger Haarbruch und Spliss",
    scalp_balance: "Ausgeglichene Kopfhaut",
    manageability_styling: "Leichteres Styling",
    shape_definition: "Mehr Form und Halt",
    volume_balance: "Ausgewogenes Volumen",
  },
  wavy: {
    moisture: "Feuchtigkeit ohne Beschweren",
    frizz_surface: "Weniger Frizz",
    shine: "Mehr Glanz",
    strength_ends: "Weniger Haarbruch und Spliss",
    scalp_balance: "Ausgeglichene Kopfhaut",
    manageability_styling: "Leichteres Styling",
    shape_definition: "Mehr Wellen-Definition",
    volume_balance: "Ausgewogenes Volumen",
  },
  curly: {
    moisture: "Intensive Feuchtigkeit",
    frizz_surface: "Weniger Frizz",
    shine: "Mehr Glanz",
    strength_ends: "Weniger Haarbruch und Spliss",
    scalp_balance: "Ausgeglichene Kopfhaut",
    manageability_styling: "Leichteres Entwirren und Styling",
    shape_definition: "Mehr Locken-Definition",
    volume_balance: "Ausgewogenes Volumen",
  },
  coily: {
    moisture: "Feuchtigkeit länger bewahren",
    frizz_surface: "Mehr Geschmeidigkeit, weniger Frizz",
    shine: "Mehr Glanz",
    strength_ends: "Weniger Haarbruch und bessere Längenretention",
    scalp_balance: "Ausgeglichene Kopfhaut",
    manageability_styling: "Leichteres Entwirren und Styling",
    shape_definition: "Mehr Definition",
    volume_balance: "Ausgewogenes Volumen",
  },
}

const GOAL_ICONS: Record<PersonalPlanQuizGoal, QuizIconKey> = {
  moisture: "droplet",
  frizz_surface: "wind",
  shine: "sparkles",
  strength_ends: "shield",
  scalp_balance: "leaf",
  manageability_styling: "comb",
  shape_definition: "waves",
  volume_balance: "layers",
}

export function getGoalOptions(texture: PersonalPlanQuizAnswers["texture"]): QuizOption[] {
  const labels = GOAL_LABELS[texture ?? "wavy"]
  return Object.entries(labels).map(([value, label]) => ({
    value,
    label,
    icon: GOAL_ICONS[value as PersonalPlanQuizGoal],
  }))
}

type TextureConcernCopy = { label: string; midSentenceLabel: string }

const TEXTURE_CONCERN_LABELS: Record<
  NonNullable<PersonalPlanQuizAnswers["texture"]>,
  Pick<
    Record<PersonalPlanQuizConcern, TextureConcernCopy>,
    "lost_shape" | "low_volume_or_weighed_down"
  >
> = {
  straight: {
    lost_shape: {
      label: "Mein Haar verliert schnell Form und Halt",
      midSentenceLabel: "platte, kraftlose Längen",
    },
    low_volume_or_weighed_down: {
      label: "Mein Haar wirkt schnell platt oder beschwert",
      midSentenceLabel: "platte oder beschwerte Längen",
    },
  },
  wavy: {
    lost_shape: {
      label: "Meine Wellen verlieren schnell ihre Form",
      midSentenceLabel: "kraftlose, ausgehängte Wellen",
    },
    low_volume_or_weighed_down: {
      label: "Mein Ansatz wirkt flach oder meine Längen schnell beschwert",
      midSentenceLabel: "ein flacher Ansatz oder beschwerte Längen",
    },
  },
  curly: {
    lost_shape: {
      label: "Meine Locken verlieren schnell ihre Definition",
      midSentenceLabel: "undefinierte Locken",
    },
    low_volume_or_weighed_down: {
      label: "Form oder Volumen wirken schnell ungleichmäßig",
      midSentenceLabel: "ungleichmäßiges Volumen",
    },
  },
  coily: {
    lost_shape: {
      label: "Meine Definition hält nicht so, wie ich es möchte",
      midSentenceLabel: "undefinierte Coils",
    },
    low_volume_or_weighed_down: {
      label: "Form oder Volumen verteilen sich nicht so, wie ich es möchte",
      midSentenceLabel: "ungleichmäßiges Volumen",
    },
  },
}

const SHARED_CONCERNS: Array<QuizOption & { value: PersonalPlanQuizConcern }> = [
  {
    value: "dry_lengths",
    label: "Trockene oder strohige Längen",
    midSentenceLabel: "trockene oder strohige Längen",
    icon: "droplet",
  },
  {
    value: "frizz_flyaways",
    label: "Frizz oder viele abstehende Haare",
    midSentenceLabel: "Frizz oder abstehende Haare",
    icon: "wind",
  },
  {
    value: "low_shine",
    label: "Wenig Glanz",
    midSentenceLabel: "stumpfe, glanzlose Längen",
    icon: "sparkles",
  },
  {
    value: "hair_damage",
    label: "Mein Haar wirkt insgesamt strapaziert oder geschädigt",
    midSentenceLabel: "insgesamt strapaziertes Haar",
    icon: "shield",
  },
  {
    value: "breakage",
    label: "Mein Haar bricht in den Längen ab",
    description: "Einzelne Haare reißen oberhalb der Spitzen ab.",
    midSentenceLabel: "Haarbruch in den Längen",
    icon: "shield",
  },
  {
    value: "split_ends",
    label: "Meine Spitzen sind sichtbar gespalten oder ausgefranst",
    description: "Die Enden einzelner Haare teilen sich sichtbar.",
    midSentenceLabel: "sichtbar gespaltene oder ausgefranste Spitzen",
    icon: "split",
  },
  {
    value: "tangling",
    label: "Schnelles Verknoten",
    midSentenceLabel: "Knoten oder Verfilzungen",
    icon: "comb",
  },
]

export function getConcernOptions(texture: PersonalPlanQuizAnswers["texture"]): QuizOption[] {
  const labels = TEXTURE_CONCERN_LABELS[texture ?? "wavy"]
  return [
    ...SHARED_CONCERNS,
    {
      value: "lost_shape",
      label: labels.lost_shape.label,
      midSentenceLabel: labels.lost_shape.midSentenceLabel,
      icon: "waves",
    },
    {
      value: "low_volume_or_weighed_down",
      label: labels.low_volume_or_weighed_down.label,
      midSentenceLabel: labels.low_volume_or_weighed_down.midSentenceLabel,
      icon: "layers",
    },
  ]
}

export const QUESTION_CONFIGS: Partial<Record<PersonalPlanQuizScreenId, QuizQuestionConfig>> = {
  thickness: {
    field: "thickness",
    title: "Wie dick ist ein einzelnes Haar?",
    helper: "Wenn du unsicher bist: Reibe eine trockene Strähne zwischen zwei Fingern.",
    visual: true,
    visualLayout: "thumbnail",
    options: [
      {
        value: "fine",
        label: "Fein",
        description: "Kaum spürbar, dünner als ein Nähfaden.",
        image: `${PERSONAL_PLAN_ASSET_BASE}/thickness-fine.webp`,
        imageAlt: "Feines Haar",
      },
      {
        value: "normal",
        label: "Mittel",
        description: "Spürbar, etwa wie ein Nähfaden.",
        image: `${PERSONAL_PLAN_ASSET_BASE}/thickness-normal.webp`,
        imageAlt: "Mitteldickes Haar",
      },
      {
        value: "coarse",
        label: "Dick",
        description: "Deutlich spürbar, eher kräftig.",
        image: `${PERSONAL_PLAN_ASSET_BASE}/thickness-coarse.webp`,
        imageAlt: "Dickes Haar",
      },
    ],
  },
  density: {
    field: "density",
    title: "Wie dicht ist dein Haar insgesamt?",
    helper:
      "Es geht um die Menge der Haare auf dem Kopf, nicht um die Dicke einer einzelnen Strähne.",
    options: [
      {
        value: "low",
        label: "Wenig Haare",
        description: "Der Scheitel wirkt breiter oder die Kopfhaut scheint schnell durch.",
        icon: "feather",
      },
      {
        value: "medium",
        label: "Mittlere Dichte",
        description: "Weder auffällig wenig noch auffällig viele Haare.",
        icon: "equal",
      },
      {
        value: "high",
        label: "Viele Haare",
        description: "Dein Haar fühlt sich voll an, ein Zopf wirkt eher dick.",
        icon: "cylinder",
      },
    ],
  },
  routine_clarity: {
    field: "routineClarity",
    title: "Wie klar ist deine aktuelle Haarpflege?",
    scale: true,
    options: [
      {
        value: "clear",
        label: "Ich habe eine klare Routine, die meistens funktioniert",
      },
      {
        value: "partial",
        label: "Einzelne Schritte funktionieren, aber mir fehlt ein klares System",
      },
      {
        value: "trial_and_error",
        label: "Ich probiere viel aus, ohne zu wissen, was zusammenpasst",
      },
      { value: "none", label: "Ich habe noch keine feste Routine" },
    ],
  },
  result_reliability: {
    field: "resultReliability",
    title: "Wie oft gelingt dein Wunschergebnis?",
    helper: "Denk dabei ans Waschen und Stylen.",
    contextImage: `${PERSONAL_PLAN_ASSET_BASE}/recognition-mirror.webp`,
    contextObjectPosition: "50% 32%",
    scale: true,
    options: [
      { value: "mostly", label: "Meistens" },
      { value: "sometimes", label: "Manchmal" },
      { value: "rarely", label: "Selten" },
    ],
  },
  adaptation_confidence: {
    field: "adaptationConfidence",
    title: "Weißt du, was du dann ändern musst?",
    helper: "Wenn das Ergebnis nach Waschen oder Styling nicht passt.",
    contextImage: `${PERSONAL_PLAN_ASSET_BASE}/uncertain-products.webp`,
    contextObjectPosition: "50% 30%",
    scale: true,
    options: [
      { value: "yes", label: "Ja, meistens" },
      { value: "partly", label: "Teilweise" },
      { value: "no", label: "Nein, eher nicht" },
    ],
  },
  hair_length: {
    field: "hairLength",
    title: "Wie lang sind deine Haare aktuell?",
    helper: "Bei Wellen, Locken und krausem Haar zählt die sanft gestreckte Länge einer Strähne.",
    options: [
      { value: "very_short", label: "Sehr kurz" },
      { value: "short", label: "Kurz" },
      { value: "medium", label: "Mittellang" },
      { value: "long", label: "Lang" },
      { value: "very_long", label: "Sehr lang" },
    ],
  },
  hair_surface: {
    field: "hairSurface",
    title: "Wie fühlt sich deine Haaroberfläche an?",
    helper: "Streiche mit zwei Fingern vorsichtig an einer einzelnen trockenen Strähne entlang.",
    options: [
      {
        value: "smooth",
        label: "Glatt",
        description: "Die Strähne gleitet gleichmäßig.",
        icon: "sparkles",
      },
      {
        value: "slightly_uneven",
        label: "Leicht uneben",
        description: "Du spürst kleine Unebenheiten.",
        icon: "activity",
      },
      {
        value: "rough",
        label: "Rau",
        description: "Die Strähne fühlt sich trocken oder rau an.",
        icon: "hand",
      },
    ],
  },
  elastic_response: {
    field: "elasticResponse",
    title: "Wie reagiert dein Haar beim Dehnen?",
    helper:
      "Teste nur sanft an einem einzelnen ausgefallenen Haar und wähle die Beobachtung, die am ehesten passt.",
    options: [
      { value: "stretches_bounces", label: "Es dehnt sich etwas und geht zurück", icon: "refresh" },
      { value: "stretches_stays", label: "Es bleibt gedehnt", icon: "move" },
      { value: "snaps", label: "Es reißt schnell", icon: "zap" },
    ],
  },
  chemical_treatments: {
    field: "chemicalTreatments",
    title: "Sind deine Haare chemisch behandelt?",
    helper: "Wähle alles aus, was aktuell noch in deinen Längen ist.",
    multi: true,
    exclusiveValue: "natural",
    options: [
      { value: "natural", label: "Naturhaar", icon: "leaf" },
      { value: "colored", label: "Gefärbt oder getönt", icon: "pipette" },
      { value: "lightened", label: "Blondiert oder aufgehellt", icon: "flame" },
      { value: "permed", label: "Dauergewellt", icon: "permed" },
      { value: "chemically_straightened", label: "Chemisch geglättet", icon: "straightened" },
    ],
  },
  scalp_oiliness: {
    field: "scalpOiliness",
    title: "Wie würdest du deine Kopfhaut beschreiben?",
    eyebrow: "Kopfhaut",
    helper:
      "Deine Gesichtshaut gibt dir einen guten Hinweis — eine ölige T-Zone deutet auf fettige Kopfhaut hin.",
    options: [
      {
        value: "oily",
        label: "Fettig",
        description: "Ansätze werden nach 1–2 Tagen ölig.",
        icon: "droplet",
      },
      {
        value: "balanced",
        label: "Ausgeglichen",
        description: "Kommt gut 2–3 Tage ohne Waschen klar.",
        icon: "scale",
      },
      {
        value: "dry",
        label: "Trocken",
        description: "Spannt gelegentlich, fühlt sich eher rau an.",
        icon: "sun-dim",
      },
    ],
  },
  scalp_concerns: {
    field: "scalpConcerns",
    title: "Was trifft aktuell auf deine Kopfhaut zu?",
    eyebrow: "Kopfhaut",
    helper:
      "Wähle alles aus, was du bemerkst. Das hilft, den Plan kosmetisch verantwortungsvoll einzuordnen.",
    multi: true,
    options: [
      {
        value: "oily_dandruff",
        label: "Fettige Schuppen",
        description: "Größere, gelbliche, ölige Flocken, die an Kopfhaut und Ansatz haften.",
      },
      {
        value: "dry_dandruff",
        label: "Trockene Schuppen",
        description: "Kleine, weiße, trockene Flocken, die rieseln — Kopfhaut spannt oft.",
      },
      {
        value: "irritated",
        label: "Gereizte oder empfindliche Kopfhaut",
        description: "Jucken, Rötungen oder Brennen.",
      },
    ],
  },
  previous_attempts: {
    field: "previousAttempts",
    title: "Was hat dir bisher geholfen?",
    scale: true,
    options: [
      {
        value: "nothing_reliably_worked",
        label: "Ich habe vieles probiert, aber nichts hat zuverlässig funktioniert",
      },
      { value: "little_targeted_trial", label: "Ich habe bisher nur wenig gezielt ausprobiert" },
      { value: "some_steps_helped", label: "Einzelne Produkte oder Schritte haben geholfen" },
      { value: "mostly_works", label: "Meine bisherige Routine funktioniert größtenteils" },
    ],
  },
  blockers: {
    field: "blockers",
    title: "Was macht eine passende Routine schwierig?",
    multi: true,
    options: [
      {
        value: "conflicting_tips",
        label: "Zu viele widersprüchliche Tipps",
        icon: "messages",
      },
      {
        value: "product_fit",
        label: "Ich weiß nicht, welche Produkte zu meinem Haar passen",
        icon: "package-search",
      },
      {
        value: "application_uncertainty",
        label: "Ich bin unsicher bei Reihenfolge, Menge oder Anwendung",
        icon: "list-ordered",
      },
      {
        value: "different_scalp_and_lengths",
        label: "Kopfhaut und Längen brauchen unterschiedliche Pflege",
        icon: "split",
      },
      {
        value: "routine_too_complex",
        label: "Eine vollständige Routine wird schnell zu aufwendig",
        icon: "clock",
      },
      {
        value: "time_and_cost",
        label: "Ausprobieren kostet zu viel Zeit und Geld",
        icon: "wallet",
      },
      {
        value: "consistency",
        label: "Es fällt mir schwer, konsequent zu bleiben",
        icon: "calendar-x",
      },
      { value: "other", label: "Etwas anderes", icon: "pen" },
    ],
  },
  routine_style: {
    field: "routineStyle",
    title: "Wie soll sich deine Haarpflege anfühlen?",
    options: [
      {
        value: "simple_reliable",
        label: "Einfach und verlässlich",
        description: "Wenige klare Schritte, die ich leicht beibehalten kann.",
        icon: "circle-check",
      },
      {
        value: "intentional_caring",
        label: "Bewusst und pflegend",
        description: "Eine Routine, für die ich mir gerne etwas Zeit nehme.",
        icon: "heart",
      },
      {
        value: "flexible_versatile",
        label: "Flexibel und vielseitig",
        description: "Eine Basisroutine, die ich je nach Tag und Styling erweitern kann.",
        icon: "sliders",
      },
      {
        value: "precise_goal_oriented",
        label: "Präzise und zielgerichtet",
        description: "Genaue Schritte, mit denen ich mein Haar systematisch verbessern kann.",
        icon: "target",
      },
    ],
  },
  meaningful_moment: {
    field: "meaningfulMoment",
    title: "Wann möchtest du dich besonders wohlfühlen?",
    options: [
      { value: "everyday", label: "Im Alltag, einfach für mich selbst", icon: "coffee" },
      { value: "work", label: "Bei der Arbeit oder wichtigen Terminen", icon: "briefcase" },
      { value: "social", label: "Beim Treffen mit Freunden oder Familie", icon: "users" },
      { value: "going_out", label: "Beim Ausgehen, Feiern oder bei Dates", icon: "party" },
      {
        value: "special_occasions",
        label: "Bei besonderen Anlässen oder auf Fotos",
        icon: "camera",
      },
    ],
  },
}

export const DAILY_TIME_OPTIONS: QuizOption[] = [
  { value: "5_minutes", label: "5 Minuten pro Tag" },
  { value: "10_minutes", label: "10 Minuten pro Tag" },
  { value: "15_minutes", label: "15 Minuten pro Tag" },
  { value: "20_plus_minutes", label: "20+ Minuten pro Tag" },
]

export const PREPARATION_TESTIMONIALS = [
  {
    role: "Verstehen",
    source: "M. · Chaarlie-Kundin",
    quote:
      "Ich hatte schon so viele Tipps ausprobiert. Durch Chaarlie habe ich zum ersten Mal verstanden, was meine Haare wirklich brauchen.",
  },
  {
    role: "Personalisieren",
    source: "S. · Chaarlie-Kundin",
    quote:
      "Mein Haarpflegeplan fühlt sich wirklich auf meine Haare abgestimmt an – nicht wie eine allgemeine Routine, die für alle gleich ist.",
  },
  {
    role: "Umsetzen",
    source: "J. · Chaarlie-Kundin",
    quote:
      "Endlich weiß ich, welche Schritte für meine Haare wichtig sind und in welcher Reihenfolge. Das macht meine Haarpflege so viel einfacher.",
  },
] as const

export const EARLY_PROOF_TESTIMONIAL = {
  source: "L. · Chaarlie-Kundin",
  quote: "Der Fragebogen ist echt gut und leicht verständlich.",
} as const
