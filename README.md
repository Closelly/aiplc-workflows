# Closelly AI-PLC Workflows

Closelly AI-PLC lleva un producto nuevo desde su idea hasta la entrega comercial y la
preparación técnica. La CLI `closelly-aiplc` controla el orden, la trazabilidad, las
aprobaciones y el sello Git. ChatGPT/Codex investiga, redacta y guía a cada responsable
usando los encargos del motor y las Agent Skills.

## Ejecutar o instalar

Requiere Git y OpenSSH con firmas Ed25519. Para compilar desde el código, usa [Bun 1.3+](https://bun.sh/docs/installation).
El binario compilado incluye Bun y se distribuye junto a `dist/assets` y `dist/vendor`.

```sh
bun install --frozen-lockfile
bun run check
bun test
bun run build
./dist/closelly-aiplc version
./dist/closelly-aiplc doctor --core
```

Instala en un directorio explícito si quieres que el comando esté en PATH. La instalación
de las skills en Codex también es explícita y el instalador rechaza destinos ocupados.

```sh
./install.sh --prefix "$HOME/.local/closelly-aiplc" --skills-dir "$HOME/.agents/skills"
export PATH="$HOME/.local/closelly-aiplc/bin:$PATH"
```

## Iniciar un producto

El PO y el DEV generan o eligen **claves SSH Ed25519 distintas**. Solo se comparten las
públicas `.pub`. Por ejemplo, cada persona puede crear la suya con
`ssh-keygen -t ed25519 -f /ruta/segura/mi-clave-aiplc`. Guarda las claves fuera del
repositorio. Usa `ssh-add` y la ruta pública si firmas con ssh-agent.

El directorio destino debe ser nuevo y estar fuera de otro Git. Puedes usar los comandos
siguientes con un binario instalado o sustituir `closelly-aiplc` por su ruta absoluta.

```sh
closelly-aiplc po init /ruta/producto-nuevo \
  --po-key /ruta/po.pub --dev-key /ruta/dev.pub \
  --po-id product-owner --dev-id developer \
  --name "Producto Nuevo" --idea "Problema y cliente inicial"
cd /ruta/producto-nuevo
export AIPLC_PO_KEY="/ruta/segura/mi-clave-o-publica-en-ssh-agent"
closelly-aiplc po start
closelly-aiplc po resume
```

`po init` ejecuta `git init`. En la raíz crea solo `AGENTS.md`, `docs/` y el directorio
interno `.git/`. La definición y el estado PO quedan en `docs/aiplc/`. Las carpetas
`docs/business/`, `docs/technical/` y `docs/operations/` reflejan el conocimiento vigente.
El estado DEV aparece en `docs/technical/aiplc/state.json` al iniciar su onboarding.

## PO · Definición y entrega

Abre el nuevo producto en Codex e invoca `$closelly-aiplc-po`. Si prefieres otro entorno,
`config --harness portable` y `harness context po --json` exponen el mismo encargo.
Los operadores controlan las transiciones con su clave. Las aprobaciones se firman
en una terminal interactiva.

| Fase | Resultado | Gate PO |
| --- | --- | --- |
| Discovery | Problema, evidencia, hipótesis y decisiones | |
| Definición | Propuesta, alcance, reglas y resultados | Negocio |
| AI-native | Oportunidades, control humano, evaluación y fallback | |
| Marca y creatividad | Fuentes, capturas, tres rutas, taller y tokens | Creatividad |
| UX/UI | Prototipo, flujos, accesibilidad y evidencia | Experiencia |
| Especificaciones | Requisitos con criterios, datos e integraciones | |
| Validación y pruebas | Cobertura, resultados de prototipo y casos pendientes de implementación | |
| Marketing, ventas y growth | Tres fases, experimentos, presupuesto y tareas del PO | Comercial |
| Handoff | Paquete comercial, presentación, prototipo y película para el DEV | Handoff |

- `po status` muestra avance y faltantes. `po resume` entrega el encargo a Codex con instrucciones, schemas y salidas.
- `po scaffold` crea borradores Markdown sin sobrescribir trabajo. `po validate` comprueba artefactos. `po advance` cierra la fase activa.
- `po approve --note "Qué revisé y qué decidí"` registra el gate de la fase y la versión exacta de los archivos.
- `po revise ID-FASE --note "Motivo y efecto"` vuelve a la primera fase afectada. Renueva las aprobaciones posteriores y conserva los archivos para revisarlos.

Para preparar la entrega, completa `briefing.json`, `video-plan.json` y el handoff
comercial dentro de `docs/aiplc/09-handoff/`. Sigue la [guía de video](docs/video.md).
Revisa el paquete y deja evidencia en `validation-report.md` antes de firmar.

```sh
closelly-aiplc doctor --probe
closelly-aiplc po handoff --prepare
closelly-aiplc po approve --note "Revisé el prototipo, las presentaciones y el MP4."
closelly-aiplc po handoff
```

El cierre crea un commit y el tag `aiplc-baseline-v1`. Configura el nombre y correo de
Git para el producto antes de cerrar y deja libre su área de preparación. Comparte el
repositorio con el DEV por el canal de Git que el equipo use y conserva el tag. El PO
tiene su estrategia, materiales y plan de acción en su handoff comercial.

## DEV · Recepción y preparación

Abre el repositorio recibido y verifica que incluya el tag. En Codex invoca
`$closelly-aiplc-dev` o usa `dev resume`. El DEV configura `AIPLC_DEV_KEY` con su
propia clave.

```sh
closelly-aiplc dev onboard
closelly-aiplc dev resume
closelly-aiplc dev ack welcome --note "Revisé el objetivo y el recorrido."
```

El recorrido presenta negocio, pitch, presentaciones, película, prototipo, estructura,
requisitos y dudas en ese orden. El paso `video-briefing` exige una confirmación
interactiva. Al terminar, redacta `understanding.md`, ejecuta `dev approve` y `dev advance`.
`dev clarify --reference RUTA --note "Pregunta" --blocking` registra una duda que el
PO puede responder con `po answer Q-ID --note "Respuesta"`. Un cambio de alcance va
primero en la documentación vigente de negocio mediante `knowledge update`.

Las fases posteriores son discovery técnico, arquitectura (`dev architect`),
diseño técnico de IA, planificación (`dev plan`) y readiness (`dev ready --note ...`).
Cada fase entrega documentos y verificaciones. A partir de READY el equipo continúa
con su práctica habitual de implementación, pruebas y operación.

## Conocimiento, estados y límites

`knowledge audit` comprueba el sello, el historial de actualizaciones y dudas pendientes.
`knowledge update business|technical|operations RUTA --from ARCHIVO --reference RUTA_ORIGEN --note ...`
registra un cambio y su responsable. Los cambios de negocio los firma el PO. Añade
`--scope-change` al modificar el alcance. Architecture y Operations deben distinguir
lo planeado de lo que se observa en producción.

Las claves de rol se verifican localmente y las aprobaciones se ligan a los archivos.
Quien controla el disco, el ejecutable y las claves controla la política local. Para
una frontera organizacional usa custodia separada de claves, protección de ramas y
tags, revisión del digest o tag por un canal confiable y permisos de repositorio
administrados. Detalles en [arquitectura y recuperación](docs/architecture.md).

Consulta [cómo se probó](docs/verification.md) y `closelly-aiplc help`.
