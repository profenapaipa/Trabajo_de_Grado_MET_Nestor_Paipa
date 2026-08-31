# Checkpoint — Reunión con el director/tutor (01)

*Fotografía fija del estado del repositorio al preparar el paquete de reunión. Generado 2026-08-14 con los valores reales de `git log`/`git status`, no de memoria. Distinto de `ESTADO_PROYECTO.md` (panel vivo, que sigue siendo la fuente de verdad para el progreso por fases).*

## Último commit estable

```
db924a3  Alinea autonomía del prototipo con Mago de Oz
```
Autor: Napaipa — 2026-08-14 03:16:43 -0500. Confirmado con `git show --stat db924a3`: modifica `ESTADO_PROYECTO.md`, `PENDIENTES_TESIS.md`, `main.tex` (+4/-2) y `main.pdf` — corresponde al cierre parcial de la Fase 10 (líneas 2175 y 2177). **Commit hecho por el autor entre sesiones, no por el asistente.**

Historial reciente:
```
db924a3  Alinea autonomía del prototipo con Mago de Oz
4dbcfd4  Normaliza nomenclatura Actuar en la tesis
d4202a8  Consolida arquitectura tecnológica y control del proyecto
1370ddc  Actualiza materiales del prototipo tecnológico
143e398  Incorpora referencia HRS-EDU
775c7b6  Normaliza nomenclatura elegir a actuar
```

## Estado local (working tree)

Verificado con `git status`/`git diff --name-only` en el momento de generar este checkpoint:

- **Modificados, sin commitear**: `DECISIONES_PROYECTO.md` (línea de nomenclatura actualizada; nota sobre la arquitectura híbrida y el commit `d4202a8`), `PENDIENTES_TESIS.md` (registro de los hallazgos de la Fase 12: labels duplicados con causa raíz, "Participantes" duplicada y vacía, Figura 4.1 heredada de un estudio con TDAH).
- **Nuevos, sin trackear**: `INFORME_AVANCE_REUNION_TESIS.md`, `PRESENTACION_REUNION_DIRECTOR.md` (fuente única de las 15 diapositivas, incluidas las tablas de decisiones — sustituye a `ACTA_DECISIONES_REUNION_TESIS.md`, retirada por decisión del autor de unificar todo en el PowerPoint). El checkpoint actual (`CHECKPOINT_REUNION_DIRECTOR_01.md`) se añadirá también como no trackeado inmediatamente después de guardarse.
- `main.tex`/`main.pdf`: **sin cambios pendientes** — ya incluidos en `db924a3`.

## Estado GitHub

Remote `origin`: `https://github.com/profenapaipa/Trabajo_de_Grado_MET_Nestor_Paipa.git`, rama `main`. `git status` reporta "up to date with 'origin/main'" respecto del último commit local (`db924a3`) — es decir, el push de ese commit ya se hizo (por el autor, no por el asistente). Los archivos nuevos de este checkpoint todavía no se han subido.

## Fases cerradas

0, 1, 2, 3, 4, 5, 6 — ✅. **7** — ✅ (commit `d4202a8`). **9** — ✅ (commit `4dbcfd4`).

## Fases abiertas

- **8** ⏳ — Nota de alcance preexperimental, sin ejecutar.
- **10** 🟡 PARCIAL (commit `db924a3`) — 2 de 7 expresiones de autonomía corregidas; 5 pendientes, ligadas a la Fase 12.
- **11** ⏳ — Unificación de valores Pausar/Pensar/Actuar, dependencia (Fase 9) ya satisfecha, sin ejecutar.
- **12** 🔴 BLOQUEADA — Relación entre los dos guiones experimentales; análisis entregado (ver `INFORME_AVANCE_REUNION_TESIS.md`, sección 10, pregunta 2), decisión pendiente del director.
- **13, 14, 15** ⏳ — Dependen de que se resuelvan las Fases 8-12.

## Fases reservadas

16 (Resultados), 17 (Conclusiones/Trabajos futuros), 18 (Auditoría final de LaTeX) — 🔵, condicionadas a la ejecución experimental (EEG).

## Archivos relevantes

- Control: `README.md`, `ESTADO_PROYECTO.md`, `DECISIONES_PROYECTO.md`, `PENDIENTES_TESIS.md`.
- Tesis: `Trabajo_de_Grado_MET_Nestor_Paipa/main.tex`, `main.pdf` (79 páginas).
- Paquete de esta reunión: `INFORME_AVANCE_REUNION_TESIS.md` (respaldo escrito detallado), `PRESENTACION_REUNION_DIRECTOR.md` (fuente única para generar el PowerPoint, con las tablas de decisiones integradas en las diapositivas 13-14), este checkpoint.

## Decisiones pendientes

Las 8 preguntas de `INFORME_AVANCE_REUNION_TESIS.md` (sección 10): diseño de investigación, relación entre los dos guiones, Mago de Oz explícito, familiarización, muestra, ética, variables/evidencias, entrevista.

## Documentos generados para la reunión

1. `INFORME_AVANCE_REUNION_TESIS.md` — creado (respaldo escrito).
2. `PRESENTACION_REUNION_DIRECTOR.md` — creado; fuente única de las 15 diapositivas, para entregar como contexto a Claude Escritorio y obtener el `.pptx`. Las diapositivas 13 y 14 contienen las tablas de las 8 decisiones con su contexto, columna "Decisión tomada" vacía a propósito.
3. `CHECKPOINT_REUNION_DIRECTOR_01.md` — este documento.
4. Presentación HTML de 14 diapositivas (Artifact, sesión anterior) — **superada** por `PRESENTACION_REUNION_DIRECTOR.md`; ya no incluye la tabla de decisiones integrada, así que el `.pptx` a generar debe partir del nuevo archivo `.md`, no del Artifact.

## Nota de cierre

Ningún `git add`, `commit` ni `push` se ejecutó en esta sesión sobre los documentos nuevos. `ACTA_DECISIONES_REUNION_TESIS.md` fue retirado (nunca estuvo commiteado) por decisión explícita del autor de unificar todo en el PowerPoint. La Fase 12 permanece 🔴 BLOQUEADA y la Fase 10 en 🟡 PARCIAL hasta que exista una decisión registrada en las diapositivas 13-14 de `PRESENTACION_REUNION_DIRECTOR.md`.
