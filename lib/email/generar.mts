/**
 * Convierte las plantillas de React Email en el HTML que consume GoTrue.
 * TECHNICAL-SPEC §14; tarea F1.8.
 *
 * **Por qué existe este paso.** GoTrue no entiende React: pide las plantillas
 * **por HTTP** contra `SITE_URL` —comprobado en el VPS, no lee archivos— y
 * espera HTML con sus variables Go adentro. Así que la salida va a `public/`,
 * que es lo que el servidor de la aplicación sirve, y de ahí las levanta.
 *
 * **El HTML generado SE COMMITEA.** No es un artefacto intermedio: es lo que
 * se despliega y lo que Supabase descarga. Se regenera con `npm run email` y
 * el diff tiene que revisarse como cualquier otro.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { render } from "react-email";

import { Invitacion } from "@/lib/email/plantillas/invitacion";
import { Recuperacion } from "@/lib/email/plantillas/recuperacion";
import { Verificacion } from "@/lib/email/plantillas/verificacion";

const RUTA = "/api/auth/confirmar";

/**
 * El enlace de E1 y E2.
 *
 * `{{ .RedirectTo }}` es el `emailRedirectTo` que manda la aplicación —o sea
 * `…/api/auth/confirmar?next=…`—; ya trae `?`, por eso se sigue con `&`.
 * `{{ .TokenHash }}` es el token que `verifyOtp` sabe canjear en el servidor.
 *
 * Es el camino que Supabase documenta para aplicaciones que renderizan en el
 * servidor. El otro —`{{ .ConfirmationURL }}`, que pasa por
 * `/auth/v1/verify`— devuelve la sesión en el fragmento de la URL, que nunca
 * llega al servidor.
 */
const desdeElDestino = (tipo: string) =>
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=${tipo}`;

/**
 * El enlace de E3, armado desde `{{ .SiteURL }}` en vez del destino.
 *
 * Quien invita es una pantalla del panel que todavía no existe (RF-26). Si el
 * día que se escriba nadie pasa `redirectTo`, `{{ .RedirectTo }}` sale vacío y
 * el enlace queda roto. Armarlo acá lo hace imposible de olvidar.
 */
const desdeElSitio = (tipo: string, destino: string) =>
  `{{ .SiteURL }}${RUTA}?next=${encodeURIComponent(destino)}` +
  `&token_hash={{ .TokenHash }}&type=${tipo}`;

/**
 * Lo que va después de «¡Hola» — o nada, si no hay nombre.
 *
 * `{{ .Data }}` es `auth.users.user_metadata`, donde `registrar` guarda
 * `first_name`. Los dos `if` anidados no son adorno: en Go, pedirle un campo a
 * un `.Data` nulo revienta la plantilla entera, y un email de verificación que
 * no sale es una cuenta que no se puede crear. El de afuera comprueba que haya
 * metadatos; el de adentro, que haya nombre.
 *
 * Las altas por invitación (E3, RF-26) todavía no cargan `first_name`: van a
 * caer en «¡Hola!», que es exactamente para lo que está la condición.
 */
const SALUDO =
  "{{ if .Data }}{{ if .Data.first_name }}, {{ .Data.first_name }}{{ end }}{{ end }}";

/** Valores de mentira para la previsualización: un `token_hash` con la forma y
 *  el largo de uno real, para que el enlace ocupe lo que va a ocupar. */
const SITIO_DE_PRUEBA = "http://localhost:3000";
const enlaceDePrueba = (tipo: string, destino: string) =>
  `${SITIO_DE_PRUEBA}${RUTA}?next=${encodeURIComponent(destino)}` +
  `&token_hash=a560326d775928e2e20ef765fe112f95113dbb0522345fd203be5a04&type=${tipo}`;

const NUEVA_CONTRASENA = "/recuperar/nueva-contrasena";

const PLANTILLAS = [
  {
    archivo: "verificacion.html",
    plantilla: Verificacion,
    enlace: desdeElDestino("signup"),
    enlaceDePrueba: enlaceDePrueba("signup", "/mi-cuenta"),
  },
  {
    archivo: "recuperacion.html",
    plantilla: Recuperacion,
    enlace: desdeElDestino("recovery"),
    enlaceDePrueba: enlaceDePrueba("recovery", NUEVA_CONTRASENA),
  },
  {
    archivo: "invitacion.html",
    plantilla: Invitacion,
    enlace: desdeElSitio("invite", NUEVA_CONTRASENA),
    enlaceDePrueba: enlaceDePrueba("invite", NUEVA_CONTRASENA),
  },
];

const destino = new URL("../../public/emails/", import.meta.url);
const destinoVistaPrevia = new URL("vista-previa/", destino);
await mkdir(destinoVistaPrevia, { recursive: true });

for (const p of PLANTILLAS) {
  // La de verdad, con las variables de Go. `pretty` NO: el formateador parte
  // las expresiones al ajustar líneas —vimos `{{ .TokenHash` y `}}` en
  // renglones distintos— y el enlace es lo único que estos emails tienen que
  // hacer bien. Lo que se revisa es el `.tsx`, no la salida.
  const html = await render(
    createElement(p.plantilla, {
      sitio: "{{ .SiteURL }}",
      enlace: p.enlace,
      saludo: SALUDO,
    }),
  );
  await writeFile(new URL(p.archivo, destino), html, "utf8");

  // La de mirar, con valores reales para que cargue el logo y el enlace se vea
  // como se va a ver. No se commitea: es andamiaje.
  const vistaPrevia = await render(
    createElement(p.plantilla, {
      sitio: SITIO_DE_PRUEBA,
      enlace: p.enlaceDePrueba,
      saludo: ", Matías",
    }),
    { pretty: true },
  );
  await writeFile(new URL(p.archivo, destinoVistaPrevia), vistaPrevia, "utf8");

  console.log(`✅ public/emails/${p.archivo}`);
}

console.log(
  `\nPara mirarlos, con \`npm run dev\` levantado:\n` +
    PLANTILLAS.map(
      (p) => `   ${SITIO_DE_PRUEBA}/emails/vista-previa/${p.archivo}`,
    ).join("\n"),
);
