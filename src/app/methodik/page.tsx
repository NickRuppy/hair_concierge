import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { EditorialShell } from "@/components/editorial/editorial-shell"
import { METHODIK_METADATA, SITE_LEGAL_NAME } from "@/lib/seo/site-identity"

export const metadata: Metadata = METHODIK_METADATA

const sectionClass = "border-t border-border py-10 sm:py-12"

export function MethodikContent() {
  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-8">
      <header className="max-w-3xl pb-10 pt-12 sm:pb-14 sm:pt-16">
        <p className="mb-3 font-mono text-xs font-semibold uppercase text-[var(--brand-coral-deep)]">
          Methodik und Transparenz
        </p>
        <h1 className="font-header text-4xl font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-5xl">
          So kommt Chaarlie zu einer Pflegeeinschätzung
        </h1>
        <p className="mt-5 text-lg leading-8 text-[var(--text-sub)]">
          Hier erklären wir, welche Angaben einfließen, wie wir Empfehlungen und Inhalte behandeln
          und wo die Grenzen von Chaarlie liegen.
        </p>
      </header>

      <section className="border-y border-border bg-[var(--brand-plum-ice)] px-5 py-7 sm:px-8">
        <h2 className="text-lg font-bold text-[var(--brand-plum-darkest)]">Kurz gesagt</h2>
        <p className="mt-2 max-w-3xl leading-7 text-[var(--text-body)]">
          Chaarlie ist eine kosmetische Pflegeeinschätzung auf Grundlage deiner Antworten. Sie ist
          keine Diagnose, ersetzt keine medizinische Untersuchung und verspricht kein bestimmtes
          Ergebnis.
        </p>
      </section>

      <section className={sectionClass} aria-labelledby="quiz-angaben">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <h2
            id="quiz-angaben"
            className="font-header text-2xl font-medium text-[var(--brand-plum-darkest)]"
          >
            Was der Fragebogen verwendet
          </h2>
          <div className="space-y-4 leading-7 text-[var(--text-body)]">
            <p>
              Die Einschätzung stützt sich auf deine eigenen Angaben. Dazu gehören unter anderem
              Haarmuster, Haardicke, Dichte und Länge sowie deine Beobachtungen zur Oberfläche und
              Elastizität einzelner Haare.
            </p>
            <p>
              Außerdem berücksichtigen wir Angaben zu Kopfhaut, chemischen Behandlungen,
              Pflegeproblemen und Zielen. Selbsttests und Selbsteinschätzungen können ungenau sein;
              Chaarlie behandelt sie deshalb als Hinweise, nicht als Messwerte oder Befunde.
            </p>
          </div>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="empfehlungen-produkte">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <h2
            id="empfehlungen-produkte"
            className="font-header text-2xl font-medium text-[var(--brand-plum-darkest)]"
          >
            Empfehlungen und Produktdaten
          </h2>
          <div className="space-y-4 leading-7 text-[var(--text-body)]">
            <p>
              Chaarlie ordnet deine Antworten in Pflegethemen ein und gleicht sie mit hinterlegten
              Regeln und Produktmerkmalen ab. Empfehlungen beziehen sich auf kosmetische Pflege,
              Anwendung und Produktauswahl. Sie sind keine Zusage, dass ein Produkt bei jeder Person
              gleich wirkt oder vertragen wird.
            </p>
            <p>
              Produktangaben können aus Herstellerinformationen, Händlerseiten und redaktioneller
              Recherche stammen. Bezeichnungen, Rezepturen, Preise und Verfügbarkeit können sich
              ändern. Prüfe deshalb vor dem Kauf die aktuelle Produktseite und bei
              Unverträglichkeiten die vollständige Inhaltsstoffliste.
            </p>
          </div>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="kommerziell">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <h2
            id="kommerziell"
            className="font-header text-2xl font-medium text-[var(--brand-plum-darkest)]"
          >
            Affiliate-Links und kommerzielle Beziehungen
          </h2>
          <div className="space-y-4 leading-7 text-[var(--text-body)]">
            <p>
              Manche Verweise zu Shops können Affiliate-Links sein. Wenn du über einen solchen Link
              etwas kaufst, kann {SITE_LEGAL_NAME} eine Provision erhalten. Entsprechende Hinweise
              stehen direkt beim Link oder in seinem unmittelbaren Kontext.
            </p>
            <p>
              Eine Vergütung ist kein Qualitätsnachweis. Kommerzielle Beziehungen und bezahlte
              Platzierungen legen wir dort offen, wo sie für einen Inhalt oder eine Produktauswahl
              relevant sind.
            </p>
          </div>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="quellen-aktualitaet">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <h2
            id="quellen-aktualitaet"
            className="font-header text-2xl font-medium text-[var(--brand-plum-darkest)]"
          >
            Quellen und Aktualisierung
          </h2>
          <div className="space-y-4 leading-7 text-[var(--text-body)]">
            <p>
              Öffentliche Sachinformationen sollen ihre wesentlichen Quellen nachvollziehbar machen.
              Wir bevorzugen Primärquellen, offizielle Informationen und belastbare
              Übersichtsarbeiten. Wo die Informationslage unsicher oder widersprüchlich ist, machen
              wir diese Unsicherheit sichtbar.
            </p>
            <p>
              Wir überarbeiten öffentliche Sachinformationen, wenn sich relevante Quellen,
              Sicherheitsinformationen oder Produktdaten wesentlich ändern. Eine redaktionelle
              Prüfung bedeutet nicht, dass ein Inhalt medizinisch validiert wurde.
            </p>
          </div>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="medizinische-grenze">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <h2
            id="medizinische-grenze"
            className="font-header text-2xl font-medium text-[var(--brand-plum-darkest)]"
          >
            Medizinische Grenze
          </h2>
          <div className="space-y-4 leading-7 text-[var(--text-body)]">
            <p>
              Chaarlie behandelt kosmetische Haarpflege. Bei plötzlich auftretendem oder starkem
              Haarausfall, Schmerzen, Wunden, Entzündungen, anhaltendem Juckreiz oder anderen
              ausgeprägten beziehungsweise zunehmenden Beschwerden solltest du ärztlichen Rat,
              möglichst dermatologisch, einholen.
            </p>
            <p>
              Wir stellen keine Diagnosen, empfehlen keine medizinische Behandlung und raten nicht
              dazu, eine bestehende Behandlung zu beginnen, zu verändern oder abzusetzen.
            </p>
          </div>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="verantwortung">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
          <h2
            id="verantwortung"
            className="font-header text-2xl font-medium text-[var(--brand-plum-darkest)]"
          >
            Verantwortung und Kontakt
          </h2>
          <div className="space-y-4 leading-7 text-[var(--text-body)]">
            <p>
              Die redaktionelle Verantwortung für diese Methodikseite liegt bei der Chaarlie
              Redaktion. Anbieter von Chaarlie ist {SITE_LEGAL_NAME}.
            </p>
            <p>
              Fragen, Korrekturhinweise oder Hinweise auf veraltete Inhalte kannst du über unsere{" "}
              <Link
                href="/kontakt"
                className="font-semibold text-[var(--brand-plum-dark)] underline decoration-[var(--brand-plum-light)] decoration-2 underline-offset-4 hover:text-[var(--brand-coral-deep)]"
              >
                Kontaktseite
              </Link>{" "}
              senden. Die vollständigen Anbieterangaben stehen im{" "}
              <Link
                href="/impressum"
                className="font-semibold text-[var(--brand-plum-dark)] underline decoration-[var(--brand-plum-light)] decoration-2 underline-offset-4 hover:text-[var(--brand-coral-deep)]"
              >
                Impressum
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-12 sm:py-16" aria-labelledby="methodik-cta">
        <div className="max-w-3xl">
          <h2
            id="methodik-cta"
            className="font-header text-3xl font-medium text-[var(--brand-plum-darkest)]"
          >
            Möchtest du deine Angaben einordnen lassen?
          </h2>
          <p className="mt-3 leading-7 text-[var(--text-sub)]">
            Der Fragebogen ist kostenlos. Du entscheidest selbst, ob du die anschließenden
            Pflegevorschläge nutzen möchtest.
          </p>
          <Link
            href="/quiz"
            prefetch={false}
            className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-[var(--brand-coral)] px-5 py-3 font-bold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)] focus-visible:ring-offset-2"
          >
            Haaranalyse starten
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}

export default function MethodikPage() {
  return (
    <EditorialShell>
      <MethodikContent />
    </EditorialShell>
  )
}
