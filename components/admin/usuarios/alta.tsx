"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import {
  Apartado,
  PieDeGuardado,
  TarjetaDeSeccion,
} from "@/components/admin/tarjeta";
import { Campo, Opcion } from "@/components/admin/formulario";
import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { type FormErrors, readErrors, NO_ERRORS } from "@/lib/form";
import { darDeAltaUsuario } from "@/modules/users/panel/actions";
import {
  ROLES_ASIGNABLES,
  type RolAsignable,
} from "@/modules/users/panel/schemas";

/**
 * Alta de una cuenta desde el panel — RF-26. No se elige contraseña: al
 * guardar sale el email E3 y la persona elige la suya. El teléfono es
 * obligatorio aunque RF-26 no lo nombre: lo pide RF-05.
 */
export function AltaDeUsuario() {
  const router = useRouter();
  const idBase = useId();
  const [guardando, iniciar] = useTransition();
  const [errores, setErrores] = useState<FormErrors<CampoDelAlta>>(NO_ERRORS);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rol, setRol] = useState<RolAsignable>("customer");

  /** Adónde va el foco cuando el envío falla: anunciar el error no es llevar hasta él. */
  const errorGeneral = useRef<HTMLDivElement | null>(null);

  function irAlPrimerError(nuevos: FormErrors<CampoDelAlta>) {
    const primero = CAMPOS.find((c) => nuevos.fields[c]);
    const control = primero
      ? document.getElementById(`${idBase}-${primero}`)
      : null;

    // Sin campo señalado (un email ya usado) el foco va al mensaje.
    (control ?? errorGeneral.current)?.focus();
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrores(NO_ERRORS);

    iniciar(async () => {
      const r = await darDeAltaUsuario({
        firstName,
        lastName,
        email,
        phone,
        rol,
      });

      if (!r.ok) {
        const nuevos = readErrors<CampoDelAlta>(r);
        setErrores(nuevos);
        irAlPrimerError(nuevos);
        return;
      }

      avisar(`Creaste la cuenta de ${firstName.trim()} ${lastName.trim()}.`);
      router.push(`/admin/usuarios/${r.data.id}`);
    });
  }

  const e = errores.fields;

  return (
    // Una sola tarjeta con el botón al pie (DESIGN.md, «Guardar»).
    <form onSubmit={enviar} noValidate className="min-w-0">
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
          ayuda="No se puede cambiar después."
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

        <Apartado
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
        </Apartado>

        <div ref={errorGeneral} tabIndex={-1} className="outline-none">
          <FieldError>{errores.general}</FieldError>
        </div>

        {/* Cancelar es un enlace: no hace nada, va a otro lado. */}
        <PieDeGuardado>
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
        </PieDeGuardado>
      </TarjetaDeSeccion>
    </form>
  );
}

type CampoDelAlta = "firstName" | "lastName" | "email" | "phone" | "rol";

/** En el orden en que se leen en pantalla, que es en el que se corrigen. */
const CAMPOS: CampoDelAlta[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "rol",
];
