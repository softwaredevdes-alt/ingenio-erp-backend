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

  // Debounce búsqueda
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Cargar obras
  useEffect(() => {
    const cargarObras = async () => {
      const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (data) setObras(data);
    };
      cargarObras();
  }, []);

  // Cargar solicitudes con filtros
  const cargarSolicitudes = async () => {
    setLoading(true);
    try {
      let query = supabase
      .from('solicitudes')
      .select('*, obras(nombre)')
      .in('estado', ['pendiente', 'cotizada'])
      .order('fecha_solicitud', { ascending: false });

      if (selectedObraId) query = query.eq('obra_id', selectedObraId);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      if (searchTerm.trim() !== '') {
        const texto = searchTerm.toLowerCase().trim();
        filtered = filtered.filter((s: any) => s.insumo?.toLowerCase().includes(texto));
      }

      setSolicitudes(filtered);

      const counts: Record<number, number> = {};
      for (const sol of filtered) {
        const { count } = await supabase
        .from('cotizaciones')
        .select('*', { count: 'exact', head: true })
        .eq('solicitud_id', sol.id);
        counts[sol.id] = count || 0;
      }
      setCotizacionesCount(counts);

      if (selectedSolicitud && !filtered.find((s) => s.id === selectedSolicitud.id)) {
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
  }, [selectedObraId, searchTerm]);

  const cargarCotizaciones = async (solicitudId: number) => {
    const { data } = await supabase
    .from('cotizaciones')
    .select('*')
    .eq('solicitud_id', solicitudId)
    .order('precio_unitario', { ascending: true });
    return data || [];
  };

  const abrirSolicitud = async (solicitud: Solicitud) => {
    setSelectedSolicitud(solicitud);
    const cotis = await cargarCotizaciones(solicitud.id);
    setCotizaciones(cotis);
  };

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

    if (!Number.isInteger(cantidadNueva)) {
      alert("La cantidad debe ser un número entero");
      return;
    }

    // Validación de cantidad total
    const { data: cotizacionesExistentes } = await supabase
    .from('cotizaciones')
    .select('cantidad')
    .eq('solicitud_id', selectedSolicitud.id);

    const cantidadYaCotizada = cotizacionesExistentes?.reduce((sum, c) => sum + Number(c.cantidad || 0), 0) || 0;
    const totalCotizado = cantidadYaCotizada + cantidadNueva;

    if (totalCotizado > selectedSolicitud.cantidad) {
      alert(`La cantidad total cotizada (${totalCotizado}) excede la cantidad solicitada (${selectedSolicitud.cantidad}).\nCantidad ya cotizada: ${cantidadYaCotizada}`);
      return;
    }

    try {
      const { error } = await supabase.from('cotizaciones').insert({
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

      if (error) throw error;

      // Actualizar estado de la solicitud si es necesario
      await supabase.from('solicitudes').update({ estado: 'cotizada' }).eq('id', selectedSolicitud.id);

      alert('Cotización agregada correctamente');
      setShowAddModal(false);
      setNuevaCotizacion({ proveedor: '', precio_unitario: '', cantidad: '', tiempo_entrega_dias: '', observaciones: '', creado_por: '' });

      // Recargar
      if (selectedSolicitud) {
        const cotis = await cargarCotizaciones(selectedSolicitud.id);
        setCotizaciones(cotis);
      }
      cargarSolicitudes();
    } catch (error) {
      console.error(error);
      alert('Error al agregar la cotización');
    }
  };

  const abrirEditar = (cot: Cotizacion) => {
    setEditingCotizacion(cot);
    setNuevaCotizacion({
      proveedor: cot.proveedor,
      precio_unitario: cot.precio_unitario.toString(),
      cantidad: cot.cantidad.toString(),           // ← Asegúrate de esto
      tiempo_entrega_dias: cot.tiempo_entrega_dias?.toString() || '',
      observaciones: cot.observaciones || '',
      creado_por: cot.creado_por || '',
    });
    setShowEditModal(true);
  };

  const guardarEdicion = async () => {
    if (!editingCotizacion || !selectedSolicitud) return;

    // Validación de cantidad total al editar
    const cantidadNueva = Number(nuevaCotizacion.cantidad) || 0;
    const cantidadAnterior = Number(editingCotizacion.cantidad) || 0;

    if (cantidadNueva <= 0) {
      alert("La cantidad debe ser mayor a 0");
      return;
    }

    if (!Number.isInteger(cantidadNueva)) {
      alert("La cantidad debe ser un número entero");
      return;
    }

    // Calcular cantidad ya cotizada EXCLUYENDO la cotización actual
    const { data: cotizacionesExistentes } = await supabase
    .from('cotizaciones')
    .select('id, cantidad')
    .eq('solicitud_id', selectedSolicitud.id);

    const cantidadYaCotizadaSinEsta = cotizacionesExistentes
    ?.filter(c => String(c.id) !== String(editingCotizacion.id))  // Comparación segura
    ?.reduce((sum, c) => sum + Number(c.cantidad || 0), 0) || 0;

    const totalCotizado = cantidadYaCotizadaSinEsta + cantidadNueva;

    if (totalCotizado > selectedSolicitud.cantidad) {
      alert(`La cantidad total cotizada (${totalCotizado}) excede la cantidad solicitada (${selectedSolicitud.cantidad}).\nCantidad ya cotizada (sin esta): ${cantidadYaCotizadaSinEsta}`);
      return;
    }

    try {
      const { error } = await supabase.from('cotizaciones').update({
        proveedor: nuevaCotizacion.proveedor,
        precio_unitario: Number(nuevaCotizacion.precio_unitario),
        cantidad: cantidadNueva,
        tiempo_entrega_dias: nuevaCotizacion.tiempo_entrega_dias ? Number(nuevaCotizacion.tiempo_entrega_dias) : null,
        observaciones: nuevaCotizacion.observaciones || null,
        creado_por: nuevaCotizacion.creado_por || null,
      }).eq('id', editingCotizacion.id);

      if (error) throw error;

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
      console.error(error);
      alert('Error al actualizar la cotización');
    }
  };

  const eliminarCotizacion = async (cot: Cotizacion) => {
    if (!confirm(`¿Eliminar la cotización de "${cot.proveedor}"?`)) return;

    try {
      await supabase.from('cotizaciones').delete().eq('id', cot.id);
      alert('Cotización eliminada');
      if (selectedSolicitud) {
        const cotis = await cargarCotizaciones(selectedSolicitud.id);
        setCotizaciones(cotis);
      }
      cargarSolicitudes();
    } catch (error) {
      console.error(error);
      alert('Error al eliminar la cotización');
    }
  };

  const seleccionarCotizacion = async (cotizacion: any) => {
    if (!cotizacion?.id || !cotizacion?.solicitud_id) {
      alert("Datos de cotización incompletos");
      return;
    }

    // Verificar si ya existe una orden para esta solicitud
    const { data: existingOC } = await supabase
    .from('ordenes_compra')
    .select('id')
    .eq('solicitud_id', cotizacion.solicitud_id)
    .single();

    if (existingOC) {
      alert("Esta solicitud ya tiene una Orden de Compra creada.");
      return;
    }

    if (!confirm(`¿Seleccionar cotización de ${cotizacion.proveedor} y crear la Orden de Compra automáticamente?`)) {
      return;
    }

    try {
      // 1. Marcar cotización como seleccionada
      await supabase
      .from('cotizaciones')
      .update({ estado: 'seleccionada' })
      .eq('id', cotizacion.id);

      // 2. Obtener datos de la solicitud
      const { data: solicitud } = await supabase
      .from('solicitudes')
      .select('cantidad, unidad, insumo, obras(nombre)')
      .eq('id', cotizacion.solicitud_id)
      .single();

      const total = Number(cotizacion.precio_unitario) * Number(solicitud?.cantidad || 0);

      // 3. Generar número de OC
      const year = new Date().getFullYear();
      const { count } = await supabase
      .from('ordenes_compra')
      .select('*', { count: 'exact', head: true })
      .gte('fecha_emision', `${year}-01-01`);

      const numeroOC = `OC-${year}-${String((count || 0) + 1).padStart(3, '0')}`;

      // 4. Crear la Orden de Compra
      const { error: ocError } = await supabase.from('ordenes_compra').insert({
        solicitud_id: cotizacion.solicitud_id,
        numero_oc: numeroOC,
        proveedor: cotizacion.proveedor,
        total: total,
        estado: 'pendiente_aprobacion',
        fecha_emision: new Date().toISOString(),
                                                                              observaciones: `Creada automáticamente desde cotización #${cotizacion.id}`,
      });

      if (ocError) throw ocError;

      alert(`¡Éxito!\nOrden de Compra creada: ${numeroOC}\nProveedor: ${cotizacion.proveedor}`);

      // Recargar datos
      cargarCotizaciones();

    } catch (error: any) {
      console.error(error);
      alert('Error al crear la Orden de Compra:\n' + (error.message || error));
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [selectedObraId, searchTerm]);

  // === Cálculo de resumen ===
  const resumen = cotizaciones.length > 0 ? {
    cantidad: cotizaciones.length,
    precioMinimo: Math.min(...cotizaciones.map(c => c.precio_unitario)),
    precioMaximo: Math.max(...cotizaciones.map(c => c.precio_unitario)),
    precioPromedio: cotizaciones.reduce((sum, c) => sum + c.precio_unitario, 0) / cotizaciones.length,
  } : null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
    <div className="mb-8">
    <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium mb-2">
    ← Volver al módulo de Compras
    </Link>
    <h1 className="text-3xl font-bold text-gray-900">Cotizaciones</h1>
    <p className="text-gray-600 mt-1">Comparar precios de proveedores y seleccionar la mejor opción</p>
    </div>

    {loading ? (
      <p className="text-center py-10">Cargando...</p>
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lista de solicitudes */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
      <h2 className="font-semibold mb-3">Solicitudes para cotizar</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <select
      value={selectedObraId || ''}
      onChange={(e) => {
        const newObra = e.target.value || null;
        setSelectedObraId(newObra);
        setSearchInput('');
        setSearchTerm('');
      }}
      className="w-full border rounded-xl p-2 text-sm"
      >
      <option value="">Todas las obras</option>
      {obras.map((obra) => (
        <option key={obra.id} value={obra.id}>{obra.nombre}</option>
      ))}
      </select>

      <div className="relative">
      <input
      type="text"
      placeholder="Buscar por insumo..."
      value={searchInput}
      onChange={(e) => setSearchInput(e.target.value)}
      className="w-full border rounded-xl p-2 pr-9 text-sm"
      />
      {searchInput && (
        <button
        onClick={() => { setSearchInput(''); setSearchTerm(''); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
        ✕
        </button>
      )}
      </div>
      </div>
      </div>

      <div className="divide-y max-h-[580px] overflow-auto">
      {solicitudes.length === 0 ? (
        <p className="p-6 text-center text-gray-500">No se encontraron solicitudes.</p>
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
          <div className="flex justify-end gap-2 mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{sol.estado}</span>
          {cotizacionesCount[sol.id] > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
            {cotizacionesCount[sol.id]} cotiz.
            </span>
          )}
          </div>
          </div>
          </div>
        ))
      )}
      </div>
      </div>

      {/* Panel de cotizaciones */}
      <div className="bg-white rounded-2xl shadow flex flex-col">
      {!selectedSolicitud ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 p-8 text-center">
        Selecciona una solicitud para ver o agregar cotizaciones
        </div>
      ) : (
        <>
        <div className="p-4 border-b bg-gray-50">
        <div className="flex justify-between items-center">
        <div>
        <h2 className="font-semibold">{selectedSolicitud.insumo}</h2>
        <p className="text-sm text-gray-500">{selectedSolicitud.obras?.nombre}</p>
        </div>
        <button
        onClick={() => {
          setNuevaCotizacion({ proveedor: '', precio_unitario: '', cantidad: '', tiempo_entrega_dias: '', observaciones: '', creado_por: '' });
          setShowAddModal(true);
        }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
        + Agregar Cotización
        </button>
        </div>

        {/* === RESUMEN DE TOTALES === */}
        {resumen && cotizaciones.length > 0 && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Cotizaciones</p>
          <p className="text-2xl font-bold text-gray-900">{resumen.cantidad}</p>
          </div>
          <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Precio más bajo</p>
          <p className="text-xl font-bold text-green-600">
          ${resumen.precioMinimo.toLocaleString('es-CO')}
          </p>
          </div>
          <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Promedio</p>
          <p className="text-xl font-bold text-blue-600">
          ${resumen.precioPromedio.toFixed(0).toLocaleString('es-CO')}
          </p>
          </div>
          <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Precio más alto</p>
          <p className="text-xl font-bold text-red-600">
          ${resumen.precioMaximo.toLocaleString('es-CO')}
          </p>
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
            const total = cot.precio_unitario * cot.cantidad;
            const isSelected = cot.estado === 'seleccionada';

          return (
            <div
            key={cot.id}
            className={`border rounded-2xl p-4 transition-all ${isSelected
              ? 'border-green-600 bg-green-50 shadow-md'
          : 'border-gray-200 hover:border-gray-300'}`}
          >
          <div className="flex justify-between items-start">
          <div>
          <p className="font-semibold text-lg">{cot.proveedor}</p>
          <p className="text-sm text-gray-600">
          ${cot.precio_unitario.toLocaleString('es-CO')} × {cot.cantidad} {cot.unidad}
          </p>
          {cot.tiempo_entrega_dias && (
            <p className="text-xs text-gray-500 mt-0.5">Entrega en {cot.tiempo_entrega_dias} días</p>
          )}
          {cot.creado_por && (
            <p className="text-xs text-gray-500 mt-1">Creado por: {cot.creado_por}</p>
          )}
          </div>

          <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">
          ${total.toLocaleString('es-CO')}
          </p>
          {isSelected ? (
            <span className="mt-2 inline-flex items-center px-3 py-1 text-sm font-semibold bg-green-600 text-white rounded-full">
            ✓ Seleccionada
            </span>
          ) : (
            <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => seleccionarCotizacion(cot)} className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Seleccionar</button>
            <button onClick={() => abrirEditar(cot)} className="text-sm px-3 py-1.5 border rounded-xl hover:bg-gray-100">Editar</button>
            <button onClick={() => eliminarCotizacion(cot)} className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-xl">Eliminar</button>
            </div>
          )}
          </div>
          </div>
          {cot.observaciones && <p className="mt-3 text-sm text-gray-600 border-t pt-3">{cot.observaciones}</p>}
          </div>
          );
          })}
          </div>
        )}
        </div>
        </>
      )}
      </div>
      </div>
    )}

    {/* Modal Agregar Cotización */}
    {showAddModal && selectedSolicitud && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold mb-6">Nueva Cotización</h2>
      <div className="space-y-4">
      <div>
      <label className="block text-sm font-semibold mb-1">Proveedor *</label>
      <input type="text" value={nuevaCotizacion.proveedor} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, proveedor: e.target.value })} className="w-full border rounded-xl p-2.5" />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Precio unitario (COP) *</label>
      <input
      type="number"
      step="0.01"
      min="0.01"
      value={nuevaCotizacion.precio_unitario}
      onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, precio_unitario: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      placeholder="0.00"
      />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Cantidad a cotizar</label>
      <input
      type="number"
      min="1"
      step="1"
      value={nuevaCotizacion.cantidad}
      onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, cantidad: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      />
      <p className="text-xs text-gray-500 mt-1">
      Cantidad original solicitada: {selectedSolicitud?.cantidad} {selectedSolicitud?.unidad}
      </p>
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Tiempo de entrega (días)</label>
      <input
      type="number"
      min="1"
      step="1"
      value={nuevaCotizacion.tiempo_entrega_dias} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, tiempo_entrega_dias: e.target.value })} className="w-full border rounded-xl p-2.5" />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Creado por</label>
      <input type="text" value={nuevaCotizacion.creado_por} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, creado_por: e.target.value })} className="w-full border rounded-xl p-2.5" placeholder="Nombre de quien cotiza" />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Observaciones</label>
      <textarea value={nuevaCotizacion.observaciones} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, observaciones: e.target.value })} className="w-full border rounded-xl p-2.5 h-20" />
      </div>
      </div>
      <div className="flex gap-3 mt-8">
      <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl border">Cancelar</button>
      <button onClick={agregarCotizacion} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium">Guardar Cotización</button>
      </div>
      </div>
      </div>
    )}

    {/* Modal Editar Cotización */}
    {showEditModal && editingCotizacion && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold mb-6">Editar Cotización</h2>
      <div className="space-y-4">
      <div>
      <label className="block text-sm font-semibold mb-1">Proveedor</label>
      <input type="text" value={nuevaCotizacion.proveedor} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, proveedor: e.target.value })} className="w-full border rounded-xl p-2.5" />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Precio unitario</label>
      <input type="number"
      min="0.1"
      step="0.1"
      value={nuevaCotizacion.precio_unitario} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, precio_unitario: e.target.value })} className="w-full border rounded-xl p-2.5" />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Cantidad a cotizar</label>
      <input
      type="number"
      min="1"
      step="1"
      value={nuevaCotizacion.cantidad}
      onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, cantidad: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Tiempo de entrega (días)</label>
      <input
      type="number"
      min="1"
      step="1"
      value={nuevaCotizacion.tiempo_entrega_dias} onChange={(e) => setNuevaCotizacion({ ...nuevaCotizacion, tiempo_entrega_dias: e.target.value })} className="w-full border rounded-xl p-2.5" />
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
      <button onClick={() => { setShowEditModal(false); setEditingCotizacion(null); }} className="flex-1 py-3 rounded-xl border">Cancelar</button>
      <button onClick={guardarEdicion} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium">Guardar Cambios</button>
      </div>
      </div>
      </div>
    )}
    </div>
  );
}
