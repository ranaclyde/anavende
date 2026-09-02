# AnaVende — Estado del desarrollo

Estado tarea por tarea de `sdd/mvp/DEVELOPMENT-PLAN.md`. Los IDs son los del
plan. Se actualiza al cerrar cada tarea, en el mismo commit que la cierra.

Última actualización: 2026-09-02.

**Qué significa cada estado**

| | |
|---|---|
| ✅ | Cumple su «Hecho cuando» y está verificado |
| 🟡 | El código está, falta una verificación o una pieza externa |
| ⬜ | Sin empezar |
| ⛔ | Bloqueada por algo que no depende de mí |

---

## F0 — Infraestructura

**Ninguna tarea de F0 está cerrada.** Lo comprobado contra el stack local de
desarrollo **no cierra una tarea de F0** (`TECHNICAL-SPEC.md` §18.2): el
entorno de verdad es el Supabase auto-hospedado del VPS. El detalle de qué se
probó en local vive en `VERSIONS.md`.

| ID | Tarea | Estado | Nota |
|---|---|---|---|
| F0.1 | Servidores en DonWeb unidos por LAN | ⬜ | |
| F0.2 | Coolify + limpieza de Docker | ⬜ | Postergada por decisión tuya |
| F0.3 | Supabase en el servidor DATA | ⬜ | |
| F0.4 | Cerrar Postgres al mundo | ⬜ | **Compuerta F0** |
| F0.5 | Restringir Studio | ⬜ | |
| F0.6 | `pg_trgm` y `unaccent` | 🟡 | **Compuerta F0.** Verificado en local con `scripts/verificar-esquema.mts`; falta producción |
| F0.7 | Storage: subir, leer, borrar | ⬜ | |
| F0.8 | Latencia real de la LAN | ⬜ | |
| F0.9 | Fijar versiones del stack | 🟡 | Parte de aplicación registrada en `VERSIONS.md`; falta la de infraestructura |
| F0.10 | Backup con restauración de prueba | ⬜ | |
| F0.11 | Resend como SMTP de Supabase | ⬜ | **Compuerta F0. Es la que muerde primero: sin esto no hay registro en producción** |
| F0.12 | Admin API de Auth | 🟡 | Sondeada en local (`scripts/sondear-auth.mts`); tres hallazgos abajo. Falta producción |
| F0.13 | *Send Email Hook* auto-hospedado | ⬜ | Su respuesta define cómo se hace F1.8 |

---

## F1 — Cimientos

| ID | Tarea | Estado | Nota |
|---|---|---|---|
| F1.1 | Proyecto Next.js 16 + estructura | ✅ | Sin `src/`, por decisión tuya. `TECHNICAL-SPEC.md` §4 actualizado |
| F1.2 | Tailwind 4 con los tokens | ✅ | |
| F1.3 | shadcn/ui mapeado a los tokens | ✅ | |
| F1.4 | Drizzle y la conexión a Postgres | ✅ | Contra el stack local. En producción cambia solo `DATABASE_URL` |
| F1.5 | Esquema completo de la base | ✅ | |
| F1.6 | Primera migración y extensiones | ✅ | Cuatro migraciones; la base se crea desde cero de una corrida |
| F1.7 | Supabase Auth: los tres métodos | ⛔ | Email completo y probado. **Google y Facebook necesitan que crees las apps en las consolas de Google y Meta** |
| F1.7b | `user_profiles` y alta con compensación | ✅ | La compensación se probó sola: un fallo real dejó cero identidades huérfanas |
| F1.7c | Resolución de sesión | ✅ | |
| F1.8 | Plantillas de email E1–E4 | ⬜ | **Depende de F0.13**: define si se unifican en React Email o se personalizan las de Supabase |
| F1.9 | Teléfono obligatorio en las tres vías | ✅ | Normaliza a `+549…`; validado en el servidor |
| F1.10 | Envoltorio de Server Actions | ✅ | |
| F1.11 | Módulo de dinero + regla de lint | ✅ | El lint falla ante `parseFloat` sobre un monto |
| F1.12 | `proxy.ts` y guardias por capas | ✅ | Un `customer` en `/admin` recibe 404, verificado en el navegador |
| F1.13 | Encabezado, pie y layout de la tienda | ✅ | |
| F1.14 | Panel con menú lateral y modo oscuro | ✅ | 240px ↔ 64px, persistido |
| F1.15 | Sentry con datos personales filtrados | 🟡 | Configurado y con el filtro escrito. **Sin DSN todavía**: falta ver un error de prueba llegar sin email ni teléfono |
| F1.16 | Dockerfile y despliegue por CI | ⬜ | Postergada por decisión tuya |

---

## Decisiones que cambiaron las especificaciones

Cada una se escribió primero en la especificación y después en el código
(`DEVELOPMENT-PLAN.md` §1.2, regla 1).

| Qué | Dónde quedó | Por qué |
|---|---|---|
| **RF-05 reescrito**: hay que verificar el email *antes* de poder entrar | `FUNCTIONAL-SPEC.md` RF-05, `TECHNICAL-SPEC.md` §13.6 | GoTrue rechaza el ingreso de cualquier identidad sin `email_confirmed_at` mirando la columna, no la configuración. Probado con las dos configuraciones posibles: el requisito original no era implementable |
| **Un bloqueado recibe `user_banned` aunque erre la contraseña** | `TECHNICAL-SPEC.md` §13.5 | Amplía la excepción registrada: no hace falta acertar la contraseña para confirmar que la cuenta existe |
| **Guarda en el CHECK de stock** (`stock_total < 0 OR reserved <= total`) | `TECHNICAL-SPEC.md` §5.4 | Sin la guarda, las dos restricciones juntas implicaban `stock_total >= 0` e imponían en silencio el CHECK que §5.4 decidió no poner, rompiendo RF-24 |
| **Estructura sin `src/`** | `TECHNICAL-SPEC.md` §4 | Decisión tuya sobre el andamiaje |
| **Producción es el entorno de verdad** | `TECHNICAL-SPEC.md` §18.2, `VERSIONS.md` | El stack local es una comodidad de desarrollo. Nada verificado ahí cierra una tarea de F0 |
| **Código de error `INTERNAL`** | `TECHNICAL-SPEC.md` §6.3 | El envoltorio necesitaba un código para lo que no previó |

---

## Qué está esperando algo tuyo

1. **F0.11 — Resend como SMTP.** Sin esto no hay registro en producción, y no
   se descubre hasta que alguien intenta crearse una cuenta. En local no se
   nota porque Mailpit captura todo.
2. **F1.7 — Google y Facebook.** Hay que crear las apps en Google Cloud y en
   Meta for Developers, con `/auth/v1/callback` como URI de retorno. El código
   ya resuelve la vinculación por email verificado; los botones se muestran
   deshabilitados con el motivo al lado.
3. **F0.13 — el *Send Email Hook*.** Su respuesta define cómo se hace F1.8.

---

## Las especificaciones están versionadas

`sdd/` entró al repositorio el 2026-09-02 (commit `bd58808`). Las cuatro
especificaciones y el porqué de cada decisión viajan ahora con el código: el
único punto del proyecto sin red quedó cerrado.
