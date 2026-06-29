'use client'

import { ReactNode } from 'react'

interface FilterBarProps {
  children: ReactNode
  onClear?: () => void
  showClearButton?: boolean
  className?: string
}

export default function FilterBar({ 
  children, 
  onClear, 
  showClearButton = true,
  className = '' 
}: FilterBarProps) {
  return (
    <div className={`bg-white rounded-2xl shadow p-4 mb-6 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {children}
        </div>

        {showClearButton && onClear && (
          <div className="flex items-end">
            <button
              onClick={onClear}
              className="w-full lg:w-auto px-5 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        )}
      </div>
    </div>
  )
}