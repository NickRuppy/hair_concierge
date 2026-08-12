export function RegularQuizFieldTestUnavailable() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#fcfaf7] px-4 py-10 text-[var(--brand-plum-darkest)]">
      <section className="w-full max-w-[30rem] rounded-[1.5rem] border border-[rgba(var(--brand-plum-rgb),0.10)] bg-white p-7 text-center shadow-[0_18px_48px_-38px_rgba(var(--brand-plum-rgb),0.65)]">
        <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgba(var(--brand-plum-rgb),0.58)]">
          Feldtest
        </p>
        <h1 className="mt-3 font-serif text-[2rem] leading-tight tracking-[-0.035em]">
          Dein Testzugang ist gerade nicht verfügbar.
        </h1>
        <p className="mt-4 text-base leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
          Deine Quiz-Antworten und deine Auswertung sind gespeichert. Versuche die Aktivierung noch
          einmal oder öffne den Testlink in einer frischen Browser-Sitzung.
        </p>
        <p className="mt-4 rounded-2xl bg-[var(--brand-plum-ice)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--brand-plum-darkest)]">
          Es wurde keine Zahlung ausgelöst. Ein angemeldetes Kundenkonto wird niemals für den
          Feldtest übernommen.
        </p>
      </section>
    </main>
  )
}
