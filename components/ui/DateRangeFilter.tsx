'use client'

interface DateRangeFilterProps {
  label?: string
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
  className?: string
}

export default function DateRangeFilter({
  label = 'Rango de Fechas',
  startDate,
  endDate,
  onChange,
  className = '',
}: DateRangeFilterProps) {
  const handleStartChange = (value: string) => {
    onChange(value, endDate)
  }

  const handleEndChange = (value: string) => {
    onChange(startDate, value)
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {/* Fecha Inicio */}
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[10px] text-gray-400 mt-0.5 ml-1">Desde</p>
        </div>

        {/* Fecha Fin */}
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleEndChange(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[10px] text-gray-400 mt-0.5 ml-1">Hasta</p>
        </div>
      </div>
    </div>
  )
}