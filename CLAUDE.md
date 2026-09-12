@AGENTS.md

# Cómo escribir React/Next.js en este proyecto

Antes de escribir, revisar o refactorizar componentes de React, páginas de
Next.js, obtención de datos o cualquier cosa que afecte el rendimiento o el
tamaño del bundle, invocar el skill `vercel-react-best-practices` y seguir sus
lineamientos.

# Cómo se trabaja en este repositorio

- **Idioma:** español con voseo en código, commits, documentación e interfaz.
- **Dónde está cada cosa:** especificaciones en `sdd/mvp/`; estado tarea por
  tarea en `PROGRESO.md`, que se actualiza en el mismo commit que cierra la
  tarea. Las especificaciones mandan: desviarse es una decisión que se anota.
- **Flujo:** un push a `main` despliega (Coolify). Nunca push directo: rama,
  PR y merge con *merge commit* (sin squash ni rebase). El merge lo hace el
  usuario.
- **Ramas:** Conventional Branch — `feat/`, `fix/`, `hotfix/`, `chore/` +
  descripción en español sin tildes + ID de tarea si hay (`feat/f3-7-home`).
- **Antes de commitear algo que lea la base:** `DATABASE_URL= npx next build`.
  Coolify compila sin base y `next dev` no lo muestra.
- **Tests:** `npm test` corre contra el Postgres del stack local, nunca contra
  producción, y un archivo por vez.
- **Servidores:** no hay acceso. Lo de adentro lo ejecuta el usuario; se
  verifica desde afuera (`curl`, `dig`).
- **El repositorio es público:** nada de secretos (claves, tokens,
  contraseñas, `.env`) en archivos versionados.
