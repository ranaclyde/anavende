import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { PaginacionDelPanel } from "@/components/admin/paginacion";
import { BarraDeFiltros } from "@/components/admin/usuarios/filtros";
import { ListadoDeUsuarios } from "@/components/admin/usuarios/listado";
import { SolapasDeEstadoDeCuenta } from "@/components/admin/usuarios/solapas";
import { Button } from "@/components/ui/button";
import {
  POR_PAGINA,
  leerFiltros,
  urlDeFiltros,
  type ParametrosDeBusqueda,
} from "@/modules/users/panel/filtros";
import { contarPorEstado, listarUsuarios } from "@/modules/users/panel/queries";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Usuarios" };

/**
 * Compradores y administradoras en la misma lista (RF-26). No hay «eliminar»:
 * un comprador con órdenes no se borra (§5.6).
 */
export default async function UsuariosDelPanel({
  searchParams,
}: {
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  await exigirAdmin();

  const filtros = leerFiltros(await searchParams);
  const [{ usuarios, total }, conteo] = await Promise.all([
    listarUsuarios(filtros),
    contarPorEstado(),
  ]);

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

      <SolapasDeEstadoDeCuenta filtros={filtros} conteo={conteo} />
      <BarraDeFiltros filtros={filtros} total={total} porPagina={POR_PAGINA} />
      <ListadoDeUsuarios usuarios={usuarios} filtros={filtros} />
      <PaginacionDelPanel
        pagina={filtros.pagina}
        paginas={paginas}
        href={(n) => urlDeFiltros({ ...filtros, pagina: n })}
      />
    </div>
  );
}
