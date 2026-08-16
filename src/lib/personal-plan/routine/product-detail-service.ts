import { loadPersonalPlanRoutineView } from "./load-view"
import type { RoutinePayloadV1 } from "./contracts"
import type { PersonalPlanRoutineReadClient } from "./repository"

type ProductReadQuery = {
  select(columns: string): ProductReadQuery
  eq(column: string, value: string | boolean): ProductReadQuery
  maybeSingle(): Promise<{ data: unknown; error: unknown }>
}

export type RoutineProductDetailClient = PersonalPlanRoutineReadClient & {
  from(table: "products"): ProductReadQuery
}

type CommerceRow = {
  id: string
  name: string
  brand: string | null
  price_eur: number | null
  currency: string | null
  affiliate_link: string | null
  purchase_link_status: "available" | "unavailable" | null
  updated_at: string | null
}

type RoutineItem = RoutinePayloadV1["items"][number]

export type RoutineProductDetail = {
  item: RoutineItem
  commerce: {
    availabilityLabel: string
    freshnessLabel: string
    affiliateDisclosure: string | null
    priceLabel: string | null
    productUrl: string | null
  }
  fitStatusLabel: string
  frozenFitSummary: string
  limitationLabel: string | null
}

export type RoutineProductDetailResult =
  | { status: "found"; detail: RoutineProductDetail }
  | { status: "not_found" }

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) return null
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

function exactCatalogProductId(item: RoutineItem): string | null {
  if (item.product.kind === "owned" && typeof item.product.productId === "string")
    return item.product.productId
  if (item.product.kind === "planned" && typeof item.product.productId === "string")
    return item.product.productId
  return null
}

function fitLabels(
  item: RoutineItem,
): Pick<RoutineProductDetail, "fitStatusLabel" | "frozenFitSummary" | "limitationLabel"> {
  if (item.state.systemAssessment === "not_recommended") {
    return {
      fitStatusLabel: "Nicht empfohlen",
      frozenFitSummary:
        "Dieses Produkt ist in deiner Routine festgehalten, wird aber nicht empfohlen.",
      limitationLabel: "Die Bewertung basiert auf deiner bestätigten Routine.",
    }
  }
  if (item.state.fitDecision === "informed_override") {
    return {
      fitStatusLabel: "Bewusste Abweichung",
      frozenFitSummary: "Du nutzt dieses Produkt bewusst abweichend von der Empfehlung.",
      limitationLabel: "Die Bewertung basiert auf deiner bestätigten Routine.",
    }
  }
  if (item.product.kind === "owned" && !item.executable) {
    return {
      fitStatusLabel: "Noch nicht einsatzbereit",
      frozenFitSummary:
        "Das Produkt ist erfasst, aber dieser Routine-Schritt ist noch nicht zur Anwendung freigegeben.",
      limitationLabel: "Prüfe die Eignung in deiner Produktauswahl, bevor du diesen Schritt nutzt.",
    }
  }
  const optional = item.state.systemAssessment === "optional"
  const missingProduct = item.product.kind === "none"
  const pendingProduct = item.product.kind === "pending_review"
  return {
    fitStatusLabel: optional ? "Optional für deine Routine" : "Empfohlen für deine Routine",
    frozenFitSummary: optional
      ? "Dieser Schritt kann deine Routine ergänzen, ist aber nicht zwingend erforderlich."
      : "Dieser Schritt gehört zu deiner empfohlenen Routine.",
    limitationLabel: pendingProduct
      ? "Dieses Produkt wartet noch auf die Prüfung."
      : missingProduct
        ? "Für diesen Schritt ist noch kein Produkt ausgewählt."
        : null,
  }
}

function priceLabel(row: CommerceRow): string | null {
  if (typeof row.price_eur !== "number" || !Number.isFinite(row.price_eur)) return null
  const currency = row.currency === "EUR" ? "EUR" : row.currency?.trim()
  if (!currency) return null
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(row.price_eur)
  } catch {
    return null
  }
}

function freshnessLabel(updatedAt: string | null) {
  if (!updatedAt) return "Zeitpunkt der Produktdaten nicht verfügbar."
  const date = new Date(updatedAt)
  if (!Number.isFinite(date.getTime())) return "Zeitpunkt der Produktdaten nicht verfügbar."
  return `Produktdaten zuletzt aktualisiert am ${new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(date)}.`
}

function commerceFor(
  item: RoutineItem,
  product: CommerceRow | null,
): RoutineProductDetail["commerce"] {
  const productId = exactCatalogProductId(item)
  if (!productId) {
    return {
      availabilityLabel:
        item.product.kind === "none"
          ? "Noch kein Produkt ausgewählt"
          : "Noch keine Shopdaten verfügbar",
      freshnessLabel: "Es liegen keine aktuellen Produktdaten vor.",
      affiliateDisclosure: null,
      priceLabel: null,
      productUrl: null,
    }
  }
  if (!product) {
    return {
      availabilityLabel: "Aktuelle Verfügbarkeit nicht bestätigt",
      freshnessLabel: "Zu diesem Produkt liegen derzeit keine aktuellen Shopdaten vor.",
      affiliateDisclosure: null,
      priceLabel: null,
      productUrl: null,
    }
  }
  const productUrl =
    product.purchase_link_status === "available" ? safeHttpUrl(product.affiliate_link) : null
  const availabilityLabel =
    product.purchase_link_status === "unavailable"
      ? "Derzeit nicht verfügbar"
      : product.purchase_link_status === "available" && productUrl
        ? "Aktuell verfügbar"
        : product.purchase_link_status === "available"
          ? "Derzeit kein verifizierter Produktlink"
          : "Aktuelle Verfügbarkeit nicht bestätigt"
  return {
    availabilityLabel,
    freshnessLabel: freshnessLabel(product.updated_at),
    affiliateDisclosure: productUrl
      ? "Affiliate-Hinweis: Bei einem Kauf über diesen Link erhalten wir möglicherweise eine Provision."
      : null,
    priceLabel: priceLabel(product),
    productUrl,
  }
}

async function loadActiveCatalogProduct(
  client: RoutineProductDetailClient,
  productId: string | null,
  planned: boolean,
): Promise<CommerceRow | null> {
  if (!productId) return null
  let query = client
    .from("products")
    .select(
      "id, name, brand, price_eur, currency, affiliate_link, purchase_link_status, updated_at",
    )
    .eq("id", productId)
    .eq("is_active", true)
  if (planned) {
    query = query.eq("lifecycle_status", "active").eq("is_chaarlie_recommended", true)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data as CommerceRow | null
}

export function createRoutineProductDetailService(input: { client: RoutineProductDetailClient }) {
  return {
    async load(request: {
      userId: string
      itemKey: string
      enabled: boolean
    }): Promise<RoutineProductDetailResult> {
      const view = await loadPersonalPlanRoutineView({
        client: input.client,
        userId: request.userId,
        enabled: request.enabled,
      })
      if (view.status === "no_personal_plan") return { status: "not_found" }
      const payload = view.activeVersion?.payload ?? view.pendingProposal?.candidate
      const item = payload?.items.find((candidate) => candidate.itemKey === request.itemKey)
      if (!item) return { status: "not_found" }
      const product = await loadActiveCatalogProduct(
        input.client,
        exactCatalogProductId(item),
        item.product.kind === "planned",
      )
      return {
        status: "found",
        detail: {
          item,
          commerce: commerceFor(item, product),
          ...fitLabels(item),
        },
      }
    },
  }
}
