"use client"

import { X, Info } from "lucide-react"

import {
  useQuizFunnelPackageKey,
  useScannerFunnelRefinementEnabled,
} from "@/components/quiz/quiz-funnel-package-provider"
import { getQuizFunnelCopy } from "@/lib/quiz/funnel-copy"

type Props = {
  onDismiss: () => void
}

export function QuizInfoStrip({ onDismiss }: Props) {
  const funnelPackageKey = useQuizFunnelPackageKey()
  const scannerFunnelRefinementEnabled = useScannerFunnelRefinementEnabled()
  const copy = getQuizFunnelCopy(funnelPackageKey)

  if (scannerFunnelRefinementEnabled && funnelPackageKey === "scan_v1") {
    return (
      <aside
        role="note"
        data-scanner-refinement-entry="true"
        className="mb-5 rounded-[10px] border border-[var(--brand-plum-light)]/50 bg-[var(--brand-plum-ice)] px-3.5 py-3 text-[13px] leading-snug text-[var(--brand-plum-darkest)]"
      >
        <div className="flex items-start gap-2.5">
          <Info
            aria-hidden="true"
            className="mt-px h-[18px] w-[18px] shrink-0 text-[var(--brand-plum)]"
          />
          <div className="flex-1">
            <strong className="font-semibold">Damit der Scanner zu deinem Haar passt.</strong>
            <p className="mt-1">
              Der Scanner gleicht Produkte mit deinem Haarprofil ab. Dafür brauchen wir ein paar
              Angaben zu deinen Haaren.
            </p>
            <p className="mt-2 font-medium text-[var(--brand-plum)]">
              10 kurze Fragen · ca. 2 Minuten
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Hinweis schließen"
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <div
      role="note"
      className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-[var(--brand-plum-light)]/50 bg-[var(--brand-plum-ice)] px-3.5 py-2.5 text-[13px] leading-snug text-[var(--brand-plum-darkest)]"
    >
      <Info
        aria-hidden="true"
        className="mt-px h-[18px] w-[18px] shrink-0 text-[var(--brand-plum)]"
      />
      <p className="flex-1">
        <strong className="font-semibold">{copy.infoStripLead}</strong> {copy.infoStripBody}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hinweis schließen"
        className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  )
}
