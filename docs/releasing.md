# Publicar el repositorio y sus releases

## Antes de subir el código por primera vez

1. Crea el repositorio público vacío. Si vas a subir este historial, evita generar
   otro README o LICENSE desde GitHub para no crear historias diferentes.
2. La URL de publicación ya está configurada como `Closelly/aiplc-workflows` en
   README.md, docs/installation.md, install.sh y package.json. Si mantienes un fork,
   actualiza estas direcciones; el instalador de cada release usa su repositorio de build.
3. Revisa LICENSE, THIRD_PARTY_NOTICES.md y el contenido que se va a compartir.
   Ejecuta `bun run check:public` y revisa también `git diff` y `git status`.
4. Sube el código a `main` cuando decidas publicarlo. No subas `dist/`, `release/`,
   claves, `.env`, productos de prueba ni dependencias instaladas.

En GitHub configura descripción y temas, habilita Issues y reportes privados de
seguridad y revisa las opciones de detección de secretos disponibles. Configura
protección de `main` con revisión de PR y los checks de CI. Estos ajustes se hacen
en GitHub; los archivos de este repositorio no los activan por sí solos.

## Construir una release

El workflow Release se activa con un tag `vX.Y.Z`. Comprueba que coincida con
`package.json`, ejecuta los checks en cuatro equipos nativos y construye:

- macOS ARM64 y x64.
- Linux glibc ARM64 y x64.
- Un instalador con el repositorio y versión reales incorporados.
- `VERSION`, `checksums.txt`, `uninstall.sh` y cuatro archivos `.tar.gz`.

Cada paquete incluye ejecutable, metodología, vendor, documentación, licencias y
`BUILD.json`. Las dependencias de desarrollo se instalan solo en el equipo de build.
El runtime está fijado en Bun 1.4.5 y su aviso está en `licenses/bun-LICENSE.md`.
Actualiza ese archivo desde el tag de Bun correspondiente al cambiar la versión.

Antes de crear un tag, mueve los cambios de Unreleased a la versión correspondiente
en CHANGELOG.md y comprueba:

```sh
bun install --frozen-lockfile
bun run check
bun run check:public
bun run build
bun test
```

Cuando decidas preparar la publicación:

```sh
git tag v0.1.0
git push origin v0.1.0
```

El workflow crea una **release en borrador**. Descarga y prueba sus paquetes, revisa
las notas y publica el borrador manualmente. `releases/latest/download/install.sh`
solo queda disponible para usuarios después de publicar una release estable.
No reutilices ni muevas un tag publicado: crea una versión nueva para corregirla.

## Ensayo local sin publicar

```sh
bun run build
bun run release:package --repository Closelly/aiplc-workflows
sh release/install.sh --from "$(pwd)/release" \
  --prefix /ruta/nueva/prueba-aiplc --skills-dir /ruta/nueva/prueba-skills \
  --no-modify-path
```

Esto valida el paquete de tu equipo y su instalación local. No demuestra una
descarga desde GitHub ni la ejecución en las demás plataformas. Los tests del
instalador repiten este recorrido en carpetas temporales y comprueban corrupción,
colisiones, rutas de paquete y desinstalación.
