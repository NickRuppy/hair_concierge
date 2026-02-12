"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/providers/toast-provider"
import type { Profile, HairProfile } from "@/lib/types"

interface UserWithHairProfile extends Profile {
  hair_profiles?: HairProfile[]
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithHairProfile[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  async function loadUsers() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/users")
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler beim Laden")
      }
      const data = await res.json()
      setUsers(data.users)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden der Nutzer"
      toast({ title: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getHairSummary(user: UserWithHairProfile): string | null {
    const hp = user.hair_profiles?.[0]
    if (!hp) return null

    const parts: string[] = []
    if (hp.hair_type) {
      parts.push(hp.hair_type.charAt(0).toUpperCase() + hp.hair_type.slice(1))
    }
    if (hp.concerns && hp.concerns.length > 0) {
      parts.push(`${hp.concerns.length} Probleme`)
    }
    if (hp.goals && hp.goals.length > 0) {
      parts.push(`${hp.goals.length} Ziele`)
    }
    return parts.length > 0 ? parts.join(" / ") : null
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nutzer</h1>
        <span className="text-sm text-muted-foreground">
          {!loading && `${users.length} Nutzer insgesamt`}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">Noch keine Nutzer vorhanden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Admin</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Onboarding</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Haarprofil</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Erstellt am</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const hairSummary = getHairSummary(user)
                return (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {user.full_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.is_admin
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {user.is_admin ? "Admin" : "Nutzer"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.onboarding_completed
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {user.onboarding_completed ? "Abgeschlossen" : `Schritt ${user.onboarding_step}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {hairSummary ? (
                        <span className="text-xs">{hairSummary}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Kein Profil</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
