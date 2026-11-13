"use client";

import { Droplets, DropletOff } from "lucide-react";
import { useState, useTransition } from "react";

import { useAvisoAlSalir } from "@/components/admin/aviso-al-salir";
import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { EstadoDeGuardado } from "@/components/admin/estado-de-guardado";
import { BibliotecaDeMarcas } from "@/components/admin/marca-de-agua/biblioteca";
import { EditorDeCapa } from "@/components/admin/marca-de-agua/capa";
import {
  capaNueva,
  sinClave,
  type CapaEnPantalla,
} from "@/components/admin/marca-de-agua/tipos";
import { VistaPrevia } from "@/components/admin/marca-de-agua/vista-previa";
import { Accordion } from "@/components/ui/accordion";
import { avisar, avisarConPero } from "@/components/ui/aviso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cambiarLaMarcaDeAgua,
  guardarLasCapasDeLaMarca,
} from "@/modules/marca-de-agua/actions";
import type { MarcaDeAguaDelPanel } from "@/modules/marca-de-agua/queries";
import { MAXIMO_DE_CAPAS } from "@/modules/media/capas-de-marca";

/**
 * La pantalla de la marca de agua — RF-39, TS §9.6.
 *
 * **Las capas se editan en pantalla y se guardan juntas**, con la vista
 * previa mirando lo que está en pantalla: se prueba antes de guardar. El
 * interruptor, en cambio, surte efecto en el acto y va aparte, como el modo
 * mantenimiento: activar no es un valor más de un formulario.
 */
