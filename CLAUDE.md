@AGENTS.md

# Cómo escribir React/Next.js en este proyecto

Antes de escribir, revisar o refactorizar componentes de React, páginas de
Next.js, obtención de datos o cualquier cosa que afecte el rendimiento o el
tamaño del bundle, invocar el skill `vercel-react-best-practices` y seguir sus
lineamientos.

# Cómo se trabaja en este repositorio

- **Idioma:** el código va en inglés (nombres de archivos, carpetas,
  variables, funciones, tipos, tablas y columnas); los comentarios, en
  español. La interfaz, los commits y la documentación, en español con
  voseo. Nada de voseo ni de español dentro de los identificadores.
  **Excepción: las rutas y sus parámetros de búsqueda van en español**
  (`/cuenta/direcciones`, `?categoria=`), porque son interfaz: las ve la
  gente y las guardan los buscadores. Es decir, las carpetas de `app/` que
  arman URLs y los nombres de los *query params*.
- **Comentarios:** solo donde el código no se explica solo. El porqué de una
  decisión va en `sdd/`, en `docs/` o en el commit, no repetido en el código.
- **Tests:** donde los piden las especificaciones (`TECHNICAL-SPEC.md` §17,
  las compuertas del plan, accesibilidad) o donde un error sale caro. No un
  test por cada cambio.
- **Dónde está cada cosa:** especificaciones en `sdd/mvp/`; estado tarea por
  tarea en `PROGRESO.md`, que se actualiza en el mismo commit que cierra la
  tarea. Las especificaciones mandan: desviarse es una decisión que se anota.
- **Documentación del sistema:** `docs/` cuenta cómo es hoy (arquitectura,
  recorridos y operación). Si una tarea cambia un recorrido, una pieza o la
  forma de operar, actualiza el documento en el mismo commit; un documento
  nuevo se suma al menú del `README.md`.
- **Flujo:** un push a `main` despliega (Coolify). Nunca push directo: rama,
  PR y merge con *merge commit* (sin squash ni rebase). El merge lo hace el
  usuario.
- **Ramas:** Conventional Branch — `feat/`, `fix/`, `hotfix/`, `chore/` +
  descripción en español sin tildes + ID de tarea si hay (`feat/f3-7-home`).
- **Antes de commitear algo que lea la base:** `DATABASE_URL= npx next build`.
  Coolify compila sin base y `next dev` no lo muestra. El gancho de pre-push
  de Husky lo corre igual, con los tipos; con `--no-verify`, a mano. Los
  tests no van en el gancho: se corren antes de abrir cada PR.
- **Accesibilidad:** lo que toque una pantalla pasa, antes del PR, la lista
  de `DESIGN.md` («Accesibilidad: lo que se revisa en cada tarea») y
  `tests/e2e/accesibilidad.spec.ts`; una página nueva se suma a `PANTALLAS`.
- **Tests:** `npm test` corre contra el Postgres del stack local, nunca contra
  producción, y un archivo por vez.
- **Servidores:** no hay acceso. Lo de adentro lo ejecuta el usuario; se
  verifica desde afuera (`curl`, `dig`).
- **El repositorio es público:** nada de secretos (claves, tokens,
  contraseñas, `.env`) en archivos versionados.
