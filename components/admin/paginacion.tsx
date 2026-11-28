import { Paginacion } from "@/components/ui/paginacion";

export { tramo } from "@/lib/paginacion";

/**
 * Paginación del panel — DR §6.9. El tramo («Del 41 al 80 de 95») va en el
 * contador de cada listado, no acá.
 */
export function PaginacionDelPanel({
  pagina,
  paginas,
  href,
}: {
  pagina: number;
  paginas: number;
  href: (n: number) => string;
}) {
  return (
    <Paginacion
      pagina={pagina}
      paginas={paginas}
      href={href}
      className="pt-2"
    />
  );
}
