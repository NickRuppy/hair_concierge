import { createAdminClient } from "@/lib/supabase/admin"
import { completionResult } from "@/lib/mobile/registration-http"
import { mobileBody, mobileJSON, requireMobileUser } from "@/lib/mobile/auth"
import { MobileError } from "@/lib/mobile/errors"
import {
  registrationRoute,
  isProfileCompletionCredential,
  validateProfileCompletionCapability,
  enrollReadyRegisteredSession,
} from "@/lib/mobile/registration-auth"
import {
  missingProfileQuestions,
  storedProfileQuizAnswers,
  profileCompletionRequestSchema,
} from "@/lib/mobile/profile-completion-contract"
import { mobileEditQuestions } from "@/lib/mobile/profile-edit-contract"
import { readScannerProfileSource } from "@/lib/scan/scanner-context-supabase"
import { completeMobileProfile } from "@/lib/mobile/registration-completion"

async function completionAuthority(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^ ]+)$/)?.[1]
  const limited = !!token && isProfileCompletionCredential(token)
  if (limited) {
    const client = createAdminClient()
    const authority = await validateProfileCompletionCapability(token!, client)
    return { client, userId: authority.userId, authority }
  }
  return { ...(await requireMobileUser(request)), authority: null }
}

export async function GET(request: Request) {
  return registrationRoute(async () => {
    const { client, userId } = await completionAuthority(request)
    const read = await readScannerProfileSource(client, userId)
    const answers = storedProfileQuizAnswers(read.profile)
    const missing = new Set(missingProfileQuestions(read.profile))
    return mobileJSON({
      profileRevision: read.profileRevision,
      answers,
      questions: mobileEditQuestions(answers).filter((q) => missing.has(q.id)),
    })
  })
}
export async function POST(request: Request) {
  return registrationRoute(async () => {
    const { client, userId, authority } = await completionAuthority(request)
    const parsed = profileCompletionRequestSchema.safeParse(await mobileBody(request))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    const bootstrap = await completionResult(completeMobileProfile(client, userId, parsed.data))
    const session = authority
      ? await enrollReadyRegisteredSession(authority, bootstrap, client)
      : undefined
    return mobileJSON({ ...(session ? { session } : {}), bootstrap })
  })
}
