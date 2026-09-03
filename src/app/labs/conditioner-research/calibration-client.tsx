"use client"

import type { ConditionerCalibration } from "./research-lab-client"

function isRetiredRinseDifference(value: string) {
  return /rinseability/i.test(value)
}

function isFocusDifference(value: string) {
  return /primary_focus|secondary_focus/i.test(value)
}

function agreementPercent(metric: { exactCells: number; totalCells: number }) {
  return `${((metric.exactCells / metric.totalCells) * 100).toFixed(1)}%`
}

function metric(label: string, value: string, detail: string) {
  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3">
      <strong className="block text-xl text-stone-950">{value}</strong>
      <span className="mt-1 block text-sm font-semibold text-stone-800">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-stone-600">{detail}</span>
    </div>
  )
}

export function ConditionerCalibrationClient({
  calibration,
}: {
  calibration: ConditionerCalibration
}) {
  const preAdjudication = calibration.preAdjudication
  const postAdjudication = calibration.postAdjudication
  const semanticDifferences = calibration.semanticDifferences.filter(
    (difference) => !isRetiredRinseDifference(difference),
  )
  const remainingDifferences = calibration.remainingDifferences.filter(
    (difference) => !isRetiredRinseDifference(difference),
  )
  const focusDifferences = (
    remainingDifferences.length > 0 ? remainingDifferences : semanticDifferences
  ).filter(isFocusDifference)

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 text-stone-950">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Nur Entwicklung · Kalibrierungsartefakt
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Kalibrierung & Unsicherheiten</h1>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          Sicht auf die vollständige Conditioner-Profilkalibrierung: Blind-Review, adjudizierter
          Schlüssel, Fokus-Hierarchie-Unsicherheiten und Stressproben. Diese Ansicht entscheidet
          nichts im Katalog.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metric(
          "Aktueller Vergleich",
          `${postAdjudication.exactCells}/${postAdjudication.totalCells}`,
          `${agreementPercent(postAdjudication)} exact nach den menschlich bestätigten Regeln; Blind-Baseline ${preAdjudication.exactCells}/${preAdjudication.totalCells}`,
        )}
        {metric(
          "Retained Focus-Differenzen",
          String(focusDifferences.length),
          `${focusDifferences.length} Focus-Differenzen als Review-Kalibrierung, keine Blocker`,
        )}
        {metric(
          "Nicht-Fokus-Felder",
          `${calibration.nonFocusAgreement.exactCells}/${calibration.nonFocusAgreement.totalCells}`,
          "Zwei NEQI-Abweichungen plus sieben transparent adjudizierte Damage-Fit-Änderungen; neue Felder 22/22 exact",
        )}
        {metric(
          "Damage-Fit-Verteilung",
          `${calibration.damageFitDistribution.healthyModerate} / ${calibration.damageFitDistribution.moderateHigh}`,
          `${calibration.damageFitDistribution.healthyModerate} general-care fits · ${calibration.damageFitDistribution.moderateHigh} specialist-route fits`,
        )}
        {metric(
          "Bali Formelautorität",
          "gelöst",
          "Hersteller plus Exact-EAN-Retailer; Focus-Hierarchie bleibt separat sichtbar",
        )}
        {metric(
          "Stressproben · historisch v1.2",
          calibration.stress,
          "Die fünf bisherigen Stressfälle bleiben bestanden; sie prüfen die zwei neuen v1.6-Felder noch nicht.",
        )}
      </section>

      <section className="rounded-md border border-sky-200 bg-sky-50 p-5">
        <h2 className="text-lg font-semibold text-sky-950">Strengere Damage-Fit-Kalibrierung</h2>
        <p className="mt-2 text-sm leading-6 text-sky-950">
          Highly damaged bleibt Produkten mit einer klaren Spezialroute vorbehalten. NEQI
          qualifiziert über Avena Sativa Oat Peptide, OGX über Hydrolyzed Collagen und Bond+ über
          das benannte Hydroxypropylgluconamide-/Hydroxypropylammonium-Gluconate-Paar. Die übrigen
          acht Profile bleiben allgemeine Fits für gesundes bis moderat geschädigtes Haar.
        </p>
        <p className="mt-3 rounded-md border border-sky-200 bg-white p-3 text-sm leading-6 text-sky-950">
          The 85/99 composite comparison keeps Reviewer F frozen for the seven historical fields and
          adds Reviewer G&apos;s independent review of the two new fields (22/22 exact). It is not a
          fresh de-novo rerun of all nine fields, so it must not be presented as full v1.6
          repeatability.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-md border border-stone-200 bg-white p-5">
          <h2 className="text-lg font-semibold">
            {focusDifferences.length} retained Focus-Differenzen
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Diese Punkte sind Kalibrierungsunsicherheit in der Fokus-Hierarchie. Sie blockieren die
            Profilnutzung nicht.
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
            {focusDifferences.map((difference) => (
              <li key={difference} className="rounded-md bg-stone-50 p-3">
                {difference}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-md border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold text-emerald-950">Bali geklärt</h2>
          <p className="mt-3 text-sm leading-6 text-emerald-950">
            Hersteller und Exact-EAN-Retailer lösen die Formelautorität. Curl Support versus
            Smoothing bleibt als separate, inzwischen menschlich bestätigte Fokus-Regel sichtbar.
          </p>
          <p className="mt-3 rounded-md border border-emerald-200 bg-white p-3 text-sm leading-6 text-emerald-950">
            Null aktive Formelkonflikte im Pilot.
          </p>
        </article>
      </section>

      <section className="rounded-md border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Neue Fokus-Entscheidungslogik</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          Detangling, Smoothing, Shine und Repair bleiben getrennte Endpunkte. Der primäre Fokus
          muss aber über die normale Conditioner-Basis hinaus differenzieren. Für die spätere
          Produktauswahl bleiben die einzelnen Fähigkeiten darunter erhalten. Für jede zukünftige
          Conditioner-Recherche bleiben ein Primary Focus und bis zu zwei Secondary Focus jedoch
          verpflichtend, damit sich Produkte konsistent vergleichen lassen.
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
          {calibration.focusDecisions.map((decision) => (
            <li key={decision} className="rounded-md bg-[#f7efe6] p-3">
              {decision}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-semibold text-amber-950">
          Adjudizierter Fallback & Evidenz-Caveat
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-950">
          NEQI weicht bewusst vom früheren Blind-Review ab, damit Unsicherheit nicht als
          restriktives High in die Haarstärken-Eignung einfließt.
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-950">
          {calibration.evidenceCaveats.map((decision) => (
            <li key={decision} className="rounded-md bg-white p-3">
              {decision}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
