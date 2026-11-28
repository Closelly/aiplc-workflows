---
name: closelly-aiplc-dev
description: "Guía al DEV/OPS de Closelly desde la invitación del PO hasta readiness. Úsala si el DEV recibió el repo con su tag y necesita onboarding o preparación técnica."
---

# closelly-aiplc-dev

1. Abre `docs/aiplc/09-handoff/INVITACION-DEV.md` y pide al DEV/OPS su nombre. Ejecuta `closelly-aiplc dev onboard --name NOMBRE` para comprobar que coincide con el destinatario que indicó el PO. No pidas claves SSH ni crees cuentas. Si el nombre no coincide, acláralo con el PO antes de continuar. En productos anteriores que ya usan claves, conserva su formato original.
2. Usa `dev resume --json` y facilita el siguiente paso con sus recursos. El DEV/OPS confirma su revisión en el chat; tú registras `dev ack PASO` con el mecanismo indicado abajo, incluido el paso de video.
3. Registra dudas con `dev clarify`. Pide al DEV resumir restricciones y pendientes en understanding.md. El DEV/OPS aprueba en el chat; tú registras `dev approve` y ejecutas `dev advance`. Eleva las decisiones de alcance al PO.
4. Prepara discovery técnico, arquitectura, IA y planificación siguiendo cada encargo. Tras revisión y `dev ready`, vuelve al proceso habitual de trabajo.
No alteres docs/aiplc. El conocimiento vigente va en docs/technical, docs/operations y, para cambios de alcance aprobados por el PO, docs/business.

## Preguntas y confirmaciones en el chat

- Pregunta una decisión por vez, con una frase de contexto y opciones cortas cuando ayuden. Máximo tres preguntas si están relacionadas. Reutiliza respuestas anteriores y registra las decisiones en los documentos técnicos. No mezcles preguntas con un resumen largo.
- Usa `request_user_input` cuando esté habilitado y permitido en el modo actual; si solo está `request_user_input_async`, mantén la pregunta pendiente hasta recibir respuesta. Si no hay control utilizable, pregunta en el chat con opciones numeradas. No fuerces un modo ni muestres JSON/YAML de preguntas.
- Tú ejecutas los comandos. No pidas al DEV/OPS copiar comandos, abrir Terminal ni escribir CONFIRMAR.
- Para `dev ack PASO`, `dev approve` o `dev ready`, ejecuta primero el comando con `--prepare --note "Descripción de la revisión" --json`. No registra ninguna decisión. Conserva `review` y todos los argumentos, muestra los recursos o documentos y pide una sola confirmación en el chat.
- Solo tras una respuesta inequívoca de la persona, repite el mismo comando sin `--prepare`, añadiendo `--review HASH --chat-response RESPUESTA_LITERAL`, con la misma nota. Pasa la respuesta como argumento literal. Comprueba el estado antes de continuar y no pidas confirmación otra vez en una consola.
- No atribuyas al DEV/OPS una reproducción de video ni una revisión que no haya confirmado. El silencio, las opciones preseleccionadas y las respuestas a otra pregunta no cuentan. Si cambian los documentos o pide cambios, prepara y presenta la versión actual antes de confirmar. Si la CLI no admite el mecanismo, informa que hay que actualizarla.
