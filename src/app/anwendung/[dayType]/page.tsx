import { notFound } from "next/navigation"
import AnwendungPage from "../page"
import { applicationDayTypeKeySchema } from "@/lib/routines/personal-plan/application/contracts"

export default async function AnwendungDayPage({
  params,
}: {
  params: Promise<{ dayType: string }>
}) {
  const { dayType } = await params
  const parsed = applicationDayTypeKeySchema.safeParse(dayType)
  if (!parsed.success) notFound()
  return <AnwendungPage selectedDayType={parsed.data} />
}
