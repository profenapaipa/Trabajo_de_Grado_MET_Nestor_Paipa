# ESTADO DEL PROYECTO

*Última actualización: 2026-08-14*

Panel de control del proyecto de tesis "Uso de EEG para explorar la influencia de herramientas con agentividad en el control inhibitorio durante la resolución del juego La Escalera en niños con Trastorno del espectro Autista - TEA nivel 1" y su prototipo tecnológico asociado (cubos inteligentes).

Leyenda: ✅ COMPLETADA · 🟡 EN CURSO / EN PLANIFICACIÓN (análisis y preparación, sin ejecutar todavía) · 🔴 BLOQUEADA · ⏳ PENDIENTE · 🔵 RESERVADA (post-experimental)

> **Nota de numeración (2026-08-14):** una instrucción reciente del autor se refirió a la normalización "Elegir → Actuar en `main.tex`" como "Fase 8". La tabla canónica de este archivo —consistente con las dependencias ya registradas para las Fases 10 y 11 en `PENDIENTES_TESIS.md`— la identifica como **Fase 9**. La Fase 8 real es "Nota de alcance preexperimental" y permanece sin tocar. Se mantiene la numeración ya establecida para no romper la consistencia entre los 4 archivos de control; se señala aquí en vez de resolverse por inferencia, a la espera de que el autor confirme o corrija.

---

## Tabla general de fases

| Fase | Nombre | Estado | Dependencias | Próximo paso |
|---|---|---|---|---|
| 0 | Preparación | ✅ | Ninguna | — |
| 1 | Diagnóstico integral | ✅ | Fase 0 | — |
| 2 | Reanálisis metodológico (etapa preexperimental, Mago de Oz, fuente de verdad = código) | ✅ | Fase 1 | — |
| 3 | Auditoría HRS-EDU (lectura completa del artículo primario) | ✅ | PDF disponible (commit `143e398`) | — |
| 4 | Normalización de código Elegir → Actuar (carpeta `actions/elegir/` → `actions/actuar/`) | ✅ | Ninguna | — |
| 5 | Incorporación del PDF de referencia HRS-EDU al proyecto | ✅ | Ninguna | — |
| 6 | Actualización inicial de Materiales (protocolo real, hub, brecha de sonido) | ✅ | Fases 4-5 | — |
| 7 | Arquitectura tecnológica (3 figuras + 2 tablas + arquitectura híbrida: canal de posición cableado + canal de actuación WiFi/TCP 3333) | ✅ | Fase 6 | — (commit `d4202a8`) |
| 8 | Nota de alcance preexperimental (Metodología/Resultados) | ⏳ | Ninguna | Autorizar redacción |
| 9 | Elegir → Actuar en el resto de `main.tex` (13 puntos ejecutados: 8 ocurrencias de texto + 5 líneas de identificadores TikZ; 5 ocurrencias dentro de los guiones quedaron intactas, ligadas a la Fase 12; 1 uso verbal genérico intacto) | ✅ | Fase 7 cerrada; nombre oficial ACTUAR confirmado; código ya normalizado | — (compilado y verificado; sin commit todavía) |
| 10 | Corrección del lenguaje de autonomía (Mago de Oz) — 5 ubicaciones mapeadas | ⏳ | Fase 9 (parcial); la parte dentro del Guión técnico depende de la Fase 12 | Autorizar sub-zona B1 (Propuesta estructural) |
| 11 | Unificación de valores PAUSAR/PENSAR/ACTUAR (fuente de verdad = `App.tsx`) | ⏳ | Fase 9; la parte dentro del Guión técnico depende de la Fase 12 | Autorizar sub-zona E1 (Propuesta estructural) |
| 12 | Relación entre los dos guiones experimentales (verbal/gestual vs. técnico de cubos) | 🔴 BLOQUEADA | Decisión metodológica del autor | El autor define si son condiciones comparativas, protocolo integrado, o versiones sucesivas |
| 13 | Metodología (Participantes/Procedimiento en modo prospectivo) | ⏳ | Fases 8-12 | — |
| 14 | Puente conceptual HRS-EDU (referente → adaptación → simplificación → implementación → futuro) | ⏳ | Ninguna | Autorizar redacción del párrafo |
| 15 | Bibliografía (3 referencias pendientes + duplicado Frith + BibTeX) | ⏳ | Ninguna | Autorizar verificación |
| 16 | Resultados | 🔵 RESERVADA | Ejecución de la fase experimental (EEG) | Esperar datos reales |
| 17 | Conclusiones / Trabajos futuros | 🔵 RESERVADA | Fase 16 | Esperar Fase 16 |
| 18 | Auditoría final de LaTeX | 🔵 RESERVADA | Todas las anteriores | — |

