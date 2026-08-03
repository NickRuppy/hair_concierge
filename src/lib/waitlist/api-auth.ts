import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Compare a cron Bearer token without leaking token length or prefix matches.
 * Hashing first keeps `timingSafeEqual`'s inputs a fixed size even for malformed
 * credentials.
 */
export function waitlistCronBearerMatches(
  authorization: string | null,
  expectedSecret: string | undefined,
  compare: (left: Buffer, right: Buffer) => boolean = timingSafeEqual,
): boolean {
  if (!expectedSecret) return false

  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : ""
  try {
    return compare(digest(token), digest(expectedSecret))
  } catch {
    return false
  }
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest()
}
