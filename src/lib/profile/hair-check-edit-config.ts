import type {
  ChemicalTreatment,
  CuticleCondition,
  HairDensity,
  HairProfile,
  HairTexture,
  HairThickness,
  ProfileConcern,
  ProteinMoistureBalance,
  ScalpCondition,
  ScalpType,
} from "@/lib/types"
import {
  CHEMICAL_TREATMENT_LABELS,
  CUTICLE_CONDITION_LABELS,
  HAIR_DENSITY_OPTIONS,
  HAIR_TEXTURE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  PROFILE_CONCERN_LABELS,
  PROTEIN_MOISTURE_LABELS,
  SCALP_CONDITION_LABELS,
  SCALP_TYPE_LABELS,
} from "@/lib/types"
import type { IconName } from "@/components/ui/icon"

export const HAIR_CHECK_EDIT_FIELDS = [
  "hair_texture",
  "thickness",
  "density",
  "cuticle_condition",
  "protein_moisture_balance",
  "chemical_treatment",
  "scalp",
  "concerns",
] as const

export type HairCheckEditField = (typeof HAIR_CHECK_EDIT_FIELDS)[number]

export type HairCheckOption<TValue extends string = string> = {
  value: TValue
  label: string
  description?: string
  icon: IconName
}

export type HairCheckProfileKey = keyof Pick<
  HairProfile,
  | "hair_texture"
  | "thickness"
  | "density"
  | "cuticle_condition"
  | "protein_moisture_balance"
  | "chemical_treatment"
  | "scalp_type"
  | "scalp_condition"
  | "concerns"
>

type HairCheckFieldValueMap = {
  hair_texture: HairTexture
  thickness: HairThickness
  density: HairDensity
  cuticle_condition: CuticleCondition
  protein_moisture_balance: ProteinMoistureBalance
  chemical_treatment: ChemicalTreatment
  concerns: ProfileConcern
}

type HairCheckCardField = keyof HairCheckFieldValueMap

export type HairCheckOptionGroup<
  TProfileKey extends HairCheckProfileKey = HairCheckProfileKey,
  TValue extends string = string,
> = {
  profileKey: TProfileKey
  title: string
  options: readonly HairCheckOption<TValue>[]
}

type HairCheckEditConfigBase<TField extends HairCheckEditField> = {
  field: TField
  profileKeys: readonly HairCheckProfileKey[]
  title: string
  description: string
}

type HairCheckCardEditConfig<TField extends HairCheckCardField> =
  HairCheckEditConfigBase<TField> & {
    mode: TField extends "chemical_treatment" | "concerns" ? "multi" : "single"
    options: readonly HairCheckOption<HairCheckFieldValueMap[TField]>[]
    optionGroups?: never
    maxSelected?: TField extends "concerns" ? number : never
  }

export type HairCheckScalpEditConfig = HairCheckEditConfigBase<"scalp"> & {
  mode: "scalp"
  profileKeys: readonly ["scalp_type", "scalp_condition"]
  optionGroups: readonly [
    HairCheckOptionGroup<"scalp_type", ScalpType>,
    HairCheckOptionGroup<"scalp_condition", ScalpCondition>,
  ]
  options?: never
  maxSelected?: never
}

export type HairCheckEditConfig =
  | HairCheckScalpEditConfig
  | {
      [TField in HairCheckCardField]: HairCheckCardEditConfig<TField>
    }[HairCheckCardField]

type HairCheckEditConfigByField = {
  [TField in HairCheckEditField]: Extract<HairCheckEditConfig, { field: TField }>
}

const hairTextureIcons: Record<HairTexture, IconName> = {
  straight: "hair-straight",
  wavy: "hair-wavy",
  curly: "hair-curly",
  coily: "hair-coily",
}

const hairTextureDescriptions: Record<HairTexture, string> = {
  straight: "Die Strähne hängt glatt runter",
  wavy: "Bildet eine S-Kurve, keine 3D-Windung",
  curly: "Formt sich zu einer deutlichen 3D-Locke",
  coily: "Enge Windungen, die sich in sich selbst drehen",
}

const hairThicknessIcons: Record<HairThickness, IconName> = {
  fine: "hair-fine",
  normal: "hair-normal",
  coarse: "hair-coarse",
}

const hairThicknessDescriptions: Record<HairThickness, string> = {
  fine: "Kaum spürbar - dünner als ein Nähfaden",
  normal: "Spürbar - ähnlich wie ein Nähfaden",
  coarse: "Deutlich spürbar - dicker als ein Nähfaden",
}

const hairDensityIcons: Record<HairDensity, IconName> = {
  low: "hair-fine",
  medium: "hair-normal",
  high: "hair-coarse",
}

const hairDensityDescriptions: Record<HairDensity, string> = {
  low: "Der Scheitel wirkt breiter oder die Kopfhaut scheint schnell durch.",
  medium: "Du hast weder auffällig wenig noch auffällig viele Haare.",
  high: "Dein Haar fühlt sich insgesamt voll an, ein Zopf wirkt eher dick.",
}

