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

/**
 * Server-resolved „a Personal Plan row exists for this user" fact (central
 * profile PR2): the profile editors only announce the plan recompute for these
 * users. Defaults to `false`, like the routine fact above.
 */
const ProfileHasPersonalPlanContext = createContext(false)

const ProfilePlanMigrationAvailableContext = createContext(false)

export function ProfileRoutineAccessProvider({
  hasRoutineAccess,
  hasPersonalPlan = false,
  planMigrationAvailable = false,
  children,
}: {
  hasRoutineAccess: boolean
  hasPersonalPlan?: boolean
  planMigrationAvailable?: boolean
  children: ReactNode
}) {
  return (
    <ProfileRoutineAccessContext.Provider value={hasRoutineAccess}>
      <ProfileHasPersonalPlanContext.Provider value={hasPersonalPlan}>
        <ProfilePlanMigrationAvailableContext.Provider value={planMigrationAvailable}>
          {children}
        </ProfilePlanMigrationAvailableContext.Provider>
      </ProfileHasPersonalPlanContext.Provider>
    </ProfileRoutineAccessContext.Provider>
  )
}

export function useProfileRoutineAccess(): boolean {
  return useContext(ProfileRoutineAccessContext)
}

export function useProfileHasPersonalPlan(): boolean {
  return useContext(ProfileHasPersonalPlanContext)
}

export function useProfilePlanMigrationAvailable(): boolean {
  return useContext(ProfilePlanMigrationAvailableContext)
}
