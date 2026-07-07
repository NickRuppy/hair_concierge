export default function RoutineLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="border-b border-border pb-4">
          <div className="h-4 w-20 animate-pulse rounded-md bg-primary/10" />
          <div className="mt-3 h-8 w-72 animate-pulse rounded-md bg-primary/10" />
          <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-md bg-primary/10" />
        </div>
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="min-h-[360px] rounded-md border border-border bg-card p-4">
              <div className="h-6 w-28 animate-pulse rounded-md bg-primary/10" />
              <div className="mt-4 h-5 w-2/3 animate-pulse rounded-md bg-primary/10" />
              <div className="mt-2 h-4 w-4/5 animate-pulse rounded-md bg-primary/10" />
              <div className="mt-6 h-[116px] animate-pulse rounded-md bg-primary/10" />
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
