export default function ProfileLoading() {
  return (
    <main
      aria-label="Profil wird geladen"
      aria-live="polite"
      className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      data-loading-shell="profile-loading-shell"
      role="status"
    >
      <div className="border-b border-border pb-6">
        <div className="h-9 w-48 rounded-md bg-muted" />
        <div className="mt-3 h-5 w-full max-w-xl rounded-md bg-muted" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <section key={item} className="min-h-44 rounded-xl border border-border bg-card p-5">
            <div className="h-5 w-2/5 rounded-md bg-muted" />
            <div className="mt-5 h-4 w-full rounded-md bg-muted" />
            <div className="mt-3 h-4 w-4/5 rounded-md bg-muted" />
            <div className="mt-6 h-9 w-full rounded-md bg-muted" />
          </section>
        ))}
      </div>
    </main>
  )
}
