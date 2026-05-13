import {
  LEAVE_IN_FORMAT_LABELS,
  LEAVE_IN_WEIGHT_LABELS,
  isLeaveInCategory,
} from "@/lib/leave-in/constants"
import type { HairProfile, LeaveInRecommendationMetadata, Product } from "@/lib/types"

export type CompactProductFactSource =
  | "format"
  | "heat_protection"
  | "care_focus"
  | "weight"
  | "category"

export interface CompactProductFact {
  label: string
  source: CompactProductFactSource
}

export interface DrawerProductProfileRow {
  label: string
  value: string
}

const BALANCE_LABELS = {
  moisture: "Feuchtigkeit",
  balanced: "ausgewogen",
  protein: "Protein",
} as const

const BALANCE_ROW_LABELS = {
  moisture: "Feuchtigkeit",
  balanced: "Ausgewogene Pflege",
  protein: "Proteinpflege",
} as const

const CARE_BENEFIT_LABELS = {
  moisture: "Feuchtigkeit",
  protein: "Protein",
  repair: "Repair",
  detangling: "Entwirren",
  anti_frizz: "Anti-Frizz",
  shine: "Glanz",
  curl_definition: "Definition",
  volume: "Volumen",
} as const

const CATEGORY_LABELS: Record<string, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  "conditioner-drogerie": "Conditioner",
  leave_in: "Leave-in",
  "leave-in": "Leave-in",
  "leave in": "Leave-in",
  leavein: "Leave-in",
  mask: "Maske",
  maske: "Maske",
  oil: "Öl",
  oel: "Öl",
  öle: "Öl",
  oele: "Öl",
  bondbuilder: "Bondbuilder",
  "bond-builder": "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigung",
  "deep-cleansing-shampoo": "Tiefenreinigung",
  "deep-cleansing": "Tiefenreinigung",
  dry_shampoo: "Trockenshampoo",
  "dry-shampoo": "Trockenshampoo",
  trockenshampoo: "Trockenshampoo",
  peeling: "Peeling",
}

const THICKNESS_PROFILE_LABELS: Record<string, string> = {
  fine: "Feines Haar",
  normal: "Mittelstarkes Haar",
  coarse: "Dickes Haar",
}

const THICKNESS_SUMMARY_LABELS: Record<string, string> = {
  fine: "feines Haar",
  normal: "mittelstarkes Haar",
  coarse: "dickes Haar",
}

const CONCERN_LABELS: Record<string, string> = {
  dandruff: "Schuppen",
  schuppen: "Schuppen",
  oily_scalp: "Fettige Kopfhaut",
  dryness: "Trockenheit",
  trocken: "Trockenheit",
  frizz: "Frizz",
  hair_damage: "Haarschäden",
  split_ends: "Spliss",
  breakage: "Haarbruch",
  tangling: "Verknotungen",
  protein: "Protein",
  feuchtigkeit: "Feuchtigkeit",
  performance: "Performance",
  repair: "Reparatur",
  moisture_anti_frizz: "Feuchtigkeit & Anti-Frizz",
  healthy_scalp: "Gesunde Kopfhaut",
  normal: "Normale Kopfhaut",
  "dehydriert-fettig": "Dehydriert-fettige Kopfhaut",
  irritationen: "Empfindliche Kopfhaut",
}

const SHOP_HOST_LABELS: Record<string, string> = {
  "dm.de": "dm",
  "rossmann.de": "Rossmann",
  "mueller.de": "Müller",
  "douglas.de": "Douglas",
  "flaconi.de": "Flaconi",
  "amazon.de": "Amazon",
  "notino.de": "Notino",
  "hagel-shop.de": "Hagel-Shop",
}

