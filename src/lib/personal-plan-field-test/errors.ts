export const PERSONAL_PLAN_FIELD_TEST_UNAVAILABLE_CODE = "field_test_unavailable" as const

export type PersonalPlanFieldTestUnavailable = {
  kind: "unavailable"
  code: typeof PERSONAL_PLAN_FIELD_TEST_UNAVAILABLE_CODE
}

export const personalPlanFieldTestUnavailable = (): PersonalPlanFieldTestUnavailable => ({
  kind: "unavailable",
  code: PERSONAL_PLAN_FIELD_TEST_UNAVAILABLE_CODE,
})

export function isMissingPersonalPlanFieldTestRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === "string" ? candidate.code : ""
  const message = typeof candidate.message === "string" ? candidate.message : ""
  return (
    (code === "PGRST205" || code === "42P01") && message.includes("personal_plan_test_enrollments")
  )
}
