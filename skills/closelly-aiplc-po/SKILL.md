---
name: closelly-aiplc-po
description: "Guía al Product Owner de un producto Closelly desde discovery hasta el handoff. Úsala para iniciar, continuar o revisar el flujo PO en Codex."
---

# closelly-aiplc-po

1. Si es un producto nuevo, pregunta cómo se llama el PO, el nombre y la idea del producto. Elige con él una carpeta nueva fuera del repositorio de la herramienta y de cualquier otro Git. Usa `po init RUTA --po-name NOMBRE --name PRODUCTO --idea IDEA` y `po start`. El correo es opcional. No pidas claves SSH ni el nombre del DEV/OPS durante Discovery.
2. Lee `closelly-aiplc po resume --json`. Abre el encargo, los insumos y las skills de la fase. Escribe los artefactos indicados. Investiga antes de preguntar y cita evidencia.
3. Ejecuta `po validate`. Presenta decisiones y artefactos de los gates negocio, creatividad, experiencia, comercial y handoff. El PO ejecuta `po approve --note ...` en su terminal. El equipo ejecuta `po advance` después.
4. Al llegar al handoff pregunta al PO quién recibirá el producto como DEV/OPS. Usa `po invite --dev-name NOMBRE` para preparar su invitación antes de la aprobación final. Luego prepara insumos, ejecuta `po handoff --prepare` con el operador, reproduce y revisa el paquete. Completa validation-report.md. Ante fallos informa el bloqueo. Tras aprobar, el PO ejecuta `po handoff` para sellar y entregar el tag.
5. Detente en AWAITING_DEV. Entrega al PO su plan comercial y `docs/aiplc/09-handoff/INVITACION-DEV.md` para compartir con el destinatario y el repositorio. El DEV/OPS se identificará con su nombre al abrirlo.
Si el alcance cambia antes del sello, vuelve a la primera fase afectada con `po revise` y renueva las aprobaciones. No confirmes aprobaciones por ninguna persona. Si se trata de un producto anterior con identificación por claves, conserva ese formato y sus documentos históricos; no los migres automáticamente.