const cuticleConditionOptions = [
  {
    value: "smooth",
    label: CUTICLE_CONDITION_LABELS.smooth,
    description: "Die Finger gleiten gleichmäßig durch",
    icon: "surface-smooth",
  },
  {
    value: "slightly_rough",
    label: CUTICLE_CONDITION_LABELS.slightly_rough,
    description: "Kleine Hügel spürbar, nicht durchgehend",
    icon: "surface-uneven",
  },
  {
    value: "rough",
    label: CUTICLE_CONDITION_LABELS.rough,
    description: "Durchgehend rau und uneben",
    icon: "surface-rough",
  },
] as const satisfies readonly HairCheckOption<CuticleCondition>[]

const proteinMoistureOptions = [
  {
    value: "stretches_bounces",
    label: PROTEIN_MOISTURE_LABELS.stretches_bounces,
    description: "Federt in den Ursprungszustand zurück",
    icon: "elastic-bounces",
  },
  {
    value: "stretches_stays",
    label: PROTEIN_MOISTURE_LABELS.stretches_stays,
    description: "Kommt nicht mehr zurück - bleibt länglich",
    icon: "elastic-stays",
  },
  {
    value: "snaps",
    label: PROTEIN_MOISTURE_LABELS.snaps,
    description: "Bricht bei leichtem Zug direkt ab",
    icon: "elastic-snaps",
  },
] as const satisfies readonly HairCheckOption<ProteinMoistureBalance>[]

const chemicalTreatmentOptions = [
  {
    value: "natural",
    label: CHEMICAL_TREATMENT_LABELS.natural,
    description: "Keine Farbe, kein Blondieren - unbehandelt",
    icon: "treatment-natural",
  },
  {
    value: "colored",
    label: CHEMICAL_TREATMENT_LABELS.colored,
    description: "Farbveränderung, aber kein Aufhellen",
    icon: "treatment-colored",
  },
  {
    value: "bleached",
    label: CHEMICAL_TREATMENT_LABELS.bleached,
    description: "Gebleacht, Strähnchen oder Balayage",
    icon: "treatment-lightened",
  },
] as const satisfies readonly HairCheckOption<ChemicalTreatment>[]

const scalpTypeOptions = [
  {
    value: "oily",
    label: SCALP_TYPE_LABELS.oily,
    description: "Fettet zwischen den Haarwäschen schnell nach",
    icon: "scalp-oily",
  },
  {
    value: "balanced",
    label: SCALP_TYPE_LABELS.balanced,
    description: "Wirkt zwischen den Haarwäschen meist ausgeglichen",
    icon: "scalp-normal",
  },
  {
    value: "dry",
    label: SCALP_TYPE_LABELS.dry,
    description: "Spannt oder fühlt sich schnell trocken an",
    icon: "scalp-dry",
  },
] as const satisfies readonly HairCheckOption<ScalpType>[]

const scalpConditionOptions = [
  {
    value: "dandruff",
    label: SCALP_CONDITION_LABELS.dandruff,
    description: "Sichtbare Schuppen auf Kopfhaut oder Haaransatz",
    icon: "scalp-flaky",
  },
  {
    value: "dry_flakes",
    label: SCALP_CONDITION_LABELS.dry_flakes,
    description: "Trockene, feine Schuppen oder trockene Stellen",
    icon: "scalp-dry-flakes",
  },
  {
    value: "irritated",
    label: SCALP_CONDITION_LABELS.irritated,
    description: "Juckreiz, Brennen oder gereiztes Gefühl",
    icon: "scalp-irritated",
  },
] as const satisfies readonly HairCheckOption<ScalpCondition>[]

const concernOptions = [
  {
    value: "hair_damage",
    label: PROFILE_CONCERN_LABELS.hair_damage,
    description: "Die Längen wirken strapaziert und geschwächt",
    icon: "goal-repair",
  },
  {
    value: "split_ends",
    label: PROFILE_CONCERN_LABELS.split_ends,
    description: "Die Spitzen fasern auf oder fransen schnell aus",
    icon: "goal-split-ends",
  },
  {
    value: "breakage",
    label: PROFILE_CONCERN_LABELS.breakage,
    description: "Haare brechen oder reißen schnell ab",
    icon: "goal-strength",
  },
  {
    value: "dryness",
    label: PROFILE_CONCERN_LABELS.dryness,
    description: "Die Längen fühlen sich stumpf und trocken an",
    icon: "goal-moisture",
  },
  {
    value: "frizz",
    label: PROFILE_CONCERN_LABELS.frizz,
    description: "Viele abstehende Härchen und wenig Geschmeidigkeit",
    icon: "goal-frizz",
  },
  {
    value: "tangling",
    label: PROFILE_CONCERN_LABELS.tangling,
    description: "Dein Haar verheddert sich schnell und ist schwer zu entwirren",
    icon: "brush-detangling",
  },
] as const satisfies readonly HairCheckOption<ProfileConcern>[]

