# Verificación local del lanzamiento 0.1.0

Comprobaciones realizadas en macOS Apple Silicon con Bun 1.4.5, Git 2.54, Node.js
22.23.2, FFmpeg/FFprobe 9.0.2, Chrome y la CLI oficial HyperFrames 0.9.104.

| Comprobación | Evidencia |
| --- | --- |
| `bun run check` y `bun run build` | Tipos, schemas, definición YAML, Agent Skills y compilación de la CLI. |
| `bun test` | Motor determinista, estructura de `po init`, separación por clave, invalidación de gates tras ediciones, trazabilidad de pruebas y growth, bloqueo sin voz o credencial, actualización de conocimiento e integridad del historial. |
| `AIPLC_TEST_MEDIA=1 bun test` | Render real con voz del sistema y cuatro capítulos, pista de subtítulos, comprobación de cambio entre fotogramas, commit y tag Git, clon DEV, onboarding obligatorio, aclaración firmada por el PO y cierre en READY. Regenera el MP4 desde las fuentes y confirma que la línea base original conserva sus hashes. |
| Instalación aislada | `install.sh` copió el ejecutable y las skills a un prefijo temporal. El binario instalado pasó `doctor --core`, creó un producto independiente y firmó un gate desde una terminal interactiva. |

Para repetir la prueba multimedia, prepara los requisitos y variables de
[la guía de video](video.md) y ejecuta desde una terminal con acceso a Chrome y
al sintetizador de macOS. Usa `AIPLC_TEST_VOICE` para cambiar la voz española
de prueba cuando Paulina no esté disponible.

```sh
bun run check
bun test
AIPLC_TEST_MEDIA=1 bun test
bun run build
```

Las entradas de la prueba integral representan un producto ficticio. El render,
la síntesis, las firmas y las operaciones Git sí son reales. La prueba comprueba
estructura y trazabilidad del contenido, y el PO de un producto real debe validar
las fuentes investigadas, el prototipo, la estrategia y la calidad editorial.
Se verificaron el encargo para Codex y el formato e instalación de las skills.
No se ejecutó un proyecto real de punta a punta en una sesión de inferencia.
Linux, Windows, proveedores TTS externos, publicación remota e identidad de
organización quedan fuera de las verificaciones de este lanzamiento.

## Instalador público y empaquetado

La ampliación del instalador se verificó en macOS ARM64 con Bun 1.4.5:

- `bun run check`: tipos y los 75 archivos de la metodología.
- `bun run check:public`: documentación base, patrones de secretos y rutas personales.
- `bun run build`: ejecutable, metodología, documentación y licencias de ejecución.
- `bun test`: 13 pruebas pasaron y 1 prueba de render multimedia quedó omitida.
- Instalación desde un paquete local sin Bun ni Node en el PATH; creación real de
  un producto aislado y reanudación en Discovery, con cero aprobaciones y sin DEV.
- Reinstalación, rutas con espacios y comillas, preservación de la configuración,
  rechazo de SHA-256 incorrecto, miembros de tar con rutas peligrosas o enlaces,
  colisiones de skills, distribución local y desinstalación conservando datos ajenos.

El ensayo local no acredita descarga pública ni ejecución en otros sistemas. Los
workflows de GitHub comprobarán macOS ARM64/x64 y Linux ARM64/x64 al subir el código
y antes de preparar cada release. Los resultados observados quedan en Actions.
