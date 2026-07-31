import type { Metadata } from "next"

import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import {
  LAUNCH_CLOSE_LABEL,
  LAUNCH_DATE_LABEL,
  LAUNCH_TIME_LABEL,
  WAITLIST_WHATSAPP_URL,
} from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Willkommen auf der Warteliste | chaarlie",
  robots: { index: false, follow: false },
}

export default function WaitlistThankYouPage() {
  return (
    <WaitlistShell>
      <section className="text-center">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          Schritt 3 von 3
        </p>
        <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2.25rem]">
          Dein Platz ist sicher.
        </h1>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
          Ein Schritt fehlt noch, und es ist der wichtigste. Alles, was vor dem Start passiert,
          läuft über die WhatsApp-Gruppe.
        </p>
      </section>

      {WAITLIST_WHATSAPP_URL ? (
        <section className="mt-8 rounded-[14px] border-2 border-[var(--brand-coral)] bg-card p-6 text-center sm:p-8">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Tritt der Warteliste-Gruppe bei
          </h2>
          <ul className="mx-auto mt-5 flex max-w-sm flex-col gap-2.5 text-left leading-relaxed text-muted-foreground">
            <li>Die Gruppe bekommt den Zugang zuerst, bevor die E-Mail rausgeht.</li>
            <li>Der Gründungspreis wird dort zuerst genannt.</li>
            <li>Fragen zu deinen Haaren beantworten wir dort direkt.</li>
          </ul>
          <a
            href={WAITLIST_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block w-full max-w-sm rounded-[10px] bg-[var(--brand-coral)] px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
          >
            Jetzt der WhatsApp-Gruppe beitreten
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Nur Ankündigungen von uns. Du kannst die Gruppe jederzeit verlassen.
          </p>
        </section>
      ) : null}

      <section className="mt-10 rounded-[14px] border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold text-foreground">Was jetzt passiert</h2>
        <ol className="mt-5 flex flex-col gap-4">
          <li>
            <p className="font-semibold text-foreground">In den nächsten Minuten</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Du bekommst eine Willkommens-Mail von uns. Wenn sie nicht ankommt, schau bitte im
              Spam-Ordner nach und markiere sie als &bdquo;kein Spam&ldquo;.
            </p>
          </li>
          <li>
            <p className="font-semibold text-foreground">Bis zum Start</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Wir schicken dir jeden Tag etwas, das du auch ohne chaarlie anwenden kannst. Zugtest,
              Kopfhaut-Einordnung, die Drei-Produkte-Basis.
            </p>
          </li>
          <li>
            <p className="font-semibold text-foreground">
              {LAUNCH_DATE_LABEL}, {LAUNCH_TIME_LABEL}
            </p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Wir öffnen für die Warteliste. Der Gründungspreis gilt bis {LAUNCH_CLOSE_LABEL}.
            </p>
          </li>
        </ol>
      </section>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Trag dir {LAUNCH_DATE_LABEL} um {LAUNCH_TIME_LABEL} in den Kalender ein. Wir erinnern dich
        vorher, aber sicher ist sicher.
      </p>
    </WaitlistShell>
  )
}
