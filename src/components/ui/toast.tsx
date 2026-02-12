"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

// --- Toast types ---

type ToastVariant = "default" | "destructive"

interface ToastData {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastState {
  toasts: ToastData[]
}

type ToastAction =
  | { type: "ADD_TOAST"; toast: ToastData }
  | { type: "REMOVE_TOAST"; id: string }

// --- Reducer ---

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "ADD_TOAST":
      return { ...state, toasts: [...state.toasts, action.toast] }
    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      }
    default:
      return state
  }
}

// --- Global state for hook ---

let globalDispatch: React.Dispatch<ToastAction> = () => {}
let toastCount = 0

function generateId() {
  toastCount += 1
  return `toast-${toastCount}`
}

// --- useToast hook ---

function useToast() {
  const toast = React.useCallback(
    ({
      title,
      description,
      variant = "default",
      duration = 5000,
    }: Omit<ToastData, "id">) => {
      const id = generateId()
      globalDispatch({ type: "ADD_TOAST", toast: { id, title, description, variant, duration } })
      return id
    },
    []
  )

  const dismiss = React.useCallback((id: string) => {
    globalDispatch({ type: "REMOVE_TOAST", id })
  }, [])

  return { toast, dismiss }
}

// --- Toast Provider ---

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] })

  React.useEffect(() => {
    globalDispatch = dispatch
    return () => {
      globalDispatch = () => {}
    }
  }, [dispatch])

  return (
    <>
      {children}
      <ToastViewport toasts={state.toasts} dispatch={dispatch} />
    </>
  )
}

// --- Toast Viewport ---

interface ToastViewportProps {
  toasts: ToastData[]
  dispatch: React.Dispatch<ToastAction>
}

function ToastViewport({ toasts, dispatch }: ToastViewportProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} dispatch={dispatch} />
      ))}
    </div>,
    document.body
  )
}

// --- Individual Toast ---

interface ToastProps {
  toast: ToastData
  dispatch: React.Dispatch<ToastAction>
}

function Toast({ toast, dispatch }: ToastProps) {
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch({ type: "REMOVE_TOAST", id: toast.id })
    }, toast.duration || 5000)
    return () => clearTimeout(timeout)
  }, [toast, dispatch])

  return (
    <div
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border border-border p-4 shadow-lg transition-all",
        toast.variant === "destructive"
          ? "border-destructive bg-destructive text-destructive-foreground"
          : "bg-background text-foreground"
      )}
    >
      <div className="grid gap-1">
        {toast.title && (
          <div className="text-sm font-semibold">{toast.title}</div>
        )}
        {toast.description && (
          <div className="text-sm opacity-90">{toast.description}</div>
        )}
      </div>
      <button
        onClick={() => dispatch({ type: "REMOVE_TOAST", id: toast.id })}
        className="absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export { ToastProvider, useToast, type ToastData }
