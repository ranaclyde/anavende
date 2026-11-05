import { Paginacion } from "@/components/ui/paginacion";

export { tramo } from "@/lib/paginacion";

/**
 * Paginación del panel — §10.2. Tarea F7.1.
 *
 * **Es la de la tienda desde el 2026-11-05** (pedido tuyo): un número por
 * página, «Anterior» y «Siguiente», y la actual con tinte. Hasta entonces el
 * panel tenía la suya —solo anterior y siguiente— porque las órdenes se
 * acumulan sin techo y una barra con un número por página terminaría siendo
 * una tira de cien. Ahora la de la tienda recorta: `1 … 4 5 6 … 73`
 * (`paginasALaVista`).
 *
 * **El tramo —«Del 41 al 80 de 95 órdenes»— va arriba**, en el contador de
 * cada listado (`tramo`), y no repetido acá abajo: antes el listado decía
 * «95 órdenes» arriba y «Del 41 al 80 de 95 órdenes» abajo, dos veces el
 * mismo total.
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