---

## Progreso visual

```
PREPARACIÓN        ████████████████████ 100%
DIAGNÓSTICO        ████████████████████ 100%
HRS-EDU            ████████████████████ 100%
CÓDIGO             ████████████████████ 100%
MATERIALES         ████████████████████ 100%
ARQUITECTURA       ████████████████████ 100% (cerrada, commit `d4202a8`)
METODOLOGÍA        ░░░░░░░░░░░░░░░░░░░░  Pendiente
EXPERIMENTO        ░░░░░░░░░░░░░░░░░░░░  Reservado
```

### Checklist visual — Fase 0 a Fase 18

- ✅ Fase 0 — Preparación
- ✅ Fase 1 — Diagnóstico integral
- ✅ Fase 2 — Reanálisis metodológico (preexperimental, Mago de Oz, fuente de verdad = código)
- ✅ Fase 3 — Auditoría HRS-EDU
- ✅ Fase 4 — Normalización de código Elegir → Actuar
- ✅ Fase 5 — Incorporación del PDF HRS-EDU
- ✅ Fase 6 — Actualización inicial de Materiales
- ✅ Fase 7 — Arquitectura tecnológica (commit `d4202a8`)
- ⏳ Fase 8 — Nota de alcance preexperimental
- ✅ Fase 9 — Elegir → Actuar en el resto de `main.tex`
- ⏳ Fase 10 — Corrección del lenguaje de autonomía (Mago de Oz)
- ⏳ Fase 11 — Unificación de valores PAUSAR/PENSAR/ACTUAR
- 🔴 Fase 12 — Relación entre los dos guiones experimentales (bloqueada)
- ⏳ Fase 13 — Metodología (Participantes/Procedimiento, modo prospectivo)
- ⏳ Fase 14 — Puente conceptual HRS-EDU
- ⏳ Fase 15 — Bibliografía
- 🔵 Fase 16 — Resultados (reservada)
- 🔵 Fase 17 — Conclusiones / Trabajos futuros (reservada)
- 🔵 Fase 18 — Auditoría final de LaTeX (reservada)

### Checklist de control académico

**Documentación**
- ✅ `README.md`, `ESTADO_PROYECTO.md`, `DECISIONES_PROYECTO.md`, `PENDIENTES_TESIS.md` creados y sincronizados con el estado real del repositorio
- ✅ Historial de commits verificado con `git log`/`git show` antes de registrarse (nunca inventado)
- ✅ Normalización "Elegir" → "Actuar" ejecutada en `main.tex` (Fase 9): 13 puntos corregidos, compilado y verificado visualmente
- ⏳ Nota de alcance preexperimental sin redactar (Fase 8)

**Prototipo**
- ✅ Hardware confirmado por el autor (ESP32-C3 SuperMini, ESP32 DevKit V1, Power Bank, batería 3.7V/180mAh) y verificado contra el firmware instalado
- ✅ Arquitectura híbrida de dos canales (posición cableada + actuación WiFi/TCP 3333) verificada y documentada
- ⏳ Protocolo eléctrico exacto del cableado cubo-base sin resolver
- ⏳ Función exacta del acoplamiento magnético respecto al ESP32-C3 sin resolver

