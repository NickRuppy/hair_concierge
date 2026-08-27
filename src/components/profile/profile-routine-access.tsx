"use client"

import { createContext, useContext, type ReactNode } from "react"

/**
 * Server-resolved „does this user see the Routine tab" fact, handed to the
 * client Profil page (Task 2.5, review round 1). The layout already loads the
 * cached navigation access for the shell, so this costs no extra read.
 *
 * Defaults to `false`: a surface that has not been given the fact must not
 * assume the user has reached Stage 4.
 */
const ProfileRoutineAccessContext = createContext(false)

export function ProfileRoutineAccessProvider({
  hasRoutineAccess,
  children,
}: {
  hasRoutineAccess: boolean
  children: ReactNode
}) {
  return (
    <ProfileRoutineAccessContext.Provider value={hasRoutineAccess}>
      {children}
    </ProfileRoutineAccessContext.Provider>
  )
}

export function useProfileRoutineAccess(): boolean {
  return useContext(ProfileRoutineAccessContext)
}
