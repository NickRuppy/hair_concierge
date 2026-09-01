import { PartnerAccessActivationButton } from "@/components/partner-access/activation-button"

export function PartnerAccessActivationCard({ leadId }: { leadId: string | null }) {
  return (
    <div
      className="mx-auto max-w-xl rounded-[1.75rem] border border-[rgba(var(--brand-plum-rgb),0.13)] bg-white p-6 text-center shadow-[0_22px_54px_-40px_rgba(var(--brand-plum-rgb),0.6)] sm:p-8"
      data-partner-access-activation-card
    >
      <h2 className="font-serif text-3xl leading-tight">Dein Zugang ist bereit.</h2>
      <p className="mx-auto mt-3 max-w-md leading-7 text-[rgba(var(--brand-plum-rgb),0.72)]">
        Öffne jetzt deinen persönlichen Plan und deine Routine.
      </p>
      <PartnerAccessActivationButton
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--brand-plum)] px-6 py-3 font-bold text-white disabled:opacity-60"
        cta="partner_access_activation"
        leadId={leadId}
        showError
        sourceSection="pricing"
      />
    </div>
  )
}
