"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { LOGO } from "@/components/admin/catalogo/copy";
import {
  LOGO_SIN_TOCAR,
  SelectorDeLogo,
  type AccionDeLogo,
} from "@/components/admin/logo/selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { subirImagen } from "@/modules/media/cliente";
import {
  crearUnMedioDePago,
  editarUnMedioDePago,
  quitarElLogoDelMedioDePago,
} from "@/modules/settings/actions";
import type { MedioDePagoDelPanel } from "@/modules/settings/queries";

type Campo = "name" | "description";

/** Lo mismo que el logo de marca, por el mismo camino (§9.1). */
async function subirLogo(id: string, archivo: File): Promise<string | null> {
  const r = await subirImagen(
    { destino: "medio-de-pago", paymentMethodId: id },
    archivo,
  );
  return r.ok ? null : r.message;
}

/**
 * Alta y edición de un medio de pago — RF-19.
 *
 * No hay campo de orden: al crear se agrega al final y se mueve desde el
 * listado, que es donde se ve contra qué se lo está ordenando. Un número de
 * posición dentro del diálogo obligaría a recordar el de los demás.
 *
 * **Se monta cuando se abre y se desmonta al cerrar** (lo decide el
 * listado), y por eso el estado arranca de las props y no hay ningún efecto
 * que lo reponga. Mantenerlo montado y limpiarlo al abrir parece lo mismo y
 * no lo es: el cierre ocurre dentro de una transición —la acción todavía
 * está revalidando—, así que hay un rato en que la pantalla muestra el
 * diálogo con los valores viejos. Si en ese rato se vuelve a abrir, el
 * efecto no ve ningún cambio de props que lo dispare y el formulario
 * arranca con lo que se escribió la vez anterior. Pasó: un medio de pago se
 * guardó con la descripción del anterior.
 */
export function DialogoDeMedioDePago({
  medio,
  abierto,
  alCerrar,
}: {
  /** `null` = alta. */
  medio: MedioDePagoDelPanel | null;
  abierto: boolean;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const idBase = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [nombre, setNombre] = useState(medio?.name ?? "");
  const [descripcion, setDescripcion] = useState(medio?.description ?? "");
  const [logo, setLogo] = useState<AccionDeLogo>(LOGO_SIN_TOCAR);
  const [errorDelLogo, setErrorDelLogo] = useState<string | null>(null);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrores(SIN_ERRORES);

    iniciar(async () => {
      const resultado = medio
        ? await editarUnMedioDePago({
            id: medio.id,
            name: nombre,
            description: descripcion,
          })
        : await crearUnMedioDePago({ name: nombre, description: descripcion });

      if (!resultado.ok) {
        setErrores(leerErrores<Campo>(resultado));
        return;
      }

      // El logo va después de guardar el nombre, y por dos caminos distintos:
      // subirlo necesita mandar un archivo, así que va por el Route Handler
      // (§9.1); quitarlo es un booleano y va por una Server Action.
      if (logo.tipo !== "mantener") {
        const id = medio?.id ?? resultado.data.id;

        if (logo.tipo === "reemplazar") {
          const fallo = await subirLogo(id, logo.archivo);
          if (!fallo) {
            // El Route Handler invalida la caché del servidor, pero un
            // `fetch` —a diferencia de una Server Action— no trae la vista
            // nueva de vuelta. Sin esto el logo está guardado y el listado
            // sigue mostrando la fila sin él.
            router.refresh();
          }
          if (fallo) {
            // El medio de pago YA se guardó. Decirlo tal cual es más honesto
            // que fingir que no pasó nada o que falló todo.
            setErrorDelLogo(
              medio
                ? fallo
                : `${LOGO.falloTrasCrear("El medio de pago", "Editalo")} (${fallo})`,
            );
            return;
          }
        } else {
          const r = await quitarElLogoDelMedioDePago({ id });
          if (!r.ok) {
            setErrorDelLogo(r.message);
            return;
          }
        }
      }

      alCerrar();
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {medio ? "Editar medio de pago" : "Nuevo medio de pago"}
          </DialogTitle>
          {/* RN-01 dicho en la primera línea: nada de esto cobra. Es lo que
              evita que alguien espere que agregar «Mercado Pago» habilite un
              pago en la web. */}
          <DialogDescription>
            Se muestra en la tienda para que el comprador sepa cómo puede
            pagar. No cobra nada: el pago se coordina por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idBase}-name`}>Nombre</Label>
            <Input
              id={`${idBase}-name`}
              name="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              required
              maxLength={60}
              placeholder="Transferencia bancaria"
              aria-invalid={!!errores.campos.name || undefined}
              aria-describedby={
                errores.campos.name ? `${idBase}-e-name` : undefined
              }
            />
            <FieldError id={`${idBase}-e-name`}>
              {errores.campos.name}
            </FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idBase}-desc`}>
              Descripción{" "}
              <span className="font-normal text-ink-tertiary">(opcional)</span>
            </Label>
            <Input
              id={`${idBase}-desc`}
              name="description"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={120}
              placeholder="10% off transfiriendo"
              aria-invalid={!!errores.campos.description || undefined}
              aria-describedby={
                errores.campos.description
                  ? `${idBase}-e-desc`
                  : `${idBase}-ayuda-desc`
              }
            />
            {errores.campos.description ? (
              <FieldError id={`${idBase}-e-desc`}>
                {errores.campos.description}
              </FieldError>
            ) : (
              <FieldHint id={`${idBase}-ayuda-desc`}>
                Una línea corta, del estilo «10% off transfiriendo» o «hasta 6
                cuotas».
              </FieldHint>
            )}
          </div>

          <SelectorDeLogo
            id={`${idBase}-logo`}
            guardado={medio?.logoUrl ?? null}
            logo={logo}
            alCambiar={setLogo}
            error={errorDelLogo}
            alError={setErrorDelLogo}
            deshabilitado={enviando}
          />

          <FieldError>{errores.general}</FieldError>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="brand"
              loading={enviando}
              loadingLabel={
                logo.tipo === "reemplazar" ? LOGO.subiendo : "Guardando"
              }
            >
              {medio ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
