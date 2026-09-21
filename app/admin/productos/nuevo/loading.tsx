import { Skeleton } from "@/components/ui/skeleton";

import { EsqueletoDeFormularioDeProducto } from "@/components/admin/productos/esqueleto";

/**
 * Carga del alta de un producto — DR §8. Tarea F2.3.
 *
 * `page.tsx` espera a `opcionesDeProducto()`, que trae las marcas y las
 * categorías activas para los dos desplegables. No es instantáneo y hasta el
 * 2026-09-21 no había nada mientras tanto.
 */
export default function CargandoElAlta() {
  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <Skeleton className="h-5 w-24 self-start" />
      <Skeleton className="h-7 w-48" />
      <EsqueletoDeFormularioDeProducto />
    </div>
  );
}
