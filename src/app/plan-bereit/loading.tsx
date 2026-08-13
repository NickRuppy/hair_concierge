export default function PlanBereitLoading() {
  return (
    <main
      aria-label="Plan bereit wird geladen"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
      data-loading-shell="plan-bereit-loading-shell"
      role="status"
    >
      <section className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto h-5 w-28 rounded-md bg-muted" />
        <div className="mx-auto h-9 w-4/5 rounded-md bg-muted" />
        <div className="mx-auto h-5 w-full rounded-md bg-muted" />
        <div className="mx-auto h-5 w-4/5 rounded-md bg-muted" />
        <div className="h-28 rounded-xl border border-border bg-card" />
      </section>
    </main>
  )
}
