import { createClient } from "@/lib/supabase/client"

export async function mergeAnsweredFields(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fieldNames: string[]
): Promise<string[]> {
  const { data } = await supabase
    .from("hair_profiles")
    .select("answered_fields")
    .eq("user_id", userId)
    .single()
  const current = (data?.answered_fields as string[]) ?? []
  return [...new Set([...current, ...fieldNames])]
}
