import { handleAppStoreNotificationPost } from "@/lib/app-store/notifications"

// Public App Store Server Notifications V2 endpoint, deliberately outside the mobile
// policy gate: Apple must reach it whether or not the mobile API is enabled.
export const runtime = "nodejs"

export async function POST(request: Request) {
  return handleAppStoreNotificationPost(request)
}