const configByField: HairCheckEditConfigByField = {
  hair_texture: {
    field: "hair_texture",
    profileKeys: ["hair_texture"],
    mode: "single",
    title: "Haartextur",
    description: "Was deine natürliche Form nach dem Nassmachen am besten beschreibt.",
    options: HAIR_TEXTURE_OPTIONS.map(({ value, label }) => ({
      value,
      label,
      description: hairTextureDescriptions[value],
      icon: hairTextureIcons[value],
    })),
  },
  thickness: {
    field: "thickness",
    profileKeys: ["thickness"],
    mode: "single",
    title: "Haardicke",
    description: "Gemeint ist der Durchmesser eines einzelnen Haares.",
    options: HAIR_THICKNESS_OPTIONS.map(({ value, label }) => ({
      value,
      label,
      description: hairThicknessDescriptions[value],
      icon: hairThicknessIcons[value],
    })),
  },
  density: {
    field: "density",
    profileKeys: ["density"],
    mode: "single",
    title: "Haardichte",
    description: "Wie viele Haare insgesamt auf deinem Kopf wachsen.",
    options: HAIR_DENSITY_OPTIONS.map(({ value, label }) => ({
      value,
      label,
      description: hairDensityDescriptions[value],
      icon: hairDensityIcons[value],
    })),
  },
  cuticle_condition: {
    field: "cuticle_condition",
    profileKeys: ["cuticle_condition"],
    mode: "single",
    title: "Haaroberfläche",
    description: "Wie sich ein sauberes, trockenes Haar zwischen den Fingern anfuehlt.",
    options: cuticleConditionOptions,
  },
  protein_moisture_balance: {
    field: "protein_moisture_balance",
    profileKeys: ["protein_moisture_balance"],
    mode: "single",
    title: "Feuchtigkeit-Protein-Balance",
    description: "Wie dein Haar bei leichtem Zug reagiert.",
    options: proteinMoistureOptions,
  },
  chemical_treatment: {
    field: "chemical_treatment",
    profileKeys: ["chemical_treatment"],
    mode: "multi",
    title: "Chemische Behandlungen",
    description: "Was dein Haar in der Vergangenheit chemisch mitgemacht hat.",
    options: chemicalTreatmentOptions,
  },
  scalp: {
    field: "scalp",
    profileKeys: ["scalp_type", "scalp_condition"],
    mode: "scalp",
    title: "Kopfhaut",
    description: "Wie sich deine Kopfhaut zwischen den Haarwäschen verhält.",
    optionGroups: [
      {
        profileKey: "scalp_type",
        title: "Kopfhauttyp",
        options: scalpTypeOptions,
      },
      {
        profileKey: "scalp_condition",
        title: "Kopfhaut-Beschwerden",
        options: scalpConditionOptions,
      },
    ],
  },
  concerns: {
    field: "concerns",
    profileKeys: ["concerns"],
    mode: "multi",
    title: "Haar-Bedenken",
    description: "Bis zu drei aktuelle Themen für deine Längen und Spitzen.",
    options: concernOptions,
    maxSelected: 3,
  },
}

export function isHairCheckEditField(value: unknown): value is HairCheckEditField {
  return typeof value === "string" && (HAIR_CHECK_EDIT_FIELDS as readonly string[]).includes(value)
}

export function getHairCheckEditConfig<TField extends HairCheckEditField>(
  field: TField,
): HairCheckEditConfigByField[TField] {
  return configByField[field]
}

export function getHairCheckEditHref(field: HairCheckEditField, returnTo = "/profile"): string {
  const params = new URLSearchParams({ field, returnTo })

  return `/profile/edit/hair-check?${params.toString()}`
}

export function resolveHairCheckReturnTo(value: string | string[] | null | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value

  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /\s/.test(candidate) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(candidate)
  ) {
    return "/profile"
  }

  return candidate
}

export function toggleChemicalTreatmentValue(
  currentValues: ChemicalTreatment[],
  treatment: ChemicalTreatment,
): ChemicalTreatment[] {
  if (treatment === "natural") {
    return currentValues.includes("natural") ? [] : ["natural"]
  }

  const withoutNatural = currentValues.filter((value) => value !== "natural")

  if (withoutNatural.includes(treatment)) {
    return withoutNatural.filter((value) => value !== treatment)
  }

  return [...withoutNatural, treatment]
}

export function toggleConcernValue(
  currentValues: ProfileConcern[],
  concern: ProfileConcern,
  maxSelected = 3,
): ProfileConcern[] {
  if (currentValues.includes(concern)) {
    return currentValues.filter((value) => value !== concern)
  }

  if (currentValues.length >= maxSelected) {
    return currentValues
  }

  return [...currentValues, concern]
}
