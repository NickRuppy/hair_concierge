"use client"

import { ScanInsertFrame, type ScanInsertViewProps } from "./scan-insert-frame"
import { getScanInsertExample, getScanInsertScalpTarget } from "@/lib/quiz/scan-insert-examples"
import { useQuizStore } from "@/lib/quiz/store"

/**
 * Insert after the scalp question: the answer the user just gave becomes the
 * yardstick the scanner holds every shampoo against.
 */
export function ScanInsertSolutionView({ answers, funnelPackageKey }: ScanInsertViewProps) {
  return (
    <ScanInsertFrame
      card={getScanInsertExample(17, answers)}
      eyebrow="Die Lösung"
      funnelPackageKey={funnelPackageKey}
      headline="Nicht mehr raten. Scannen."
      insertId="solution"
      photoAlt="Hand scannt eine Shampoo-Flasche vor dem Regal mit dem Smartphone"
      photoSrc="/images/funnels/scan/regal-scan-flasche.webp"
      step={17}
    >
      <span>
        {`Du hast „${getScanInsertScalpTarget(answers)}“ angegeben. Jedes Shampoo, das nicht dazu passt, erkennt der Scanner in Sekunden – bevor es im Korb landet.`}
      </span>
    </ScanInsertFrame>
  )
}

export function ScanInsertSolution() {
  const answers = useQuizStore((s) => s.answers)
  const funnelPackageKey = useQuizStore((s) => s.funnelPackageKey)

  return <ScanInsertSolutionView answers={answers} funnelPackageKey={funnelPackageKey} />
}
