import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";
import { AccionesDeDireccion } from "@/components/shop/direcciones/acciones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIdentity, getSession } from "@/lib/session";
import { MAXIMO_DE_DIRECCIONES } from "@/modules/users/direcciones/constantes";
import {
  listarDirecciones,
  type Direccion,
} from "@/modules/users/direcciones/operaciones";

export const metadata: Metadata = { title: "Direcciones" };

/**
 * La libreta de direcciones — RF-09. Tarea F5.3.
 *
 * Hasta 3 (decisión del 2026-09-13). Con 3, «Agregar» no desaparece: se
 * muestra apagado y con el motivo a la vista (§8), porque un botón que se va
 * sin explicación se lee como un error.
 *
 * **Una tarjeta por fila, siempre.** Son 3 como mucho, y en dos columnas
 * —con el menú al costado— cada una quedaba de unos 460px: «Usar como
 * predeterminada», «Editar» y «Eliminar» no entraban en un renglón. A lo
 * ancho, la dirección va a la izquierda y las acciones a la derecha.
 */
export default async function Direcciones() {
  const sesion = await getSession();

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/mi-cuenta/direcciones");
  }

  const direcciones = await listarDirecciones(sesion.profile.id);
  const llena = direcciones.length >= MAXIMO_DE_DIRECCIONES;
  // Con la baja pedida (F5.8) la libreta se mira y no se cambia.
  const enPausa = sesion.profile.closureRequestedAt !== null;

  // La lista viene con la predeterminada primero y después por antigüedad:
  // la primera que no es predeterminada es la que tomaría su lugar.
  const siguiente = direcciones.find((d) => !d.isDefault)?.label ?? null;

  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="titulo" className="text-heading text-ink">
            Direcciones
          </h2>
          <p className="text-body text-ink-secondary">
            Podés guardar hasta {MAXIMO_DE_DIRECCIONES}. La predeterminada es la
            que aparece elegida al comprar.
          </p>
        </div>

        {direcciones.length === 0 ? null : enPausa ? (
          <Button
            variant="secondary"
            size="md"
            disabled
            aria-describedby={ID_AVISO_DE_PAUSA}
          >
            <Plus aria-hidden />
            Agregar dirección
          </Button>
        ) : llena ? (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button variant="secondary" size="md" disabled>
              <Plus aria-hidden />
              Agregar dirección
            </Button>
            <p className="text-caption text-ink-secondary">
              Llegaste a {MAXIMO_DE_DIRECCIONES}. Eliminá una para agregar otra.
            </p>
          </div>
        ) : (
          <Button asChild variant="secondary" size="md">
            <Link href="/mi-cuenta/direcciones/nueva">
              <Plus aria-hidden />
              Agregar dirección
            </Link>
          </Button>
        )}
      </header>

      {direcciones.length === 0 ? (
        <SinDirecciones enPausa={enPausa} />
      ) : (
        <ul className="flex flex-col gap-4">
          {direcciones.map((d) => (
            <li key={d.id}>
              <TarjetaDeDireccion direccion={d} siguiente={siguiente} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TarjetaDeDireccion({
  direccion: d,
  siguiente,
}: {
  direccion: Direccion;
  siguiente: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {d.label}
          {d.isDefault ? <Badge tone="brand">Predeterminada</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <address className="flex flex-col not-italic text-body text-ink">
            <span>
              {d.street} {d.number}
              {d.apartment ? `, ${d.apartment}` : null}
            </span>
            <span>
              {d.city}, {d.province}
              {d.postalCode ? ` (${d.postalCode})` : null}
            </span>
          </address>
          <p className="text-body-sm text-ink-secondary">
            Recibe {d.recipientName} · {d.phone.replace(/^\+549/, "")}
          </p>
          {d.notes ? (
            <p className="text-body-sm text-ink-secondary">{d.notes}</p>
          ) : null}
        </div>

        <AccionesDeDireccion
          id={d.id}
          etiqueta={d.label}
          predeterminada={d.isDefault}
          siguientePredeterminada={d.isDefault ? siguiente : null}
        />
      </CardContent>
    </Card>
  );
}

/** El vacío explica para qué sirve y ofrece la acción (§8). */
function SinDirecciones({ enPausa }: { enPausa: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-16 text-center shadow-md">
      <h3 className="text-heading text-ink">
        Todavía no guardaste ninguna dirección
      </h3>
      <p className="max-w-prose text-body text-ink-secondary">
        La vas a necesitar si querés que te enviemos el pedido. Si lo retirás o
        lo coordinás con la vendedora, no hace falta.
      </p>
      {enPausa ? (
        <Button
          variant="brand"
          size="lg"
          className="mt-2"
          disabled
          aria-describedby={ID_AVISO_DE_PAUSA}
        >
          Agregar una dirección
        </Button>
      ) : (
        <Button asChild variant="brand" size="lg" className="mt-2">
          <Link href="/mi-cuenta/direcciones/nueva">Agregar una dirección</Link>
        </Button>
      )}
    </div>
  );
}
