import "server-only";

/**
 * Los ingresos sociales prendidos se le preguntan a GoTrue, que guarda las
 * credenciales (TECHNICAL-SPEC §18): una lista propia acá se desincronizaría.
 * Si GoTrue no contesta, ninguno: el email sigue andando.
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
