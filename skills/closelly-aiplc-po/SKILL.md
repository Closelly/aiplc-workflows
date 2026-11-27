---
name: closelly-aiplc-po
description: "Guía al Product Owner de un producto Closelly desde discovery hasta el handoff. Úsala para iniciar, continuar o revisar el flujo PO en Codex."
---

# closelly-aiplc-po

1. Si es un producto nuevo, acuerda nombre, carpeta independiente y claves públicas PO/DEV. Ejecuta `po init` y pide al PO iniciar el flujo con su clave.
2. Lee `closelly-aiplc po resume --json`. Abre el encargo, los insumos y las skills de la fase. Escribe los artefactos indicados. Investiga antes de preguntar y cita evidencia.
3. Ejecuta `po validate`. Presenta decisiones y artefactos de los gates negocio, creatividad, experiencia, comercial y handoff. El PO ejecuta `po approve --note ...` en su terminal. El equipo ejecuta `po advance` después.
4. En handoff prepara insumos, ejecuta `po handoff --prepare` con el operador, reproduce y revisa el paquete. Completa validation-report.md. Ante fallos informa el bloqueo. Tras aprobar, el PO ejecuta `po handoff` para sellar y entregar el tag.
5. Detente en AWAITING_DEV. Entrega al PO el enlace a su plan comercial y el comando que debe ejecutar el DEV.
Si el alcance cambia antes del sello, vuelve a la primera fase afectada con `po revise` y renueva las aprobaciones. No firmes por ninguna persona.
