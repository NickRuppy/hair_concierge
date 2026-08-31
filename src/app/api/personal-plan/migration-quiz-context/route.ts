import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import {
  decodeMigrationQuizContextCookie,
  MIGRATION_QUIZ_COOKIE,
} from "@/lib/personal-plan/migration-quiz-context"
import {
  isPersonalPlanLegacyMigrationEnabled,
  resolvePersonalPlanMigrationAdmission,
  type PersonalPlanMigrationAdmissionClient,
} from "@/lib/personal-plan/migration-admission"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { normalizeMigrationQuizPrefillAnswers } from "@/lib/quiz/migration-prefill-init"
import type { QuizAnswers } from "@/lib/quiz/types"

type CookieStore = {
  get: (name: string) => { value: string } | undefined
}

type SessionClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error?: unknown }>
  }
}

type SupabaseQueryClient = PersonalPlanMigrationAdmissionClient & {
  from: (table: string) => unknown
}

export type MigrationQuizContextGetDependencies = {
  cookies: () => Promise<CookieStore>
  createClient: () => Promise<SessionClient>
  createAdminClient: () => SupabaseQueryClient
  cookieSecret: () => string | null
  now: () => number
  migrationEnabled: () => boolean
}

const defaultDependencies: MigrationQuizContextGetDependencies = {
  cookies,
  createClient,
  createAdminClient,
  cookieSecret: () => process.env.FUNNEL_COOKIE_SIGNING_SECRET ?? null,
  now: () => Date.now(),
  migrationEnabled: () => isPersonalPlanLegacyMigrationEnabled(),
}

export function createMigrationQuizContextGetHandler(
  overrides: Partial<MigrationQuizContextGetDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides }

  return async function GET() {
    const cookieStore = await dependencies.cookies()
    const cookieValue = cookieStore.get(MIGRATION_QUIZ_COOKIE)?.value
    if (!cookieValue) return response({ status: "recover" })

    const session = await dependencies.createClient()
    const {
      data: { user },
    } = await session.auth.getUser()
    if (!user?.id) return response({ status: "recover" })

    const context = decodeMigrationQuizContextCookie(cookieValue, dependencies.cookieSecret(), {
      userId: user.id,
      now: dependencies.now(),
    })
    if (!context) return response({ status: "recover" })
    if (!dependencies.migrationEnabled()) return response({ status: "recover" })

    try {
      const prefill = await loadMigrationQuizPrefill({
        client: dependencies.createAdminClient(),
        userId: user.id,
        enrollmentId: context.enrollmentId,
      })
      return response(prefill)
    } catch (error) {
      console.warn("Migration quiz context lookup failed:", error)
      return response({ status: "unavailable" })
    }
  }
}

export const GET = createMigrationQuizContextGetHandler()

export type MigrationQuizContextResponse =
  | { status: "recover" }
  | { status: "unavailable" }
  | { status: "fresh_blank" }
  | { status: "prefill"; answers: QuizAnswers }

async function loadMigrationQuizPrefill(input: {
  client: SupabaseQueryClient
  userId: string
  enrollmentId: string
}): Promise<MigrationQuizContextResponse> {
  const admission = await resolvePersonalPlanMigrationAdmission({
    client: input.client,
    userId: input.userId,
    release: { legacyMigrationEnabled: () => true },
  })

  if (admission.status === "pending_source") {
    return admission.enrollmentId === input.enrollmentId
      ? { status: "fresh_blank" }
      : { status: "recover" }
  }
  if (admission.status !== "ready" || admission.enrollmentId !== input.enrollmentId) {
    return { status: "recover" }
  }

  if (await sourceWasAlreadyUsed(input.client, input.userId, input.enrollmentId)) {
    return { status: "recover" }
  }

  if (admission.quizSourceKind === "personal_plan") {
    return { status: "fresh_blank" }
  }

  const lead = await loadBoundLegacyLead(input.client, {
    leadId: admission.leadId,
    userId: input.userId,
  })
  if (!lead) return { status: "recover" }

  return {
    status: "prefill",
    answers: normalizeMigrationQuizPrefillAnswers(lead.quiz_answers),
  }
}

async function sourceWasAlreadyUsed(
  client: SupabaseQueryClient,
  userId: string,
  enrollmentId: string,
): Promise<boolean> {
  const query = client.from("personal_plans") as {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{ data: unknown | null; error: unknown | null }>
        }
      }
    }
  }
  const { data, error } = await query
    .select("id, current_initial_need_version_id")
    .eq("user_id", userId)
    .eq("enrollment_purchase_source_id", enrollmentId)
    .maybeSingle()
  if (error) throw error
  if (!data || typeof data !== "object") return false
  return typeof (data as Record<string, unknown>).current_initial_need_version_id === "string"
}

async function loadBoundLegacyLead(
  client: SupabaseQueryClient,
  input: { leadId: string; userId: string },
): Promise<{ quiz_answers: Record<string, unknown> } | null> {
  const query = client.from("leads") as {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{ data: unknown | null; error: unknown | null }>
        }
      }
    }
  }
  const { data, error } = await query
    .select("id, user_id, quiz_kind, quiz_answers")
    .eq("id", input.leadId)
    .eq("user_id", input.userId)
    .maybeSingle()
  if (error) throw error
  if (!data || typeof data !== "object") return null
  const row = data as Record<string, unknown>
  if (row.quiz_kind !== "legacy") return null
  if (
    !row.quiz_answers ||
    typeof row.quiz_answers !== "object" ||
    Array.isArray(row.quiz_answers)
  ) {
    return null
  }
  return { quiz_answers: row.quiz_answers as Record<string, unknown> }
}

function response(body: MigrationQuizContextResponse) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
  })
}