export function buildCompactProductFacts(product: Product): CompactProductFact[] {
  if (isLeaveInProduct(product)) {
    const facts: CompactProductFact[] = []
    const meta = getLeaveInMeta(product)
    const format = meta?.product_format ?? product.leave_in_specs?.format ?? null
    const weight = meta?.product_weight ?? product.leave_in_specs?.weight ?? null
    const balance = meta?.product_balance_direction ?? null

    if (format) {
      facts.push({ label: LEAVE_IN_FORMAT_LABELS[format], source: "format" })
    }

    if (meta?.provides_heat_protection ?? product.leave_in_specs?.provides_heat_protection) {
      facts.push({ label: "Hitzeschutz", source: "heat_protection" })
    }

    if (balance) {
      facts.push({ label: `Pflege: ${BALANCE_LABELS[balance]}`, source: "care_focus" })
    } else {
      const benefit = firstLeaveInCareBenefit(
        meta?.product_care_benefits ?? product.leave_in_specs?.care_benefits,
      )
      if (benefit) {
        facts.push({ label: `Pflege: ${benefit}`, source: "care_focus" })
      }
    }

    if (facts.length < 3 && weight) {
      facts.push({ label: LEAVE_IN_WEIGHT_LABELS[weight], source: "weight" })
    }

    return facts.slice(0, 3)
  }

  const categoryLabel = getProductCategoryLabel(
    product.recommendation_meta?.category ?? product.category,
  )
  return categoryLabel ? [{ label: categoryLabel, source: "category" }] : []
}

export function buildDrawerProductProfileRows(product: Product): DrawerProductProfileRow[] {
  if (!isLeaveInProduct(product)) return buildFallbackProductProfileRows(product)

  const meta = getLeaveInMeta(product)
  const rows: DrawerProductProfileRow[] = []
  const format = meta?.product_format ?? product.leave_in_specs?.format ?? null
  const weight = meta?.product_weight ?? product.leave_in_specs?.weight ?? null
  const balance = meta?.product_balance_direction ?? null
  const providesHeatProtection =
    meta?.provides_heat_protection ?? product.leave_in_specs?.provides_heat_protection ?? null
  const role = getLeaveInRoleLabel(meta, product)

  if (format) rows.push({ label: "Textur/Form", value: LEAVE_IN_FORMAT_LABELS[format] })
  if (weight) rows.push({ label: "Gefühl", value: LEAVE_IN_WEIGHT_LABELS[weight] })
  if (balance) rows.push({ label: "Wirkung", value: BALANCE_ROW_LABELS[balance] })
  if (!balance) {
    const benefit = firstLeaveInCareBenefit(
      meta?.product_care_benefits ?? product.leave_in_specs?.care_benefits,
    )
    if (benefit) rows.push({ label: "Wirkung", value: benefit })
  }
  if (providesHeatProtection !== null) {
    rows.push({ label: "Hitzeschutz", value: providesHeatProtection ? "Ja" : "Nein" })
  }
  if (role) rows.push({ label: "Rolle", value: role })

  return rows
}

export function buildProductMatchSummary(
  product: Product,
  hairProfile?: HairProfile | null,
): string {
  if (!isLeaveInProduct(product)) {
    return buildFallbackProductMatchSummary(product, hairProfile)
  }

  const meta = getLeaveInMeta(product)
  const goals = hairProfile?.goals ?? []
  const heatStyling = hairProfile?.heat_styling ?? null
  const hasRegularHeatStyling =
    meta?.styling_context === "heat_style" ||
    heatStyling === "daily" ||
    heatStyling === "several_weekly" ||
    heatStyling === "once_weekly"
  const wantsShine = goals.includes("shine") || meta?.need_bucket === "shine_protect"
  const hasFineHair =
    hairProfile?.thickness === "fine" || meta?.matched_profile.thickness === "fine"

  const format = meta?.product_format ?? product.leave_in_specs?.format ?? null
  const role = getLeaveInRoleLabel(meta, product)
  const balance = meta?.product_balance_direction ?? null
  const categoryLabel =
    getProductCategoryLabel(product.recommendation_meta?.category ?? product.category) || "Leave-in"
  const productSubject = getLeaveInProductSubject(categoryLabel, format)
  const providesHeatProtection =
    meta?.provides_heat_protection ?? product.leave_in_specs?.provides_heat_protection ?? false

  const profileSentence = buildLeaveInProfileSentence(
    hasRegularHeatStyling,
    wantsShine,
    hasFineHair,
  )
  const rolePhrase = role ? ` als ${role}` : ""
  const factPhrase = buildLeaveInFactPhrase(providesHeatProtection, balance, productSubject.article)
  const weightCaution =
    hairProfile?.thickness === "fine" &&
    (meta?.product_weight ?? product.leave_in_specs?.weight) !== "rich"
      ? ", ohne in eine sehr reichhaltige Richtung zu gehen"
      : ""

  return `${profileSentence}${productSubject.label} passt${rolePhrase}${factPhrase}${weightCaution}.`
}

