
'use client';

    import { useState, useEffect } from 'react';
    import { supabase } from '@/lib/supabase';
    import Link from 'next/link';

    interface Registro {
        id: number;
        tipo: 'entrada' | 'salida';
        nombre_trabajador: string;
        fecha_hora: string;
        obra_id: string;           // ← Cambiado a string (UUID)
        nota?: string;
        foto_url?: string;
        ubicacion?: string;
        obras?: {
            nombre: string;
        };
    }

    export default function HistorialPersonal() {
        const [obras, setObras] = useState<any[]>([]);
        const [registros, setRegistros] = useState<Registro[]>([]);
        const [loading, setLoading] = useState(true);

        // Filtros
        const [selectedObraId, setSelectedObraId] = useState<string | null>(null); // ← Cambiado a string
        const [tipoFiltro, setTipoFiltro] = useState<'todas' | 'entrada' | 'salida'>('todas');
        const [fechaDesde, setFechaDesde] = useState('');
        const [fechaHasta, setFechaHasta] = useState('');
        const [searchText, setSearchText] = useState('');

        // Cargar obras
        useEffect(() => {
            const cargarObras = async () => {
                const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
                if (data) setObras(data);
            };
                cargarObras();
        }, []);

        // Cargar registros con filtros
        const cargarRegistros = async () => {
            setLoading(true);
            try {
                let query = supabase
                .from('control_personal')
                .select('*, obras(nombre)')
                .order('fecha_hora', { ascending: false });

                if (selectedObraId) {
                    query = query.eq('obra_id', selectedObraId);   // ← Ahora funciona correctamente
                }

                if (tipoFiltro !== 'todas') {
                    query = query.eq('tipo', tipoFiltro);
                }

                if (fechaDesde) {
                    query = query.gte('fecha_hora', `${fechaDesde}T00:00:00`);
                }

                if (fechaHasta) {
                    query = query.lte('fecha_hora', `${fechaHasta}T23:59:59`);
                }

                const { data, error } = await query;
                if (error) throw error;

                let datosFiltrados = data || [];

                // Filtro por nombre
                if (searchText.trim() !== '') {
                    const texto = searchText.toLowerCase().trim();
                    datosFiltrados = datosFiltrados.filter((r: any) =>
                    r.nombre_trabajador?.toLowerCase().includes(texto)
                    );
                }

                setRegistros(datosFiltrados);
            } catch (error) {
                console.error('Error cargando historial:', error);
            } finally {
                setLoading(false);
            }
        };

        useEffect(() => {
            cargarRegistros();
        }, [selectedObraId, tipoFiltro, fechaDesde, fechaHasta, searchText]);

        // Exportar a CSV
        const exportarCSV = () => {
            if (registros.length === 0) return;

            const headers = ['Fecha', 'Hora', 'Tipo', 'Trabajador', 'Obra', 'Nota'];
            const rows = registros.map((r) => {
                const fecha = new Date(r.fecha_hora);
                const fechaStr = fecha.toLocaleDateString('es-CO');
                const horaStr = fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

                return [
                    fechaStr,
                    horaStr,
                    r.tipo === 'entrada' ? 'Entrada' : 'Salida',
                    r.nombre_trabajador,
                    r.obras?.nombre || 'Sin obra',
                    r.nota || '',
                ];
            });

            const csvContent = [
                headers.join(','),
                ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = `historial_personal_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        };

        const limpiarFiltros = () => {
            setSelectedObraId(null);
            setTipoFiltro('todas');
            setFechaDesde('');
            setFechaHasta('');
            setSearchText('');
        };

        return (
            <div className="p-8 max-w-7xl mx-auto">
            {/* Botón Volver */}
            <div className="mb-6">
            <Link href="/personal" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
            ← Volver al módulo principal
            </Link>
            </div>

            <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Historial de Personal</h1>
            <div className="flex gap-3">
            <button
            onClick={limpiarFiltros}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2"
            >
            🧹 Limpiar filtros
            </button>
            <button
            onClick={exportarCSV}
            disabled={registros.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:bg-gray-400 flex items-center gap-2"
            >
            📥 Exportar a CSV
            </button>
            </div>
            </div>

            {/* Filtros */}
            <div className="bg-white p-6 rounded-2xl shadow mb-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Obra */}
            <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Obra</label>
            <select
            value={selectedObraId || ''}
            onChange={(e) => setSelectedObraId(e.target.value || null)}   // ← Simplificado
            className="w-full border rounded-xl p-2.5"
            >
            <option value="">Todas</option>
            {obras.map((obra) => (
                <option key={obra.id} value={obra.id}>{obra.nombre}</option>
            ))}
            </select>
            </div>

            {/* Tipo */}
            <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Tipo</label>
            <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as any)}
            className="w-full border rounded-xl p-2.5"
            >
            <option value="todas">Todas</option>
            <option value="entrada">Solo Entradas</option>
            <option value="salida">Solo Salidas</option>
            </select>
            </div>

            {/* Desde */}
            <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Desde</label>
            <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full border rounded-xl p-2.5"
            />
            </div>

            {/* Hasta */}
            <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Hasta</label>
            <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full border rounded-xl p-2.5"
            />
            </div>

            {/* Buscar por nombre */}
            <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Buscar por nombre</label>
            <input
            type="text"
            placeholder="Nombre del trabajador..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full border rounded-xl p-2.5"
            />
            </div>
            </div>
            </div>

            {/* Tabla */}
            {loading ? (
                <p className="text-center py-10 text-gray-500">Cargando historial...</p>
            ) : registros.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow">
                <p className="text-5xl mb-4">📋</p>
                <p className="text-xl font-semibold text-gray-700">No hay registros</p>
                <p className="text-gray-500 mt-1">No se encontraron marcas con los filtros aplicados.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow overflow-hidden">
                <table className="w-full">
                <thead className="bg-gray-50">
                <tr>
                <th className="p-4 text-left font-semibold text-gray-700">Fecha / Hora</th>
                <th className="p-4 text-left font-semibold text-gray-700">Tipo</th>
                <th className="p-4 text-left font-semibold text-gray-700">Trabajador</th>
                <th className="p-4 text-left font-semibold text-gray-700">Obra</th>
                <th className="p-4 text-left font-semibold text-gray-700">Nota</th>
                </tr>
                </thead>
                <tbody>
                {registros.map((r) => {
                    const fecha = new Date(r.fecha_hora);
                    return (
                        <tr key={r.id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                        <div>{fecha.toLocaleDateString('es-CO')}</div>
                        <div className="text-sm text-gray-500">
                        {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        </td>
                        <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            r.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {r.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                        </span>
                        </td>
                        <td className="p-4 font-medium">{r.nombre_trabajador}</td>
                        <td className="p-4 text-gray-600">{r.obras?.nombre || '—'}</td>
                        <td className="p-4 text-gray-600 text-sm max-w-xs truncate">
                        {r.nota || '—'}
                        </td>
                        </tr>
                    );
                })}
                </tbody>
                </table>

                <div className="p-4 border-t text-sm text-gray-500 text-right">
                Mostrando {registros.length} registros
                </div>
                </div>
            )}
            </div>
        );
    }
