'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface Estadisticas {
    total: number;
    entradas: number;
    salidas: number;
    trabajadoresUnicos: number;
    diasConActividad: number;
    promedioEntrada: string | null;
    promedioSalida: string | null;
    totalHorasTrabajadas: string | null;
    trabajadorTop: string | null;
}

export default function EstadisticasPersonal() {
    const [obras, setObras] = useState<any[]>([]);
    const [selectedObraId, setSelectedObraId] = useState<string | null>(null); // ← Cambiado a string
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [searchText, setSearchText] = useState('');
    const [stats, setStats] = useState<Estadisticas | null>(null);
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<any[]>([]);

    // Cargar obras
    useEffect(() => {
        const cargarObras = async () => {
            const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
            if (data) setObras(data);
        };
            cargarObras();
    }, []);

    const limpiarFiltros = () => {
        setSelectedObraId(null);
        setFechaDesde('');
        setFechaHasta('');
        setSearchText('');
    };

    const calcularEstadisticas = async () => {
        setLoading(true);
        try {
            let query = supabase
            .from('control_personal')
            .select('tipo, nombre_trabajador, fecha_hora')
            .gte('fecha_hora', `${fechaDesde || '1900-01-01'}T00:00:00`)
            .lte('fecha_hora', `${fechaHasta || '2100-12-31'}T23:59:59`);

            if (selectedObraId) {
                query = query.eq('obra_id', selectedObraId); // ← Ahora funciona correctamente
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                setStats(null);
                setRawData([]);
                setLoading(false);
                return;
            }

            // Filtro por nombre
            let datosFiltrados = data;
            if (searchText.trim() !== '') {
                const texto = searchText.toLowerCase().trim();
                datosFiltrados = data.filter((r: any) =>
                r.nombre_trabajador?.toLowerCase().includes(texto)
                );
            }

            if (datosFiltrados.length === 0) {
                setStats(null);
                setRawData([]);
                setLoading(false);
                return;
            }

            setRawData(datosFiltrados);

            // === Cálculo de estadísticas ===
            const total = datosFiltrados.length;
            const entradas = datosFiltrados.filter((r: any) => r.tipo === 'entrada').length;
            const salidas = datosFiltrados.filter((r: any) => r.tipo === 'salida').length;
            const trabajadoresUnicos = new Set(datosFiltrados.map((r: any) => r.nombre_trabajador)).size;
            const diasUnicos = new Set(datosFiltrados.map((r: any) => r.fecha_hora.split('T')[0])).size;

            // Promedio hora de entrada
            let promedioEntrada: string | null = null;
            const soloEntradas = datosFiltrados.filter((r: any) => r.tipo === 'entrada');
            if (soloEntradas.length > 0) {
                const totalMinutos = soloEntradas.reduce((sum: number, r: any) => {
                    const d = new Date(r.fecha_hora);
                    return sum + (d.getHours() * 60 + d.getMinutes());
                }, 0);
                const prom = Math.round(totalMinutos / soloEntradas.length);
                promedioEntrada = `${Math.floor(prom / 60).toString().padStart(2, '0')}:${(prom % 60).toString().padStart(2, '0')}`;
            }

            // Promedio hora de salida
            let promedioSalida: string | null = null;
            const soloSalidas = datosFiltrados.filter((r: any) => r.tipo === 'salida');
            if (soloSalidas.length > 0) {
                const totalMinutos = soloSalidas.reduce((sum: number, r: any) => {
                    const d = new Date(r.fecha_hora);
                    return sum + (d.getHours() * 60 + d.getMinutes());
                }, 0);
                const prom = Math.round(totalMinutos / soloSalidas.length);
                promedioSalida = `${Math.floor(prom / 60).toString().padStart(2, '0')}:${(prom % 60).toString().padStart(2, '0')}`;
            }

            // Total de horas trabajadas
            let totalHoras = 0;
            const porTrabajadorDia: any = {};
            datosFiltrados.forEach((r: any) => {
                const fecha = r.fecha_hora.split('T')[0];
                const key = `${r.nombre_trabajador}-${fecha}`;
                if (!porTrabajadorDia[key]) porTrabajadorDia[key] = [];
                porTrabajadorDia[key].push(r);
            });

            Object.values(porTrabajadorDia).forEach((registrosDelDia: any) => {
                const entradasDelDia = registrosDelDia.filter((r: any) => r.tipo === 'entrada');
                const salidasDelDia = registrosDelDia.filter((r: any) => r.tipo === 'salida');
                if (entradasDelDia.length > 0 && salidasDelDia.length > 0) {
                    const entradaMasTemprana = Math.min(...entradasDelDia.map((r: any) => new Date(r.fecha_hora).getTime()));
                    const salidaMasTardia = Math.max(...salidasDelDia.map((r: any) => new Date(r.fecha_hora).getTime()));
                    const diferenciaHoras = (salidaMasTardia - entradaMasTemprana) / (1000 * 60 * 60);
                    if (diferenciaHoras > 0) totalHoras += diferenciaHoras;
                }
            });

            const totalHorasTrabajadas = totalHoras > 0 ? `${totalHoras.toFixed(1)} hrs` : null;

            // Trabajador con más marcas
            const conteo: any = {};
            datosFiltrados.forEach((r: any) => {
                conteo[r.nombre_trabajador] = (conteo[r.nombre_trabajador] || 0) + 1;
            });
            const trabajadorTop = Object.entries(conteo).sort((a: any, b: any) => b[1] - a[1])[0];

            setStats({
                total,
                entradas,
                salidas,
                trabajadoresUnicos,
                diasConActividad: diasUnicos,
                promedioEntrada,
                promedioSalida,
                totalHorasTrabajadas,
                trabajadorTop: trabajadorTop ? `${trabajadorTop[0]} (${trabajadorTop[1]})` : null,
            });
        } catch (error) {
            console.error('Error calculando estadísticas:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        calcularEstadisticas();
    }, [selectedObraId, fechaDesde, fechaHasta, searchText]);

    // === Datos para el gráfico de barras ===
    const dailyData = useMemo(() => {
        if (!rawData || rawData.length === 0) return [];

        const grouped: any = {};
        rawData.forEach((r: any) => {
            const date = r.fecha_hora.split('T')[0];
            if (!grouped[date]) {
                grouped[date] = { fecha: date, Entradas: 0, Salidas: 0 };
            }
            if (r.tipo === 'entrada') grouped[date].Entradas++;
            else grouped[date].Salidas++;
        });

            return Object.values(grouped).sort((a: any, b: any) =>
            a.fecha.localeCompare(b.fecha)
            );
    }, [rawData]);

    return (
        <div className="p-8 max-w-7xl mx-auto">
        {/* Botón Volver */}
        <div className="mb-6">
        <Link href="/personal" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
        ← Volver al módulo principal
        </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Estadísticas de Personal</h1>
        <button
        onClick={limpiarFiltros}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2"
        >
        🧹 Limpiar filtros
        </button>
        </div>

        {/* Filtros */}
        <div className="bg-white p-6 rounded-2xl shadow mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700">Obra</label>
        <select
        value={selectedObraId || ''}
        onChange={(e) => setSelectedObraId(e.target.value || null)}   // ← Sin Number()
    className="w-full border rounded-xl p-2.5"
    >
    <option value="">Todas</option>
    {obras.map((obra) => (
        <option key={obra.id} value={obra.id}>{obra.nombre}</option>
    ))}
    </select>
    </div>

    <div>
    <label className="block text-sm font-semibold mb-2 text-gray-700">Desde</label>
    <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full border rounded-xl p-2.5" />
    </div>

    <div>
    <label className="block text-sm font-semibold mb-2 text-gray-700">Hasta</label>
    <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full border rounded-xl p-2.5" />
    </div>

    <div>
    <label className="block text-sm font-semibold mb-2 text-gray-700">Buscar por nombre</label>
    <input type="text" placeholder="Nombre del trabajador..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full border rounded-xl p-2.5" />
    </div>
    </div>
    </div>

    {/* Estadísticas */}
    {loading ? (
        <p className="text-center py-10 text-gray-500">Cargando estadísticas...</p>
    ) : !stats || stats.total === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow">
        <p className="text-5xl mb-4">📊</p>
        <p className="text-xl font-semibold text-gray-700">No hay datos</p>
        <p className="text-gray-500 mt-1">No se encontraron registros con los filtros aplicados.</p>
        </div>
    ) : (
        <>
        {/* Tarjetas de métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow">
        <p className="text-sm text-gray-500">Total de marcas</p>
        <p className="text-5xl font-bold mt-2 text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
        <p className="text-sm text-gray-500">Entradas</p>
        <p className="text-5xl font-bold mt-2 text-green-600">{stats.entradas}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
        <p className="text-sm text-gray-500">Salidas</p>
        <p className="text-5xl font-bold mt-2 text-red-600">{stats.salidas}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
        <p className="text-sm text-gray-500">Trabajadores únicos</p>
        <p className="text-5xl font-bold mt-2 text-blue-600">{stats.trabajadoresUnicos}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
        <p className="text-sm text-gray-500">Días con actividad</p>
        <p className="text-5xl font-bold mt-2 text-purple-600">{stats.diasConActividad}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
        <p className="text-sm text-gray-500">Promedio hora de entrada</p>
        <p className="text-5xl font-bold mt-2 text-green-600">{stats.promedioEntrada || '—'}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
        <p className="text-sm text-gray-500">Promedio hora de salida</p>
        <p className="text-5xl font-bold mt-2 text-red-600">{stats.promedioSalida || '—'}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
        <p className="text-sm text-gray-500">Total horas trabajadas</p>
        <p className="text-5xl font-bold mt-2 text-indigo-600">{stats.totalHorasTrabajadas || '—'}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow md:col-span-2 lg:col-span-3">
        <p className="text-sm text-gray-500">Trabajador con más marcas</p>
        <p className="text-3xl font-bold mt-2 text-gray-800">{stats.trabajadorTop || '—'}</p>
        </div>
        </div>

        {/* Gráfico */}
        {dailyData.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-4">Actividad por día</h2>
            <div style={{ width: '100%', height: 380 }}>
            <ResponsiveContainer>
            <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Entradas" fill="#10b981" name="Entradas" />
            <Bar dataKey="Salidas" fill="#ef4444" name="Salidas" />
            </BarChart>
            </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
            Cantidad de entradas y salidas por día según los filtros aplicados.
            </p>
            </div>
        )}
        </>
    )}
    </div>
    );
}
