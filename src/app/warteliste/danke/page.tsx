import type { Metadata } from "next"
import QRCode from "qrcode"

import { WaitlistProgress } from "@/components/waitlist/waitlist-progress"
import { WaitlistShell } from "@/components/waitlist/waitlist-shell"
import {
  LAUNCH_CLOSE_LABEL,
  LAUNCH_DATE_LABEL,
  LAUNCH_TIME_LABEL,
  WAITLIST_WHATSAPP_URL,
} from "@/lib/waitlist/config"

export const metadata: Metadata = {
  title: "Nur noch ein Schritt",
  robots: { index: false, follow: false },
}

const GROUP_BENEFITS = [
  {
    title: `Der Zugang am ${LAUNCH_DATE_LABEL} kommt zuerst in die Gruppe`,
    body: "Ein paar Minuten, bevor die E-Mail rausgeht. Wer drin ist, ist zuerst dran.",
  },
  {
    title: "Der Gründungspreis wird dort zuerst genannt",
    body: `Und er gilt nur bis ${LAUNCH_CLOSE_LABEL}.`,
  },
  {
    title: "Deine Fragen beantworten wir direkt",
    body: "Zugtest, Kopfhaut, Produkte. Schreib rein, wir lesen mit.",
  },
]

async function whatsappQrDataUri() {
  if (!WAITLIST_WHATSAPP_URL) return null

  try {
    return await QRCode.toDataURL(WAITLIST_WHATSAPP_URL, {
      margin: 1,
      width: 320,
      color: { dark: "#2A1845", light: "#FFFFFF" },
    })
  } catch {
    // Ein fehlgeschlagener QR-Code darf die Seite nicht mitnehmen. Der Button
    // darunter funktioniert ohnehin.
    return null
  }
}

export default async function WaitlistThankYouPage() {
  const qr = await whatsappQrDataUri()

  return (
    <WaitlistShell>
      <WaitlistProgress label="Letzter Schritt" percent={92} />

      {WAITLIST_WHATSAPP_URL ? (
        <>
          <section className="mt-8 text-center">
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
              Letzter Schritt
            </p>
            <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2.25rem]">
              Hol dir deinen Platz
              <br />
              in der WhatsApp-Gruppe
            </h1>
            <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
              Der Launch läuft über WhatsApp. Der Zugang am {LAUNCH_DATE_LABEL} um{" "}
              {LAUNCH_TIME_LABEL}, der Gründungspreis und alles, was bis dahin passiert, kommt
              zuerst dorthin. Per E-Mail bekommst du es auch, nur später.
            </p>
          </section>

          <section className="mt-8 rounded-[14px] border-2 border-[var(--brand-coral)] bg-card p-6 text-center sm:p-8">
            <a
              href={WAITLIST_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full max-w-sm rounded-[10px] bg-[var(--brand-coral)] px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
            >
              WhatsApp-Gruppe beitreten
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Kostenlos · Nur Ankündigungen von uns · Du kannst jederzeit wieder gehen
            </p>

            <ul className="mx-auto mt-7 flex max-w-md flex-col gap-4 text-left">
              {GROUP_BENEFITS.map((benefit) => (
                <li key={benefit.title} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum)] text-[11px] font-bold text-white"
                  >
                    ✓
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{benefit.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {benefit.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {qr ? (
            <section className="mt-8 rounded-[14px] border border-border bg-card p-6 text-center">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Gerade am Laptop?
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Scann den Code mit der Kamera deines Handys. Dann landest du direkt in der Gruppe,
                also dort, wo du die Nachrichten am 9. August auch wirklich siehst.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="QR-Code zur WhatsApp-Gruppe von chaarlie"
                width={176}
                height={176}
                className="mx-auto mt-5 h-44 w-44 rounded-[10px] border border-border"
              />
            </section>
          ) : null}
        </>
      ) : (
        <section className="mt-8 text-center">
          <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
            Geschafft
          </p>
          <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2.25rem]">
            Dein Platz ist sicher.
          </h1>
          <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
            Du bekommst gleich eine Willkommens-Mail von uns und ab morgen jeden Tag etwas, das du
            sofort anwenden kannst.
          </p>
        </section>
      )}

      <section className="mt-10 rounded-[14px] border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold text-foreground">Was jetzt passiert</h2>
        <ol className="mt-5 flex flex-col gap-4">
          <li>
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--brand-plum)]">
              Schritt 1
            </p>
            <p className="mt-1 font-semibold text-foreground">Schau in dein E-Mail-Postfach</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Die Willkommens-Mail hat den Betreff &bdquo;Du bist drin&ldquo;. Wenn sie nicht
              ankommt, schau im Spam-Ordner nach und markiere sie als &bdquo;kein Spam&ldquo;, sonst
              verpasst du die Mails bis zum Start.
            </p>
          </li>
          <li>
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--brand-plum)]">
              Schritt 2
            </p>
            <p className="mt-1 font-semibold text-foreground">Bis zum Start</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Jeden Tag eine kurze Mail mit etwas, das du auch ohne uns anwenden kannst. Zugtest,
              Kopfhaut-Einordnung, die Drei-Produkte-Basis.
            </p>
          </li>
          <li>
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--brand-plum)]">
              Schritt 3
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {LAUNCH_DATE_LABEL}, {LAUNCH_TIME_LABEL}
            </p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Wir öffnen für die Warteliste. Der Gründungspreis gilt bis {LAUNCH_CLOSE_LABEL}.
            </p>
          </li>
        </ol>
      </section>
    </WaitlistShell>
  )
}
