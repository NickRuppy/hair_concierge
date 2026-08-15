import { notFound } from "next/navigation"

import { ProgrammaticTransitionLab } from "./programmatic-transition-lab"

export default function PersonalPlanViewTransitionLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <ProgrammaticTransitionLab />
}
