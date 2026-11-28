import type { NextRequest } from "next/server";

import { getSession } from "@/lib/session";
import { armarPlanilla, nombreDelArchivo } from "@/modules/reports/excel";
import { leerPeriodo } from "@/modules/reports/periodo";
import {
  masVendidos,
  totalesDelPeriodo,
  ventasAgrupadas,
  ventasEnElTiempo,
  webContraManual,
} from "@/modules/reports/queries";

/**
 * Exportación de los reportes a `.xlsx` (TS §15). El rol se verifica acá
 * porque el layout del panel no envuelve a un `route.ts`; el resto recibe 404,
 * no 403. Corre en Node porque ExcelJS usa sus APIs.
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session?.role !== "admin" || session.profile.isBanned) {
    return new Response("No encontrado.", { status: 404 });
  }

  const periodo = leerPeriodo(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  const [totales, anteriores, serie, productos, categorias, marcas, origenes] =
    await Promise.all([
      totalesDelPeriodo(periodo),
      totalesDelPeriodo(periodo.anterior),
      ventasEnElTiempo(periodo, periodo.agrupado),
      // Todos, no los diez de la pantalla: ver `armarPlanilla`.
      masVendidos(periodo, periodo.ranking, null),
      ventasAgrupadas(periodo, "categoria"),
      ventasAgrupadas(periodo, "marca"),
      webContraManual(periodo),
    ]);

  const archivo = await armarPlanilla({
    periodo,
    totales,
    anteriores,
    serie,
    productos,
    categorias,
    marcas,
    origenes,
    generada: new Date(),
  });

  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreDelArchivo(periodo)}"`,
      // Que no quede copia de las ventas en ningún intermedio.
      "Cache-Control": "private, no-store",
    },
  });
}
