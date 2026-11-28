import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FormularioDeDireccion } from "@/components/shop/direcciones/formulario";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIdentity, getSession } from "@/lib/session";
import { telefonoLocal } from "@/lib/telefono";
import { valoresDeUbicacion } from "@/modules/users/direcciones/constantes";
import { leerDireccion } from "@/modules/users/direcciones/operaciones";
import { soloIdSchema } from "@/modules/users/direcciones/schemas";

export const metadata: Metadata = { title: "Editar dirección" };

/**
 * Una dirección ajena, eliminada o inexistente da el mismo 404: decir «es de
 * otra persona» confirmaría que el id existe.
 */
export default async function EditarDireccion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sesion = await getSession();
  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect(
      `/ingresar?volver=/mi-cuenta/direcciones/${encodeURIComponent(id)}`,
    );
  }

  if (!soloIdSchema.safeParse({ id }).success) notFound();

  // Con la baja pedida la libreta se mira y no se cambia.
  if (sesion.profile.closureRequestedAt) redirect("/mi-cuenta/direcciones");

  const d = await leerDireccion(sesion.profile.id, id);
  if (!d) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar «{d.label}»</CardTitle>
      </CardHeader>
      <CardContent>
        <FormularioDeDireccion
          id={d.id}
          inicial={{
            label: d.label,
            recipientName: d.recipientName,
            phone: telefonoLocal(d.phone),
            street: d.street,
            number: d.number,
            apartment: d.apartment ?? "",
            ...valoresDeUbicacion(d.city, d.province),
            notes: d.notes ?? "",
          }}
        />
      </CardContent>
    </Card>
  );
}
