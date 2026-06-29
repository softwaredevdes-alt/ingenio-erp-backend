'use client'

import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
  className?: string
}

export default function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  className = '' 
}: BadgeProps) {
  
  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    danger:  'bg-red-100 text-red-700 border-red-200',
    info:    'bg-blue-100 text-blue-700 border-blue-200',
  }[variant]

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-3 py-1'

  return (
    <span className={`${sizeClasses} font-medium rounded-full border inline-flex items-center ${variantClasses} ${className}`}>
      {children}
    </span>
  )
}