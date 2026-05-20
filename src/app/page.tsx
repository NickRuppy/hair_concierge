import { LandingHeader } from "@/components/landing/landing-header"
import { Hero } from "@/components/landing/hero"
import { WhatIs } from "@/components/landing/what-is"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Features } from "@/components/landing/features"
import { Pricing } from "@/components/landing/pricing"
import { Faq } from "@/components/landing/faq"
import { FinalCta } from "@/components/landing/final-cta"
import { SiteFooter } from "@/components/landing/site-footer"

export default function Home() {
  return (
    <>
      <LandingHeader />
      <main>
        <Hero />
        <WhatIs />
        <HowItWorks />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  )
}
