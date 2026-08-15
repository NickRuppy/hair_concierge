"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import type { ApplicationRecoveryKind, ApplicationRecoveryView } from "./application-types"

const STATE_COPY: Record<
  ApplicationRecoveryKind,
  {
    title: string
    description: string
    actionLabel: string
    actionHref: string | null
    secondaryHref?: string
    secondaryLabel?: string
  }
> = {
  feature_disabled: {
    title: "Anwendung gerade nicht verfügbar",
    description:
      "Deine Routine bleibt verfügbar. Die Anleitung wird erst angezeigt, wenn Anwendung freigeschaltet ist.",
    actionLabel: "Zur Routine",
    actionHref: "/routine",
  },
  not_ready: {
    title: "Anwendung noch nicht bereit",
    description:
      "Die Anleitung erscheint erst, wenn deine bestätigte Routine sicher verbunden ist.",
    actionLabel: "Zur Routine",
    actionHref: "/routine",
  },
  no_active_routine: {
    title: "Bestätige zuerst deine Routine",
    description:
      "Anwendung nutzt nur Produkte, die in deiner bestätigten Routine wirklich einsatzbereit sind.",
    actionLabel: "Routine prüfen",
    actionHref: "/routine",
  },
  unavailable: {
    title: "Anwendung gerade nicht verfügbar",
    description:
      "Deine Routine ist unverändert. Du kannst es erneut versuchen oder zurück zu deiner Routine gehen.",
    actionLabel: "Erneut laden",
    actionHref: null,
    secondaryHref: "/routine",
    secondaryLabel: "Zur Routine",
  },
}

const DAY_UNAVAILABLE_COPY = {
  title: "Dieser Anwendungstag ist gerade nicht verfügbar",
  description: "Deine Routine bleibt unverändert. Wähle einen verfügbaren Tag in der Übersicht.",
  actionLabel: "Zur Übersicht",
  actionHref: null,
  secondaryHref: undefined,
  secondaryLabel: undefined,
} as const

export function ApplicationState({ view }: { view: ApplicationRecoveryView }) {
  const directDayRecovery = view.state === "day_unavailable"
  const copy = directDayRecovery ? DAY_UNAVAILABLE_COPY : STATE_COPY[view.state]

  return (
    <section
      aria-labelledby="application-state-title"
      className="mx-auto flex min-h-[calc(100dvh-var(--personal-plan-shell-bottom-padding,0px))] w-full max-w-xl flex-col justify-center px-4 py-10 text-center sm:px-6"
    >
      <div className="rounded-md border border-[var(--brand-plum-light)] bg-card px-5 py-6 shadow-[0_16px_44px_-34px_rgba(var(--brand-plum-rgb),0.72)]">
        <p className="type-overline mb-3 text-[var(--text-caption)]">Anwendung</p>
        <h1 id="application-state-title" className="type-h1 text-[var(--text-heading)]">
          {copy.title}
        </h1>
        <p className="type-body-sm mx-auto mt-3 max-w-md text-[var(--text-sub)]">
          {copy.description}
        </p>
        {directDayRecovery ? (
          <Link
            href={view.overviewHref}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {copy.actionLabel}
          </Link>
        ) : copy.actionHref ? (
          <Link
            href={copy.actionHref}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {copy.actionLabel}
          </Link>
        ) : (
          <>
            <ApplicationRetryButton label={copy.actionLabel} />
            {copy.secondaryHref && copy.secondaryLabel ? (
              <Link
                href={copy.secondaryHref}
                className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-[12px] border-[1.5px] border-primary px-5 text-sm font-semibold text-primary hover:bg-muted"
              >
                {copy.secondaryLabel}
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

function ApplicationRetryButton({ label }: { label: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {label}
    </button>
  )
}
