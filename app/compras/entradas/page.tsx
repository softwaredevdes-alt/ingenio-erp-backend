'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function EntradasAlmacenPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [obras, setObras] = useState<any[]>([]);

  // Filtros
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [numeroOcFiltro, setNumeroOcFiltro] = useState('');
  const [proveedorFiltro, setProveedorFiltro] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Modal
  const [showEntradaModal, setShowEntradaModal] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historialEntradas, setHistorialEntradas] = useState<any[]>([]);
  const [ordenParaHistorial, setOrdenParaHistorial] = useState<any>(null);
  const [nuevaEntrada, setNuevaEntrada] = useState({
    cantidad_recibida: '',
    recibido_por: '',
    observaciones: '',
  });

  // Colores para la barra de progreso
  const getProgressColor = (porcentaje: number) => {
    if (porcentaje >= 70) return 'bg-green-500';
    if (porcentaje >= 30) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  // Calcula los dias trancurridos para cubrir una OC
  const calcularDiasTranscurridos = (fecha: string) => {
    const fechaEmision = new Date(fecha);
    const hoy = new Date();
    const diffTime = Math.abs(hoy.getTime() - fechaEmision.getTime());
    const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let colorClass = 'text-green-600 bg-green-100';

    if (dias > 30) {
      colorClass = 'text-red-700 bg-red-100';
    } else if (dias > 15) {
      colorClass = 'text-orange-600 bg-orange-100';
    } else if (dias > 7) {
      colorClass = 'text-yellow-700 bg-yellow-100';
    }

    return { dias, colorClass };
  };

  // Cargar obras
  useEffect(() => {
    const cargarObras = async () => {
      const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (data) setObras(data);
    };
      cargarObras();
  }, []);

  // Cargar órdenes de compra
  const cargarOrdenes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
      .from('ordenes_compra')
      .select(`
      *,
      solicitudes (
        id,
        insumo,
        cantidad,
        unidad,
        obra_id,
        ubicacion_almacen,
        obras(nombre)
      )
      `)
      .in('estado', ['enviada', 'recibida'])   // ← Solo estos estados
      .order('fecha_emision', { ascending: false });

      if (error) throw error;

      // Calcular progreso de cada orden
      const ordenesConProgreso = await Promise.all(
        (data || []).map(async (orden: any) => {
          const { data: entradas } = await supabase
          .from('entradas_almacen')
          .select('cantidad_recibida')
          .eq('orden_compra_id', orden.id);

          const cantidadRecibida = entradas?.reduce((sum, e) => sum + Number(e.cantidad_recibida || 0), 0) || 0;
          const cantidadTotal = orden.cantidad || orden.solicitudes?.cantidad || 0;
          const cantidadFaltante = Math.max(0, cantidadTotal - cantidadRecibida);
          const porcentaje = cantidadTotal > 0 ? Math.round((cantidadRecibida / cantidadTotal) * 100) : 0;

          return {
            ...orden,
            cantidadRecibida,
            cantidadFaltante,
            porcentaje,
          };
        })
      );

      // Aplicar filtros adicionales (puedes mantener los que ya tienes)
      let filtered = ordenesConProgreso;

      // ... (tus filtros actuales de número OC, proveedor, fechas, etc.)

      setOrdenes(filtered);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarOrdenes();
  }, [selectedObraId, estadoFiltro, numeroOcFiltro, proveedorFiltro, fechaInicio, fechaFin, searchTerm]);

  // Registrar entrada
  const registrarEntrada = async () => {
    if (!nuevaEntrada.cantidad_recibida || !ordenSeleccionada) {
      alert('Faltan datos');
      return;
    }

    // === VALIDACIÓN: Solo permitir entradas en órdenes "enviada" ===
    if (ordenSeleccionada.estado !== 'enviada') {
      alert('Solo se pueden registrar entradas en órdenes con estado "Enviada".');
      return;
    }

    const cantidad = Number(nuevaEntrada.cantidad_recibida);

    // === VALIDACIÓN: No permitir sobrepasar la cantidad total de la Solicitud ===
    if (ordenSeleccionada.solicitud_id) {
      // Obtener todas las OCs de esta solicitud
      const { data: ordenesDeSolicitud } = await supabase
      .from('ordenes_compra')
      .select('id')
      .eq('solicitud_id', ordenSeleccionada.solicitud_id);

      if (ordenesDeSolicitud && ordenesDeSolicitud.length > 0) {
        const idsOrdenes = ordenesDeSolicitud.map(o => o.id);

        // Sumar todo lo ya recibido de esta solicitud
        const { data: todasLasEntradas } = await supabase
        .from('entradas_almacen')
        .select('cantidad_recibida')
        .in('orden_compra_id', idsOrdenes);

        const totalYaRecibido = todasLasEntradas?.reduce((sum, e) => sum + Number(e.cantidad_recibida || 0), 0) || 0;
        const cantidadSolicitadaOriginal = ordenSeleccionada.solicitudes?.cantidad || 0;

        if (totalYaRecibido + cantidad > cantidadSolicitadaOriginal) {
          alert(
            `No se puede registrar esta entrada.\n\n` +
            `La cantidad total solicitada es ${cantidadSolicitadaOriginal}.\n` +
            `Ya se han recibido ${totalYaRecibido} en total.\n` +
            `Solo puedes recibir hasta ${cantidadSolicitadaOriginal - totalYaRecibido} más.`
          );
          return;
        }
      }
    }

    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (cantidad > ordenSeleccionada.cantidadFaltante) {
      alert(`La cantidad (${cantidad}) excede lo pendiente (${ordenSeleccionada.cantidadFaltante}).`);
      return;
    }

    try {
      // 1. Registrar la entrada
      const { error: entradaError } = await supabase.from('entradas_almacen').insert({
        orden_compra_id: ordenSeleccionada.id,
        cantidad_recibida: cantidad,
        recibido_por: nuevaEntrada.recibido_por || null,
        observaciones: nuevaEntrada.observaciones || null,
        fecha_entrada: new Date().toISOString(),
                                                                                     insumo: ordenSeleccionada.solicitudes?.insumo,
                                                                                     unidad: ordenSeleccionada.solicitudes?.unidad || 'UND',
      });

      if (entradaError) throw entradaError;

      // 2. Actualizar Inventario
      const insumo = ordenSeleccionada.solicitudes?.insumo;
      const obraId = ordenSeleccionada.solicitudes?.obra_id;
      const unidad = ordenSeleccionada.solicitudes?.unidad || 'UND';
      const ubicacion = ordenSeleccionada.solicitudes?.ubicacion_almacen || null;
      const numeroOrden = ordenSeleccionada.numero_oc;

      if (insumo && obraId) {
        const { data: inventarioExistente } = await supabase
        .from('inventario')
        .select('id, cantidad')
        .eq('insumo', insumo)
        .eq('obra_id', obraId)
        .maybeSingle();

        if (inventarioExistente) {
          await supabase
          .from('inventario')
          .update({
            cantidad: Number(inventarioExistente.cantidad) + cantidad,
                  ubicacion_almacen: ubicacion || inventarioExistente.ubicacion_almacen,
                  ultima_orden_compra: numeroOrden,
                  updated_at: new Date().toISOString()
          })
          .eq('id', inventarioExistente.id);
        } else {
          await supabase.from('inventario').insert({
            insumo: insumo,
            obra_id: obraId,
            cantidad: cantidad,
            unidad: unidad,
            ubicacion_almacen: ubicacion,
            ultima_orden_compra: numeroOrden,
            updated_at: new Date().toISOString()
          });
        }
      }

      // 3. Actualizar ubicación también en la solicitud
      if (ordenSeleccionada.solicitud_id && ubicacion) {
        await supabase
        .from('solicitudes')
        .update({ ubicacion_almacen: ubicacion })
        .eq('id', ordenSeleccionada.solicitud_id);
      }

      // 4. Lógica mejorada para marcar estados
      const nuevaCantidadRecibida = ordenSeleccionada.cantidadRecibida + cantidad;
      const cantidadTotal = ordenSeleccionada.cantidad || ordenSeleccionada.solicitudes?.cantidad || 0;
      const seCompleto = nuevaCantidadRecibida >= cantidadTotal;

      if (seCompleto) {
        // Actualizar Orden de Compra a recibida
        await supabase
        .from('ordenes_compra')
        .update({ estado: 'recibida' })
        .eq('id', ordenSeleccionada.id);

        // === LÓGICA MEJORADA PARA LA SOLICITUD ===
        if (ordenSeleccionada.solicitud_id) {
          // Verificar si todas las OC de esta solicitud están recibidas
          const { data: ordenesDeLaSolicitud } = await supabase
          .from('ordenes_compra')
          .select('id, estado')
          .eq('solicitud_id', ordenSeleccionada.solicitud_id);

          const todasRecibidas = ordenesDeLaSolicitud?.every(o => o.estado === 'recibida');

          if (todasRecibidas) {
            // Verificar si la cantidad total recibida cubre lo solicitado
            const { data: totalRecibidoData } = await supabase
            .from('entradas_almacen')
            .select('cantidad_recibida')
            .in('orden_compra_id', ordenesDeLaSolicitud.map(o => o.id));

            const sumaRecibida = totalRecibidoData?.reduce((sum, e) => sum + (e.cantidad_recibida || 0), 0) || 0;
            const cantidadSolicitada = ordenSeleccionada.solicitudes?.cantidad || 0;

            if (sumaRecibida >= cantidadSolicitada) {
              await supabase
              .from('solicitudes')
              .update({ estado: 'recibida' })
              .eq('id', ordenSeleccionada.solicitud_id);

              alert('✅ ¡Orden completada!\nLa solicitud ha sido marcada como RECIBIDA.');
            } else {
              alert('✅ Orden completada.\nAún queda cantidad pendiente en la solicitud.');
            }
          } else {
            alert('✅ Orden completada.\nAún existen otras órdenes pendientes para esta solicitud.');
          }
        } else {
          alert('✅ ¡Orden completada!');
        }
      } else {
        alert('Entrada registrada correctamente');
      }

      // Cerrar modal y recargar
      setShowEntradaModal(false);
      setNuevaEntrada({ cantidad_recibida: '', recibido_por: '', observaciones: '' });
      cargarOrdenes();

    } catch (error) {
      console.error(error);
      alert('Error al registrar entrada');
    }
  };

  // Ver Historial de Cada Entrada
  const verHistorial = async (orden: any) => {
    setOrdenParaHistorial(orden);

    const { data, error } = await supabase
    .from('entradas_almacen')
    .select('*')
    .eq('orden_compra_id', orden.id)
    .order('fecha_entrada', { ascending: false });

    if (error) {
      console.error(error);
      alert('Error al cargar el historial');
      return;
    }

    setHistorialEntradas(data || []);
    setShowHistoryModal(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
    {/* Encabezado */}
    <div className="mb-8 flex items-center justify-between">
    <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
    ← Volver a Compras
    </Link>

    <h1 className="text-3xl font-bold text-gray-900">Entradas de Almacén</h1>

    <Link href="/compras/oc" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
    Ir a Órdenes de Compra →
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
    <label className="block text-sm font-medium text-gray-700 mb-1">N° OC</label>
    <input
    type="text"
    placeholder="OC-2026-..."
    value={numeroOcFiltro}
    onChange={(e) => setNumeroOcFiltro(e.target.value)}
    className="w-full border rounded-xl p-3"
    />
    </div>

    <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
    <select
    value={estadoFiltro}
    onChange={(e) => setEstadoFiltro(e.target.value)}
    className="w-full border rounded-xl p-3"
    >
    <option value="todas">Todos</option>
    <option value="pendiente">Sin recibir</option>
    <option value="parcial">Parcialmente recibido</option>
    <option value="completa">Completamente recibido</option>
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
    </div>

    {/* Segunda fila */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
    <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por Insumo</label>
    <input
    type="text"
    placeholder="Buscar por insumo..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="w-full border rounded-xl p-3"
    />
    </div>

    <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por Proveedor</label>
    <input
    type="text"
    placeholder="Buscar proveedor..."
    value={proveedorFiltro}
    onChange={(e) => setProveedorFiltro(e.target.value)}
    className="w-full border rounded-xl p-3"
    />
    </div>

    <div className="flex items-end">
    <button
    onClick={() => {
      setSelectedObraId(null);
      setEstadoFiltro('todas');
      setNumeroOcFiltro('');
      setFechaInicio('');
      setFechaFin('');
      setSearchTerm('');
      setProveedorFiltro('');
    }}
    className="w-full px-6 py-3 text-sm border rounded-xl hover:bg-gray-100"
    >
    Limpiar Filtros
    </button>
    </div>
    </div>
    </div>

    {/* Tabla de Órdenes */}
    {loading ? (
      <p className="text-center py-10">Cargando órdenes...</p>
    ) : (
      <div className="bg-white rounded-2xl shadow overflow-hidden">
      <table className="w-full">
      <thead className="bg-gray-50 border-b">
      <tr>
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">N° OC</th>
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Fecha Emisión</th>
      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Días Tran.</th>
      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Valor Total</th>
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Proveedor</th>
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Insumo</th>
      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Cantidad</th>
      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Progreso</th>
      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ubicación</th>
      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Acciones</th>
      </tr>
      </thead>
      <tbody className="divide-y">
      {ordenes.length === 0 ? (
        <tr>
        <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
        No se encontraron órdenes de compra.
        </td>
        </tr>
      ) : (
        ordenes.map((orden) => (
          <tr key={orden.id} className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm font-medium text-gray-900">{orden.numero_oc}</td>
          <td className="px-6 py-4 text-sm text-gray-600">
          {new Date(orden.fecha_emision).toLocaleDateString('es-CO')}
          </td>
          <td className="px-6 py-4 text-center">
          {(() => {
            const resultado = calcularDiasTranscurridos(orden.fecha_emision);
            return (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${resultado.colorClass}`}>
              {resultado.dias}
              </span>
            );
          })()}
          </td>
          <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
          {orden.total
            ? `$${Number(orden.total).toLocaleString('es-CO')}`
            : '—'}
            </td>
          <td className="px-6 py-4 text-sm text-gray-700">{orden.proveedor}</td>
          <td className="px-6 py-4 text-sm text-gray-700">{orden.solicitudes?.insumo}</td>
          <td className="px-6 py-4 text-sm text-center text-gray-700">
          {orden.cantidad} {orden.solicitudes?.unidad}
          </td>
          <td className="px-6 py-4 text-center">
          <div className="flex flex-col items-center">
          <span className="text-sm font-medium mb-1">{orden.porcentaje}%</span>

          <div className="w-28 bg-gray-200 rounded-full h-2.5">
          <div
          className={`h-2.5 rounded-full transition-all ${getProgressColor(orden.porcentaje)}`}
          style={{ width: `${orden.porcentaje}%` }}
          />
          </div>

          <span className="text-xs text-gray-500 mt-1">
          {orden.cantidadRecibida} / {orden.cantidad || orden.solicitudes?.cantidad}
          </span>
          </div>
          </td>
          <td className="px-6 py-4 text-sm text-gray-700">
          {orden.solicitudes?.ubicacion_almacen || <span className="text-gray-400 italic">Sin ubicación</span>}
          </td>

          <td className="px-4 py-3 text-center min-w-[115px]">
          <div className="flex flex-col items-stretch gap-1.5">

          {/* Ver Historial */}
          <button
          onClick={() => verHistorial(orden)}
          className="w-full px-3 py-1.5 text-xs border border-gray-300 hover:bg-gray-100 rounded-lg text-center"
          >
          Ver Historial
          </button>

          {/* + Entrada */}
          {orden.estado === 'enviada' && (
            <button
            onClick={() => {
              setOrdenSeleccionada(orden);
              setNuevaEntrada({
                cantidad_recibida: orden.cantidadFaltante.toString(),
                              recibido_por: '',
                              observaciones: ''
              });
              setShowEntradaModal(true);
            }}
            className="w-full px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-center"
            >
            + Entrada
            </button>
          )}

          {/* Completada */}
          {orden.estado === 'recibida' && (
            <span className="w-full px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg font-medium text-center">
            Completada
            </span>
          )}

          </div>
          </td>
          </tr>
        ))
      )}
      </tbody>
      </table>
      </div>
    )}

    {/* Modal Registrar Entrada */}
    {showEntradaModal && ordenSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2">Registrar Entrada</h2>
        <p className="text-sm text-gray-500 mb-6">
        {ordenSeleccionada.solicitudes?.insumo} — {ordenSeleccionada.proveedor}
        </p>

        <div className="space-y-4">
        {/* Ubicación */}
        <div>
        <label className="block text-sm font-semibold mb-1">Ubicación en Almacén</label>
        <input
        type="text"
        value={ordenSeleccionada.solicitudes?.ubicacion_almacen || ''}
        onChange={(e) => {
          // Actualizamos el estado local para que se vea el cambio inmediato
          setOrdenSeleccionada({
            ...ordenSeleccionada,
            solicitudes: {
              ...ordenSeleccionada.solicitudes,
              ubicacion_almacen: e.target.value
            }
          });
        }}
        className="w-full border rounded-xl p-2.5"
        placeholder="Ej: Pasillo A - Estante 3"
        />
        <p className="text-xs text-gray-500 mt-1">Puedes actualizar la ubicación al recibir el material</p>
        </div>

        <div>
        <label className="block text-sm font-semibold mb-1">Cantidad recibida</label>
        <input
        type="number"
        value={nuevaEntrada.cantidad_recibida}
        onChange={(e) => setNuevaEntrada({ ...nuevaEntrada, cantidad_recibida: e.target.value })}
        className="w-full border rounded-xl p-2.5"
        />
        <p className="text-xs text-gray-500 mt-1">
        Pendiente: {ordenSeleccionada.cantidadFaltante} {ordenSeleccionada.solicitudes?.unidad}
        </p>
        </div>

        <div>
        <label className="block text-sm font-semibold mb-1">Recibido por</label>
        <input
        type="text"
        value={nuevaEntrada.recibido_por}
        onChange={(e) => setNuevaEntrada({ ...nuevaEntrada, recibido_por: e.target.value })}
        className="w-full border rounded-xl p-2.5"
        placeholder="Nombre de quien recibe"
        />
        </div>

        <div>
        <label className="block text-sm font-semibold mb-1">Observaciones</label>
        <textarea
        value={nuevaEntrada.observaciones}
        onChange={(e) => setNuevaEntrada({ ...nuevaEntrada, observaciones: e.target.value })}
        className="w-full border rounded-xl p-2.5 h-20"
        placeholder="Observaciones de la recepción..."
        />
        </div>
        </div>

        <div className="flex gap-3 mt-8">
        <button
        onClick={() => setShowEntradaModal(false)}
        className="flex-1 py-3 rounded-xl border"
        >
        Cancelar
        </button>
        <button
        onClick={registrarEntrada}
        className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-medium"
        >
        Registrar Entrada
        </button>
        </div>
        </div>
        </div>
      )}

      {/* Modal Historial de Entradas */}
      {showHistoryModal && ordenParaHistorial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
        <h2 className="text-2xl font-bold">Historial de Entradas</h2>
        <p className="text-gray-600 mt-1">
        {ordenParaHistorial.solicitudes?.insumo} — {ordenParaHistorial.proveedor}
        ({ordenParaHistorial.numero_oc})
        </p>
        </div>

        <div className="flex-1 overflow-auto p-6">
        {historialEntradas.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aún no hay entradas registradas.</p>
        ) : (
          <div className="space-y-4">
          {historialEntradas.map((entrada, index) => (
            <div key={index} className="border rounded-xl p-4">
            <div className="flex justify-between items-start">
            <div>
            <p className="font-semibold text-lg">
            +{entrada.cantidad_recibida} {entrada.unidad}
            </p>
            <p className="text-sm text-gray-600 mt-1">
            Recibido por: {entrada.recibido_por || '—'}
            </p>
            </div>
            <div className="text-right text-sm text-gray-500">
            {new Date(entrada.fecha_entrada).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
            </div>
            </div>
            {entrada.observaciones && (
              <p className="mt-3 text-sm text-gray-600 border-t pt-3">
              {entrada.observaciones}
              </p>
            )}
            </div>
          ))}
          </div>
        )}
        </div>

        <div className="p-6 border-t flex justify-end">
        <button
        onClick={() => setShowHistoryModal(false)}
        className="px-6 py-2.5 border rounded-xl hover:bg-gray-100"
        >
        Cerrar
        </button>
        </div>
        </div>
        </div>
      )}

    </div>
  );
}
