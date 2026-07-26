export const DISPLAY_FIRST_NAME_MAX_LENGTH = 60

export function formatDisplayFirstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0]?.slice(0, DISPLAY_FIRST_NAME_MAX_LENGTH) ?? ""
}
