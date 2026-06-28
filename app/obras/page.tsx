'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Obra {
  id: string
  nombre: string
  descripcion?: string
  fecha_inicio?: string
  fecha_fin?: string
  estado?: string
  created_at?: string
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingObra, setEditingObra] = useState<Obra | null>(null)

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    presupuesto_estimado: 0,
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'en_progreso',
  })

  useEffect(() => {
    fetchObras()
  }, [])

  const fetchObras = async () => {
    setLoading(true)
    const { data, error } = await supabase
    .from('obras')
    .select('*')
    .order('created_at', { ascending: false })

    if (!error) setObras(data || [])
      setLoading(false)
  }

  const openModal = (obra?: Obra) => {
    if (obra) {
      setEditingObra(obra)
      setFormData({
        nombre: obra.nombre || '',
        descripcion: obra.descripcion || '',
        fecha_inicio: obra.fecha_inicio || '',
        fecha_fin: obra.fecha_fin || '',
        estado: obra.estado || 'en_progreso',
      })
    } else {
      setEditingObra(null)
      setFormData({
        nombre: '',
        descripcion: '',
        fecha_inicio: '',
        fecha_fin: '',
        estado: 'en_progreso',
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingObra(null)
  }

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) {
      alert('El nombre de la obra es obligatorio');
      return;
    }

    try {
      // Convertimos correctamente los valores vacíos a null
      const payload = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion?.trim() || null,
        fecha_inicio: formData.fecha_inicio || null,
        fecha_fin: formData.fecha_fin || null,
        estado: formData.estado,
      };

      if (editingObra) {
        // === ACTUALIZAR ===
        const { error } = await supabase
        .from('obras')
        .update(payload)
        .eq('id', editingObra.id);

        if (error) throw error;

        alert('Obra actualizada correctamente');
      } else {
        // === CREAR ===
        const { error } = await supabase.from('obras').insert([payload]);
        if (error) throw error;

        alert('Obra creada correctamente');
      }

      closeModal();
      fetchObras();
    } catch (error: any) {
      console.error('Error al guardar:', error);
      alert(`Error al guardar la obra: ${error.message || error}`);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'en_progreso':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'finalizada':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'pausada':
        return 'bg-amber-100 text-amber-700 border border-amber-200';
      case 'cancelada':
        return 'bg-red-100 text-red-700 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'en_progreso': return '🔄';
      case 'finalizada': return '✅';
      case 'pausada': return '⏸️';
      case 'cancelada': return '❌';
      default: return '📄';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'en_progreso': return 'En Progreso';
      case 'finalizada': return 'Finalizada';
      case 'pausada': return 'Pausada';
      case 'cancelada': return 'Cancelada';
      default: return estado;
    }
  };

  const cambiarEstadoObra = async (id: string, nuevoEstado: string) => {
    try {
      const { error } = await supabase
      .from('obras')
      .update({ estado: nuevoEstado })
      .eq('id', id);

      if (error) throw error;

      // Actualizar la lista localmente
      setObras(prev =>
      prev.map(obra =>
      obra.id === id ? { ...obra, estado: nuevoEstado } : obra
      )
      );
    } catch (error) {
      console.error(error);
      alert('Error al cambiar el estado de la obra');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
    <div className="flex justify-between items-center mb-6">
    <h1 className="text-3xl font-bold">Gestión de Obras</h1>
    <button
    onClick={() => openModal()}
    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium"
    >
    + Nueva Obra
    </button>
    </div>

    {/* Listado de Obras Mejorado */}
    <div className="bg-white rounded-2xl shadow overflow-hidden">
    <table className="w-full">
    <thead className="bg-gray-50 border-b">
    <tr>
    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nombre</th>
    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Descripción</th>
    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Estado</th>
    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Presupuesto</th>
    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Período</th>
    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Creada</th>
    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Acciones</th>
    </tr>
    </thead>
    <tbody className="divide-y">
    {obras.length === 0 ? (
      <tr>
      <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
      No hay obras registradas todavía.
      </td>
      </tr>
    ) : (
      [...obras]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((obra) => (
        <tr key={obra.id} className="hover:bg-gray-50">
        {/* Nombre */}
        <td className="px-6 py-4 font-semibold text-gray-900">{obra.nombre}</td>

        {/* Descripción */}
        <td
        className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate cursor-help"
        title={obra.descripcion || ''}
        >
        {obra.descripcion || <span className="text-gray-400 italic">Sin descripción</span>}
        </td>

        {/* Estado con select */}
        <td className="px-6 py-4 text-center">
        <select
        value={obra.estado}
        onChange={(e) => cambiarEstadoObra(obra.id, e.target.value)}
        className={`text-xs font-medium px-3 py-1 rounded-full border cursor-pointer focus:outline-none ${getEstadoColor(obra.estado)}`}
        >
        <option value="en_progreso">En Progreso</option>
        <option value="pausada">Pausada</option>
        <option value="finalizada">Finalizada</option>
        <option value="cancelada">Cancelada</option>
        </select>
        </td>

        {/* Presupuesto Estimado */}
        <td className="px-6 py-4 text-right font-medium text-gray-900">
        {obra.presupuesto_estimado && obra.presupuesto_estimado > 0
          ? `$${Number(obra.presupuesto_estimado).toLocaleString('es-CO')}`
          : <span className="text-gray-400">—</span>}
          </td>

          {/* Período */}
          <td className="px-6 py-4 text-center text-sm text-gray-600">
          {obra.fecha_inicio && obra.fecha_fin ? (
            `${new Date(obra.fecha_inicio).toLocaleDateString('es-CO')} → ${new Date(obra.fecha_fin).toLocaleDateString('es-CO')}`
          ) : obra.fecha_inicio ? (
            new Date(obra.fecha_inicio).toLocaleDateString('es-CO')
          ) : obra.fecha_fin ? (
            `→ ${new Date(obra.fecha_fin).toLocaleDateString('es-CO')}`
          ) : (
            <span className="text-gray-400">—</span>
          )}
          </td>

          {/* Fecha de creación */}
          <td className="px-6 py-4 text-center text-sm text-gray-500">
          {new Date(obra.created_at).toLocaleDateString('es-CO')}
          </td>

          {/* Acciones */}
          <td className="px-6 py-4 text-center">
          <button
          onClick={() => openModal(obra)}
          className="px-4 py-1.5 text-sm border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
          >
          Editar
          </button>
          </td>
          </tr>
      ))
    )}
    </tbody>
    </table>
    </div>

    {/* Modal Crear / Editar Obra - Mejorado */}
    {/* Modal Crear / Editar Obra - Actualizado con Presupuesto */}
    {showModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg">
      <h2 className="text-2xl font-bold mb-6">
      {editingObra ? 'Editar Obra' : 'Nueva Obra'}
      </h2>

      <div className="space-y-5">
      {/* Nombre */}
      <div>
      <label className="block text-sm font-semibold mb-1">
      Nombre de la Obra <span className="text-red-500">*</span>
      </label>
      <input
      type="text"
      value={formData.nombre}
      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
      className="w-full border rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Ej: Torre María"
      />
      </div>

      {/* Descripción */}
      <div>
      <label className="block text-sm font-semibold mb-1">Descripción</label>
      <textarea
      value={formData.descripcion}
      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
      className="w-full border rounded-xl p-2.5 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Breve descripción de la obra..."
      />
      </div>

      {/* Presupuesto Estimado */}
      <div>
      <label className="block text-sm font-semibold mb-1">Presupuesto Estimado</label>
      <div className="relative">
      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
      <input
      type="number"
      step="0.01"
      min="0"
      value={formData.presupuesto_estimado || ''}
      onChange={(e) => setFormData({
        ...formData,
        presupuesto_estimado: e.target.value ? parseFloat(e.target.value) : 0
      })}
      className="w-full border rounded-xl p-2.5 pl-7 focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="0.00"
      />
      </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-4">
      <div>
      <label className="block text-sm font-semibold mb-1">Fecha de Inicio</label>
      <input
      type="date"
      value={formData.fecha_inicio}
      onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
      className="w-full border rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Fecha de Fin</label>
      <input
      type="date"
      value={formData.fecha_fin}
      onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
      className="w-full border rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      </div>
      </div>

      {/* Estado */}
      <div>
      <label className="block text-sm font-semibold mb-1">Estado</label>
      <select
      value={formData.estado}
      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
      className="w-full border rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
      <option value="en_progreso">En Progreso</option>
      <option value="pausada">Pausada</option>
      <option value="finalizada">Finalizada</option>
      <option value="cancelada">Cancelada</option>
      </select>
      </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 mt-8">
      <button
      onClick={closeModal}
      className="flex-1 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 font-medium"
      >
      Cancelar
      </button>
      <button
      onClick={handleSubmit}
      className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
      >
      {editingObra ? 'Guardar Cambios' : 'Crear Obra'}
      </button>
      </div>
      </div>
      </div>
    )}
    </div>
  )
}
