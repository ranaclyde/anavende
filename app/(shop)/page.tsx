/**
 * Home (RF-01) — la construye F3.7, con datos reales cargados en F2.
 * Hasta entonces esto es un marcador de posición deliberado: construir la
 * home contra productos inventados es exactamente el riesgo P1 del plan.
 */
export default function Home() {
  return (
    <div className="mx-auto flex max-w-shop flex-col gap-4 px-4 py-20 sm:px-6 lg:px-8">
      <h1 className="text-display text-ink">AnaVende</h1>
      <p className="max-w-prose text-body-lg text-ink-secondary">
        Teclados, mouses, auriculares, cables y memorias. Envíos por PedidosYa.
      </p>
    </div>
  );
}
