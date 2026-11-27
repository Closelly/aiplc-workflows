# Tu primer producto

Esta guía usa macOS, Linux o WSL y Codex con acceso a archivos y terminal. El PO es
la persona responsable del producto; el DEV es quien recibe después la definición
para preparar su implementación. No necesitas trabajar con ambos a la vez.

## 1. Instala una vez

Usa el comando de instalación del README. Abre una terminal nueva y ejecuta `closelly-aiplc doctor --core`.
Si la skill no aparece en Codex, abre una sesión nueva o reinicia la aplicación.

## 2. Pide ayuda en el chat

Abre una carpeta de trabajo en Codex y escribe:

> Usa $closelly-aiplc-po para iniciar un producto nuevo llamado Taller de pedidos.
> Quiero explorar el problema de recibir y seguir encargos. Ayúdame a preparar una
> carpeta independiente y mis identidades. Guíame en Discovery y detente antes de
> pedir o registrar cualquier aprobación.

El asistente puede preparar los comandos y documentos. Una pregunta de Discovery
sirve para conocer tu caso; no equivale a una aprobación del flujo.

## 3. Prepara las identidades

Cada responsable debe custodiar una clave SSH Ed25519 distinta. En una terminal,
el PO puede crear la suya así, eligiendo una ruta que todavía no exista:

```sh
mkdir -p "$HOME/.ssh"
ssh-keygen -t ed25519 -f "$HOME/.ssh/closelly-aiplc-po"
```

Usa una contraseña para proteger una clave real. El DEV genera su propia clave y
comparte únicamente el archivo `.pub`. Pide al asistente que adapte los comandos a
las rutas reales. Nunca pegues ni subas una clave privada al chat o al repositorio.
Si usas contraseña, carga tu clave en `ssh-agent` y utiliza la ruta pública al firmar.

Para una demostración ficticia pueden prepararse dos claves temporales en una
carpeta privada externa al producto, identificadas como claves de prueba. No las
reutilices para un producto real ni atribuyas sus firmas a otra persona.

## 4. Crea e inicia el producto

La carpeta destino debe ser nueva y estar fuera de cualquier otro Git. Sustituye
las rutas antes de ejecutar:

```sh
closelly-aiplc po init /ruta/producto-nuevo \
  --po-key /ruta/po.pub --dev-key /ruta/dev.pub \
  --name "Taller de pedidos" \
  --idea "Explorar la recepción y seguimiento de encargos"
cd /ruta/producto-nuevo
export AIPLC_PO_KEY="/ruta/clave-po-o-publica-cargada-en-ssh-agent"
closelly-aiplc po start
closelly-aiplc po resume --json
```

Abre ahora **la carpeta del producto** en Codex. Pide que lea el estado y continúe
con `$closelly-aiplc-po`. La carpeta de la herramienta y la del producto son distintas.

## 5. Trabaja por conversación

En Discovery el asistente identifica el segmento, el problema, las alternativas y
la evidencia. Te presenta preguntas y propuestas; tú describes ejemplos, corriges
supuestos y revisas documentos. Los primeros resultados son `brief.md`,
`research.json` y `decisions.md` dentro de `docs/aiplc/01-discovery/`.

`po status` muestra el estado y archivos ausentes. Que no falten archivos no significa
que estén completos: `po validate` también comprueba su contenido y los borradores
siguen pendientes. `po resume` informa qué hacer; no llama por sí mismo a un modelo
ni investiga automáticamente. La redacción la hace el asistente con las herramientas
disponibles en tu chat. No se necesita una clave de la API de OpenAI para este adaptador.

Más adelante hay etapas de definición, IA, marca, experiencia, especificaciones,
validación, estrategia comercial y entrega. Los puntos de aprobación pertenecen a
la persona responsable y requieren su terminal. El instalador no los ejecuta. DEV
solo comienza después de que el PO cierre y selle su entrega.

## Retomar y pedir ayuda

Abre la misma carpeta y pide: “Continúa el flujo PO desde su estado real. Muéstrame
qué está completo y qué falta”. Si aparece un bloqueo, comparte el mensaje y la
versión, sin claves ni información privada.

Consulta [instalación](installation.md) para problemas con PATH o skills, y
[video](video.md) antes de preparar la entrega multimedia.