export function buildProductApplicationSentence(
  product: Product,
  hairProfile?: HairProfile | null,
): string {
  const usageHint = product.recommendation_meta?.usage_hint?.trim()
  if (!usageHint) return ""

  const sentences = [ensureSentenceEnding(usageHint)]
  if (hairProfile?.thickness === "fine" && !hasFineHairOrSparseUseGuidance(usageHint)) {
    sentences.push("Bei feinem Haar lieber mit wenig Produkt starten und nur bei Bedarf nachlegen.")
  }

  return sentences.join(" ")
}

export function formatProductPrice(
  price: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (price === null || price === undefined || !Number.isFinite(price)) return ""

  const formatCurrency = (currencyCode: string) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: currencyCode,
    })
      .format(price)
      .replace(/\u00a0/g, " ")

  try {
    return formatCurrency(currency || "EUR")
  } catch {
    return formatCurrency("EUR")
  }
}

export function getProductCategoryLabel(category: string | null | undefined): string {
  if (!category) return ""
  return CATEGORY_LABELS[normalizeCategoryKey(category)] ?? ""
}

export function getValidAffiliateLink(affiliateLink: string | null | undefined): string {
  const trimmed = affiliateLink?.trim()
  if (!trimmed) return ""

  try {
    const url = new URL(trimmed)
    if (url.protocol !== "https:" && url.protocol !== "http:") return ""
    return url.toString()
  } catch {
    return ""
  }
}

export function getShopLabel(affiliateLink: string | null | undefined): string {
  const validLink = getValidAffiliateLink(affiliateLink)
  if (!validLink) return "Kaufen"

  try {
    const host = new URL(validLink).hostname.replace(/^www\./, "").toLowerCase()
    const knownLabel = SHOP_HOST_LABELS[host]
    if (knownLabel) return `Bei ${knownLabel} kaufen`

    const baseLabel = host.split(".")[0]
    if (!baseLabel) return "Kaufen"
    return `Bei ${capitalize(baseLabel)} kaufen`
  } catch {
    return "Kaufen"
  }
}

export function shouldShowAffiliateDisclosure(product: Product): boolean {
  return Boolean(getValidAffiliateLink(product.affiliate_link))
}

function isLeaveInProduct(product: Product): boolean {
  return (
    product.recommendation_meta?.category === "leave_in" ||
    isLeaveInCategory(product.category) ||
    Boolean(product.leave_in_specs)
  )
}

function getLeaveInMeta(product: Product): LeaveInRecommendationMetadata | null {
  return product.recommendation_meta?.category === "leave_in" ? product.recommendation_meta : null
}

function buildLeaveInProfileSentence(
  hasRegularHeatStyling: boolean,
  wantsShine: boolean,
  hasFineHair: boolean,
): string {
  const firstParts: string[] = []
  if (hasRegularHeatStyling) firstParts.push("Du stylst regelmäßig mit Hitze")
  if (wantsShine)
    firstParts.push(firstParts.length > 0 ? "möchtest mehr Glanz" : "Du möchtest mehr Glanz")

  if (hasFineHair) {
    if (firstParts.length > 0) {
      return `${joinGermanList(firstParts)}, während dein feines Haar schnell beschwert wirken kann. `
    }
    return "Dein feines Haar kann schnell beschwert wirken. "
  }

  return firstParts.length > 0 ? `${joinGermanList(firstParts)}. ` : ""
}

