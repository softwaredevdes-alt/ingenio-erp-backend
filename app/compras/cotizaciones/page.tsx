'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { generarNumeroOC } from '@/lib/utils';

import PageHeader from '@/components/ui/PageHeader';
import ActionButton from '@/components/ui/ActionButton';
import Modal from '@/components/ui/Modal';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
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
  obras?: { nombre: string };
}

interface Cotizacion {
  id: number;
  solicitud_id: number;
  proveedor: string;
  precio_unitario: number;
  cantidad: number;
  unidad?: string;
  tiempo_entrega_dias?: number;
  observaciones?: string;
  estado: string;
  creado_por?: string;
  ordenes_compra?: any;
}

export default function CotizacionesPage() {
  const [obras, setObras] = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);
  const [cotizacionesCount, setCotizacionesCount] = useState<Record<number, number>>({});

  // Filtros
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [solicitanteFiltro, setSolicitanteFiltro] = useState('');
  const [solicitanteTerm, setSolicitanteTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todas');

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCotizacion, setEditingCotizacion] = useState<Cotizacion | null>(null);

  const [nuevaCotizacion, setNuevaCotizacion] = useState({
    proveedor: '',
    precio_unitario: '',
    cantidad: '',
    tiempo_entrega_dias: '',
    observaciones: '',
    creado_por: '',
  });

  const limpiarFiltros = () => {
    setSelectedObraId(null);
    setSearchInput('');
    setSearchTerm('');
    setSolicitanteFiltro('');
    setFechaInicio('');
    setFechaFin('');
    setEstadoFiltro('todas');
  };

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 800);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => setSolicitanteTerm(solicitanteFiltro), 500);
    return () => clearTimeout(timer);
  }, [solicitanteFiltro]);

  // Cargar obras
  useEffect(() => {
    const cargarObras = async () => {
      const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (data) setObras(data);
    };
    cargarObras();
  }, []);

  const cargarSolicitudes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('solicitudes')
        .select('*, obras(nombre)')
        .in('estado', ['pendiente', 'cotizada'])
        .order('fecha_solicitud', { ascending: false });

      if (selectedObraId) query = query.eq('obra_id', selectedObraId);
      if (estadoFiltro !== 'todas') query = query.eq('estado', estadoFiltro);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      if (searchTerm.trim()) {
        const texto = searchTerm.toLowerCase().trim();
        filtered = filtered.filter((s: any) => s.insumo?.toLowerCase().includes(texto));
      }

      if (solicitanteTerm.trim()) {
        const texto = solicitanteTerm.toLowerCase().trim();
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

      // Conteo de cotizaciones
      const counts: Record<number, number> = {};
      for (const sol of filtered) {
        const { count } = await supabase
          .from('cotizaciones')
          .select('*', { count: 'exact', head: true })
          .eq('solicitud_id', sol.id);
        counts[sol.id] = count || 0;
      }
      setCotizacionesCount(counts);

      if (selectedSolicitud && !filtered.find(s => s.id === selectedSolicitud.id)) {
        setSelectedSolicitud(null);
        setCotizaciones([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [selectedObraId, estadoFiltro, searchTerm, solicitanteTerm, fechaInicio, fechaFin]);

  const cargarCotizaciones = async (solicitudId: number) => {
    const { data, error } = await supabase
      .from('cotizaciones')
      .select(`*, ordenes_compra (id, estado)`)
      .eq('solicitud_id', solicitudId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return [];
    }
    return data || [];
  };

  const abrirSolicitud = async (solicitud: Solicitud) => {
    setSelectedSolicitud(solicitud);
    const cotis = await cargarCotizaciones(solicitud.id);
    setCotizaciones(cotis);
  };

  // === AGREGAR COTIZACIÓN ===
  const agregarCotizacion = async () => {
    if (!selectedSolicitud || !nuevaCotizacion.proveedor || !nuevaCotizacion.precio_unitario || !nuevaCotizacion.cantidad) {
      alert('Por favor completa proveedor, precio unitario y cantidad');
      return;
    }

    const cantidadNueva = Number(nuevaCotizacion.cantidad);
    if (cantidadNueva <= 0) {
      alert("La cantidad debe ser mayor a 0");
      return;
    }

    const cantidadYaSeleccionada = cotizaciones
      .filter(c => c.estado === 'seleccionada')
      .reduce((sum, c) => sum + Number(c.cantidad || 0), 0);

    const cantidadMaxima = selectedSolicitud.cantidad - cantidadYaSeleccionada;

    if (cantidadNueva > cantidadMaxima) {
      alert(`La cantidad máxima permitida es ${cantidadMaxima} ${selectedSolicitud.unidad}`);
      return;
    }

    try {
      await supabase.from('cotizaciones').insert({
        solicitud_id: selectedSolicitud.id,
        proveedor: nuevaCotizacion.proveedor,
        precio_unitario: Number(nuevaCotizacion.precio_unitario),
        cantidad: cantidadNueva,
        unidad: selectedSolicitud.unidad,
        tiempo_entrega_dias: nuevaCotizacion.tiempo_entrega_dias ? Number(nuevaCotizacion.tiempo_entrega_dias) : null,
        observaciones: nuevaCotizacion.observaciones || null,
        creado_por: nuevaCotizacion.creado_por || null,
        estado: 'pendiente',
      });

      await supabase.from('solicitudes').update({ estado: 'cotizada' }).eq('id', selectedSolicitud.id);

      alert('Cotización agregada correctamente');
      setShowAddModal(false);
      setNuevaCotizacion({ proveedor: '', precio_unitario: '', cantidad: '', tiempo_entrega_dias: '', observaciones: '', creado_por: '' });

      if (selectedSolicitud) {
        const cotis = await cargarCotizaciones(selectedSolicitud.id);
        setCotizaciones(cotis);
      }
      cargarSolicitudes();
    } catch (error) {
      alert('Error al agregar la cotización');
    }
  };

  const abrirEditar = (cot: Cotizacion) => {
    setEditingCotizacion(cot);
    setNuevaCotizacion({
      proveedor: cot.proveedor,
      precio_unitario: cot.precio_unitario.toString(),
      cantidad: cot.cantidad.toString(),
      tiempo_entrega_dias: cot.tiempo_entrega_dias?.toString() || '',
      observaciones: cot.observaciones || '',
      creado_por: cot.creado_por || '',
    });
    setShowEditModal(true);
  };

  const guardarEdicion = async () => {
    if (!editingCotizacion || !selectedSolicitud) return;

    const cantidadNueva = Number(nuevaCotizacion.cantidad) || 0;
    if (cantidadNueva <= 0) {
      alert("La cantidad debe ser mayor a 0");
      return;
    }

    const cantidadYaSeleccionada = cotizaciones
      .filter(c => c.estado === 'seleccionada' && c.id !== editingCotizacion.id)
      .reduce((sum, c) => sum + Number(c.cantidad || 0), 0);

    const cantidadMaxima = selectedSolicitud.cantidad - cantidadYaSeleccionada;

    if (cantidadNueva > cantidadMaxima) {
      alert(`La cantidad máxima permitida es ${cantidadMaxima}`);
      return;
    }

    try {
      await supabase.from('cotizaciones').update({
        proveedor: nuevaCotizacion.proveedor,
        precio_unitario: Number(nuevaCotizacion.precio_unitario),
        cantidad: cantidadNueva,
        tiempo_entrega_dias: nuevaCotizacion.tiempo_entrega_dias ? Number(nuevaCotizacion.tiempo_entrega_dias) : null,
        observaciones: nuevaCotizacion.observaciones || null,
        creado_por: nuevaCotizacion.creado_por || null,
      }).eq('id', editingCotizacion.id);

      // Sincronizar OC si está seleccionada
      if (editingCotizacion.estado === 'seleccionada') {
        const { data: oc } = await supabase
          .from('ordenes_compra')
          .select('id, estado')
          .eq('cotizacion_id', editingCotizacion.id)
          .maybeSingle();

        if (oc && oc.estado === 'pendiente_aprobacion') {
          const nuevoTotal = Number(nuevaCotizacion.precio_unitario) * cantidadNueva;
          await supabase.from('ordenes_compra').update({
            proveedor: nuevaCotizacion.proveedor,
            cantidad: cantidadNueva,
            total: nuevoTotal,
          }).eq('id', oc.id);
        }
      }

      alert('Cotización actualizada correctamente');
      setShowEditModal(false);
      setEditingCotizacion(null);
      setNuevaCotizacion({ proveedor: '', precio_unitario: '', cantidad: '', tiempo_entrega_dias: '', observaciones: '', creado_por: '' });

      if (selectedSolicitud) {
        const cotis = await cargarCotizaciones(selectedSolicitud.id);
        setCotizaciones(cotis);
      }
      cargarSolicitudes();
    } catch (error) {
      alert('Error al actualizar la cotización');
    }
  };

  const eliminarCotizacion = async (cot: any) => {
    if (cot.estado === 'seleccionada') {
      alert('No se puede eliminar una cotización que ya ha sido seleccionada.');
      return;
    }

    if (!confirm(`¿Eliminar la cotización de "${cot.proveedor}"?`)) return;

    try {
      await supabase.from('cotizaciones').delete().eq('id', cot.id);
      alert('Cotización eliminada correctamente');

      if (selectedSolicitud) {
        const cotis = await cargarCotizaciones(selectedSolicitud.id);
        setCotizaciones(cotis);
      }
      cargarSolicitudes();
    } catch (error) {
      alert('Error al eliminar la cotización');
    }
  };

  const seleccionarCotizacion = async (cotizacion: any) => {
    if (!cotizacion?.id || !cotizacion?.solicitud_id) {
      alert("Datos de cotización incompletos");
      return;
    }

    const { data: solicitud } = await supabase
      .from('solicitudes')
      .select('cantidad')
      .eq('id', cotizacion.solicitud_id)
      .single();

    const { data: cotizacionesSeleccionadas } = await supabase
      .from('cotizaciones')
      .select('cantidad')
      .eq('solicitud_id', cotizacion.solicitud_id)
      .eq('estado', 'seleccionada');

    const cantidadYaSeleccionada = cotizacionesSeleccionadas?.reduce((sum, c) => sum + Number(c.cantidad || 0), 0) || 0;
    const cantidadNueva = Number(cotizacion.cantidad || 0);
    const totalSeleccionado = cantidadYaSeleccionada + cantidadNueva;

    if (totalSeleccionado > (solicitud?.cantidad || 0)) {
      alert(`La cantidad total seleccionada excede la cantidad solicitada.`);
      return;
    }

    if (!confirm(`¿Seleccionar cotización de ${cotizacion.proveedor} y crear la Orden de Compra?`)) return;

    try {
      await supabase.from('cotizaciones').update({ estado: 'seleccionada' }).eq('id', cotizacion.id);

      const { data: solicitudData } = await supabase
        .from('solicitudes')
        .select('cantidad, unidad, insumo, obras(nombre)')
        .eq('id', cotizacion.solicitud_id)
        .single();

      const cantidadUsada = Number(cotizacion.cantidad || solicitudData?.cantidad || 0);
      const total = Number(cotizacion.precio_unitario) * cantidadUsada;
      const numeroOC = await generarNumeroOC();

      await supabase.from('ordenes_compra').insert({
        solicitud_id: cotizacion.solicitud_id,
        numero_oc: numeroOC,
        proveedor: cotizacion.proveedor,
        total: total,
        cantidad: cantidadUsada,
        cotizacion_id: cotizacion.id,
        estado: 'pendiente_aprobacion',
        fecha_emision: new Date().toISOString(),
        observaciones: `Creada automáticamente desde cotización #${cotizacion.id}`,
      });

      alert(`¡Éxito! Orden de Compra creada: ${numeroOC}`);

      setCotizaciones(prev => prev.map(c =>
        c.id === cotizacion.id ? { ...c, estado: 'seleccionada' } : c
      ));

      cargarSolicitudes();
    } catch (error: any) {
      alert('Error al crear la Orden de Compra: ' + (error.message || error));
    }
  };

  // Resumen
  const resumen = cotizaciones.length > 0 ? {
    cantidad: cotizaciones.length,
    precioMinimo: Math.min(...cotizaciones.map(c => c.precio_unitario)),
    precioMaximo: Math.max(...cotizaciones.map(c => c.precio_unitario)),
    precioPromedio: cotizaciones.reduce((sum, c) => sum + c.precio_unitario, 0) / cotizaciones.length,
  } : null;

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
    href="/compras/solicitudes" 
    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
  >
    Ir a Solicitudes →
  </Link>
</div>

{/* Título centrado */}
<PageHeader
  title="Cotizaciones"
  centerTitle={true}
/>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" text="Cargando cotizaciones..." />
        </div>
      ) : (
        <>
{/* Filtros - Cotizaciones */}
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
          { value: 'seleccionada', label: 'Seleccionada' },
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

    <div className="lg:col-span-3"></div>
  </div>

  {/* Fila 2: Búsquedas más amplias + Limpiar Filtros */}
<div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-5">
  
  {/* Buscar por Insumo - más ancho */}
  <div className="md:col-span-2">
    <SearchInput
      value={searchInput}
      onChange={setSearchInput}
      placeholder="Buscar por insumo..."
    />
  </div>

  {/* Buscar por Solicitante - más ancho */}
  <div className="md:col-span-2">
    <SearchInput
      value={solicitanteFiltro}
      onChange={setSolicitanteFiltro}
      placeholder="Buscar por solicitante..."
    />
  </div>

  {/* Limpiar Filtros */}
  <div className="md:col-span-1 flex justify-end items-end">
    <ActionButton variant="secondary" onClick={limpiarFiltros}>
      Limpiar Filtros
    </ActionButton>
  </div>
</div>
</Card>

          {/* Contenido principal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de Solicitudes */}
            <Card padding="none" className="overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h2 className="font-semibold">Solicitudes para cotizar</h2>
              </div>

              <div className="divide-y max-h-[620px] overflow-auto">
                {solicitudes.length === 0 ? (
                  <EmptyState
                    icon={<span className="text-4xl">📋</span>}
                    title="No hay solicitudes"
                    description="No se encontraron solicitudes pendientes de cotizar."
                  />
                ) : (
                  solicitudes.map((sol) => (
                    <div
                      key={sol.id}
                      onClick={() => abrirSolicitud(sol)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center ${selectedSolicitud?.id === sol.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                    >
                      <div>
                        <p className="font-medium">{sol.insumo}</p>
                        <p className="text-sm text-gray-500">{sol.obras?.nombre}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{sol.cantidad} {sol.unidad}</p>
                        {cotizacionesCount[sol.id] > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 mt-1 inline-block">
                            {cotizacionesCount[sol.id]} cotiz.
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Panel de Cotizaciones */}
            <Card className="flex flex-col min-h-[620px]">
              {!selectedSolicitud ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 p-8 text-center">
                  Selecciona una solicitud para ver o agregar cotizaciones
                </div>
              ) : (
                <>
                  <div className="p-4 border-b bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="font-semibold text-lg">{selectedSolicitud.insumo}</h2>
                        <p className="text-base text-gray-600 font-medium">{selectedSolicitud.obras?.nombre}</p>
                      </div>
                      <ActionButton onClick={() => {
                        setNuevaCotizacion({ proveedor: '', precio_unitario: '', cantidad: '', tiempo_entrega_dias: '', observaciones: '', creado_por: '' });
                        setShowAddModal(true);
                      }}>
                        + Agregar Cotización
                      </ActionButton>
                    </div>

                    {resumen && cotizaciones.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white border rounded-xl p-3">
                          <p className="text-xs text-gray-500">Cotizaciones</p>
                          <p className="text-2xl font-bold">{resumen.cantidad}</p>
                        </div>
                        <div className="bg-white border rounded-xl p-3">
                          <p className="text-xs text-gray-500">Precio más bajo</p>
                          <p className="text-xl font-bold text-green-600">${resumen.precioMinimo.toLocaleString('es-CO')}</p>
                        </div>
                        <div className="bg-white border rounded-xl p-3">
                          <p className="text-xs text-gray-500">Promedio</p>
                          <p className="text-xl font-bold text-blue-600">${resumen.precioPromedio.toFixed(0)}</p>
                        </div>
                        <div className="bg-white border rounded-xl p-3">
                          <p className="text-xs text-gray-500">Precio más alto</p>
                          <p className="text-xl font-bold text-red-600">${resumen.precioMaximo.toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 overflow-auto">
                    {cotizaciones.length === 0 ? (
                      <p className="text-center py-10 text-gray-500">Aún no hay cotizaciones para esta solicitud.</p>
                    ) : (
                      <div className="space-y-3">
                        {cotizaciones.map((cot) => {
                          const isSelected = cot.estado === 'seleccionada';
                          const total = cot.precio_unitario * cot.cantidad;

                          return (
                            <div key={cot.id} className={`border rounded-2xl p-5 ${isSelected ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
                              <div className="flex justify-between">
                                <div>
                                  <p className="font-semibold text-lg">{cot.proveedor}</p>
                                  <p className="text-sm text-gray-600">
                                    ${cot.precio_unitario.toLocaleString('es-CO')} × {cot.cantidad} {cot.unidad}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold">${total.toLocaleString('es-CO')}</p>
                                  {isSelected && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Seleccionada</span>}
                                </div>
                              </div>

                              <div className="flex gap-2 mt-4 justify-end">
                                {!isSelected && (
                                  <ActionButton onClick={() => seleccionarCotizacion(cot)} size="sm">
                                    Seleccionar
                                  </ActionButton>
                                )}
                                <ActionButton variant="secondary" size="sm" onClick={() => abrirEditar(cot)}>
                                  Editar
                                </ActionButton>
                                <ActionButton variant="danger" size="sm" onClick={() => eliminarCotizacion(cot)}>
                                  Eliminar
                                </ActionButton>
                              </div>

                              {cot.observaciones && (
                                <div className="mt-3 pt-3 border-t text-sm text-gray-600">{cot.observaciones}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Modal Agregar Cotización */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Nueva Cotización" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Proveedor *</label>
            <input type="text" value={nuevaCotizacion.proveedor} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, proveedor: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Precio unitario *</label>
            <input type="number" step="0.01" value={nuevaCotizacion.precio_unitario} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, precio_unitario: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Cantidad</label>
            <input type="number" value={nuevaCotizacion.cantidad} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, cantidad: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
             Restante por cotizar: {
             selectedSolicitud 
             ? selectedSolicitud.cantidad - cotizaciones
               .filter(c => c.estado === 'seleccionada')
               .reduce((sum, c) => sum + Number(c.cantidad || 0), 0)
             : 0
             } {selectedSolicitud?.unidad}
          </p>
          <div>
            <label className="block text-sm font-semibold mb-1">Tiempo de entrega (días)</label>
            <input type="number" value={nuevaCotizacion.tiempo_entrega_dias} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, tiempo_entrega_dias: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Creado por</label>
            <input type="text" value={nuevaCotizacion.creado_por} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, creado_por: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Observaciones</label>
            <textarea value={nuevaCotizacion.observaciones} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, observaciones: e.target.value })} className="w-full border rounded-xl p-2.5 h-20" />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <ActionButton variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">Cancelar</ActionButton>
          <ActionButton onClick={agregarCotizacion} className="flex-1">Guardar Cotización</ActionButton>
        </div>
      </Modal>

      {/* Modal Editar Cotización */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Cotización" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Proveedor</label>
            <input type="text" value={nuevaCotizacion.proveedor} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, proveedor: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Precio unitario</label>
            <input type="number" value={nuevaCotizacion.precio_unitario} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, precio_unitario: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Cantidad</label>
            <input type="number" value={nuevaCotizacion.cantidad} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, cantidad: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Tiempo de entrega (días)</label>
            <input type="number" value={nuevaCotizacion.tiempo_entrega_dias} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, tiempo_entrega_dias: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Creado por</label>
            <input type="text" value={nuevaCotizacion.creado_por} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, creado_por: e.target.value })} className="w-full border rounded-xl p-2.5" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Observaciones</label>
            <textarea value={nuevaCotizacion.observaciones} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, observaciones: e.target.value })} className="w-full border rounded-xl p-2.5 h-20" />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <ActionButton variant="secondary" onClick={() => setShowEditModal(false)} className="flex-1">Cancelar</ActionButton>
          <ActionButton onClick={guardarEdicion} className="flex-1">Guardar Cambios</ActionButton>
        </div>
      </Modal>
    </div>
  );
}