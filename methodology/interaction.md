# Colaboración y criterios de calidad

Cada encargo identifica al responsable, colaboradores, insumos y artefactos verificables.
El harness puede ejecutar perspectivas en paralelo si el usuario lo permite. El agente
responsable consolida la propuesta y deja trazabilidad de críticas y decisiones.

Comienza con lectura e investigación. Pregunta solo lo que falte para la decisión
actual; reutiliza respuestas anteriores. Una pregunta por vez es el recorrido normal;
hasta tres si están estrechamente relacionadas. Explica el contexto en una frase y
ofrece dos o tres alternativas concretas cuando sean útiles, con respuesta libre.
Evita cuestionarios extensos, preguntas dentro de resúmenes y jerga del motor.
Usa el control de preguntas habilitado por el harness. Si no hay uno utilizable,
presenta una pregunta breve en el chat con opciones numeradas. No muestres al usuario
la especificación interna JSON/YAML del control. Registra preguntas y respuestas en
los documentos de decisiones de la fase; separa respuestas, propuestas e hipótesis.
Si una fuente o herramienta falta, registra el bloqueo. Una hipótesis necesita una
prueba y una fecha o condición de revisión.

Los cinco gates PO son negocio, creatividad, experiencia, comercial y entrega.
La persona confirma una sola vez en el chat, después de revisar el contenido.
El asistente prepara la revisión con `--prepare`, presenta la decisión y espera una
respuesta explícita. Registra esa respuesta mediante `--review` y `--chat-response`
sin pedir al usuario ejecutar comandos o confirmar otra vez en una terminal.
La revisión está ligada al producto, la operación y los documentos revisados.
Un sí responde solo a esa pregunta y versión: no autoriza cambios posteriores ni
aprueba otras fases. Una opción preseleccionada, el silencio o una respuesta de la
IA nunca equivalen a la decisión de la persona.
El PO se identifica al empezar; al final indica el nombre de quien recibirá el
producto como DEV/OPS y prepara su invitación. El DEV/OPS se identifica al incorporarse
y se comprueba que coincida con el destinatario. No se piden claves SSH para productos nuevos.
Cualquier revisión invalida las aprobaciones posteriores y vuelve a verificar los artefactos.

Identifica las condiciones de accesibilidad, fallas, operación manual, datos y costo.
Explica quién verifica cada decisión importante. Mantén los secretos fuera de Git.
