export const WAITLIST_SURVEY_ACCESS_COOKIE = "chaarlie_waitlist_survey_access"
export const WAITLIST_SURVEY_ACCESS_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

const SURVEY_TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/

export const waitlistSurveyAccessCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/api/waitlist/survey",
  maxAge: WAITLIST_SURVEY_ACCESS_MAX_AGE_SECONDS,
}

export function parseWaitlistSurveyAccessTokenHash(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized && SURVEY_TOKEN_HASH_PATTERN.test(normalized) ? normalized : null
}

export function readWaitlistSurveyAccessCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=")
    if (separator === -1) continue
    const name = part.slice(0, separator).trim()
    if (name !== WAITLIST_SURVEY_ACCESS_COOKIE) continue
    try {
      return parseWaitlistSurveyAccessTokenHash(
        decodeURIComponent(part.slice(separator + 1).trim()),
      )
    } catch {
      return null
    }
  }
  return null
}
