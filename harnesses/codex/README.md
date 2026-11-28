# ChatGPT / Codex

Abre el repositorio del producto como workspace de Codex. Invoca `$closelly-aiplc-po`
o `$closelly-aiplc-dev` según tu rol. Si no están instaladas, usa el encargo de
`closelly-aiplc po resume --json` o `closelly-aiplc dev resume --json` y abre los
SKILL.md del snapshot dentro de docs/aiplc/methodology/.

El adaptador usa el chat, las herramientas disponibles en esa sesión y la salida JSON.
No necesita una clave de OpenAI del usuario para usar Codex. Si usas ChatGPT sin
acceso a una terminal y a la carpeta de producto, genera propuestas en el chat y lleva
los documentos y comandos a Codex o a una terminal local.

La persona decide en el chat; el asistente ejecuta la CLI. El PO indica su nombre al
crear el producto. Al final invita al DEV/OPS por su nombre, y esa persona se presenta
al recibirlo. No pidas claves SSH para productos nuevos.

## Preguntar dentro del chat

Usa `request_user_input` si está habilitado y permitido en el modo actual. Si solo
está `request_user_input_async`, úsalo manteniendo la pregunta pendiente hasta
recibir la respuesta; no cierres un turno si eso retira el control antes de que la
persona pueda responder. Si no hay control utilizable, presenta una pregunta corta
con opciones numeradas en el chat. No fuerces cambios de modo, inventes herramientas
ni imprimas la especificación interna del formulario.

Una decisión por pregunta, con contexto breve. Hasta tres preguntas por bloque
solo si están relacionadas; dos o tres alternativas concretas cuando ayuden.
Permite respuesta libre y no añadas «Otra» si el control ya la ofrece. Registra las
respuestas en los documentos de decisiones de la fase y no repitas lo ya resuelto.

## Confirmar una vez

Antes de preguntar, el asistente ejecuta la operación con `--prepare --note NOTA
--json`. La CLI comprueba la revisión y devuelve `AWAITING_CONFIRMATION`, su mensaje
y un `review`, sin registrar aprobación ni cambiar el estado del producto.

El asistente presenta el resultado y los documentos en pocas líneas y pregunta si
la persona aprueba esa versión. Tras una respuesta explícita a esa pregunta,
repite la operación conservando todos los argumentos y la nota, sin `--prepare`,
con `--review HASH --chat-response RESPUESTA_LITERAL`. La CLI rechaza un producto,
operación, propuesta o contenido diferente al revisado. El asistente comprueba el
estado y continúa; no pide otro sí ni abre una terminal o un archivo `.command`.

No hay decisión mientras falte la respuesta; una opción preseleccionada no cuenta.
Una respuesta ambigua se aclara, y una solicitud de cambios se trabaja antes de
presentar la nueva revisión. Si falta acceso a la carpeta o a la CLI, informa el
bloqueo real sin fingir el registro.

Consulta [el diseño de la conversación y sus referencias](../../docs/conversation.md).
