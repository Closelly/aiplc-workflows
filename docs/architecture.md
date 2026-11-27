# Motor, roles y recuperación

`workflows/po.yaml` y `workflows/dev.yaml` declaran orden, gates, colaboradores,
artefactos y reglas de cada fase. `src/engine.ts` aplica transiciones deterministas.
Los adaptadores de `src/harness.ts` traducen el estado a un encargo portable.
Los agentes Markdown y las Agent Skills orientan investigación y producción.
La CLI hace verificaciones de forma, trazabilidad y archivos. La evidencia real,
la calidad editorial y las decisiones de negocio se revisan con personas.

El estado serializa la posición, los eventos, las aprobaciones y los artefactos
completos. El repositorio del producto conserva los workflows y sus schemas; la CLI
comprueba su huella antes de usarlos. Una revisión PO vuelve a la primera fase
afectada e invalida las transiciones y aprobaciones posteriores. La confianza en una
aprobación depende de la clave de rol, la custodia del operador y el digest firmado.

## Archivo histórico y documentación viva

- `docs/aiplc/state.json` y `artifact-manifest.json` registran el progreso PO.
- `docs/aiplc/09-handoff/handoff-manifest.json` enumera archivos históricos, tamaños
  y SHA-256. Se excluye a sí mismo para evitar una referencia circular.
- El handoff incluye `AGENTS.md` y `docs/` en el commit y crea un tag anotado
  `aiplc-baseline-v1`. El DEV verifica el árbol del tag, el manifest, los hashes,
  el estado PO y la pertenencia del tag a la historia de su rama.
- El DEV escribe `docs/technical/aiplc/state.json`. Las respuestas PO a aclaraciones
  se guardan allí con firma sin reabrir el workflow histórico.
- Business describe alcance, reglas, segmento y estrategia vigentes. Technical
  distingue diseño y arquitectura instalada, fuente, datos, servicios, nombres de
  variables y pruebas. Operations crece al confirmarse rutinas con persona, motivo,
  frecuencia y resultado.

## Control local

`po init` inscribe dos claves públicas SSH Ed25519 diferentes. Cada mutación valida
la prueba de posesión de la clave de su rol. Cada gate guarda una firma sobre
el proyecto, identidad, propósito, nota y digest. El comando interactivo muestra
un reto para que el responsable confirme que revisó el resultado. El repositorio
copia las claves públicas y jamás necesita copiar la privada.

El control local evita mezclar identidades durante el uso ordinario. No impone
permisos de archivos ni certifica identidad organizacional, presencia humana o
tiempo de reproducción. El propietario del equipo o un actor con acceso a todas
las claves y al repositorio puede cambiar los controles. El tag local tampoco
identifica al emisor por sí solo. Compartirlo con un digest por un canal confiable
o aplicar políticas de repositorio, revisión y firma externa queda a cargo del equipo.
El motor no administra cuentas, repositorios remotos ni servicios de productos.

## Bloqueos y reintentos

- Si faltan archivos o un servicio, el comando termina con código 2 y el motivo.
  Los borradores se pueden completar en el mismo repositorio. Los errores inesperados
  devuelven código 1.
- Si faltan aprobaciones después de preparar la película, lee `AWAITING_REVIEW`, revisa
  y firma. El PO conserva el control y el DEV sigue bloqueado.
- Si falta Git author, el índice tiene cambios staged o un archivo fue ignorado,
  corrige el problema y ejecuta `po handoff` otra vez. En `SEAL_PENDING` la línea base
  está en proceso de sellado. Los reintentos comprueban el manifest antes de completar.
- Si un proceso terminó bruscamente, revisa el PID de `.git/closelly-aiplc.lock/owner.json`.
  Cuando ya no exista la operación, retira solo ese directorio de bloqueo y reintenta.
- Si la línea base difiere después de sellar, recupera la copia del tag y revisa antes
  de continuar. No corrijas el problema reescribiendo el tag distribuido. Registra los
  cambios posteriores de alcance y diseño en el conocimiento vigente.
