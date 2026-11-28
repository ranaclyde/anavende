/**
 * ESLint antes que Prettier: un `--fix` puede dejar algo fuera de formato, y
 * al revés no pasa. Los Markdown quedan afuera: Prettier reacomodaría las
 * tablas de `PROGRESO.md`.
 */
const configuracion = {
  "*.{ts,tsx,mts,mjs,cjs,js}": [
    "eslint --fix --no-warn-ignored",
    "prettier --write",
  ],
  "*.css": "prettier --write",
};

export default configuracion;
