import type { Metadata } from "next"
import Image from "next/image"

import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import { WhatsAppCta } from "@/components/waitlist/whatsapp-cta"
import {
  LAUNCH_CLOSE_LABEL,
  LAUNCH_DATE_LABEL,
  LAUNCH_TIME_LABEL,
  WAITLIST_WHATSAPP_URL,
} from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Du bist drin | chaarlie",
  robots: { index: false, follow: false },
}

export default function WaitlistThankYouPage() {
  return (
    <WaitlistShell>
      <section className="text-center">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
          Geschafft
        </p>
        <h1 className="mt-4 font-display text-[2rem] font-semibold leading-tight sm:text-[2.5rem]">
          Du bist drin.
        </h1>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
          Dein Platz ist gesichert. Du bekommst gleich eine Willkommens-E-Mail und bis zum Start
          jeden Tag eine kurze, hilfreiche Mail von uns.
        </p>
      </section>
      {WAITLIST_WHATSAPP_URL ? (
        <section className="mt-9 rounded-[14px] border-2 border-[#25d366] bg-card p-6 text-center sm:p-8">
          <h2 className="font-display text-2xl font-semibold">
            WhatsApp ist der schnellste Weg zum Start.
          </h2>
          <p className="mx-auto mt-3 max-w-lg leading-relaxed text-muted-foreground">
            Optional, aber dort bekommst du den Zugang am {LAUNCH_DATE_LABEL} um {LAUNCH_TIME_LABEL}
            , den Gründungspreis und die kostenlosen Ressourcen zuerst. Der Gründungspreis ist bis{" "}
            {LAUNCH_CLOSE_LABEL} verfügbar und bleibt danach für dich dauerhaft erhalten. Per E-Mail
            bekommst du alles ebenfalls.
          </p>
          <div className="mt-6">
            <WhatsAppCta href={WAITLIST_WHATSAPP_URL} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Kostenlos · Nur Ankündigungen von uns · Du kannst jederzeit wieder gehen
          </p>
          <div className="mt-8 border-t border-border pt-6">
            <h3 className="font-display text-lg font-semibold">Gerade am Laptop?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Scanne den Code mit deinem Handy – oder nutze einfach den Button oben.
            </p>
            <Image
              src="/images/waitlist/whatsapp-community-qr.png"
              alt="QR-Code zur WhatsApp-Community von chaarlie"
              width={176}
              height={176}
              className="mx-auto mt-4 h-44 w-44 rounded-[10px] border border-border"
            />
          </div>
        </section>
      ) : null}
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
