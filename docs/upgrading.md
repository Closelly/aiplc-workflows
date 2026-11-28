# Actualizar Closelly AI-PLC

La versión 0.2 permite crear productos con el nombre del PO y elegir al DEV/OPS al
preparar la entrega. El DEV/OPS recibe una invitación y se identifica con el nombre
que indicó el PO. No se necesitan claves para este recorrido.

## Actualizar la herramienta

Repite el comando de instalación del README para instalar la última versión publicada. Abre una
terminal nueva y comprueba `closelly-aiplc version`. En el chat pide al asistente
que vuelva a leer la skill instalada antes de continuar.

## Confirmaciones por chat desde 0.2.1

El asistente prepara la revisión, te pregunta en el chat y registra tu respuesta.
Ya no tienes que confirmar otra vez en una terminal. Pídele que vuelva a leer la
skill actualizada y retome el estado real. Las preguntas usan el control nativo
disponible, con una decisión por vez y opciones breves.

Puedes continuar un producto de 0.2.0 con este mecanismo. No modifica su historial,
sus schemas ni los documentos de la metodología fijada. Las decisiones ya registradas
se conservan. Una aprobación aún pendiente se prepara y se presenta con el mecanismo
actual antes de registrarla. No cierres el paso editando a mano state.json.

## Si todavía no creaste un producto

Empieza directamente con tu nombre según [getting-started.md](getting-started.md).
No prepares claves ni datos del DEV/OPS para comenzar Discovery.

## Si ya tienes un producto de 0.1.x

Su historial conserva el formato anterior. La nueva CLI lo reconoce y mantiene sus
firmas y schemas; no cambia personas ni convierte aprobaciones automáticamente.
Puedes continuar con su configuración anterior o iniciar otro producto con el
nuevo recorrido y trasladar los documentos que quieras reutilizar. Conserva la
carpeta original: no la borres ni sustituyas su historial para cambiar de formato.

Una entrega ya sellada se conserva tal cual. La invitación por nombre pertenece a
los productos nuevos; no reemplaza la identidad ni los recibos de un sello anterior.
