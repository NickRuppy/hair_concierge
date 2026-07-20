import { loadStripe } from "@stripe/stripe-js/pure"
import type { Stripe } from "@stripe/stripe-js"

type StripeLoader = (publishableKey: string) => Promise<Stripe | null>

const unloadedStripePromise = Promise.resolve(null)
let offerStripePromise: Promise<Stripe | null> | null = null

export function getOfferStripePromise(loader: StripeLoader = loadStripe): Promise<Stripe | null> {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey) return unloadedStripePromise

  if (!offerStripePromise) {
    const promise = loader(publishableKey)
    promise.catch(() => {
      if (offerStripePromise === promise) offerStripePromise = null
    })
    offerStripePromise = promise
  }

  return offerStripePromise
}

export function warmOfferStripe(): void {
  void getOfferStripePromise()
}

export function resetOfferStripePromiseForTests(): void {
  offerStripePromise = null
}
