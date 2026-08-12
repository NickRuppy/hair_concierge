import "server-only"

import { APPLICATION_DAY_TYPE_KEYS, applicationGuidanceProtocolSchema } from "./contracts"
import { applicationFamilyTemplateV2Schema, type ApplicationFamilyTemplateV2 } from "./contracts-v2"
import type { ApplicationGuidanceProtocolV1 } from "./contracts"
import type { PersonalPlanStage5ContractVersion } from "@/lib/personal-plan/stage5-rollout"
import { createAdminClient } from "@/lib/supabase/admin"

type QueryError = { message?: string }

type QueryResult<T> = {
  data: T | null
  error: QueryError | null
}

export type ApplicationContentQuery = {
  select(columns: string): ApplicationContentQuery
  eq(column: string, value: unknown): ApplicationContentQuery
  order(column: string, options?: { ascending?: boolean }): PromiseLike<QueryResult<unknown[]>>
}

export type ApplicationContentQueryClient = {
  from(
    table: "application_day_type_definitions" | "application_guidance_protocols",
  ): ApplicationContentQuery
}

type ApplicationDayTypeDefinitionRow = {
  day_type_key: string
  definition_version: number
  locale: string
  label: string
  summary: string
  sort_order: number
  status: string
}

type ApplicationGuidanceProtocolRow = {
  id: string
  guidance_key: string
  protocol_version: number
  locale: string
  scope_kind: string
  category_key: string
  role_key: string | null
  product_id: string | null
  application_family: string
  contract_version: number
  payload: unknown
  status: string
  verified_at: string | null
}

export type ApplicationDayTypeDefinition = {
  key: (typeof APPLICATION_DAY_TYPE_KEYS)[number]
  definitionVersion: number
  locale: "de"
  label: string
  summary: string
  sortOrder: number
}

export type ApplicationGuidanceProtocol = {
  id: string
  guidanceKey: string
  protocolVersion: number
  locale: "de"
  scopeKind: "application_family" | "product"
  categoryKey: string
  roleKey: string | null
  productId: string | null
  applicationFamily: string
  payload: ApplicationGuidanceProtocolV1 | ApplicationFamilyTemplateV2
  verifiedAt: string | null
}

const DAY_TYPE_DEFINITION_SELECT =
  "day_type_key, definition_version, locale, label, summary, sort_order, status"
const GUIDANCE_PROTOCOL_SELECT =
  "id, guidance_key, protocol_version, locale, scope_kind, category_key, role_key, product_id, application_family, contract_version, payload, status, verified_at"

function queryError(table: string, error: QueryError | null): Error {
  return new Error(
    `application guidance ${table} query failed: ${error?.message ?? "unknown error"}`,
  )
}

function invalidRow(table: string, key: string): Error {
  return new Error(`invalid ${table} row ${key}`)
}

function parseDayTypeDefinition(
  row: ApplicationDayTypeDefinitionRow,
): ApplicationDayTypeDefinition {
  if (
    row.status !== "active" ||
    row.locale !== "de" ||
    !APPLICATION_DAY_TYPE_KEYS.includes(
      row.day_type_key as (typeof APPLICATION_DAY_TYPE_KEYS)[number],
    ) ||
    !Number.isInteger(row.definition_version) ||
    row.definition_version < 1 ||
    !Number.isInteger(row.sort_order) ||
    row.sort_order < 1 ||
    !row.label ||
    !row.summary
  ) {
    throw invalidRow("application day type definition", row.day_type_key)
  }

  return {
    key: row.day_type_key as (typeof APPLICATION_DAY_TYPE_KEYS)[number],
    definitionVersion: row.definition_version,
    locale: "de",
    label: row.label,
    summary: row.summary,
    sortOrder: row.sort_order,
  }
}

function parseGuidanceProtocol(
  row: ApplicationGuidanceProtocolRow,
  contractVersion: PersonalPlanStage5ContractVersion,
): ApplicationGuidanceProtocol {
  if (row.status !== "active" || row.locale !== "de" || row.contract_version !== contractVersion) {
    throw invalidRow("application guidance protocol", row.guidance_key)
  }
  if (row.verified_at === null) {
    throw new Error(`active application guidance protocol ${row.guidance_key} is not verified`)
  }

  const parsed =
    contractVersion === 1
      ? applicationGuidanceProtocolSchema.safeParse(row.payload)
      : applicationFamilyTemplateV2Schema.safeParse(row.payload)
  if (!parsed.success) {
    throw new Error(`invalid application guidance protocol ${row.guidance_key}`)
  }

  const protocol = parsed.data
  if (
    protocol.guidanceKey !== row.guidance_key ||
    protocol.protocolVersion !== row.protocol_version ||
    protocol.locale !== row.locale ||
    protocol.scope.kind !== row.scope_kind ||
    protocol.scope.category !== row.category_key ||
    protocol.role !== row.role_key ||
    protocol.applicationFamily !== row.application_family ||
    (protocol.scope.kind === "product" ? protocol.scope.productId : null) !== row.product_id
  ) {
    throw new Error(
      `application guidance protocol ${row.guidance_key} does not match its indexed columns`,
    )
  }

  return {
    id: row.id,
    guidanceKey: row.guidance_key,
    protocolVersion: row.protocol_version,
    locale: "de",
    scopeKind: row.scope_kind as "application_family" | "product",
    categoryKey: row.category_key,
    roleKey: row.role_key,
    productId: row.product_id,
    applicationFamily: row.application_family,
    payload: protocol,
    verifiedAt: row.verified_at,
  }
}

export function createApplicationGuidanceRepository(
  client: ApplicationContentQueryClient,
  options: { contractVersion: PersonalPlanStage5ContractVersion } = { contractVersion: 1 },
) {
  return {
    async loadActiveDayTypeDefinitions(): Promise<ApplicationDayTypeDefinition[]> {
      const result = (await client
        .from("application_day_type_definitions")
        .select(DAY_TYPE_DEFINITION_SELECT)
        .eq("status", "active")
        .eq("locale", "de")
        .order("sort_order", { ascending: true })) as QueryResult<ApplicationDayTypeDefinitionRow[]>

      if (result.error) throw queryError("application_day_type_definitions", result.error)
      return (result.data ?? []).map(parseDayTypeDefinition)
    },

    async loadActiveGuidanceProtocols(): Promise<ApplicationGuidanceProtocol[]> {
      const result = (await client
        .from("application_guidance_protocols")
        .select(GUIDANCE_PROTOCOL_SELECT)
        .eq("status", "active")
        .eq("locale", "de")
        .eq("contract_version", options.contractVersion)
        .order("guidance_key", { ascending: true })) as QueryResult<
        ApplicationGuidanceProtocolRow[]
      >

      if (result.error) throw queryError("application_guidance_protocols", result.error)
      return (result.data ?? []).map((row) => parseGuidanceProtocol(row, options.contractVersion))
    },
  }
}

export function createServerApplicationGuidanceRepository(
  contractVersion: PersonalPlanStage5ContractVersion,
) {
  return createApplicationGuidanceRepository(
    createAdminClient() as unknown as ApplicationContentQueryClient,
    { contractVersion },
  )
}
