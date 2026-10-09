import { notFound } from "next/navigation"

import { HairPortraitGallery } from "@/components/quiz/hair-portrait-gallery"
import { isOfferPageLabEnabled } from "@/lib/labs/offer-page-access"

export default function PortraitLabPage() {
  if (!isOfferPageLabEnabled(process.env)) notFound()

  return <HairPortraitGallery />
}
