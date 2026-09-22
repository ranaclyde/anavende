"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { Campo, Opcion } from "@/components/admin/formulario";
import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { leerErrores, SIN_ERRORES } from "@/lib/form";
import { darDeAltaUsuario } from "@/modules/users/panel/actions";
import {
  ROLES_ASIGNABLES,
  type RolAsignable,
} from "@/modules/users/panel/schemas";

/**
 * Alta de una cuenta desde el panel — FS RF-26. Tarea F7.6.
 *
 * **No se elige contraseña acá, y es lo importante de esta pantalla**: al
 * guardar sale el email E3 y la persona elige la suya. La alternativa —
 * inventarle una y pasársela por WhatsApp— deja la contraseña escrita en un
 * chat y obliga a la vendedora a saberla, que es justo lo que no tiene que
 * pasar.
 *
 * **El teléfono es obligatorio** aunque RF-26 no lo nombre: RF-05 lo pide en
 * las tres vías de alta y sin él no se puede coordinar una entrega (`schemas.ts`).
 */
export function AltaDeUsuario() {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [errores, setErrores] = useState(SIN_ERRORES);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rol, setRol] = useState<RolAsignable>("customer");

  function guardar() {
    setErrores(SIN_ERRORES);

    iniciar(async () => {
      const r = await darDeAltaUsuario({
        firstName,
        lastName,
        email,
        phone,
        rol,
      });

      if (!r.ok) {
        setErrores(leerErrores<CampoDelAlta>(r));
        return;
      }

      // A su ficha: el alta casi siempre sigue con «y ahora quiero ver cómo
      // quedó», y ahí está lo que se le puede hacer a esa cuenta.
      avisar(`Creaste la cuenta de ${firstName.trim()} ${lastName.trim()}.`);
      router.push(`/admin/usuarios/${r.data.id}`);
    });
  }

  const e = errores.campos;

  return (
    <div className="flex flex-col gap-4">
      <TarjetaDeSeccion id="datos-persona" titulo="Datos de la persona">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Nombre"
            valor={firstName}
            alCambiar={setFirstName}
            error={e.firstName}
            autoComplete="off"
          />
          <Campo
            etiqueta="Apellido"
            valor={lastName}
            alCambiar={setLastName}
            error={e.lastName}
            autoComplete="off"
          />
        </div>

        <Campo
          etiqueta="Email"
          type="email"
          valor={email}
          alCambiar={setEmail}
          error={e.email}
          ayuda="Ahí le llega el mensaje para elegir su contraseña. No se puede cambiar después."
          autoComplete="off"
        />

        <Campo
          etiqueta="Teléfono"
          type="tel"
          valor={phone}
          alCambiar={setPhone}
          error={e.phone}
          ayuda="Con característica, por ejemplo 11 5555 5555."
          autoComplete="off"
        />
      </TarjetaDeSeccion>

      <TarjetaDeSeccion
        id="rol"
        titulo="Rol"
        ayuda="Define a qué puede entrar. Se puede cambiar después desde su ficha."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES_ASIGNABLES.map((opcion) => (
            <Opcion
              key={opcion.valor}
              nombre="rol"
              elegida={rol === opcion.valor}
              alElegir={() => setRol(opcion.valor)}
              titulo={opcion.etiqueta}
              detalle={opcion.ayuda}
            />
          ))}
        </div>
      </TarjetaDeSeccion>

      {errores.general === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {errores.general}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="tertiary"
          disabled={guardando}
          onClick={() => router.push("/admin/usuarios")}
        >
          Cancelar
        </Button>
        <Button
          variant="brand"
          loading={guardando}
          loadingLabel="Creando"
          onClick={guardar}
        >
          Crear cuenta y mandar el email
        </Button>
      </div>
    </div>
  );
}

type CampoDelAlta = "firstName" | "lastName" | "email" | "phone" | "rol";
