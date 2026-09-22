"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { Campo, Opcion } from "@/components/admin/formulario";
import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { type ErroresDeFormulario, leerErrores, SIN_ERRORES } from "@/lib/form";
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
 *
 * **Es un `<form>` de verdad** desde el 2026-09-22, como el de producto y el
 * de configuración: Enter envía, el navegador lo anuncia como formulario y el
 * foco va al primer campo que falló. Hasta hoy era un `<div>` con botones
 * `onClick`, que se ve igual y se usa peor.
 */
export function AltaDeUsuario() {
  const router = useRouter();
  const idBase = useId();
  const [guardando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<CampoDelAlta>>(SIN_ERRORES);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rol, setRol] = useState<RolAsignable>("customer");

  /**
   * Adónde va el foco cuando el envío falla. Sin esto queda en el botón, que
   * no dice cuál de los cinco campos hay que corregir: el mensaje se anuncia
   * —cada `FieldError` es `role="alert"`— pero anunciar no es llevar hasta el
   * problema.
   */
  const errorGeneral = useRef<HTMLDivElement | null>(null);

  function irAlPrimerError(nuevos: ErroresDeFormulario<CampoDelAlta>) {
    const primero = CAMPOS.find((c) => nuevos.campos[c]);
    const control = primero
      ? document.getElementById(`${idBase}-${primero}`)
      : null;

    // Sin campo señalado —un email ya usado, que el servidor no cuelga de
    // ninguno— el foco va al mensaje, que es lo único que explica qué pasó.
    (control ?? errorGeneral.current)?.focus();
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
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
        const nuevos = leerErrores<CampoDelAlta>(r);
        setErrores(nuevos);
        irAlPrimerError(nuevos);
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
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <TarjetaDeSeccion id="datos-persona" titulo="Datos de la persona">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            id={`${idBase}-firstName`}
            etiqueta="Nombre"
            valor={firstName}
            alCambiar={setFirstName}
            error={e.firstName}
            autoComplete="off"
          />
          <Campo
            id={`${idBase}-lastName`}
            etiqueta="Apellido"
            valor={lastName}
            alCambiar={setLastName}
            error={e.lastName}
            autoComplete="off"
          />
        </div>

        <Campo
          id={`${idBase}-email`}
          etiqueta="Email"
          type="email"
          valor={email}
          alCambiar={setEmail}
          error={e.email}
          ayuda="Ahí le llega el mensaje para elegir su contraseña. No se puede cambiar después."
          autoComplete="off"
        />

        <Campo
          id={`${idBase}-phone`}
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
          {ROLES_ASIGNABLES.map((opcion, i) => (
            <Opcion
              key={opcion.valor}
              id={i === 0 ? `${idBase}-rol` : undefined}
              nombre="rol"
              elegida={rol === opcion.valor}
              alElegir={() => setRol(opcion.valor)}
              titulo={opcion.etiqueta}
              detalle={opcion.ayuda}
            />
          ))}
        </div>
        <FieldError id={`${idBase}-rol-error`}>{e.rol}</FieldError>
      </TarjetaDeSeccion>

      <div ref={errorGeneral} tabIndex={-1} className="outline-none">
        <FieldError>{errores.general}</FieldError>
      </div>

      {/* En el panel la acción principal va a la derecha, y el escape queda a
          mano: cancelar es un enlace y no un botón, porque no hace nada, va a
          otro lado. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="tertiary">
          <Link href="/admin/usuarios">Cancelar</Link>
        </Button>
        <Button
          type="submit"
          variant="brand"
          loading={guardando}
          loadingLabel="Creando"
        >
          Crear cuenta y mandar el email
        </Button>
      </div>
    </form>
  );
}

type CampoDelAlta = "firstName" | "lastName" | "email" | "phone" | "rol";

/** El orden en que se leen en pantalla, que es el orden en que se corrigen. */
const CAMPOS: CampoDelAlta[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "rol",
];
