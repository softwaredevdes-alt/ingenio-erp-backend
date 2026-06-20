export default function PersonalPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Control de Personal</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">

        {/* Tarjeta: Historial de Marcas */}
        <a
          href="/personal/historial"
          className="block p-8 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
        >
          <h2 className="text-2xl font-bold mb-2">Historial de Marcas</h2>
          <p className="text-blue-100">
            Ver y filtrar entradas y salidas del personal
          </p>
        </a>

        {/* Tarjeta: Estadísticas */}
        <a
          href="/personal/estadisticas"
          className="block p-8 bg-violet-600 text-white rounded-2xl hover:bg-violet-700 transition-all shadow-md hover:shadow-lg"
        >
          <h2 className="text-2xl font-bold mb-2">Estadísticas</h2>
          <p className="text-violet-100">
            Ver resúmenes, promedios y métricas del personal
          </p>
        </a>

      </div>
    </div>
  );
}


