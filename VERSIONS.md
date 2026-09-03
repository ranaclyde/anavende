# Versiones fijadas del stack

**Este archivo es el parámetro de toda consulta a `context7`**
(`DEVELOPMENT-PLAN.md` §1.2 regla 6, `TECHNICAL-SPEC.md` §2.1).
Se consulta la documentación de *estas* versiones, no de la última publicada.

Registrado el 2026-09-02 — tarea F0.9, parte de aplicación.
Las piezas de infraestructura se completan cuando F0 esté hecha.

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
| PostgreSQL | 15+ | **pendiente F0.3** — en local corre 17.6 (dev) |
| Supabase auto-hospedado | — | **pendiente F0.3** — en local, el stack del CLI (dev) |
| Coolify | — | **pendiente F0.2** |

---

## Verificaciones de F0: qué se comprobó y dónde

Lo comprobado contra el stack local **no cierra una tarea de F0**
(`TECHNICAL-SPEC.md` §18.2). Producción es el entorno de verdad.

| Tarea | Local | Producción |
|---|---|---|
| F0.6 `pg_trgm` y `unaccent` con similitud real | ✅ comprobado | ⬜ pendiente |
| F0.7 Storage: subir, leer, borrar | ⬜ | ⬜ pendiente |
| F0.12 Admin API de Auth | ⬜ | ⬜ pendiente |
| F0.13 *Send Email Hook* auto-hospedado | ⬜ | ⬜ pendiente |
| F0.1 – F0.5, F0.8, F0.10, F0.11 | — sin equivalente local | ⬜ pendiente |

**F0.11 es la que muerde primero.** Sin Resend como SMTP no hay registro
posible en producción, y no se descubre hasta que alguien intenta crearse
una cuenta. En local no se nota: Mailpit captura todo.
