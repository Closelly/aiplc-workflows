# De la idea al trabajo compartido

Necesitas Codex con acceso a la carpeta de trabajo y a una terminal. La herramienta
acompaña a dos personas: el PO define el producto y el DEV/OPS prepara cómo
construirlo y operarlo.

## 1. El PO se presenta y cuenta su idea

Después de [instalar la herramienta](installation.md), escribe en Codex:

> Usa $closelly-aiplc-po. Me llamo Luis y quiero trabajar una idea llamada Taller de
> pedidos. Ayúdame a entender el problema y guíame paso a paso desde Discovery.

Tu nombre basta para empezar. Puedes añadir un correo si quieres, pero es opcional.
Todavía no necesitas saber quién hará el desarrollo.

Codex te ayuda a elegir una carpeta nueva y crea allí el producto. La carpeta de
la herramienta y la del producto son distintas. Los comandos equivalentes son:

```sh
closelly-aiplc po init /ruta/producto-nuevo --po-name "Luis" \
  --name "Taller de pedidos" --idea "Organizar la recepción y seguimiento de encargos"
cd /ruta/producto-nuevo
closelly-aiplc po start
closelly-aiplc po resume --json
```

## 2. El PO trabaja con Codex

Cuenta ejemplos, responde preguntas y corrige las propuestas. Codex investiga,
separa evidencia de hipótesis y prepara los documentos. Discovery empieza con
`brief.md`, `research.json` y `decisions.md` en `docs/aiplc/01-discovery/`.

Después vienen definición, IA, marca, experiencia, especificaciones, validación,
estrategia comercial y entrega. Las decisiones importantes las revisas tú. Cuando
corresponda una aprobación, la herramienta te muestra qué se está revisando y te
pide confirmar en el chat. El asistente registra tu respuesta y continúa, sin
pedirte ejecutar comandos ni confirmar de nuevo en una consola. El registro
conserva tu nombre, tu respuesta, la fecha y los documentos revisados.
Las preguntas aparecen en el control nativo disponible, una decisión por vez y con
opciones breves. Si tu sesión no tiene ese control, se hacen en el propio chat.

`po status` muestra el avance. `po resume` entrega al asistente el trabajo pendiente;
la investigación y la redacción las realiza Codex con las herramientas del chat.
`po validate` comprueba archivos y contenido: que un archivo exista no significa
que esté completo.

## 3. Al entregar, el PO indica quién continúa

Cuando el producto esté listo para la entrega, Codex te preguntará:

> ¿Quién recibirá el producto como DEV/OPS?

Por ejemplo: “Ana Muñoz”. La herramienta prepara la invitación con ese nombre:

```sh
closelly-aiplc po invite --dev-name "Ana Muñoz"
```

La invitación queda en `docs/aiplc/09-handoff/INVITACION-DEV.md`. Revisa el paquete
comercial, el prototipo y la película, confirma la entrega y comparte el repositorio
junto con la invitación por el canal que uses con esa persona. La herramienta no
envía correos ni necesita crear una cuenta para el invitado.

La película requiere preparar sus herramientas y voz según [video.md](video.md).
El instalador básico permite empezar Discovery; no acredita un render multimedia.

## 4. El DEV/OPS abre la invitación y se presenta

Ana abre el producto recibido en Codex y escribe:

> Me llamo Ana Muñoz. El PO me invitó a recibir este producto. Usa
> $closelly-aiplc-dev y guíame paso a paso.

La herramienta comprueba que el nombre coincide con el destinatario indicado por
el PO. Tolera diferencias de mayúsculas, tildes y espacios. Si no coincide, pide
revisarlo con el PO antes de continuar. El comando equivalente es:

```sh
closelly-aiplc dev onboard --name "Ana Muñoz"
closelly-aiplc dev resume
```

El DEV/OPS recorre negocio, producto, materiales, película, prototipo y decisiones.
Después prepara viabilidad, arquitectura, IA, planificación y readiness. A partir
de READY, el equipo sigue su proceso habitual de construcción, pruebas y operación.

## Retomar el trabajo

Abre la misma carpeta y pide: “Continúa desde donde quedamos y muéstrame qué falta”.
La identificación se conserva localmente en esa copia del producto. En una copia
nueva, el PO puede volver a presentarse con `po identify --name "Luis"`; el DEV/OPS
puede usar otra vez `dev onboard --name "Ana Muñoz"`.

Los nombres son los que cada persona declara para este trabajo. El acceso al
repositorio lo administra el equipo con sus herramientas habituales.

Para productos creados con 0.1.x, consulta [la actualización a 0.2](upgrading.md).
