import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormularioDeDireccion } from "@/components/shop/direcciones/formulario";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getIdentity, getSession } from "@/lib/session";
import { MAXIMO_DE_DIRECCIONES } from "@/modules/users/direcciones/constantes";
import { listarDirecciones } from "@/modules/users/direcciones/operaciones";

export const metadata: Metadata = { title: "Nueva dirección" };

/**
 * Cargar una dirección — RF-09, F5.3.
 *
 * Quién la recibe y el teléfono vienen precargados con los de la cuenta:
 * casi siempre es la misma persona, y si no, se cambian. Con 3 direcciones
 * no hay formulario: vuelve a la lista, que dice por qué.
 */
export default async function NuevaDireccion() {
  const sesion = await getSession();

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/mi-cuenta/direcciones/nueva");
  }

  const { profile } = sesion;

  // Con la baja pedida (F5.8) la libreta se mira y no se cambia: la lista
  // dice por qué, y guardar lo rechazaría el envoltorio de acciones.
  if (profile.closureRequestedAt) redirect("/mi-cuenta/direcciones");

  const direcciones = await listarDirecciones(profile.id);
  if (direcciones.length >= MAXIMO_DE_DIRECCIONES) {
    redirect("/mi-cuenta/direcciones");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva dirección</CardTitle>
        <CardDescription>
          {direcciones.length === 0
            ? "Va a ser tu dirección predeterminada"
            : "La vas a poder elegir al comprar, o hacerla predeterminada desde la lista"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioDeDireccion
          inicial={{
            label: "",
            recipientName: profile.fullName,
            phone: profile.phone.replace(/^\+549/, ""),
            street: "",
            number: "",
            apartment: "",
            localidad: "",
            otraLocalidad: "",
            provinciaDeOtra: "",
            notes: "",
          }}
        />
      </CardContent>
    </Card>
  );
}
