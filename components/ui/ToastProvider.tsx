'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import Toast, { ToastType } from './Toast'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastContextType {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    warning: (message: string) => void
    info: (message: string) => void
  }
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = (type: ToastType, message: string) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, type, message }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  const toast = {
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    warning: (message: string) => addToast('warning', message),
    info: (message: string) => addToast('info', message),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      
      {/* Contenedor de Toasts */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toastItem) => (
          <Toast
            key={toastItem.id}
            id={toastItem.id}
            type={toastItem.type}
            message={toastItem.message}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast debe usarse dentro de un ToastProvider')
  }
  return context.toast
}