/**
 * Maps protein_moisture_balance profile value to product concern codes
 * used in the `suitable_concerns` column and chunk metadata.
 */
export function mapProteinMoistureToConcernCode(
  proteinMoistureBalance?: string | null
): string | null {
  if (proteinMoistureBalance === "snaps") return "feuchtigkeit"
  if (proteinMoistureBalance === "stretches_stays") return "protein"
  // stretches_bounces = balanced -> no specific concern filter needed
  return null
}
