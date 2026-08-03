import type { Metadata } from "next"
import Image from "next/image"

import { WaitlistProgress } from "@/components/waitlist/waitlist-progress"
import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import { WhatsAppCta } from "@/components/waitlist/whatsapp-cta"
import {
  LAUNCH_CLOSE_LABEL,
  LAUNCH_DATE_LABEL,
  LAUNCH_TIME_LABEL,
  WAITLIST_WHATSAPP_URL,
} from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Letzter Schritt",
  robots: { index: false, follow: false },
}

export default function WaitlistThankYouPage() {
  return (
    <WaitlistShell>
      <WaitlistProgress label="Letzter Schritt" percent={95} />

      {WAITLIST_WHATSAPP_URL ? (
        <>
          <section className="mt-8 text-center">
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
              Letzter Schritt
            </p>
            <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight sm:text-[2.25rem]">
              Tritt der WhatsApp-Community bei
            </h1>
            <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
              Ab hier läuft alles über WhatsApp: der Zugang am {LAUNCH_DATE_LABEL} um{" "}
              {LAUNCH_TIME_LABEL}, der Gründungspreis und deine kostenlosen Ressourcen bis dahin.
              Per E-Mail bekommst du es auch, nur später.
            </p>
          </section>

          <section className="mt-8 rounded-[14px] border-2 border-[#25d366] bg-card p-6 text-center sm:p-8">
            <WhatsAppCta href={WAITLIST_WHATSAPP_URL} />
            <p className="mt-3 text-xs text-muted-foreground">
              Kostenlos · Nur Ankündigungen von uns · Du kannst jederzeit wieder gehen
            </p>
          </section>

          <section className="mt-8 rounded-[14px] border border-border bg-card p-6 text-center">
            <h3 className="font-display text-lg font-semibold">Gerade am Laptop?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Scann den Code mit der Kamera deines Handys. Dann landest du direkt in der Community.
            </p>
            <Image
              src="/images/waitlist/whatsapp-community-qr.png"
              alt="QR-Code zur WhatsApp-Community von chaarlie"
              width={176}
              height={176}
              className="mx-auto mt-4 h-44 w-44 rounded-[10px] border border-border"
            />
          </section>
        </>
      ) : (
        <section className="mt-8 text-center">
          <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
            Anmeldung gespeichert
          </p>
          <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight sm:text-[2.25rem]">
            Wir melden uns per E-Mail bei dir.
          </h1>
          <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
            Der Community-Link ist gerade nicht verfügbar. Deine Anmeldung bleibt gespeichert.
          </p>
        </section>
      )}
      <section className="mt-10 rounded-[14px] border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Was jetzt passiert</h2>
        <ol className="mt-5 space-y-4 text-muted-foreground">
          <li>
            <strong className="text-foreground">1. Schau in dein E-Mail-Postfach.</strong>
            <br />
            Die Willkommens-Mail trägt den Betreff „Du bist drin“. Falls sie fehlt, prüfe bitte auch
            deinen Spam-Ordner.
          </li>
          <li>
            <strong className="text-foreground">2. Bis zum Start.</strong>
            <br />
            Jeden Tag erhältst du eine kurze Mail mit etwas, das du direkt anwenden kannst.
          </li>
          <li>
            <strong className="text-foreground">3. Am {LAUNCH_DATE_LABEL}.</strong>
            <br />
            Wir öffnen für die Warteliste. Dein Gründungspreis bleibt dauerhaft erhalten. Sichere
            ihn dir bis {LAUNCH_CLOSE_LABEL}.
          </li>
        </ol>
      </section>
    </WaitlistShell>
  )
}
