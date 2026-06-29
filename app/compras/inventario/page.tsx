'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import PageHeader from '@/components/ui/PageHeader';
import ActionButton from '@/components/ui/ActionButton';
import Modal from '@/components/ui/Modal';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Loading from '@/components/ui/Loading';
import SearchInput from '@/components/ui/SearchInput';
import SelectFilter from '@/components/ui/SelectFilter';

export default function InventarioPage() {
  const [inventario, setInventario] = useState<any[]>([]);
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
 const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [numeroOcFiltro, setNumeroOcFiltro] = useState('');
 const [fechaInicio, setFechaInicio] = useState('');
 const [fechaFin, setFechaFin] = useState('');

  // Modales
  const [showKardexModal, setShowKardexModal] = useState(false);
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [materialSeleccionado, setMaterialSeleccionado] = useState<any>(null);
  const [itemParaAjuste, setItemParaAjuste] = useState<any>(null);
  const [kardexData, setKardexData] = useState<any[]>([]);

  const [nuevoStock, setNuevoStock] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [ajustadoPor, setAjustadoPor] = useState('');

  // Cargar obras
  useEffect(() => {
    const cargarObras = async () => {
      const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (data) setObras(data);
    };
    cargarObras();
  }, []);

  // Cargar inventario
  const cargarInventario = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('inventario')
        .select(`*, obras(nombre)`)
        .order('updated_at', { ascending: false });

      if (selectedObraId) query = query.eq('obra_id', selectedObraId);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      if (searchTerm.trim()) {
        const texto = searchTerm.toLowerCase().trim();
        filtered = filtered.filter((item: any) =>
          item.insumo?.toLowerCase().includes(texto)
        );
      }

      setInventario(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarInventario();
  }, [selectedObraId, searchTerm]);

  // Alerta de stock bajo
  const getStockAlert = (cantidad: number) => {
    if (cantidad <= 5) return { color: 'text-red-700 bg-red-100 border-red-300', mensaje: '¡Crítico!', icono: '🔴' };
    if (cantidad <= 20) return { color: 'text-orange-700 bg-orange-100 border-orange-300', mensaje: 'Stock bajo', icono: '🟠' };
    return { color: 'text-green-700 bg-green-100 border-green-300', mensaje: '', icono: '' };
  };

  // Ver Kardex
  const verKardex = async (item: any) => {
    setMaterialSeleccionado(item);

    try {
      const { data: entradas } = await supabase
        .from('entradas_almacen')
        .select('*')
        .eq('insumo', item.insumo)
        .order('fecha_entrada', { ascending: false });

      const { data: ajustes } = await supabase
        .from('ajustes_inventario')
        .select('*')
        .eq('insumo', item.insumo)
        .eq('obra_id', item.obra_id)
        .order('fecha_ajuste', { ascending: false });

      const movimientos = [
        ...(entradas || []).map(m => ({ ...m, tipo_movimiento: 'entrada', fecha: m.fecha_entrada })),
        ...(ajustes || []).map(a => ({ ...a, tipo_movimiento: 'ajuste', fecha: a.fecha_ajuste }))
      ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setKardexData(movimientos);
      setShowKardexModal(true);
    } catch (error) {
      alert('Error al cargar el Kardex');
    }
  };

  // Abrir modal de ajuste
  const abrirAjusteStock = (item: any) => {
    setItemParaAjuste(item);
    setNuevoStock(item.cantidad.toString());
    setAjustadoPor('');
    setMotivoAjuste('');
    setShowAjusteModal(true);
  };

  // Guardar ajuste
  const guardarAjusteStock = async () => {
    if (!itemParaAjuste || !nuevoStock || !ajustadoPor) {
      alert('Por favor completa Nueva Cantidad y Realizado por');
      return;
    }

    const nuevaCantidad = Number(nuevoStock);
    const cantidadAnterior = Number(itemParaAjuste.cantidad);
    const diferencia = nuevaCantidad - cantidadAnterior;

    if (diferencia === 0) {
      alert('No hay cambios en la cantidad');
      return;
    }

    try {
      await supabase.from('ajustes_inventario').insert({
        insumo: itemParaAjuste.insumo,
        obra_id: itemParaAjuste.obra_id,
        tipo: diferencia > 0 ? 'entrada' : 'salida',
        cantidad: diferencia,
        motivo: motivoAjuste || 'Ajuste manual',
        realizado_por: ajustadoPor,
        stock_anterior: cantidadAnterior,
        stock_nuevo: nuevaCantidad,
      });

      await supabase.from('inventario').update({
        cantidad: nuevaCantidad,
        updated_at: new Date().toISOString()
      }).eq('id', itemParaAjuste.id);

      alert('Ajuste registrado correctamente');
      setShowAjusteModal(false);
      cargarInventario();
    } catch (error) {
      alert('Error al registrar el ajuste');
    }
  };

  // Exportar Kardex a PDF
  const exportarKardexPDF = async (item: any) => {
    const { data: movimientos } = await supabase
      .from('entradas_almacen')
      .select('*')
      .eq('insumo', item.insumo)
      .order('fecha_entrada', { ascending: false });

    const doc = new jsPDF();
    const fechaActual = new Date().toLocaleDateString('es-CO');

    doc.setFontSize(18);
    doc.text('KARDEX - HISTORIAL DE INVENTARIO', 14, 20);

    doc.setFontSize(12);
    doc.text(`Insumo: ${item.insumo}`, 14, 30);
    doc.text(`Obra: ${item.obras?.nombre || '—'}`, 14, 36);
    doc.text(`Cantidad Actual: ${item.cantidad} ${item.unidad}`, 14, 42);
    doc.text(`Ubicación: ${item.ubicacion_almacen || '—'}`, 14, 48);
    doc.text(`Fecha: ${fechaActual}`, 14, 54);

    const tableData = (movimientos || []).map((mov: any) => [
      new Date(mov.fecha_entrada).toLocaleDateString('es-CO'),
      `+${mov.cantidad_recibida} ${mov.unidad}`,
      mov.recibido_por || '—',
      mov.observaciones || '—'
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Fecha', 'Cantidad', 'Recibido por', 'Observaciones']],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`Kardex_${item.insumo.replace(/\s+/g, '_')}.pdf`);
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
    href="/compras/entradas" 
    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
  >
    Ir a Entradas de Almacén →
  </Link>
</div>

<PageHeader
  title="Inventario"
  centerTitle={true}
/>

      {/* Filtros */}
<Card className="mb-6">
  {/* Fila 1: Obra + N° Orden + Rango de Fechas */}
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

    {/* Número de Orden */}
    <div className="lg:col-span-3">
      <SearchInput
        value={numeroOcFiltro}
        onChange={setNumeroOcFiltro}
        placeholder="Buscar N° Orden..."
      />
    </div>

    {/* Rango de Fechas */}
    <div className="lg:col-span-6">
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

  {/* Fila 2: Buscar por Insumo + Limpiar Filtros */}
  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-5">
    <div className="md:col-span-4">
      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar por insumo..."
      />
    </div>

    <div className="md:col-span-1 flex justify-end items-end">
      <ActionButton variant="secondary" onClick={() => {
        setSelectedObraId(null);
        setNumeroOcFiltro('');
        setFechaInicio('');
        setFechaFin('');
        setSearchTerm('');
      }}>
        Limpiar Filtros
      </ActionButton>
    </div>
  </div>
</Card>

      {/* Tabla de Inventario */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" text="Cargando inventario..." />
        </div>
      ) : inventario.length === 0 ? (
        <EmptyState
          icon={<span className="text-5xl">📦</span>}
          title="No hay inventario"
          description="Aún no hay materiales registrados en inventario."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left">Insumo</th>
                  <th className="px-6 py-4 text-left">Obra</th>
                  <th className="px-6 py-4 text-center">Cantidad</th>
                  <th className="px-6 py-4 text-left">Ubicación</th>
                  <th className="px-6 py-4 text-left">Última Orden</th>
                  <th className="px-6 py-4 text-center">Última Actualización</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inventario.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{item.insumo}</td>
                    <td className="px-6 py-4 text-sm">{item.obras?.nombre || '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`px-4 py-1 rounded-full text-sm font-semibold border ${getStockAlert(item.cantidad).color}`}>
                          {item.cantidad} {item.unidad}
                        </span>
                        {getStockAlert(item.cantidad).mensaje && (
                          <span className="mt-1 text-xs font-medium text-red-600">
                            {getStockAlert(item.cantidad).icono} {getStockAlert(item.cantidad).mensaje}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{item.ubicacion_almacen || <span className="text-gray-400 italic">Sin ubicación</span>}</td>
                    <td className="px-6 py-4 text-sm font-mono text-blue-600">{item.ultima_orden_compra || '—'}</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">
                      {new Date(item.updated_at).toLocaleDateString('es-CO')}
                    </td>

                    <td className="px-6 py-4 text-center">
  <div className="flex justify-center items-center gap-2">
    
    {/* Kardex - Secundario neutro */}
    <ActionButton 
      variant="secondary" 
      size="sm" 
      onClick={() => verKardex(item)}
    >
      Kardex
    </ActionButton>

    {/* Ajustar - Destacado (naranja) */}
    <button
      onClick={() => abrirAjusteStock(item)}
      className="px-3 py-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
    >
      Ajustar
    </button>

    {/* PDF - Diferenciado (más claro) */}
    <ActionButton 
      variant="secondary" 
      size="sm" 
      onClick={() => exportarKardexPDF(item)}
      className="border-gray-300 text-gray-600 hover:bg-gray-100"
    >
      PDF
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

      {/* Modal Kardex */}
<Modal 
  isOpen={showKardexModal} 
  onClose={() => setShowKardexModal(false)} 
  title={`Kardex - ${materialSeleccionado?.insumo}`} 
  maxWidth="xl"
>
  {materialSeleccionado && (
    <>
      {/* Información del material */}
      <div className="mb-4">
        <p className="text-gray-600">{materialSeleccionado.obras?.nombre}</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Stock Actual</p>
          <p className="text-2xl font-bold text-gray-900">
            {materialSeleccionado.cantidad} {materialSeleccionado.unidad}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Movimientos</p>
          <p className="text-2xl font-bold text-blue-600">{kardexData.length}</p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Recibido</p>
          <p className="text-2xl font-bold text-green-600">
            {kardexData.reduce((sum, item) => sum + Number(item.cantidad_recibida || item.cantidad || 0), 0)} {materialSeleccionado.unidad}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Última Orden</p>
          <p className="text-lg font-bold text-blue-600 font-mono">
            {materialSeleccionado.ultima_orden_compra || '—'}
          </p>
        </div>
      </div>

      {/* Lista de movimientos */}
      <div className="max-h-[420px] overflow-auto pr-2">
        {kardexData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <p className="text-5xl mb-4">📭</p>
            <p>No hay movimientos registrados para este material.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {kardexData.map((mov, index) => {
              const esEntrada = mov.tipo_movimiento === 'entrada';
              const esAjuste = mov.tipo_movimiento === 'ajuste';

              return (
                <div
                  key={index}
                  className={`border rounded-2xl p-4 ${
                    esEntrada 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-orange-200 bg-orange-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xl font-bold ${esEntrada ? 'text-green-600' : 'text-orange-600'}`}>
                          {esEntrada ? '+' : ''}{esEntrada ? mov.cantidad_recibida : mov.cantidad}
                        </span>
                        <span className="text-gray-600">
                          {mov.unidad || materialSeleccionado?.unidad}
                        </span>

                        {esAjuste && (
                          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-200 text-orange-700 font-medium">
                            Ajuste
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mt-1">
                        {esEntrada ? 'Recibido por:' : 'Realizado por:'}{' '}
                        <span className="font-medium">
                          {esEntrada ? mov.recibido_por : mov.realizado_por || '—'}
                        </span>
                      </p>
                    </div>

                    <div className="text-right text-sm text-gray-500">
                      <p>
                        {new Date(mov.fecha).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(mov.fecha).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {(mov.observaciones || mov.motivo) && (
                    <div className="mt-3 pt-3 border-t text-sm text-gray-600">
                      <span className="font-medium text-gray-700">
                        {esEntrada ? 'Observaciones:' : 'Motivo:'}
                      </span>
                      <br />
                      {esEntrada ? mov.observaciones : mov.motivo}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  )}

  {/* Footer */}
  <div className="flex justify-end mt-6 pt-4 border-t">
    <ActionButton variant="secondary" onClick={() => setShowKardexModal(false)}>
      Cerrar
    </ActionButton>
  </div>
</Modal>

      {/* Modal Ajustar Stock */}
<Modal 
  isOpen={showAjusteModal} 
  onClose={() => setShowAjusteModal(false)} 
  title="Ajustar Stock" 
  maxWidth="md"
>
  {itemParaAjuste && (
    <div className="space-y-5">
      {/* Información del material */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="font-semibold text-lg">{itemParaAjuste.insumo}</p>
        <p className="text-sm text-gray-600">{itemParaAjuste.obras?.nombre}</p>
      </div>

      {/* Cantidad Actual vs Nueva */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Cantidad Actual</label>
          <div className="text-2xl font-bold text-gray-900">
            {itemParaAjuste.cantidad} {itemParaAjuste.unidad}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Nueva Cantidad</label>
          <input
            type="number"
            value={nuevoStock}
            onChange={(e) => setNuevoStock(e.target.value)}
            className="w-full border rounded-xl p-3 text-xl font-semibold"
          />
        </div>
      </div>

      {/* Diferencia */}
      {nuevoStock && Number(nuevoStock) !== itemParaAjuste.cantidad && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-sm text-blue-700">
            Diferencia:{" "}
            <span className="font-bold">
              {Number(nuevoStock) > itemParaAjuste.cantidad ? "+" : ""}
              {Number(nuevoStock) - itemParaAjuste.cantidad} {itemParaAjuste.unidad}
            </span>
          </p>
        </div>
      )}

      {/* Realizado por (Obligatorio) */}
      <div>
        <label className="block text-sm font-semibold mb-1">
          Realizado por <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={ajustadoPor}
          onChange={(e) => setAjustadoPor(e.target.value)}
          className="w-full border rounded-xl p-2.5"
          placeholder="Nombre de quien realiza el ajuste"
        />
      </div>

      {/* Motivo */}
      <div>
        <label className="block text-sm font-semibold mb-1">Motivo del ajuste</label>
        <textarea
          value={motivoAjuste}
          onChange={(e) => setMotivoAjuste(e.target.value)}
          className="w-full border rounded-xl p-2.5 h-20"
          placeholder="Ej: Conteo físico, merma, corrección de error..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Recomendado especialmente cuando la diferencia es significativa.
        </p>
      </div>
    </div>
  )}

  {/* Botones */}
  <div className="flex gap-3 mt-8">
    <ActionButton 
      variant="secondary" 
      onClick={() => setShowAjusteModal(false)} 
      className="flex-1"
    >
      Cancelar
    </ActionButton>
    <ActionButton 
      onClick={guardarAjusteStock} 
      className="flex-1"
    >
      Guardar Ajuste
    </ActionButton>
  </div>
</Modal>
    </div>
  );
}