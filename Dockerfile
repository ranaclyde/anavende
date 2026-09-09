# syntax=docker/dockerfile:1

# Contenedor de producción — TECHNICAL-SPEC §18.1 y §18.2.
#
# Tres etapas: dependencias, construcción y ejecución. Lo único que viaja al
# servidor es la tercera; las dos primeras existen para que la tercera sea
# chica.
#
# **Base Debian slim y NO Alpine, y es la decisión más importante de este
# archivo.** sharp envuelve a libvips, que es C, y descarga un binario
# compilado para la biblioteca de C del sistema: glibc en Debian, musl en
# Alpine. Como acá se COPIAN los `node_modules` de una etapa a otra, mezclar
# bases copia el binario equivocado — y eso no falla al construir: falla en
# producción, la primera vez que alguien sube una foto, con
# «'linux-x64' binaries cannot be used on the 'linuxmusl-x64' platform».
# Las tres etapas usan exactamente la misma imagen por ese motivo.

ARG NODE_IMAGE=node:22-bookworm-slim


# --- 1. Dependencias -------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# Solo el manifiesto y el candado: mientras no cambien, Docker reutiliza esta
# capa y no vuelve a instalar nada.
COPY package.json package-lock.json ./
RUN npm ci


# --- 2. Construcción -------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Las NEXT_PUBLIC_* se INCRUSTAN en el build, no se leen al arrancar: hay que
# pasarlas acá o quedan vacías para siempre en esa imagen.
#
# Y una en particular no es solo del navegador: `next.config.ts` deriva de
# NEXT_PUBLIC_SUPABASE_URL la lista de orígenes de imagen permitidos (§9.3).
# Construir sin ella deja `remotePatterns` VACÍO, y entonces la tienda no
# muestra ninguna foto de producto y el motivo sale por la consola del
# servidor, no en pantalla.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build


# --- 3. Ejecución ----------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuario sin privilegios (§18.1). Si algún día alguien se escapa del proceso
# de Node, se escapa a una cuenta que no puede escribir nada.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --home /app nextjs

# El servidor mínimo que dejó `output: 'standalone'`, y las dos carpetas que
# ese servidor NO se copia solo.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Lo que el trazado de Next no puede saber que hace falta, porque no lo usa
# ninguna página: el migrador de arranque y las migraciones.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations
COPY --chown=nextjs:nodejs scripts/migrar.mjs ./scripts/migrar.mjs
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

# sharp explícito y no confiando en el trazado: es la pieza que §18.1 señala
# como la que falla tarde y mal. Vienen de `deps`, que es la MISMA base, así
# que el binario es el que corresponde.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

USER nextjs
EXPOSE 3000

# Sin `curl` en la imagen —Debian slim no lo trae y agregarlo es superficie de
# más—, así que el healthcheck lo hace el propio Node con `fetch`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
