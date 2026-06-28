'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Solicitud {
  id: number;
  obra_id: string;
  insumo: string;
  cantidad: number;
  unidad?: string;
  estado: string;
  fecha_solicitud: string;
  solicitado_por?: string;
  notas?: string;
  obras?: {
    nombre: string;
  };
}

export default function SolicitudesPage() {
  const [obras, setObras] = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Estados para Edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSolicitud, setEditingSolicitud] = useState<Solicitud | null>(null);

  // Filtros
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todas');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [solicitanteFiltro, setSolicitanteFiltro] = useState('');

  const limpiarFiltros = () => {
    setEstadoFiltro('todas');
    setSelectedObraId(null);
    setSearchInput('');
    setSearchTerm('');
    setSolicitanteFiltro('');
    setFechaInicio('');
    setFechaFin('');
  };

  // Debounce búsqueda
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Modal crear
  const [nuevaSolicitud, setNuevaSolicitud] = useState({
    obra_id: '',
    insumo: '',
    cantidad: '',
    unidad: 'Und',
    solicitado_por: '',
    notas: '',
  });

  // Cargar obras
  useEffect(() => {
    const cargarObras = async () => {
      const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (data) setObras(data);
    };
      cargarObras();
  }, []);

  // Cargar solicitudes
  const cargarSolicitudes = async () => {
    setLoading(true);
    try {
      let query = supabase
      .from('solicitudes')
      .select('*, obras(nombre)')
      .order('fecha_solicitud', { ascending: false });

      if (selectedObraId) {
        query = query.eq('obra_id', selectedObraId);
      }

      if (estadoFiltro !== 'todas') {
        const estadoFiltroLower = estadoFiltro.toLowerCase().trim();
        query = query.eq('estado', estadoFiltroLower);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      if (searchTerm.trim() !== '') {
        const texto = searchTerm.toLowerCase().trim();
        filtered = filtered.filter((s: any) =>
        s.insumo?.toLowerCase().includes(texto) ||
        s.notas?.toLowerCase().includes(texto) ||
        s.solicitado_por?.toLowerCase().includes(texto)
        );
      }

      if (solicitanteFiltro.trim() !== '') {
        const texto = solicitanteFiltro.toLowerCase().trim();
        filtered = filtered.filter((s: any) =>
        s.solicitado_por?.toLowerCase().includes(texto)
        );
      }

      if (fechaInicio || fechaFin) {
        filtered = filtered.filter((s: any) => {
          const fecha = new Date(s.fecha_solicitud);
          if (fechaInicio && fecha < new Date(fechaInicio)) return false;
          if (fechaFin && fecha > new Date(fechaFin)) return false;
          return true;
        });
      }

      setSolicitudes(filtered);
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [selectedObraId, estadoFiltro, searchTerm, solicitanteFiltro, fechaInicio, fechaFin]);

  // Crear nueva solicitud
  const crearSolicitud = async () => {
    if (!nuevaSolicitud.obra_id || !nuevaSolicitud.insumo || !nuevaSolicitud.cantidad) {
      alert('Por favor completa los campos obligatorios (Obra, Insumo y Cantidad)');
      return;
    }

    try {
      const { error } = await supabase.from('solicitudes').insert({
        obra_id: nuevaSolicitud.obra_id,
        insumo: nuevaSolicitud.insumo,
        cantidad: Number(nuevaSolicitud.cantidad),
        unidad: nuevaSolicitud.unidad,
        estado: 'pendiente',
        fecha_solicitud: new Date().toISOString(),
        solicitado_por: nuevaSolicitud.solicitado_por || null,
        notas: nuevaSolicitud.notas || null,
      });

      if (error) throw error;

      alert('Solicitud creada correctamente');
      setShowModal(false);
      setNuevaSolicitud({
        obra_id: '',
        insumo: '',
        cantidad: '',
        unidad: 'Und',
        solicitado_por: '',
        notas: '',
      });
      cargarSolicitudes();
    } catch (error) {
      console.error('Error creando solicitud:', error);
      alert('Error al crear la solicitud');
    }
  };

  // Función para abrir solicitud (ahora abre el modal de edición)
  const abrirSolicitud = (solicitud: Solicitud) => {
    setEditingSolicitud(solicitud);
    setShowEditModal(true);
  };

  // Rechazar solicitud
  const rechazarSolicitud = async (id: number, estado: string) => {
    if (estado === 'rechazada') {
      alert('Esta solicitud ya está rechazada.');
      return;
    }

    if (estado === 'aprobada') {
      alert('No se puede rechazar una solicitud que ya está APROBADA.');
      return;
    }

    if (estado === 'recibida') {
      alert('No se puede rechazar una solicitud que ya tiene material recibido en almacén.');
      return;
    }

    // === VALIDACIÓN: Verificar si tiene Órdenes de Compra con entradas ===
    try {
      const { data: ordenesRelacionadas } = await supabase
      .from('ordenes_compra')
      .select('id')
      .eq('solicitud_id', id);

      if (ordenesRelacionadas && ordenesRelacionadas.length > 0) {
        for (const orden of ordenesRelacionadas) {
          const cantidadRecibida = await calcularCantidadRecibida(orden.id);
          if (cantidadRecibida > 0) {
            alert(
              'No se puede rechazar esta solicitud.\n\n' +
              'Ya existe una Orden de Compra con material recibido en almacén.\n' +
              'Primero debe gestionar las devoluciones o ajustes correspondientes.'
            );
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error verificando órdenes relacionadas:', error);
      alert('Error al verificar el estado de la solicitud.');
      return;
    }

    // Si pasó todas las validaciones, pedimos confirmación
    if (!confirm('¿Rechazar esta solicitud?')) return;

    try {
      const { error } = await supabase
      .from('solicitudes')
      .update({ estado: 'rechazada' })
      .eq('id', id);

      if (error) throw error;

      alert('Solicitud rechazada');
      cargarSolicitudes();
    } catch (error) {
      console.error(error);
      alert('Error al rechazar la solicitud');
    }
  };

  const getEstadoColor = (estado: string) => {
    const est = (estado || '').toLowerCase().trim();

    switch (est) {
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'cotizada':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'aprobada':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'rechazada':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const getEstadoLabel = (estado: string) => {
    const est = (estado || '').toLowerCase().trim();
    switch (est) {
      case 'pendiente': return 'Pendiente';
      case 'cotizada': return 'Cotizada';
      case 'aprobada': return 'Aprobada';
      case 'rechazada': return 'Rechazada';
      default: return estado;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
    {/* Encabezado */}
    <div className="mb-8 flex items-center justify-between">
    <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
    ← Volver a Compras
    </Link>

    <h1 className="text-3xl font-bold text-gray-900">Solicitud de Materiales e Insumos</h1>

    <Link href="/compras/cotizaciones" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
    Ir a Cotizaciones →
    </Link>
    </div>

    {/* Filtros */}
    <div className="bg-white rounded-2xl shadow p-6 mb-6">
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
    <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Obra</label>
    <select
    value={selectedObraId || ''}
    onChange={(e) => setSelectedObraId(e.target.value || null)}
    className="w-full border rounded-xl p-3"
    >
    <option value="">Todas las obras</option>
    {obras.map((obra) => (
      <option key={obra.id} value={obra.id}>{obra.nombre}</option>
    ))}
    </select>
    </div>

    <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
    <select
    value={estadoFiltro}
    onChange={(e) => setEstadoFiltro(e.target.value)}
    className="w-full border rounded-xl p-3"
    >
    <option value="todas">Todos</option>
    <option value="pendiente">Pendiente</option>
    <option value="cotizada">Cotizada</option>
    <option value="aprobada">Aprobada</option>
    <option value="rechazada">Rechazada</option>
    </select>
    </div>

    <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
    <input
    type="date"
    value={fechaInicio}
    onChange={(e) => setFechaInicio(e.target.value)}
    className="w-full border rounded-xl p-3"
    />
    </div>

    <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
    <input
    type="date"
    value={fechaFin}
    onChange={(e) => setFechaFin(e.target.value)}
    className="w-full border rounded-xl p-3"
    />
    </div>

    <div className="flex items-end">
    <button
    onClick={() => setShowModal(true)}
    className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium"
    >
    + Nueva Solicitud
    </button>
    </div>
    </div>

    {/* Segunda fila de filtros */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
    <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por Insumo</label>
    <input
    type="text"
    placeholder="Buscar por insumo..."
    value={searchInput}
    onChange={(e) => setSearchInput(e.target.value)}
    className="w-full border rounded-xl p-3"
    />
    </div>

    <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por Solicitante</label>
    <input
    type="text"
    placeholder="Buscar solicitante..."
    value={solicitanteFiltro}
    onChange={(e) => setSolicitanteFiltro(e.target.value)}
    className="w-full border rounded-xl p-3"
    />
    </div>

    <div className="flex items-end">
    <button
    onClick={limpiarFiltros}
    className="w-full px-6 py-3 text-sm border rounded-xl hover:bg-gray-100"
    >
    Limpiar Filtros
    </button>
    </div>
    </div>
    </div>

    {/* Tabla */}
    {loading ? (
      <p className="text-center py-10 text-gray-500">Cargando solicitudes...</p>
    ) : solicitudes.length === 0 ? (
      <div className="text-center py-16 bg-white rounded-2xl shadow">
      <p className="text-5xl mb-4">📝</p>
      <p className="text-xl font-semibold text-gray-700">No hay solicitudes</p>
      <p className="text-gray-500 mt-1">Crea tu primera solicitud usando el botón de arriba.</p>
      </div>
    ) : (
      <div className="bg-white rounded-2xl shadow overflow-hidden">
      <table className="w-full">
      <thead className="bg-gray-50 border-b">
      <tr>
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Fecha</th>
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Obra</th>
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Insumo</th>
      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Cantidad</th>
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Solicitado por</th>
      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Estado</th>
      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Acciones</th>
      </tr>
      </thead>
      <tbody className="divide-y">
      {solicitudes.map((sol) => (
        <tr
        key={sol.id}
        className="hover:bg-gray-50"
        >
        <td className="px-6 py-4 text-sm text-gray-600">
        {new Date(sol.fecha_solicitud).toLocaleDateString('es-CO')}
        </td>
        <td className="px-6 py-4 text-sm text-gray-800">{sol.obras?.nombre || '—'}</td>
        <td className="px-6 py-4 text-sm text-gray-800">{sol.insumo}</td>
        <td className="px-6 py-4 text-sm text-center text-gray-700">
        {sol.cantidad} {sol.unidad}
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">{sol.solicitado_por || '—'}</td>
        <td className="px-6 py-4 text-center">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(sol.estado)}`}>
        {getEstadoLabel(sol.estado)}
        </span>
        </td>
        <td className="px-6 py-4 text-center">
        <div className="flex justify-center gap-2">

        {/* Editar - Visible en pendiente, cotizada y rechazada */}
        {(sol.estado === 'pendiente' ||
          sol.estado === 'cotizada' ||
          sol.estado === 'rechazada') && (
            <button
            onClick={(e) => {
              e.stopPropagation();
              abrirSolicitud(sol);
            }}
            className="px-3 py-1 text-xs font-medium border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
            >
            Editar
            </button>
          )}

          {/* Rechazar - Solo visible en pendiente y cotizada */}
          {(sol.estado === 'pendiente' || sol.estado === 'cotizada') && (
            <button
            onClick={(e) => {
              e.stopPropagation();
              rechazarSolicitud(sol.id, sol.estado);
            }}
            className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-lg transition-all"
            >
            ✕ Rechazar
            </button>
          )}

          </div>
          </td>
        </tr>
      ))}
      </tbody>
      </table>
      </div>
    )}

    {/* Modal Crear Solicitud */}
    {showModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold mb-6">Nueva Solicitud</h2>

      <div className="space-y-4">
      <div>
      <label className="block text-sm font-semibold mb-1">Obra *</label>
      <select
      value={nuevaSolicitud.obra_id}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, obra_id: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      >
      <option value="">Selecciona una obra</option>
      {obras.map((o) => (
        <option key={o.id} value={o.id}>{o.nombre}</option>
      ))}
      </select>
      </div>

      <div>
      <label className="block text-sm font-semibold mb-1">Insumo / Material *</label>
      <input
      type="text"
      value={nuevaSolicitud.insumo}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, insumo: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      placeholder="Ej: Cemento gris 50kg"
      />
      </div>

      <div className="grid grid-cols-2 gap-4">
      <div>
      <label className="block text-sm font-semibold mb-1">Cantidad *</label>
      <input
      type="number"
      value={nuevaSolicitud.cantidad}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, cantidad: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Unidad</label>
      <input
      type="text"
      value={nuevaSolicitud.unidad}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, unidad: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      />
      </div>
      </div>

      <div>
      <label className="block text-sm font-semibold mb-1">Creado por</label>
      <input
      type="text"
      value={nuevaSolicitud.solicitado_por}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, solicitado_por: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      placeholder="Nombre de quien crea la solicitud"
      />
      </div>

      <div>
      <label className="block text-sm font-semibold mb-1">Notas (opcional)</label>
      <textarea
      value={nuevaSolicitud.notas}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, notas: e.target.value })}
      className="w-full border rounded-xl p-2.5 h-20"
      placeholder="Especificaciones o comentarios..."
      />
      </div>
      </div>

      <div className="flex gap-3 mt-8">
      <button
      onClick={() => setShowModal(false)}
      className="flex-1 py-3 rounded-xl border border-gray-300 hover:bg-gray-50"
      >
      Cancelar
      </button>
      <button
      onClick={crearSolicitud}
      className="flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
      >
      Crear Solicitud
      </button>
      </div>
      </div>
      </div>
    )}

    {/* Modal Editar Solicitud */}
    {showEditModal && editingSolicitud && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold mb-6">Editar Solicitud</h2>

      <div className="space-y-4">
      {/* Obra */}
      <div>
      <label className="block text-sm font-semibold mb-1">Obra *</label>
      <select
      value={editingSolicitud.obra_id}
      onChange={(e) => setEditingSolicitud({ ...editingSolicitud, obra_id: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      >
      <option value="">Selecciona una obra</option>
      {obras.map((o) => (
        <option key={o.id} value={o.id}>{o.nombre}</option>
      ))}
      </select>
      </div>

      {/* Insumo */}
      <div>
      <label className="block text-sm font-semibold mb-1">Insumo / Material *</label>
      <input
      type="text"
      value={editingSolicitud.insumo}
      onChange={(e) => setEditingSolicitud({ ...editingSolicitud, insumo: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      />
      </div>

      {/* Cantidad + Unidad */}
      <div className="grid grid-cols-2 gap-4">
      <div>
      <label className="block text-sm font-semibold mb-1">Cantidad *</label>
      <input
      type="number"
      value={editingSolicitud.cantidad}
      onChange={(e) => setEditingSolicitud({ ...editingSolicitud, cantidad: Number(e.target.value) })}
      className="w-full border rounded-xl p-2.5"
      />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Unidad</label>
      <input
      type="text"
      value={editingSolicitud.unidad || ''}
      onChange={(e) => setEditingSolicitud({ ...editingSolicitud, unidad: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      />
      </div>
      </div>

      {/* Solicitado por */}
      <div>
      <label className="block text-sm font-semibold mb-1">Solicitado por</label>
      <input
      type="text"
      value={editingSolicitud.solicitado_por || ''}
      onChange={(e) => setEditingSolicitud({ ...editingSolicitud, solicitado_por: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      />
      </div>

      {/* Notas */}
      <div>
      <label className="block text-sm font-semibold mb-1">Notas</label>
      <textarea
      value={editingSolicitud.notas || ''}
      onChange={(e) => setEditingSolicitud({ ...editingSolicitud, notas: e.target.value })}
      className="w-full border rounded-xl p-2.5 h-20"
      />
      </div>

      {/* Estado Actual */}
      <div>
      <label className="block text-sm font-semibold mb-1">Estado Actual</label>
      <div>
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(editingSolicitud.estado)}`}>
      {editingSolicitud.estado.charAt(0).toUpperCase() + editingSolicitud.estado.slice(1)}
      </span>
      </div>
      </div>

      {/* Botón Recuperar (solo si está rechazada) */}
      {editingSolicitud.estado === 'rechazada' && (
        <div className="pt-2">
        <button
        type="button"
        onClick={() => {
          setEditingSolicitud({ ...editingSolicitud, estado: 'pendiente' });
        }}
        className="w-full py-2.5 text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-colors"
        >
        Recuperar Solicitud (Volver a Pendiente)
        </button>
        <p className="text-xs text-gray-500 mt-1 text-center">
        Esto permitirá que la solicitud vuelva a estar disponible para cotizar.
        </p>
        </div>
      )}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3 mt-8">
      <button
      onClick={() => {
        setShowEditModal(false);
        setEditingSolicitud(null);
      }}
      className="flex-1 py-3 rounded-xl border"
      >
      Cancelar
      </button>
      <button
      onClick={async () => {
        if (!editingSolicitud) return;

        try {
          const { error } = await supabase
          .from('solicitudes')
          .update({
            obra_id: editingSolicitud.obra_id,
            insumo: editingSolicitud.insumo,
            cantidad: editingSolicitud.cantidad,
            unidad: editingSolicitud.unidad,
            solicitado_por: editingSolicitud.solicitado_por,
            notas: editingSolicitud.notas,
            estado: editingSolicitud.estado,
          })
          .eq('id', editingSolicitud.id);

          if (error) throw error;

          alert('Solicitud actualizada correctamente');
          setShowEditModal(false);
          setEditingSolicitud(null);
          cargarSolicitudes();
        } catch (error) {
          console.error(error);
          alert('Error al actualizar la solicitud');
        }
      }}
      className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium"
      >
      Guardar Cambios
      </button>
      </div>
      </div>
      </div>
    )}
    </div>
  );
}
