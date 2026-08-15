import { notFound } from "next/navigation"

import { applicationDayTypeKeySchema } from "@/lib/routines/personal-plan/application/contracts"

import PersonalPlanApplicationLabPage from "../page"

export default async function PersonalPlanApplicationDayLabPage({
  params,
}: {
  params: Promise<{ dayType: string }>
}) {
  const { dayType } = await params
  if (!applicationDayTypeKeySchema.safeParse(dayType).success) notFound()
  return <PersonalPlanApplicationLabPage />
}
