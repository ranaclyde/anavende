# Versiones fijadas del stack

**Este archivo es el parámetro de toda consulta a `context7`**
(`DEVELOPMENT-PLAN.md` §1.2 regla 6, `TECHNICAL-SPEC.md` §2.1).
Se consulta la documentación de *estas* versiones, no de la última publicada.

Registrado el 2026-09-02 — tarea F0.9, parte de aplicación.
Ampliado el 2026-09-05 con la infraestructura de producción, cuando el
desarrollo pasó a apuntar al servidor DATA.
Ampliado el 2026-09-10 con el servidor APP —Coolify y su proxy—, cuando la
tienda se desplegó por primera vez.

| Pieza | Referencia (TS §2.1) | Instalada |
|---|---|---|
| Node.js | 22 LTS | v22.22.0 (`@types/node` 22.20.1) |
| npm | — | 10.9.4 |
| Next.js | 16.3.x | 16.3.4 |
| React | 19.2 | 19.2.8 |
| TypeScript | 5.x | 5.9.3 |
| Tailwind CSS | 4.x | 4.3.3 |
| @supabase/ssr | Últimas | 0.12.5 |
| @supabase/supabase-js | Últimas | 2.114.0 |
| Drizzle ORM | 0.45.x | 0.45.2 (`drizzle-kit` 0.31.10, `postgres` 3.4.9) |
| Zod | 4.x | 4.5.4 |
| sharp | 0.35.x | 0.35.4 |
| Lexical (editor de la descripción, RF-15) | 0.50.x | 0.50.0 (`@lexical/react`, `list`, `rich-text`, `markdown`, `utils`) |
| mdast (sanitizador del servidor, §16) | — | `from-markdown` 2.0.3, `to-markdown` 2.1.2, `gfm` 3.1.0, `micromark-extension-gfm` 3.0.0 |
| React Email | — | **`react-email` 6.9.3**, y es el paquete entero. `@react-email/components` está **deprecado en todas sus versiones**: la 6 unificó componentes, `render` y CLI en uno solo. Se instaló el deprecado primero y se revirtió — los mantenedores son los de `resend/react-email`, así que no es un secuestro del paquete |
| Resend (envío de E4) | resend 6.x | pendiente, cuando E4 se conecte |
| ExcelJS | 4.x | pendiente F9.2 |
| Sentry | @sentry/nextjs | 10.73.0 |
| decimal.js (aritmética de montos, §7.1) | — | 10.6.0 |
| Vitest | — | **5.0.0** (F4.0, 2026-09-06). Pidió subir `@types/node` de `^20` a `^22`, que es la versión de Node que §2.1 declara y la que corre de verdad |
| Playwright | — | **1.63.0** (`@playwright/test`, 2026-09-08). Instalado para poder **ver y medir el teléfono**, que hasta hoy era a ciegas; sólo se bajó Chromium (`npx playwright install chromium`). La suite de extremo a extremo sigue pendiente en F10.2 |
| PostgreSQL (servidor DATA) | 15+ | **15.8** (`supabase/postgres:15.8.1.085`) — `supabase/config.toml` igualado a esta |
| Supabase auto-hospedado (servidor DATA) | — | *docker compose* oficial. Las trece imágenes, abajo |
| Coolify (servidor APP) | — | **4.3.18** — la que instaló el atajo de DonWeb. Registrada el 2026-09-10 |
| Traefik (proxy del servidor APP) | — | **3.6.25** (*ramequin*, compilado 2026-07-31, go1.26.5). El proxy que trae Coolify, y el único que quedó en pie: el nginx del atajo de DonWeb se apagó y deshabilitó (2026-09-09). **La etiqueta de la imagen es `traefik:v3.6`, que es una serie y no una versión**: el parche sale de `docker exec coolify-proxy traefik version`, no de la etiqueta, y puede cambiar solo — ver la nota de abajo. Hay v3.7 y se deja pasar a propósito: actualizar es una decisión aparte |

