"use client";

import { useState, useTransition } from "react";

import { Campo } from "@/components/admin/formulario";
import { Button } from "@/components/ui/button";
import { readErrors, NO_ERRORS } from "@/lib/form";
import { localPhone } from "@/lib/phone";
import { guardarDatosDelUsuario } from "@/modules/users/panel/actions";

/**
 * Corregir los datos de una cuenta — RF-26. El email no está: lo guarda
 * GoTrue, cambiarlo exige confirmar la dirección nueva y la copia de
 * `user_profiles` quedaría desincronizada. El rol va en su propia tarjeta.
 */
export function EditarDatosDelUsuario({
  usuario,
}: {
  usuario: {
    id: string;
    firstName: string;
    lastName: string;
    telefono: string;
  };
}) {
  const [guardando, iniciar] = useTransition();
  const [errores, setErrores] = useState(NO_ERRORS);
  const [guardado, setGuardado] = useState(false);

  const [firstName, setFirstName] = useState(usuario.firstName);
  const [lastName, setLastName] = useState(usuario.lastName);
  // Sin el `+549`: el campo ya muestra el +54 (`Input`, `type="tel"`).
  const [phone, setPhone] = useState(localPhone(usuario.telefono));

  /**
   * Con qué se compara para saber si hay algo sin guardar: lo que confirmó el
   * servidor, no las props. El esquema normaliza el teléfono, y con las props
   * quedarían cambios pendientes para siempre.
   */
  const [guardadoEnLaBase, setGuardadoEnLaBase] = useState({
    firstName: usuario.firstName,
    lastName: usuario.lastName,
    phone: localPhone(usuario.telefono),
  });

  const cambio =
    firstName !== guardadoEnLaBase.firstName ||
    lastName !== guardadoEnLaBase.lastName ||
    phone !== guardadoEnLaBase.phone;

  function guardar() {
    setErrores(NO_ERRORS);
    setGuardado(false);

    iniciar(async () => {
      const r = await guardarDatosDelUsuario({
        id: usuario.id,
        firstName,
        lastName,
        phone,
      });

      if (!r.ok) {
        setErrores(readErrors<"firstName" | "lastName" | "phone">(r));
        return;
      }

      // Los campos muestran lo guardado: el teléfono normalizado, sin el `+549`.
      const guardados = { ...r.data, phone: localPhone(r.data.phone) };
      setFirstName(guardados.firstName);
      setLastName(guardados.lastName);
      setPhone(guardados.phone);
      setGuardadoEnLaBase(guardados);
      setGuardado(true);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Nombre"
          valor={firstName}
          alCambiar={(v) => {
            setFirstName(v);
            setGuardado(false);
          }}
          error={errores.fields.firstName}
        />
        <Campo
          etiqueta="Apellido"
          valor={lastName}
          alCambiar={(v) => {
            setLastName(v);
            setGuardado(false);
          }}
          error={errores.fields.lastName}
        />
      </div>

      <Campo
        etiqueta="Teléfono"
        type="tel"
        valor={phone}
        alCambiar={(v) => {
          setPhone(v);
          setGuardado(false);
        }}
        error={errores.fields.phone}
        ayuda="Con característica, por ejemplo 11 5555 5555."
      />

      {errores.general === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {errores.general}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        {/* Se anuncia (§9). Desaparece al volver a tocar un campo. */}
        {guardado ? (
          <p aria-live="polite" className="text-caption text-success">
            Datos guardados.
          </p>
        ) : null}
        <Button
          variant="brand"
          size="sm"
          disabled={!cambio}
          loading={guardando}
          loadingLabel="Guardando"
          onClick={guardar}
        >
          Guardar datos
        </Button>
      </div>
    </div>
  );
}
