# Versiones fijadas del stack

**Este archivo es el parámetro de toda consulta a `context7`**
(`DEVELOPMENT-PLAN.md` §1.2 regla 6, `TECHNICAL-SPEC.md` §2.1).
Se consulta la documentación de *estas* versiones, no de la última publicada.

Registrado el 2026-09-02 — tarea F0.9, parte de aplicación.
Ampliado el 2026-09-05 con la infraestructura de producción, cuando el
desarrollo pasó a apuntar al servidor DATA.

| Pieza | Referencia (TS §2.1) | Instalada |
|---|---|---|
| Node.js | 22 LTS | v22.22.0 |
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
| Resend + React Email | resend 6.x | pendiente F1.8 |
| ExcelJS | 4.x | pendiente F9.2 |
| Sentry | @sentry/nextjs | 10.73.0 |
| decimal.js (aritmética de montos, §7.1) | — | 10.6.0 |
| Vitest + Playwright | — | pendiente F4.6 / F10.2 |
| PostgreSQL (servidor DATA) | 15+ | **15.8** (`supabase/postgres:15.8.1.085`) — `supabase/config.toml` igualado a esta |
| Supabase auto-hospedado (servidor DATA) | — | *docker compose* oficial. Las trece imágenes, abajo |
| Coolify | — | **pendiente F0.2** |

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
| F0.4 Cerrar Postgres al mundo | — | 🟡 cerrado y verificado; falta el firewall local, que necesita el segundo servidor |
| F0.6 `pg_trgm` y `unaccent` con similitud real | ✅ comprobado | ✅ `db:verificar` contra el VPS |
| F0.7 Storage: subir, leer, borrar | ⬜ | ✅ `db:imagenes` contra el bucket `productos` del VPS |
| F0.11 Resend como SMTP | — sin equivalente local (Mailpit) | ✅ emails reales a una casilla de verdad |
| F0.12 Admin API de Auth | ⬜ | ✅ listar y borrar por `service_role` |
| F0.13 *Send Email Hook* auto-hospedado | ⬜ | ⬜ pendiente |
| F0.1, F0.2, F0.5, F0.8, F0.10 | — sin equivalente local | ⬜ pendiente |

**Lo que hay que recordar de este cruce.** Los tres caminos de email —alta,
reenvío y recuperación— **funcionaban en local y llegaron rotos a
producción**, todos por lo mismo: el endpoint `/resend` de GoTrue descarta el
`code_challenge` de PKCE. En local no se veía porque nunca se hizo clic en un
enlace de Mailpit. Es el ejemplo más caro hasta ahora de por qué §18.2 dice
que el entorno de verdad es producción. El detalle está en `PROGRESO.md`,
en las decisiones.
