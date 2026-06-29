'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

import PageHeader from '@/components/ui/PageHeader'
import ActionButton from '@/components/ui/ActionButton'
import EstadoBadge from '@/components/ui/EstadoBadge'
import Modal from '@/components/ui/Modal'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Loading from '@/components/ui/Loading'

interface Obra {
  id: string
  nombre: string
  descripcion?: string
  fecha_inicio?: string
  fecha_fin?: string
  estado?: string
  presupuesto_estimado?: number
  created_at?: string
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingObra, setEditingObra] = useState<Obra | null>(null)

  const [solicitudesPorObra, setSolicitudesPorObra] = useState<Record<string, number>>({})
  const [ordenesPorObra, setOrdenesPorObra] = useState<Record<string, number>>({})

  // Estados para ConfirmDialog
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [obraToDelete, setObraToDelete] = useState<{ id: string; nombre: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const cargarActividadCompras = async () => {
    const { data: solicitudesData } = await supabase.from('solicitudes').select('obra_id')
    const solicitudesCount: Record<string, number> = {}
    solicitudesData?.forEach((s: any) => {
      solicitudesCount[s.obra_id] = (solicitudesCount[s.obra_id] || 0) + 1
    })
    setSolicitudesPorObra(solicitudesCount)

    const { data: ordenesData } = await supabase
      .from('ordenes_compra')
      .select('solicitud_id, solicitudes(obra_id)')

    const ordenesCount: Record<string, number> = {}
    ordenesData?.forEach((o: any) => {
      const obraId = o.solicitudes?.obra_id
      if (obraId) ordenesCount[obraId] = (ordenesCount[obraId] || 0) + 1
    })
    setOrdenesPorObra(ordenesCount)
  }

  const fetchObras = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('obras')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setObras(data || [])
    setLoading(false)
    cargarActividadCompras()
  }

  const openModal = (obra?: Obra) => {
    if (obra) {
      setEditingObra(obra)
      setFormData({
        nombre: obra.nombre || '',
        descripcion: obra.descripcion || '',
        presupuesto_estimado: obra.presupuesto_estimado || 0,
        fecha_inicio: obra.fecha_inicio || '',
        fecha_fin: obra.fecha_fin || '',
        estado: obra.estado || 'en_progreso',
      })
    } else {
      setEditingObra(null)
      setFormData({
        nombre: '',
        descripcion: '',
        presupuesto_estimado: 0,
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
      alert('El nombre de la obra es obligatorio')
      return
    }

    try {
      const payload = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion?.trim() || null,
        presupuesto_estimado: formData.presupuesto_estimado || 0,
        fecha_inicio: formData.fecha_inicio || null,
        fecha_fin: formData.fecha_fin || null,
        estado: formData.estado,
      }

      if (editingObra) {
        const { error } = await supabase.from('obras').update(payload).eq('id', editingObra.id)
        if (error) throw error
        alert('Obra actualizada correctamente')
      } else {
        const { error } = await supabase.from('obras').insert([payload])
        if (error) throw error
        alert('Obra creada correctamente')
      }

      closeModal()
      fetchObras()
    } catch (error: any) {
      console.error('Error al guardar:', error)
      alert(`Error al guardar la obra: ${error.message || error}`)
    }
  }

  // === ELIMINAR OBRA CON CONFIRMDIALOG ===
  const abrirConfirmEliminar = (id: string, nombre: string) => {
    setObraToDelete({ id, nombre })
    setShowConfirmDelete(true)
  }

  const confirmarEliminarObra = async () => {
    if (!obraToDelete) return
    setIsDeleting(true)

    try {
      const { count: totalSolicitudes } = await supabase
        .from('solicitudes')
        .select('*', { count: 'exact', head: true })
        .eq('obra_id', obraToDelete.id)

      const { data: ordenesData } = await supabase
        .from('ordenes_compra')
        .select(`id, solicitudes!inner(obra_id)`)
        .eq('solicitudes.obra_id', obraToDelete.id)
      const totalOrdenes = ordenesData?.length || 0

      const { data: entradasData } = await supabase
        .from('entradas_almacen')
        .select(`id, ordenes_compra!inner(solicitudes!inner(obra_id))`)
        .eq('ordenes_compra.solicitudes.obra_id', obraToDelete.id)
      const totalEntradas = entradasData?.length || 0

      const { count: totalInventario } = await supabase
        .from('inventario')
        .select('*', { count: 'exact', head: true })
        .eq('obra_id', obraToDelete.id)

      const tieneActividad =
        (totalSolicitudes || 0) > 0 ||
        totalOrdenes > 0 ||
        totalEntradas > 0 ||
        (totalInventario || 0) > 0

      if (tieneActividad) {
        alert(
          `⚠️ No es posible eliminar la obra "${obraToDelete.nombre}".\n\n` +
          `Esta obra tiene registros asociados:\n\n` +
          `• ${totalSolicitudes || 0} Solicitud(es)\n` +
          `• ${totalOrdenes} Orden(es) de Compra\n` +
          `• ${totalEntradas} Entrada(s) de almacén\n` +
          `• ${totalInventario || 0} Registro(s) en inventario`
        )
        setShowConfirmDelete(false)
        setObraToDelete(null)
        setIsDeleting(false)
        return
      }

      const { error } = await supabase.from('obras').delete().eq('id', obraToDelete.id)
      if (error) throw error

      alert('Obra eliminada correctamente.')
      fetchObras()
    } catch (error: any) {
      console.error(error)
      alert('Ocurrió un error al intentar eliminar la obra.')
    } finally {
      setShowConfirmDelete(false)
      setObraToDelete(null)
      setIsDeleting(false)
    }
  }

  const cambiarEstadoObra = async (id: string, nuevoEstado: string) => {
    if (nuevoEstado === 'finalizada' || nuevoEstado === 'cancelada') {
      try {
        const { count: totalSolicitudes } = await supabase
          .from('solicitudes')
          .select('*', { count: 'exact', head: true })
          .eq('obra_id', id)

        const { data: ordenesData } = await supabase
          .from('ordenes_compra')
          .select(`id, solicitudes!inner(obra_id)`)
          .eq('solicitudes.obra_id', id)
        const totalOrdenes = ordenesData?.length || 0

        const { data: entradasData } = await supabase
          .from('entradas_almacen')
          .select(`id, ordenes_compra!inner(solicitudes!inner(obra_id))`)
          .eq('ordenes_compra.solicitudes.obra_id', id)
        const totalEntradas = entradasData?.length || 0

        const { count: totalInventario } = await supabase
          .from('inventario')
          .select('*', { count: 'exact', head: true })
          .eq('obra_id', id)

        const tieneActividad =
          (totalSolicitudes || 0) > 0 ||
          totalOrdenes > 0 ||
          totalEntradas > 0 ||
          (totalInventario || 0) > 0

        if (tieneActividad) {
          const accion = nuevoEstado === 'finalizada' ? 'finalizar' : 'cancelar'
          alert(
            `⚠️ No es posible ${accion} la obra.\n\n` +
            `La obra tiene actividad registrada en Compras.`
          )
          return
        }
      } catch (error) {
        alert('Error al verificar actividad de la obra.')
        return
      }
    }

    try {
      const { error } = await supabase.from('obras').update({ estado: nuevoEstado }).eq('id', id)
      if (error) throw error

      setObras((prev) =>
        prev.map((obra) => (obra.id === id ? { ...obra, estado: nuevoEstado } : obra))
      )
    } catch (error) {
      alert('Error al cambiar el estado de la obra')
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Gestión de Obras"
        actions={
          <ActionButton onClick={() => openModal()}>+ Nueva Obra</ActionButton>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" text="Cargando obras..." />
        </div>
      ) : obras.length === 0 ? (
        <EmptyState
          icon={<span className="text-5xl">🏗️</span>}
          title="No hay obras registradas"
          description="Comienza creando tu primera obra para empezar a gestionar tus proyectos."
          action={
            <ActionButton onClick={() => openModal()}>+ Crear Primera Obra</ActionButton>
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">Nombre</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">Descripción</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-gray-700">Presupuesto</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700">Período</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700">Creada</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700">Actividad de Compras</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...obras]
                  .sort((a, b) => a.nombre.localeCompare(b.nombre))
                  .map((obra) => (
                    <tr key={obra.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-semibold text-gray-900">{obra.nombre}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 max-w-[220px] truncate cursor-help" title={obra.descripcion}>
                        {obra.descripcion || <span className="text-gray-400 italic">Sin descripción</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <EstadoBadge
                          estado={obra.estado || 'en_progreso'}
                          editable={true}
                          onChange={(nuevoEstado) => cambiarEstadoObra(obra.id, nuevoEstado)}
                        />
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-gray-900">
                        {obra.presupuesto_estimado && obra.presupuesto_estimado > 0
                          ? `$${Number(obra.presupuesto_estimado).toLocaleString('es-CO')}`
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-600">
                        {obra.fecha_inicio && obra.fecha_fin
                          ? `${new Date(obra.fecha_inicio).toLocaleDateString('es-CO')} → ${new Date(obra.fecha_fin).toLocaleDateString('es-CO')}`
                          : obra.fecha_inicio
                          ? new Date(obra.fecha_inicio).toLocaleDateString('es-CO')
                          : obra.fecha_fin
                          ? `→ ${new Date(obra.fecha_fin).toLocaleDateString('es-CO')}`
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-500">
                        {new Date(obra.created_at!).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1 text-sm">
                          <div>
                            <span className="font-medium">Sol: </span>
                            <span className={solicitudesPorObra[obra.id] > 0 ? 'text-blue-600 font-semibold' : 'text-gray-400'}>
                              {solicitudesPorObra[obra.id] || 0}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">OC: </span>
                            <span className={ordenesPorObra[obra.id] > 0 ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                              {ordenesPorObra[obra.id] || 0}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center min-w-[200px]">
                        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            onClick={() => openModal(obra)}
                          >
                            Editar
                          </ActionButton>

                          <Link href={`/compras/solicitudes?obra_id=${obra.id}`}>
                            <ActionButton variant="success" size="sm">
                              + Solicitud
                            </ActionButton>
                          </Link>

                          <ActionButton
                            variant="danger"
                            size="sm"
                            onClick={() => abrirConfirmEliminar(obra.id, obra.nombre)}
                          >
                            Eliminar
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Crear / Editar */}
      <Modal isOpen={showModal} onClose={closeModal} title={editingObra ? 'Editar Obra' : 'Nueva Obra'} maxWidth="lg">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1">Nombre de la Obra <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full border rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Descripción</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full border rounded-xl p-2.5 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Presupuesto Estimado</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.presupuesto_estimado || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    presupuesto_estimado: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                className="w-full border rounded-xl p-2.5 pl-7 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

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

        <div className="flex gap-3 mt-8">
          <ActionButton variant="secondary" onClick={closeModal} className="flex-1">
            Cancelar
          </ActionButton>
          <ActionButton onClick={handleSubmit} className="flex-1">
            {editingObra ? 'Guardar Cambios' : 'Crear Obra'}
          </ActionButton>
        </div>
      </Modal>

      {/* ConfirmDialog para eliminar */}
      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false)
          setObraToDelete(null)
        }}
        onConfirm={confirmarEliminarObra}
        title="Eliminar Obra"
        message={`¿Estás seguro de que deseas eliminar la obra "${obraToDelete?.nombre}"?\n\nEsta acción es irreversible.`}
        confirmText="Eliminar Obra"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}