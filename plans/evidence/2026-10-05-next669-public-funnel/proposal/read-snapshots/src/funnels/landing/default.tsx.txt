import { Faq } from "@/components/landing/faq"
import { FinalCta } from "@/components/landing/final-cta"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { LandingHeader } from "@/components/landing/landing-header"
import { PainStrip } from "@/components/landing/pain-strip"
import { SiteFooter } from "@/components/landing/site-footer"
import { StickyQuizCta } from "@/components/landing/sticky-quiz-cta"
import { WhatYouGet } from "@/components/landing/what-you-get"

export default function DefaultLandingVariant() {
  return (
    <>
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
