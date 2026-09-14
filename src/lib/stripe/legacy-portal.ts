import {
  hasTrialBillingContract,
  type BillingTrialAccessRow,
} from "@/lib/billing/trial-access-projection"

type Input = { userId: string; customerId: string; returnUrl: string }
type Dependencies = {
  readSubscriptions: (userId: string) => Promise<readonly BillingTrialAccessRow[]>
  createSession: (params: { customer: string; return_url: string }) => Promise<{ url: string }>
}

export async function createLegacyPortalSession(input: Input, deps: Dependencies) {
  const rows = await deps.readSubscriptions(input.userId)
  if (rows.some(hasTrialBillingContract)) throw new Error("trial_management_required")
  return deps.createSession({ customer: input.customerId, return_url: input.returnUrl })
}
