import type { Metadata } from "next"
import { PublicContractDeclarationForm } from "@/components/billing/public-contract-declaration-form"

export const metadata: Metadata = {
  title: "Vertrag widerrufen · Chaarlie",
  robots: { index: false, follow: true },
}

export default function WithdrawalDeclarationPage() {
  return <PublicContractDeclarationForm mode="withdrawal" />
}
