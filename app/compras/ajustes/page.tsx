'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

import PageHeader from '@/components/ui/PageHeader';
import ActionButton from '@/components/ui/ActionButton';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Loading from '@/components/ui/Loading';
import SearchInput from '@/components/ui/SearchInput';
import SelectFilter from '@/components/ui/SelectFilter';
import DateRangeFilter from '@/components/ui/DateRangeFilter';

export default function AjustesInventarioPage() {
  const [ajustes, setAjustes] = useState<any[]>([]);
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Cargar obras
  useEffect(() => {
    const cargarObras = async () => {
      const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (data) setObras(data);
    };
    cargarObras();
  }, []);

  // Cargar ajustes
  const cargarAjustes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ajustes_inventario')
        .select(`*, obras(nombre)`)
        .order('fecha_ajuste', { ascending: false });

      if (selectedObraId) query = query.eq('obra_id', selectedObraId);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      if (searchTerm.trim()) {
        const texto = searchTerm.toLowerCase().trim();
        filtered = filtered.filter((a: any) => a.insumo?.toLowerCase().includes(texto));
      }

      if (tipoFiltro !== 'todos') {
        filtered = filtered.filter((a: any) => a.tipo === tipoFiltro);
      }

      if (fechaInicio || fechaFin) {
        filtered = filtered.filter((a: any) => {
          const fecha = new Date(a.fecha_ajuste);
          if (fechaInicio && fecha < new Date(fechaInicio)) return false;
          if (fechaFin && fecha > new Date(fechaFin)) return false;
          return true;
        });
      }

      setAjustes(filtered);
    } catch (error) {
      console.error('Error cargando ajustes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAjustes();
  }, [selectedObraId, searchTerm, tipoFiltro, fechaInicio, fechaFin]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header consistente */}
      <div className="mb-2 flex items-center justify-between">
        <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
          ← Volver a Compras
        </Link>
        <Link href="/compras/inventario" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
          Ir a Inventario →
        </Link>
      </div>

      <PageHeader
        title="Ajustes de Inventario"
        centerTitle={true}
      />

      {/* Filtros */}
<Card className="mb-6">
  {/* Fila 1: Obra + Tipo + Rango de Fechas */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
    
    {/* Obra */}
    <div className="lg:col-span-4">
      <SelectFilter
        label="Obra"
        value={selectedObraId || ''}
        onChange={setSelectedObraId}
        placeholder="Todas las obras"
        options={obras.map(o => ({ value: o.id, label: o.nombre }))}
      />
    </div>

    {/* Tipo de Ajuste */}
    <div className="lg:col-span-3">
      <SelectFilter
        label="Tipo de Ajuste"
        value={tipoFiltro}
        onChange={setTipoFiltro}
        placeholder="Todos"
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'entrada', label: 'Entrada' },
          { value: 'salida', label: 'Salida' },
          { value: 'ajuste', label: 'Ajuste' },
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
        setSearchTerm('');
        setTipoFiltro('todos');
        setFechaInicio('');
        setFechaFin('');
      }}>
        Limpiar Filtros
      </ActionButton>
    </div>
  </div>
</Card>

      {/* Tabla de Ajustes */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" text="Cargando ajustes..." />
        </div>
      ) : ajustes.length === 0 ? (
        <EmptyState
          icon={<span className="text-5xl">📝</span>}
          title="No hay ajustes registrados"
          description="Aún no se han realizado ajustes manuales de inventario."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left">Fecha</th>
                  <th className="px-6 py-4 text-left">Insumo</th>
                  <th className="px-6 py-4 text-left">Obra</th>
                  <th className="px-6 py-4 text-center">Tipo</th>
                  <th className="px-6 py-4 text-center">Cantidad</th>
                  <th className="px-6 py-4 text-left">Motivo</th>
                  <th className="px-6 py-4 text-left">Realizado por</th>
                  <th className="px-6 py-4 text-left">Aprobado por</th>
                  <th className="px-6 py-4 text-center">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ajustes.map((ajuste, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(ajuste.fecha_ajuste).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-6 py-4 font-medium">{ajuste.insumo}</td>
                    <td className="px-6 py-4 text-sm">{ajuste.obras?.nombre || '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        ajuste.tipo === 'entrada' ? 'bg-green-100 text-green-700' :
                        ajuste.tipo === 'salida' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {ajuste.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      {ajuste.cantidad > 0 ? '+' : ''}{ajuste.cantidad}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{ajuste.motivo}</td>
                    <td className="px-6 py-4 text-sm">{ajuste.realizado_por || '—'}</td>
                    <td className="px-6 py-4 text-sm">{ajuste.aprobado_por || '—'}</td>
                    <td className="px-6 py-4 text-center text-sm">
                      <span className="text-gray-500">{ajuste.stock_anterior}</span>
                      {' → '}
                      <span className="font-semibold">{ajuste.stock_nuevo}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}