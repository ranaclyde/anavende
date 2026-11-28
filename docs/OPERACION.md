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
error. Desde el 2026-11-18 lo corre el gancho de pre-push de Husky, junto con
los tipos (README, «Scripts»).

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

**Toda tabla nueva lleva `.enableRLS()`** en su `pgTable`. Sin políticas, es
un cerrojo: la tienda no lo nota y la API de Supabase no ve nada (TS §13.8).
`tests/unit/seguridad/roles-de-la-api.test.ts` falla si alguna lo olvida.

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
- **El ingreso con Google** también: el ID y el secreto van en el `.env` del
  stack (`GOOGLE_CLIENT_ID`, `GOOGLE_SECRET`) y las cuatro
  `GOTRUE_EXTERNAL_GOOGLE_*` en `docker-compose.override.yml`. La tienda no
  guarda ninguna lista: le pregunta a GoTrue qué proveedores tiene prendidos
  (`modules/users/proveedores.ts`, recordado cinco minutos), así que prender o
  apagar uno allá alcanza. El proyecto de Google Cloud es de la cuenta
  `admin@anavende.com.ar`, y tiene que tener prendida la **API de People**
  (Google Cloud → APIs y servicios → Biblioteca): con ella se sabe si la foto
  de Google es una elegida o la inicial genérica, y se traen el nombre y el
  apellido por separado. Apagada, el ingreso anda igual, las cuentas nuevas
  salen con su blobatar y el nombre se parte en el primer espacio.
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

**Después de un corte, la tienda vuelve sola.** Si el contenedor termina con
error —por ejemplo, porque el servidor se quedó sin red—, Docker lo vuelve a
arrancar con una espera que crece hasta un intento por minuto. Coolify lo deja
de intentar al llegar a su **Max Restart Count**, que en la app está en
**120** (_Configuration → Advanced_): unas dos horas de corte. Con el valor que
trae, 10, se rendía a los dos minutos y la tienda quedaba _Exited_ hasta un
Deploy a mano, que es lo que pasó el 2026-11-16. No está en 0 —sin límite— a
propósito: con límite, si el corte dura más, llega un aviso.

**Los avisos de Coolify llegan por email**, por Resend, desde
`avisos@anavende.com.ar` y con su propia API key (`coolify-avisos`, solo
envío), separada de la de Supabase y de la de la tienda. Van al email del
usuario de Coolify y se configuran en _Notifications → Email_ del equipo.
Están prendidos solo los de falla: _Restart limit reached_, _Deployment
failure_, _Backup failure_, _Scheduled task failure_ y los del servidor
(_Server unreachable_, disco, limpieza de Docker, parches, Traefik).

## Tareas frecuentes

**Entrar a los servidores**: desde internet, solo con llave (F0.15). La
contraseña de `root` sigue andando únicamente desde las IPs de soporte de
DonWeb, que fija su propio archivo
(`/etc/ssh/sshd_config.d/00-0-trusted-ca.conf`: no se toca). Lo nuestro está
en `/etc/ssh/sshd_config.d/50-solo-llave.conf`, en los dos servidores. La
llave es `~/.ssh/id_ed25519_anavende`, sin passphrase: perderla no deja la
tienda sin andar, pero sí a vos sin SSH, y se recupera desde la consola VNC
del panel de DonWeb cargando una llave nueva.

```bash
ssh -i ~/.ssh/id_ed25519_anavende -p 5400 root@149.34.225.79   # DATA
ssh -i ~/.ssh/id_ed25519_anavende -p 5057 root@149.34.225.107  # APP
```

Coolify entra al APP por el 22 desde adentro, con su propia llave (_Servers
→ localhost → Private Key_), así que no depende de esto.

**Entrar a Studio**: no está publicado en internet. Se abre un túnel SSH al
servidor DATA, que escucha SSH en el 5400, y se deja la terminal abierta:

```bash
ssh -i ~/.ssh/id_ed25519_anavende -N -p 5400 -L 8000:localhost:8000 root@149.34.225.79
```

y se entra a <http://localhost:8000> con el usuario y la contraseña del
dashboard. Ctrl+C cierra el túnel.

**Cambiar una plantilla de email de la cuenta** (confirmación, recuperación,
invitación, reenvío): se edita en `lib/email/templates/`, se corre
`npm run email` y se commitea el HTML que queda en `public/emails/`. GoTrue
descarga las plantillas de la tienda por URL, así que llegan con el
despliegue. En local se ven en Mailpit (<http://localhost:54324>).

**Desplegar con el panel abierto**: no rompe nada, pero lo que se esté
cargando en ese momento no se puede guardar hasta recargar. El panel lo avisa
solo («Se actualizó AnaVende», con «Recargar»), y lo escrito en un producto se
recupera al recargar; en los demás formularios se pierde. Si se puede, mergear
cuando nadie está cargando en el panel.

**Cerrar la tienda al público**: «Configuración» → modo mantenimiento. El
público ve una página con un 503 y quien administra ve la tienda normal.
`/api/salud` sigue contestando.

**Apagar una fecha especial** (Pascua, Halloween, Navidad): «Configuración» →
«Fechas especiales», destildarla y «Guardar cambios». El logo pierde el
adorno en el próximo pedido.

**Sumar una fecha especial**: es código, no panel. Lleva su período en
`lib/scenes.ts`, su adorno en `components/shop/adorno-de-temporada.tsx` y
su interruptor en `site_settings`.

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
| Los emails llegan a spam            | Los reportes de DMARC en Cloudflare (_Email → DMARC Management_): ahí se ve si los envíos de Resend fallan la firma                 |
| No llega el aviso de orden (E4)     | Sentry: un envío fallido se registra ahí y la orden queda igual                                                                     |
| No se puede ingresar ni registrarse | Turnstile y los límites de GoTrue. Un `429` es el límite de intentos                                                                |
| Las fotos no cargan                 | Storage, en el servidor de datos. Las fotos no pasan por la tienda                                                                  |
| El servidor no se ve desde afuera   | Primero https://status.donweb.com: un corte del nodo es de DonWeb y no se arregla desde adentro. Si no figura, ticket a DonWeb      |
| Llegó «Restart limit reached»       | Coolify agotó los reintentos y la tienda quedó _Exited_. Si el servidor ya tiene red, un Deploy a mano la levanta                   |

**Si el servidor se reinició, el _journal_ no sirve**: no sobrevive al
reinicio. `/var/log/syslog` sí, y ahí se ve qué hizo Docker con el contenedor.

Lo de adentro de los servidores, como los logs del _compose_ o la
configuración de nginx, lo ejecuta quien tiene acceso. Lo que está hecho en
cada servidor, y cómo, está anotado tarea por tarea en
[PROGRESO.md](../PROGRESO.md).
