'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export default function ActionButton({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ActionButtonProps) {
  
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const variantClasses = {
    primary:   'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700',
    danger:    'bg-red-600 hover:bg-red-700 text-white',
    success:   'bg-emerald-600 hover:bg-emerald-700 text-white',
    ghost:     'hover:bg-gray-100 text-gray-700',
  }[variant]

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size]

  return (
    <button 
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`} 
      {...props}
    >
      {children}
    </button>
  )
}