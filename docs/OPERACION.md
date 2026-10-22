# Operación

Cómo se despliega AnaVende, qué corre solo, dónde se configura cada cosa y
qué mirar cuando algo falla. Las piezas están descritas en
[Arquitectura](ARQUITECTURA.md); las versiones exactas, en
[VERSIONS.md](../VERSIONS.md).

**Ningún valor secreto va en este documento ni en ningún otro archivo del
repositorio, que es público.** Acá están los nombres de las variables y dónde
se cargan; los valores viven en Coolify y en el servidor de datos.

## Desplegar

1. Rama, PR y merge a `main` con _merge commit_. Nunca un push directo.
2. El push a `main` llega a Coolify por webhook, y Coolify construye la
   imagen con el `Dockerfile` **en el servidor APP**. No hay CI.
3. Al arrancar, el contenedor corre `scripts/migrar.mjs` y después levanta
   Next (`docker-entrypoint.sh`). Si una migración falla, el contenedor nuevo
   no arranca.
4. Docker da el contenedor por sano cuando `/api/salud` contesta 200
   (`scripts/salud.mjs`).

**No todo push despliega.** Las _Watch Paths_ de Coolify, que se configuran
en el panel de la aplicación y no en el repositorio, dejan afuera lo que no
entra en la imagen: los `.md`, `sdd/`, `tests/`, `supabase/`, los scripts
`.mts` y los `.env*.example`. Un push que solo toca documentación no
reconstruye nada. El botón _Deploy_ de Coolify no pasa por ese filtro.

**Antes del merge**, si el cambio lee la base:

```sh
DATABASE_URL= npx next build
```

La compilación de producción no tiene base, y `next dev` no muestra ese
error.

**Lo que sostiene la compilación en el servidor**, y no se quita: el swap del
servidor APP y Coolify configurado con **una construcción simultánea**. Dos
construcciones seguidas o una sin swap ya lo dejaron trabado.

## Migraciones

1. Cambiar el esquema en `db/schema/`.
2. `npm run db:generate` escribe la migración en `db/migrations/`. Se lee el
   SQL antes de commitearlo.
3. En local, `npm run db:migrate` la aplica y `npm run db:verificar` revisa
   que la base quedó como el esquema dice.
4. En producción se aplica sola al desplegar.

Hay un solo entorno, así que una migración no tiene dónde ensayarse antes de
producción. Por eso **toda migración es compatible hacia atrás**: primero se
agrega, se despliega, y recién en otro cambio se borra lo viejo (TS §18.2).

## Variables de entorno

La plantilla es [`.env.example`](../.env.example), con un comentario por
variable. Las que llevan `NEXT_PUBLIC_` terminan en el código del navegador:
nunca un secreto con ese prefijo.

