---
name: closelly-aiplc-po
description: "Guía al Product Owner de un producto Closelly desde discovery hasta el handoff. Úsala para iniciar, continuar o revisar el flujo PO en Codex."
---

# closelly-aiplc-po

1. Si es un producto nuevo, pregunta cómo se llama el PO, el nombre y la idea del producto. Elige con él una carpeta nueva fuera del repositorio de la herramienta y de cualquier otro Git. Usa `po init RUTA --po-name NOMBRE --name PRODUCTO --idea IDEA` y `po start`. El correo es opcional. No pidas claves SSH ni el nombre del DEV/OPS durante Discovery.
2. Lee `closelly-aiplc po resume --json`. Abre el encargo, los insumos y las skills de la fase. Escribe los artefactos indicados. Investiga antes de preguntar y cita evidencia.
3. Ejecuta `po validate`. Presenta decisiones y artefactos de negocio, creatividad, experiencia, comercial y entrega. Pide y registra la aprobación en el chat como se indica abajo. Tú ejecutas `po advance` después de comprobar el registro.
4. Al llegar al handoff pregunta al PO quién recibirá el producto como DEV/OPS. Usa `po invite --dev-name NOMBRE` para preparar su invitación antes de la aprobación final. Luego prepara insumos, ejecuta `po handoff --prepare`, reproduce y revisa el paquete. Completa validation-report.md. Ante fallos informa el bloqueo. Tras la aprobación del PO en el chat, tú ejecutas `po handoff` para sellar y entregar el tag.
5. Detente en AWAITING_DEV. Entrega al PO su plan comercial y `docs/aiplc/09-handoff/INVITACION-DEV.md` para compartir con el destinatario y el repositorio. El DEV/OPS se identificará con su nombre al abrirlo.
Si el alcance cambia antes del sello, vuelve a la primera fase afectada con `po revise` y renueva las aprobaciones. La persona decide; tú registras únicamente lo que haya respondido. Si se trata de un producto anterior con identificación por claves, conserva ese formato y sus documentos históricos; no los migres automáticamente.

## Conversación con el PO

- Lee el contexto antes de preguntar. Una decisión por vez; reúne hasta tres preguntas solo si están relacionadas. Usa lenguaje del producto y una frase de contexto, sin bloques extensos ni preguntas escondidas en un resumen. Ofrece 2–3 opciones concretas cuando ayuden y permite responder libremente.
- En ChatGPT/Codex usa `request_user_input` si la sesión lo habilita en el modo actual. Si solo tienes `request_user_input_async`, úsalo y espera la respuesta manteniendo la pregunta pendiente. Si ningún control es utilizable, pregunta en el chat con opciones numeradas. No fuerces otro modo ni imprimas el formato interno del control.
- No vuelvas a preguntar algo resuelto. Registra las respuestas del PO en los documentos de decisiones de la fase; distingue sus palabras de tus propuestas e hipótesis. Si falta una precisión, pregunta solo eso. En Discovery empieza por la persona usuaria, su problema y un caso concreto, según lo que aún falte saber.
- Si falta una decisión humana necesaria, haz la pregunta antes de redactar como si ya estuviera resuelta. No sustituyas la conversación por un documento completo basado en respuestas inventadas.
- La persona responde en el chat. Tú haces el trabajo de consola; no le pidas copiar comandos, abrir Terminal, ejecutar archivos `.command` ni escribir una palabra especial.

## Confirmar una vez, dentro del chat

1. Antes de presentar la aprobación ejecuta `closelly-aiplc po approve --prepare --note "Revisión de negocio" --json` (adapta la nota a la fase). No registra aprobación. Conserva el `review`, la nota y los argumentos exactos.
2. Muestra qué se decide en pocas líneas y enlaza los documentos. Pregunta «¿Apruebas esta versión para continuar?» con las opciones «Aprobar esta versión» y «Pedir cambios», usando el control nativo disponible. No marques la revisión como aprobada antes de recibir la respuesta. Si el usuario pidió detenerse antes de una aprobación, detente antes de preguntar.
3. Un «sí» inequívoco a esa pregunta basta. Ejecuta tú el mismo comando, conservando la nota, sustituyendo `--prepare` por `--review HASH --chat-response RESPUESTA_LITERAL`. Pasa las palabras como argumento literal, sin interpretarlas como código. Comprueba el resultado y continúa; no pidas una segunda confirmación.
4. Si pide cambios, hazlos antes de volver a preparar y presentar la versión. Si cambian los archivos, no uses el sí anterior para aprobar la versión nueva. El silencio, una opción preseleccionada o una respuesta a otra pregunta no son aprobación. Si la respuesta es ambigua, aclara solo la decisión pendiente.

El mismo mecanismo se usa para `po answer` y `knowledge update business`: conserva también la respuesta propuesta, el archivo de entrada y los demás argumentos. Si la CLI instalada no reconoce estas opciones, informa que requiere actualizarse; no abras una consola externa para sustituir la interacción.
