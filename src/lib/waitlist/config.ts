/** Public constants for the standalone August waitlist. */
export const FOUNDING_COHORT_SIZE = 300
export const LAUNCH_DATE_LABEL = "Sonntag, 9. August"
export const LAUNCH_TIME_LABEL = "10:00 Uhr"
export const LAUNCH_CLOSE_LABEL = "Dienstag, 11. August, 23:59 Uhr"
export const WAITLIST_SURVEY_ID = process.env.NEXT_PUBLIC_WAITLIST_SURVEY_ID ?? "DP6saz3M"
export const WAITLIST_WHATSAPP_URL =
  process.env.NEXT_PUBLIC_WAITLIST_WHATSAPP_URL ??
  "https://chat.whatsapp.com/DFky27pitXN19Lq99Zmafy?s=cl&p=i&mlu=4"
export const WAITLIST_SURVEY_TOKEN_STORAGE_KEY = "chaarlie_waitlist_survey_token"
