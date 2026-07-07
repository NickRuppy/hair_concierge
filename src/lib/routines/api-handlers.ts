import { PRODUCT_CATEGORY_ORDER } from "@/lib/onboarding/product-options"
import { isProductEligibleForMode } from "@/lib/product-catalog/eligibility"
import { isUnselectedShampooFallbackItem } from "@/lib/product-usage/shampoo-fallback"
import type { RoutineArtifactData, RoutineUiShape } from "@/lib/routines/types"
import type { ProductUsageMatchStatus } from "@/lib/types"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"
import { normalizeProductFrequency, PRODUCT_FREQUENCIES } from "@/lib/vocabulary/frequencies"

type AuthUser = { id: string }

type SupabaseClientLike = {
  auth: {
    getUser(): Promise<{ data: { user: AuthUser | null }; error?: { message?: string } | null }>
  }
  from(table: string): unknown
}

type QueryResult<T = unknown> = {
  data: T | null
  error: { message?: string } | null
}

type SupabaseTableQuery = {
  select(columns: string): SupabaseTableQuery
  eq(column: string, value: unknown): SupabaseTableQuery
  order(column: string, options?: unknown): Promise<QueryResult<unknown[]>>
  maybeSingle(): Promise<QueryResult<unknown>>
  single(): Promise<QueryResult<unknown>>
  update(payload: Record<string, unknown>): SupabaseTableQuery
  delete(): SupabaseTableQuery
  insert(payload: Record<string, unknown>): SupabaseTableQuery
}

type ApiResult<TBody extends Record<string, unknown>> = {
  status: number
  body: TBody
}

type RoutineApiDeps = {
  createClient: () => Promise<unknown>
  loadRoutineArtifactData: (params: { userId: string }) => Promise<RoutineArtifactData>
  shapeRoutineForUi: RoutineApiShapeFunction
  createDismissal: (params: {
    client: never
    userId: string
    category: string
  }) => Promise<Record<string, unknown>>
}

export type RoutineApiShapeFunction = (input: {
  hairProfile: RoutineArtifactData["hairProfile"]
  usageRows: RoutineArtifactData["usageRows"]
  careBalanceRows: RoutineArtifactData["runtime"]["careBalance"]["rows"]
  pendingSubmissionsById: RoutineArtifactData["pendingSubmissionsById"]
  activeDismissedCategories?: RoutineArtifactData["activeDismissedCategories"]
}) => RoutineUiShape | Record<string, unknown>

type ProductRow = {
  id: string
  category: string | null
  name: string | null
  brand: string | null
  is_active: boolean | null
  lifecycle_status: string | null
  is_chaarlie_recommended: boolean | null
}

type UsageRow = {
  id: string
  user_id: string
  category: string
  product_name: string | null
  brand_text?: string | null
  frequency_range: ProductFrequency | string | null
  product_id: string | null
  product_submission_id?: string | null
  match_status: ProductUsageMatchStatus | null
  front_image_path?: string | null
  intake_method?: string | null
  source?: string | null
}

type AddProductRequest = {
  category?: unknown
  productId?: unknown
  replaceUsageId?: unknown
  confirmReplace?: unknown
}

const PRODUCT_SELECT =
  "id, category, name, brand, is_active, lifecycle_status, is_chaarlie_recommended"
const VALID_CATEGORIES = new Set<string>(PRODUCT_CATEGORY_ORDER)
const VALID_PRODUCT_FREQUENCIES = new Set<string>(PRODUCT_FREQUENCIES)

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function json<TBody extends Record<string, unknown>>(body: TBody, status = 200): ApiResult<TBody> {
  return { status, body }
}

function asRoutineClient(client: unknown): SupabaseClientLike {
  return client as SupabaseClientLike
}

function table(client: SupabaseClientLike, name: string): SupabaseTableQuery {
  return client.from(name) as SupabaseTableQuery
}

async function requireUser(
  client: SupabaseClientLike,
): Promise<ApiResult<{ error: string }> | AuthUser> {
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) {
    return json({ error: "Nicht angemeldet." }, 401)
  }

  return user
}

