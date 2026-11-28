# Preguntas y decisiones en el chat

La persona responde y decide; el asistente prepara los documentos y maneja los
comandos. Una confirmación en el chat basta para registrar la revisión que se
acaba de presentar. No se abre una segunda ventana para escribir CONFIRMAR.

## Preguntas concretas, en orden

En Discovery el asistente empieza por lo que aún falte conocer: quién usará el
producto, qué problema tiene y un caso concreto. Lee el contexto antes de preguntar.
Si la persona ya explicó quién es su cliente, no lo vuelve a preguntar.

Cada pregunta trata una decisión y explica en una frase por qué importa. Por
ejemplo: «Para elegir el primer recorrido, ¿quién registrará los pedidos?».
Puede ofrecer «La persona que recibe encargos» y «El propio cliente», manteniendo
la posibilidad de responder con otras palabras. Evita pedir de una vez el mercado,
el presupuesto, todos los requisitos y la arquitectura.

El control de preguntas disponible en el entorno es la primera opción. En
ChatGPT/Codex se usan `request_user_input` o `request_user_input_async` solo cuando
estén habilitados y sus reglas permitan usarlos. Si no hay un control utilizable,
la misma pregunta se presenta en el chat con opciones numeradas. Las capacidades
varían por sesión; no se cambia el modo ni se promete un formulario inexistente.
La guía del adaptador describe cómo esperar una respuesta asíncrona.

El asistente registra las preguntas y sus respuestas en los documentos de decisiones
de la fase. Distingue las respuestas humanas de las propuestas y las hipótesis.
Una precisión posterior pregunta solo por la duda pendiente.

## Una sola confirmación

El asistente prepara una revisión sin cambiar el estado, muestra una síntesis corta
y los documentos, y pregunta «¿Apruebas esta versión para continuar?». La persona
puede elegir «Aprobar esta versión», pedir cambios o responder con sus palabras.
Un «sí» claro a esa pregunta se registra y el asistente continúa. No se pide repetir
la decisión en una consola.

La respuesta vale para esa versión. Si cambian los documentos o la propuesta, se
presenta la versión actual antes de pedir otra decisión. El silencio, un formulario
cerrado y una opción preseleccionada no son aprobación. Si la persona pidió parar
antes de una aprobación, el asistente se detiene antes de hacer la pregunta.

## Referencia para integraciones

Las operaciones `po approve`, `dev approve`, `dev ready`, `dev ack`, `po answer`
y `knowledge update business` permiten preparar una revisión y después registrar
la respuesta. Estos comandos los ejecuta el asistente:

```sh
closelly-aiplc po approve --prepare --note "Revisión de negocio" --json
closelly-aiplc po approve --review HASH --chat-response "Sí, apruebo esta versión" --note "Revisión de negocio" --json
```

`HASH` es el `review` de la preparación, no una contraseña ni algo que deba escribir
la persona. Vincula producto, operación, argumentos, nota y contenido. La nota y los
argumentos se conservan entre ambos comandos. El registro mantiene la respuesta
literal dentro de la nota y conserva el formato de recibos existente.

La CLI verifica identidad declarada, documentos y revisión; el asistente debe
transcribir únicamente una respuesta real e inequívoca a esa pregunta. La CLI no
autentica el origen de una frase pegada desde otro proceso. Los controles de nombre
y acceso al repositorio conservan los límites descritos en arquitectura.

El uso manual de la CLI en una terminal sigue disponible. No es el recorrido que
el asistente debe imponer a quien trabaja por chat.

## Qué tomamos del proyecto de referencia

Se revisaron [el protocolo de preguntas de AWS AI-DLC](https://github.com/awslabs/aidlc-workflows/blob/main/core/aidlc-common/protocols/stage-protocol.md),
[su guía de ejecución](https://github.com/awslabs/aidlc-workflows/blob/main/core/aidlc-common/conductor.md)
y [su adaptación de preguntas para Codex](https://github.com/awslabs/aidlc-workflows/blob/main/harness/codex/skills/aidlc/question-rendering.md).
La separación entre pregunta, respuesta humana y registro del motor permite usar
la interfaz nativa de cada entorno. También retomamos el contexto breve, la
reutilización de respuestas y la adaptación de preguntas a lo que falte decidir.

Closelly mantiene sus etapas PO y DEV/OPS y una conversación guiada por defecto.
No obliga a editar un cuestionario ni añade otra confirmación después de la respuesta
humana. La selección del control se basa en las herramientas de la sesión actual;
la documentación de un harness distinto no habilita capacidades por sí sola.
