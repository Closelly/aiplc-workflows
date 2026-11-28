# Seguridad

La rama principal y la última release estable son las versiones que reciben
correcciones. Las releases 0.x pueden introducir cambios; revisa CHANGELOG.md.

## Reportar una vulnerabilidad

En GitHub usa **Security → Report a vulnerability** si el repositorio tiene
habilitados los reportes privados. Incluye versión, sistema operativo, pasos para
reproducir, efecto y una prueba mínima sin credenciales ni datos de clientes.

Si esa opción no está disponible, contacta en privado a un mantenedor mediante un
canal publicado en su perfil. Puedes abrir un issue solicitando un canal privado,
sin describir la vulnerabilidad ni adjuntar material sensible. El proyecto todavía
no ofrece un plazo de respuesta garantizado ni un programa de recompensas.

## Alcance y límites

Los productos nuevos identifican a los participantes por el nombre que declaran.
El PO nombra al destinatario al preparar la entrega; DEV/OPS debe indicar ese
mismo nombre para comenzar. Esto permite registrar responsabilidades y confirmar
que el nombre coincide; no certifica la identidad de una persona ni sustituye
permisos de acceso, cuentas verificadas o controles del repositorio del equipo.

Las confirmaciones se vinculan a los documentos revisados y el sello Git verifica
la integridad de la entrega. Los nombres y los correos opcionales se guardan en los
documentos del producto. Comparte ese repositorio con las personas correspondientes.
Los productos anteriores conservan sus claves privadas fuera de Git y su mecanismo
original; consulta docs/upgrading.md.

La instalación usa HTTPS y verifica SHA-256 de los paquetes contra `checksums.txt`
de la misma release. Esto detecta descargas dañadas; no sustituye una firma de
editor ni protege frente a una cuenta de publicación comprometida. Puedes descargar
y revisar el instalador antes de ejecutarlo, o usar una versión fijada.

El instalador no solicita sudo, credenciales del proveedor de IA ni claves privadas.
Comprueba Git, y falla si faltan. Los proveedores remotos de voz reciben
la narración solo cuando el operador los configura; consulta docs/video.md.
