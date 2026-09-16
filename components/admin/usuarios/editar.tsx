"use client";

import { useState, useTransition } from "react";

import { Campo } from "@/components/admin/formulario";
import { Button } from "@/components/ui/button";
import { leerErrores, SIN_ERRORES } from "@/lib/form";
import { guardarDatosDelUsuario } from "@/modules/users/panel/actions";

/**
 * Corregir los datos de una cuenta — FS RF-26. Tarea F7.6.
 *
 * **El email no está**, y es la misma decisión de «Mis datos» (F5.2): lo
 * guarda GoTrue, cambiarlo exige confirmar la dirección nueva con un email que
 * RF-30 no tiene, y la copia de `user_profiles` quedaría desincronizada. Se
 * muestra al lado, de solo lectura, para que se vea que existe y no parezca
 * que falta.
 *
 * **El rol no está tampoco**, y vive en su propia tarjeta: dar o quitar acceso
 * al panel no es corregir un teléfono mal tipeado, y un «Guardar» que hiciera
 * las dos cosas dejaría viajar la decisión grande escondida adentro de la chica.
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
  const [errores, setErrores] = useState(SIN_ERRORES);
  const [guardado, setGuardado] = useState(false);

  const [firstName, setFirstName] = useState(usuario.firstName);
  const [lastName, setLastName] = useState(usuario.lastName);
  const [phone, setPhone] = useState(usuario.telefono);

  /**
   * Con qué se compara para saber si hay algo sin guardar.
   *
   * **No son las props**, y esa fue la trampa: el esquema normaliza el
   * teléfono, así que después de guardar «11 4444 3333» el perfil dice
   * `+5491144443333` y el campo seguiría marcando cambios pendientes para
   * siempre. Se guarda lo que el servidor confirmó, que es lo que de verdad
   * hay en la base. Lo encontró el repaso.
   */
  const [guardadoEnLaBase, setGuardadoEnLaBase] = useState({
    firstName: usuario.firstName,
    lastName: usuario.lastName,
    phone: usuario.telefono,
  });

  const cambio =
    firstName !== guardadoEnLaBase.firstName ||
    lastName !== guardadoEnLaBase.lastName ||
    phone !== guardadoEnLaBase.phone;

  function guardar() {
    setErrores(SIN_ERRORES);
    setGuardado(false);

    iniciar(async () => {
      const r = await guardarDatosDelUsuario({
        id: usuario.id,
        firstName,
        lastName,
        phone,
      });

      if (!r.ok) {
        setErrores(leerErrores<"firstName" | "lastName" | "phone">(r));
        return;
      }

      // Los campos pasan a mostrar lo que quedó guardado: el teléfono, con su
      // forma normalizada.
      setFirstName(r.data.firstName);
      setLastName(r.data.lastName);
      setPhone(r.data.phone);
      setGuardadoEnLaBase(r.data);
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
          error={errores.campos.firstName}
        />
        <Campo
          etiqueta="Apellido"
          valor={lastName}
          alCambiar={(v) => {
            setLastName(v);
            setGuardado(false);
          }}
          error={errores.campos.lastName}
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
        error={errores.campos.phone}
        ayuda="Con característica, por ejemplo 11 5555 5555."
      />

      {errores.general === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {errores.general}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        {/* Se anuncia: quien no ve el botón tiene que enterarse igual de que
            el cambio quedó (§9). Desaparece al volver a tocar un campo. */}
        {guardado ? (
          <p aria-live="polite" className="text-caption text-success">
            Datos guardados.
          </p>
        ) : null}
        <Button
          variant="brand"
          size="sm"
          // Sin cambios no hay nada que guardar, y un botón vivo que no hace
          // nada enseña a desconfiar del resto.
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
