import type { Metadata } from "next"
import Image from "next/image"

import { WaitlistProgress } from "@/components/waitlist/waitlist-progress"
import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import { WhatsAppCta } from "@/components/waitlist/whatsapp-cta"
import { LAUNCH_DATE_LABEL, LAUNCH_TIME_LABEL, WAITLIST_WHATSAPP_URL } from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Letzter Schritt",
  robots: { index: false, follow: false },
}

const GROUP_BENEFITS = [
  {
    title: "Dein Zugangslink zur Öffnung",
    tag: "Zuerst in der Gruppe",
    body: `Am ${LAUNCH_DATE_LABEL} um ${LAUNCH_TIME_LABEL}. In der Gruppe bist du in der ersten Sekunde dabei.`,
  },
  {
    title: "Erinnerung kurz vor der Öffnung",
    tag: null,
    body: "Damit du deinen Platz nicht an die Startzeit verlierst.",
  },
  {
    title: "Deine kostenlosen Ressourcen bis zum Start",
    tag: "Nur in der Gruppe",
    body: "Zugtest, Kopfhaut-Einordnung, Drei-Produkte-Basis. Fragen beantworten wir dir dort direkt.",
  },
]

export default function WaitlistThankYouPage() {
  return (
    <WaitlistShell
      topBanner={
        WAITLIST_WHATSAPP_URL ? (
          <p className="flex items-center justify-center gap-2 px-5 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-foreground">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[#e0433f]" />
            Dein Platz ist noch nicht bestätigt
          </p>
        ) : null
      }
    >
      <WaitlistProgress label="Letzter Schritt" percent={97} />

      {WAITLIST_WHATSAPP_URL ? (
        <>
          <section className="mt-8 text-center">
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
              Letzter Schritt
            </p>
            <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight sm:text-[2.25rem]">
              Bestätige jetzt deinen Platz in der WhatsApp-Gruppe
            </h1>
            <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
              Der Start läuft über WhatsApp: Dein <strong>Zugangslink</strong> am{" "}
              {LAUNCH_DATE_LABEL} um {LAUNCH_TIME_LABEL}, die{" "}
              <strong>Erinnerung kurz vor der Öffnung</strong> und deine{" "}
              <strong>kostenlosen Ressourcen</strong> bis dahin kommen dorthin. Wer die Öffnung
              verpasst, muss wieder warten.
            </p>
          </section>

          <section className="mt-8 rounded-[14px] border-2 border-[#25d366] bg-card p-6 text-center sm:p-8">
            <WhatsAppCta href={WAITLIST_WHATSAPP_URL} />
            <p className="mt-3 text-xs text-muted-foreground">
              100 % kostenlos · Unser Hauptkanal für den Start
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Kein WhatsApp?{" "}
              <a
                href="https://www.whatsapp.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Hier herunterladen.
              </a>
            </p>
          </section>

          <section className="mt-8 flex flex-col gap-4">
            {GROUP_BENEFITS.map((benefit) => (
              <div
                key={benefit.title}
                className="flex gap-3 rounded-[14px] border border-border bg-card p-5"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-[11px] font-bold text-white"
                >
                  ✓
                </span>
                <div>
                  <p className="font-semibold text-foreground">
                    {benefit.title}
                    {benefit.tag ? (
                      <span className="ml-2 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--brand-plum)]">
                        {benefit.tag}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {benefit.body}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-8 rounded-[14px] border border-border bg-card p-6 text-center">
            <h3 className="font-display text-lg font-semibold">Gerade am Laptop?</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Scann den Code mit der Kamera deines Handys und du landest direkt in der Gruppe. Dort,
              wo du die Nachricht am {LAUNCH_DATE_LABEL} auch wirklich siehst.
            </p>
            <Image
              src="/images/waitlist/whatsapp-community-qr.png"
              alt="QR-Code zur WhatsApp-Gruppe von chaarlie"
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
            Der WhatsApp-Link ist gerade nicht verfügbar. Deine Anmeldung bleibt gespeichert.
          </p>
        </section>
      )}
    </WaitlistShell>
  )
}
