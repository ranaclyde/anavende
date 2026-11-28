"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { LOGO } from "@/components/admin/catalogo/copy";
import {
  LOGO_SIN_TOCAR,
  SelectorDeLogo,
  type AccionDeLogo,
} from "@/components/admin/logo/selector";
import { Seccion, Secciones } from "@/components/admin/formulario";
import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetForm,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { readErrors, NO_ERRORS, type FormErrors } from "@/lib/form";
import { subirImagen } from "@/modules/media/cliente";
import {
  crearUnMedioDePago,
  editarUnMedioDePago,
  quitarElLogoDelMedioDePago,
} from "@/modules/settings/actions";
import type { MedioDePagoDelPanel } from "@/modules/settings/queries";

type Campo = "name" | "description";

/** Lo mismo que el logo de marca, por el Route Handler (TS §9.1). */
async function subirLogo(id: string, archivo: File): Promise<string | null> {
  const r = await subirImagen(
    { destino: "medio-de-pago", paymentMethodId: id },
    archivo,
  );
  return r.ok ? null : r.message;
}

/**
 * Alta y edición de un medio de pago, en un drawer — RF-19, DR §6.14.3. No hay
 * campo de orden: se agrega al final y se mueve desde el listado.
 *
 * Se monta al abrirse y se desmonta al cerrar, y por eso el estado arranca de
 * las props sin efecto que lo reponga. Limpiarlo al abrir no alcanza: el
 * cierre ocurre dentro de una transición que todavía revalida, y reabrir ahí
 * arrancaba con lo escrito la vez anterior.
 */
export function EdicionDeMedioDePago({
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
  const [errores, setErrores] = useState<FormErrors<Campo>>(NO_ERRORS);
  const [nombre, setNombre] = useState(medio?.name ?? "");
  const [descripcion, setDescripcion] = useState(medio?.description ?? "");
  const [logo, setLogo] = useState<AccionDeLogo>(LOGO_SIN_TOCAR);
  const [errorDelLogo, setErrorDelLogo] = useState<string | null>(null);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrores(NO_ERRORS);

    iniciar(async () => {
      const resultado = medio
        ? await editarUnMedioDePago({
            id: medio.id,
            name: nombre,
            description: descripcion,
          })
        : await crearUnMedioDePago({ name: nombre, description: descripcion });

      if (!resultado.ok) {
        setErrores(readErrors<Campo>(resultado));
        return;
      }

      if (logo.tipo !== "mantener") {
        const id = medio?.id ?? resultado.data.id;

        if (logo.tipo === "reemplazar") {
          const fallo = await subirLogo(id, logo.archivo);
          if (!fallo) {
            // Un `fetch`, a diferencia de una Server Action, no trae la vista
            // nueva: sin esto el listado sigue mostrando la fila sin el logo.
            router.refresh();
          }
          if (fallo) {
            // El medio de pago ya se guardó: queda abierto con el error del logo.
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

      avisar(
        medio
          ? `Guardaste «${nombre.trim()}».`
          : `Creaste el medio de pago «${nombre.trim()}».`,
      );
      alCerrar();
    });
  };

  return (
    <Sheet open={abierto} onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {medio ? "Editar medio de pago" : "Nuevo medio de pago"}
          </SheetTitle>
          {/* RN-01 dicho en la primera línea: nada de esto cobra. */}
          <SheetDescription>
            Se muestra en la tienda para que el comprador sepa cómo puede pagar.
            No cobra nada: el pago se coordina por WhatsApp.
          </SheetDescription>
        </SheetHeader>

        <SheetForm onSubmit={enviar} noValidate>
          <SheetBody>
            <Secciones>
              <Seccion>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${idBase}-name`}>Nombre</Label>
                  <Input
                    id={`${idBase}-name`}
                    name="name"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoFocus
                    required
                    maxLength={60}
                    aria-invalid={!!errores.fields.name || undefined}
                    aria-describedby={
                      errores.fields.name ? `${idBase}-e-name` : undefined
                    }
                  />
                  <FieldError id={`${idBase}-e-name`}>
                    {errores.fields.name}
                  </FieldError>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${idBase}-desc`}>
                    Descripción{" "}
                    <span className="font-normal text-ink-secondary">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id={`${idBase}-desc`}
                    name="description"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    maxLength={120}
                    aria-invalid={!!errores.fields.description || undefined}
                    aria-describedby={
                      errores.fields.description
                        ? `${idBase}-e-desc`
                        : `${idBase}-ayuda-desc`
                    }
                  />
                  {errores.fields.description ? (
                    <FieldError id={`${idBase}-e-desc`}>
                      {errores.fields.description}
                    </FieldError>
                  ) : (
                    <FieldHint id={`${idBase}-ayuda-desc`}>
                      Una línea corta, como «10% off transfiriendo».
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
              </Seccion>
            </Secciones>

            <FieldError className="mt-5">{errores.general}</FieldError>
          </SheetBody>

          <SheetFooter>
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
          </SheetFooter>
        </SheetForm>
      </SheetContent>
    </Sheet>
  );
}
