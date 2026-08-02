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
  title: "Letzter Schritt",
  robots: { index: false, follow: false },
}

/** WhatsApp-Grün. Bewusst die Markenfarbe, damit der Button sofort erkannt wird. */
const WHATSAPP_GREEN = "#25D366"

const COMMUNITY_BENEFITS = [
  {
    title: `Der Zugang am ${LAUNCH_DATE_LABEL} kommt zuerst dorthin`,
    body: "Ein paar Minuten, bevor die E-Mail rausgeht. Wer drin ist, ist zuerst dran.",
  },
  {
    title: "Der Gründungspreis wird dort zuerst genannt",
    body: `Und er gilt nur bis ${LAUNCH_CLOSE_LABEL}.`,
  },
  {
    title: "Deine kostenlosen Ressourcen liegen dort",
    body: "Zugtest, Kopfhaut-Einordnung, die Drei-Produkte-Basis. Fragen beantworten wir direkt.",
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
      <WaitlistProgress label="Letzter Schritt" percent={95} />

      {WAITLIST_WHATSAPP_URL ? (
        <>
          <section className="mt-8 text-center">
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]">
              Letzter Schritt
            </p>
            <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2.25rem]">
              Tritt der WhatsApp-Community bei
            </h1>
            <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
              Ab hier läuft alles über WhatsApp: der Zugang am {LAUNCH_DATE_LABEL} um{" "}
              {LAUNCH_TIME_LABEL}, der Gründungspreis und deine kostenlosen Ressourcen bis dahin.
              Per E-Mail bekommst du es auch, nur später.
            </p>
          </section>

          <section
            className="mt-8 rounded-[14px] border-2 bg-card p-6 text-center sm:p-8"
            style={{ borderColor: WHATSAPP_GREEN }}
          >
            <a
              href={WAITLIST_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full max-w-sm items-center justify-center gap-2.5 rounded-[10px] px-6 py-4 text-base font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
              style={{ backgroundColor: WHATSAPP_GREEN }}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 shrink-0"
              >
                <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.38-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.87 9.87 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.14h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.1.81.83-3.03-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.25 8.22z" />
              </svg>
              Der WhatsApp-Community beitreten
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Kostenlos · Nur Ankündigungen von uns · Du kannst jederzeit wieder gehen
            </p>

            <ul className="mx-auto mt-7 flex max-w-md flex-col gap-4 text-left">
              {COMMUNITY_BENEFITS.map((benefit) => (
                <li key={benefit.title} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: WHATSAPP_GREEN }}
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
                Scann den Code mit der Kamera deines Handys. Dann landest du direkt in der
                Community, also dort, wo du die Nachrichten am 9. August auch wirklich siehst.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="QR-Code zur WhatsApp-Community von chaarlie"
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
