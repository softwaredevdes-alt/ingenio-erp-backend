'use client'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export default function Loading({ 
  size = 'md', 
  text, 
  fullScreen = false 
}: LoadingProps) {
  
  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }[size]

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div 
        className={`${sizeClasses} animate-spin rounded-full border-4 border-gray-200 border-t-blue-600`} 
      />
      {text && (
        <p className="text-sm text-gray-500">{text}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
        {spinner}
      </div>
    )
  }

  return spinner
}