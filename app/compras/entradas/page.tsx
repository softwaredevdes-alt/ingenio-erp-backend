'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrdenCompra {
  id: number;
  proveedor: string;
  total: number;
  estado: string;
  fecha_emision: string;
  solicitudes?: {
    insumo: string;
    cantidad: number;
    unidad?: string;
    obras?: { nombre: string };
  };
  cantidadRecibida?: number;
  cantidadFaltante?: number;
  porcentajeRecibido?: number;
}

interface Entrada {
  id: number;
  orden_compra_id: number;
  insumo: string;
  cantidad_recibida: number;
  unidad?: string;
  fecha_entrada: string;
  recibido_por?: string;
  observaciones?: string;
  ordenes_compra?: { proveedor: string };
}

export default function EntradasAlmacenPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros del historial
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [proveedorFiltro, setProveedorFiltro] = useState('');
  const [insumoFiltro, setInsumoFiltro] = useState('');
  const [proveedores, setProveedores] = useState<string[]>([]);

  // Modal Registrar nueva entrada
  const [showModal, setShowModal] = useState(false);
  const [selectedOrden, setSelectedOrden] = useState<OrdenCompra | null>(null);
  const [cantidadPendiente, setCantidadPendiente] = useState(0);
  const [nuevaEntrada, setNuevaEntrada] = useState({ cantidad_recibida: '', recibido_por: '', observaciones: '' });
  const [errorCantidad, setErrorCantidad] = useState('');

  // Modal Editar entrada
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntrada, setEditingEntrada] = useState<Entrada | null>(null);
  const [editForm, setEditForm] = useState({ cantidad_recibida: '', recibido_por: '', observaciones: '' });

  // Modal Historial de una Orden específica
  const [showOrdenHistoryModal, setShowOrdenHistoryModal] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenCompra | null>(null);
  const [historialOrden, setHistorialOrden] = useState<Entrada[]>([]);

  // === RESUMEN MEJORADO (sin promedio) ===
  const resumen = useMemo(() => {
    if (entradas.length === 0) {
      return {
        totalEntradas: 0,
        totalUnidades: 0,
        proveedoresUnicos: 0
      };
    }

    const totalUnidades = entradas.reduce((sum, e) => sum + e.cantidad_recibida, 0);

    // Contar proveedores únicos
    const proveedoresSet = new Set(
      entradas
      .map(e => e.ordenes_compra?.proveedor)
      .filter(Boolean)
    );

    return {
      totalEntradas: entradas.length,
      totalUnidades: Math.round(totalUnidades),
                          proveedoresUnicos: proveedoresSet.size,
    };
  }, [entradas]);

  // Cargar órdenes con progreso
  const cargarOrdenes = async () => {
    setLoading(true);
    try {
      const { data: ordenesData } = await supabase
      .from('ordenes_compra')
      .select('*, solicitudes(insumo, cantidad, unidad, obras(nombre))')
      .in('estado', ['pendiente', 'enviada', 'recibida_parcial'])
      .order('fecha_emision', { ascending: false });

      if (!ordenesData) {
        setOrdenes([]);
        return;
      }

      const ordenesConProgreso = await Promise.all(
        ordenesData.map(async (orden) => {
          const { data: entradasData } = await supabase
          .from('entradas_almacen')
          .select('cantidad_recibida')
          .eq('orden_compra_id', orden.id);

          const cantidadRecibida = entradasData?.reduce((sum, e) => sum + e.cantidad_recibida, 0) || 0;
          const cantidadOriginal = orden.solicitudes?.cantidad || 0;
          const cantidadFaltante = Math.max(0, cantidadOriginal - cantidadRecibida);
          const porcentajeRecibido = cantidadOriginal > 0
          ? Math.round((cantidadRecibida / cantidadOriginal) * 100)
          : 0;

          return { ...orden, cantidadRecibida, cantidadFaltante, porcentajeRecibido };
        })
      );

      setOrdenes(ordenesConProgreso);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarProveedores = async () => {
    const { data } = await supabase.from('ordenes_compra').select('proveedor').not('proveedor', 'is', null);
    if (data) {
      const unique = [...new Set(data.map(d => d.proveedor))];
      setProveedores(unique);
    }
  };

  const cargarEntradas = async () => {
    const hasProveedorFilter = !!proveedorFiltro;
    let query = hasProveedorFilter
    ? supabase.from('entradas_almacen').select('*, ordenes_compra!inner(proveedor)').eq('ordenes_compra.proveedor', proveedorFiltro)
    : supabase.from('entradas_almacen').select('*, ordenes_compra(proveedor)');

    if (fechaDesde) query = query.gte('fecha_entrada', `${fechaDesde}T00:00:00`);
    if (fechaHasta) query = query.lte('fecha_entrada', `${fechaHasta}T23:59:59`);
    if (insumoFiltro.trim()) query = query.ilike('insumo', `%${insumoFiltro}%`);

    const { data } = await query.order('fecha_entrada', { ascending: false }).limit(50);
    setEntradas(data || []);
  };

  // === Ver historial completo de una orden ===
  const verHistorialDeOrden = async (orden: OrdenCompra) => {
    setOrdenSeleccionada(orden);
    const { data } = await supabase
    .from('entradas_almacen')
    .select('*')
    .eq('orden_compra_id', orden.id)
    .order('fecha_entrada', { ascending: false });
    setHistorialOrden(data || []);
    setShowOrdenHistoryModal(true);
  };

  const abrirRegistrarDesdeHistorial = () => {
    if (!ordenSeleccionada) return;
    setSelectedOrden(ordenSeleccionada);
    setErrorCantidad('');
    setCantidadPendiente(ordenSeleccionada.cantidadFaltante || 0);
    setNuevaEntrada({ cantidad_recibida: '', recibido_por: '', observaciones: '' });
    setShowOrdenHistoryModal(false);
    setShowModal(true);
  };

  const actualizarEstadoOrden = async (ordenId: number) => {
    try {
      const { data: entradasData } = await supabase.from('entradas_almacen').select('cantidad_recibida').eq('orden_compra_id', ordenId);
      const totalRecibido = entradasData?.reduce((sum, e) => sum + e.cantidad_recibida, 0) || 0;
      const { data: ordenData } = await supabase.from('ordenes_compra').select('*, solicitudes(cantidad)').eq('id', ordenId).single();
      const cantidadOriginal = ordenData?.solicitudes?.cantidad || 0;
      let nuevoEstado = 'enviada';
      if (totalRecibido > 0) {
        nuevoEstado = totalRecibido >= cantidadOriginal ? 'recibida_total' : 'recibida_parcial';
      }
      await supabase.from('ordenes_compra').update({ estado: nuevoEstado }).eq('id', ordenId);
    } catch (error) {
      console.error(error);
    }
  };

  const calcularCantidadRecibida = async (ordenId: number): Promise<number> => {
    const { data } = await supabase.from('entradas_almacen').select('cantidad_recibida').eq('orden_compra_id', ordenId);
    return data?.reduce((sum, e) => sum + e.cantidad_recibida, 0) || 0;
  };

  const registrarEntrada = async () => {
    if (!selectedOrden || !nuevaEntrada.cantidad_recibida) {
      alert('Por favor ingresa la cantidad recibida');
      return;
    }
    const cantidadRecibida = Number(nuevaEntrada.cantidad_recibida);
    if (cantidadRecibida > cantidadPendiente) {
      setErrorCantidad(`Solo quedan ${cantidadPendiente} unidades pendientes.`);
      return;
    }
    if (cantidadRecibida <= 0) {
      setErrorCantidad('La cantidad debe ser mayor a 0');
      return;
    }
    setErrorCantidad('');
    try {
      const { error } = await supabase.from('entradas_almacen').insert({
        orden_compra_id: selectedOrden.id,
        insumo: selectedOrden.solicitudes?.insumo || '',
        cantidad_recibida: cantidadRecibida,
        unidad: selectedOrden.solicitudes?.unidad,
        fecha_entrada: new Date().toISOString(),
                                                                       recibido_por: nuevaEntrada.recibido_por || null,
                                                                       observaciones: nuevaEntrada.observaciones || null,
      });
      if (error) throw error;
      await actualizarEstadoOrden(selectedOrden.id);
      alert('Entrada registrada correctamente');
      setShowModal(false);
      setSelectedOrden(null);
      setNuevaEntrada({ cantidad_recibida: '', recibido_por: '', observaciones: '' });
      cargarOrdenes();
      cargarEntradas();
    } catch (error) {
      console.error(error);
      alert('Error al registrar la entrada');
    }
  };

  const abrirEditar = (entrada: Entrada) => {
    setEditingEntrada(entrada);
    setEditForm({
      cantidad_recibida: entrada.cantidad_recibida.toString(),
                recibido_por: entrada.recibido_por || '',
                observaciones: entrada.observaciones || '',
    });
    setShowEditModal(true);
  };

  const guardarEdicion = async () => {
    if (!editingEntrada) return;
    const nuevaCantidad = Number(editForm.cantidad_recibida);
    if (nuevaCantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }
    try {
      const { error } = await supabase.from('entradas_almacen').update({
        cantidad_recibida: nuevaCantidad,
        recibido_por: editForm.recibido_por || null,
        observaciones: editForm.observaciones || null,
      }).eq('id', editingEntrada.id);
      if (error) throw error;
      await actualizarEstadoOrden(editingEntrada.orden_compra_id);
      alert('Entrada actualizada correctamente');
      setShowEditModal(false);
      setEditingEntrada(null);
      cargarEntradas();
      cargarOrdenes();
    } catch (error) {
      console.error(error);
      alert('Error al actualizar la entrada');
    }
  };

  const eliminarEntrada = async (entrada: Entrada) => {
    if (!confirm(`¿Eliminar esta entrada de ${entrada.insumo}?`)) return;
    try {
      const { error } = await supabase.from('entradas_almacen').delete().eq('id', entrada.id);
      if (error) throw error;
      await actualizarEstadoOrden(entrada.orden_compra_id);
      alert('Entrada eliminada');
      cargarEntradas();
      cargarOrdenes();
    } catch (error) {
      console.error(error);
      alert('Error al eliminar la entrada');
    }
  };

  const exportarCSV = () => {
    if (entradas.length === 0) {
      alert('No hay datos para exportar con los filtros actuales.');
      return;
    }
    const headers = ['Fecha', 'Insumo', 'Cantidad', 'Unidad', 'Proveedor', 'Recibido por', 'Observaciones'];
    const rows = entradas.map(e => [
      new Date(e.fecha_entrada).toLocaleDateString('es-CO'),
                              e.insumo,
                              e.cantidad_recibida,
                              e.unidad || '',
                              e.ordenes_compra?.proveedor || '',
                              e.recibido_por || '',
                              e.observaciones || ''
    ]);
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => { csvContent += row.map(field => `"${field}"`).join(',') + '\n'; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fecha = new Date().toISOString().split('T')[0];
    link.download = `Entradas_Almacen_${fecha}.csv`;
    link.click();
  };

  const exportarPDF = () => {
    if (entradas.length === 0) {
      alert('No hay datos para exportar con los filtros actuales.');
      return;
    }
    const doc = new jsPDF();
    const fechaHoy = new Date().toLocaleDateString('es-CO');
    doc.setFontSize(16);
    doc.text('Historial de Entradas a Almacén', 14, 20);
    doc.setFontSize(11);
    doc.text(`Fecha de generación: ${fechaHoy}`, 14, 28);
    const tableColumn = ['Fecha', 'Insumo', 'Cantidad', 'Unidad', 'Proveedor', 'Recibido por', 'Observaciones'];
    const tableRows: any[] = [];
    entradas.forEach(e => {
      tableRows.push([
        new Date(e.fecha_entrada).toLocaleDateString('es-CO'),
                     e.insumo,
                     e.cantidad_recibida,
                     e.unidad || '',
                     e.ordenes_compra?.proveedor || '',
                     e.recibido_por || '',
                     e.observaciones || ''
      ]);
    });
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [234, 88, 12] },
    });
    const fecha = new Date().toISOString().split('T')[0];
    doc.save(`Entradas_Almacen_${fecha}.pdf`);
  };

  const limpiarFiltrosHistorial = () => {
    setFechaDesde(''); setFechaHasta(''); setProveedorFiltro(''); setInsumoFiltro('');
  };

  useEffect(() => {
    cargarOrdenes();
    cargarProveedores();
    cargarEntradas();
  }, []);

  useEffect(() => {
    cargarEntradas();
  }, [fechaDesde, fechaHasta, proveedorFiltro, insumoFiltro]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
    <div className="mb-8">
    <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium mb-2">
    ← Volver al módulo de Compras
    </Link>
    <h1 className="text-3xl font-bold text-gray-900">Entradas a Almacén</h1>
    <p className="text-gray-600 mt-1">Control de recepción de materiales</p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

    {/* === PANEL IZQUIERDO: Órdenes con progreso === */}
    <div className="bg-white rounded-2xl shadow overflow-hidden">
    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
    <h2 className="font-semibold">Órdenes pendientes de recibir</h2>
    <span className="text-sm px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">
    {ordenes.length} pendientes
    </span>
    </div>

    {loading ? (
      <p className="p-6 text-center text-gray-500">Cargando...</p>
    ) : ordenes.length === 0 ? (
      <p className="p-6 text-center text-gray-500">No hay órdenes pendientes.</p>
    ) : (
      <div className="divide-y max-h-[620px] overflow-auto">
      {ordenes.map((orden) => (
        <div
        key={orden.id}
        onClick={() => verHistorialDeOrden(orden)}
        className="p-4 hover:bg-gray-50 cursor-pointer"
        >
        <div className="flex justify-between items-start mb-2">
        <div>
        <p className="font-semibold text-lg">{orden.solicitudes?.insumo}</p>
        <p className="text-sm text-gray-500">{orden.proveedor}</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium self-start">
        {orden.estado}
        </span>
        </div>

        <div className="mt-2">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>Recibidas: <strong>{orden.cantidadRecibida}</strong> de {orden.solicitudes?.cantidad}</span>
        <span className="font-semibold text-orange-600">Faltan: {orden.cantidadFaltante}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
        className="bg-orange-500 h-2.5 rounded-full transition-all"
        style={{ width: `${orden.porcentajeRecibido}%` }}
        ></div>
        </div>
        <div className="text-right text-xs text-gray-500 mt-0.5">
        {orden.porcentajeRecibido}% recibido
        </div>
        </div>
        </div>
      ))}
      </div>
    )}
    </div>

    {/* === PANEL DERECHO: Historial === */}
    <div className="bg-white rounded-2xl shadow overflow-hidden">
    <div className="p-4 border-b bg-gray-50">
    <div className="flex justify-between items-center mb-3">
    <h2 className="font-semibold">Historial de Entradas</h2>
    <div className="flex gap-2">
    <button onClick={limpiarFiltrosHistorial} className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg">Limpiar</button>
    <button onClick={exportarCSV} className="text-sm px-3 py-1 bg-green-600 text-white rounded-lg flex items-center gap-1">📄 CSV</button>
    <button onClick={exportarPDF} className="text-sm px-3 py-1 bg-red-600 text-white rounded-lg flex items-center gap-1">🖨️ PDF</button>
    </div>
    </div>

    {/* Filtros */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
    <div>
    <label className="text-xs text-gray-500">Desde</label>
    <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full border rounded-xl p-2 text-sm" />
    </div>
    <div>
    <label className="text-xs text-gray-500">Hasta</label>
    <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full border rounded-xl p-2 text-sm" />
    </div>
    <div>
    <label className="text-xs text-gray-500">Proveedor</label>
    <select value={proveedorFiltro} onChange={(e) => setProveedorFiltro(e.target.value)} className="w-full border rounded-xl p-2 text-sm">
    <option value="">Todos</option>
    {proveedores.map((prov, i) => <option key={i} value={prov}>{prov}</option>)}
    </select>
    </div>
    <div>
    <label className="text-xs text-gray-500">Insumo</label>
    <input type="text" placeholder="Buscar insumo..." value={insumoFiltro} onChange={(e) => setInsumoFiltro(e.target.value)} className="w-full border rounded-xl p-2 text-sm" />
    </div>
    </div>

    {/* RESUMEN MEJORADO (3 columnas) */}
    {entradas.length > 0 && (
      <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
      <div>
      <p className="text-xs text-gray-500">Total entradas</p>
      <p className="text-2xl font-bold text-gray-800">{resumen.totalEntradas}</p>
      </div>
      <div>
      <p className="text-xs text-gray-500">Unidades recibidas</p>
      <p className="text-2xl font-bold text-green-600">{resumen.totalUnidades}</p>
      </div>
      <div>
      <p className="text-xs text-gray-500">Proveedores</p>
      <p className="text-2xl font-bold text-purple-600">{resumen.proveedoresUnicos}</p>
      </div>
      </div>
    )}
    </div>

    {/* Lista de entradas */}
    <div className="divide-y max-h-[480px] overflow-auto">
    {entradas.length === 0 ? (
      <p className="p-6 text-center text-gray-500">No se encontraron entradas con los filtros aplicados.</p>
    ) : (
      entradas.map((entrada) => (
        <div key={entrada.id} className="p-4 flex justify-between items-start">
        <div>
        <p className="font-medium">{entrada.insumo}</p>
        <p className="text-sm text-gray-500">{entrada.ordenes_compra?.proveedor}</p>
        {entrada.recibido_por && <p className="text-xs text-gray-500 mt-0.5">Recibido por: {entrada.recibido_por}</p>}
        </div>
        <div className="text-right flex flex-col items-end gap-1">
        <p className="font-semibold text-green-600">+{entrada.cantidad_recibida} {entrada.unidad}</p>
        <p className="text-xs text-gray-500">{new Date(entrada.fecha_entrada).toLocaleDateString('es-CO')}</p>
        <div className="flex gap-2 mt-1">
        <button onClick={() => abrirEditar(entrada)} className="text-blue-600 hover:text-blue-800 text-sm px-2 py-0.5 rounded hover:bg-blue-50">✏️ Editar</button>
        <button onClick={() => eliminarEntrada(entrada)} className="text-red-600 hover:text-red-800 text-sm px-2 py-0.5 rounded hover:bg-red-50">🗑️ Eliminar</button>
        </div>
        </div>
        </div>
      ))
    )}
    </div>
    </div>
    </div>

    {/* === MODAL: Historial de una Orden Específica === */}
    {showOrdenHistoryModal && ordenSeleccionada && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
      <div className="p-6 border-b">
      <h2 className="text-2xl font-bold">Historial de la Orden</h2>
      <p className="text-lg text-gray-700 mt-1">{ordenSeleccionada.solicitudes?.insumo} — {ordenSeleccionada.proveedor}</p>
      <div className="mt-2 text-sm text-gray-600">
      Cantidad original: <strong>{ordenSeleccionada.solicitudes?.cantidad} {ordenSeleccionada.solicitudes?.unidad}</strong> &nbsp;|&nbsp;
      Recibido: <strong>{ordenSeleccionada.cantidadRecibida}</strong> &nbsp;|&nbsp;
      Faltante: <strong className="text-orange-600">{ordenSeleccionada.cantidadFaltante}</strong>
      </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
      {historialOrden.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Aún no se han registrado entradas para esta orden.</p>
      ) : (
        <div className="space-y-3">
        {historialOrden.map((entrada) => (
          <div key={entrada.id} className="border rounded-xl p-4">
          <div className="flex justify-between">
          <div>
          <p className="font-semibold">+{entrada.cantidad_recibida} {entrada.unidad}</p>
          <p className="text-sm text-gray-500">{new Date(entrada.fecha_entrada).toLocaleDateString('es-CO')}</p>
          </div>
          {entrada.recibido_por && <p className="text-sm text-gray-600">Recibido por: {entrada.recibido_por}</p>}
          </div>
          {entrada.observaciones && <p className="text-sm text-gray-600 mt-2 italic">“{entrada.observaciones}”</p>}
          </div>
        ))}
        </div>
      )}
      </div>

      <div className="p-6 border-t flex gap-3">
      <button onClick={() => setShowOrdenHistoryModal(false)} className="flex-1 py-3 rounded-xl border">Cerrar</button>
      <button onClick={abrirRegistrarDesdeHistorial} className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-medium">
      Registrar nueva entrada para esta orden
      </button>
      </div>
      </div>
      </div>
    )}

    {/* Modal Registrar Nueva Entrada */}
    {showModal && selectedOrden && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold mb-2">Registrar Entrada</h2>
      <p className="text-sm text-gray-500 mb-1">{selectedOrden.solicitudes?.insumo} — {selectedOrden.proveedor}</p>
      <div className="mb-4 p-3 bg-blue-50 rounded-xl text-sm">
      <p>Pendiente por recibir: <strong>{cantidadPendiente}</strong> {selectedOrden.solicitudes?.unidad}</p>
      </div>
      <div className="space-y-4">
      <div>
      <label className="block text-sm font-semibold mb-1">Cantidad recibida *</label>
      <input type="number" value={nuevaEntrada.cantidad_recibida} onChange={(e) => { setNuevaEntrada({ ...nuevaEntrada, cantidad_recibida: e.target.value }); setErrorCantidad(''); }} className="w-full border rounded-xl p-2.5" />
      {errorCantidad && <p className="text-red-600 text-sm mt-1">{errorCantidad}</p>}
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Recibido por</label>
      <input type="text" value={nuevaEntrada.recibido_por} onChange={(e) => setNuevaEntrada({ ...nuevaEntrada, recibido_por: e.target.value })} className="w-full border rounded-xl p-2.5" placeholder="Nombre de quien recibe" />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Observaciones</label>
      <textarea value={nuevaEntrada.observaciones} onChange={(e) => setNuevaEntrada({ ...nuevaEntrada, observaciones: e.target.value })} className="w-full border rounded-xl p-2.5 h-20" />
      </div>
      </div>
      <div className="flex gap-3 mt-8">
      <button onClick={() => { setShowModal(false); setSelectedOrden(null); setErrorCantidad(''); }} className="flex-1 py-3 rounded-xl border">Cancelar</button>
      <button onClick={registrarEntrada} className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-medium">Registrar Entrada</button>
      </div>
      </div>
      </div>
    )}

    {/* Modal Editar Entrada */}
    {showEditModal && editingEntrada && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold mb-2">Editar Entrada</h2>
      <p className="text-sm text-gray-500 mb-4">{editingEntrada.insumo}</p>
      <div className="space-y-4">
      <div>
      <label className="block text-sm font-semibold mb-1">Cantidad recibida *</label>
      <input type="number" value={editForm.cantidad_recibida} onChange={(e) => setEditForm({ ...editForm, cantidad_recibida: e.target.value })} className="w-full border rounded-xl p-2.5" />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Recibido por</label>
      <input type="text" value={editForm.recibido_por} onChange={(e) => setEditForm({ ...editForm, recibido_por: e.target.value })} className="w-full border rounded-xl p-2.5" />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Observaciones</label>
      <textarea value={editForm.observaciones} onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })} className="w-full border rounded-xl p-2.5 h-20" />
      </div>
      </div>
      <div className="flex gap-3 mt-8">
      <button onClick={() => { setShowEditModal(false); setEditingEntrada(null); }} className="flex-1 py-3 rounded-xl border">Cancelar</button>
      <button onClick={guardarEdicion} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium">Guardar Cambios</button>
      </div>
      </div>
      </div>
    )}
    </div>
  );
}
