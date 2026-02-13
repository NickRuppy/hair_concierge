"use client"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

interface QuizConsentSheetProps {
  open: boolean
  onConsent: (accepted: boolean) => void
}

export function QuizConsentSheet({ open, onConsent }: QuizConsentSheetProps) {
  return (
    <Sheet open={open} onOpenChange={() => onConsent(false)}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-white/10 bg-[#141414] px-6 pb-8 pt-6"
      >
        {/* Envelope icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5C518]/20">
          <span className="text-2xl">✉️</span>
        </div>

        <h3 className="font-header text-center text-xl text-white mb-2">
          DUERFEN WIR DIR HAARPFLEGE-TIPPS SCHICKEN?
        </h3>

        {/* Yellow divider */}
        <div className="mx-auto mb-3 h-0.5 w-10 rounded-full bg-[#F5C518]" />

        <p className="text-center text-sm font-semibold text-white/80 mb-1">
          Experten-Tipps, Produkt-News und exklusive Angebote.
        </p>
        <p className="text-center text-xs text-white/38 mb-6 leading-relaxed">
          Du kannst dich jederzeit abmelden ueber den Link in unseren E-Mails. Unsere Datenschutzerklaerung findest du hier.
        </p>

        <Button
          onClick={() => onConsent(true)}
          className="w-full h-12 text-base font-bold tracking-wide rounded-xl mb-3"
          style={{ background: "linear-gradient(135deg, #F5C518, #D4A800)" }}
        >
          JA, WEITER ZU MEINEM PLAN
        </Button>
        <button
          onClick={() => onConsent(false)}
          className="w-full text-center text-sm text-white/60 underline underline-offset-2 hover:text-white/80 transition-colors"
        >
          Nein, nur meinen Plan schicken
        </button>
      </SheetContent>
    </Sheet>
  )
}
