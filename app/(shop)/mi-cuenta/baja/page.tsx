import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormularioDeBaja } from "@/components/shop/baja/formulario";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIdentity, getSession } from "@/lib/session";
import {
  mensajeDeOrdenesActivas,
  ordenesActivas,
} from "@/modules/users/baja/operaciones";

export const metadata: Metadata = { title: "Pedir la baja" };

/**
 * Pedir la baja de la cuenta — RF-34, RN-13. Tarea F5.8.
 *
 * **Antes de pedir, la pantalla dice qué implica y qué se conserva** (RF-34):
 * qué deja de poder hacer, que no se borra nada, y que volver es posible.
 *
 * **Con órdenes activas no hay formulario**: se dice cuántas y cuáles, y qué
 * hacer. Un botón que va a fallar es peor que ningún botón (§8).
 *
 * Con la baja ya pedida vuelve a «Mis datos», que es donde se ve y se retira.
 * Una administradora no la pide desde acá (`pedirBaja`).
 */
export default async function PedirLaBaja() {
  const sesion = await getSession();

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/mi-cuenta/baja");
  }
  if (sesion.role !== "customer") redirect("/mi-cuenta");
  if (sesion.profile.closureRequestedAt) redirect("/mi-cuenta#baja");

  const activas = await ordenesActivas(sesion.profile.id);

  return (
    <section aria-labelledby="titulo" className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 id="titulo" className="text-heading text-ink">
          Pedir la baja de tu cuenta
        </h2>
        <p className="text-body text-ink-secondary">
          La pedís vos y la procesamos nosotros. Antes, esto es lo que tenés
          que saber.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Qué pasa cuando la pedís</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-ink">
            <li>
              Desde ese momento podés mirar la tienda, pero no comprar, ni
              guardar favoritos, ni cambiar tus datos o tus direcciones.
            </li>
            <li>
              Hasta que la procesemos, podés retirar el pedido desde «Mis
              datos» y todo vuelve a ser como antes.
            </li>
            <li>Cuando la procesemos, ya no vas a poder entrar con esta cuenta.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qué se conserva</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-ink">
            <li>No se borra nada: tus compras y tu historial quedan registrados.</li>
            <li>Tus direcciones y tus favoritos quedan guardados.</li>
            <li>
              Si más adelante querés volver, escribinos y la reactivamos con
              todo como estaba.
            </li>
          </ul>
        </CardContent>
      </Card>

      {activas.length > 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-card bg-warning-tint p-5">
          <p className="flex items-start gap-2 text-body text-ink">
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
            <span>
              <span className="font-medium">Todavía no podés pedirla.</span>{" "}
              {mensajeDeOrdenesActivas(activas)}
            </span>
          </p>
          <Button asChild variant="secondary" size="md">
            <Link href="/mi-cuenta">Volver a Mis datos</Link>
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>El motivo</CardTitle>
          </CardHeader>
          <CardContent>
            <FormularioDeBaja />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
