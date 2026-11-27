# Créditos y componentes de terceros

El código propio de Closelly AI-PLC se distribuye bajo MIT. Las dependencias
conservan sus licencias y avisos; la licencia MIT del proyecto no las sustituye.

## Inspiración

[AWS AI-DLC Workflows](https://github.com/awslabs/aidlc-workflows) es una referencia
para el enfoque de trabajo asistido por agentes y la instalación desde releases.
Su licencia declarada es MIT-0. Closelly es un proyecto independiente, sin
afiliación ni respaldo de AWS u OpenAI. El instalador de Closelly tiene una
implementación propia; no distribuye los runtimes de AI-DLC.

## Dependencias JavaScript

- Ajv 8.17.1: MIT.
- JSZip 3.10.1: se utiliza bajo la opción MIT de su licencia dual MIT/GPLv3.
- PptxGenJS 4.0.1: MIT.
- GSAP 3.13.0: [licencia estándar de GSAP](https://gsap.com/standard-license/),
  con condiciones propias. No se presenta GSAP como software bajo MIT.

El build genera `licenses/javascript/` con los archivos de licencia y avisos de
las dependencias de ejecución, incluidas las transitivas. El archivo minificado de
GSAP conserva su cabecera original. Las herramientas de desarrollo no se incluyen
como dependencias JavaScript en el ejecutable.

## Runtime Bun

Los ejecutables nativos incluyen Bun. Consulta su versión en `BUILD.json` y los
avisos en `licenses/bun-LICENSE.md`. Bun incluye componentes con licencias propias,
entre ellos JavaScriptCore/WebKit. Las fuentes de la aplicación se publican en el
repositorio; las instrucciones de compilación están en CONTRIBUTING.md y las de
reconstrucción del runtime se enlazan en el aviso de Bun.

## Herramientas externas

Git, OpenSSH, Codex, Chrome/Chromium, FFmpeg, HyperFrames y los proveedores de voz
se instalan y ejecutan por separado, bajo sus términos. El instalador no los
redistribuye. El acceso a servicios externos depende de la cuenta y permisos del
usuario.