function shapeRoutine(data: RoutineArtifactData, shapeRoutineForUi: RoutineApiShapeFunction) {
  return shapeRoutineForUi({
    hairProfile: data.hairProfile,
    usageRows: data.usageRows,
    careBalanceRows: data.runtime.careBalance.rows,
    pendingSubmissionsById: data.pendingSubmissionsById,
    activeDismissedCategories: data.activeDismissedCategories,
  })
}

function validateCategory(category: unknown): string | ApiResult<{ error: string }> {
  if (typeof category !== "string" || !VALID_CATEGORIES.has(category)) {
    return json({ error: "Ungültige Produktkategorie." }, 400)
  }
  return category
}

function visibleUsageRows(rows: UsageRow[]): UsageRow[] {
  return rows.filter((row) => !isUnselectedShampooFallbackItem(row))
}

async function loadCategoryUsageRows(
  client: SupabaseClientLike,
  userId: string,
  category: string,
): Promise<UsageRow[]> {
  const { data, error } = await table(client, "user_product_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("category", category)
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(`load category usage rows: ${error.message ?? "unknown error"}`)
  }

  return Array.isArray(data) ? (data as UsageRow[]) : []
}

async function loadOwnedProductIds(
  client: SupabaseClientLike,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await (table(client, "user_product_usage")
    .select("product_id")
    .eq("user_id", userId)
    .eq("match_status", "matched") as unknown as Promise<QueryResult<unknown[]>>)

  if (error) {
    throw new Error(`load owned product ids: ${error.message ?? "unknown error"}`)
  }

  return new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => (isObject(row) && typeof row.product_id === "string" ? row.product_id : null))
      .filter((id): id is string => Boolean(id)),
  )
}

async function loadProduct(
  client: SupabaseClientLike,
  productId: string,
): Promise<ProductRow | null> {
  const { data, error } = await table(client, "products")
    .select(PRODUCT_SELECT)
    .eq("id", productId)
    .maybeSingle()

  if (error) {
    throw new Error(`load routine product: ${error.message ?? "unknown error"}`)
  }

  return data as ProductRow | null
}

function preferredFrequencyForCategory(
  data: RoutineArtifactData,
  category: string,
): ProductFrequency | null {
  const row = data.runtime.careBalance.rows.find((candidate) => candidate.category === category)
  return row?.frequencyTarget?.preferredFrequency ?? null
}

function productPayload(product: ProductRow) {
  return {
    product_id: product.id,
    product_name: product.name,
    brand_text: product.brand,
    product_submission_id: null,
    front_image_path: null,
    match_status: "matched",
    intake_method: "manual",
    source: "profile",
  }
}

