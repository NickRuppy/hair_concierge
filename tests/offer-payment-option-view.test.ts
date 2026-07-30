import assert from "node:assert/strict"
import test from "node:test"

import {
  claimOfferPaymentOptionView,
  isOfferPaymentOptionViewEligible,
  observeOfferPaymentOptionView,
  OFFER_PAYMENT_OPTION_VIEW_DWELL_MS,
  OFFER_PAYMENT_OPTION_VIEW_THRESHOLD,
} from "../src/lib/analytics/offer-payment-option-view"

test("payment option exposure requires an open attempt, readiness, availability, and visibility", () => {
  const readyAndVisible = {
    available: true,
    checkoutAttemptId: "attempt-1",
    providerReady: true,
    visible: true,
  }

  assert.equal(isOfferPaymentOptionViewEligible(readyAndVisible), true)
  assert.equal(
    isOfferPaymentOptionViewEligible({ ...readyAndVisible, visible: false }),
    false,
    "hidden prewarm must not qualify",
  )
  assert.equal(
    isOfferPaymentOptionViewEligible({ ...readyAndVisible, available: false }),
    false,
    "unavailable options must not qualify",
  )
  assert.equal(
    isOfferPaymentOptionViewEligible({ ...readyAndVisible, providerReady: false }),
    false,
    "loading or failed providers must not qualify",
  )
  assert.equal(
    isOfferPaymentOptionViewEligible({ ...readyAndVisible, checkoutAttemptId: null }),
    false,
  )
})

test("payment option exposure requires continuous 50% visibility for 750 ms", () => {
  const element = {} as Element
  let observerCallback: IntersectionObserverCallback | undefined
  let observerThreshold: number | number[] | undefined
  let scheduled: (() => void) | undefined
  let tracked = 0
  let disconnected = 0
  const listeners = new Set<EventListenerOrEventListenerObject>()
  const documentTarget = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener: (_name: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener)
    },
    removeEventListener: (_name: string, listener: EventListenerOrEventListenerObject) => {
      listeners.delete(listener)
    },
  }

  class FakeObserver {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      observerCallback = callback
      observerThreshold = options?.threshold
    }
    observe() {}
    disconnect() {
      disconnected += 1
    }
  }

  observeOfferPaymentOptionView(
    element,
    () => {
      tracked += 1
    },
    {
      documentTarget,
      Observer: FakeObserver,
      setTimer: ((callback: TimerHandler, delay?: number) => {
        assert.equal(delay, OFFER_PAYMENT_OPTION_VIEW_DWELL_MS)
        scheduled = callback as () => void
        return 1
      }) as typeof setTimeout,
      clearTimer: (() => {
        scheduled = undefined
      }) as typeof clearTimeout,
    },
  )

  assert.equal(observerThreshold, OFFER_PAYMENT_OPTION_VIEW_THRESHOLD)
  observerCallback?.(
    [
      {
        intersectionRatio: 0.49,
        isIntersecting: true,
        target: element,
      } as IntersectionObserverEntry,
    ],
    {} as IntersectionObserver,
  )
  assert.equal(scheduled, undefined)

  observerCallback?.(
    [
      {
        intersectionRatio: 0.5,
        isIntersecting: true,
        target: element,
      } as IntersectionObserverEntry,
    ],
    {} as IntersectionObserver,
  )
  assert.ok(scheduled)
  const fire = scheduled as (() => void) | undefined
  fire?.()
  assert.equal(tracked, 1)
  assert.equal(listeners.size, 0)
  assert.ok(disconnected >= 1)
})

test("payment option exposure cancels pending dwell while checkout is occluded and re-arms after it is visible", () => {
  const element = {} as Element
  const observerCallbacks: IntersectionObserverCallback[] = []
  const timers = new Map<number, () => void>()
  let timerId = 0
  let tracked = 0
  let cleared = 0
  const documentTarget = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener() {},
    removeEventListener() {},
  }

  class FakeObserver {
    constructor(callback: IntersectionObserverCallback) {
      observerCallbacks.push(callback)
    }
    observe() {}
    disconnect() {}
  }

  const options = {
    documentTarget,
    Observer: FakeObserver,
    setTimer: ((callback: TimerHandler) => {
      const id = ++timerId
      timers.set(id, callback as () => void)
      return id
    }) as typeof setTimeout,
    clearTimer: ((id: number) => {
      cleared += 1
      timers.delete(id)
    }) as typeof clearTimeout,
  }
  const markVisible = (callback: IntersectionObserverCallback) =>
    callback(
      [
        {
          intersectionRatio: OFFER_PAYMENT_OPTION_VIEW_THRESHOLD,
          isIntersecting: true,
          target: element,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )

  const stopOccludedObservation = observeOfferPaymentOptionView(
    element,
    () => {
      tracked += 1
    },
    options,
  )
  markVisible(observerCallbacks[0])
  assert.equal(timers.size, 1, "ready+visible begins the dwell timer")

  // The overlay's visibility gate removes this observer when its confirmation
  // dialog covers checkout. The cancelled callback therefore cannot emit.
  stopOccludedObservation()
  assert.equal(cleared, 1)
  assert.equal(timers.size, 0)
  assert.equal(tracked, 0)

  const stopRestoredObservation = observeOfferPaymentOptionView(
    element,
    () => {
      tracked += 1
    },
    options,
  )
  markVisible(observerCallbacks[1])
  assert.equal(timers.size, 1, "dwell restarts only after checkout is visible again")
  for (const callback of timers.values()) callback()
  assert.equal(tracked, 1)
  stopRestoredObservation()
})

test("payment option exposure dedupes by checkout attempt and option", () => {
  const seen = new Set<string>()

  assert.equal(claimOfferPaymentOptionView(seen, "attempt-1", "apple_pay"), true)
  assert.equal(claimOfferPaymentOptionView(seen, "attempt-1", "apple_pay"), false)
  assert.equal(claimOfferPaymentOptionView(seen, "attempt-1", "paypal"), true)
  assert.equal(claimOfferPaymentOptionView(seen, "attempt-2", "apple_pay"), true)
})

test("payment option exposure revokes Apple Pay eligibility when readiness is lost", () => {
  const applePayReady = {
    available: true,
    checkoutAttemptId: "attempt-1",
    providerReady: true,
    visible: true,
  }

  assert.equal(isOfferPaymentOptionViewEligible(applePayReady), true)
  assert.equal(
    isOfferPaymentOptionViewEligible({ ...applePayReady, available: false }),
    false,
    "an unavailable Apple Pay method must cancel a pending exposure",
  )
  assert.equal(
    isOfferPaymentOptionViewEligible({ ...applePayReady, providerReady: false }),
    false,
    "an Apple Pay provider failure must cancel a pending exposure",
  )
})

test("ready and visible card and more is eligible only while the provider remains ready", () => {
  const cardAndMoreReady = {
    available: true,
    checkoutAttemptId: "attempt-1",
    providerReady: true,
    visible: true,
  }

  assert.equal(isOfferPaymentOptionViewEligible(cardAndMoreReady), true)
  assert.equal(
    isOfferPaymentOptionViewEligible({ ...cardAndMoreReady, visible: false }),
    false,
    "the hidden overlay prewarm must not count card and more",
  )
  assert.equal(
    isOfferPaymentOptionViewEligible({ ...cardAndMoreReady, available: false }),
    false,
    "a failed card and more provider must not count",
  )
})
