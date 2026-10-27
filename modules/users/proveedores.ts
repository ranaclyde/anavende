import "server-only";

/**
 * Qué ingresos sociales están prendidos — F1.7, RF-06.
 *
 * Las credenciales de Google y Facebook viven en GoTrue y no en la tienda
 * (TECHNICAL-SPEC §18): prender o apagar uno es tocar las variables del
 * servidor DATA. Así que la tienda no lleva su propia lista: le pregunta a
 * GoTrue, que la publica en `/auth/v1/settings`. Con una lista acá, prender
 * Facebook en el servidor y olvidarse de la tienda dejaría el botón escondido;
 * apagar Google y olvidarse, un botón que lleva a un error.
 *
 * **Se recuerda cinco minutos** en la caché de datos de Next: la respuesta no
 * cambia salvo cuando alguien toca el servidor, y sin memoria cada visita a
 * `/ingresar` y `/registro` sumaría un viaje a otra máquina antes de mostrar
 * nada.
 *
 * **Si GoTrue no contesta, ninguno.** Un botón que lleva a un ingreso caído es
 * peor que no verlo, y el email sigue andando.
 */

export const PROVEEDORES_SOCIALES = ["google", "facebook"] as const;

export type ProveedorSocial = (typeof PROVEEDORES_SOCIALES)[number];

const VIGENCIA_S = 300;

export async function proveedoresDisponibles(): Promise<ProveedorSocial[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return [];

  try {
    const respuesta = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: clave },
      next: { revalidate: VIGENCIA_S },
      signal: AbortSignal.timeout(3_000),
    });
    if (!respuesta.ok) throw new Error(`GoTrue respondió ${respuesta.status}`);

    const { external } = (await respuesta.json()) as {
      external?: Partial<Record<string, boolean>>;
    };
    return PROVEEDORES_SOCIALES.filter((id) => external?.[id] === true);
  } catch (error) {
    console.error(
      "[proveedores] No se pudo leer la configuración de GoTrue.",
      error,
    );
    return [];
  }
}
