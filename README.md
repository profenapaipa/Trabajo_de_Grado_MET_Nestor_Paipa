# Proyecto de tesis y prototipo

Carpeta madre del proyecto de tesis de maestría "Uso de EEG para explorar la influencia de herramientas con agentividad en el control inhibitorio durante la resolución del juego La Escalera en niños con Trastorno del espectro Autista - TEA nivel 1" y su prototipo tecnológico asociado (sistema de 10 cubos inteligentes).

## Documentos de control del proyecto

- [`ESTADO_PROYECTO.md`](./ESTADO_PROYECTO.md) — panel visual de fases, progreso y próxima acción.
- [`DECISIONES_PROYECTO.md`](./DECISIONES_PROYECTO.md) — decisiones ya consolidadas (nomenclatura, hardware, arquitectura de red, HRS-EDU, reglas editoriales).
- [`PENDIENTES_TESIS.md`](./PENDIENTES_TESIS.md) — registro estructurado de pendientes, priorizados y con su evidencia necesaria.

## Estructura

- `Trabajo_de_Grado_MET_Nestor_Paipa/` — documento de la tesis en LaTeX (`main.tex`), bibliografía, figuras y anexos.
- `Desarrollo_cubos_juego_escalera/` — prototipo tecnológico: backend (`Backend-Cubos-Inteligentes-main/`), frontend (`Frontend-Cubos-Inteligentes-main/`), firmware del ESP32 maestro, manual de hardware y guías de conexión/diagnóstico.

## Protocolo de inicio para Claude Code

Antes de modificar cualquier archivo de este proyecto, en cualquier sesión futura:

1. Leer `README.md` (este archivo).
2. Leer `DECISIONES_PROYECTO.md` — no volver a discutir ni contradecir por inferencia lo que ya está ahí consolidado.
3. Leer `PENDIENTES_TESIS.md` — identificar qué está realmente abierto y con qué prioridad.
4. Leer `ESTADO_PROYECTO.md` — identificar la fase actual y su estado exacto.
5. Verificar el estado de Git (`git status`, `git log`) antes de asumir qué está o no confirmado.
6. Determinar exactamente qué fase está autorizada a ejecutarse en la sesión actual — nunca asumirlo del historial de chat.
7. No ejecutar fases posteriores a la autorizada, ni ampliar el alcance por iniciativa propia.

Cuando exista una contradicción entre estos archivos de control y la evidencia primaria (código, firmware, el propio `main.tex`, el manual, o los artículos citados), **detente y señala la contradicción explícitamente** — no la resuelvas por inferencia.
