---
name: closelly-aiplc-dev
description: "Guía al DEV de Closelly desde la entrega Git hasta readiness. Úsala si el DEV recibió el repo con su tag y necesita onboarding o preparación técnica."
---

# closelly-aiplc-dev

1. Pide al DEV ejecutar `closelly-aiplc dev onboard` con su clave. Resuelve discrepancias de tag antes de trabajar.
2. Usa `dev resume --json` y facilita el siguiente paso con sus recursos. Tras cada revisión, el DEV registra `dev ack PASO --note ...`. El paso de video pide confirmación interactiva.
3. Registra dudas con `dev clarify`. Pide al DEV resumir restricciones y pendientes en understanding.md. El DEV firma `dev approve` y avanza. Eleva las decisiones de alcance al PO.
4. Prepara discovery técnico, arquitectura, IA y planificación siguiendo cada encargo. Tras revisión y `dev ready`, vuelve al proceso habitual de trabajo.
No alteres docs/aiplc. El conocimiento vigente va en docs/technical, docs/operations y, para cambios de alcance aprobados por el PO, docs/business.
