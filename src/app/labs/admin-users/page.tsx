import { notFound } from "next/navigation"
import AdminUsersPage from "@/app/admin/users/page"

export default function AdminUsersLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return (
    <main className="min-w-0 p-6">
      <AdminUsersPage />
    </main>
  )
}
