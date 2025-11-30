export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <h1 className="text-4xl font-bold text-blue-600 mb-8">
        ¡Bienvenido a IngenioERP!
      </h1>
      <p className="text-lg text-gray-700">
        Tu ERP personalizado para construcción en Colombia. 
        Ya está conectado a Supabase. Prueba /dashboard, /obras o /compras.
      </p>
    </main>
  )
}