**Visual (`main.pdf`)**
- ✅ Figuras 4.1 a 4.7 y Tablas 4.3/4.4 verificadas dentro del margen útil de página (compilado y revisado visualmente)
- ✅ Figura 4.2 normalizada, incluido el identificador TikZ interno (`elegir`→`actuar`, `emo_elegir`→`emo_actuar`, Fase 9)
- ✅ Compilación sin errores fatales tras el cierre de la Fase 7 y tras la ejecución de la Fase 9 (2 pasadas de `pdflatex`, 79 páginas ambas veces)
- ✅ Verificación visual repetida tras la Fase 9 (páginas 16, 18, 54, 55 y 64 revisadas directamente)

---

## FASE ACTUAL

**FASE 9 — ELEGIR → ACTUAR EN EL RESTO DE `main.tex`**

Estado: ✅ CERRADA (fecha de cierre: 2026-08-14). Se ejecutaron los 13 puntos en alcance: 8 sustituciones de texto visible ("Elegir"→"Actuar" en líneas 364, 440, 1989, 2086, 2089, 2090, 2177, 2543) y el renombrado atómico de los 5 puntos de identificadores TikZ (`elegir`→`actuar` en su definición y 2 referencias `\draw`; `emo_elegir`→`emo_actuar` en su definición y 2 referencias `\draw`). Las 5 ocurrencias dentro de los guiones experimentales (líneas 2746, 2789, 2794, 2824, 2844) y el uso verbal genérico (línea 938) se dejaron intactos, tal como exigía el alcance. Compilado 2 veces con `pdflatex -interaction=nonstopmode -halt-on-error` — 0 errores fatales, 79 páginas en ambas pasadas, sin error "shape unknown". Verificación visual directa de las páginas 16, 18, 54, 55 y 64 confirmó el texto y el diagrama TikZ correctos, sin defectos gráficos nuevos. `grep -in elegir main.tex` posterior a la edición devuelve exactamente las 6 líneas esperadas fuera de alcance.

**Hallazgo registrado, no corregido** (regla de alcance): se detectaron etiquetas LaTeX duplicadas preexistentes (`\label{MWM1}` en líneas 550/598; `\label{fig:placeholder}` en 10 ubicaciones distintas, líneas 1973–2673) — ninguna coincide con las líneas editadas en esta fase, por lo que se confirma que no fueron introducidas por la Fase 9. Registrado en `PENDIENTES_TESIS.md`, sin corregir.

Resumen de la Fase 7 (cerrada): se incorporó evidencia física confirmada por el autor sobre ESP32-C3 SuperMini (cubos), ESP32 DevKit V1 (maestro), alimentación (batería Li-Po 3.7V/180mAh en el cubo, Power Bank en el maestro), acoplamiento magnético y cableado de las bases. Se verificó contra el firmware disponible (`Maestro___Wifi_copy_20260813194508.ino`, confirmado por el autor como el firmware físicamente instalado) y se documentó la arquitectura híbrida de dos canales: posición (cableado, GPIO del maestro) y actuación (WiFi/TCP:3333). Cierre registrado en el commit `d4202a8` ("Consolida arquitectura tecnológica y control del proyecto").

## PRÓXIMA ACCIÓN

Decidir si se hace commit de la Fase 9 (normalización Elegir→Actuar en `main.tex`, ya verificada) y del alistamiento del repositorio para GitHub privado. En paralelo, sin bloqueo, también pueden autorizarse la Fase 8 (nota de alcance preexperimental), la Fase 10 (lenguaje de autonomía) o la Fase 14 (puente conceptual HRS-EDU). La Fase 12 (relación entre los dos guiones experimentales) sigue bloqueada a la espera de una decisión metodológica del autor.

---

## Historial de commits importantes