export function createRoutineApiHandlers(deps: RoutineApiDeps) {
  return {
    async getRoutine() {
      const client = asRoutineClient(await deps.createClient())
      const user = await requireUser(client)
      if ("status" in user) return user

      const data = await deps.loadRoutineArtifactData({ userId: user.id })
      return json({ routine: shapeRoutine(data, deps.shapeRoutineForUi) })
    },

    async patchProduct(
      usageId: string,
      body: { frequency_range?: unknown },
    ): Promise<ApiResult<Record<string, unknown>>> {
      const client = asRoutineClient(await deps.createClient())
      const user = await requireUser(client)
      if ("status" in user) return user

      if (!VALID_PRODUCT_FREQUENCIES.has(String(body.frequency_range))) {
        return json({ error: "Ungültige Nutzungsfrequenz." }, 400)
      }

      const frequency = normalizeProductFrequency(String(body.frequency_range))
      if (!frequency) {
        return json({ error: "Ungültige Nutzungsfrequenz." }, 400)
      }

      const { data, error } = await table(client, "user_product_usage")
        .update({ frequency_range: frequency })
        .eq("id", usageId)
        .eq("user_id", user.id)
        .select("*")
        .maybeSingle()

      if (error)
        throw new Error(`update routine product usage: ${error.message ?? "unknown error"}`)
      if (!data) return json({ error: "Produkt wurde nicht gefunden." }, 404)

      return json({ usage: data as Record<string, unknown> })
    },

    async deleteProduct(usageId: string): Promise<ApiResult<Record<string, unknown>>> {
      const client = asRoutineClient(await deps.createClient())
      const user = await requireUser(client)
      if ("status" in user) return user

      const { data, error } = await table(client, "user_product_usage")
        .delete()
        .eq("id", usageId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle()

      if (error)
        throw new Error(`delete routine product usage: ${error.message ?? "unknown error"}`)
      if (!data) return json({ error: "Produkt wurde nicht gefunden." }, 404)

      return json({ success: true })
    },

    async dismissSuggestion(categoryParam: string): Promise<ApiResult<Record<string, unknown>>> {
      const client = asRoutineClient(await deps.createClient())
      const user = await requireUser(client)
      if ("status" in user) return user

      const category = validateCategory(categoryParam)
      if (typeof category !== "string") return category

      const dismissal = await deps.createDismissal({
        client: client as never,
        userId: user.id,
        category,
      })
      return json({ dismissal })
    },

    async addProduct(body: AddProductRequest): Promise<ApiResult<Record<string, unknown>>> {
      const client = asRoutineClient(await deps.createClient())
      const user = await requireUser(client)
      if ("status" in user) return user

      const category = validateCategory(body.category)
      if (typeof category !== "string") return category

      if (typeof body.productId !== "string" || !body.productId.trim()) {
        return json({ error: "Produkt fehlt." }, 400)
      }

      const [product, ownedProductIds, categoryRows, routineData] = await Promise.all([
        loadProduct(client, body.productId),
        loadOwnedProductIds(client, user.id),
        loadCategoryUsageRows(client, user.id, category),
        deps.loadRoutineArtifactData({ userId: user.id }),
      ])

      if (!product) {
        return json({ error: "Produkt wurde nicht gefunden." }, 404)
      }

      if (product.category !== category) {
        return json({ error: "Produkt passt nicht zu dieser Kategorie." }, 422)
      }

      const eligible =
        isProductEligibleForMode(product, "general_recommendation") ||
        isProductEligibleForMode(product, "owned_assessment", {
          ownedProductIds,
          hasVerifiedSpecs: ownedProductIds.has(product.id),
        })

      if (!eligible) {
        return json({ error: "Dieses Produkt kann hier nicht ausgewählt werden." }, 422)
      }

      const visibleRows = visibleUsageRows(categoryRows)
      const replaceUsageId =
        typeof body.replaceUsageId === "string" && body.replaceUsageId.trim()
          ? body.replaceUsageId
          : null
      const replacementRow = replaceUsageId
        ? (visibleRows.find((row) => row.id === replaceUsageId) ?? null)
        : null

      if (body.confirmReplace === true && !replaceUsageId) {
        return json({ error: "Zu ersetzendes Produkt fehlt." }, 400)
      }

      if (replaceUsageId && body.confirmReplace !== true) {
        return json({ error: "Ersetzen muss bestätigt werden." }, 400)
      }

      if (replaceUsageId && !replacementRow) {
        return json({ error: "Zu ersetzendes Produkt wurde nicht gefunden." }, 404)
      }

      if (visibleRows.length > 0 && !replaceUsageId && body.confirmReplace !== true) {
        return json(
          { error: "Diese Kategorie ist bereits belegt.", existingUsageId: visibleRows[0]?.id },
          409,
        )
      }

      if (replacementRow) {
        const { data, error } = await table(client, "user_product_usage")
          .update(productPayload(product))
          .eq("id", replacementRow.id)
          .eq("user_id", user.id)
          .select("*")
          .maybeSingle()

        if (error)
          throw new Error(`replace routine product usage: ${error.message ?? "unknown error"}`)
        if (!data) return json({ error: "Zu ersetzendes Produkt wurde nicht gefunden." }, 404)
        return json({ usage: data as Record<string, unknown> })
      }

      const frequency = preferredFrequencyForCategory(routineData, category)
      if (!frequency) {
        return json({ error: "Für diese Kategorie fehlt ein Frequenzziel." }, 422)
      }

      const { data, error } = await table(client, "user_product_usage")
        .insert({
          user_id: user.id,
          category,
          ...productPayload(product),
          frequency_range: frequency,
        })
        .select("*")
        .single()

      if (error) throw new Error(`add routine product usage: ${error.message ?? "unknown error"}`)

      return json({ usage: data as Record<string, unknown> }, 201)
    },
  }
}
