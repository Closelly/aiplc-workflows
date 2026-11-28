# Preparar y publicar una release

## Recorrido habitual

1. Incluye en el cambio una versión nueva en `package.json`, por ejemplo `0.1.2`.
   Debe ser mayor que la última versión pública y usar el formato `X.Y.Z`.
2. Añade sus cambios a una sección `## 0.1.2 — AAAA-MM-DD` de CHANGELOG.md.
3. Integra el cambio en `main`.
4. GitHub ejecuta las pruebas en macOS y Linux, ARM64 y x64, construye los paquetes,
   crea el tag en el commit comprobado y prepara una **release en borrador**.
5. Entra a [Releases](https://github.com/Closelly/aiplc-workflows/releases), revisa
   las notas y los archivos y pulsa **Publish release** cuando decidas publicarla.

No necesitas crear tags ni adjuntar archivos a mano. La última acción —publicar—
la hace la persona responsable. Hasta entonces, el comando de instalación de
`releases/latest/download/install.sh` sigue descargando la versión pública anterior.

Los cambios en `main` que mantienen una versión ya publicada no preparan otra
release. Si esa versión ya tiene un borrador de otro commit, también se conserva:
para incluir más cambios en una release nueva, aumenta el número de versión.
Un borrador ya publicado nunca se sobrescribe y un tag existente nunca se mueve.
El tag también permite reconocer una versión preparada cuando GitHub oculta su
borrador al proceso de solo lectura: un cambio posterior con la misma versión
omite la preparación y conserva ese tag.

## Qué prepara GitHub

El workflow Release detecta la versión de `package.json` al recibir un push a
`main`, incluidos los merges de pull requests. Si corresponde una versión nueva:

- Ejecuta CI en cuatro equipos nativos.
- Construye macOS ARM64/x64 y Linux glibc ARM64/x64.
- Genera `install.sh` con el repositorio y la versión incorporados.
- Adjunta cuatro `.tar.gz`, `uninstall.sh`, `VERSION` y `checksums.txt` al borrador.
- Usa como notas la sección de esa versión en CHANGELOG.md.

Cada paquete incluye ejecutable, metodología, vendor, documentación, licencias y
`BUILD.json`. El runtime está fijado en Bun 1.4.5. Actualiza
`licenses/bun-LICENSE.md` al cambiar esa versión. Solo el trabajo que prepara el tag
y el borrador recibe permisos de escritura; las comprobaciones y la compilación
usan permisos de lectura.

## Fallos y reintentos

Revisa el workflow **Release** en Actions. Si falla una prueba, corrige el problema
antes de preparar el borrador. Si fue un problema temporal, usa **Re-run failed jobs**.
También puedes ejecutar **Run workflow** sobre `main` para volver a intentarlo.

Se puede completar un borrador fallido si su tag apunta al mismo commit que se
está comprobando. Los errores de conexión o permisos de GitHub se muestran como
fallos; no se interpretan como que la release no existe. Si cambias el contenido
tras haber preparado un borrador, usa una versión nueva para ese contenido.

El workflow solo prepara borradores desde `main`. Ejecutarlo manualmente sobre
otra rama no publica ni prepara una versión.

## Comprobaciones antes del merge

```sh
bun install --frozen-lockfile
bun run check
bun run check:public
bun run build
bun test
```

El CI omite la prueba de render multimedia salvo que se habilite expresamente.
No es necesario preparar el entorno multimedia para una release del motor básico.

## Ensayo local sin publicar

```sh
bun run build
bun run release:package --repository Closelly/aiplc-workflows
sh release/install.sh --from "$(pwd)/release" \
  --prefix /ruta/nueva/prueba-aiplc --skills-dir /ruta/nueva/prueba-skills \
  --no-modify-path
```

Esto verifica el paquete de tu equipo y su instalación local. No crea una release
ni demuestra una descarga pública. Los tests usan carpetas y claves temporales y
no modifican tu instalación personal.

## Configuración del repositorio

La URL de publicación está configurada como `Closelly/aiplc-workflows`. En un fork,
actualiza README.md, docs/installation.md, install.sh y package.json; el instalador
adjunto a cada release utiliza su repositorio de build.

Mantén habilitados los reportes privados de seguridad y revisa las opciones de
detección de secretos. Las protecciones de `main` y sus revisiones se configuran en
GitHub. Los archivos del proyecto no activan esas protecciones por sí solos.
