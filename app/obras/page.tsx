'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Obras() {
  const [obras, setObras] = useState<any[]>([])
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    fetchObras()
  }, [])

  const fetchObras = async () => {
    const { data } = await supabase.from('obras').select('*')
    setObras(data || [])
  }

  const crearObra = async () => {
    const { data, error } = await supabase
      .from('obras')
      .insert([{ nombre }])
    if (!error) {
      setNombre('')
      fetchObras()
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Gestión de Obras</h1>
      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre de la nueva obra"
        className="border p-2 mr-2"
      />
      <button onClick={crearObra} className="bg-blue-500 text-white p-2 rounded">
        Crear Obra
      </button>
      <ul className="mt-4">
        {obras.map((obra) => (
          <li key={obra.id} className="border p-2 mb-2">{obra.nombre}</li>
        ))}
      </ul>
    </div>
  )
}
