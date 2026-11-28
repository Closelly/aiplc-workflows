# ChatGPT / Codex

Abre el repositorio del producto como workspace de Codex. Invoca `$closelly-aiplc-po`
o `$closelly-aiplc-dev` según tu rol. Si no están instaladas, usa el encargo de
`closelly-aiplc po resume --json` o `closelly-aiplc dev resume --json` y abre los
SKILL.md del snapshot dentro de docs/aiplc/methodology/.

El adaptador usa el chat, las herramientas disponibles en esa sesión y la salida JSON.
No necesita una clave de OpenAI del usuario para usar Codex. Si usas ChatGPT sin
acceso a una terminal y a la carpeta de producto, genera propuestas en el chat y lleva
los documentos y comandos a Codex o a una terminal local.

Ejecuta las aprobaciones en la terminal del operador. Para que Codex redacte, basta
la lectura de los documentos. El PO indica su nombre al crear el producto. Al final invita al DEV/OPS por su nombre; el DEV/OPS se identifica con ese mismo nombre al recibirlo. Las aprobaciones las confirma cada persona en su terminal. No pidas claves SSH para productos nuevos.
