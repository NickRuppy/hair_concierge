import quizVariantDefinitions from "./registry.json"

export type FunnelQuizKind = "legacy" | "personal_plan"

export type FunnelQuizVariant = {
  id: string
  quizKind: FunnelQuizKind
  delivery: { kind: "route"; route: "/quiz" } | { kind: "embedded"; landingVariant: string }
  landingVariants: readonly string[]
}

/**
 * Owner-controlled quiz identities. A package selects one of these declared
 * variants; contributor packages may not add quiz implementations or routing.
 */
const QUIZ_VARIANT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const QUIZ_KINDS = new Set<FunnelQuizKind>(["legacy", "personal_plan"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function validateFunnelQuizVariants(value: unknown): readonly FunnelQuizVariant[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Funnel quiz variants must be a list")
  }

  const ids = new Set<string>()
  const variants: FunnelQuizVariant[] = []
  for (const candidate of value) {
    if (!isRecord(candidate)) throw new Error("Funnel quiz variant must be an object")
    const { id, quizKind, delivery, landingVariants } = candidate
    if (typeof id !== "string" || !QUIZ_VARIANT_ID_PATTERN.test(id)) {
      throw new Error(`Invalid quiz variant ID: ${String(id)}`)
    }
    if (ids.has(id)) throw new Error(`Duplicate quiz variant ID: ${id}`)
    ids.add(id)
    if (typeof quizKind !== "string" || !QUIZ_KINDS.has(quizKind as FunnelQuizKind)) {
      throw new Error(`Unsupported quiz kind: ${String(quizKind)}`)
    }
    if (
      !Array.isArray(landingVariants) ||
      landingVariants.length === 0 ||
      landingVariants.some(
        (landingVariant) =>
          typeof landingVariant !== "string" || !QUIZ_VARIANT_ID_PATTERN.test(landingVariant),
      )
    ) {
      throw new Error(`Invalid landing variants for quiz variant: ${id}`)
    }
    if (!isRecord(delivery) || typeof delivery.kind !== "string") {
      throw new Error(`Invalid quiz delivery seam for quiz variant: ${id}`)
    }
    if (delivery.kind === "route") {
      if (delivery.route !== "/quiz") {
        throw new Error(`Invalid route delivery seam for quiz variant: ${id}`)
      }
      variants.push({
        id,
        quizKind: quizKind as FunnelQuizKind,
        delivery: { kind: "route", route: "/quiz" },
        landingVariants,
      })
      continue
    }
    if (delivery.kind === "embedded") {
      if (
        typeof delivery.landingVariant !== "string" ||
        !QUIZ_VARIANT_ID_PATTERN.test(delivery.landingVariant) ||
        !landingVariants.includes(delivery.landingVariant)
      ) {
        throw new Error(`Invalid embedded delivery seam for quiz variant: ${id}`)
      }
      variants.push({
        id,
        quizKind: quizKind as FunnelQuizKind,
        delivery: { kind: "embedded", landingVariant: delivery.landingVariant },
        landingVariants,
      })
      continue
    }
    throw new Error(`Unsupported quiz delivery seam for quiz variant: ${id}`)
  }
  return variants
}

export const FUNNEL_QUIZ_VARIANTS = validateFunnelQuizVariants(quizVariantDefinitions)

export type FunnelQuizVariantId = (typeof FUNNEL_QUIZ_VARIANTS)[number]["id"]

export function getQuizVariant(id: string): FunnelQuizVariant | null {
  return FUNNEL_QUIZ_VARIANTS.find((quizVariant) => quizVariant.id === id) ?? null
}

export function isLandingCompatibleQuizVariant(
  quizVariant: FunnelQuizVariant,
  landingVariant: string,
): boolean {
  if (quizVariant.delivery.kind === "route") {
    return !FUNNEL_QUIZ_VARIANTS.some(
      (candidate) =>
        candidate.delivery.kind === "embedded" &&
        candidate.delivery.landingVariant === landingVariant,
    )
  }
  return quizVariant.landingVariants.includes(landingVariant)
}

export function assertLandingCompatibleQuizVariant(
  quizVariantId: string,
  landingVariant: string,
): FunnelQuizVariant {
  const quizVariant = getQuizVariant(quizVariantId)
  if (!quizVariant) throw new Error(`Unknown quiz variant: ${quizVariantId}`)
  if (!isLandingCompatibleQuizVariant(quizVariant, landingVariant)) {
    throw new Error(
      `Quiz variant ${quizVariantId} is not compatible with landing variant ${landingVariant}`,
    )
  }
  return quizVariant
}
