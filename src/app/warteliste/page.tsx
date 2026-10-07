import type { Metadata } from "next"

import { WaitlistShell } from "@/components/waitlist/waitlist-shell"

export const metadata: Metadata = {
  title: "Warteliste | chaarlie",
  description: "Die Anmeldung zur Warteliste ist geschlossen.",
  robots: { index: false, follow: false },
}

export default function WaitlistPage() {
  return (
    <WaitlistShell>
      <section className="max-w-xl">
        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          Warteliste
        </p>
        <h1 className="font-display text-[2rem] font-semibold leading-[1.12] sm:text-[2.75rem]">
          Die Anmeldung zur Warteliste ist geschlossen.
        </h1>
      </section>
    </WaitlistShell>
  )
}
