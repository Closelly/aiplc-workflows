# {{PRODUCT}}

- [Definición inicial](docs/aiplc/README.md) contiene las decisiones y artefactos de la metodología. Tras la entrega queda sellada y se consulta como referencia histórica.
- [Negocio vigente](docs/business/README.md) contiene producto, reglas, clientes, métricas y estrategia actuales. Los cambios de alcance requieren aprobación del PO.
- [Técnica vigente](docs/technical/README.md) cubre arquitectura propuesta y en producción, código, entornos, servicios, datos y pruebas. Documenta los nombres de variables sin sus valores.
- [Operaciones vigentes](docs/operations/README.md) documenta las tareas humanas y revisiones del negocio con propósito, frecuencia, responsable, pasos, escalamiento y evidencia.

Ejecuta el grupo de comandos de tu rol. El PO termina en el handoff. El DEV inicia con
`closelly-aiplc dev onboard` tras recibir el repositorio y su tag Git. El motor verifica
la entrega y la confirmación de cada rol. Mantén las tres carpetas vigentes al cambiar
comportamiento, arquitectura u operación y registra la referencia de la decisión.

La persona responde y confirma en el chat; el asistente ejecuta los comandos y
registra solo respuestas explícitas sobre la revisión presentada. Usa el control
de preguntas disponible, con una decisión por vez y contexto breve. No pidas copiar
comandos ni confirmar otra vez en una consola. Consulta la pauta de conversación
que entrega la CLI actual, conservando los documentos históricos de la metodología.