| Commit | Mensaje | Fecha |
|---|---|---|
| `dcae481` | Estado inicial antes de revisión integral de tesis | 2026-08-13 |
| `775c7b6` | Normaliza nomenclatura elegir a actuar | 2026-08-13 |
| `143e398` | Incorpora referencia HRS-EDU | 2026-08-13 |
| `1370ddc` | Actualiza materiales del prototipo tecnológico | 2026-08-13 |
| `d4202a8` | Consolida arquitectura tecnológica y control del proyecto | 2026-08-14 |

La Fase 7 (arquitectura tecnológica: 3 figuras + 2 tablas + arquitectura híbrida de dos canales + correcciones heredadas de la Fase 6 + corrección de anchos de página + documentación persistente de control) quedó cerrada y committeada en `d4202a8`. `git status` confirma árbol de trabajo limpio tras ese commit.

---

## Registro de cambios

| Fecha | Fase | Acción | Resultado | Commit |
|---|---|---|---|---|
| 2026-08-13 | 0-1 | Diagnóstico integral inicial del proyecto (tesis + prototipo) | Completado | `dcae481` (estado base) |
| 2026-08-13 | 4 | Rename `actions/elegir/` → `actions/actuar/` en el frontend | Completado, verificado sin romper la compilación | `775c7b6` |
| 2026-08-13 | 5 | Incorporación del PDF "Human-Robot Scaffolding" al proyecto | Completado | `143e398` |
| 2026-08-13 | 6 | Actualización de Materiales: protocolo real (WiFi), modelo de hub, brecha de sonido | Completado, compiló sin errores nuevos | `1370ddc` |
| 2026-08-14 | 7 | Arquitectura tecnológica: 3 figuras TikZ + 2 tablas en "Funcionamiento electrónico/lógico de los cubos"; corrección con evidencia física (ESP32-C3 SuperMini, ESP32 DevKit V1, Power Bank, canal de posición cableado); corrección de Figura 4.2 y captions de Figuras 4.3/4.4 | En corrección — compiló sin errores fatales, sin commit todavía | *(pendiente)* |
| 2026-08-14 | 7 | Cierre definitivo: confirmación del autor de que TCP 3333/el firmware disponible es el instalado; corrección heredada de "Descripción técnica de los cubos" y "Funcionamiento electrónico de la base" (ESP32-C3 SuperMini / ESP32 DevKit V1 / batería 3.7V-180mAh); corrección de ancho de Figuras 4.1, 4.3 y 4.4; consolidación de tono (buzzer como componente de la arquitectura, no como defecto); creación de los 4 archivos de control | ✅ Cerrada — compiló sin errores fatales tras corregir un error de sintaxis TikZ (salto de línea en modo LR) | `d4202a8` |
| 2026-08-14 | 9 | Auditoría completa de ocurrencias "Elegir/elegir" en `main.tex` (19 localizadas, clasificadas en 5 categorías); actualización de los 4 archivos de control (marcar Fase 7 cerrada con commit, poner Fase 9 en planificación, registrar hallazgo de las 5 ocurrencias dentro de los guiones ligadas a la Fase 12) | Auditoría y planificación completadas; ningún archivo de la tesis, firmware, frontend o backend fue modificado en esta sesión | *(sin commit — solo archivos de control)* |
| 2026-08-14 | 9 | Ejecución autorizada: sustitución "Elegir"→"Actuar" en 8 líneas de texto (364, 440, 1989, 2086, 2089, 2090, 2177, 2543) y renombrado atómico de 5 identificadores TikZ (`elegir`→`actuar`, `emo_elegir`→`emo_actuar`); registro (sin corregir) de labels duplicados preexistentes (`MWM1`, `fig:placeholder`) | ✅ Cerrada — compilado 2 veces sin errores fatales (79 páginas ambas pasadas), revisión visual de páginas 16/18/54/55/64 correcta, `grep -in elegir` final devuelve solo las 6 líneas fuera de alcance | *(pendiente — checkpoint de git revisado, sin commit todavía)* |

*Nota: no se registran fechas ni commits distintos de los verificados directamente con `git log`. Si una fase futura no tiene commit, esta tabla lo indica explícitamente como "(pendiente)" en vez de inventar uno.*
