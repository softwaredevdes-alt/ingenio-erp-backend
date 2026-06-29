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

export default function OrdenesCompraPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [obraFiltro, setObraFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todas');
  const [numeroOcFiltro, setNumeroOcFiltro] = useState('');
  const [searchText, setSearchText] = useState('');
  const [proveedorFiltro, setProveedorFiltro] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Modales
  const [showEntradaModal, setShowEntradaModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);

  const [nuevaEntrada, setNuevaEntrada] = useState({
    cantidad_recibida: '',
    recibido_por: '',
    observaciones: '',
  });

  const limpiarFiltros = () => {
    setObraFiltro('');
    setEstadoFiltro('todas');
    setNumeroOcFiltro('');
    setSearchText('');
    setProveedorFiltro('');
    setFechaInicio('');
    setFechaFin('');
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
      let query = supabase
        .from('ordenes_compra')
        .select(`*, solicitudes (insumo, cantidad, unidad, obras (nombre))`)
        .order('fecha_emision', { ascending: false });

      if (obraFiltro) query = query.eq('solicitudes.obras.id', obraFiltro);
      if (estadoFiltro !== 'todas') query = query.eq('estado', estadoFiltro);
      if (numeroOcFiltro) query = query.ilike('numero_oc', `%${numeroOcFiltro}%`);
      if (proveedorFiltro) query = query.ilike('proveedor', `%${proveedorFiltro}%`);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      if (searchText.trim()) {
        const texto = searchText.toLowerCase().trim();
        filtered = filtered.filter((o: any) =>
          o.solicitudes?.insumo?.toLowerCase().includes(texto) ||
          o.proveedor?.toLowerCase().includes(texto)
        );
      }

      if (fechaInicio || fechaFin) {
        filtered = filtered.filter((o: any) => {
          const fecha = new Date(o.fecha_emision);
          if (fechaInicio && fecha < new Date(fechaInicio)) return false;
          if (fechaFin && fecha > new Date(fechaFin)) return false;
          return true;
        });
      }

      setOrdenes(filtered);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarOrdenes();
  }, [obraFiltro, estadoFiltro, numeroOcFiltro, searchText, proveedorFiltro, fechaInicio, fechaFin]);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente_aprobacion': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'enviada':               return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'parcialmente_recibida': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'recibida':              return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'anulada':               return 'bg-red-100 text-red-800 border border-red-200';
      default:                      return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const abrirHistorial = async (orden: any) => {
    setOrdenSeleccionada(orden);
    setShowHistoryModal(true);

    const { data } = await supabase
      .from('entradas_almacen')
      .select('*')
      .eq('orden_compra_id', orden.id)
      .order('fecha_entrada', { ascending: false });

    setHistorial(data || []);
  };

  const abrirEntrada = (orden: any) => {
    setOrdenSeleccionada(orden);
    setNuevaEntrada({ cantidad_recibida: '', recibido_por: '', observaciones: '' });
    setShowEntradaModal(true);
  };

  const registrarEntrada = async () => {
    if (!nuevaEntrada.cantidad_recibida || !ordenSeleccionada) return;

    const cantidad = Number(nuevaEntrada.cantidad_recibida);
    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      await supabase.from('entradas_almacen').insert({
        orden_compra_id: ordenSeleccionada.id,
        cantidad_recibida: cantidad,
        recibido_por: nuevaEntrada.recibido_por || null,
        observaciones: nuevaEntrada.observaciones || null,
        fecha_entrada: new Date().toISOString(),
      });

      alert('Entrada registrada correctamente');
      setShowEntradaModal(false);
      cargarOrdenes();
    } catch (error) {
      alert('Error al registrar entrada');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Encabezado con links alineados */}
      <div className="mb-2 flex items-center justify-between">
        <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
          ← Volver a Compras
        </Link>
        <Link href="/compras/cotizaciones" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
          Ir a Cotizaciones →
        </Link>
      </div>

      <PageHeader
        title="Órdenes de Compra"
        centerTitle={true}
      />

      {/* Filtros */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-3">
            <SelectFilter
              label="Obra"
              value={obraFiltro}
              onChange={setObraFiltro}
              placeholder="Todas las obras"
              options={obras.map(o => ({ value: o.id, label: o.nombre }))}
            />
          </div>

          <div className="lg:col-span-2">
            <SelectFilter
              label="Estado"
              value={estadoFiltro}
              onChange={setEstadoFiltro}
              placeholder="Todos"
              options={[
                { value: 'pendiente_aprobacion', label: 'Pendiente Aprobación' },
                { value: 'enviada', label: 'Enviada' },
                { value: 'parcialmente_recibida', label: 'Parcialmente Recibida' },
                { value: 'recibida', label: 'Recibida' },
                { value: 'anulada', label: 'Anulada' },
              ]}
            />
          </div>

          <div className="lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Emisión</label>
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

          <div className="lg:col-span-3 flex justify-end">
            <ActionButton variant="secondary" onClick={limpiarFiltros}>
              Limpiar Filtros
            </ActionButton>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Buscar por insumo o proveedor..."
          />
          <SearchInput
            value={proveedorFiltro}
            onChange={setProveedorFiltro}
            placeholder="Buscar por proveedor..."
          />
          <SearchInput
            value={numeroOcFiltro}
            onChange={setNumeroOcFiltro}
            placeholder="Buscar N° Orden..."
          />
        </div>
      </Card>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" text="Cargando órdenes..." />
        </div>
      ) : ordenes.length === 0 ? (
        <EmptyState
          icon={<span className="text-5xl">📦</span>}
          title="No hay órdenes de compra"
          description="Aún no se han generado órdenes de compra."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left">N° Orden</th>
                  <th className="px-6 py-4 text-left">Fecha</th>
                  <th className="px-6 py-4 text-left">Proveedor</th>
                  <th className="px-6 py-4 text-left">Insumo</th>
                  <th className="px-6 py-4 text-center">Cantidad</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ordenes.map((orden) => (
                  <tr key={orden.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{orden.numero_oc}</td>
                    <td className="px-6 py-4 text-sm">{new Date(orden.fecha_emision).toLocaleDateString('es-CO')}</td>
                    <td className="px-6 py-4">{orden.proveedor}</td>
                    <td className="px-6 py-4">{orden.solicitudes?.insumo}</td>
                    <td className="px-6 py-4 text-center">{orden.cantidad} {orden.solicitudes?.unidad}</td>
                    <td className="px-6 py-4 text-right font-medium">${orden.total?.toLocaleString('es-CO')}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 text-xs rounded-full border ${getEstadoColor(orden.estado)}`}>
                        {orden.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <ActionButton variant="secondary" size="sm" onClick={() => abrirHistorial(orden)}>
                          Historial
                        </ActionButton>
                        <ActionButton variant="success" size="sm" onClick={() => abrirEntrada(orden)}>
                          Registrar Entrada
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

      {/* Modal Historial */}
      <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Historial de Entradas" maxWidth="lg">
        {historial.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No hay entradas registradas.</p>
        ) : (
          <div className="space-y-3">
            {historial.map((entrada, index) => (
              <div key={index} className="border rounded-xl p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{entrada.cantidad_recibida} unidades</p>
                    <p className="text-sm text-gray-500">{entrada.recibido_por}</p>
                  </div>
                  <div className="text-right text-sm">
                    {new Date(entrada.fecha_entrada).toLocaleDateString('es-CO')}
                  </div>
                </div>
                {entrada.observaciones && <p className="text-sm text-gray-600 mt-2">{entrada.observaciones}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal Registrar Entrada */}
      <Modal isOpen={showEntradaModal} onClose={() => setShowEntradaModal(false)} title="Registrar Nueva Entrada" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Cantidad Recibida</label>
            <input
              type="number"
              value={nuevaEntrada.cantidad_recibida}
              onChange={(e) => setNuevaEntrada({ ...nuevaEntrada, cantidad_recibida: e.target.value })}
              className="w-full border rounded-xl p-2.5"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Recibido por</label>
            <input
              type="text"
              value={nuevaEntrada.recibido_por}
              onChange={(e) => setNuevaEntrada({ ...nuevaEntrada, recibido_por: e.target.value })}
              className="w-full border rounded-xl p-2.5"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Observaciones</label>
            <textarea
              value={nuevaEntrada.observaciones}
              onChange={(e) => setNuevaEntrada({ ...nuevaEntrada, observaciones: e.target.value })}
              className="w-full border rounded-xl p-2.5 h-20"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <ActionButton variant="secondary" onClick={() => setShowEntradaModal(false)} className="flex-1">Cancelar</ActionButton>
          <ActionButton onClick={registrarEntrada} className="flex-1">Registrar Entrada</ActionButton>
        </div>
      </Modal>
    </div>
  );
}