"use client"

import { useRouter } from "next/navigation"

export function RetryRefreshButtonView({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {label}
    </button>
  )
}

export function RetryRefreshButton({ label }: { label: string }) {
  const router = useRouter()

  return <RetryRefreshButtonView label={label} onRetry={() => router.refresh()} />
}
