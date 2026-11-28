import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { ALL_ALLOWED, type AllowedScenes } from "@/lib/scenes";
import { POR_PAGINA } from "@/modules/catalog/filtros-panel";
import { urlDeLogo } from "@/modules/media/subir";
import type { PromocionVigente } from "@/modules/settings/promociones";

/**
 * La sesión de Postgres está en UTC: sin esto, de 21 a 24 una promoción que
 * vence hoy ya se daría por vencida.
 */
const HOY_EN_ARGENTINA = sql`(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;

// La fila de `site_settings` puede no existir: no la escribe ninguna migración
// sino la vendedora, la primera vez que guarda la configuración (§5.9).

/**
 * Repetido a propósito del `DEFAULT` de la columna: la base decide la fila
 * nueva, y esto qué pasa cuando no hay fila. Es también lo que muestra el
 * formulario antes de la primera vez.
 */
export const UMBRAL_DE_STOCK_BAJO_POR_DEFECTO = 3;

export async function umbralDeStockBajo(): Promise<number> {
  const [fila] = await db.execute<{ umbral: number }>(sql`
    SELECT low_stock_threshold AS umbral FROM site_settings WHERE id = 1
  `);
  return fila?.umbral ?? UMBRAL_DE_STOCK_BAJO_POR_DEFECTO;
}

export type ConfiguracionDelSitio = {
  /** Normalizado a `+549…` (`lib/phone.ts`). */
  whatsappNumber: string;
  adminNotificationEmail: string;
  lowStockThreshold: number;
  /** `null` = esa red no se muestra. */
  facebookUrl: string | null;
  instagramUrl: string | null;
  /** Si la escena de cada fecha puede encenderse sola (RF-38). */
  halloweenScene: boolean;
  christmasScene: boolean;
  easterScene: boolean;
};

/**
 * `null`, y no valores de relleno, si nunca se guardó: la pantalla tiene que
 * distinguir un valor elegido de uno por defecto.
 */
export async function leerLaConfiguracion(): Promise<ConfiguracionDelSitio | null> {
  const [fila] = await db.execute<ConfiguracionDelSitio>(sql`
    SELECT whatsapp_number           AS "whatsappNumber",
           admin_notification_email  AS "adminNotificationEmail",
           low_stock_threshold       AS "lowStockThreshold",
           facebook_url              AS "facebookUrl",
           instagram_url             AS "instagramUrl",
           halloween_scene           AS "halloweenScene",
           christmas_scene           AS "christmasScene",
           easter_scene              AS "easterScene"
      FROM site_settings
     WHERE id = 1
  `);
  return fila ?? null;
}

/**
 * De la base y no de lo que recuerda el proxy, para que la pantalla no diga
 * «abierta» justo después de cerrarla. `null` = no hay fila.
 */
export async function elModoMantenimiento(): Promise<boolean | null> {
  const [fila] = await db.execute<{ activo: boolean }>(sql`
    SELECT maintenance_mode AS activo FROM site_settings WHERE id = 1
  `);
  return fila?.activo ?? null;
}

/**
 * Ordenados por `sort_order` y después por nombre, por si dos filas comparten
 * número. Es el mismo orden que usa `moverMedioDePago`: si discreparan, la
 * flecha movería el de al lado.
 */
export type MedioDePagoDelPanel = {
  id: string;
  name: string;
  description: string | null;
  /** Ya resuelta: armarla necesita el adaptador de almacenamiento. */
  logoUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Las vencidas al final. */
  promociones: PromocionDelPanel[];
};

/**
 * `estado` lo calcula la base contra el día de Argentina, como la tienda, para
 * que el panel no diga «vigente» de una que la ficha ya no muestra.
 */
export type PromocionDelPanel = {
  id: string;
  plan: string | null;
  cuotas: number;
  recargo: string;
  desde: string;
  hasta: string | null;
  montoMinimo: string | null;
  activa: boolean;
  estado: "vigente" | "programada" | "vencida";
};

export async function listarMediosDePago(
  pagina = 1,
): Promise<{ items: MedioDePagoDelPanel[]; total: number }> {
  const [filas, [conteo]] = await Promise.all([
    db.execute<
      Omit<MedioDePagoDelPanel, "logoUrl"> & { logoKey: string | null }
    >(
      sql`
    SELECT id, name, description,
           logo_key   AS "logoKey",
           sort_order AS "sortOrder",
           is_active  AS "isActive",
           -- Las promociones van en la misma ida: son pocas por medio, y una
           -- segunda consulta por página no ahorraría nada (RF-40).
           coalesce((
             SELECT json_agg(json_build_object(
                      'id', pp.id,
                      'plan', pp.plan_name,
                      'cuotas', pp.installments,
                      'recargo', pp.surcharge_pct::text,
                      'desde', pp.starts_on::text,
                      'hasta', pp.ends_on::text,
                      'montoMinimo', pp.min_amount::text,
                      'activa', pp.is_active,
                      'estado', CASE
                        WHEN pp.ends_on < ${HOY_EN_ARGENTINA} THEN 'vencida'
                        WHEN pp.starts_on > ${HOY_EN_ARGENTINA} THEN 'programada'
                        ELSE 'vigente' END)
                    ORDER BY coalesce(pp.ends_on < ${HOY_EN_ARGENTINA}, false),
                             pp.starts_on, pp.installments, pp.id)
               FROM payment_promotions pp
              WHERE pp.payment_method_id = payment_methods.id
           ), '[]'::json) AS promociones
      FROM payment_methods
     -- El id desempata: dos medios con el mismo orden y el mismo nombre
     -- podrían cambiar de página entre dos cargas.
     ORDER BY sort_order, immutable_unaccent(lower(name)), id
     LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`,
    ),
    db.execute<{ total: number }>(
      sql`SELECT count(*)::int AS total FROM payment_methods`,
    ),
  ]);

  return {
    items: filas.map(({ logoKey, ...fila }) => ({
      ...fila,
      logoUrl: urlDeLogo(logoKey, "thumb"),
    })),
    total: conteo?.total ?? 0,
  };
}

// Lo que lee la tienda va en consultas propias y no en `leerLaConfiguracion()`
// recortada: una pantalla pública no tiene por qué traerse el email interno.

/**
 * `null` mientras no se haya guardado la configuración: quien lo use tiene que
 * no mostrar el botón, porque `wa.me/` sin número parece un sitio roto.
 */
export async function numeroDeWhatsApp(): Promise<string | null> {
  const [fila] = await db.execute<{ numero: string }>(sql`
    SELECT whatsapp_number AS numero FROM site_settings WHERE id = 1
  `);
  return fila?.numero ?? null;
}

export type RedesSociales = {
  facebook: string | null;
  instagram: string | null;
};

export type ConfiguracionDeLaTienda = {
  redes: RedesSociales;
  escenas: AllowedScenes;
};

/**
 * Con `cache()` porque el layout y el hero de la home la piden en el mismo
 * pedido. Sin fila, ninguna red y todas las escenas, como el DEFAULT.
 */
export const configuracionDeLaTienda = cache(
  async (): Promise<ConfiguracionDeLaTienda> => {
    const [fila] = await db.execute<RedesSociales & AllowedScenes>(sql`
      SELECT facebook_url    AS facebook,
             instagram_url   AS instagram,
             halloween_scene AS halloween,
             christmas_scene AS navidad,
             easter_scene    AS pascua
        FROM site_settings WHERE id = 1
    `);
    if (!fila) {
      return {
        redes: { facebook: null, instagram: null },
        escenas: ALL_ALLOWED,
      };
    }
    return {
      redes: { facebook: fila.facebook, instagram: fila.instagram },
      escenas: {
        halloween: fila.halloween,
        navidad: fila.navidad,
        pascua: fila.pascua,
      },
    };
  },
);

/**
 * El monto mínimo no se filtra acá: así la consulta es la misma para toda la
 * tienda y va en paralelo con la ficha (`promocionesParaElPrecio` termina).
 * Viene en el orden de los medios de pago, que es el que desempata.
 */
export const promocionesVigentes = cache(
  async (): Promise<PromocionVigente[]> => {
    const filas = await db.execute<
      Omit<PromocionVigente, "logoUrl"> & { logoKey: string | null }
    >(sql`
      SELECT pp.id,
             pm.name                 AS medio,
             pp.plan_name            AS plan,
             pm.logo_key             AS "logoKey",
             pp.installments         AS cuotas,
             pp.surcharge_pct::text  AS recargo,
             pp.min_amount::text     AS "montoMinimo"
        FROM payment_promotions pp
        JOIN payment_methods pm ON pm.id = pp.payment_method_id
       WHERE pp.is_active AND pm.is_active
         AND pp.starts_on <= ${HOY_EN_ARGENTINA}
         AND (pp.ends_on IS NULL OR pp.ends_on >= ${HOY_EN_ARGENTINA})
       ORDER BY pm.sort_order, immutable_unaccent(lower(pm.name)),
                pp.installments, pp.id
    `);
    return filas.map(({ logoKey, ...p }) => ({
      ...p,
      logoUrl: urlDeLogo(logoKey, "thumb"),
    }));
  },
);

export type MedioDePagoDeLaTienda = {
  id: string;
  nombre: string;
  logoUrl: string | null;
};

/** Solo los activos: decir que se acepta algo que no, es el peor error. */
export async function mediosDePagoDeLaTienda(): Promise<
  MedioDePagoDeLaTienda[]
> {
  const filas = await db.execute<{
    id: string;
    nombre: string;
    logoKey: string | null;
  }>(sql`
    SELECT id, name AS nombre, logo_key AS "logoKey"
      FROM payment_methods
     WHERE is_active
     ORDER BY sort_order, immutable_unaccent(lower(name))
  `);

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    logoUrl: urlDeLogo(f.logoKey, "thumb"),
  }));
}

/**
 * `null` mientras no se haya guardado la configuración: entonces el aviso no
 * se manda, porque no hay dirección de respaldo razonable.
 */
export async function emailDeAvisos(): Promise<string | null> {
  const [fila] = await db.execute<{ email: string }>(sql`
    SELECT admin_notification_email AS email FROM site_settings WHERE id = 1
  `);
  return fila?.email ?? null;
}
