'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

// Lista fija de supervisores (puedes modificarla después)
const SUPERVISORES = [
    'Carlos Mendoza',
'Luis Ramírez',
'Ana Torres',
'Jorge Herrera',
'María López',
];

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
            .select(`
            *,
            obras(nombre)
            `)
            .order('fecha_ajuste', { ascending: false });

            // Filtro por Obra
            if (selectedObraId) {
                query = query.eq('obra_id', selectedObraId);
            }

            const { data, error } = await query;
            if (error) throw error;

            let filtered = data || [];

            // Filtro por Insumo
            if (searchTerm.trim() !== '') {
                const texto = searchTerm.toLowerCase().trim();
                filtered = filtered.filter((a: any) =>
                a.insumo?.toLowerCase().includes(texto)
                );
            }

            // Filtro por Tipo
            if (tipoFiltro !== 'todos') {
                filtered = filtered.filter((a: any) => a.tipo === tipoFiltro);
            }

            // Filtro por Fechas
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
        {/* Encabezado */}
        <div className="mb-8 flex items-center justify-between">
        <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
        ← Volver a Compras
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Ajustes de Inventario</h1>
        <div></div>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Insumo</label>
        <input
        type="text"
        placeholder="Buscar por insumo..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full border rounded-xl p-3"
        />
        </div>

        <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ajuste</label>
        <select
        value={tipoFiltro}
        onChange={(e) => setTipoFiltro(e.target.value)}
        className="w-full border rounded-xl p-3"
        >
        <option value="todos">Todos</option>
        <option value="entrada">Entrada</option>
        <option value="salida">Salida</option>
        <option value="ajuste">Ajuste</option>
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
        </div>

        {/* Tabla de Ajustes */}
        {loading ? (
            <p className="text-center py-10">Cargando ajustes...</p>
        ) : (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
            <thead className="bg-gray-50 border-b">
            <tr>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Fecha</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Insumo</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Obra</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Tipo</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Cantidad</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Motivo</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Realizado por</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Aprobado por</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Stock</th>
            </tr>
            </thead>
            <tbody className="divide-y">
            {ajustes.length === 0 ? (
                <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-gray-500">
                No hay ajustes registrados.
                </td>
                </tr>
            ) : (
                ajustes.map((ajuste, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(ajuste.fecha_ajuste).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{ajuste.insumo}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{ajuste.obras?.nombre || '—'}</td>
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
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {ajuste.motivo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{ajuste.realizado_por || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{ajuste.aprobado_por || '—'}</td>
                    <td className="px-6 py-4 text-center text-sm">
                    <span className="text-gray-500">{ajuste.stock_anterior}</span>
                    {' → '}
                    <span className="font-semibold">{ajuste.stock_nuevo}</span>
                    </td>
                    </tr>
                ))
            )}
            </tbody>
            </table>
            </div>
        )}
        </div>
    );
}
