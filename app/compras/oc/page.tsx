'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export type EstadoOC =
| 'borrador'
| 'pendiente_aprobacion'
| 'pendiente'
| 'enviada'
| 'parcialmente_recibida'
| 'recibida'
| 'cancelada'
| 'anulada';

export default function OrdenesCompraPage() {
    const [ordenes, setOrdenes] = useState<any[]>([]);
    const [solicitudesAprobadas, setSolicitudesAprobadas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [estadoFiltro, setEstadoFiltro] = useState('todas');
    const [obraFiltro, setObraFiltro] = useState('');
    const [searchText, setSearchText] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showEntradaModal, setShowEntradaModal] = useState(false);

    const [proveedorFiltro, setProveedorFiltro] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');

    const [numeroOcFiltro, setNumeroOcFiltro] = useState('');

    const [nuevaOC, setNuevaOC] = useState({
        id: null as number | null,
        solicitud_id: '',
        numero_oc: '',
        proveedor: '',
        total: '',
        observaciones: '',
    });

    const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);
    const [historialOrden, setHistorialOrden] = useState<any[]>([]);

    const [nuevaEntrada, setNuevaEntrada] = useState({
        cantidad_recibida: '',
        recibido_por: '',
        observaciones: '',
    });

    // Lista de obras únicas
    const obrasUnicas = useMemo(() => {
        const obrasSet = new Set<string>();
        ordenes.forEach((orden: any) => {
            const nombreObra = orden.solicitudes?.obras?.nombre;
            if (nombreObra) obrasSet.add(nombreObra);
        });
            return Array.from(obrasSet).sort();
    }, [ordenes]);

    // Filtro de órdenes
    const ordenesFiltradas = useMemo(() => {
        return ordenes.filter((orden: any) => {
            // Filtro por Estado
            if (estadoFiltro !== 'todas') {
                const estadoOrden = (orden.estado || '').toLowerCase().trim();
                const recibido = orden.cantidadRecibida || 0;
                const original = orden.cantidad || orden.solicitudes?.cantidad || 0;

                if (estadoFiltro === 'pendiente') {
                    if (estadoOrden !== 'pendiente_aprobacion' && estadoOrden !== 'pendiente') return false;
                } else if (estadoFiltro === 'parcialmente_recibida') {
                    if (recibido === 0 || recibido >= original) return false;
                } else if (estadoFiltro === 'recibida') {
                    if (recibido < original) return false;
                } else if (estadoOrden !== estadoFiltro) {
                    return false;
                }
            }

            // Filtro por Obra
            if (obraFiltro) {
                const obraOrden = orden.solicitudes?.obras?.nombre;
                if (obraOrden !== obraFiltro) return false;
            }

            // Filtro por Proveedor (campo específico)
            if (proveedorFiltro.trim()) {
                if (!orden.proveedor?.toLowerCase().includes(proveedorFiltro.toLowerCase().trim())) {
                    return false;
                }
            }

            // Filtro por Insumo / N° de Orden (campo "Buscar por Insumo")
            if (searchText.trim()) {
                const texto = searchText.toLowerCase().trim();
                const coincideInsumo = (orden.solicitudes?.insumo || '').toLowerCase().includes(texto);
                const coincideNumeroOC = (orden.numero_oc || '').toLowerCase().includes(texto);

                if (!coincideInsumo && !coincideNumeroOC) {
                    return false;
                }
            }

            // Filtro por Número de Orden (campo específico "N° Orden")
            if (numeroOcFiltro.trim()) {
                if (!orden.numero_oc?.toLowerCase().includes(numeroOcFiltro.toLowerCase().trim())) {
                    return false;
                }
            }

            // Filtro por Fecha
            if (fechaInicio || fechaFin) {
                const fechaOrden = new Date(orden.fecha_emision);
                if (fechaInicio && fechaOrden < new Date(fechaInicio)) return false;
                if (fechaFin && fechaOrden > new Date(fechaFin)) return false;
            }

            return true;
        });
    }, [
        ordenes,
        estadoFiltro,
        obraFiltro,
        proveedorFiltro,
        searchText,
        numeroOcFiltro,
        fechaInicio,
        fechaFin,
    ]);

    const generarNumeroOC = () => {
        const now = new Date();

        const year = now.getFullYear().toString().slice(-2);     // 26
        const month = String(now.getMonth() + 1).padStart(2, '0'); // 06
        const day = String(now.getDate()).padStart(2, '0');        // 25

        // 4 dígitos aleatorios
        const random = Math.floor(1000 + Math.random() * 9000);    // 4832

        return `${year}${month}${day}-${random}`;
    };

    const solicitudesDisponibles = useMemo(() => {
        if (!solicitudesAprobadas.length) return [];

        // Calcular cantidad total ya ordenada por solicitud
        const cantidadOrdenadaPorSolicitud = ordenes.reduce((acc: any, oc: any) => {
            const sid = String(oc.solicitud_id);
            // Usamos la cantidad de la solicitud asociada a la orden
            const cantidadEnEstaOrden = Number(oc.solicitudes?.cantidad || 0);
            acc[sid] = (acc[sid] || 0) + cantidadEnEstaOrden;
            return acc;
        }, {});

        const disponibles = solicitudesAprobadas.filter((sol: any) => {
            const sid = String(sol.id);
            const cantidadSolicitada = Number(sol.cantidad || 0);
            const cantidadYaOrdenada = Number(cantidadOrdenadaPorSolicitud[sid] || 0);

            const cantidadDisponible = cantidadSolicitada - cantidadYaOrdenada;

            return cantidadDisponible > 0; // Aún hay cantidad pendiente
        });

        console.log(`Solicitudes con cantidad física disponible: ${disponibles.length}`);
        return disponibles;
    }, [solicitudesAprobadas, ordenes]);


    {/*============ it's the old one
    const ordenesFiltradas = useMemo(() => {
        return ordenes.filter((orden: any) => {
            if (estadoFiltro !== 'todas' && orden.estado !== estadoFiltro) return false;
            if (obraFiltro && orden.solicitudes?.obras?.nombre !== obraFiltro) return false;
            if (searchText.trim()) {
                const texto = searchText.toLowerCase();
                return (
                    orden.proveedor?.toLowerCase().includes(texto) ||
                    orden.solicitudes?.insumo?.toLowerCase().includes(texto)
                );
            }
            return true;
        });
    }, [ordenes, estadoFiltro, obraFiltro, searchText]);
    ======= */}

    const cargarOrdenes = async () => {
        setLoading(true);
        try {
            const { data: ordenesData, error } = await supabase
            .from('ordenes_compra')
            .select(`
            *,
            solicitudes (insumo, cantidad, unidad, obras(nombre))
            `)
            .order('fecha_emision', { ascending: false });

            if (error) throw error;

            const ordenesConProgreso = await Promise.all(
                (ordenesData || []).map(async (orden: any) => {
                    const cantidadRecibida = await calcularCantidadRecibida(orden.id);
                    const cantidadOriginal = orden.cantidad || orden.solicitudes?.cantidad || 0;  // ← Usa cantidad de la OC primero
                    const cantidadFaltante = Math.max(0, cantidadOriginal - cantidadRecibida);
                    const porcentajeRecibido = cantidadOriginal > 0 ? Math.round((cantidadRecibida / cantidadOriginal) * 100) : 0;
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

    {/* =============== Hide for a test
        const cargarSolicitudesAprobadas = async () => {
        try {
            const { data, error } = await supabase
            .from('solicitudes')
            .select('id, insumo, obras(nombre)')
            .eq('estado', 'aprobada')
            .order('fecha_solicitud', { ascending: false });

            if (error) throw error;
            setSolicitudesAprobadas(data || []);
        } catch (error) {
            console.error('Error cargando solicitudes aprobadas:', error);
            setSolicitudesAprobadas([]);
        }
    }; ========*/}

    const cargarSolicitudesAprobadas = async () => {
        console.log("🚀 Iniciando carga de solicitudes aprobadas...");

        try {
            const { data, error } = await supabase
            .from('solicitudes')
            .select(`
            id,
            insumo,
            cantidad,
            unidad,
            estado,
            obras (nombre)
            `)
            .eq('estado', 'aprobada')
            .order('fecha_solicitud', { ascending: false });

            if (error) {
                console.error("❌ Error Supabase:", error);
                alert("Error cargando solicitudes: " + error.message);
                return;
            }

            console.log("✅ Solicitudes cargadas:", data?.length || 0, data);

            setSolicitudesAprobadas(data || []);
        } catch (err) {
            console.error("❌ Error inesperado:", err);
        }
    };

    const calcularCantidadRecibida = async (ordenId: number): Promise<number> => {
        const { data } = await supabase
        .from('entradas_almacen')
        .select('cantidad_recibida')
        .eq('orden_compra_id', ordenId);
        return data?.reduce((sum, e) => sum + (e.cantidad_recibida || 0), 0) || 0;
    };

    const marcarComoEnviada = async (orden: any) => {
        if (!confirm(`¿Marcar la orden de "${orden.proveedor}" como ENVIADA?`)) return;
        const { error } = await supabase.from('ordenes_compra').update({ estado: 'enviada' }).eq('id', orden.id);
        if (!error) cargarOrdenes();
    };

        const cancelarOrden = async (orden: any) => {
            if (!confirm(`¿Cancelar la orden de "${orden.proveedor}"?`)) return;

            try {
                const { error } = await supabase
                .from('ordenes_compra')
                .update({ estado: 'anulada' })
                .eq('id', orden.id);

                if (error) throw error;

                alert('Orden cancelada correctamente');
                cargarOrdenes();
            } catch (error: any) {
                console.error("Error al cancelar:", error);
                alert(`Error al cancelar la orden: ${error.message || error}`);
            }
        };

            const verHistorialDeOrden = async (orden: any) => {
                setOrdenSeleccionada(orden);
                const { data } = await supabase
                .from('entradas_almacen')
                .select('*')
                .eq('orden_compra_id', orden.id)
                .order('fecha_entrada', { ascending: false });
                setHistorialOrden(data || []);
                setShowHistoryModal(true);
            };

            const registrarEntrada = async () => {
                if (!nuevaEntrada.cantidad_recibida || !ordenSeleccionada) {
                    alert("Faltan datos");
                    return;
                }

                const cantidadIngresada = Number(nuevaEntrada.cantidad_recibida);
                const cantidadPendiente = ordenSeleccionada.cantidadFaltante || 0;

                if (cantidadIngresada <= 0) {
                    alert("La cantidad debe ser mayor a 0");
                    return;
                }

                if (cantidadIngresada > cantidadPendiente) {
                    alert(`La cantidad (${cantidadIngresada}) excede la pendiente (${cantidadPendiente}). No se permite sobrepasar el total de la orden.`);
                    return;
                }

                try {
                    const { error } = await supabase.from('entradas_almacen').insert({
                        orden_compra_id: ordenSeleccionada.id,
                        cantidad_recibida: cantidadIngresada,
                        recibido_por: nuevaEntrada.recibido_por || null,
                        observaciones: nuevaEntrada.observaciones || null,
                        fecha_entrada: new Date().toISOString(),
                                                                                     unidad: ordenSeleccionada.solicitudes?.unidad || 'UND',
                                                                                     insumo: ordenSeleccionada.solicitudes?.insumo,
                    });

                    if (error) throw error;

                    // Recalcular valores
                    const cantidadRecibidaActual = await calcularCantidadRecibida(ordenSeleccionada.id);
                    const cantidadOriginal = ordenSeleccionada.cantidad || ordenSeleccionada.solicitudes?.cantidad || 0;
                    const cantidadFaltanteActualizada = Math.max(0, cantidadOriginal - cantidadRecibidaActual);

                    // Actualizar estado
                    let nuevoEstado = ordenSeleccionada.estado;
                    if (cantidadRecibidaActual >= cantidadOriginal) {
                        nuevoEstado = 'recibida';
                    } else if (cantidadRecibidaActual > 0) {
                        nuevoEstado = 'parcialmente_recibida';
                    }

                    if (nuevoEstado !== ordenSeleccionada.estado) {
                        await supabase
                        .from('ordenes_compra')
                        .update({ estado: nuevoEstado })
                        .eq('id', ordenSeleccionada.id);
                    }

                    alert('Entrada registrada correctamente');
                    setShowEntradaModal(false);
                    setNuevaEntrada({ cantidad_recibida: '', recibido_por: '', observaciones: '' });

                    // Actualizar orden seleccionada
                    const ordenActualizada = {
                        ...ordenSeleccionada,
                        cantidadRecibida: cantidadRecibidaActual,
                        cantidadFaltante: cantidadFaltanteActualizada,
                        estado: nuevoEstado,
                    };
                    setOrdenSeleccionada(ordenActualizada);

                    cargarOrdenes();
                    verHistorialDeOrden(ordenActualizada);
                } catch (error: any) {
                    console.error(error);
                    alert('Error al registrar entrada');
                }
            };

            // Carga inicial
            useEffect(() => {
                cargarOrdenes();
            }, []);

            // Refresca cuando cambian filtros
            useEffect(() => {
                cargarOrdenes();
            }, [estadoFiltro, obraFiltro, searchText]);

            // Carga solicitudes solo cuando se abre el modal
            useEffect(() => {
                if (showModal) {
                    cargarSolicitudesAprobadas();
                }
            }, [showModal]);

            const getEstadoColor = (estado: string) => {
                const est = (estado || '').toLowerCase().trim();
                switch (est) {
                    case 'borrador': return 'bg-gray-100 text-gray-700 border border-gray-200';
                    case 'pendiente_aprobacion':
                    case 'pendiente': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
                    case 'enviada': return 'bg-blue-100 text-blue-800 border border-blue-200';
                    case 'parcialmente_recibida': return 'bg-orange-100 text-orange-800 border border-orange-200';
                    case 'recibida': return 'bg-green-100 text-green-800 border border-green-200';
                    case 'anulada':
                    case 'cancelada': return 'bg-red-100 text-red-800 border border-red-200';
                    default: return 'bg-gray-100 text-gray-700 border border-gray-200';
                }
              };

              const getEstadoLabel = (estado: string) => {
                  const est = (estado || '').toLowerCase().trim();

                  switch (est) {
                      case 'pendiente_aprobacion':
                          return 'Pendiente';
                      case 'parcialmente_recibida':
                          return 'Parcial';
                      case 'pendiente':
                          return 'Pendiente';
                      case 'enviada':
                          return 'Enviada';
                      case 'recibida':
                          return 'Recibida';
                      case 'anulada':
                          return 'Anulada';
                      case 'cancelada':
                          return 'Cancelada';
                      default:
                          return estado;
                  }
              };

              const getEstadoIcon = (estado: string) => {
                  const est = (estado || '').toLowerCase();
                  if (est.includes('recibida')) return '✅';
                  if (est.includes('parcial')) return '⏳';
                  if (est.includes('enviada')) return '📤';
                  if (est.includes('pendiente')) return '⏳';
                  if (est.includes('anulada') || est.includes('cancelada')) return '❌';
                  return '📄';
               };


                const generarPDF = (oc: any) => {
                    import('jspdf').then(({ jsPDF }) => {
                        import('jspdf-autotable').then(() => {
                            const doc = new jsPDF();

                            // Header
                            doc.setFontSize(22);
                            doc.text("ORDEN DE COMPRA", 105, 20, { align: "center" });

                            doc.setFontSize(11);
                            doc.text("Construcción con Ingenio S.A.S.", 105, 28, { align: "center" });
                            doc.text("NIT: 900.XXX.XXX | Dirección: Jacksonville / Colombia", 105, 34, { align: "center" });

                            // Línea separadora
                            doc.setDrawColor(139, 92, 246);
                            doc.setLineWidth(1);
                            doc.line(20, 40, 190, 40);

                            let y = 50;

                            // Información principal
                            doc.setFontSize(11);
                            doc.text(`N° Orden: ${oc.numero_oc || `#${oc.id}`}`, 25, y);
                            y += 8;
                            doc.text(`Fecha: ${new Date(oc.fecha_emision).toLocaleDateString('es-CO')}`, 25, y);
                            y += 8;
                            doc.text(`Proveedor: ${oc.proveedor}`, 25, y);
                            y += 8;
                            doc.text(`Insumo: ${oc.solicitudes?.insumo || '—'}`, 25, y);
                            y += 8;
                            doc.text(`Cantidad: ${oc.solicitudes?.cantidad || '—'} ${oc.solicitudes?.unidad || ''}`, 25, y);
                            y += 10;

                            // Total grande
                            doc.setFontSize(16);
                            doc.setTextColor(16, 185, 129);
                            doc.text("TOTAL:", 25, y);
                            doc.text(`$${Number(oc.total).toLocaleString('es-CO')}`, 120, y);
                            doc.setTextColor(0, 0, 0);
                            y += 15;

                            // Estado
                            doc.setFontSize(11);
                            doc.text(`Estado: ${oc.estado?.toUpperCase() || 'PENDIENTE'}`, 25, y);
                            y += 10;

                            if (oc.observaciones) {
                                doc.text("Observaciones:", 25, y);
                                const lines = doc.splitTextToSize(oc.observaciones, 160);
                                doc.text(lines, 25, y + 7);
                                y += 10 + lines.length * 7;
                            }

                            // Footer
                            doc.setDrawColor(200);
                            doc.setLineWidth(0.5);
                            doc.line(20, 250, 190, 250);

                            doc.setFontSize(9);
                            doc.setTextColor(100);
                            doc.text("Documento generado por IngenioERP", 105, 260, { align: "center" });
                            doc.text(`Generado el ${new Date().toLocaleString('es-CO')}`, 105, 266, { align: "center" });
                            doc.text("Válido para registro en Sigo / DIAN y control interno", 105, 272, { align: "center" });

                            // Guardar
                            const fileName = `OC_${oc.numero_oc || oc.id}_${(oc.proveedor || '').replace(/\s+/g, '_')}`;
                            doc.save(`${fileName}.pdf`);
                        });
                    }).catch(() => {
                        alert("Error al generar el PDF. Asegúrate de tener jspdf y jspdf-autotable instalados.");
                    });
                };

                return (
                    <div className="p-8 max-w-7xl mx-auto">
                    {/* Encabezado */}
                    <div className="mb-8 flex items-center justify-between">
                    <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                    ← Volver a Compras
                    </Link>

                    <h1 className="text-3xl font-bold text-gray-900">Órdenes de Compra</h1>

                    <Link href="/compras/entradas" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                    Ir a Entradas de Almacén →
                    </Link>
                    </div>

                    {/* Filtros */}
                    <div className="bg-white rounded-2xl shadow p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Obra</label>
                    <select
                    value={obraFiltro}
                    onChange={(e) => setObraFiltro(e.target.value)}
                    className="w-full border rounded-xl p-3"
                    >
                    <option value="">Todas las obras</option>
                    {obrasUnicas.map((obra, index) => (
                        <option key={index} value={obra}>{obra}</option>
                    ))}
                    </select>
                    </div>

                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">N° Orden</label>
                    <input
                    type="text"
                    placeholder="aammdd-..."
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
                    <option value="pendiente">Pendiente</option>
                    <option value="enviada">Enviada</option>
                    <option value="parcialmente_recibida">Recibida Parcial</option>
                    <option value="recibida">Recibida Total</option>
                    <option value="anulada">Anulada</option>
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
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
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
                        setEstadoFiltro('todas');
                        setObraFiltro('');
                        setProveedorFiltro('');
                        setFechaInicio('');
                        setFechaFin('');
                        setNumeroOcFiltro('');
                        setSearchText('');
                    }}
                    className="w-full px-6 py-3 text-sm border rounded-xl hover:bg-gray-100"
                    >
                    Limpiar Filtros
                    </button>
                    </div>
                    </div>
                    </div>

                    {/* Tabla */}
                    <div className="bg-white rounded-2xl shadow overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                    <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Fecha</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">N° OC</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Obra</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Insumo</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Cantidad</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Recibido</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Proveedor</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Total</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Estado</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Acciones</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y">

                    {ordenesFiltradas.length === 0 ? (
                        <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">No se encontraron órdenes de compra.</td></tr>
                    ) : (
                        ordenesFiltradas.map((orden: any) => {
                            const cantidadSolicitada = orden.cantidad || orden.solicitudes?.cantidad || 0;
                            const recibido = orden.cantidadRecibida || 0;
                            const porcentaje = cantidadSolicitada > 0 ? Math.round((recibido / cantidadSolicitada) * 100) : 0;

                            return (
                                <tr key={orden.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-600">{new Date(orden.fecha_emision).toLocaleDateString('es-CO')}</td>
                                <td className="px-6 py-4 font-medium text-gray-900">{orden.numero_oc || '—'}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-800">{orden.solicitudes?.obras?.nombre || '—'}</td>
                                <td className="px-6 py-4 text-sm text-gray-800">{orden.solicitudes?.insumo || '—'}</td>
                                <td className="px-6 py-4 text-sm text-center text-gray-700">
                                {orden.cantidad || 0} {orden.solicitudes?.unidad || ''}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                <div className="flex items-center gap-3">
                                <div className="flex-1">
                                <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-green-600">{recibido}</span>
                                <span className="text-gray-500">{porcentaje}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                className="bg-green-500 h-2 rounded-full transition-all"
                                style={{ width: `${porcentaje}%` }}
                                />
                                </div>
                                </div>
                                </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-800">{orden.proveedor}</td>
                                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">${Number(orden.total).toLocaleString('es-CO')}</td>
                                <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(orden.estado)}`}>
                                {getEstadoLabel(orden.estado)}
                                </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                <div className="flex justify-center gap-1.5 flex-wrap">
                                {orden.estado !== 'anulada' && (
                                    <button
                                    onClick={() => {
                                        setOrdenSeleccionada(orden);
                                        setNuevaEntrada({ cantidad_recibida: orden.cantidadFaltante?.toString() || '', recibido_por: '', observaciones: '' });
                                        setShowEntradaModal(true);
                                    }}
                                    className="px-2.5 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg transition-colors"
                                    >
                                    + Entrada
                                    </button>
                                )}

                                <button
                                onClick={() => verHistorialDeOrden(orden)}
                                className="px-2.5 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition-colors"
                                >
                                Historial
                                </button>

                                {(orden.estado === 'pendiente' || orden.estado === 'parcialmente_recibida') && (
                                    <button
                                    onClick={() => marcarComoEnviada(orden)}
                                    className="px-2.5 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                                    >
                                    Enviar
                                    </button>
                                )}

                                {orden.estado !== 'anulada' && orden.estado !== 'cancelada' && (
                                    <button
                                    onClick={() => cancelarOrden(orden)}
                                    className="px-2.5 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                                    >
                                    Cancelar
                                    </button>
                                )}

                                <button
                                onClick={() => generarPDF(orden)}
                                className="px-2.5 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
                                >
                                PDF
                                </button>
                                </div>
                                </td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                    </table>
                    </div>
                    </div>

                    {/* Modal Historial */}
                    {showHistoryModal && ordenSeleccionada && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b">
                        <h2 className="text-2xl font-bold">Historial de la Orden</h2>
                        <p className="text-lg text-gray-700 mt-1">{ordenSeleccionada.solicitudes?.insumo} — {ordenSeleccionada.proveedor}</p>
                        <p className="text-sm text-gray-500">Total Orden: ${Number(ordenSeleccionada.total).toLocaleString('es-CO')}</p>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                        {historialOrden.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">Aún no hay entradas.</p>
                        ) : (
                            <>
                            {historialOrden.map((entrada: any) => (
                                <div key={entrada.id} className="border rounded-xl p-4 mb-3">
                                <div className="flex justify-between">
                                <p className="font-semibold">+{entrada.cantidad_recibida} {entrada.unidad}</p>
                                <p className="text-sm text-gray-500">{new Date(entrada.fecha_entrada).toLocaleDateString('es-CO')}</p>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">Recibido por: {entrada.recibido_por || '—'}</p>
                                {entrada.observaciones && <p className="text-sm text-gray-500 mt-1">{entrada.observaciones}</p>}
                                </div>
                            ))}
                            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                            <p className="font-semibold">Total Recibido: {ordenSeleccionada.cantidadRecibida} {ordenSeleccionada.solicitudes?.unidad}</p>
                            <p className="text-sm text-gray-500">Faltante: {ordenSeleccionada.cantidadFaltante} {ordenSeleccionada.solicitudes?.unidad}</p>
                            </div>
                            </>
                        )}
                        </div>
                        <div className="p-6 border-t flex gap-3">
                        <button onClick={() => setShowHistoryModal(false)} className="flex-1 py-3 border rounded-xl">Cerrar</button>
                        <button
                        onClick={() => {
                            if (ordenSeleccionada.estado === 'anulada') {
                                alert("No se pueden registrar entradas en órdenes anuladas.");
                                return;
                            }
                            setShowHistoryModal(false);
                            setNuevaEntrada({ cantidad_recibida: ordenSeleccionada.cantidadFaltante?.toString() || '', recibido_por: '', observaciones: '' });
                            setShowEntradaModal(true);
                        }}
                        className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-medium disabled:bg-gray-400"
                        disabled={ordenSeleccionada.estado === 'anulada'}
                        >
                        Registrar nueva entrada
                        </button>
                        </div>
                        </div>
                        </div>
                    )}

                    {/* Modal Nueva Entrada */}
                    {showEntradaModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-8 w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-6">Registrar Entrada</h2>
                        <input type="number" placeholder="Cantidad recibida" value={nuevaEntrada.cantidad_recibida} onChange={(e) => setNuevaEntrada({...nuevaEntrada, cantidad_recibida: e.target.value})} className="w-full border p-3 rounded-xl mb-4" />
                        <input type="text" placeholder="Recibido por" value={nuevaEntrada.recibido_por} onChange={(e) => setNuevaEntrada({...nuevaEntrada, recibido_por: e.target.value})} className="w-full border p-3 rounded-xl mb-4" />
                        <textarea placeholder="Observaciones" value={nuevaEntrada.observaciones} onChange={(e) => setNuevaEntrada({...nuevaEntrada, observaciones: e.target.value})} className="w-full border p-3 rounded-xl h-24" />
                        <div className="flex gap-3 mt-6">
                        <button onClick={() => setShowEntradaModal(false)} className="flex-1 py-3 border rounded-xl">Cancelar</button>
                        <button onClick={registrarEntrada} className="flex-1 py-3 bg-orange-600 text-white rounded-xl">Guardar Entrada</button>
                        </div>
                        </div>
                        </div>
                    )}
                    {/*=== Hasta aqui los Modales que tenia ==*/}

                    </div>
                );
}
