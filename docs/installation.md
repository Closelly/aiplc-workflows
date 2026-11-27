# Instalación y mantenimiento

## Plataformas

Las releases están preparadas para macOS ARM64/x64 y Linux con glibc ARM64/x64.
WSL utiliza la distribución Linux correspondiente. Windows PowerShell nativo y
Linux musl/Alpine todavía no están soportados. El CI comprobará cada plataforma
antes de preparar sus paquetes; consulta los resultados de cada release.

El instalador requiere una terminal POSIX, curl, tar, un verificador SHA-256, Git y
OpenSSH. Comprueba las herramientas del sistema y explica qué falta. La distribución
nativa incluye Bun: el usuario no necesita instalar Bun ni Node para el flujo básico.
No instala un cliente de Codex ni configura cuentas de IA.

## Instalación normal

El repositorio público es `Closelly/aiplc-workflows`. El comando estará disponible
al publicarse una release con sus paquetes:

```sh
curl -fsSL https://github.com/Closelly/aiplc-workflows/releases/latest/download/install.sh | sh
```

Descarga el paquete para tu equipo, verifica SHA-256 y ejecuta `doctor --core` antes
de activar el programa. Instala en `~/.local/closelly-aiplc`, enlaza las skills en
`~/.agents/skills` y añade una línea a la configuración de tu terminal:

- zsh: `${ZDOTDIR:-$HOME}/.zshrc`.
- bash: `~/.bashrc` y `~/.bash_profile`.
- Otros shells POSIX: `~/.profile`.

Abre una terminal nueva. También puedes cargar el PATH en la actual con:

```sh
. "$HOME/.local/closelly-aiplc/env"
closelly-aiplc version
closelly-aiplc doctor --core
```

Una descarga dañada no se ejecuta. Los checksums se descargan de la misma release;
no son una firma independiente del editor. Lee SECURITY.md para conocer los límites.
El instalador no crea productos, claves ni aprobaciones.

## Revisar el script o elegir una versión

```sh
curl -fsSL https://github.com/Closelly/aiplc-workflows/releases/download/v0.1.0/install.sh -o install.sh
less install.sh
sh install.sh
```

El script adjunto a cada release fija su versión y el repositorio automáticamente.
El script del código fuente acepta `--repo Closelly/aiplc-workflows --version 0.1.0`.

## Opciones

```sh
sh install.sh --prefix /ruta/nueva/aiplc --skills-dir /ruta/skills
sh install.sh --no-modify-path
sh install.sh --no-skills
sh install.sh --help
```

También existen `AIPLC_INSTALL_DIR` y `AIPLC_SKILLS_DIR` para fijar destinos. Usa
rutas absolutas. `--no-modify-path` conserva la configuración de la terminal;
puedes usar la ruta completa del ejecutable o cargar el archivo `env` manualmente.

El instalador conserva las skills que no le pertenecen y falla ante una colisión
de nombres. Si ya instalaste estas skills manualmente, utiliza otra carpeta con
`--skills-dir` o `--no-skills`; no las sobrescribe. Una instalación del antiguo
instalador sin marcador de propiedad necesita otro prefijo para evitar mezclar archivos.

## Actualizar y volver a una versión

Repite el comando de instalación de la última release. Se conserva cada versión
en `versions/` y se cambia el enlace `current`. Las skills administradas apuntan a
la versión activa. Repetir una instalación idéntica no duplica la línea del PATH.
Se rechaza una versión con el mismo número y contenido distinto.

Para volver a una versión, ejecuta el instalador adjunto a esa release. Esto cambia
la herramienta activa; no migra ni altera el snapshot de metodología de un producto
existente. Cada producto conserva la metodología con la que fue creado.

## Instalación sin red y desde código

Descarga `install.sh`, `VERSION`, `checksums.txt` y el `.tar.gz` de tu equipo desde la
misma release. Después ejecuta `sh install.sh --from /ruta/release-descargada`.

Para compilar, consulta CONTRIBUTING.md. Usa Bun 1.4.5 y ejecuta
`sh scripts/install-local.sh --prefix /ruta/nueva/aiplc --no-modify-path`.

## Desinstalar

```sh
sh "$HOME/.local/closelly-aiplc/uninstall.sh"
```

Si elegiste otro prefijo, añade `--prefix /ruta/elegida`. Se eliminan la instalación
y sus enlaces de skills; se conservan productos, claves y skills ajenas. La línea
del shell queda inactiva si falta `env`; puedes retirarla después. Las terminales
ya abiertas pueden conservar su PATH anterior hasta que las cierres.

## Video y diagnóstico completo

`doctor --core` revisa el funcionamiento básico. La película requiere Node 22.12+,
FFmpeg/FFprobe, Chrome, HyperFrames y voz configurada. Estos componentes externos
se preparan por separado según [video.md](video.md). No presentes una instalación
básica como una verificación completa de render o de proveedores remotos.
