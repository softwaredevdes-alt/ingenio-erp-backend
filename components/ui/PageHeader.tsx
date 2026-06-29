'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  backLink?: string
  backLabel?: string
  actions?: ReactNode
  subtitle?: string
  centerTitle?: boolean
}

export default function PageHeader({
  title,
  backLink,
  backLabel = '← Volver',
  actions,
  subtitle,
  centerTitle = false,
}: PageHeaderProps) {
  if (centerTitle) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {/* Izquierda */}
          <div>
            {backLink && (
              <Link 
                href={backLink} 
                className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {backLabel}
              </Link>
            )}
          </div>

          {/* Centro - Título centrado */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
          </div>

          {/* Derecha - Acciones */}
          <div>
            {actions}
          </div>
        </div>
      </div>
    )
  }

  // Versión normal (sin centrar)
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {backLink && (
            <Link href={backLink} className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium mb-1">
              {backLabel}
            </Link>
          )}
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>

        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}