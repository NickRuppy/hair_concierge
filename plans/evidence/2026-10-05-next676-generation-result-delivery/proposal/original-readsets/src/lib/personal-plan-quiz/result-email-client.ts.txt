export async function requestPersonalPlanResultArtifactEmail(
  leadId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await fetchImpl("/api/quiz/personal-plan-result-artifact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId }),
    keepalive: true,
  })
}
