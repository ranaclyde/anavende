import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FormularioDeDireccion } from "@/components/shop/direcciones/formulario";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIdentity, getSession } from "@/lib/session";
import { valoresDeUbicacion } from "@/modules/users/direcciones/constantes";
import { leerDireccion } from "@/modules/users/direcciones/operaciones";
import { soloIdSchema } from "@/modules/users/direcciones/schemas";

export const metadata: Metadata = { title: "Editar dirección" };

/**
 * Editar una dirección — RF-09, F5.3.
 *
 * Una dirección ajena, eliminada o que no existe es la misma página: 404
 * (§17.2, caso 6). Decir «es de otra persona» confirmaría que el id existe.
 * Un id que no tiene forma de uuid ni llega a la base.
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
    redirect(`/ingresar?volver=/mi-cuenta/direcciones/${encodeURIComponent(id)}`);
  }

  if (!soloIdSchema.safeParse({ id }).success) notFound();

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
            phone: d.phone.replace(/^\+549/, ""),
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
