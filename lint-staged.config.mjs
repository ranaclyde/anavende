/**
 * Lo que corre el gancho de pre-commit (`.husky/pre-commit`), y solo sobre los
 * archivos que entran en el commit: tiene que tardar segundos, o se vuelve una
 * molestia en cada commit y se termina salteando.
 *
 * ESLint primero y Prettier después, porque un `--fix` puede dejar algo fuera
 * de formato y al revés no pasa. `--no-warn-ignored`: a un archivo que ESLint
 * ignora a propósito no le corresponde ni un aviso. lint-staged vuelve a
 * agregar al commit lo que estos comandos corrijan.
 *
 * Los Markdown quedan afuera, igual que en `npm run format`: Prettier
 * reacomodaría las tablas de `PROGRESO.md`.
 */
const configuracion = {
  "*.{ts,tsx,mts,mjs,cjs,js}": [
    "eslint --fix --no-warn-ignored",
    "prettier --write",
  ],
  "*.css": "prettier --write",
};

export default configuracion;
