export default function AnwendungLoading() {
  return (
    <main
      aria-label="Anwendung wird geladen"
      aria-live="polite"
      className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6"
      data-loading-shell="anwendung-loading-shell"
      role="status"
    >
      <div className="max-w-2xl border-b border-border pb-4">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="mt-3 h-5 w-full max-w-md rounded-md bg-muted" />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="min-h-[92px] rounded-md border border-border bg-card p-4">
            <div className="h-5 w-36 rounded-md bg-muted" />
            <div className="mt-3 h-4 w-full rounded-md bg-muted" />
            <div className="mt-2 h-4 w-2/3 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </main>
  )
}
