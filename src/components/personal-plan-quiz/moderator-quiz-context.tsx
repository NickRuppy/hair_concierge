"use client"

import { createContext, useContext, type ReactNode } from "react"

export type ModeratorQuizContext = { scope: string; email: string }
const ModeratorContext = createContext<ModeratorQuizContext | null>(null)

export function ModeratorQuizProvider({
  value,
  children,
}: {
  value: ModeratorQuizContext | null
  children: ReactNode
}) {
  return <ModeratorContext.Provider value={value}>{children}</ModeratorContext.Provider>
}

export function useModeratorQuiz() {
  return useContext(ModeratorContext)
}
