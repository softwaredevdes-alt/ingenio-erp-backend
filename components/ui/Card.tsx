'use client'

import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export default function Card({ 
  children, 
  className = '', 
  padding = 'md' 
}: CardProps) {
  
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }[padding]

  return (
    <div className={`bg-white rounded-2xl shadow ${paddingClasses} ${className}`}>
      {children}
    </div>
  )
}