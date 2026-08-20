import type { QuizOption, QuizQuestionConfig } from "./quiz-data"

export const PERSONAL_PLAN_ASSET_BASE = "/images/funnels/personal-plan-quiz"

export type PersonalPlanTexture = "straight" | "wavy" | "curly" | "coily"

type TextureOption = QuizOption & {
  value: PersonalPlanTexture
  description: string
  image: string
  imageAlt: string
}

export const TEXTURE_OPTIONS: TextureOption[] = [
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

export const TEXTURE_QUESTION_CONFIG: QuizQuestionConfig & { field: "texture" } = {
  field: "texture",
  title: "Welche Haarstruktur hast du?",
  helper: "Wähle das Bild, das deinem natürlichen Haar am nächsten kommt.",
  options: TEXTURE_OPTIONS,
  visual: true,
  visualLayout: "grid",
}
