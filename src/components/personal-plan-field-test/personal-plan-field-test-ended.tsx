export function PersonalPlanFieldTestEnded({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <main className="min-h-screen bg-[var(--bg-page)] px-5 py-16 text-[var(--text-main)] sm:px-8 sm:py-24">
      <section className="mx-auto flex w-full max-w-xl flex-col items-center rounded-[2rem] border border-[var(--brand-plum-light)] bg-white px-6 py-10 text-center shadow-sm sm:px-10 sm:py-14">
        <p className="text-sm font-semibold text-[var(--brand-plum)]">Chaarlie Produkttest</p>
        <h1 className="mt-3 text-balance font-header text-3xl font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-4xl">
          {unavailable
            ? "Dein Testzugang kann gerade nicht geprüft werden."
            : "Dein Testzugang ist nicht mehr verfügbar."}
        </h1>
        <p className="mt-4 max-w-md text-pretty leading-7 text-[var(--text-sub)]">
          {unavailable
            ? "Bitte lade diese Seite erneut oder öffne deine Einladung noch einmal und melde dich mit dem eingeladenen Konto an. Deine bereits gespeicherten Antworten bleiben erhalten. Es wird nichts berechnet."
            : "Der Testzeitraum ist beendet oder der Zugang wurde geschlossen. Bitte frage das Chaarlie-Team, wenn du weiter testen möchtest."}
        </p>
      </section>
    </main>
  )
}
