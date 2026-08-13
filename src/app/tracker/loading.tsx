export default function TrackerLoading() {
  return (
    <main
      aria-label="Tracker wird geladen"
      aria-live="polite"
      className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      data-loading-shell="tracker-loading-shell"
      role="status"
    >
      <div className="border-b border-border pb-6">
        <div className="h-9 w-40 rounded-md bg-muted" />
        <div className="mt-3 h-5 w-full max-w-lg rounded-md bg-muted" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <section className="min-h-80 rounded-xl border border-border bg-card p-5">
          <div className="h-6 w-44 rounded-md bg-muted" />
          <div className="mt-6 grid grid-cols-7 gap-2">
            {Array.from({ length: 14 }, (_, item) => (
              <div key={item} className="aspect-square rounded-md bg-muted" />
            ))}
          </div>
        </section>
        <section className="min-h-80 rounded-xl border border-border bg-card p-5">
          <div className="h-6 w-32 rounded-md bg-muted" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-12 rounded-md bg-muted" />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
