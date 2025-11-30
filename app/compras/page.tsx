import Link from 'next/link'

export default function ComprasHome() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Módulo de Compras</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/compras/solicitudes" className="bg-blue-600 text-white p-8 rounded-xl text-center hover:bg-blue-700">
          <h2 className="text-xl font-bold">Solicitudes</h2>
          <p>Crear solicitud de materiales</p>
        </Link>
        <Link href="/compras/cotizaciones" className="bg-green-600 text-white p-8 rounded-xl text-center hover:bg-green-700">
          <h2 className="text-xl font-bold">Cotizaciones</h2>
          <p>Comparar proveedores</p>
        </Link>
        <Link href="/compras/oc" className="bg-purple-600 text-white p-8 rounded-xl text-center hover:bg-purple-700">
          <h2 className="text-xl font-bold">Órdenes de Compra</h2>
          <p>Generar OC + PDF</p>
        </Link>
        <Link href="/compras/entradas" className="bg-orange-600 text-white p-8 rounded-xl text-center hover:bg-orange-700">
          <h2 className="text-xl font-bold">Entradas Almacén</h2>
          <p>Registrar llegada de materiales</p>
        </Link>
      </div>
    </div>
  )
}
