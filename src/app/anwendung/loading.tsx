export default function AnwendungLoading() {
  return (
    <main
      aria-label="Anwendung wird geladen"
      className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6"
    >
      <div className="max-w-2xl border-b border-border pb-4">
        <div className="h-8 w-40 animate-pulse rounded-md bg-primary/10" />
        <div className="mt-3 h-5 w-full max-w-md animate-pulse rounded-md bg-primary/10" />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="min-h-[92px] rounded-md border border-border bg-card p-4">
            <div className="h-5 w-36 animate-pulse rounded-md bg-primary/10" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-md bg-primary/10" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded-md bg-primary/10" />
          </div>
        ))}
      </div>
    </main>
  )
}
