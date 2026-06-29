'use client'

interface Option {
  value: string | number
  label: string
}

interface SelectFilterProps {
  label: string
  value: string | number
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}

export default function SelectFilter({
  label,
  value,
  onChange,
  options,
  placeholder = 'Todas',
  className = '',
}: SelectFilterProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}