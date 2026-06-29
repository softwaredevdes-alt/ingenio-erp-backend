'use client'

import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  id: string
  type: ToastType
  message: string
  onClose: (id: string) => void
}

const toastStyles: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white',
  error:   'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  info:    'bg-blue-600 text-white',
}

const icons: Record<ToastType, string> = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
}

export default function Toast({ id, type, message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, 4000) // Auto close después de 4 segundos

    return () => clearTimeout(timer)
  }, [id, onClose])

  return (
    <div className={`${toastStyles[type]} px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[280px]`}>
      <span className="text-lg">{icons[type]}</span>
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button 
        onClick={() => onClose(id)} 
        className="text-white/70 hover:text-white ml-2"
      >
        ✕
      </button>
    </div>
  )
}