export const PERSONAL_PLAN_FIELD_TEST_UNAVAILABLE_CODE = "field_test_unavailable" as const

export type PersonalPlanFieldTestUnavailable = {
  kind: "unavailable"
  code: typeof PERSONAL_PLAN_FIELD_TEST_UNAVAILABLE_CODE
}

export const personalPlanFieldTestUnavailable = (): PersonalPlanFieldTestUnavailable => ({
  kind: "unavailable",
  code: PERSONAL_PLAN_FIELD_TEST_UNAVAILABLE_CODE,
})
