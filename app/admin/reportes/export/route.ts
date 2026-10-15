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
 * Exportación de los reportes a `.xlsx` — FS RF-28 · TS §15. Tarea F9.2.
 *
 * **Un Route Handler y no una Server Action**, como fija TS §15: lo que vuelve
 * es un archivo, y una Server Action serializa su respuesta para React.
 *
 * **El rol se verifica acá**, porque el layout del panel no envuelve a un
 * `route.ts`: sin esta guardia, la ruta entregaría las ventas de la tienda a
 * cualquiera que la conozca. Un comprador o un visitante reciben 404 y no 403,
 * como la subida de imágenes: no se confirma que la ruta existe (§13.3).
 *
 * **Los filtros son los de la pantalla** porque se leen de los mismos
 * parámetros con la misma función (`leerPeriodo`), y el botón arma la URL con
 * `urlDeExportacion`.
 *
 * Corre en Node: ExcelJS arma el zip con APIs de Node.
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
      // Son las ventas de la tienda: que no quede copia en ningún intermedio.
      "Cache-Control": "private, no-store",
    },
  });
}
