import { EsqueletoDeEncabezado } from "@/components/admin/encabezado";

import { EsqueletoDeFormularioDeProducto } from "@/components/admin/productos/esqueleto";

export default function CargandoElAlta() {
  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EsqueletoDeEncabezado
        titulo="w-48"
        bajada="w-full max-w-xl"
        volver="w-28"
      />
      <EsqueletoDeFormularioDeProducto />
    </div>
  );
}
