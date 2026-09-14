import type { Metadata } from "next"
import { PublicContractDeclarationForm } from "@/components/billing/public-contract-declaration-form"

export const metadata: Metadata = {
  title: "Vertrag kündigen · Chaarlie",
  robots: { index: false, follow: true },
}

export default function CancellationPage() {
  return <PublicContractDeclarationForm mode="cancellation" />
}
