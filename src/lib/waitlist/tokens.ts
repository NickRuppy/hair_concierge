import { createHash } from "node:crypto"

export function hashWaitlistSurveyToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}