function getLeaveInProductSubject(
  categoryLabel: string,
  format: LeaveInRecommendationMetadata["product_format"] | null | undefined,
): { label: string; article: "Diese" | "Dieses" } {
  const noun = `${categoryLabel}${format ? `-${LEAVE_IN_FORMAT_LABELS[format]}` : ""}`
  const article =
    format === "lotion" || format === "cream" || format === "milk" ? "Diese" : "Dieses"
  return { label: `${article} ${noun}`, article }
}

function buildLeaveInFactPhrase(
  providesHeatProtection: boolean,
  balance: LeaveInRecommendationMetadata["product_balance_direction"] | null | undefined,
  article: "Diese" | "Dieses",
): string {
  const pronoun = article === "Diese" ? "sie" : "es"
  const carePhrase = balance ? getCarePhrase(balance) : ""

  if (providesHeatProtection && carePhrase) {
    return `, weil ${pronoun} Hitzeschutz mit ${carePhrase} verbindet`
  }
  if (providesHeatProtection) {
    return `, weil ${pronoun} Hitzeschutz bietet`
  }
  if (carePhrase) {
    return `, weil ${pronoun} ${carePhrase} mitbringt`
  }

  return ""
}

function getCarePhrase(
  balance: NonNullable<LeaveInRecommendationMetadata["product_balance_direction"]>,
): string {
  if (balance === "moisture") return "Feuchtigkeitspflege"
  if (balance === "protein") return "Proteinpflege"
  return "ausgewogener Pflege"
}

function buildFallbackProductProfileRows(product: Product): DrawerProductProfileRow[] {
  const rows: DrawerProductProfileRow[] = []
  const categoryLabel = getSafeProductCategoryLabel(product)
  const thicknessLabels = getWhitelistedLabels(
    product.suitable_thicknesses,
    THICKNESS_PROFILE_LABELS,
  )
  const concernLabels = getWhitelistedLabels(product.suitable_concerns, CONCERN_LABELS)

  if (categoryLabel) rows.push({ label: "Kategorie", value: categoryLabel })
  if (thicknessLabels.length > 0) {
    rows.push({ label: "Geeignet für", value: joinGermanList(thicknessLabels) })
  }
  if (concernLabels.length > 0) {
    rows.push({ label: "Fokus", value: concernLabels.slice(0, 3).join(", ") })
  }

  return rows
}

function buildFallbackProductMatchSummary(
  product: Product,
  hairProfile?: HairProfile | null,
): string {
  const categoryLabel = getSafeProductCategoryLabel(product)
  const subject = getProductSubject(categoryLabel)
  const description = getProductDescriptionSummary(product)
  const reasonClauses: string[] = []
  const thicknessPhrase = getThicknessSummaryPhrase(product, hairProfile)
  const concernLabels = getWhitelistedLabels(product.suitable_concerns, CONCERN_LABELS).slice(0, 2)

  if (thicknessPhrase) {
    reasonClauses.push(`es für ${thicknessPhrase} eingeordnet ist`)
  }
  if (concernLabels.length > 0) {
    reasonClauses.push(`der Fokus auf ${joinGermanList(concernLabels)} liegt`)
  }

  if (reasonClauses.length > 0) {
    const descriptionSentence = description ? ` ${ensureSentenceEnding(description)}` : ""
    return `${subject} passt, weil ${joinGermanList(reasonClauses)}.${descriptionSentence}`
  }

  if (description) {
    return `${subject} passt zu diesem Pflegeschritt. ${ensureSentenceEnding(description)}`
  }

  return categoryLabel ? `${subject} passt als ${categoryLabel} in diesen Pflegeschritt.` : ""
}

