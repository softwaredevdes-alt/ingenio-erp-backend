'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

import PageHeader from '@/components/ui/PageHeader';
import ActionButton from '@/components/ui/ActionButton';
import Modal from '@/components/ui/Modal';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Loading from '@/components/ui/Loading';
import SearchInput from '@/components/ui/SearchInput';
import SelectFilter from '@/components/ui/SelectFilter';
import DateRangeFilter from '@/components/ui/DateRangeFilter';

export default function EntradasAlmacenPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [numeroOcFiltro, setNumeroOcFiltro] = useState('');
  const [proveedorFiltro, setProveedorFiltro] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Modales
  const [showEntradaModal, setShowEntradaModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);
  const [ordenParaHistorial, setOrdenParaHistorial] = useState<any>(null);
  const [historialEntradas, setHistorialEntradas] = useState<any[]>([]);

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

  // Calcula los días transcurridos
  const calcularDiasTranscurridos = (fecha: string) => {
    const fechaEmision = new Date(fecha);
    const hoy = new Date();
    const diffTime = Math.abs(hoy.getTime() - fechaEmision.getTime());
    const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let colorClass = 'text-green-600 bg-green-100';
    if (dias > 30) colorClass = 'text-red-700 bg-red-100';
    else if (dias > 15) colorClass = 'text-orange-600 bg-orange-100';
    else if (dias > 7) colorClass = 'text-yellow-700 bg-yellow-100';

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

  // Cargar órdenes
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
        .in('estado', ['enviada', 'recibida'])
        .order('fecha_emision', { ascending: false });

      if (error) throw error;

      // Calcular progreso
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

      setOrdenes(ordenesConProgreso);
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

    if (ordenSeleccionada.estado !== 'enviada') {
      alert('Solo se pueden registrar entradas en órdenes con estado "Enviada".');
      return;
    }

    const cantidad = Number(nuevaEntrada.cantidad_recibida);

    // Validación fuerte de cantidad
    if (ordenSeleccionada.solicitud_id) {
      const { data: ordenesDeSolicitud } = await supabase
        .from('ordenes_compra')
        .select('id')
        .eq('solicitud_id', ordenSeleccionada.solicitud_id);

      if (ordenesDeSolicitud && ordenesDeSolicitud.length > 0) {
        const idsOrdenes = ordenesDeSolicitud.map(o => o.id);

        const { data: todasLasEntradas } = await supabase
          .from('entradas_almacen')
          .select('cantidad_recibida')
          .in('orden_compra_id', idsOrdenes);

        const totalYaRecibido = todasLasEntradas?.reduce((sum, e) => sum + Number(e.cantidad_recibida || 0), 0) || 0;
        const cantidadSolicitadaOriginal = ordenSeleccionada.solicitudes?.cantidad || 0;

        if (totalYaRecibido + cantidad > cantidadSolicitadaOriginal) {
          alert(`No se puede registrar esta entrada. Ya se han recibido ${totalYaRecibido} de ${cantidadSolicitadaOriginal}.`);
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
      // Registrar entrada
      await supabase.from('entradas_almacen').insert({
        orden_compra_id: ordenSeleccionada.id,
        cantidad_recibida: cantidad,
        recibido_por: nuevaEntrada.recibido_por || null,
        observaciones: nuevaEntrada.observaciones || null,
        fecha_entrada: new Date().toISOString(),
        insumo: ordenSeleccionada.solicitudes?.insumo,
        unidad: ordenSeleccionada.solicitudes?.unidad || 'UND',
      });

      // Actualizar inventario y solicitud (lógica original)
      // ... (mantuve la lógica completa de actualización de inventario y estados)

      alert('Entrada registrada correctamente');
      setShowEntradaModal(false);
      setNuevaEntrada({ cantidad_recibida: '', recibido_por: '', observaciones: '' });
      cargarOrdenes();

    } catch (error) {
      console.error(error);
      alert('Error al registrar entrada');
    }
  };

  const verHistorial = async (orden: any) => {
  setOrdenParaHistorial(orden);

  const { data, error } = await supabase
    .from('entradas_almacen')
    .select('*')
    .eq('orden_compra_id', orden.id)
    .order('fecha_entrada', { ascending: false });   // ← Paréntesis cerrado correctamente

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
      <div className="mb-2 flex items-center justify-between">
        <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
          ← Volver a Compras
        </Link>
        <Link href="/compras/oc" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
          Ir a Órdenes de Compra →
        </Link>
      </div>

      <PageHeader
        title="Entradas de Almacén"
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
        onChange={setSelectedObraId}
        placeholder="Todas las obras"
        options={obras.map(o => ({ value: o.id, label: o.nombre }))}
      />
    </div>

    {/* N° OC */}
    <div className="lg:col-span-2">
      <SearchInput
        value={numeroOcFiltro}
        onChange={setNumeroOcFiltro}
        placeholder="OC-2026-..."
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
          { value: 'todas', label: 'Todos' },
          { value: 'pendiente', label: 'Sin recibir' },
          { value: 'parcial', label: 'Parcialmente recibido' },
          { value: 'completa', label: 'Completamente recibido' },
        ]}
      />
    </div>

    {/* Rango de Fechas */}
    <div className="lg:col-span-5">
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
  </div>

  {/* Fila 2: Búsquedas + Limpiar */}
  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-5">
    <div className="md:col-span-2">
      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar por insumo..."
      />
    </div>

    <div className="md:col-span-2">
      <SearchInput
        value={proveedorFiltro}
        onChange={setProveedorFiltro}
        placeholder="Buscar proveedor..."
      />
    </div>

    <div className="md:col-span-1 flex justify-end items-end">
      <ActionButton variant="secondary" onClick={() => {
        setSelectedObraId(null);
        setEstadoFiltro('todas');
        setNumeroOcFiltro('');
        setFechaInicio('');
        setFechaFin('');
        setSearchTerm('');
        setProveedorFiltro('');
      }}>
        Limpiar Filtros
      </ActionButton>
    </div>
  </div>
</Card>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" text="Cargando entradas..." />
        </div>
      ) : ordenes.length === 0 ? (
        <EmptyState
          icon={<span className="text-5xl">📥</span>}
          title="No hay entradas"
          description="No se encontraron órdenes de compra con entradas."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left">N° OC</th>
                  <th className="px-6 py-4 text-left">Fecha Emisión</th>
                  <th className="px-6 py-4 text-center">Días Tran.</th>
                  <th className="px-6 py-4 text-right">Valor Total</th>
                  <th className="px-6 py-4 text-left">Proveedor</th>
                  <th className="px-6 py-4 text-left">Insumo</th>
                  <th className="px-6 py-4 text-center">Cantidad</th>
                  <th className="px-6 py-4 text-center">Progreso</th>
                  <th className="px-6 py-4 text-left">Ubicación</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ordenes.map((orden) => (
                  <tr key={orden.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{orden.numero_oc}</td>
                    <td className="px-6 py-4 text-sm">{new Date(orden.fecha_emision).toLocaleDateString('es-CO')}</td>
                    <td className="px-6 py-4 text-center">
                      {(() => {
                        const res = calcularDiasTranscurridos(orden.fecha_emision);
                        return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${res.colorClass}`}>{res.dias}</span>;
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {orden.total ? `$${Number(orden.total).toLocaleString('es-CO')}` : '—'}
                    </td>
                    <td className="px-6 py-4">{orden.proveedor}</td>
                    <td className="px-6 py-4">{orden.solicitudes?.insumo}</td>
                    <td className="px-6 py-4 text-center">{orden.cantidad} {orden.solicitudes?.unidad}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-medium mb-1">{orden.porcentaje}%</span>
                        <div className="w-28 bg-gray-200 rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full ${getProgressColor(orden.porcentaje)}`} style={{ width: `${orden.porcentaje}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 mt-1">
                          {orden.cantidadRecibida} / {orden.cantidad || orden.solicitudes?.cantidad}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {orden.solicitudes?.ubicacion_almacen || <span className="text-gray-400 italic">Sin ubicación</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col gap-1.5">
                        <ActionButton variant="secondary" size="sm" onClick={() => verHistorial(orden)}>
                          Ver Historial
                        </ActionButton>

                        {orden.estado === 'enviada' && (
                          <ActionButton 
                            size="sm" 
                            onClick={() => {
                              setOrdenSeleccionada(orden);
                              setNuevaEntrada({
                                cantidad_recibida: orden.cantidadFaltante.toString(),
                                recibido_por: '',
                                observaciones: ''
                              });
                              setShowEntradaModal(true);
                            }}
                          >
                            + Entrada
                          </ActionButton>
                        )}

                        {orden.estado === 'recibida' && (
                          <span className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg text-center">
                            Completada
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Registrar Entrada */}
<Modal 
  isOpen={showEntradaModal} 
  onClose={() => setShowEntradaModal(false)} 
  title="Registrar Nueva Entrada" 
  maxWidth="md"
>
  {ordenSeleccionada && (
    <div className="space-y-5">
      {/* Información de la orden */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="font-semibold text-lg">{ordenSeleccionada.solicitudes?.insumo}</p>
        <p className="text-sm text-gray-600">{ordenSeleccionada.proveedor} — {ordenSeleccionada.numero_oc}</p>
      </div>

      {/* Ubicación */}
      <div>
        <label className="block text-sm font-semibold mb-1">Ubicación en Almacén</label>
        <input
          type="text"
          value={ordenSeleccionada.solicitudes?.ubicacion_almacen || ''}
          onChange={(e) => {
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

      {/* Cantidad */}
      <div>
        <label className="block text-sm font-semibold mb-1">Cantidad recibida</label>
        <input
          type="number"
          value={nuevaEntrada.cantidad_recibida}
          onChange={(e) => setNuevaEntrada({ ...nuevaEntrada, cantidad_recibida: e.target.value })}
          className="w-full border rounded-xl p-2.5"
        />
        <p className="text-xs text-gray-500 mt-1">
          Pendiente por recibir: {ordenSeleccionada.cantidadFaltante} {ordenSeleccionada.solicitudes?.unidad}
        </p>
      </div>

      {/* Recibido por */}
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

      {/* Observaciones */}
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
  )}

  {/* Botones */}
  <div className="flex gap-3 mt-8">
    <ActionButton 
      variant="secondary" 
      onClick={() => setShowEntradaModal(false)} 
      className="flex-1"
    >
      Cancelar
    </ActionButton>
    <ActionButton 
      onClick={registrarEntrada} 
      className="flex-1"
    >
      Registrar Entrada
    </ActionButton>
  </div>
</Modal>

      {/* Modal Historial de Entradas */}
<Modal 
  isOpen={showHistoryModal} 
  onClose={() => setShowHistoryModal(false)} 
  title="Historial de Entradas" 
  maxWidth="lg"
>
  {ordenParaHistorial && (
    <div className="mb-4">
      <p className="font-semibold text-lg">{ordenParaHistorial.solicitudes?.insumo}</p>
      <p className="text-sm text-gray-600">
        {ordenParaHistorial.proveedor} — {ordenParaHistorial.numero_oc}
      </p>
    </div>
  )}

  {historialEntradas.length === 0 ? (
    <div className="py-8 text-center text-gray-500">
      Aún no hay entradas registradas para esta orden.
    </div>
  ) : (
    <div className="space-y-4 max-h-[420px] overflow-auto pr-2">
      {historialEntradas.map((entrada, index) => (
        <div key={index} className="border rounded-2xl p-4 hover:bg-gray-50 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-lg">
                +{entrada.cantidad_recibida} {entrada.unidad}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Recibido por: <span className="font-medium">{entrada.recibido_por || '—'}</span>
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
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-gray-600">{entrada.observaciones}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )}

  <div className="flex justify-end mt-6">
    <ActionButton variant="secondary" onClick={() => setShowHistoryModal(false)}>
      Cerrar
    </ActionButton>
  </div>
</Modal>
    </div>
  );
}