export function EditorDeMarcaDeAgua({ marca }: { marca: MarcaDeAguaDelPanel }) {
  const guardadas = JSON.stringify(marca.capas);
  const [capas, setCapas] = useState<CapaEnPantalla[]>(() =>
    conClave(marca.capas),
  );
  // Con dos capas o más se pliegan y se abre una por vez, como los colores
  // del producto (2026-11-13): abiertas todas, la lista era larga y costaba
  // ver cuál era cuál. Arranca abierta la primera.
  const [abierta, setAbierta] = useState(() => capas[0]?.clave ?? "");
  // Lo del servidor cambió —se guardó, o borrar una imagen se llevó su
  // capa—: la pantalla pasa a mostrar eso. Durante el render y no en un
  // efecto, para no pintar primero lo viejo.
  const [ultimasVistas, setUltimasVistas] = useState(guardadas);
  if (ultimasVistas !== guardadas) {
    setUltimasVistas(guardadas);
    const nuevas = conClave(marca.capas);
    setCapas(nuevas);
    setAbierta(nuevas[0]?.clave ?? "");
  }

  const enPantalla = capas.map(sinClave);
  const hayCambios = JSON.stringify(enPantalla) !== guardadas;
  const [recienGuardado, setRecienGuardado] = useState(false);
  const [guardando, iniciarGuardado] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useAvisoAlSalir(hayCambios);

  function cambiar(clave: string, cambios: Partial<CapaEnPantalla>) {
    setRecienGuardado(false);
    setCapas((actuales) =>
      actuales.map((c) => (c.clave === clave ? { ...c, ...cambios } : c)),
    );
  }

  function agregar(imageId: string) {
    if (capas.length >= MAXIMO_DE_CAPAS) return;
    const nueva = capaNueva(imageId);
    setRecienGuardado(false);
    setCapas((actuales) => [...actuales, nueva]);
    setAbierta(nueva.clave);
  }

  function mover(indice: number, direccion: -1 | 1) {
    setRecienGuardado(false);
    setCapas((actuales) => {
      const otra = indice + direccion;
      if (otra < 0 || otra >= actuales.length) return actuales;
      const nuevas = [...actuales];
      [nuevas[indice], nuevas[otra]] = [nuevas[otra], nuevas[indice]];
      return nuevas;
    });
  }

  function quitar(clave: string) {
    setRecienGuardado(false);
    setCapas((actuales) => actuales.filter((c) => c.clave !== clave));
  }

  function guardar() {
    setError(null);
    iniciarGuardado(async () => {
      const r = await guardarLasCapasDeLaMarca({ capas: enPantalla });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setRecienGuardado(true);
      if (r.data.seApago) {
        avisarConPero(
          "Guardamos las capas. Sin ninguna, la marca de agua quedó desactivada.",
        );
      }
    });
  }

  const usadaEn = new Map<string, number[]>();
  marca.capas.forEach((c, i) => {
    usadaEn.set(c.imageId, [...(usadaEn.get(c.imageId) ?? []), i + 1]);
  });

  const encabezado = {
    titulo: "Marca de agua",
    volver: { href: "/admin/configuracion", etiqueta: "Configuración" },
    bajada:
      "Lo que se pone sobre las fotos de productos que subís mientras está activada, para que no se puedan usar en otro lado.",
  };

  // Sin imágenes no hay nada que armar, probar ni activar: la pantalla es
  // solo el primer paso (2026-11-11).
  if (marca.biblioteca.length === 0) {
    return (
      <div className="flex w-full max-w-admin-form flex-col gap-4">
        <EncabezadoDePanel {...encabezado} />
        <BibliotecaDeMarcas biblioteca={marca.biblioteca} usadaEn={usadaEn} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* El estado y su botón van en el encabezado y no en una tarjeta: es
          lo que se mira primero, y surte efecto solo, sin «Guardar». */}
      <EncabezadoDePanel
        {...encabezado}
        insignias={
          marca.activa ? (
            <Badge tone="success">
              <Droplets aria-hidden />
              Activada
            </Badge>
          ) : (
            <Badge tone="danger">
              <DropletOff aria-hidden />
              Desactivada
            </Badge>
          )
        }
        acciones={
          <Interruptor
            activa={marca.activa}
            hayCapasGuardadas={marca.capas.length > 0}
            hayCambios={hayCambios}
          />
        }
      />

      {/* Dos mitades iguales desde 56rem de contenido (896px), como Reportes: a la
          izquierda se arma —imágenes, capas y «Guardar» al pie, en una sola
          tarjeta porque se guarda junto— y a la derecha se mira. Apiladas,
          la vista previa va después. */}
      <div className="@container">
        <div className="grid max-w-admin-form items-start gap-4 @min-[56rem]:max-w-none @min-[56rem]:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6 rounded-panel-card border border-border bg-surface p-4">
            <BibliotecaDeMarcas
              biblioteca={marca.biblioteca}
              usadaEn={usadaEn}
              alAgregarCapa={agregar}
              entranMasCapas={capas.length < MAXIMO_DE_CAPAS}
            />

            <section
              aria-labelledby="marca-capas"
              className="flex flex-col gap-4 border-t border-border pt-6"
            >
              <div className="flex flex-col gap-1">
                <h2 id="marca-capas" className="text-body font-medium text-ink">
                  Capas
                </h2>
                <p className="text-body-sm text-ink-secondary">
                  Lo que se pega sobre cada foto, en orden: la primera queda
                  abajo. Por ejemplo, el nombre repetido muy suave y el logo en
                  una esquina.
                </p>
              </div>

              {capas.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-panel-image bg-surface-sunken p-4">
                  <p className="text-body-sm text-ink-secondary">
                    Todavía no armaste ninguna. Tocá «Capa» debajo de una de las
                    imágenes de arriba y elegí su lugar, su tamaño y su
                    opacidad.
                  </p>
                </div>
              ) : (
                <>
                  {capas.length === 1 ? (
                    <EditorDeCapa
                      capa={capas[0]}
                      numero={1}
                      total={1}
                      biblioteca={marca.biblioteca}
                      plegable={false}
                      alCambiar={(cambios) => cambiar(capas[0].clave, cambios)}
                      alMover={(d) => mover(0, d)}
                      alQuitar={() => quitar(capas[0].clave)}
                    />
                  ) : (
                    <Accordion
                      type="single"
                      collapsible
                      value={abierta}
                      onValueChange={setAbierta}
                      asChild
                    >
                      <ul className="flex flex-col divide-y divide-border">
                        {capas.map((capa, i) => (
                          <EditorDeCapa
                            key={capa.clave}
                            capa={capa}
                            numero={i + 1}
                            total={capas.length}
                            biblioteca={marca.biblioteca}
                            plegable
                            alCambiar={(cambios) =>
                              cambiar(capa.clave, cambios)
                            }
                            alMover={(d) => mover(i, d)}
                            alQuitar={() => quitar(capa.clave)}
                          />
                        ))}
                      </ul>
                    </Accordion>
                  )}
                  {capas.length < MAXIMO_DE_CAPAS ? null : (
                    <p className="text-caption text-ink-secondary">
                      Entran hasta {MAXIMO_DE_CAPAS} capas.
                    </p>
                  )}
                </>
              )}
            </section>

            {error === null ? null : (
              <p role="alert" className="text-body-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
              <EstadoDeGuardado
                estado={
                  hayCambios
                    ? "sin-guardar"
                    : recienGuardado
                      ? "actualizado"
                      : "guardado"
                }
              />
              <Button
                variant="brand"
                loading={guardando}
                loadingLabel="Guardando"
                disabled={!hayCambios}
                onClick={guardar}
              >
                Guardar capas
              </Button>
            </div>
          </div>

          <div className="min-w-0 @min-[56rem]:sticky @min-[56rem]:top-4">
            <VistaPrevia capas={enPantalla} muestra={marca.muestra} />
          </div>
        </div>
      </div>
    </div>
  );
}

function conClave(capas: MarcaDeAguaDelPanel["capas"]): CapaEnPantalla[] {
  return capas.map((c) => ({ ...c, clave: crypto.randomUUID() }));
}

/**
 * Activar o desactivar — RF-39. Surte efecto en la próxima subida.
 *
 * **No se activa con cambios sin guardar**: activaría la marca guardada, que
 * no es la que está en pantalla, y la primera foto saldría con otra cosa.
 */
function Interruptor({
  activa,
  hayCapasGuardadas,
  hayCambios,
}: {
  activa: boolean;
  hayCapasGuardadas: boolean;
  hayCambios: boolean;
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const motivo = activa
    ? null
    : !hayCapasGuardadas
      ? "Para activarla, armá al menos una capa y guardala."
      : hayCambios
        ? "Guardá las capas para activarla con lo que ves."
        : null;

  function cambiar(siguiente: boolean) {
    setError(null);
    iniciar(async () => {
      const r = await cambiarLaMarcaDeAgua({ activa: siguiente });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      avisar(
        siguiente
          ? "Activamos la marca de agua: las próximas fotos que subas la llevan."
          : "Desactivamos la marca de agua: las próximas fotos salen sin ella.",
      );
    });
  }

  return (
    <div className="flex max-w-72 flex-col items-end gap-1.5 text-right">
      {activa ? (
        <Button
          variant="secondary"
          loading={enCurso}
          loadingLabel="Desactivando"
          onClick={() => cambiar(false)}
        >
          <DropletOff aria-hidden />
          Desactivar la marca de agua
        </Button>
      ) : (
        <Button
          variant="secondary"
          loading={enCurso}
          loadingLabel="Activando"
          disabled={motivo !== null}
          aria-describedby={motivo ? "marca-estado-motivo" : undefined}
          onClick={() => cambiar(true)}
        >
          <Droplets aria-hidden />
          Activar la marca de agua
        </Button>
      )}
      {motivo ? (
        <p id="marca-estado-motivo" className="text-caption text-ink-secondary">
          {motivo}
        </p>
      ) : null}
      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
