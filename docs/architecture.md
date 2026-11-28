# Motor, participantes y recuperación

`workflows/po.yaml` y `workflows/dev.yaml` declaran el orden, las revisiones humanas,
los colaboradores, artefactos y reglas. `src/engine.ts` aplica transiciones
deterministas y `src/harness.ts` entrega encargos al asistente. La CLI verifica
forma, trazabilidad y archivos; las personas revisan evidencia, calidad y decisiones.

## Identificación por nombre e invitación

Los productos nuevos usan `project.json` versión 2. El PO aporta su nombre al crear
el producto y puede añadir un correo opcional. DEV empieza como `null`: no es
necesario elegir a esa persona durante Discovery.

La identificación de la copia local queda en `.git/closelly-aiplc-person.json`,
fuera del contenido compartido. Los comandos de cada rol comprueban esa declaración.
Al identificarse se configura únicamente el Git de ese producto con el nombre;
si falta correo se usa una dirección interna `@aiplc.invalid`, sin buzón. No se
modifica la configuración global de Git ni se solicita firma de commits o tags.

En la fase final, `po invite --dev-name NOMBRE` genera `invitation.json` y
`INVITACION-DEV.md`. El nombre del destinatario y el texto quedan incluidos en la
versión de archivos que el PO revisa y en la entrega sellada. Un cambio después de
aprobar obliga a reabrir la fase; la invitación histórica no se edita tras el sello.

El DEV/OPS recibe una copia del repositorio y usa `dev onboard --name NOMBRE`.
Primero se verifica la entrega; después se compara su nombre con el de la invitación,
normalizando mayúsculas, tildes y espacios. El perfil aceptado se registra en
`docs/technical/aiplc/participant.json`, ligado a esa invitación, y comienza onboarding.
El nombre incorrecto no crea un perfil ni un estado DEV.

Las revisiones guardan persona, rol, fecha, motivo y digest de los documentos. Las
confirmaciones de este formato registran una declaración humana por nombre; no
son firmas criptográficas ni certifican titularidad del nombre. El equipo administra
el acceso al repositorio. Un propietario del disco puede modificar controles locales.
El motor no administra cuentas, invitaciones por correo ni un servicio de autenticación.

## Confirmación desde el chat

Las operaciones de revisión aceptan `--prepare`: validan y devuelven un `review`
sin escribir una aprobación ni avanzar el estado. La confirmación puede registrarse
sin TTY con `--review HASH --chat-response RESPUESTA`, manteniendo nota y argumentos.
La clave de revisión incluye producto, comando, argumentos, nota y digest del
contenido. Una edición, otro producto o una propuesta distinta invalida esa clave.
Las comprobaciones de identidad y los validadores siguen ejecutándose.

La respuesta literal se conserva en la nota del recibo, con su formato original.
No se reescriben schemas, snapshots ni entregas de productos anteriores. El asistente
es responsable de registrar una respuesta humana real: la CLI no verifica que un
texto provenga de un mensaje autenticado del chat. El modo manual por TTY se conserva.
La pauta de conversación de la CLI actual sustituye instrucciones antiguas de
interacción, manteniendo intacta la metodología fijada al crear cada producto.
Consulta [conversation.md](conversation.md).

## Archivo histórico y documentación vigente

- `docs/aiplc/state.json` y `artifact-manifest.json` registran el progreso PO.
- `docs/aiplc/09-handoff/handoff-manifest.json` enumera archivos, tamaños y SHA-256.
  Se excluye a sí mismo para evitar una referencia circular.
- La entrega crea un commit y el tag anotado `aiplc-baseline-v1`. DEV verifica árbol,
  manifest, hashes, estado PO y pertenencia del tag a la historia de su rama.
- El perfil y el estado DEV se crean en `docs/technical/aiplc/` al aceptar la invitación.
  No se modifica el `project.json` histórico para registrar al nuevo participante.
- Business describe decisiones de negocio actuales; Technical, diseño y arquitectura;
  Operations, rutinas humanas con responsables y evidencia.
- Reabrir una fase PO invalida sus aprobaciones posteriores y vuelve a verificar
  los artefactos. Los cambios después del sello se registran en el conocimiento vigente.

## Productos anteriores

Los productos versión 1 conservan su verificación por SSH y sus documentos y
schemas originales. La nueva CLI puede leerlos y usar sus claves con `--key` o
`AIPLC_PO_KEY`/`AIPLC_DEV_KEY`. Esta compatibilidad no se utiliza al crear productos
nuevos por nombre. No se convierten firmas ni se reescriben tags existentes.
Consulta [upgrading.md](upgrading.md).

## Bloqueos y reintentos

- Si falta un archivo, una revisión o un servicio, el comando termina con código 2
  y su motivo. Los errores inesperados devuelven código 1.
- Si falta indicar el destinatario en handoff, pide su nombre al PO y prepara la
  invitación antes de la aprobación final.
- Si un nombre no coincide, revísalo con la persona que hizo la invitación. No
  cambies el destinatario histórico para forzar el acceso de otra persona.
- Si hay cambios staged, resuélvelos antes de sellar. En SEAL_PENDING, comprueba el
  manifest y reintenta `po handoff`; no reescribas un tag ya distribuido.
- Si un proceso terminó bruscamente, revisa `.git/closelly-aiplc.lock/owner.json`.
  Solo cuando la operación ya no exista, retira ese directorio y reintenta.
- Si cambió la línea base después del sello, recupera su copia y registra los
  cambios posteriores en la documentación vigente.
