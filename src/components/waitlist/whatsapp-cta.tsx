"use client"

import { trackAppEvent } from "@/lib/analytics/track-app-event"

export function WhatsAppCta({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackAppEvent("waitlist_whatsapp_clicked", { surface: "thank_you" })}
      className="inline-flex w-full max-w-sm items-center justify-center rounded-[10px] bg-[#25d366] px-6 py-4 text-base font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25d366] focus-visible:ring-offset-2"
    >
      Der WhatsApp-Community beitreten
    </a>
  )
}
