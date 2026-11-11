"use client";

import { Droplets, DropletOff, Layers, Plus } from "lucide-react";
import { Fragment, useState, useTransition } from "react";

import { useAvisoAlSalir } from "@/components/admin/aviso-al-salir";
import { EstadoDeGuardado } from "@/components/admin/estado-de-guardado";
import { BibliotecaDeMarcas } from "@/components/admin/marca-de-agua/biblioteca";
import { EditorDeCapa } from "@/components/admin/marca-de-agua/capa";
import {
  capaNueva,
  sinClave,
  type CapaEnPantalla,
} from "@/components/admin/marca-de-agua/tipos";
import { VistaPrevia } from "@/components/admin/marca-de-agua/vista-previa";
import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { VacioDelPanel } from "@/components/admin/vacio";
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
    marca.capas.map((c) => ({ ...c, clave: crypto.randomUUID() })),
  );
  // Lo del servidor cambió —se guardó, o borrar una imagen se llevó su
  // capa—: la pantalla pasa a mostrar eso. Durante el render y no en un
  // efecto, para no pintar primero lo viejo.
  const [ultimasVistas, setUltimasVistas] = useState(guardadas);
  if (ultimasVistas !== guardadas) {
    setUltimasVistas(guardadas);
    setCapas(marca.capas.map((c) => ({ ...c, clave: crypto.randomUUID() })));
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

  const sinBiblioteca = marca.biblioteca.length === 0;

  return (
    // En el orden en que se usa: el estado, la biblioteca —primero se sube
    // la imagen— y las capas, con su «Guardar» adentro y al pie: guarda las
    // capas y nada más, y lo de abajo no queda colgando de un botón que no
    // lo guarda (2026-11-11).
    //
    // Al lado, la vista previa se queda con todo el ancho que sobra: es una
    // foto, y cuanto más grande mejor se juzga una marca suave. Los
    // controles no necesitan más de 36rem. Apiladas, va después de las
    // capas: es lo que se mira al mover un control.
    <div className="@container w-full">
      <div className="grid max-w-admin-form items-start gap-4 @min-[60rem]:max-w-none @min-[60rem]:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
        <div className="min-w-0 @min-[60rem]:col-start-1">
          <Interruptor
            activa={marca.activa}
            hayCapasGuardadas={marca.capas.length > 0}
            hayCambios={hayCambios}
          />
        </div>

        <div className="min-w-0 @min-[60rem]:col-start-1">
          <BibliotecaDeMarcas biblioteca={marca.biblioteca} usadaEn={usadaEn} />
        </div>

        <div className="min-w-0 @min-[60rem]:col-start-1">
          <TarjetaDeSeccion
            id="marca-capas"
            titulo="Capas"
            ayuda="Lo que se pega sobre cada foto, en orden: la primera queda abajo. Por ejemplo, el nombre repetido muy suave y el logo en una esquina."
          >
            {capas.length === 0 ? (
              <VacioDelPanel
                dentro
                icono={Layers}
                titulo="Todavía no armaste ninguna capa"
                accion={
                  sinBiblioteca ? null : (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setCapas([capaNueva(marca.biblioteca[0].id)])
                      }
                    >
                      <Plus aria-hidden />
                      Agregar capa
                    </Button>
                  )
                }
              >
                {sinBiblioteca
                  ? "Primero subí una imagen a la biblioteca, acá arriba: cada capa usa una."
                  : "Cada capa usa una imagen de la biblioteca, con su lugar, su tamaño y su opacidad."}
              </VacioDelPanel>
            ) : (
              <>
                <div className="flex flex-col">
                  {capas.map((capa, i) => (
                    <Fragment key={capa.clave}>
                      {i > 0 ? <hr className="my-6 border-border" /> : null}
                      <EditorDeCapa
                        capa={capa}
                        numero={i + 1}
                        total={capas.length}
                        biblioteca={marca.biblioteca}
                        alCambiar={(cambios) => cambiar(capa.clave, cambios)}
                        alMover={(d) => mover(i, d)}
                        alQuitar={() => {
                          setRecienGuardado(false);
                          setCapas((actuales) =>
                            actuales.filter((c) => c.clave !== capa.clave),
                          );
                        }}
                      />
                    </Fragment>
                  ))}
                </div>
                {capas.length < MAXIMO_DE_CAPAS ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => {
                      setRecienGuardado(false);
                      setCapas((actuales) => [
                        ...actuales,
                        capaNueva(marca.biblioteca[0].id),
                      ]);
                    }}
                  >
                    <Plus aria-hidden />
                    Agregar capa
                  </Button>
                ) : (
                  <p className="text-caption text-ink-secondary">
                    Entran hasta {MAXIMO_DE_CAPAS} capas.
                  </p>
                )}
              </>
            )}

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
          </TarjetaDeSeccion>
        </div>

        <div className="min-w-0 @min-[60rem]:sticky @min-[60rem]:top-4 @min-[60rem]:col-start-2 @min-[60rem]:row-span-3 @min-[60rem]:row-start-1">
          <VistaPrevia capas={enPantalla} />
        </div>
      </div>
    </div>
  );
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
    <TarjetaDeSeccion
      id="marca-estado"
      titulo="Estado"
      insignias={
        activa ? (
          <Badge tone="info">
            <Droplets aria-hidden />
            Activada
          </Badge>
        ) : (
          <Badge tone="neutral">
            <DropletOff aria-hidden />
            Desactivada
          </Badge>
        )
      }
      ayuda={
        activa
          ? "Las fotos de productos que subas llevan la marca en la tarjeta del catálogo y en la ficha. La miniatura queda limpia, y las fotos que ya estaban no cambian."
          : "Las fotos de productos se suben sin marca. Activarla no cambia las que ya están: vale para las que subas desde ese momento."
      }
    >
      <div className="flex flex-col items-start gap-2">
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
          <p
            id="marca-estado-motivo"
            className="text-caption text-ink-secondary"
          >
            {motivo}
          </p>
        ) : null}
        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </TarjetaDeSeccion>
  );
}
