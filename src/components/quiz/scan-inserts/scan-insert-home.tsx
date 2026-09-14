"use client"

import { ScanInsertFrame, type ScanInsertViewProps } from "./scan-insert-frame"
import { getScanInsertExample } from "@/lib/quiz/scan-insert-examples"
import { useQuizStore } from "@/lib/quiz/store"

/**
 * Insert after the goals question: the scanner does not start at the shelf but
 * at the shelf the user already owns.
 */
export function ScanInsertHomeView({ answers, funnelPackageKey }: ScanInsertViewProps) {
  return (
    <ScanInsertFrame
      card={getScanInsertExample(18, answers)}
      eyebrow="Und zu Hause"
      funnelPackageKey={funnelPackageKey}
      headline="Dein Bad ist das erste Regal."
      insertId="home"
      photoAlt="Pflegeprodukte auf einer Ablage im Badezimmer"
      photoSrc="/images/funnels/scan/bad-ablage.webp"
      step={18}
    >
      <span>
        Scann, was da steht. Was passt, bleibt. Was nicht passt, fliegt raus. Was fehlt, kommt in
        deinen Plan.
      </span>
    </ScanInsertFrame>
  )
}

export function ScanInsertHome() {
  const answers = useQuizStore((s) => s.answers)
  const funnelPackageKey = useQuizStore((s) => s.funnelPackageKey)

  return <ScanInsertHomeView answers={answers} funnelPackageKey={funnelPackageKey} />
}
