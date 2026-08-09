export function resolveOnboardingCompletionDestination(returnTo: string | null): string {
  return returnTo ?? "/routine"
}

export function resolveOnboardingCompletionCtaLabel(returnTo: string | null): string {
  return returnTo ? "ZUM CHAT" : "ZU MEINER ROUTINE"
}
