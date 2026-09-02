export default function RoutineLoading() {
  return (
    <main
      aria-label="Routine wird geladen"
      aria-live="polite"
      className="min-h-screen bg-background"
      data-loading-shell="routine-loading-shell"
      role="status"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="border-b border-border pb-4">
          <div className="h-4 w-20 rounded-md bg-muted" />
          <div className="mt-3 h-8 w-72 rounded-md bg-muted" />
          <div className="mt-3 h-4 w-full max-w-2xl rounded-md bg-muted" />
        </div>
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="min-h-[360px] rounded-md border border-border bg-card p-4">
              <div className="h-6 w-28 rounded-md bg-muted" />
              <div className="mt-4 h-5 w-2/3 rounded-md bg-muted" />
              <div className="mt-2 h-4 w-4/5 rounded-md bg-muted" />
              <div className="mt-6 h-[116px] rounded-md bg-muted" />
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
