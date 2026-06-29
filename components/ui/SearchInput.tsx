'use client'

import { useState, useEffect } from 'react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  debounceMs = 300,
  className = '',
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(value)

  // Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(internalValue)
    }, debounceMs)

    return () => {
      clearTimeout(handler)
    }
  }, [internalValue, debounceMs, onChange])

  // Sincronizar si el valor externo cambia
  useEffect(() => {
    setInternalValue(value)
  }, [value])

  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        🔍
      </div>
      <input
        type="text"
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {internalValue && (
        <button
          onClick={() => {
            setInternalValue('')
            onChange('')
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      )}
    </div>
  )
}