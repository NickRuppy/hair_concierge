export function RegularQuizFieldTestBanner({ surface }: { surface: "quiz" | "offer" }) {
  const copy =
    surface === "offer"
      ? "Dein kostenloser Testzugang ist für diese Sitzung reserviert"
      : "Kostenloser Chaarlie Produkttest · keine Zahlung erforderlich"

  return (
    <div
      className="flex items-center justify-center gap-2 bg-[var(--brand-plum-ice)] px-4 py-2 text-center text-[0.72rem] font-extrabold leading-4 text-[var(--brand-plum-darkest)]"
      data-regular-quiz-field-test-banner={surface}
      role="note"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
      <span>{copy}</span>
    </div>
  )
}
