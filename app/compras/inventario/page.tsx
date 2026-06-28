'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InventarioPage() {
    const [inventario, setInventario] = useState<any[]>([]);
    const [obras, setObras] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal Kardex
    const [showKardexModal, setShowKardexModal] = useState(false);
    const [kardexData, setKardexData] = useState<any[]>([]);
    const [materialSeleccionado, setMaterialSeleccionado] = useState<any>(null);
    const [showAjusteModal, setShowAjusteModal] = useState(false);
    const [itemParaAjuste, setItemParaAjuste] = useState<any>(null);
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
            .select(`
            *,
            obras(nombre)
            `)
            .order('updated_at', { ascending: false });

            if (selectedObraId) {
                query = query.eq('obra_id', selectedObraId);
            }

            const { data, error } = await query;
            if (error) throw error;

            let filtered = data || [];

            if (searchTerm.trim() !== '') {
                const texto = searchTerm.toLowerCase().trim();
                filtered = filtered.filter((item: any) =>
                item.insumo?.toLowerCase().includes(texto)
                );
            }

            setInventario(filtered);
        } catch (error) {
            console.error('Error cargando inventario:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarInventario();
    }, [selectedObraId, searchTerm]);

    // Msg Alerta inventario bajo
    const getStockAlert = (cantidad: number) => {
        if (cantidad <= 5) {
            return {
                color: 'text-red-700 bg-red-100 border-red-300',
                mensaje: '¡Crítico!',
                icono: '🔴'
            };
        }
        if (cantidad <= 20) {
            return {
                color: 'text-orange-700 bg-orange-100 border-orange-300',
                mensaje: 'Stock bajo',
                icono: '🟠'
            };
        }
        return {
            color: 'text-green-700 bg-green-100 border-green-300',
            mensaje: '',
            icono: ''
        };
    };

    // Ver Kardex de un material
    const verKardex = async (item: any) => {
        setMaterialSeleccionado(item);

        const { data, error } = await supabase
        .from('entradas_almacen')
        .select('*')
        .eq('insumo', item.insumo)
        .order('fecha_entrada', { ascending: false });

        if (error) {
            console.error(error);
            alert('Error al cargar el Kardex');
            return;
        }

        setKardexData(data || []);
        setShowKardexModal(true);
    };

    // Abrir Modal de Ajustes
    const abrirAjusteStock = (item: any) => {
        setItemParaAjuste(item);
        setNuevoStock(item.cantidad.toString());
        setAjustadoPor('');           // ← Nuevo
        setMotivoAjuste('');
        setShowAjusteModal(true);
    };

    // Guardar ajustes al inventario
    const guardarAjusteStock = async () => {
        if (!itemParaAjuste || !nuevoStock) {
            alert('Datos incompletos');
            return;
        }

        const nuevaCantidad = Number(nuevoStock);
        const diferencia = nuevaCantidad - itemParaAjuste.cantidad;

        if (diferencia === 0) {
            alert('No hay cambios en la cantidad');
            return;
        }

        try {
            // Actualizar cantidad en inventario
            const { error } = await supabase
            .from('inventario')
            .update({
                cantidad: nuevaCantidad,
                updated_at: new Date().toISOString()
            })
            .eq('id', itemParaAjuste.id);

            if (error) throw error;

            alert('Stock ajustado correctamente');
            setShowAjusteModal(false);
            cargarInventario();
        } catch (error) {
            console.error(error);
            alert('Error al ajustar el stock');
        }
    };

    // =============================================
    // Exportar Kardex a PDF
    // =============================================
    const exportarKardexPDF = async (item: any) => {
        // Traer historial de movimientos
        const { data: movimientos, error } = await supabase
        .from('entradas_almacen')
        .select('*')
        .eq('insumo', item.insumo)
        .order('fecha_entrada', { ascending: false });

        if (error) {
            alert('Error al obtener el historial');
            return;
        }

        const doc = new jsPDF();
        const fechaActual = new Date().toLocaleDateString('es-CO');

        // Título
        doc.setFontSize(18);
        doc.text('KARDEX - HISTORIAL DE INVENTARIO', 14, 20);

        // Información del material
        doc.setFontSize(12);
        doc.text(`Insumo: ${item.insumo}`, 14, 30);
        doc.text(`Obra: ${item.obras?.nombre || '—'}`, 14, 36);
        doc.text(`Cantidad Actual: ${item.cantidad} ${item.unidad}`, 14, 42);
        doc.text(`Ubicación: ${item.ubicacion_almacen || '—'}`, 14, 48);
        doc.text(`Última Orden: ${item.ultima_orden_compra || '—'}`, 14, 54);
        doc.text(`Fecha de generación: ${fechaActual}`, 14, 60);

        // Tabla de movimientos
        const tableData = (movimientos || []).map((mov: any) => [
            new Date(mov.fecha_entrada).toLocaleDateString('es-CO'),
                                                  `+${mov.cantidad_recibida} ${mov.unidad}`,
                                                  mov.recibido_por || '—',
                                                  mov.observaciones || '—'
        ]);

        autoTable(doc, {
            startY: 70,
            head: [['Fecha', 'Cantidad', 'Recibido por', 'Observaciones']],
            body: tableData,
            styles: { fontSize: 10 },
            headStyles: { fillColor: [41, 128, 185] },
        });

        // Guardar PDF
        doc.save(`Kardex_${item.insumo.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="mb-8 flex items-center justify-between">
        <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
        ← Volver a Compras
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
        <div></div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <div className="flex items-end">
        <button
        onClick={() => {
            setSelectedObraId(null);
            setSearchTerm('');
        }}
        className="w-full px-6 py-3 text-sm border rounded-xl hover:bg-gray-100"
        >
        Limpiar Filtros
        </button>
        </div>
        </div>
        </div>

        {/* Tabla de Inventario */}
        {loading ? (
            <p className="text-center py-10">Cargando inventario...</p>
        ) : (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
            <thead className="bg-gray-50 border-b">
            <tr>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Insumo</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Obra</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Cantidad</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ubicación</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Última Orden</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Última Actualización</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Acciones</th>
            </tr>
            </thead>
            <tbody className="divide-y">
            {inventario.length === 0 ? (
                <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                No hay inventario registrado.
                </td>
                </tr>
            ) : (
                inventario.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.insumo}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.obras?.nombre || '—'}</td>
                    <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                    <span className={`px-4 py-1 rounded-full text-sm font-semibold border ${getStockAlert(item.cantidad).color}`}>
                    {item.cantidad} {item.unidad}
                    </span>

                    {getStockAlert(item.cantidad).mensaje && (
                        <span className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">
                        {getStockAlert(item.cantidad).icono} {getStockAlert(item.cantidad).mensaje}
                        </span>
                    )}
                    </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                    {item.ubicacion_almacen || <span className="text-gray-400 italic">Sin ubicación</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                    {item.ultima_orden_compra ? (
                        <span className="font-mono text-blue-600">{item.ultima_orden_compra}</span>
                    ) : (
                        <span className="text-gray-400 italic">—</span>
                    )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">
                    {new Date(item.updated_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-6 py-4 text-center">
                    <div className="flex justify-center items-center gap-2">
                    {/* Ver Kardex */}
                    <button
                    onClick={() => verKardex(item)}
                    className="px-3 py-1 text-xs font-medium border border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Ver historial de movimientos"
                    >
                    Kardex
                    </button>

                    {/* Ajustar Stock */}
                    <button
                    onClick={() => abrirAjusteStock(item)}
                    className="px-3 py-1 text-xs font-medium border border-orange-300 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Ajustar cantidad manualmente"
                    >
                    Ajustar
                    </button>

                    {/* Exportar PDF */}
                    <button
                    onClick={() => exportarKardexPDF(item)}
                    className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Exportar historial a PDF"
                    >
                    PDF
                    </button>
                    </div>
                    </td>
                    </tr>
                ))
            )}
            </tbody>
            </table>
            </div>
        )}

        {/* Modal Kardex Mejorado */}
        {showKardexModal && materialSeleccionado && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">

            {/* Header */}
            <div className="p-6 border-b bg-gray-50">
            <div className="flex justify-between items-start">
            <div>
            <h2 className="text-2xl font-bold">Kardex - {materialSeleccionado.insumo}</h2>
            <p className="text-gray-600 mt-1">{materialSeleccionado.obras?.nombre}</p>
            </div>
            <button
            onClick={() => setShowKardexModal(false)}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
            ×
            </button>
            </div>

            {/* Resumen */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-xl p-3">
            <p className="text-xs text-gray-500">Stock Actual</p>
            <p className="text-2xl font-bold text-gray-900">
            {materialSeleccionado.cantidad} {materialSeleccionado.unidad}
            </p>
            </div>

            <div className="bg-white border rounded-xl p-3">
            <p className="text-xs text-gray-500">Total de Entradas</p>
            <p className="text-2xl font-bold text-blue-600">{kardexData.length}</p>
            </div>

            <div className="bg-white border rounded-xl p-3">
            <p className="text-xs text-gray-500">Total Recibido</p>
            <p className="text-2xl font-bold text-green-600">
            {kardexData.reduce((sum, item) => sum + Number(item.cantidad_recibida || 0), 0)} {materialSeleccionado.unidad}
            </p>
            </div>

            {/* === NUEVO: Última Orden === */}
            <div className="bg-white border rounded-xl p-3">
            <p className="text-xs text-gray-500">Última Orden</p>
            <p className="text-lg font-bold text-blue-600 font-mono">
            {materialSeleccionado.ultima_orden_compra || '—'}
            </p>
            </div>
            </div>
            </div>

            {/* Contenido del Kardex */}
            <div className="flex-1 overflow-auto p-6">
            {kardexData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p className="text-6xl mb-4">📭</p>
                <p className="text-lg">No hay movimientos registrados para este material.</p>
                </div>
            ) : (
                <div className="space-y-4">
                {kardexData.map((mov, index) => (
                    <div key={index} className="border border-gray-200 rounded-2xl p-5 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start">
                    <div>
                    <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-green-600">
                    +{mov.cantidad_recibida}
                    </span>
                    <span className="text-gray-600">{mov.unidad}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                    Recibido por: <span className="font-medium">{mov.recibido_por || '—'}</span>
                    </p>
                    </div>
                    <div className="text-right">
                    <p className="text-sm text-gray-500">
                    {new Date(mov.fecha_entrada).toLocaleDateString('es-CO', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    })}
                    </p>
                    <p className="text-xs text-gray-400">
                    {new Date(mov.fecha_entrada).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                    </p>
                    </div>
                    </div>

                    {mov.observaciones && (
                        <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Observaciones:</span><br />
                        {mov.observaciones}
                        </div>
                    )}
                    </div>
                ))}
                </div>
            )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50 flex justify-end">
            <button
            onClick={() => setShowKardexModal(false)}
            className="px-6 py-2.5 border border-gray-300 rounded-xl hover:bg-white font-medium"
            >
            Cerrar
            </button>
            </div>
            </div>
            </div>
        )}

        {/* Modal Ajustar Stock */}
        {/* Modal Ajustar Stock */}
        {showAjusteModal && itemParaAjuste && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-2">Ajustar Stock</h2>
            <p className="text-gray-600 mb-6">{itemParaAjuste.insumo}</p>

            <div className="space-y-4">
            {/* Cantidad Actual */}
            <div>
            <label className="block text-sm font-semibold mb-1">Cantidad Actual</label>
            <div className="text-2xl font-bold text-gray-900">
            {itemParaAjuste.cantidad} {itemParaAjuste.unidad}
            </div>
            </div>

            {/* Nueva Cantidad */}
            <div>
            <label className="block text-sm font-semibold mb-1">Nueva Cantidad</label>
            <input
            type="number"
            value={nuevoStock}
            onChange={(e) => setNuevoStock(e.target.value)}
            className="w-full border rounded-xl p-2.5 text-lg"
            />
            </div>

            {/* Realizado por */}
            <div>
            <label className="block text-sm font-semibold mb-1">Realizado por</label>
            <input
            type="text"
            value={ajustadoPor}
            onChange={(e) => setAjustadoPor(e.target.value)}
            className="w-full border rounded-xl p-2.5"
            placeholder="Nombre de quien realiza el ajuste"
            />
            </div>

            {/* Motivo del ajuste */}
            <div>
            <label className="block text-sm font-semibold mb-1">Motivo del ajuste (opcional)</label>
            <textarea
            value={motivoAjuste}
            onChange={(e) => setMotivoAjuste(e.target.value)}
            className="w-full border rounded-xl p-2.5 h-20"
            placeholder="Ej: Conteo físico, merma, corrección..."
            />
            </div>
            </div>

            <div className="flex gap-3 mt-8">
            <button
            onClick={() => setShowAjusteModal(false)}
            className="flex-1 py-3 rounded-xl border"
            >
            Cancelar
            </button>
            <button
            onClick={guardarAjusteStock}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium"
            >
            Guardar Ajuste
            </button>
            </div>
            </div>
            </div>
        )}

        </div>
    );
}
