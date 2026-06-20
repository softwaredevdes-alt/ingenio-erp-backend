import Link from 'next/link'

export default function ComprasHome() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
    {/* Encabezado */}
    <div className="mb-10">
    <h1 className="text-4xl font-bold text-gray-900">Módulo de Compras</h1>
    <p className="text-gray-600 mt-2 text-lg">
    Gestión completa de solicitudes, cotizaciones, órdenes de compra y entradas a almacén.
    </p>
    </div>

    {/* Tarjetas principales */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

    {/* Solicitudes */}
    <Link
    href="/compras/solicitudes"
    className="group bg-white border border-gray-200 rounded-2xl p-8 hover:border-blue-500 hover:shadow-lg transition-all duration-200"
    >
    <div className="flex items-center gap-4 mb-4">
    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl">
    📝
    </div>
    <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
    Solicitudes
    </h2>
    </div>
    <p className="text-gray-600">Crear y gestionar solicitudes de materiales e insumos.</p>
    </Link>

    {/* Cotizaciones */}
    <Link
    href="/compras/cotizaciones"
    className="group bg-white border border-gray-200 rounded-2xl p-8 hover:border-green-500 hover:shadow-lg transition-all duration-200"
    >
    <div className="flex items-center gap-4 mb-4">
    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-2xl">
    💰
    </div>
    <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
    Cotizaciones
    </h2>
    </div>
    <p className="text-gray-600">Comparar precios de proveedores y seleccionar la mejor opción.</p>
    </Link>

    {/* Órdenes de Compra */}
    <Link
    href="/compras/oc"
    className="group bg-white border border-gray-200 rounded-2xl p-8 hover:border-purple-500 hover:shadow-lg transition-all duration-200"
    >
    <div className="flex items-center gap-4 mb-4">
    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-2xl">
    📦
    </div>
    <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
    Órdenes de Compra
    </h2>
    </div>
    <p className="text-gray-600">Generar OC, PDF profesional y archivo XML para Sigo/DIAN.</p>
    </Link>

    {/* Entradas a Almacén */}
    <Link
    href="/compras/entradas"
    className="group bg-white border border-gray-200 rounded-2xl p-8 hover:border-orange-500 hover:shadow-lg transition-all duration-200"
    >
    <div className="flex items-center gap-4 mb-4">
    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-2xl">
    🏭
    </div>
    <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
    Entradas Almacén
    </h2>
    </div>
    <p className="text-gray-600">Registrar llegada de materiales y actualizar inventario (Kardex).</p>
    </Link>

    </div>

    {/* Sección informativa inferior (opcional por ahora) */}
    <div className="mt-12 bg-gray-50 border border-gray-200 rounded-2xl p-8">
    <h3 className="font-semibold text-gray-800 mb-2">¿Cómo funciona el flujo de Compras?</h3>
    <p className="text-gray-600 text-sm">
    1. Se crea una <strong>Solicitud</strong> → 2. Se generan <strong>Cotizaciones</strong> de proveedores →
    3. Se aprueba y genera la <strong>Orden de Compra</strong> → 4. Se registra la <strong>Entrada</strong> en almacén.
    </p>
    </div>
    </div>
  )
}
