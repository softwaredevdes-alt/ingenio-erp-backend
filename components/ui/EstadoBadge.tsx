'use client'

interface EstadoBadgeProps {
  estado: string
  editable?: boolean
  onChange?: (nuevoEstado: string) => void
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

const estadoConfig: Record<string, { label: string; color: string; icon: string }> = {
  en_progreso: { label: 'En Progreso', color: 'bg-blue-100 text-blue-700 border-blue-200',    icon: '🔄' },
  finalizada:  { label: 'Finalizada',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✅' },
  pausada:     { label: 'Pausada',     color: 'bg-amber-100 text-amber-700 border-amber-200',    icon: '⏸️' },
  cancelada:   { label: 'Cancelada',   color: 'bg-red-100 text-red-700 border-red-200',       icon: '❌' },
}

export default function EstadoBadge({ 
  estado, 
  editable = false, 
  onChange, 
  size = 'md',
  showIcon = true 
}: EstadoBadgeProps) {
  
  const config = estadoConfig[estado] || {
    label: estado,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: '📄',
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5',
  }[size]

  if (editable && onChange) {
    return (
      <select
        value={estado}
        onChange={(e) => onChange(e.target.value)}
        className={`${sizeClasses} font-medium rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${config.color}`}
      >
        {Object.entries(estadoConfig).map(([key, value]) => (
          <option key={key} value={key}>
            {value.icon} {value.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <span className={`${sizeClasses} font-medium rounded-full border inline-flex items-center gap-1.5 ${config.color}`}>
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  )
}