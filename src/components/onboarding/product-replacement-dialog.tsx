"use client"

export function ProductReplacementDialog({
  disabled,
  onCancel,
  onConfirm,
}: {
  disabled: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 py-6 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-replacement-title"
        className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"
      >
        <h2 id="product-replacement-title" className="mb-2 text-lg font-semibold text-foreground">
          Produkt ersetzen?
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-[var(--text-sub)]">
          Du hast für diese Kategorie bereits ein Produkt hinterlegt. Wenn du fortfährst, ersetzen
          wir den bisherigen Eintrag durch dieses Produkt.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="min-h-[44px] rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className="quiz-btn-primary disabled:opacity-40"
          >
            Produkt ersetzen
          </button>
        </div>
      </div>
    </div>
  )
}