function getSafeProductCategoryLabel(product: Product): string {
  const label = getProductCategoryLabel(product.recommendation_meta?.category ?? product.category)
  if (!label || !isSafePublicText(label)) return "Produkt"
  return label
}

function getWhitelistedLabels(
  values: readonly string[] | null | undefined,
  labels: Record<string, string>,
): string[] {
  const result: string[] = []

  for (const value of values ?? []) {
    const label = labels[value]
    if (label && !result.includes(label)) result.push(label)
  }

  return result
}

function getThicknessSummaryPhrase(product: Product, hairProfile?: HairProfile | null): string {
  const suitableThicknesses = product.suitable_thicknesses ?? []
  const profileThickness = hairProfile?.thickness ?? null

  if (profileThickness && suitableThicknesses.includes(profileThickness)) {
    return THICKNESS_SUMMARY_LABELS[profileThickness] ?? ""
  }

  return getWhitelistedLabels(suitableThicknesses, THICKNESS_SUMMARY_LABELS)
    .slice(0, 2)
    .join(" oder ")
}

function getProductSubject(categoryLabel: string): string {
  if (!categoryLabel || categoryLabel === "Produkt") return "Dieses Produkt"

  const normalized = categoryLabel.toLowerCase()
  if (normalized === "conditioner" || normalized === "bondbuilder") return `Dieser ${categoryLabel}`
  if (normalized === "maske" || normalized === "tiefenreinigung") return `Diese ${categoryLabel}`
  return `Dieses ${categoryLabel}`
}

function getProductDescriptionSummary(product: Product): string {
  const rawDescription = product.short_description?.trim() || product.description?.trim() || ""
  if (!rawDescription) return ""

  const normalized = rawDescription.replace(/\s+/g, " ")
  if (!isSafePublicText(normalized)) return ""

  const firstSentence = normalized.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? normalized
  return firstSentence.length > 180 ? `${firstSentence.slice(0, 177).trim()}...` : firstSentence
}

function isSafePublicText(value: string): boolean {
  return !(
    /Score|Profil-Match|Empfehlungskontext|Shampoo-Bucket|Trade-offs|recommendation_meta|matched_profile|matched-profile|top_reasons|top-reasons|tradeoffs|trade-offs/i.test(
      value,
    ) ||
    /\b[a-z][a-z0-9_-]*:[a-z0-9_-]+\b/i.test(value) ||
    /\b[a-z]+_[a-z0-9_]*[a-z0-9]\b/i.test(value)
  )
}

function normalizeCategoryKey(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "ö")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[()]/g, "")
    .replace(/[\s_-]+/g, "-")
}

function firstLeaveInCareBenefit(
  benefits: readonly (keyof typeof CARE_BENEFIT_LABELS)[] | null | undefined,
): string | null {
  const benefit = benefits?.[0]
  return benefit ? CARE_BENEFIT_LABELS[benefit] : null
}

function getLeaveInRoleLabel(
  meta: LeaveInRecommendationMetadata | null,
  product: Product,
): string | null {
  const relationship =
    meta?.conditioner_relationship ?? product.leave_in_specs?.conditioner_relationship ?? null
  if (relationship === "booster_only") return "Booster nach dem Conditioner"
  if (relationship === "replacement_capable") return "Kann Conditioner ersetzen"

  const roles = meta?.product_roles ?? product.leave_in_specs?.roles ?? []
  if (roles.includes("extension_conditioner")) return "Booster nach dem Conditioner"
  if (roles.includes("replacement_conditioner")) return "Kann Conditioner ersetzen"
  if (roles.includes("styling_prep")) return "Styling-Vorbereitung"
  if (roles.includes("oil_replacement")) return "Öl-Ersatz"

  return null
}

function ensureSentenceEnding(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`
}

function hasFineHairOrSparseUseGuidance(value: string): boolean {
  return /feinem Haar|feines Haar|sparsam|wenig Produkt/i.test(value)
}

function joinGermanList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ""
  if (parts.length === 2) return `${parts[0]} und ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
