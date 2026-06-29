'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import PageHeader from '@/components/ui/PageHeader';
import ActionButton from '@/components/ui/ActionButton';
import Modal from '@/components/ui/Modal';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Loading from '@/components/ui/Loading';
import SearchInput from '@/components/ui/SearchInput';
import SelectFilter from '@/components/ui/SelectFilter';
import DateRangeFilter from '@/components/ui/DateRangeFilter';

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
  obras?: { nombre: string };
}

export default function SolicitudesPage() {
  const [obras, setObras] = useState<any[]>([]);
  const [obraActual, setObraActual] = useState<{ id: string; nombre: string } | null>(null);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cotizacionesResumen, setCotizacionesResumen] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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

  // ConfirmDialog
  const [showConfirmRechazar, setShowConfirmRechazar] = useState(false);
  const [solicitudToRechazar, setSolicitudToRechazar] = useState<Solicitud | null>(null);

  const searchParams = useSearchParams();

  const [nuevaSolicitud, setNuevaSolicitud] = useState({
    obra_id: '',
    insumo: '',
    cantidad: '',
    unidad: 'Und',
    solicitado_por: '',
    notas: '',
  });

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Preseleccionar obra desde URL
  useEffect(() => {
    const obraIdFromUrl = searchParams.get('obra_id');
    if (obraIdFromUrl) {
      setNuevaSolicitud(prev => ({ ...prev, obra_id: obraIdFromUrl }));
      const obraEncontrada = obras.find(o => o.id === obraIdFromUrl);
      if (obraEncontrada) setObraActual(obraEncontrada);
      setShowModal(true);
    }
  }, [searchParams, obras]);

  // Cargar obras
  useEffect(() => {
    const cargarObras = async () => {
      const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (data) setObras(data);
    };
    cargarObras();
  }, []);

  const cargarResumenCotizaciones = async () => {
    const { data } = await supabase.from('cotizaciones').select('solicitud_id, cantidad');
    const resumen: Record<number, number> = {};
    data?.forEach((cot: any) => {
      resumen[cot.solicitud_id] = (resumen[cot.solicitud_id] || 0) + Number(cot.cantidad);
    });
    setCotizacionesResumen(resumen);
  };

  const cargarSolicitudes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('solicitudes')
        .select('*, obras(nombre)')
        .order('fecha_solicitud', { ascending: false });

      if (selectedObraId) query = query.eq('obra_id', selectedObraId);
      if (estadoFiltro !== 'todas') query = query.eq('estado', estadoFiltro.toLowerCase().trim());

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      if (searchTerm.trim()) {
        const texto = searchTerm.toLowerCase().trim();
        filtered = filtered.filter((s: any) =>
          s.insumo?.toLowerCase().includes(texto) ||
          s.notas?.toLowerCase().includes(texto) ||
          s.solicitado_por?.toLowerCase().includes(texto)
        );
      }

      if (solicitanteFiltro.trim()) {
        const texto = solicitanteFiltro.toLowerCase().trim();
        filtered = filtered.filter((s: any) => s.solicitado_por?.toLowerCase().includes(texto));
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
      cargarResumenCotizaciones();
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [selectedObraId, estadoFiltro, searchTerm, solicitanteFiltro, fechaInicio, fechaFin]);

  // Crear solicitud
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
      setNuevaSolicitud({ obra_id: '', insumo: '', cantidad: '', unidad: 'Und', solicitado_por: '', notas: '' });
      cargarSolicitudes();
    } catch (error) {
      alert('Error al crear la solicitud');
    }
  };

  const abrirSolicitud = (solicitud: Solicitud) => {
    setEditingSolicitud(solicitud);
    setShowEditModal(true);
  };

  // Rechazar con ConfirmDialog
  const abrirConfirmRechazar = (solicitud: Solicitud) => {
    if (['rechazada', 'aprobada', 'recibida'].includes(solicitud.estado)) {
      alert(`No se puede rechazar una solicitud en estado ${solicitud.estado}.`);
      return;
    }
    setSolicitudToRechazar(solicitud);
    setShowConfirmRechazar(true);
  };

  const confirmarRechazo = async () => {
    if (!solicitudToRechazar) return;
    try {
      const { error } = await supabase
        .from('solicitudes')
        .update({ estado: 'rechazada' })
        .eq('id', solicitudToRechazar.id);
      if (error) throw error;
      alert('Solicitud rechazada');
      cargarSolicitudes();
    } catch (error) {
      alert('Error al rechazar la solicitud');
    } finally {
      setShowConfirmRechazar(false);
      setSolicitudToRechazar(null);
    }
  };

  const limpiarFiltros = () => {
    setEstadoFiltro('todas');
    setSelectedObraId(null);
    setSearchInput('');
    setSearchTerm('');
    setSolicitanteFiltro('');
    setFechaInicio('');
    setFechaFin('');
  };

  const getEstadoColor = (estado: string) => {
    const est = (estado || '').toLowerCase().trim();
    switch (est) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'cotizada': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'aprobada': return 'bg-green-100 text-green-800 border border-green-200';
      case 'rechazada': return 'bg-red-100 text-red-800 border border-red-200';
      default: return 'bg-gray-100 text-gray-700 border border-gray-200';
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
      {/* Encabezado con links alineados */}
<div className="mb-2 flex items-center justify-between">
  {/* Link Izquierdo */}
  <Link 
    href="/compras" 
    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
  >
    ← Volver a Compras
  </Link>

  {/* Link Derecho */}
  <Link 
    href="/compras/oc" 
    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
  >
    Ir a Órdenes de Compra →
  </Link>
</div>

{/* Título centrado */}
<PageHeader
  title="Solicitud de Materiales e Insumos"
  centerTitle={true}
/>

      {/* Filtros */}
<Card className="mb-6">
  {/* Fila 1 */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
    
    {/* Obra */}
    <div className="lg:col-span-3">
      <SelectFilter
        label="Obra"
        value={selectedObraId || ''}
        onChange={(val) => setSelectedObraId(val || null)}
        placeholder="Todas las obras"
        options={obras.map(o => ({ value: o.id, label: o.nombre }))}
      />
    </div>

    {/* Estado */}
    <div className="lg:col-span-2">
      <SelectFilter
        label="Estado"
        value={estadoFiltro}
        onChange={setEstadoFiltro}
        placeholder="Todos"
        options={[
          { value: 'pendiente', label: 'Pendiente' },
          { value: 'cotizada', label: 'Cotizada' },
          { value: 'aprobada', label: 'Aprobada' },
          { value: 'rechazada', label: 'Rechazada' },
        ]}
      />
    </div>

    {/* Rango de Fechas */}
    <div className="lg:col-span-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Rango de Fechas</label>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="w-full border rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="w-full border rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    {/* Botón + Nueva Solicitud */}
    <div className="lg:col-span-3 flex justify-end">
      <ActionButton onClick={() => setShowModal(true)}>
        + Nueva Solicitud
      </ActionButton>
    </div>
  </div>

  {/* Fila 2: Búsquedas + Limpiar Filtros (más amplios) */}
<div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-5">
  <div className="md:col-span-2">
    <SearchInput
      value={searchInput}
      onChange={setSearchInput}
      placeholder="Buscar por insumo..."
    />
  </div>

  <div className="md:col-span-2">
    <SearchInput
      value={solicitanteFiltro}
      onChange={setSolicitanteFiltro}
      placeholder="Buscar por solicitante..."
    />
  </div>

  <div className="md:col-span-1 flex justify-end items-end">
    <ActionButton variant="secondary" onClick={limpiarFiltros}>
      Limpiar Filtros
    </ActionButton>
  </div>
</div>
</Card>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-20"><Loading size="lg" text="Cargando solicitudes..." /></div>
      ) : solicitudes.length === 0 ? (
        <EmptyState
          icon={<span className="text-5xl">📝</span>}
          title="No hay solicitudes"
          description="Crea tu primera solicitud de materiales."
          action={<ActionButton onClick={() => setShowModal(true)}>+ Nueva Solicitud</ActionButton>}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left">Fecha</th>
                <th className="px-6 py-4 text-left">Obra</th>
                <th className="px-6 py-4 text-left">Insumo</th>
                <th className="px-6 py-4 text-center">Cantidad</th>
                <th className="px-6 py-4 text-center">Cotizado</th>
                <th className="px-6 py-4 text-center">Pendiente</th>
                <th className="px-6 py-4 text-left">Solicitado por</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {solicitudes.map((sol) => (
                <tr key={sol.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{new Date(sol.fecha_solicitud).toLocaleDateString('es-CO')}</td>
                  <td className="px-6 py-4 text-sm">{sol.obras?.nombre || '—'}</td>
                  <td className="px-6 py-4 text-sm">{sol.insumo}</td>
                  <td className="px-6 py-4 text-center text-sm">{sol.cantidad} {sol.unidad}</td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-blue-600">{cotizacionesResumen[sol.id] || '—'}</td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-orange-600">
                    {Math.max(0, sol.cantidad - (cotizacionesResumen[sol.id] || 0))}
                  </td>
                  <td className="px-6 py-4 text-sm">{sol.solicitado_por || '—'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(sol.estado)}`}>
                      {getEstadoLabel(sol.estado)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      {(sol.estado === 'pendiente' || sol.estado === 'cotizada' || sol.estado === 'rechazada') && (
                        <ActionButton variant="secondary" size="sm" onClick={() => abrirSolicitud(sol)}>Editar</ActionButton>
                      )}
                      {(sol.estado === 'pendiente' || sol.estado === 'cotizada') && (
                        <ActionButton variant="danger" size="sm" onClick={() => abrirConfirmRechazar(sol)}>Rechazar</ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal Crear Solicitud */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Solicitud" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Obra *</label>
            <select value={nuevaSolicitud.obra_id} onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, obra_id: e.target.value })} className="w-full border rounded-xl p-2.5">
              <option value="">Selecciona una obra</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Insumo / Material *</label>
            <input type="text" value={nuevaSolicitud.insumo} onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, insumo: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Cantidad *</label>
              <input type="number" value={nuevaSolicitud.cantidad} onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, cantidad: e.target.value })} className="w-full border rounded-xl p-2.5" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Unidad</label>
              <input type="text" value={nuevaSolicitud.unidad} onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, unidad: e.target.value })} className="w-full border rounded-xl p-2.5" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Solicitado por</label>
            <input type="text" value={nuevaSolicitud.solicitado_por} onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, solicitado_por: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Notas</label>
            <textarea value={nuevaSolicitud.notas} onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, notas: e.target.value })} className="w-full border rounded-xl p-2.5 h-20" />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <ActionButton variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</ActionButton>
          <ActionButton onClick={crearSolicitud} className="flex-1">Crear Solicitud</ActionButton>
        </div>
      </Modal>

      {/* Modal Editar Solicitud */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Solicitud" maxWidth="md">
        {editingSolicitud && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Obra *</label>
              <select value={editingSolicitud.obra_id} onChange={(e) => setEditingSolicitud({ ...editingSolicitud, obra_id: e.target.value })} className="w-full border rounded-xl p-2.5">
                <option value="">Selecciona una obra</option>
                {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Insumo / Material *</label>
              <input type="text" value={editingSolicitud.insumo} onChange={(e) => setEditingSolicitud({ ...editingSolicitud, insumo: e.target.value })} className="w-full border rounded-xl p-2.5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Cantidad *</label>
                <input type="number" value={editingSolicitud.cantidad} onChange={(e) => setEditingSolicitud({ ...editingSolicitud, cantidad: Number(e.target.value) })} className="w-full border rounded-xl p-2.5" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Unidad</label>
                <input type="text" value={editingSolicitud.unidad || ''} onChange={(e) => setEditingSolicitud({ ...editingSolicitud, unidad: e.target.value })} className="w-full border rounded-xl p-2.5" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Solicitado por</label>
              <input type="text" value={editingSolicitud.solicitado_por || ''} onChange={(e) => setEditingSolicitud({ ...editingSolicitud, solicitado_por: e.target.value })} className="w-full border rounded-xl p-2.5" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Notas</label>
              <textarea value={editingSolicitud.notas || ''} onChange={(e) => setEditingSolicitud({ ...editingSolicitud, notas: e.target.value })} className="w-full border rounded-xl p-2.5 h-20" />
            </div>

            {/* Estado Actual + Recuperar */}
            <div>
              <label className="block text-sm font-semibold mb-1">Estado Actual</label>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(editingSolicitud.estado)}`}>
                {getEstadoLabel(editingSolicitud.estado)}
              </span>
            </div>

            {editingSolicitud.estado === 'rechazada' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSolicitud({ ...editingSolicitud, estado: 'pendiente' })}
                  className="w-full py-2.5 text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl"
                >
                  Recuperar Solicitud (Volver a Pendiente)
                </button>
                <p className="text-xs text-gray-500 mt-1 text-center">Esto permitirá que la solicitud vuelva a estar disponible para cotizar.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-8">
          <ActionButton variant="secondary" onClick={() => setShowEditModal(false)} className="flex-1">Cancelar</ActionButton>
          <ActionButton
            onClick={async () => {
              if (!editingSolicitud) return;
              const cantidadYaCotizada = cotizacionesResumen[editingSolicitud.id] || 0;
              if (editingSolicitud.cantidad < cantidadYaCotizada) {
                alert(`No se puede reducir la cantidad. Ya se cotizaron ${cantidadYaCotizada} unidades.`);
                return;
              }
              try {
                const { error } = await supabase.from('solicitudes').update({
                  obra_id: editingSolicitud.obra_id,
                  insumo: editingSolicitud.insumo,
                  cantidad: editingSolicitud.cantidad,
                  unidad: editingSolicitud.unidad,
                  solicitado_por: editingSolicitud.solicitado_por,
                  notas: editingSolicitud.notas,
                  estado: editingSolicitud.estado,
                }).eq('id', editingSolicitud.id);
                if (error) throw error;
                alert('Solicitud actualizada correctamente');
                setShowEditModal(false);
                setEditingSolicitud(null);
                cargarSolicitudes();
              } catch (error) {
                alert('Error al actualizar la solicitud');
              }
            }}
            className="flex-1"
          >
            Guardar Cambios
          </ActionButton>
        </div>
      </Modal>

      {/* ConfirmDialog para Rechazar */}
      <ConfirmDialog
        isOpen={showConfirmRechazar}
        onClose={() => setShowConfirmRechazar(false)}
        onConfirm={confirmarRechazo}
        title="Rechazar Solicitud"
        message={`¿Estás seguro de rechazar esta solicitud de "${solicitudToRechazar?.insumo}"?`}
        confirmText="Rechazar"
        variant="danger"
      />
    </div>
  );
}