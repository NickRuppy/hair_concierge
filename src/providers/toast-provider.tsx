"use client"

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

interface Toast {
  id: string
  title: string
  description?: string
  variant?: "default" | "destructive"
}

interface ToastContextType {
  toasts: Toast[]
  toast: (t: Omit<Toast, "id">) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
})

const subscribeToClientReady = () => () => {}
const getClientReadySnapshot = () => true
const getServerReadySnapshot = () => false

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  )
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 5000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      {mounted
        ? createPortal(
            <div
              data-modal-layer-exempt
              aria-live="polite"
              className="fixed bottom-4 right-4 z-[130] flex flex-col gap-2"
            >
              {toasts.map((t) => (
                <div
                  key={t.id}
                  role={t.variant === "destructive" ? "alert" : "status"}
                  className={`animate-in slide-in-from-bottom-5 rounded-lg border px-4 py-3 shadow-lg ${
                    t.variant === "destructive"
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "border-border bg-card text-card-foreground"
                  }`}
                >
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.description && <p className="text-sm opacity-80">{t.description}</p>}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