> **Una etiqueta de serie no fija nada.** Coolify referencia a Traefik como
> `traefik:v3.6`, así que la próxima vez que esa imagen se descargue puede
> traer otro parche con el mismo nombre, sin que nadie lo haya pedido y sin
> que se note. Es exactamente el riesgo que este archivo existe para evitar.
> No se cambió por ahora —tocar cómo Coolify referencia su propio proxy es
> meter mano en su instalación—, pero **el número de arriba hay que volver a
> mirarlo después de cualquier actualización de Coolify**, y no darlo por
> válido porque está escrito.

### Imágenes del stack del servidor DATA

Registradas el 2026-09-05 con `docker ps --format '{{.Names}}\t{{.Image}}'`.
Las tres primeras son las que el código toca de verdad; el resto se anota
porque una actualización silenciosa de cualquiera de ellas es un cambio de
producción que nadie pidió.

| Servicio | Imagen |
|---|---|
| Postgres | `supabase/postgres:15.8.1.085` |
| Auth (GoTrue) | `supabase/gotrue:v2.184.0` |
| Storage | `supabase/storage-api:v1.33.0` |
| Pooler (Supavisor) | `supabase/supavisor:2.7.4` |
| API REST | `postgrest/postgrest:v14.1` |
| Pasarela | `kong:2.8.1` |
| Studio | `supabase/studio:2025.12.17-sha-43f4f7f` |
| Metadatos | `supabase/postgres-meta:v0.95.1` |
| Realtime | `supabase/realtime:v2.68.0` |
| Edge Functions | `supabase/edge-runtime:v1.69.28` |
| Analytics (Logflare) | `supabase/logflare:1.27.0` |
| Vector | `timberio/vector:0.28.1-alpine` |
| imgproxy | `darthsim/imgproxy:v3.8.0` |

---

## Verificaciones de F0: qué se comprobó y dónde

Lo comprobado contra el stack local **no cierra una tarea de F0**
(`TECHNICAL-SPEC.md` §18.2). Producción es el entorno de verdad.

| Tarea | Local | Producción |
|---|---|---|
| F0.3 Supabase en el servidor DATA | — | ✅ |
| F0.4 Cerrar Postgres al mundo | — | ✅ **completa desde el 2026-09-09**: el firewall local que faltaba esperaba a que existiera el servidor APP. `ufw` en los dos, más dos reglas en `DOCKER-USER` que abren el 5432 sólo desde `192.168.200.193` |
| F0.6 `pg_trgm` y `unaccent` con similitud real | ✅ comprobado | ✅ `db:verificar` contra el VPS |
| F0.7 Storage: subir, leer, borrar | ⬜ | ✅ `db:imagenes` contra el bucket `productos` del VPS |
| F0.11 Resend como SMTP | — sin equivalente local (Mailpit) | ✅ emails reales a una casilla de verdad |
| F0.12 Admin API de Auth | ⬜ | ✅ listar y borrar por `service_role` |
| F0.13 *Send Email Hook* auto-hospedado | ⬜ | ⬜ pendiente |
| F0.1 Servidores unidos por LAN | — sin equivalente local | ✅ 2026-09-09 |
| F0.2 Coolify + limpieza de Docker | — sin equivalente local | ✅ 2026-09-09, con la limpieza **programada** |
| F0.8 Latencia real de la LAN | — sin equivalente local | ✅ **0,4 ms** medidos el 2026-09-09 |
| F0.5 Restringir Studio · F0.10 Backup | — sin equivalente local | ⬜ pendiente |

**Lo que hay que recordar de este cruce.** Los tres caminos de email —alta,
reenvío y recuperación— **funcionaban en local y llegaron rotos a
producción**, todos por lo mismo: el endpoint `/resend` de GoTrue descarta el
`code_challenge` de PKCE. En local no se veía porque nunca se hizo clic en un
enlace de Mailpit. Es el ejemplo más caro hasta ahora de por qué §18.2 dice
que el entorno de verdad es producción. El detalle está en `PROGRESO.md`,
en las decisiones.
