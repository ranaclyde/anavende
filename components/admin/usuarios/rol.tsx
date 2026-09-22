"use client";

import { useState, useTransition } from "react";

import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { cambiarRol } from "@/modules/users/panel/actions";
import {
  ROLES_ASIGNABLES,
  type RolAsignable,
} from "@/modules/users/panel/schemas";

/**
 * Cambiar el rol de una cuenta — FS RF-26. Tarea F7.6.
 *
 * **Pregunta antes**, al revés de «Guardar datos» de al lado: esto da o quita
 * el acceso al panel entero —catálogo, órdenes, stock, usuarios— y el diálogo
 * dice qué significa cada uno. No es la confirmación por reflejo de todo
 * botón: es que acá el error se descubre cuando alguien entra a donde no
 * debía, o cuando no puede entrar a donde tenía que.
 *
 * **Sobre la propia cuenta no hay selector, hay una explicación** (RF-26). El
 * requisito pide que la administradora no pueda quitarse el rol a sí misma, y
 * un control que rebota sin decir por qué deja pensando que la pantalla falla.
 * La regla la hace cumplir el dominio igual: esconder el control no es una
 * guardia.
 */
export function RolDelUsuarioEditable({
  id,
  rolActual,
  nombre,
  esMiCuenta,
  esLaUnicaAdministradora,
}: {
  id: string;
  rolActual: RolAsignable;
  nombre: string;
  esMiCuenta: boolean;
  /** Quitarle el rol dejaría la tienda sin nadie que entre al panel. */
  esLaUnicaAdministradora: boolean;
}) {
  const [elegido, setElegido] = useState<RolAsignable>(rolActual);
  const [abierto, setAbierto] = useState(false);
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (esMiCuenta) {
    return (
      <p className="text-body-sm text-ink-secondary">
        Es tu cuenta, así que el rol no lo cambiás vos. Si querés dejar de ser
        administradora, pedíselo a otra administradora.
      </p>
    );
  }

  if (esLaUnicaAdministradora) {
    return (
      <p className="text-body-sm text-ink-secondary">
        Es la única administradora que queda, así que su rol no se puede
        cambiar: si se lo quitás, nadie va a poder entrar al panel. Nombrá a
        otra administradora primero.
      </p>
    );
  }

  const nuevo = ROLES_ASIGNABLES.find((r) => r.valor === elegido)!;

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await cambiarRol({ id, rol: elegido });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      avisar(
        elegido === "admin"
          ? `${nombre} ahora entra al panel.`
          : `${nombre} ya no entra al panel.`,
      );
      setAbierto(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Select
        aria-label={`Rol de ${nombre}`}
        value={elegido}
        onChange={(e) => setElegido(e.target.value as RolAsignable)}
      >
        {ROLES_ASIGNABLES.map((r) => (
          <option key={r.valor} value={r.valor}>
            {r.etiqueta}
          </option>
        ))}
      </Select>

      <p className="text-caption text-ink-secondary">{nuevo.ayuda}</p>

      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          disabled={elegido === rolActual}
          onClick={() => setAbierto(true)}
        >
          Cambiar el rol
        </Button>
      </div>

      <Dialog
        open={abierto}
        onOpenChange={(v) => (v ? null : setAbierto(false))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {elegido === "admin"
                ? `Hacer administradora a ${nombre}`
                : `Quitarle el panel a ${nombre}`}
            </DialogTitle>
            <DialogDescription>
              {elegido === "admin"
                ? "Va a poder entrar al panel y hacer todo lo que hacés vos: cargar productos, mover stock, resolver órdenes, registrar devoluciones y administrar cuentas."
                : "Deja de entrar al panel en la próxima pantalla que abra, sin tener que cerrar sesión. Su cuenta y sus compras quedan como están."}
            </DialogDescription>
          </DialogHeader>

          {/* Lo que no se ve y conviene saber: el rol no viaja en el token
              (§13.3), así que el cambio surte efecto enseguida. */}
          <p className="text-body-sm text-ink-secondary">
            El cambio vale desde la próxima página que cargue. No hace falta que
            cierre sesión ni que vuelva a entrar.
          </p>

          {error === null ? null : (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="tertiary"
              disabled={enCurso}
              onClick={() => setAbierto(false)}
            >
              Dejarlo como está
            </Button>
            <Button
              variant="brand"
              loading={enCurso}
              loadingLabel="Cambiando"
              onClick={guardar}
            >
              {elegido === "admin"
                ? "Hacerla administradora"
                : "Quitarle el panel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