| Variable                                                           | Para qué                                                                                                 | Dónde se carga                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`                                                     | Postgres, por la red privada                                                                             | Coolify, ejecución                                   |
| `SUPABASE_SERVICE_ROLE_KEY`                                        | Admin API de Auth y escritura en Storage                                                                 | Coolify, ejecución                                   |
| `SUPABASE_STORAGE_BUCKET`                                          | El bucket de las fotos                                                                                   | Coolify, ejecución                                   |
| `SUPABASE_CLAVE_CLIENTE_IP`                                        | La clave que comparte la tienda con el nginx del servidor de datos, para que GoTrue limite por comprador | Coolify, ejecución, y el nginx del servidor de datos |
| `RESEND_API_KEY`, `RESEND_FROM`                                    | El aviso de nueva orden (E4)                                                                             | Coolify, ejecución                                   |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth desde la tienda                                                                                     | Coolify, **construcción**                            |
| `NEXT_PUBLIC_SITE_URL`                                             | Enlaces absolutos en emails y metadatos                                                                  | Coolify, **construcción**                            |
| `NEXT_PUBLIC_SENTRY_DSN`                                           | Adónde van los errores                                                                                   | Coolify, **construcción**                            |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`                                   | El widget de Turnstile                                                                                   | Coolify, **construcción**                            |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`                | Subir los _source maps_ al construir                                                                     | Coolify, **construcción**                            |

**Las de construcción quedan escritas en la imagen.** Cambiar una exige
volver a desplegar; cambiarla en Coolify sin reconstruir no hace nada.

**Lo que no es una variable de la tienda:**

- El secreto de Turnstile, las credenciales SMTP de Resend y los límites de
  intentos son de **GoTrue**, y se cargan en el entorno del _docker compose_
  de Supabase, en el servidor de datos.
- El número de WhatsApp, el email que recibe los avisos y el modo
  mantenimiento viven en la base (`site_settings`), igual que los medios de
  pago (`payment_methods`). Ana los cambia desde el panel sin desplegar.

## Lo que corre solo

| Qué                                                 | Cuándo                    | Dónde                                                                                                |
| --------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Migraciones                                         | Al arrancar el contenedor | `scripts/migrar.mjs`                                                                                 |
| Healthcheck                                         | Cada 30 segundos          | `scripts/salud.mjs` → `/api/salud`                                                                   |
| Borrar las cuentas sin confirmar de más de 48 horas | Cada hora (`0 * * * *`)   | Tarea programada de Coolify, `node scripts/limpiar-cuentas.mjs`, adentro del contenedor de la tienda |

La limpieza sale con código 1 si no puede conectarse o falla la consulta, así
que en Coolify «Success» quiere decir que corrió de verdad.

## Tareas frecuentes

**Cambiar una plantilla de email de la cuenta** (confirmación, recuperación,
invitación, reenvío): se edita en `lib/email/plantillas/`, se corre
`npm run email` y se commitea el HTML que queda en `public/emails/`. GoTrue
descarga las plantillas de la tienda por URL, así que llegan con el
despliegue. En local se ven en Mailpit (<http://localhost:54324>).

**Cerrar la tienda al público**: «Configuración» → modo mantenimiento. El
público ve una página con un 503 y quien administra ve la tienda normal.
`/api/salud` sigue contestando.

**Sumar una administradora**: desde el panel, «Usuarios» → nuevo, que manda
una invitación por email. A mano, desde Studio:

```sql
UPDATE user_profiles SET role = 'admin', updated_at = now()
 WHERE email = '…' RETURNING id, email, role;
```

El `RETURNING` sirve para saber si encontró la fila: sin él, un `WHERE` que
no encuentra a nadie también dice «Success».

**Actualizar una dependencia o una imagen del stack**: es un cambio de
producción, no un mantenimiento. Va en su propio PR y se anota en
`VERSIONS.md`.

## Cuando algo falla

Lo primero es mirar desde afuera:

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://anavende.com.ar/api/salud
```

| Qué se ve                           | Dónde mirar                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `/api/salud` no contesta 200        | Los logs del contenedor en Coolify. Si se cortan en la migración, falló `migrar.mjs` y el error está ahí                            |
| El despliegue no termina            | Los logs de construcción en Coolify. Un corte sin error suele ser falta de memoria: revisar que no haya dos construcciones a la vez |
| Una pantalla da error               | Sentry. Los errores de negocio, como «sin stock», no van ahí: llegan al usuario como un mensaje                                     |
| No llegan los emails de la cuenta   | Los logs de GoTrue en el servidor de datos, y el panel de Resend                                                                    |
| No llega el aviso de orden (E4)     | Sentry: un envío fallido se registra ahí y la orden queda igual                                                                     |
| No se puede ingresar ni registrarse | Turnstile y los límites de GoTrue. Un `429` es el límite de intentos                                                                |
| Las fotos no cargan                 | Storage, en el servidor de datos. Las fotos no pasan por la tienda                                                                  |

Lo de adentro de los servidores, como los logs del _compose_ o la
configuración de nginx, lo ejecuta quien tiene acceso. Lo que está hecho en
cada servidor, y cómo, está anotado tarea por tarea en
[PROGRESO.md](../PROGRESO.md).
