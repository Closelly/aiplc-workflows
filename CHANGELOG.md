# Changelog

Los cambios relevantes se registran aquí. Las versiones siguen SemVer; durante 0.x
pueden existir cambios incompatibles, que se señalarán expresamente.

## Unreleased

Sin cambios pendientes.

## 0.1.1 — 2026-11-27

### Cambiado

- Al integrar en `main` una versión nueva de `package.json`, GitHub ejecuta las
  pruebas y prepara automáticamente el tag y la release en borrador con sus cuatro
  paquetes nativos, instalador, desinstalador, VERSION y checksums.
- Las notas del borrador se extraen de la sección correspondiente de este changelog.
- La publicación final sigue siendo manual desde Releases; el instalador de
  `latest` conserva la versión pública anterior hasta que se publique el borrador.

### Protección de versiones

- Los cambios que mantienen una versión ya publicada o un borrador de otro commit
  no regeneran sus paquetes. Un borrador fallido se puede reintentar en su mismo commit.
- Se rechazan versiones anteriores y tags ligados a otro commit; los tags publicados
  no se mueven ni se sobrescriben releases públicas.

## 0.1.0 — 2026-11-27

### Añadido

- Instalador descargable de ejecutables nativos para macOS y Linux/WSL, ARM64 y x64.
- Verificación SHA-256, instalación de skills, actualización del PATH y desinstalador.
- Paquetes de release con metodología, avisos y licencias de terceros.
- Comprobaciones en CI, publicación de releases borrador y guías para usuarios y colaboradores.
- Licencia MIT, política de seguridad, código de conducta y plantillas de GitHub.

- Motor local de fases PO y DEV con firmas SSH y aprobaciones humanas.
- Nueve fases PO, seis fases DEV y transferencia mediante una línea base Git.
- Encargos para Codex, schemas y conocimiento de negocio, técnica y operaciones.
- Generación del paquete comercial y película de onboarding con proveedores externos.

Las comprobaciones y sus límites están documentados en docs/verification.md.
