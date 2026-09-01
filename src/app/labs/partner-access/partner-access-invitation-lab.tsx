"use client"

import { useState } from "react"

import { PartnerInvitationCard } from "@/app/partner/einladung/partner-invitation-client"

export function PartnerAccessInvitationLab() {
  const [mode, setMode] = useState<"ready" | "change_email">("ready")

  return (
    <PartnerInvitationCard
      email="lea@studio-example.de"
      mode={mode}
      name="Lea Sommer"
      onCancel={() => setMode("ready")}
      onChangeEmail={() => setMode("change_email")}
    />
  )
}
