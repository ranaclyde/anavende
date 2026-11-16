import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { TODAS_PERMITIDAS, type EscenasPermitidas } from "@/lib/escenas";
import { POR_PAGINA } from "@/modules/catalog/filtros-panel";
import { urlDeLogo } from "@/modules/media/subir";
import type { PromocionVigente } from "@/modules/settings/promociones";

/**
 * El día de hoy en Argentina, para comparar contra columnas `date` (RF-40).
 * La sesión de Postgres está en UTC: sin esto, de 21 a 24 una promoción que
 * vence hoy ya se daría por vencida.
 */
const HOY_EN_ARGENTINA = sql`(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;

/**
 * Configuración del sitio — RF-20, §5.9.
 *
 * La tabla es un singleton garantizado por CHECK, y la fila puede NO
 * existir: **no la escribe ninguna migración, la escribe la vendedora** la
 * primera vez que guarda la pantalla de configuración (F2.7). No podría ser
 * de otra manera: sus dos columnas de texto son NOT NULL y no hay número de
 * WhatsApp ni email que una migración pueda inventar. Así que el respaldo
 * del umbral no era algo provisorio de F2.5: es permanente.
 */

/**
 * El mismo `3` que declara `DEFAULT` en la columna (§5.9).
 *
 * Está repetido a propósito y no derivado: la base decide el valor de la
 * fila nueva, y este decide qué pasa cuando NO hay fila. Son dos preguntas
 * distintas que hoy tienen la misma respuesta.
 *
 * También es lo que la pantalla de configuración muestra en el campo antes
 * de la primera vez, y eso importa: si ofreciera otro número, guardar sin
 * tocar nada cambiaría el comportamiento del listado sin que nadie lo
 * hubiera pedido.
 */
export const UMBRAL_DE_STOCK_BAJO_POR_DEFECTO = 3;

export async function umbralDeStockBajo(): Promise<number> {
  const [fila] = await db.execute<{ umbral: number }>(sql`
    SELECT low_stock_threshold AS umbral FROM site_settings WHERE id = 1
  `);
  return fila?.umbral ?? UMBRAL_DE_STOCK_BAJO_POR_DEFECTO;
}

export type ConfiguracionDelSitio = {
  /** Normalizado a `+549…` (`lib/telefono.ts`). */
  whatsappNumber: string;
  adminNotificationEmail: string;
  lowStockThreshold: number;
  /** Enlaces completos y normalizados; `null` = esa red no se muestra. */
  facebookUrl: string | null;
  instagramUrl: string | null;
  /** Si la escena de cada fecha puede encenderse sola (F9.5, RF-38). */
  halloweenScene: boolean;
  christmasScene: boolean;
  easterScene: boolean;
};

/**
 * La configuración entera, para la pantalla que la edita.
 *
 * Devuelve `null` —y no valores de relleno— cuando todavía no se guardó
 * nunca. Es la diferencia entre «acá dice 3 porque lo elegiste» y «acá dice
 * 3 porque es lo que usa el sistema mientras no elijas»: quien lo tiene que
 * distinguir es la pantalla, y con un objeto ya rellenado no podría.
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
 * El interruptor de mantenimiento como está EN LA BASE — F2.7b.
 *
 * Para la pantalla que lo cambia, que no puede mostrar lo que el proxy
 * recuerda: si dijera «abierta» cinco segundos después de cerrarla, parecería
 * que no se guardó. `null` = la configuración nunca se guardó y no hay fila
 * donde prenderlo.
 */
export async function elModoMantenimiento(): Promise<boolean | null> {
  const [fila] = await db.execute<{ activo: boolean }>(sql`
    SELECT maintenance_mode AS activo FROM site_settings WHERE id = 1
  `);
  return fila?.activo ?? null;
}

/**
 * Los medios de pago del panel — RF-19.
 *
 * El orden es el que se configuró, y el nombre desempata: `sort_order` se
 * renumera sin huecos en cada alta, baja y movimiento (`actions.ts`), pero
 * dos filas pueden compartir número si alguien las escribe por fuera del
 * panel. Sin el desempate, esas dos cambiarían de lugar entre dos cargas de
 * la misma pantalla.
 *
 * **Es el mismo orden que usa `moverMedioDePago` para saber quién está
 * arriba de quién.** Si discreparan, la flecha movería el de al lado.
 */
export type MedioDePagoDelPanel = {
  id: string;
  name: string;
  description: string | null;
  /**
   * La URL del logo, ya resuelta. `null` = no tiene. La vista recibe una URL
   * y no una clave a propósito: armarla necesita el adaptador de
   * almacenamiento (§9.4), que es código de servidor.
   */
  logoUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Sus promociones de cuotas (RF-40), las vencidas al final. */
  promociones: PromocionDelPanel[];
};

/**
 * Una promoción de cuotas en el panel — RF-40.
 *
 * Los montos y el recargo como los guarda la base (§7.2); las fechas,
 * `AAAA-MM-DD`. `estado` lo calcula la base contra el día de Argentina, el
 * mismo criterio que usa la tienda, para que el panel no diga «vigente» de
 * una que la ficha ya no muestra.
 */
export type PromocionDelPanel = {
  id: string;
  /** «Plan Z». `null` = la promoción es del medio, sin aclaración. */
  plan: string | null;
  cuotas: number;
  recargo: string;
  desde: string;
  hasta: string | null;
  montoMinimo: string | null;
  activa: boolean;
  estado: "vigente" | "programada" | "vencida";
};

/**
 * Los medios de pago del panel, paginados desde el 2026-09-18 (§6.9).
 *
 * Devuelve `{ items, total }` por lo mismo que las otras tres de catálogo: con
 * `LIMIT`, el largo del arreglo es el de la página, y el contador y el estado
 * vacío de la pantalla necesitan el total de verdad.
 */
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

// ── Lo que la tienda necesita de la configuración ───────────────────────
//
// Consultas propias y no `leerLaConfiguracion()` recortada: esa devuelve
// también el email de aviso a la administradora, y una pantalla pública no
// tiene por qué traerse un dato interno a la memoria del servidor para
// después descartarlo.

/**
 * El número al que van los `wa.me` de la tienda — RF-20, F3.6.
 *
 * `null` mientras la vendedora no haya guardado la configuración, y eso pasa
 * de verdad: la fila no la escribe ninguna migración (§5.9). Quien lo use
 * tiene que poder no mostrar el botón, no armar un enlace roto — `wa.me/`
 * sin número abre WhatsApp en la nada y parece que el sitio falló.
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
  escenas: EscenasPermitidas;
};

/**
 * Lo que la tienda lee de la configuración en cada página: los perfiles del
 * pie (2026-10-20) y qué escenas por fecha están permitidas (F9.5, RF-38).
 *
 * **Una consulta y no dos**, porque las dos van en la misma tanda del layout.
 * Con `cache()` porque la home la vuelve a pedir para el hero, y dentro de
 * un mismo pedido no tiene que volver a la base.
 *
 * Sin fila, ninguna red —un ícono que no lleva a ningún lado es peor que no
 * tenerlo— y todas las escenas permitidas, lo mismo que el DEFAULT.
 */
export const configuracionDeLaTienda = cache(
  async (): Promise<ConfiguracionDeLaTienda> => {
    const [fila] = await db.execute<RedesSociales & EscenasPermitidas>(sql`
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
        escenas: TODAS_PERMITIDAS,
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
 * Las promociones de cuotas que la tienda muestra hoy — RF-40, F2.17.
 *
 * Activas, de un medio de pago activo y dentro de la vigencia **según el día
 * de Argentina**: «hasta el 30» incluye el 30 entero acá, aunque en UTC ya
 * sea 1. El monto mínimo NO se filtra acá: depende del producto, y sin él la
 * consulta es la misma para toda la tienda y se puede pedir en paralelo con
 * la ficha (`promocionesParaElPrecio` termina el trabajo).
 *
 * En el orden de los medios de pago, que es con el que se desempata.
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

