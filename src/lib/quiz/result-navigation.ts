type SearchParamValue = string | string[] | null | undefined

const DEFAULT_RETAKE_RETURN_TO = "/profile"
const WHITESPACE = /\s/u

export function getQuizResultSearchParamValue(value: SearchParamValue): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

function isSafeLocalReturnTo(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !WHITESPACE.test(value)
  )
}

export function resolveQuizResultRetakeReturnTo(
  mode: SearchParamValue,
  returnTo: SearchParamValue,
): string | null {
  if (getQuizResultSearchParamValue(mode) !== "retake") {
    return null
  }

  const candidate = getQuizResultSearchParamValue(returnTo)
  return candidate && isSafeLocalReturnTo(candidate) ? candidate : DEFAULT_RETAKE_RETURN_TO
}

export function buildQuizResultPath({
  leadId,
  mode,
  returnTo,
}: {
  leadId: string
  mode?: SearchParamValue
  returnTo?: SearchParamValue
}): string {
  const resultPath = `/result/${encodeURIComponent(leadId)}?entry=quiz_completion`
  const retakeReturnTo = resolveQuizResultRetakeReturnTo(mode, returnTo)

  if (!retakeReturnTo) {
    return resultPath
  }

  return `${resultPath}&mode=retake&returnTo=${encodeURIComponent(retakeReturnTo)}`
}

export function buildQuizResultOnboardingPath({
  leadId,
  returnTo,
}: {
  leadId: string
  returnTo?: string | null
}): string {
  const onboardingPath = `/onboarding?lead=${encodeURIComponent(leadId)}`

  if (!returnTo || !isSafeLocalReturnTo(returnTo)) {
    return onboardingPath
  }

  return `${onboardingPath}&returnTo=${encodeURIComponent(returnTo)}`
}
