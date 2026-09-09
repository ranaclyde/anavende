#!/bin/sh
# Arranque del contenedor — TECHNICAL-SPEC §18.2.
#
# Primero migrar, después servir. `exec` reemplaza al shell por el servidor,
# así que Node queda como PID 1 y recibe el SIGTERM de Docker directo: sin
# eso, parar el contenedor termina en un `kill` a los diez segundos y las
# peticiones en curso se cortan a la mitad.
set -e

node scripts/migrar.mjs
exec node server.js
