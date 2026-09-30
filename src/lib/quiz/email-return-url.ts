import { SITE_ORIGIN } from "@/lib/seo/site-identity"
import { isValidQuizEmailReturnCredential } from "./email-return-credential"

/** Format only an already-issued credential; this function never issues links. */
export function formatQuizEmailReturnUrl(token: string, origin = SITE_ORIGIN): string {
  if (!isValidQuizEmailReturnCredential(token)) throw new Error("Invalid quiz return token")
  const base = new URL(origin)
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("Quiz return links require a clean HTTPS origin")
  }
  const url = new URL("/quiz/return", base.origin)
  url.searchParams.set("token", token)
  return url.toString()
}
