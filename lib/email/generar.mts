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
 *
 * Para mirar cómo quedan, abrir los archivos de `public/emails/` en el
 * navegador. Los `{{ .Algo }}` se ven literales a propósito: es exactamente lo
 * que recibe GoTrue antes de sustituir.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { render } from "react-email";

import { Verificacion } from "@/lib/email/plantillas/verificacion";

/**
 * El enlace de E1 y E2 (TECHNICAL-SPEC §14).
 *
 * `{{ .RedirectTo }}` es el `emailRedirectTo` que manda la aplicación, o sea
 * `…/api/auth/confirmar?next=…`; ya trae `?`, por eso se sigue con `&`.
 * `{{ .TokenHash }}` es el token que `verifyOtp` sabe canjear en el servidor.
 *
 * Es el camino que Supabase documenta para aplicaciones que renderizan en el
 * servidor. El otro —`{{ .ConfirmationURL }}`, que pasa por
 * `/auth/v1/verify`— devuelve la sesión en el fragmento de la URL, que nunca
 * llega al servidor.
 */
const enlaceDeConfirmacion = (tipo: string) =>
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=${tipo}`;

/**
 * Lo que va después de «¡Hola» — o nada, si no hay nombre.
 *
 * `{{ .Data }}` es `auth.users.user_metadata`, donde `registrar` guarda
 * `first_name`. Los dos `if` anidados no son adorno: en Go, pedirle un campo a
 * un `.Data` nulo revienta la plantilla entera, y un email de verificación que
 * no sale es una cuenta que no se puede crear. El de afuera comprueba que haya
 * metadatos; el de adentro, que haya nombre.
 *
 * Los altas por invitación (E3, RF-26) todavía no cargan `first_name`: van a
 * caer en «¡Hola!», que es exactamente para lo que está la condición.
 */
const SALUDO = "{{ if .Data }}{{ if .Data.first_name }}, {{ .Data.first_name }}{{ end }}{{ end }}";

// `createElement` en vez de JSX porque este archivo es `.mts`, como el resto
// de los scripts, y esa extensión no habilita JSX.
/** Valores de mentira para la previsualización: un `token_hash` con la forma y
 *  el largo de uno real, para que el enlace ocupe lo que va a ocupar. */
const SITIO_DE_PRUEBA = "http://localhost:3000";
const enlaceDePrueba = (tipo: string) =>
  `${SITIO_DE_PRUEBA}/api/auth/confirmar?next=%2Fmi-cuenta` +
  `&token_hash=a560326d775928e2e20ef765fe112f95113dbb0522345fd203be5a04&type=${tipo}`;

const PLANTILLAS = [
  {
    archivo: "verificacion.html",
    plantilla: Verificacion,
    tipo: "signup",
  },
];

const destino = new URL("../../public/emails/", import.meta.url);
const destinoVistaPrevia = new URL("vista-previa/", destino);
await mkdir(destinoVistaPrevia, { recursive: true });

for (const { archivo, plantilla, tipo } of PLANTILLAS) {
  // La de verdad, con las variables de Go. `pretty` NO: el formateador parte
  // las expresiones al ajustar líneas —vimos `{{ .TokenHash` y `}}` en
  // renglones distintos— y el enlace de confirmación es lo único que este
  // email tiene que hacer bien. Lo que se revisa es el `.tsx`, no la salida.
  const html = await render(
    createElement(plantilla, {
      sitio: "{{ .SiteURL }}",
      enlace: enlaceDeConfirmacion(tipo),
      saludo: SALUDO,
    }),
  );
  await writeFile(new URL(archivo, destino), html, "utf8");

  // La de mirar, con valores reales para que cargue el logo y el enlace se vea
  // como se va a ver. No se commitea: es andamiaje.
  const vistaPrevia = await render(
    createElement(plantilla, {
      sitio: SITIO_DE_PRUEBA,
      enlace: enlaceDePrueba(tipo),
      saludo: ", Matías",
    }),
    { pretty: true },
  );
  await writeFile(new URL(archivo, destinoVistaPrevia), vistaPrevia, "utf8");

  console.log(`✅ public/emails/${archivo}`);
}

console.log(
  `\nPara mirarlos, con \`npm run dev\` levantado:\n` +
    PLANTILLAS.map(
      (p) => `   ${SITIO_DE_PRUEBA}/emails/vista-previa/${p.archivo}`,
    ).join("\n"),
);
