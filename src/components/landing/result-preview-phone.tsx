// src/components/landing/result-preview-phone.tsx
// Static hero preview of the quiz result screen (mirrors the real
// transformation card + lever card so the promise matches the product).
export function ResultPreviewPhone() {
  return (
    <div aria-hidden="true" className="flex justify-center">
      <div className="w-[300px] rounded-[36px] bg-[var(--brand-plum-darkest)] p-[10px] shadow-[0_30px_80px_-20px_rgba(42,24,69,0.4)] lg:w-[320px]">
        <div className="overflow-hidden rounded-[28px] bg-white">
          <div className="grid h-[22px] place-items-center">
            <span className="block h-[7px] w-[84px] rounded-full bg-[#efeae5]" />
          </div>
          <div className="bg-background px-3.5 pb-[18px] pt-3.5">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--brand-plum)]">
              So sieht dein Ergebnis aus
            </p>
            <p className="mb-2.5 font-header text-[14.5px] font-medium uppercase leading-[1.25] text-[var(--brand-plum-darkest)]">
              So kommen wir deinem Haarziel näher
            </p>

            <div className="relative grid grid-cols-2 overflow-hidden rounded-[14px] border border-black/5 bg-white">
              <div className="bg-[linear-gradient(180deg,var(--brand-coral-light)_0%,#FBDDE0_100%)] py-2.5 pl-[11px] pr-[26px]">
                <h4 className="mb-2 font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--brand-coral-dark)]">
                  Heute
                </h4>
                <p className="mb-[9px] font-header text-[11px] italic leading-[1.3] text-[#6B3439]">
                  wenig Feuchtigkeit
                </p>
                <p className="font-header text-[11px] italic leading-[1.3] text-[#6B3439]">
                  wenig Kontrolle
                </p>
              </div>
              <div className="bg-[linear-gradient(180deg,#E8F4ED_0%,#D2EBDB_100%)] py-2.5 pl-[26px] pr-[11px]">
                <h4 className="mb-2 font-mono text-[8px] uppercase tracking-[0.14em] text-[#2D8A57]">
                  In 4 Wochen
                </h4>
                <p className="mb-[9px] font-header text-[11px] font-medium italic leading-[1.3] text-[#1F4D33]">
                  mehr Elastizität &amp; Geschmeidigkeit
                </p>
                <p className="font-header text-[11px] font-medium italic leading-[1.3] text-[#1F4D33]">
                  mehr Kontrolle
                </p>
              </div>
              <span className="absolute left-1/2 top-1/2 grid size-[30px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[14px] font-bold text-[#2D8A57] shadow-[0_6px_16px_-8px_rgba(45,138,87,0.5),0_0_0_3px_rgba(255,255,255,0.9)]">
                →
              </span>
            </div>

            <div className="mt-2.5 rounded-[14px] border border-black/5 bg-white px-3 py-[11px]">
              <p className="mb-[5px] font-mono text-[7.5px] uppercase tracking-[0.18em] text-[var(--brand-plum)]">
                Was dein Haar jetzt braucht
              </p>
              <p className="mb-2 font-header text-[13.5px] font-medium text-[var(--brand-plum-darkest)]">
                Feuchtigkeit gezielt aufbauen
              </p>
              <div className="mt-1.5 flex items-start gap-[7px]">
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[var(--brand-coral-light)] text-[9px] font-bold text-[var(--brand-coral-dark)]">
                  ★
                </span>
                <div>
                  <p className="text-[10.5px] font-semibold leading-[1.3] text-[var(--brand-plum-darkest)]">
                    Feuchtigkeits-Maske
                  </p>
                  <p className="text-[9.5px] leading-[1.35] text-muted-foreground">
                    Baut Elastizität in den Längen wieder auf.
                  </p>
                </div>
              </div>
              <div className="mt-1.5 flex items-start gap-[7px]">
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[var(--brand-plum-ice)] text-[9px] font-bold text-[var(--brand-plum)]">
                  +
                </span>
                <div>
                  <p className="text-[10.5px] font-semibold leading-[1.3] text-[var(--brand-plum-darkest)]">
                    Leichtes Leave-in
                  </p>
                  <p className="text-[9.5px] leading-[1.35] text-muted-foreground">
                    Hält die Feuchtigkeit zwischen den Wäschen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
