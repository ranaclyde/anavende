import { ChevronRight } from "lucide-react";
import Link from "next/link";

import {
  EstadoDelUsuario,
  RolDelUsuario,
} from "@/components/admin/usuarios/estado";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fechaCorta } from "@/lib/fechas";
import {
  FILTROS_VACIOS,
  hayFiltros,
  urlDeFiltros,
  type FiltrosDeUsuarios,
} from "@/modules/users/panel/filtros";
import type { UsuarioDelListado } from "@/modules/users/panel/queries";

/**
 * Listado de usuarios — FS RF-26. Tarea F7.6.
 *
 * **Componente de servidor**: los filtros y la paginación son enlaces, y todo
 * lo que se le puede hacer a una cuenta vive en su ficha, con la persona
 * enfrente. Es el mismo reparto que el listado de órdenes.
 *
 * En móvil la tabla se vuelve tarjetas, no scroll horizontal (§6.9).
 */
export function ListadoDeUsuarios({
  usuarios,
  filtros,
}: {
  usuarios: UsuarioDelListado[];
  filtros: FiltrosDeUsuarios;
}) {
  if (usuarios.length === 0) return <SinResultados filtros={filtros} />;

  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-hidden rounded-panel-card border border-border bg-surface md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-surface-sunken">
              <TableHead>Nombre</TableHead>
              <TableHead className="w-44">Teléfono</TableHead>
              <TableHead className="w-52">Rol y estado</TableHead>
              <TableHead data-align="right" className="w-24">
                Órdenes
              </TableHead>
              <TableHead className="w-28">Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((usuario) => (
              <TableRow key={usuario.id}>
                <TableCell>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={`/admin/usuarios/${usuario.id}`}
                      className="truncate font-medium text-ink hover:text-brand"
                    >
                      {usuario.nombre}
                    </Link>
                    <span className="truncate text-caption text-ink-tertiary">
                      {usuario.email}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-ink-secondary tabular-nums">
                  {usuario.telefono}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <RolDelUsuario rol={usuario.rol} />
                    <EstadoDelUsuario
                      bloqueado={usuario.bloqueado}
                      bajaPedida={usuario.bajaPedida}
                      dadoDeBaja={usuario.dadoDeBaja}
                    />
                  </div>
                </TableCell>
                <TableCell data-align="right">{usuario.ordenes}</TableCell>
                <TableCell className="text-ink-secondary tabular-nums">
                  <time dateTime={usuario.creadoEn}>
                    {fechaCorta(usuario.creadoEn)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Móvil: la tarjeta entera es el enlace a la ficha, que es lo único
          que se puede hacer desde acá. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {usuarios.map((usuario) => (
          <li key={usuario.id}>
            <Link
              href={`/admin/usuarios/${usuario.id}`}
              className="flex items-center gap-3 rounded-panel-card border border-border bg-surface p-3 transition-colors duration-150 hover:bg-surface-sunken"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm font-medium text-ink">
                    {usuario.nombre}
                  </span>
                  <RolDelUsuario rol={usuario.rol} />
                  <EstadoDelUsuario
                    bloqueado={usuario.bloqueado}
                    bajaPedida={usuario.bajaPedida}
                    dadoDeBaja={usuario.dadoDeBaja}
                  />
                </div>
                <span className="truncate text-caption text-ink-tertiary">
                  {usuario.email}
                </span>
                <span className="text-caption text-ink-tertiary tabular-nums">
                  {usuario.telefono} ·{" "}
                  {usuario.ordenes === 1
                    ? "1 orden"
                    : `${usuario.ordenes} órdenes`}
                </span>
              </div>
              <ChevronRight aria-hidden className="size-4 text-ink-tertiary" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Sin resultados (§8): hay usuarios y ninguno coincide. Se repite lo buscado
 * para ver el error de tipeo sin volver al campo.
 */
function SinResultados({ filtros }: { filtros: FiltrosDeUsuarios }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-panel-card border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-body-sm text-ink">
        {filtros.q
          ? `No encontramos a nadie para «${filtros.q}».`
          : "Nadie coincide con los filtros."}
      </p>
      {hayFiltros(filtros) ? (
        <>
          <p className="text-caption text-ink-secondary">
            Probá con menos filtros, o revisá cómo quedó escrito.
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-2">
            <Link href={urlDeFiltros(FILTROS_VACIOS)}>Limpiar todo</Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}
