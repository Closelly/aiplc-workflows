# Película de onboarding con HyperFrames

El PO prepara el plan desde documentos revisados. El motor produce una película 1080p
con animaciones, voz sintetizada, capítulos, transcripción, un SRT y una pista de
subtítulos seleccionable en el MP4. El archivo completo y sus fuentes se incluyen en
el repositorio del nuevo producto. La duración depende de la narración y las escenas.

## Preparar el entorno

Usa Node.js 22.12 o superior, FFmpeg, FFprobe y Chrome/Chromium. La versión probada de
HyperFrames es `0.9.104`. El [repositorio oficial](https://github.com/heygen-com/hyperframes/tree/v0.9.104/skills)
incluye `hyperframes`, `hyperframes-cli`, `hyperframes-registry` y `media-use`.
Instala esos cuatro nombres en Codex con el [procedimiento oficial](https://github.com/heygen-com/hyperframes#agent-skills)
o coloca las carpetas oficiales de esa release en un directorio de skills.
Configura `AIPLC_HYPERFRAMES_SKILLS` si no están en `~/.agents/skills`. El lanzador
oficial selecciona la versión fijada. Si ya instalaste la CLI oficial en un prefijo
aislado, puedes indicar su ruta absoluta con `AIPLC_HYPERFRAMES_BIN`.

```sh
# En el producto. La voz debe estar instalada y corresponder al idioma del guion.
say -v '?'
closelly-aiplc config --language es-CL --tts say --voice Paulina
closelly-aiplc doctor --probe
```

`say` usa las voces del sistema en macOS. Algunas sesiones de Codex restringen al
proceso de voz y Chrome. Si el diagnóstico encuentra ese caso, ejecuta la CLI desde
una terminal local con acceso a los servicios del sistema. No se necesita clave de
servicios de voz para esta ruta.

Para usar otro proveedor, configura un ejecutable de confianza en la ruta absoluta
`AIPLC_TTS_BIN` y `config --tts command --voice NOMBRE`. El proveedor debe implementar
`--check --voice NOMBRE --language IDIOMA` y producir WAV en
`--input TEXTO --output WAV --voice NOMBRE --language IDIOMA`. Usa
`--credential-env NOMBRE_VARIABLE` cuando necesite credenciales. El valor se toma solo
del entorno del operador. Habilita un proveedor remoto únicamente si puede recibir
la narración del producto. El motor detecta ausencia de la variable y fallas del
proveedor sin registrar la clave.

## Plano, revisión y reproducción

1. Escribe `briefing.json` para los resúmenes y los tres PowerPoint. Los campos
   requeridos están en los schemas `briefing` y `video-plan` del snapshot de metodología.
2. Crea capítulos con categorías `product`, `prototype`, `business` y `marketing`.
   Puedes agregar capítulos `other`. Cada uno cita artefactos de las primeras ocho
   fases, y cada escena indica título, mensaje, puntos y frases narradas. Usa frases
   cortas para leer los subtítulos. Las escenas `prototype` muestran una de las
   capturas aprobadas y su punto de foco en coordenadas porcentuales.
3. Ejecuta `po handoff --prepare`. Se generan las presentaciones, se sintetizan los
   cues y se renderizan capítulos. HyperFrames verifica las composiciones. La CLI
   ensambla el MP4, sincroniza subtítulos con la duración efectiva de los cues y
   comprueba audio, capítulos, resolución y consistencia del paquete con FFprobe.
4. Abre el video y revisa legibilidad, voz, subtítulos, cortes, capítulos y cobertura.
   Recorre el prototipo y revisa los tres PowerPoint. Registra la revisión y cualquier
   corrección en `validation-report.md`. El PO confirma en el chat después de revisar
   el paquete; el asistente registra su respuesta con la revisión correspondiente.

El paquete `video-source/` contiene HTML, animación, audio WAV, capturas, guion,
storyboards y comprobaciones. Ejecuta `sh reproduce.sh /ruta/film.mp4` desde ese
directorio con el mismo HyperFrames y los demás requisitos. Usa los WAV incluidos.
Al cambiar un insumo se vuelve a verificar el paquete y se renderiza la versión
vigente antes de sellar. La identidad visual depende de los tokens y las fuentes
disponibles en el equipo. El renderer produce el resultado verificable, y el PO
tiene la decisión editorial sobre claridad, ritmo y pertinencia.
