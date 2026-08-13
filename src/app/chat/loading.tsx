export default function ChatLoading() {
  return (
    <main
      aria-label="Chat wird geladen"
      aria-live="polite"
      className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col px-4 py-6 sm:px-6"
      data-loading-shell="chat-loading-shell"
      role="status"
    >
      <div className="border-b border-border pb-5">
        <div className="h-7 w-36 rounded-md bg-muted" />
      </div>
      <section className="flex flex-1 flex-col gap-4 py-6">
        <div className="h-16 w-4/5 rounded-xl bg-muted" />
        <div className="ml-auto h-20 w-3/5 rounded-xl bg-muted" />
        <div className="h-24 w-5/6 rounded-xl bg-muted" />
      </section>
      <div className="h-14 rounded-xl border border-border bg-card" />
    </main>
  )
}