/** Un medio de pago como lo ve el comprador (RF-01, RF-02, RF-03). */
export type MedioDePagoDeLaTienda = {
  id: string;
  nombre: string;
  logoUrl: string | null;
};

/**
 * Los medios de pago **activos**, en el orden configurado — RF-19, RN-01.
 *
 * `listarMediosDePago()` es la del panel y trae también los desactivados,
 * porque ahí desactivar es un estado que se administra. Acá un desactivado
 * no existe: son informativos y decir que se acepta algo que no se acepta es
 * el peor de los dos errores posibles.
 */
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
 * La casilla que recibe el aviso de nueva orden — RF-20, RF-30 (E4), F6.4.
 *
 * Consulta propia y no `leerLaConfiguracion()` recortada, por el mismo motivo
 * que `numeroDeWhatsApp()`: cada lectura trae lo suyo y nada más.
 *
 * `null` mientras la vendedora no haya guardado la configuración. Quien la use
 * tiene que poder **no mandar el email**, que es lo que corresponde: no hay
 * dirección de respaldo razonable, y mandárselo a cualquier otra sería peor
 * que no mandarlo.
 */
export async function emailDeAvisos(): Promise<string | null> {
  const [fila] = await db.execute<{ email: string }>(sql`
    SELECT admin_notification_email AS email FROM site_settings WHERE id = 1
  `);
  return fila?.email ?? null;
}
