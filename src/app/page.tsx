import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing/landing-header"
import { Hero } from "@/components/landing/hero"
import { PainStrip } from "@/components/landing/pain-strip"
import { WhatYouGet } from "@/components/landing/what-you-get"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Faq } from "@/components/landing/faq"
import { FinalCta } from "@/components/landing/final-cta"
import { SiteFooter } from "@/components/landing/site-footer"
import { StickyQuizCta } from "@/components/landing/sticky-quiz-cta"
import { LandingTracking } from "@/providers/route-providers"
import { JsonLd } from "@/components/seo/json-ld"
import { HOME_METADATA, ORGANIZATION_JSON_LD, WEBSITE_JSON_LD } from "@/lib/seo/site-identity"

export const metadata: Metadata = HOME_METADATA

export default function Home() {
  return (
    <>
      <JsonLd data={ORGANIZATION_JSON_LD} />
      <JsonLd data={WEBSITE_JSON_LD} />
      <LandingTracking />
      <LandingHeader />
      <div className="pb-[var(--landing-sticky-cta-clearance)] md:pb-0">
        <main>
          <Hero />
          <PainStrip />
          <WhatYouGet />
          <HowItWorks />
          <Faq />
          <FinalCta />
        </main>
        <SiteFooter />
      </div>
      <StickyQuizCta />
    </>
  )
}
