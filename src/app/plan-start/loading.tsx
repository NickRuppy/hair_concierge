export default function PlanStartLoading() {
  return (
    <main
      aria-label="Planstart wird geladen"
      aria-live="polite"
      className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:py-12"
      data-loading-shell="plan-start-loading-shell"
      role="status"
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-3 border-b border-border pb-6">
          <div className="h-4 w-28 rounded-md bg-muted" />
          <div className="h-9 w-3/4 max-w-md rounded-md bg-muted" />
          <div className="h-5 w-full max-w-2xl rounded-md bg-muted" />
        </div>
        <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
          <div className="h-6 w-40 rounded-md bg-muted" />
          <div className="mt-6 space-y-3">
            <div className="h-5 w-full rounded-md bg-muted" />
            <div className="h-5 w-5/6 rounded-md bg-muted" />
            <div className="h-5 w-2/3 rounded-md bg-muted" />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-16 rounded-lg border border-border bg-muted/60" />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
