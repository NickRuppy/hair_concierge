import { presentCatalogCommerce, type CatalogCommerceFacts } from "./commerce"
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
    // Null when availability is simply unknown — the sheet stays quiet instead
    // of announcing an unconfirmed status.
    availabilityLabel: string | null
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

function toCommerceFacts(row: CommerceRow): CatalogCommerceFacts {
  return {
    priceEur: row.price_eur,
    currency: row.currency,
    affiliateLink: row.affiliate_link,
    purchaseLinkStatus: row.purchase_link_status,
    updatedAt: row.updated_at,
  }
}

function commerceFor(
  item: RoutineItem,
  product: CommerceRow | null,
): RoutineProductDetail["commerce"] {
  const productId = exactCatalogProductId(item)
  if (!productId) {
    return {
      availabilityLabel: item.product.kind === "none" ? "Noch kein Produkt ausgewählt" : null,
      freshnessLabel: "Es liegen keine aktuellen Produktdaten vor.",
      affiliateDisclosure: null,
      priceLabel: null,
      productUrl: null,
    }
  }
  return presentCatalogCommerce(product ? toCommerceFacts(product) : null)
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
