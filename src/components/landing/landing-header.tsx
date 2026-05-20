import Link from "next/link"

export function LandingHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-border backdrop-blur-[12px]"
      style={{ backgroundColor: "rgba(253,251,249,0.95)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="chaarlie Startseite">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[var(--brand-plum-darkest)]">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="#FDFBF9">
              <path d="M12 2C9 7 5 11 5 15a7 7 0 0014 0c0-4-4-8-7-13z" />
            </svg>
          </span>
          <span className="font-header text-[22px] font-medium leading-none text-[var(--brand-plum-darkest)]">
            chaarlie
          </span>
        </Link>
        <Link
          href="/quiz"
          className="rounded-[10px] bg-[var(--brand-coral)] px-[18px] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-coral-dark)]"
        >
          Quiz starten
        </Link>
      </div>
    </header>
  )
}
