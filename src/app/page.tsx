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

export default function Home() {
  return (
    <>
      <LandingTracking />
      <LandingHeader />
      <main className="pb-[84px] md:pb-0">
        <Hero />
        <PainStrip />
        <WhatYouGet />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <StickyQuizCta />
    </>
  )
}
