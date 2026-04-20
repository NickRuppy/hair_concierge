export interface SubscriptionProfile {
  subscription_status: string | null
}

export function isSubscriptionActive(profile: SubscriptionProfile | null | undefined): boolean {
  if (!profile) return false
  return profile.subscription_status === "active" || profile.subscription_status === "past_due"
}
