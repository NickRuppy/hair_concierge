import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ERR_INVALID_DATA, ERR_UNAUTHORIZED } from "@/lib/vocabulary"
import { isProductIntakeEnabled } from "@/lib/product-intake/config"
import {
  chatProductIntakeSubmissionSchema,
  onboardingProductIntakeCancelSchema,
  onboardingProductIntakeSubmissionSchema,
} from "@/lib/product-intake/schemas"
import {
  cancelProductIntakeUsage,
  ProductIntakeConflictError,
  ProductIntakeOwnershipError,
  submitProductIntake,
  type ProductIntakeRepository,
} from "@/lib/product-intake/submissions"
import { createSupabaseProductIntakeRepository } from "@/lib/product-intake/repository"
import { ProductIntakeUserInputError } from "@/lib/product-intake/errors"

type ProductIntakeRouteSource = "onboarding" | "chat"

type ProductIntakePostHandlerDeps = {
  createServerClient?: typeof createClient
  createAdminClient?: typeof createAdminClient
  isEnabled?: () => boolean
  createRepository?: (admin: ReturnType<typeof createAdminClient>) => ProductIntakeRepository
}

const DISABLED_RESPONSE = {
  error: "Produktaufnahme ist aktuell deaktiviert.",
  code: "product_intake_disabled",
}

export function createProductIntakePostHandler(
  source: ProductIntakeRouteSource,
  overrides: ProductIntakePostHandlerDeps = {},
) {
  const deps = {
    createServerClient: createClient,
    createAdminClient,
    isEnabled: isProductIntakeEnabled,
    createRepository: createSupabaseProductIntakeRepository,
    ...overrides,
  }

  return async function productIntakePostHandler(request: Request) {
    if (!deps.isEnabled()) {
      return NextResponse.json(DISABLED_RESPONSE, { status: 503 })
    }

    const supabase = await deps.createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
    }

    const body = await request.json()
    const schema =
      source === "chat"
        ? chatProductIntakeSubmissionSchema
        : onboardingProductIntakeSubmissionSchema
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = deps.createAdminClient()
    const repository = deps.createRepository(admin)

    try {
      const result = await submitProductIntake({
        userId: user.id,
        source,
        input: parsed.data,
        repository,
      })

      return NextResponse.json(result, { status: result.status === "matched" ? 200 : 202 })
    } catch (error) {
      if (error instanceof ProductIntakeConflictError) {
        return NextResponse.json(
          {
            error: error.message,
            code: "product_category_already_filled",
            category: error.category,
            existing_usage_id: error.existingUsageId,
          },
          { status: 409 },
        )
      }

      if (error instanceof ProductIntakeOwnershipError) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }

      if (error instanceof ProductIntakeUserInputError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        )
      }

      console.error("[product-intake] submission failed", error)
      return NextResponse.json(
        { error: "Produkt konnte nicht gespeichert werden." },
        { status: 500 },
      )
    }
  }
}

export function createProductIntakeCancelHandler(overrides: ProductIntakePostHandlerDeps = {}) {
  const deps = {
    createServerClient: createClient,
    createAdminClient,
    isEnabled: isProductIntakeEnabled,
    createRepository: createSupabaseProductIntakeRepository,
    ...overrides,
  }

  return async function productIntakeCancelHandler(request: Request) {
    if (!deps.isEnabled()) {
      return NextResponse.json(DISABLED_RESPONSE, { status: 503 })
    }

    const supabase = await deps.createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: ERR_UNAUTHORIZED }, { status: 401 })
    }

    const body = await request.json()
    const parsed = onboardingProductIntakeCancelSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: ERR_INVALID_DATA, details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = deps.createAdminClient()
    const repository = deps.createRepository(admin)

    try {
      const cancelled = []
      for (const category of parsed.data.categories) {
        cancelled.push(
          await cancelProductIntakeUsage({
            userId: user.id,
            category,
            repository,
          }),
        )
      }

      return NextResponse.json({ cancelled }, { status: 200 })
    } catch (error) {
      console.error("[product-intake] usage cancellation failed", error)
      return NextResponse.json({ error: "Produkt konnte nicht entfernt werden." }, { status: 500 })
    }
  }
}
