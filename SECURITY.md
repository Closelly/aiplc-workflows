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

Las claves privadas PO/DEV deben permanecer fuera de Git. No son claves de OpenAI.
Las firmas vinculan un rol y una revisión de documentos; quien controla disco,
claves y ejecutable también controla la política local. Las protecciones de ramas,
permisos y custodia separada de claves se administran fuera de la herramienta.

La instalación usa HTTPS y verifica SHA-256 de los paquetes contra `checksums.txt`
de la misma release. Esto detecta descargas dañadas; no sustituye una firma de
editor ni protege frente a una cuenta de publicación comprometida. Puedes descargar
y revisar el instalador antes de ejecutarlo, o usar una versión fijada.

El instalador no solicita sudo, credenciales del proveedor de IA ni claves privadas.
Comprueba Git y OpenSSH, y falla si faltan. Los proveedores remotos de voz reciben
la narración solo cuando el operador los configura; consulta docs/video.md.
