'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Solicitud {
  id: number;
  obra_id: string;
  insumo: string;
  cantidad: number;
  unidad?: string;
  estado: string;
  fecha_solicitud: string;
  solicitado_por?: string;
  notas?: string;
  obras?: {
    nombre: string;
  };
}

export default function SolicitudesPage() {
  const [obras, setObras] = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todas');
  const [searchText, setSearchText] = useState('');

  // Modal crear
  const [showModal, setShowModal] = useState(false);
  const [nuevaSolicitud, setNuevaSolicitud] = useState({
    obra_id: '',
    insumo: '',
    cantidad: '',
    unidad: 'Und',
    solicitado_por: '',   // ← Nuevo campo
    notas: '',
  });

  // Cargar obras
  useEffect(() => {
    const cargarObras = async () => {
      const { data } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (data) setObras(data);
    };
      cargarObras();
  }, []);

  // Cargar solicitudes
  const cargarSolicitudes = async () => {
    setLoading(true);
    try {
      let query = supabase
      .from('solicitudes')
      .select('*, obras(nombre)')
      .order('fecha_solicitud', { ascending: false });

      if (selectedObraId) {
        query = query.eq('obra_id', selectedObraId);
      }

      if (estadoFiltro !== 'todas') {
        query = query.eq('estado', estadoFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;

      let datos = data || [];

      if (searchText.trim() !== '') {
        const texto = searchText.toLowerCase().trim();
        datos = datos.filter((s: any) =>
        s.insumo?.toLowerCase().includes(texto) ||
        s.notas?.toLowerCase().includes(texto) ||
        s.solicitado_por?.toLowerCase().includes(texto)
        );
      }

      setSolicitudes(datos);
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [selectedObraId, estadoFiltro, searchText]);

  // Crear nueva solicitud
  const crearSolicitud = async () => {
    if (!nuevaSolicitud.obra_id || !nuevaSolicitud.insumo || !nuevaSolicitud.cantidad) {
      alert('Por favor completa los campos obligatorios (Obra, Insumo y Cantidad)');
      return;
    }

    try {
      const { error } = await supabase.from('solicitudes').insert({
        obra_id: nuevaSolicitud.obra_id,
        insumo: nuevaSolicitud.insumo,
        cantidad: Number(nuevaSolicitud.cantidad),
                                                                  unidad: nuevaSolicitud.unidad,
                                                                  estado: 'pendiente',
                                                                  fecha_solicitud: new Date().toISOString(),
                                                                  solicitado_por: nuevaSolicitud.solicitado_por || null, // ← Guardamos el creador
                                                                  notas: nuevaSolicitud.notas || null,
      });

      if (error) throw error;

      alert('Solicitud creada correctamente');
      setShowModal(false);
      setNuevaSolicitud({
        obra_id: '',
        insumo: '',
        cantidad: '',
        unidad: 'Und',
        solicitado_por: '',
        notas: '',
      });
      cargarSolicitudes();
    } catch (error) {
      console.error('Error creando solicitud:', error);
      alert('Error al crear la solicitud');
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-700';
      case 'cotizada': return 'bg-blue-100 text-blue-700';
      case 'aprobada': return 'bg-green-100 text-green-700';
      case 'rechazada': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
    {/* Encabezado */}
    <div className="mb-8">
    <Link href="/compras" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium mb-2">
    ← Volver al módulo de Compras
    </Link>
    <div className="flex items-center justify-between">
    <div>
    <h1 className="text-3xl font-bold text-gray-900">Solicitudes de Materiales</h1>
    <p className="text-gray-600 mt-1">Crear y gestionar solicitudes de insumos</p>
    </div>
    <button
    onClick={() => setShowModal(true)}
    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
    >
    + Nueva Solicitud
    </button>
    </div>
    </div>

    {/* Filtros */}
    <div className="bg-white p-6 rounded-2xl shadow mb-8">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    {/* Obra */}
    <div>
    <label className="block text-sm font-semibold mb-2 text-gray-700">Obra</label>
    <select
    value={selectedObraId || ''}
    onChange={(e) => setSelectedObraId(e.target.value || null)}
    className="w-full border rounded-xl p-2.5"
    >
    <option value="">Todas las obras</option>
    {obras.map((obra) => (
      <option key={obra.id} value={obra.id}>{obra.nombre}</option>
    ))}
    </select>
    </div>

    {/* Estado */}
    <div>
    <label className="block text-sm font-semibold mb-2 text-gray-700">Estado</label>
    <select
    value={estadoFiltro}
    onChange={(e) => setEstadoFiltro(e.target.value)}
    className="w-full border rounded-xl p-2.5"
    >
    <option value="todas">Todos</option>
    <option value="pendiente">Pendiente</option>
    <option value="cotizada">Cotizada</option>
    <option value="aprobada">Aprobada</option>
    <option value="rechazada">Rechazada</option>
    </select>
    </div>

    {/* Buscar */}
    <div className="md:col-span-2">
    <label className="block text-sm font-semibold mb-2 text-gray-700">Buscar</label>
    <input
    type="text"
    placeholder="Buscar por insumo, nota o creador..."
    value={searchText}
    onChange={(e) => setSearchText(e.target.value)}
    className="w-full border rounded-xl p-2.5"
    />
    </div>
    </div>
    </div>

    {/* Tabla */}
    {loading ? (
      <p className="text-center py-10 text-gray-500">Cargando solicitudes...</p>
    ) : solicitudes.length === 0 ? (
      <div className="text-center py-16 bg-white rounded-2xl shadow">
      <p className="text-5xl mb-4">📝</p>
      <p className="text-xl font-semibold text-gray-700">No hay solicitudes</p>
      <p className="text-gray-500 mt-1">Crea tu primera solicitud usando el botón de arriba.</p>
      </div>
    ) : (
      <div className="bg-white rounded-2xl shadow overflow-hidden">
      <table className="w-full">
      <thead className="bg-gray-50">
      <tr>
      <th className="p-4 text-left font-semibold text-gray-700">Fecha</th>
      <th className="p-4 text-left font-semibold text-gray-700">Obra</th>
      <th className="p-4 text-left font-semibold text-gray-700">Insumo</th>
      <th className="p-4 text-left font-semibold text-gray-700">Cantidad</th>
      <th className="p-4 text-left font-semibold text-gray-700">Estado</th>
      <th className="p-4 text-left font-semibold text-gray-700">Creado por</th>
      </tr>
      </thead>
      <tbody>
      {solicitudes.map((s) => (
        <tr key={s.id} className="border-t hover:bg-gray-50">
        <td className="p-4 text-sm text-gray-600">
        {new Date(s.fecha_solicitud).toLocaleDateString('es-CO')}
        </td>
        <td className="p-4 font-medium">{s.obras?.nombre || '—'}</td>
        <td className="p-4">{s.insumo}</td>
        <td className="p-4">
        {s.cantidad} {s.unidad || ''}
        </td>
        <td className="p-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEstadoColor(s.estado)}`}>
        {s.estado}
        </span>
        </td>
        <td className="p-4 text-sm text-gray-600">{s.solicitado_por || '—'}</td>
        </tr>
      ))}
      </tbody>
      </table>
      </div>
    )}

    {/* Modal Crear Solicitud */}
    {showModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold mb-6">Nueva Solicitud</h2>

      <div className="space-y-4">
      {/* Obra */}
      <div>
      <label className="block text-sm font-semibold mb-1">Obra *</label>
      <select
      value={nuevaSolicitud.obra_id}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, obra_id: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      >
      <option value="">Selecciona una obra</option>
      {obras.map((o) => (
        <option key={o.id} value={o.id}>{o.nombre}</option>
      ))}
      </select>
      </div>

      {/* Insumo */}
      <div>
      <label className="block text-sm font-semibold mb-1">Insumo / Material *</label>
      <input
      type="text"
      value={nuevaSolicitud.insumo}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, insumo: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      placeholder="Ej: Cemento gris 50kg"
      />
      </div>

      {/* Cantidad + Unidad */}
      <div className="grid grid-cols-2 gap-4">
      <div>
      <label className="block text-sm font-semibold mb-1">Cantidad *</label>
      <input
      type="number"
      value={nuevaSolicitud.cantidad}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, cantidad: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      />
      </div>
      <div>
      <label className="block text-sm font-semibold mb-1">Unidad</label>
      <input
      type="text"
      value={nuevaSolicitud.unidad}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, unidad: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      />
      </div>
      </div>

      {/* === NUEVO CAMPO: Creado por === */}
      <div>
      <label className="block text-sm font-semibold mb-1">Creado por</label>
      <input
      type="text"
      value={nuevaSolicitud.solicitado_por}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, solicitado_por: e.target.value })}
      className="w-full border rounded-xl p-2.5"
      placeholder="Nombre de quien crea la solicitud"
      />
      </div>

      {/* Notas */}
      <div>
      <label className="block text-sm font-semibold mb-1">Notas (opcional)</label>
      <textarea
      value={nuevaSolicitud.notas}
      onChange={(e) => setNuevaSolicitud({ ...nuevaSolicitud, notas: e.target.value })}
      className="w-full border rounded-xl p-2.5 h-20"
      placeholder="Especificaciones o comentarios..."
      />
      </div>
      </div>

      <div className="flex gap-3 mt-8">
      <button
      onClick={() => setShowModal(false)}
      className="flex-1 py-3 rounded-xl border border-gray-300 hover:bg-gray-50"
      >
      Cancelar
      </button>
      <button
      onClick={crearSolicitud}
      className="flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
      >
      Crear Solicitud
      </button>
      </div>
      </div>
      </div>
    )}
    </div>
  );
}
