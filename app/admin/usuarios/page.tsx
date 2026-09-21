import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { PaginacionDelPanel } from "@/components/admin/paginacion";
import { BarraDeFiltros } from "@/components/admin/usuarios/filtros";
import { ListadoDeUsuarios } from "@/components/admin/usuarios/listado";
import { Button } from "@/components/ui/button";
import {
  POR_PAGINA,
  leerFiltros,
  urlDeFiltros,
  type ParametrosDeBusqueda,
} from "@/modules/users/panel/filtros";
import { listarUsuarios } from "@/modules/users/panel/queries";

export const metadata: Metadata = { title: "Usuarios" };

/**
 * Listado de usuarios — FS RF-26. Tarea F7.6.
 *
 * Las cuentas de la tienda y las del panel en la misma lista, porque la
 * pregunta que se viene a hacer acá es siempre la misma —«¿quién es esta
 * persona y qué puede hacer?»— y separarlas en dos pantallas obligaría a saber
 * de antemano en cuál buscar.
 *
 * **No hay «eliminar»**, ni acá ni en la ficha: un comprador con órdenes no se
 * borra (§5.6, F4.5b). Lo que existe es bloquear (F7.7) y dar de baja (F7.9).
 */
export default async function UsuariosDelPanel({
  searchParams,
}: {
  // En Next 16 `searchParams` es una promesa; el acceso sincrónico se quitó.
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  const filtros = leerFiltros(await searchParams);
  const { usuarios, total } = await listarUsuarios(filtros);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  if (filtros.pagina > paginas) {
    redirect(urlDeFiltros({ ...filtros, pagina: paginas }));
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePanel
        titulo="Usuarios"
        bajada="Quién compra, quién entra al panel, y en qué estado está cada cuenta."
        acciones={
          <Button asChild variant="brand" size="sm">
            <Link href="/admin/usuarios/nuevo">
              <Plus aria-hidden />
              Nueva cuenta
            </Link>
          </Button>
        }
      />

      <BarraDeFiltros filtros={filtros} total={total} />
      <ListadoDeUsuarios usuarios={usuarios} filtros={filtros} />
      <PaginacionDelPanel
        pagina={filtros.pagina}
        paginas={paginas}
        href={(n) => urlDeFiltros({ ...filtros, pagina: n })}
      />
    </div>
  );
}
