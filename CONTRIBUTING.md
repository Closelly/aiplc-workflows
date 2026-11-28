# Contribuir a Closelly AI-PLC

Gracias por contribuir. Empieza con un issue que describa el problema o una mejora
concreta. Para cambios pequeños, envía directamente un pull request. El idioma
principal de la documentación es español; se aceptan issues en español o inglés.

## Entorno local

Usa Bun 1.4.5 (la versión de CI) y Git. OpenSSH solo se necesita para las pruebas
de compatibilidad con productos anteriores. Después de clonar:

```sh
bun install --frozen-lockfile
bun run check
bun run check:public
bun test
bun run build
bun run test:install
```

`bun test` omite el render multimedia salvo que se habilite expresamente. Las
pruebas crean carpetas y claves temporales: no uses credenciales ni productos reales.
Las pruebas del instalador usan una release local y no modifican tu instalación,
tus skills ni la configuración de tu terminal.

## Preparar un cambio

1. Crea una rama con un nombre descriptivo.
2. Mantén el cambio centrado en un problema y explica el comportamiento resultante.
3. Añade pruebas cuando cambies estados, firmas, validadores, instalación o empaquetado.
4. Actualiza la documentación afectada y la sección Unreleased de CHANGELOG.md.
5. Incluye las comprobaciones ejecutadas y sus límites en el pull request.

No incluyas claves, `.env`, productos de clientes, grabaciones privadas ni salidas
generadas. No mezcles los flujos PO y DEV ni elimines las aprobaciones humanas.
Lee AGENTS.md y docs/architecture.md antes de cambiar el motor.

## Compilación e instalación de desarrollo

```sh
bun run build
sh install.sh --dist "$(pwd)/dist" --prefix /ruta/nueva/aiplc --skills-dir /ruta/nueva/skills --no-modify-path
```

También puedes usar `sh scripts/install-local.sh` con las mismas opciones. Este
comando compila primero. El instalador nunca sobrescribe skills ajenas. Las versiones
publicadas son inmutables: si cambia su contenido, aumenta la versión del paquete.

## Revisión y licencia

Un mantenedor revisa cada propuesta. No se exige CLA. Al contribuir, aceptas que tu
contribución se distribuya bajo la licencia MIT de este proyecto, y declaras que
puedes aportar ese contenido. Conserva los avisos de terceros.

Para problemas de seguridad, sigue SECURITY.md. Para preparar releases, sigue
docs/releasing.md.
