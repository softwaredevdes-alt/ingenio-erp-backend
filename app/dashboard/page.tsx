'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [obras, setObras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data } = await supabase.from('obras').select('*').limit(10)
    setObras(data || [])
    setLoading(false)
  }

  const curvaSData = [
    { mes: 'Ene', presupuestado: 0, programado: 5, ejecutado: 3 },
    { mes: 'Feb', presupuestado: 15, programado: 18, ejecutado: 14 },
    { mes: 'Mar', presupuestado: 30, programado: 32, ejecutado: 28 },
    { mes: 'Abr', presupuestado: 50, programado: 48, ejecutado: 45 },
    { mes: 'May', presupuestado: 70, programado: 68, ejecutado: 70 },
    { mes: 'Jun', presupuestado: 90, programado: 88, ejecutado: 85 },
    { mes: 'Jul', presupuestado: 100, programado: 100, ejecutado: 92 },
  ]

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">Dashboard Ejecutivo - IngenioERP</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <p className="text-sm text-gray-600">Obras Activas</p>
          <p className="text-3xl font-bold text-blue-600">{obras.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <p className="text-sm text-gray-600">Avance Físico Promedio</p>
          <p className="text-3xl font-bold text-green-600">87%</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <p className="text-sm text-gray-600">Avance Financiero</p>
          <p className="text-3xl font-bold text-yellow-600">82%</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <p className="text-sm text-gray-600">Rentabilidad Promedio</p>
          <p className="text-3xl font-bold text-green-600">+12%</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
        <h2 className="text-2xl font-semibold mb-4">Curva S - Obra Principal</h2>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={curvaSData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="presupuestado" stroke="#8884d8" strokeWidth={3} name="Presupuestado" />
            <Line type="monotone" dataKey="programado" stroke="#82ca9d" strokeWidth={3} name="Programado" />
            <Line type="monotone" dataKey="ejecutado" stroke="#ff7300" strokeWidth={3} name="Ejecutado" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-6">
        <h3 className="text-xl font-bold text-yellow-800 mb-3">Alertas Críticas</h3>
        <ul className="space-y-2 text-yellow-900">
          <li className="flex items-center"><span className="mr-2">•</span> Obra "Edificio Centro" - Desviación de costo mayor al 5%</li>
          <li className="flex items-center"><span className="mr-2">•</span> Obra "Vivienda Norte" - Retraso de 4 días en estructura</li>
          <li className="flex items-center"><span className="mr-2">•</span> Almacén con bajo stock de cemento y varilla</li>
        </ul>
      </div>
    </div>
  )
}
