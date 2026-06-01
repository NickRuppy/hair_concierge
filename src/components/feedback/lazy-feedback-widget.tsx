"use client"

import dynamic from "next/dynamic"

const FeedbackWidget = dynamic(
  () => import("@/components/feedback/feedback-widget").then((mod) => mod.FeedbackWidget),
  {
    loading: () => null,
    ssr: false,
  },
)

export function LazyFeedbackWidget() {
  return <FeedbackWidget />
}
